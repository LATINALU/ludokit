// Curvas de escalado como DATOS (serializables a JSON): todo lo que crece con el nivel, la profundidad, la
// dificultad o el tiempo (vida de enemigos, rareza, costo de experiencia, oro por minuto...) se describe con una
// `Curva` en vez de una fórmula escrita a mano o de una tabla con un largo fijo. Así:
//   - ningún sistema queda atado a "N niveles" o "N pisos": todas las curvas aceptan cualquier nivel ≥ 1;
//   - el diseño se cambia editando datos (y las herramientas pueden graficarlas);
//   - los ports (Rust, C++, Python) evalúan exactamente lo mismo.
//
// Convención: `x` es el nivel (1 = el primero). Las curvas de progreso (`saturacion`, `logistica`) devuelven 0..1
// y sirven para mezclar dos tablas sin tope ("cuánto avanzó el juego"): nunca llegan a 1, siempre queda margen.

export type Curva =
  /** Valor fijo. */
  | { readonly tipo: "constante"; readonly valor: number }
  /** base + porNivel·(x − 1). */
  | { readonly tipo: "lineal"; readonly base: number; readonly porNivel: number }
  /** base·x^exp (exp < 1: crece cada vez más lento; > 1: cada vez más rápido). */
  | { readonly tipo: "potencia"; readonly base: number; readonly exp: number }
  /** base·razon^(x − 1) (dificultad infinita: +X % por nivel). */
  | { readonly tipo: "exponencial"; readonly base: number; readonly razon: number }
  /** Progreso 0..1 sin tope: d^e / (d^e + mitad^e) con d = x − 1. En x = 1 + mitad vale 0,5. */
  | { readonly tipo: "saturacion"; readonly mitad: number; readonly exp?: number }
  /** Progreso 0..1 en "S": 1 / (1 + e^(−pendiente·(x − centro))), normalizado para que x = 1 dé 0. */
  | { readonly tipo: "logistica"; readonly centro: number; readonly pendiente: number }
  /** Tramos lineales entre puntos [x, y] ordenados. Fuera de rango: plano (por defecto) o sigue la última pendiente. */
  | { readonly tipo: "tramos"; readonly puntos: ReadonlyArray<readonly [number, number]>; readonly extrapolar?: "plano" | "lineal" }
  /** Escalones: [desde, valor] ordenados; vale el último cuyo `desde` ≤ x. Debajo del primero: `inicial` (0). */
  | { readonly tipo: "escalones"; readonly puntos: ReadonlyArray<readonly [number, number]>; readonly inicial?: number }
  /** Tope suave: igual a `curva` hasta `desde`; después f(desde)·(x/desde)^exp (sigue creciendo, más lento). */
  | { readonly tipo: "topeSuave"; readonly curva: Curva; readonly desde: number; readonly exp: number }
  /** Recorta el resultado de otra curva. */
  | { readonly tipo: "limitar"; readonly curva: Curva; readonly min?: number; readonly max?: number }
  /** Producto de varias curvas (p. ej. potencia × exponencial). */
  | { readonly tipo: "producto"; readonly curvas: readonly Curva[] }
  /** Suma de varias curvas. */
  | { readonly tipo: "suma"; readonly curvas: readonly Curva[] }
  /** Desplaza el nivel: evalúa `curva` en x + desplazar (zonas que empiezan "en el nivel 10"). */
  | { readonly tipo: "desplazar"; readonly curva: Curva; readonly desplazar: number }
  /** Escala el resultado: valor·curva(x). */
  | { readonly tipo: "escalar"; readonly curva: Curva; readonly valor: number };

/** Evalúa una curva en `x` (nivel, profundidad, minuto...). Pura, sin tope. */
export function evaluar(c: Curva, x: number): number {
  switch (c.tipo) {
    case "constante":
      return c.valor;
    case "lineal":
      return c.base + c.porNivel * (x - 1);
    case "potencia":
      return c.base * Math.pow(Math.max(0, x), c.exp);
    case "exponencial":
      return c.base * Math.pow(c.razon, x - 1);
    case "saturacion": {
      const e = c.exp ?? 1;
      const d = Math.pow(Math.max(0, x - 1), e);
      const m = Math.pow(Math.max(1e-9, c.mitad), e);
      return d / (d + m);
    }
    case "logistica": {
      const f = (v: number): number => 1 / (1 + Math.exp(-c.pendiente * (v - c.centro)));
      const f1 = f(1);
      return Math.max(0, (f(x) - f1) / (1 - f1));
    }
    case "tramos": {
      const p = c.puntos;
      if (p.length === 0) return 0;
      if (p.length === 1) return p[0][1];
      if (x <= p[0][0]) return c.extrapolar === "lineal" ? pendiente(p[0], p[1], x) : p[0][1];
      for (let i = 1; i < p.length; i++) if (x <= p[i][0]) return pendiente(p[i - 1], p[i], x);
      const n = p.length - 1;
      return c.extrapolar === "lineal" ? pendiente(p[n - 1], p[n], x) : p[n][1];
    }
    case "escalones": {
      let v = c.inicial ?? 0;
      for (const [desde, valor] of c.puntos) if (x >= desde) v = valor;
      return v;
    }
    case "topeSuave":
      return x <= c.desde ? evaluar(c.curva, x) : evaluar(c.curva, c.desde) * Math.pow(x / c.desde, c.exp);
    case "limitar": {
      const v = evaluar(c.curva, x);
      return Math.min(c.max ?? Infinity, Math.max(c.min ?? -Infinity, v));
    }
    case "producto":
      return c.curvas.reduce((s, k) => s * evaluar(k, x), 1);
    case "suma":
      return c.curvas.reduce((s, k) => s + evaluar(k, x), 0);
    case "desplazar":
      return evaluar(c.curva, x + c.desplazar);
    case "escalar":
      return c.valor * evaluar(c.curva, x);
  }
}

