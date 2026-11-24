// Encuentros por oleadas (arenas, hordas, defensa de un punto, desafíos opcionales):
//   - VARIANTE por datos (oleadas, enemigos base y por oleada, política de élites, reloj, premio) elegida por peso y
//     desbloqueada por nivel, determinista por la semilla de la sala.
//   - CONTRARRELOJ opcional: completar una oleada suma tiempo (más por cada oleada ya hecha).
//   - ANTI-BLOQUEO: si pasan N s sin bajas con enemigos vivos, se los acerca al jugador; si pasan M s, se retiran
//     (nunca una arena imposible de terminar porque un enemigo quedó trabado).
//   - PREMIO con SELLOS de mérito (sin recibir golpes, pocos golpes, a tiempo / tarde) y RACHA de encuentros
//     seguidos; los sellos son códigos (el texto lo pone el juego).

import { Pcg32 } from "../../../nucleo/pcg32.ts";
import { evaluar, type Curva } from "../../../nucleo/escalado.ts";

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


const val = (v: number | ((n: number) => number) | undefined, n: number, def = 0): number => (v === undefined ? def : typeof v === "number" ? v : v(n));

/** Variante determinista por semilla entre las desbloqueadas en `nivel`. */
export function varianteParaSala(semilla: number, nivel: number, lista: readonly VarianteOleadas[]): VarianteOleadas {
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

export type Sello = "intocable" | "pocos-golpes" | "a-tiempo" | "tarde" | "racha";

export interface PremioEncuentro {
  readonly cofre: number;
  readonly pieza: number;
  readonly moneda: number;
  /** Códigos de mérito: el juego los traduce a texto (i18n) y decide cómo mostrarlos. */
  readonly sellos: ReadonlyArray<{ readonly sello: Sello; readonly bueno: boolean; readonly valor?: number }>;
  readonly racha: number;
}

export interface ReglasPremio {
  /** Grado de cofre base según el nivel y su tope. */
  readonly cofre: Curva;
  readonly cofreMax: number;
  /** Rareza mínima de la pieza por defecto y su tope (rareza más alta del juego). */
  readonly pieza: number;
  readonly piezaMax: number;
  readonly moneda: Curva;
  /** Sin golpes: +cofre y +rareza. Pocos golpes (≤ umbral): × moneda. */
  readonly pocosGolpes: number;
  readonly multPocosGolpes: number;
  /** Racha: +porRacha por encuentro seguido, hasta +maxRacha. */
  readonly porRacha: number;
  readonly maxRacha: number;
}

/** Premio con sellos de mérito. `rachaPrevia`: encuentros seguidos completados antes de este. */
export function premioEncuentro(e: EncuentroOleadas, aTiempo: boolean, rachaPrevia: number, r: ReglasPremio): PremioEncuentro {
  const v = e.variante;
  let cofre = (v.cofre ?? 0) + Math.round(evaluar(r.cofre, e.nivel));
  let pieza = v.pieza ?? r.pieza;
  let moneda = v.moneda ? v.moneda(e.nivel) : Math.round(evaluar(r.moneda, e.nivel));
  const sellos: Array<{ sello: Sello; bueno: boolean; valor?: number }> = [];
  if (e.golpesRecibidos === 0) {
    cofre++;
    pieza = Math.min(r.piezaMax, pieza + 1);
    sellos.push({ sello: "intocable", bueno: true });
  } else if (e.golpesRecibidos <= r.pocosGolpes) {
    moneda = Math.round(moneda * r.multPocosGolpes);
    sellos.push({ sello: "pocos-golpes", bueno: true, valor: r.multPocosGolpes });
  }
  if (e.tiempoTotal > 0) {
    if (aTiempo) {
      cofre++;
      sellos.push({ sello: "a-tiempo", bueno: true });
    } else {
      cofre--;
      pieza = -1;
      sellos.push({ sello: "tarde", bueno: false });
    }
  }
  const racha = rachaPrevia + 1;
  if (racha >= 2) {
    moneda = Math.round(moneda * (1 + Math.min(r.maxRacha, (racha - 1) * r.porRacha)));
    sellos.push({ sello: "racha", bueno: true, valor: racha });
  }
  return { cofre: Math.max(0, Math.min(r.cofreMax, cofre)), pieza, moneda, sellos, racha };
}

export interface ReglasDureza {
  readonly vida: Curva;
  readonly danio: Curva;
  /** Enemigos extra por oleada. */
  readonly extra: Curva;
  /** Probabilidad de que un enemigo sea élite (recortar con `curva.limitar`). */
  readonly probElite: Curva;
}

/** Escalado por nivel de los enemigos de un encuentro (sin tope: todo son curvas). */
export const durezaEncuentro = (nivel: number, r: ReglasDureza): { vida: number; danio: number; extra: number; probElite: number } => ({
  vida: evaluar(r.vida, nivel),
  danio: evaluar(r.danio, nivel),
  extra: Math.max(0, Math.floor(evaluar(r.extra, nivel))),
  probElite: Math.min(1, Math.max(0, evaluar(r.probElite, nivel))),
});
