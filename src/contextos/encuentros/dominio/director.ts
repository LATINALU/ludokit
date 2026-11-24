// Director de ritmo (hordas de zombis, survival cooperativo, juegos de terror): en vez de oleadas fijas, mide la
// INTENSIDAD que vive el jugador (daño recibido, enemigos cerca, muertes cercanas) y alterna fases:
//   ACUMULAR (aparecen enemigos hasta llegar al pico) → PICO (se mantiene un rato) → RELAJAR (casi nada aparece, el
//   jugador respira y se cura) → vuelve a ACUMULAR.
// Además reparte un PRESUPUESTO de aparición por segundo entre tipos con costo (comunes baratos, especiales caros,
// con recarga mínima entre especiales) y lanza EVENTOS de horda (alarma, fuegos artificiales) bajo demanda.

import type { Azar } from "../../../nucleo/azar.ts";

export type FaseDirector = "acumular" | "pico" | "relajar";

export interface TipoAparicion {
  readonly id: string;
  readonly costo: number;
  readonly peso: number;
  /** Segundos mínimos entre apariciones de este tipo (especiales). */
  readonly recarga?: number;
  /** Máximo vivos a la vez. */
  readonly maxVivos?: number;
}

export interface ReglasDirector {
  /** Intensidad 0..1 objetivo para pasar a pico; segundos de pico y de relajo. */
  readonly umbralPico: number;
  readonly duracionPico: number;
  readonly duracionRelajo: number;
  /** Caída de intensidad por segundo. */
  readonly decaeIntensidad: number;
  /** Presupuesto por segundo en cada fase. */
  readonly presupuesto: Readonly<Record<FaseDirector, number>>;
  /** Máximo de enemigos vivos. */
  readonly maxVivos: number;
  readonly tipos: readonly TipoAparicion[];
}

export class Director {
  readonly reglas: ReglasDirector;
  fase: FaseDirector = "acumular";
  intensidad = 0;
  private t = 0;
  private bolsa = 0;
  private readonly recargas = new Map<string, number>();
  private readonly azar: Azar;

  constructor(reglas: ReglasDirector, azar: Azar) {
    this.reglas = reglas;
    this.azar = azar;
  }

  /** Eventos que suben la intensidad (llamar desde el juego). */
  recibioDanio(fraccionVida: number): void {
    this.intensidad = Math.min(1, this.intensidad + fraccionVida * 0.8);
  }

  enemigoCerca(): void {
    this.intensidad = Math.min(1, this.intensidad + 0.02);
  }

  murioCerca(): void {
    this.intensidad = Math.min(1, this.intensidad + 0.08);
  }

  /** Horda forzada: llena la bolsa con `presupuesto` extra ya. */
  horda(presupuesto: number): void {
    this.bolsa += presupuesto;
    this.fase = "pico";
    this.t = 0;
  }

  /** Avanza; devuelve los tipos a hacer aparecer este paso. `vivos`: por tipo. */
  actualizar(dt: number, vivos: ReadonlyMap<string, number>): string[] {
    const r = this.reglas;
    this.intensidad = Math.max(0, this.intensidad - r.decaeIntensidad * dt);
    this.t += dt;
    if (this.fase === "acumular" && this.intensidad >= r.umbralPico) {
      this.fase = "pico";
      this.t = 0;
    } else if (this.fase === "pico" && this.t >= r.duracionPico) {
      this.fase = "relajar";
      this.t = 0;
      this.bolsa = 0;
    } else if (this.fase === "relajar" && this.t >= r.duracionRelajo) {
      this.fase = "acumular";
      this.t = 0;
    }
    for (const [k, v] of this.recargas) this.recargas.set(k, Math.max(0, v - dt));
    this.bolsa += r.presupuesto[this.fase] * dt;

    const salen: string[] = [];
    let total = 0;
    for (const v of vivos.values()) total += v;
    const cuenta = new Map(vivos);
    for (let intentos = 0; intentos < 32 && total < r.maxVivos; intentos++) {
      const posibles = r.tipos.filter((t) => t.costo <= this.bolsa && (this.recargas.get(t.id) ?? 0) <= 0 && (cuenta.get(t.id) ?? 0) < (t.maxVivos ?? Infinity));
      if (!posibles.length) break;
      const peso = posibles.reduce((s, t) => s + t.peso, 0);
      let x = this.azar.siguiente() * peso;
      let elegido = posibles[posibles.length - 1];
      for (const t of posibles) {
        x -= t.peso;
        if (x < 0) { elegido = t; break; }
      }
      this.bolsa -= elegido.costo;
      if (elegido.recarga) this.recargas.set(elegido.id, elegido.recarga);
      cuenta.set(elegido.id, (cuenta.get(elegido.id) ?? 0) + 1);
      total++;
      salen.push(elegido.id);
    }
    return salen;
  }
}
