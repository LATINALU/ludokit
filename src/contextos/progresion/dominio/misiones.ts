// Misiones: objetivos (matar N, entregar, juntar), requisitos de nivel, cadenas (una abre la siguiente)
// y recompensas. Registro por jugador con progreso; entregar es todo o nada.

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";

export interface Objetivo {
  /** "matar", "juntar", "hablar", "ganar-partida", "fusionar"... lo que el juego quiera registrar. */
  readonly tipo: string;
  /** Id de monstruo, objeto, NPC... (-1 = cualquiera). */
  readonly objetivo: number;
  readonly cantidad: number;
}

export interface RecompensaMision {
  readonly exp?: number;
  readonly monedas?: Readonly<Record<string, number>>;
  readonly objetos?: ReadonlyArray<{ readonly objeto: number; readonly cantidad: number }>;
}

export interface DefinicionMision {
  readonly id: number;
  readonly nivelMinimo?: number;
  /** Misión que hay que haber entregado antes (cadena). */
  readonly requiere?: number;
  readonly objetivos: readonly Objetivo[];
  readonly recompensa: RecompensaMision;
  /** Se puede volver a aceptar después de entregarla (diarias, pergaminos). */
  readonly repetible?: boolean;
}

export type ErrorMision =
  | "no-existe"
  | "nivel-insuficiente"
  | "falta-anterior"
  | "ya-activa"
  | "ya-entregada"
  | "demasiadas"
  | "no-activa"
  | "incompleta";

export interface MisionActiva {
  readonly id: number;
  readonly progreso: number[];
}

export class RegistroMisiones {
  private readonly definicion: (id: number) => DefinicionMision | undefined;
  private readonly maxActivas: number;
  private readonly activas = new Map<number, number[]>();
  private readonly entregadas = new Set<number>();

  constructor(definicion: (id: number) => DefinicionMision | undefined, maxActivas = 10) {
    this.definicion = definicion;
    this.maxActivas = maxActivas;
  }

  puedeAceptar(id: number, nivel: number): Resultado<DefinicionMision, ErrorMision> {
    const d = this.definicion(id);
    if (d === undefined) return fallo("no-existe");
    if (this.activas.has(id)) return fallo("ya-activa");
    if (this.entregadas.has(id) && d.repetible !== true) return fallo("ya-entregada");
    if (nivel < (d.nivelMinimo ?? 0)) return fallo("nivel-insuficiente");
    if (d.requiere !== undefined && !this.entregadas.has(d.requiere)) return fallo("falta-anterior");
    if (this.activas.size >= this.maxActivas) return fallo("demasiadas");
    return exito(d);
  }

  aceptar(id: number, nivel: number): Resultado<MisionActiva, ErrorMision> {
    const r = this.puedeAceptar(id, nivel);
    if (!r.ok) return r;
    const progreso = r.valor.objetivos.map(() => 0);
    this.activas.set(id, progreso);
    return exito({ id, progreso });
  }

  abandonar(id: number): Resultado<void, ErrorMision> {
    return this.activas.delete(id) ? exito(undefined) : fallo("no-activa");
  }

  /** Algo pasó en el juego. Devuelve las misiones cuyo progreso cambió. */
  registrar(tipo: string, objetivo: number, cantidad = 1): MisionActiva[] {
    const cambiadas: MisionActiva[] = [];
    for (const [id, progreso] of this.activas) {
      const d = this.definicion(id);
      if (d === undefined) continue;
      let cambio = false;
      d.objetivos.forEach((o, i) => {
        if (o.tipo === tipo && (o.objetivo === -1 || o.objetivo === objetivo) && progreso[i] < o.cantidad) {
          progreso[i] = Math.min(o.cantidad, progreso[i] + cantidad);
          cambio = true;
        }
      });
      if (cambio) cambiadas.push({ id, progreso });
    }
    return cambiadas;
  }

  /** Para objetivos de "tener N objetos": fija el progreso al valor actual (puede bajar). */
  fijar(tipo: string, objetivo: number, valor: number): void {
    for (const [id, progreso] of this.activas) {
      this.definicion(id)?.objetivos.forEach((o, i) => {
        if (o.tipo === tipo && (o.objetivo === -1 || o.objetivo === objetivo)) progreso[i] = Math.min(o.cantidad, valor);
      });
    }
  }

  completa(id: number): boolean {
    const d = this.definicion(id);
    const p = this.activas.get(id);
    return d !== undefined && p !== undefined && d.objetivos.every((o, i) => p[i] >= o.cantidad);
  }

  /** Cierra la misión y devuelve la recompensa para que quien llama la entregue (o la mande por correo). */
  entregar(id: number): Resultado<RecompensaMision, ErrorMision> {
    const d = this.definicion(id);
    if (d === undefined) return fallo("no-existe");
    if (!this.activas.has(id)) return fallo("no-activa");
    if (!this.completa(id)) return fallo("incompleta");
    this.activas.delete(id);
    this.entregadas.add(id);
    return exito(d.recompensa);
  }

  listaActivas(): MisionActiva[] {
    return [...this.activas].map(([id, progreso]) => ({ id, progreso: [...progreso] }));
  }

  fueEntregada(id: number): boolean {
    return this.entregadas.has(id);
  }

  /** Para guardar en la base. */
  exportar(): { activas: MisionActiva[]; entregadas: number[] } {
    return { activas: this.listaActivas(), entregadas: [...this.entregadas] };
  }

  importar(datos: { activas: readonly MisionActiva[]; entregadas: readonly number[] }): void {
    this.activas.clear();
    this.entregadas.clear();
    for (const a of datos.activas) this.activas.set(a.id, [...a.progreso]);
    for (const id of datos.entregadas) this.entregadas.add(id);
  }
}
