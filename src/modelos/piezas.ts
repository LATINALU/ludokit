// PIEZAS de reglas reutilizables (configuraciones ya armadas) con las que se construyen los modelos. Son números
// PROPIOS de ludokit, elegidos para que cada sistema funcione bien de entrada; ninguno viene de un juego concreto.
// Todas las curvas aceptan cualquier nivel: nada tiene "último nivel" salvo que el modelo lo pida.

import { curva } from "../nucleo/escalado.ts";
import type { TablaRarezaNivel } from "../contextos/botin/dominio/rareza.ts";
import type { ReglasEquipo } from "../contextos/botin/dominio/equipo.ts";
import type { CurvaPoder, ReglasBalance } from "../contextos/balance/dominio/poder-esperado.ts";
import type { ReglasNivelesDificultad } from "../contextos/balance/dominio/dificultad.ts";
import type { ParametrosRecompensa } from "../contextos/progresion/dominio/recompensas.ts";
import type { ReglasDescanso, ReglasMaestria } from "../contextos/progresion/dominio/progresion-extendida.ts";
import type { ReglasLanzamiento } from "../contextos/combate/dominio/lanzamiento.ts";
import type { ReglasRendimiento } from "../contextos/combate/dominio/control.ts";
import type { DefRegenerativo, DefAcumulativo, DefEstamina } from "../contextos/combate/dominio/recursos.ts";
import type { ReglasDanio } from "../contextos/combate/dominio/danio.ts";
import type { PerfilMovimiento3D } from "../contextos/fisica/dominio/controlador3d.ts";
import type { ReglasSalud } from "../contextos/disparos/dominio/salud-partes.ts";
import type { DefAsistencia } from "../contextos/disparos/dominio/punteria.ts";
import type { ReglasDirector } from "../contextos/encuentros/dominio/director.ts";
import type { ReglasPremio, ReglasDureza, ReglasOleadas } from "../contextos/encuentros/dominio/oleadas.ts";
import type { DefOleadaCarril, ReglasRecompensaMoba, ReglasRangos } from "../contextos/moba/dominio/moba.ts";
import type { ReglasSospecha } from "../contextos/vision/dominio/vision.ts";
import type { DefNecesidad, FaseDia } from "../contextos/supervivencia/dominio/supervivencia.ts";
import type { ReglasImpactoTactico } from "../contextos/turnos/dominio/turnos.ts";
import type { ReglasMazo } from "../contextos/mazo/dominio/mazo.ts";
import type { ReglasTD } from "../contextos/estrategia/dominio/estrategia.ts";
import type { ReglasCaptura, FaseZona } from "../contextos/competitivo/dominio/modos.ts";
import type { ReglasInfinito } from "../contextos/roguelite/dominio/extraccion.ts";
import type { ReglasTemplado } from "../contextos/economia/dominio/crafteo.ts";
import { tiposDeAparicion } from "../datos/criaturas.ts";
import { RAREZAS } from "../datos/rpg.ts";

// ---------------------------------------------------------------- Botín y equipo

/** Rareza de botín para ARPG: se inclina hacia lo raro con el nivel sin tope (mitad del camino en el nivel 30). */
export const RAREZA_ARPG: TablaRarezaNivel = {
  nombres: RAREZAS.nombres, colores: RAREZAS.colores,
  primero: [70, 24, 5, 0.8, 0.15, 0.02],
  ultimo: [30, 34, 22, 9, 3, 0.6],
  progreso: curva.saturacion(30, 1.5),
  suertePorNivel: curva.topeSuave(curva.lineal(0, 1), 60, 0.5),
};

/** Rareza de looter shooter: más generosa, menos escalones. */
export const RAREZA_LOOTER: TablaRarezaNivel = {
  nombres: ["Común", "Poco común", "Raro", "Épico", "Legendario"], colores: RAREZAS.colores.slice(0, 5),
  primero: [60, 28, 9, 2.5, 0.5],
  ultimo: [35, 30, 20, 11, 4],
  progreso: curva.saturacion(20, 1.2),
};

