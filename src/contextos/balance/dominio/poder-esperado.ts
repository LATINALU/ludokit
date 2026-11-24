// Balance por PODER ESPERADO: en vez de poner a mano la vida y el daño de cada enemigo, se define qué poder se
// espera que tenga el jugador en cada nivel (golpe, vida, defensa, resistencia) y de ahí se derivan los enemigos por
// "golpes para matar" (cuántos golpes del jugador aguanta) y "golpes para morir" (cuántos golpes suyos aguanta el
// jugador). Cambiar la curva del jugador rebalancea TODO el juego de una vez. Los jefes se derivan de una duración
// objetivo de la pelea. Verificar siempre con el simulador (`simularPelea`).
//
// Todo se describe con `Curva` (nucleo/escalado): no hay nivel máximo ni "último piso". Si el juego quiere que el
// crecimiento se frene después de cierto punto, usa `curva.topeSuave(...)`; si quiere dificultad infinita
// exponencial, `curva.exponencial(...)`. No hay reglas por defecto: ver `presets/` para puntos de partida.

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export interface CurvaPoder {
  readonly golpe: Curva;
  readonly vida: Curva;
  readonly defensa: Curva;
  /** Resistencia 0..1 a todo (recortar con `curva.limitar`). */
  readonly resistencia: Curva;
}

export interface Poder {
  readonly golpe: number;
  readonly vida: number;
  readonly defensa: number;
  readonly resistencia: number;
}

export function poderEsperado(c: CurvaPoder, nivel: number): Poder {
  const p = Math.max(1, nivel);
  return {
    golpe: evaluar(c.golpe, p),
    vida: evaluar(c.vida, p),
    defensa: evaluar(c.defensa, p),
    resistencia: Math.min(0.95, Math.max(0, evaluar(c.resistencia, p))),
  };
}

export const mitigacionBalance = (def: number, k: number): number => k / (k + Math.max(0, def));

export interface ReglasBalance {
  /** Golpes del jugador que aguanta un enemigo común. */
  readonly golpesParaMatar: number;
  /** Golpes de un común que aguanta el jugador. */
  readonly golpesParaMorir: number;
  /** k de la defensa de los enemigos (defensa = k → mitad de daño). */
  readonly kEnemigo: number;
  /** k de la defensa del jugador = max(minimo, factor × defensa esperada): la defensa escala con el nivel. */
  readonly kJugadorFactor: number;
  readonly kJugadorMin: number;
  /** Defensa y experiencia de un enemigo común según el nivel. */
  readonly defensaEnemigo: Curva;
  readonly expEnemigo: Curva;
  /** Golpes por segundo que el jugador conecta (para la duración de los jefes). */
  readonly ritmoJugador: number;
  /** Segundos que debería durar un jefe según el nivel. */
  readonly duracionJefe: Curva;
  /** Golpes del jefe que aguanta el jugador según el nivel. */
  readonly aguanteJefe: Curva;
  readonly defensaJefe: Curva;
  readonly expJefe: Curva;
  /** Multiplicador de vida del jefe (fases, curaciones, tiempo sin poder pegar). */
  readonly multVidaJefe: number;
}

export interface StatsEnemigo {
  readonly vida: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
}

/**
 * Modelo de balance: curva del jugador + reglas de derivación. Un objeto por juego (o por modo: normal, difícil,
 * temporada). Todas las consultas aceptan cualquier nivel ≥ 1.
 */
export class ModeloBalance {
  readonly curva: CurvaPoder;
  readonly reglas: ReglasBalance;

  constructor(curva: CurvaPoder, reglas: ReglasBalance) {
    this.curva = curva;
    this.reglas = reglas;
  }

  poder(nivel: number): Poder {
    return poderEsperado(this.curva, nivel);
  }

  kJugador(nivel: number): number {
    return Math.max(this.reglas.kJugadorMin, this.reglas.kJugadorFactor * this.poder(nivel).defensa);
  }

