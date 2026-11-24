// Catálogo PROPIO de armas de fuego para juegos tácticos, de extracción, militares y de supervivencia.
// Los datos físicos de los calibres (masa del proyectil, velocidad en boca) son valores técnicos públicos y
// aproximados del mundo real; el daño, la penetración y las clases de blindaje son una CONVERSIÓN propia de ludokit
// (fórmulas abajo), pensadas para que un diseñador las retoque, no copiadas de ningún juego.
//
//   energía (J)    = ½ · masa(kg) · velocidad²
//   daño           = base + escala · √energía          (por proyectil)
//   penetración    = factorTipo · k · √energía          (misma escala que clase de blindaje × 10)
//
// Uso: `municion("5.56x45", "perforante")` → `Municion` para `resolverBlindaje`; `ARMAS` → `DefArma` +
// dispersión/retroceso para `Arma`, `Dispersion`, `Retroceso`; `aplicarAccesorios` para miras, culatas, etc.

import type { DefArma } from "../contextos/disparos/dominio/arma.ts";
import type { Municion } from "../contextos/disparos/dominio/balistica.ts";
import type { DefDispersion, DefRetroceso } from "../contextos/disparos/dominio/punteria.ts";
import type { Curva } from "../nucleo/escalado.ts";

export interface Calibre {
  readonly id: string;
  readonly familia: "pistola" | "intermedio" | "completo" | "magnum" | "escopeta" | "pesado" | "pdw" | "subsonico";
  /** Masa del proyectil en gramos y velocidad en boca (m/s), aproximadas. */
  readonly masa: number;
  readonly velocidad: number;
  /** Proyectiles por disparo (perdigones). */
  readonly proyectiles?: number;
}

export const CALIBRES: readonly Calibre[] = [
  { id: "9x19", familia: "pistola", masa: 8, velocidad: 360 },
  { id: ".45acp", familia: "pistola", masa: 15, velocidad: 260 },
  { id: ".357mag", familia: "magnum", masa: 10.2, velocidad: 440 },
  { id: "5.7x28", familia: "pdw", masa: 2, velocidad: 715 },
  { id: "9x39", familia: "subsonico", masa: 16, velocidad: 290 },
  { id: ".300blk", familia: "intermedio", masa: 8.1, velocidad: 670 },
  { id: "5.56x45", familia: "intermedio", masa: 4, velocidad: 940 },
  { id: "5.45x39", familia: "intermedio", masa: 3.4, velocidad: 880 },
  { id: "7.62x39", familia: "intermedio", masa: 7.9, velocidad: 715 },
  { id: "7.62x51", familia: "completo", masa: 9.5, velocidad: 840 },
  { id: "7.62x54r", familia: "completo", masa: 9.6, velocidad: 830 },
  { id: ".338lm", familia: "magnum", masa: 16.2, velocidad: 900 },
  { id: "12.7x99", familia: "pesado", masa: 42, velocidad: 890 },
  { id: "12ga-posta", familia: "escopeta", masa: 3.5, velocidad: 400, proyectiles: 9 },
  { id: "12ga-slug", familia: "escopeta", masa: 28, velocidad: 450 },
];

export type TipoMunicion = "comun" | "expansiva" | "perforante" | "trazadora" | "subsonica";

/** Modificadores por tipo de munición: daño, penetración, desgaste de blindaje, sangrado, velocidad. */
export const TIPOS_MUNICION: Readonly<Record<TipoMunicion, { danio: number; pen: number; blindaje: number; sangrado: number; velocidad: number }>> = {
  comun: { danio: 1, pen: 1, blindaje: 0.5, sangrado: 0.2, velocidad: 1 },
  expansiva: { danio: 1.3, pen: 0.55, blindaje: 0.3, sangrado: 0.45, velocidad: 1 },
  perforante: { danio: 0.88, pen: 1.55, blindaje: 0.75, sangrado: 0.12, velocidad: 1.03 },
  trazadora: { danio: 0.95, pen: 0.95, blindaje: 0.45, sangrado: 0.2, velocidad: 1 },
  subsonica: { danio: 0.9, pen: 0.8, blindaje: 0.4, sangrado: 0.2, velocidad: 0.7 },
};

