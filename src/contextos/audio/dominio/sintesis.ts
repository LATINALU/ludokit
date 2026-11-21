// Síntesis procedural de efectos de sonido: cada sonido es una RECETA (lista de capas) que se renderiza una vez a
// PCM (Float32Array) y se cachea. Sin archivos de audio: todo sale del mismo "ADN tonal", así un golpe, un cofre y
// la música suenan al mismo mundo. Puro y determinista (el ruido usa un Azar con semilla por variante).
//
// Capas de un sonido importante: TRANSITORIO (10-20 ms de ruido brillante: el "clac" del contacto) · CUERPO (el peso:
// subgrave o tono que cae) · COLA (la resonancia del material: FM con índice que se apaga) · GRANO (ruido de banda muy
// bajo que sigue a la cola: la imperfección que el oído lee como "real").

import { AzarSemilla, type Azar } from "../../../nucleo/azar.ts";

export type Onda = "sine" | "triangle" | "square" | "sawtooth";

export type Capa =
  | { readonly t: "tono"; readonly f: number; readonly dur: number; readonly onda: Onda; readonly vol: number; readonly final?: number; readonly retraso?: number }
  | { readonly t: "ruido"; readonly dur: number; readonly vol: number; readonly filtro: number; readonly retraso?: number }
  | { readonly t: "fm"; readonly f: number; readonly ratio: number; readonly indice: number; readonly dur: number; readonly vol: number; readonly retraso?: number }
  | { readonly t: "grano"; readonly dur: number; readonly vol: number; readonly bajo: number; readonly alto: number; readonly retraso?: number }
  | { readonly t: "barrido"; readonly dur: number; readonly desde: number; readonly hasta: number; readonly vol: number; readonly retraso?: number };

export type Receta = readonly Capa[];

export interface OpcionesRender {
  /** Frecuencia de muestreo (Hz). 22050 alcanza para efectos y ahorra memoria. */
  readonly fs?: number;
  /** Multiplica todas las frecuencias (variantes con desafinación). */
  readonly afinacion?: number;
  readonly azar?: Azar;
}

const TAU = Math.PI * 2;

function onda(tipo: Onda, fase: number): number {
  switch (tipo) {
    case "square":
      return fase < 0.5 ? 1 : -1;
    case "sawtooth":
      return fase * 2 - 1;
    case "triangle":
      return 4 * Math.abs(fase - 0.5) - 1;
    default:
      return Math.sin(fase * TAU);
  }
}

function largoDe(c: Capa): number {
  return (c.retraso ?? 0) + c.dur;
}

