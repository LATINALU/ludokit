// Compresión delta de estados: en vez de mandar el estado completo cada tick, se manda solo lo que cambió respecto
// a la última versión que el cliente CONFIRMÓ (baseline). Con cuantización de números (posiciones a 1/16 px) el
// tráfico de un MMO baja un orden de magnitud. Estados = objetos planos JSON.

export type Plano = Readonly<Record<string, unknown>>;

export interface Delta {
  readonly cambios: Record<string, unknown>;
  readonly quitados: string[];
}

const igual = (a: unknown, b: unknown): boolean => a === b || (typeof a === "object" && a !== null && typeof b === "object" && b !== null && JSON.stringify(a) === JSON.stringify(b));

export function calcularDelta(base: Plano | undefined, actual: Plano): Delta {
  const cambios: Record<string, unknown> = {};
  const quitados: string[] = [];
  for (const [k, v] of Object.entries(actual)) if (!base || !igual(base[k], v)) cambios[k] = v;
  if (base) for (const k of Object.keys(base)) if (!(k in actual)) quitados.push(k);
  return { cambios, quitados };
}

export function aplicarDelta(base: Plano | undefined, d: Delta): Record<string, unknown> {
  const r: Record<string, unknown> = { ...(base ?? {}) };
  for (const k of d.quitados) delete r[k];
  Object.assign(r, d.cambios);
  return r;
}

export const deltaVacio = (d: Delta): boolean => d.quitados.length === 0 && Object.keys(d.cambios).length === 0;

/** Cuantiza un número a `pasos` por unidad (posición a 1/16 px: pasos = 16). */
export const cuantizar = (v: number, pasos = 16): number => Math.round(v * pasos) / pasos;

/** Historial de estados enviados por tick, para hacer delta contra el último que el cliente confirmó. */
export class HistorialBaselines<S extends Plano> {
  private readonly porTick = new Map<number, S>();
  readonly max: number;

  constructor(max = 64) {
    this.max = max;
  }

  registrar(tick: number, s: S): void {
    this.porTick.set(tick, s);
    if (this.porTick.size > this.max) this.porTick.delete(this.porTick.keys().next().value!);
  }

  /** Delta contra el tick confirmado (o estado completo si ese tick ya no está). */
  deltaDesde(tickConfirmado: number | null, actual: S): { base: number | null; delta: Delta } {
    const b = tickConfirmado === null ? undefined : this.porTick.get(tickConfirmado);
    return { base: b ? tickConfirmado : null, delta: calcularDelta(b, actual) };
  }
}
