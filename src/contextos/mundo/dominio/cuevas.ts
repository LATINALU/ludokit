// Cuevas por autómata celular (regla 4-5): ruido inicial + suavizado → cavernas orgánicas. Después se quedan solo
// las regiones conectadas a la mayor (sin bolsillos inalcanzables). Para roguelikes top-down, minería, mapas de
// supervivencia. Devuelve una Grilla (ROCA / VACIO) lista para la física y el A*.

import { Pcg32 } from "../../../nucleo/pcg32.ts";
import { Celda, Grilla } from "../../fisica/dominio/grilla.ts";

export interface OpcionesCuevas {
  readonly cols: number;
  readonly filas: number;
  readonly semilla: number;
  /** Probabilidad inicial de roca. */
  readonly relleno?: number;
  readonly pasos?: number;
  readonly tile?: number;
}

export function generarCuevas(o: OpcionesCuevas): Grilla {
  const az = new Pcg32(o.semilla);
  const { cols, filas } = o;
  let m = new Uint8Array(cols * filas);
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) m[f * cols + c] = c === 0 || f === 0 || c === cols - 1 || f === filas - 1 || az.prob(o.relleno ?? 0.45) ? 1 : 0;
  const vecinasRoca = (a: Uint8Array, c: number, f: number): number => {
    let n = 0;
    for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0 && df === 0) continue;
      const x = c + dc, y = f + df;
      n += x < 0 || y < 0 || x >= cols || y >= filas ? 1 : a[y * cols + x];
    }
    return n;
  };
  for (let p = 0; p < (o.pasos ?? 5); p++) {
    const n = new Uint8Array(cols * filas);
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const v = vecinasRoca(m, c, f);
      n[f * cols + c] = v > 4 ? 1 : v < 4 ? 0 : m[f * cols + c];
    }
    m = n;
  }
  // Quedarse con la región vacía más grande.
  const region = new Int32Array(cols * filas).fill(-1);
  let mejor = -1, mejorTam = 0, id = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i] !== 0 || region[i] !== -1) continue;
    let tam = 0;
    const pila = [i];
    region[i] = id;
    while (pila.length) {
      const k = pila.pop()!;
      tam++;
      const c = k % cols, f = (k - c) / cols;
      for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c + dc, y = f + df;
        if (x < 0 || y < 0 || x >= cols || y >= filas) continue;
        const j = y * cols + x;
        if (m[j] === 0 && region[j] === -1) {
          region[j] = id;
          pila.push(j);
        }
      }
    }
    if (tam > mejorTam) {
      mejorTam = tam;
      mejor = id;
    }
    id++;
  }
  const g = new Grilla(cols, filas, o.tile ?? 16, Celda.ROCA);
  for (let i = 0; i < m.length; i++) g.poner(i % cols, Math.floor(i / cols), m[i] === 0 && region[i] === mejor ? Celda.VACIO : Celda.ROCA);
  return g;
}
