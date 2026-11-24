// Juegos de CARRERAS (arcade y simulación ligera) y de vehículos en general:
//   - MOTOR con curva de par (Nm según RPM), caja de cambios (relaciones + diferencial), cambio automático por RPM,
//     limitador y freno motor.
//   - NEUMÁTICOS con agarre que se satura por deslizamiento (curva simplificada tipo "fórmula mágica"): debajo del
//     pico agarra más cuanto más desliza, pasado el pico pierde agarre (derrape).
//   - VEHÍCULO 2D de vista superior (o plano XZ de uno 3D) con modelo de bicicleta: aceleración, frenado, giro
//     dependiente de la velocidad, derrape y freno de mano, arrastre aerodinámico y resistencia de rodadura.
//   - TURBO / NITRO como recurso.
//   - PISTA: puntos de control en orden, vueltas, tiempos por vuelta y sector, mejor vuelta, POSICIONES de carrera
//     (vuelta, control, distancia al siguiente), fantasma (grabar/reproducir) y "rubber banding" para la IA.

import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

export interface DefMotor {
  /** Par en Nm según RPM (tramos). */
  readonly par: Curva;
  readonly rpmRalenti: number;
  readonly rpmMax: number;
  /** Relaciones de cada marcha (1.ª, 2.ª...) y del diferencial. */
  readonly marchas: readonly number[];
  readonly diferencial: number;
  readonly eficiencia: number;
  /** Cambio automático: sube por encima de `subirA` RPM, baja por debajo de `bajarA`. */
  readonly subirA: number;
  readonly bajarA: number;
  /** Fuerza de freno motor (fracción del par a fondo al soltar el acelerador). */
  readonly frenoMotor: number;
}

export interface DefVehiculo {
  readonly masa: number;
  /** Distancia entre ejes (m) y radio de rueda (m). */
  readonly ejes: number;
  readonly radioRueda: number;
  readonly motor: DefMotor;
  /** Fuerza de freno máxima (N). */
  readonly freno: number;
  /** Arrastre aerodinámico (0.5·ρ·Cd·A) y resistencia de rodadura. */
  readonly arrastre: number;
  readonly rodadura: number;
  /** Ángulo máximo de dirección (rad) y reducción a alta velocidad (m/s a la que el giro se reduce a la mitad). */
  readonly direccionMax: number;
  readonly direccionMitadA: number;
  /** Agarre lateral (coeficiente) y deslizamiento pico (rad) para la curva de neumático. */
  readonly agarre: number;
  readonly picoDeslizamiento: number;
  /** Fracción de agarre trasero con freno de mano. */
  readonly frenoMano: number;
  /** Nitro: fuerza extra (N), duración máxima (s) y recarga por segundo. */
  readonly nitro?: { readonly fuerza: number; readonly max: number; readonly recarga: number };
}

/** Fuerza lateral normalizada del neumático según el ángulo de deslizamiento: sube hasta el pico y luego cae a 70 %. */
export function curvaNeumatico(deslizamiento: number, pico: number): number {
  const x = Math.abs(deslizamiento) / Math.max(1e-6, pico);
  const f = x <= 1 ? Math.sin((x * Math.PI) / 2) : Math.max(0.7, 1 - 0.3 * Math.min(1, (x - 1) / 2));
  return Math.sign(deslizamiento) * f;
}

export interface ControlVehiculo {
  readonly acelerador: number;
  readonly freno: number;
  /** −1 izquierda .. 1 derecha. */
  readonly direccion: number;
  readonly frenoMano?: boolean;
  readonly nitro?: boolean;
}

/** Vehículo en el plano (x, y) con rumbo `angulo` (rad). Modelo de bicicleta simplificado, estable a 60 Hz. */
export class Vehiculo {
  x: number;
  y: number;
  angulo: number;
  /** Velocidad en ejes del coche: adelante y lateral (m/s). */
  vx = 0;
  vy = 0;
  giro = 0;
  marcha = 1;
  rpm: number;
  nitro: number;
  derrapando = false;
  readonly def: DefVehiculo;