function pendiente(a: readonly [number, number], b: readonly [number, number], x: number): number {
  const dx = b[0] - a[0];
  return dx === 0 ? b[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / dx;
}

/** Progreso 0..1 recortado (para mezclar tablas). */
export const progreso = (c: Curva, x: number): number => Math.min(1, Math.max(0, evaluar(c, x)));

/** Mezcla dos tablas con un progreso 0..1 (rareza, composición de enemigos, precios...). */
export function mezclarTablas(a: readonly number[], b: readonly number[], t: number): number[] {
  return a.map((v, i) => v + ((b[i] ?? v) - v) * t);
}

/** Muestra una curva en [desde, hasta] (herramientas, gráficos, tests de balance). */
export function muestrear(c: Curva, desde: number, hasta: number, paso = 1): Array<[number, number]> {
  const r: Array<[number, number]> = [];
  for (let x = desde; x <= hasta + 1e-9; x += paso) r.push([x, evaluar(c, x)]);
  return r;
}

/** Valida una curva leída de datos. Devuelve la lista de problemas (vacía = válida). */
export function validarCurva(c: Curva, ruta = "curva"): string[] {
  const e: string[] = [];
  const num = (v: unknown, n: string): void => {
    if (typeof v !== "number" || !Number.isFinite(v)) e.push(`${ruta}.${n} no es un número finito`);
  };
  switch (c?.tipo) {
    case "constante": num(c.valor, "valor"); break;
    case "lineal": num(c.base, "base"); num(c.porNivel, "porNivel"); break;
    case "potencia": num(c.base, "base"); num(c.exp, "exp"); break;
    case "exponencial": num(c.base, "base"); num(c.razon, "razon"); if (c.razon <= 0) e.push(`${ruta}.razon debe ser > 0`); break;
    case "saturacion": num(c.mitad, "mitad"); if (c.mitad <= 0) e.push(`${ruta}.mitad debe ser > 0`); break;
    case "logistica": num(c.centro, "centro"); num(c.pendiente, "pendiente"); break;
    case "tramos":
    case "escalones":
      if (!Array.isArray(c.puntos) || c.puntos.length === 0) e.push(`${ruta}.puntos vacío`);
      else for (let i = 1; i < c.puntos.length; i++) if (c.puntos[i][0] < c.puntos[i - 1][0]) e.push(`${ruta}.puntos desordenados en ${i}`);
      break;
    case "topeSuave": num(c.desde, "desde"); num(c.exp, "exp"); e.push(...validarCurva(c.curva, `${ruta}.curva`)); break;
    case "limitar": case "desplazar": case "escalar": e.push(...validarCurva(c.curva, `${ruta}.curva`)); break;
    case "producto": case "suma": c.curvas.forEach((k, i) => e.push(...validarCurva(k, `${ruta}.curvas[${i}]`))); break;
    default: e.push(`${ruta}: tipo desconocido`);
  }
  return e;
}

/** Atajos para escribir curvas en código. */
export const curva = {
  constante: (valor: number): Curva => ({ tipo: "constante", valor }),
  lineal: (base: number, porNivel: number): Curva => ({ tipo: "lineal", base, porNivel }),
  potencia: (base: number, exp: number): Curva => ({ tipo: "potencia", base, exp }),
  exponencial: (base: number, razon: number): Curva => ({ tipo: "exponencial", base, razon }),
  saturacion: (mitad: number, exp = 1): Curva => ({ tipo: "saturacion", mitad, exp }),
  logistica: (centro: number, pendiente: number): Curva => ({ tipo: "logistica", centro, pendiente }),
  tramos: (puntos: ReadonlyArray<readonly [number, number]>, extrapolar: "plano" | "lineal" = "plano"): Curva => ({ tipo: "tramos", puntos, extrapolar }),
  escalones: (puntos: ReadonlyArray<readonly [number, number]>, inicial = 0): Curva => ({ tipo: "escalones", puntos, inicial }),
  topeSuave: (c: Curva, desde: number, exp: number): Curva => ({ tipo: "topeSuave", curva: c, desde, exp }),
  limitar: (c: Curva, min?: number, max?: number): Curva => ({ tipo: "limitar", curva: c, min, max }),
  producto: (...curvas: Curva[]): Curva => ({ tipo: "producto", curvas }),
  suma: (...curvas: Curva[]): Curva => ({ tipo: "suma", curvas }),
  desplazar: (c: Curva, d: number): Curva => ({ tipo: "desplazar", curva: c, desplazar: d }),
  escalar: (c: Curva, valor: number): Curva => ({ tipo: "escalar", curva: c, valor }),
} as const;
