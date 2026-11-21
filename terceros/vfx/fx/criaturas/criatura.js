// CRIATURAS POR RECETA: un solo efecto con la opción `tipo` arma la criatura desde su receta (recetas.js) con piezas
// sombreadas (luz arriba a la izquierda, rampa de paleta por pieza, brillo especular, contorno de 1 px) y la anima en
// bucle (respira, camina, aletea, flota, salta u ondula). Opción `escala`: dibujar YA al tamaño final (achicar después
// borra caras y detalles). Usa el kit (Grid, shift) de critters/_lib.js de este paquete (MIT, ver LICENSE y NOTICE.md).

import { clamp, TAU, hex } from "../../core/index.js";
import { Grid, shift } from "../critters/_lib.js";
import { RECETAS, RAMPAS } from "./recetas.js";

export const meta = {
  name: "Criatura",
  desc: "A creature built from shaded parts and looped: breathes, walks, flaps, floats, hops or ripples.",
  tags: ["creature", "monster", "loop"],
  size: [96, 96],
  origin: [48, 86],
  duration: 1.6,
  loop: true,
  fps: 12,
  bg: "ground",
  options: { tipo: "rondador", seed: 1, escala: 0.68, contorno: false },
};

const D = meta.duration;
const L = (() => { const v = [-0.55, -0.75, 0.62], n = Math.hypot(...v); return v.map((c) => c / n); })();
const GRID = new Grid(-46, -84, 92, 92);
const cache = {};

function rampa(nombre, oscuro = 0) {
  const k = nombre + "|" + oscuro;
  if (!cache[k]) {
    const r = RAMPAS[nombre] || RAMPAS.hueso;
    cache[k] = r.map((c, i) => hex(r[clamp(i - oscuro, 0, r.length - 1)]));
  }
  return cache[k];
}

// Índice de la rampa según la luz (lambert) y un toque especular arriba a la izquierda.
function tono(R, nx, ny, nz, mate = false) {
  const s = nx * L[0] + ny * L[1] + nz * L[2];
  const n = R.length;
  let v = clamp((s + 0.5) / 1.55);
  let i = Math.round(v * (n - 2)) + 1;
  if (!mate && s > 0.95) i = n - 1;
  if (s < -0.3) i = 0;
  return R[clamp(i, 0, n - 1)];
}

// ---------- transformaciones de las piezas
const rot = ([x, y], [px, py], a) => {
  const c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
};

// Movimiento de una pieza en la fase a (0..TAU): lista de {r: rotación sobre piv, d: desplazamiento, o: onda}.
function mover(pt, movs, a, i = 0) {
  let p = pt;
  for (const m of movs || []) {
    const f = Math.sin(a * (m.f || 1) + (m.fase || 0) + (m.o ? i * m.o : 0));
    if (m.r !== undefined) p = rot(p, m.piv, m.r * f);
    if (m.d) p = [p[0] + m.d[0] * f, p[1] + m.d[1] * f];
    if (m.abs) p = [p[0] + m.abs[0] * Math.abs(f), p[1] + m.abs[1] * Math.abs(f)];
  }
  return p;
}

// ---------- dibujo de piezas
function elipse(g, cx, cy, rx, ry, R, mate) {
  if (rx <= 0.2 || ry <= 0.2) return;
  g.shade(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) return 0;
    return tono(R, nx, ny, Math.sqrt(Math.max(0, 1 - d)), mate);
  });
}

function capsula(g, a, b, r0, r1, R, mate) {
  const x0 = Math.min(a[0], b[0]) - Math.max(r0, r1) - 1, x1 = Math.max(a[0], b[0]) + Math.max(r0, r1) + 1;
  const y0 = Math.min(a[1], b[1]) - Math.max(r0, r1) - 1, y1 = Math.max(a[1], b[1]) + Math.max(r0, r1) + 1;
  const vx = b[0] - a[0], vy = b[1] - a[1], LL = vx * vx + vy * vy || 1;
  g.shade(x0, y0, x1, y1, (x, y) => {
    const u = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / LL), r = r0 + (r1 - r0) * u;
    const qx = a[0] + vx * u, qy = a[1] + vy * u, dx = (x - qx) / r, dy = (y - qy) / r, d = dx * dx + dy * dy;
    if (d > 1) return 0;
    return tono(R, dx, dy, Math.sqrt(Math.max(0, 1 - d)), mate);
  });
}

