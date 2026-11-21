// Conjuntos de equipo (set bonuses): llevar N piezas del mismo conjunto activa bonos escalonados (2, 4, 6 piezas).
// Los bonos son modificadores para `Atributos` y efectos con nombre que interpreta el juego ("onda al patear").
// Incluye ENGARCES (ranuras para gemas/runas) y la fusión de 3 runas iguales en la de rareza siguiente.

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Modificador } from "../../combate/dominio/atributos.ts";

export interface BonoConjunto {
  readonly piezas: number;
  readonly texto: string;
  readonly mods?: readonly Omit<Modificador, "fuente">[];
  /** Efectos con nombre para el juego: { ondaAlPatear: 1, explotaAlMorir: 1 }. */
  readonly efectos?: Readonly<Record<string, number>>;
}

export interface DefConjunto {
  readonly id: string;
  readonly nombre: string;
  /** Clases que lo componen (para mostrar "3/6" y qué falta). */
  readonly clases: readonly string[];
  readonly bonos: readonly BonoConjunto[];
  /** Dónde cae (niveles, zonas): contenido para el generador de botín. */
  readonly dondeCae?: readonly number[];
}

export interface PiezaDeConjunto {
  readonly clase: string;
  readonly conjunto?: string;
}

export interface EstadoConjunto {
  readonly def: DefConjunto;
  readonly puestas: number;
  readonly activos: readonly BonoConjunto[];
  readonly siguiente: BonoConjunto | null;
  readonly faltan: readonly string[];
}

/** Cuenta piezas por conjunto (una por clase: dos anillos iguales cuentan si la clase aparece dos veces en `clases`). */
export function estadoConjuntos(equipadas: readonly PiezaDeConjunto[], defs: readonly DefConjunto[]): EstadoConjunto[] {
  const r: EstadoConjunto[] = [];
  for (const def of defs) {
    const delConjunto = equipadas.filter((p) => p.conjunto === def.id);
    if (delConjunto.length === 0) continue;
    const restantes = [...def.clases];
    let puestas = 0;
    for (const p of delConjunto) {
      const i = restantes.indexOf(p.clase);
      if (i >= 0) {
        restantes.splice(i, 1);
        puestas++;
      }
    }
    const ordenados = [...def.bonos].sort((a, b) => a.piezas - b.piezas);
    r.push({ def, puestas, activos: ordenados.filter((b) => b.piezas <= puestas), siguiente: ordenados.find((b) => b.piezas > puestas) ?? null, faltan: restantes });
  }
  return r;
}

/** Modificadores de todos los bonos activos (fuente = "conjunto:id:piezas", para quitarlos al cambiar equipo). */
export function modificadoresConjuntos(estados: readonly EstadoConjunto[]): Modificador[] {
  const r: Modificador[] = [];
  for (const e of estados) for (const b of e.activos) for (const m of b.mods ?? []) r.push({ ...m, fuente: `conjunto:${e.def.id}:${b.piezas}` });
  return r;
}

/** Efectos con nombre activos, sumados. */
export function efectosConjuntos(estados: readonly EstadoConjunto[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const e of estados) for (const b of e.activos) for (const [k, v] of Object.entries(b.efectos ?? {})) r[k] = (r[k] ?? 0) + v;
  return r;
}

// ---------------------------------------------------------------- Engarces y runas

export interface Runa {
  readonly id: string;
  readonly tipo: string;
  readonly rareza: number;
}

export type ErrorEngarce = "sin-ranura" | "ocupada" | "vacia" | "incompatible";

export class Engarces {
  readonly ranuras: (Runa | null)[];
  /** Tipos permitidos por ranura (null = cualquiera). */
  readonly tipos: (string | null)[];

  constructor(cantidad: number, tipos: (string | null)[] = []) {
    this.ranuras = Array(cantidad).fill(null);
    this.tipos = Array.from({ length: cantidad }, (_, i) => tipos[i] ?? null);
  }

  engarzar(i: number, r: Runa): Resultado<void, ErrorEngarce> {
    if (i < 0 || i >= this.ranuras.length) return fallo("sin-ranura");
    if (this.ranuras[i]) return fallo("ocupada");
    if (this.tipos[i] && this.tipos[i] !== r.tipo) return fallo("incompatible");
    this.ranuras[i] = r;
    return exito(undefined);
  }

  quitar(i: number): Resultado<Runa, ErrorEngarce> {
    const r = this.ranuras[i];
    if (r === undefined) return fallo("sin-ranura");
    if (!r) return fallo("vacia");
    this.ranuras[i] = null;
    return exito(r);
  }

  get puestas(): Runa[] {
    return this.ranuras.filter((r): r is Runa => r !== null);
  }
}

/** Costo de fundir 3 runas de cada rareza en una de la siguiente. */
export const COSTO_FUSION_RUNAS: readonly number[] = [60, 250, 900];

/** Tres runas iguales (mismo tipo y rareza) → una de rareza + 1. */
export function fundirRunas(tres: readonly [Runa, Runa, Runa], nuevoId: string, rarezaMax = COSTO_FUSION_RUNAS.length): Resultado<{ runa: Runa; costo: number }, "distintas" | "al-maximo"> {
  const [a, b, c] = tres;
  if (a.tipo !== b.tipo || a.tipo !== c.tipo || a.rareza !== b.rareza || a.rareza !== c.rareza) return fallo("distintas");
  if (a.rareza >= rarezaMax) return fallo("al-maximo");
  return exito({ runa: { id: nuevoId, tipo: a.tipo, rareza: a.rareza + 1 }, costo: COSTO_FUSION_RUNAS[a.rareza] });
}
