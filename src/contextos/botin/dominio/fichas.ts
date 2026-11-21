// Botín por FICHAS: las tablas de botín no sueltan objetos concretos sino fichas abstractas ("equipo", "carta",
// "material", "moneda") que se RESUELVEN al caer con el contexto del momento (nivel, rareza mínima de la fuente,
// suerte). Una sola tabla sirve para todo el juego y el contenido se puede ampliar sin tocar las tablas.

import { tirarDrop, type ModoDrop } from "./drops.ts";
import type { Azar } from "../../../nucleo/azar.ts";

export interface ContextoBotin {
  readonly nivel: number;
  readonly minima: number;
  readonly suerte: number;
  /** Multiplicador global de probabilidad (eventos, dificultad). */
  readonly mult: number;
}

export interface TablaFichas {
  readonly modo: ModoDrop;
  /** [ficha, probabilidad o peso] */
  readonly entradas: ReadonlyArray<readonly [string, number]>;
  /** Siempre caen (jefes). */
  readonly garantizadas?: readonly string[];
  /** Moneda [min, max] escalada por nivel: × (1 + crecimiento × (nivel − 1)). */
  readonly moneda?: readonly [number, number];
  readonly crecimientoMoneda?: number;
}

export type Resolutor<R> = (ficha: string, azar: Azar, ctx: ContextoBotin) => R | null;

export interface Botin<R> {
  readonly premios: R[];
  readonly moneda: number;
}

/** Tira una tabla de fichas y resuelve cada ficha con el resolutor del juego. */
export function soltarBotin<R>(azar: Azar, tabla: TablaFichas, ctx: ContextoBotin, resolver: Resolutor<R>): Botin<R> {
  const ids = tabla.entradas.map((_, i) => i);
  const indices = tirarDrop(azar, tabla.entradas.map(([, p], i) => [ids[i], p] as const), tabla.modo, ctx.mult);
  const fichas = [...(tabla.garantizadas ?? []), ...indices.map((i) => tabla.entradas[i][0])];
  const premios: R[] = [];
  for (const f of fichas) {
    const r = resolver(f, azar, ctx);
    if (r !== null) premios.push(r);
  }
  let moneda = 0;
  if (tabla.moneda) {
    const [a, b] = tabla.moneda;
    moneda = Math.round((a + Math.floor(azar.siguiente() * (b - a + 1))) * (1 + (tabla.crecimientoMoneda ?? 0.6) * (ctx.nivel - 1)));
  }
  return { premios, moneda };
}

/** Tablas de ejemplo para un juego de acción con botín. */
export const TABLAS_EJEMPLO: Readonly<Record<string, TablaFichas>> = {
  comun: { modo: "cada-uno", entradas: [["pocion", 0.08], ["material", 0.06], ["equipo", 0.025], ["carta", 0.13]], moneda: [3, 9] },
  elite: { modo: "cada-uno", entradas: [["pocion", 0.22], ["material", 0.25], ["equipo", 0.24], ["carta", 0.4], ["unico", 0.002]], moneda: [15, 33] },
  cofre: { modo: "ponderado", entradas: [["equipo", 54], ["carta", 28], ["material", 10], ["unico", 0.6]] },
  jefe: { modo: "cada-uno", garantizadas: ["equipo"], entradas: [["carta", 0.6], ["unico", 0.05]], moneda: [180, 270] },
};