export interface ConversionBalistica {
  readonly danioBase: number;
  readonly danioEscala: number;
  readonly penetracionK: number;
}

/** Conversión por defecto (vida de referencia ~100 por zona vital). */
export const CONVERSION_BALISTICA: ConversionBalistica = { danioBase: 18, danioEscala: 1.45, penetracionK: 0.92 };

export const energia = (c: Calibre, tipo: TipoMunicion = "comun"): number => {
  const v = c.velocidad * TIPOS_MUNICION[tipo].velocidad;
  return 0.5 * (c.masa / 1000) * v * v;
};

/** Munición lista para `resolverBlindaje` / `resolverDisparo`. */
export function municion(calibre: string, tipo: TipoMunicion = "comun", conv: ConversionBalistica = CONVERSION_BALISTICA): Municion {
  const c = CALIBRES.find((x) => x.id === calibre);
  if (!c) throw new Error(`Calibre desconocido: ${calibre}`);
  const t = TIPOS_MUNICION[tipo];
  const raiz = Math.sqrt(energia(c, tipo));
  return {
    id: `${calibre}/${tipo}`,
    danio: Math.round((conv.danioBase + conv.danioEscala * raiz) * t.danio),
    penetracion: Math.round(conv.penetracionK * raiz * t.pen),
    danioBlindaje: t.blindaje,
    sangrado: t.sangrado,
    fractura: c.familia === "pesado" || c.familia === "magnum" ? 0.35 : 0.12,
    velocidad: Math.round(c.velocidad * t.velocidad),
    proyectiles: c.proyectiles,
  };
}

/** Clases de blindaje 1..6 (penetración necesaria ≈ clase × 10). Material decide desgaste y daño contundente. */
export interface DefBlindaje {
  readonly id: string;
  readonly clase: number;
  readonly durabilidad: number;
  readonly desgaste: number;
  readonly contundente: number;
  readonly zonas: readonly string[];
  /** kg: penaliza estamina/velocidad. */
  readonly peso: number;
}

export const BLINDAJES: readonly DefBlindaje[] = [
  { id: "chaleco-textil-1", clase: 1, durabilidad: 40, desgaste: 0.9, contundente: 0.35, zonas: ["torso"], peso: 1.5 },
  { id: "chaleco-aramida-2", clase: 2, durabilidad: 50, desgaste: 0.8, contundente: 0.3, zonas: ["torso"], peso: 2.5 },
  { id: "chaleco-aramida-3", clase: 3, durabilidad: 60, desgaste: 0.7, contundente: 0.28, zonas: ["torso"], peso: 4 },
  { id: "placa-acero-4", clase: 4, durabilidad: 70, desgaste: 0.35, contundente: 0.25, zonas: ["torso"], peso: 8 },
  { id: "placa-ceramica-5", clase: 5, durabilidad: 65, desgaste: 0.6, contundente: 0.2, zonas: ["torso", "abdomen"], peso: 9 },
  { id: "placa-polietileno-6", clase: 6, durabilidad: 80, desgaste: 0.5, contundente: 0.18, zonas: ["torso", "abdomen"], peso: 7.5 },
  { id: "casco-ligero-2", clase: 2, durabilidad: 30, desgaste: 0.8, contundente: 0.3, zonas: ["cabeza"], peso: 1 },
  { id: "casco-balistico-4", clase: 4, durabilidad: 45, desgaste: 0.5, contundente: 0.22, zonas: ["cabeza"], peso: 1.6 },
];

