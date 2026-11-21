// Cámara 2D: seguimiento suave con zona muerta, anticipación en la dirección de movimiento, límites del mundo,
// sacudida por trauma (trauma² para que los golpes chicos casi no se noten y los grandes sí) y redondeo a píxel
// con resto sub-píxel (para presentar a escala entera sin temblor).

export interface OpcionesCamara {
  readonly ancho: number;
  readonly alto: number;
  /** Zona muerta (px) alrededor del centro donde el objetivo se mueve sin arrastrar la cámara. */
  readonly zonaX?: number;
  readonly zonaY?: number;
  /** Suavizado exponencial (1/s): mayor = sigue más rápido. */
  readonly rigidez?: number;
  /** Anticipación: px por cada px/s de velocidad del objetivo (máx `anticipoMax`). */
  readonly anticipo?: number;
  readonly anticipoMax?: number;
  /** Límites del mundo (px). */
  readonly limites?: { x: number; y: number; w: number; h: number };
  readonly sacudidaMax?: number;
}

export class Camara {
  x = 0;
  y = 0;
  trauma = 0;
  private t = 0;
  private ax = 0;
  private readonly o: Required<Omit<OpcionesCamara, "limites">> & { limites?: OpcionesCamara["limites"] };

  constructor(o: OpcionesCamara) {
    this.o = { zonaX: 16, zonaY: 24, rigidez: 8, anticipo: 0.25, anticipoMax: 40, sacudidaMax: 6, ...o };
  }

  sacudir(cantidad: number): void {
    this.trauma = Math.min(1, this.trauma + cantidad);
  }

  centrarEn(px: number, py: number): void {
    this.x = px - this.o.ancho / 2;
    this.y = py - this.o.alto / 2;
    this.limitar();
  }

  actualizar(dt: number, objetivoX: number, objetivoY: number, velX = 0): void {
    const o = this.o;
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const deseadoAnt = Math.max(-o.anticipoMax, Math.min(o.anticipoMax, velX * o.anticipo));
    this.ax += (deseadoAnt - this.ax) * Math.min(1, dt * 3);
    const cx = this.x + o.ancho / 2;
    const cy = this.y + o.alto / 2;
    const tx = objetivoX + this.ax;
    let dx = 0;
    let dy = 0;
    if (tx > cx + o.zonaX) dx = tx - (cx + o.zonaX);
    else if (tx < cx - o.zonaX) dx = tx - (cx - o.zonaX);
    if (objetivoY > cy + o.zonaY) dy = objetivoY - (cy + o.zonaY);
    else if (objetivoY < cy - o.zonaY) dy = objetivoY - (cy - o.zonaY);
    const k = 1 - Math.exp(-o.rigidez * dt);
    this.x += dx * k;
    this.y += dy * k;
    this.limitar();
  }

  private limitar(): void {
    const l = this.o.limites;
    if (!l) return;
    this.x = l.w <= this.o.ancho ? l.x + (l.w - this.o.ancho) / 2 : Math.max(l.x, Math.min(l.x + l.w - this.o.ancho, this.x));
    this.y = l.h <= this.o.alto ? l.y + (l.h - this.o.alto) / 2 : Math.max(l.y, Math.min(l.y + l.h - this.o.alto, this.y));
  }

  /** Desplazamiento de sacudida actual (px). Determinista: senos inconmensurables, sin azar. */
  get sacudida(): { x: number; y: number } {
    const tr = this.trauma * this.trauma * this.o.sacudidaMax;
    return { x: Math.sin(this.t * 61) * tr, y: Math.cos(this.t * 47) * tr * 0.8 };
  }

  /** Posición final para dibujar: entera + resto sub-píxel (para un presentador que lo aplique a escala entera). */
  vista(): { x: number; y: number; restoX: number; restoY: number } {
    const s = this.sacudida;
    const fx = this.x + s.x;
    const fy = this.y + s.y;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    return { x: ix, y: iy, restoX: fx - ix, restoY: fy - iy };
  }

  mundoAPantalla(px: number, py: number): { x: number; y: number } {
    const v = this.vista();
    return { x: px - v.x, y: py - v.y };
  }
}
