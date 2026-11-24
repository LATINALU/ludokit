// Rareza por nivel SIN TOPE: dos tablas de pesos (al empezar y "a la larga") que se mezclan con una curva de
// progreso 0..1 (`saturacion`, `logistica`, `tramos`...). Con una curva de saturación el juego puede tener 10, 100 o
// infinitos niveles/pisos/dificultades y la tabla sigue moviéndose suave hacia la de "a la larga" sin llegar nunca.
// Además: factor global por rareza (dificultad del botín), SUERTE que inclina la tabla hacia arriba, suerte extra por
// nivel (contenido infinito) y rareza mínima garantizada por fuente (jefes, cofres).
// Regla importante: la rareza mínima ELEVA lo que sale por debajo; NO renormaliza la tabla (renormalizar inflaría la
// rareza máxima: con mínimo "legendario" saldría "mítico" casi la mitad de las veces).
// No trae tabla por defecto: cada juego define la suya (ver `presets/`).

import { elegirPorPeso, type Azar } from "../../../nucleo/azar.ts";
import { evaluar, mezclarTablas, progreso, type Curva } from "../../../nucleo/escalado.ts";

export interface TablaRarezaNivel {
  readonly nombres: readonly string[];
  readonly colores?: readonly string[];
  /** Pesos en el nivel 1. */
  readonly primero: readonly number[];
  /** Pesos hacia los que tiende la tabla. */
  readonly ultimo: readonly number[];
  /** Progreso 0..1 según el nivel (p. ej. `curva.saturacion(20, 1.7)`). */
  readonly progreso: Curva;
  /** Multiplicador fijo por rareza (dificultad global del botín). */
  readonly factor?: readonly number[];
  /** Suerte extra según el nivel (contenido infinito: cuanto más hondo, mejor botín). */
  readonly suertePorNivel?: Curva;
  /** Inclinación de la suerte: +X por escalón de rareza cada 100 puntos (por defecto 0,35). */
  readonly inclinacion?: number;
}

/** Pesos de cada rareza en un nivel (con factor, sin suerte). */
export function pesosRareza(t: TablaRarezaNivel, nivel: number): number[] {
  const k = progreso(t.progreso, Math.max(1, nivel));
  return mezclarTablas(t.primero, t.ultimo, k).map((v, i) => v * (t.factor?.[i] ?? 1));
}

const suerteTotal = (t: TablaRarezaNivel, nivel: number, suerte: number): number =>
  suerte + (t.suertePorNivel ? evaluar(t.suertePorNivel, Math.max(1, nivel)) : 0);

function inclinar(pesos: readonly number[], suerte: number, inclinacion: number): number[] {
  const inc = Math.max(0, suerte) / 100;
  return pesos.map((w, i) => w * (1 + inc * i * inclinacion));
}

/** Porcentajes visibles (para mostrar al jugador y para herramientas de diseño). */
export function probabilidadesRareza(t: TablaRarezaNivel, nivel: number, suerte = 0): number[] {
  const p = inclinar(pesosRareza(t, nivel), suerteTotal(t, nivel, suerte), t.inclinacion ?? 0.35);
  const total = p.reduce((s, x) => s + x, 0);
  return p.map((x) => x / total);
}

/**
 * Tira una rareza. `suerte`: inclina la tabla (+inclinación por escalón cada 100 puntos). `minima`: eleva lo que
 * salga por debajo. `multMax`: multiplica el peso de la rareza máxima (eventos, modo difícil).
 */
export function tirarRareza(azar: Azar, t: TablaRarezaNivel, nivel: number, op: { suerte?: number; minima?: number; multMax?: number } = {}): number {
  const pesos = pesosRareza(t, nivel);
  if (op.multMax) pesos[pesos.length - 1] *= op.multMax;
  const inc = inclinar(pesos, suerteTotal(t, nivel, op.suerte ?? 0), t.inclinacion ?? 0.35);
  const r = elegirPorPeso(azar, inc.map((w, i) => [i, w] as const));
  return Math.max(op.minima ?? 0, r);
}

/** Valida una tabla leída de datos. */
export function validarTablaRareza(t: TablaRarezaNivel): string[] {
  const e: string[] = [];
  const n = t.nombres.length;
  if (n === 0) e.push("sin rarezas");
  if (t.primero.length !== n || t.ultimo.length !== n) e.push("primero/ultimo no tienen una entrada por rareza");
  if (t.factor && t.factor.length !== n) e.push("factor no tiene una entrada por rareza");
  if ([...t.primero, ...t.ultimo].some((x) => x < 0)) e.push("pesos negativos");
  return e;
}
