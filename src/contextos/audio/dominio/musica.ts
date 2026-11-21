// Música adaptativa por CAPAS (no por pistas): un director decide qué capas suenan y a qué tempo según el estado del
// juego, y un secuenciador emite NOTAS (eventos) que el motor de audio sintetiza o dispara con samples.
//   - Identidad por zona: escala/modo, tónica, tempo, MOTIVO (célula de 5 grados) y progresión de acordes.
//   - Estados: explora · combate (la ENERGÍA 0..1 arma las capas: bajo → percusión → arpegio → motivo → coro → filo)
//     · jefe (tempo +14, energía mínima) · final. Peligro: latido y la música se apaga (paso-bajo).
//   - Los cambios caen AL EMPEZAR EL COMPÁS SIGUIENTE: nunca a mitad de frase.
//   - El motivo se transforma por compás: original, inversión, retrógrado y, con mucha energía, fragmentado.

export const ESCALAS: Readonly<Record<string, readonly number[]>> = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  eolico: [0, 2, 3, 5, 7, 8, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  frigioDominante: [0, 1, 4, 5, 7, 8, 10],
  tonosEnteros: [0, 2, 4, 6, 8, 10, 12],
  pentatonica: [0, 2, 4, 7, 9],
};

export interface IdentidadMusical {
  readonly nombre: string;
  readonly escala: string;
  /** Tónica en número MIDI (45 = La2). */
  readonly tonica: number;
  readonly tempo: number;
  /** Grados de la escala (0 = tónica). */
  readonly motivo: readonly number[];
  /** Grado de la escala de cada compás. */
  readonly progresion: readonly number[];
  /** Compases de 4 tiempos por defecto. */
  readonly tiempos?: number;
}

export const IDENTIDADES_EJEMPLO: Readonly<Record<string, IdentidadMusical>> = {
  refugio: { nombre: "Refugio", escala: "lidio", tonica: 45, tempo: 74, motivo: [0, 2, 4, 6, 4], progresion: [0, 3, 4, 0] },
  ruinas: { nombre: "Ruinas", escala: "dorico", tonica: 45, tempo: 96, motivo: [0, 2, 4, 3, 1], progresion: [0, 5, 3, 4] },
  profundidad: { nombre: "Profundidad", escala: "eolico", tonica: 43, tempo: 102, motivo: [0, 4, 3, 1, 2], progresion: [0, 5, 6, 4] },
  forja: { nombre: "Forja", escala: "frigio", tonica: 40, tempo: 108, motivo: [0, 1, 3, 1, 4], progresion: [0, 1, 0, 6] },
  vacio: { nombre: "Vacío", escala: "tonosEnteros", tonica: 37, tempo: 100, motivo: [0, 3, 1, 4, 2], progresion: [0, 2, 4, 1] },
};

export type ModoMusica = "explora" | "combate" | "jefe" | "final";
export const CAPAS_MUSICA = ["percusion", "bajo", "motivo", "coro", "filo", "arpegio", "latido"] as const;
export type CapaMusica = (typeof CAPAS_MUSICA)[number];

export const midiAHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Nota MIDI de un grado de la escala (los grados fuera de rango suben/bajan de octava). */
export function grado(escala: readonly number[], tonica: number, g: number): number {
  const n = escala.length;
  const oct = Math.floor(g / n);
  return tonica + escala[((g % n) + n) % n] + 12 * oct;
}

/** Transformaciones clásicas de un motivo. */
export const transformarMotivo = (m: readonly number[], forma: "original" | "inversion" | "retrogrado" | "fragmento"): number[] =>
  forma === "inversion" ? m.map((x) => m[0] - (x - m[0])) : forma === "retrogrado" ? [...m].reverse() : forma === "fragmento" ? m.slice(0, 3) : [...m];

export interface EstadoJuegoMusica {
  readonly modo: ModoMusica;
  /** 0..1 (por ejemplo del medidor de estilo). */
  readonly energia: number;
  /** 0 sano … 1 al borde de la muerte. */
  readonly peligro: number;
  readonly tension?: boolean;
  readonly frenesi?: boolean;
}

export interface Nota {
  readonly capa: CapaMusica;
  /** Segundos desde el inicio de la música. */
  readonly t: number;
  readonly midi: number;
  readonly dur: number;
  readonly vel: number;
}

export interface Mezcla {
  readonly volumen: Readonly<Record<CapaMusica, number>>;
  readonly tempo: number;
  /** Frecuencia de corte del paso-bajo general (Hz): baja con el peligro. */
  readonly corte: number;
}

/** Capas, tempo y filtro objetivo para un estado (la regla de diseño, sin tiempo). */
export function mezclaPara(id: IdentidadMusical, e: EstadoJuegoMusica): Mezcla {
  let en = e.modo === "explora" ? e.energia * 0.6 : e.energia;
  if (e.tension) en = Math.max(en, 0.75);
  if (e.frenesi) en = Math.max(en, 0.6);
  if (e.modo === "jefe") en = Math.max(en, 0.62);
  if (e.modo === "final") en = Math.max(en, 0.86);
  let tempo = id.tempo + en * 30 + (e.modo === "jefe" || e.modo === "final" ? 14 : 0);
  if (e.tension) tempo = 140;
  if (e.frenesi) tempo *= 1.22;
  const explora = e.modo === "explora";
  const volumen: Record<CapaMusica, number> = {
    percusion: explora ? 0.45 : 0.85,
    bajo: explora ? 0.6 : 0.9,
    motivo: en >= 0.55 || explora ? 1 : 0,
    coro: en >= 0.7 ? 0.7 : 0,
    filo: en >= 0.85 ? 0.5 : 0,
    arpegio: en >= 0.45 || explora ? 0.6 : 0,
    latido: e.peligro > 0.7 ? 1 : 0,
  };
  return { volumen, tempo, corte: 18000 - Math.max(0, e.peligro - 0.7) / 0.3 * 16500 };
}

