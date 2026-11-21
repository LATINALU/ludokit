// Fondos con parallax: capas que se desplazan a una fracción de la cámara (0 = fijo como el cielo, 1 = mundo),
// con repetición horizontal/vertical, deriva propia (nubes) y redondeo a píxel entero para pixel art.

export interface CapaParallax {
  readonly id: string;
  /** Factor de desplazamiento respecto a la cámara (x, y). */
  readonly factor: readonly [number, number];
  /** Tamaño del motivo que se repite (px); 0 = no repite en ese eje. */
  readonly repetir: readonly [number, number];
  /** Deriva propia en px/s (viento, agua). */
  readonly deriva?: readonly [number, number];
}

export interface PosicionCapa {
  readonly id: string;
  /** Desplazamiento a aplicar al dibujar la capa (px enteros). */
  readonly x: number;
  readonly y: number;
  /** Copias necesarias para cubrir la vista al repetir. */
  readonly copiasX: number;
  readonly copiasY: number;
}

export function posicionesParallax(capas: readonly CapaParallax[], camX: number, camY: number, tiempo: number, vistaW: number, vistaH: number): PosicionCapa[] {
  return capas.map((c) => {
    let x = -camX * c.factor[0] + (c.deriva?.[0] ?? 0) * tiempo;
    let y = -camY * c.factor[1] + (c.deriva?.[1] ?? 0) * tiempo;
    if (c.repetir[0] > 0) x = ((x % c.repetir[0]) - c.repetir[0]) % c.repetir[0];
    if (c.repetir[1] > 0) y = ((y % c.repetir[1]) - c.repetir[1]) % c.repetir[1];
    return {
      id: c.id,
      x: Math.round(x),
      y: Math.round(y),
      copiasX: c.repetir[0] > 0 ? Math.ceil(vistaW / c.repetir[0]) + 1 : 1,
      copiasY: c.repetir[1] > 0 ? Math.ceil(vistaH / c.repetir[1]) + 1 : 1,
    };
  });
}
