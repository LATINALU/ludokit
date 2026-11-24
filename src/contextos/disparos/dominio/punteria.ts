// Puntería: DISPERSIÓN (cono de imprecisión), RETROCESO (la mira sube y se desvía) y ASISTENCIA de apuntado.
//
// Dispersión = base × multiplicador de postura (quieto, caminando, corriendo, en el aire, agachado, apuntando)
//              + BLOOM (cada disparo agranda el cono; se recupera con el tiempo), recortada a un máximo.
// Retroceso  = patrón por disparo (fijo, aprendible, estilo shooter competitivo) o aleatorio acotado, con
//              RECUPERACIÓN (la mira vuelve sola cuando se deja de disparar) y control (atenúa el patrón).
// Asistencia = FRICCIÓN (la sensibilidad baja sobre un objetivo) e IMÁN (la mira se corre hacia el objetivo),
//              ambas dentro de un cono y con alcance máximo. Para mando; en ratón se suele apagar.

import type { Azar } from "../../../nucleo/azar.ts";
import { vec3, type V3 } from "../../../nucleo/vec3.ts";

export type Postura = "quieto" | "caminando" | "corriendo" | "aire" | "agachado" | "apuntando";

export interface DefDispersion {
  /** Semiapertura del cono quieto, en grados. */
  readonly base: number;
  readonly postura?: Partial<Record<Postura, number>>;
  /** Grados que suma cada disparo y grados por segundo que recupera. */
  readonly bloomPorDisparo: number;
  readonly recuperacion: number;
  readonly maxima: number;
  /** El primer disparo tras estar quieto es perfecto (rifles de precisión, tiro táctico). */
  readonly primerTiroPerfecto?: boolean;
}

export class Dispersion {
  readonly def: DefDispersion;
  bloom = 0;
  private quieto = 0;

  constructor(def: DefDispersion) {
    this.def = def;
  }

  /** Semiapertura actual en grados. */
  actual(postura: Postura): number {
    const m = this.def.postura?.[postura] ?? 1;
    return Math.min(this.def.maxima, this.def.base * m + this.bloom);
  }

  /** Dirección del disparo dentro del cono (radianes internamente). Registra el bloom. */
  disparar(dir: V3, postura: Postura, azar: Azar): V3 {
    const perfecto = this.def.primerTiroPerfecto && this.bloom === 0 && this.quieto > 0.25;
    const grados = perfecto ? 0 : this.actual(postura);
    this.bloom = Math.min(this.def.maxima, this.bloom + this.def.bloomPorDisparo);
    this.quieto = 0;
    if (grados <= 0) return vec3.normalizar(dir);
    const ang = (grados * Math.PI) / 180 * Math.sqrt(azar.siguiente());
    return vec3.enCono(dir, ang, azar.siguiente() * Math.PI * 2);
  }

  /** Direcciones de los perdigones de una escopeta (cada uno en el cono). */
  perdigones(dir: V3, n: number, postura: Postura, azar: Azar): V3[] {
    const grados = this.actual(postura);
    const r: V3[] = [];
    for (let i = 0; i < n; i++) r.push(vec3.enCono(dir, ((grados * Math.PI) / 180) * Math.sqrt(azar.siguiente()), azar.siguiente() * Math.PI * 2));
    this.bloom = Math.min(this.def.maxima, this.bloom + this.def.bloomPorDisparo);
    this.quieto = 0;
    return r;
  }

  actualizar(dt: number): void {
    this.bloom = Math.max(0, this.bloom - this.def.recuperacion * dt);
    this.quieto += dt;
  }
}

export interface DefRetroceso {
  /** Patrón [arriba°, lado°] por número de disparo (se repite el último). Vacío = solo aleatorio. */
  readonly patron?: ReadonlyArray<readonly [number, number]>;
  /** Componente aleatoria: arriba ± y lado ± en grados. */
  readonly vertical: number;
  readonly horizontal: number;
  /** Grados por segundo que vuelve la mira al dejar de disparar, y retraso antes de volver. */
  readonly recuperacion: number;
  readonly retrasoRecuperacion?: number;
  /** Fracción del retroceso acumulado que se recupera (0 = nada, 1 = vuelve al punto inicial). */
  readonly fraccionRecuperable?: number;
}

