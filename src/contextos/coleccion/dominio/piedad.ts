// Piedad (pity) para cajas aleatorias: garantiza resultados en una ventana de aperturas para que la mala suerte
// tenga techo. Tres modelos, combinables:
//   - Umbral: si en N aperturas no salió nivel ≥ X, la siguiente es X (y el contador se reinicia si sale antes).
//   - Cuotas por bloque: en cada bloque de N aperturas salen al menos K de cada nivel listado.
//   - Probabilidad suave: tras M aperturas sin premio, la probabilidad sube un poco por apertura.
// El estado es un objeto plano (guardable). La caja muestra siempre sus probabilidades base.

import type { Azar } from "../../../nucleo/azar.ts";

export interface DefCaja {
  /** Nivel mínimo de la caja y probabilidades por nivel desde ese mínimo. */
  readonly minimo: number;
  readonly prob: readonly number[];
  readonly umbral?: { readonly aperturas: number; readonly nivel: number };
  readonly cuotas?: { readonly bloque: number; readonly minimos: Readonly<Record<number, number>> };
  readonly suave?: { readonly desde: number; readonly nivel: number; readonly porApertura: number };
}

export interface EstadoPiedad {
  contador: number;
  abiertos: number;
  conseguidas: Record<number, number>;
}

export const piedadInicial = (): EstadoPiedad => ({ contador: 0, abiertos: 0, conseguidas: {} });

function tirarTabla(azar: Azar, prob: readonly number[]): number {
  let r = azar.siguiente();
  for (let i = 0; i < prob.length; i++) {
    r -= prob[i];
    if (r < 0) return i;
  }
  return 0;
}

/** Abre una caja: devuelve el nivel y si salió por la garantía. Modifica `estado`. */
export function abrirConPiedad(azar: Azar, caja: DefCaja, estado: EstadoPiedad): { nivel: number; garantizada: boolean } {
  let nivel: number;
  let garantizada = false;
  // 1. Cuotas por bloque: si lo que falta ya no entra en lo que queda del bloque, se fuerza.
  const c = caja.cuotas;
  let forzado: number | null = null;
  if (c) {
    let falta = 0;
    let mayor = -1;
    for (const [n, k] of Object.entries(c.minimos)) {
      const f = Math.max(0, k - (estado.conseguidas[Number(n)] ?? 0));
      falta += f;
      if (f > 0) mayor = Math.max(mayor, Number(n));
    }
    if (falta > 0 && falta >= c.bloque - estado.abiertos) forzado = mayor;
  }
  if (forzado !== null) {
    nivel = forzado;
    garantizada = true;
  } else {
    const prob = [...caja.prob];
    if (caja.suave && estado.contador >= caja.suave.desde) {
      const i = caja.suave.nivel - caja.minimo;
      const extra = (estado.contador - caja.suave.desde + 1) * caja.suave.porApertura;
      prob[i] = Math.min(1, prob[i] + extra);
      const resto = prob.reduce((s, p, j) => (j === i ? s : s + p), 0);
      const escala = resto > 0 ? (1 - prob[i]) / resto : 0;
      for (let j = 0; j < prob.length; j++) if (j !== i) prob[j] *= escala;
    }
    nivel = caja.minimo + tirarTabla(azar, prob);
  }
  // 2. Umbral.
  const u = caja.umbral;
  if (u) {
    if (nivel >= u.nivel) estado.contador = 0;
    else if (estado.contador + 1 >= u.aperturas) {
      nivel = u.nivel;
      garantizada = true;
      estado.contador = 0;
    } else estado.contador++;
  } else if (caja.suave) {
    estado.contador = nivel >= caja.suave.nivel ? 0 : estado.contador + 1;
  }
  // 3. Contabilidad del bloque.
  if (c) {
    if (nivel in c.minimos) estado.conseguidas[nivel] = (estado.conseguidas[nivel] ?? 0) + 1;
    estado.abiertos++;
    if (estado.abiertos >= c.bloque) {
      estado.abiertos = 0;
      estado.conseguidas = {};
    }
  }
  return { nivel, garantizada };
}

/** Texto de probabilidades para mostrar: "6★ 48 % · 7★ 28 % · …". */
export const textoProbabilidades = (caja: DefCaja, sufijo = "★"): string =>
  caja.prob.map((p, i) => `${caja.minimo + i + 1}${sufijo} ${Math.round(p * 1000) / 10} %`).join(" · ");

