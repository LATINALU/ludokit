// Generador de mazmorras como GRAFO de salas en una grilla, con llave y cerradura (metroidvania, roguelite,
// zelda-like). Pasos:
//   1. Crece un árbol desde el inicio con pesos de dirección (p. ej. "tiende a bajar") y preferencia por crecer
//      desde las salas recientes (pasillos largos = más exploración).
//   2. Agrega atajos (ciclos) entre vecinas para que no todo sea ida y vuelta.
//   3. Ubica salas especiales: jefe en la hoja más lejana, llave en una sala media, tesoros en hojas, etc.
//   4. Pone CERRADURAS en conexiones, solo de llaves que el jugador ya tiene o que se colocan en este nivel.
//   5. VALIDA por punto fijo (explorar, juntar llaves alcanzables, repetir): si no se puede llegar a lo obligatorio,
//      reintenta; como último recurso genera sin cerraduras. Siempre devuelve un mapa jugable.

import { Pcg32 } from "../../../nucleo/pcg32.ts";

export type Dir = "izq" | "der" | "arr" | "aba";
export const OPUESTA: Readonly<Record<Dir, Dir>> = { izq: "der", der: "izq", arr: "aba", aba: "arr" };
const DELTA: Readonly<Record<Dir, readonly [number, number]>> = { izq: [-1, 0], der: [1, 0], arr: [0, -1], aba: [0, 1] };

export interface SalaMapa {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  tipo: string;
  readonly semilla: number;
  llave?: string;
}

export interface Conexion {
  readonly a: number;
  readonly b: number;
  /** Dirección de a hacia b. */
  readonly dir: Dir;
  cerradura?: string;
}

export interface MapaMazmorra {
  readonly ancho: number;
  readonly alto: number;
  readonly salas: SalaMapa[];
  readonly conexiones: Conexion[];
  readonly inicio: number;
  readonly jefe: number;
  readonly especiales: Record<string, number[]>;
}

export interface Especial {
  readonly tipo: string;
  readonly cantidad: number;
  /** Dónde: "hoja" (callejón), "medio" (entre inicio y jefe), "lejos" (dist ≥ 2), "cualquiera". */
  readonly donde: "hoja" | "medio" | "lejos" | "cualquiera";
}

export interface OpcionesMazmorra {
  readonly salas: number;
  readonly semilla: number;
  readonly ancho?: number;
  readonly alto?: number;
  /** Pesos de dirección de crecimiento. */
  readonly pesos?: Readonly<Partial<Record<Dir, number>>>;
  /** Probabilidad de atajo entre vecinas. */
  readonly atajos?: number;
  readonly especiales?: readonly Especial[];
  /** Cerradura → llave que la abre. */
  readonly cerraduras?: Readonly<Record<string, string>>;
  /** Llaves que el jugador ya tiene. */
  readonly llavesPoseidas?: readonly string[];
  /** Llave que se coloca en este nivel (en una sala "medio"). */
  readonly llaveAColocar?: string;
  readonly probCerradura?: number;
  /** Solo en conexiones laterales (útil si las verticales son escaleras). */
  readonly cerradurasSoloLaterales?: boolean;
}

/** Grilla recomendada: ~2,5 celdas por sala, más ancha que alta. */
export function dimensiones(salas: number): { ancho: number; alto: number } {
  const celdas = salas * 2.5;
  const ancho = Math.max(7, Math.ceil(Math.sqrt(celdas * 1.4)));
  return { ancho, alto: Math.max(5, Math.ceil(celdas / ancho)) };
}

export function vecinos(m: MapaMazmorra, sala: number): Array<{ sala: number; dir: Dir; conexion: Conexion }> {
  const r: Array<{ sala: number; dir: Dir; conexion: Conexion }> = [];
  for (const c of m.conexiones) {
    if (c.a === sala) r.push({ sala: c.b, dir: c.dir, conexion: c });
    else if (c.b === sala) r.push({ sala: c.a, dir: OPUESTA[c.dir], conexion: c });
  }
  return r;
}

