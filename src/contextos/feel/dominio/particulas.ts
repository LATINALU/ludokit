// Sistema de partículas de CPU en estructura de arrays (SoA: un Float32Array por propiedad, sin objetos por
// partícula = sin basura y cache-friendly), con emisores (ráfaga, continuo), gravedad, arrastre, rebote contra el
// suelo o un sólido, campos de fuerza, color/tamaño por vida y sub-pasos para que se vea igual a cualquier fps.
// Miles de chispas, polvo, sangre, humo y monedas. El dibujo es del juego: iterar `vivas` y leer los arrays.

import type { Azar } from "../../../nucleo/azar.ts";
import type { Campos } from "./campos.ts";

export interface TipoParticula {
  readonly gravedad: number;
  /** Arrastre lineal por segundo (0 = ninguno). */
  readonly arrastre: number;
  /** Rebote contra sólidos: 0 = se queda pegada (manchas), 0.3 = rebota poco, < 0 = la atraviesa. */
  readonly rebote: number;
  /** Se mueve con los campos de fuerza. */
  readonly afectaCampos: boolean;
}

export const TIPOS_PARTICULA: Readonly<Record<string, TipoParticula>> = {
  chispa: { gravedad: 430, arrastre: 2.2, rebote: 0.35, afectaCampos: true },
  polvo: { gravedad: -10, arrastre: 1.6, rebote: -1, afectaCampos: true },
  brasa: { gravedad: -30, arrastre: 1.6, rebote: -1, afectaCampos: true },
  escombro: { gravedad: 950, arrastre: 0.8, rebote: 0.25, afectaCampos: false },
  fragmento: { gravedad: 700, arrastre: 0.5, rebote: 0, afectaCampos: false },
  humo: { gravedad: -16, arrastre: 1.4, rebote: -1, afectaCampos: true },
};

export class Particulas {
  readonly capacidad: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vida: Float32Array;
  readonly vidaMax: Float32Array;
  readonly tam: Float32Array;
  readonly color: Uint32Array;
  readonly tipo: Uint8Array;
  /** Partícula pegada (mancha permanente): no se mueve más. */
  readonly pegada: Uint8Array;
  vivas = 0;
  private readonly tipos: TipoParticula[];
  private readonly indiceTipo = new Map<string, number>();

  constructor(capacidad = 4096, tipos: Readonly<Record<string, TipoParticula>> = TIPOS_PARTICULA) {
    this.capacidad = capacidad;
    this.x = new Float32Array(capacidad);
    this.y = new Float32Array(capacidad);
    this.vx = new Float32Array(capacidad);
    this.vy = new Float32Array(capacidad);
    this.vida = new Float32Array(capacidad);
    this.vidaMax = new Float32Array(capacidad);
    this.tam = new Float32Array(capacidad);
    this.color = new Uint32Array(capacidad);
    this.tipo = new Uint8Array(capacidad);
    this.pegada = new Uint8Array(capacidad);
    this.tipos = Object.values(tipos);
    Object.keys(tipos).forEach((k, i) => this.indiceTipo.set(k, i));
  }

  emitir(tipo: string, x: number, y: number, vx: number, vy: number, vida: number, color = 0xffffffff, tam = 1): boolean {
    if (this.vivas >= this.capacidad) return false;
    const i = this.vivas++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vida[i] = this.vidaMax[i] = vida;
    this.tam[i] = tam;
    this.color[i] = color;
    this.tipo[i] = this.indiceTipo.get(tipo) ?? 0;
    this.pegada[i] = 0;
    return true;
  }

  /** Ráfaga radial: n partículas con ángulo en [a0, a1] y velocidad en [v0, v1]. */
  rafaga(azar: Azar, tipo: string, x: number, y: number, n: number, op: { a0?: number; a1?: number; v0?: number; v1?: number; vida?: [number, number]; color?: number; tam?: number } = {}): void {
    const a0 = op.a0 ?? 0, a1 = op.a1 ?? Math.PI * 2, v0 = op.v0 ?? 60, v1 = op.v1 ?? 180;
    const [l0, l1] = op.vida ?? [0.3, 0.8];
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * azar.siguiente();
      const v = v0 + (v1 - v0) * azar.siguiente();
      this.emitir(tipo, x, y, Math.cos(a) * v, Math.sin(a) * v, l0 + (l1 - l0) * azar.siguiente(), op.color, op.tam);
    }
  }

  /** Avanza con sub-pasos (por defecto ≥ 120 Hz). `solido` para colisión; `campos` para fuerzas. */
  actualizar(dt: number, op: { solido?: (x: number, y: number) => boolean; campos?: Campos; hz?: number } = {}): void {
    const n = Math.max(1, Math.ceil(dt * (op.hz ?? 120) - 1e-9));
    const h = dt / n;
    for (let s = 0; s < n; s++) this.paso(h, op.solido, op.campos);
  }

  private paso(dt: number, solido?: (x: number, y: number) => boolean, campos?: Campos): void {
    let i = 0;
    while (i < this.vivas) {
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        this.matar(i);
        continue;
      }
      if (this.pegada[i]) {
        i++;
        continue;
      }
      const t = this.tipos[this.tipo[i]];
      if (t.afectaCampos && campos) {
        const [ax, ay] = campos.aceleracion(this.x[i], this.y[i]);
        this.vx[i] += ax * dt;
        this.vy[i] += ay * dt;
      }
      this.vy[i] += t.gravedad * dt;
      if (t.arrastre > 0) {
        const k = Math.max(0, 1 - t.arrastre * dt);
        this.vx[i] *= k;
        this.vy[i] *= k;
      }
      const nx = this.x[i] + this.vx[i] * dt;
      const ny = this.y[i] + this.vy[i] * dt;
      if (solido && t.rebote >= 0 && solido(nx, ny)) {
        if (t.rebote === 0) {
          this.pegada[i] = 1;
          this.vx[i] = this.vy[i] = 0;
        } else {
          // Rebote por eje: invierte el componente que entró al sólido.
          if (solido(nx, this.y[i])) this.vx[i] = -this.vx[i] * t.rebote;
          if (solido(this.x[i], ny)) this.vy[i] = -this.vy[i] * t.rebote;
        }
      } else {
        this.x[i] = nx;
        this.y[i] = ny;
      }
      i++;
    }
  }

  /** Quitar sin dejar huecos: la última ocupa su lugar (O(1)). */
  private matar(i: number): void {
    const u = --this.vivas;
    if (i === u) return;
    this.x[i] = this.x[u];
    this.y[i] = this.y[u];
    this.vx[i] = this.vx[u];
    this.vy[i] = this.vy[u];
    this.vida[i] = this.vida[u];
    this.vidaMax[i] = this.vidaMax[u];
    this.tam[i] = this.tam[u];
    this.color[i] = this.color[u];
    this.tipo[i] = this.tipo[u];
    this.pegada[i] = this.pegada[u];
  }

  /** 0..1 de vida restante de la partícula i (para desvanecer o cambiar color). */
  fraccionVida(i: number): number {
    return this.vida[i] / this.vidaMax[i];
  }

  limpiar(): void {
    this.vivas = 0;
  }
}
