// Curvas para estelas (tajos de espada, hechizos, rastros de proyectiles) y trayectorias de cámara o UI:
//   - Catmull-Rom CENTRÍPETA (α = 0,5): pasa por los puntos y NUNCA hace lazos ni picos cuando el movimiento gira
//     rápido (la uniforme sí, en cada tajo veloz).
//   - Bézier cuadrática y cúbica.
//   - Cinta: a partir de nodos (base, punta) muestreados en el tiempo, arma tramos subdivididos con coordenada u
//     (0 = más viejo, 1 = más nuevo) para dibujar una estela que se afina y se desvanece.

export type P = readonly [number, number];

const dist = (a: P, b: P): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

function mezcla(a: P, b: P, ta: number, tb: number, t: number): [number, number] {
  const d = tb - ta;
  if (Math.abs(d) < 1e-6) return [a[0], a[1]];
  const wa = (tb - t) / d, wb = (t - ta) / d;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb];
}

/** Punto entre p1 y p2 (t 0..1) de la Catmull-Rom centrípeta definida por p0..p3. */
export function catmullRom(p0: P, p1: P, p2: P, p3: P, t: number, alfa = 0.5): [number, number] {
  const nudo = (a: P, b: P): number => Math.max(1e-3, Math.pow(dist(a, b), alfa));
  const t0 = 0, t1 = t0 + nudo(p0, p1), t2 = t1 + nudo(p1, p2), t3 = t2 + nudo(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const a1 = mezcla(p0, p1, t0, t1, tt), a2 = mezcla(p1, p2, t1, t2, tt), a3 = mezcla(p2, p3, t2, t3, tt);
  const b1 = mezcla(a1, a2, t0, t2, tt), b2 = mezcla(a2, a3, t1, t3, tt);
  return mezcla(b1, b2, t1, t2, tt);
}

/** Curva suave que pasa por todos los puntos (extremos con puntos fantasma reflejados). */
export function suavizar(puntos: readonly P[], subdiv = 8): Array<[number, number]> {
  const n = puntos.length;
  if (n < 2) return puntos.map((p) => [p[0], p[1]]);
  const at = (i: number): P => (i < 0 ? [2 * puntos[0][0] - puntos[1][0], 2 * puntos[0][1] - puntos[1][1]] : i >= n ? [2 * puntos[n - 1][0] - puntos[n - 2][0], 2 * puntos[n - 1][1] - puntos[n - 2][1]] : puntos[i]);
  const r: Array<[number, number]> = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < subdiv; k++) r.push(catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), k / subdiv));
  r.push([puntos[n - 1][0], puntos[n - 1][1]]);
  return r;
}

export const bezier2 = (a: P, c: P, b: P, t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

export const bezier3 = (a: P, c1: P, c2: P, b: P, t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]];
};

export interface Tramo {
  readonly base0: [number, number];
  readonly punta0: [number, number];
  readonly base1: [number, number];
  readonly punta1: [number, number];
  readonly u0: number;
  readonly u1: number;
}

/** Estela tipo cinta a partir de nodos (base, punta) del arma en los últimos cuadros. */
export function cinta(nodos: ReadonlyArray<readonly [P, P]>, subdiv = 4): Tramo[] {
  if (nodos.length < 2) return [];
  const bases = suavizar(nodos.map((n) => n[0]), subdiv);
  const puntas = suavizar(nodos.map((n) => n[1]), subdiv);
  const total = bases.length - 1;
  const r: Tramo[] = [];
  for (let i = 0; i < total; i++) r.push({ base0: bases[i], punta0: puntas[i], base1: bases[i + 1], punta1: puntas[i + 1], u0: i / total, u1: (i + 1) / total });
  return r;
}

/** Largo aproximado de una polilínea. */
export const largoPolilinea = (ps: readonly P[]): number => ps.slice(1).reduce((s, p, i) => s + dist(ps[i], p), 0);
