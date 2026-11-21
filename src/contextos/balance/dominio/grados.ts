// Grados de un enemigo: el MISMO arte e IA en N variantes de nivel (cada `paso` niveles), cada una con su tabla de
// botín y su rango de moneda. Multiplica el contenido sin dibujar nada nuevo; combinado con `girarTono` (grafico)
// cada grado puede tener además su propio color.

export interface Grado {
  readonly indice: number;
  readonly nivel: number;
  /** Índice de la tabla de botín de este grado. */
  readonly tablaBotin: number;
  /** Moneda [mín, máx] y probabilidad de soltarla. */
  readonly moneda: readonly [number, number, number];
}

/**
 * `nivelBase`: nivel del grado 1 · `paso`: niveles entre grados · `tablaBase`: tabla de botín del grado 1 (las
 * siguientes avanzan de a `paso`) · moneda de cada grado = (nivel, 2·nivel + 1) con probabilidad `probMoneda`.
 */
export function gradosEnemigo(nivelBase: number, paso: number, cantidad: number, tablaBase: number, probMoneda = 0.5): Grado[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const nivel = nivelBase + paso * i;
    return { indice: i + 1, nivel, tablaBotin: tablaBase + paso * i, moneda: [nivel, 2 * nivel + 1, probMoneda] as const };
  });
}

/** El grado que corresponde a un nivel de zona (el más alto que no lo supera). */
export function gradoParaNivel(grados: readonly Grado[], nivelZona: number): Grado {
  let g = grados[0];
  for (const x of grados) if (x.nivel <= nivelZona) g = x;
  return g;
}

/** Giro de tono sugerido por grado (para variantes de color repartidas en la rueda). */
export const tonoDeGrado = (indice: number, cantidad: number): number => Math.round(((indice - 1) * 360) / Math.max(1, cantidad));
