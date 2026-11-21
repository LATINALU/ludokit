// Caso de uso: comprar en una tienda, con persistencia transaccional y libro contable (ledger). Es el patrón para
// TODA operación que mueve valor en un juego en línea:
//   1. cargar el agregado (jugador) dentro de una transacción
//   2. ejecutar la regla de dominio (pura) — valida, entrega y cobra todo o nada
//   3. si salió bien: guardar el agregado + registrar el movimiento en el libro, en la MISMA transacción
//   4. devolver el resultado (la respuesta al cliente lleva el estado nuevo completo, no deltas)
// Los puertos (`UnidadDeTrabajo`, `RepositorioJugadores`, `LibroContable`) los implementa la infraestructura:
// memoria para tests y un jugador local, SQL/documentos en el servidor.

import type { Resultado } from "../../../nucleo/resultado.ts";
import type { Reloj } from "../../../nucleo/reloj.ts";
import type { Inventario } from "../../inventario/dominio/inventario.ts";
import { pagoConBilletera, type Billetera } from "../dominio/billetera.ts";
import { comprar, type Catalogo, type Compra, type ErrorCompra } from "../dominio/tienda.ts";

export interface Jugador {
  readonly id: string;
  readonly nivel: number;
  readonly inventario: Inventario;
  readonly billetera: Billetera;
}

export interface Movimiento {
  readonly jugador: string;
  readonly moneda: string;
  readonly delta: number;
  readonly motivo: string;
  readonly referencia: string;
  readonly cuando: number;
}

export interface RepositorioJugadores {
  cargar(id: string): Promise<Jugador | null>;
  guardar(j: Jugador): Promise<void>;
}

export interface LibroContable {
  registrar(m: Movimiento): Promise<void>;
}

export interface UnidadDeTrabajo {
  /** Ejecuta `f` en una transacción: si lanza, nada se guarda. */
  transaccion<T>(f: (repos: { jugadores: RepositorioJugadores; libro: LibroContable }) => Promise<T>): Promise<T>;
}

export interface DependenciasCompra {
  readonly uow: UnidadDeTrabajo;
  readonly catalogo: Catalogo;
  readonly reloj: Reloj;
  readonly nivelRequerido?: (objeto: number) => number;
}

export type ErrorCasoCompra = ErrorCompra | "jugador-inexistente";

export async function casoComprar(dep: DependenciasCompra, jugadorId: string, tienda: string, objeto: number, moneda = "oro"): Promise<Resultado<Compra, ErrorCasoCompra>> {
  return dep.uow.transaccion(async ({ jugadores, libro }) => {
    const j = await jugadores.cargar(jugadorId);
    if (!j) return { ok: false, error: "jugador-inexistente" } as const;
    const r = comprar({
      catalogo: dep.catalogo,
      tienda,
      objeto,
      inventario: j.inventario,
      pago: pagoConBilletera(j.billetera, moneda),
      nivelJugador: j.nivel,
      nivelRequerido: dep.nivelRequerido,
    });
    if (r.ok) {
      await jugadores.guardar(j);
      await libro.registrar({ jugador: j.id, moneda, delta: -r.valor.articulo.precio, motivo: `tienda:${tienda}`, referencia: String(objeto), cuando: dep.reloj.ahora() });
    }
    return r;
  });
}

/** Implementación en memoria (un jugador local o tests): la "transacción" copia y restaura si algo falla. */
export class MemoriaEconomia implements UnidadDeTrabajo {
  readonly jugadores = new Map<string, Jugador>();
  readonly movimientos: Movimiento[] = [];

  async transaccion<T>(f: (repos: { jugadores: RepositorioJugadores; libro: LibroContable }) => Promise<T>): Promise<T> {
    const pendientes: Movimiento[] = [];
    const guardados = new Map<string, Jugador>();
    const r = await f({
      jugadores: { cargar: async (id) => this.jugadores.get(id) ?? null, guardar: async (j) => void guardados.set(j.id, j) },
      libro: { registrar: async (m) => void pendientes.push(m) },
    });
    for (const [k, v] of guardados) this.jugadores.set(k, v);
    this.movimientos.push(...pendientes);
    return r;
  }
}
