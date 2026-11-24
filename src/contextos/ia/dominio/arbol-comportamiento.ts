// Árbol de comportamiento (Behavior Tree), el estándar de la IA de juegos: nodos que devuelven EXITO, FALLO o
// CORRIENDO cada tick. Compuestos (secuencia, selector, paralelo, aleatorio ponderado), decoradores (invertir,
// repetir, cooldown, límite de tiempo, condición) y hojas (acción, condición, esperar). Pizarra (blackboard) para
// compartir datos. Los nodos con memoria reanudan el hijo que quedó CORRIENDO.

import type { Azar } from "../../../nucleo/azar.ts";

export const EXITO = "exito" as const;
export const FALLO = "fallo" as const;
export const CORRIENDO = "corriendo" as const;
export type Estado = typeof EXITO | typeof FALLO | typeof CORRIENDO;

export interface Ctx<P> {
  readonly pizarra: P;
  readonly dt: number;
  readonly azar?: Azar;
}

export interface Nodo<P> {
  tick(ctx: Ctx<P>): Estado;
  /** Se llama cuando un padre aborta este nodo (para cancelar animaciones, liberar recursos). */
  reiniciar?(): void;
}

export const accion = <P>(f: (ctx: Ctx<P>) => Estado): Nodo<P> => ({ tick: f });
export const condicion = <P>(f: (ctx: Ctx<P>) => boolean): Nodo<P> => ({ tick: (c) => (f(c) ? EXITO : FALLO) });

/** Corre los hijos en orden; falla en el primero que falla. Con memoria: reanuda el que estaba CORRIENDO. */
export function secuencia<P>(...hijos: Nodo<P>[]): Nodo<P> {
  let i = 0;
  return {
    tick(c) {
      while (i < hijos.length) {
        const r = hijos[i].tick(c);
        if (r === CORRIENDO) return r;
        if (r === FALLO) {
          i = 0;
          return FALLO;
        }
        i++;
      }
      i = 0;
      return EXITO;
    },
    reiniciar() {
      for (const h of hijos) h.reiniciar?.();
      i = 0;
    },
  };
}

/** Prueba los hijos en orden hasta que uno no falle. Reactivo: reevalúa desde el primero cada tick
 * (un hijo de mayor prioridad puede interrumpir al que corre). */
export function selector<P>(...hijos: Nodo<P>[]): Nodo<P> {
  let corriendo = -1;
  return {
    tick(c) {
      for (let i = 0; i < hijos.length; i++) {
        const r = hijos[i].tick(c);
        if (r === FALLO) continue;
        if (corriendo !== -1 && corriendo !== i) hijos[corriendo].reiniciar?.();
        corriendo = r === CORRIENDO ? i : -1;
        return r;
      }
      if (corriendo !== -1) hijos[corriendo].reiniciar?.();
      corriendo = -1;
      return FALLO;
    },
    reiniciar() {
      for (const h of hijos) h.reiniciar?.();
      corriendo = -1;
    },
  };
}

/** Corre todos a la vez. Éxito cuando `exitosNecesarios` tuvieron éxito; fallo cuando ya no se puede llegar. */
export function paralelo<P>(exitosNecesarios: number, ...hijos: Nodo<P>[]): Nodo<P> {
  return {
    tick(c) {
      let ok = 0, ko = 0;
      for (const h of hijos) {
        const r = h.tick(c);
        if (r === EXITO) ok++;
        else if (r === FALLO) ko++;
      }
      if (ok >= exitosNecesarios) return EXITO;
      if (hijos.length - ko < exitosNecesarios) return FALLO;
      return CORRIENDO;
    },
    reiniciar() {
      for (const h of hijos) h.reiniciar?.();
    },
  };
}

/** Elige un hijo al azar por peso y lo corre hasta que termine (variedad en los ataques de un jefe). */
export function aleatorio<P>(opciones: ReadonlyArray<readonly [Nodo<P>, number]>): Nodo<P> {
  let actual: Nodo<P> | null = null;
  return {
    tick(c) {
      if (!actual) {
        const total = opciones.reduce((s, [, w]) => s + w, 0);
        if (!c.azar) throw new Error("aleatorio(): el contexto necesita un `azar` inyectado (determinismo)");
        let r = c.azar.siguiente() * total;
        actual = opciones[opciones.length - 1][0];
        for (const [n, w] of opciones) {
          r -= w;
          if (r < 0) {
            actual = n;
            break;
          }
        }
      }
      const res = actual.tick(c);
      if (res !== CORRIENDO) actual = null;
      return res;
    },
    reiniciar() {
      actual?.reiniciar?.();
      actual = null;
    },
  };
}

export const invertir = <P>(h: Nodo<P>): Nodo<P> => ({
  tick: (c) => {
    const r = h.tick(c);
    return r === EXITO ? FALLO : r === FALLO ? EXITO : r;
  },
  reiniciar: () => h.reiniciar?.(),
});

export const siempreExito = <P>(h: Nodo<P>): Nodo<P> => ({
  tick: (c) => (h.tick(c) === CORRIENDO ? CORRIENDO : EXITO),
  reiniciar: () => h.reiniciar?.(),
});

/** Repite el hijo `n` veces (Infinity = para siempre mientras no falle). */
export function repetir<P>(h: Nodo<P>, n = Infinity): Nodo<P> {
  let k = 0;
  return {
    tick(c) {
      const r = h.tick(c);
      if (r === CORRIENDO) return r;
      if (r === FALLO) {
        k = 0;
        return FALLO;
      }
      k++;
      if (k >= n) {
        k = 0;
        return EXITO;
      }
      return CORRIENDO;
    },
    reiniciar() {
      k = 0;
      h.reiniciar?.();
    },
  };
}

/** Tras un EXITO del hijo, falla durante `seg` segundos (habilidades con recarga). */
export function cooldown<P>(h: Nodo<P>, seg: number): Nodo<P> {
  let resta = 0;
  return {
    tick(c) {
      resta -= c.dt;
      if (resta > 0) return FALLO;
      const r = h.tick(c);
      if (r === EXITO) resta = seg;
      return r;
    },
    reiniciar: () => h.reiniciar?.(),
  };
}

/** Falla si el hijo sigue CORRIENDO después de `seg` segundos. */
export function limiteTiempo<P>(h: Nodo<P>, seg: number): Nodo<P> {
  let t = 0;
  return {
    tick(c) {
      t += c.dt;
      if (t > seg) {
        h.reiniciar?.();
        t = 0;
        return FALLO;
      }
      const r = h.tick(c);
      if (r !== CORRIENDO) t = 0;
      return r;
    },
    reiniciar() {
      t = 0;
      h.reiniciar?.();
    },
  };
}

export function esperar<P>(seg: number): Nodo<P> {
  let t = 0;
  return {
    tick(c) {
      t += c.dt;
      if (t >= seg) {
        t = 0;
        return EXITO;
      }
      return CORRIENDO;
    },
    reiniciar() {
      t = 0;
    },
  };
}

/** Solo corre el hijo si la condición se cumple (y lo aborta si deja de cumplirse). */
export function si<P>(cond: (c: Ctx<P>) => boolean, h: Nodo<P>): Nodo<P> {
  return {
    tick(c) {
      if (!cond(c)) {
        h.reiniciar?.();
        return FALLO;
      }
      return h.tick(c);
    },
    reiniciar: () => h.reiniciar?.(),
  };
}
