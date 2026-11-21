// Proyectiles por datos: velocidad inicial, aceleración, gravedad y vida. Más helpers de puntería
// (tiro recto, tiro parabólico que cae en el objetivo, teledirigido con giro máximo).

import type { MundoTiles } from "./grilla.ts";
import { esSolida } from "./grilla.ts";

export interface DefProyectil {
  readonly velocidad: number;
  /** Aceleración a lo largo de la dirección de salida (px/s²; negativa frena). */
  readonly aceleracion: number;
  readonly gravedad: number;
  readonly vida: number;
  readonly radio: number;
  readonly atraviesaRoca: boolean;
  /** Teledirigido: giro máximo en rad/s (0 = no persigue). */
  readonly giro: number;
}

export const PROYECTIL_BASE: DefProyectil = { velocidad: 240, aceleracion: 0, gravedad: 0, vida: 5, radio: 3, atraviesaRoca: false, giro: 0 };

export class Proyectil {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t = 0;
  vivo = true;
  readonly def: DefProyectil;

  constructor(x: number, y: number, vx: number, vy: number, def: DefProyectil = PROYECTIL_BASE) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.def = def;
  }

  actualizar(dt: number, mundo?: MundoTiles, objetivo?: { x: number; y: number }): void {
    if (!this.vivo) return;
    const d = this.def;
    const v = Math.hypot(this.vx, this.vy) || 1;
    if (d.giro > 0 && objetivo) {
      const actual = Math.atan2(this.vy, this.vx);
      const deseado = Math.atan2(objetivo.y - this.y, objetivo.x - this.x);
      let delta = deseado - actual;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const a = actual + Math.max(-d.giro * dt, Math.min(d.giro * dt, delta));
      this.vx = Math.cos(a) * v;
      this.vy = Math.sin(a) * v;
    }
    if (d.aceleracion !== 0) {
      const nv = Math.max(0, v + d.aceleracion * dt);
      this.vx *= nv / v;
      this.vy *= nv / v;
    }
    this.vy += d.gravedad * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.t += dt;
    if (this.t >= d.vida) this.vivo = false;
    if (mundo && !d.atraviesaRoca && esSolida(mundo.celda(Math.floor(this.x / mundo.tile), Math.floor(this.y / mundo.tile)))) this.vivo = false;
  }
}

/** Velocidad para ir recto hacia el objetivo. */
export function apuntarRecto(desde: { x: number; y: number }, hacia: { x: number; y: number }, velocidad: number): { vx: number; vy: number } {
  const dx = hacia.x - desde.x;
  const dy = hacia.y - desde.y;
  const l = Math.hypot(dx, dy) || 1;
  return { vx: (dx / l) * velocidad, vy: (dy / l) * velocidad };
}

/**
 * Tiro parabólico que cae exactamente en el objetivo en `tVuelo` segundos (granadas, lanzadores, flechas en arco).
 * Por defecto el tiempo crece con la distancia: 0.9 + min(|dx|/400, 0.5).
 */
export function apuntarArco(desde: { x: number; y: number }, hacia: { x: number; y: number }, gravedad: number, tVuelo?: number): { vx: number; vy: number; t: number } {
  const dx = hacia.x - desde.x;
  const dy = hacia.y - desde.y;
  const t = tVuelo ?? 0.9 + Math.min(Math.abs(dx) / 400, 0.5);
  return { vx: dx / t, vy: (dy - 0.5 * gravedad * t * t) / t, t };
}
