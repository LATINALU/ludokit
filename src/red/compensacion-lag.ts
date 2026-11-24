// Compensación de lag en 3D (la versión 2D es `HistorialPosiciones` en utilidades-red) para shooters y juegos de acción en red: el cliente dispara viendo
// el mundo "en el pasado" (interpolación + latencia). El servidor guarda un historial corto de las hitboxes de cada
// entidad y, al recibir el disparo, REBOBINA a la hora que veía el tirador, resuelve el impacto ahí y vuelve.
// Tope de rebobinado para que un jugador con 1 s de ping no pueda pegar "detrás de la pared" a quien ya se cubrió.

import { vec3, type V3 } from "../nucleo/vec3.ts";
import { trasladar3D, type Colisionador3D } from "../espacial/colision3d.ts";

interface Muestra {
  readonly t: number;
  readonly pos: V3;
}

export class HistorialPosiciones3D {
  private readonly hist = new Map<number, Muestra[]>();
  /** Segundos de historial que se guardan. */
  readonly ventana: number;

  constructor(ventana = 1) {
    this.ventana = ventana;
  }

  registrar(entidad: number, t: number, pos: V3): void {
    let h = this.hist.get(entidad);
    if (!h) this.hist.set(entidad, (h = []));
    h.push({ t, pos });
    while (h.length > 2 && h[0].t < t - this.ventana) h.shift();
  }

  quitar(entidad: number): void {
    this.hist.delete(entidad);
  }

  /** Posición interpolada de la entidad en el tiempo t (o la más cercana en los extremos). */
  en(entidad: number, t: number): V3 | null {
    const h = this.hist.get(entidad);
    if (!h || h.length === 0) return null;
    if (t <= h[0].t) return h[0].pos;
    for (let i = 1; i < h.length; i++) {
      if (t <= h[i].t) {
        const a = h[i - 1], b = h[i];
        return vec3.lerp(a.pos, b.pos, (t - a.t) / Math.max(1e-9, b.t - a.t));
      }
    }
    return h[h.length - 1].pos;
  }
}

/**
 * Hitboxes rebobinadas: cada colisionador con dueño se traslada según cuánto se movió su dueño entre `ahora` y
 * `tiempoVisto` (recortado a `maxRebobinado`). Los colisionadores sin dueño (el mundo) quedan igual.
 */
export function rebobinar(escena: readonly Colisionador3D[], hist: HistorialPosiciones3D, ahora: number, tiempoVisto: number, maxRebobinado = 0.25): Colisionador3D[] {
  const t = Math.max(ahora - maxRebobinado, Math.min(ahora, tiempoVisto));
  const despl = new Map<number, V3>();
  return escena.map((c) => {
    if (c.duenio === undefined) return c;
    let d = despl.get(c.duenio);
    if (!d) {
      const pa = hist.en(c.duenio, ahora), pt = hist.en(c.duenio, t);
      d = pa && pt ? vec3.restar(pt, pa) : vec3.CERO;
      despl.set(c.duenio, d);
    }
    return d === vec3.CERO ? c : { ...c, forma: trasladar3D(c.forma, d) };
  });
}

/** Tiempo que veía el cliente: hora del servidor − latencia de ida − retraso de interpolación. */
export const tiempoVistoPorCliente = (ahoraServidor: number, rttSegundos: number, retrasoInterpolacion: number): number =>
  ahoraServidor - rttSegundos / 2 - retrasoInterpolacion;
