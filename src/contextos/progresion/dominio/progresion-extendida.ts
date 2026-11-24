// Progresión de largo plazo de los RPG/MMO/shooters modernos:
//   - PARAGON / PRESTIGIO: al llegar al nivel máximo, la experiencia sigue en una curva SIN TOPE que da puntos
//     repartibles (o reinicia el nivel a cambio de un rango de prestigio).
//   - EXPERIENCIA DESCANSADA: el tiempo desconectado acumula un bono (hasta un tope) que duplica la experiencia de
//     combate hasta gastarse.
//   - MAESTRÍA POR USO: armas, oficios y habilidades suben al usarlas; la probabilidad / la experiencia baja cuando la
//     tarea es "fácil" para el nivel actual (colores naranja → amarillo → verde → gris).
//   - REPUTACIÓN con facciones: rangos con umbrales, ganancias que también afectan a facciones aliadas/enemigas.
//   - PASE DE TEMPORADA: niveles por puntos con carril gratuito y premium, y niveles extra infinitos al final.

import type { Azar } from "../../../nucleo/azar.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";
import { CurvaNivelesInfinita } from "./niveles.ts";

// ---------------------------------------------------------------- Paragon / prestigio

export class Paragon {
  readonly curva: CurvaNivelesInfinita;
  readonly puntosPorNivel: number;
  experiencia = 0;
  private gastados = new Map<string, number>();
  /** Tope de puntos por atributo (Infinity = sin tope). */
  readonly topes: Readonly<Record<string, number>>;

  constructor(costo: Curva, puntosPorNivel = 1, topes: Readonly<Record<string, number>> = {}) {
    this.curva = new CurvaNivelesInfinita(costo);
    this.puntosPorNivel = puntosPorNivel;
    this.topes = topes;
  }

  get nivel(): number {
    return this.curva.nivelDe(this.experiencia).nivel - 1;
  }

  get puntosLibres(): number {
    let g = 0;
    for (const v of this.gastados.values()) g += v;
    return this.nivel * this.puntosPorNivel - g;
  }

  /** Suma experiencia; devuelve los niveles ganados. */
  ganar(exp: number): number {
    const antes = this.nivel;
    this.experiencia += Math.max(0, exp);
    return this.nivel - antes;
  }

  asignar(atributo: string, n = 1): boolean {
    const actual = this.gastados.get(atributo) ?? 0;
    if (n <= 0 || this.puntosLibres < n || actual + n > (this.topes[atributo] ?? Infinity)) return false;
    this.gastados.set(atributo, actual + n);
    return true;
  }

  puntos(atributo: string): number {
    return this.gastados.get(atributo) ?? 0;
  }

  reiniciarPuntos(): void {
    this.gastados.clear();
  }
}

/** Prestigio: al llegar a `nivelMax` se puede volver a 1 a cambio de +1 rango (y lo que el juego dé por rango). */
export function prestigiar(estado: { nivel: number; experiencia: number; prestigio: number }, nivelMax: number): boolean {
  if (estado.nivel < nivelMax) return false;
  estado.nivel = 1;
  estado.experiencia = 0;
  estado.prestigio++;
  return true;
}

// ---------------------------------------------------------------- Experiencia descansada

export interface ReglasDescanso {
  /** Experiencia de descanso por hora desconectado (o en zona segura) y tope. */
  readonly porHora: number;
  readonly tope: number;
  /** Multiplicador mientras haya descanso (2 = doble). */
  readonly mult: number;
}

export class Descanso {
  acumulado = 0;
  readonly reglas: ReglasDescanso;

  constructor(reglas: ReglasDescanso) {
    this.reglas = reglas;
  }

  descansar(horas: number): void {
    this.acumulado = Math.min(this.reglas.tope, this.acumulado + Math.max(0, horas) * this.reglas.porHora);
  }

  /** Aplica el bono a una ganancia de combate. Devuelve la experiencia total y cuánto se consumió del descanso. */
  aplicar(exp: number): { total: number; bono: number } {
    const bono = Math.min(this.acumulado, exp * (this.reglas.mult - 1));
    this.acumulado -= bono;
    return { total: exp + bono, bono };
  }
}

// ---------------------------------------------------------------- Maestría por uso

export type Dificultad = "imposible" | "dificil" | "media" | "facil" | "trivial";

export interface ReglasMaestria {
  /** Experiencia para el nivel siguiente (Curva sobre el nivel actual). */
  readonly costo: Curva;
  readonly nivelMax: number;
  /** Diferencias (nivel requerido de la tarea − nivel actual) para cada color. */
  readonly margenes: { readonly dificil: number; readonly media: number; readonly facil: number };
  /** Probabilidad/fracción de experiencia por dificultad. */
  readonly rinde: Readonly<Record<Dificultad, number>>;
}

export class Maestria {
  nivel = 1;
  experiencia = 0;
  readonly reglas: ReglasMaestria;

  constructor(reglas: ReglasMaestria) {
    this.reglas = reglas;
  }

  dificultad(nivelTarea: number): Dificultad {
    const d = nivelTarea - this.nivel;
    const m = this.reglas.margenes;
    if (d > 0) return "imposible";
    if (d >= -m.dificil) return "dificil";
    if (d >= -m.media) return "media";
    if (d >= -m.facil) return "facil";
    return "trivial";
  }

