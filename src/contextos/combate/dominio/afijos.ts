// Afijos de desafío (modificadores de dificultad por nivel): un nivel de dificultad que escala
// vida y daño de los enemigos y suma afijos al alcanzar ciertos niveles. El sorteo es DETERMINISTA por semilla
// (misma sala + mismo nivel = mismos afijos, visibles antes de aceptar) y un contrarreloj sube o baja el nivel.

import { Pcg32 } from "../../../nucleo/pcg32.ts";

export interface DefAfijo {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** Nivel desde el que puede salir. */
  readonly desde: number;
  readonly mods?: Readonly<Record<string, number>>;
}

export const AFIJOS_EJEMPLO: readonly DefAfijo[] = [
  { id: "acorazado", nombre: "Acorazado", descripcion: "Los enemigos comunes tienen +30 % de vida y hacen +20 % de daño.", desde: 2, mods: { vidaComun: 0.3, danioComun: 0.2 } },
  { id: "soberano", nombre: "Soberano", descripcion: "Élites y jefes tienen +60 % de vida y hacen +30 % de daño.", desde: 2, mods: { vidaElite: 0.6, danioElite: 0.3 } },
  { id: "hermandad", nombre: "Hermandad", descripcion: "Al morir un enemigo, los demás ganan +12 % de vida y daño.", desde: 4 },
  { id: "desesperado", nombre: "Desesperado", descripcion: "Por debajo del 30 % de vida, los enemigos hacen +50 % de daño.", desde: 4 },
  { id: "rastro", nombre: "Rastro corrosivo", descripcion: "Al morir dejan un charco que daña.", desde: 4 },
  { id: "grietas", nombre: "Suelo inestable", descripcion: "Cada pocos segundos se abre una grieta bajo tus pies.", desde: 5 },
  { id: "detonante", nombre: "Detonante", descripcion: "Al morir estallan tras un instante.", desde: 5 },
  { id: "acecho", nombre: "Acecho", descripcion: "Entre oleadas se suman cazadores voladores.", desde: 5 },
];

/** Niveles en los que se gana un afijo más. */
export const UMBRALES_AFIJOS: readonly number[] = [2, 4, 7, 10];

/** Escala de vida y daño de los enemigos por nivel de desafío (+9 % por nivel). */
export const escalaDesafio = (nivel: number, porNivel = 0.09): number => 1 + porNivel * Math.max(0, nivel);

/** Afijos de una sala para un nivel: sin repetir, deterministas por semilla. */
export function sortearAfijos(semilla: number, nivel: number, lista: readonly DefAfijo[] = AFIJOS_EJEMPLO, umbrales: readonly number[] = UMBRALES_AFIJOS): DefAfijo[] {
  const cantidad = umbrales.filter((u) => nivel >= u).length;
  const az = new Pcg32(semilla * 1000 + nivel);
  const pool = lista.filter((a) => a.desde <= nivel);
  const r: DefAfijo[] = [];
  while (r.length < cantidad && pool.length > 0) r.push(pool.splice(az.rango(0, pool.length - 1), 1)[0]);
  return r;
}

/** Contrarreloj: tiempo total para N oleadas. */
export const tiempoDesafio = (oleadas: number, nivel: number, base = 80, porOleada = 40): number => base + oleadas * (porOleada + (nivel >= 10 ? 10 : 0));

/** Cambio del nivel según el tiempo sobrante: +3 (≥40 %), +2 (≥20 %), +1 a tiempo, −1 tarde. */
export function cambioDeNivel(sobrante: number, total: number): number {
  if (sobrante <= 0) return -1;
  const f = sobrante / total;
  return f >= 0.4 ? 3 : f >= 0.2 ? 2 : 1;
}
