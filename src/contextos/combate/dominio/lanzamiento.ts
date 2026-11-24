// Lanzamiento de habilidades estilo MMO/MOBA/ARPG:
//   - TIEMPO DE LANZAMIENTO (cast) con barra; moverse o ser interrumpido lo corta; recibir daño lo EMPUJA hacia atrás
//     (pushback) hasta un máximo de veces.
//   - CANALIZACIÓN: efecto en ticks durante N segundos (se puede cortar).
//   - RECARGA GLOBAL (GCD) compartida entre habilidades, reducida por celeridad (haste) con mínimo.
//   - COLA DE LANZAMIENTO: apretar la siguiente habilidad poco antes de terminar la actual la encola (se siente
//     fluido con latencia).
//   - INTERRUPCIÓN que bloquea la ESCUELA de la habilidad interrumpida por unos segundos.
//   - CARGAS: habilidades con N usos que se recargan de a una (ver `Cargas` en recursos.ts).
// Emite eventos; el efecto real (daño, curación) lo aplica el juego al recibir "completado"/"tick".

export interface DefLanzamiento {
  readonly id: string;
  /** Segundos de lanzamiento (0 = instantáneo). */
  readonly lanzamiento: number;
  /** Canalizada: dura `canalizar` segundos con `ticks` efectos. */
  readonly canalizar?: number;
  readonly ticks?: number;
  /** Usa la recarga global. */
  readonly gcd?: boolean;
  /** Se puede lanzar en movimiento. */
  readonly enMovimiento?: boolean;
  /** Escuela (fuego, sagrado, físico...) para bloqueos por interrupción. */
  readonly escuela?: string;
}

export interface ReglasLanzamiento {
  readonly gcd: number;
  readonly gcdMin: number;
  /** Ventana para encolar la siguiente (s). */
  readonly ventanaCola: number;
  /** Segundos que empuja cada golpe y cuántos empujes como máximo. */
  readonly empuje: number;
  readonly maxEmpujes: number;
}

export type EventoLanzamiento =
  | { readonly tipo: "inicio"; readonly id: string; readonly duracion: number }
  | { readonly tipo: "completado"; readonly id: string }
  | { readonly tipo: "tick"; readonly id: string; readonly numero: number }
  | { readonly tipo: "cancelado"; readonly id: string; readonly motivo: "movimiento" | "interrupcion" | "manual" }
  | { readonly tipo: "encolado"; readonly id: string };

export type ErrorLanzamiento = "ocupado" | "gcd" | "escuela-bloqueada" | "en-movimiento";

export class Lanzador {
  readonly reglas: ReglasLanzamiento;
  /** Celeridad: 0.2 = +20 % (lanzamientos y GCD más cortos). */
  celeridad = 0;
  private actual: { def: DefLanzamiento; restante: number; total: number; empujes: number; tick: number; canal: boolean } | null = null;
  private gcd = 0;
  private cola: DefLanzamiento | null = null;
  private readonly bloqueos = new Map<string, number>();

  constructor(reglas: ReglasLanzamiento) {
    this.reglas = reglas;
  }

  get lanzando(): string | null {
    return this.actual?.def.id ?? null;
  }

  /** Progreso 0..1 de la barra actual. */
  get progreso(): number {
    return this.actual ? 1 - this.actual.restante / this.actual.total : 0;
  }

  get gcdRestante(): number {
    return this.gcd;
  }

  escuelaBloqueada(escuela: string): number {
    return this.bloqueos.get(escuela) ?? 0;
  }

  private duracionGcd(): number {
    return Math.max(this.reglas.gcdMin, this.reglas.gcd / (1 + this.celeridad));
  }

  /** Intentar lanzar. Si falta poco para terminar lo actual (o el GCD), se encola. */
  lanzar(def: DefLanzamiento, moviendose: boolean, ev: EventoLanzamiento[] = []): ErrorLanzamiento | null {
    if (def.escuela && (this.bloqueos.get(def.escuela) ?? 0) > 0) return "escuela-bloqueada";
    if (moviendose && !def.enMovimiento && def.lanzamiento > 0) return "en-movimiento";
    const ocupado = this.actual ? this.actual.restante : 0;
    const espera = Math.max(ocupado, def.gcd !== false ? this.gcd : 0);
    if (espera > 0) {
      if (espera <= this.reglas.ventanaCola) {
        this.cola = def;
        ev.push({ tipo: "encolado", id: def.id });
        return null;
      }
      return this.actual ? "ocupado" : "gcd";
    }
    this.empezar(def, ev);
    return null;
  }

  private empezar(def: DefLanzamiento, ev: EventoLanzamiento[]): void {
    if (def.gcd !== false) this.gcd = this.duracionGcd();
    const canal = !!def.canalizar;
    const dur = (canal ? def.canalizar! : def.lanzamiento) / (1 + this.celeridad);
    if (dur <= 0) {
      ev.push({ tipo: "completado", id: def.id });
      return;
    }
    this.actual = { def, restante: dur, total: dur, empujes: 0, tick: 0, canal };
    ev.push({ tipo: "inicio", id: def.id, duracion: dur });
  }

  /** Recibir daño mientras se lanza: empuja la barra (no afecta canalizaciones: estas pierden duración). */
  recibirGolpe(): void {
    const a = this.actual;
    if (!a || a.empujes >= this.reglas.maxEmpujes) return;
    a.empujes++;
    if (a.canal) a.restante = Math.max(0, a.restante - this.reglas.empuje);
    else a.restante = Math.min(a.total, a.restante + this.reglas.empuje);
  }

  /** Interrupción (patada, silencio): corta y bloquea la escuela `bloqueo` segundos. */
  interrumpir(bloqueo: number, ev: EventoLanzamiento[] = []): boolean {
    const a = this.actual;
    if (!a) return false;
    if (a.def.escuela && bloqueo > 0) this.bloqueos.set(a.def.escuela, bloqueo);
    this.actual = null;
    this.cola = null;
    ev.push({ tipo: "cancelado", id: a.def.id, motivo: "interrupcion" });
    return true;
  }

  cancelar(motivo: "movimiento" | "manual" = "manual", ev: EventoLanzamiento[] = []): void {
    if (!this.actual) return;
    ev.push({ tipo: "cancelado", id: this.actual.def.id, motivo });
    this.actual = null;
  }

  actualizar(dt: number, moviendose: boolean): EventoLanzamiento[] {
    const ev: EventoLanzamiento[] = [];
    this.gcd = Math.max(0, this.gcd - dt);
    for (const [k, v] of this.bloqueos) {
      if (v - dt <= 0) this.bloqueos.delete(k);
      else this.bloqueos.set(k, v - dt);
    }
    const a = this.actual;
    if (a) {
      if (moviendose && !a.def.enMovimiento) {
        this.cancelar("movimiento", ev);
      } else {
        a.restante -= dt;
        if (a.canal && a.def.ticks) {
          const debe = Math.min(a.def.ticks, Math.floor(((a.total - Math.max(0, a.restante)) / a.total) * a.def.ticks + 1e-9));
          while (a.tick < debe) ev.push({ tipo: "tick", id: a.def.id, numero: ++a.tick });
        }
        if (a.restante <= 0) {
          this.actual = null;
          ev.push({ tipo: "completado", id: a.def.id });
        }
      }
    }
    if (!this.actual && this.cola && this.gcd <= 0) {
      const c = this.cola;
      this.cola = null;
      this.empezar(c, ev);
    }
    return ev;
  }
}
