// Movimiento en vista superior (RPG, roguelike de acción, twin-stick, juego de granja): 8 direcciones con
// aceleración, freno y normalización diagonal, contra la misma grilla de tiles (sin gravedad).
// También sirve para enemigos que persiguen y para naves en un shooter espacial (con `friccion` baja).

import { Cuerpo, mover } from "./cuerpo.ts";
import type { MundoTiles } from "./grilla.ts";

export interface PerfilSuperior {
  readonly vel: number;
  readonly acel: number;
  readonly freno: number;
  /** Fricción proporcional extra (0 = ninguna; naves: 0.5-2). */
  readonly friccion: number;
  readonly esquinas: number;
}

export const PERFIL_SUPERIOR_BASE: PerfilSuperior = { vel: 90, acel: 900, freno: 1100, friccion: 0, esquinas: 3 };

export class MovilSuperior {
  readonly cuerpo: Cuerpo;
  perfil: PerfilSuperior;
  /** Dirección a la que mira (último eje no nulo, normalizado). */
  mirar = { x: 1, y: 0 };

  constructor(x: number, y: number, w = 12, h = 12, perfil: PerfilSuperior = PERFIL_SUPERIOR_BASE) {
    this.cuerpo = new Cuerpo(x, y, w, h);
    this.perfil = perfil;
  }

  /** `ex`, `ey` en [-1, 1] (stick analógico o teclas). */
  actualizar(dt: number, ex: number, ey: number, mundo: MundoTiles | null): void {
    const c = this.cuerpo;
    const p = this.perfil;
    let l = Math.hypot(ex, ey);
    if (l > 1) {
      ex /= l;
      ey /= l;
      l = 1;
    }
    if (l > 0.05) this.mirar = { x: ex / l, y: ey / l };
    const ox = ex * p.vel;
    const oy = ey * p.vel;
    const acel = l > 0.05 ? p.acel : p.freno;
    const dx = ox - c.vx;
    const dy = oy - c.vy;
    const d = Math.hypot(dx, dy);
    const paso = acel * dt;
    if (d <= paso) {
      c.vx = ox;
      c.vy = oy;
    } else {
      c.vx += (dx / d) * paso;
      c.vy += (dy / d) * paso;
    }
    if (p.friccion > 0) {
      c.vx -= c.vx * p.friccion * dt;
      c.vy -= c.vy * p.friccion * dt;
    }
    if (mundo) {
      // Sin gravedad las plataformas de un sentido no tienen sentido: se atraviesan.
      mover(c, mundo, dt, { atravesar: true, esquinas: p.esquinas });
      c.enSuelo = false;
    } else {
      c.antX = c.x;
      c.antY = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
    }
  }
}