/** Rareza de MMO: lo épico viene de jefes y bandas, no del mundo. */
export const RAREZA_MMO: TablaRarezaNivel = {
  nombres: ["Pobre", "Común", "Poco común", "Raro", "Épico", "Legendario"], colores: ["#9d9d9d", ...RAREZAS.colores.slice(0, 5)],
  primero: [30, 55, 13, 1.8, 0.2, 0.001],
  ultimo: [20, 55, 19, 5, 0.9, 0.01],
  progreso: curva.saturacion(40),
};

export const EQUIPO_ARPG: ReglasEquipo = {
  rareza: RAREZA_ARPG,
  multRareza: [1, 1.08, 1.16, 1.26, 1.38, 1.52],
  afijosPorRareza: [0, 1, 2, 3, 4, 5],
  tiradaMin: 0.5, topeBase: 1.1, topeAfijo: 0.6,
  nivelPieza: curva.lineal(1, 1), variacionNivel: 2,
  escala: curva.topeSuave(curva.lineal(1, 1), 10, 0.75),
  multMejora: 1.05, mejoraMax: 15,
  costoMejora: { base: 30, porNivel: 5, porRareza: 0.35 },
  calidad: { min: 0.8, max: 1.15, porRareza: 0.02, tope: 1.25 },
  desguace: [1, 2, 4, 7, 12, 20], desguaceBase: { base: 3, porNivel: 1.5 },
};

export const EQUIPO_LOOTER: ReglasEquipo = { ...EQUIPO_ARPG, rareza: RAREZA_LOOTER, multRareza: [1, 1.1, 1.22, 1.36, 1.55], afijosPorRareza: [0, 1, 2, 3, 4], desguace: [1, 2, 4, 8, 15] };

export const TEMPLADO_BASE: ReglasTemplado = {
  maximo: Infinity, nivelEleccion: 5,
  materiales: curva.lineal(1, 0.5), moneda: curva.exponencial(60, 1.18),
  seguro: { materiales: 2, moneda: 3 }, riesgo: { materiales: 0.5, moneda: 0.5 },
  atenuar: { bono: 1.25, maldicion: 0.5 },
};

// ---------------------------------------------------------------- Balance

/** Jugador de RPG de acción: crece sublineal y se frena (sin parar) después del 50. */
export const PODER_RPG: CurvaPoder = {
  golpe: curva.topeSuave(curva.potencia(25, 0.95), 50, 0.7),
  vida: curva.topeSuave(curva.potencia(110, 0.8), 50, 0.6),
  defensa: curva.topeSuave(curva.potencia(10, 0.95), 50, 0.8),
  resistencia: curva.limitar(curva.lineal(0, 0.004), 0, 0.15),
};

/** Shooter: el poder casi no crece (lo decide la habilidad); la vida es fija. */
export const PODER_SHOOTER: CurvaPoder = {
  golpe: curva.lineal(30, 0.3), vida: curva.constante(100), defensa: curva.constante(0), resistencia: curva.constante(0),
};

export const BALANCE_ACCION: ReglasBalance = {
  golpesParaMatar: 5, golpesParaMorir: 12, kEnemigo: 60, kJugadorFactor: 1.5, kJugadorMin: 30,
  defensaEnemigo: curva.lineal(1, 0.5), expEnemigo: curva.lineal(2, 1),
  ritmoJugador: 2, duracionJefe: curva.limitar(curva.lineal(45, 1.5), 0, 150),
  aguanteJefe: curva.limitar(curva.lineal(8, -0.1), 5, 8), defensaJefe: curva.lineal(6, 1.5), expJefe: curva.lineal(100, 80),
  multVidaJefe: 2,
};

