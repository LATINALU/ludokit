// IA por utilidad (Utility AI): cada acción tiene consideraciones que puntúan 0..1 con curvas de respuesta; el
// puntaje es el producto (con compensación por cantidad de factores) y se elige la mejor (o al azar entre las
// mejores). Ideal para NPCs de simulación, compañeros, jefes con muchas opciones y bots de juegos de estrategia.

import type { Azar } from "../../../nucleo/azar.ts";

export type Curva = (x: number) => number;

/** Curvas de respuesta estándar sobre x en [0,1]. */
export const CURVAS = {
  lineal: (m = 1, b = 0): Curva => (x) => m * x + b,
  potencia: (k = 2): Curva => (x) => Math.pow(x, k),
  inversa: (): Curva => (x) => 1 - x,
  logistica: (pendiente = 10, centro = 0.5): Curva => (x) => 1 / (1 + Math.exp(-pendiente * (x - centro))),
  escalon: (umbral = 0.5): Curva => (x) => (x >= umbral ? 1 : 0),
  campana: (centro = 0.5, ancho = 0.25): Curva => (x) => Math.exp(-((x - centro) ** 2) / (2 * ancho * ancho)),
};

export interface Consideracion<C> {
  readonly nombre: string;
  /** Valor de entrada normalizado 0..1 (vida propia, distancia al objetivo / rango, munición...). */
  readonly entrada: (ctx: C) => number;
  readonly curva: Curva;
}

export interface AccionUtil<C> {
  readonly nombre: string;
  readonly consideraciones: readonly Consideracion<C>[];
  /** Multiplicador fijo (prioridad de diseño). */
  readonly peso?: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Puntaje con compensación (Dave Mark): evita que muchas consideraciones hundan el producto. */
export function puntuar<C>(a: AccionUtil<C>, ctx: C): number {
  const n = a.consideraciones.length;
  if (n === 0) return a.peso ?? 1;
  let s = 1;
  for (const c of a.consideraciones) {
    s *= clamp01(c.curva(clamp01(c.entrada(ctx))));
    if (s === 0) return 0;
  }
  const mod = 1 - 1 / n;
  const comp = s + (1 - s) * mod * s;
  return comp * (a.peso ?? 1);
}

/**
 * Elige la acción. `top`: elige al azar entre las `top` mejores ponderando por puntaje (comportamiento menos
 * robótico). `inercia`: bonus a la acción actual para que no cambie de idea a cada tick.
 */
export function elegirAccion<C>(acciones: readonly AccionUtil<C>[], ctx: C, op: { azar?: Azar; top?: number; actual?: string; inercia?: number } = {}): { accion: AccionUtil<C>; puntaje: number } | null {
  const puntuadas = acciones
    .map((a) => ({ accion: a, puntaje: puntuar(a, ctx) * (a.nombre === op.actual ? 1 + (op.inercia ?? 0) : 1) }))
    .filter((p) => p.puntaje > 0)
    .sort((x, y) => y.puntaje - x.puntaje);
  if (puntuadas.length === 0) return null;
  const top = Math.max(1, op.top ?? 1);
  if (top === 1 || !op.azar) return puntuadas[0];
  const cand = puntuadas.slice(0, top);
  const total = cand.reduce((s, p) => s + p.puntaje, 0);
  let r = op.azar.siguiente() * total;
  for (const p of cand) {
    r -= p.puntaje;
    if (r < 0) return p;
  }
  return cand[cand.length - 1];
}
