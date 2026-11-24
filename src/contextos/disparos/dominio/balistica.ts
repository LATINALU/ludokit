// Balística y resolución de impactos:
//   - CAÍDA DE DAÑO por distancia (tramos: pleno hasta X m, baja lineal hasta Y m, mínimo después).
//   - ZONAS de impacto con multiplicador (cabeza, torso, brazos, piernas) y zona → parte del cuerpo con vida propia
//     (sistemas de salud por partes, como en los simuladores de extracción).
//   - BLINDAJE por CLASES y PENETRACIÓN de la munición: si la penetración supera la clase, entra casi todo; si no,
//     el chaleco absorbe y pierde durabilidad (con daño contundente que pasa igual). Probabilidad de penetrar con
//     transición suave alrededor de la clase. Todo por datos (`datos/armas` trae un catálogo propio de ejemplo).
//   - PENETRACIÓN DE MATERIALES: una bala atraviesa paredes finas perdiendo poder según el material y el espesor.
//   - PROYECTIL 3D con gravedad y arrastre (francotiradores, arcos, granadas) integrado en sub-pasos.

import type { Azar } from "../../../nucleo/azar.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";
import { v3, vec3, type V3 } from "../../../nucleo/vec3.ts";
import { lanzarRayoTodos, type Colisionador3D, type ImpactoEscena } from "../../../espacial/colision3d.ts";

/** Multiplicador de daño según la distancia (m) con una curva de tramos: [[0,1],[20,1],[60,0.6]]. */
export const caidaDanio = (c: Curva, distancia: number): number => Math.max(0, evaluar(c, distancia));

export interface DefZona {
  readonly mult: number;
  /** Parte del cuerpo con vida propia (opcional). */
  readonly parte?: string;
  /** Clase de blindaje que cubre esta zona ("casco", "chaleco"...). */
  readonly cubre?: string;
}

/** Zonas estándar de un humanoide (el juego puede cambiar los números). */
export type MapaZonas = Readonly<Record<string, DefZona>>;

export interface Municion {
  readonly id: string;
  readonly danio: number;
  /** Penetración de blindaje (misma escala que la clase × 10: clase 4 ≈ penetración 40). */
  readonly penetracion: number;
  /** Fracción del daño que va al blindaje (desgaste). */
  readonly danioBlindaje: number;
  /** Probabilidad de causar sangrado / fractura (supervivencia). */
  readonly sangrado?: number;
  readonly fractura?: number;
  /** m/s en la boca del cañón (balística y tiempo de vuelo). */
  readonly velocidad?: number;
  /** Proyectiles por disparo (perdigones). */
  readonly proyectiles?: number;
}

export interface Blindaje {
  readonly clase: number;
  durabilidad: number;
  readonly durabilidadMax: number;
  /** Cuánto se desgasta por punto de daño de blindaje (materiales: cerámica alta, aramida baja). */
  readonly desgaste: number;
  /** Fracción del daño que pasa como contundente cuando NO penetra. */
  readonly contundente: number;
}

/**
 * Probabilidad de penetrar: con penetración ≥ clase·10 + 15 casi seguro; ≤ clase·10 − 15 casi nunca; en el medio,
 * transición suave. La durabilidad baja reduce la clase efectiva (un chaleco roto protege menos).
 */
export function probPenetrar(penetracion: number, b: Blindaje): number {
  if (b.durabilidad <= 0) return 1;
  const efectiva = b.clase * 10 * (0.5 + 0.5 * (b.durabilidad / b.durabilidadMax));
  const x = (penetracion - efectiva) / 15;
  return Math.min(1, Math.max(0, 0.5 + 0.5 * x));
}

export interface ResultadoBlindaje {
  readonly penetro: boolean;
  readonly danio: number;
  readonly desgaste: number;
}

/** Aplica una bala contra un blindaje (muta su durabilidad). Sin blindaje: daño completo. */
export function resolverBlindaje(danio: number, m: Municion, b: Blindaje | undefined, azar: Azar): ResultadoBlindaje {
  if (!b || b.durabilidad <= 0) return { penetro: true, danio, desgaste: 0 };
  const penetro = azar.siguiente() < probPenetrar(m.penetracion, b);
  const desgaste = Math.min(b.durabilidad, danio * m.danioBlindaje * b.desgaste * (penetro ? 0.5 : 1));
  b.durabilidad -= desgaste;
  return { penetro, danio: penetro ? danio * (1 - 0.1 * Math.min(1, b.clase / 6)) : danio * b.contundente, desgaste };
}

/** Pérdida de poder al atravesar un material: [poder perdido por cm]. 1 = poder 100 → 0 en 100 cm. */
export type TablaMateriales = Readonly<Record<string, number>>;

