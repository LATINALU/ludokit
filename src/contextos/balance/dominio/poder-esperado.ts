// Balance por PODER ESPERADO: en vez de poner a mano la vida y el daño de cada enemigo, se define qué poder se
// espera que tenga el jugador en cada nivel (golpe, vida, defensa) y de ahí se derivan los enemigos por
// "golpes para matar" (cuántos golpes del jugador aguanta) y "golpes para morir" (cuántos golpes suyos aguanta el
// jugador). Cambiar la curva del jugador rebalancea TODO el juego de una vez. Los jefes se derivan de una duración
// objetivo de la pelea. Verificar siempre con el simulador (`simularPelea`).

export interface CurvaPoder {
  /** Golpe del jugador = golpe·n^expGolpe; vida = vida·n^expVida; defensa = defensa·n^expDefensa. */
  readonly golpe: number;
  readonly expGolpe: number;
  readonly vida: number;
  readonly expVida: number;
  readonly defensa: number;
  readonly expDefensa: number;
  /** Nivel a partir del cual la curva crece más lento (contenido infinito). */
  readonly nivelTope: number;
  readonly expPasado: number;
  readonly resistenciaPorNivel: number;
  readonly resistenciaMax: number;
}

export const CURVA_PODER_ESTANDAR: CurvaPoder = {
  golpe: 30, expGolpe: 0.93, vida: 115, expVida: 0.78, defensa: 12, expDefensa: 0.92,
  nivelTope: 24, expPasado: 0.8, resistenciaPorNivel: 0.005, resistenciaMax: 0.12,
};

export interface Poder {
  readonly golpe: number;
  readonly vida: number;
  readonly defensa: number;
  readonly resistencia: number;
}

export function poderEsperado(nivel: number, c: CurvaPoder = CURVA_PODER_ESTANDAR): Poder {
  const p = Math.max(1, nivel);
  const q = Math.min(p, c.nivelTope);
  const hondo = p > c.nivelTope ? Math.pow(p / c.nivelTope, c.expPasado) : 1;
  return {
    golpe: c.golpe * Math.pow(q, c.expGolpe) * hondo,
    vida: c.vida * Math.pow(q, c.expVida) * hondo,
    defensa: c.defensa * Math.pow(q, c.expDefensa) * (p > c.nivelTope ? p / c.nivelTope : 1),
    resistencia: Math.min(c.resistenciaMax, c.resistenciaPorNivel * p),
  };
}

const mit = (def: number, k: number): number => k / (k + Math.max(0, def));

export interface ReglasBalance {
  /** Golpes del jugador que aguanta un enemigo común. */
  readonly golpesParaMatar: number;
  /** Golpes de un común que aguanta el jugador. */
  readonly golpesParaMorir: number;
  /** k de la defensa de los enemigos. */
  readonly kEnemigo: number;
  /** k de la defensa del jugador = max(minimo, factor × defensa esperada): la defensa escala con el nivel. */
  readonly kJugadorFactor: number;
  readonly kJugadorMin: number;
  /** Defensa de los comunes = base + porNivel × (nivel − 1). */
  readonly defensaBase: number;
  readonly defensaPorNivel: number;
  /** Golpes por segundo que el jugador conecta (para la duración de los jefes). */
  readonly ritmoJugador: number;
  readonly duracionJefeBase: number;
  readonly duracionJefePorNivel: number;
  readonly aguanteJefeInicial: number;
  readonly aguanteJefeMin: number;
  readonly multVidaJefe: number;
}

export const REGLAS_BALANCE: ReglasBalance = {
  golpesParaMatar: 6, golpesParaMorir: 11, kEnemigo: 60, kJugadorFactor: 1.5, kJugadorMin: 30,
  defensaBase: 1, defensaPorNivel: 0.45, ritmoJugador: 2, duracionJefeBase: 48, duracionJefePorNivel: 1.8,
  aguanteJefeInicial: 7, aguanteJefeMin: 5.5, multVidaJefe: 1.6 * 1.2 * 2,
};