/** Zonas de impacto de un humanoide con multiplicadores y parte de salud (para `SaludPorPartes`). */
export const ZONAS_HUMANOIDE = {
  cabeza: { mult: 2.5, parte: "cabeza", cubre: "casco" },
  torso: { mult: 1, parte: "torso", cubre: "chaleco" },
  abdomen: { mult: 1, parte: "abdomen", cubre: "chaleco" },
  brazoIzq: { mult: 0.7, parte: "brazoIzq" },
  brazoDer: { mult: 0.7, parte: "brazoDer" },
  piernaIzq: { mult: 0.75, parte: "piernaIzq" },
  piernaDer: { mult: 0.75, parte: "piernaDer" },
} as const;

/** Partes de salud de un humanoide (vitales: cabeza y torso). */
export const PARTES_HUMANOIDE = {
  cabeza: { vida: 35, vital: true },
  torso: { vida: 85, vital: true },
  abdomen: { vida: 70 },
  brazoIzq: { vida: 60 },
  brazoDer: { vida: 60 },
  piernaIzq: { vida: 65 },
  piernaDer: { vida: 65 },
} as const;

export interface FichaArma {
  readonly arma: DefArma;
  readonly calibre: string;
  readonly categoria: "pistola" | "revolver" | "subfusil" | "pdw" | "carabina" | "fusil" | "batalla" | "tirador" | "francotirador" | "antimaterial" | "escopeta" | "ametralladora";
  readonly dispersion: DefDispersion;
  readonly retroceso: DefRetroceso;
  /** Caída de daño por distancia (m). */
  readonly caida: Curva;
  /** Alcance máximo útil (m) y masa (kg). */
  readonly alcance: number;
  readonly masa: number;
  /** Ranuras de accesorios disponibles. */
  readonly ranuras: readonly string[];
}

const disp = (base: number, bloom: number, maxima: number, primero = false): DefDispersion => ({
  base, bloomPorDisparo: bloom, recuperacion: bloom * 8, maxima, primerTiroPerfecto: primero,
  postura: { quieto: 1, caminando: 1.8, corriendo: 3.5, aire: 5, agachado: 0.7, apuntando: 0.35 },
});
const ret = (v: number, h: number, rec: number, patron?: ReadonlyArray<readonly [number, number]>): DefRetroceso => ({ vertical: v, horizontal: h, recuperacion: rec, patron, fraccionRecuperable: 0.7 });
const caida = (pleno: number, fin: number, min: number): Curva => ({ tipo: "tramos", puntos: [[0, 1], [pleno, 1], [fin, min]] });