/** Renderiza una receta a PCM mono flotante. */
export function renderizar(receta: Receta, op: OpcionesRender = {}): Float32Array {
  const FS = op.fs ?? 22050;
  const af = op.afinacion ?? 1;
  const azar = op.azar ?? new AzarSemilla(1);
  const largo = receta.reduce((m, c) => Math.max(m, largoDe(c)), 0);
  const buf = new Float32Array(Math.ceil((largo + 0.03) * FS));
  const rnd = (): number => azar.siguiente() * 2 - 1;
  for (const c of receta) {
    const n = Math.floor(c.dur * FS);
    const i0 = Math.floor((c.retraso ?? 0) * FS);
    if (n <= 0) continue;
    switch (c.t) {
      case "tono": {
        const f0 = c.f * af;
        const mult = c.final && c.final > 0 ? Math.pow((c.final * af) / f0, 1 / n) : 1;
        const caida = Math.pow(0.0001 / Math.max(1e-6, c.vol), 1 / n);
        let fase = 0, g = c.vol, frec = f0;
        for (let i = 0; i < n && i0 + i < buf.length; i++) {
          fase = (fase + frec / FS) % 1;
          buf[i0 + i] += onda(c.onda, fase) * g * Math.min(1, i / 40);
          g *= caida;
          frec *= mult;
        }
        break;
      }
      case "ruido": {
        const a = 1 - Math.exp((-TAU * Math.min(c.filtro, FS * 0.45)) / FS);
        let y = 0;
        for (let i = 0; i < n && i0 + i < buf.length; i++) {
          y += a * (rnd() * (1 - i / n) - y);
          buf[i0 + i] += y * c.vol * 2;
        }
        break;
      }
      case "fm": {
        // Moduladora f·ratio con índice que cae antes que el volumen (el brillo se apaga primero, como un bronce).
        const w = (TAU * c.f * af) / FS;
        const wm = w * c.ratio;
        for (let i = 0; i < n && i0 + i < buf.length; i++) {
          const t = i / n;
          const env = Math.exp(-t * 4.6) * Math.min(1, i / 30);
          buf[i0 + i] += Math.sin(w * i + c.indice * Math.exp(-t * 6) * Math.sin(wm * i)) * c.vol * env;
        }
        break;
      }
      case "grano": {
        const aA = 1 - Math.exp((-TAU * Math.min(c.alto, FS * 0.45)) / FS);
        const aB = 1 - Math.exp((-TAU * Math.min(c.bajo, FS * 0.45)) / FS);
        let lp = 0, lp2 = 0;
        for (let i = 0; i < n && i0 + i < buf.length; i++) {
          lp += aA * (rnd() - lp);
          lp2 += aB * (lp - lp2);
          buf[i0 + i] += (lp - lp2) * c.vol * 3 * Math.exp((-i / n) * 4) * Math.min(1, i / 60);
        }
        break;
      }
      case "barrido": {
        // Ruido por un filtro de estado variable pasa-banda que barre (el silbido de un corte).
        let bajo = 0, banda = 0, f = c.desde * af;
        const q = 1 / 3.5;
        const mult = Math.pow(c.hasta / c.desde, 1 / n);
        const caida = Math.pow(0.001 / Math.max(1e-6, c.vol), 1 / n);
        let g = c.vol;
        for (let i = 0; i < n && i0 + i < buf.length; i++) {
          const k = 2 * Math.sin((Math.PI * Math.min(f, FS * 0.2)) / FS);
          const alto = rnd() - bajo - q * banda;
          banda += k * alto;
          bajo += k * banda;
          buf[i0 + i] += banda * g * 1.5;
          g *= caida;
          f *= mult;
        }
        break;
      }
    }
  }
  return buf;
}

/** Saturación suave normalizada (tanh): calidez sin aplastar el transitorio. Una señal de 1 sale a ~0,92. */
export function saturar(buf: Float32Array, drive = 1.25): Float32Array {
  const norma = 0.92 / Math.tanh(drive);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = Math.max(-1, Math.min(1, Math.tanh(buf[i] * drive) * norma));
  return out;
}

/** PCM flotante → archivo WAV de 16 bits mono (bytes listos para guardar o para `new Blob([...])`). */
export function aWav(buf: Float32Array, fs = 22050): Uint8Array {
  const datos = buf.length * 2;
  const out = new Uint8Array(44 + datos);
  const v = new DataView(out.buffer);
  const txt = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i);
  };
  txt(0, "RIFF");
  v.setUint32(4, 36 + datos, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, fs, true);
  v.setUint32(28, fs * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, datos, true);
  for (let i = 0; i < buf.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, buf[i])) * 32000), true);
  return out;
}

// ---------------------------------------------------------------- Materiales

export interface Material {
  /** Cola FM: frecuencia, ratio (no entero = inarmónico), índice, duración y volumen. f = 0 sin cola tonal. */
  readonly f: number;
  readonly ratio: number;
  readonly indice: number;
  readonly cola: number;
  readonly colaVol: number;
  readonly ruido: number;
  readonly ruidoF: number;
  readonly cuerpoF: number;
  readonly cuerpo: number;
  readonly grano: readonly [bajo: number, alto: number, vol: number];
  readonly chasquidos: number;
}

