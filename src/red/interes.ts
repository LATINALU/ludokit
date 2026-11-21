// Gestión de interés (AOI, Area Of Interest) para MMO: cada jugador solo recibe las entidades cercanas. Usa el
// hash espacial y devuelve, por jugador, quién ENTRA y quién SALE de su vista (para enviar "aparecer" con el estado
// completo y "desaparecer"), con HISTÉRESIS (radio de salida mayor que el de entrada) para que una entidad en el
// borde no parpadee. Escala a miles de entidades: el costo es por vecindario, no por par.

import { HashEspacial } from "../espacial/hash-espacial.ts";

export interface CambiosInteres {
  readonly entran: string[];
  readonly salen: string[];
  readonly visibles: ReadonlySet<string>;
}

export class GestorInteres {
  private readonly hash: HashEspacial<string>;
  private readonly pos = new Map<string, { x: number; y: number }>();
  private readonly vistas = new Map<string, Set<string>>();
  readonly radioEntrada: number;
  readonly radioSalida: number;

  constructor(radioEntrada = 400, radioSalida = 480, celda = 128) {
    this.hash = new HashEspacial<string>(celda);
    this.radioEntrada = radioEntrada;
    this.radioSalida = radioSalida;
  }

  mover(id: string, x: number, y: number): void {
    this.pos.set(id, { x, y });
    this.hash.mover(id, { x, y, w: 0, h: 0 });
  }

  quitar(id: string): void {
    this.pos.delete(id);
    this.hash.quitar(id);
    this.vistas.delete(id);
    for (const v of this.vistas.values()) v.delete(id);
  }

  /** Recalcula la vista de un observador (llamar por tick o cada pocos ticks). */
  actualizar(observador: string): CambiosInteres {
    const p = this.pos.get(observador);
    const antes = this.vistas.get(observador) ?? new Set<string>();
    if (!p) return { entran: [], salen: [...antes], visibles: new Set() };
    const ahora = new Set<string>();
    for (const id of this.hash.cercanos(p.x, p.y, this.radioSalida)) {
      if (id === observador) continue;
      const q = this.pos.get(id)!;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= this.radioEntrada || (antes.has(id) && d <= this.radioSalida)) ahora.add(id);
    }
    const entran = [...ahora].filter((id) => !antes.has(id));
    const salen = [...antes].filter((id) => !ahora.has(id));
    this.vistas.set(observador, ahora);
    return { entran, salen, visibles: ahora };
  }

  visiblesDe(observador: string): ReadonlySet<string> {
    return this.vistas.get(observador) ?? new Set();
  }
}
