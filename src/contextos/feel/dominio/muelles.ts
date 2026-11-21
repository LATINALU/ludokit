// Muelles amortiguados para animación secundaria: x'' = k·(objetivo − x) − d·x'. Sub-amortiguados rebotan 1-2
// veces (los cuadros de "asentarse" de una animación hecha a mano). Con ellos, un sprite de 1-3 dibujos se siente
// vivo: inclinación por inercia, squash & stretch a volumen constante, rebote de UI, cámara elástica.
// Integración semi-implícita (estable con el paso fijo).

export class Muelle {
  valor: number;
  velocidad = 0;
  objetivo: number;
  k: number;
  d: number;

  constructor(inicial = 0, k = 200, d = 14) {
    this.valor = inicial;
    this.objetivo = inicial;
    this.k = k;
    this.d = d;
  }

  /** Empujón instantáneo (velocidad) o desplazamiento. */
  impulsar(dv: number): void {
    this.velocidad += dv;
  }

  actualizar(dt: number): number {
    const f = (this.objetivo - this.valor) * this.k - this.velocidad * this.d;
    this.velocidad += f * dt;
    this.valor += this.velocidad * dt;
    return this.valor;
  }

  get enReposo(): boolean {
    return Math.abs(this.objetivo - this.valor) < 1e-3 && Math.abs(this.velocidad) < 1e-3;
  }
}

/** Parámetros a partir de frecuencia (Hz) y razón de amortiguación ζ (< 1 rebota, 1 crítico, > 1 lento). */
export function muelleDesdeFrecuencia(hz: number, zeta: number, inicial = 0): Muelle {
  const w = 2 * Math.PI * hz;
  return new Muelle(inicial, w * w, 2 * zeta * w);
}

export interface Deformacion {
  readonly escalaX: number;
  readonly escalaY: number;
  /** Inclinación (grados o px de cizalla, a criterio del render). */
  readonly inclinacion: number;
  readonly temblor: number;
  readonly destello: number;
}

/**
 * Cuerpo elástico de un personaje: aplastar/estirar conservando el área (escalaX = 1/escalaY, anclado en los
 * pies), inclinación por la velocidad horizontal, temblor de impacto o de anticipación, destello de golpe.
 */
export class Elastico {
  readonly altura = new Muelle(1, 280, 18);
  readonly incl = new Muelle(0, 220, 16);
  inercia = 0.035;
  private temblorT = 0;
  private temblorA = 0;
  destello = 0;
  private t = 0;
  anticipando = false;

  static gelatina(): Elastico {
    const e = new Elastico();
    e.altura.k = 160;
    e.altura.d = 9;
    e.inercia = 0.08;
    return e;
  }

  /** Aplastar (delta < 0) o estirar (delta > 0): al despegar +0.2, al aterrizar −0.25. */
  impulsar(delta: number): void {
    this.altura.valor = Math.max(0.45, Math.min(1.65, this.altura.valor + delta));
  }

  impacto(dirX: number, fuerte = false): void {
    const f = fuerte ? 1.4 : 1;
    this.altura.valor = 0.74;
    this.altura.velocidad = 4.5 * f;
    this.incl.valor = dirX * 4 * f;
    this.temblorT = fuerte ? 0.14 : 0.08;
    this.temblorA = fuerte ? 2.5 : 1.5;
    this.destello = 1;
  }

  actualizar(dt: number, velX = 0): void {
    this.t += dt;
    this.altura.objetivo = 1;
    this.altura.actualizar(dt);
    this.altura.valor = Math.max(0.4, Math.min(1.8, this.altura.valor));
    this.incl.objetivo = Math.max(-4, Math.min(4, -velX * this.inercia));
    this.incl.actualizar(dt);
    this.temblorT = Math.max(0, this.temblorT - dt);
    this.destello = Math.max(0, this.destello - dt * 9);
  }

  deformacion(): Deformacion {
    const sy = Math.max(0.4, this.altura.valor);
    const m = this.temblorT > 0 ? this.temblorA : this.anticipando ? 1 : 0;
    return { escalaX: 1 / sy, escalaY: sy, inclinacion: Math.round(this.incl.valor), temblor: Math.round(Math.sin(this.t * 90) * m), destello: this.destello };
  }
}
