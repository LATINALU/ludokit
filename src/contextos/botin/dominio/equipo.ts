// Generador de equipo para juegos de botín (ARPG, looter, RPG): cada pieza tiene clase, nivel, rareza, stats con
// TIRADA (cada stat sale entre el 50 % y el 100 % de su máximo: la "perfección" de la pieza es la media), afijos
// extra según la rareza, calidad, mejora (+N), y valor de desguace. Las definiciones son datos: el juego dice qué
// clases existen, cuánto da cada stat por nivel y cómo escala (con `Curva`, sin tope de niveles). No hay reglas por
// defecto: ver `presets/` para puntos de partida por género.

import type { Azar } from "../../../nucleo/azar.ts";
import { tirarRareza, type TablaRarezaNivel } from "./rareza.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

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
  /** Multiplicador de stats por rareza (una entrada por rareza). */
  readonly multRareza: readonly number[];
  /** Afijos extra por rareza. */
  readonly afijosPorRareza: readonly number[];
  /** Cada stat sale entre tiradaMin y 1 de su máximo. */
  readonly tiradaMin: number;
  readonly topeBase: number;
  readonly topeAfijo: number;
  /** Nivel de la pieza según el nivel de la fuente (zona, enemigo, dificultad) y su variación ±. */
  readonly nivelPieza: Curva;
  readonly variacionNivel: number;
  /** Escala de stats según el nivel de la pieza (p. ej. `topeSuave(lineal(1,1), 4, 0.56)`: números chicos). */
  readonly escala: Curva;
  /** Mejora: ×multMejora por grado; `mejoraMax` = Infinity para mejora sin tope. */
  readonly multMejora: number;
  readonly mejoraMax: number;
  /** Costo de mejora = (base + porNivel·nivel)·(grado+1)·(1 + porRareza·rareza). */
  readonly costoMejora: { readonly base: number; readonly porNivel: number; readonly porRareza: number };
  /** Calidad: rango [min, max] y bono por rareza. */
  readonly calidad?: { readonly min: number; readonly max: number; readonly porRareza: number; readonly tope: number };
  /** Desguace = (base + porNivel·nivel)·desguace[rareza]. */
  readonly desguace: readonly number[];
  readonly desguaceBase?: { readonly base: number; readonly porNivel: number };
}

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

export const escalaNivel = (n: number, r: ReglasEquipo): number => evaluar(r.escala, Math.max(1, n));

const redondear = (v: number): number => (Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v));

export function uid(azar: Azar): string {
  let s = "";
  for (let i = 0; i < 12; i++) s += Math.floor(azar.siguiente() * 16).toString(16);
  return s;
}

/** Genera una pieza. `nivelFuente`: nivel de la zona; `minima`: rareza mínima de la fuente; `suerte`. */
export function generarPieza(azar: Azar, clases: readonly DefClase[], nivelFuente: number, r: ReglasEquipo, op: { minima?: number; suerte?: number; clase?: string } = {}): Pieza {
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
  const v = r.variacionNivel;
  const nivel = Math.max(1, Math.round(evaluar(r.nivelPieza, nivelFuente)) + (v > 0 ? Math.floor(azar.siguiente() * (2 * v + 1)) - v : 0));
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
  const q = r.calidad ?? { min: 1, max: 1, porRareza: 0, tope: 1 };
  const calidad = Math.min(q.tope, Math.round((q.min + ((azar.siguiente() + azar.siguiente()) / 2) * (q.max - q.min) + rareza * q.porRareza) * 100) / 100);
  return { uid: uid(azar), clase: def.id, nivel, rareza, stats, tiradas, calidad, mejora: 0 };
}

/** Perfección 0..1 (media de las tiradas): con tiradaMin 0,5 una pieza perfecta rinde ~2× una mala. */
export const perfeccion = (p: Pieza): number => (p.tiradas.length === 0 ? 0 : p.tiradas.reduce((s, t) => s + t, 0) / p.tiradas.length);

/** Mejora +1: cada stat × multMejora (al menos +1 en los enteros). Devuelve una pieza nueva. */
export function mejorarPieza(p: Pieza, r: ReglasEquipo): Pieza | null {
  if (p.mejora >= r.mejoraMax) return null;
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.stats)) stats[k] = Math.abs(v) < 10 ? redondear(v * r.multMejora) : Math.max(v + 1, Math.round(v * r.multMejora));
  return { ...p, stats, tiradas: [...p.tiradas], mejora: p.mejora + 1 };
}

export const costoMejora = (p: Pieza, r: ReglasEquipo): number =>
  Math.round((r.costoMejora.base + p.nivel * r.costoMejora.porNivel) * (p.mejora + 1) * (1 + p.rareza * r.costoMejora.porRareza));
export const valorDesguace = (p: Pieza, r: ReglasEquipo): number =>
  ((r.desguaceBase?.base ?? 1) + (r.desguaceBase?.porNivel ?? 0) * p.nivel) * (r.desguace[p.rareza] ?? 1);

/** Puntaje para comparar dos piezas con un peso por stat definido por el juego (o 1). */
export function puntaje(p: Pieza, pesos: Readonly<Record<string, number>> = {}): number {
  return Object.entries(p.stats).reduce((s, [k, v]) => s + v * (pesos[k] ?? 1), 0) * p.calidad;
}
