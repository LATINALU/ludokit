// Supervivencia (sandbox, extracción, zombis, náufrago, colonia):
//   - NECESIDADES que bajan con el tiempo (hambre, sed, sueño, temperatura, cordura...) con tasas por actividad,
//     umbrales con EFECTOS (penalizaciones, daño por segundo al llegar a 0) y consumibles que las reponen.
//   - TEMPERATURA corporal que tiende a la del ambiente según el abrigo.
//   - DURABILIDAD de herramientas, armas y ropa; reparar baja el máximo.
//   - NODOS DE RECOLECCIÓN (árboles, vetas, plantas) con herramienta mínima, rendimiento y reaparición.
//   - CICLO DÍA/NOCHE con fases, luz ambiente y eventos (anochecer → más peligro).
//   - INFECCIÓN (zombis, plagas): carga que avanza; al llegar a 1 el personaje "se convierte" o muere; tratable.
//   - DESCOMPOSICIÓN de comida con el tiempo (más lenta refrigerada).

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

// ---------------------------------------------------------------- Necesidades

export interface DefNecesidad {
  readonly id: string;
  readonly max: number;
  /** Puntos por segundo que pierde según la actividad ("quieto", "caminando", "corriendo"...); "base" si no hay. */
  readonly tasa: Readonly<Record<string, number>>;
  /** Umbrales [fracción, efecto] de menor a mayor: con valor ≤ fracción·max se activa el efecto. */
  readonly umbrales?: ReadonlyArray<readonly [number, string]>;
  /** Daño por segundo a la vida cuando llega a 0. */
  readonly danioVacio?: number;
}

export class Necesidades {
  readonly defs: ReadonlyMap<string, DefNecesidad>;
  readonly valores = new Map<string, number>();

  constructor(defs: readonly DefNecesidad[]) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
    for (const d of defs) this.valores.set(d.id, d.max);
  }

  valor(id: string): number {
    return this.valores.get(id) ?? 0;
  }

  /** Avanza: devuelve el daño a la vida de este paso (necesidades vacías). `mult`: multiplicador global (clima). */
  actualizar(dt: number, actividad: string, mult: Readonly<Record<string, number>> = {}): number {
    let danio = 0;
    for (const [id, d] of this.defs) {
      const tasa = (d.tasa[actividad] ?? d.tasa.base ?? 0) * (mult[id] ?? 1);
      const v = Math.max(0, this.valor(id) - tasa * dt);
      this.valores.set(id, v);
      if (v <= 0) danio += (d.danioVacio ?? 0) * dt;
    }
    return danio;
  }

  reponer(id: string, cantidad: number): void {
    const d = this.defs.get(id);
    if (d) this.valores.set(id, Math.min(d.max, Math.max(0, this.valor(id) + cantidad)));
  }

  /** Efectos activos (de todos los umbrales cruzados). */
  efectos(): string[] {
    const r: string[] = [];
    for (const [id, d] of this.defs) {
      const f = this.valor(id) / d.max;
      for (const [umbral, efecto] of d.umbrales ?? []) if (f <= umbral) r.push(efecto);
    }
    return r;
  }
}

/** Temperatura corporal hacia la ambiente: `aislamiento` 0..1 frena el cambio. Devuelve la nueva temperatura. */
export function temperaturaCorporal(actual: number, ambiente: number, aislamiento: number, dt: number, velocidad = 0.05, calorPropio = 0): number {
  const k = velocidad * (1 - Math.min(0.95, Math.max(0, aislamiento)));
  return actual + ((ambiente - actual) * k + calorPropio) * dt;
}

// ---------------------------------------------------------------- Durabilidad

export class Durabilidad {
  actual: number;
  max: number;
  readonly maxOriginal: number;

  constructor(max: number) {
    this.actual = this.max = this.maxOriginal = max;
  }

  get roto(): boolean {
    return this.actual <= 0;
  }

  /** Eficacia 0..1 (un arma gastada pega menos, por ejemplo: 0.5 + 0.5·fracción). */
  eficacia(minimo = 0.5): number {
    return this.max <= 0 ? 0 : minimo + (1 - minimo) * (this.actual / this.max);
  }

  usar(desgaste = 1): boolean {
    this.actual = Math.max(0, this.actual - desgaste);
    return !this.roto;
  }

  /** Reparar con `perdidaMax` (fracción del máximo que se pierde en cada reparación). */
  reparar(cantidad: number, perdidaMax = 0.05): void {
    this.max = Math.max(1, this.max - this.maxOriginal * perdidaMax);
    this.actual = Math.min(this.max, this.actual + cantidad);
  }
}

// ---------------------------------------------------------------- Recolección

