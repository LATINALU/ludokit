// Pruebas de colisión (narrowphase) con vector de separación mínimo (MTV), barrido continuo de AABB (sin túnel a
// alta velocidad), rayos contra cajas y círculos, y SAT para polígonos convexos. Convención: y hacia abajo.

import type { Caja } from "./hash-espacial.ts";

export interface Circulo {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Resultado de una colisión: normal (de A hacia afuera de B... apuntando de B a A) y profundidad. */
export interface Contacto {
  readonly nx: number;
  readonly ny: number;
  readonly profundidad: number;
}

export function aabbSolapa(a: Caja, b: Caja): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** MTV entre dos AABB: cuánto mover A (por el eje de menor penetración) para separarlas. */
export function aabbContacto(a: Caja, b: Caja): Contacto | null {
  const dx = a.x + a.w / 2 - (b.x + b.w / 2);
  const px = (a.w + b.w) / 2 - Math.abs(dx);
  if (px <= 0) return null;
  const dy = a.y + a.h / 2 - (b.y + b.h / 2);
  const py = (a.h + b.h) / 2 - Math.abs(dy);
  if (py <= 0) return null;
  return px < py ? { nx: Math.sign(dx) || 1, ny: 0, profundidad: px } : { nx: 0, ny: Math.sign(dy) || 1, profundidad: py };
}

export function circuloContacto(a: Circulo, b: Circulo): Contacto | null {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  const p = a.r + b.r - d;
  if (p <= 0) return null;
  return d < 1e-9 ? { nx: 1, ny: 0, profundidad: p } : { nx: dx / d, ny: dy / d, profundidad: p };
}

export function circuloCaja(c: Circulo, b: Caja): Contacto | null {
  const qx = Math.max(b.x, Math.min(c.x, b.x + b.w));
  const qy = Math.max(b.y, Math.min(c.y, b.y + b.h));
  const dx = c.x - qx;
  const dy = c.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > c.r * c.r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, profundidad: c.r - d };
  }
  // Centro dentro de la caja: salir por el lado más cercano.
  const izq = c.x - b.x, der = b.x + b.w - c.x, arr = c.y - b.y, aba = b.y + b.h - c.y;
  const m = Math.min(izq, der, arr, aba);
  if (m === izq) return { nx: -1, ny: 0, profundidad: izq + c.r };
  if (m === der) return { nx: 1, ny: 0, profundidad: der + c.r };
  if (m === arr) return { nx: 0, ny: -1, profundidad: arr + c.r };
  return { nx: 0, ny: 1, profundidad: aba + c.r };
}

/** Rayo vs AABB (slabs). Devuelve t en [0, tMax] del primer impacto y la normal, o null. */
export function rayoCaja(ox: number, oy: number, dx: number, dy: number, b: Caja, tMax = Infinity): { t: number; nx: number; ny: number } | null {
  let tmin = 0;
  let tmax = tMax;
  let nx = 0;
  let ny = 0;
  for (const eje of [0, 1]) {
    const o = eje === 0 ? ox : oy;
    const d = eje === 0 ? dx : dy;
    const lo = eje === 0 ? b.x : b.y;
    const hi = eje === 0 ? b.x + b.w : b.y + b.h;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    let n = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = eje === 0 ? n : 0;
      ny = eje === 1 ? n : 0;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return { t: tmin, nx, ny };
}

/**
 * Barrido continuo: caja A moviéndose (vx, vy) durante el paso contra caja quieta B (Minkowski + rayo).
 * Devuelve la fracción del movimiento [0,1] hasta tocar y la normal. Evita que una bala rápida atraviese paredes.
 */
export function barrerCaja(a: Caja, vx: number, vy: number, b: Caja): { t: number; nx: number; ny: number } | null {
  const expandida: Caja = { x: b.x - a.w / 2, y: b.y - a.h / 2, w: b.w + a.w, h: b.h + a.h };
  const r = rayoCaja(a.x + a.w / 2, a.y + a.h / 2, vx, vy, expandida, 1);
  return r && r.t >= 0 && r.t <= 1 ? r : null;
}

export function rayoCirculo(ox: number, oy: number, dx: number, dy: number, c: Circulo, tMax = Infinity): number | null {
  const fx = ox - c.x, fy = oy - c.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0 || a < 1e-12) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  const t = t1 >= 0 ? t1 : t2 >= 0 ? t2 : null;
  return t !== null && t <= tMax ? t : null;
}

export type Poligono = ReadonlyArray<readonly [number, number]>;

function proyectar(p: Poligono, ax: number, ay: number): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const [x, y] of p) {
    const d = x * ax + y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** SAT para polígonos convexos (vértices en orden). Normal de B hacia A. */
export function satPoligonos(a: Poligono, b: Poligono): Contacto | null {
  let mejor = Infinity;
  let nx = 0, ny = 0;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      let ax = -(y2 - y1), ay = x2 - x1;
      const l = Math.hypot(ax, ay);
      if (l < 1e-12) continue;
      ax /= l;
      ay /= l;
      const [amin, amax] = proyectar(a, ax, ay);
      const [bmin, bmax] = proyectar(b, ax, ay);
      const solape = Math.min(amax, bmax) - Math.max(amin, bmin);
      if (solape <= 0) return null;
      if (solape < mejor) {
        mejor = solape;
        nx = ax;
        ny = ay;
      }
    }
  }
  const ca = centroide(a), cb = centroide(b);
  if ((ca[0] - cb[0]) * nx + (ca[1] - cb[1]) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny, profundidad: mejor };
}

export function centroide(p: Poligono): [number, number] {
  let x = 0, y = 0;
  for (const [px, py] of p) {
    x += px;
    y += py;
  }
  return [x / p.length, y / p.length];
}

export function rectAPoligono(c: Caja, angulo = 0): Poligono {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const co = Math.cos(angulo), si = Math.sin(angulo);
  return ([[-c.w / 2, -c.h / 2], [c.w / 2, -c.h / 2], [c.w / 2, c.h / 2], [-c.w / 2, c.h / 2]] as const).map(
    ([x, y]) => [cx + x * co - y * si, cy + x * si + y * co] as const,
  );
}
