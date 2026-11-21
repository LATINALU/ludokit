// Sistema de habilidades (al estilo de los sistemas de habilidades de los motores AAA, simplificado):
//   - Definición = datos: costo (recurso), recarga, recarga global, cargas, tiempo de lanzamiento, canalización,
//     rango, etiquetas que bloquean o requiere ("aturdido" bloquea todo, "silenciado" bloquea "hechizo").
//   - Instancia por personaje: cooldowns, cargas, lanzamiento en curso. Interrumpible.
//   - El efecto NO vive aquí: al completar emite un evento y la capa de juego aplica daño, proyectiles, buffs.
// Válido para un plataformas con 3 habilidades, un ARPG con barra de 10 y un MMO con GCD.

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";

export interface DefHabilidad {
  readonly id: string;
  readonly costo?: { readonly recurso: string; readonly cantidad: number };
  readonly recarga: number;
  /** Activa la recarga global (GCD) al usarla. */
  readonly usaGlobal?: boolean;
  readonly cargas?: number;
  /** Tiempo de lanzamiento (0 = instantánea). */
  readonly lanzamiento?: number;
  /** Canalización: emite "pulso" cada `cadaPulso` durante `duracion`. */
  readonly canal?: { readonly duracion: number; readonly cadaPulso: number };
  readonly rango?: number;
  readonly etiquetas?: readonly string[];
  /** Estados del personaje que impiden usarla. */
  readonly bloqueadaPor?: readonly string[];
  /** Se puede usar en movimiento (si no, moverse interrumpe el lanzamiento). */
  readonly enMovimiento?: boolean;
}

export type ErrorHabilidad = "desconocida" | "en-recarga" | "recarga-global" | "sin-recurso" | "bloqueada" | "fuera-de-rango" | "ocupado";

export type EventoHabilidad =
  | { readonly tipo: "inicio"; readonly id: string }
  | { readonly tipo: "efecto"; readonly id: string; readonly objetivo?: unknown }
  | { readonly tipo: "pulso"; readonly id: string; readonly n: number; readonly objetivo?: unknown }
  | { readonly tipo: "interrumpida"; readonly id: string };

export interface UsuarioHabilidades {
  /** Gasta del recurso si alcanza. */
  gastar(recurso: string, cantidad: number): boolean;
  tiene(recurso: string, cantidad: number): boolean;
  /** Estados activos ("aturdido", "silenciado"...). */
  readonly estados: ReadonlySet<string>;
  /** Reducción de recarga 0..1 (prisa). */
  readonly prisa?: number;
}

interface EnCurso {
  readonly def: DefHabilidad;
  t: number;
  pulsos: number;
  readonly objetivo?: unknown;
  canalizando: boolean;
}

export class Habilidades {
  private readonly defs = new Map<string, DefHabilidad>();
  private readonly recargas = new Map<string, number>();
  private readonly cargas = new Map<string, number>();
  private global = 0;
  readonly duracionGlobal: number;
  private enCurso: EnCurso | null = null;

  constructor(defs: readonly DefHabilidad[], duracionGlobal = 1.0) {
    for (const d of defs) {
      this.defs.set(d.id, d);
      this.cargas.set(d.id, d.cargas ?? 1);
    }
    this.duracionGlobal = duracionGlobal;
  }

  get ocupado(): boolean {
    return this.enCurso !== null;
  }
  get lanzando(): string | null {
    return this.enCurso?.def.id ?? null;
  }
  /** 0..1 del lanzamiento o canal en curso (barra de lanzamiento). */
  get progresoLanzamiento(): number {
    const c = this.enCurso;
    if (!c) return 0;
    const total = c.canalizando ? c.def.canal!.duracion : c.def.lanzamiento ?? 0;
    return total > 0 ? Math.min(1, c.t / total) : 1;
  }

  recargaRestante(id: string): number {
    return this.recargas.get(id) ?? 0;
  }
  cargasDe(id: string): number {
    return this.cargas.get(id) ?? 0;
  }

