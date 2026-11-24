// Venta a un comerciante: precio = precio de tienda / divisor (lo fija cada juego), por unidad. Es una FUENTE de
// moneda, así que su divisor fija cuánto vale el botín en la economía.

export interface DatosVenta {
  /** Precio del objeto en la tienda NPC. */
  readonly precio: number;
  readonly vendible: boolean;
  /** Objetos con vencimiento no se venden. */
  readonly temporal?: boolean;
  /** Cuántas unidades forman el "lote" que vale precio/divisor. */
  readonly loteVenta?: number;
  /** Tamaño máximo de pila. */
  readonly maxPila: number;
}


/** Oro que recibe el jugador por vender `cantidad` unidades. 0 = no se puede vender. */
export function precioDeVenta(d: DatosVenta, cantidad: number, divisor: number): number {
  if (!d.vendible || d.temporal === true || cantidad < 1) {
    return 0;
  }
  const base = Math.floor(d.precio / divisor);
  if (base <= 0) {
    return 0;
  }
  const lote = d.loteVenta !== undefined && d.loteVenta > 0 ? d.loteVenta : d.maxPila;
  const total = cantidad * Math.floor(base / Math.max(1, lote));
  return Math.max(1, total);
}
