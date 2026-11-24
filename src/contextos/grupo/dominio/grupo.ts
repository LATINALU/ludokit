// Juego en grupo (MMO, cooperativo, mazmorras y bandas):
//   - `Grupo`: líder, miembros con ROL (tanque, sanador, daño...) y composición requerida; buscador de grupo que
//     arma equipos desde una cola respetando los roles.
//   - REPARTO DE BOTÍN: libre, por turnos, maestro (decide el líder), necesidad/codicia/pasar con tiradas 1-100
//     (necesidad gana a codicia) y botín personal (cada uno tira lo suyo).
//   - BLOQUEOS por reinicio periódico (bandas semanales, jefes diarios): puede saquear una vez por período.
//   - CONTRIBUCIÓN: quién tiene derecho al botín/experiencia de un enemigo según el daño hecho (etiquetado) — evita
//     que alguien "robe" la presa con el último golpe.

import type { Azar } from "../../../nucleo/azar.ts";

export interface Miembro {
  readonly id: number;
  readonly rol: string;
  /** Roles que puede cubrir (para el buscador). */
  readonly roles?: readonly string[];
}

export class Grupo {
  readonly maximo: number;
  lider: number;
  readonly miembros: Miembro[] = [];

  constructor(lider: Miembro, maximo: number) {
    this.maximo = maximo;
    this.lider = lider.id;
    this.miembros.push(lider);
  }

  unir(m: Miembro): boolean {
    if (this.miembros.length >= this.maximo || this.miembros.some((x) => x.id === m.id)) return false;
    this.miembros.push(m);
    return true;
  }

  salir(id: number): void {
    const i = this.miembros.findIndex((m) => m.id === id);
    if (i < 0) return;
    this.miembros.splice(i, 1);
    if (this.lider === id && this.miembros.length) this.lider = this.miembros[0].id;
  }

  cuenta(rol: string): number {
    return this.miembros.filter((m) => m.rol === rol).length;
  }

  /** Roles que faltan según la composición pedida (p. ej. {tanque:1, sanador:1, danio:3}). */
  faltantes(composicion: Readonly<Record<string, number>>): Record<string, number> {
    const r: Record<string, number> = {};
    for (const [rol, n] of Object.entries(composicion)) if (this.cuenta(rol) < n) r[rol] = n - this.cuenta(rol);
    return r;
  }
}

/**
 * Buscador de grupo: arma grupos completos desde una cola (en orden de llegada) según la composición. Cada jugador
 * puede ofrecer varios roles; se asignan primero los roles más escasos.
 */
export function armarGrupos(cola: readonly Miembro[], composicion: Readonly<Record<string, number>>): { grupos: Miembro[][]; resto: Miembro[] } {
  const pendientes = [...cola];
  const grupos: Miembro[][] = [];
  const tamano = Object.values(composicion).reduce((s, v) => s + v, 0);
  const rolesOrden = Object.keys(composicion).sort((a, b) => pendientes.filter((m) => (m.roles ?? [m.rol]).includes(a)).length - pendientes.filter((m) => (m.roles ?? [m.rol]).includes(b)).length);
  for (;;) {
    const elegidos: Miembro[] = [];
    const usados = new Set<number>();
    for (const rol of rolesOrden) {
      for (let k = 0; k < composicion[rol]; k++) {
        const m = pendientes.find((x) => !usados.has(x.id) && (x.roles ?? [x.rol]).includes(rol));
        if (!m) break;
        usados.add(m.id);
        elegidos.push({ ...m, rol });
      }
    }
    if (elegidos.length < tamano) break;
    grupos.push(elegidos);
    for (let i = pendientes.length - 1; i >= 0; i--) if (usados.has(pendientes[i].id)) pendientes.splice(i, 1);
  }
  return { grupos, resto: pendientes };
}

// ---------------------------------------------------------------- Reparto de botín

export type Eleccion = "necesidad" | "codicia" | "pasar";

/** Necesidad/codicia: gana la mayor tirada dentro de la mejor categoría elegida. Devuelve ganador y tiradas. */
export function repartirPorTirada(elecciones: ReadonlyMap<number, Eleccion>, azar: Azar): { ganador: number | null; tiradas: Map<number, number> } {
  const tiradas = new Map<number, number>();
  for (const cat of ["necesidad", "codicia"] as const) {
    const quienes = [...elecciones].filter(([, e]) => e === cat).map(([id]) => id);
    if (!quienes.length) continue;
    let ganador = quienes[0], mejor = -1;
    for (const id of quienes) {
      const t = 1 + Math.floor(azar.siguiente() * 100);
      tiradas.set(id, t);
      if (t > mejor) { mejor = t; ganador = id; }
    }
    return { ganador, tiradas };
  }
  return { ganador: null, tiradas };
}

/** Por turnos: cada objeto al siguiente de la lista (estado = índice guardable). */
export function repartirPorTurno(miembros: readonly number[], estado: { indice: number }): number {
  const id = miembros[estado.indice % miembros.length];
  estado.indice = (estado.indice + 1) % miembros.length;
  return id;
}

/** Botín personal: cada miembro tira su propia tabla (con su propia probabilidad). */
export function botinPersonal<T>(miembros: readonly number[], tirar: (id: number) => T[]): Map<number, T[]> {
  return new Map(miembros.map((id) => [id, tirar(id)]));
}

// ---------------------------------------------------------------- Bloqueos por período

export class Bloqueos {
  /** Período en ms y desplazamiento del reinicio (p. ej. miércoles 9:00). */
  readonly periodo: number;
  readonly origen: number;
  private readonly usados = new Map<string, number>();

  constructor(periodoMs: number, origenMs = 0) {
    this.periodo = periodoMs;
    this.origen = origenMs;
  }

  periodoDe(ahora: number): number {
    return Math.floor((ahora - this.origen) / this.periodo);
  }

  proximoReinicio(ahora: number): number {
    return this.origen + (this.periodoDe(ahora) + 1) * this.periodo;
  }

  /** ¿Puede `jugador` saquear `encuentro` en este período? */
  disponible(jugador: number, encuentro: string, ahora: number): boolean {
    return this.usados.get(`${jugador}/${encuentro}`) !== this.periodoDe(ahora);
  }

  marcar(jugador: number, encuentro: string, ahora: number): boolean {
    if (!this.disponible(jugador, encuentro, ahora)) return false;
    this.usados.set(`${jugador}/${encuentro}`, this.periodoDe(ahora));
    return true;
  }
}

// ---------------------------------------------------------------- Contribución

/** Registro de daño por atacante sobre un enemigo; reparte crédito por fracción mínima. */
export class Contribucion {
  private readonly danio = new Map<number, number>();
  private total = 0;
  primero: number | null = null;

  registrar(atacante: number, cantidad: number): void {
    if (cantidad <= 0) return;
    if (this.primero === null) this.primero = atacante;
    this.danio.set(atacante, (this.danio.get(atacante) ?? 0) + cantidad);
    this.total += cantidad;
  }

  /** Quiénes tienen crédito (≥ `minimo` del daño total) y su fracción. */
  credito(minimo = 0.1): Map<number, number> {
    const r = new Map<number, number>();
    if (this.total <= 0) return r;
    for (const [id, d] of this.danio) if (d / this.total >= minimo) r.set(id, d / this.total);
    return r;
  }
}