export const BALANCE_MMO: ReglasBalance = { ...BALANCE_ACCION, golpesParaMatar: 8, golpesParaMorir: 10, duracionJefe: curva.limitar(curva.lineal(120, 6), 0, 600), multVidaJefe: 5 };

/** Dificultad infinita (portales, mazmorras con nivel): +12 % vida y +8 % daño por nivel, compuestos. */
export const DIFICULTAD_INFINITA: ReglasNivelesDificultad = {
  vida: curva.exponencial(1, 1.12), danio: curva.exponencial(1, 1.08),
  botin: curva.topeSuave(curva.lineal(1, 0.05), 100, 0.5), experiencia: curva.lineal(1, 0.1),
  tiempo: curva.constante(900),
  ascenso: [[0.4, 3], [0.2, 2], [0, 1]], alFallar: -1,
};

// ---------------------------------------------------------------- Progresión

export const EXP_RPG = { tipo: "tope", nivelMax: 60, costo: curva.potencia(120, 1.6) } as const;
export const EXP_MMO = { tipo: "tope", nivelMax: 70, costo: curva.potencia(400, 1.55) } as const;
export const EXP_INFINITA = { tipo: "infinita", costo: curva.topeSuave(curva.potencia(100, 1.5), 100, 1.1) } as const;
export const EXP_PARAGON = { tipo: "paragon", costo: curva.exponencial(5000, 1.03), puntosPorNivel: 1 } as const;
export const EXP_CUENTA = { tipo: "infinita", costo: curva.lineal(1000, 50) } as const;

export const DESCANSO_MMO: ReglasDescanso = { porHora: 600, tope: 20000, mult: 2 };

export const MAESTRIA_USO: ReglasMaestria = {
  costo: curva.potencia(50, 1.35), nivelMax: 200,
  margenes: { dificil: 10, media: 25, facil: 50 },
  rinde: { imposible: 0, dificil: 1, media: 0.7, facil: 0.25, trivial: 0 },
};

export const RECOMPENSA_PARTIDA: ParametrosRecompensa = {
  base: curva.topeSuave(curva.lineal(100, 10), 50, 0.5), factorDerrota: 0.6,
  segundosSinPremio: 60, segundosMaximos: 1800, divisorTiempoExp: 4, divisorTiempoMonedas: 6,
  expPorMuerte: 10, monedasPorMuerte: 5, muertesSinPenalidad: 25,
  monedasBase: 50, monedasParticipacion: 150, multiplicadorMonedas: 1, tope: 100000,
};

// ---------------------------------------------------------------- Combate

export const DANIO_ESTANDAR: ReglasDanio = { k: 100, topeResistencia: 0.75, topeVulnerabilidad: 1, topeReduccion: 0.5 };
export const LANZAMIENTO_MMO: ReglasLanzamiento = { gcd: 1.5, gcdMin: 0.75, ventanaCola: 0.4, empuje: 0.5, maxEmpujes: 2 };
export const LANZAMIENTO_MOBA: ReglasLanzamiento = { gcd: 0, gcdMin: 0, ventanaCola: 0.15, empuje: 0, maxEmpujes: 0 };
export const RENDIMIENTOS_PVP: ReglasRendimiento = { escalones: [1, 0.5, 0.25], reinicio: 18, exentas: ["empuje"] };
export const MANA: DefRegenerativo = { max: 100, regen: 4, regenCombate: 1.5, pausaTrasGasto: 2 };
export const ENERGIA: DefRegenerativo = { max: 100, regen: 10 };
export const FURIA: DefAcumulativo = { max: 100, alGolpear: 0.15, alRecibir: 0.25, porDanio: true, decae: 2 };
export const ESTAMINA_ACCION: DefEstamina = { max: 100, regen: 35, retraso: 0.8, umbralAgotado: 0.3 };

// ---------------------------------------------------------------- Disparos

