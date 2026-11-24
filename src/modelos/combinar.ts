// Combinar modelos: une módulos, géneros, datos y mecánicas, y mezcla las reglas EN PROFUNDIDAD (objetos planos se
// fusionan clave a clave; números, textos, arreglos y curvas se reemplazan). Cuando dos modelos definen la misma
// regla con valores distintos gana el último de la lista y queda registrado en `conflictos`, para que el diseñador
// decida conscientemente.

import type { Combinacion, Modelo } from "./tipos.ts";

const esObjetoPlano = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype && !("tipo" in v && typeof (v as { tipo: unknown }).tipo === "string");

function mezclar(dest: Record<string, unknown>, origen: Readonly<Record<string, unknown>>, modelo: string, ruta: string, quien: Map<string, string[]>, conflictos: Map<string, { modelos: string[]; ganador: string }>): void {
  for (const [k, v] of Object.entries(origen)) {
    const r = ruta ? `${ruta}.${k}` : k;
    const previo = dest[k];
    if (esObjetoPlano(v) && esObjetoPlano(previo)) {
      mezclar(previo, v, modelo, r, quien, conflictos);
      continue;
    }
    if (previo !== undefined && JSON.stringify(previo) !== JSON.stringify(v)) {
      const c = conflictos.get(r) ?? { modelos: [...(quien.get(r) ?? [])], ganador: modelo };
      if (!c.modelos.includes(modelo)) c.modelos.push(modelo);
      c.ganador = modelo;
      conflictos.set(r, c);
    }
    quien.set(r, [...(quien.get(r) ?? []), modelo]);
    dest[k] = esObjetoPlano(v) ? structuredClone(v) : v;
  }
}

const unir = (listas: ReadonlyArray<readonly string[] | undefined>): string[] => [...new Set(listas.flatMap((l) => l ?? []))];

/** Combina modelos en orden (los últimos pisan a los primeros). */
export function combinar(modelos: readonly Modelo[], nombre?: string): Combinacion {
  if (modelos.length === 0) throw new Error("combinar: hace falta al menos un modelo");
  const reglas: Record<string, unknown> = {};
  const quien = new Map<string, string[]>();
  const conflictos = new Map<string, { modelos: string[]; ganador: string }>();
  for (const m of modelos) mezclar(reglas, m.reglas as Record<string, unknown>, m.id, "", quien, conflictos);
  return {
    ids: modelos.map((m) => m.id),
    nombre: nombre ?? modelos.map((m) => m.nombre.replace(/^\+\s*/, "")).join(" + "),
    generos: unir(modelos.map((m) => m.generos)),
    modulos: unir(modelos.map((m) => m.modulos)).sort(),
    datos: unir(modelos.map((m) => m.datos)),
    mecanicas: unir(modelos.map((m) => m.mecanicas)),
    reglas,
    conflictos: [...conflictos].map(([ruta, c]) => ({ ruta, modelos: c.modelos, ganador: c.ganador })),
  };
}
