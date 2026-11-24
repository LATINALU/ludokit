// Arma de fuego como máquina de estados determinista (shooter en primera/tercera persona, top-down, extracción):
//   - CADENCIA en disparos por minuto; modos semi, automático, ráfaga de N y cerrojo (acción manual entre tiros).
//   - CARGADOR + RESERVA; recarga TÁCTICA (queda una en la recámara: cargador + 1) y recarga VACÍA (más lenta).
//   - Recarga por cartucho (escopetas): se puede interrumpir disparando.
//   - Tiempo de preparación al sacar el arma, CALENTAMIENTO opcional (miniguns) y SOBRECALENTAMIENTO (armas de
//     energía: cada tiro calienta, al llegar a 1 se traba hasta enfriar).
//   - Encasquillado opcional según la condición del arma (supervivencia / extracción).
// No mueve balas ni calcula daño: emite eventos ("disparo", "recarga-fin"...) que la capa de juego convierte en
// rayos (`resolverDisparo`) o proyectiles. Avanzar con `actualizar(dt, gatillo)` en el paso fijo.

import type { Azar } from "../../../nucleo/azar.ts";

export type ModoFuego = "semi" | "auto" | "rafaga" | "cerrojo";

export interface DefArma {
  readonly id: string;
  /** Disparos por minuto. */
  readonly cadencia: number;
  readonly modos: readonly ModoFuego[];
  readonly balasRafaga?: number;
  /** Proyectiles por disparo (escopetas: 8-12). */
  readonly perdigones?: number;
  readonly cargador: number;
  /** Recámara: con recarga táctica queda cargador + 1. */
  readonly recamara?: boolean;
  /** Segundos de recarga con balas en el cargador y con el cargador vacío. */
  readonly recargaTactica: number;
  readonly recargaVacia: number;
  /** Recarga cartucho a cartucho: segundos por cartucho (reemplaza a las recargas de arriba). */
  readonly porCartucho?: number;
  /** Segundos al sacar el arma. */
  readonly preparacion?: number;
  /** Segundos de acción manual entre tiros (cerrojo, corredera). */
  readonly accion?: number;
  /** Segundos hasta llegar a la cadencia completa (giro de cañones). */
  readonly calentamiento?: number;
  /** Calor por disparo (0..1) y enfriamiento por segundo; trabada hasta bajar de `destrabar`. */
  readonly calorPorDisparo?: number;
  readonly enfriamiento?: number;
  readonly destrabar?: number;
  /** Munición infinita en la reserva (modos arcade). */
  readonly reservaInfinita?: boolean;
}

export type EventoArma =
  | { readonly tipo: "disparo"; readonly perdigones: number; readonly numero: number }
  | { readonly tipo: "vacio" }
  | { readonly tipo: "recarga-inicio"; readonly segundos: number; readonly vacia: boolean }
  | { readonly tipo: "cartucho" }
  | { readonly tipo: "recarga-fin" }
  | { readonly tipo: "sobrecalentada" }
  | { readonly tipo: "encasquillada" }
  | { readonly tipo: "lista" };

export type EstadoArma = "preparando" | "lista" | "recargando" | "accion" | "trabada" | "encasquillada";

export class Arma {
  readonly def: DefArma;
  balas: number;
  reserva: number;
  modo: ModoFuego;
  estado: EstadoArma;
  calor = 0;
  /** 0..1 de condición (1 = nueva). Con `azar` y condición baja puede encasquillarse. */
  condicion = 1;
  disparados = 0;
  private espera = 0;
  private enfriar = 0;
  private giro = 0;
  private rafagaPendiente = 0;
  private gatilloPrevio = false;
  private recargaVacia = false;
  private readonly azar?: Azar;
  /** Probabilidad de encasquillarse por disparo con condición 0 (se escala con 1 − condición). */
  probEncasquillar = 0;

  constructor(def: DefArma, reserva: number, op: { azar?: Azar; cargado?: boolean } = {}) {
    this.def = def;
    this.balas = op.cargado === false ? 0 : def.cargador;
    this.reserva = reserva;
    this.modo = def.modos[0];
    this.azar = op.azar;
    this.estado = def.preparacion ? "preparando" : "lista";
    this.espera = def.preparacion ?? 0;
  }

  get intervalo(): number {
    return 60 / this.def.cadencia;
  }

  get capacidad(): number {
    return this.def.cargador + (this.def.recamara && this.balas > 0 ? 1 : 0);
  }

  cambiarModo(): ModoFuego {
    const i = this.def.modos.indexOf(this.modo);
    this.modo = this.def.modos[(i + 1) % this.def.modos.length];
    this.rafagaPendiente = 0;
    return this.modo;
  }

  /** Pide recargar. Devuelve false si no hace falta o no hay reserva. */
  recargar(ev: EventoArma[] = []): boolean {
    if (this.estado === "recargando" || this.estado === "preparando") return false;
    if (this.reserva <= 0 && !this.def.reservaInfinita) return false;
    if (this.balas >= this.capacidad) return false;
    this.recargaVacia = this.balas === 0;
    this.estado = "recargando";
    this.rafagaPendiente = 0;
    this.espera = this.def.porCartucho ?? (this.recargaVacia ? this.def.recargaVacia : this.def.recargaTactica);
    ev.push({ tipo: "recarga-inicio", segundos: this.espera, vacia: this.recargaVacia });
    return true;
  }

  /** Destraba un encasquillamiento (acción del jugador). */
  destrabar(segundos = 0.8): void {
    if (this.estado !== "encasquillada") return;
    this.estado = "accion";
    this.espera = segundos;
  }