  /** Fracción del daño enemigo que le llega al jugador típico de ese nivel. */
  pasaAlJugador(nivel: number): number {
    const pe = this.poder(nivel);
    return mitigacionBalance(pe.defensa, this.kJugador(nivel)) * (1 - pe.resistencia);
  }

  /** Enemigo común del nivel, multiplicado por el peso del arquetipo (tanque 1.6 vida, frágil 0.6...). */
  enemigo(nivel: number, pesoVida = 1, pesoAtaque = 1): StatsEnemigo {
    const r = this.reglas;
    const n = Math.max(1, nivel);
    const pe = this.poder(n);
    const defensa = evaluar(r.defensaEnemigo, n);
    const golpeContra = pe.golpe * mitigacionBalance(defensa, r.kEnemigo);
    return {
      vida: Math.round(r.golpesParaMatar * golpeContra * pesoVida),
      ataque: Math.round((pe.vida / (r.golpesParaMorir * this.pasaAlJugador(n))) * pesoAtaque),
      defensa: Math.round(defensa),
      exp: Math.round(evaluar(r.expEnemigo, n)),
    };
  }

  /** Jefe derivado de una duración objetivo de la pelea y de cuántos golpes suyos aguanta el jugador. */
  jefe(nivel: number, peso = 1): StatsEnemigo & { duracion: number } {
    const r = this.reglas;
    const n = Math.max(1, nivel);
    const pe = this.poder(n);
    const defensa = evaluar(r.defensaJefe, n);
    const duracion = evaluar(r.duracionJefe, n);
    const aguante = Math.max(1, evaluar(r.aguanteJefe, n));
    return {
      vida: Math.round(pe.golpe * mitigacionBalance(defensa, r.kEnemigo) * r.ritmoJugador * duracion * peso * r.multVidaJefe),
      ataque: Math.round(pe.vida / (aguante * this.pasaAlJugador(n))),
      defensa: Math.round(defensa),
      exp: Math.round(evaluar(r.expJefe, n)),
      duracion,
    };
  }

  /** Tabla nivel a nivel (herramientas de diseño, exportar a planilla). */
  tabla(desde: number, hasta: number): Array<{ nivel: number; jugador: Poder; enemigo: StatsEnemigo; jefe: StatsEnemigo & { duracion: number } }> {
    const t = [];
    for (let n = desde; n <= hasta; n++) t.push({ nivel: n, jugador: this.poder(n), enemigo: this.enemigo(n), jefe: this.jefe(n) });
    return t;
  }
}

/** Puntaje de equipo recomendado para entrar a un nivel (curva del juego) y veredicto para la interfaz. */
export function veredicto(tengo: number, requerido: number, justo = 0.75): "listo" | "justo" | "peligroso" {
  return requerido <= 0 || tengo >= requerido ? "listo" : tengo >= requerido * justo ? "justo" : "peligroso";
}

export interface Peleador {
  readonly vida: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly k: number;
  /** Golpes por segundo. */
  readonly ritmo: number;
}

/** Simulación "en números" sin azar: cuántos golpes y segundos tarda cada uno en caer. */
export function simularPelea(a: Peleador, b: Peleador): { golpesAaB: number; golpesBaA: number; segundosA: number; segundosB: number; gana: "a" | "b" } {
  const danioA = Math.max(1, a.ataque * mitigacionBalance(b.defensa, b.k));
  const danioB = Math.max(1, b.ataque * mitigacionBalance(a.defensa, a.k));
  const golpesAaB = Math.ceil(b.vida / danioA);
  const golpesBaA = Math.ceil(a.vida / danioB);
  const segundosA = golpesAaB / a.ritmo;
  const segundosB = golpesBaA / b.ritmo;
  return { golpesAaB, golpesBaA, segundosA, segundosB, gana: segundosA <= segundosB ? "a" : "b" };
}
