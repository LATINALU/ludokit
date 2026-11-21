// Medidor de estilo / combo (D → SSS): premia pegar seguido y VARIADO. Cada acción suma puntos (lo variado vale
// más: repetir la misma acción rinde menos), se corta si dejas de pegar `ventana` segundos y recibir daño cuesta un
// porcentaje (no lo corta: así se llega a los rangos altos). Da bonos (daño, velocidad) y una "energía" 0..1 que
// puede alimentar la música adaptativa.

export interface RangoEstilo {
  readonly nombre: string;
  readonly titulo: string;
  readonly puntos: number;
  readonly color: string;
}

export const RANGOS_ESTILO: readonly RangoEstilo[] = [
  { nombre: "D", titulo: "Despierto", puntos: 0, color: "#8a84a0" },
  { nombre: "C", titulo: "Certero", puntos: 6, color: "#7fe3ff" },
  { nombre: "B", titulo: "Brutal", puntos: 14, color: "#7dff9a" },
  { nombre: "A", titulo: "Atroz", puntos: 26, color: "#ffe27a" },
  { nombre: "S", titulo: "Salvaje", puntos: 42, color: "#ffb23d" },
  { nombre: "SS", titulo: "Sangriento", puntos: 62, color: "#ff6a3d" },
  { nombre: "SSS", titulo: "¡Frenético!", puntos: 88, color: "#ff3d6a" },
];

export const PUNTOS_ESTILO: Readonly<Record<string, number>> = {
  golpe: 1, patada: 1.5, tecnica: 2, cargado: 3, estocada: 2, aereo: 1.5, desvio: 4, esquiva: 4, muerte: 2,
};

export class MedidorEstilo {
  puntos = 0;
  indice = 0;
  private resta = 0;
  private ultimas: string[] = [];
  readonly ventana: number;
  readonly penalizacion: number;
  private readonly rangos: readonly RangoEstilo[];
  private readonly tabla: Readonly<Record<string, number>>;

  constructor(op: { ventana?: number; penalizacion?: number; rangos?: readonly RangoEstilo[]; puntos?: Readonly<Record<string, number>> } = {}) {
    this.ventana = op.ventana ?? 4.5;
    this.penalizacion = op.penalizacion ?? 0.1;
    this.rangos = op.rangos ?? RANGOS_ESTILO;
    this.tabla = op.puntos ?? PUNTOS_ESTILO;
  }

  get rango(): RangoEstilo {
    return this.rangos[this.indice];
  }
  /** 0..1 de la ventana que queda (barrita del HUD). */
  get restante(): number {
    return Math.max(0, this.resta / this.ventana);
  }
  /** 0..1 para música/efectos. */
  get energia(): number {
    return this.indice / (this.rangos.length - 1);
  }
  get multiplicadorDanio(): number {
    return 1 + this.indice * 0.04;
  }
  get bonoVelocidad(): number {
    return this.indice >= 4 ? 0.1 + (this.indice - 4) * 0.05 : 0;
  }

  /** Registra una acción. Devuelve el rango nuevo si subió, o null. */
  registrar(accion: string, mult = 1): RangoEstilo | null {
    const base = this.tabla[accion] ?? 1;
    const repetidas = this.ultimas.filter((a) => a === accion).length;
    const variedad = 1 / (1 + repetidas * 0.5);
    this.ultimas.push(accion);
    if (this.ultimas.length > 5) this.ultimas.shift();
    this.puntos += base * variedad * mult;
    this.resta = this.ventana;
    const antes = this.indice;
    while (this.indice < this.rangos.length - 1 && this.puntos >= this.rangos[this.indice + 1].puntos) this.indice++;
    return this.indice > antes ? this.rango : null;
  }

  recibirGolpe(): void {
    this.puntos *= 1 - this.penalizacion;
    this.recalcular();
  }

  private recalcular(): void {
    while (this.indice > 0 && this.puntos < this.rangos[this.indice].puntos) this.indice--;
  }

  actualizar(dt: number): void {
    if (this.puntos <= 0) return;
    this.resta -= dt;
    if (this.resta <= 0) {
      this.puntos = 0;
      this.indice = 0;
      this.ultimas = [];
    }
  }
}
