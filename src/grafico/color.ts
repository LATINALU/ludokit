// Color: sRGB ↔ lineal ↔ OKLab (espacio perceptual: distancias que coinciden con lo que ve el ojo), cuantización a
// una paleta limitada por OKLab, y gradación de color (split-toning sombras/medios/luces, contraste, saturación)
// horneable en una LUT 3D (tira 1024×32 RGBA8: x = azul·32 + rojo, y = verde) para aplicarla en un shader.

export type Rgb = readonly [number, number, number];

export const hexARgb = (h: number): Rgb => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const rgbAHex = (c: Rgb): number => (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);

const lineal = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function aOklab([R, G, B]: Rgb): [number, number, number] {
  const r = lineal(R), g = lineal(G), b = lineal(B);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function desdeOklab([L, A, B]: readonly [number, number, number]): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  const c = (v: number): number => Math.max(0, Math.min(1, gamma(v)));
  return [c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), c(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

/** Mezcla perceptual (los degradados no pasan por grises sucios). */
export const mezclarOklab = (a: Rgb, b: Rgb, t: number): [number, number, number] => {
  const x = aOklab(a), y = aOklab(b);
  return desdeOklab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

/** Paleta precalculada en OKLab para buscar el color más cercano rápido. */
export class Paleta {
  readonly colores: readonly Rgb[];
  private readonly lab: Array<[number, number, number]>;

  constructor(hex: readonly number[]) {
    this.colores = hex.map(hexARgb);
    this.lab = this.colores.map(aOklab);
  }

  masCercano(c: Rgb): Rgb {
    const p = aOklab(c);
    let mejor = 0, d = Infinity;
    this.lab.forEach((q, i) => {
      const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (dd < d) [d, mejor] = [dd, i];
    });
    return this.colores[mejor];
  }
}

export interface Gradacion {
  readonly sombras: Rgb;
  readonly medios: Rgb;
  readonly luces: Rgb;
  readonly contraste: number;
  readonly saturacion: number;
  readonly paleta?: Paleta;
  /** 0..1: cuánto se acerca cada color al de la paleta (1 = todo en paleta). */
  readonly mezclaPaleta?: number;
}

export const GRADACION_NEUTRA: Gradacion = { sombras: [1, 1, 1], medios: [1, 1, 1], luces: [1, 1, 1], contraste: 1, saturacion: 1 };

/** Aplica la gradación a un color (referencia en CPU; la GPU usa la LUT). */
export function aplicarGradacion(g: Gradacion, c: Rgb): [number, number, number] {
  const cl = (v: number): number => Math.max(0, Math.min(1, v));
  let x = c.map((v) => cl((v - 0.5) * g.contraste + 0.5)) as [number, number, number];
  const l = 0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2];
  x = x.map((v) => cl(l + (v - l) * g.saturacion)) as [number, number, number];
  const ws = (1 - l) * (1 - l), wh = l * l, wm = Math.max(0, 1 - ws - wh);
  for (let i = 0; i < 3; i++) x[i] = cl(x[i] * (g.sombras[i] * ws + g.medios[i] * wm + g.luces[i] * wh));
  if (g.paleta && (g.mezclaPaleta ?? 0) > 0) {
    const p = g.paleta.masCercano(x);
    const t = cl(g.mezclaPaleta ?? 0);
    for (let i = 0; i < 3; i++) x[i] += (p[i] - x[i]) * t;
  }
  return x;
}

/** Hornea la LUT 3D (lado³) en una tira (lado² × lado) RGBA8. */
export function hornearLut(g: Gradacion, lado = 32): { w: number; h: number; datos: Uint8ClampedArray } {
  const w = lado * lado;
  const datos = new Uint8ClampedArray(w * lado * 4);
  const k = 1 / (lado - 1);
  for (let gv = 0; gv < lado; gv++) for (let b = 0; b < lado; b++) for (let r = 0; r < lado; r++) {
    const c = aplicarGradacion(g, [r * k, gv * k, b * k]);
    const i = (gv * w + b * lado + r) * 4;
    datos[i] = Math.round(c[0] * 255);
    datos[i + 1] = Math.round(c[1] * 255);
    datos[i + 2] = Math.round(c[2] * 255);
    datos[i + 3] = 255;
  }
  return { w, h: lado, datos };
}
