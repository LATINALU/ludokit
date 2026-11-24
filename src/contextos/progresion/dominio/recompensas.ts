// Recompensa de fin de partida (juegos por sesión: MOBA, shooter, arena, mazmorra instanciada) y bonificaciones
// porcentuales. Estructura de la fórmula (los números los pone cada juego, ver `presets/`):
//   EXP     = base(nivel)  (×factorDerrota si perdió)  + tiempo/divisor  + expPorMuerte·muertes
//   Monedas = (monedasBase + monedasParticipacion·participación + tiempo/divisor)  (×factorDerrota)
//             + monedasPorMuerte·muertes,  y todo × multiplicador
//   - El tiempo cuenta desde `segundosSinPremio` y hasta `segundosMaximos` (anti partidas cortas y anti AFK).
//   - Pasadas `muertesSinPenalidad`, las muertes rinden un tercio menos (anti-farmeo entre amigos).
//   - Tope por partida: cualquier error de la fórmula tiene un daño máximo.
// La participación es una fracción real (presentes / total): con división entera solo pagaría si nadie se va.

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export interface DatosPartida {
  readonly nivel: number;
  readonly gano: boolean;
  readonly muertes: number;
  readonly duracionMs: number;
  /** Jugadores que terminaron / jugadores que empezaron. */
  readonly presentes: number;
  readonly total: number;
}

export interface ParametrosRecompensa {
  /** EXP base según el nivel de la partida (escalones, lineal... cualquier `Curva`). */
  readonly base: Curva;
  readonly factorDerrota: number;
  readonly segundosSinPremio: number;
  readonly segundosMaximos: number;
  readonly divisorTiempoExp: number;
  readonly divisorTiempoMonedas: number;
  readonly expPorMuerte: number;
  readonly monedasPorMuerte: number;
  readonly muertesSinPenalidad: number;
  readonly monedasBase: number;
  readonly monedasParticipacion: number;
  readonly multiplicadorMonedas: number;
  readonly tope: number;
}

function baseDeNivel(nivel: number, p: ParametrosRecompensa): number {
  return Math.max(0, Math.floor(evaluar(p.base, Math.max(1, nivel))));
}

function muertesEfectivas(muertes: number, p: ParametrosRecompensa): number {
  return muertes > p.muertesSinPenalidad ? muertes - Math.floor(muertes / 3) : muertes;
}

function segundosPremiados(duracionMs: number, p: ParametrosRecompensa): number {
  return Math.min(p.segundosMaximos, Math.max(0, Math.floor(duracionMs / 1000) - p.segundosSinPremio));
}

export function recompensaPartida(d: DatosPartida, p: ParametrosRecompensa): { exp: number; monedas: number } {
  const participacion = d.total > 0 ? Math.min(1, d.presentes / d.total) : 1;
  const segundos = segundosPremiados(d.duracionMs, p);
  const muertes = muertesEfectivas(d.muertes, p);

  let exp = baseDeNivel(d.nivel, p);
  if (!d.gano) exp = Math.floor(exp * p.factorDerrota);
  exp += Math.floor(segundos / p.divisorTiempoExp) + p.expPorMuerte * muertes;

  let monedas = Math.floor(p.monedasBase + p.monedasParticipacion * participacion + Math.floor(segundos / p.divisorTiempoMonedas));
  if (!d.gano) monedas = Math.floor(monedas * p.factorDerrota);
  monedas += p.monedasPorMuerte * muertes;
  monedas = Math.floor(monedas * p.multiplicadorMonedas);

  return { exp: Math.min(Math.max(0, exp), p.tope), monedas: Math.min(Math.max(0, monedas), p.tope) };
}

/** valor × (100 + porcentaje) / 100. Pociones de EXP, eventos globales, VIP... se suman en `porcentaje`. */
export function aplicarBonus(valor: number, porcentaje: number): number {
  return valor <= 0 || porcentaje <= 0 ? valor : Math.floor((valor * (100 + porcentaje)) / 100);
}

export interface PremioDeNivel {
  readonly nivel: number;
  readonly objeto: number;
  readonly cantidad: number;
  readonly monedas: number;
}

/** Premios de los niveles alcanzados al subir de `antes` a `despues` (también si se saltan niveles). */
export function premiosPorSubida(tabla: readonly PremioDeNivel[], antes: number, despues: number): PremioDeNivel[] {
  return tabla.filter((p) => p.nivel > antes && p.nivel <= despues);
}