  /** Cancela la recarga (cambiar de arma, correr). */
  cancelarRecarga(): void {
    if (this.estado === "recargando") {
      this.estado = "lista";
      this.espera = 0;
    }
  }

  private completarRecarga(ev: EventoArma[]): void {
    const cap = this.def.recamara && !this.recargaVacia ? this.def.cargador + 1 : this.def.cargador;
    const quiere = cap - this.balas;
    const pone = this.def.reservaInfinita ? quiere : Math.min(quiere, this.reserva);
    this.balas += pone;
    if (!this.def.reservaInfinita) this.reserva -= pone;
    this.estado = "lista";
    ev.push({ tipo: "recarga-fin" });
  }

  /** Avanza el arma. `gatillo`: si está apretado este paso. Devuelve los eventos del paso. */
  actualizar(dt: number, gatillo: boolean): EventoArma[] {
    const ev: EventoArma[] = [];
    const flanco = gatillo && !this.gatilloPrevio;
    this.gatilloPrevio = gatillo;
    // Calor
    if (this.def.calorPorDisparo) {
      this.calor = Math.max(0, this.calor - (this.def.enfriamiento ?? 0.5) * dt);
      if (this.estado === "trabada" && this.calor <= (this.def.destrabar ?? 0.3)) {
        this.estado = "lista";
        ev.push({ tipo: "lista" });
      }
    }
    // Calentamiento de cañones
    if (this.def.calentamiento) this.giro = gatillo ? Math.min(this.def.calentamiento, this.giro + dt) : Math.max(0, this.giro - dt);
    // El sobrante (negativo) se conserva para que la cadencia sea exacta aunque el intervalo no sea múltiplo de dt.
    if (this.enfriar > 0) this.enfriar -= dt;
    else this.enfriar = 0;

    if (this.estado === "preparando" || this.estado === "accion") {
      this.espera -= dt;
      if (this.espera <= 0) {
        this.estado = "lista";
        ev.push({ tipo: "lista" });
      }
      return ev;
    }
    if (this.estado === "recargando") {
      // Recarga por cartucho: disparar la interrumpe si hay al menos una.
      if (this.def.porCartucho && flanco && this.balas > 0) {
        this.estado = "lista";
      } else {
        this.espera -= dt;
        if (this.espera <= 0) {
          if (this.def.porCartucho) {
            if (this.def.reservaInfinita || this.reserva > 0) {
              this.balas++;
              if (!this.def.reservaInfinita) this.reserva--;
              ev.push({ tipo: "cartucho" });
            }
            if (this.balas >= this.def.cargador || (!this.def.reservaInfinita && this.reserva <= 0)) {
              this.estado = "lista";
              ev.push({ tipo: "recarga-fin" });
            } else this.espera += this.def.porCartucho;
          } else this.completarRecarga(ev);
        }
        return ev;
      }
    }
    if (this.estado !== "lista") return ev;

    const quiere = this.modo === "auto" ? gatillo : this.modo === "rafaga" ? flanco || this.rafagaPendiente > 0 : flanco;
    if (!quiere || this.enfriar > 1e-9) return ev;
    if (this.def.calentamiento && this.giro < this.def.calentamiento) return ev;
    if (this.balas <= 0) {
      if (flanco) ev.push({ tipo: "vacio" });
      this.rafagaPendiente = 0;
      return ev;
    }
    if (this.azar && this.probEncasquillar > 0 && this.azar.siguiente() < this.probEncasquillar * (1 - this.condicion)) {
      this.estado = "encasquillada";
      ev.push({ tipo: "encasquillada" });
      return ev;
    }
    if (this.modo === "rafaga" && this.rafagaPendiente === 0) this.rafagaPendiente = this.def.balasRafaga ?? 3;
    if (this.rafagaPendiente > 0) this.rafagaPendiente--;
    this.balas--;
    this.disparados++;
    this.enfriar = Math.min(0, this.enfriar) + this.intervalo;
    ev.push({ tipo: "disparo", perdigones: this.def.perdigones ?? 1, numero: this.disparados });
    if (this.modo === "cerrojo" || this.def.accion) {
      this.estado = "accion";
      this.espera = this.def.accion ?? this.intervalo;
    }
    if (this.def.calorPorDisparo) {
      this.calor = Math.min(1, this.calor + this.def.calorPorDisparo);
      if (this.calor >= 1) {
        this.estado = "trabada";
        ev.push({ tipo: "sobrecalentada" });
      }
    }
    return ev;
  }
}

/** Daño por segundo teórico (sin recargas) y sostenido (con recarga vacía). */
export function dpsArma(def: DefArma, danioPorProyectil: number): { rafaga: number; sostenido: number } {
  const porTiro = danioPorProyectil * (def.perdigones ?? 1);
  const intervalo = Math.max(60 / def.cadencia, def.accion ?? 0);
  const rafaga = porTiro / intervalo;
  const vaciar = def.cargador * intervalo;
  const recarga = def.porCartucho ? def.porCartucho * def.cargador : def.recargaVacia;
  return { rafaga, sostenido: (porTiro * def.cargador) / (vaciar + recarga) };
}

/** Tiempo para matar (TTK) con `vida` y `danio` por impacto, dada la cadencia (el primer tiro sale en t = 0). */
export const tiempoParaMatar = (vida: number, danio: number, def: DefArma): number =>
  (Math.ceil(vida / Math.max(1e-9, danio)) - 1) * Math.max(60 / def.cadencia, def.accion ?? 0);
