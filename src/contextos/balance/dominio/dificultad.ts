// Dificultad SIN TOPE y escalado al jugador:
//   - `NivelesDificultad`: niveles infinitos (portales, mazmorras con llave, tormentos) donde vida y daño de los
//     enemigos crecen con una curva (normalmente exponencial) y el botín/experiencia acompañan con otra. Incluye la
//     regla de progreso: completar a tiempo sube N niveles según el margen; fallar baja.
//   - `escalarAlJugador`: mundo abierto donde los enemigos se ajustan al nivel del jugador dentro de un rango de la
//     zona (sin que nunca deje de sentirse el progreso: `fraccionProgreso`).
//   - `dificultadAdaptativa`: director que ajusta un multiplicador según el rendimiento reciente (muertes, tiempo).
//   - `escalarPorJugadores`: vida/daño de enemigos según cuántos jugadores hay (cooperativo).

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export interface ReglasNivelesDificultad {
  readonly vida: Curva;
  readonly danio: Curva;
  readonly botin: Curva;
  readonly experiencia: Curva;
  /** Tiempo objetivo (s) para completar. */
  readonly tiempo: Curva;
  /** [fracción de tiempo sobrante mínima, niveles que sube] de mayor a menor; fallar = `alFallar`. */
  readonly ascenso: ReadonlyArray<readonly [number, number]>;
  readonly alFallar: number;
}

export class NivelesDificultad {
  readonly reglas: ReglasNivelesDificultad;
  mejor = 0;
  constructor(reglas: ReglasNivelesDificultad) {
    this.reglas = reglas;
  }

  multiplicadores(nivel: number): { vida: number; danio: number; botin: number; experiencia: number; tiempo: number } {
    const n = Math.max(1, nivel);
    const r = this.reglas;
    return { vida: evaluar(r.vida, n), danio: evaluar(r.danio, n), botin: evaluar(r.botin, n), experiencia: evaluar(r.experiencia, n), tiempo: evaluar(r.tiempo, n) };
  }

  /** Resultado de una corrida: devuelve el nivel siguiente sugerido y actualiza el récord. */
  completar(nivel: number, segundos: number, exito: boolean): number {
    const total = evaluar(this.reglas.tiempo, Math.max(1, nivel));
    let sube = this.reglas.alFallar;
    if (exito && segundos <= total) {
      const f = (total - segundos) / total;
      sube = 0;
      for (const [min, n] of this.reglas.ascenso) if (f >= min) { sube = n; break; }
      this.mejor = Math.max(this.mejor, nivel);
    }
    return Math.max(1, nivel + sube);
  }
}

/** Nivel efectivo de un enemigo en una zona [min, max] que escala al jugador. `fraccionProgreso` 0..1: 1 = siempre igual al jugador; 0.8 = el jugador conserva ventaja al subir. */
export function escalarAlJugador(nivelJugador: number, zonaMin: number, zonaMax: number, fraccionProgreso = 1, desplazamiento = 0): number {
  const objetivo = zonaMin + (nivelJugador - zonaMin) * fraccionProgreso + desplazamiento;
  return Math.round(Math.min(zonaMax, Math.max(zonaMin, objetivo)));
}

/** Multiplicadores por cantidad de jugadores (cooperativo): curvas sobre n = jugadores. */
export function escalarPorJugadores(jugadores: number, vida: Curva, danio: Curva): { vida: number; danio: number } {
  const n = Math.max(1, jugadores);
  return { vida: evaluar(vida, n), danio: evaluar(danio, n) };
}

/**
 * Dificultad adaptativa: mantiene un multiplicador en [min, max] que sube cuando al jugador le va bien y baja cuando
 * muere seguido. Nunca cambia de golpe (paso máximo por evento).
 */
export class DificultadAdaptativa {
  valor: number;
  readonly min: number;
  readonly max: number;
  readonly paso: number;

  constructor(inicial = 1, min = 0.6, max = 1.6, paso = 0.05) {
    this.valor = inicial;
    this.min = min;
    this.max = max;
    this.paso = paso;
  }

  private mover(d: number): number {
    this.valor = Math.min(this.max, Math.max(this.min, this.valor + d));
    return this.valor;
  }

  /** El jugador murió. */
  muerte(): number {
    return this.mover(-this.paso * 2);
  }

  /** Superó un desafío; `sinDanio` sube más. */
  exito(sinDanio = false): number {
    return this.mover(this.paso * (sinDanio ? 1.5 : 1));
  }

  /** Se demoró mucho en un tramo (frustración). */
  atascado(): number {
    return this.mover(-this.paso);
  }
}
