// Esqueleto humanoide procedural de 21 puntos con cinemática inversa (IK): una POSE solo dice dónde van las manos y
// los pies y cómo carga el cuerpo (cadera, inclinación, agachado, giro); el esqueleto resuelve el resto con huesos de
// largo FIJO. Al estar en 3D el pecho gira con el giro (una mano al frente trae su hombro) y la profundidad z decide
// qué queda delante al dibujar. Para personajes animados sin hojas de sprites, armas que se sostienen bien, y
// efectos que se pegan a una mano o al pecho.
//
// Coordenadas: x a la derecha, y NEGATIVA hacia arriba (como en pantalla), z hacia la cámara; pies en el origen.
// Lado "n" (cercano) = mano del arma; "f" (lejano) = la otra.

export type V3 = [number, number, number];

const sum = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const res = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const esc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const pp = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const largo = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => esc(a, 1 / (largo(a) || 1e-9));

/**
 * IK analítica de dos huesos (brazo, pierna, cola de 2 segmentos): desde la raíz `a` hacia `objetivo` con largos
 * L1, L2; la articulación se dobla hacia `polo` (codo atrás, rodilla adelante). Si no alcanza, se estira al máximo
 * en la dirección del objetivo (nunca estira los huesos).
 */
export function ik2Huesos(a: V3, objetivo: V3, L1: number, L2: number, polo: V3): { articulacion: V3; extremo: V3 } {
  let hacia = res(objetivo, a);
  let d = largo(hacia);
  const alcance = L1 + L2 - 1e-4;
  if (d > alcance) {
    hacia = esc(hacia, alcance / d);
    d = alcance;
  }
  d = Math.max(d, Math.abs(L1 - L2) + 1e-4);
  const u = unit(hacia);
  const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
  let v = res(polo, esc(u, pp(polo, u)));
  v = largo(v) < 1e-5 ? unit(cruz(u, [0, 0, 1])) : unit(v);
  return { articulacion: sum(a, sum(esc(u, along), esc(v, h))), extremo: sum(a, esc(u, d)) };
}

/** IK 2D (sprites planos): `doblez` +1 o −1 elige hacia qué lado se dobla la articulación. */
export function ik2Huesos2D(ax: number, ay: number, ox: number, oy: number, L1: number, L2: number, doblez: 1 | -1 = 1): { jx: number; jy: number; ex: number; ey: number } {
  const dx = ox - ax, dy = oy - ay;
  const n = Math.hypot(dx, dy) || 1e-9;
  const r = ik2Huesos([ax, ay, 0], [ox, oy, 0], L1, L2, [(-dy / n) * doblez, (dx / n) * doblez, 0]);
  return { jx: r.articulacion[0], jy: r.articulacion[1], ex: r.extremo[0], ey: r.extremo[1] };
}

export interface Medidas {
  readonly pelvis: number;
  readonly espina1: number;
  readonly espina2: number;
  readonly cuello: number;
  readonly cabeza: number;
  readonly hombroAlto: number;
  readonly hombroAncho: number;
  readonly caderaBaja: number;
  readonly caderaAncho: number;
  readonly brazo: number;
  readonly antebrazo: number;
  readonly muslo: number;
  readonly pierna: number;
  readonly pie: number;
}

/** Medidas para un personaje de ~24 px de alto (escalar con `escalarMedidas`). */
export const MEDIDAS_24PX: Medidas = {
  pelvis: 11.5, espina1: 2.8, espina2: 4.2, cuello: 2.4, cabeza: 3, hombroAlto: 1.5, hombroAncho: 3.6,
  caderaBaja: 0.8, caderaAncho: 1.8, brazo: 4.6, antebrazo: 4.4, muslo: 5.4, pierna: 5.2, pie: 2.2,
};

export const escalarMedidas = (m: Medidas, k: number): Medidas => Object.fromEntries(Object.entries(m).map(([a, v]) => [a, v * k])) as unknown as Medidas;

export interface Pose {
  /** Desplazamiento de la cadera (x) y agachado (px hacia abajo). */
  readonly x?: number;
  readonly agachar?: number;
  /** Inclinación del torso (rad, + hacia adelante) y giro sobre el eje vertical (rad, + muestra el pecho). */
  readonly inclinar?: number;
  readonly giro?: number;
  /** Objetivos de manos y pies en coordenadas de pantalla (y negativa arriba). z opcional. */
  readonly manoN: V3;
  readonly manoF: V3;
  readonly pieN: V3;
  readonly pieF: V3;
  /** Mirada (rad) de la cabeza respecto del cuello. */
  readonly cabeza?: number;
}

export const POSE_DE_PIE: Pose = { manoN: [3, -11, 2], manoF: [-3, -11, -2], pieN: [1.5, 0, 1.5], pieF: [-1.5, 0, -1.5] };

export const ARTICULACIONES = [
  "raiz", "pelvis", "cintura", "pecho", "cuello", "cabeza", "coronilla",
  "hombroN", "codoN", "manoN", "hombroF", "codoF", "manoF",
  "caderaN", "rodillaN", "tobilloN", "puntaN", "caderaF", "rodillaF", "tobilloF", "puntaF",
] as const;
export type Articulacion = (typeof ARTICULACIONES)[number];
export type Esqueleto = Record<Articulacion, V3>;

/** Rotación alrededor del eje Y (giro) y del eje Z (inclinación) aplicada a un vector local. */
function rotar(v: V3, giro: number, incl: number): V3 {
  const cz = Math.cos(incl), sz = Math.sin(incl);
  const x1 = v[0] * cz - v[1] * sz, y1 = v[0] * sz + v[1] * cz;
  const cy = Math.cos(giro), sy = Math.sin(giro);
  return [x1 * cy + v[2] * sy, y1, -x1 * sy + v[2] * cy];
}