export const MATERIALES: Readonly<Record<string, Material>> = {
  metal: { f: 1150, ratio: 1.41, indice: 5.5, cola: 0.42, colaVol: 0.07, ruido: 0.18, ruidoF: 5200, cuerpoF: 160, cuerpo: 0.1, grano: [1800, 6000, 0.025], chasquidos: 0 },
  hueso: { f: 900, ratio: 2.76, indice: 2, cola: 0.09, colaVol: 0.04, ruido: 0.26, ruidoF: 2600, cuerpoF: 210, cuerpo: 0.08, grano: [900, 3000, 0.02], chasquidos: 3 },
  madera: { f: 420, ratio: 1, indice: 1.2, cola: 0.12, colaVol: 0.05, ruido: 0.22, ruidoF: 1400, cuerpoF: 180, cuerpo: 0.14, grano: [500, 1800, 0.02], chasquidos: 2 },
  carne: { f: 0, ratio: 1, indice: 0, cola: 0, colaVol: 0, ruido: 0.3, ruidoF: 700, cuerpoF: 95, cuerpo: 0.24, grano: [200, 900, 0.025], chasquidos: 0 },
  piedra: { f: 300, ratio: 2.1, indice: 1.5, cola: 0.14, colaVol: 0.04, ruido: 0.32, ruidoF: 1800, cuerpoF: 70, cuerpo: 0.22, grano: [400, 2200, 0.03], chasquidos: 1 },
  cristal: { f: 1760, ratio: 3.5, indice: 3, cola: 0.6, colaVol: 0.06, ruido: 0.12, ruidoF: 7000, cuerpoF: 0, cuerpo: 0, grano: [5000, 10000, 0.015], chasquidos: 2 },
  energia: { f: 520, ratio: 0.5, indice: 7, cola: 0.3, colaVol: 0.06, ruido: 0.1, ruidoF: 3000, cuerpoF: 140, cuerpo: 0.1, grano: [2000, 7000, 0.02], chasquidos: 0 },
};

/** Fuerza 0 leve · 1 normal · 2 fuerte: [frecuencia, volumen, cola, cuerpo, índice FM]. Más fuerza = más grave y largo. */
export const FUERZAS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [1.08, 0.7, 0.8, 0.6, 0.8],
  [1, 1, 1, 1, 1],
  [0.88, 1.3, 1.4, 1.6, 1.3],
];

/** Receta de un impacto contra un material, con 3 fuerzas. */
export function recetaImpacto(material: string, fuerza: 0 | 1 | 2 = 1): Receta {
  const m = MATERIALES[material] ?? MATERIALES.carne;
  const [kf, kv, kc, kb, ki] = FUERZAS[fuerza];
  const r: Capa[] = [
    { t: "ruido", dur: 0.012, vol: 0.3 * kv, filtro: 7000 },
    { t: "ruido", dur: 0.07 * kc, vol: m.ruido * kv, filtro: m.ruidoF * kf },
  ];
  if (m.cuerpo > 0) r.push({ t: "tono", f: m.cuerpoF * kf, dur: 0.1 * kc, onda: "sine", vol: m.cuerpo * kb, final: m.cuerpoF * kf * 0.45 });
  if (m.f > 0) r.push({ t: "fm", f: m.f * kf, ratio: m.ratio, indice: m.indice * ki, dur: m.cola * kc, vol: m.colaVol * kv, retraso: 0.004 });
  for (let c = 0; c < m.chasquidos; c++) r.push({ t: "ruido", dur: 0.02, vol: 0.12 * kv, filtro: m.ruidoF * (1.2 + c * 0.3), retraso: 0.018 + c * 0.022 });
  r.push({ t: "grano", dur: Math.max(0.08, m.cola * kc * 1.1), vol: m.grano[2] * kv, bajo: m.grano[0], alto: m.grano[1] });
  return r;
}

/**
 * Sonido de botín según rareza (0..7): arpegio por una pentatónica lidia desde C5 con 2 + rareza notas, que "respira"
 * (micro-variación de tempo), FM más profunda e inarmónica con la rareza; acorde desde 2, campana desde 3, subgrave
 * desde 4, polvo de cristal desde 5. Así lo raro SUENA raro antes de verlo.
 */