  puedeUsar(id: string, p: UsuarioHabilidades, distancia = 0): Resultado<DefHabilidad, ErrorHabilidad> {
    const d = this.defs.get(id);
    if (!d) return fallo("desconocida");
    if (this.enCurso) return fallo("ocupado");
    if ((d.bloqueadaPor ?? []).some((e) => p.estados.has(e)) || p.estados.has("aturdido")) return fallo("bloqueada");
    if (d.usaGlobal && this.global > 0) return fallo("recarga-global");
    if ((this.cargas.get(id) ?? 0) <= 0) return fallo("en-recarga");
    if (d.costo && !p.tiene(d.costo.recurso, d.costo.cantidad)) return fallo("sin-recurso");
    if (d.rango !== undefined && distancia > d.rango) return fallo("fuera-de-rango");
    return exito(d);
  }

  /** Intenta usar. Si es instantánea, el efecto sale ya en los eventos. */
  usar(id: string, p: UsuarioHabilidades, distancia = 0, objetivo?: unknown): Resultado<EventoHabilidad[], ErrorHabilidad> {
    const r = this.puedeUsar(id, p, distancia);
    if (!r.ok) return r;
    const d = r.valor;
    if (d.costo && !p.gastar(d.costo.recurso, d.costo.cantidad)) return fallo("sin-recurso");
    this.consumirCarga(d, p);
    if (d.usaGlobal) this.global = this.duracionGlobal * (1 - (p.prisa ?? 0));
    const ev: EventoHabilidad[] = [{ tipo: "inicio", id }];
    if ((d.lanzamiento ?? 0) > 0 || d.canal) {
      this.enCurso = { def: d, t: 0, pulsos: 0, objetivo, canalizando: (d.lanzamiento ?? 0) <= 0 && !!d.canal };
    } else {
      ev.push({ tipo: "efecto", id, objetivo });
    }
    return exito(ev);
  }

  private consumirCarga(d: DefHabilidad, p: UsuarioHabilidades): void {
    const n = (this.cargas.get(d.id) ?? 1) - 1;
    this.cargas.set(d.id, n);
    if (!this.recargas.get(d.id)) this.recargas.set(d.id, d.recarga * (1 - (p.prisa ?? 0)));
  }

  /** Interrumpe el lanzamiento (golpe, aturdimiento, moverse). No devuelve el costo. */
  interrumpir(): EventoHabilidad[] {
    if (!this.enCurso) return [];
    const id = this.enCurso.def.id;
    this.enCurso = null;
    return [{ tipo: "interrumpida", id }];
  }

  actualizar(dt: number, p?: UsuarioHabilidades, moviendose = false): EventoHabilidad[] {
    const ev: EventoHabilidad[] = [];
    this.global = Math.max(0, this.global - dt);
    for (const [id, t] of this.recargas) {
      if (t <= 0) continue;
      const nt = t - dt;
      const d = this.defs.get(id)!;
      const max = d.cargas ?? 1;
      if (nt <= 0) {
        const c = Math.min(max, (this.cargas.get(id) ?? 0) + 1);
        this.cargas.set(id, c);
        this.recargas.set(id, c < max ? d.recarga * (1 - (p?.prisa ?? 0)) + nt : 0);
      } else {
        this.recargas.set(id, nt);
      }
    }
    const c = this.enCurso;
    if (!c) return ev;
    if ((moviendose && !c.def.enMovimiento) || (p && p.estados.has("aturdido"))) return this.interrumpir();
    c.t += dt;
    if (!c.canalizando) {
      if (c.t >= (c.def.lanzamiento ?? 0)) {
        ev.push({ tipo: "efecto", id: c.def.id, objetivo: c.objetivo });
        if (c.def.canal) {
          c.canalizando = true;
          c.t = 0;
        } else {
          this.enCurso = null;
        }
      }
      return ev;
    }
    const canal = c.def.canal!;
    while (c.pulsos < Math.floor(Math.min(c.t, canal.duracion) / canal.cadaPulso)) {
      c.pulsos++;
      ev.push({ tipo: "pulso", id: c.def.id, n: c.pulsos, objetivo: c.objetivo });
    }
    if (c.t >= canal.duracion) this.enCurso = null;
    return ev;
  }
}
