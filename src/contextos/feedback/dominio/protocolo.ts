// PROTOCOLO DE FEEDBACK: el puente entre la simulación pura y lo que el jugador ve, oye y siente. El dominio nunca
// dibuja ni suena: emite `EventoJuego` (qué pasó + intensidad 0..1 + dónde). Un `TraductorFeedback` los convierte en
// ÓRDENES para tres adaptadores que implementa el juego en su motor (Godot, Unity, Unreal, web):
//   - impacto: hitstop, sacudida (trauma), cámara lenta, destello  → `feel.DirectorImpacto.aplicar`
//   - sonido:  nombre de sonido + volumen + tono + prioridad          → `audio.BancoSonidos.tocar` o el motor de audio
//   - visual:  efecto + escala + color + duración                     → partículas/VFX/shaders del motor
// Un ESTILO (arcade, táctico, terror...) decide cuánto exagerar cada cosa: el mismo juego puede cambiar de estilo sin
// tocar las reglas. Glosario fijo de eventos = vocabulario común entre programación, arte, sonido y diseño.
//
// Reglas del protocolo:
//   1. La intensidad siempre es 0..1 (normalizada por el emisor: daño / vida máxima, velocidad / velocidad tope...).
//   2. Los eventos se generan en el paso fijo y se consumen en el mismo paso (el sonido no espera al dibujo).
//   3. El feedback es COSMÉTICO: nunca cambia el resultado de la simulación (salvo el hitstop, que el bucle aplica
//      igual en servidor y cliente si se quiere determinismo, o solo en el cliente si es puramente visual).
//   4. Límite por cuadro: muchos eventos iguales en el mismo paso se fusionan en uno más intenso (diez golpes de
//      metralla = un golpe fuerte, no diez sonidos encimados).

/** Glosario de eventos de feedback. El juego puede agregar los suyos (string libre). */
export type TipoEventoJuego =
  | "golpe" | "critico" | "bloqueo" | "parada" | "esquiva" | "esquiva-perfecta" | "recibir-golpe" | "muerte" | "muerte-jefe"
  | "salto" | "salto-aire" | "aterrizaje" | "dash" | "deslizar" | "pared"
  | "disparo" | "disparo-silenciado" | "recarga" | "vacio" | "impacto-bala" | "penetracion" | "explosion"
  | "curacion" | "escudo-roto" | "estado-aplicado" | "nivel-subido" | "botin" | "logro" | "habilidad-lista"
  | "alerta" | "sospecha" | "fase-jefe" | "oleada" | "captura" | "vuelta" | "derrape" | "choque"
  | (string & {});

export interface EventoJuego {
  readonly tipo: TipoEventoJuego;
  /** 0..1: cuánto importa (daño/vida, velocidad/tope, rareza/maxima...). */
  readonly intensidad: number;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  /** Material o superficie ("carne", "metal", "piedra"...) para elegir el sonido/efecto. */
  readonly material?: string;
  /** Rareza (botín), elemento (estado), equipo, etc. */
  readonly etiqueta?: string;
  /** ¿Lo protagoniza el jugador local? (el feedback del jugador pesa más que el de los demás). */
  readonly propio?: boolean;
}

export interface OrdenImpacto {
  readonly hitstop: number;
  readonly trauma: number;
  readonly lenta?: number;
  readonly escalaLenta?: number;
  readonly destello?: number;
}

export interface OrdenSonido {
  readonly sonido: string;
  readonly volumen: number;
  /** Multiplicador de tono (1 = original). */
  readonly tono: number;
  /** Más alta = no se corta por otros sonidos. */
  readonly prioridad: number;
}

export interface OrdenVisual {
  readonly efecto: string;
  readonly escala: number;
  readonly color?: string;
  readonly duracion: number;
}

export interface Feedback {
  readonly evento: EventoJuego;
  readonly impacto?: OrdenImpacto;
  readonly sonido?: OrdenSonido;
  readonly visual?: OrdenVisual;
}

/** Receta de un evento: valores con intensidad 1 (se escalan con la intensidad real). */
export interface RecetaFeedback {
  readonly impacto?: OrdenImpacto;
  /** Nombre del sonido; `{material}` y `{etiqueta}` se reemplazan (p. ej. "impacto_{material}"). */
  readonly sonido?: string;
  readonly volumen?: readonly [min: number, max: number];
  readonly tono?: readonly [min: number, max: number];
  readonly prioridad?: number;
  readonly visual?: string;
  readonly escala?: readonly [min: number, max: number];
  readonly duracion?: number;
  /** Colores por etiqueta (rarezas, elementos, equipos). */
  readonly colores?: Readonly<Record<string, string>>;
  /** Por debajo de esta intensidad no hay impacto de pantalla (solo sonido/visual). */
  readonly umbralImpacto?: number;
}

