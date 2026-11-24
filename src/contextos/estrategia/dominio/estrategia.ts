// Estrategia en tiempo real (RTS), defensa de torres (TD), construcción de bases y colonias:
//   - SELECCIÓN por rectángulo y por tipo, grupos de control (1-9).
//   - FORMACIONES: posiciones de N unidades alrededor de un punto (línea, columna, cuña, cuadro, círculo) orientadas.
//   - COLA DE PRODUCCIÓN por edificio: costo, tiempo, población, cancelar con reembolso.
//   - RECOLECTORES: ciclo ir → recolectar → volver → depositar, con capacidad y tiempos.
//   - ECONOMÍA DE TD: oro por enemigo, interés por oro guardado entre oleadas, venta de torres con pérdida y mejoras.
//   - CUADRÍCULA DE CONSTRUCCIÓN: ocupar/liberar huellas de edificios y validar que no se bloquee el camino.

export interface Unidad {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly tipo?: string;
  readonly duenio?: number;
}

/** Unidades dentro del rectángulo (arrastre del ratón) del dueño indicado. */
export function seleccionarRect<U extends Unidad>(unidades: readonly U[], x0: number, y0: number, x1: number, y1: number, duenio?: number): U[] {
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
  const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
  return unidades.filter((u) => u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by && (duenio === undefined || u.duenio === duenio));
}

export class GruposControl {
  private readonly grupos = new Map<number, number[]>();

  asignar(n: number, ids: readonly number[]): void {
    this.grupos.set(n, [...ids]);
  }

  sumar(n: number, ids: readonly number[]): void {
    this.grupos.set(n, [...new Set([...(this.grupos.get(n) ?? []), ...ids])]);
  }

  /** Ids vivos del grupo (filtra las unidades que ya no existen). */
  obtener(n: number, existe: (id: number) => boolean = () => true): number[] {
    const g = (this.grupos.get(n) ?? []).filter(existe);
    this.grupos.set(n, g);
    return g;
  }
}

export type TipoFormacion = "linea" | "columna" | "cuna" | "cuadro" | "circulo";

/** Posiciones de `n` unidades alrededor de (x,y) mirando en `angulo` (rad) con separación `sep`. */
export function formacion(tipo: TipoFormacion, n: number, x: number, y: number, angulo: number, sep: number): Array<{ x: number; y: number }> {
  const local: Array<[number, number]> = [];
  if (tipo === "linea") for (let i = 0; i < n; i++) local.push([0, (i - (n - 1) / 2) * sep]);
  else if (tipo === "columna") for (let i = 0; i < n; i++) local.push([-i * sep, 0]);
  else if (tipo === "cuna") for (let i = 0; i < n; i++) {
    const fila = Math.ceil(i / 2), lado = i === 0 ? 0 : i % 2 ? 1 : -1;
    local.push([-fila * sep, lado * fila * sep]);
  }
  else if (tipo === "cuadro") {
    const lado = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) local.push([-Math.floor(i / lado) * sep, ((i % lado) - (lado - 1) / 2) * sep]);
  } else for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = n <= 1 ? 0 : (sep * n) / (2 * Math.PI);
    local.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const c = Math.cos(angulo), s = Math.sin(angulo);
  return local.map(([lx, ly]) => ({ x: x + lx * c - ly * s, y: y + lx * s + ly * c }));
}

// ---------------------------------------------------------------- Producción

export interface DefProduccion {
  readonly id: string;
  readonly tiempo: number;
  readonly costo: Readonly<Record<string, number>>;
  readonly poblacion?: number;
}

export interface Economia {
  recursos: Record<string, number>;
  poblacion: number;
  poblacionMax: number;
}

export class ColaProduccion {
  readonly maximo: number;
  readonly cola: Array<{ def: DefProduccion; restante: number }> = [];

  constructor(maximo = 5) {
    this.maximo = maximo;
  }

  /** Encola pagando al momento (como la mayoría de los RTS). */
  encolar(def: DefProduccion, eco: Economia): "ok" | "cola-llena" | "sin-recursos" | "sin-poblacion" {
    if (this.cola.length >= this.maximo) return "cola-llena";
    for (const [k, v] of Object.entries(def.costo)) if ((eco.recursos[k] ?? 0) < v) return "sin-recursos";
    if (eco.poblacion + (def.poblacion ?? 0) > eco.poblacionMax) return "sin-poblacion";
    for (const [k, v] of Object.entries(def.costo)) eco.recursos[k] -= v;
    eco.poblacion += def.poblacion ?? 0;
    this.cola.push({ def, restante: def.tiempo });
    return "ok";
  }

