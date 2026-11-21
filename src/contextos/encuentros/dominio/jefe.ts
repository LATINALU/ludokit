// Jefe configurable por datos: un REPERTORIO de ataques con pesos y FASES por vida (cada fase cambia el ritmo, acorta
// los avisos y suma ataques). Ciclo: intro → pausa → AVISO (telegrafiado) → ATAQUE → pausa (o aturdido si se
// estrelló). Nunca repite el mismo ataque dos veces seguidas si hay alternativas, y cada ataque puede tener su
// propia recarga. El jefe no se mueve aquí: emite eventos y la capa de juego ejecuta el patrón (carga, salto,
// lluvia, radial, rayo, invocar...). Sirve para jefes de acción, de bullet hell y hasta de juegos por turnos.

import type { Azar } from "../../../nucleo/azar.ts";

export interface AtaqueJefe {
  readonly id: string;
  /** Patrón que interpreta el juego ("carga", "salto", "lluvia", "radial", "rayo", "invocar"...). */
  readonly patron: string;
  readonly peso?: number;
  /** Duración del aviso antes de ejecutarse (s). */
  readonly aviso: number;
  /** Cuánto dura la ejecución hasta la pausa siguiente (s). */
  readonly duracion: number;
  readonly pausa?: number;
  /** Recarga propia del ataque (s). */
  readonly recarga?: number;
  readonly mult?: number;
  /** Solo disponible desde esta fase (0 = siempre). */
  readonly desdeFase?: number;
  /** Datos libres para el juego (cantidad de proyectiles, radio...). */
  readonly datos?: Readonly<Record<string, number | string>>;
}

export interface FaseJefe {
  /** La fase empieza cuando la vida baja a esta fracción (1 = desde el inicio). */
  readonly desdeVida: number;
  /** Multiplicador de velocidad de todo el ciclo (pausas, avisos). */
  readonly rapidez: number;
  /** Multiplicador extra del aviso (< 1 = avisos más cortos). */
  readonly multAviso?: number;
  readonly nombre?: string;
}

export interface DefJefe {
  readonly id: string;
  readonly ataques: readonly AtaqueJefe[];
  readonly fases: readonly FaseJefe[];
  readonly intro?: number;
  readonly pausaBase?: number;
}

export type EstadoJefe = "intro" | "pausa" | "aviso" | "ataque" | "aturdido" | "vencido";

export type EventoJefe =
  | { readonly tipo: "fase"; readonly fase: number; readonly nombre?: string }
  | { readonly tipo: "aviso"; readonly ataque: AtaqueJefe; readonly duracion: number }
  | { readonly tipo: "ataque"; readonly ataque: AtaqueJefe; readonly mult: number }
  | { readonly tipo: "fin-ataque"; readonly ataque: AtaqueJefe }
  | { readonly tipo: "aturdido"; readonly duracion: number }
  | { readonly tipo: "vencido" };

export class CerebroJefe {
  readonly def: DefJefe;
  estado: EstadoJefe = "intro";
  fase = 0;
  actual: AtaqueJefe | null = null;
  private t: number;
  private ultimo: string | null = null;
  private readonly recargas = new Map<string, number>();
  private readonly azar: Azar;

  constructor(def: DefJefe, azar: Azar) {
    if (def.fases.length === 0) throw new Error("Jefe sin fases");
    this.def = def;
    this.azar = azar;
    this.t = def.intro ?? 1.5;
  }

  get faseActual(): FaseJefe {
    return this.def.fases[this.fase];
  }

  /** 0..1 dentro del estado (para animar la anticipación del aviso). */
  get restante(): number {
    return this.t;
  }

  /** Disponibles en la fase actual, sin recarga, sin repetir el último si hay otra opción. */
  disponibles(): AtaqueJefe[] {
    const ok = this.def.ataques.filter((a) => (a.desdeFase ?? 0) <= this.fase && (this.recargas.get(a.id) ?? 0) <= 0);
    const sinRepetir = ok.filter((a) => a.id !== this.ultimo);
    return sinRepetir.length > 0 ? sinRepetir : ok;
  }

  private elegir(): AtaqueJefe | null {
    const lista = this.disponibles();
    if (lista.length === 0) return null;
    const total = lista.reduce((s, a) => s + (a.peso ?? 1), 0);
    let r = this.azar.siguiente() * total;
    for (const a of lista) {
      r -= a.peso ?? 1;
      if (r < 0) return a;
    }
    return lista[lista.length - 1];
  }

  /** El ataque se estrelló (carga contra la pared): queda aturdido, ventana de castigo. */
  aturdir(seg = 0.8): EventoJefe[] {
    if (this.estado === "vencido") return [];
    this.estado = "aturdido";
    this.t = seg;
    return [{ tipo: "aturdido", duracion: seg }];
  }

  /** `vida` = fracción 0..1 actual. */
  actualizar(dt: number, vida: number): EventoJefe[] {
    const ev: EventoJefe[] = [];
    if (this.estado === "vencido") return ev;
    if (vida <= 0) {
      this.estado = "vencido";
      ev.push({ tipo: "vencido" });
      return ev;
    }
    // Cambios de fase (pueden saltarse varias si un golpe enorme baja mucho la vida).
    while (this.fase + 1 < this.def.fases.length && vida <= this.def.fases[this.fase + 1].desdeVida) {
      this.fase++;
      ev.push({ tipo: "fase", fase: this.fase, nombre: this.faseActual.nombre });
    }
    const rap = this.faseActual.rapidez;
    for (const [k, v] of this.recargas) this.recargas.set(k, v - dt);
    this.t -= dt * rap;
    if (this.t > 0) return ev;
    switch (this.estado) {
      case "intro":
      case "pausa":
      case "aturdido": {
        const a = this.elegir();
        if (!a) {
          this.t = 0.2;
          break;
        }
        this.actual = a;
        this.estado = "aviso";
        const dur = a.aviso * (this.faseActual.multAviso ?? 1);
        this.t = dur;
        ev.push({ tipo: "aviso", ataque: a, duracion: dur / rap });
        break;
      }
      case "aviso": {
        const a = this.actual!;
        this.estado = "ataque";
        this.t = a.duracion;
        this.ultimo = a.id;
        if (a.recarga) this.recargas.set(a.id, a.recarga);
        ev.push({ tipo: "ataque", ataque: a, mult: a.mult ?? 1 });
        break;
      }
      case "ataque": {
        const a = this.actual!;
        this.estado = "pausa";
        this.t = a.pausa ?? this.def.pausaBase ?? 0.8;
        ev.push({ tipo: "fin-ataque", ataque: a });
        break;
      }
    }
    return ev;
  }
}