export const ARMAS: readonly FichaArma[] = [
  { calibre: "9x19", categoria: "pistola", arma: { id: "pistola-9", cadencia: 450, modos: ["semi"], cargador: 17, recamara: true, recargaTactica: 1.5, recargaVacia: 2, preparacion: 0.25 }, dispersion: disp(0.9, 0.5, 4), retroceso: ret(1.1, 0.5, 30), caida: caida(15, 50, 0.55), alcance: 50, masa: 0.8, ranuras: ["mira", "boca", "linterna"] },
  { calibre: ".45acp", categoria: "pistola", arma: { id: "pistola-45", cadencia: 380, modos: ["semi"], cargador: 8, recamara: true, recargaTactica: 1.6, recargaVacia: 2.1, preparacion: 0.3 }, dispersion: disp(1, 0.7, 4.5), retroceso: ret(1.6, 0.6, 28), caida: caida(12, 45, 0.55), alcance: 45, masa: 1.1, ranuras: ["mira", "boca"] },
  { calibre: ".357mag", categoria: "revolver", arma: { id: "revolver-357", cadencia: 160, modos: ["semi"], cargador: 6, recargaTactica: 3.2, recargaVacia: 3.2, preparacion: 0.35 }, dispersion: disp(0.7, 1.2, 5), retroceso: ret(3, 0.8, 22), caida: caida(20, 60, 0.6), alcance: 60, masa: 1.2, ranuras: ["mira"] },
  { calibre: "9x19", categoria: "subfusil", arma: { id: "subfusil-9", cadencia: 850, modos: ["semi", "auto"], cargador: 30, recamara: true, recargaTactica: 2.1, recargaVacia: 2.8, preparacion: 0.35 }, dispersion: disp(1.3, 0.25, 5), retroceso: ret(0.6, 0.45, 26, [[0.5, 0], [0.6, 0.1], [0.6, -0.1], [0.7, 0.15]]), caida: caida(20, 60, 0.5), alcance: 70, masa: 2.6, ranuras: ["mira", "boca", "culata", "empunadura"] },
  { calibre: ".45acp", categoria: "subfusil", arma: { id: "subfusil-45", cadencia: 650, modos: ["semi", "auto"], cargador: 25, recamara: true, recargaTactica: 2.3, recargaVacia: 3, preparacion: 0.35 }, dispersion: disp(1.3, 0.3, 5), retroceso: ret(0.8, 0.5, 24), caida: caida(18, 55, 0.5), alcance: 60, masa: 3, ranuras: ["mira", "boca", "culata"] },
  { calibre: "5.7x28", categoria: "pdw", arma: { id: "pdw-57", cadencia: 900, modos: ["semi", "auto"], cargador: 50, recamara: true, recargaTactica: 2.6, recargaVacia: 3.2, preparacion: 0.35 }, dispersion: disp(1.1, 0.2, 4), retroceso: ret(0.4, 0.3, 30), caida: caida(30, 90, 0.6), alcance: 100, masa: 2.8, ranuras: ["mira", "boca"] },
  { calibre: "9x39", categoria: "subfusil", arma: { id: "silenciado-939", cadencia: 700, modos: ["semi", "auto"], cargador: 20, recamara: true, recargaTactica: 2.3, recargaVacia: 3, preparacion: 0.4 }, dispersion: disp(1, 0.35, 4.5), retroceso: ret(0.9, 0.5, 24), caida: caida(40, 120, 0.55), alcance: 150, masa: 2.6, ranuras: ["mira", "culata"] },
  { calibre: "5.56x45", categoria: "carabina", arma: { id: "carabina-556", cadencia: 800, modos: ["semi", "rafaga", "auto"], balasRafaga: 3, cargador: 30, recamara: true, recargaTactica: 2.2, recargaVacia: 2.9, preparacion: 0.45 }, dispersion: disp(0.6, 0.3, 4, true), retroceso: ret(0.8, 0.4, 25, [[0.7, 0], [0.8, 0.1], [0.9, 0.2], [0.9, -0.1], [1, -0.25]]), caida: caida(60, 250, 0.7), alcance: 400, masa: 3.3, ranuras: ["mira", "boca", "culata", "empunadura", "cargador", "linterna"] },
  { calibre: "5.45x39", categoria: "fusil", arma: { id: "fusil-545", cadencia: 650, modos: ["semi", "auto"], cargador: 30, recamara: true, recargaTactica: 2.4, recargaVacia: 3.1, preparacion: 0.45 }, dispersion: disp(0.65, 0.3, 4, true), retroceso: ret(0.75, 0.35, 26, [[0.6, 0], [0.7, 0.15], [0.8, 0.25], [0.8, 0.3]]), caida: caida(60, 250, 0.7), alcance: 400, masa: 3.4, ranuras: ["mira", "boca", "culata", "empunadura", "cargador"] },
  { calibre: "7.62x39", categoria: "fusil", arma: { id: "fusil-762c", cadencia: 600, modos: ["semi", "auto"], cargador: 30, recamara: true, recargaTactica: 2.5, recargaVacia: 3.2, preparacion: 0.5 }, dispersion: disp(0.75, 0.45, 4.5, true), retroceso: ret(1.3, 0.6, 22, [[1.1, 0.1], [1.2, 0.3], [1.3, -0.2], [1.3, 0.4]]), caida: caida(50, 200, 0.65), alcance: 350, masa: 3.6, ranuras: ["mira", "boca", "culata", "cargador"] },
  { calibre: "7.62x51", categoria: "batalla", arma: { id: "batalla-762", cadencia: 650, modos: ["semi", "auto"], cargador: 20, recamara: true, recargaTactica: 2.6, recargaVacia: 3.4, preparacion: 0.55 }, dispersion: disp(0.55, 0.6, 5, true), retroceso: ret(2, 0.8, 20), caida: caida(80, 400, 0.75), alcance: 600, masa: 4.4, ranuras: ["mira", "boca", "culata", "empunadura"] },
  { calibre: "7.62x51", categoria: "tirador", arma: { id: "tirador-762", cadencia: 300, modos: ["semi"], cargador: 10, recamara: true, recargaTactica: 2.5, recargaVacia: 3.1, preparacion: 0.6 }, dispersion: disp(0.15, 0.6, 3, true), retroceso: ret(2.4, 0.6, 18), caida: caida(150, 600, 0.8), alcance: 800, masa: 4.8, ranuras: ["mira", "boca", "culata", "bipode"] },
  { calibre: "7.62x54r", categoria: "francotirador", arma: { id: "cerrojo-762l", cadencia: 50, modos: ["cerrojo"], accion: 1.1, cargador: 5, recargaTactica: 3, recargaVacia: 3.8, porCartucho: 0.55, preparacion: 0.6 }, dispersion: disp(0.05, 0, 2, true), retroceso: ret(3.5, 0.5, 14), caida: caida(250, 800, 0.85), alcance: 1000, masa: 4.5, ranuras: ["mira", "boca", "bipode"] },
  { calibre: ".338lm", categoria: "francotirador", arma: { id: "cerrojo-338", cadencia: 45, modos: ["cerrojo"], accion: 1.3, cargador: 5, recargaTactica: 3.2, recargaVacia: 4, preparacion: 0.7 }, dispersion: disp(0.04, 0, 2, true), retroceso: ret(4.5, 0.6, 12), caida: caida(400, 1400, 0.85), alcance: 1500, masa: 6.8, ranuras: ["mira", "boca", "bipode"] },
  { calibre: "12.7x99", categoria: "antimaterial", arma: { id: "antimaterial-50", cadencia: 90, modos: ["semi"], cargador: 10, recamara: true, recargaTactica: 3.6, recargaVacia: 4.4, preparacion: 1 }, dispersion: disp(0.08, 1, 3, true), retroceso: ret(6, 1, 10), caida: caida(600, 1800, 0.9), alcance: 1800, masa: 13, ranuras: ["mira", "bipode"] },
  { calibre: "12ga-posta", categoria: "escopeta", arma: { id: "escopeta-corredera", cadencia: 70, modos: ["semi"], accion: 0.55, perdigones: 9, cargador: 6, recargaTactica: 0, recargaVacia: 0, porCartucho: 0.5, preparacion: 0.45 }, dispersion: disp(3.5, 0.5, 6), retroceso: ret(4, 1, 16), caida: caida(8, 35, 0.2), alcance: 40, masa: 3.6, ranuras: ["mira", "culata", "linterna"] },
  { calibre: "12ga-posta", categoria: "escopeta", arma: { id: "escopeta-semi", cadencia: 240, modos: ["semi"], perdigones: 9, cargador: 8, recargaTactica: 0, recargaVacia: 0, porCartucho: 0.45, preparacion: 0.5 }, dispersion: disp(3.8, 0.8, 7), retroceso: ret(3.6, 1.2, 18), caida: caida(8, 35, 0.2), alcance: 40, masa: 3.8, ranuras: ["mira", "culata"] },
  { calibre: "5.56x45", categoria: "ametralladora", arma: { id: "ametralladora-556", cadencia: 750, modos: ["auto"], cargador: 100, recargaTactica: 6, recargaVacia: 6.5, preparacion: 0.9, calentamiento: 0 }, dispersion: disp(1.2, 0.25, 6), retroceso: ret(0.9, 0.7, 18), caida: caida(70, 300, 0.7), alcance: 600, masa: 7.5, ranuras: ["mira", "bipode"] },
];

