// Estilos de feedback de partida (PROPIOS de ludokit): cuánto se exagera cada evento según el tono del juego. Copiar
// y ajustar. Los nombres de sonido coinciden con los que genera `audio` (`impacto_{material}_{fuerza}`, `corte`,
// `botin_rareza_{n}`) para que funcionen de entrada con `audio.BancoSonidos`; los de efectos son sugeridos.

import type { EstiloFeedback, RecetaFeedback } from "./protocolo.ts";

const RAREZA_COLORES = { "0": "#c8c8c8", "1": "#5ad85a", "2": "#4aa3ff", "3": "#b05cff", "4": "#ffa531", "5": "#ff4d5e" };

const BASE: Readonly<Record<string, RecetaFeedback>> = {
  golpe: { impacto: { hitstop: 0.05, trauma: 0.15 }, sonido: "impacto_{material}_normal", volumen: [0.5, 1], tono: [1.1, 0.9], visual: "chispa_{material}", escala: [0.6, 1.4], umbralImpacto: 0.15 },
  critico: { impacto: { hitstop: 0.08, trauma: 0.3, destello: 0.3 }, sonido: "impacto_{material}_fuerte", volumen: [0.8, 1], tono: [1, 0.85], visual: "critico", escala: [1, 1.8], prioridad: 3 },
  "recibir-golpe": { impacto: { hitstop: 0.07, trauma: 0.5, destello: 0.4 }, sonido: "impacto_carne_fuerte", volumen: [0.6, 1], visual: "vineta_roja", escala: [0.5, 1], prioridad: 4 },
  bloqueo: { impacto: { hitstop: 0.04, trauma: 0.1 }, sonido: "impacto_metal_leve", visual: "chispa_metal", escala: [0.5, 1] },
  parada: { impacto: { hitstop: 0.12, trauma: 0.2, destello: 0.5 }, sonido: "impacto_metal_fuerte", visual: "destello_parada", prioridad: 4 },
  "esquiva-perfecta": { impacto: { hitstop: 0, trauma: 0, lenta: 0.4, escalaLenta: 0.35 }, sonido: "corte", tono: [1.3, 1.3], visual: "estela", prioridad: 3 },
  muerte: { impacto: { hitstop: 0.06, trauma: 0.25 }, sonido: "impacto_{material}_fuerte", visual: "estallido_{material}", escala: [0.8, 1.6] },
  "muerte-jefe": { impacto: { hitstop: 0.15, trauma: 1, lenta: 1, escalaLenta: 0.3, destello: 0.8 }, sonido: "impacto_energia_fuerte", visual: "estallido_jefe", escala: [2, 3], prioridad: 5 },
  salto: { sonido: "salto", volumen: [0.3, 0.5], visual: "polvo", escala: [0.4, 0.8] },
  aterrizaje: { impacto: { hitstop: 0, trauma: 0.15 }, sonido: "aterrizaje_{material}", volumen: [0.2, 0.9], tono: [1.1, 0.8], visual: "polvo", escala: [0.5, 1.5], umbralImpacto: 0.6 },
  dash: { sonido: "corte", volumen: [0.4, 0.6], tono: [1.2, 1.2], visual: "estela", duracion: 0.25 },
  disparo: { impacto: { hitstop: 0, trauma: 0.08 }, sonido: "disparo_{etiqueta}", volumen: [0.7, 1], visual: "fogonazo", escala: [0.8, 1.3], duracion: 0.05, prioridad: 2 },
  "disparo-silenciado": { sonido: "disparo_silenciado", volumen: [0.2, 0.35], visual: "fogonazo_chico", duracion: 0.03 },
  "impacto-bala": { sonido: "impacto_{material}_leve", volumen: [0.3, 0.8], visual: "impacto_{material}", escala: [0.5, 1] },
  explosion: { impacto: { hitstop: 0.03, trauma: 0.8, destello: 0.6 }, sonido: "explosion", volumen: [0.7, 1], visual: "explosion", escala: [1, 3], prioridad: 5 },
  recarga: { sonido: "recarga_{etiqueta}", volumen: [0.5, 0.6] },
  vacio: { sonido: "vacio", volumen: [0.4, 0.4], prioridad: 3 },
  curacion: { sonido: "curacion", volumen: [0.4, 0.7], visual: "brillo_verde", escala: [0.6, 1.2] },
  "nivel-subido": { impacto: { hitstop: 0, trauma: 0, destello: 0.3 }, sonido: "nivel", volumen: [0.9, 0.9], visual: "columna_luz", escala: [1.5, 1.5], prioridad: 5 },
  botin: { sonido: "botin_rareza_{etiqueta}", volumen: [0.5, 1], visual: "haz_botin", escala: [0.6, 1.6], colores: RAREZA_COLORES, prioridad: 2 },
  alerta: { sonido: "alerta", volumen: [1, 1], visual: "signo_alerta", prioridad: 5 },
  sospecha: { sonido: "sospecha", volumen: [0.3, 0.7], visual: "signo_sospecha", escala: [0.5, 1] },
  "fase-jefe": { impacto: { hitstop: 0.1, trauma: 0.6, destello: 0.5 }, sonido: "fase", visual: "onda", escala: [2, 2], prioridad: 5 },
  derrape: { sonido: "derrape", volumen: [0.3, 0.9], tono: [0.9, 1.2], visual: "humo_neumatico", escala: [0.5, 1.5] },
  choque: { impacto: { hitstop: 0.02, trauma: 0.7 }, sonido: "impacto_metal_fuerte", volumen: [0.5, 1], visual: "chispas_choque", escala: [0.8, 2], umbralImpacto: 0.3 },
};

/** Acción arcade: todo exagerado, mucho impacto de pantalla. */
export const ESTILO_ARCADE: EstiloFeedback = { id: "arcade", impacto: 1.3, sonido: 1, visual: 1.3, ajenos: 0.5, recetas: BASE };

/** Estándar equilibrado (RPG de acción, aventura). */
export const ESTILO_ESTANDAR: EstiloFeedback = { id: "estandar", impacto: 1, sonido: 1, visual: 1, ajenos: 0.4, recetas: BASE };

/** Táctico / simulación: sin congelar, sacudida mínima, el sonido manda (shooters tácticos, extracción). */
export const ESTILO_TACTICO: EstiloFeedback = {
  id: "tactico", impacto: 0.25, sonido: 1, visual: 0.6, ajenos: 0.8,
  recetas: { ...BASE, golpe: { ...BASE.golpe, impacto: { hitstop: 0, trauma: 0.05 } }, critico: { ...BASE.critico, impacto: { hitstop: 0, trauma: 0.1 } } },
};

/** Terror: poco impacto visual, sonidos ajenos tan fuertes como los propios (lo que no ves, lo oís). */
export const ESTILO_TERROR: EstiloFeedback = { id: "terror", impacto: 0.6, sonido: 1, visual: 0.5, ajenos: 1, recetas: BASE };

/** Accesible: sin destellos ni sacudidas (fotosensibilidad, mareo), feedback por sonido y efectos estáticos. */
export const ESTILO_ACCESIBLE: EstiloFeedback = { id: "accesible", impacto: 0, sonido: 1, visual: 0.8, ajenos: 0.5, recetas: BASE };

export const ESTILOS_FEEDBACK: readonly EstiloFeedback[] = [ESTILO_ARCADE, ESTILO_ESTANDAR, ESTILO_TACTICO, ESTILO_TERROR, ESTILO_ACCESIBLE];
