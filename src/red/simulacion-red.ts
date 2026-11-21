// Red simulada con latencia, variación (jitter), pérdida y duplicados, sobre un reloj de simulación. Sirve para
// probar el netcode de forma determinista (tests) y para un modo "ping falso" en desarrollo. Cada canal es
// unidireccional; un enlace son dos canales.

import type { Azar } from "../nucleo/azar.ts";

export interface CondicionesRed {
  /** Latencia de un sentido en segundos. */
  readonly latencia: number;
  readonly jitter: number;
  readonly perdida: number;
  readonly duplicado: number;
  /** Si es false, el jitter puede desordenar los mensajes (UDP); true = orden garantizado (TCP/WebSocket). */
  readonly ordenado: boolean;
}

export const RED_LOCAL: CondicionesRed = { latencia: 0, jitter: 0, perdida: 0, duplicado: 0, ordenado: true };
export const RED_BUENA: CondicionesRed = { latencia: 0.04, jitter: 0.005, perdida: 0, duplicado: 0, ordenado: true };
export const RED_MALA: CondicionesRed = { latencia: 0.12, jitter: 0.04, perdida: 0.05, duplicado: 0.01, ordenado: false };

export class CanalSimulado<M> {
  private readonly cola: Array<{ llega: number; msg: M; orden: number }> = [];
  private ultimoLlega = 0;
  private n = 0;
  readonly c: CondicionesRed;
  private readonly azar: Azar;
  enviados = 0;
  perdidos = 0;

  constructor(c: CondicionesRed, azar: Azar) {
    this.c = c;
    this.azar = azar;
  }

  enviar(msg: M, ahora: number): void {
    this.enviados++;
    if (this.azar.siguiente() < this.c.perdida) {
      this.perdidos++;
      return;
    }
    const copias = this.azar.siguiente() < this.c.duplicado ? 2 : 1;
    for (let k = 0; k < copias; k++) {
      let llega = ahora + this.c.latencia + (this.azar.siguiente() * 2 - 1) * this.c.jitter;
      if (this.c.ordenado) llega = Math.max(llega, this.ultimoLlega);
      this.ultimoLlega = Math.max(this.ultimoLlega, llega);
      this.cola.push({ llega, msg: structuredClone(msg), orden: this.n++ });
    }
  }

  /** Mensajes que ya llegaron a `ahora`, en orden de llegada. */
  recibir(ahora: number): M[] {
    const listos = this.cola.filter((x) => x.llega <= ahora).sort((a, b) => a.llega - b.llega || a.orden - b.orden);
    for (const l of listos) this.cola.splice(this.cola.indexOf(l), 1);
    return listos.map((x) => x.msg);
  }

  get enVuelo(): number {
    return this.cola.length;
  }
}
