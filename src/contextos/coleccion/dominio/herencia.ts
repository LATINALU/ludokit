// Herencia de rasgos al FUSIONAR (cartas, mascotas, armas, criaturas que se combinan). Cuatro reglas que hacen que
// fusionar sea una decisión interesante y no solo "3 → 1":
//   1. HERENCIA: el resultado hereda los rasgos de las tres entradas (los más raros primero) hasta el tope.
//   2. RESONANCIA: cada rasgo que comparten dos o más entradas DESPIERTA un rasgo nuevo (si hay lugar).
//   3. MUTACIÓN: muchos rasgos comunes juntos pueden subir de rareza (más probable cuantos más haya).
//   4. TRANSMUTACIÓN: los rasgos que no entran no se pierden: cada uno que sobra mejora al de menor rareza.
// El catálogo de rasgos es del juego ({id, rareza}); aquí solo están las reglas.

import type { Azar } from "../../../nucleo/azar.ts";

export interface DefRasgo {
  readonly id: string;
  readonly rareza: number;
  /** Peso de aparición base (1 por defecto). */
  readonly peso?: number;
  /** Excluido de los sorteos (rasgos especiales que solo trae algo concreto). */
  readonly especial?: boolean;
}

export interface ReglasHerencia {
  readonly tope: number;
  /** Peso por rareza para sortear rasgos nuevos. */
  readonly pesoRareza: readonly number[];
  /** Cuánto se inclinan los sorteos a rarezas altas con el nivel del resultado. */
  readonly inclinacionNivel: number;
  /** Rareza máxima que puede alcanzar una mejora por transmutación. */
  readonly maxTransmutar: number;
}

export const REGLAS_HERENCIA: ReglasHerencia = { tope: 5, pesoRareza: [60, 28, 10, 2], inclinacionNivel: 0.12, maxTransmutar: 3 };

export class CatalogoRasgos {
  private readonly porId: ReadonlyMap<string, DefRasgo>;
  readonly lista: readonly DefRasgo[];

  constructor(lista: readonly DefRasgo[]) {
    this.lista = lista;
    this.porId = new Map(lista.map((r) => [r.id, r]));
  }

  rareza(id: string): number {
    return this.porId.get(id)?.rareza ?? 0;
  }

  ordenar(ids: readonly string[]): string[] {
    return [...new Set(ids)].filter((i) => this.porId.has(i)).sort((a, b) => this.rareza(b) - this.rareza(a));
  }

  /** Sortea un rasgo que no esté en `excluir`, más raro cuanto mayor el nivel. */
  sortear(azar: Azar, nivel: number, excluir: readonly string[], r: ReglasHerencia = REGLAS_HERENCIA, rareza?: number): string | null {
    const tabla = this.lista.filter((x) => !x.especial && !excluir.includes(x.id) && (rareza === undefined || x.rareza === rareza));
    if (!tabla.length) return null;
    const pesos = tabla.map((x) => (r.pesoRareza[x.rareza] ?? 1) * (x.peso ?? 1) * (1 + nivel * r.inclinacionNivel * x.rareza));
    let v = azar.siguiente() * pesos.reduce((s, p) => s + p, 0);
    for (let i = 0; i < tabla.length; i++) {
      v -= pesos[i];
      if (v < 0) return tabla[i].id;
    }
    return tabla[tabla.length - 1].id;
  }
}

/** Probabilidad de que un rasgo de rareza `rareza` mute, según cuántos de esa rareza hay juntos. */
export function probMutacion(cuantos: number, rareza: number): number {
  if (rareza === 0) return cuantos < 3 ? 0 : Math.min(0.4, 0.12 + 0.05 * (cuantos - 3));
  if (rareza === 1) return cuantos < 4 ? 0 : Math.min(0.18, 0.06 + 0.03 * (cuantos - 4));
  return 0;
}

export interface ResultadoHerencia {
  readonly rasgos: string[];
  readonly heredados: string[];
  readonly despertados: string[];
  readonly mutados: Array<{ de: string; a: string }>;
  readonly mejorados: Array<{ de: string; a: string }>;
}

/**
 * Rasgos del resultado de fusionar `entradas` (listas de rasgos de cada pieza). `propios`: los que ya trae la pieza
 * nueva (llenan huecos). `nivel`: nivel del resultado.
 */
export function heredarRasgos(azar: Azar, cat: CatalogoRasgos, entradas: ReadonlyArray<readonly string[]>, propios: readonly string[], nivel: number, r: ReglasHerencia = REGLAS_HERENCIA): ResultadoHerencia {
  const veces = new Map<string, number>();
  for (const e of entradas) for (const id of new Set(e)) veces.set(id, (veces.get(id) ?? 0) + 1);
  const heredados = cat.ordenar([...veces.keys()]).slice(0, r.tope);
  const todos = [...heredados];
  for (const id of propios) if (todos.length < r.tope && !todos.includes(id)) todos.push(id);
  const despertados: string[] = [];
  for (const n of veces.values()) {
    if (n >= 2 && todos.length < r.tope) {
      const nuevo = cat.sortear(azar, nivel, todos, r);
      if (nuevo) {
        todos.push(nuevo);
        despertados.push(nuevo);
      }
    }
  }
  // Mutación.
  const cuenta = new Map<number, number>();
  for (const id of todos) cuenta.set(cat.rareza(id), (cuenta.get(cat.rareza(id)) ?? 0) + 1);
  const mutados: Array<{ de: string; a: string }> = [];
  for (let i = 0; i < todos.length; i++) {
    const rar = cat.rareza(todos[i]);
    if (azar.siguiente() >= probMutacion(cuenta.get(rar) ?? 0, rar)) continue;
    const destino = rar + (rar === 0 && azar.siguiente() < 1 / 6 ? 2 : 1);
    const nuevo = cat.sortear(azar, nivel, todos, r, destino);
    if (nuevo) {
      mutados.push({ de: todos[i], a: nuevo });
      todos[i] = nuevo;
    }
  }
  // Transmutación de lo que no entró.
  const total = propios.length + entradas.reduce((s, e) => s + e.length, 0);
  const mejorados: Array<{ de: string; a: string }> = [];
  for (let k = 0; k < total - r.tope; k++) {
    let peor = -1;
    for (let i = 0; i < todos.length; i++) {
      const rar = cat.rareza(todos[i]);
      if (rar < r.maxTransmutar && (peor < 0 || rar < cat.rareza(todos[peor]))) peor = i;
    }
    if (peor < 0) break;
    const nuevo = cat.sortear(azar, nivel, todos, r, cat.rareza(todos[peor]) + 1);
    if (!nuevo) break;
    mejorados.push({ de: todos[peor], a: nuevo });
    todos[peor] = nuevo;
  }
  return { rasgos: cat.ordenar(todos), heredados, despertados, mutados, mejorados };
}
