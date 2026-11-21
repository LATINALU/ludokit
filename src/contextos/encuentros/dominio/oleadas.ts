// Encuentros por oleadas (arenas, hordas, defensa de un punto, desafíos opcionales):
//   - VARIANTE por datos (oleadas, enemigos base y por oleada, política de élites, reloj, premio) elegida por peso y
//     desbloqueada por nivel, determinista por la semilla de la sala.
//   - CONTRARRELOJ opcional: completar una oleada suma tiempo (más por cada oleada ya hecha).
//   - ANTI-BLOQUEO: si pasan N s sin bajas con enemigos vivos, se los acerca al jugador; si pasan M s, se retiran
//     (nunca una arena imposible de terminar porque un enemigo quedó trabado).
//   - PREMIO con SELLOS de mérito (sin recibir golpes, pocos golpes, a tiempo / tarde) y RACHA de arenas seguidas.

import { Pcg32 } from "../../../nucleo/pcg32.ts";

export type PoliticaElites = "ninguna" | "ultimo" | "todos" | "campeon";

export interface VarianteOleadas {
  readonly id: string;
  readonly nombre: string;
  readonly regla: string;
  readonly desde: number;
  readonly peso: number;
  readonly oleadas: number | ((nivel: number) => number);
  readonly enemigosBase: number | ((nivel: number) => number);
  readonly enemigosPorOleada: number;
  readonly elites: PoliticaElites;
  /** Segundos de reloj (0 = sin reloj). Puede depender del nivel. */
  readonly tiempo?: number | ((nivel: number) => number);
  readonly dificultad?: number;
  readonly cofre?: number;
  /** Rareza mínima de la pieza de premio (-1 = sin pieza). */
  readonly pieza?: number;
  readonly moneda?: (nivel: number) => number;
}

export const VARIANTES_EJEMPLO: readonly VarianteOleadas[] = [
  { id: "creciente", nombre: "Oleadas crecientes", regla: "Oleadas que crecen; un campeón cierra la última.", desde: 1, peso: 1.2, oleadas: (n) => 2 + Math.floor(n / 6), enemigosBase: (n) => 3 + Math.floor(n / 4), enemigosPorOleada: 1, elites: "ultimo", moneda: (n) => 10 * n },
  { id: "contrarreloj", nombre: "Contrarreloj", regla: "Limpia 3 oleadas antes de que se acabe el tiempo.", desde: 2, peso: 1, oleadas: 3, enemigosBase: (n) => 2 + Math.floor(n / 4), enemigosPorOleada: 1, elites: "ultimo", tiempo: (n) => 90 + Math.min(60, n * 4), moneda: (n) => 10 * n },
  { id: "elite", nombre: "Foso de élites", regla: "Pocos rivales, todos élites. Premio mejorado.", desde: 3, peso: 0.9, oleadas: 2, enemigosBase: (n) => 2 + Math.floor(n / 8), enemigosPorOleada: 0, elites: "todos", cofre: 1, pieza: 3, moneda: (n) => 15 * n },
  { id: "marea", nombre: "La marea", regla: "Cuatro oleadas numerosas. Mucha moneda.", desde: 4, peso: 0.8, oleadas: 4, enemigosBase: (n) => 5 + Math.floor(n / 4), enemigosPorOleada: 1, elites: "ultimo", moneda: (n) => 40 * n },
];

const val = (v: number | ((n: number) => number) | undefined, n: number, def = 0): number => (v === undefined ? def : typeof v === "number" ? v : v(n));

/** Variante determinista por semilla entre las desbloqueadas en `nivel`. */
export function varianteParaSala(semilla: number, nivel: number, lista: readonly VarianteOleadas[] = VARIANTES_EJEMPLO): VarianteOleadas {
  const pool = lista.filter((v) => nivel >= v.desde);
  const az = new Pcg32(semilla ^ 0x5a17);
  const total = pool.reduce((s, v) => s + v.peso, 0);
  let r = az.siguiente() * total;
  for (const v of pool) {
    r -= v.peso;
    if (r < 0) return v;
  }
  return pool[pool.length - 1];
}

export type EventoOleadas =
  | { readonly tipo: "oleada"; readonly numero: number; readonly enemigos: number; readonly elites: number; readonly ultima: boolean }
  | { readonly tipo: "tiempo-extra"; readonly segundos: number }
  | { readonly tipo: "acercar" }
  | { readonly tipo: "retirar" }
  | { readonly tipo: "fin"; readonly aTiempo: boolean };

export interface ReglasOleadas {
  readonly acercarTras: number;
  readonly retirarTras: number;
  readonly esperaEntreOleadas: number;
  readonly tiempoPorOleada: number;
  readonly tiempoExtraPorOleadaHecha: number;
}

export const REGLAS_OLEADAS: ReglasOleadas = { acercarTras: 25, retirarTras: 45, esperaEntreOleadas: 1, tiempoPorOleada: 24, tiempoExtraPorOleadaHecha: 2 };

export class EncuentroOleadas {
  readonly variante: VarianteOleadas;
  readonly nivel: number;
  readonly totalOleadas: number;
  oleada = 0;
  tiempo: number;
  tiempoTotal: number;
  golpesRecibidos = 0;
  terminado = false;
  private espera = 0;
  private sinProgreso = 0;
  private vivosPrevios = 0;
  private acercado = false;
  private readonly r: ReglasOleadas;