export function alcanzables(m: MapaMazmorra, desde: number, llaves: ReadonlySet<string>, cerraduras: Readonly<Record<string, string>>): Set<number> {
  const vistos = new Set([desde]);
  const cola = [desde];
  while (cola.length) {
    const s = cola.shift()!;
    for (const v of vecinos(m, s)) {
      const c = v.conexion.cerradura;
      if (vistos.has(v.sala) || (c !== undefined && !llaves.has(cerraduras[c]))) continue;
      vistos.add(v.sala);
      cola.push(v.sala);
    }
  }
  return vistos;
}

/** Punto fijo: explora, junta las llaves alcanzables, repite hasta que no aparezcan nuevas. */
export function resolver(m: MapaMazmorra, iniciales: readonly string[], cerraduras: Readonly<Record<string, string>>): { alcanzables: Set<number>; llaves: Set<string> } {
  const llaves = new Set(iniciales);
  for (;;) {
    const alc = alcanzables(m, m.inicio, llaves, cerraduras);
    let nueva = false;
    for (const id of alc) {
      const k = m.salas[id].llave;
      if (k && !llaves.has(k)) {
        llaves.add(k);
        nueva = true;
      }
    }
    if (!nueva) return { alcanzables: alc, llaves };
  }
}

export function esValido(m: MapaMazmorra, iniciales: readonly string[], cerraduras: Readonly<Record<string, string>>, obligatorios: readonly string[] = []): boolean {
  const { alcanzables: alc } = resolver(m, iniciales, cerraduras);
  if (!alc.has(m.jefe)) return false;
  for (const s of m.salas) if ((s.llave || obligatorios.includes(s.tipo)) && !alc.has(s.id)) return false;
  return true;
}

export function distancias(salas: readonly SalaMapa[], conexiones: readonly Conexion[], inicio: number): number[] {
  const d = salas.map(() => Infinity);
  d[inicio] = 0;
  const cola = [inicio];
  while (cola.length) {
    const a = cola.shift()!;
    for (const c of conexiones) {
      const b = c.a === a ? c.b : c.b === a ? c.a : -1;
      if (b >= 0 && d[b] === Infinity) {
        d[b] = d[a] + 1;
        cola.push(b);
      }
    }
  }
  return d;
}

