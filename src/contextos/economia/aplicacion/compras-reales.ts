// Compras con dinero real (IAP) y anuncios con recompensa, como CASOS DE USO con PUERTOS (la tienda de aplicaciones,
// el SDK de anuncios y el almacenamiento son adaptadores que implementa el juego). Reglas:
//   - El cliente NUNCA acredita: manda el recibo; el SERVIDOR lo verifica con la tienda (puerto) y acredita.
//   - IDEMPOTENCIA: el mismo recibo/transacción se acredita una sola vez aunque llegue diez veces (reintentos de red).
//   - Todo o nada + libro contable: se registra el movimiento con el id de la transacción.
//   - Anuncios con recompensa: tope por día y espera entre anuncios; la recompensa solo con la confirmación del SDK
//     (callback de servidor a servidor cuando existe).
//   - Separar comodidad/cosmético de poder (ver docs/IA.md, monetización responsable).

import { exito, fallo, type Resultado } from "../../../nucleo/resultado.ts";
import type { Reloj } from "../../../nucleo/reloj.ts";

export interface ProductoReal {
  readonly sku: string;
  /** Qué entrega: monedas, objetos, suscripción (días). */
  readonly entrega: ReadonlyArray<{ readonly tipo: "moneda"; readonly moneda: string; readonly cantidad: number } | { readonly tipo: "objeto"; readonly objeto: number; readonly cantidad: number } | { readonly tipo: "suscripcion"; readonly dias: number }>;
  /** Consumible (se puede comprar muchas veces) o permanente (una vez por cuenta). */
  readonly consumible: boolean;
}

export interface ReciboVerificado {
  readonly transaccion: string;
  readonly sku: string;
  readonly cuenta: string;
  readonly valido: boolean;
  /** Reembolsado o revocado por la tienda. */
  readonly revocado?: boolean;
}

/** Puerto hacia la tienda (Google Play, App Store, Steam, web): verifica un recibo en el SERVIDOR. */
export interface PuertoTienda {
  verificar(recibo: string): Promise<ReciboVerificado>;
}

/** Puerto de persistencia: transacciones ya acreditadas y permanentes de cada cuenta. */
export interface RepositorioCompras {
  yaAcreditada(transaccion: string): Promise<boolean>;
  tienePermanente(cuenta: string, sku: string): Promise<boolean>;
  /** Registra y entrega en UNA transacción (todo o nada). */
  acreditar(cuenta: string, transaccion: string, producto: ProductoReal): Promise<void>;
}

export type ErrorCompraReal = "recibo-invalido" | "revocado" | "producto-desconocido" | "cuenta-distinta" | "permanente-ya-comprado";

/**
 * Caso de uso: canjear un recibo. Devuelve `{ acreditado: false }` (éxito sin acreditar de nuevo) si la transacción ya
 * se había procesado: así los reintentos del cliente son seguros.
 */
export async function canjearRecibo(
  dep: { tienda: PuertoTienda; repo: RepositorioCompras; catalogo: ReadonlyMap<string, ProductoReal> },
  cuenta: string,
  recibo: string,
): Promise<Resultado<{ acreditado: boolean; transaccion: string; producto: ProductoReal }, ErrorCompraReal>> {
  const v = await dep.tienda.verificar(recibo);
  if (!v.valido) return fallo("recibo-invalido");
  if (v.revocado) return fallo("revocado");
  if (v.cuenta !== cuenta) return fallo("cuenta-distinta");
  const producto = dep.catalogo.get(v.sku);
  if (!producto) return fallo("producto-desconocido");
  if (await dep.repo.yaAcreditada(v.transaccion)) return exito({ acreditado: false, transaccion: v.transaccion, producto });
  if (!producto.consumible && (await dep.repo.tienePermanente(cuenta, v.sku))) return fallo("permanente-ya-comprado");
  await dep.repo.acreditar(cuenta, v.transaccion, producto);
  return exito({ acreditado: true, transaccion: v.transaccion, producto });
}

/** Repositorio en memoria (pruebas, prototipos). En producción: base de datos con índice único por transacción. */
export class ComprasEnMemoria implements RepositorioCompras {
  readonly acreditadas = new Map<string, { cuenta: string; sku: string }>();
  readonly entregas: Array<{ cuenta: string; producto: ProductoReal }> = [];

  async yaAcreditada(t: string): Promise<boolean> {
    return this.acreditadas.has(t);
  }

  async tienePermanente(cuenta: string, sku: string): Promise<boolean> {
    for (const v of this.acreditadas.values()) if (v.cuenta === cuenta && v.sku === sku) return true;
    return false;
  }

  async acreditar(cuenta: string, transaccion: string, producto: ProductoReal): Promise<void> {
    if (this.acreditadas.has(transaccion)) return;
    this.acreditadas.set(transaccion, { cuenta, sku: producto.sku });
    this.entregas.push({ cuenta, producto });
  }
}

// ---------------------------------------------------------------- Anuncios con recompensa

export interface ReglasAnuncios {
  readonly maxPorDia: number;
  /** Segundos mínimos entre anuncios. */
  readonly espera: number;
  /** Duración del "día" en ms y desplazamiento del reinicio (p. ej. medianoche del servidor). */
  readonly dia: number;
  readonly origen: number;
}

export type ErrorAnuncio = "tope-diario" | "esperar" | "sin-confirmacion";

/** Control de anuncios con recompensa por cuenta (servidor). */
export class AnunciosConRecompensa {
  readonly reglas: ReglasAnuncios;
  private readonly reloj: Reloj;
  private readonly estado = new Map<string, { dia: number; vistos: number; ultimo: number }>();
  private readonly confirmados = new Set<string>();

  constructor(reglas: ReglasAnuncios, reloj: Reloj) {
    this.reglas = reglas;
    this.reloj = reloj;
  }

  private diaDe(t: number): number {
    return Math.floor((t - this.reglas.origen) / this.reglas.dia);
  }

  /** ¿Puede ver otro anuncio ahora? (para mostrar u ocultar el botón). */
  disponible(cuenta: string): Resultado<{ restantes: number }, ErrorAnuncio> {
    const ahora = this.reloj.ahora();
    const e = this.estado.get(cuenta);
    const vistos = e && e.dia === this.diaDe(ahora) ? e.vistos : 0;
    if (vistos >= this.reglas.maxPorDia) return fallo("tope-diario");
    if (e && ahora - e.ultimo < this.reglas.espera * 1000) return fallo("esperar");
    return exito({ restantes: this.reglas.maxPorDia - vistos });
  }

  /**
   * Registrar un anuncio visto: solo con la confirmación del SDK (`idConfirmacion`, idempotente). Devuelve si se debe
   * entregar la recompensa.
   */
  completar(cuenta: string, idConfirmacion: string | null): Resultado<{ recompensar: boolean }, ErrorAnuncio> {
    if (!idConfirmacion) return fallo("sin-confirmacion");
    if (this.confirmados.has(idConfirmacion)) return exito({ recompensar: false });
    const d = this.disponible(cuenta);
    if (!d.ok) return d;
    const ahora = this.reloj.ahora();
    const e = this.estado.get(cuenta);
    const dia = this.diaDe(ahora);
    this.estado.set(cuenta, { dia, vistos: (e && e.dia === dia ? e.vistos : 0) + 1, ultimo: ahora });
    this.confirmados.add(idConfirmacion);
    return exito({ recompensar: true });
  }
}
