// Eventos de dominio. Los agregados no llaman a la UI, al audio ni a los VFX: emiten eventos y la capa de juego
// los traduce (sonido por material, hitstop, partículas). El dominio empuja eventos durante un paso de
// simulación y la aplicación los vacía al final del paso.

export interface EventoDominio {
  readonly tipo: string;
}

export class ColaEventos<E extends EventoDominio = EventoDominio> {
  private lista: E[] = [];

  emitir(e: E): void {
    this.lista.push(e);
  }

  /** Devuelve y vacía los eventos pendientes (llamar una vez por paso de simulación). */
  vaciar(): E[] {
    const r = this.lista;
    this.lista = [];
    return r;
  }

  get pendientes(): readonly E[] {
    return this.lista;
  }
}
