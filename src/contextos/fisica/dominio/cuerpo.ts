// Cuerpo AABB y movimiento por ejes separados contra una grilla de tiles. Sin motor de física genérico: cada píxel
// es predecible y afinable (lo que un juego de plataformas o top-down necesita).
//   - Primero X, después Y. Plataformas de un sentido. Pinchos al tocar con los pies.
//   - Corrección de esquinas (opcional, px): si la cabeza roza un techo por ≤ N px se desliza al hueco; si el cuerpo
//     choca una cornisa que está ≤ N px sobre los pies, la sube. Nunca "un salto que se queda a un pelo".
//   - `ant` guarda la posición al empezar el paso para interpolar el dibujo (bucle de paso fijo).

import { Celda, esSolida, type MundoTiles } from "./grilla.ts";

export class Cuerpo {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  antX: number;
  antY: number;
  enSuelo = false;
  /** -1 chocó a la izquierda, 1 a la derecha, 0 nada (último paso). */
  pared = 0;
  techo = false;
  pinchos = false;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.antX = x;
    this.antY = y;
  }

  get centroX(): number {
    return this.x + this.w / 2;
  }
  get centroY(): number {
    return this.y + this.h / 2;
  }
  get pies(): number {
    return this.y + this.h;
  }

  /** Posición para dibujar entre dos pasos fijos (alfa 0..1). */
  visual(alfa: number): { x: number; y: number } {
    return { x: this.antX + (this.x - this.antX) * alfa, y: this.antY + (this.y - this.antY) * alfa };
  }

  teletransportar(x: number, y: number): void {
    this.x = this.antX = x;
    this.y = this.antY = y;
  }

  /** Sin interpolación este paso (hitstop, pausa). */
  congelar(): void {
    this.antX = this.x;
    this.antY = this.y;
  }
}

export interface OpcionesMover {
  /** Ignora plataformas de un sentido (bajar con ↓ + salto, enemigos voladores). */
  atravesar?: boolean;
  /** Atraviesa todo (fantasmas, modo depuración). */
  fantasma?: boolean;
  /** Corrección de esquinas en px (0 = apagada; 4 es un buen valor para el jugador). */
  esquinas?: number;
}

const EPS = 0.001;

export function rectLibre(m: MundoTiles, x: number, y: number, w: number, h: number): boolean {
  const T = m.tile;
  for (let f = Math.floor(y / T); f <= Math.floor((y + h - 0.01) / T); f++) {
    for (let c = Math.floor(x / T); c <= Math.floor((x + w - 0.01) / T); c++) {
      if (esSolida(m.celda(c, f))) return false;
    }
  }
  return true;
}

function deslizarTecho(cu: Cuerpo, m: MundoTiles, n: number): boolean {
  for (let d = 1; d <= n; d++) {
    for (const lado of [-1, 1]) {
      if (rectLibre(m, cu.x + lado * d, cu.y, cu.w, cu.h)) {
        cu.x += lado * d;
        return true;
      }
    }
  }
  return false;
}

function subirCornisa(cu: Cuerpo, m: MundoTiles, col: number, n: number): boolean {
  const T = m.tile;
  const borde = Math.floor((cu.y + cu.h - 0.01) / T) * T;
  const sube = cu.y + cu.h - borde;
  if (sube <= 0 || sube > n) return false;
  if (!rectLibre(m, cu.x, cu.y - sube - 0.01, cu.w, cu.h) || esSolida(m.celda(col, Math.floor((borde - 1) / T)))) return false;
  cu.y -= sube + 0.01;
  return true;
}

/** Mueve el cuerpo un paso `dt` con su velocidad y resuelve colisiones. */
export function mover(cu: Cuerpo, m: MundoTiles, dt: number, op: OpcionesMover = {}): void {
  const T = m.tile;
  const n = op.esquinas ?? 0;
  cu.antX = cu.x;
  cu.antY = cu.y;
  cu.pared = 0;
  cu.techo = false;
  cu.pinchos = false;
  if (op.fantasma) {
    cu.x += cu.vx * dt;
    cu.y += cu.vy * dt;
    cu.enSuelo = false;
    return;
  }
  // --- Eje X
  if (cu.vx !== 0) {
    cu.x += cu.vx * dt;
    const f0 = Math.floor(cu.y / T);
    const f1 = Math.floor((cu.y + cu.h - EPS) / T);
    const col = cu.vx > 0 ? Math.floor((cu.x + cu.w - EPS) / T) : Math.floor(cu.x / T);
    for (let f = f0; f <= f1; f++) {
      if (!esSolida(m.celda(col, f))) continue;
      if (n > 0 && subirCornisa(cu, m, col, n)) break;
      if (cu.vx > 0) {
        cu.x = col * T - cu.w;
        cu.pared = 1;
      } else {
        cu.x = (col + 1) * T;
        cu.pared = -1;
      }
      cu.vx = 0;
      break;
    }
  }
  // --- Eje Y
  const pieAntes = cu.y + cu.h;
  cu.y += cu.vy * dt;
  cu.enSuelo = false;
  const c0 = Math.floor(cu.x / T);
  const c1 = Math.floor((cu.x + cu.w - EPS) / T);
  if (cu.vy >= 0) {
    const fila = Math.floor((cu.y + cu.h - EPS) / T);
    const tope = fila * T;
    for (let c = c0; c <= c1; c++) {
      const t = m.celda(c, fila);
      const plataforma = t === Celda.PLATAFORMA && !op.atravesar && pieAntes <= tope + 0.5;
      if (esSolida(t) || plataforma) {
        cu.y = tope - cu.h;
        cu.vy = 0;
        cu.enSuelo = true;
        break;
      }
    }
  } else {
    const fila = Math.floor(cu.y / T);
    for (let c = c0; c <= c1; c++) {
      if (!esSolida(m.celda(c, fila))) continue;
      if (n > 0 && deslizarTecho(cu, m, n)) break;
      cu.y = (fila + 1) * T;
      cu.vy = 0;
      cu.techo = true;
      break;
    }
  }
  // --- Pinchos: se tocan con los pies.
  const fPie = Math.floor((cu.y + cu.h - 1) / T);
  for (let c = Math.floor((cu.x + 2) / T); c <= Math.floor((cu.x + cu.w - 2) / T); c++) {
    if (m.celda(c, fPie) === Celda.PINCHOS) cu.pinchos = true;
  }
}

/** ¿Está parado sobre una plataforma de un sentido (y no sobre roca)? Decide si ↓ + salto la atraviesa. */
export function sobrePlataforma(cu: Cuerpo, m: MundoTiles): boolean {
  const T = m.tile;
  const fila = Math.floor((cu.y + cu.h + 1) / T);
  let plataforma = false;
  for (let c = Math.floor(cu.x / T); c <= Math.floor((cu.x + cu.w - EPS) / T); c++) {
    const t = m.celda(c, fila);
    if (t === Celda.ROCA) return false;
    if (t === Celda.PLATAFORMA) plataforma = true;
  }
  return plataforma;
}

/** ¿Hay suelo justo debajo del punto? (IA que patrulla sin caerse de las cornisas). */
export function haySuelo(m: MundoTiles, px: number, piesY: number): boolean {
  const t = m.celda(Math.floor(px / m.tile), Math.floor((piesY + 2) / m.tile));
  return esSolida(t) || t === Celda.PLATAFORMA;
}