export interface Accesorio {
  readonly id: string;
  readonly ranura: string;
  /** Multiplicadores (1 = sin cambio) sobre retroceso, dispersión, tiempo de preparación, recarga y alcance. */
  readonly retroceso?: number;
  readonly dispersion?: number;
  readonly preparacion?: number;
  readonly recarga?: number;
  readonly alcance?: number;
  /** Cargador: balas extra. Boca: silenciado (el juego baja el ruido). */
  readonly cargadorExtra?: number;
  readonly silenciador?: boolean;
  readonly masa?: number;
}

export const ACCESORIOS: readonly Accesorio[] = [
  { id: "mira-punto-rojo", ranura: "mira", preparacion: 0.95, masa: 0.15 },
  { id: "mira-4x", ranura: "mira", dispersion: 0.85, preparacion: 1.15, masa: 0.4 },
  { id: "mira-francotirador", ranura: "mira", dispersion: 0.7, preparacion: 1.3, masa: 0.7 },
  { id: "compensador", ranura: "boca", retroceso: 0.82, masa: 0.1 },
  { id: "silenciador", ranura: "boca", retroceso: 0.9, alcance: 0.9, silenciador: true, masa: 0.4 },
  { id: "culata-ajustable", ranura: "culata", retroceso: 0.88, preparacion: 1.05, masa: 0.3 },
  { id: "empunadura-vertical", ranura: "empunadura", retroceso: 0.9, dispersion: 0.92, masa: 0.15 },
  { id: "cargador-ampliado", ranura: "cargador", cargadorExtra: 10, recarga: 1.12, masa: 0.3 },
  { id: "bipode", ranura: "bipode", retroceso: 0.6, preparacion: 1.2, masa: 0.5 },
  { id: "linterna-tactica", ranura: "linterna", masa: 0.1 },
];

