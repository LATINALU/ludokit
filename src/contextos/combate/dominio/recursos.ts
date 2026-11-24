// Modelos de RECURSO de los géneros más comunes. Todos comparten la interfaz `actual / max / gastar / actualizar`
// para que una habilidad pueda costar "maná", "energía", "furia" o "estamina" sin saber cuál es:
//   - REGENERATIVO (maná, energía): regenera por segundo; opcional "regla de N segundos" (no regenera hasta N s
//     después del último gasto) y regeneración distinta en/fuera de combate.
//   - ACUMULATIVO (furia, ira, calor, combo): empieza en 0, se GANA al golpear o recibir daño y DECAE fuera de combate.
//   - ESTAMINA (acción, souls-like, supervivencia): regenera tras un retraso; si se vacía queda AGOTADA hasta
//     recuperar un umbral (no se puede esquivar ni correr).
//   - CARGAS (habilidades con N usos, granadas, curas, dashes): cada carga se recarga por separado.

export interface Recursable {
  readonly actual: number;
  readonly max: number;
  puedePagar(n: number): boolean;
  gastar(n: number): boolean;
  actualizar(dt: number, enCombate: boolean): void;
}

export interface DefRegenerativo {
  readonly max: number;
  readonly regen: number;
  readonly regenCombate?: number;
  /** Segundos sin gastar antes de volver a regenerar. */
  readonly pausaTrasGasto?: number;
}

export class RecursoRegenerativo implements Recursable {
  actual: number;
  max: number;
  readonly def: DefRegenerativo;
  private desdeGasto = Infinity;

  constructor(def: DefRegenerativo, lleno = true) {
    this.def = def;
    this.max = def.max;
    this.actual = lleno ? def.max : 0;
  }

  puedePagar(n: number): boolean {
    return this.actual >= n;
  }

  gastar(n: number): boolean {
    if (!this.puedePagar(n)) return false;
    this.actual -= n;
    this.desdeGasto = 0;
    return true;
  }

  sumar(n: number): void {
    this.actual = Math.min(this.max, Math.max(0, this.actual + n));
  }

  actualizar(dt: number, enCombate: boolean): void {
    this.desdeGasto += dt;
    if (this.desdeGasto < (this.def.pausaTrasGasto ?? 0)) return;
    const r = enCombate ? (this.def.regenCombate ?? this.def.regen) : this.def.regen;
    this.actual = Math.min(this.max, this.actual + r * dt);
  }
}

export interface DefAcumulativo {
  readonly max: number;
  /** Puntos por golpe dado (por punto de daño si `porDanio`) y por golpe recibido. */
  readonly alGolpear: number;
  readonly alRecibir: number;
  readonly porDanio?: boolean;
  /** Pérdida por segundo fuera de combate (y en combate, opcional). */
  readonly decae: number;
  readonly decaeCombate?: number;
}

export class RecursoAcumulativo implements Recursable {
  actual = 0;
  readonly max: number;
  readonly def: DefAcumulativo;

  constructor(def: DefAcumulativo) {
    this.def = def;
    this.max = def.max;
  }

  golpear(danio = 1): void {
    this.actual = Math.min(this.max, this.actual + this.def.alGolpear * (this.def.porDanio ? danio : 1));
  }

  recibir(danio = 1): void {
    this.actual = Math.min(this.max, this.actual + this.def.alRecibir * (this.def.porDanio ? danio : 1));
  }

  puedePagar(n: number): boolean {
    return this.actual >= n;
  }

  gastar(n: number): boolean {
    if (!this.puedePagar(n)) return false;
    this.actual -= n;
    return true;
  }

  actualizar(dt: number, enCombate: boolean): void {
    const d = enCombate ? (this.def.decaeCombate ?? 0) : this.def.decae;
    this.actual = Math.max(0, this.actual - d * dt);
  }
}

export interface DefEstamina {
  readonly max: number;
  readonly regen: number;
  /** Retraso tras gastar antes de regenerar. */
  readonly retraso: number;
  /** Al vaciarse queda agotada hasta llegar a esta fracción del máximo. */
  readonly umbralAgotado: number;
  /** Gasto continuo por segundo (correr, bloquear, nadar) se paga con `drenar`. */
}

export class Estamina implements Recursable {
  actual: number;
  readonly max: number;
  readonly def: DefEstamina;
  agotada = false;
  private espera = 0;

  constructor(def: DefEstamina) {
    this.def = def;
    this.max = def.max;
    this.actual = def.max;
  }

  /** Las acciones se permiten con algo de estamina aunque no alcance (queda en 0), salvo agotada. */
  puedePagar(n: number): boolean {
    return !this.agotada && (this.actual >= n || this.actual > 0);
  }

  gastar(n: number): boolean {
    if (!this.puedePagar(n)) return false;
    this.actual = Math.max(0, this.actual - n);
    this.espera = this.def.retraso;
    if (this.actual <= 0) this.agotada = true;
    return true;
  }

  /** Gasto continuo (correr): devuelve false si ya no alcanza. */
  drenar(porSegundo: number, dt: number): boolean {
    if (this.agotada) return false;
    return this.gastar(porSegundo * dt);
  }

  actualizar(dt: number): void {
    if (this.espera > 0) {
      this.espera -= dt;
      return;
    }
    this.actual = Math.min(this.max, this.actual + this.def.regen * dt);
    if (this.agotada && this.actual >= this.max * this.def.umbralAgotado) this.agotada = false;
  }
}

/** Cargas independientes: cada carga gastada vuelve tras `recarga` segundos (en fila, de a una). */
export class Cargas {
  readonly max: number;
  recarga: number;
  actual: number;
  private progreso = 0;

  constructor(max: number, recarga: number) {
    this.max = max;
    this.recarga = recarga;
    this.actual = max;
  }

  /** Fracción 0..1 de la carga que se está recuperando. */
  get fraccion(): number {
    return this.actual >= this.max ? 1 : this.progreso / this.recarga;
  }

  usar(): boolean {
    if (this.actual <= 0) return false;
    this.actual--;
    return true;
  }

  /** Reducción de recarga (golpes que bajan la recarga, ítems). */
  adelantar(segundos: number): void {
    this.actualizar(segundos);
  }

  actualizar(dt: number): void {
    if (this.actual >= this.max) {
      this.progreso = 0;
      return;
    }
    this.progreso += dt;
    while (this.progreso >= this.recarga && this.actual < this.max) {
      this.progreso -= this.recarga;
      this.actual++;
    }
    if (this.actual >= this.max) this.progreso = 0;
  }
}
