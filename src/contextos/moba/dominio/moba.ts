// Mecánicas de arena de batalla multijugador (MOBA) y de cualquier juego con carriles, estructuras y oro por partida:
//   - OLEADAS DE SÚBDITOS por carril con temporizador; composición que cambia con el número de oleada (asedio cada N,
//     súper súbditos cuando cae una estructura clave) y fuerza que escala con el minuto de partida.
//   - ESTRUCTURAS (torres) que priorizan objetivos (al campeón que ataca a un aliado, si no súbditos), con daño que
//     crece al pegarle seguido al mismo objetivo; protección por orden (no se puede atacar la 2.ª sin la 1.ª).
//   - ORO Y EXPERIENCIA: último golpe da oro; la experiencia se reparte entre los cercanos; recompensa por asesinato
//     con RACHA y RECOMPENSA POR APAGAR (shutdown); asistencias.
//   - REAPARICIÓN que crece con el nivel y el minuto.
//   - NIVELES DE HABILIDAD: puntos por nivel con habilidad definitiva en niveles fijos.

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

// ---------------------------------------------------------------- Oleadas

export interface DefOleadaCarril {
  /** Segundos entre oleadas y primera oleada. */
  readonly cada: number;
  readonly primera: number;
  /** Composición base: tipo → cantidad. */
  readonly base: Readonly<Record<string, number>>;
  /** Unidad de asedio cada N oleadas (0 = nunca). */
  readonly asedioCada: number;
  readonly tipoAsedio: string;
  /** Tipo que reemplaza al asedio cuando el carril tiene "súper" (estructura enemiga clave destruida). */
  readonly tipoSuper: string;
  /** Multiplicador de vida/daño por minuto de partida. */
  readonly fuerza: Curva;
}

export interface Oleada {
  readonly numero: number;
  readonly carril: string;
  readonly unidades: Readonly<Record<string, number>>;
  readonly fuerza: number;
}

export class GeneradorCarriles {
  readonly def: DefOleadaCarril;
  readonly carriles: readonly string[];
  private t = 0;
  private numero = 0;
  private proxima: number;
  readonly superEn = new Set<string>();

  constructor(def: DefOleadaCarril, carriles: readonly string[]) {
    this.def = def;
    this.carriles = carriles;
    this.proxima = def.primera;
  }

  get tiempo(): number {
    return this.t;
  }

  actualizar(dt: number): Oleada[] {
    this.t += dt;
    const r: Oleada[] = [];
    while (this.t >= this.proxima) {
      this.numero++;
      const fuerza = evaluar(this.def.fuerza, this.proxima / 60 + 1);
      for (const c of this.carriles) {
        const u: Record<string, number> = { ...this.def.base };
        if (this.superEn.has(c)) u[this.def.tipoSuper] = (u[this.def.tipoSuper] ?? 0) + 1;
        else if (this.def.asedioCada > 0 && this.numero % this.def.asedioCada === 0) u[this.def.tipoAsedio] = (u[this.def.tipoAsedio] ?? 0) + 1;
        r.push({ numero: this.numero, carril: c, unidades: u, fuerza });
      }
      this.proxima += this.def.cada;
    }
    return r;
  }
}

// ---------------------------------------------------------------- Estructuras

export interface DefEstructura {
  readonly id: string;
  readonly vida: number;
  readonly danio: number;
  /** +fracción de daño por golpe consecutivo al mismo objetivo, con tope. */
  readonly calentamiento: number;
  readonly calentamientoMax: number;
  /** Estructuras que deben caer antes (protección). */
  readonly requiere?: readonly string[];
}

export class Estructura {
  readonly def: DefEstructura;
  vida: number;
  objetivo: number | null = null;
  private consecutivos = 0;

  constructor(def: DefEstructura) {
    this.def = def;
    this.vida = def.vida;
  }

  get viva(): boolean {
    return this.vida > 0;
  }

  /** ¿Se puede atacar? (todas las requeridas caídas). */
  atacable(caidas: ReadonlySet<string>): boolean {
    return this.viva && (this.def.requiere ?? []).every((r) => caidas.has(r));
  }

  /** Daño del próximo disparo al objetivo `id` (sube si es el mismo). */
  disparar(id: number): number {
    if (id === this.objetivo) this.consecutivos++;
    else {
      this.objetivo = id;
      this.consecutivos = 0;
    }
    return this.def.danio * (1 + Math.min(this.def.calentamientoMax, this.consecutivos * this.def.calentamiento));
  }

