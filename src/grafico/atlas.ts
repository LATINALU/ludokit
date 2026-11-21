// Empaquetador de atlas por "skyline" (línea de horizonte): coloca rectángulos de distintos tamaños en una textura
// minimizando el espacio perdido; mucho mejor que filas simples cuando hay sprites de alturas variadas. Con margen
// entre regiones (evita sangrado al filtrar) y opción de crecer la textura (potencias de 2) si no entra todo.
// Toda la escena en un atlas = un solo lote de dibujo.

export interface Region {
  readonly nombre: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export class EmpaquetadorAtlas {
  readonly ancho: number;
  readonly alto: number;
  readonly margen: number;
  private horizonte: Array<{ x: number; y: number; w: number }>;
  readonly regiones: Region[] = [];

  constructor(ancho: number, alto: number, margen = 1) {
    this.ancho = ancho;
    this.alto = alto;
    this.margen = margen;
    this.horizonte = [{ x: 0, y: 0, w: ancho }];
  }

  /** Coloca un rectángulo; null si no entra. */
  colocar(nombre: string, w: number, h: number): Region | null {
    const W = w + this.margen, H = h + this.margen;
    let mejorY = Infinity, mejorI = -1, mejorX = 0, mejorAncho = Infinity;
    for (let i = 0; i < this.horizonte.length; i++) {
      const y = this.cabe(i, W);
      if (y < 0 || y + H > this.alto) continue;
      const seg = this.horizonte[i];
      if (y < mejorY || (y === mejorY && seg.w < mejorAncho)) {
        mejorY = y;
        mejorI = i;
        mejorX = seg.x;
        mejorAncho = seg.w;
      }
    }
    if (mejorI < 0) return null;
    this.agregarSegmento(mejorI, mejorX, mejorY + H, W);
    const r: Region = { nombre, x: mejorX, y: mejorY, w, h };
    this.regiones.push(r);
    return r;
  }

  /** y donde cabe un ancho w empezando en el segmento i, o -1. */
  private cabe(i: number, w: number): number {
    const x = this.horizonte[i].x;
    if (x + w > this.ancho) return -1;
    let resto = w, y = 0;
    for (let j = i; resto > 0; j++) {
      if (j >= this.horizonte.length) return -1;
      y = Math.max(y, this.horizonte[j].y);
      resto -= this.horizonte[j].w;
    }
    return y;
  }

  private agregarSegmento(i: number, x: number, y: number, w: number): void {
    this.horizonte.splice(i, 0, { x, y, w });
    for (let j = i + 1; j < this.horizonte.length; j++) {
      const s = this.horizonte[j], prev = this.horizonte[j - 1];
      const fin = prev.x + prev.w;
      if (s.x >= fin) break;
      const recorte = fin - s.x;
      s.x += recorte;
      s.w -= recorte;
      if (s.w <= 0) {
        this.horizonte.splice(j, 1);
        j--;
      }
    }
    for (let j = 0; j < this.horizonte.length - 1; j++) {
      if (this.horizonte[j].y === this.horizonte[j + 1].y) {
        this.horizonte[j].w += this.horizonte[j + 1].w;
        this.horizonte.splice(j + 1, 1);
        j--;
      }
    }
  }

  /** Fracción de la textura ocupada por regiones. */
  get ocupacion(): number {
    return this.regiones.reduce((s, r) => s + r.w * r.h, 0) / (this.ancho * this.alto);
  }
}

/**
 * Empaqueta una lista completa (ordenada de mayor a menor alto, que es lo que mejor funciona) en la textura cuadrada
 * potencia de 2 más chica donde entra todo, hasta `maximo`.
 */
export function empaquetar(rects: ReadonlyArray<{ nombre: string; w: number; h: number }>, op: { margen?: number; minimo?: number; maximo?: number } = {}): { lado: number; regiones: Map<string, Region>; ocupacion: number } {
  const orden = [...rects].sort((a, b) => b.h - a.h || b.w - a.w);
  for (let lado = op.minimo ?? 64; lado <= (op.maximo ?? 8192); lado *= 2) {
    const e = new EmpaquetadorAtlas(lado, lado, op.margen ?? 1);
    if (orden.every((r) => e.colocar(r.nombre, r.w, r.h))) return { lado, regiones: new Map(e.regiones.map((r) => [r.nombre, r])), ocupacion: e.ocupacion };
  }
  throw new Error("Atlas: no entra en el tamaño máximo");
}
