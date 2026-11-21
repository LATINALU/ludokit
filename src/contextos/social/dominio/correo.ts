// Correo con adjuntos (objetos y moneda): premios del sistema, regalos entre jugadores, entregas diferidas.

import type { Reloj } from "../../../nucleo/reloj.ts";
import { DIA } from "../../../nucleo/reloj.ts";
import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Billetera } from "../../economia/dominio/billetera.ts";
import type { Inventario } from "../../inventario/dominio/inventario.ts";

export interface Adjunto {
  readonly objeto: number;
  readonly cantidad: number;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface Carta {
  readonly id: number;
  readonly remitente: string;
  readonly asunto: string;
  readonly texto: string;
  readonly adjuntos: readonly Adjunto[];
  readonly monedas: Readonly<Record<string, number>>;
  readonly enviada: number;
  readonly vence: number;
  leida: boolean;
  cobrada: boolean;
}

export type ErrorCorreo = "buzon-lleno" | "no-existe" | "ya-cobrada" | "sin-espacio" | "tiene-adjuntos";

export interface NuevaCarta {
  readonly remitente: string;
  readonly asunto: string;
  readonly texto?: string;
  readonly adjuntos?: readonly Adjunto[];
  readonly monedas?: Readonly<Record<string, number>>;
  readonly duracionMs?: number;
}

export class Buzon {
  private readonly cartas = new Map<number, Carta>();
  private readonly reloj: Reloj;
  private readonly maximo: number;
  private proximoId = 1;

  constructor(reloj: Reloj, maximo = 40) {
    this.reloj = reloj;
    this.maximo = maximo;
  }

  enviar(c: NuevaCarta): Resultado<Carta, ErrorCorreo> {
    this.limpiar();
    if (this.cartas.size >= this.maximo) return fallo("buzon-lleno");
    const ahora = this.reloj.ahora();
    const carta: Carta = {
      id: this.proximoId++,
      remitente: c.remitente,
      asunto: c.asunto,
      texto: c.texto ?? "",
      adjuntos: c.adjuntos ?? [],
      monedas: c.monedas ?? {},
      enviada: ahora,
      vence: ahora + (c.duracionMs ?? 30 * DIA),
      leida: false,
      cobrada: false,
    };
    this.cartas.set(carta.id, carta);
    return exito(carta);
  }

  /** Más nuevas primero. */
  listar(): Carta[] {
    return [...this.cartas.values()].sort((a, b) => b.enviada - a.enviada || b.id - a.id);
  }

  noLeidas(): number {
    return this.listar().filter((c) => !c.leida).length;
  }

  leer(id: number): Resultado<Carta, ErrorCorreo> {
    const c = this.cartas.get(id);
    if (c === undefined) return fallo("no-existe");
    c.leida = true;
    return exito(c);
  }

  /** Pasa adjuntos y monedas al jugador. Simula primero en una copia del inventario: todo o nada. */
  cobrar(id: number, inventario: Inventario, billetera: Billetera): Resultado<Carta, ErrorCorreo> {
    const c = this.cartas.get(id);
    if (c === undefined) return fallo("no-existe");
    if (c.cobrada) return fallo("ya-cobrada");
    const prueba = inventario.clonar();
    for (const a of c.adjuntos) {
      if (!prueba.agregar(a.objeto, a.cantidad, a.extra).ok) return fallo("sin-espacio");
    }
    for (const a of c.adjuntos) inventario.agregar(a.objeto, a.cantidad, a.extra);
    for (const [moneda, monto] of Object.entries(c.monedas)) billetera.acreditar(moneda, monto);
    c.cobrada = true;
    c.leida = true;
    return exito(c);
  }

  borrar(id: number, forzar = false): Resultado<void, ErrorCorreo> {
    const c = this.cartas.get(id);
    if (c === undefined) return fallo("no-existe");
    if (!forzar && !c.cobrada && tieneAdjuntos(c)) return fallo("tiene-adjuntos");
    this.cartas.delete(id);
    return exito(undefined);
  }

  /** Quita las vencidas. Devuelve las que tenían adjuntos sin cobrar. */
  limpiar(): Carta[] {
    const ahora = this.reloj.ahora();
    const perdidas: Carta[] = [];
    for (const c of this.cartas.values()) {
      if (c.vence <= ahora) {
        if (!c.cobrada && tieneAdjuntos(c)) perdidas.push(c);
        this.cartas.delete(c.id);
      }
    }
    return perdidas;
  }
}

export function tieneAdjuntos(c: Carta): boolean {
  return c.adjuntos.length > 0 || Object.values(c.monedas).some((m) => m > 0);
}
