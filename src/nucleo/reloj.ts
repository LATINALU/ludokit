// Reloj inyectable: buffs, vencimientos, subastas y cooldowns leen el tiempo de aquí, nunca de Date.now().
// `RelojManual` permite probar "pasaron 48 horas" en un milisegundo.

export interface Reloj {
  /** Milisegundos desde la época Unix. */
  ahora(): number;
}

export class RelojSistema implements Reloj {
  ahora(): number {
    return Date.now();
  }
}

export class RelojManual implements Reloj {
  private ms: number;

  constructor(inicio = 0) {
    this.ms = inicio;
  }

  ahora(): number {
    return this.ms;
  }

  avanzar(ms: number): void {
    this.ms += ms;
  }
}

export const SEGUNDO = 1000;
export const MINUTO = 60 * SEGUNDO;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;
