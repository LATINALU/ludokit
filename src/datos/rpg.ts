// Catálogo PROPIO para RPG (acción, MMO, por turnos): conjuntos de stats por estilo, clases arquetípicas con roles y
// recurso, tipos de daño con su tabla de interacción, estados alterados y rarezas de botín. Son puntos de partida:
// cada juego los copia y los cambia.

import type { DefEstadoBasico } from "./tipos.ts";

/** Conjuntos de stats por estilo de juego. */
export const CONJUNTOS_STATS: Readonly<Record<string, readonly string[]>> = {
  clasico: ["fuerza", "destreza", "inteligencia", "vitalidad", "sabiduria", "carisma"],
  accionArpg: ["fuerza", "destreza", "inteligencia", "vitalidad", "danio", "probCritico", "danioCritico", "velocidadAtaque", "armadura", "resistencia", "roboVida"],
  mmo: ["poderAtaque", "poderHechizo", "aguante", "armadura", "critico", "celeridad", "maestria", "versatilidad", "esquivar", "parar", "bloquear"],
  moba: ["danioAtaque", "poderHabilidad", "vida", "mana", "armadura", "resistenciaMagica", "velocidadAtaque", "reduccionRecarga", "velocidadMovimiento", "penetracion", "robo"],
  shooter: ["vida", "escudo", "blindaje", "velocidad", "manejo", "recarga", "estabilidad", "precision"],
  supervivencia: ["vida", "estamina", "hambre", "sed", "temperatura", "peso", "sigilo", "punteria"],
  turnos: ["vida", "magia", "ataque", "defensa", "ataqueMagico", "defensaMagica", "velocidad", "suerte"],
  lucha: ["vida", "danio", "defensa", "velocidad", "medidor", "aguante"],
};

export interface Clase {
  readonly id: string;
  readonly rol: "tanque" | "sanador" | "danio" | "apoyo" | "control";
  readonly recurso: "mana" | "energia" | "furia" | "estamina" | "concentracion";
  /** Peso de cada stat al subir de nivel o al valorar equipo. */
  readonly pesos: Readonly<Record<string, number>>;
  readonly armas: readonly string[];
  readonly distancia: boolean;
}

export const CLASES: readonly Clase[] = [
  { id: "guerrero", rol: "tanque", recurso: "furia", pesos: { fuerza: 1, vitalidad: 0.9, armadura: 0.6 }, armas: ["espada", "hacha", "maza", "escudo"], distancia: false },
  { id: "paladin", rol: "tanque", recurso: "mana", pesos: { fuerza: 0.8, vitalidad: 0.8, sabiduria: 0.5 }, armas: ["maza", "espada", "escudo"], distancia: false },
  { id: "picaro", rol: "danio", recurso: "energia", pesos: { destreza: 1, probCritico: 0.8, velocidadAtaque: 0.6 }, armas: ["daga", "espadaCorta"], distancia: false },
  { id: "explorador", rol: "danio", recurso: "concentracion", pesos: { destreza: 1, probCritico: 0.6, danio: 0.6 }, armas: ["arco", "ballesta"], distancia: true },
  { id: "mago", rol: "danio", recurso: "mana", pesos: { inteligencia: 1, danioCritico: 0.5, celeridad: 0.6 }, armas: ["baston", "varita", "orbe"], distancia: true },
  { id: "nigromante", rol: "control", recurso: "mana", pesos: { inteligencia: 1, vitalidad: 0.5 }, armas: ["baston", "guadana"], distancia: true },
  { id: "clerigo", rol: "sanador", recurso: "mana", pesos: { sabiduria: 1, inteligencia: 0.5, vitalidad: 0.4 }, armas: ["maza", "baston"], distancia: true },
  { id: "druida", rol: "sanador", recurso: "mana", pesos: { sabiduria: 0.9, inteligencia: 0.6 }, armas: ["baston", "garras"], distancia: true },
  { id: "bardo", rol: "apoyo", recurso: "mana", pesos: { carisma: 1, destreza: 0.5 }, armas: ["instrumento", "estoque"], distancia: true },
  { id: "monje", rol: "danio", recurso: "energia", pesos: { destreza: 0.9, sabiduria: 0.5, velocidadAtaque: 0.7 }, armas: ["punos", "baston"], distancia: false },
  { id: "berserker", rol: "danio", recurso: "furia", pesos: { fuerza: 1, roboVida: 0.6, velocidadAtaque: 0.5 }, armas: ["hachaDoble", "mandoble"], distancia: false },
  { id: "ingeniero", rol: "apoyo", recurso: "energia", pesos: { inteligencia: 0.8, destreza: 0.6 }, armas: ["arma de fuego", "llave"], distancia: true },
];

