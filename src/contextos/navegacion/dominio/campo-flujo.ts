// Campo de flujo (Dijkstra desde el objetivo): una sola búsqueda da la dirección hacia el objetivo para TODAS las
// celdas. Es como los juegos de estrategia y los survival con hordas mueven cientos de unidades hacia el jugador
// sin un A* por unidad. Recalcular solo cuando el objetivo cambia de celda.

import { MonticuloMin } from "./astar.ts";

export class CampoFlujo {
  readonly cols: number;
  readonly filas: number;
  readonly distancia: Float32Array;

  constructor(cols: number, filas: number) {
    this.cols = cols;
    this.filas = filas;
    this.distancia = new Float32Array(cols * filas).fill(Infinity);
  }

  /** Calcula distancias desde uno o varios objetivos. `costo` <= 0 o Infinity = bloqueada. */
  calcular(objetivos: ReadonlyArray<readonly [number, number]>, costo: (c: number, f: number) => number, maxDist = Infinity): void {
    const d = this.distancia;
    d.fill(Infinity);
    const h = new MonticuloMin<number>();
    for (const [c, f] of objetivos) {
      const i = f * this.cols + c;
      d[i] = 0;
      h.meter(i, 0);
    }
    while (h.tamano > 0) {
      const i = h.sacar()!;
      const c = i % this.cols;
      const f = (i - c) / this.cols;
      const base = d[i];
      if (base > maxDist) continue;
      for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const nc = c + dc, nf = f + df;
        if (nc < 0 || nf < 0 || nc >= this.cols || nf >= this.filas) continue;
        const k = costo(nc, nf);
        if (!(k > 0) || !Number.isFinite(k)) continue;
        if (dc !== 0 && df !== 0) {
          const a = costo(c + dc, f), b = costo(c, f + df);
          if (!(a > 0 && Number.isFinite(a) && b > 0 && Number.isFinite(b))) continue;
        }
        const nd = base + k * (dc !== 0 && df !== 0 ? Math.SQRT2 : 1);
        const j = nf * this.cols + nc;
        if (nd < d[j]) {
          d[j] = nd;
          h.meter(j, nd);
        }
      }
    }
  }

  /** Dirección normalizada (hacia la vecina de menor distancia) para una celda; [0,0] si no hay camino. */
  direccion(c: number, f: number): [number, number] {
    let mejor = this.distancia[f * this.cols + c];
    let dx = 0, dy = 0;
    for (let ff = -1; ff <= 1; ff++) {
      for (let cc = -1; cc <= 1; cc++) {
        if (cc === 0 && ff === 0) continue;
        const nc = c + cc, nf = f + ff;
        if (nc < 0 || nf < 0 || nc >= this.cols || nf >= this.filas) continue;
        const v = this.distancia[nf * this.cols + nc];
        if (v < mejor) {
          mejor = v;
          dx = cc;
          dy = ff;
        }
      }
    }
    const l = Math.hypot(dx, dy);
    return l > 0 ? [dx / l, dy / l] : [0, 0];
  }

  distanciaEn(c: number, f: number): number {
    return this.distancia[f * this.cols + c];
  }
}
