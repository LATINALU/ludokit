// Composición de stats por capas: base + personaje + puntos + equipo (+ buffs, mascotas, runas, títulos...).
// Modelarlo como capas permite mostrar el desglose en la interfaz, agregar capas sin tocar la fórmula y
// reemplazar una capa entera (modo justo: todos con la misma capa de equipo).

export const STATS_ESTANDAR = [
  "golpe", "patada", "defensa", "hp", "mp", "habilidad", "habilidadNueva", "especial", "especialFinal", "agarre",
] as const;

export type Stat = (typeof STATS_ESTANDAR)[number];

export type Capa = Readonly<Partial<Record<string, number>>>;

export const BASE_ESTANDAR: Capa = {
  golpe: 200, patada: 200, defensa: 200, hp: 3500, mp: 200,
  habilidad: 200, habilidadNueva: 200, especial: 200, especialFinal: 200, agarre: 200,
};

export function componerStats(capas: readonly Capa[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const capa of capas) {
    for (const [stat, valor] of Object.entries(capa)) {
      if (valor !== undefined) {
        total[stat] = (total[stat] ?? 0) + valor;
      }
    }
  }
  return total;
}

/** Desglose por capa de un stat (para tooltips: "Golpe 540 = 200 base + 310 carta + 30 equipo"). */
export function desglose(capas: Readonly<Record<string, Capa>>, stat: string): { capa: string; valor: number }[] {
  return Object.entries(capas)
    .map(([capa, valores]) => ({ capa, valor: valores[stat] ?? 0 }))
    .filter((d) => d.valor !== 0);
}