  constructor(variante: VarianteOleadas, nivel: number, r: ReglasOleadas = REGLAS_OLEADAS) {
    this.variante = variante;
    this.nivel = nivel;
    this.totalOleadas = Math.max(1, Math.round(val(variante.oleadas, nivel, 1)));
    this.tiempo = this.tiempoTotal = val(variante.tiempo, nivel, 0);
    this.r = r;
  }

  enemigosDeOleada(n: number): number {
    return Math.max(1, Math.round(val(this.variante.enemigosBase, this.nivel, 1)) + this.variante.enemigosPorOleada * n);
  }

  private elitesDeOleada(enemigos: number, ultima: boolean): number {
    switch (this.variante.elites) {
      case "todos":
        return enemigos;
      case "ultimo":
      case "campeon":
        return ultima ? 1 : 0;
      default:
        return 0;
    }
  }

  /** Llamar cada paso con la cantidad de enemigos vivos del encuentro. */
  actualizar(dt: number, vivos: number): EventoOleadas[] {
    const ev: EventoOleadas[] = [];
    if (this.terminado) return ev;
    if (this.tiempoTotal > 0) {
      this.tiempo -= dt;
      if (this.tiempo <= 0) {
        if (vivos > 0) ev.push({ tipo: "retirar" });
        this.terminado = true;
        ev.push({ tipo: "fin", aTiempo: false });
        return ev;
      }
    }
    if (vivos > 0) {
      if (vivos < this.vivosPrevios) {
        this.sinProgreso = 0;
        this.acercado = false;
      } else this.sinProgreso += dt;
      this.vivosPrevios = vivos;
      if (this.sinProgreso >= this.r.retirarTras) {
        ev.push({ tipo: "retirar" });
        this.sinProgreso = 0;
      } else if (this.sinProgreso >= this.r.acercarTras && !this.acercado) {
        this.acercado = true;
        ev.push({ tipo: "acercar" });
      }
      return ev;
    }
    this.vivosPrevios = 0;
    this.sinProgreso = 0;
    this.espera -= dt;
    if (this.espera > 0) return ev;
    if (this.oleada < this.totalOleadas) {
      if (this.tiempoTotal > 0 && this.oleada >= 1) {
        const extra = this.r.tiempoPorOleada + this.oleada * this.r.tiempoExtraPorOleadaHecha;
        this.tiempo += extra;
        this.tiempoTotal += extra;
        ev.push({ tipo: "tiempo-extra", segundos: extra });
      }
      this.oleada++;
      const ultima = this.oleada === this.totalOleadas;
      const n = this.enemigosDeOleada(this.oleada - 1);
      ev.push({ tipo: "oleada", numero: this.oleada, enemigos: n, elites: this.elitesDeOleada(n, ultima), ultima });
      this.espera = this.r.esperaEntreOleadas;
    } else {
      this.terminado = true;
      ev.push({ tipo: "fin", aTiempo: this.tiempoTotal <= 0 || this.tiempo > 0 });
    }
    return ev;
  }

  recibirGolpe(): void {
    this.golpesRecibidos++;
  }
}

export interface PremioEncuentro {
  readonly cofre: number;
  readonly pieza: number;
  readonly moneda: number;
  readonly sellos: ReadonlyArray<{ readonly texto: string; readonly bueno: boolean }>;
  readonly racha: number;
}

/** Premio con sellos de mérito. `rachaPrevia`: encuentros seguidos completados antes de este. */
export function premioEncuentro(e: EncuentroOleadas, aTiempo: boolean, rachaPrevia: number): PremioEncuentro {
  const v = e.variante;
  let cofre = (v.cofre ?? 0) + Math.min(3, 1 + Math.floor(e.nivel / 8));
  let pieza = v.pieza ?? 2;
  let moneda = v.moneda ? v.moneda(e.nivel) : 10 * e.nivel;
  const sellos: Array<{ texto: string; bueno: boolean }> = [];
  if (e.golpesRecibidos === 0) {
    cofre++;
    pieza = Math.min(5, pieza + 1);
    sellos.push({ texto: "Intocable: el cofre y la pieza mejoran", bueno: true });
  } else if (e.golpesRecibidos <= 3) {
    moneda = Math.round(moneda * 1.5);
    sellos.push({ texto: "Pocos rasguños: +50 % de moneda", bueno: true });
  }
  if (e.tiempoTotal > 0) {
    if (aTiempo) {
      cofre++;
      sellos.push({ texto: "¡A tiempo!: el cofre mejora", bueno: true });
    } else {
      cofre--;
      pieza = -1;
      sellos.push({ texto: "Tarde: se acabó el tiempo", bueno: false });
    }
  }
  const racha = rachaPrevia + 1;
  if (racha >= 2) {
    moneda = Math.round(moneda * (1 + Math.min(1, (racha - 1) * 0.25)));
    sellos.push({ texto: `Racha ×${racha}`, bueno: true });
  }
  return { cofre: Math.max(0, Math.min(3, cofre)), pieza, moneda, sellos, racha };
}

/** Escalado por nivel de los enemigos de un encuentro: +3,7 % vida y +1,75 % daño por nivel, uno más cada 8. */
export const durezaEncuentro = (nivel: number): { vida: number; danio: number; extra: number; probElite: number } => {
  const p = Math.max(0, nivel - 1);
  return { vida: 1 + p * 0.037, danio: 1 + p * 0.0175, extra: Math.floor(p / 8), probElite: Math.min(0.4, p * 0.017) };
};
