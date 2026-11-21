// Piezas de soporte del netcode: sincronización de reloj cliente-servidor (estilo NTP), compensación de lag para
// validar impactos en el pasado (lo que el tirador VIO), y limitador de tasa por cubeta de fichas (anti-spam,
// anti-flood de paquetes, límites de chat y de acciones económicas).

/** Estima el desfase de reloj con el servidor a partir de pings: offset = ((t1 − t0) + (t2 − t3)) / 2. */
export class RelojSincronizado {
  private muestras: Array<{ offset: number; rtt: number }> = [];
  readonly max: number;

  constructor(max = 16) {
    this.max = max;
  }

  /** t0: envío cliente · t1: recepción servidor · t2: envío servidor · t3: recepción cliente. */
  muestra(t0: number, t1: number, t2: number, t3: number): void {
    const rtt = t3 - t0 - (t2 - t1);
    const offset = (t1 - t0 + (t2 - t3)) / 2;
    this.muestras.push({ offset, rtt });
    if (this.muestras.length > this.max) this.muestras.shift();
  }

  /** Offset con las muestras de menor RTT (las más confiables). */
  get offset(): number {
    if (this.muestras.length === 0) return 0;
    const mejores = [...this.muestras].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, Math.ceil(this.muestras.length / 2)));
    const o = mejores.map((m) => m.offset).sort((a, b) => a - b);
    return o[Math.floor(o.length / 2)];
  }

  get rtt(): number {
    if (this.muestras.length === 0) return 0;
    const r = this.muestras.map((m) => m.rtt).sort((a, b) => a - b);
    return r[Math.floor(r.length / 2)];
  }

  horaServidor(horaLocal: number): number {
    return horaLocal + this.offset;
  }
}

/** Compensación de lag: guarda posiciones pasadas para "rebobinar" al instante en que el cliente disparó. */
export class HistorialPosiciones {
  private readonly datos = new Map<string, Array<{ t: number; x: number; y: number }>>();
  readonly ventana: number;

  constructor(ventana = 1) {
    this.ventana = ventana;
  }

  registrar(id: string, t: number, x: number, y: number): void {
    let l = this.datos.get(id);
    if (!l) this.datos.set(id, (l = []));
    l.push({ t, x, y });
    while (l.length && l[0].t < t - this.ventana) l.shift();
  }

  /** Posición interpolada de `id` en el tiempo `t` (null si está fuera de la ventana). */
  en(id: string, t: number): { x: number; y: number } | null {
    const l = this.datos.get(id);
    if (!l || l.length === 0 || t < l[0].t) return null;
    for (let i = l.length - 1; i >= 0; i--) {
      if (l[i].t <= t) {
        const a = l[i], b = l[i + 1];
        if (!b) return { x: a.x, y: a.y };
        const k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return null;
  }
}

/** Cubeta de fichas: `capacidad` acciones de golpe, recarga `porSegundo`. */
export class LimitadorTasa {
  private fichas: number;
  private ultimo: number;
  readonly capacidad: number;
  readonly porSegundo: number;

  constructor(capacidad: number, porSegundo: number, ahora = 0) {
    this.capacidad = capacidad;
    this.porSegundo = porSegundo;
    this.fichas = capacidad;
    this.ultimo = ahora;
  }

  permitir(ahora: number, costo = 1): boolean {
    this.fichas = Math.min(this.capacidad, this.fichas + (ahora - this.ultimo) * this.porSegundo);
    this.ultimo = ahora;
    if (this.fichas < costo) return false;
    this.fichas -= costo;
    return true;
  }
}
