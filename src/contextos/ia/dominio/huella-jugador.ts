// IA que APRENDE DEL JUGADOR: un rastreador mide en vivo cómo pelea (distancia, tiempo en el aire, esquivas,
// golpes fuertes, uso de habilidades, agresividad, arma favorita) y lo resume en una HUELLA 0..1. Con ella:
//   - un rival espejo / jefe adaptativo PELEA COMO EL JUGADOR (o contra su estilo),
//   - la dificultad dinámica sabe si el jugador está cómodo,
//   - la interfaz puede mostrar "qué aprendió de ti" (cartel del duelo).
// `decidirEspejo` toma la huella y la situación y elige la acción con los mismos pesos.

import type { Azar } from "../../../nucleo/azar.ts";

export interface Huella {
  readonly distancia: number;
  readonly aereo: number;
  readonly esquiva: number;
  /** Golpes que empujan / rompen guardia (patadas, embestidas). */
  readonly empuje: number;
  readonly cargado: number;
  readonly habilidad: number;
  readonly agresividad: number;
  readonly estilo: string;
}

export const HUELLA_NEUTRA: Huella = { distancia: 0.2, aereo: 0.15, esquiva: 0.1, empuje: 0.15, cargado: 0.1, habilidad: 0.3, agresividad: 0.5, estilo: "" };

export class RastreadorHabitos {
  golpes = 0;
  private sumaDistancia = 0;
  private aereos = 0;
  private empujes = 0;
  private cargados = 0;
  habilidades = 0;
  private esquivasPerfectas = 0;
  private esquivas = 0;
  private segundos = 0;
  private tAire = 0;
  private tLejos = 0;
  private readonly porEstilo = new Map<string, number>();
  /** Distancia a partir de la que se considera "pelear de lejos" (px). */
  readonly lejos: number;
  /** Golpes mínimos antes de confiar en la huella. */
  readonly minimo: number;

  constructor(lejos = 135, minimo = 8) {
    this.lejos = lejos;
    this.minimo = minimo;
  }

  /** Cada paso con enemigos presentes. */
  paso(dt: number, enAire: boolean, distanciaAlMasCercano: number): void {
    this.segundos += dt;
    if (enAire) this.tAire += dt;
    if (distanciaAlMasCercano > this.lejos) this.tLejos += dt;
  }

  golpe(distancia: number, enAire: boolean, tipo: "normal" | "empuje" | "cargado", estilo = ""): void {
    this.golpes++;
    this.sumaDistancia += distancia;
    if (enAire) this.aereos++;
    if (tipo === "empuje") this.empujes++;
    else if (tipo === "cargado") this.cargados++;
    if (estilo) this.porEstilo.set(estilo, (this.porEstilo.get(estilo) ?? 0) + 1);
  }

  habilidad(): void {
    this.habilidades++;
  }

  esquiva(perfecta: boolean): void {
    if (perfecta) this.esquivasPerfectas++;
    else this.esquivas++;
  }

  huella(): Huella {
    if (this.golpes < this.minimo) return HUELLA_NEUTRA;
    const c = (x: number): number => Math.max(0, Math.min(1, x));
    const min = Math.max(0.5, this.segundos / 60);
    const t = Math.max(10, this.segundos);
    const ofensivas = this.golpes + this.habilidades;
    let estilo = "";
    let max = -1;
    for (const [e, n] of this.porEstilo) if (n > max) [estilo, max] = [e, n];
    return {
      distancia: c(Math.max((this.sumaDistancia / this.golpes - 30) / 130, (this.tLejos / t) * 1.2)),
      aereo: c(Math.max(this.aereos / this.golpes, (this.tAire / t) * 1.1)),
      empuje: c((this.empujes * 2.2) / ofensivas),
      cargado: c((this.cargados * 3) / ofensivas),
      habilidad: c(Math.max(this.habilidades / min / 8, (this.habilidades * 2.5) / ofensivas)),
      esquiva: c((this.esquivasPerfectas * 3 + this.esquivas * 0.5) / min / 6),
      agresividad: c(this.golpes / min / 45),
      estilo,
    };
  }
}

export type Habito = "tirador" | "aereo" | "esquivador" | "rompeguardias" | "hechicero" | "berserker";

