// Tiempo de juego: temporizadores, cooldowns, tweens con easing y secuencias. Todo avanza con `actualizar(dt)`
// desde el paso fijo (nada de setTimeout: así funciona en pausa, cámara lenta, servidor y repeticiones).

export type Easing = (t: number) => number;

/** Curvas de easing estándar (Penner). t en [0,1]. */
export const EASE = {
  lineal: (t) => t,
  entradaCuad: (t) => t * t,
  salidaCuad: (t) => t * (2 - t),
  entradaSalidaCuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  entradaCubica: (t) => t * t * t,
  salidaCubica: (t) => 1 - Math.pow(1 - t, 3),
  entradaSalidaCubica: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  salidaExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  salidaAtras: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  salidaElastica: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1),
  salidaRebote: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
} satisfies Record<string, Easing>;

/** Cooldown simple: listo cuando llega a 0. */
export class Cooldown {
  restante = 0;
  readonly duracion: number;
  constructor(duracion: number) {
    this.duracion = duracion;
  }
  get listo(): boolean {
    return this.restante <= 0;
  }
  /** 0..1 de recarga (para la UI). */
  get progreso(): number {
    return this.duracion <= 0 ? 1 : 1 - Math.max(0, this.restante) / this.duracion;
  }
  usar(): boolean {
    if (!this.listo) return false;
    this.restante = this.duracion;
    return true;
  }
  actualizar(dt: number): void {
    this.restante = Math.max(0, this.restante - dt);
  }
}

interface Tarea {
  t: number;
  readonly cada: number;
  repetir: number;
  readonly f: () => void;
  vivo: boolean;
}

interface Tween {
  t: number;
  readonly dur: number;
  readonly desde: number;
  readonly hasta: number;
  readonly ease: Easing;
  readonly aplicar: (v: number) => void;
  readonly fin?: () => void;
  vivo: boolean;
}

/** Programador de tareas y tweens. */
export class Agenda {
  private tareas: Tarea[] = [];
  private tweens: Tween[] = [];

  /** Ejecuta `f` dentro de `seg` segundos. Devuelve una función para cancelar. */
  en(seg: number, f: () => void): () => void {
    const t: Tarea = { t: seg, cada: seg, repetir: 1, f, vivo: true };
    this.tareas.push(t);
    return () => (t.vivo = false);
  }

  /** Repite `f` cada `seg` segundos (`veces` = Infinity para siempre). */
  cada(seg: number, f: () => void, veces = Infinity): () => void {
    const t: Tarea = { t: seg, cada: seg, repetir: veces, f, vivo: true };
    this.tareas.push(t);
    return () => (t.vivo = false);
  }

  tween(desde: number, hasta: number, dur: number, aplicar: (v: number) => void, ease: Easing = EASE.salidaCuad, fin?: () => void): () => void {
    const tw: Tween = { t: 0, dur: Math.max(1e-6, dur), desde, hasta, ease, aplicar, fin, vivo: true };
    this.tweens.push(tw);
    aplicar(desde);
    return () => (tw.vivo = false);
  }

  actualizar(dt: number): void {
    for (const t of this.tareas) {
      if (!t.vivo) continue;
      t.t -= dt;
      while (t.vivo && t.t <= 0) {
        t.f();
        t.repetir--;
        if (t.repetir <= 0) t.vivo = false;
        else t.t += t.cada;
      }
    }
    this.tareas = this.tareas.filter((t) => t.vivo);
    for (const tw of this.tweens) {
      if (!tw.vivo) continue;
      tw.t = Math.min(tw.dur, tw.t + dt);
      const k = tw.ease(tw.t / tw.dur);
      tw.aplicar(tw.desde + (tw.hasta - tw.desde) * k);
      if (tw.t >= tw.dur) {
        tw.vivo = false;
        tw.fin?.();
      }
    }
    this.tweens = this.tweens.filter((t) => t.vivo);
  }

  get pendientes(): number {
    return this.tareas.length + this.tweens.length;
  }
}
