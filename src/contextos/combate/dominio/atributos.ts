// Atributos con modificadores (el sistema de stats de los RPG modernos): cada atributo tiene un valor base y una
// lista de modificadores con fuente, que se aplican en un ORDEN fijo y conocido:
//   final = ((base + Σ plano) × (1 + Σ aumentado%) × Π (1 + más%)) , luego se recorta a [min, max]
//   - "plano":      +10 de ataque (equipo, puntos).
//   - "aumentado":  porcentajes que se SUMAN entre sí (+20 % y +30 % = +50 %). Evita la explosión multiplicativa.
//   - "mas":        multiplicadores independientes (+20 % "más" × +30 % "más" = ×1,56). Reservarlos para lo raro.
//   - "fijar":      reemplaza el resultado (inmune, transformación). Gana el de mayor prioridad.
// Quitar todo lo de una fuente (desequipar, fin de buff) es una sola llamada. Cálculo perezoso con caché.

export type TipoMod = "plano" | "aumentado" | "mas" | "fijar";

export interface Modificador {
  readonly atributo: string;
  readonly tipo: TipoMod;
  readonly valor: number;
  /** Quién lo puso (id del objeto, del buff, del talento): para quitarlo junto. */
  readonly fuente: string;
  readonly prioridad?: number;
}

export interface LimitesAtributo {
  readonly min?: number;
  readonly max?: number;
  /** Redondeo del resultado (enteros para vida/daño). */
  readonly entero?: boolean;
}

export class Atributos {
  private readonly base = new Map<string, number>();
  private readonly mods: Modificador[] = [];
  private readonly limites = new Map<string, LimitesAtributo>();
  private readonly cache = new Map<string, number>();
  /** Atributos derivados: vidaMax = 10 × vigor, etc. Se recalculan con sus dependencias. */
  private readonly derivados = new Map<string, (a: Atributos) => number>();

  constructor(base: Readonly<Record<string, number>> = {}, limites: Readonly<Record<string, LimitesAtributo>> = {}) {
    for (const [k, v] of Object.entries(base)) this.base.set(k, v);
    for (const [k, v] of Object.entries(limites)) this.limites.set(k, v);
  }

  fijarBase(atributo: string, v: number): void {
    this.base.set(atributo, v);
    this.cache.clear();
  }

  baseDe(atributo: string): number {
    return this.base.get(atributo) ?? 0;
  }

  derivar(atributo: string, f: (a: Atributos) => number): void {
    this.derivados.set(atributo, f);
    this.cache.clear();
  }

  agregar(m: Modificador): void {
    this.mods.push(m);
    this.cache.clear();
  }

  agregarVarios(ms: readonly Modificador[]): void {
    for (const m of ms) this.mods.push(m);
    this.cache.clear();
  }

  /** Quita todos los modificadores de una fuente. Devuelve cuántos quitó. */
  quitarFuente(fuente: string): number {
    let n = 0;
    for (let i = this.mods.length - 1; i >= 0; i--) {
      if (this.mods[i].fuente === fuente) {
        this.mods.splice(i, 1);
        n++;
      }
    }
    if (n) this.cache.clear();
    return n;
  }

  valor(atributo: string): number {
    const c = this.cache.get(atributo);
    if (c !== undefined) return c;
    const der = this.derivados.get(atributo);
    let plano = der ? der(this) : this.baseDe(atributo);
    let aum = 0;
    let mas = 1;
    let fijo: Modificador | null = null;
    for (const m of this.mods) {
      if (m.atributo !== atributo) continue;
      if (m.tipo === "plano") plano += m.valor;
      else if (m.tipo === "aumentado") aum += m.valor;
      else if (m.tipo === "mas") mas *= 1 + m.valor;
      else if (!fijo || (m.prioridad ?? 0) > (fijo.prioridad ?? 0)) fijo = m;
    }
    let v = fijo ? fijo.valor : plano * (1 + aum) * mas;
    const l = this.limites.get(atributo);
    if (l) {
      if (l.min !== undefined) v = Math.max(l.min, v);
      if (l.max !== undefined) v = Math.min(l.max, v);
      if (l.entero) v = Math.round(v);
    }
    this.cache.set(atributo, v);
    return v;
  }

  /** Desglose para la interfaz: base, plano, aumentado, más, final. */
  desglose(atributo: string): { base: number; plano: number; aumentado: number; mas: number; final: number; fuentes: string[] } {
    const mods = this.mods.filter((m) => m.atributo === atributo);
    return {
      base: this.baseDe(atributo),
      plano: mods.filter((m) => m.tipo === "plano").reduce((s, m) => s + m.valor, 0),
      aumentado: mods.filter((m) => m.tipo === "aumentado").reduce((s, m) => s + m.valor, 0),
      mas: mods.filter((m) => m.tipo === "mas").reduce((s, m) => s * (1 + m.valor), 1),
      final: this.valor(atributo),
      fuentes: [...new Set(mods.map((m) => m.fuente))],
    };
  }

  /** Atributos conocidos (con base, derivados o modificadores). */
  nombres(): string[] {
    return [...new Set([...this.base.keys(), ...this.derivados.keys(), ...this.mods.map((m) => m.atributo)])];
  }

  instantanea(): Record<string, number> {
    return Object.fromEntries(this.nombres().map((n) => [n, this.valor(n)]));
  }
}

/** Recurso con máximo derivado de un atributo (vida, maná, energía, aguante): actual se conserva en proporción. */
export class Recurso {
  actual: number;
  private maxPrevio: number;
  private readonly maxDe: () => number;
  /** Regeneración por segundo (puede ser negativa) y retardo tras gastar/recibir daño. */
  regen = 0;
  retardoRegen = 0;
  private espera = 0;

  constructor(maxDe: () => number, lleno = true) {
    this.maxDe = maxDe;
    this.maxPrevio = maxDe();
    this.actual = lleno ? this.maxPrevio : 0;
  }

  get max(): number {
    return this.maxDe();
  }
  get fraccion(): number {
    const m = this.max;
    return m > 0 ? this.actual / m : 0;
  }
  get vacio(): boolean {
    return this.actual <= 0;
  }

  /** Si el máximo cambió (subir de nivel, equipo), escala el actual en proporción. */
  sincronizar(): void {
    const m = this.max;
    if (m !== this.maxPrevio && this.maxPrevio > 0) this.actual = Math.min(m, (this.actual * m) / this.maxPrevio);
    this.maxPrevio = m;
    this.actual = Math.min(this.actual, m);
  }

  /** Gasta si alcanza (todo o nada). */
  gastar(n: number): boolean {
    if (n > this.actual) return false;
    this.actual -= n;
    this.espera = this.retardoRegen;
    return true;
  }

  /** Daño o curación (negativo = daño). Devuelve el cambio real. */
  modificar(delta: number): number {
    const antes = this.actual;
    this.actual = Math.max(0, Math.min(this.max, this.actual + delta));
    if (delta < 0) this.espera = this.retardoRegen;
    return this.actual - antes;
  }

  actualizar(dt: number): void {
    this.sincronizar();
    if (this.espera > 0) {
      this.espera -= dt;
      return;
    }
    if (this.regen !== 0) this.modificar(this.regen * dt);
  }
}
