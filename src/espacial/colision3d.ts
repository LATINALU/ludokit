// Colisiones y rayos en 3D para shooters, ARPG 3D y cualquier juego con hitboxes volumétricas:
//   - formas: esfera, caja alineada (AABB) y cápsula (la forma típica de personajes y extremidades);
//   - rayo contra cada forma (distancia de impacto + normal), solapamientos entre formas;
//   - `lanzarRayo` contra una escena (lista de colisionadores con id y etiqueta) devolviendo el impacto más cercano
//     o TODOS ordenados (para penetración de balas a través de varias cosas).
// Puro, sin motor: el juego registra sus colisionadores y consulta.

import { v3, vec3, type V3 } from "../nucleo/vec3.ts";

export type Forma3D =
  | { readonly tipo: "esfera"; readonly centro: V3; readonly radio: number }
  | { readonly tipo: "caja"; readonly min: V3; readonly max: V3 }
  | { readonly tipo: "capsula"; readonly a: V3; readonly b: V3; readonly radio: number };

export interface Rayo3D {
  readonly origen: V3;
  /** Unitario. */
  readonly dir: V3;
  readonly largo: number;
}

export interface Impacto3D {
  readonly t: number;
  readonly punto: V3;
  readonly normal: V3;
}

export function rayoEsfera3D(r: Rayo3D, centro: V3, radio: number): Impacto3D | null {
  const oc = vec3.restar(r.origen, centro);
  const b = vec3.punto(oc, r.dir);
  const c = vec3.largo2(oc) - radio * radio;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0 || t > r.largo) return null;
  if (c <= 0) t = 0; // empieza adentro
  const punto = vec3.sumarEscalado(r.origen, r.dir, t);
  return { t, punto, normal: c <= 0 ? vec3.escalar(r.dir, -1) : vec3.normalizar(vec3.restar(punto, centro)) };
}

export function rayoCaja3D(r: Rayo3D, min: V3, max: V3): Impacto3D | null {
  let tmin = 0, tmax = r.largo;
  let eje = -1, signo = 1;
  const o = [r.origen.x, r.origen.y, r.origen.z], d = [r.dir.x, r.dir.y, r.dir.z];
  const lo = [min.x, min.y, min.z], hi = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
      continue;
    }
    let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i], s = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      eje = i;
      signo = s;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  const n = [0, 0, 0];
  if (eje >= 0) n[eje] = signo;
  return { t: tmin, punto: vec3.sumarEscalado(r.origen, r.dir, tmin), normal: eje >= 0 ? v3(n[0], n[1], n[2]) : vec3.escalar(r.dir, -1) };
}

/** Rayo contra cápsula: cilindro infinito recortado + las dos semiesferas. */
export function rayoCapsula3D(r: Rayo3D, a: V3, b: V3, radio: number): Impacto3D | null {
  let mejor: Impacto3D | null = null;
  const tomar = (i: Impacto3D | null): void => {
    if (i && (!mejor || i.t < mejor.t)) mejor = i;
  };
  const ab = vec3.restar(b, a);
  const ao = vec3.restar(r.origen, a);
  const abab = vec3.punto(ab, ab), abd = vec3.punto(ab, r.dir), abao = vec3.punto(ab, ao);
  const A = abab - abd * abd;
  const B = abab * vec3.punto(ao, r.dir) - abao * abd;
  const C = abab * vec3.punto(ao, ao) - abao * abao - radio * radio * abab;
  if (A > 1e-12) {
    const disc = B * B - A * C;
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / A;
      const y = abao + t * abd;
      if (t >= 0 && t <= r.largo && y > 0 && y < abab) {
        const punto = vec3.sumarEscalado(r.origen, r.dir, t);
        const eje = vec3.sumarEscalado(a, ab, y / abab);
        tomar({ t, punto, normal: vec3.normalizar(vec3.restar(punto, eje)) });
      }
    }
  }
  tomar(rayoEsfera3D(r, a, radio));
  tomar(rayoEsfera3D(r, b, radio));
  return mejor;
}

export function rayoForma3D(r: Rayo3D, f: Forma3D): Impacto3D | null {
  switch (f.tipo) {
    case "esfera": return rayoEsfera3D(r, f.centro, f.radio);
    case "caja": return rayoCaja3D(r, f.min, f.max);
    case "capsula": return rayoCapsula3D(r, f.a, f.b, f.radio);
  }
}

