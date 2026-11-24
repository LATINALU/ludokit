// Tablas de botín. Hay tres formas de leer una tabla y dan economías MUY distintas:
//   "uno-y-tirar": se elige UNA entrada al azar y después se tira su probabilidad. Las probabilidades de una
//                  tabla pueden sumar más de 1. Cada muerte da 0 o 1 objeto. P real = p / cantidad de entradas.
//   "cada-uno":    se tira cada entrada por separado. Una muerte puede dar varios objetos.
//   "ponderado":   las probabilidades son pesos y siempre sale exactamente uno (cofres, recompensas garantizadas).
// La tabla puede elegirse por el nivel del enemigo (`tablaPorNivel`) y los jefes pueden tener la suya.

import { elegirPorPeso, entero, type Azar } from "../../../nucleo/azar.ts";

export type EntradaDrop = readonly [objeto: number, probabilidad: number];
export type ModoDrop = "uno-y-tirar" | "cada-uno" | "ponderado";

export function tirarDrop(azar: Azar, tabla: readonly EntradaDrop[], modo: ModoDrop = "uno-y-tirar", multiplicador = 1): number[] {
  if (tabla.length === 0) {
    return [];
  }
  switch (modo) {
    case "uno-y-tirar": {
      const tirada = azar.siguiente();
      const [objeto, prob] = tabla[entero(azar, tabla.length)];
      return prob * multiplicador > tirada ? [objeto] : [];
    }
    case "cada-uno":
      return tabla.filter(([, prob]) => azar.siguiente() < prob * multiplicador).map(([objeto]) => objeto);
    case "ponderado":
      return [elegirPorPeso(azar, tabla)];
  }
}

/** Probabilidad real de que salga cada objeto en una muerte (para equilibrar y para mostrar al jugador). */
export function probabilidadReal(tabla: readonly EntradaDrop[], modo: ModoDrop = "uno-y-tirar"): Map<number, number> {
  const res = new Map<number, number>();
  const pesoTotal = tabla.reduce((s, [, p]) => s + Math.max(0, p), 0);
  for (const [objeto, prob] of tabla) {
    const p = Math.min(1, Math.max(0, prob));
    const real = modo === "uno-y-tirar" ? p / tabla.length : modo === "cada-uno" ? p : pesoTotal > 0 ? Math.max(0, prob) / pesoTotal : 0;
    res.set(objeto, (res.get(objeto) ?? 0) + real);
  }
  return res;
}

/** Elige la tabla según el nivel: rangos [nivel máximo, tabla] ordenados; si se pasa del último, `defecto`. */
export function tablaPorNivel(rangos: ReadonlyArray<readonly [number, number]>, defecto: number): (nivel: number) => number {
  return (nivel) => {
    for (const [maximo, tabla] of rangos) {
      if (nivel <= maximo) {
        return tabla;
      }
    }
    return defecto;
  };
}
