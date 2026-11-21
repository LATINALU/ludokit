// Bucle de juego de paso fijo con interpolación ("Fix your timestep"): la simulación avanza siempre en pasos
// iguales (determinista, idéntica en cualquier PC y en el servidor) y el dibujo interpola entre el último estado y
// el actual con `alfa`. Tope de dt para evitar la "espiral de la muerte" tras un tirón o una pausa del navegador.
// El bucle no conoce requestAnimationFrame ni setInterval: la plataforma llama a `avanzar(ahoraSeg)`.

export interface Simulacion {
  /** Un paso fijo de `dt` segundos. `paso` = número de paso desde el inicio (tick). */
  actualizar(dt: number, paso: number): void;
  /** Dibuja; `alfa` (0..1) = cuánto avanzó el tiempo hacia el próximo paso. */
  dibujar?(alfa: number, dtReal: number): void;
}

export interface OpcionesBucle {
  /** Pasos por segundo (60 para acción; 20-30 en un servidor MMO). */
  readonly hz?: number;
  /** dt real máximo que se procesa por cuadro (s). */
  readonly topeDt?: number;
  /** Pasos máximos por cuadro (si se supera, se descarta tiempo: el juego se ralentiza en vez de colgarse). */
  readonly maxPasos?: number;
}

export class BucleFijo {
  readonly paso: number;
  readonly topeDt: number;
  readonly maxPasos: number;
  /** Escala de tiempo (cámara lenta 0.35, pausa 0). Afecta a la simulación, no al dibujo. */
  escalaTiempo = 1;
  tick = 0;
  private acumulado = 0;
  private ultimo: number | null = null;
  private readonly sim: Simulacion;

  constructor(sim: Simulacion, op: OpcionesBucle = {}) {
    this.sim = sim;
    this.paso = 1 / (op.hz ?? 60);
    this.topeDt = op.topeDt ?? 0.25;
    this.maxPasos = op.maxPasos ?? 8;
  }

  /** Llamar una vez por cuadro con el tiempo actual en segundos. Devuelve cuántos pasos se simularon. */
  avanzar(ahora: number): number {
    if (this.ultimo === null) this.ultimo = ahora;
    const dtReal = Math.min(this.topeDt, Math.max(0, ahora - this.ultimo));
    this.ultimo = ahora;
    this.acumulado += dtReal * this.escalaTiempo;
    let n = 0;
    while (this.acumulado >= this.paso && n < this.maxPasos) {
      this.sim.actualizar(this.paso, this.tick++);
      this.acumulado -= this.paso;
      n++;
    }
    if (n === this.maxPasos && this.acumulado >= this.paso) this.acumulado = 0;
    this.sim.dibujar?.(this.acumulado / this.paso, dtReal);
    return n;
  }

  /** Modo determinista (tests, capturas, servidor): exactamente `n` pasos, alfa = 1. */
  pasos(n: number): void {
    for (let i = 0; i < n; i++) this.sim.actualizar(this.paso, this.tick++);
    this.sim.dibujar?.(1, this.paso * n);
  }

  reiniciarReloj(): void {
    this.ultimo = null;
    this.acumulado = 0;
  }
}