export interface ImpactoBala {
  readonly colisionador: Colisionador3D;
  readonly punto: V3;
  readonly distancia: number;
  readonly danio: number;
  readonly zona?: string;
}

/**
 * Hitscan con penetración: recorre los impactos en orden; los personajes reciben daño (zona por etiqueta) y las
 * superficies con material (etiqueta "mundo:<material>:<espesorCm>") restan poder. Se corta al quedar sin poder
 * o al pegar en algo impenetrable. `poder` inicial = penetración de la munición.
 */
export function resolverDisparo(
  escena: readonly Colisionador3D[],
  origen: V3,
  dir: V3,
  op: { alcance: number; danio: number; caida?: Curva; zonas?: MapaZonas; materiales?: TablaMateriales; poder?: number; tirador?: number },
): ImpactoBala[] {
  const imp: ImpactoBala[] = [];
  let poder = op.poder ?? 0;
  const tocados = new Set<number>();
  for (const h of lanzarRayoTodos(escena, { origen, dir: vec3.normalizar(dir), largo: op.alcance }, op.tirador)) {
    const et = h.colisionador.etiqueta ?? "mundo";
    if (et.startsWith("mundo")) {
      const [, mat, esp] = et.split(":");
      const perdida = mat && op.materiales?.[mat] !== undefined ? op.materiales[mat] * Number(esp ?? 1) : Infinity;
      poder -= perdida;
      imp.push({ colisionador: h.colisionador, punto: h.punto, distancia: h.t, danio: 0 });
      if (poder <= 0) break;
      continue;
    }
    // Un personaje recibe un solo impacto por bala aunque el rayo cruce varias de sus zonas (la primera).
    const duenio = h.colisionador.duenio ?? h.colisionador.id;
    if (tocados.has(duenio)) continue;
    tocados.add(duenio);
    const z = op.zonas?.[et];
    const danio = op.danio * (z?.mult ?? 1) * (op.caida ? caidaDanio(op.caida, h.t) : 1) * (op.poder !== undefined && op.poder > 0 ? Math.max(0.2, poder / op.poder) : 1);
    imp.push({ colisionador: h.colisionador, punto: h.punto, distancia: h.t, danio, zona: z ? et : undefined });
    if (op.poder === undefined) break; // sin penetración: la bala se queda en el primero
    poder -= 25;
    if (poder <= 0) break;
  }
  return imp;
}

export interface EstadoProyectil3D {
  pos: V3;
  vel: V3;
  vivo: boolean;
  tiempo: number;
}

/** Proyectil balístico: gravedad (m/s²) y arrastre (fracción de velocidad perdida por segundo). */
export function avanzarProyectil3D(p: EstadoProyectil3D, dt: number, gravedad = 9.81, arrastre = 0, escena?: readonly Colisionador3D[]): ImpactoEscena | null {
  if (!p.vivo) return null;
  const nv = vec3.escalar(vec3.sumar(p.vel, v3(0, -gravedad * dt, 0)), Math.max(0, 1 - arrastre * dt));
  const delta = vec3.escalar(vec3.lerp(p.vel, nv, 0.5), dt);
  const largo = vec3.largo(delta);
  let hit: ImpactoEscena | null = null;
  if (escena && largo > 0) {
    const r = lanzarRayoTodos(escena, { origen: p.pos, dir: vec3.escalar(delta, 1 / largo), largo });
    hit = r[0] ?? null;
  }
  p.vel = nv;
  p.tiempo += dt;
  if (hit) {
    p.pos = hit.punto;
    p.vivo = false;
    return hit;
  }
  p.pos = vec3.sumar(p.pos, delta);
  return null;
}

/** Ángulo de elevación (rad) para acertar a `distancia` horizontal con caída `altura` y velocidad `v` (null = no llega). */
export function anguloDeTiro(v: number, distancia: number, altura = 0, g = 9.81, alto = false): number | null {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * distancia * distancia + 2 * altura * v2);
  if (disc < 0) return null;
  const r = Math.sqrt(disc);
  return Math.atan((v2 + (alto ? r : -r)) / (g * distancia));
}

/** Adelanto: punto al que apuntar para pegarle a un blanco que se mueve a velocidad constante. */
export function puntoDeAdelanto(tirador: V3, blanco: V3, velBlanco: V3, velBala: number): V3 | null {
  const d = vec3.restar(blanco, tirador);
  const a = vec3.punto(velBlanco, velBlanco) - velBala * velBala;
  const b = 2 * vec3.punto(d, velBlanco);
  const c = vec3.punto(d, d);
  let t: number;
  if (Math.abs(a) < 1e-9) t = -c / b;
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t > 0)) return null;
  return vec3.sumarEscalado(blanco, velBlanco, t);
}
