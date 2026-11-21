// Mapa explorado (niebla de guerra) para el minimapa y el mapa completo: salas visitadas, vistas (adyacentes a una
// visitada: se dibujan en gris) y desconocidas; marcadores (jefe visto, cofre, llave) y porcentaje explorado para
// logros y para la pantalla de fin. Serializable para el guardado.

import { vecinos, type MapaMazmorra } from "./mazmorra.ts";

export type EstadoSala = "desconocida" | "vista" | "visitada";

export class MapaExplorado {
  private readonly visitadas = new Set<number>();
  readonly marcadores = new Map<number, Set<string>>();
  private readonly mapa: MapaMazmorra;

  constructor(mapa: MapaMazmorra, guardado?: { visitadas: number[]; marcadores: Record<number, string[]> }) {
    this.mapa = mapa;
    for (const v of guardado?.visitadas ?? []) this.visitadas.add(v);
    for (const [k, v] of Object.entries(guardado?.marcadores ?? {})) this.marcadores.set(Number(k), new Set(v));
  }

  visitar(sala: number): boolean {
    const nueva = !this.visitadas.has(sala);
    this.visitadas.add(sala);
    return nueva;
  }

  marcar(sala: number, marca: string): void {
    let s = this.marcadores.get(sala);
    if (!s) this.marcadores.set(sala, (s = new Set()));
    s.add(marca);
  }

  estado(sala: number): EstadoSala {
    if (this.visitadas.has(sala)) return "visitada";
    for (const v of vecinos(this.mapa, sala)) if (this.visitadas.has(v.sala)) return "vista";
    return "desconocida";
  }

  get porcentaje(): number {
    return this.visitadas.size / this.mapa.salas.length;
  }

  /** Celdas del minimapa: posición en la grilla, estado y marcas (solo lo que se puede mostrar). */
  vista(): Array<{ id: number; x: number; y: number; estado: EstadoSala; marcas: string[] }> {
    return this.mapa.salas
      .map((s) => ({ id: s.id, x: s.x, y: s.y, estado: this.estado(s.id), marcas: [...(this.marcadores.get(s.id) ?? [])] }))
      .filter((s) => s.estado !== "desconocida");
  }

  exportar(): { visitadas: number[]; marcadores: Record<number, string[]> } {
    return { visitadas: [...this.visitadas].sort((a, b) => a - b), marcadores: Object.fromEntries([...this.marcadores].map(([k, v]) => [k, [...v]])) };
  }
}