/** Resuelve las 21 articulaciones de una pose. */
export function resolverEsqueleto(p: Pose, m: Medidas = MEDIDAS_24PX): Esqueleto {
  const giro = p.giro ?? 0, incl = p.inclinar ?? 0;
  const raiz: V3 = [p.x ?? 0, 0, 0];
  const pelvis: V3 = [raiz[0], -(m.pelvis - (p.agachar ?? 0)), 0];
  const arriba = (d: number): V3 => rotar([0, -d, 0], giro, incl);
  const cintura = sum(pelvis, arriba(m.espina1));
  const pecho = sum(cintura, arriba(m.espina2));
  const cuello = sum(pecho, arriba(m.cuello));
  const mirada = p.cabeza ?? 0;
  const cabeza = sum(cuello, rotar([0, -m.cabeza * 0.5, 0], giro, incl + mirada));
  const coronilla = sum(cuello, rotar([0, -m.cabeza, 0], giro, incl + mirada));
  const hombro = (lado: 1 | -1): V3 => sum(pecho, rotar([0, m.hombroAlto, lado * m.hombroAncho], giro, incl));
  const cadera = (lado: 1 | -1): V3 => sum(pelvis, rotar([0, m.caderaBaja, lado * m.caderaAncho], giro, 0));
  const hN = hombro(1), hF = hombro(-1), cN = cadera(1), cF = cadera(-1);
  const brazoN = ik2Huesos(hN, sum(raiz, p.manoN), m.brazo, m.antebrazo, [-1, 0.6, 0.2]);
  const brazoF = ik2Huesos(hF, sum(raiz, p.manoF), m.brazo, m.antebrazo, [-1, 0.6, -0.2]);
  const piernaN = ik2Huesos(cN, sum(raiz, p.pieN), m.muslo, m.pierna, [1, 0, 0.1]);
  const piernaF = ik2Huesos(cF, sum(raiz, p.pieF), m.muslo, m.pierna, [1, 0, -0.1]);
  const punta = (t: V3): V3 => sum(t, [m.pie, 0, 0]);
  return {
    raiz, pelvis, cintura, pecho, cuello, cabeza, coronilla,
    hombroN: hN, codoN: brazoN.articulacion, manoN: brazoN.extremo,
    hombroF: hF, codoF: brazoF.articulacion, manoF: brazoF.extremo,
    caderaN: cN, rodillaN: piernaN.articulacion, tobilloN: piernaN.extremo, puntaN: punta(piernaN.extremo),
    caderaF: cF, rodillaF: piernaF.articulacion, tobilloF: piernaF.extremo, puntaF: punta(piernaF.extremo),
  };
}

/** Huesos para dibujar (pares de articulaciones), ordenados de atrás hacia adelante por profundidad media. */
export const HUESOS: ReadonlyArray<readonly [Articulacion, Articulacion]> = [
  ["pelvis", "cintura"], ["cintura", "pecho"], ["pecho", "cuello"], ["cuello", "coronilla"],
  ["pecho", "hombroN"], ["hombroN", "codoN"], ["codoN", "manoN"], ["pecho", "hombroF"], ["hombroF", "codoF"], ["codoF", "manoF"],
  ["pelvis", "caderaN"], ["caderaN", "rodillaN"], ["rodillaN", "tobilloN"], ["tobilloN", "puntaN"],
  ["pelvis", "caderaF"], ["caderaF", "rodillaF"], ["rodillaF", "tobilloF"], ["tobilloF", "puntaF"],
];

export function huesosPorProfundidad(e: Esqueleto): Array<readonly [Articulacion, Articulacion]> {
  return [...HUESOS].sort((a, b) => e[a[0]][2] + e[a[1]][2] - (e[b[0]][2] + e[b[1]][2]));
}

// ---------------------------------------------------------------- Pistas de poses

const lerpV3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerpN = (a: number | undefined, b: number | undefined, t: number): number => (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t;

export function mezclarPoses(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerpN(a.x, b.x, t), agachar: lerpN(a.agachar, b.agachar, t), inclinar: lerpN(a.inclinar, b.inclinar, t), giro: lerpN(a.giro, b.giro, t), cabeza: lerpN(a.cabeza, b.cabeza, t),
    manoN: lerpV3(a.manoN, b.manoN, t), manoF: lerpV3(a.manoF, b.manoF, t), pieN: lerpV3(a.pieN, b.pieN, t), pieF: lerpV3(a.pieF, b.pieF, t),
  };
}

/** Clave de una pista: tiempo, pose y si se salta de golpe ("snap": golpe que llega sin transición). */
export type ClavePose = readonly [t: number, pose: Pose, modo?: "suave" | "snap"];

/**
 * Pose en el tiempo `t` de una pista de claves. `fps` > 0 cuantiza el tiempo a escalones (12 fps da el aspecto de
 * animación dibujada a mano mientras las partículas corren a tasa completa).
 */
export function poseEn(pista: readonly ClavePose[], t: number, fps = 12): Pose {
  if (pista.length === 0) return POSE_DE_PIE;
  const tt = fps > 0 ? Math.floor(t * fps) / fps : t;
  if (tt <= pista[0][0]) return pista[0][1];
  for (let i = 1; i < pista.length; i++) {
    const [t1, p1, modo] = pista[i];
    if (tt < t1) {
      const [t0, p0] = pista[i - 1];
      if (modo === "snap") return p0;
      const k = (tt - t0) / (t1 - t0);
      return mezclarPoses(p0, p1, k * k * (3 - 2 * k));
    }
  }
  return pista[pista.length - 1][1];
}
