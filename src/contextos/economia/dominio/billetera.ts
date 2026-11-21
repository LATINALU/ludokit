// Billetera multi-moneda y medios de pago. Hay dos clases de moneda:
//   - De número (oro, gemas): viven en la billetera.
//   - De objeto (fichas de evento, medallas): viven en el inventario; crean economías paralelas sin inflar el oro.
// `MedioDePago` unifica ambas para que la tienda no sepa con qué se paga.

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Inventario } from "../../inventario/dominio/inventario.ts";

export type ErrorPago = "monto-invalido" | "sin-fondos";

export class Billetera {
  private readonly saldos = new Map<string, number>();

  constructor(iniciales: Readonly<Record<string, number>> = {}) {
    for (const [moneda, monto] of Object.entries(iniciales)) {
      this.saldos.set(moneda, monto);
    }
  }

  saldo(moneda: string): number {
    return this.saldos.get(moneda) ?? 0;
  }

  acreditar(moneda: string, monto: number): Resultado<number, ErrorPago> {
    if (!Number.isSafeInteger(monto) || monto < 0) {
      return fallo("monto-invalido");
    }
    const nuevo = this.saldo(moneda) + monto;
    this.saldos.set(moneda, nuevo);
    return exito(nuevo);
  }

  debitar(moneda: string, monto: number): Resultado<number, ErrorPago> {
    if (!Number.isSafeInteger(monto) || monto < 0) {
      return fallo("monto-invalido");
    }
    if (this.saldo(moneda) < monto) {
      return fallo("sin-fondos");
    }
    const nuevo = this.saldo(moneda) - monto;
    this.saldos.set(moneda, nuevo);
    return exito(nuevo);
  }
}

export interface MedioDePago {
  readonly nombre: string;
  saldo(): number;
  cobrar(monto: number): Resultado<number, ErrorPago>;
  pagar(monto: number): Resultado<number, ErrorPago>;
}

export function pagoConBilletera(billetera: Billetera, moneda: string): MedioDePago {
  return {
    nombre: moneda,
    saldo: () => billetera.saldo(moneda),
    cobrar: (monto) => billetera.debitar(moneda, monto),
    pagar: (monto) => billetera.acreditar(moneda, monto),
  };
}

/** Un objeto del inventario usado como moneda (fichas, medallas, tickets). */
export function pagoConObjeto(inventario: Inventario, objeto: number): MedioDePago {
  return {
    nombre: `objeto:${objeto}`,
    saldo: () => inventario.contar(objeto),
    cobrar: (monto) => {
      if (!Number.isSafeInteger(monto) || monto < 0) {
        return fallo("monto-invalido");
      }
      if (monto === 0) {
        return exito(inventario.contar(objeto));
      }
      const r = inventario.quitar(objeto, monto);
      return r.ok ? exito(inventario.contar(objeto)) : fallo("sin-fondos");
    },
    pagar: (monto) => {
      if (!Number.isSafeInteger(monto) || monto < 0) {
        return fallo("monto-invalido");
      }
      if (monto === 0) {
        return exito(inventario.contar(objeto));
      }
      const r = inventario.agregar(objeto, monto);
      return r.ok ? exito(inventario.contar(objeto)) : fallo("monto-invalido");
    },
  };
}