export const kJugador = (nivel: number, r: ReglasBalance = REGLAS_BALANCE, c: CurvaPoder = CURVA_PODER_ESTANDAR): number =>
  Math.max(r.kJugadorMin, r.kJugadorFactor * poderEsperado(nivel, c).defensa);

/** Fracción del daño enemigo que le llega al jugador típico de ese nivel. */
export function pasaAlJugador(nivel: number, r: ReglasBalance = REGLAS_BALANCE, c: CurvaPoder = CURVA_PODER_ESTANDAR): number {
  const pe = poderEsperado(nivel, c);
  return mit(pe.defensa, kJugador(nivel, r, c)) * (1 - pe.resistencia);
}

export interface StatsEnemigo {
  readonly vida: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
}

/** Enemigo común del nivel, multiplicado por el peso del arquetipo (tanque 1.6 vida, frágil 0.6...). */
export function enemigoEsperado(nivel: number, pesoVida = 1, pesoAtaque = 1, r: ReglasBalance = REGLAS_BALANCE, c: CurvaPoder = CURVA_PODER_ESTANDAR): StatsEnemigo {
  const p = Math.max(0, nivel - 1);
  const pe = poderEsperado(nivel, c);
  const defensa = r.defensaBase + r.defensaPorNivel * p;
  const golpeContra = pe.golpe * mit(defensa, r.kEnemigo);
  return {
    vida: Math.round(r.golpesParaMatar * golpeContra * pesoVida),
    ataque: Math.round((pe.vida / (r.golpesParaMorir * pasaAlJugador(nivel, r, c))) * pesoAtaque),
    defensa: Math.round(defensa),
    exp: Math.round(1 + 0.8 * p),
  };
}

/** Jefe derivado de una duración objetivo de la pelea y de cuántos golpes suyos aguanta el jugador. */
export function jefeEsperado(nivel: number, peso = 1, r: ReglasBalance = REGLAS_BALANCE, c: CurvaPoder = CURVA_PODER_ESTANDAR): StatsEnemigo & { duracion: number } {
  const p = Math.max(1, nivel);
  const pe = poderEsperado(p, c);
  const defensa = 6 * (1 + 0.3 * (p - 1));
  const duracion = r.duracionJefeBase + r.duracionJefePorNivel * p;
  const aguante = Math.max(r.aguanteJefeMin, r.aguanteJefeInicial - (p - 1) / 6);
  return {
    vida: Math.round(pe.golpe * mit(defensa, r.kEnemigo) * r.ritmoJugador * duracion * peso * r.multVidaJefe / 2),
    ataque: Math.round(pe.vida / (aguante * 1.1 * pasaAlJugador(p, r, c))),
    defensa: Math.round(defensa),
    exp: Math.round(120 * (1 + 0.9 * (p - 1))),
    duracion,
  };
}

/** Puntaje de equipo recomendado para entrar a un nivel y veredicto para la interfaz. */
export const puntajeRequerido = (nivel: number, base = 120, exp = 0.75, tope = 40): number => (nivel <= 1 ? 0 : Math.round(base * Math.pow(Math.min(nivel, tope) - 1, exp)));
export function veredicto(tengo: number, nivel: number): "listo" | "justo" | "peligroso" {
  const pide = puntajeRequerido(nivel);
  return pide <= 0 || tengo >= pide ? "listo" : tengo >= pide * 0.75 ? "justo" : "peligroso";
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
  const danioA = Math.max(1, a.ataque * mit(b.defensa, b.k));
  const danioB = Math.max(1, b.ataque * mit(a.defensa, a.k));
  const golpesAaB = Math.ceil(b.vida / danioA);
  const golpesBaA = Math.ceil(a.vida / danioB);
  const segundosA = golpesAaB / a.ritmo;
  const segundosB = golpesBaA / b.ritmo;
  return { golpesAaB, golpesBaA, segundosA, segundosB, gana: segundosA <= segundosB ? "a" : "b" };
}
