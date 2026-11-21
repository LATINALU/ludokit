// Efectos de estado con ticks: veneno, quemadura y sangrado (daño por tick), regeneración, aturdido, lento,
// silenciado, congelado. Reglas de apilado por efecto: "renovar" (reinicia duración), "apilar" (hasta N pilas,
// cada pila suma), "independiente" (cada aplicación corre su propio reloj), "mas-fuerte" (se queda el mayor).
// Inmunidades por etiqueta y resistencia a control (reduce la duración de aturdidos encadenados).

export type ReglaApilado = "renovar" | "apilar" | "independiente" | "mas-fuerte";

export interface DefEstado {
  readonly id: string;
  readonly duracion: number;
  readonly apilado: ReglaApilado;
  readonly maxPilas?: number;
  /** Cada cuánto aplica su tick (daño o curación). */
  readonly cadaTick?: number;
  /** Valor por tick por pila (positivo = daño, negativo = curación). */
  readonly porTick?: number;
  /** Etiquetas que pone mientras dura ("aturdido", "lento", "silenciado"). */
  readonly etiquetas?: readonly string[];
  /** Modificadores mientras dura: { velocidad: -0.3 }. */
  readonly mods?: Readonly<Record<string, number>>;
  /** Es control (aturdir, congelar): sufre rendimiento decreciente. */
  readonly control?: boolean;
}

interface Instancia {
  readonly def: DefEstado;
  resta: number;
  pilas: number;
  potencia: number;
  acumTick: number;
  readonly fuente: string;
}

export interface TickEstado {
  readonly id: string;
  readonly valor: number;
  readonly fuente: string;
}

export class GestorEstados {
  private lista: Instancia[] = [];
  readonly inmunidades = new Set<string>();
  /** Rendimiento decreciente de control: cada control reciente dura la mitad (se olvida tras `memoriaControl` s). */
  memoriaControl = 15;
  private controlReciente = 0;
  private tControl = 0;

  aplicar(def: DefEstado, fuente = "", potencia = 1): boolean {
    if (this.inmunidades.has(def.id) || (def.etiquetas ?? []).some((e) => this.inmunidades.has(e))) return false;
    let dur = def.duracion;
    if (def.control) {
      dur *= Math.pow(0.5, this.controlReciente);
      if (dur < 0.1) return false;
      this.controlReciente++;
      this.tControl = this.memoriaControl;
    }
    const existente = this.lista.find((i) => i.def.id === def.id && (def.apilado !== "independiente"));
    if (existente) {
      switch (def.apilado) {
        case "renovar":
          existente.resta = Math.max(existente.resta, dur);
          return true;
        case "apilar":
          existente.pilas = Math.min(def.maxPilas ?? 99, existente.pilas + 1);
          existente.resta = dur;
          return true;
        case "mas-fuerte":
          if (potencia >= existente.potencia) {
            existente.potencia = potencia;
            existente.resta = dur;
          }
          return true;
      }
    }
    this.lista.push({ def, resta: dur, pilas: 1, potencia, acumTick: 0, fuente });
    return true;
  }

  quitar(id: string): void {
    this.lista = this.lista.filter((i) => i.def.id !== id);
  }

  /** Limpia por etiqueta (purificar quita "veneno", liberarse quita "aturdido"). */
  limpiarEtiqueta(etiqueta: string): void {
    this.lista = this.lista.filter((i) => !(i.def.etiquetas ?? []).includes(etiqueta) && i.def.id !== etiqueta);
  }

  tiene(idOEtiqueta: string): boolean {
    return this.lista.some((i) => i.def.id === idOEtiqueta || (i.def.etiquetas ?? []).includes(idOEtiqueta));
  }

  get etiquetas(): Set<string> {
    const s = new Set<string>();
    for (const i of this.lista) for (const e of i.def.etiquetas ?? []) s.add(e);
    return s;
  }

  /** Suma de modificadores activos (pilas × potencia). */
  modificadores(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const i of this.lista) for (const [k, v] of Object.entries(i.def.mods ?? {})) r[k] = (r[k] ?? 0) + v * i.pilas * i.potencia;
    return r;
  }

  pilasDe(id: string): number {
    return this.lista.filter((i) => i.def.id === id).reduce((s, i) => s + i.pilas, 0);
  }

  /** Avanza y devuelve los ticks de daño/curación de este paso. */
  actualizar(dt: number): TickEstado[] {
    const ticks: TickEstado[] = [];
    if (this.tControl > 0) {
      this.tControl -= dt;
      if (this.tControl <= 0) this.controlReciente = 0;
    }
    for (const i of this.lista) {
      const avance = Math.min(dt, Math.max(0, i.resta));
      i.resta -= dt;
      if (i.def.cadaTick && i.def.porTick) {
        i.acumTick += avance;
        while (i.acumTick >= i.def.cadaTick - 1e-9) {
          i.acumTick -= i.def.cadaTick;
          ticks.push({ id: i.def.id, valor: i.def.porTick * i.pilas * i.potencia, fuente: i.fuente });
        }
      }
    }
    this.lista = this.lista.filter((i) => i.resta > 1e-9);
    return ticks;
  }
}
