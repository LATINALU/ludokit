// Ruido procedural determinista: hash entero, ruido de valor 2D suavizado, ruido de gradiente (Perlin mejorado),
// fBm (octavas), versión TILEABLE (se repite sin costura cada periodo) y ruido de dominio deformado.
// Terreno, biomas, cuevas, nubes, temperatura, distribución de recursos, texturas procedurales.

export function hash2(x: number, y: number, semilla = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(semilla | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const suave = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const mezcla = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ruido de valor 2D en [0,1). */
export function ruidoValor(x: number, y: number, semilla = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = suave(x - xi), ty = suave(y - yi);
  return mezcla(mezcla(hash2(xi, yi, semilla), hash2(xi + 1, yi, semilla), tx), mezcla(hash2(xi, yi + 1, semilla), hash2(xi + 1, yi + 1, semilla), tx), ty);
}

function gradiente(ix: number, iy: number, x: number, y: number, semilla: number): number {
  const a = hash2(ix, iy, semilla) * Math.PI * 2;
  return Math.cos(a) * (x - ix) + Math.sin(a) * (y - iy);
}

/** Ruido de gradiente 2D en aprox. [-0.7, 0.7] (más orgánico que el de valor). */
export function ruidoGradiente(x: number, y: number, semilla = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = suave(x - x0), ty = suave(y - y0);
  const a = mezcla(gradiente(x0, y0, x, y, semilla), gradiente(x0 + 1, y0, x, y, semilla), tx);
  const b = mezcla(gradiente(x0, y0 + 1, x, y, semilla), gradiente(x0 + 1, y0 + 1, x, y, semilla), tx);
  return mezcla(a, b, ty);
}

/** fBm: suma de octavas con lacunaridad y ganancia. Normalizado a [0,1). */
export function fbm(x: number, y: number, op: { semilla?: number; octavas?: number; lacunaridad?: number; ganancia?: number } = {}): number {
  const oct = op.octavas ?? 4, lac = op.lacunaridad ?? 2, gan = op.ganancia ?? 0.5;
  let s = 0, amp = 1, frec = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += ruidoValor(x * frec, y * frec, (op.semilla ?? 0) + i * 101) * amp;
    norm += amp;
    amp *= gan;
    frec *= lac;
  }
  return s / norm;
}

/** Ruido de valor que se repite cada (px, py) celdas: texturas y mapas que tilean sin costura. */
export function ruidoTileable(x: number, y: number, px: number, py: number, semilla = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = suave(x - xi), ty = suave(y - yi);
  const w = (a: number, p: number): number => ((a % p) + p) % p;
  const h = (a: number, b: number): number => hash2(w(a, px), w(b, py), semilla);
  return mezcla(mezcla(h(xi, yi), h(xi + 1, yi), tx), mezcla(h(xi, yi + 1), h(xi + 1, yi + 1), tx), ty);
}

/** Dominio deformado: muestrea el fBm desplazado por otro fBm (formas más naturales: costas, vetas). */
export function ruidoDeformado(x: number, y: number, fuerza = 4, semilla = 0): number {
  const qx = fbm(x, y, { semilla });
  const qy = fbm(x + 5.2, y + 1.3, { semilla: semilla + 7 });
  return fbm(x + fuerza * qx, y + fuerza * qy, { semilla: semilla + 13 });
}

/** Clasifica un valor 0..1 en bandas (agua, arena, pasto, roca, nieve...). */
export function bandas<T>(v: number, cortes: ReadonlyArray<readonly [number, T]>): T {
  for (const [hasta, t] of cortes) if (v < hasta) return t;
  return cortes[cortes.length - 1][1];
}