/** Distancia mínima entre dos segmentos (para cápsula-cápsula). */
export function distanciaSegmentos(p1: V3, q1: V3, p2: V3, q2: V3): number {
  const d1 = vec3.restar(q1, p1), d2 = vec3.restar(q2, p2), r = vec3.restar(p1, p2);
  const a = vec3.punto(d1, d1), e = vec3.punto(d2, d2), f = vec3.punto(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return vec3.largo(r);
  if (a <= 1e-12) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = vec3.punto(d1, r);
    if (e <= 1e-12) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = vec3.punto(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return vec3.distancia(vec3.sumarEscalado(p1, d1, s), vec3.sumarEscalado(p2, d2, t));
}

/** ¿Se tocan dos formas? (esfera/cápsula entre sí y contra cajas). */
export function solapan3D(x: Forma3D, y: Forma3D): boolean {
  const seg = (f: Forma3D): [V3, V3, number] | null =>
    f.tipo === "esfera" ? [f.centro, f.centro, f.radio] : f.tipo === "capsula" ? [f.a, f.b, f.radio] : null;
  const sx = seg(x), sy = seg(y);
  if (sx && sy) return distanciaSegmentos(sx[0], sx[1], sy[0], sy[1]) <= sx[2] + sy[2];
  if (x.tipo === "caja" && y.tipo === "caja")
    return x.min.x <= y.max.x && y.min.x <= x.max.x && x.min.y <= y.max.y && y.min.y <= x.max.y && x.min.z <= y.max.z && y.min.z <= x.max.z;
  const caja = (x.tipo === "caja" ? x : y) as Extract<Forma3D, { tipo: "caja" }>;
  const otra = sx ?? sy!;
  // Aproximación: punto del segmento más cercano al centro de la caja, luego distancia punto-caja.
  const c = vec3.escalar(vec3.sumar(caja.min, caja.max), 0.5);
  const p = vec3.cercanoEnSegmento(c, otra[0], otra[1]).punto;
  const q = v3(Math.min(caja.max.x, Math.max(caja.min.x, p.x)), Math.min(caja.max.y, Math.max(caja.min.y, p.y)), Math.min(caja.max.z, Math.max(caja.min.z, p.z)));
  return vec3.distancia(p, q) <= otra[2];
}

export interface Colisionador3D {
  readonly id: number;
  readonly forma: Forma3D;
  /** "mundo", "cabeza", "torso", "vehiculo"... la usa el juego para zonas de daño y materiales. */
  readonly etiqueta?: string;
  /** Dueño (entidad) para ignorar al que dispara y agrupar zonas del mismo personaje. */
  readonly duenio?: number;
}

export interface ImpactoEscena extends Impacto3D {
  readonly colisionador: Colisionador3D;
}

/** Todos los impactos del rayo, ordenados por distancia (penetración). `ignorar`: dueño a excluir. */
export function lanzarRayoTodos(escena: readonly Colisionador3D[], r: Rayo3D, ignorar?: number): ImpactoEscena[] {
  const res: ImpactoEscena[] = [];
  for (const c of escena) {
    if (ignorar !== undefined && c.duenio === ignorar) continue;
    const i = rayoForma3D(r, c.forma);
    if (i) res.push({ ...i, colisionador: c });
  }
  return res.sort((a, b) => a.t - b.t);
}

/** El impacto más cercano o null. */
export function lanzarRayo(escena: readonly Colisionador3D[], r: Rayo3D, ignorar?: number): ImpactoEscena | null {
  let mejor: ImpactoEscena | null = null;
  for (const c of escena) {
    if (ignorar !== undefined && c.duenio === ignorar) continue;
    const i = rayoForma3D(r, c.forma);
    if (i && (!mejor || i.t < mejor.t)) mejor = { ...i, colisionador: c };
  }
  return mejor;
}

/** Desplaza una forma (para mover hitboxes con su entidad o rebobinar con compensación de lag). */
export function trasladar3D(f: Forma3D, d: V3): Forma3D {
  switch (f.tipo) {
    case "esfera": return { ...f, centro: vec3.sumar(f.centro, d) };
    case "caja": return { ...f, min: vec3.sumar(f.min, d), max: vec3.sumar(f.max, d) };
    case "capsula": return { ...f, a: vec3.sumar(f.a, d), b: vec3.sumar(f.b, d) };
  }
}