/** Tipos de daño y multiplicador contra cada "naturaleza" de objetivo (1 = normal). */
export const TIPOS_DANIO = ["fisico", "fuego", "hielo", "rayo", "veneno", "sagrado", "sombra", "arcano"] as const;

export const AFINIDADES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // naturaleza del objetivo → tipo de daño → multiplicador
  bestia: { fuego: 1.25, veneno: 1.25 },
  nomuerto: { sagrado: 1.5, fuego: 1.25, veneno: 0, sombra: 0.5 },
  demonio: { sagrado: 1.4, sombra: 0.5, fuego: 0.5 },
  elementalFuego: { fuego: 0, hielo: 1.75 },
  elementalHielo: { hielo: 0, fuego: 1.75, rayo: 1.25 },
  maquina: { rayo: 1.6, veneno: 0, fisico: 0.8 },
  espectro: { fisico: 0.25, arcano: 1.5, sagrado: 1.5 },
};

/** Multiplicador de afinidad (1 si no hay dato). */
export const afinidad = (naturaleza: string, tipo: string): number => AFINIDADES[naturaleza]?.[tipo] ?? 1;

/** Estados alterados habituales con su duración/potencia de referencia. */
export const ESTADOS: readonly DefEstadoBasico[] = [
  { id: "quemadura", tipo: "dano-tiempo", duracion: 4, potencia: 0.06, acumula: "refresca", danio: "fuego" },
  { id: "veneno", tipo: "dano-tiempo", duracion: 8, potencia: 0.03, acumula: "apila", maxPilas: 5, danio: "veneno" },
  { id: "sangrado", tipo: "dano-tiempo", duracion: 6, potencia: 0.04, acumula: "apila", maxPilas: 3, danio: "fisico" },
  { id: "congelado", tipo: "control", duracion: 2, categoria: "aturdir" },
  { id: "aturdido", tipo: "control", duracion: 1.5, categoria: "aturdir" },
  { id: "enraizado", tipo: "control", duracion: 2.5, categoria: "raiz" },
  { id: "silenciado", tipo: "control", duracion: 3, categoria: "silencio" },
  { id: "miedo", tipo: "control", duracion: 3, categoria: "miedo" },
  { id: "ralentizado", tipo: "modificador", duracion: 3, potencia: -0.4, atributo: "velocidadMovimiento" },
  { id: "debilitado", tipo: "modificador", duracion: 6, potencia: -0.2, atributo: "danio" },
  { id: "vulnerable", tipo: "modificador", duracion: 6, potencia: 0.2, atributo: "danioRecibido" },
  { id: "escudo", tipo: "absorber", duracion: 10, potencia: 0.2 },
  { id: "regeneracion", tipo: "cura-tiempo", duracion: 10, potencia: 0.02, acumula: "refresca" },
  { id: "prisa", tipo: "modificador", duracion: 8, potencia: 0.25, atributo: "celeridad" },
];

/** Rarezas de referencia (nombres y colores); los pesos los decide la tabla de rareza de cada juego. */
export const RAREZAS = {
  nombres: ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico"],
  colores: ["#c8c8c8", "#5ad85a", "#4aa3ff", "#b05cff", "#ffa531", "#ff4d5e"],
} as const;
