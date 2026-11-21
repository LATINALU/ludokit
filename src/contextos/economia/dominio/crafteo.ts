// Crafteo y templado:
//   - RECETAS: ingredientes (objeto × cantidad) + moneda → resultado (objeto o "equipo" que genera el juego).
//     Todo o nada: se verifica TODO antes de tocar nada; si el resultado no entra, no se consume nada.
//   - TEMPLADO de equipo que NUNCA falla (la frustración de perder una pieza no aporta), con elección a partir de
//     cierto nivel: SEGURO (caro) o con RIESGO (barato, pero sella un PACTO: un bono grande y una maldición).

import type { Azar } from "../../../nucleo/azar.ts";
import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Inventario } from "../../inventario/dominio/inventario.ts";
import type { Billetera } from "./billetera.ts";

export interface Receta {
  readonly id: string;
  readonly ingredientes: ReadonlyArray<readonly [objeto: number, cantidad: number]>;
  readonly costo?: { readonly moneda: string; readonly monto: number };
  /** Objeto que da (si es equipo generado, el juego lo resuelve con `resolverEquipo`). */
  readonly resultado: { readonly objeto: number; readonly cantidad: number } | { readonly equipo: string };
  readonly nivelMin?: number;
}

export type ErrorCrafteo = "faltan-ingredientes" | "sin-fondos" | "sin-espacio" | "nivel";

export interface Faltante {
  readonly objeto: number;
  readonly tiene: number;
  readonly necesita: number;
}

/** Qué falta para una receta (para la interfaz). */
export function faltantes(r: Receta, inv: Inventario): Faltante[] {
  return r.ingredientes.map(([o, n]) => ({ objeto: o, tiene: inv.contar(o), necesita: n })).filter((f) => f.tiene < f.necesita);
}

/** Cuántas veces se puede craftear con lo que hay. */
export function vecesPosibles(r: Receta, inv: Inventario, billetera?: Billetera): number {
  let n = Infinity;
  for (const [o, c] of r.ingredientes) n = Math.min(n, Math.floor(inv.contar(o) / c));
  if (r.costo && billetera) n = Math.min(n, Math.floor(billetera.saldo(r.costo.moneda) / r.costo.monto));
  return Number.isFinite(n) ? n : 0;
}

export function craftear<E>(r: Receta, inv: Inventario, billetera: Billetera, op: { nivel?: number; resolverEquipo?: (clase: string) => E } = {}): Resultado<{ objeto?: number; cantidad?: number; equipo?: E }, ErrorCrafteo> {
  if ((op.nivel ?? Infinity) < (r.nivelMin ?? 0)) return fallo("nivel");
  if (faltantes(r, inv).length > 0) return fallo("faltan-ingredientes");
  if (r.costo && billetera.saldo(r.costo.moneda) < r.costo.monto) return fallo("sin-fondos");
  // Simular en una copia: si el resultado no entra después de sacar los ingredientes, no se toca nada.
  const prueba = inv.clonar();
  for (const [o, c] of r.ingredientes) prueba.quitar(o, c);
  if ("objeto" in r.resultado && prueba.capacidadPara(r.resultado.objeto) < r.resultado.cantidad) return fallo("sin-espacio");
  for (const [o, c] of r.ingredientes) inv.quitar(o, c);
  if (r.costo) billetera.debitar(r.costo.moneda, r.costo.monto);
  if ("objeto" in r.resultado) {
    inv.agregar(r.resultado.objeto, r.resultado.cantidad);
    return exito({ objeto: r.resultado.objeto, cantidad: r.resultado.cantidad });
  }
  if (!op.resolverEquipo) throw new Error(`Receta ${r.id}: falta resolverEquipo`);
  return exito({ equipo: op.resolverEquipo(r.resultado.equipo) });
}

// ---------------------------------------------------------------- Templado

export interface Pacto {
  readonly id: string;
  readonly nombre: string;
  readonly bono: Readonly<Record<string, number>>;
  readonly maldicion: Readonly<Record<string, number>>;
}

export const PACTOS_EJEMPLO: readonly Pacto[] = [
  { id: "hambre", nombre: "Filo hambriento", bono: { danioCritico: 0.4 }, maldicion: { danioRecibido: 0.15 } },
  { id: "cristal", nombre: "Cristal roto", bono: { danio: 0.3 }, maldicion: { danioRecibido: 0.25 } },
  { id: "frio", nombre: "Sangre fría", bono: { velocidadAtaque: 0.15 }, maldicion: { vida: -0.12 } },
  { id: "sed", nombre: "Sed antigua", bono: { roboVida: 0.05 }, maldicion: { curacion: -0.4 } },
  { id: "lengua", nombre: "Lengua de fuego", bono: { danioHabilidad: 0.3 }, maldicion: { costoHabilidad: 0.25 } },
];

export type ModoTemplado = "normal" | "seguro" | "riesgo";

export interface ReglasTemplado {
  readonly maximo: number;
  /** Desde este nivel se elige modo (antes, siempre "normal"). */
  readonly nivelEleccion: number;
}

export const REGLAS_TEMPLADO: ReglasTemplado = { maximo: 10, nivelEleccion: 5 };

/** Costo del siguiente grado: materiales y moneda según nivel y modo. */
export function costoTemplado(nivelActual: number, modo: ModoTemplado, r: ReglasTemplado = REGLAS_TEMPLADO): { materiales: number; moneda: number } {
  const base = { materiales: 1 + Math.floor(nivelActual / 2), moneda: 50 * (nivelActual + 1) * (nivelActual >= r.nivelEleccion ? 2 : 1) };
  if (nivelActual < r.nivelEleccion || modo === "normal") return base;
  if (modo === "seguro") return { materiales: base.materiales * 2, moneda: base.moneda * 3 };
  return { materiales: Math.max(1, Math.ceil(base.materiales / 2)), moneda: Math.ceil(base.moneda / 2) };
}

/** Templar: siempre sube. En modo riesgo sella un pacto que la pieza aún no tenga. */
export function templar(nivelActual: number, modo: ModoTemplado, pactosPrevios: readonly string[], azar: Azar, pactos: readonly Pacto[] = PACTOS_EJEMPLO, r: ReglasTemplado = REGLAS_TEMPLADO): Resultado<{ nivel: number; pacto: Pacto | null }, "al-maximo"> {
  if (nivelActual >= r.maximo) return fallo("al-maximo");
  let pacto: Pacto | null = null;
  if (modo === "riesgo" && nivelActual >= r.nivelEleccion) {
    const libres = pactos.filter((p) => !pactosPrevios.includes(p.id));
    if (libres.length) pacto = libres[Math.floor(azar.siguiente() * libres.length)];
  }
  return exito({ nivel: nivelActual + 1, pacto });
}

/** Suma bonos y maldiciones de una lista de pactos (`atenuar`: maldiciones a la mitad y bonos +25 %). */
export function sumarPactos(ids: readonly string[], pactos: readonly Pacto[] = PACTOS_EJEMPLO, atenuar = false): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of ids) {
    const p = pactos.find((x) => x.id === id);
    if (!p) continue;
    for (const [k, v] of Object.entries(p.bono)) r[k] = (r[k] ?? 0) + v * (atenuar ? 1.25 : 1);
    for (const [k, v] of Object.entries(p.maldicion)) r[k] = (r[k] ?? 0) + v * (atenuar ? 0.5 : 1);
  }
  return r;
}
