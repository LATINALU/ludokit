// Modos de juego competitivos y cooperativos (shooters, MOBA, arenas, battle royale):
//   - `PuntoCaptura`: zona que se captura con jugadores dentro (más rápido con más, hasta un tope), DISPUTADA si
//     hay de los dos equipos, que decae si nadie la sostiene. Sirve para dominación, rey de la colina, conquista.
//   - `Marcador`: puntos por equipo con objetivo (primero a N), tiempo límite y "sangrado de tickets" (cada punto
//     de captura controlado quita tickets al rival por segundo).
//   - `ZonaSegura` (battle royale): círculo que se achica por fases con daño fuera, centro siguiente al azar
//     dentro del actual.
//   - `Reapariciones`: oleadas de reaparición por equipo y vidas limitadas.

import type { Azar } from "../../../nucleo/azar.ts";

export interface ReglasCaptura {
  /** Progreso por segundo con 1 jugador, extra por jugador adicional y máximo de jugadores que cuentan. */
  readonly ritmo: number;
  readonly porExtra: number;
  readonly maxContados: number;
  /** Progreso que pierde por segundo si nadie está. */
  readonly decae: number;
}

/** Progreso −1..1: negativo = equipo B, positivo = equipo A; dueño al llegar a ±1. */
export class PuntoCaptura {
  progreso = 0;
  duenio: "A" | "B" | null = null;
  disputado = false;
  readonly reglas: ReglasCaptura;

  constructor(reglas: ReglasCaptura) {
    this.reglas = reglas;
  }

  actualizar(dt: number, enA: number, enB: number): "A" | "B" | null {
    const r = this.reglas;
    this.disputado = enA > 0 && enB > 0;
    let cambio: "A" | "B" | null = null;
    if (this.disputado) return null;
    const n = enA || enB;
    if (n === 0) {
      // Decae hacia el dueño actual (o hacia 0 si no hay).
      const meta = this.duenio === "A" ? 1 : this.duenio === "B" ? -1 : 0;
      const d = meta - this.progreso;
      this.progreso += Math.sign(d) * Math.min(Math.abs(d), r.decae * dt);
      return null;
    }
    const v = (r.ritmo + r.porExtra * (Math.min(n, r.maxContados) - 1)) * dt * (enA > 0 ? 1 : -1);
    this.progreso = Math.max(-1, Math.min(1, this.progreso + v));
    if (this.progreso >= 1 && this.duenio !== "A") cambio = this.duenio = "A";
    else if (this.progreso <= -1 && this.duenio !== "B") cambio = this.duenio = "B";
    else if (this.duenio === "A" && this.progreso <= 0) this.duenio = null;
    else if (this.duenio === "B" && this.progreso >= 0) this.duenio = null;
    return cambio;
  }
}

export class Marcador {
  readonly puntos = new Map<string, number>();
  readonly objetivo: number;
  tiempoRestante: number;
  ganador: string | null = null;

  constructor(equipos: readonly string[], objetivo: number, tiempoLimite = Infinity, inicial = 0) {
    for (const e of equipos) this.puntos.set(e, inicial);
    this.objetivo = objetivo;
    this.tiempoRestante = tiempoLimite;
  }

  sumar(equipo: string, n: number): string | null {
    if (this.ganador) return this.ganador;
    this.puntos.set(equipo, (this.puntos.get(equipo) ?? 0) + n);
    if ((this.puntos.get(equipo) ?? 0) >= this.objetivo) this.ganador = equipo;
    return this.ganador;
  }

  /** Tickets: quita `n` a un equipo; con 0 gana el otro (si son dos). */
  restar(equipo: string, n: number): string | null {
    if (this.ganador) return this.ganador;
    const v = Math.max(0, (this.puntos.get(equipo) ?? 0) - n);
    this.puntos.set(equipo, v);
    if (v === 0) {
      const otros = [...this.puntos.keys()].filter((k) => k !== equipo);
      if (otros.length === 1) this.ganador = otros[0];
    }
    return this.ganador;
  }