  constructor(def: DefVehiculo, x = 0, y = 0, angulo = 0) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.angulo = angulo;
    this.rpm = def.motor.rpmRalenti;
    this.nitro = def.nitro?.max ?? 0;
  }

  get velocidad(): number {
    return Math.hypot(this.vx, this.vy);
  }

  get kmh(): number {
    return this.vx * 3.6;
  }

  private relacion(): number {
    const m = this.def.motor;
    return m.marchas[this.marcha - 1] * m.diferencial;
  }

  actualizar(dt: number, c: ControlVehiculo): void {
    const d = this.def, m = d.motor;
    // RPM desde la velocidad de las ruedas
    this.rpm = Math.max(m.rpmRalenti, Math.min(m.rpmMax, (Math.abs(this.vx) / d.radioRueda) * this.relacion() * (60 / (2 * Math.PI))));
    if (this.rpm > m.subirA && this.marcha < m.marchas.length) this.marcha++;
    else if (this.rpm < m.bajarA && this.marcha > 1) this.marcha--;
    const par = evaluar(m.par, this.rpm) * (this.rpm >= m.rpmMax ? 0 : 1);
    let traccion = c.acelerador > 0 ? (par * c.acelerador * this.relacion() * m.eficiencia) / d.radioRueda : -(par * m.frenoMotor * this.relacion()) / d.radioRueda * Math.sign(this.vx) * Math.min(1, Math.abs(this.vx));
    if (c.nitro && d.nitro && this.nitro > 0) {
      traccion += d.nitro.fuerza;
      this.nitro = Math.max(0, this.nitro - dt);
    } else if (d.nitro) this.nitro = Math.min(d.nitro.max, this.nitro + d.nitro.recarga * dt);
    const frenado = c.freno > 0 ? -Math.sign(this.vx) * d.freno * c.freno : 0;
    const resist = -this.vx * Math.abs(this.vx) * d.arrastre - this.vx * d.rodadura;
    let ax = (traccion + resist) / d.masa;
    const frenaA = frenado / d.masa;
    if (Math.abs(this.vx) < Math.abs(frenaA * dt) && c.acelerador <= 0) this.vx = 0;
    else ax += frenaA;

    // Dirección: menos ángulo a más velocidad
    const dir = c.direccion * d.direccionMax / (1 + Math.abs(this.vx) / d.direccionMitadA);
    // Deslizamiento de cada eje y fuerzas laterales
    const v = Math.max(1, Math.abs(this.vx));
    const desDel = Math.atan2(this.vy + this.giro * (d.ejes / 2), v) - dir * Math.sign(this.vx || 1);
    const desTra = Math.atan2(this.vy - this.giro * (d.ejes / 2), v);
    const carga = (d.masa * 9.81) / 2;
    const agTra = d.agarre * (c.frenoMano ? d.frenoMano : 1);
    const fDel = -curvaNeumatico(desDel, d.picoDeslizamiento) * d.agarre * carga;
    const fTra = -curvaNeumatico(desTra, d.picoDeslizamiento) * agTra * carga;
    this.derrapando = Math.abs(desTra) > d.picoDeslizamiento || !!c.frenoMano && Math.abs(this.vy) > 1;
    const ay = (fDel + fTra) / d.masa - this.giro * this.vx;
    const inercia = d.masa * (d.ejes / 2) ** 2;
    const torque = (fDel - fTra) * (d.ejes / 2);
    this.giro += (torque / inercia) * dt;
    this.giro *= Math.max(0, 1 - 2 * dt) ** (this.velocidad < 0.5 ? 10 : 0); // quieto: no gira
    this.vx += ax * dt;
    this.vy += ay * dt;
    if (this.velocidad < 0.05 && c.acelerador <= 0) {
      this.vx = this.vy = this.giro = 0;
    }
    this.angulo += this.giro * dt;
    const co = Math.cos(this.angulo), si = Math.sin(this.angulo);
    this.x += (this.vx * co - this.vy * si) * dt;
    this.y += (this.vx * si + this.vy * co) * dt;
  }
}

// ---------------------------------------------------------------- Pista y carrera

export interface PuntoControl {
  readonly x: number;
  readonly y: number;
  readonly radio: number;
}

export interface EstadoCorredor {
  readonly id: number;
  vuelta: number;
  siguiente: number;
  tiempoVuelta: number;
  mejorVuelta: number;
  vueltas: number[];
  terminado: boolean;
  tiempoTotal: number;
}

export class Carrera {
  readonly controles: readonly PuntoControl[];
  readonly vueltas: number;
  readonly corredores = new Map<number, EstadoCorredor>();
  tiempo = 0;

  constructor(controles: readonly PuntoControl[], vueltas: number, ids: readonly number[]) {
    if (controles.length < 2) throw new Error("La pista necesita al menos 2 puntos de control (el 0 es la meta)");
    this.controles = controles;
    this.vueltas = vueltas;
    for (const id of ids) this.corredores.set(id, { id, vuelta: 0, siguiente: 0, tiempoVuelta: 0, mejorVuelta: Infinity, vueltas: [], terminado: false, tiempoTotal: 0 });
  }

