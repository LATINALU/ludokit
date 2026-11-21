// Value objects inmutables de geometría 2D (y hacia abajo, como en pantalla).
export interface V2 {
  readonly x: number;
  readonly y: number;
}

export const v2 = (x: number, y: number): V2 => ({ x, y });
export const CERO: V2 = v2(0, 0);
export const sumar = (a: V2, b: V2): V2 => v2(a.x + b.x, a.y + b.y);
export const restar = (a: V2, b: V2): V2 => v2(a.x - b.x, a.y - b.y);
export const escalar = (a: V2, k: number): V2 => v2(a.x * k, a.y * k);
export const largo = (a: V2): number => Math.hypot(a.x, a.y);
export const distancia = (a: V2, b: V2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerpV = (a: V2, b: V2, t: number): V2 => v2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const desdeAngulo = (a: number): V2 => v2(Math.cos(a), Math.sin(a));
export function normalizar(a: V2): V2 {
  const l = largo(a);
  return l > 1e-6 ? escalar(a, 1 / l) : CERO;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const seTocan = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const contiene = (r: Rect, p: V2): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
export const centro = (r: Rect): V2 => v2(r.x + r.w / 2, r.y + r.h / 2);
export const inflar = (r: Rect, m: number): Rect => rect(r.x - m, r.y - m, r.w + 2 * m, r.h + 2 * m);
