// Cálculo de daño con tipos y resistencias, en un orden documentado (el orden importa tanto como los números):
//   1. bruto      = ataque × multiplicador del golpe
//   2. variación  = × U(1 − var, 1 + var)
//   3. crítico    = × multCritico si U < probCritico
//   4. defensa    = × k / (k + max(0, defensa − penetración))        (rendimiento decreciente: def = k → mitad)
//   5. resistencia= × (1 − clamp(resist[tipo] − penetraciónResist, −topeNeg, topePos))  (negativa = vulnerable)
//   6. reducción  = × (1 − clamp(reducciónGeneral, 0, topeReduccion))
//   7. bloqueo    = × (1 − bloqueo) si bloqueó
//   8. mínimo 1 (si no es inmune) y redondeo
// Puro y determinista con `Azar` inyectado: el servidor y el cliente obtienen el mismo número.

import type { Azar } from "../../../nucleo/azar.ts";

export interface Golpe {
  readonly ataque: number;
  readonly mult?: number;
  readonly tipo?: string;
  readonly probCritico?: number;
  readonly multCritico?: number;
  readonly variacion?: number;
  readonly penetracion?: number;
  readonly penetracionResist?: number;
  /** Ignora defensa (daño verdadero). */
  readonly verdadero?: boolean;
}

export interface Defensor {
  readonly defensa?: number;
  readonly resistencias?: Readonly<Record<string, number>>;
  readonly reduccion?: number;
  readonly bloqueo?: number;
  readonly bloqueando?: boolean;
  readonly inmune?: boolean;
}

export interface ReglasDanio {
  /** Defensa que reduce el daño a la mitad. Escalar con el nivel para que la defensa nunca sea inútil ni total. */
  readonly k: number;
  readonly topeResistencia: number;
  readonly topeVulnerabilidad: number;
  readonly topeReduccion: number;
}

export const REGLAS_DANIO: ReglasDanio = { k: 60, topeResistencia: 0.75, topeVulnerabilidad: 1, topeReduccion: 0.35 };

export interface ResultadoDanio {
  readonly danio: number;
  readonly critico: boolean;
  readonly bloqueado: boolean;
  readonly tipo: string;
  /** Daño antes de defensa y resistencias (para mostrar "mitigado"). */
  readonly bruto: number;
}

export function mitigacion(defensa: number, k: number): number {
  return k / (k + Math.max(0, defensa));
}

export function calcularDanio(g: Golpe, d: Defensor, azar: Azar, r: ReglasDanio = REGLAS_DANIO): ResultadoDanio {
  const tipo = g.tipo ?? "fisico";
  if (d.inmune) return { danio: 0, critico: false, bloqueado: false, tipo, bruto: 0 };
  let v = g.ataque * (g.mult ?? 1);
  const varia = g.variacion ?? 0.1;
  if (varia > 0) v *= 1 - varia + azar.siguiente() * 2 * varia;
  const critico = (g.probCritico ?? 0) > 0 && azar.siguiente() < (g.probCritico ?? 0);
  if (critico) v *= g.multCritico ?? 1.75;
  const bruto = v;
  if (!g.verdadero) {
    v *= mitigacion((d.defensa ?? 0) - (g.penetracion ?? 0), r.k);
    const res = (d.resistencias?.[tipo] ?? 0) - (g.penetracionResist ?? 0);
    v *= 1 - Math.max(-r.topeVulnerabilidad, Math.min(r.topeResistencia, res));
    v *= 1 - Math.max(0, Math.min(r.topeReduccion, d.reduccion ?? 0));
  }
  const bloqueado = !!d.bloqueando && (d.bloqueo ?? 0) > 0;
  if (bloqueado) v *= 1 - Math.min(1, d.bloqueo ?? 0);
  const danio = bloqueado && (d.bloqueo ?? 0) >= 1 ? 0 : Math.max(1, Math.round(v));
  return { danio, critico, bloqueado, tipo, bruto };
}

/** Daño esperado sin azar (para simuladores de balance y tooltips "daño promedio"). */
export function danioEsperado(g: Golpe, d: Defensor, r: ReglasDanio = REGLAS_DANIO): number {
  const pc = Math.min(1, g.probCritico ?? 0);
  let v = g.ataque * (g.mult ?? 1) * (1 + pc * ((g.multCritico ?? 1.75) - 1));
  if (!g.verdadero) {
    v *= mitigacion((d.defensa ?? 0) - (g.penetracion ?? 0), r.k);
    const res = (d.resistencias?.[g.tipo ?? "fisico"] ?? 0) - (g.penetracionResist ?? 0);
    v *= 1 - Math.max(-r.topeVulnerabilidad, Math.min(r.topeResistencia, res));
    v *= 1 - Math.max(0, Math.min(r.topeReduccion, d.reduccion ?? 0));
  }
  return v;
}

/** Robo de vida desde una reserva por segundo (evita que combinar robo vuelva inmortal al jugador). */
export class RoboDeVida {
  private reserva: number;
  readonly porSegundo: number;
  readonly tope: number;

  constructor(porSegundo: number, tope = 0.06) {
    this.porSegundo = porSegundo;
    this.reserva = porSegundo;
    this.tope = tope;
  }

  /** Curación por un golpe de `danio` con `porcentaje` de robo. */
  curar(danio: number, porcentaje: number): number {
    const quiere = danio * Math.min(this.tope, porcentaje);
    const da = Math.min(quiere, this.reserva);
    this.reserva -= da;
    return da;
  }

  actualizar(dt: number): void {
    this.reserva = Math.min(this.porSegundo, this.reserva + this.porSegundo * dt);
  }
}