export const MOV_FPS_ARENA: PerfilMovimiento3D = {
  caminar: 6, correr: 9, agachado: 3, aceleracion: 70, friccion: 8, controlAire: 0.6, strafeAereo: true,
  salto: 7.2, gravedad: 20, caidaMax: 40, coyote: 0.1, bufer: 0.12, saltosAire: 1,
  deslizar: { impulso: 4, duracion: 0.8, friccion: 1 }, pendienteMax: 50, ojos: 1.65, ojosAgachado: 1.05,
};

export const MOV_FPS_TACTICO: PerfilMovimiento3D = {
  caminar: 3.2, correr: 5.5, agachado: 1.6, aceleracion: 25, friccion: 10, controlAire: 0.15,
  salto: 4.5, gravedad: 9.81, caidaMax: 50, coyote: 0.08, bufer: 0.1, pendienteMax: 40, ojos: 1.6, ojosAgachado: 1.0,
};

export const MOV_TERCERA_PERSONA: PerfilMovimiento3D = { ...MOV_FPS_TACTICO, caminar: 4, correr: 7, aceleracion: 35, controlAire: 0.3, salto: 5.5, ojos: 1.7 };

export const SALUD_TACTICA: ReglasSalud = { repartoDestruida: 0.7, sangradoLeve: 0.8, sangradoFuerte: 2.5 };
export const ASISTENCIA_MANDO: DefAsistencia = { cono: 4, alcance: 60, friccion: 0.55, iman: 2.5 };

// ---------------------------------------------------------------- Encuentros

export const OLEADAS_BASE: ReglasOleadas = { acercarTras: 25, retirarTras: 45, esperaEntreOleadas: 2, tiempoPorOleada: 30, tiempoExtraPorOleadaHecha: 3 };
export const PREMIO_ENCUENTRO: ReglasPremio = {
  cofre: curva.limitar(curva.lineal(1, 0.1), 1, 3), cofreMax: 4, pieza: 1, piezaMax: 5,
  moneda: curva.lineal(20, 8), pocosGolpes: 3, multPocosGolpes: 1.5, porRacha: 0.2, maxRacha: 1,
};
export const DUREZA_ENCUENTRO: ReglasDureza = {
  vida: curva.lineal(1, 0.05), danio: curva.lineal(1, 0.025),
  extra: curva.lineal(0, 0.1), probElite: curva.limitar(curva.lineal(0, 0.015), 0, 0.35),
};

export const DIRECTOR_ZOMBIS: ReglasDirector = {
  umbralPico: 0.7, duracionPico: 25, duracionRelajo: 30, decaeIntensidad: 0.03,
  presupuesto: { acumular: 2, pico: 6, relajar: 0.2 }, maxVivos: 60,
  tipos: tiposDeAparicion(["caminante", "corredor", "acorazado", "escupidor", "explosivo", "aullador", "acechador"]),
};

export const DIRECTOR_MILITAR: ReglasDirector = {
  umbralPico: 0.6, duracionPico: 30, duracionRelajo: 40, decaeIntensidad: 0.025,
  presupuesto: { acumular: 1.2, pico: 3, relajar: 0.1 }, maxVivos: 24,
  tipos: tiposDeAparicion(["fusilero", "asaltante", "ametrallador", "tirador", "medico", "pesado"]),
};

export const INFINITO_ROGUELITE: ReglasInfinito = { probBase: 0.6, caidaPorNivel: 0.01, probMin: 0.2, piedad: 3, jefeCada: 5 };

// ---------------------------------------------------------------- Géneros específicos

