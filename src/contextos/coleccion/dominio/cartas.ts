// Colección tipo gacha: cartas (personajes, armas, mascotas...) con tipo, nivel (estrellas) y stats.
//   - Rareza: tablas acumuladas [nivel, probabilidad] y porcentajes visibles para el jugador.
//   - Fusión: tres cartas del mismo tipo y nivel -> una; con probabilidad p sube un nivel.
//   - Mejora: un objeto suma +1~+5 a todos los stats sin pasar el máximo de su nivel.
// Todo está parametrizado: un juego nuevo cambia tablas, no código.

import { elegirPonderado, elegirUno, tirar, type Azar } from "../../../nucleo/azar.ts";
import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

// ---------------- Rareza ----------------

/** Tabla acumulada [nivel, probabilidad]. */
export type TablaRareza = ReadonlyArray<readonly [number, number]>;

export function tirarRareza(azar: Azar, tabla: TablaRareza, sobrantes: readonly number[] = []): number {
  return elegirPonderado(azar, tabla, sobrantes);
}

/** Probabilidad de salir con una tabla acumulada (para mostrarla al jugador, obligatorio en muchos países). */
export function probabilidadesVisibles(tabla: TablaRareza): { nivel: number; porcentaje: number }[] {
  const total = tabla.reduce((s, [, p]) => s + p, 0);
  const resto = Math.max(0, 1 - total);
  return tabla.map(([nivel, p], i) => ({ nivel, porcentaje: (p + (i === 0 ? resto : 0)) * 100 }));
}

// ---------------- Fusión ----------------

export interface CartaBase {
  readonly tipo: number;
  readonly nivel: number;
  readonly personaje: number;
}

export interface ReglasFusion<C extends CartaBase> {
  readonly azar: Azar;
  /** Probabilidad (0~1) de subir desde ese nivel para ese tipo. Sin dato = 1 (siempre). */
  readonly probabilidad: (tipo: number, nivel: number) => number | undefined;
  readonly nivelMaximo: number;
  /** Personajes posibles si las tres cartas son de personajes distintos (mismo "grado" que las de entrada). */
  readonly personajesPosibles: (cartas: readonly C[]) => readonly number[];
  readonly crear: (tipo: number, nivel: number, personaje: number) => C;
}

export type ErrorFusion = "distinto-nivel" | "distinto-tipo" | "nivel-maximo";

/**
 * Tres cartas iguales en tipo y nivel -> una carta. `suerte` (carta de la suerte / de éxito) asegura subir.
 * Las probabilidades por nivel las define el juego (`reglas.probabilidad`, p. ej. con `probabilidadDesdeCurva`).
 */
export function fusionar<C extends CartaBase>(
  cartas: readonly [C, C, C],
  reglas: ReglasFusion<C>,
  suerte = false,
): Resultado<{ carta: C; subio: boolean }, ErrorFusion> {
  const [a, b, c] = cartas;
  if (a.nivel !== b.nivel || a.nivel !== c.nivel) return fallo("distinto-nivel");
  if (a.tipo !== b.tipo || a.tipo !== c.tipo) return fallo("distinto-tipo");
  if (a.nivel >= reglas.nivelMaximo) return fallo("nivel-maximo");

  const personaje = a.personaje === b.personaje && a.personaje === c.personaje
    ? a.personaje
    : elegirUno(reglas.azar, reglas.personajesPosibles(cartas));
  const prob = reglas.probabilidad(a.tipo, a.nivel) ?? 1;
  const subio = suerte || tirar(reglas.azar, prob);
  return exito({ carta: reglas.crear(a.tipo, subio ? a.nivel + 1 : a.nivel, personaje), subio });
}

/** Probabilidad de subir al fusionar desde una curva (nivel → 0..1): sirve para cualquier cantidad de niveles. */
export const probabilidadDesdeCurva = (c: Curva) => (_tipo: number, nivel: number): number => Math.min(1, Math.max(0, evaluar(c, nivel)));

/** Costo de fusionar según el nivel de las cartas, desde una curva (normalmente exponencial). */
export const costoFusion = (c: Curva, nivel: number): number => Math.round(evaluar(c, nivel + 1));

// ---------------- Mejora (encantamiento) ----------------

export type Stats = Record<string, number>;

/**
 * Suma el mismo incremento a todos los stats sin pasar `maximos`. `tabla`: incrementos posibles con su
 * probabilidad (p. ej. [[1, 0.5], [2, 0.35], [3, 0.15]]). Falla si ya están todos al máximo (y el objeto no se gasta).
 */
export function mejorar(
  stats: Stats,
  maximos: Readonly<Stats>,
  azar: Azar,
  tabla: TablaRareza,
): Resultado<{ incremento: number; stats: Stats }, "al-maximo"> {
  const claves = Object.keys(maximos);
  if (claves.every((k) => (stats[k] ?? 0) >= maximos[k])) {
    return fallo("al-maximo");
  }
  const incremento = elegirPonderado(azar, tabla);
  const nuevos: Stats = { ...stats };
  for (const k of claves) {
    nuevos[k] = Math.min((stats[k] ?? 0) + incremento, maximos[k]);
  }
  return exito({ incremento, stats: nuevos });
}

/** Stats de una carta nueva: cada uno al azar entre el mínimo y el máximo de su nivel. */
export function generarStats(azar: Azar, minimos: Readonly<Stats>, maximos: Readonly<Stats>): Stats {
  const stats: Stats = {};
  for (const k of Object.keys(maximos)) {
    const min = minimos[k] ?? 0;
    stats[k] = min + Math.floor(azar.siguiente() * (maximos[k] - min + 1));
  }
  return stats;
}
