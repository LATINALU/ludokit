// Caso de uso: el jugador muere en una incursión. Orquesta el contexto de extracción con el estado de la partida:
// todo lo que llevaba encima pasa a un LEGADO en ese nivel, la incursión se vacía, lo depositado queda a salvo, y
// se avisa qué legados se perdieron (para mostrarlo en la interfaz y registrarlo).

import type { Legado, RegistroLegados } from "../dominio/extraccion.ts";

export interface EstadoIncursion<B> {
  /** Lo que se arriesga (equipo puesto, mochila, moneda del viaje). */
  llevado: B;
  nivel: number;
  vivo: boolean;
}

export interface ResultadoMuerte<B> {
  readonly legado: Legado<B>;
  readonly perdidos: readonly Legado<B>[];
}

export function resolverMuerte<B>(
  incursion: EstadoIncursion<B>,
  legados: RegistroLegados<B>,
  forma: Readonly<Record<string, unknown>>,
  causa: string,
  vacio: () => B,
): ResultadoMuerte<B> {
  const { nuevo, perdidos } = legados.morir(incursion.nivel, incursion.llevado, forma, causa);
  incursion.llevado = vacio();
  incursion.vivo = false;
  return { legado: nuevo, perdidos };
}

/** Vencer/tocar el legado: el botín vuelve a lo llevado (fusionado por el juego). */
export function recuperarLegado<B>(incursion: EstadoIncursion<B>, legados: RegistroLegados<B>, uid: string, fusionar: (a: B, b: B) => B): boolean {
  const b = legados.recuperar(uid);
  if (b === null) return false;
  incursion.llevado = fusionar(incursion.llevado, b);
  return true;
}