function dentro(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// Polígono plano con bisel: borde de arriba/izquierda claro, de abajo/derecha oscuro (como el metal de pixelfx).
function poligono(g, pts, R) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const n = R.length;
  g.shade(x0 - 1, y0 - 1, x1 + 1, y1 + 1, (x, y) => {
    if (!dentro(pts, x, y)) return 0;
    if (!dentro(pts, x - 1, y - 1)) return R[n - 1];
    if (!dentro(pts, x + 1.2, y + 1.2)) return R[1];
    if (!dentro(pts, x + 2.4, y + 2.4)) return R[2];
    return R[clamp(n - 3, 1, n - 1)];
  });
}

let S = 1;
function pieza(g, p, a) {
  const R = rampa(p.pal || "hueso", p.osc || 0);
  const M = (pt, i) => { const q = mover(pt, p.m, a, i); return [q[0] * S, q[1] * S]; };
  switch (p.k) {
    case "e": {
      const [cx, cy] = M([p.x, p.y]);
      const re = 1 + (p.resp || 0) * Math.sin(a * 2);
      elipse(g, cx, cy, (p.rx * S) / Math.sqrt(re), p.ry * re * S, R, p.mate);
      break;
    }
    case "c": {
      if (p.pts) {
        // Cadena (colas, tentáculos, cuellos): una cápsula por tramo, con onda que avanza.
        const q = p.pts.map((pt, i) => M(pt, i));
        for (let i = 1; i < q.length; i++) {
          const u0 = (i - 1) / (q.length - 1), u1 = i / (q.length - 1);
          capsula(g, q[i - 1], q[i], (p.r0 + (p.r1 - p.r0) * u0) * S, (p.r0 + (p.r1 - p.r0) * u1) * S, R, p.mate);
        }
      } else capsula(g, M(p.a), M(p.b), (p.r0 ?? p.r) * S, (p.r1 ?? p.r) * S, R, p.mate);
      break;
    }
    case "p":
      poligono(g, p.pts.map((pt) => M(pt)), R);
      break;
    case "px": {
      // Píxeles sueltos: ojos, dientes, remaches, brillos.
      const c = hex(p.col);
      for (const pt of p.pts) {
        const [x, y] = M(pt);
        if (p.parpadeo && Math.sin(a * 3 + 1) > 0.97) continue;
        g.set(Math.floor(x), Math.floor(y), c);
      }
      break;
    }
  }
}

export function draw(p, time, o) {
  const rec = RECETAS[o.tipo] || RECETAS.rondador;
  const t = shift(time, D, o.seed), a = (t / D) * TAU;
  const g = GRID;
  g.clear();
  S = (rec.escala ?? 1) * (o.escala ?? 1);
  // Movimiento de todo el cuerpo: respirar/caminar (rebote), flotar o saltar.
  let dy = 0, dx = 0;
  switch (rec.anim) {
    case "andar": dy = -Math.abs(Math.sin(a)) * (rec.rebote ?? 1.2); break;
    case "flotar": dy = -(rec.altura ?? 0) - 2.2 * Math.sin(a); dx = 1.2 * Math.sin(a * 0.5); break;
    case "saltar": dy = -Math.max(0, Math.sin(a)) * (rec.rebote ?? 5); break;
    default: dy = -0.6 * Math.max(0, Math.sin(a * 2)); break;
  }
  for (const pz of rec.partes) pieza(g, pz, a);
  // El contorno lo pone después herramientas/gen_mobs_bichos.py (a su tamaño final); aquí solo para mirar.
  if (o.contorno) g.outline((x, y, nx, ny) => hex(ny > 0 ? "#0c0910" : "#1a1424"), 1);
  g.draw(p, 1, Math.round(dx * S), Math.round(dy * S));
  if (rec.brillo) p.glow((dx + rec.brillo[0]) * S, (dy + rec.brillo[1]) * S, rec.brillo[2] * S, hex(rec.brillo[3]), 0.25);
}
