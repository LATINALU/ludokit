// Curvas de experiencia:
//   - `CurvaNiveles`: tabla de umbrales acumulados (umbrales[k] = experiencia mínima para el nivel k+1) con nivel
//     máximo; se arma a mano o con `curvaDesde(curva, niveles)`.
//   - `CurvaNivelesInfinita`: costo de cada nivel dado por una `Curva` y SIN nivel máximo (paragon, prestigio,
//     maestrías, niveles de cuenta). Calcula los umbrales a medida que se necesitan.
// No hay curva por defecto: cada juego define la suya (ver `presets/`).

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export class CurvaNiveles {
  readonly umbrales: readonly number[];
  readonly nivelMaximo: number;

  constructor(umbrales: readonly number[], nivelMaximo = umbrales.length) {
    if (umbrales.length === 0 || umbrales[0] !== 0) {
      throw new Error("La curva tiene que empezar en 0 (nivel 1 sin experiencia)");
    }
    for (let i = 1; i < umbrales.length; i++) {
      if (umbrales[i] <= umbrales[i - 1]) {
        throw new Error(`La curva tiene que crecer: nivel ${i + 1}`);
      }
    }
    this.umbrales = umbrales;
    this.nivelMaximo = Math.min(nivelMaximo, umbrales.length);
  }

  experienciaPara(nivel: number): number {
    const n = Math.max(1, Math.min(nivel, this.nivelMaximo));
    return this.umbrales[n - 1];
  }

  /** Nivel y porcentaje hacia el siguiente (0~100). En el nivel máximo el porcentaje es 0. */
  nivelDe(experiencia: number): { nivel: number; porcentaje: number } {
    let nivel = 1;
    while (nivel < this.nivelMaximo && experiencia >= this.umbrales[nivel]) {
      nivel++;
    }
    if (nivel >= this.nivelMaximo) {
      return { nivel: this.nivelMaximo, porcentaje: 0 };
    }
    const desde = this.umbrales[nivel - 1];
    const hasta = this.umbrales[nivel];
    return { nivel, porcentaje: ((experiencia - desde) / (hasta - desde)) * 100 };
  }
}

/** Genera una curva con costo por nivel = base * nivel^exponente (redondeado). Para juegos nuevos. */
export function curvaPolinomica(niveles: number, base: number, exponente: number): CurvaNiveles {
  const umbrales = [0];
  for (let n = 1; n < niveles; n++) {
    umbrales.push(umbrales[n - 1] + Math.max(1, Math.round(base * Math.pow(n, exponente))));
  }
  return new CurvaNiveles(umbrales);
}

/** Curva de `niveles` niveles con costo del nivel n→n+1 = curva(n) (redondeado, mínimo 1). */
export function curvaDesde(c: Curva, niveles: number): CurvaNiveles {
  const umbrales = [0];
  for (let n = 1; n < niveles; n++) umbrales.push(umbrales[n - 1] + Math.max(1, Math.round(evaluar(c, n))));
  return new CurvaNiveles(umbrales);
}

/** Curva sin nivel máximo: costo del nivel n→n+1 = curva(n). Búsqueda binaria sobre umbrales en caché. */
export class CurvaNivelesInfinita {
  private readonly umbrales: number[] = [0];
  readonly costo: Curva;

  constructor(costo: Curva) {
    this.costo = costo;
  }

  private asegurar(nivel: number): void {
    while (this.umbrales.length < nivel) {
      const n = this.umbrales.length;
      this.umbrales.push(this.umbrales[n - 1] + Math.max(1, Math.round(evaluar(this.costo, n))));
    }
  }

  experienciaPara(nivel: number): number {
    const n = Math.max(1, Math.floor(nivel));
    this.asegurar(n);
    return this.umbrales[n - 1];
  }

  costoDelNivel(nivel: number): number {
    return this.experienciaPara(nivel + 1) - this.experienciaPara(nivel);
  }

  nivelDe(experiencia: number): { nivel: number; porcentaje: number } {
    // Duplicar hasta pasarse y luego buscar: O(log n) aun con experiencia enorme.
    let hi = 2;
    while (this.experienciaPara(hi) <= experiencia && hi < 1e7) hi *= 2;
    let lo = 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (this.experienciaPara(m) <= experiencia) lo = m;
      else hi = m;
    }
    const desde = this.experienciaPara(lo), hasta = this.experienciaPara(lo + 1);
    return { nivel: lo, porcentaje: ((experiencia - desde) / (hasta - desde)) * 100 };
  }
}
