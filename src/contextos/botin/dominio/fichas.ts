// Botín por FICHAS: las tablas de botín no sueltan objetos concretos sino fichas abstractas ("equipo", "carta",
// "material", "moneda") que se RESUELVEN al caer con el contexto del momento (nivel, rareza mínima de la fuente,
// suerte). Una sola tabla sirve para todo el juego y el contenido se puede ampliar sin tocar las tablas.

import { tirarDrop, type ModoDrop } from "./drops.ts";
import type { Azar } from "../../../nucleo/azar.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

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
  /** Moneda [min, max] en el nivel 1, multiplicada por `monedaPorNivel` (sin curva no escala). */
  readonly moneda?: readonly [number, number];
  readonly monedaPorNivel?: Curva;
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
    moneda = Math.round((a + Math.floor(azar.siguiente() * (b - a + 1))) * (tabla.monedaPorNivel ? evaluar(tabla.monedaPorNivel, Math.max(1, ctx.nivel)) : 1));
  }
  return { premios, moneda };
}
