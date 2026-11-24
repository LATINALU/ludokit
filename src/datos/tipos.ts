// Tipos compartidos por los catálogos de datos.

/** Estado alterado de referencia (el juego lo traduce a `GestorEstados`, `GestorBuffs` o `RendimientosDecrecientes`). */
export interface DefEstadoBasico {
  readonly id: string;
  readonly tipo: "dano-tiempo" | "cura-tiempo" | "control" | "modificador" | "absorber";
  readonly duracion: number;
  /** Fracción de vida por segundo (daño/cura en el tiempo), fracción del atributo (modificador) o de vida (escudo). */
  readonly potencia?: number;
  readonly acumula?: "refresca" | "apila" | "ignora";
  readonly maxPilas?: number;
  /** Tipo de daño (dano-tiempo) o categoría de control (control) o atributo (modificador). */
  readonly danio?: string;
  readonly categoria?: string;
  readonly atributo?: string;
}