function intentar(az: Pcg32, o: OpcionesMazmorra, conCerraduras: boolean): MapaMazmorra {
  const dim = o.ancho && o.alto ? { ancho: o.ancho, alto: o.alto } : dimensiones(o.salas);
  const grilla = new Map<number, number>();
  const salas: SalaMapa[] = [];
  const conexiones: Conexion[] = [];
  const agregar = (x: number, y: number): number => {
    const id = salas.length;
    salas.push({ id, x, y, tipo: "normal", semilla: az.u32() & 0x7fffffff });
    grilla.set(y * dim.ancho + x, id);
    return id;
  };
  const inicio = agregar(Math.floor(dim.ancho / 2), 0);
  const pesos = Object.entries({ aba: 1.1, izq: 1.3, der: 1.3, arr: 0.35, ...o.pesos }).filter(([, w]) => (w ?? 0) > 0) as Array<[Dir, number]>;
  const total = pesos.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; salas.length < o.salas && i < 4000; i++) {
    const desde = salas[Math.max(0, salas.length - 1 - az.rango(0, Math.min(salas.length, 4) - 1))];
    let r = az.siguiente() * total;
    let dir: Dir = pesos[0][0];
    for (const [d, w] of pesos) {
      r -= w;
      if (r < 0) {
        dir = d;
        break;
      }
    }
    const [dx, dy] = DELTA[dir];
    const x = desde.x + dx, y = desde.y + dy;
    if (x < 0 || y < 0 || x >= dim.ancho || y >= dim.alto || grilla.has(y * dim.ancho + x)) continue;
    conexiones.push({ a: desde.id, b: agregar(x, y), dir });
  }
  for (const s of salas) {
    for (const dir of ["der", "aba"] as const) {
      const [dx, dy] = DELTA[dir];
      const otro = grilla.get((s.y + dy) * dim.ancho + s.x + dx);
      if (otro === undefined || s.x + dx >= dim.ancho) continue;
      const existe = conexiones.some((c) => (c.a === s.id && c.b === otro) || (c.a === otro && c.b === s.id));
      if (!existe && az.prob(o.atajos ?? 0.2)) conexiones.push({ a: s.id, b: otro, dir });
    }
  }
  const dist = distancias(salas, conexiones, inicio);
  const grado = (id: number): number => conexiones.filter((c) => c.a === id || c.b === id).length;
  const hojas = salas.filter((s) => s.id !== inicio && grado(s.id) === 1).sort((a, b) => dist[b.id] - dist[a.id]);
  const porDist = salas.filter((s) => s.id !== inicio).sort((a, b) => dist[b.id] - dist[a.id]);
  const jefe = (hojas[0] ?? porDist[0] ?? salas[inicio]).id;
  salas[inicio].tipo = "inicio";
  salas[jefe].tipo = "jefe";
  const especiales: Record<string, number[]> = {};
  const tomar = (pref: SalaMapa[]): SalaMapa | null => {
    const libres = pref.filter((s) => s.tipo === "normal");
    if (libres.length) return libres[az.rango(0, libres.length - 1)];
    const resto = salas.filter((s) => s.tipo === "normal");
    return resto.length ? resto[az.rango(0, resto.length - 1)] : null;
  };
  if (o.llaveAColocar) {
    const s = tomar(salas.filter((x) => dist[x.id] >= 2 && dist[x.id] <= dist[jefe] - 1));
    if (s) {
      s.tipo = "llave";
      s.llave = o.llaveAColocar;
      especiales.llave = [s.id];
    }
  }
  for (const e of o.especiales ?? []) {
    for (let k = 0; k < e.cantidad; k++) {
      const pref = e.donde === "hoja" ? hojas : e.donde === "medio" ? salas.filter((x) => dist[x.id] >= 2 && dist[x.id] < dist[jefe]) : e.donde === "lejos" ? salas.filter((x) => dist[x.id] >= 2) : salas;
      const s = tomar(pref);
      if (!s) break;
      s.tipo = e.tipo;
      (especiales[e.tipo] ??= []).push(s.id);
    }
  }
  if (conCerraduras && o.cerraduras) {
    const poseidas = new Set(o.llavesPoseidas ?? []);
    const tipos = Object.entries(o.cerraduras).filter(([, llave]) => poseidas.has(llave) || llave === o.llaveAColocar).map(([c]) => c);
    if (tipos.length) {
      for (const c of conexiones) {
        if (o.cerradurasSoloLaterales !== false && (c.dir === "arr" || c.dir === "aba")) continue;
        if (c.a === inicio || c.b === inicio) continue;
        if (az.prob(o.probCerradura ?? 0.3)) c.cerradura = tipos[az.rango(0, tipos.length - 1)];
      }
    }
  }
  return { ancho: dim.ancho, alto: dim.alto, salas, conexiones, inicio, jefe, especiales };
}

/** Genera un mapa válido (reintenta hasta 60 veces; si no, sin cerraduras). */
export function generarMazmorra(o: OpcionesMazmorra): MapaMazmorra {
  const az = new Pcg32(o.semilla);
  const obligatorios = (o.especiales ?? []).map((e) => e.tipo);
  for (let i = 0; i < 60; i++) {
    const m = intentar(az, o, true);
    if (m.salas.length >= Math.min(o.salas, 6) && esValido(m, o.llavesPoseidas ?? [], o.cerraduras ?? {}, obligatorios)) return m;
  }
  return intentar(az, o, false);
}

/** Aberturas de una sala: dir → {destino, cerradura?} (para construir su interior). */
export function aberturas(m: MapaMazmorra, sala: number): Partial<Record<Dir, { destino: number; cerradura?: string }>> {
  const r: Partial<Record<Dir, { destino: number; cerradura?: string }>> = {};
  for (const v of vecinos(m, sala)) r[v.dir] = { destino: v.sala, cerradura: v.conexion.cerradura };
  return r;
}
