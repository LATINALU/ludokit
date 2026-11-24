// Salud por PARTES del cuerpo (simuladores tácticos y de extracción, supervivencia): cada parte tiene su vida;
// una parte a 0 queda "destruida" y el daño que recibe se REPARTE al resto (multiplicado); las partes vitales
// (cabeza, torso) a 0 matan. Estados por parte: sangrado (leve/fuerte, quita vida por segundo) y fractura
// (penaliza moverse o apuntar). Los objetos de curación quitan estados y devuelven vida.

import type { Azar } from "../../../nucleo/azar.ts";

export interface DefParte {
  readonly vida: number;
  readonly vital?: boolean;
}

export type Sangrado = "ninguno" | "leve" | "fuerte";

export interface EstadoParte {
  vida: number;
  readonly max: number;
  readonly vital: boolean;
  sangrado: Sangrado;
  fractura: boolean;
}

export interface ReglasSalud {
  /** Multiplicador del daño que se reparte cuando la parte golpeada ya está destruida. */
  readonly repartoDestruida: number;
  /** Vida por segundo que quita el sangrado leve y el fuerte. */
  readonly sangradoLeve: number;
  readonly sangradoFuerte: number;
}

export type EventoSalud =
  | { readonly tipo: "danio"; readonly parte: string; readonly cantidad: number }
  | { readonly tipo: "destruida"; readonly parte: string }
  | { readonly tipo: "sangrado"; readonly parte: string; readonly nivel: Sangrado }
  | { readonly tipo: "fractura"; readonly parte: string }
  | { readonly tipo: "muerte"; readonly causa: string };

export class SaludPorPartes {
  readonly partes = new Map<string, EstadoParte>();
  readonly reglas: ReglasSalud;
  muerto = false;

  constructor(defs: Readonly<Record<string, DefParte>>, reglas: ReglasSalud) {
    for (const [k, d] of Object.entries(defs)) this.partes.set(k, { vida: d.vida, max: d.vida, vital: !!d.vital, sangrado: "ninguno", fractura: false });
    this.reglas = reglas;
  }

  get total(): number {
    let s = 0;
    for (const p of this.partes.values()) s += p.vida;
    return s;
  }

  get totalMax(): number {
    let s = 0;
    for (const p of this.partes.values()) s += p.max;
    return s;
  }

  private quitar(parte: string, cant: number, ev: EventoSalud[]): void {
    const p = this.partes.get(parte);
    if (!p || this.muerto) return;
    const antes = p.vida;
    p.vida = Math.max(0, p.vida - cant);
    ev.push({ tipo: "danio", parte, cantidad: antes - p.vida });
    if (antes > 0 && p.vida === 0) {
      ev.push({ tipo: "destruida", parte });
      if (p.vital) {
        this.muerto = true;
        ev.push({ tipo: "muerte", causa: parte });
      }
    }
  }

  /** Daño a una parte con probabilidades de sangrado/fractura. */
  recibir(parte: string, danio: number, azar: Azar, op: { sangrado?: number; fractura?: number } = {}): EventoSalud[] {
    const ev: EventoSalud[] = [];
    const p = this.partes.get(parte);
    if (!p || this.muerto) return ev;
    if (p.vida <= 0) {
      // Parte destruida: el daño se reparte entre las que quedan.
      const vivas = [...this.partes.entries()].filter(([, x]) => x.vida > 0);
      const cada = (danio * this.reglas.repartoDestruida) / Math.max(1, vivas.length);
      for (const [k] of vivas) this.quitar(k, cada, ev);
    } else this.quitar(parte, danio, ev);
    if (!this.muerto && op.sangrado && azar.siguiente() < op.sangrado) {
      p.sangrado = p.sangrado === "ninguno" && azar.siguiente() < 0.7 ? "leve" : "fuerte";
      ev.push({ tipo: "sangrado", parte, nivel: p.sangrado });
    }
    if (!this.muerto && op.fractura && !p.fractura && azar.siguiente() < op.fractura) {
      p.fractura = true;
      ev.push({ tipo: "fractura", parte });
    }
    return ev;
  }

  /** Sangrados por segundo. */
  actualizar(dt: number): EventoSalud[] {
    const ev: EventoSalud[] = [];
    for (const [k, p] of this.partes) {
      if (p.sangrado === "ninguno") continue;
      const v = (p.sangrado === "leve" ? this.reglas.sangradoLeve : this.reglas.sangradoFuerte) * dt;
      if (p.vida > 0) this.quitar(k, v, ev);
      else {
        // Sangrar en una parte destruida drena las vitales.
        for (const [kv, pv] of this.partes) if (pv.vital && pv.vida > 0) this.quitar(kv, v / 2, ev);
      }
    }
    return ev.filter((e) => e.tipo !== "danio");
  }

  /** Curar: quita estados en `parte` y suma vida (sin revivir partes destruidas si `revive` es false). */
  curar(parte: string, op: { vida?: number; sangrado?: boolean; fractura?: boolean; revive?: boolean }): void {
    const p = this.partes.get(parte);
    if (!p || this.muerto) return;
    if (op.sangrado) p.sangrado = "ninguno";
    if (op.fractura) p.fractura = false;
    if (op.vida && (p.vida > 0 || op.revive)) p.vida = Math.min(p.max, p.vida + op.vida);
  }

  /** Penalización de movimiento por piernas fracturadas o destruidas (0..1 de velocidad). */
  movilidad(piernas: readonly string[] = ["piernaIzq", "piernaDer"]): number {
    let m = 1;
    for (const k of piernas) {
      const p = this.partes.get(k);
      if (!p) continue;
      if (p.vida <= 0) m *= 0.6;
      else if (p.fractura) m *= 0.75;
    }
    return m;
  }
}
