// Hash espacial uniforme (broadphase): reparte objetos en celdas para que "¿quién está cerca?" no sea O(n²).
// Es la estructura de las áreas de interés de un servidor MMO, de las colisiones entre cientos de balas y de la
// IA que busca objetivos. Celdas en un Map por clave entera (mundo infinito, sin reservar memoria).

export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const clave = (cx: number, cy: number): number => ((cx & 0xffff) << 16) | (cy & 0xffff);

export class HashEspacial<T> {
  readonly celda: number;
  private readonly celdas = new Map<number, Set<T>>();
  private readonly donde = new Map<T, { cajas: number[]; caja: Caja }>();

  constructor(celda = 64) {
    this.celda = celda;
  }

  private claves(c: Caja): number[] {
    const s = this.celda;
    const r: number[] = [];
    for (let cy = Math.floor(c.y / s); cy <= Math.floor((c.y + c.h) / s); cy++) {
      for (let cx = Math.floor(c.x / s); cx <= Math.floor((c.x + c.w) / s); cx++) r.push(clave(cx, cy));
    }
    return r;
  }

  insertar(o: T, c: Caja): void {
    this.quitar(o);
    const ks = this.claves(c);
    for (const k of ks) {
      let set = this.celdas.get(k);
      if (!set) this.celdas.set(k, (set = new Set()));
      set.add(o);
    }
    this.donde.set(o, { cajas: ks, caja: c });
  }

  /** Mover = quitar + insertar, pero sin tocar celdas si sigue en las mismas. */
  mover(o: T, c: Caja): void {
    const d = this.donde.get(o);
    if (d) {
      const ks = this.claves(c);
      if (ks.length === d.cajas.length && ks.every((k, i) => k === d.cajas[i])) {
        d.caja = c;
        return;
      }
    }
    this.insertar(o, c);
  }

  quitar(o: T): void {
    const d = this.donde.get(o);
    if (!d) return;
    for (const k of d.cajas) {
      const set = this.celdas.get(k);
      set?.delete(o);
      if (set && set.size === 0) this.celdas.delete(k);
    }
    this.donde.delete(o);
  }

  /** Objetos cuya caja toca la región (sin duplicados). */
  consultar(region: Caja, filtro?: (o: T) => boolean): T[] {
    const vistos = new Set<T>();
    const r: T[] = [];
    for (const k of this.claves(region)) {
      for (const o of this.celdas.get(k) ?? []) {
        if (vistos.has(o)) continue;
        vistos.add(o);
        const c = this.donde.get(o)!.caja;
        if (c.x <= region.x + region.w && region.x <= c.x + c.w && c.y <= region.y + region.h && region.y <= c.y + c.h && (!filtro || filtro(o))) r.push(o);
      }
    }
    return r;
  }

  /** Objetos a menos de `radio` del punto (por centro de caja), ordenados por distancia. */
  cercanos(x: number, y: number, radio: number, filtro?: (o: T) => boolean): T[] {
    const cand = this.consultar({ x: x - radio, y: y - radio, w: radio * 2, h: radio * 2 }, filtro);
    const d = (o: T): number => {
      const c = this.donde.get(o)!.caja;
      return Math.hypot(c.x + c.w / 2 - x, c.y + c.h / 2 - y);
    };
    return cand.filter((o) => d(o) <= radio).sort((a, b) => d(a) - d(b));
  }

  /** Pares que se solapan (para resolver colisiones entre muchos objetos). */
  pares(): Array<[T, T]> {
    const r: Array<[T, T]> = [];
    const visto = new Set<string>();
    const ids = new Map<T, number>();
    let n = 0;
    for (const o of this.donde.keys()) ids.set(o, n++);
    for (const set of this.celdas.values()) {
      const lista = [...set];
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const a = lista[i], b = lista[j];
          const ia = ids.get(a)!, ib = ids.get(b)!;
          const k = ia < ib ? `${ia},${ib}` : `${ib},${ia}`;
          if (visto.has(k)) continue;
          visto.add(k);
          const ca = this.donde.get(a)!.caja, cb = this.donde.get(b)!.caja;
          if (ca.x < cb.x + cb.w && cb.x < ca.x + ca.w && ca.y < cb.y + cb.h && cb.y < ca.y + ca.h) r.push([a, b]);
        }
      }
    }
    return r;
  }

  get tamano(): number {
    return this.donde.size;
  }

  cajaDe(o: T): Caja | undefined {
    return this.donde.get(o)?.caja;
  }
}
