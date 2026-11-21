// Torneo de eliminación directa: siembra por puntaje (los mejores no se cruzan hasta el final), pases libres (byes)
// cuando la cantidad no es potencia de 2, avance por ronda, premio que crece por ronda y con el tamaño del torneo,
// y estados con tiempos de espera (inscripción, preparación, pelea) para un torneo automático en un servidor.

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";

export interface Inscripto {
  readonly id: string;
  readonly puntaje?: number;
}

export interface Cruce {
  readonly ronda: number;
  readonly indice: number;
  a: string | null;
  b: string | null;
  ganador: string | null;
}

/** Orden de siembra estándar para n (potencia de 2): 1 vs n, 2 vs n−1… en lados opuestos del cuadro. */
export function ordenSiembra(n: number): number[] {
  let orden = [1];
  while (orden.length < n) {
    const m = orden.length * 2 + 1;
    orden = orden.flatMap((s) => [s, m - s]);
  }
  return orden;
}

export class Torneo {
  readonly rondas: Cruce[][];
  readonly tamano: number;
  readonly inscriptos: readonly Inscripto[];

  constructor(inscriptos: readonly Inscripto[]) {
    if (inscriptos.length < 2) throw new Error("Torneo: hacen falta al menos 2");
    this.inscriptos = [...inscriptos].sort((x, y) => (y.puntaje ?? 0) - (x.puntaje ?? 0));
    this.tamano = 1 << Math.ceil(Math.log2(inscriptos.length));
    const siembra = ordenSiembra(this.tamano);
    const primera: Cruce[] = [];
    for (let i = 0; i < this.tamano / 2; i++) {
      const a = this.inscriptos[siembra[2 * i] - 1]?.id ?? null;
      const b = this.inscriptos[siembra[2 * i + 1] - 1]?.id ?? null;
      primera.push({ ronda: 0, indice: i, a, b, ganador: null });
    }
    this.rondas = [primera];
    for (let r = 1, n = this.tamano / 4; n >= 1; r++, n /= 2) {
      this.rondas.push(Array.from({ length: n }, (_, i) => ({ ronda: r, indice: i, a: null, b: null, ganador: null })));
    }
    // Pases libres: quien no tiene rival avanza solo.
    for (const c of primera) if ((c.a === null) !== (c.b === null)) this.avanzar(c, (c.a ?? c.b)!);
  }

  get cantidadRondas(): number {
    return this.rondas.length;
  }

  /** Cruces listos para jugarse (los dos lados definidos y sin ganador). */
  pendientes(): Cruce[] {
    return this.rondas.flat().filter((c) => c.a !== null && c.b !== null && c.ganador === null);
  }

  private avanzar(c: Cruce, ganador: string): void {
    c.ganador = ganador;
    const sig = this.rondas[c.ronda + 1];
    if (!sig) return;
    const destino = sig[Math.floor(c.indice / 2)];
    if (c.indice % 2 === 0) destino.a = ganador;
    else destino.b = ganador;
  }

  reportar(ronda: number, indice: number, ganador: string): Resultado<void, "no-existe" | "no-listo" | "ya-jugado" | "no-participa"> {
    const c = this.rondas[ronda]?.[indice];
    if (!c) return fallo("no-existe");
    if (c.a === null || c.b === null) return fallo("no-listo");
    if (c.ganador !== null) return fallo("ya-jugado");
    if (ganador !== c.a && ganador !== c.b) return fallo("no-participa");
    this.avanzar(c, ganador);
    return exito(undefined);
  }

  get campeon(): string | null {
    return this.rondas[this.rondas.length - 1][0].ganador;
  }

  /** Ronda máxima a la que llegó cada participante (para repartir premios). */
  rondaAlcanzada(id: string): number {
    let r = -1;
    for (const ronda of this.rondas) for (const c of ronda) if (c.a === id || c.b === id) r = Math.max(r, c.ronda);
    return this.campeon === id ? this.rondas.length : r;
  }
}

/** Premio por ronda ganada: base·N/16 + base, con base por ronda (crece con el torneo y con la ronda). */
export const premioRonda = (ronda: number, participantes: number, bases: readonly number[] = [200, 300, 500, 800]): number => {
  const b = bases[Math.min(ronda, bases.length - 1)];
  return Math.floor((b * participantes) / 16) + b;
};

export type EstadoTorneo = "inscripcion" | "preparacion" | "pelea" | "entre-rondas" | "terminado";

/** Tiempos por estado de un torneo automático (segundos). */
export const TIEMPOS_TORNEO: Readonly<Record<Exclude<EstadoTorneo, "terminado">, number>> = {
  inscripcion: 10, preparacion: 20, pelea: 180, "entre-rondas": 5,
};
