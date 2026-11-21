// Mapas de normales automáticos a partir del arte (para luz 2D con relieve sin dibujar normales a mano):
//   altura = mitad luminancia + mitad BISEL (distancia chamfer al borde transparente, hasta `bisel` px),
//   normal = gradiente Sobel de la altura × fuerza. Lo transparente queda plano hacia la cámara (128,128,255).
// Fuera de la región se repite el borde: los tiles no muestran costura.

import { crearImagen, type Imagen } from "./imagen.ts";

const lum = (d: Uint8ClampedArray, i: number): number => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;

export function alturas(im: Imagen, bisel = 3): Float32Array {
  const { w, h, datos } = im;
  const hayTransparencia = (() => {
    for (let i = 3; i < datos.length; i += 4) if (datos[i] < 26) return true;
    return false;
  })();
  let dist = new Float32Array(w * h).fill(bisel);
  if (hayTransparencia) {
    for (let i = 0; i < w * h; i++) if (datos[i * 4 + 3] < 26) dist[i] = 0;
    for (let k = 0; k < bisel; k++) {
      const prev = dist.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let m = prev[y * w + x];
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          const v = nx < 0 || ny < 0 || nx >= w || ny >= h ? 0 : prev[ny * w + nx];
          m = Math.min(m, v + 1);
        }
        dist[y * w + x] = m;
      }
    }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (datos[i * 4 + 3] < 26) out[i] = 0;
    else out[i] = hayTransparencia ? 0.5 * lum(datos, i * 4) + 0.5 * Math.min(1, dist[i] / bisel) : lum(datos, i * 4);
  }
  return out;
}

export function mapaNormales(im: Imagen, fuerza = 2, bisel = 3): Imagen {
  const { w, h } = im;
  const alt = alturas(im, bisel);
  const a = (x: number, y: number): number => alt[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const out = crearImagen(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (im.datos[i + 3] < 26) {
      out.datos.set([128, 128, 255, 255], i);
      continue;
    }
    const gx = a(x + 1, y - 1) + 2 * a(x + 1, y) + a(x + 1, y + 1) - (a(x - 1, y - 1) + 2 * a(x - 1, y) + a(x - 1, y + 1));
    const gy = a(x - 1, y + 1) + 2 * a(x, y + 1) + a(x + 1, y + 1) - (a(x - 1, y - 1) + 2 * a(x, y - 1) + a(x + 1, y - 1));
    const nx = -gx * fuerza, ny = -gy * fuerza, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const c = (v: number): number => Math.round(((v / l) * 0.5 + 0.5) * 255);
    out.datos.set([c(nx), c(ny), c(nz), 255], i);
  }
  return out;
}