export function recetaRareza(rareza: number, azar: Azar = new AzarSemilla(rareza + 1)): Receta {
  const rz = Math.max(0, Math.min(7, Math.floor(rareza)));
  const escala = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const notas = 2 + rz;
  const paso = 0.075 - rz * 0.004;
  const ratio = rz < 3 ? 2 : rz < 6 ? 3.5 : 2.76;
  const indice = 1 + rz * 0.55;
  const r: Capa[] = [];
  let t = 0;
  for (let i = 0; i < notas; i++) {
    const f = 523.25 * Math.pow(2, escala[i] / 12);
    const ultima = i === notas - 1;
    r.push({ t: "fm", f, ratio, indice: indice * (ultima ? 1.4 : 1), dur: ultima ? 0.6 : 0.22 + rz * 0.02, vol: ultima ? 0.06 : 0.05, retraso: t });
    t += paso * (1 + (azar.siguiente() * 0.24 - 0.12) * Math.min(1, rz / 4));
  }
  const tf = t - paso;
  if (rz >= 2) {
    r.push({ t: "tono", f: 261.63, dur: 0.5 + rz * 0.1, onda: "sine", vol: 0.06, retraso: tf });
    r.push({ t: "tono", f: 392, dur: 0.5 + rz * 0.1, onda: "triangle", vol: 0.03, retraso: tf });
  }
  if (rz >= 3) r.push({ t: "fm", f: 392, ratio: 1.4, indice: 3 + rz * 0.3, dur: 1 + rz * 0.15, vol: 0.07, retraso: tf });
  if (rz >= 4) r.push({ t: "tono", f: 65.4, dur: 0.9 + rz * 0.1, onda: "sine", vol: 0.2, final: 43.6, retraso: tf });
  if (rz >= 5) {
    r.push({ t: "fm", f: 2637, ratio: 3.5, indice: 2, dur: 0.9, vol: 0.025, retraso: tf + 0.05 });
    r.push({ t: "fm", f: 3520, ratio: 2.76, indice: 1.5, dur: 0.8, vol: 0.018, retraso: tf + 0.12 });
    r.push({ t: "grano", dur: 1.2, vol: 0.025, bajo: 5000, alto: 10000, retraso: tf });
  }
  return r;
}

/** Corte de arma: barrido de ruido que sube (silbido) + transitorio. */
export const recetaCorte = (pesado = false): Receta => [
  { t: "barrido", dur: pesado ? 0.22 : 0.14, desde: pesado ? 500 : 900, hasta: pesado ? 2400 : 4200, vol: pesado ? 0.5 : 0.35 },
  { t: "ruido", dur: 0.01, vol: 0.15, filtro: 8000 },
];

// ---------------------------------------------------------------- Banco con variantes

/**
 * Banco de sonidos con VARIANTES: cada receta se renderiza N veces con desafinación ±1,5 % y ruido distinto (semilla
 * fija por variante), nunca se toca la misma variante dos veces seguidas, y el mismo sonido no se repite dentro de
 * `antirepeticion` s (diez golpes en un cuadro suenan como uno fuerte, no como un muro).
 */
export class BancoSonidos {
  private readonly cache = new Map<string, Float32Array[]>();
  private readonly ultimaVariante = new Map<string, number>();
  private readonly ultimoTiempo = new Map<string, number>();
  readonly variantes: number;
  readonly fs: number;
  readonly antirepeticion: number;

  constructor(variantes = 4, fs = 22050, antirepeticion = 0.035) {
    this.variantes = variantes;
    this.fs = fs;
    this.antirepeticion = antirepeticion;
  }

  registrar(nombre: string, receta: Receta): void {
    const lista: Float32Array[] = [];
    for (let v = 0; v < this.variantes; v++) {
      const af = 1 + (v === 0 ? 0 : ((v % 2 === 0 ? 1 : -1) * 0.015 * Math.ceil(v / 2)) / Math.ceil((this.variantes - 1) / 2));
      lista.push(saturar(renderizar(receta, { fs: this.fs, afinacion: af, azar: new AzarSemilla(1000 + v) })));
    }
    this.cache.set(nombre, lista);
  }

  /** PCM a reproducir ahora (o null si se repetiría dentro de la ventana). `r01`: azar 0..1 para elegir variante. */
  tocar(nombre: string, ahora: number, r01: number): Float32Array | null {
    const lista = this.cache.get(nombre);
    if (!lista) throw new Error(`Sonido desconocido: ${nombre}`);
    const t = this.ultimoTiempo.get(nombre);
    if (t !== undefined && ahora - t < this.antirepeticion) return null;
    this.ultimoTiempo.set(nombre, ahora);
    const previa = this.ultimaVariante.get(nombre) ?? -1;
    let v = Math.floor(r01 * lista.length) % lista.length;
    if (v === previa && lista.length > 1) v = (v + 1) % lista.length;
    this.ultimaVariante.set(nombre, v);
    return lista[v];
  }

  tiene(nombre: string): boolean {
    return this.cache.has(nombre);
  }
}
