// Tabla de amenaza (aggro), el corazón del PvE en grupo: cada enemigo recuerda cuánta amenaza le generó cada
// jugador (daño × multiplicador, curación / 2, provocaciones). Ataca al de mayor amenaza, pero solo cambia de
// objetivo si alguien supera al actual por un margen (110 % cuerpo a cuerpo, 130 % a distancia): así el tanque
// mantiene al enemigo y los demás no lo "roban" por un golpe de suerte. La amenaza decae fuera de combate.

export interface OpcionesAmenaza {
  readonly margenMelee?: number;
  readonly margenDistancia?: number;
  /** Fracción por segundo que se pierde cuando nadie genera amenaza. */
  readonly decaimiento?: number;
}

export class TablaAmenaza<J = string> {
  private readonly valores = new Map<J, number>();
  objetivo: J | null = null;
  private readonly o: Required<OpcionesAmenaza>;
  private provocadoPor: { quien: J; resta: number } | null = null;

  constructor(o: OpcionesAmenaza = {}) {
    this.o = { margenMelee: 1.1, margenDistancia: 1.3, decaimiento: 0, ...o };
  }

  sumar(quien: J, cantidad: number): void {
    this.valores.set(quien, Math.max(0, (this.valores.get(quien) ?? 0) + cantidad));
  }

  /** Provocar: pasa al primer puesto con la amenaza del líder y queda fijo `seg` segundos. */
  provocar(quien: J, seg = 3): void {
    const max = Math.max(0, ...this.valores.values());
    this.valores.set(quien, Math.max(this.valores.get(quien) ?? 0, max));
    this.objetivo = quien;
    this.provocadoPor = { quien, resta: seg };
  }

  quitar(quien: J): void {
    this.valores.delete(quien);
    if (this.objetivo === quien) this.objetivo = null;
  }

  /** Reduce un porcentaje (habilidades de "fingir muerte", "desvanecer"). */
  reducir(quien: J, fraccion: number): void {
    const v = this.valores.get(quien);
    if (v !== undefined) this.valores.set(quien, v * (1 - fraccion));
  }

  amenazaDe(quien: J): number {
    return this.valores.get(quien) ?? 0;
  }

  orden(): Array<[J, number]> {
    return [...this.valores].sort((a, b) => b[1] - a[1]);
  }

  /** Elige el objetivo. `esMelee(j)`: si está a rango cuerpo a cuerpo (margen menor). */
  actualizar(dt: number, esMelee: (j: J) => boolean = () => true, generoAmenaza = true): J | null {
    if (this.provocadoPor) {
      this.provocadoPor.resta -= dt;
      if (this.provocadoPor.resta > 0 && this.valores.has(this.provocadoPor.quien)) return (this.objetivo = this.provocadoPor.quien);
      this.provocadoPor = null;
    }
    if (!generoAmenaza && this.o.decaimiento > 0) {
      for (const [k, v] of this.valores) this.valores.set(k, v * Math.max(0, 1 - this.o.decaimiento * dt));
    }
    const orden = this.orden();
    if (orden.length === 0) return (this.objetivo = null);
    if (this.objetivo === null || !this.valores.has(this.objetivo)) return (this.objetivo = orden[0][0]);
    const actual = this.amenazaDe(this.objetivo);
    for (const [j, v] of orden) {
      if (j === this.objetivo) break;
      const margen = esMelee(j) ? this.o.margenMelee : this.o.margenDistancia;
      if (v > actual * margen) return (this.objetivo = j);
    }
    return this.objetivo;
  }
}