export const CARRILES_MOBA: DefOleadaCarril = {
  cada: 30, primera: 65, base: { melee: 3, distancia: 3 }, asedioCada: 3, tipoAsedio: "asedio", tipoSuper: "super",
  fuerza: curva.lineal(1, 0.04),
};
export const RECOMPENSA_MOBA: ReglasRecompensaMoba = {
  oroUnidad: { melee: 21, distancia: 14, asedio: 60, super: 60 }, expUnidad: { melee: 60, distancia: 30, asedio: 90, super: 97 },
  repartoExp: curva.tramos([[1, 1], [2, 0.65], [3, 0.47], [5, 0.3]]),
  oroAsesinato: 300, oroPorRachaVictima: 100, oroRachaMax: 700, fraccionAsistencia: 0.5, oroPasivo: 2,
};
export const RANGOS_MOBA: ReglasRangos = { rangoMax: 5, definitiva: "R", nivelesDefinitiva: [6, 11, 16], limitePorNivel: true };
export const REAPARICION_MOBA = { porNivel: curva.lineal(6, 2.2), porMinuto: curva.topeSuave(curva.lineal(1, 0.015), 30, 0.3) };

export const SIGILO_BASE: ReglasSospecha = { llenado: 1.2, alcance: 25, decae: 0.25, agachado: 0.45, corriendo: 1.8, umbralSospecha: 0.35, umbralAlerta: 1, umbralCalma: 0.1 };

export const NECESIDADES_SUPERVIVENCIA: readonly DefNecesidad[] = [
  { id: "hambre", max: 100, tasa: { base: 0.05, corriendo: 0.09 }, umbrales: [[0.25, "hambriento"], [0.1, "famelico"]], danioVacio: 0.5 },
  { id: "sed", max: 100, tasa: { base: 0.08, corriendo: 0.14 }, umbrales: [[0.25, "sediento"], [0.1, "deshidratado"]], danioVacio: 0.8 },
  { id: "energia", max: 100, tasa: { base: 0.02, corriendo: 0.06 }, umbrales: [[0.2, "agotado"]] },
];
export const NECESIDADES_COLONIA: readonly DefNecesidad[] = [
  ...NECESIDADES_SUPERVIVENCIA,
  { id: "animo", max: 100, tasa: { base: 0.01 }, umbrales: [[0.3, "triste"], [0.1, "crisis"]] },
];
export const DIA_NOCHE: readonly FaseDia[] = [
  { nombre: "amanecer", desde: 0.22, luz: 0.6 }, { nombre: "dia", desde: 0.3, luz: 1 },
  { nombre: "atardecer", desde: 0.72, luz: 0.55 }, { nombre: "noche", desde: 0.8, luz: 0.12 },
];

export const IMPACTO_TACTICO: ReglasImpactoTactico = { base: 0.65, porDistancia: 0.03, alcanceOptimo: 6, coberturaMedia: 0.2, coberturaTotal: 0.4, flanqueo: 0.15, min: 0.05, max: 0.95 };
export const MAZO_ROGUELIKE: ReglasMazo = { manoMax: 10, roboPorTurno: 5, manoLlena: "descartar", energiaPorTurno: 3, energiaSeVacia: true, energiaMax: 10 };
export const MAZO_COLECCIONABLE: ReglasMazo = { manoMax: 10, roboPorTurno: 1, manoLlena: "quemar", energiaPorTurno: 1, energiaSeVacia: false, energiaMax: 10 };
export const TD_BASE: ReglasTD = { interes: 0.1, interesMax: 50, reembolso: 0.7 };
export const CAPTURA_BASE: ReglasCaptura = { ritmo: 0.1, porExtra: 0.05, maxContados: 3, decae: 0.05 };
export const ZONA_BATALLA_REAL: readonly FaseZona[] = [
  { espera: 120, cierre: 90, radio: 1200, danio: 1 }, { espera: 90, cierre: 60, radio: 700, danio: 2 },
  { espera: 60, cierre: 45, radio: 350, danio: 5 }, { espera: 45, cierre: 30, radio: 150, danio: 8 },
  { espera: 30, cierre: 30, radio: 40, danio: 12 }, { espera: 20, cierre: 20, radio: 0, danio: 20 },
];
