// Máquina de estados jerárquica (HSM): estados con entrar/salir/actualizar, transiciones guardadas por condición,
// sub-máquinas dentro de un estado y tiempo en el estado. Sirve para: IA (patrulla → alerta → ataque), personajes
// (quieto/correr/saltar/atacar), flujo del juego (menú → partida → pausa), animación y fases de jefes.

export interface Estado<C> {
  entrar?(ctx: C, desde: string | null): void;
  actualizar?(ctx: C, dt: number, t: number): void;
  salir?(ctx: C, hacia: string): void;
  /** Sub-máquina: se actualiza mientras este estado está activo. */
  hija?: MaquinaEstados<C>;
}

export interface Transicion<C> {
  readonly desde: string | "*";
  readonly hacia: string;
  readonly cuando: (ctx: C, t: number) => boolean;
  /** Mayor prioridad se evalúa primero. */
  readonly prioridad?: number;
}

export class MaquinaEstados<C> {
  private readonly estados = new Map<string, Estado<C>>();
  private readonly transiciones: Transicion<C>[] = [];
  private actual: string | null = null;
  private tEstado = 0;
  readonly historial: string[] = [];

  constructor(estados: Record<string, Estado<C>>, transiciones: Transicion<C>[] = []) {
    for (const [k, v] of Object.entries(estados)) this.estados.set(k, v);
    this.transiciones = [...transiciones].sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0));
  }

  get estado(): string | null {
    return this.actual;
  }
  /** Ruta completa con sub-estados: "combate/atacar/anticipa". */
  get ruta(): string {
    if (this.actual === null) return "";
    const h = this.estados.get(this.actual)?.hija;
    return h && h.estado ? `${this.actual}/${h.ruta}` : this.actual;
  }
  get tiempoEnEstado(): number {
    return this.tEstado;
  }

  iniciar(ctx: C, estado: string): void {
    this.cambiar(ctx, estado);
  }

  cambiar(ctx: C, hacia: string): void {
    const nuevo = this.estados.get(hacia);
    if (!nuevo) throw new Error(`FSM: estado desconocido ${hacia}`);
    const desde = this.actual;
    if (desde !== null) {
      const viejo = this.estados.get(desde)!;
      viejo.hija?.detener(ctx, hacia);
      viejo.salir?.(ctx, hacia);
    }
    this.actual = hacia;
    this.tEstado = 0;
    this.historial.push(hacia);
    if (this.historial.length > 32) this.historial.shift();
    nuevo.entrar?.(ctx, desde);
  }

  detener(ctx: C, hacia: string): void {
    if (this.actual === null) return;
    const e = this.estados.get(this.actual)!;
    e.hija?.detener(ctx, hacia);
    e.salir?.(ctx, hacia);
    this.actual = null;
  }

  actualizar(ctx: C, dt: number): void {
    if (this.actual === null) return;
    for (const tr of this.transiciones) {
      if ((tr.desde === "*" || tr.desde === this.actual) && tr.hacia !== this.actual && tr.cuando(ctx, this.tEstado)) {
        this.cambiar(ctx, tr.hacia);
        break;
      }
    }
    this.tEstado += dt;
    const e = this.estados.get(this.actual!)!;
    e.actualizar?.(ctx, dt, this.tEstado);
    if (e.hija) {
      if (e.hija.estado === null) {
        const primero = e.hija.estados.keys().next().value;
        if (primero !== undefined) e.hija.iniciar(ctx, primero);
      }
      e.hija.actualizar(ctx, dt);
    }
  }
}
