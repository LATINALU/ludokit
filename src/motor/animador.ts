// Animador de sprites por hojas: clips con cuadros, fps, bucle o una vez, eventos por cuadro (pisada, golpe
// activo, sonido) y transiciones. Datos compatibles con el JSON de Aseprite (frames + frameTags + duraciones).

export interface Clip {
  readonly cuadros: readonly number[];
  readonly fps: number;
  readonly bucle: boolean;
  /** Evento por índice de cuadro dentro del clip: { 2: "pisada", 4: "golpe" }. */
  readonly eventos?: Readonly<Record<number, string>>;
  /** Clip al que pasa cuando termina (si no es bucle). */
  readonly siguiente?: string;
}

export class Animador {
  private readonly clips: ReadonlyMap<string, Clip>;
  clip: string;
  private t = 0;
  private ultimoCuadro = -1;
  terminado = false;
  velocidad = 1;

  constructor(clips: Record<string, Clip>, inicial: string) {
    this.clips = new Map(Object.entries(clips));
    if (!this.clips.has(inicial)) throw new Error(`Animador: clip ${inicial}`);
    this.clip = inicial;
  }

  /** Cambia de clip (si ya está en él no reinicia, salvo `reiniciar`). */
  reproducir(nombre: string, reiniciar = false): void {
    if (!this.clips.has(nombre)) throw new Error(`Animador: clip ${nombre}`);
    if (nombre === this.clip && !reiniciar) return;
    this.clip = nombre;
    this.t = 0;
    this.ultimoCuadro = -1;
    this.terminado = false;
  }

  private get def(): Clip {
    return this.clips.get(this.clip)!;
  }

  get indice(): number {
    const c = this.def;
    const n = c.cuadros.length;
    const i = Math.floor(this.t * c.fps);
    return c.bucle ? i % n : Math.min(n - 1, i);
  }

  /** Cuadro de la hoja a dibujar. */
  get cuadro(): number {
    return this.def.cuadros[this.indice];
  }

  /** Avanza y devuelve los eventos de los cuadros que se pisaron en este paso (sin saltarse ninguno). */
  actualizar(dt: number): string[] {
    const eventos: string[] = [];
    const c = this.def;
    const n = c.cuadros.length;
    this.t += dt * this.velocidad;
    const total = Math.floor(this.t * c.fps);
    const hasta = c.bucle ? total : Math.min(n - 1, total);
    for (let k = this.ultimoCuadro + 1; k <= hasta; k++) {
      const ev = c.eventos?.[k % n];
      if (ev) eventos.push(ev);
    }
    this.ultimoCuadro = hasta;
    if (!c.bucle && total >= n) {
      this.terminado = true;
      if (c.siguiente) this.reproducir(c.siguiente);
    }
    return eventos;
  }
}

/** Convierte el JSON de Aseprite (`--format json-array` con tags) en clips. */
export function clipsDesdeAseprite(json: {
  frames: ReadonlyArray<{ duration: number }>;
  meta: { frameTags?: ReadonlyArray<{ name: string; from: number; to: number; direction?: string }> };
}, bucles: readonly string[] = []): Record<string, Clip> {
  const r: Record<string, Clip> = {};
  for (const tag of json.meta.frameTags ?? []) {
    const cuadros: number[] = [];
    for (let i = tag.from; i <= tag.to; i++) cuadros.push(i);
    if (tag.direction === "reverse") cuadros.reverse();
    const dur = cuadros.reduce((s, i) => s + json.frames[i].duration, 0) / cuadros.length;
    r[tag.name] = { cuadros, fps: 1000 / dur, bucle: bucles.includes(tag.name) };
  }
  return r;
}
