// Visión: NIEBLA DE GUERRA, CONOS DE VISIÓN y SIGILO.
//   - `NieblaGuerra`: grilla con tres estados por celda (oculta, explorada, visible). Cada paso se recalcula lo
//     visible desde varias fuentes (unidades, torres, guardianes) con radio y bloqueo por línea de visión (rayos
//     Bresenham hasta el borde del círculo). Lo visible pasa a explorado al dejar de verse (RTS, MOBA, roguelike).
//   - `enConoDeVision`: ¿un punto está dentro del cono y del alcance de un guardia? (sigilo, IA).
//   - `Sospecha`: medidor de detección que se llena según distancia, luz, movimiento y ruido; decae al perder de
//     vista. Estados: tranquilo → sospechoso → alerta (con histéresis).
//   - `propagarRuido`: qué oyentes escuchan un ruido según su radio y la atenuación por paredes.

export type EstadoNiebla = 0 | 1 | 2; // 0 oculta, 1 explorada, 2 visible

export interface FuenteVision {
  readonly x: number;
  readonly y: number;
  readonly radio: number;
  /** Ve por encima de obstáculos (unidades voladoras, guardianes altos). */
  readonly ignoraBloqueo?: boolean;
}

export class NieblaGuerra {
  readonly cols: number;
  readonly filas: number;
  private readonly celdas: Uint8Array;
  private readonly bloquea: (c: number, f: number) => boolean;

  constructor(cols: number, filas: number, bloquea: (c: number, f: number) => boolean) {
    this.cols = cols;
    this.filas = filas;
    this.celdas = new Uint8Array(cols * filas);
    this.bloquea = bloquea;
  }

  estado(c: number, f: number): EstadoNiebla {
    if (c < 0 || f < 0 || c >= this.cols || f >= this.filas) return 0;
    return this.celdas[f * this.cols + c] as EstadoNiebla;
  }

  visible(c: number, f: number): boolean {
    return this.estado(c, f) === 2;
  }

  /** Recalcula lo visible (lo que estaba visible pasa a explorado). Coordenadas en celdas. */
  actualizar(fuentes: readonly FuenteVision[]): void {
    for (let i = 0; i < this.celdas.length; i++) if (this.celdas[i] === 2) this.celdas[i] = 1;
    for (const s of fuentes) {
      const r = Math.ceil(s.radio);
      const cx = Math.floor(s.x), cy = Math.floor(s.y);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > s.radio * s.radio) continue;
          const c = cx + dx, f = cy + dy;
          if (c < 0 || f < 0 || c >= this.cols || f >= this.filas) continue;
          if (s.ignoraBloqueo || this.lineaLibre(cx, cy, c, f)) this.celdas[f * this.cols + c] = 2;
        }
      }
    }
  }

  /** Línea de visión por Bresenham: la celda destino se ve aunque sea pared (se ven las paredes). */
  lineaLibre(x0: number, y0: number, x1: number, y1: number): boolean {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      if ((x !== x0 || y !== y0) && this.bloquea(x, y)) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return true;
  }

  exportarExplorado(): Uint8Array {
    return this.celdas.map((v) => (v > 0 ? 1 : 0));
  }
}

/** ¿El punto (px,py) está en el cono del observador? `dir` y `semiAngulo` en radianes. */
export function enConoDeVision(ox: number, oy: number, dir: number, semiAngulo: number, alcance: number, px: number, py: number): boolean {
  const dx = px - ox, dy = py - oy;
  const d = Math.hypot(dx, dy);
  if (d > alcance) return false;
  if (d < 1e-9) return true;
  const a = Math.atan2(dy, dx) - dir;
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= semiAngulo;
}

export type Alerta = "tranquilo" | "sospechoso" | "alerta";

export interface ReglasSospecha {
  /** Llenado por segundo a distancia 0 con luz plena; cae con la distancia hasta `alcance`. */
  readonly llenado: number;
  readonly alcance: number;
  readonly decae: number;
  /** Multiplicadores por postura/movimiento. */
  readonly agachado: number;
  readonly corriendo: number;
  /** Umbrales para sospechoso y alerta (0..1) y para volver a tranquilo. */
  readonly umbralSospecha: number;
  readonly umbralAlerta: number;
  readonly umbralCalma: number;
}

export class Sospecha {
  valor = 0;
  estado: Alerta = "tranquilo";
  readonly reglas: ReglasSospecha;

  constructor(reglas: ReglasSospecha) {
    this.reglas = reglas;
  }

  /**
   * `ve`: si el objetivo está en el cono y con línea de visión. `luz` 0..1 en el objetivo. `ruido` 0..1 suma
   * aunque no lo vea.
   */
  actualizar(dt: number, ve: boolean, distancia: number, luz: number, op: { agachado?: boolean; corriendo?: boolean; ruido?: number } = {}): Alerta {
    const r = this.reglas;
    let llena = 0;
    if (ve) {
      const cerca = Math.max(0, 1 - distancia / r.alcance);
      llena = r.llenado * cerca * Math.max(0, Math.min(1, luz)) * (op.agachado ? r.agachado : 1) * (op.corriendo ? r.corriendo : 1);
    }
    llena += r.llenado * (op.ruido ?? 0);
    this.valor = Math.min(1, Math.max(0, this.valor + (llena > 0 ? llena : -r.decae) * dt));
    if (this.valor >= r.umbralAlerta) this.estado = "alerta";
    else if (this.valor >= r.umbralSospecha && this.estado === "tranquilo") this.estado = "sospechoso";
    else if (this.valor <= r.umbralCalma) this.estado = "tranquilo";
    return this.estado;
  }
}

export interface Oyente {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Sensibilidad (1 = normal). */
  readonly oido?: number;
}

/**
 * Quién oye un ruido de `volumen` (radio base). `paredes(x0,y0,x1,y1)` devuelve cuántas paredes hay en medio; cada
 * una multiplica el radio por `atenuacion`. Devuelve los oyentes con la intensidad 0..1 percibida.
 */
export function propagarRuido(x: number, y: number, volumen: number, oyentes: readonly Oyente[], paredes?: (x0: number, y0: number, x1: number, y1: number) => number, atenuacion = 0.5): Array<{ id: number; intensidad: number }> {
  const r: Array<{ id: number; intensidad: number }> = [];
  for (const o of oyentes) {
    const radio = volumen * (o.oido ?? 1) * Math.pow(atenuacion, paredes ? paredes(x, y, o.x, o.y) : 0);
    const d = Math.hypot(o.x - x, o.y - y);
    if (d <= radio) r.push({ id: o.id, intensidad: 1 - d / radio });
  }
  return r.sort((a, b) => b.intensidad - a.intensidad);
}