  recibir(danio: number, caidas: ReadonlySet<string>): boolean {
    if (!this.atacable(caidas)) return false;
    this.vida = Math.max(0, this.vida - danio);
    return this.vida === 0;
  }
}

// ---------------------------------------------------------------- Oro y experiencia

export interface ReglasRecompensaMoba {
  /** Oro por último golpe según el tipo de unidad. */
  readonly oroUnidad: Readonly<Record<string, number>>;
  readonly expUnidad: Readonly<Record<string, number>>;
  /** Experiencia compartida: multiplicador por cantidad de cercanos (1 → 1, 2 → 0.65 c/u...). */
  readonly repartoExp: Curva;
  /** Oro por asesinato base, por racha de la víctima y tope; fracción para asistencias. */
  readonly oroAsesinato: number;
  readonly oroPorRachaVictima: number;
  readonly oroRachaMax: number;
  readonly fraccionAsistencia: number;
  /** Oro pasivo por segundo. */
  readonly oroPasivo: number;
}

export interface Asesinato {
  readonly asesino: number;
  readonly victima: number;
  readonly asistentes: readonly number[];
  /** Racha de asesinatos de la víctima (para la recompensa por apagar). */
  readonly rachaVictima: number;
}

/** Oro de un asesinato: asesino y asistentes. Matar a alguien en racha da recompensa extra. */
export function oroAsesinato(a: Asesinato, r: ReglasRecompensaMoba): Map<number, number> {
  const m = new Map<number, number>();
  const extra = Math.min(r.oroRachaMax, Math.max(0, a.rachaVictima - 1) * r.oroPorRachaVictima);
  const total = r.oroAsesinato + extra;
  m.set(a.asesino, Math.round(total));
  if (a.asistentes.length) {
    const cada = Math.round((total * r.fraccionAsistencia) / a.asistentes.length);
    for (const x of a.asistentes) if (x !== a.asesino) m.set(x, (m.get(x) ?? 0) + cada);
  }
  return m;
}

/** Muere una unidad: oro para quien dio el último golpe, experiencia repartida entre los cercanos. */
export function recompensaUnidad(tipo: string, ultimoGolpe: number | null, cercanos: readonly number[], r: ReglasRecompensaMoba): { oro: Map<number, number>; exp: Map<number, number> } {
  const oro = new Map<number, number>();
  if (ultimoGolpe !== null) oro.set(ultimoGolpe, r.oroUnidad[tipo] ?? 0);
  const exp = new Map<number, number>();
  const n = cercanos.length;
  if (n > 0) {
    const cada = (r.expUnidad[tipo] ?? 0) * evaluar(r.repartoExp, n);
    for (const c of cercanos) exp.set(c, cada);
  }
  return { oro, exp };
}

/** Segundos de reaparición: curva por nivel × multiplicador por minuto de partida. */
export const tiempoReaparicion = (nivel: number, minuto: number, porNivel: Curva, porMinuto: Curva): number =>
  evaluar(porNivel, Math.max(1, nivel)) * evaluar(porMinuto, Math.max(1, minuto));

// ---------------------------------------------------------------- Rangos de habilidad

export interface ReglasRangos {
  /** Habilidades normales: rango máximo; definitiva: niveles en que se puede subir. */
  readonly rangoMax: number;
  readonly definitiva: string;
  readonly nivelesDefinitiva: readonly number[];
  /** Una habilidad normal no puede superar ceil(nivel/2) rangos. */
  readonly limitePorNivel?: boolean;
}

/** ¿Puede subir `habilidad` estando en `nivel` con estos rangos actuales? */
export function puedeSubirRango(habilidad: string, nivel: number, rangos: Readonly<Record<string, number>>, r: ReglasRangos): boolean {
  const gastados = Object.values(rangos).reduce((s, v) => s + v, 0);
  if (gastados >= nivel) return false;
  const actual = rangos[habilidad] ?? 0;
  if (habilidad === r.definitiva) return r.nivelesDefinitiva.filter((n) => n <= nivel).length > actual;
  if (actual >= r.rangoMax) return false;
  return !r.limitePorNivel || actual < Math.ceil(nivel / 2);
}
