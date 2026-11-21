// Comportamientos de dirección (steering, Reynolds): buscar, huir, llegar (frenando), perseguir y evadir con
// predicción, deambular, separación/alineación/cohesión (bandadas) y evitar obstáculos. Devuelven una fuerza
// (aceleración deseada) que se suma con pesos y se limita. Para naves, peces, pájaros, multitudes y enemigos voladores.

export interface Agente {
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly velMax: number;
  readonly fuerzaMax: number;
}

export type Fuerza = { x: number; y: number };

/** Tiempo de reacción (s): la fuerza es (velocidad deseada − actual) / REACCION. Más chico = más brusco. Con
 * 0.1 s el "llegar" queda sobre-amortiguado (frena sin pasarse). */
export const REACCION = 0.1;

const limitar = (x: number, y: number, max: number): Fuerza => {
  const l = Math.hypot(x, y);
  return l > max && l > 0 ? { x: (x / l) * max, y: (y / l) * max } : { x, y };
};

export function buscar(a: Agente, tx: number, ty: number): Fuerza {
  const dx = tx - a.x, dy = ty - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return limitar(((dx / l) * a.velMax - a.vx) / REACCION, ((dy / l) * a.velMax - a.vy) / REACCION, a.fuerzaMax);
}

export function huir(a: Agente, tx: number, ty: number, radioPanico = Infinity): Fuerza {
  if (Math.hypot(a.x - tx, a.y - ty) > radioPanico) return { x: 0, y: 0 };
  const f = buscar(a, tx, ty);
  return { x: -f.x, y: -f.y };
}

/** Como buscar, pero frena dentro de `radioFreno` y se detiene en el objetivo. */
export function llegar(a: Agente, tx: number, ty: number, radioFreno = 48): Fuerza {
  const dx = tx - a.x, dy = ty - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return limitar(-a.vx / REACCION, -a.vy / REACCION, a.fuerzaMax);
  const v = d < radioFreno ? (a.velMax * d) / radioFreno : a.velMax;
  return limitar(((dx / d) * v - a.vx) / REACCION, ((dy / d) * v - a.vy) / REACCION, a.fuerzaMax);
}

/** Persigue la posición futura del objetivo (intercepta en vez de seguir la cola). */
export function perseguir(a: Agente, o: { x: number; y: number; vx: number; vy: number }): Fuerza {
  const d = Math.hypot(o.x - a.x, o.y - a.y);
  const t = d / (a.velMax + Math.hypot(o.vx, o.vy) || 1);
  return buscar(a, o.x + o.vx * t, o.y + o.vy * t);
}

export function evadir(a: Agente, o: { x: number; y: number; vx: number; vy: number }): Fuerza {
  const f = perseguir(a, o);
  return { x: -f.x, y: -f.y };
}

/** Deambular suave: un punto en un círculo delante del agente que gira un poco al azar cada paso. */
export function deambular(a: Agente, estado: { angulo: number }, r01: number, distancia = 40, radio = 20, giro = 0.6): Fuerza {
  estado.angulo += (r01 * 2 - 1) * giro;
  const l = Math.hypot(a.vx, a.vy) || 1;
  const cx = a.x + (a.vx / l) * distancia;
  const cy = a.y + (a.vy / l) * distancia;
  return buscar(a, cx + Math.cos(estado.angulo) * radio, cy + Math.sin(estado.angulo) * radio);
}

/** Bandada: separación, alineación y cohesión con los vecinos dentro de `radio`. */
export function bandada(a: Agente, vecinos: readonly Agente[], radio = 40, pesos = { separacion: 1.5, alineacion: 1, cohesion: 1 }): Fuerza {
  let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
  for (const b of vecinos) {
    if (b === a) continue;
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0 || d > radio) continue;
    sx += dx / (d * d);
    sy += dy / (d * d);
    ax += b.vx;
    ay += b.vy;
    cx += b.x;
    cy += b.y;
    n++;
  }
  if (n === 0) return { x: 0, y: 0 };
  const sep = limitar(sx * a.velMax, sy * a.velMax, a.fuerzaMax);
  const ali = limitar((ax / n - a.vx) / REACCION, (ay / n - a.vy) / REACCION, a.fuerzaMax);
  const coh = buscar(a, cx / n, cy / n);
  return limitar(sep.x * pesos.separacion + ali.x * pesos.alineacion + coh.x * pesos.cohesion, sep.y * pesos.separacion + ali.y * pesos.alineacion + coh.y * pesos.cohesion, a.fuerzaMax);
}

/** Esquiva círculos que estén delante dentro de `anticipo` px. */
export function evitarObstaculos(a: Agente, obstaculos: ReadonlyArray<{ x: number; y: number; r: number }>, anticipo = 60): Fuerza {
  const l = Math.hypot(a.vx, a.vy);
  if (l < 1e-6) return { x: 0, y: 0 };
  const hx = a.vx / l, hy = a.vy / l;
  let peor: { x: number; y: number; r: number } | null = null;
  let tPeor = Infinity;
  for (const o of obstaculos) {
    const ox = o.x - a.x, oy = o.y - a.y;
    const proy = ox * hx + oy * hy;
    if (proy < 0 || proy > anticipo) continue;
    const lateral = Math.abs(ox * hy - oy * hx);
    if (lateral < o.r && proy < tPeor) {
      tPeor = proy;
      peor = o;
    }
  }
  if (!peor) return { x: 0, y: 0 };
  // Empujar de costado, hacia el lado contrario al obstáculo (perpendicular a la marcha).
  const px = -hy, py = hx;
  const lado = (peor.x - a.x) * px + (peor.y - a.y) * py >= 0 ? -1 : 1;
  return { x: px * lado * a.fuerzaMax, y: py * lado * a.fuerzaMax };
}

/** Integra: suma fuerzas ya pesadas, limita, aplica a la velocidad y la posición. */
export function integrar(a: Agente, fuerzas: readonly Fuerza[], dt: number): void {
  let fx = 0, fy = 0;
  for (const f of fuerzas) {
    fx += f.x;
    fy += f.y;
  }
  const f = limitar(fx, fy, a.fuerzaMax);
  const v = limitar(a.vx + f.x * dt, a.vy + f.y * dt, a.velMax);
  a.vx = v.x;
  a.vy = v.y;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
}
