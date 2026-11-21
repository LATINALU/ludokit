// Remate (kill-cam) del golpe final a un jefe: la muerte no ocurre en un cuadro; se cuenta en tres tiempos de reloj
// REAL mientras el mundo va en cámara lenta:
//   1. IMPACTO  (0 → 0,09 s): pantalla apagada, jefe en silueta, tajo de lado a lado, líneas de velocidad.
//   2. LENTA    (0,09 → 1,10 s): bandas de cine, la silueta tiembla, haces de luz que se abren de a uno.
//   3. ESTALLIDO (1,10 s): el jefe se deshace en partículas, onda y sacudida; las bandas se retiran.
// Este objeto solo lleva el tiempo y emite los momentos; el render dibuja según `fase` y `progreso`.

export type FaseRemate = "impacto" | "lenta" | "estallido" | "fin";

export interface TiemposRemate {
  readonly impacto: number;
  readonly lenta: number;
  readonly salida: number;
  /** Escala de tiempo del mundo durante el remate. */
  readonly escalaMundo: number;
  /** Cantidad de haces de luz que se abren durante la lenta. */
  readonly haces: number;
}

export const TIEMPOS_REMATE: TiemposRemate = { impacto: 0.09, lenta: 1.01, salida: 0.5, escalaMundo: 0.2, haces: 6 };

export type EventoRemate = { readonly tipo: "fase"; readonly fase: FaseRemate } | { readonly tipo: "haz"; readonly n: number } | { readonly tipo: "estallar" };

export class Remate {
  t = 0;
  private hacesEmitidos = 0;
  private faseAnterior: FaseRemate | null = null;
  readonly tiempos: TiemposRemate;

  constructor(tiempos: TiemposRemate = TIEMPOS_REMATE) {
    this.tiempos = tiempos;
  }

  get fase(): FaseRemate {
    const { impacto, lenta, salida } = this.tiempos;
    if (this.t < impacto) return "impacto";
    if (this.t < impacto + lenta) return "lenta";
    if (this.t < impacto + lenta + salida) return "estallido";
    return "fin";
  }

  /** 0..1 dentro de la fase actual. */
  get progreso(): number {
    const { impacto, lenta, salida } = this.tiempos;
    const f = this.fase;
    if (f === "impacto") return this.t / impacto;
    if (f === "lenta") return (this.t - impacto) / lenta;
    if (f === "estallido") return (this.t - impacto - lenta) / salida;
    return 1;
  }

  /** Escala de tiempo que debe usar el mundo ahora (aplicar a la simulación, no al remate). */
  get escalaMundo(): number {
    const f = this.fase;
    return f === "impacto" ? 0 : f === "lenta" ? this.tiempos.escalaMundo : 1;
  }

  get terminado(): boolean {
    return this.fase === "fin";
  }

  /** Avanzar con el dt REAL (no el escalado). */
  actualizar(dtReal: number): EventoRemate[] {
    const ev: EventoRemate[] = [];
    if (this.faseAnterior === null) ev.push({ tipo: "fase", fase: (this.faseAnterior = "impacto") });
    this.t += dtReal;
    const f = this.fase;
    if (f === "lenta") {
      const deberia = Math.min(this.tiempos.haces, Math.floor(this.progreso * this.tiempos.haces) + 1);
      while (this.hacesEmitidos < deberia) ev.push({ tipo: "haz", n: ++this.hacesEmitidos });
    }
    if (f !== this.faseAnterior) {
      if (this.faseAnterior === "impacto" && f !== "lenta") ev.push({ tipo: "fase", fase: "lenta" });
      if (f === "estallido" || (f === "fin" && this.faseAnterior !== "estallido")) ev.push({ tipo: "estallar" });
      ev.push({ tipo: "fase", fase: f });
      this.faseAnterior = f;
    }
    return ev;
  }
}
