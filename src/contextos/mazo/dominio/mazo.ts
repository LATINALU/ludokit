// Juegos de cartas con mazo (constructores de mazos, roguelikes de cartas, coleccionables):
//   - PILAS: robo, mano, descarte, agotadas (exiliadas) y en juego; al quedarse sin robo se baraja el descarte.
//   - Robar con tamaño máximo de mano (lo que no entra va al descarte o se quema, según la regla).
//   - Fin de turno: descartar la mano salvo las cartas que se "retienen".
//   - ENERGÍA por turno (maná), con energía temporal y costo modificable por carta.
//   - Mulligan y búsqueda (tutor) por predicado.
// Las cartas son datos del juego: este módulo solo mueve identificadores (`C` genérico) entre pilas.

import type { Azar } from "../../../nucleo/azar.ts";

export function barajar<T>(arr: T[], azar: Azar): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(azar.siguiente() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface ReglasMazo {
  readonly manoMax: number;
  readonly roboPorTurno: number;
  /** Qué pasa si se roba con la mano llena. */
  readonly manoLlena: "descartar" | "quemar" | "no-robar";
  readonly energiaPorTurno: number;
  /** La energía sobrante se pierde (true) o se acumula hasta `energiaMax`. */
  readonly energiaSeVacia: boolean;
  readonly energiaMax: number;
}

export type EventoMazo<C> =
  | { readonly tipo: "robo"; readonly carta: C }
  | { readonly tipo: "barajar"; readonly cantidad: number }
  | { readonly tipo: "quemada"; readonly carta: C }
  | { readonly tipo: "sin-cartas" };

export class Mazo<C> {
  robo: C[];
  mano: C[] = [];
  descarte: C[] = [];
  agotadas: C[] = [];
  energia = 0;
  readonly reglas: ReglasMazo;
  private readonly azar: Azar;

  constructor(cartas: readonly C[], reglas: ReglasMazo, azar: Azar) {
    this.reglas = reglas;
    this.azar = azar;
    this.robo = barajar([...cartas], azar);
  }

  robar(n: number): EventoMazo<C>[] {
    const ev: EventoMazo<C>[] = [];
    for (let i = 0; i < n; i++) {
      if (this.robo.length === 0) {
        if (this.descarte.length === 0) {
          ev.push({ tipo: "sin-cartas" });
          break;
        }
        this.robo = barajar(this.descarte, this.azar);
        this.descarte = [];
        ev.push({ tipo: "barajar", cantidad: this.robo.length });
      }
      if (this.mano.length >= this.reglas.manoMax) {
        if (this.reglas.manoLlena === "no-robar") break;
        const c = this.robo.pop()!;
        if (this.reglas.manoLlena === "descartar") this.descarte.push(c);
        else this.agotadas.push(c);
        ev.push({ tipo: "quemada", carta: c });
        continue;
      }
      const c = this.robo.pop()!;
      this.mano.push(c);
      ev.push({ tipo: "robo", carta: c });
    }
    return ev;
  }

  empezarTurno(): EventoMazo<C>[] {
    const r = this.reglas;
    this.energia = r.energiaSeVacia ? r.energiaPorTurno : Math.min(r.energiaMax, this.energia + r.energiaPorTurno);
    return this.robar(r.roboPorTurno);
  }

  /** Juega la carta `i` de la mano pagando `costo`. `destino`: descarte (normal), agotar (se va) o null (queda en juego). */
  jugar(i: number, costo: number, destino: "descarte" | "agotar" | null = "descarte"): C | null {
    if (i < 0 || i >= this.mano.length || costo > this.energia) return null;
    this.energia -= costo;
    const [c] = this.mano.splice(i, 1);
    if (destino === "descarte") this.descarte.push(c);
    else if (destino === "agotar") this.agotadas.push(c);
    return c;
  }

  /** Fin de turno: la mano va al descarte salvo las que cumplen `retener`. */
  terminarTurno(retener: (c: C) => boolean = () => false): void {
    const quedan: C[] = [];
    for (const c of this.mano) (retener(c) ? quedan : this.descarte).push(c);
    this.mano = quedan;
  }

  /** Mulligan: devuelve la mano al robo, baraja y roba la misma cantidad (o `n`). */
  mulligan(n = this.mano.length): EventoMazo<C>[] {
    this.robo.push(...this.mano);
    this.mano = [];
    barajar(this.robo, this.azar);
    return this.robar(n);
  }

  /** Busca en el robo la primera carta que cumpla y la pone en la mano. */
  buscar(pred: (c: C) => boolean): C | null {
    const i = this.robo.findIndex(pred);
    if (i < 0) return null;
    const [c] = this.robo.splice(i, 1);
    this.mano.push(c);
    return c;
  }

  /** Agrega una carta (recompensa, maldición) a una pila; en el robo, en posición al azar. */
  agregar(c: C, pila: "robo" | "mano" | "descarte"): void {
    if (pila === "robo") this.robo.splice(Math.floor(this.azar.siguiente() * (this.robo.length + 1)), 0, c);
    else if (pila === "mano") this.mano.push(c);
    else this.descarte.push(c);
  }

  get total(): number {
    return this.robo.length + this.mano.length + this.descarte.length;
  }
}

/** Curva de maná de un mazo: cantidad de cartas por costo (herramienta de diseño). */
export function curvaDeCostos<C>(cartas: readonly C[], costo: (c: C) => number): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cartas) m.set(costo(c), (m.get(costo(c)) ?? 0) + 1);
  return new Map([...m].sort((a, b) => a[0] - b[0]));
}

/** Probabilidad hipergeométrica de robar al menos `k` de `exitos` copias en `robos` cartas de un mazo de `n`. */
export function probRobarAlMenos(n: number, exitos: number, robos: number, k = 1): number {
  const comb = (a: number, b: number): number => {
    if (b < 0 || b > a) return 0;
    let r = 1;
    for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i;
    return r;
  };
  let p = 0;
  for (let i = k; i <= Math.min(exitos, robos); i++) p += (comb(exitos, i) * comb(n - exitos, robos - i)) / comb(n, robos);
  return p;
}
