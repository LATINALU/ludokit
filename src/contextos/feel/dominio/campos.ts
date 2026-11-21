// Campos de fuerza con duración que se apagan suavemente: repulsor (explosión, onda), vórtice (succionar con
// giro), corriente (viento de un hechizo). La MISMA fórmula mueve partículas, cuerdas y objetos ligeros, así una
// onda empuja polvo, capas y cadenas a la vez. Pensado para correr igual en CPU y en un compute shader.

export type TipoCampo =
  | { readonly tipo: "repulsor" }
  | { readonly tipo: "vortice"; readonly giro: number }
  | { readonly tipo: "corriente"; readonly dx: number; readonly dy: number };

export class CampoFuerza {
  readonly x: number;
  readonly y: number;
  readonly radio: number;
  fuerza: number;
  forma: TipoCampo;

  constructor(x: number, y: number, radio: number, fuerza: number, forma: TipoCampo = { tipo: "repulsor" }) {
    this.x = x;
    this.y = y;
    this.radio = radio;
    this.fuerza = fuerza;
    this.forma = forma;
  }

  /** Aceleración en (px, py): t = 1 − d/radio. */
  aceleracion(px: number, py: number): [number, number] {
    const dx = this.x - px, dy = this.y - py;
    const d = Math.hypot(dx, dy);
    if (d >= this.radio || d < 1e-3) return [0, 0];
    const ux = dx / d, uy = dy / d;
    const t = 1 - d / this.radio;
    const f = this.forma;
    if (f.tipo === "repulsor") return [-ux * this.fuerza * t * t, -uy * this.fuerza * t * t];
    if (f.tipo === "vortice") {
      const s = this.fuerza * (0.4 + 0.6 * t);
      return [ux * s - uy * f.giro * t, uy * s + ux * f.giro * t];
    }
    return [f.dx * this.fuerza * t, f.dy * this.fuerza * t];
  }
}

export class Campos {
  private vivos: Array<{ campo: CampoFuerza; base: number; giro: number; t: number; dur: number }> = [];
  readonly maximo: number;

  constructor(maximo = 8) {
    this.maximo = maximo;
  }

  disparar(c: CampoFuerza, dur: number): void {
    this.vivos.push({ campo: c, base: c.fuerza, giro: c.forma.tipo === "vortice" ? c.forma.giro : 0, t: 0, dur: Math.max(0.01, dur) });
    if (this.vivos.length > this.maximo) this.vivos.shift();
  }

  actualizar(dt: number): void {
    for (const v of this.vivos) v.t += dt;
    this.vivos = this.vivos.filter((v) => v.t < v.dur);
    for (const v of this.vivos) {
      const k = 1 - v.t / v.dur;
      v.campo.fuerza = v.base * k;
      if (v.campo.forma.tipo === "vortice") v.campo.forma = { tipo: "vortice", giro: v.giro * k };
    }
  }

  get activos(): CampoFuerza[] {
    return this.vivos.map((v) => v.campo);
  }

  aceleracion(px: number, py: number): [number, number] {
    let ax = 0, ay = 0;
    for (const v of this.vivos) {
      const [x, y] = v.campo.aceleracion(px, py);
      ax += x;
      ay += y;
    }
    return [ax, ay];
  }
}