/** Aplica accesorios (uno por ranura, en orden; ignora los que no entran) y devuelve una ficha nueva. */
export function aplicarAccesorios(f: FichaArma, ids: readonly string[], catalogo: readonly Accesorio[] = ACCESORIOS): FichaArma & { silenciada: boolean; accesorios: string[] } {
  const usados = new Map<string, Accesorio>();
  for (const id of ids) {
    const a = catalogo.find((x) => x.id === id);
    if (a && f.ranuras.includes(a.ranura) && !usados.has(a.ranura)) usados.set(a.ranura, a);
  }
  let r = 1, d = 1, p = 1, rec = 1, al = 1, extra = 0, masa = f.masa, sil = false;
  for (const a of usados.values()) {
    r *= a.retroceso ?? 1;
    d *= a.dispersion ?? 1;
    p *= a.preparacion ?? 1;
    rec *= a.recarga ?? 1;
    al *= a.alcance ?? 1;
    extra += a.cargadorExtra ?? 0;
    masa += a.masa ?? 0;
    sil ||= !!a.silenciador;
  }
  return {
    ...f,
    arma: { ...f.arma, cargador: f.arma.cargador + extra, preparacion: (f.arma.preparacion ?? 0) * p, recargaTactica: f.arma.recargaTactica * rec, recargaVacia: f.arma.recargaVacia * rec, porCartucho: f.arma.porCartucho !== undefined ? f.arma.porCartucho * rec : undefined },
    dispersion: { ...f.dispersion, base: f.dispersion.base * d, maxima: f.dispersion.maxima * d },
    retroceso: { ...f.retroceso, vertical: f.retroceso.vertical * r, horizontal: f.retroceso.horizontal * r, patron: f.retroceso.patron?.map(([a, b]) => [a * r, b * r] as const) },
    alcance: f.alcance * al,
    masa,
    silenciada: sil,
    accesorios: [...usados.values()].map((a) => a.id),
  };
}

export const ficha = (id: string): FichaArma => {
  const f = ARMAS.find((x) => x.arma.id === id);
  if (!f) throw new Error(`Arma desconocida: ${id}`);
  return f;
};
