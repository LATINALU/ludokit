// Raycast sobre una grilla de tiles con DDA (Amanatides & Woo): recorre exactamente las celdas que cruza el rayo.
// Línea de visión de la IA, balas hitscan, láseres, luz 2D, cámaras que no atraviesan paredes, niebla de guerra.

export interface ImpactoGrilla {
  readonly c: number;
  readonly f: number;
  /** Distancia en px desde el origen. */
  readonly distancia: number;
  readonly x: number;
  readonly y: number;
  /** Normal de la cara golpeada. */
  readonly nx: number;
  readonly ny: number;
}

export function raycastGrilla(
  ox: number, oy: number, dx: number, dy: number, maxDist: number, tile: number,
  solida: (c: number, f: number) => boolean,
): ImpactoGrilla | null {
  const l = Math.hypot(dx, dy);
  if (l < 1e-12) return null;
  dx /= l;
  dy /= l;
  let c = Math.floor(ox / tile);
  let f = Math.floor(oy / tile);
  const pasoC = dx > 0 ? 1 : -1;
  const pasoF = dy > 0 ? 1 : -1;
  const tDeltaX = Math.abs(dx) < 1e-12 ? Infinity : tile / Math.abs(dx);
  const tDeltaY = Math.abs(dy) < 1e-12 ? Infinity : tile / Math.abs(dy);
  let tMaxX = Math.abs(dx) < 1e-12 ? Infinity : ((dx > 0 ? (c + 1) * tile - ox : ox - c * tile) / Math.abs(dx));
  let tMaxY = Math.abs(dy) < 1e-12 ? Infinity : ((dy > 0 ? (f + 1) * tile - oy : oy - f * tile) / Math.abs(dy));
  let t = 0;
  let nx = 0, ny = 0;
  if (solida(c, f)) return { c, f, distancia: 0, x: ox, y: oy, nx: 0, ny: 0 };
  while (t <= maxDist) {
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      c += pasoC;
      nx = -pasoC;
      ny = 0;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      f += pasoF;
      nx = 0;
      ny = -pasoF;
    }
    if (t > maxDist) break;
    if (solida(c, f)) return { c, f, distancia: t, x: ox + dx * t, y: oy + dy * t, nx, ny };
  }
  return null;
}

/** ¿Se ven dos puntos? (línea de visión). */
export function hayVision(ax: number, ay: number, bx: number, by: number, tile: number, solida: (c: number, f: number) => boolean): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  return raycastGrilla(ax, ay, bx - ax, by - ay, d, tile, solida) === null;
}
