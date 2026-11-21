// Rareza por nivel: una tabla de pesos que se interpola entre el primer y el último nivel con una curva de
// potencia (los primeros niveles casi no cambian, sube al final), un factor global de dificultad del botín, la
// SUERTE que inclina la tabla hacia arriba, y la rareza mínima garantizada por fuente (jefes, cofres).
// Regla importante: la rareza mínima ELEVA lo que sale por debajo; NO renormaliza la tabla (renormalizar
// inflaría la rareza máxima: con mínimo "legendario" saldría "mítico" casi la mitad de las veces).

import { elegirPorPeso, type Azar } from "../../../nucleo/azar.ts";

export interface TablaRarezaNivel {
  readonly nombres: readonly string[];
  readonly colores?: readonly string[];
  readonly niveles: number;
  readonly primero: readonly number[];
  readonly ultimo: readonly number[];
  readonly exponente: number;
  readonly factor?: readonly number[];
}

export const RAREZA_ESTANDAR: TablaRarezaNivel = {
  nombres: ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico"],
  colores: ["#c8c0d8", "#7ad87a", "#5fb8ff", "#c06bff", "#ffb03d", "#ff5a6a"],
  niveles: 24,
  primero: [64, 28, 7.4, 0.5, 0.06, 0.04],
  ultimo: [26, 36, 27, 10, 1.2, 0.12],
  exponente: 1.7,
  factor: [1, 1, 0.8, 0.5, 0.4, 0.5],
};

/** Pesos de cada rareza en un nivel (con factor). `extra` > 0 = niveles más allá del último (modo infinito). */
export function pesosRareza(t: TablaRarezaNivel, nivel: number): number[] {
  const k = Math.pow(Math.min(1, Math.max(0, (nivel - 1) / Math.max(1, t.niveles - 1))), t.exponente);
  return t.primero.map((v, i) => (v + (t.ultimo[i] - v) * k) * (t.factor?.[i] ?? 1));
}

/** Porcentajes visibles (para mostrar al jugador y para herramientas de diseño). */
export function probabilidadesRareza(t: TablaRarezaNivel, nivel: number, suerte = 0): number[] {
  const p = inclinar(pesosRareza(t, nivel), suerte + 2 * Math.max(0, nivel - t.niveles));
  const total = p.reduce((s, x) => s + x, 0);
  return p.map((x) => x / total);
}

function inclinar(pesos: readonly number[], suerte: number): number[] {
  const inc = Math.max(0, suerte) / 100;
  return pesos.map((w, i) => w * (1 + inc * i * 0.35));
}

/**
 * Tira una rareza. `suerte`: +35 % por escalón de rareza cada 100 puntos. `minima`: eleva lo que salga por
 * debajo. `multMax`: multiplica el peso de la rareza máxima (eventos, modo difícil).
 */
export function tirarRareza(azar: Azar, t: TablaRarezaNivel, nivel: number, op: { suerte?: number; minima?: number; multMax?: number } = {}): number {
  const pesos = pesosRareza(t, nivel);
  if (op.multMax) pesos[pesos.length - 1] *= op.multMax;
  const inc = inclinar(pesos, (op.suerte ?? 0) + 2 * Math.max(0, nivel - t.niveles));
  const r = elegirPorPeso(azar, inc.map((w, i) => [i, w] as const));
  return Math.max(op.minima ?? 0, r);
}
