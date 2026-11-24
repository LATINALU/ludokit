// Control de masas (CC) con RENDIMIENTOS DECRECIENTES y TENACIDAD, y selección de OBJETIVO.
//
// Rendimientos decrecientes (MMO/MOBA/PvP): aplicar el mismo tipo de control seguido dura cada vez menos
// (100 % → 50 % → 25 % → inmune) y la cuenta se reinicia tras N segundos sin recibir ese tipo. La tenacidad
// (MOBA) reduce la duración de todo control en un porcentaje. Las categorías las define el juego ("aturdir",
// "raiz", "silencio", "miedo"...).
//
// Selección de objetivo:
//   - tab-target: el más alineado con la mirada dentro de un cono y alcance; tab sucesivos ciclan por distancia;
//   - prioridad de torre/defensa (MOBA, tower defense): reglas en orden ("ataca a un campeón aliado" > "súbdito
//     más cercano" > ...), "primero en el camino", "más fuerte", "menos vida".

export interface ReglasRendimiento {
  /** Multiplicador de duración por aplicación seguida: [1, 0.5, 0.25] → la 4.ª es inmune. */
  readonly escalones: readonly number[];
  /** Segundos sin recibir esa categoría para reiniciar. */
  readonly reinicio: number;
  /** Categorías sin rendimiento decreciente (p. ej. "empuje"). */
  readonly exentas?: readonly string[];
}

export class RendimientosDecrecientes {
  readonly reglas: ReglasRendimiento;
  private readonly estado = new Map<string, { veces: number; desde: number }>();

  constructor(reglas: ReglasRendimiento) {
    this.reglas = reglas;
  }

  /** Duración efectiva de un control. `tenacidad` 0..1 (0.3 = −30 %). 0 = inmune. */
  aplicar(categoria: string, duracion: number, tenacidad = 0): number {
    const base = duracion * (1 - Math.min(0.95, Math.max(0, tenacidad)));
    if (this.reglas.exentas?.includes(categoria)) return base;
    const e = this.estado.get(categoria) ?? { veces: 0, desde: 0 };
    const mult = e.veces < this.reglas.escalones.length ? this.reglas.escalones[e.veces] : 0;
    this.estado.set(categoria, { veces: e.veces + 1, desde: 0 });
    return base * mult;
  }

  /** Escalón en el que está una categoría (0 = completo). */
  escalon(categoria: string): number {
    return this.estado.get(categoria)?.veces ?? 0;
  }

  actualizar(dt: number): void {
    for (const [k, e] of this.estado) {
      e.desde += dt;
      if (e.desde >= this.reglas.reinicio) this.estado.delete(k);
    }
  }
}

// ---------------------------------------------------------------- Objetivos

export interface Candidato {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vida?: number;
  readonly vidaMax?: number;
  /** Progreso en el camino (tower defense): mayor = más cerca de la meta. */
  readonly progreso?: number;
  readonly amenaza?: number;
  readonly etiquetas?: readonly string[];
  /** A quién está atacando (para "ataca a un aliado"). */
  readonly atacandoA?: number;
}

export type ReglaPrioridad =
  | { readonly tipo: "atacaA"; readonly ids: readonly number[] }
  | { readonly tipo: "etiqueta"; readonly etiqueta: string }
  | { readonly tipo: "cercano" }
  | { readonly tipo: "lejano" }
  | { readonly tipo: "menosVida" }
  | { readonly tipo: "masVida" }
  | { readonly tipo: "primero" }
  | { readonly tipo: "ultimo" }
  | { readonly tipo: "amenaza" };

/**
 * Elige objetivo dentro de `alcance` con una lista de reglas en orden: las reglas de filtro (atacaA, etiqueta)
 * reducen el grupo si alguno cumple; la primera regla de orden decide. `actual`: se mantiene si sigue siendo válido
 * y `pegajoso` (las torres no cambian de objetivo a cada rato).
 */
export function elegirObjetivo(desde: { x: number; y: number }, alcance: number, candidatos: readonly Candidato[], reglas: readonly ReglaPrioridad[], actual?: number, pegajoso = false): Candidato | null {
  const d2 = (c: Candidato): number => (c.x - desde.x) ** 2 + (c.y - desde.y) ** 2;
  let grupo = candidatos.filter((c) => d2(c) <= alcance * alcance);
  if (grupo.length === 0) return null;
  if (pegajoso && actual !== undefined) {
    const sigue = grupo.find((c) => c.id === actual);
    if (sigue) return sigue;
  }
  for (const r of reglas) {
    if (r.tipo === "atacaA") {
      const f = grupo.filter((c) => c.atacandoA !== undefined && r.ids.includes(c.atacandoA));
      if (f.length) grupo = f;
      continue;
    }
    if (r.tipo === "etiqueta") {
      const f = grupo.filter((c) => c.etiquetas?.includes(r.etiqueta));
      if (f.length) grupo = f;
      continue;
    }
    const clave: (c: Candidato) => number =
      r.tipo === "cercano" ? d2 : r.tipo === "lejano" ? (c) => -d2(c)
      : r.tipo === "menosVida" ? (c) => c.vida ?? Infinity : r.tipo === "masVida" ? (c) => -(c.vida ?? 0)
      : r.tipo === "primero" ? (c) => -(c.progreso ?? 0) : r.tipo === "ultimo" ? (c) => c.progreso ?? 0
      : (c) => -(c.amenaza ?? 0);
    return [...grupo].sort((a, b) => clave(a) - clave(b) || a.id - b.id)[0];
  }
  return [...grupo].sort((a, b) => d2(a) - d2(b) || a.id - b.id)[0];
}

/**
 * Tab-target: candidatos dentro del cono de la mirada (`dir` en radianes, `cono` semiapertura) ordenados por
 * distancia; `previo` hace ciclar al siguiente.
 */
export function tabObjetivo(desde: { x: number; y: number }, dir: number, cono: number, alcance: number, candidatos: readonly Candidato[], previo?: number): Candidato | null {
  const dentro = candidatos
    .map((c) => ({ c, d: Math.hypot(c.x - desde.x, c.y - desde.y), a: Math.atan2(c.y - desde.y, c.x - desde.x) }))
    .filter(({ d, a }) => d <= alcance && Math.abs(Math.atan2(Math.sin(a - dir), Math.cos(a - dir))) <= cono)
    .sort((x, y) => x.d - y.d || x.c.id - y.c.id);
  if (dentro.length === 0) return null;
  const i = previo === undefined ? -1 : dentro.findIndex((x) => x.c.id === previo);
  return dentro[(i + 1) % dentro.length].c;
}
