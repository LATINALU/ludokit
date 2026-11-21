// Ataque por fases, la base de un combate legible: PATRULLA → ANTICIPA (telegrafiado: el jugador puede reaccionar)
// → ATACA (ventana activa del golpe) → RECUPERA (ventana de castigo) → PATRULLA. Con cooldown inicial al azar para
// que un grupo no ataque sincronizado. Datos por enemigo; la capa de juego mueve el sprite según `fase`.

import type { Azar } from "../../../nucleo/azar.ts";

export type Fase = "patrulla" | "anticipa" | "ataca" | "recupera";

export interface DefAtaque {
  readonly carga: number;
  readonly golpe: number;
  readonly recupera: number;
  /** Alcance en px para empezar el ataque. */
  readonly alcance: number;
  /** Multiplicador de daño del golpe. */
  readonly mult: number;
  /** Segundos entre ataques (desde que termina la recuperación). */
  readonly ciclo: number;
}

/** Presets de ejemplo: liviano rápido, medio, pesado lento con mucho castigo. */
export const ATAQUES_TIPO: Readonly<Record<string, DefAtaque>> = {
  rapido: { carga: 0.22, golpe: 0.12, recupera: 0.3, alcance: 22, mult: 1.1, ciclo: 1.2 },
  medio: { carga: 0.34, golpe: 0.12, recupera: 0.38, alcance: 20, mult: 1.0, ciclo: 2.0 },
  pesado: { carga: 0.42, golpe: 0.12, recupera: 0.5, alcance: 20, mult: 1.25, ciclo: 2.6 },
  volador: { carga: 0.28, golpe: 0.1, recupera: 0.4, alcance: 14, mult: 0.9, ciclo: 1.8 },
};

export type EventoAtaque = { readonly tipo: "anticipa" } | { readonly tipo: "golpe"; readonly mult: number } | { readonly tipo: "fin" };

export class AtaquePorFases {
  readonly def: DefAtaque;
  fase: Fase = "patrulla";
  t = 0;
  cd: number;

  constructor(def: DefAtaque, azar?: Azar) {
    this.def = def;
    this.cd = azar ? 0.3 + azar.siguiente() * 0.6 : 0.5;
  }

  /** 0..1 dentro de la fase actual (para animar la anticipación). */
  get progreso(): number {
    const d = this.fase === "anticipa" ? this.def.carga : this.fase === "ataca" ? this.def.golpe : this.fase === "recupera" ? this.def.recupera : 1;
    return Math.min(1, this.t / d);
  }

  /** ¿El golpe está activo este paso? (encender la hitbox). */
  get activo(): boolean {
    return this.fase === "ataca";
  }

  /** `distancia` al objetivo (Infinity si no lo ve). Devuelve los eventos del paso. */
  actualizar(dt: number, distancia: number): EventoAtaque[] {
    const ev: EventoAtaque[] = [];
    this.t += dt;
    const d = this.def;
    switch (this.fase) {
      case "patrulla":
        this.cd -= dt;
        if (this.cd <= 0 && distancia <= d.alcance) {
          this.fase = "anticipa";
          this.t = 0;
          ev.push({ tipo: "anticipa" });
        }
        break;
      case "anticipa":
        if (this.t >= d.carga) {
          this.fase = "ataca";
          this.t = 0;
          ev.push({ tipo: "golpe", mult: d.mult });
        }
        break;
      case "ataca":
        if (this.t >= d.golpe) {
          this.fase = "recupera";
          this.t = 0;
        }
        break;
      case "recupera":
        if (this.t >= d.recupera) {
          this.fase = "patrulla";
          this.t = 0;
          this.cd = d.ciclo;
          ev.push({ tipo: "fin" });
        }
        break;
    }
    return ev;
  }

  /** Interrumpir (aturdido, golpe recibido fuerte): vuelve a patrulla con un cooldown. */
  interrumpir(cd = 0.6): void {
    this.fase = "patrulla";
    this.t = 0;
    this.cd = cd;
  }
}
