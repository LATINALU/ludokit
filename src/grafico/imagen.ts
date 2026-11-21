// Imagen RGBA8 en memoria (compatible con ImageData del navegador, con texturas de cualquier motor y con PNG
// decodificados) y operaciones pixel-perfect: reescalado por vecino más cercano (sin "mixels"), contorno de 1 px,
// silueta blanca para el destello de golpe, alfa binaria, recorte a lo visible y giro de tono.

export interface Imagen {
  readonly w: number;
  readonly h: number;
  /** RGBA8, fila por fila. */
  readonly datos: Uint8ClampedArray;
}

export const crearImagen = (w: number, h: number): Imagen => ({ w, h, datos: new Uint8ClampedArray(w * h * 4) });

export function leer(im: Imagen, x: number, y: number): [number, number, number, number] {
  const i = (y * im.w + x) * 4;
  const d = im.datos;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

export function pintar(im: Imagen, x: number, y: number, rgba: readonly [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
  im.datos.set(rgba, (y * im.w + x) * 4);
}

/** Desde texto ASCII + paleta (sprites y tiles dibujados en el código). '.' o ' ' = transparente. */
export function desdeAscii(filas: readonly string[], paleta: Readonly<Record<string, readonly [number, number, number, number?]>>): Imagen {
  const im = crearImagen(Math.max(...filas.map((f) => f.length)), filas.length);
  filas.forEach((f, y) => [...f].forEach((ch, x) => {
    const c = paleta[ch];
    if (c) pintar(im, x, y, [c[0], c[1], c[2], c[3] ?? 255]);
  }));
  return im;
}

/** Reescalado por vecino más cercano a un tamaño exacto (rehacer UNA vez a su tamaño real en píxeles). */
export function escalarVecino(im: Imagen, w: number, h: number): Imagen {
  const out = crearImagen(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(im.h - 1, Math.floor(((y + 0.5) * im.h) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(im.w - 1, Math.floor(((x + 0.5) * im.w) / w));
      out.datos.set(im.datos.subarray((sy * im.w + sx) * 4, (sy * im.w + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return out;
}

/** Alfa binaria: ≥ umbral queda opaco, el resto se borra (bordes limpios a escala entera). */
export function alfaBinaria(im: Imagen, umbral = 128): Imagen {
  const out = crearImagen(im.w, im.h);
  out.datos.set(im.datos);
  for (let i = 3; i < out.datos.length; i += 4) out.datos[i] = out.datos[i] >= umbral ? 255 : 0;
  return out;
}

/** Contorno de 1 px por fuera de la silueta (4-vecinos). Agranda la imagen 1 px por lado. */
export function contornear(im: Imagen, color: readonly [number, number, number, number] = [16, 12, 22, 255]): Imagen {
  const out = crearImagen(im.w + 2, im.h + 2);
  for (let y = 0; y < im.h; y++) out.datos.set(im.datos.subarray(y * im.w * 4, (y + 1) * im.w * 4), ((y + 1) * out.w + 1) * 4);
  const opaco = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < out.w && y < out.h && out.datos[(y * out.w + x) * 4 + 3] > 0;
  const borde: number[] = [];
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (!opaco(x, y) && (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1))) borde.push(y * out.w + x);
  for (const i of borde) out.datos.set(color, i * 4);
  return out;
}

/** Silueta blanca (mismo alfa): para el destello de un golpe. */
export function silueta(im: Imagen, rgb: readonly [number, number, number] = [255, 255, 255]): Imagen {
  const out = crearImagen(im.w, im.h);
  for (let i = 0; i < im.datos.length; i += 4) {
    out.datos[i] = rgb[0];
    out.datos[i + 1] = rgb[1];
    out.datos[i + 2] = rgb[2];
    out.datos[i + 3] = im.datos[i + 3];
  }
  return out;
}

/** Caja de lo visible (alfa > 0), o null si está vacía. */
export function cajaVisible(im: Imagen): { x: number; y: number; w: number; h: number } | null {
  let x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.datos[(y * im.w + x) * 4 + 3] > 0) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function recortar(im: Imagen, c: { x: number; y: number; w: number; h: number }): Imagen {
  const out = crearImagen(c.w, c.h);
  for (let y = 0; y < c.h; y++) out.datos.set(im.datos.subarray(((c.y + y) * im.w + c.x) * 4, ((c.y + y) * im.w + c.x + c.w) * 4), y * c.w * 4);
  return out;
}

/** Color de contorno de un dibujo: el color más común entre los píxeles opacos que tocan el aire. */
export function colorDeContorno(im: Imagen): [number, number, number, number] | null {
  const cuenta = new Map<number, number>();
  const a = (x: number, y: number): number => (x < 0 || y < 0 || x >= im.w || y >= im.h ? 0 : im.datos[(y * im.w + x) * 4 + 3]);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (!a(x, y) || (a(x - 1, y) && a(x + 1, y) && a(x, y - 1) && a(x, y + 1))) continue;
    const i = (y * im.w + x) * 4;
    const k = (im.datos[i] << 16) | (im.datos[i + 1] << 8) | im.datos[i + 2];
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  let mejor = -1, n = 0;
  for (const [k, v] of cuenta) if (v > n) [mejor, n] = [k, v];
  return mejor < 0 ? null : [mejor >> 16, (mejor >> 8) & 255, mejor & 255, 255];
}

/** Reescalado pixel-perfect de un sprite a un alto dado conservando su contorno original. */
export function reescalarSprite(im: Imagen, alto: number): Imagen {
  const caja = cajaVisible(im);
  if (!caja) return crearImagen(1, Math.max(1, alto));
  const recorte = recortar(im, caja);
  const tinta = colorDeContorno(recorte) ?? [16, 12, 22, 255];
  const hi = Math.max(1, alto - 2);
  const wi = Math.max(1, Math.round((recorte.w * hi) / recorte.h));
  return contornear(alfaBinaria(escalarVecino(recorte, wi, hi)), tinta);
}

/** Variante de color: gira el tono (grados) y escala saturación y brillo, en HSV. */
export function girarTono(im: Imagen, grados: number, saturacion = 1, brillo = 1): Imagen {
  const out = crearImagen(im.w, im.h);
  const d = im.datos, o = out.datos;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0;
    if (delta > 0) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    h = (((h * 60 + grados) % 360) + 360) % 360;
    const s = Math.min(1, (max === 0 ? 0 : delta / max) * saturacion);
    const v = Math.min(1, max * brillo);
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    o[i] = Math.round((rr + m) * 255);
    o[i + 1] = Math.round((gg + m) * 255);
    o[i + 2] = Math.round((bb + m) * 255);
    o[i + 3] = d[i + 3];
  }
  return out;
}