  /** Cancela el elemento `i` con reembolso completo (o `fraccion`). */
  cancelar(i: number, eco: Economia, fraccion = 1): boolean {
    const e = this.cola[i];
    if (!e) return false;
    for (const [k, v] of Object.entries(e.def.costo)) eco.recursos[k] = (eco.recursos[k] ?? 0) + Math.floor(v * fraccion);
    eco.poblacion -= e.def.poblacion ?? 0;
    this.cola.splice(i, 1);
    return true;
  }

  /** Avanza solo el primero; devuelve los terminados. `velocidad` (mejoras, energía baja). */
  actualizar(dt: number, velocidad = 1): DefProduccion[] {
    const listos: DefProduccion[] = [];
    let t = dt * velocidad;
    while (this.cola.length && t > 0) {
      const e = this.cola[0];
      const usa = Math.min(t, e.restante);
      e.restante -= usa;
      t -= usa;
      if (e.restante <= 1e-9) listos.push(this.cola.shift()!.def);
    }
    return listos;
  }
}

// ---------------------------------------------------------------- Recolectores

export type FaseRecolector = "yendo" | "recolectando" | "volviendo";

export class Recolector {
  fase: FaseRecolector = "yendo";
  carga = 0;
  readonly capacidad: number;
  readonly ritmo: number;
  private t = 0;

  constructor(capacidad: number, ritmo: number) {
    this.capacidad = capacidad;
    this.ritmo = ritmo;
  }

  /**
   * Avanza el ciclo. `tiempoIda`: segundos de viaje (calculados por el juego con su pathfinding). Devuelve lo
   * depositado en este paso.
   */
  actualizar(dt: number, tiempoIda: number, disponible: () => number, extraer: (n: number) => number): number {
    this.t += dt;
    if (this.fase === "yendo" && this.t >= tiempoIda) {
      this.fase = "recolectando";
      this.t = 0;
    } else if (this.fase === "recolectando") {
      if (disponible() <= 0 && this.carga === 0) return 0;
      const quiere = Math.min(this.capacidad - this.carga, this.ritmo * dt);
      this.carga += extraer(quiere);
      if (this.carga >= this.capacidad - 1e-9 || disponible() <= 0) {
        this.fase = "volviendo";
        this.t = 0;
      }
    } else if (this.fase === "volviendo" && this.t >= tiempoIda) {
      const d = this.carga;
      this.carga = 0;
      this.fase = "yendo";
      this.t = 0;
      return d;
    }
    return 0;
  }
}

// ---------------------------------------------------------------- Economía de defensa de torres

export interface ReglasTD {
  /** Interés por oleada: fracción del oro guardado, con tope. */
  readonly interes: number;
  readonly interesMax: number;
  /** Fracción del valor invertido que se devuelve al vender. */
  readonly reembolso: number;
}

export const interesTD = (oro: number, r: ReglasTD): number => Math.min(r.interesMax, Math.floor(oro * r.interes));
export const ventaTorre = (invertido: number, r: ReglasTD): number => Math.floor(invertido * r.reembolso);

// ---------------------------------------------------------------- Cuadrícula de construcción

export class CuadriculaConstruccion {
  readonly cols: number;
  readonly filas: number;
  private readonly ocupada: Int32Array;

  constructor(cols: number, filas: number) {
    this.cols = cols;
    this.filas = filas;
    this.ocupada = new Int32Array(cols * filas).fill(-1);
  }

  libre(c: number, f: number, w: number, h: number, bloqueo?: (c: number, f: number) => boolean): boolean {
    for (let y = f; y < f + h; y++) for (let x = c; x < c + w; x++) {
      if (x < 0 || y < 0 || x >= this.cols || y >= this.filas) return false;
      if (this.ocupada[y * this.cols + x] >= 0 || bloqueo?.(x, y)) return false;
    }
    return true;
  }

  /**
   * Coloca un edificio si el lugar está libre y, si se pasa `caminoLibre`, si tras colocarlo sigue habiendo camino
   * (defensa de torres con laberinto: nunca encerrar el camino).
   */
  colocar(id: number, c: number, f: number, w: number, h: number, caminoLibre?: (ocupada: (c: number, f: number) => boolean) => boolean): boolean {
    if (!this.libre(c, f, w, h)) return false;
    const dentro = (x: number, y: number): boolean => x >= c && x < c + w && y >= f && y < f + h;
    if (caminoLibre && !caminoLibre((x, y) => this.ocupadaPor(x, y) >= 0 || dentro(x, y))) return false;
    for (let y = f; y < f + h; y++) for (let x = c; x < c + w; x++) this.ocupada[y * this.cols + x] = id;
    return true;
  }

  quitar(id: number): void {
    for (let i = 0; i < this.ocupada.length; i++) if (this.ocupada[i] === id) this.ocupada[i] = -1;
  }

  ocupadaPor(c: number, f: number): number {
    if (c < 0 || f < 0 || c >= this.cols || f >= this.filas) return -2;
    return this.ocupada[f * this.cols + c];
  }
}
