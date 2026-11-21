// Netcode de servidor autoritativo con predicción del lado del cliente (el modelo de los shooters y MMO modernos):
//
//   CLIENTE                                         SERVIDOR (autoridad)
//   lee entrada (seq n) ──► la aplica YA (predice) ──► cola de entradas por cliente
//   guarda la entrada en un historial                 cada tick: aplica entradas en orden, simula el mundo
//   recibe snapshot {estado, ackSeq} ◄──────────────── envía snapshots a la tasa de red (con área de interés)
//   reconcilia: estado = servidor; re-aplica las entradas con seq > ackSeq (las que el servidor aún no vio)
//   entidades remotas: se dibujan INTERPOLADAS entre dos snapshots, con un retraso fijo (~100 ms)
//
// La SIMULACIÓN es una función pura que comparten cliente y servidor: `aplicar(estado, entrada, dt)`. Con el
// mismo código en los dos lados la predicción casi nunca falla; cuando falla (otro jugador te empujó), la
// reconciliación corrige y el error visual se suaviza.

export interface EntradaRed<E> {
  readonly seq: number;
  readonly dt: number;
  readonly datos: E;
}

export interface Snapshot<S> {
  readonly tick: number;
  readonly tiempo: number;
  /** Última entrada de ESTE cliente que el servidor ya aplicó. */
  readonly ackSeq: number;
  /** Estado propio del jugador (autoritativo). */
  readonly propio: S;
  /** Estado de las entidades visibles (área de interés): id → estado. */
  readonly otros: Readonly<Record<string, S>>;
}

/** Predicción + reconciliación del lado del cliente. */
export class PrediccionCliente<S, E> {
  estado: S;
  private seq = 0;
  private pendientes: EntradaRed<E>[] = [];
  private readonly aplicar: (s: S, e: E, dt: number) => S;
  /** Error de la última reconciliación (para suavizar visualmente o para métricas). */
  ultimoError = 0;
  private readonly distancia?: (a: S, b: S) => number;

  constructor(inicial: S, aplicar: (s: S, e: E, dt: number) => S, distancia?: (a: S, b: S) => number) {
    this.estado = inicial;
    this.aplicar = aplicar;
    this.distancia = distancia;
  }

  /** Aplica la entrada localmente y devuelve el mensaje a enviar al servidor. */
  entrada(datos: E, dt: number): EntradaRed<E> {
    const e: EntradaRed<E> = { seq: ++this.seq, dt, datos };
    this.pendientes.push(e);
    this.estado = this.aplicar(this.estado, datos, dt);
    return e;
  }

  /** Llega un snapshot del servidor: estado autoritativo + re-aplicar lo que el servidor no vio. */
  reconciliar(snap: Snapshot<S>): void {
    const predicho = this.estado;
    this.pendientes = this.pendientes.filter((e) => e.seq > snap.ackSeq);
    let s = snap.propio;
    for (const e of this.pendientes) s = this.aplicar(s, e.datos, e.dt);
    this.estado = s;
    if (this.distancia) this.ultimoError = this.distancia(predicho, s);
  }

  get sinConfirmar(): number {
    return this.pendientes.length;
  }
}

/** Búfer de interpolación de entidades remotas: se dibujan en `ahora − retraso`, entre los dos snapshots que lo rodean. */
export class BuferInterpolacion<S> {
  private readonly muestras: Array<{ t: number; s: S }> = [];
  readonly retraso: number;
  private readonly mezclar: (a: S, b: S, k: number) => S;
  readonly maxMuestras: number;

  constructor(mezclar: (a: S, b: S, k: number) => S, retraso = 0.1, maxMuestras = 32) {
    this.mezclar = mezclar;
    this.retraso = retraso;
    this.maxMuestras = maxMuestras;
  }

  agregar(t: number, s: S): void {
    if (this.muestras.length && t <= this.muestras[this.muestras.length - 1].t) return; // fuera de orden o duplicado
    this.muestras.push({ t, s });
    if (this.muestras.length > this.maxMuestras) this.muestras.shift();
  }

