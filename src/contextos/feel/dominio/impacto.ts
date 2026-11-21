// Director de impacto (game feel): hitstop (congelar la simulación unos milisegundos en el contacto), trauma
// (sacudida de cámara que decae; se usa trauma² para que lo chico casi no se note), cámara lenta y destello.
// La regla de oro: durante el hitstop la ENTRADA se sigue leyendo y guardando en el búfer (nada se pierde) y
// los efectos de pantalla siguen decayendo con el tiempo real.

export interface PresetImpacto {
  readonly hitstop: number;
  readonly trauma: number;
  readonly lenta?: number;
  readonly escalaLenta?: number;
  readonly destello?: number;
}

/** Presets medidos para acción en 2D. */
export const IMPACTOS: Readonly<Record<string, PresetImpacto>> = {
  golpe: { hitstop: 0.045, trauma: 0.12 },
  fuerte: { hitstop: 0.075, trauma: 0.28 },
  critico: { hitstop: 0.075, trauma: 0.28, destello: 0.3 },
  recibido: { hitstop: 0.07, trauma: 0.5, destello: 0.4 },
  tecnica: { hitstop: 0.055, trauma: 0.2 },
  esquivaPerfecta: { hitstop: 0, trauma: 0, lenta: 0.5, escalaLenta: 0.35 },
  muerteJefe: { hitstop: 0.12, trauma: 1, lenta: 1, escalaLenta: 0.35, destello: 0.8 },
};

export class DirectorImpacto {
  hitstop = 0;
  trauma = 0;
  lenta = 0;
  escalaLenta = 0.35;
  destello = 0;
  private t = 0;
  decaimientoTrauma = 1.5;
  /** Tope de trauma por evento (muchos impactos pequeños seguidos no suman sin fin). */
  topeTrauma = 1;

  aplicar(p: PresetImpacto | string, intensidad = 1): void {
    const q = typeof p === "string" ? IMPACTOS[p] : p;
    if (!q) return;
    this.hitstop = Math.max(this.hitstop, q.hitstop * intensidad);
    this.trauma = Math.min(this.topeTrauma, this.trauma + q.trauma * intensidad);
    if (q.lenta) {
      this.lenta = Math.max(this.lenta, q.lenta);
      this.escalaLenta = q.escalaLenta ?? 0.35;
    }
    if (q.destello) this.destello = Math.max(this.destello, q.destello);
  }

  /**
   * Llamar al inicio de cada paso con el dt real. Devuelve el dt que debe usar la simulación:
   * 0 durante el hitstop, reducido en cámara lenta.
   */
  paso(dtReal: number): number {
    this.t += dtReal;
    this.trauma = Math.max(0, this.trauma - dtReal * this.decaimientoTrauma);
    this.destello = Math.max(0, this.destello - dtReal * 2.5);
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      return 0;
    }
    if (this.lenta > 0) {
      this.lenta -= dtReal;
      return dtReal * this.escalaLenta;
    }
    return dtReal;
  }

  get congelado(): boolean {
    return this.hitstop > 0;
  }

  /** Desplazamiento de cámara (px) determinista. */
  sacudida(amplitud = 5): { x: number; y: number } {
    const tr = this.trauma * this.trauma;
    return { x: Math.sin(this.t * 61) * tr * amplitud, y: Math.cos(this.t * 47) * tr * amplitud * 0.8 };
  }

  /** Aberración cromática sugerida (px). */
  get aberracion(): number {
    return this.trauma * this.trauma * 2;
  }
}
