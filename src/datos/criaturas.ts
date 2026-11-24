// Catálogo PROPIO de arquetipos de enemigos y unidades: no son estadísticas finales sino PESOS relativos que se
// multiplican por el balance del juego (`ModeloBalance.enemigo(nivel, pesoVida, pesoAtaque)`), más rasgos de
// comportamiento para la IA (`ia`) y costos para el director de hordas (`encuentros/director`).

import type { TipoAparicion } from "../contextos/encuentros/dominio/director.ts";

export interface Arquetipo {
  readonly id: string;
  readonly familia: "zombi" | "soldado" | "fantasia" | "bestia" | "maquina" | "civil";
  readonly pesoVida: number;
  readonly pesoAtaque: number;
  /** Velocidad relativa (1 = caminar humano). */
  readonly velocidad: number;
  /** Comportamiento sugerido: "perseguir", "cubrirse", "flanquear", "distancia", "apoyo", "emboscar", "kamikaze", "invocar", "huir". */
  readonly conducta: string;
  /** Alcance de ataque (m) y si ataca a distancia. */
  readonly alcance: number;
  readonly distancia?: boolean;
  /** Para el director: costo de aparición, peso y recarga (especiales). */
  readonly costo: number;
  readonly peso: number;
  readonly recarga?: number;
  readonly rasgos?: readonly string[];
}

