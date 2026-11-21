// Cuerdas y telas por integración de Verlet con restricciones de distancia (Jakobsen): capas, bufandas, cadenas,
// pelo, colas, puentes colgantes, enredaderas. Restricción de distancia entre vecinos + rigidez de doblado
// (i, i+2) + viento con turbulencia + campos de fuerza + colisión con un círculo (el cuerpo) y con la roca.
// Masa inversa creciente hacia la punta (la base es más pesada: se mueve menos). Posición previa para interpolar.

import type { CampoFuerza } from "./campos.ts";

export interface ConfigCuerda {
  readonly nodos: number;
  readonly segmento: number;
  readonly gravedad: number;
  /** Conservación de velocidad por paso (0.9 = mucho rozamiento, 0.99 = casi nada). */
  readonly friccion: number;
  readonly iteraciones: number;
  /** Rigidez de doblado (0 = cadena floja). */
  readonly rigidez: number;
  readonly turbulencia: number;
}

export const CUERDAS: Readonly<Record<string, ConfigCuerda>> = {
  capa: { nodos: 7, segmento: 2.6, gravedad: 420, friccion: 0.9, iteraciones: 4, rigidez: 0.35, turbulencia: 30 },
  venda: { nodos: 6, segmento: 4, gravedad: 380, friccion: 0.92, iteraciones: 4, rigidez: 0.25, turbulencia: 25 },
  cadena: { nodos: 10, segmento: 5, gravedad: 520, friccion: 0.97, iteraciones: 8, rigidez: 0, turbulencia: 2 },
  cuerda: { nodos: 16, segmento: 6, gravedad: 600, friccion: 0.98, iteraciones: 10, rigidez: 0.05, turbulencia: 0 },
};

export class Cuerda {
  readonly cfg: ConfigCuerda;
  readonly x: Float32Array;
  readonly y: Float32Array;
  private readonly ax: Float32Array;
  private readonly ay: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly invMasa: Float32Array;

  constructor(anclaX: number, anclaY: number, cfg: ConfigCuerda) {
    this.cfg = cfg;
    const n = Math.max(2, cfg.nodos);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.ax = new Float32Array(n);
    this.ay = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.invMasa = new Float32Array(n);
    for (let i = 0; i < n; i++) this.invMasa[i] = i === 0 ? 0 : 1 + (0.6 * i) / (n - 1);
    this.reiniciar(anclaX, anclaY);
  }

  get n(): number {
    return this.x.length;
  }

  reiniciar(ax: number, ay: number): void {
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ax[i] = this.px[i] = ax;
      this.y[i] = this.ay[i] = this.py[i] = ay + i * this.cfg.segmento;
    }
  }

  /** Mueve el ancla (nodo 0) — por ejemplo, el hombro del personaje. */
  anclar(x: number, y: number): void {
    this.x[0] = x;
    this.y[0] = y;
  }

  fijar(i: number, fijo: boolean): void {
    if (i >= 0 && i < this.n) this.invMasa[i] = fijo ? 0 : 1;
  }

  /** Empujón local (un golpe que pasa cerca). */
  empujar(x: number, y: number, radio: number, vx: number, vy: number, dt: number): void {
    for (let i = 1; i < this.n; i++) {
      const d = Math.hypot(this.x[i] - x, this.y[i] - y);
      if (d < radio) {
        const k = (1 - d / radio) * this.invMasa[i];
        this.ax[i] -= vx * dt * k;
        this.ay[i] -= vy * dt * k;
      }
    }
  }

  simular(dt: number, tiempo: number, op: { viento?: [number, number]; campos?: readonly CampoFuerza[]; cuerpo?: { x: number; y: number; r: number }; solido?: (x: number, y: number) => boolean } = {}): void {
    const c = this.cfg;
    const dt2 = dt * dt;
    const [wx, wy] = op.viento ?? [0, 0];
    this.px.set(this.x);
    this.py.set(this.y);
    for (let i = 1; i < this.n; i++) {
      if (this.invMasa[i] === 0) continue;
      const vx = (this.x[i] - this.ax[i]) * c.friccion;
      const vy = (this.y[i] - this.ay[i]) * c.friccion;
      this.ax[i] = this.x[i];
      this.ay[i] = this.y[i];
      const fase = tiempo * 7.5 + i * 0.9 + this.x[i] * 0.04;
      let fx = wx + Math.sin(fase) * c.turbulencia;
      let fy = c.gravedad + wy + Math.cos(fase * 1.3) * c.turbulencia * 0.35;
      for (const campo of op.campos ?? []) {
        const [ex, ey] = campo.aceleracion(this.x[i], this.y[i]);
        fx += ex * 1.5;
        fy += ey * 1.5;
      }
      const m = this.invMasa[i];
      this.x[i] += vx + fx * m * dt2;
      this.y[i] += vy + fy * m * dt2;
    }
    for (let it = 0; it < c.iteraciones; it++) {
      for (let i = 0; i < this.n - 1; i++) this.restringir(i, i + 1, c.segmento, 1);
      if (c.rigidez > 0) for (let i = 0; i < this.n - 2; i++) this.restringir(i, i + 2, c.segmento * 1.75, c.rigidez);
      for (let i = 1; i < this.n; i++) {
        const cu = op.cuerpo;
        if (cu) {
          const dx = this.x[i] - cu.x, dy = this.y[i] - cu.y;
          const d = Math.hypot(dx, dy);
          if (d < cu.r && d > 1e-3) {
            const e = (cu.r - d) / d;
            this.x[i] += dx * e;
            this.y[i] += dy * e;
          }
        }
        if (op.solido?.(this.x[i], this.y[i])) {
          this.x[i] = this.ax[i];
          this.y[i] = this.ay[i] - 0.5;
        }
      }
    }
  }

  private restringir(i: number, j: number, objetivo: number, rigidez: number): void {
    const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i];
    const d = Math.hypot(dx, dy);
    const w1 = this.invMasa[i], w2 = this.invMasa[j];
    if (d < 1e-4 || w1 + w2 === 0) return;
    const k = ((d - objetivo) / d) * rigidez;
    const a = w1 / (w1 + w2), b = w2 / (w1 + w2);
    this.x[i] += dx * k * a;
    this.y[i] += dy * k * a;
    this.x[j] -= dx * k * b;
    this.y[j] -= dy * k * b;
  }

  /** Puntos interpolados para dibujar (alfa del bucle fijo). */
  puntos(alfa = 1): Array<[number, number]> {
    const r: Array<[number, number]> = [];
    for (let i = 0; i < this.n; i++) r.push([this.px[i] + (this.x[i] - this.px[i]) * alfa, this.py[i] + (this.y[i] - this.py[i]) * alfa]);
    return r;
  }

  largoActual(): number {
    let s = 0;
    for (let i = 0; i < this.n - 1; i++) s += Math.hypot(this.x[i + 1] - this.x[i], this.y[i + 1] - this.y[i]);
    return s;
  }
}
