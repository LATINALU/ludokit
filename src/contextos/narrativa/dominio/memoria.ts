// MEMORIA NARRATIVA y DISPARADORES de consecuencias: el puente entre la simulación y la historia.
//   - `MemoriaNarrativa`: lo que el mundo "recuerda" del jugador: hechos (banderas), contadores (cuántas veces),
//     relaciones con personajes (−100..100) y un registro cronológico. Implementa `Mundo` de los diálogos, así las
//     condiciones de un diálogo pueden preguntar "¿mató al jefe sin recibir daño?" o "¿qué opina de mí el herrero?".
//   - `Disparadores`: reglas por datos "cuando ocurre ESTE evento de dominio (con estas condiciones), registrá ESTO y
//     emití ESTA consecuencia narrativa" (abrir diálogo, iniciar misión, cambiar relación, desbloquear escena). Una
//     sola vez o repetible, con prioridad. El dominio no sabe de historia: el bus traduce eventos en consecuencias.
// Todo es serializable (guardado versionado) y determinista.

import { cumple, type Condicion, type Mundo, type Valor } from "./dialogo.ts";

export interface EventoNarrable {
  readonly tipo: string;
  /** Datos del evento (jefe: "coloso", sinDanio: true, zona: "puerto"...). */
  readonly datos?: Readonly<Record<string, Valor>>;
}

export interface RegistroNarrativo {
  readonly orden: number;
  readonly tipo: string;
  readonly datos?: Readonly<Record<string, Valor>>;
}

export class MemoriaNarrativa implements Mundo {
  private readonly vars = new Map<string, Valor>();
  private readonly relaciones = new Map<string, number>();
  readonly registro: RegistroNarrativo[] = [];
  private orden = 0;
  /** Largo máximo del registro (los más viejos se descartan; los hechos y contadores quedan). */
  readonly maxRegistro: number;

  constructor(maxRegistro = 500) {
    this.maxRegistro = maxRegistro;
  }

  obtener(v: string): Valor | undefined {
    if (v.startsWith("relacion.")) return this.relacion(v.slice(9));
    return this.vars.get(v);
  }

  fijar(v: string, valor: Valor): void {
    if (v.startsWith("relacion.") && typeof valor === "number") this.relaciones.set(v.slice(9), Math.max(-100, Math.min(100, valor)));
    else this.vars.set(v, valor);
  }

  tiene(v: string): boolean {
    const x = this.obtener(v);
    return x !== undefined && x !== false && x !== 0;
  }

  /** Suma a un contador ("veces.muerte", "asesinatos.civiles"). */
  contar(v: string, n = 1): number {
    const x = (typeof this.vars.get(v) === "number" ? (this.vars.get(v) as number) : 0) + n;
    this.vars.set(v, x);
    return x;
  }

  relacion(personaje: string): number {
    return this.relaciones.get(personaje) ?? 0;
  }

  /** Cambia la relación con un personaje (recortada a −100..100). Devuelve el valor nuevo. */
  cambiarRelacion(personaje: string, delta: number): number {
    const v = Math.max(-100, Math.min(100, this.relacion(personaje) + delta));
    this.relaciones.set(personaje, v);
    return v;
  }

  registrar(e: EventoNarrable): void {
    this.registro.push({ orden: ++this.orden, tipo: e.tipo, datos: e.datos });
    if (this.registro.length > this.maxRegistro) this.registro.splice(0, this.registro.length - this.maxRegistro);
  }

  /** ¿Ocurrió alguna vez un evento de este tipo que cumpla el filtro? (solo en el registro retenido). */
  ocurrio(tipo: string, filtro: Readonly<Record<string, Valor>> = {}): boolean {
    return this.registro.some((r) => r.tipo === tipo && Object.entries(filtro).every(([k, v]) => r.datos?.[k] === v));
  }

  exportar(): { vars: Array<[string, Valor]>; relaciones: Array<[string, number]>; registro: RegistroNarrativo[]; orden: number } {
    return { vars: [...this.vars], relaciones: [...this.relaciones], registro: [...this.registro], orden: this.orden };
  }

