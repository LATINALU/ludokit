// Búsqueda de caminos A* sobre grilla (4 u 8 direcciones) con montículo binario, costo por celda (barro, agua),
// prohibición de cortar esquinas en diagonal, límite de nodos expandidos y suavizado por línea de visión.
// El grafo es genérico (`Grafo`): sirve igual para tiles, nodos de navegación o mapas de un juego de estrategia.

export class MonticuloMin<T> {
  private readonly items: T[] = [];
  private readonly prio: number[] = [];

  get tamano(): number {
    return this.items.length;
  }

  meter(v: T, p: number): void {
    this.items.push(v);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (this.prio[padre] <= this.prio[i]) break;
      this.cambiar(i, padre);
      i = padre;
    }
  }

  sacar(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const ultimoV = this.items.pop()!;
    const ultimoP = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = ultimoV;
      this.prio[0] = ultimoP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.items.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.cambiar(i, m);
        i = m;
      }
    }
    return top;
  }

  private cambiar(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

export interface Grafo<N> {
  clave(n: N): string | number;
  vecinos(n: N): Iterable<readonly [N, number]>;
  heuristica(a: N, b: N): number;
}

export interface OpcionesBusqueda {
  readonly maxNodos?: number;
}

/** A* genérico. Devuelve el camino [inicio..meta] o null. */
export function aEstrella<N>(g: Grafo<N>, inicio: N, meta: N, op: OpcionesBusqueda = {}): N[] | null {
  const max = op.maxNodos ?? 20000;
  const abiertos = new MonticuloMin<N>();
  const costo = new Map<string | number, number>();
  const vino = new Map<string | number, N>();
  const cerrados = new Set<string | number>();
  const km = g.clave(meta);
  costo.set(g.clave(inicio), 0);
  abiertos.meter(inicio, g.heuristica(inicio, meta));
  let expandidos = 0;
  while (abiertos.tamano > 0) {
    const n = abiertos.sacar()!;
    const k = g.clave(n);
    if (k === km) {
      const camino = [n];
      let c = k;
      while (vino.has(c)) {
        const p = vino.get(c)!;
        camino.push(p);
        c = g.clave(p);
      }
      return camino.reverse();
    }
    if (cerrados.has(k)) continue;
    cerrados.add(k);
    if (++expandidos > max) return null;
    const base = costo.get(k)!;
    for (const [v, w] of g.vecinos(n)) {
      const kv = g.clave(v);
      if (cerrados.has(kv)) continue;
      const nuevo = base + w;
      if (nuevo < (costo.get(kv) ?? Infinity)) {
        costo.set(kv, nuevo);
        vino.set(kv, n);
        abiertos.meter(v, nuevo + g.heuristica(v, meta));
      }
    }
  }
  return null;
}

export type Celda2 = readonly [number, number];

export interface OpcionesGrilla {
  readonly cols: number;
  readonly filas: number;
  /** Costo de entrar a la celda; Infinity o <= 0 = bloqueada. */
  readonly costo: (c: number, f: number) => number;
  readonly diagonal?: boolean;
}

const RAIZ2 = Math.SQRT2;

/** Grafo de grilla listo para `aEstrella`. Heurística octil (8 dir) o Manhattan (4 dir), ambas admisibles. */
export function grafoGrilla(o: OpcionesGrilla): Grafo<Celda2> {
  const libre = (c: number, f: number): boolean => {
    if (c < 0 || f < 0 || c >= o.cols || f >= o.filas) return false;
    const k = o.costo(c, f);
    return k > 0 && Number.isFinite(k);
  };
  return {
    clave: ([c, f]) => f * o.cols + c,
    *vecinos([c, f]) {
      for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (libre(c + dc, f + df)) yield [[c + dc, f + df], o.costo(c + dc, f + df)] as const;
      }
      if (o.diagonal) {
        for (const [dc, df] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
          // Sin cortar esquinas: las dos ortogonales tienen que estar libres.
          if (libre(c + dc, f + df) && libre(c + dc, f) && libre(c, f + df)) yield [[c + dc, f + df], o.costo(c + dc, f + df) * RAIZ2] as const;
        }
      }
    },
    heuristica: ([c1, f1], [c2, f2]) => {
      const dx = Math.abs(c1 - c2), dy = Math.abs(f1 - f2);
      return o.diagonal ? dx + dy + (RAIZ2 - 2) * Math.min(dx, dy) : dx + dy;
    },
  };
}

/** Quita puntos intermedios mientras haya línea de visión (caminos naturales, menos zig-zag). */
export function suavizarCamino(camino: readonly Celda2[], vision: (a: Celda2, b: Celda2) => boolean): Celda2[] {
  if (camino.length <= 2) return [...camino];
  const r: Celda2[] = [camino[0]];
  let i = 0;
  while (i < camino.length - 1) {
    let j = camino.length - 1;
    while (j > i + 1 && !vision(camino[i], camino[j])) j--;
    r.push(camino[j]);
    i = j;
  }
  return r;
}

/** Línea de visión en grilla por Bresenham (para `suavizarCamino`). */
export function visionBresenham(libre: (c: number, f: number) => boolean): (a: Celda2, b: Celda2) => boolean {
  return ([x0, y0], [x1, y1]) => {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    for (;;) {
      if (!libre(x, y)) return false;
      if (x === x1 && y === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  };
}
