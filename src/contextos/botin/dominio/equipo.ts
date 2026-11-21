// Generador de equipo para juegos de botín (ARPG, looter, RPG): cada pieza tiene clase, nivel, rareza, stats con
// TIRADA (cada stat sale entre el 50 % y el 100 % de su máximo: la "perfección" de la pieza es la media), afijos
// extra según la rareza, calidad, mejora (+N), y valor de desguace. Las definiciones son datos: el juego dice qué
// clases existen y cuánto da cada stat por nivel.

import type { Azar } from "../../../nucleo/azar.ts";
import { RAREZA_ESTANDAR, tirarRareza, type TablaRarezaNivel } from "./rareza.ts";

export interface DefClase {
  readonly id: string;
  /** Stat principal → valor por nivel de escala. */
  readonly principal: Readonly<Record<string, number>>;
  /** Stats que pueden salir como afijo (valor por nivel de escala). */
  readonly afijos: Readonly<Record<string, number>>;
  /** Peso de aparición. */
  readonly peso?: number;
}

export interface ReglasEquipo {
  readonly rareza: TablaRarezaNivel;
  readonly multRareza: readonly number[];
  readonly afijosPorRareza: readonly number[];
  readonly tiradaMin: number;
  readonly topeBase: number;
  readonly topeAfijo: number;
  /** Mejora: +X % por grado y grado máximo. */
  readonly multMejora: number;
  readonly mejoraMax: number;
  /** Escala sublineal del nivel: n ≤ codo → n; si no codo·(n/codo)^exp (números chicos y legibles). */
  readonly codo: number;
  readonly expNivel: number;
  readonly desguace: readonly number[];
}

export const REGLAS_EQUIPO: ReglasEquipo = {
  rareza: RAREZA_ESTANDAR,
  multRareza: [1, 1.06, 1.12, 1.19, 1.27, 1.36],
  afijosPorRareza: [0, 1, 2, 3, 4, 5],
  tiradaMin: 0.5,
  topeBase: 1.15,
  topeAfijo: 0.65,
  multMejora: 1.05,
  mejoraMax: 10,
  codo: 4,
  expNivel: 0.56,
  desguace: [1, 2, 3, 5, 8, 12],
};

export interface Pieza {
  readonly uid: string;
  readonly clase: string;
  readonly nivel: number;
  readonly rareza: number;
  readonly stats: Record<string, number>;
  /** Tirada normalizada 0..1 de cada stat (para mostrar la perfección). */
  readonly tiradas: number[];
  readonly calidad: number;
  mejora: number;
}

export const escalaNivel = (n: number, r: ReglasEquipo = REGLAS_EQUIPO): number => {
  const x = Math.max(1, n);
  return x <= r.codo ? x : r.codo * Math.pow(x / r.codo, r.expNivel);
};

const redondear = (v: number): number => (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v));

export function uid(azar: Azar): string {
  let s = "";
  for (let i = 0; i < 12; i++) s += Math.floor(azar.siguiente() * 16).toString(16);
  return s;
}

/** Genera una pieza. `nivelFuente`: nivel de la zona; `minima`: rareza mínima de la fuente; `suerte`. */
export function generarPieza(azar: Azar, clases: readonly DefClase[], nivelFuente: number, op: { minima?: number; suerte?: number; clase?: string; r?: ReglasEquipo } = {}): Pieza {
  const r = op.r ?? REGLAS_EQUIPO;
  const pool = op.clase ? clases.filter((c) => c.id === op.clase) : clases;
  const total = pool.reduce((s, c) => s + (c.peso ?? 1), 0);
  let x = azar.siguiente() * total;
  let def = pool[pool.length - 1];
  for (const c of pool) {
    x -= c.peso ?? 1;
    if (x < 0) {
      def = c;
      break;
    }
  }
  const rareza = Math.min(r.multRareza.length - 1, tirarRareza(azar, r.rareza, nivelFuente, { minima: op.minima, suerte: op.suerte }));
  const nivel = Math.max(1, nivelFuente * 4 + Math.floor(azar.siguiente() * 4) - 2);
  const esc = escalaNivel(nivel, r) * r.multRareza[rareza];
  const stats: Record<string, number> = {};
  const tiradas: number[] = [];
  const tirar = (): number => {
    const t = azar.siguiente();
    tiradas.push(t);
    return r.tiradaMin + (1 - r.tiradaMin) * t;
  };
  for (const [s, v] of Object.entries(def.principal)) stats[s] = redondear(v * esc * r.topeBase * tirar());
  const disponibles = Object.keys(def.afijos).filter((s) => !(s in stats));
  for (let i = 0; i < r.afijosPorRareza[rareza] && disponibles.length > 0; i++) {
    const s = disponibles.splice(Math.floor(azar.siguiente() * disponibles.length), 1)[0];
    stats[s] = redondear(def.afijos[s] * esc * r.topeAfijo * tirar());
  }
  const calidad = Math.min(1.3, Math.round((0.75 + ((azar.siguiente() + azar.siguiente()) / 2) * 0.45 + rareza * 0.02) * 100) / 100);
  return { uid: uid(azar), clase: def.id, nivel, rareza, stats, tiradas, calidad, mejora: 0 };
}

/** Perfección 0..1 (media de las tiradas): una pieza perfecta rinde ~1,6× una mala del mismo nivel y rareza. */
export const perfeccion = (p: Pieza): number => (p.tiradas.length === 0 ? 0 : p.tiradas.reduce((s, t) => s + t, 0) / p.tiradas.length);

/** Mejora +1: cada stat × multMejora (al menos +1 en los enteros). Devuelve una pieza nueva. */
export function mejorarPieza(p: Pieza, r: ReglasEquipo = REGLAS_EQUIPO): Pieza | null {
  if (p.mejora >= r.mejoraMax) return null;
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.stats)) stats[k] = Math.abs(v) < 10 ? redondear(v * r.multMejora) : Math.max(v + 1, Math.round(v * r.multMejora));
  return { ...p, stats, tiradas: [...p.tiradas], mejora: p.mejora + 1 };
}

export const costoMejora = (p: Pieza): number => Math.round((40 + p.nivel * 6) * (p.mejora + 1) * (1 + p.rareza * 0.3));
export const valorDesguace = (p: Pieza, r: ReglasEquipo = REGLAS_EQUIPO): number => (4 + 2 * p.nivel) * r.desguace[p.rareza];

/** Puntaje para comparar dos piezas con un peso por stat definido por el juego (o 1). */
export function puntaje(p: Pieza, pesos: Readonly<Record<string, number>> = {}): number {
  return Object.entries(p.stats).reduce((s, [k, v]) => s + v * (pesos[k] ?? 1), 0) * p.calidad;
}