  /** Avanza el reloj y procesa posiciones; devuelve eventos de vuelta/meta. */
  actualizar(dt: number, posiciones: ReadonlyMap<number, { x: number; y: number }>): Array<{ id: number; tipo: "control" | "vuelta" | "meta"; valor: number }> {
    this.tiempo += dt;
    const ev: Array<{ id: number; tipo: "control" | "vuelta" | "meta"; valor: number }> = [];
    for (const e of this.corredores.values()) {
      if (e.terminado) continue;
      e.tiempoVuelta += dt;
      const p = posiciones.get(e.id);
      if (!p) continue;
      const cp = this.controles[e.siguiente];
      if (Math.hypot(p.x - cp.x, p.y - cp.y) > cp.radio) continue;
      // El control 0 es la línea de salida/meta: cruzarlo abre la vuelta 1 y, después, cierra cada vuelta.
      e.siguiente = (e.siguiente + 1) % this.controles.length;
      if (e.siguiente === 0) {
        ev.push({ id: e.id, tipo: "control", valor: this.controles.length - 1 });
      } else if (e.siguiente === 1) {
        if (e.vuelta > 0) {
          e.vueltas.push(e.tiempoVuelta);
          e.mejorVuelta = Math.min(e.mejorVuelta, e.tiempoVuelta);
          ev.push({ id: e.id, tipo: "vuelta", valor: e.tiempoVuelta });
          if (e.vuelta >= this.vueltas) {
            e.terminado = true;
            e.tiempoTotal = this.tiempo;
            ev.push({ id: e.id, tipo: "meta", valor: this.tiempo });
            continue;
          }
        }
        e.vuelta++;
        e.tiempoVuelta = 0;
      } else ev.push({ id: e.id, tipo: "control", valor: e.siguiente - 1 });
    }
    return ev;
  }

  /** Posiciones de carrera: terminados por tiempo, luego por vuelta, control y distancia al siguiente control. */
  clasificacion(posiciones: ReadonlyMap<number, { x: number; y: number }>): number[] {
    const dist = (e: EstadoCorredor): number => {
      const p = posiciones.get(e.id), cp = this.controles[e.siguiente];
      return p ? Math.hypot(p.x - cp.x, p.y - cp.y) : Infinity;
    };
    const ctrl = (e: EstadoCorredor): number => (e.siguiente === 0 ? this.controles.length : e.siguiente);
    return [...this.corredores.values()]
      .sort((a, b) => {
        if (a.terminado !== b.terminado) return a.terminado ? -1 : 1;
        if (a.terminado) return a.tiempoTotal - b.tiempoTotal;
        return b.vuelta - a.vuelta || ctrl(b) - ctrl(a) || dist(a) - dist(b) || a.id - b.id;
      })
      .map((e) => e.id);
  }
}

/** Fantasma: graba muestras (t, x, y, ángulo) y las reproduce interpoladas. */
export class Fantasma {
  readonly muestras: Array<[number, number, number, number]> = [];

  grabar(t: number, x: number, y: number, angulo: number): void {
    this.muestras.push([t, x, y, angulo]);
  }

  en(t: number): { x: number; y: number; angulo: number } | null {
    const m = this.muestras;
    if (m.length === 0) return null;
    if (t <= m[0][0]) return { x: m[0][1], y: m[0][2], angulo: m[0][3] };
    let lo = 0, hi = m.length - 1;
    if (t >= m[hi][0]) return { x: m[hi][1], y: m[hi][2], angulo: m[hi][3] };
    while (hi - lo > 1) {
      const k = (lo + hi) >> 1;
      if (m[k][0] <= t) lo = k;
      else hi = k;
    }
    const a = m[lo], b = m[hi], f = (t - a[0]) / (b[0] - a[0]);
    return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, angulo: a[3] + (b[3] - a[3]) * f };
  }
}

/**
 * Rubber banding para la IA: multiplicador de rendimiento según la distancia (m) al jugador. Por detrás acelera
 * hasta `max`, por delante afloja hasta `min`; `alcance` es la distancia a la que se aplica todo el efecto.
 */
export function rubberBanding(distanciaAlJugador: number, alcance: number, min = 0.92, max = 1.08): number {
  const t = Math.max(-1, Math.min(1, distanciaAlJugador / alcance));
  return t >= 0 ? 1 + (max - 1) * t : 1 + (1 - min) * t;
}