  /** Usar la habilidad en una tarea de `nivelTarea` con `exp` base. Con `azar`: sube por probabilidad (oficios). */
  usar(nivelTarea: number, exp: number, azar?: Azar): { subio: number; dificultad: Dificultad } {
    const dif = this.dificultad(nivelTarea);
    if (dif === "imposible" || this.nivel >= this.reglas.nivelMax) return { subio: 0, dificultad: dif };
    const rinde = this.reglas.rinde[dif];
    const gana = azar ? (azar.siguiente() < rinde ? exp : 0) : exp * rinde;
    this.experiencia += gana;
    let subio = 0;
    while (this.nivel < this.reglas.nivelMax) {
      const costo = Math.max(1, evaluar(this.reglas.costo, this.nivel));
      if (this.experiencia < costo) break;
      this.experiencia -= costo;
      this.nivel++;
      subio++;
    }
    return { subio, dificultad: dif };
  }
}

// ---------------------------------------------------------------- Reputación

export interface DefFaccion {
  readonly id: string;
  /** Facciones que ganan/pierden junto con esta: id → factor (0.5 aliada, −1 enemiga). */
  readonly relaciones?: Readonly<Record<string, number>>;
}

export class Reputacion {
  private readonly valores = new Map<string, number>();
  readonly facciones: ReadonlyMap<string, DefFaccion>;
  /** Rangos [umbral mínimo, nombre] ordenados (p. ej. odiado, hostil, neutral, amistoso, honrado, venerado...). */
  readonly rangos: ReadonlyArray<readonly [number, string]>;
  readonly min: number;
  readonly max: number;

  constructor(facciones: readonly DefFaccion[], rangos: ReadonlyArray<readonly [number, string]>, min = -Infinity, max = Infinity, inicial: Readonly<Record<string, number>> = {}) {
    this.facciones = new Map(facciones.map((f) => [f.id, f]));
    this.rangos = rangos;
    this.min = min;
    this.max = max;
    for (const [k, v] of Object.entries(inicial)) this.valores.set(k, v);
  }

  valor(faccion: string): number {
    return this.valores.get(faccion) ?? 0;
  }

  rango(faccion: string): string {
    const v = this.valor(faccion);
    let r = this.rangos[0]?.[1] ?? "";
    for (const [umbral, nombre] of this.rangos) if (v >= umbral) r = nombre;
    return r;
  }

  /** Gana (o pierde) reputación con una facción y propaga a las relacionadas. Devuelve los cambios aplicados. */
  ganar(faccion: string, cantidad: number, mult = 1): Record<string, number> {
    const cambios: Record<string, number> = {};
    const aplicar = (id: string, c: number): void => {
      const antes = this.valor(id);
      const despues = Math.min(this.max, Math.max(this.min, antes + c));
      this.valores.set(id, despues);
      cambios[id] = despues - antes;
    };
    aplicar(faccion, cantidad * mult);
    for (const [id, f] of Object.entries(this.facciones.get(faccion)?.relaciones ?? {})) aplicar(id, cantidad * mult * f);
    return cambios;
  }

  exportar(): Record<string, number> {
    return Object.fromEntries(this.valores);
  }
}

// ---------------------------------------------------------------- Pase de temporada

export interface PremioPase<P> {
  readonly nivel: number;
  readonly carril: "gratis" | "premium";
  readonly premio: P;
}

export class PaseTemporada<P> {
  readonly puntosPorNivel: Curva;
  readonly niveles: number;
  readonly premios: readonly PremioPase<P>[];
  /** Premio repetible de los niveles extra (después del último). */
  readonly premioExtra?: P;
  puntos = 0;
  premium = false;
  private readonly reclamados = new Set<string>();

  constructor(puntosPorNivel: Curva, niveles: number, premios: readonly PremioPase<P>[], premioExtra?: P) {
    this.puntosPorNivel = puntosPorNivel;
    this.niveles = niveles;
    this.premios = premios;
    this.premioExtra = premioExtra;
  }

  /** Nivel alcanzado (puede superar `niveles`: los extra son infinitos). */
  get nivel(): number {
    let n = 0, resto = this.puntos;
    for (;;) {
      const c = Math.max(1, evaluar(this.puntosPorNivel, n + 1));
      if (resto < c) return n;
      resto -= c;
      n++;
      if (n > 1e6) return n;
    }
  }

  sumar(p: number): void {
    this.puntos += Math.max(0, p);
  }

  /** Premios pendientes de reclamar (respeta el carril premium). Los marca como reclamados. */
  reclamar(): P[] {
    const n = this.nivel;
    const r: P[] = [];
    for (const p of this.premios) {
      const k = `${p.nivel}/${p.carril}`;
      if (p.nivel <= n && !this.reclamados.has(k) && (p.carril === "gratis" || this.premium)) {
        this.reclamados.add(k);
        r.push(p.premio);
      }
    }
    if (this.premioExtra !== undefined) {
      for (let k = this.niveles + 1; k <= n; k++) {
        const clave = `extra/${k}`;
        if (!this.reclamados.has(clave)) {
          this.reclamados.add(clave);
          r.push(this.premioExtra);
        }
      }
    }
    return r;
  }
}