  /** Estado para dibujar en el tiempo `ahora` (del servidor). Extrapola poco si faltan datos (se queda en el último). */
  muestrear(ahora: number): S | null {
    const m = this.muestras;
    if (m.length === 0) return null;
    const t = ahora - this.retraso;
    if (t <= m[0].t) return m[0].s;
    for (let i = m.length - 1; i > 0; i--) {
      if (m[i - 1].t <= t) {
        const a = m[i - 1], b = m[i];
        if (t >= b.t) return b.s;
        return this.mezclar(a.s, b.s, (t - a.t) / (b.t - a.t));
      }
    }
    return m[m.length - 1].s;
  }
}

/** Servidor autoritativo por ticks. El mundo es del juego; el servidor solo ordena entradas y arma snapshots. */
export interface MundoServidor<S, E> {
  /** Aplica una entrada de un jugador (validada). */
  aplicarEntrada(jugador: string, e: E, dt: number): void;
  /** Simula lo que no depende de entradas (IA, proyectiles). */
  simular(dt: number): void;
  estadoDe(id: string): S | undefined;
  /** Ids visibles para un jugador (área de interés). */
  visiblesPara(jugador: string): Iterable<string>;
  /** Anti-trampa: descarta entradas imposibles (dt enorme, velocidad imposible). */
  validar?(jugador: string, e: EntradaRed<E>): boolean;
}

export class ServidorAutoritativo<S, E> {
  private readonly mundo: MundoServidor<S, E>;
  private readonly colas = new Map<string, EntradaRed<E>[]>();
  private readonly ack = new Map<string, number>();
  readonly hz: number;
  tick = 0;
  tiempo = 0;
  /** Máximo de entradas por jugador por tick (evita que un cliente acelerado simule más rápido). */
  maxEntradasPorTick = 4;
  rechazadas = 0;

  constructor(mundo: MundoServidor<S, E>, hz = 30) {
    this.mundo = mundo;
    this.hz = hz;
  }

  conectar(jugador: string): void {
    this.colas.set(jugador, []);
    this.ack.set(jugador, 0);
  }

  desconectar(jugador: string): void {
    this.colas.delete(jugador);
    this.ack.delete(jugador);
  }

  recibir(jugador: string, e: EntradaRed<E>): void {
    const cola = this.colas.get(jugador);
    if (!cola) return;
    if (e.seq <= (this.ack.get(jugador) ?? 0) || cola.some((x) => x.seq === e.seq)) return; // vieja o duplicada
    if (!(e.dt > 0 && e.dt <= 0.25) || (this.mundo.validar && !this.mundo.validar(jugador, e))) {
      this.rechazadas++;
      return;
    }
    cola.push(e);
    cola.sort((a, b) => a.seq - b.seq);
  }

  /** Un tick del servidor. Devuelve los snapshots a enviar (uno por jugador). */
  paso(): Map<string, Snapshot<S>> {
    const dt = 1 / this.hz;
    for (const [j, cola] of this.colas) {
      let n = 0;
      while (cola.length && n < this.maxEntradasPorTick) {
        const e = cola.shift()!;
        this.mundo.aplicarEntrada(j, e.datos, e.dt);
        this.ack.set(j, e.seq);
        n++;
      }
    }
    this.mundo.simular(dt);
    this.tick++;
    this.tiempo += dt;
    const r = new Map<string, Snapshot<S>>();
    for (const j of this.colas.keys()) {
      const propio = this.mundo.estadoDe(j);
      if (propio === undefined) continue;
      const otros: Record<string, S> = {};
      for (const id of this.mundo.visiblesPara(j)) {
        if (id === j) continue;
        const s = this.mundo.estadoDe(id);
        if (s !== undefined) otros[id] = s;
      }
      r.set(j, { tick: this.tick, tiempo: this.tiempo, ackSeq: this.ack.get(j) ?? 0, propio, otros });
    }
    return r;
  }
}