export const TEXTOS_HABITO: Readonly<Record<Habito, string>> = {
  tirador: "Aprendió tu distancia: huirá de ti y atacará desde lejos.",
  aereo: "Aprendió tus saltos: vivirá en el aire y caerá sobre ti.",
  esquivador: "Aprendió tus reflejos: esquivará tus golpes en el último instante.",
  rompeguardias: "Aprendió tu fuerza: romperá tu guardia con golpes pesados.",
  hechicero: "Aprendió tus habilidades: las encadenará sin descanso.",
  berserker: "Aprendió tu furia: no dejará de presionarte de cerca.",
};

/** El hábito que más pesa en la huella. */
export function habitoDominante(h: Huella): Habito {
  const p: Record<Habito, number> = {
    tirador: h.distancia * 1.3,
    aereo: h.aereo * 1.35,
    esquivador: h.esquiva * 1.25,
    rompeguardias: (h.empuje + h.cargado) * 0.85,
    hechicero: h.habilidad * 1.3 - 0.15,
    berserker: h.agresividad * (1 - h.distancia) * 1.2,
  };
  let mejor: Habito = "berserker";
  for (const k of Object.keys(p) as Habito[]) if (p[k] > p[mejor]) mejor = k;
  return mejor;
}

/** Descripción corta ("ataca desde el aire, esquiva al último instante"). */
export function describirHuella(h: Huella): string {
  const r: string[] = [];
  if (h.distancia > 0.55) r.push("acecha desde lejos");
  else if (h.distancia < 0.15) r.push("pelea pegado");
  if (h.aereo > 0.35) r.push("ataca desde el aire");
  if (h.esquiva > 0.3) r.push("esquiva al último instante");
  if (h.empuje > 0.25) r.push("empuja contra los muros");
  if (h.cargado > 0.3) r.push("carga golpes pesados");
  if (h.habilidad > 0.5) r.push("abusa de sus habilidades");
  if (h.agresividad > 0.7) r.push("no da respiro");
  else if (h.agresividad < 0.25) r.push("espera tu error");
  return r.length === 0 ? "pelea como tú" : r.slice(0, 3).join(", ");
}

export interface SituacionEspejo {
  /** Distancia horizontal al objetivo (px). */
  readonly distancia: number;
  readonly enSuelo: boolean;
  readonly objetivoContraMuro: boolean;
  readonly objetivoCargando: boolean;
  readonly habilidadLista: boolean;
  readonly disparoListo: boolean;
}

export type AccionEspejo = "empujar" | "habilidad" | "asalto-aereo" | "alejarse" | "disparar" | "cargado" | "combo" | "embestida" | "acechar";

/** Decide la acción del rival espejo con los pesos de la huella. Devuelve también el próximo tiempo de decisión. */
export function decidirEspejo(h: Huella, s: SituacionEspejo, azar: Azar): { accion: AccionEspejo; proximaDecision: number } {
  const prox = Math.max(0.18, 0.55 - h.agresividad * 0.32);
  const r = (): number => azar.siguiente();
  const d = s.distancia;
  let accion: AccionEspejo = "acechar";
  if (d < 48 && (s.objetivoContraMuro || s.objetivoCargando) && r() < 0.3 + h.empuje * 0.65) accion = "empujar";
  else if (s.habilidadLista && r() < 0.15 + h.habilidad * 0.55) accion = "habilidad";
  else if (h.aereo > 0.42 && s.enSuelo && r() < h.aereo) accion = "asalto-aereo";
  else if (h.distancia > 0.55 && d < 110) accion = "alejarse";
  else if (h.distancia > 0.55 && s.disparoListo) accion = "disparar";
  else if (d > 90 && s.disparoListo && r() < 0.55) accion = "disparar";
  else if (d < 50) accion = r() < 0.2 + h.cargado * 0.6 ? "cargado" : "combo";
  else if (d < 200 && r() < 0.35 + h.agresividad * 0.3) accion = "embestida";
  return { accion, proximaDecision: prox };
}

/**
 * Dificultad dinámica a partir del rendimiento reciente: devuelve un multiplicador de daño enemigo en [min, max]
 * que sube si el jugador gana con holgura y baja si sufre. `vidaMedia`: vida promedio del jugador al terminar
 * los últimos encuentros (0..1); `muertes`: muertes recientes.
 */
export function ajusteDificultad(vidaMedia: number, muertes: number, actual = 1, min = 0.7, max = 1.3): number {
  const objetivo = vidaMedia > 0.75 && muertes === 0 ? actual * 1.05 : vidaMedia < 0.35 || muertes >= 2 ? actual * 0.92 : actual;
  return Math.max(min, Math.min(max, objetivo));
}
