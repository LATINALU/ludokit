// Objetos con vencimiento (alquileres, pases de temporada) y suscripciones por tiempo que amplían el inventario.

import { DIA, HORA, type Reloj } from "../../../nucleo/reloj.ts";
import type { Inventario, Pila, Posicion } from "./inventario.ts";

export function venceEn(desde: number, horas: number): number {
  return desde + horas * HORA;
}

export function vencimientoDe(pila: Pila): number | undefined {
  const v = pila.extra?.["vence"];
  return typeof v === "number" ? v : undefined;
}

export function estaVencido(pila: Pila, ahora: number): boolean {
  const v = vencimientoDe(pila);
  return v !== undefined && v <= ahora;
}

/** Agrega un objeto temporal (cantidad 1, con su fecha). */
export function agregarTemporal(inv: Inventario, objeto: number, horas: number, reloj: Reloj, extra: Readonly<Record<string, unknown>> = {}) {
  return inv.agregar(objeto, 1, { ...extra, vence: venceEn(reloj.ahora(), horas) });
}

/** Quita los objetos vencidos y devuelve qué se quitó (para avisar al jugador). */
export function quitarVencidos(inv: Inventario, reloj: Reloj): { posicion: Posicion; pila: Pila }[] {
  const ahora = reloj.ahora();
  const quitados: { posicion: Posicion; pila: Pila }[] = [];
  for (const p of inv.posiciones()) {
    const pila = inv.en(p);
    if (pila !== null && estaVencido(pila, ahora)) {
      const r = inv.sacarDe(p);
      if (r.ok) quitados.push({ posicion: p, pila: r.valor });
    }
  }
  return quitados;
}

/** Suscripción acumulable por tiempo (VIP, pase de batalla, bonus de EXP de 7 días...). */
export class Suscripcion {
  private hasta: number;
  private readonly reloj: Reloj;

  constructor(reloj: Reloj, hasta = 0) {
    this.reloj = reloj;
    this.hasta = hasta;
  }

  get activa(): boolean {
    return this.hasta > this.reloj.ahora();
  }

  get vence(): number {
    return this.hasta;
  }

  restanteMs(): number {
    return Math.max(0, this.hasta - this.reloj.ahora());
  }

  /** Suma tiempo desde el vencimiento actual si sigue activa, o desde ahora si ya venció. */
  extender(ms: number): number {
    this.hasta = Math.max(this.hasta, this.reloj.ahora()) + ms;
    return this.hasta;
  }

  extenderDias(dias: number): number {
    return this.extender(dias * DIA);
  }
}

/** Sincroniza las pestañas del inventario con el estado de la suscripción. */
export function aplicarVip(inv: Inventario, vip: Suscripcion, normales: number, conVip: number): void {
  inv.cambiarPestanasActivas(vip.activa ? conVip : normales);
}