  /** Avanza el reloj; al terminar gana quien tenga más (o "empate"). */
  actualizar(dt: number): string | null {
    if (this.ganador) return this.ganador;
    this.tiempoRestante -= dt;
    if (this.tiempoRestante <= 0) {
      const orden = [...this.puntos].sort((a, b) => b[1] - a[1]);
      this.ganador = orden.length > 1 && orden[0][1] === orden[1][1] ? "empate" : orden[0][0];
    }
    return this.ganador;
  }
}

export interface FaseZona {
  /** Segundos de espera antes de cerrar, segundos que tarda en cerrar, radio final y daño por segundo fuera. */
  readonly espera: number;
  readonly cierre: number;
  readonly radio: number;
  readonly danio: number;
}

export class ZonaSegura {
  x: number;
  y: number;
  radio: number;
  fase = 0;
  private desdeX: number;
  private desdeY: number;
  private desdeR: number;
  private haciaX: number;
  private haciaY: number;
  private t = 0;
  readonly fases: readonly FaseZona[];
  private readonly azar: Azar;

  constructor(x: number, y: number, radio: number, fases: readonly FaseZona[], azar: Azar) {
    this.x = this.desdeX = this.haciaX = x;
    this.y = this.desdeY = this.haciaY = y;
    this.radio = this.desdeR = radio;
    this.fases = fases;
    this.azar = azar;
    this.elegirCentro();
  }

  private elegirCentro(): void {
    const f = this.fases[this.fase];
    if (!f) return;
    // El círculo siguiente queda completamente dentro del actual.
    const margen = Math.max(0, this.radio - f.radio);
    const a = this.azar.siguiente() * Math.PI * 2, r = Math.sqrt(this.azar.siguiente()) * margen;
    this.haciaX = this.x + Math.cos(a) * r;
    this.haciaY = this.y + Math.sin(a) * r;
  }

  /** Centro y radio de la próxima zona (para dibujarla). */
  get proxima(): { x: number; y: number; radio: number } | null {
    const f = this.fases[this.fase];
    return f ? { x: this.haciaX, y: this.haciaY, radio: f.radio } : null;
  }

  get danio(): number {
    return this.fases[Math.min(this.fase, this.fases.length - 1)]?.danio ?? 0;
  }

  fuera(px: number, py: number): boolean {
    return Math.hypot(px - this.x, py - this.y) > this.radio;
  }

  actualizar(dt: number): void {
    const f = this.fases[this.fase];
    if (!f) return;
    this.t += dt;
    if (this.t <= f.espera) return;
    const k = Math.min(1, (this.t - f.espera) / Math.max(1e-6, f.cierre));
    this.x = this.desdeX + (this.haciaX - this.desdeX) * k;
    this.y = this.desdeY + (this.haciaY - this.desdeY) * k;
    this.radio = this.desdeR + (f.radio - this.desdeR) * k;
    if (k >= 1) {
      this.fase++;
      this.t = 0;
      this.desdeX = this.x;
      this.desdeY = this.y;
      this.desdeR = this.radio;
      this.elegirCentro();
    }
  }
}

/** Reaparición por oleadas: los muertos reaparecen juntos cada `intervalo` s; con `vidas` limitadas por equipo. */
export class Reapariciones {
  readonly intervalo: number;
  private readonly esperando = new Set<number>();
  private t = 0;
  readonly vidas = new Map<string, number>();

  constructor(intervalo: number, vidasPorEquipo: Readonly<Record<string, number>> = {}) {
    this.intervalo = intervalo;
    for (const [k, v] of Object.entries(vidasPorEquipo)) this.vidas.set(k, v);
  }

  morir(id: number, equipo: string): boolean {
    const v = this.vidas.get(equipo);
    if (v !== undefined) {
      if (v <= 0) return false;
      this.vidas.set(equipo, v - 1);
    }
    this.esperando.add(id);
    return true;
  }

  /** Devuelve los que reaparecen en este paso. */
  actualizar(dt: number): number[] {
    this.t += dt;
    if (this.t < this.intervalo) return [];
    this.t -= this.intervalo;
    const r = [...this.esperando];
    this.esperando.clear();
    return r;
  }

  get proxima(): number {
    return this.intervalo - this.t;
  }
}
