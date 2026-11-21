// Árbol de talentos genérico: sendas × grados (o un grafo libre con requisitos), con rangos por talento, costo en
// puntos, nivel mínimo, exclusiones (elegir uno de dos) y reinicio con o sin costo. Devuelve modificadores para el
// sistema de atributos. Para RPG, ARPG, roguelite (meta-progresión) y juegos de estrategia (tecnologías).

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Modificador } from "../../combate/dominio/atributos.ts";

export interface DefTalento {
  readonly id: string;
  readonly rangos?: number;
  readonly costo?: number;
  readonly nivelMin?: number;
  /** Todos estos deben tener al menos 1 rango. */
  readonly requiere?: readonly string[];
  /** Ninguno de estos puede estar aprendido. */
  readonly excluye?: readonly string[];
  /** Puntos que hace falta haber gastado en la misma senda. */
  readonly puntosEnSenda?: number;
  readonly senda?: string;
  /** Modificadores por rango (se multiplican por el rango aprendido). */
  readonly mods?: readonly Omit<Modificador, "fuente">[];
}

export type ErrorTalento = "desconocido" | "sin-puntos" | "al-maximo" | "nivel" | "requisito" | "excluido" | "senda";

export class ArbolTalentos {
  private readonly defs: ReadonlyMap<string, DefTalento>;
  private readonly rangos = new Map<string, number>();
  puntos: number;

  constructor(defs: readonly DefTalento[], puntos = 0) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
    this.puntos = puntos;
    for (const d of defs) for (const r of d.requiere ?? []) if (!this.defs.has(r)) throw new Error(`Talento ${d.id} requiere ${r}, que no existe`);
  }

  /** Árbol clásico de sendas × grados: cada grado requiere el anterior de la misma senda. */
  static porSendas(sendas: Readonly<Record<string, ReadonlyArray<Omit<DefTalento, "requiere" | "senda">>>>, puntos = 0): ArbolTalentos {
    const defs: DefTalento[] = [];
    for (const [senda, lista] of Object.entries(sendas)) {
      lista.forEach((t, i) => defs.push({ ...t, senda, requiere: i > 0 ? [lista[i - 1].id] : [] }));
    }
    return new ArbolTalentos(defs, puntos);
  }

  rango(id: string): number {
    return this.rangos.get(id) ?? 0;
  }

  gastadoEnSenda(senda: string): number {
    let s = 0;
    for (const [id, r] of this.rangos) {
      const d = this.defs.get(id)!;
      if (d.senda === senda) s += r * (d.costo ?? 1);
    }
    return s;
  }

  puedeAprender(id: string, nivel = Infinity): Resultado<DefTalento, ErrorTalento> {
    const d = this.defs.get(id);
    if (!d) return fallo("desconocido");
    if (this.rango(id) >= (d.rangos ?? 1)) return fallo("al-maximo");
    if (this.puntos < (d.costo ?? 1)) return fallo("sin-puntos");
    if (nivel < (d.nivelMin ?? 0)) return fallo("nivel");
    if ((d.requiere ?? []).some((r) => this.rango(r) < 1)) return fallo("requisito");
    if ((d.excluye ?? []).some((r) => this.rango(r) > 0)) return fallo("excluido");
    if (d.puntosEnSenda && d.senda && this.gastadoEnSenda(d.senda) < d.puntosEnSenda) return fallo("senda");
    return exito(d);
  }

  aprender(id: string, nivel = Infinity): Resultado<number, ErrorTalento> {
    const r = this.puedeAprender(id, nivel);
    if (!r.ok) return r;
    this.puntos -= r.valor.costo ?? 1;
    const nuevo = this.rango(id) + 1;
    this.rangos.set(id, nuevo);
    return exito(nuevo);
  }

  /** Reinicia todo y devuelve los puntos. */
  reiniciar(): number {
    let devuelve = 0;
    for (const [id, r] of this.rangos) devuelve += r * (this.defs.get(id)!.costo ?? 1);
    this.rangos.clear();
    this.puntos += devuelve;
    return devuelve;
  }

  /** Modificadores de todos los talentos aprendidos (fuente = "talento:id"). */
  modificadores(): Modificador[] {
    const r: Modificador[] = [];
    for (const [id, rango] of this.rangos) for (const m of this.defs.get(id)!.mods ?? []) r.push({ ...m, valor: m.valor * rango, fuente: `talento:${id}` });
    return r;
  }

  exportar(): Record<string, number> {
    return Object.fromEntries(this.rangos);
  }

  importar(d: Readonly<Record<string, number>>): void {
    this.rangos.clear();
    for (const [k, v] of Object.entries(d)) if (this.defs.has(k)) this.rangos.set(k, v);
  }
}
