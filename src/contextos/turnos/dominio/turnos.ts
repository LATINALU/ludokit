// Combate por TURNOS (JRPG, táctico, roguelike, juegos de mesa):
//   - `OrdenIniciativa`: ronda clásica ordenada por iniciativa (velocidad + tirada), con empate estable.
//   - `ColaTiempo` (CTB/ATB): cada unidad acumula "carga" a su velocidad; actúa al llegar al umbral. Permite ver los
//     próximos N turnos (vista previa), retrasar/adelantar (habilidades de "prisa" y "lentitud") y acciones con
//     costo de carga distinto (acción rápida vs. pesada).
//   - PUNTOS DE ACCIÓN por turno (táctico): moverse y actuar cuestan PA; lo que sobra puede guardarse con tope.
//   - ALCANCE en grilla con costos de terreno (Dijkstra) para mostrar casillas alcanzables; LÍNEA de visión y
//     probabilidad de impacto con cobertura (media/total) y flanqueo.

import type { Azar } from "../../../nucleo/azar.ts";

export interface Combatiente {
  readonly id: number;
  readonly velocidad: number;
}

/** Orden de una ronda: velocidad + tirada (0..`variacion`), desempate por id. */
export function ordenIniciativa(cs: readonly Combatiente[], azar?: Azar, variacion = 0): number[] {
  return cs
    .map((c) => ({ id: c.id, v: c.velocidad + (azar && variacion > 0 ? azar.siguiente() * variacion : 0) }))
    .sort((a, b) => b.v - a.v || a.id - b.id)
    .map((x) => x.id);
}

export class ColaTiempo {
  private readonly carga = new Map<number, number>();
  private readonly vel = new Map<number, number>();
  readonly umbral: number;

  constructor(cs: readonly Combatiente[], umbral = 100) {
    this.umbral = umbral;
    for (const c of cs) {
      this.carga.set(c.id, 0);
      this.vel.set(c.id, Math.max(1e-6, c.velocidad));
    }
  }

  agregar(c: Combatiente, carga = 0): void {
    this.carga.set(c.id, carga);
    this.vel.set(c.id, Math.max(1e-6, c.velocidad));
  }

  quitar(id: number): void {
    this.carga.delete(id);
    this.vel.delete(id);
  }

  cambiarVelocidad(id: number, v: number): void {
    if (this.vel.has(id)) this.vel.set(id, Math.max(1e-6, v));
  }

  /** Adelanta (+) o retrasa (−) a una unidad en fracción del umbral. */
  empujar(id: number, fraccion: number): void {
    const c = this.carga.get(id);
    if (c !== undefined) this.carga.set(id, Math.max(0, c + fraccion * this.umbral));
  }

  private tiempoHasta(id: number, carga: number): number {
    return Math.max(0, (this.umbral - carga) / this.vel.get(id)!);
  }

  /** Avanza el tiempo hasta que alguien actúa; devuelve su id. `costo` 1 = acción normal (gasta el umbral entero). */
  siguiente(): number | null {
    let mejor: number | null = null, t = Infinity;
    for (const [id, c] of this.carga) {
      const tt = this.tiempoHasta(id, c);
      if (tt < t || (tt === t && mejor !== null && id < mejor)) {
        t = tt;
        mejor = id;
      }
    }
    if (mejor === null) return null;
    for (const [id, c] of this.carga) this.carga.set(id, c + this.vel.get(id)! * t);
    return mejor;
  }

  /** Tras actuar: gasta `costo` umbrales (0.5 = acción rápida, vuelve antes). */
  actuo(id: number, costo = 1): void {
    const c = this.carga.get(id);
    if (c !== undefined) this.carga.set(id, c - this.umbral * costo);
  }

  /** Próximos `n` turnos sin modificar el estado (vista previa de la interfaz). */
  previsualizar(n: number): number[] {
    const carga = new Map(this.carga);
    const r: number[] = [];
    while (r.length < n && carga.size) {
      let mejor = -1, t = Infinity;
      for (const [id, c] of carga) {
        const tt = Math.max(0, (this.umbral - c) / this.vel.get(id)!);
        if (tt < t || (tt === t && id < mejor)) { t = tt; mejor = id; }
      }
      for (const [id, c] of carga) carga.set(id, c + this.vel.get(id)! * t);
      carga.set(mejor, carga.get(mejor)! - this.umbral);
      r.push(mejor);
    }
    return r;
  }
}

/** Puntos de acción: se recargan al empezar el turno; sobrante guardable hasta `guardarMax`. */
export class PuntosAccion {
  actual = 0;
  readonly porTurno: number;
  readonly guardarMax: number;

  constructor(porTurno: number, guardarMax = 0) {
    this.porTurno = porTurno;
    this.guardarMax = guardarMax;
  }

  empezarTurno(): number {
    this.actual = Math.min(this.actual, this.guardarMax) + this.porTurno;
    return this.actual;
  }

  gastar(n: number): boolean {
    if (n > this.actual) return false;
    this.actual -= n;
    return true;
  }
}

/** Casillas alcanzables con `presupuesto` de movimiento. `costo(c,f)` = Infinity si no se puede pisar. */
export function alcanceGrilla(cols: number, filas: number, desde: readonly [number, number], presupuesto: number, costo: (c: number, f: number) => number, diagonal = false): Map<string, number> {
  const dist = new Map<string, number>([[`${desde[0]},${desde[1]}`, 0]]);
  const abiertos: Array<[number, number, number]> = [[0, desde[0], desde[1]]];
  const dirs = diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (abiertos.length) {
    abiertos.sort((a, b) => a[0] - b[0]);
    const [d, c, f] = abiertos.shift()!;
    if (d > (dist.get(`${c},${f}`) ?? Infinity)) continue;
    for (const [dx, dy] of dirs) {
      const nc = c + dx, nf = f + dy;
      if (nc < 0 || nf < 0 || nc >= cols || nf >= filas) continue;
      const k = costo(nc, nf) * (dx && dy ? Math.SQRT2 : 1);
      const nd = d + k;
      if (!Number.isFinite(k) || nd > presupuesto) continue;
      const clave = `${nc},${nf}`;
      if (nd < (dist.get(clave) ?? Infinity)) {
        dist.set(clave, nd);
        abiertos.push([nd, nc, nf]);
      }
    }
  }
  return dist;
}

export interface ReglasImpactoTactico {
  readonly base: number;
  /** Penalización por casilla de distancia más allá de `alcanceOptimo`. */
  readonly porDistancia: number;
  readonly alcanceOptimo: number;
  readonly coberturaMedia: number;
  readonly coberturaTotal: number;
  /** Bono por flanquear (ignora la cobertura). */
  readonly flanqueo: number;
  readonly min: number;
  readonly max: number;
}

/** Probabilidad de impacto táctica: base + puntería − distancia − cobertura (o + flanqueo), recortada. */
export function probImpactoTactico(r: ReglasImpactoTactico, punteria: number, distancia: number, cobertura: "ninguna" | "media" | "total", flanquea: boolean): number {
  let p = r.base + punteria - Math.max(0, distancia - r.alcanceOptimo) * r.porDistancia;
  if (flanquea) p += r.flanqueo;
  else p -= cobertura === "media" ? r.coberturaMedia : cobertura === "total" ? r.coberturaTotal : 0;
  return Math.min(r.max, Math.max(r.min, p));
}
