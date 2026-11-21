// Interior de una sala de plataformas con GARANTÍA DE RECORRIDO: marco de roca irregular, puertas abiertas según
// las conexiones del mapa, escalera de plataformas en las puertas verticales y un motivo interior (repisas,
// columnas bajas, escalones) que nunca supera `altoMaxObstaculo` tiles ni toca las zonas de puertas: toda sala se
// recorre con el salto base. Las habilidades abren atajos, no el camino.

import { Pcg32 } from "../../../nucleo/pcg32.ts";
import { Celda, Grilla } from "../../fisica/dominio/grilla.ts";

export interface OpcionesSala {
  readonly cols?: number;
  readonly filas?: number;
  readonly tile?: number;
  readonly puertas: { readonly izq?: boolean; readonly der?: boolean; readonly arr?: boolean; readonly aba?: boolean };
  readonly tipo?: "normal" | "jefe" | "tesoro" | "arena" | "inicio";
  readonly semilla: number;
  /** Alto máximo de un obstáculo en tiles (alto de salto en tiles − 1). */
  readonly altoMaxObstaculo?: number;
}

export interface SalaConstruida {
  readonly grilla: Grilla;
  readonly antorchas: Array<readonly [number, number]>;
  readonly altar: number | null;
  readonly filaSuelo: number;
}

export function construirSala(o: OpcionesSala): SalaConstruida {
  const COLS = o.cols ?? 30, FILAS = o.filas ?? 17;
  const az = new Pcg32(o.semilla);
  // Fuera de la sala = vacío: el jugador puede salir por una puerta y el juego cambia de sala.
  const g = new Grilla(COLS, FILAS, o.tile ?? 16, Celda.VACIO);
  const SUELO = FILAS - 2;
  const alto = o.altoMaxObstaculo ?? 3;
  const pv = o.puertas;
  const vertical = !!(pv.arr || pv.aba);
  const cMed = Math.floor(COLS / 2);
  const puertaV = [cMed - 2, cMed - 1, cMed, cMed + 1];
  const puertaL = [SUELO - 3, SUELO - 2, SUELO - 1];
  for (let c = 0; c < COLS; c++) {
    g.poner(c, 0, Celda.ROCA);
    g.poner(c, SUELO, Celda.ROCA);
    g.poner(c, FILAS - 1, Celda.ROCA);
    if (c > 0 && c < COLS - 1 && az.prob(0.35)) g.poner(c, 1, Celda.ROCA);
  }
  for (let f = 0; f < FILAS; f++) {
    g.poner(0, f, Celda.ROCA);
    g.poner(COLS - 1, f, Celda.ROCA);
    if (f >= 2 && f < SUELO - 5) {
      if (az.prob(0.3)) g.poner(1, f, Celda.ROCA);
      if (az.prob(0.3)) g.poner(COLS - 2, f, Celda.ROCA);
    }
  }
  const libre = (c: number, f: number): boolean => {
    const lado = (c <= 4 || c >= COLS - 5) && f >= SUELO - 5;
    const escalera = vertical && c >= cMed - 4 && c <= cMed + 3;
    return !lado && !escalera;
  };
  let altar: number | null = null;
  const tipo = o.tipo ?? "normal";
  if (tipo === "normal") {
    const motivo = az.rango(0, 3);
    if (motivo === 0 || motivo === 3) {
      for (let k = az.rango(2, 4); k > 0; k--) {
        const w = az.rango(3, 6), f = az.rango(SUELO - 6, SUELO - 4), c0 = az.rango(3, COLS - 4 - w);
        let ok = true;
        for (let c = c0; c < c0 + w; c++) ok &&= libre(c, f);
        if (ok) for (let c = c0; c < c0 + w; c++) g.poner(c, f, Celda.PLATAFORMA);
      }
    }
    if (motivo === 1 || motivo === 3) {
      for (let k = az.rango(2, 3); k > 0; k--) {
        const h = az.rango(1, alto), c0 = az.rango(5, COLS - 7);
        if (libre(c0, SUELO - 1) && libre(c0 + 1, SUELO - 1)) for (let c = c0; c < c0 + 2; c++) for (let f = SUELO - h; f < SUELO; f++) g.poner(c, f, Celda.ROCA);
      }
    }
    if (motivo === 2) {
      const izq = az.prob(0.5);
      for (let k = 0; k < Math.min(3, alto); k++) {
        const c = izq ? 5 + k * 2 : COLS - 7 - k * 2;
        for (let dc = 0; dc < 2; dc++) if (libre(c + dc, SUELO - 1)) for (let f = SUELO - 1 - k; f < SUELO; f++) g.poner(c + dc, f, Celda.ROCA);
      }
      const c0 = izq ? 10 : COLS - 16;
      for (let c = c0; c < c0 + 6; c++) if (libre(c, SUELO - 7)) g.poner(c, SUELO - 7, Celda.PLATAFORMA);
    }
  } else if (tipo === "jefe" || tipo === "arena") {
    for (let c = 4; c < 9; c++) g.poner(c, SUELO - 5, Celda.PLATAFORMA);
    for (let c = COLS - 9; c < COLS - 4; c++) g.poner(c, SUELO - 5, Celda.PLATAFORMA);
    if (tipo === "arena") altar = vertical ? 7 : cMed;
  } else if (tipo === "tesoro") {
    altar = vertical ? 7 : cMed;
  }
  if (pv.izq) for (const f of puertaL) g.llenar(0, f, 1, f, Celda.VACIO);
  if (pv.der) for (const f of puertaL) g.llenar(COLS - 2, f, COLS - 1, f, Celda.VACIO);
  if (pv.arr) {
    for (const c of puertaV) g.llenar(c, 0, c, 1, Celda.VACIO);
    for (let f = SUELO - 3; f >= 3; f -= 3) for (const c of puertaV) g.poner(c, f, Celda.PLATAFORMA);
  }
  if (pv.aba) for (const c of puertaV) {
    g.poner(c, SUELO, Celda.PLATAFORMA);
    g.poner(c, FILAS - 1, Celda.VACIO);
  }
  const antorchas: Array<readonly [number, number]> = [];
  for (const c of [5, cMed - 1, COLS - 6]) {
    if (vertical && c === cMed - 1) continue;
    if (g.celda(c, SUELO - 6) === Celda.VACIO && g.celda(c, SUELO - 7) === Celda.VACIO) antorchas.push([c, SUELO - 6]);
  }
  return { grilla: g, antorchas, altar, filaSuelo: SUELO };
}

/** Comprueba la garantía: ninguna columna interior tiene una pared más alta que `alto` tiles sobre el suelo. */
export function alturaMaxObstaculo(s: SalaConstruida): number {
  let max = 0;
  for (let c = 2; c < s.grilla.cols - 2; c++) {
    let h = 0;
    for (let f = s.filaSuelo - 1; s.grilla.celda(c, f) === Celda.ROCA; f--) h++;
    max = Math.max(max, h);
  }
  return max;
}