export const ARQUETIPOS: readonly Arquetipo[] = [
  // Zombis / infectados
  { id: "caminante", familia: "zombi", pesoVida: 0.8, pesoAtaque: 0.7, velocidad: 0.6, conducta: "perseguir", alcance: 1.2, costo: 1, peso: 10, rasgos: ["horda", "oido"] },
  { id: "corredor", familia: "zombi", pesoVida: 0.6, pesoAtaque: 0.8, velocidad: 1.6, conducta: "perseguir", alcance: 1.2, costo: 2, peso: 4, rasgos: ["horda"] },
  { id: "acorazado", familia: "zombi", pesoVida: 3, pesoAtaque: 1.2, velocidad: 0.5, conducta: "perseguir", alcance: 1.4, costo: 8, peso: 1, recarga: 25, rasgos: ["blindado", "resiste-cabeza"] },
  { id: "gigante", familia: "zombi", pesoVida: 12, pesoAtaque: 3, velocidad: 0.9, conducta: "perseguir", alcance: 2.5, costo: 40, peso: 0.3, recarga: 120, rasgos: ["jefe", "derriba"] },
  { id: "escupidor", familia: "zombi", pesoVida: 0.9, pesoAtaque: 1, velocidad: 0.8, conducta: "distancia", alcance: 15, distancia: true, costo: 5, peso: 1.5, recarga: 20, rasgos: ["acido", "area"] },
  { id: "explosivo", familia: "zombi", pesoVida: 0.7, pesoAtaque: 2.5, velocidad: 0.7, conducta: "kamikaze", alcance: 3, costo: 4, peso: 1.5, recarga: 15, rasgos: ["explota-al-morir"] },
  { id: "aullador", familia: "zombi", pesoVida: 0.8, pesoAtaque: 0.3, velocidad: 0.9, conducta: "huir", alcance: 0, costo: 6, peso: 1, recarga: 40, rasgos: ["llama-horda"] },
  { id: "acechador", familia: "zombi", pesoVida: 1, pesoAtaque: 1.4, velocidad: 1.4, conducta: "emboscar", alcance: 1.5, costo: 6, peso: 1.2, recarga: 30, rasgos: ["inmoviliza", "sigilo"] },
  // Soldados / facciones armadas
  { id: "fusilero", familia: "soldado", pesoVida: 1, pesoAtaque: 1, velocidad: 1, conducta: "cubrirse", alcance: 60, distancia: true, costo: 3, peso: 6, rasgos: ["coberturas"] },
  { id: "asaltante", familia: "soldado", pesoVida: 1.1, pesoAtaque: 1.2, velocidad: 1.2, conducta: "flanquear", alcance: 25, distancia: true, costo: 4, peso: 3, rasgos: ["granadas"] },
  { id: "ametrallador", familia: "soldado", pesoVida: 1.4, pesoAtaque: 1.4, velocidad: 0.8, conducta: "cubrirse", alcance: 70, distancia: true, costo: 6, peso: 1.5, rasgos: ["supresion"] },
  { id: "tirador", familia: "soldado", pesoVida: 0.8, pesoAtaque: 2.5, velocidad: 0.9, conducta: "distancia", alcance: 200, distancia: true, costo: 7, peso: 1, recarga: 30, rasgos: ["laser-aviso"] },
  { id: "medico", familia: "soldado", pesoVida: 0.9, pesoAtaque: 0.6, velocidad: 1, conducta: "apoyo", alcance: 30, distancia: true, costo: 5, peso: 1, rasgos: ["cura", "revive"] },
  { id: "ingeniero", familia: "soldado", pesoVida: 1, pesoAtaque: 0.8, velocidad: 0.9, conducta: "apoyo", alcance: 30, distancia: true, costo: 5, peso: 1, rasgos: ["construye-torreta", "repara"] },
  { id: "pesado", familia: "soldado", pesoVida: 3.5, pesoAtaque: 1.6, velocidad: 0.6, conducta: "perseguir", alcance: 20, distancia: true, costo: 15, peso: 0.5, recarga: 60, rasgos: ["blindado", "lanzallamas"] },
  // Fantasía
  { id: "bruto", familia: "fantasia", pesoVida: 1.6, pesoAtaque: 1.2, velocidad: 0.8, conducta: "perseguir", alcance: 2, costo: 3, peso: 4 },
  { id: "arquero", familia: "fantasia", pesoVida: 0.7, pesoAtaque: 1.1, velocidad: 1, conducta: "distancia", alcance: 25, distancia: true, costo: 3, peso: 4 },
  { id: "hechicero", familia: "fantasia", pesoVida: 0.6, pesoAtaque: 1.5, velocidad: 0.9, conducta: "distancia", alcance: 20, distancia: true, costo: 4, peso: 2, rasgos: ["area", "elemental"] },
  { id: "sanador", familia: "fantasia", pesoVida: 0.8, pesoAtaque: 0.4, velocidad: 1, conducta: "apoyo", alcance: 15, distancia: true, costo: 4, peso: 1, rasgos: ["cura"] },
  { id: "invocador", familia: "fantasia", pesoVida: 0.8, pesoAtaque: 0.6, velocidad: 0.9, conducta: "invocar", alcance: 18, distancia: true, costo: 6, peso: 1, recarga: 20, rasgos: ["invoca"] },
  { id: "enjambre", familia: "bestia", pesoVida: 0.25, pesoAtaque: 0.35, velocidad: 1.5, conducta: "perseguir", alcance: 1, costo: 0.5, peso: 8, rasgos: ["horda"] },
  { id: "acechador-sombra", familia: "fantasia", pesoVida: 0.9, pesoAtaque: 1.6, velocidad: 1.4, conducta: "emboscar", alcance: 1.5, costo: 5, peso: 1.5, rasgos: ["sigilo", "veneno"] },
  // Máquinas
  { id: "dron", familia: "maquina", pesoVida: 0.5, pesoAtaque: 0.8, velocidad: 1.8, conducta: "distancia", alcance: 30, distancia: true, costo: 3, peso: 2, rasgos: ["vuela"] },
  { id: "torreta", familia: "maquina", pesoVida: 2, pesoAtaque: 1.3, velocidad: 0, conducta: "distancia", alcance: 50, distancia: true, costo: 6, peso: 1, rasgos: ["estatico"] },
];

export const arquetipo = (id: string): Arquetipo => {
  const a = ARQUETIPOS.find((x) => x.id === id);
  if (!a) throw new Error(`Arquetipo desconocido: ${id}`);
  return a;
};

/** Tipos de aparición para el `Director` desde arquetipos (por familia o lista). */
export function tiposDeAparicion(ids: readonly string[]): TipoAparicion[] {
  return ids.map(arquetipo).map((a) => ({ id: a.id, costo: a.costo, peso: a.peso, recarga: a.recarga }));
}
