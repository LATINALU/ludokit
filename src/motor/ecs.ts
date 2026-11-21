// Entity-Component-System con conjuntos dispersos (sparse sets), la estructura de los ECS modernos:
//   - Entidad = id numérico con generación (los ids reciclados no se confunden con los viejos).
//   - Cada tipo de componente vive en su propio almacén denso (iterar es recorrer un array contiguo).
//   - Consultas por varios componentes recorren el almacén más chico y filtran con lookups O(1).
//   - Sistemas = funciones ordenadas por fase; los cambios estructurales (crear/destruir) se pueden diferir a un
//     buffer de comandos para no invalidar iteraciones.
// Escala de un juego de un jugador a un servidor con decenas de miles de entidades.

export type Entidad = number;

const BITS_INDICE = 20;
const MASCARA_INDICE = (1 << BITS_INDICE) - 1;
export const indiceDe = (e: Entidad): number => e & MASCARA_INDICE;
export const generacionDe = (e: Entidad): number => e >>> BITS_INDICE;

/** Clave tipada de un componente: `const Posicion = componente<{x:number,y:number}>("posicion")`. */
export interface TipoComponente<T> {
  readonly nombre: string;
  readonly _t?: T;
}
export const componente = <T>(nombre: string): TipoComponente<T> => ({ nombre });

class Almacen<T> {
  readonly denso: Entidad[] = [];
  readonly valores: T[] = [];
  private readonly disperso = new Map<number, number>();

  tiene(e: Entidad): boolean {
    const i = this.disperso.get(indiceDe(e));
    return i !== undefined && this.denso[i] === e;
  }
  obtener(e: Entidad): T | undefined {
    const i = this.disperso.get(indiceDe(e));
    return i !== undefined && this.denso[i] === e ? this.valores[i] : undefined;
  }
  poner(e: Entidad, v: T): void {
    const i = this.disperso.get(indiceDe(e));
    if (i !== undefined && this.denso[i] === e) {
      this.valores[i] = v;
      return;
    }
    this.disperso.set(indiceDe(e), this.denso.length);
    this.denso.push(e);
    this.valores.push(v);
  }
  quitar(e: Entidad): boolean {
    const i = this.disperso.get(indiceDe(e));
    if (i === undefined || this.denso[i] !== e) return false;
    const ultimo = this.denso.length - 1;
    const eu = this.denso[ultimo];
    this.denso[i] = eu;
    this.valores[i] = this.valores[ultimo];
    this.disperso.set(indiceDe(eu), i);
    this.denso.pop();
    this.valores.pop();
    this.disperso.delete(indiceDe(e));
    return true;
  }
  get tamano(): number {
    return this.denso.length;
  }
}

export type Sistema = (mundo: MundoEcs, dt: number) => void;

export class MundoEcs {
  private readonly generaciones: number[] = [];
  private readonly libres: number[] = [];
  private readonly vivas = new Set<Entidad>();
  private readonly almacenes = new Map<string, Almacen<unknown>>();
  private readonly fases = new Map<string, Sistema[]>();
  private readonly ordenFases: string[] = [];
  private comandos: Array<() => void> = [];
  /** Recursos globales (tiempo, mapa, configuración): un valor por tipo. */
  readonly recursos = new Map<string, unknown>();

  crear(): Entidad {
    const i = this.libres.length > 0 ? this.libres.pop()! : this.generaciones.push(0) - 1;
    if (i > MASCARA_INDICE) throw new Error("ECS: demasiadas entidades");
    const e = ((this.generaciones[i] << BITS_INDICE) | i) >>> 0;
    this.vivas.add(e);
    return e;
  }

  vive(e: Entidad): boolean {
    return this.vivas.has(e);
  }

  destruir(e: Entidad): void {
    if (!this.vivas.delete(e)) return;
    for (const a of this.almacenes.values()) a.quitar(e);
    const i = indiceDe(e);
    this.generaciones[i] = (this.generaciones[i] + 1) & 0xfff;
    this.libres.push(i);
  }

  get cantidad(): number {
    return this.vivas.size;
  }

  private almacen<T>(t: TipoComponente<T>): Almacen<T> {
    let a = this.almacenes.get(t.nombre);
    if (!a) {
      a = new Almacen<unknown>();
      this.almacenes.set(t.nombre, a);
    }
    return a as Almacen<T>;
  }

  poner<T>(e: Entidad, t: TipoComponente<T>, v: T): this {
    if (!this.vivas.has(e)) throw new Error("ECS: entidad muerta");
    this.almacen(t).poner(e, v);
    return this;
  }
  obtener<T>(e: Entidad, t: TipoComponente<T>): T | undefined {
    return this.almacen(t).obtener(e);
  }
  requerir<T>(e: Entidad, t: TipoComponente<T>): T {
    const v = this.almacen(t).obtener(e);
    if (v === undefined) throw new Error(`ECS: falta ${t.nombre}`);
    return v;
  }
  tiene(e: Entidad, t: TipoComponente<unknown>): boolean {
    return this.almacen(t).tiene(e);
  }
  quitar(e: Entidad, t: TipoComponente<unknown>): void {
    this.almacen(t).quitar(e);
  }

  /** Itera entidades con TODOS los componentes pedidos. Recorre el almacén más chico. */
  *consultar<A, B = never, C = never, D = never>(
    a: TipoComponente<A>, b?: TipoComponente<B>, c?: TipoComponente<C>, d?: TipoComponente<D>,
  ): Generator<[Entidad, A, B, C, D]> {
    const tipos = [a, b, c, d].filter((x): x is TipoComponente<any> => x !== undefined);
    const alms = tipos.map((t) => this.almacen(t));
    let base = alms[0];
    for (const x of alms) if (x.tamano < base.tamano) base = x;
    const entidades = base.denso.slice();
    for (const e of entidades) {
      const vals = alms.map((x) => x.obtener(e));
      if (vals.some((v) => v === undefined)) continue;
      yield [e, vals[0] as A, vals[1] as B, vals[2] as C, vals[3] as D];
    }
  }

  /** Cambio estructural diferido: se aplica en `aplicarComandos` (al final de cada fase). */
  diferir(f: () => void): void {
    this.comandos.push(f);
  }

  aplicarComandos(): void {
    const c = this.comandos;
    this.comandos = [];
    for (const f of c) f();
  }

  /** Registra un sistema en una fase. Las fases corren en el orden en que se declararon por primera vez. */
  sistema(fase: string, s: Sistema): this {
    if (!this.fases.has(fase)) {
      this.fases.set(fase, []);
      this.ordenFases.push(fase);
    }
    this.fases.get(fase)!.push(s);
    return this;
  }

  /** Corre todas las fases en orden (llamar desde el paso fijo). */
  actualizar(dt: number): void {
    for (const f of this.ordenFases) {
      for (const s of this.fases.get(f)!) s(this, dt);
      this.aplicarComandos();
    }
  }

  recurso<T>(t: TipoComponente<T>): T | undefined {
    return this.recursos.get(t.nombre) as T | undefined;
  }
  ponerRecurso<T>(t: TipoComponente<T>, v: T): void {
    this.recursos.set(t.nombre, v);
  }
}
