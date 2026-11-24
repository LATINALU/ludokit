// Afijos de desafío (modificadores de dificultad por nivel): un nivel de dificultad que escala
// vida y daño de los enemigos y suma afijos al alcanzar ciertos niveles. El sorteo es DETERMINISTA por semilla
// (misma sala + mismo nivel = mismos afijos, visibles antes de aceptar) y un contrarreloj sube o baja el nivel.

import { Pcg32 } from "../../../nucleo/pcg32.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export interface DefAfijo {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** Nivel desde el que puede salir. */
  readonly desde: number;
  readonly mods?: Readonly<Record<string, number>>;
}


/** Escala de vida y daño de los enemigos por nivel de desafío: una `Curva` (lineal, exponencial... sin tope). */
export const escalaDesafio = (c: Curva, nivel: number): number => evaluar(c, Math.max(1, nivel));

/** Afijos de una sala para un nivel: sin repetir, deterministas por semilla. */
export function sortearAfijos(semilla: number, nivel: number, lista: readonly DefAfijo[], umbrales: readonly number[]): DefAfijo[] {
  const cantidad = umbrales.filter((u) => nivel >= u).length;
  const az = new Pcg32(semilla * 1000 + nivel);
  const pool = lista.filter((a) => a.desde <= nivel);
  const r: DefAfijo[] = [];
  while (r.length < cantidad && pool.length > 0) r.push(pool.splice(az.rango(0, pool.length - 1), 1)[0]);
  return r;
}

/** Contrarreloj: tiempo total = base + oleadas × porOleada(nivel). */
export const tiempoDesafio = (oleadas: number, nivel: number, base: number, porOleada: Curva): number => base + oleadas * evaluar(porOleada, Math.max(1, nivel));

/**
 * Cambio del nivel según la fracción de tiempo sobrante. `escalones`: [fracción mínima, cambio] de mayor a menor
 * (p. ej. [[0.4, 3], [0.2, 2], [0, 1]]); terminar tarde da `tarde` (p. ej. −1).
 */
export function cambioDeNivel(sobrante: number, total: number, escalones: ReadonlyArray<readonly [number, number]>, tarde: number): number {
  if (sobrante <= 0) return tarde;
  const f = sobrante / total;
  for (const [min, cambio] of escalones) if (f >= min) return cambio;
  return 0;
}