  importar(d: ReturnType<MemoriaNarrativa["exportar"]>): void {
    this.vars.clear();
    this.relaciones.clear();
    for (const [k, v] of d.vars) this.vars.set(k, v);
    for (const [k, v] of d.relaciones) this.relaciones.set(k, v);
    this.registro.splice(0, this.registro.length, ...d.registro);
    this.orden = d.orden;
  }
}

export type Consecuencia =
  | { readonly tipo: "hecho"; readonly var: string; readonly valor: Valor }
  | { readonly tipo: "contar"; readonly var: string; readonly n?: number }
  | { readonly tipo: "relacion"; readonly personaje: string; readonly delta: number }
  /** Lo interpreta la capa de juego: abrir un diálogo, iniciar una misión, una escena, un cambio del mundo. */
  | { readonly tipo: "disparar"; readonly accion: string; readonly datos?: Readonly<Record<string, Valor>> };

export interface Disparador {
  readonly id: string;
  /** Tipo de evento de dominio que lo activa. */
  readonly evento: string;
  /** Igualdades sobre los datos del evento. */
  readonly datos?: Readonly<Record<string, Valor>>;
  /** Condiciones sobre la memoria (mismo formato que los diálogos). */
  readonly si?: readonly Condicion[];
  readonly consecuencias: readonly Consecuencia[];
  /** Una sola vez (por defecto) o repetible. */
  readonly repetible?: boolean;
  /** Mayor = se evalúa antes. */
  readonly prioridad?: number;
}

/** Bus narrativo: escucha eventos de dominio, actualiza la memoria y devuelve las acciones para la capa de juego. */
export class Disparadores {
  private readonly lista: Disparador[];
  private readonly usados = new Set<string>();
  readonly memoria: MemoriaNarrativa;

  constructor(lista: readonly Disparador[], memoria: MemoriaNarrativa) {
    this.lista = [...lista].sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0) || a.id.localeCompare(b.id));
    this.memoria = memoria;
  }

  /** Procesa un evento: lo registra y aplica los disparadores que correspondan. Devuelve las acciones "disparar". */
  procesar(e: EventoNarrable): Array<{ accion: string; datos?: Readonly<Record<string, Valor>>; disparador: string }> {
    this.memoria.registrar(e);
    this.memoria.contar(`veces.${e.tipo}`);
    const acciones: Array<{ accion: string; datos?: Readonly<Record<string, Valor>>; disparador: string }> = [];
    for (const d of this.lista) {
      if (d.evento !== e.tipo || (!d.repetible && this.usados.has(d.id))) continue;
      if (d.datos && !Object.entries(d.datos).every(([k, v]) => e.datos?.[k] === v)) continue;
      if (d.si && !d.si.every((c) => cumple(c, this.memoria))) continue;
      if (!d.repetible) this.usados.add(d.id);
      for (const c of d.consecuencias) {
        if (c.tipo === "hecho") this.memoria.fijar(c.var, c.valor);
        else if (c.tipo === "contar") this.memoria.contar(c.var, c.n ?? 1);
        else if (c.tipo === "relacion") this.memoria.cambiarRelacion(c.personaje, c.delta);
        else acciones.push({ accion: c.accion, datos: c.datos, disparador: d.id });
      }
    }
    return acciones;
  }

  /** Valida referencias: disparadores sin consecuencias o ids repetidos. */
  static validar(lista: readonly Disparador[]): string[] {
    const e: string[] = [];
    const ids = new Set<string>();
    for (const d of lista) {
      if (ids.has(d.id)) e.push(`id repetido: ${d.id}`);
      ids.add(d.id);
      if (d.consecuencias.length === 0) e.push(`${d.id}: sin consecuencias`);
    }
    return e;
  }

  exportar(): string[] {
    return [...this.usados];
  }

  importar(usados: readonly string[]): void {
    this.usados.clear();
    for (const u of usados) this.usados.add(u);
  }
}
