// Utilidades matemáticas sin estado (clamp, interpolación, curvas). Para ruido y easing de efectos ver vfx.
export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number): number => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x: number, a0: number, a1: number, b0: number, b1: number): number => lerp(b0, b1, invLerp(a0, a1, x));
export const fract = (x: number): number => x - Math.floor(x);
export const wrap = (x: number, m: number): number => ((x % m) + m) % m;
/** 0..1 dentro de [t0, t1]. */
export const seg = (t: number, t0: number, t1: number): number => clamp((t - t0) / (t1 - t0));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Campana 0→1→0 entre t0 y t1. */
export const bump = (t: number, t0: number, t1: number): number => (t <= t0 || t >= t1 ? 0 : Math.sin(Math.PI * seg(t, t0, t1)));
/** Acercar `v` a `objetivo` como máximo `paso`. */
export function acercar(v: number, objetivo: number, paso: number): number {
  return v < objetivo ? Math.min(objetivo, v + paso) : Math.max(objetivo, v - paso);
}
/** Curva de potencia interpolada entre dos tablas (rareza por piso): t = ((i-1)/(n-1))^exp. */
export function interpolarTablas(a: readonly number[], b: readonly number[], i: number, n: number, exp = 1): number[] {
  const t = Math.pow(clamp((i - 1) / Math.max(1, n - 1)), exp);
  return a.map((v, k) => v + (b[k] - v) * t);
}
