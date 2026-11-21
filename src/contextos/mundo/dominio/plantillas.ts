// Plantillas de salas hechas a mano + procedimiento: el diseñador dibuja salas en ASCII con una LEYENDA (tiles y
// marcadores de aparición: enemigos, cofres, antorchas, jefe), y el generador elige una que sea compatible con las
// aberturas que pide el mapa, la espeja al azar y extrae los marcadores. Mezcla lo mejor de los dos mundos: salas
// con diseño y variedad infinita.

import type { Azar } from "../../../nucleo/azar.ts";
import { Celda, Grilla } from "../../fisica/dominio/grilla.ts";

export interface Plantilla {
  readonly id: string;
  readonly filas: readonly string[];
  /** Aberturas que la plantilla soporta (deben coincidir con las del mapa). */
  readonly aberturas: readonly ("izq" | "der" | "arr" | "aba")[];
  readonly peso?: number;
  readonly etiquetas?: readonly string[];
}

/** Leyenda: carácter → tile, o carácter → marcador (el tile queda vacío). */
export interface Leyenda {
  readonly tiles: Readonly<Record<string, Celda>>;
  readonly marcadores: Readonly<Record<string, string>>;
}

export const LEYENDA_ESTANDAR: Leyenda = {
  tiles: { "#": Celda.ROCA, "=": Celda.PLATAFORMA, "^": Celda.PINCHOS },
  marcadores: { E: "enemigo", V: "volador", C: "cofre", T: "antorcha", J: "jefe", P: "jugador", O: "objeto" },
};

export interface Marcador {
  readonly tipo: string;
  readonly c: number;
  readonly f: number;
}

export interface SalaDePlantilla {
  readonly plantilla: string;
  readonly espejada: boolean;
  readonly grilla: Grilla;
  readonly marcadores: readonly Marcador[];
}

const ESPEJO: Readonly<Record<string, "izq" | "der" | "arr" | "aba">> = { izq: "der", der: "izq", arr: "arr", aba: "aba" };

/** Valida que todas las filas tengan el mismo ancho y que los caracteres estén en la leyenda. */
export function validarPlantilla(p: Plantilla, l: Leyenda = LEYENDA_ESTANDAR): string[] {
  const e: string[] = [];
  const w = p.filas[0]?.length ?? 0;
  p.filas.forEach((f, i) => {
    if (f.length !== w) e.push(`${p.id}: fila ${i} mide ${f.length}, se esperaba ${w}`);
    for (const ch of f) if (ch !== "." && ch !== " " && !(ch in l.tiles) && !(ch in l.marcadores)) e.push(`${p.id}: carácter desconocido "${ch}" en fila ${i}`);
  });
  return e;
}

/** Construye una sala desde una plantilla (opcionalmente espejada en horizontal). */
export function construirDesdePlantilla(p: Plantilla, espejar: boolean, l: Leyenda = LEYENDA_ESTANDAR, tile = 16): SalaDePlantilla {
  const filas = espejar ? p.filas.map((f) => [...f].reverse().join("")) : p.filas;
  const g = new Grilla(filas[0].length, filas.length, tile);
  const marcadores: Marcador[] = [];
  filas.forEach((fila, f) => [...fila].forEach((ch, c) => {
    if (ch in l.tiles) g.poner(c, f, l.tiles[ch]);
    else if (ch in l.marcadores) marcadores.push({ tipo: l.marcadores[ch], c, f });
  }));
  return { plantilla: p.id, espejada: espejar, grilla: g, marcadores };
}

/** Elige una plantilla compatible con las aberturas pedidas (probando también su versión espejada). */
export function elegirPlantilla(azar: Azar, plantillas: readonly Plantilla[], aberturas: readonly string[], etiqueta?: string, l: Leyenda = LEYENDA_ESTANDAR): SalaDePlantilla | null {
  const pedidas = [...aberturas].sort().join();
  const opciones: Array<{ p: Plantilla; espejar: boolean }> = [];
  for (const p of plantillas) {
    if (etiqueta && !(p.etiquetas ?? []).includes(etiqueta)) continue;
    if ([...p.aberturas].sort().join() === pedidas) opciones.push({ p, espejar: false });
    if ([...p.aberturas].map((a) => ESPEJO[a]).sort().join() === pedidas) opciones.push({ p, espejar: true });
  }
  if (opciones.length === 0) return null;
  const total = opciones.reduce((s, o) => s + (o.p.peso ?? 1), 0);
  let r = azar.siguiente() * total;
  let e = opciones[opciones.length - 1];
  for (const o of opciones) {
    r -= o.p.peso ?? 1;
    if (r < 0) {
      e = o;
      break;
    }
  }
  return construirDesdePlantilla(e.p, e.espejar, l);
}