/** Director: aplica el estado nuevo al empezar el compás siguiente y emite las notas de cada compás. */
export class DirectorMusical {
  private id: IdentidadMusical;
  private idPendiente: IdentidadMusical | null = null;
  private estadoPendiente: EstadoJuegoMusica;
  mezcla: Mezcla;
  /** Corrimiento de tónica (semitonos), p. ej. por nivel dentro de una zona. */
  transporte = 0;
  t = 0;
  compas = 0;
  private finCompas = 0;
  private notas: Nota[] = [];

  constructor(id: IdentidadMusical, estado: EstadoJuegoMusica = { modo: "explora", energia: 0, peligro: 0 }) {
    this.id = id;
    this.estadoPendiente = estado;
    this.mezcla = mezclaPara(id, estado);
  }

  get identidad(): IdentidadMusical {
    return this.id;
  }

  /** El estado nuevo se aplica al empezar el compás siguiente. */
  estado(e: EstadoJuegoMusica): void {
    this.estadoPendiente = e;
  }

  cambiarZona(id: IdentidadMusical): void {
    this.idPendiente = id;
  }

  /** Duración de un compás al tempo actual (s). */
  get duracionCompas(): number {
    return ((this.id.tiempos ?? 4) * 60) / this.mezcla.tempo;
  }

  /** Avanza el tiempo y devuelve las notas que empiezan en esta ventana [t, t+dt). */
  actualizar(dt: number): Nota[] {
    const hasta = this.t + dt;
    while (this.finCompas <= hasta) this.programarCompas();
    const salen = this.notas.filter((n) => n.t < hasta);
    this.notas = this.notas.filter((n) => n.t >= hasta);
    this.t = hasta;
    return salen;
  }

  private programarCompas(): void {
    if (this.idPendiente) {
      this.id = this.idPendiente;
      this.idPendiente = null;
    }
    this.mezcla = mezclaPara(this.id, this.estadoPendiente);
    const inicio = this.finCompas;
    const tiempos = this.id.tiempos ?? 4;
    const pulso = 60 / this.mezcla.tempo;
    const escala = ESCALAS[this.id.escala] ?? ESCALAS.menor;
    const ton = this.id.tonica + this.transporte;
    const raiz = this.id.progresion[this.compas % this.id.progresion.length];
    const v = this.mezcla.volumen;
    const e = this.estadoPendiente;
    const add = (capa: CapaMusica, t: number, midi: number, dur: number, vel: number): void => {
      if (v[capa] > 0) this.notas.push({ capa, t, midi, dur, vel: vel * v[capa] });
    };
    // Bajo: raíz del acorde, en blancas (combate: corcheas sincopadas en el jefe).
    const pasosBajo = e.modo === "jefe" ? tiempos * 2 : 2;
    for (let i = 0; i < pasosBajo; i++) add("bajo", inicio + (i * tiempos * pulso) / pasosBajo, grado(escala, ton - 12, raiz), (tiempos * pulso) / pasosBajo * 0.9, i === 0 ? 1 : 0.75);
    // Percusión: golpe en 1 y 3, caja en 2 y 4 (con energía alta, corcheas).
    for (let b = 0; b < tiempos; b++) {
      add("percusion", inicio + b * pulso, b % 2 === 0 ? 36 : 38, 0.1, b === 0 ? 1 : 0.7);
      if (this.mezcla.volumen.coro > 0) add("percusion", inicio + (b + 0.5) * pulso, 42, 0.05, 0.4);
    }
    // Motivo transformado según el compás y la energía.
    const formas = ["original", "inversion", "original", "retrogrado"] as const;
    const forma = e.energia >= 0.86 && this.compas % 2 === 1 ? "fragmento" : formas[this.compas % 4];
    const motivo = transformarMotivo(this.id.motivo, forma);
    motivo.forEach((g, i) => add("motivo", inicio + (i * tiempos * pulso) / motivo.length, grado(escala, ton + 12, g + raiz), (tiempos * pulso) / motivo.length * 0.8, 0.8));
    // Arpegio del acorde (1-3-5) en semicorcheas.
    for (let i = 0; i < tiempos * 4; i++) add("arpegio", inicio + (i * pulso) / 4, grado(escala, ton + 24, raiz + [0, 2, 4, 2][i % 4]), pulso / 4, 0.4);
    // Coro: acorde sostenido.
    for (const g of [0, 2, 4]) add("coro", inicio, grado(escala, ton + 12, raiz + g), tiempos * pulso, 0.5);
    // Filo: sierra saturada en la raíz, a contratiempo.
    for (let b = 0; b < tiempos; b++) add("filo", inicio + (b + 0.5) * pulso, grado(escala, ton, raiz), pulso * 0.4, 0.6);
    // Latido (peligro): dos golpes graves por compás.
    add("latido", inicio, 28, 0.15, 1);
    add("latido", inicio + pulso * 0.35, 28, 0.12, 0.7);
    this.notas.sort((a, b) => a.t - b.t);
    this.finCompas = inicio + tiempos * pulso;
    this.compas++;
  }
}