/** Retroceso acumulado (pitch/yaw en grados) que la cámara suma a la mira del jugador. */
export class Retroceso {
  readonly def: DefRetroceso;
  pitch = 0;
  yaw = 0;
  private recuperable = 0;
  private recuperableYaw = 0;
  private desde = 0;

  constructor(def: DefRetroceso) {
    this.def = def;
  }

  /** Patada del disparo número `n` (1 = primero). `control` 0..1 atenúa (accesorios, habilidad). */
  disparar(n: number, azar: Azar, control = 0): { pitch: number; yaw: number } {
    const p = this.def.patron;
    const base = p && p.length ? p[Math.min(p.length - 1, n - 1)] : [0, 0];
    const atenuar = 1 - Math.min(0.95, Math.max(0, control));
    const dp = (base[0] + this.def.vertical * azar.siguiente()) * atenuar;
    const dy = (base[1] + this.def.horizontal * (azar.siguiente() * 2 - 1)) * atenuar;
    this.pitch += dp;
    this.yaw += dy;
    const f = this.def.fraccionRecuperable ?? 1;
    this.recuperable += dp * f;
    this.recuperableYaw += dy * f;
    this.desde = 0;
    return { pitch: dp, yaw: dy };
  }

  /** Devuelve cuánto vuelve la mira este paso (restar a la cámara). */
  actualizar(dt: number): { pitch: number; yaw: number } {
    this.desde += dt;
    if (this.desde < (this.def.retrasoRecuperacion ?? 0.08) || this.recuperable <= 0) return { pitch: 0, yaw: 0 };
    const vuelve = Math.min(this.recuperable, this.def.recuperacion * dt);
    const k = this.recuperable > 0 ? vuelve / this.recuperable : 0;
    const vy = this.recuperableYaw * k;
    this.recuperable -= vuelve;
    this.recuperableYaw -= vy;
    this.pitch -= vuelve;
    this.yaw -= vy;
    return { pitch: vuelve, yaw: vy };
  }
}

export interface DefAsistencia {
  /** Semiapertura del cono en grados y alcance máximo. */
  readonly cono: number;
  readonly alcance: number;
  /** Multiplicador de sensibilidad sobre el objetivo (0.5 = la mitad). */
  readonly friccion: number;
  /** Fracción del ángulo al objetivo que la mira se corre por segundo (imán). */
  readonly iman: number;
}

export interface ObjetivoAsistencia {
  readonly id: number;
  readonly pos: V3;
}

/** Elige el objetivo más alineado dentro del cono y devuelve la fricción y la nueva dirección (con imán). */
export function asistirMira(origen: V3, dir: V3, objetivos: readonly ObjetivoAsistencia[], d: DefAsistencia, dt: number): { objetivo: number | null; sensibilidad: number; dir: V3 } {
  let mejor: ObjetivoAsistencia | null = null;
  let mejorAng = (d.cono * Math.PI) / 180;
  for (const o of objetivos) {
    const hacia = vec3.restar(o.pos, origen);
    const dist = vec3.largo(hacia);
    if (dist > d.alcance || dist < 1e-6) continue;
    const a = vec3.angulo(dir, hacia);
    if (a < mejorAng) {
      mejorAng = a;
      mejor = o;
    }
  }
  if (!mejor) return { objetivo: null, sensibilidad: 1, dir };
  const hacia = vec3.normalizar(vec3.restar(mejor.pos, origen));
  const t = Math.min(1, d.iman * dt);
  return { objetivo: mejor.id, sensibilidad: d.friccion, dir: vec3.normalizar(vec3.lerp(vec3.normalizar(dir), hacia, t)) };
}