export interface DefNodo {
  readonly id: string;
  /** Recurso que da, cantidad por golpe [min, max] y golpes totales antes de agotarse. */
  readonly recurso: string;
  readonly porGolpe: readonly [number, number];
  readonly golpes: number;
  /** Grado mínimo de herramienta (0 = a mano). */
  readonly herramienta: number;
  readonly reaparicion: number;
}

export class NodoRecoleccion {
  readonly def: DefNodo;
  restantes: number;
  private espera = 0;

  constructor(def: DefNodo) {
    this.def = def;
    this.restantes = def.golpes;
  }

  get disponible(): boolean {
    return this.restantes > 0;
  }

  /** Golpe con una herramienta de `grado`; `bono` multiplica la cantidad (habilidad, herramienta mejor). */
  golpear(grado: number, azarValor: number, bono = 1): { recurso: string; cantidad: number } | "herramienta" | "agotado" {
    if (!this.disponible) return "agotado";
    if (grado < this.def.herramienta) return "herramienta";
    const [a, b] = this.def.porGolpe;
    const cantidad = Math.max(1, Math.round((a + Math.floor(azarValor * (b - a + 1))) * bono * (1 + 0.25 * (grado - this.def.herramienta))));
    this.restantes--;
    if (this.restantes === 0) this.espera = this.def.reaparicion;
    return { recurso: this.def.recurso, cantidad };
  }

  actualizar(dt: number): boolean {
    if (this.restantes > 0) return false;
    this.espera -= dt;
    if (this.espera <= 0) {
      this.restantes = this.def.golpes;
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- Día y noche

export interface FaseDia {
  readonly nombre: string;
  /** Inicio 0..1 dentro del día. */
  readonly desde: number;
  readonly luz: number;
}

export class CicloDia {
  /** Segundos reales por día de juego. */
  readonly duracion: number;
  readonly fases: readonly FaseDia[];
  tiempo: number;
  dia = 1;

  constructor(duracion: number, fases: readonly FaseDia[], inicio = 0.3) {
    this.duracion = duracion;
    this.fases = [...fases].sort((a, b) => a.desde - b.desde);
    this.tiempo = inicio;
  }

  get fase(): FaseDia {
    let f = this.fases[this.fases.length - 1];
    for (const x of this.fases) if (this.tiempo >= x.desde) f = x;
    return f;
  }

  /** Luz interpolada entre la fase actual y la siguiente. */
  get luz(): number {
    const i = this.fases.indexOf(this.fase);
    const a = this.fases[i], b = this.fases[(i + 1) % this.fases.length];
    const fin = b.desde > a.desde ? b.desde : b.desde + 1;
    const t = (this.tiempo - a.desde + (this.tiempo < a.desde ? 1 : 0)) / (fin - a.desde);
    return a.luz + (b.luz - a.luz) * Math.min(1, Math.max(0, t));
  }

  /** Avanza; devuelve el nombre de la fase nueva si cambió. */
  actualizar(dt: number): string | null {
    const antes = this.fase.nombre;
    this.tiempo += dt / this.duracion;
    while (this.tiempo >= 1) {
      this.tiempo -= 1;
      this.dia++;
    }
    const ahora = this.fase.nombre;
    return ahora !== antes ? ahora : null;
  }
}

// ---------------------------------------------------------------- Infección

export class Infeccion {
  carga = 0;
  /** Avance por segundo una vez infectado (puede depender de la carga con una curva). */
  readonly avance: Curva;
  activa = false;

  constructor(avance: Curva) {
    this.avance = avance;
  }

  /** Exposición (mordida, nube): suma carga y activa. */
  exponer(cantidad: number): void {
    this.carga = Math.min(1, this.carga + cantidad);
    if (this.carga > 0) this.activa = true;
  }

  /** Tratamiento: baja la carga; `cura` la detiene. */
  tratar(cantidad: number, cura = false): void {
    this.carga = Math.max(0, this.carga - cantidad);
    if (cura || this.carga === 0) this.activa = false;
  }

  /** Devuelve true el paso en que llega al máximo (convertido / muerte). */
  actualizar(dt: number): boolean {
    if (!this.activa || this.carga >= 1) return false;
    this.carga = Math.min(1, this.carga + evaluar(this.avance, this.carga * 100 + 1) * dt);
    return this.carga >= 1;
  }
}

// ---------------------------------------------------------------- Descomposición

/** Frescura 0..1 tras `segundos` con vida útil `vida` y multiplicador de conservación (heladera 0.25). */
export const frescura = (segundos: number, vida: number, conservacion = 1): number => Math.max(0, 1 - (segundos * conservacion) / vida);
