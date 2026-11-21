// Fuente pixel de 3×5 guardada en bits (15 bits por glifo, fila por fila de arriba a abajo) para números de daño,
// contadores y HUD a resolución lógica: siempre nítida, sin archivos de fuente. Más un gestor de TEXTOS FLOTANTES
// (números de daño que saltan, suben y se desvanecen) en arreglos paralelos, sin objetos por texto.

import { pintar, type Imagen } from "./imagen.ts";

export const GLIFOS_3X5: Readonly<Record<string, number>> = {
  "0": 0b111101101101111, "1": 0b010110010010111, "2": 0b111001111100111, "3": 0b111001011001111,
  "4": 0b101101111001001, "5": 0b111100111001111, "6": 0b111100111101111, "7": 0b111001010010010,
  "8": 0b111101111101111, "9": 0b111101111001111, "+": 0b000010111010000, "-": 0b000000111000000,
  "!": 0b010010010000010, "%": 0b101001010100101, ".": 0b000000000000010, ":": 0b000010000010000,
  "/": 0b001001010100100, x: 0b000101010101000, " ": 0,
};

/** ¿El píxel (cx, cy) del glifo está encendido? (cx 0..2, cy 0..4). */
export const pixelGlifo = (glifo: number, cx: number, cy: number): boolean => ((glifo >> (14 - (cy * 3 + cx))) & 1) === 1;

export function anchoTexto(texto: string, escala = 1, espacio = 1): number {
  return texto.length === 0 ? 0 : (texto.length * (3 + espacio) - espacio) * escala;
}

/** Dibuja texto en una imagen con contorno opcional de 1 px (legible sobre cualquier fondo). */
export function dibujarTexto(im: Imagen, texto: string, x: number, y: number, color: readonly [number, number, number, number], op: { escala?: number; contorno?: readonly [number, number, number, number]; espacio?: number } = {}): void {
  const e = op.escala ?? 1;
  const esp = op.espacio ?? 1;
  const encendidos: Array<[number, number]> = [];
  [...texto].forEach((ch, k) => {
    const g = GLIFOS_3X5[ch] ?? GLIFOS_3X5[ch.toLowerCase()];
    if (g === undefined) return;
    for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 3; cx++) if (pixelGlifo(g, cx, cy)) {
      for (let sy = 0; sy < e; sy++) for (let sx = 0; sx < e; sx++) encendidos.push([x + (k * (3 + esp) + cx) * e + sx, y + cy * e + sy]);
    }
  });
  if (op.contorno) {
    const set = new Set(encendidos.map(([a, b]) => `${a},${b}`));
    for (const [a, b] of encendidos) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${a + dx},${b + dy}`)) pintar(im, a + dx, b + dy, op.contorno);
  }
  for (const [a, b] of encendidos) pintar(im, a, b, color);
}

/** Textos flotantes (números de daño, "+50", "¡CRÍTICO!") en arreglos paralelos. */
export class TextosFlotantes {
  readonly capacidad: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vy: Float32Array;
  readonly vida: Float32Array;
  readonly vidaMax: Float32Array;
  readonly escala: Uint8Array;
  readonly texto: string[];
  readonly color: Uint32Array;
  vivos = 0;

  constructor(capacidad = 128) {
    this.capacidad = capacidad;
    this.x = new Float32Array(capacidad);
    this.y = new Float32Array(capacidad);
    this.vy = new Float32Array(capacidad);
    this.vida = new Float32Array(capacidad);
    this.vidaMax = new Float32Array(capacidad);
    this.escala = new Uint8Array(capacidad);
    this.texto = Array(capacidad).fill("");
    this.color = new Uint32Array(capacidad);
  }

  /** Agrega un número; si está lleno, reemplaza el más viejo. Los críticos salen más grandes y saltan más. */
  agregar(texto: string, x: number, y: number, color = 0xffffffff, critico = false): void {
    let i = this.vivos;
    if (i >= this.capacidad) {
      i = 0;
      for (let k = 1; k < this.vivos; k++) if (this.vida[k] < this.vida[i]) i = k;
    } else this.vivos++;
    this.texto[i] = texto;
    this.x[i] = x - anchoTexto(texto, critico ? 2 : 1) / 2;
    this.y[i] = y;
    this.vy[i] = critico ? -70 : -42;
    this.vida[i] = this.vidaMax[i] = critico ? 1.1 : 0.85;
    this.escala[i] = critico ? 2 : 1;
    this.color[i] = color;
  }

  actualizar(dt: number): void {
    let i = 0;
    while (i < this.vivos) {
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        const u = --this.vivos;
        this.x[i] = this.x[u];
        this.y[i] = this.y[u];
        this.vy[i] = this.vy[u];
        this.vida[i] = this.vida[u];
        this.vidaMax[i] = this.vidaMax[u];
        this.escala[i] = this.escala[u];
        this.texto[i] = this.texto[u];
        this.color[i] = this.color[u];
        continue;
      }
      this.vy[i] += 90 * dt; // frena al subir: el número "salta" y se asienta
      this.y[i] += this.vy[i] * dt;
      i++;
    }
  }

  /** 0..1 de opacidad (se desvanece en el último 40 % de su vida). */
  alfa(i: number): number {
    return Math.min(1, this.vida[i] / (this.vidaMax[i] * 0.4));
  }
}