export interface EstiloFeedback {
  readonly id: string;
  /** Multiplicadores globales: cuánto exagera este estilo. */
  readonly impacto: number;
  readonly sonido: number;
  readonly visual: number;
  /** Factor para eventos de otros (no propios). */
  readonly ajenos: number;
  readonly recetas: Readonly<Record<string, RecetaFeedback>>;
}

const lerp = (r: readonly [number, number] | undefined, t: number, def: number): number => (r ? r[0] + (r[1] - r[0]) * t : def);
const reemplazar = (s: string, e: EventoJuego): string => s.replace("{material}", e.material ?? "generico").replace("{etiqueta}", e.etiqueta ?? "");

export class TraductorFeedback {
  estilo: EstiloFeedback;

  constructor(estilo: EstiloFeedback) {
    this.estilo = estilo;
  }

  traducir(e: EventoJuego): Feedback {
    const r = this.estilo.recetas[e.tipo];
    if (!r) return { evento: e };
    const t = Math.min(1, Math.max(0, e.intensidad));
    const k = e.propio === false ? this.estilo.ajenos : 1;
    const est = this.estilo;
    const impacto = r.impacto && t >= (r.umbralImpacto ?? 0) && est.impacto > 0
      ? {
          hitstop: r.impacto.hitstop * t * est.impacto * k,
          trauma: r.impacto.trauma * t * est.impacto * k,
          lenta: r.impacto.lenta,
          escalaLenta: r.impacto.escalaLenta,
          destello: r.impacto.destello !== undefined ? r.impacto.destello * t * est.impacto * k : undefined,
        }
      : undefined;
    const sonido = r.sonido && est.sonido > 0
      ? { sonido: reemplazar(r.sonido, e), volumen: Math.min(1, lerp(r.volumen, t, 0.8) * est.sonido * k), tono: lerp(r.tono, t, 1), prioridad: (r.prioridad ?? 1) + (e.propio ? 1 : 0) }
      : undefined;
    const visual = r.visual && est.visual > 0
      ? { efecto: reemplazar(r.visual, e), escala: lerp(r.escala, t, 1) * est.visual, color: e.etiqueta ? r.colores?.[e.etiqueta] : undefined, duracion: r.duracion ?? 0.3 }
      : undefined;
    return { evento: e, impacto, sonido, visual };
  }

  /**
   * Traduce los eventos de un paso fusionando los repetidos (mismo tipo + material + etiqueta): se queda con el más
   * intenso y le suma un poco por cada repetición (tope 1).
   */
  traducirPaso(eventos: readonly EventoJuego[]): Feedback[] {
    const grupos = new Map<string, { e: EventoJuego; n: number }>();
    for (const e of eventos) {
      const k = `${e.tipo}|${e.material ?? ""}|${e.etiqueta ?? ""}|${e.propio ? 1 : 0}`;
      const g = grupos.get(k);
      if (!g) grupos.set(k, { e, n: 1 });
      else grupos.set(k, { e: e.intensidad > g.e.intensidad ? e : g.e, n: g.n + 1 });
    }
    return [...grupos.values()].map(({ e, n }) => this.traducir(n > 1 ? { ...e, intensidad: Math.min(1, e.intensidad + 0.08 * (n - 1)) } : e));
  }
}

// ---------------------------------------------------------------- Normalizadores (de datos de dominio a 0..1)

/** Intensidad de un golpe: daño respecto de la vida máxima del que lo recibe, con curva raíz (lo chico se nota). */
export const intensidadDanio = (danio: number, vidaMax: number): number => Math.min(1, Math.sqrt(Math.max(0, danio) / Math.max(1, vidaMax)));

/** Intensidad de un aterrizaje según la velocidad de caída (0 hasta `minima`, 1 en `maxima`). */
export const intensidadCaida = (velocidad: number, minima: number, maxima: number): number => Math.min(1, Math.max(0, (Math.abs(velocidad) - minima) / Math.max(1e-6, maxima - minima)));

/** Intensidad por rareza (botín): 0 la más común, 1 la más alta. */
export const intensidadRareza = (rareza: number, cantidad: number): number => (cantidad <= 1 ? 1 : Math.min(1, Math.max(0, rareza / (cantidad - 1))));

/**
 * Fricción sonora continua (deslizar, derrapar, arrastrar): volumen y tono según la velocidad y el agarre de la
 * superficie. Para sonidos en bucle que se actualizan cada paso, no para eventos.
 */
export function friccionSonora(velocidad: number, velocidadTope: number, agarre = 1): { volumen: number; tono: number } {
  const v = Math.min(1, Math.abs(velocidad) / Math.max(1e-6, velocidadTope));
  return { volumen: Math.min(1, v * (0.4 + 0.6 * Math.min(1, agarre))), tono: 0.8 + 0.5 * v };
}
