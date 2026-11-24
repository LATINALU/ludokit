// Riesgo y extracción (roguelite de extracción, ARPG hardcore, souls-like):
//   - Lo que llevás encima en una incursión SE ARRIESGA; lo depositado en la base (bóveda, banco) está a salvo.
//   - Al morir queda un LEGADO (fantasma, tumba, cadáver) en ese nivel con todo lo que llevabas. Vencerlo/tocarlo
//     devuelve el botín exacto. Morir de nuevo en ese nivel antes de recuperarlo lo reemplaza (el viejo se pierde).
//   - Máximo de legados vivos a la vez (el más viejo se pierde).
//   - Modo infinito: la salida es cada vez más rara con la profundidad, con PIEDAD (garantizada tras N niveles).

import type { Azar } from "../../../nucleo/azar.ts";

export interface Legado<B> {
  readonly uid: string;
  readonly nivel: number;
  readonly botin: B;
  /** Instantánea del personaje (para que el legado pelee como él): stats, equipo visible, nombre. */
  readonly forma: Readonly<Record<string, unknown>>;
  readonly causa: string;
  readonly numero: number;
}

export class RegistroLegados<B> {
  private lista: Legado<B>[] = [];
  private contador = 0;
  readonly maximo: number;
  readonly unoPorNivel: boolean;

  constructor(maximo = 12, unoPorNivel = true) {
    this.maximo = maximo;
    this.unoPorNivel = unoPorNivel;
  }

  /** Registra una muerte. Devuelve el legado nuevo y los que se perdieron (reemplazados o por exceso). */
  morir(nivel: number, botin: B, forma: Readonly<Record<string, unknown>>, causa: string): { nuevo: Legado<B>; perdidos: Legado<B>[] } {
    const perdidos: Legado<B>[] = [];
    if (this.unoPorNivel) {
      perdidos.push(...this.lista.filter((l) => l.nivel === nivel));
      this.lista = this.lista.filter((l) => l.nivel !== nivel);
    }
    const nuevo: Legado<B> = { uid: `legado-${++this.contador}`, nivel, botin, forma, causa, numero: this.contador };
    this.lista.push(nuevo);
    while (this.lista.length > this.maximo) perdidos.push(this.lista.shift()!);
    return { nuevo, perdidos };
  }

  enNivel(nivel: number): Legado<B>[] {
    return this.lista.filter((l) => l.nivel === nivel);
  }

  /** Recuperar: quita el legado y devuelve su botín exacto. */
  recuperar(uid: string): B | null {
    const i = this.lista.findIndex((l) => l.uid === uid);
    if (i < 0) return null;
    return this.lista.splice(i, 1)[0].botin;
  }

  get todos(): readonly Legado<B>[] {
    return this.lista;
  }

  exportar(): { lista: Legado<B>[]; contador: number } {
    return { lista: this.lista.map((l) => ({ ...l })), contador: this.contador };
  }

  importar(d: { lista: Legado<B>[]; contador: number }): void {
    this.lista = d.lista.map((l) => ({ ...l }));
    this.contador = d.contador;
  }
}

/** Vida de un legado que pelea: lo mayor entre vida del jefe del nivel × factor y vida del jugador × multiplicador. */
export const vidaDeLegado = (vidaJefeNivel: number, vidaJugador: number, factorJefe: number, multJugador: number): number => Math.max(vidaJefeNivel * factorJefe, vidaJugador * multJugador);

export interface ReglasInfinito {
  readonly probBase: number;
  readonly caidaPorNivel: number;
  readonly probMin: number;
  /** Niveles seguidos sin salida tras los que la salida es segura. */
  readonly piedad: number;
  /** Jefe cada N niveles (punto de inicio desbloqueable). */
  readonly jefeCada: number;
}


export const probSalida = (profundidad: number, r: ReglasInfinito): number => Math.max(r.probMin, r.probBase - profundidad * r.caidaPorNivel);

/** ¿Este nivel del modo infinito tiene salida? Lleva el contador de piedad. */
export function haySalida(azar: Azar, profundidad: number, estado: { sinSalida: number }, r: ReglasInfinito): boolean {
  const hay = estado.sinSalida >= r.piedad || azar.siguiente() < probSalida(profundidad, r);
  estado.sinSalida = hay ? 0 : estado.sinSalida + 1;
  return hay;
}

/** Niveles desde los que se puede empezar: 1 y cada uno posterior a un jefe vencido. */
export function iniciosDisponibles(mejorProfundidad: number, r: ReglasInfinito): number[] {
  const r2 = [1];
  for (let p = r.jefeCada + 1; p <= mejorProfundidad + 1; p += r.jefeCada) r2.push(p);
  return r2;
}
