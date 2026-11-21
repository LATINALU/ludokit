// Logros con contadores y puente a plataformas (Steam, consolas, móviles):
//   - Un logro mide un EVENTO acumulado ("matar" ×100), un evento en un CONTEXTO ("jefe@nivel12"), o un REGISTRO que
//     solo sube (mejor nivel alcanzado, muertes totales).
//   - Los contadores son los mismos que usan las misiones y las estadísticas: una sola fuente de verdad.
//   - Funciona sin conexión: lo ganado queda pendiente y se sincroniza con la plataforma cuando está disponible.
//   - Progreso visible (barra 0..1) y categorías para la pantalla de logros.

export interface DefLogro {
  /** Id interno y "API name" de la plataforma. */
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly categoria?: string;
  /** Evento contado (con `contexto` opcional) o registro máximo. Uno de los dos. */
  readonly evento?: string;
  readonly contexto?: string | number;
  readonly registro?: string;
  readonly cantidad: number;
  /** Oculto hasta ganarlo (sorpresas, spoilers de historia). */
  readonly secreto?: boolean;
}

/** Puerto hacia la plataforma. Implementaciones: Steam, Game Center, Play Games, consolas; `PlataformaNula` sin ninguna. */
export interface PlataformaLogros {
  readonly disponible: boolean;
  desbloquear(id: string): void;
  /** Progreso opcional (algunas plataformas muestran "45/100"). */
  progreso?(id: string, actual: number, total: number): void;
}

export class PlataformaNula implements PlataformaLogros {
  readonly disponible = false;
  readonly desbloqueados: string[] = [];
  desbloquear(id: string): void {
    this.desbloqueados.push(id);
  }
}

export interface EstadoLogros {
  contadores: Record<string, number>;
  registros: Record<string, number>;
  ganados: Record<string, number>;
  pendientes: string[];
}

export class RegistroLogros {
  private readonly defs: readonly DefLogro[];
  readonly estado: EstadoLogros;
  private plataforma: PlataformaLogros;
  private readonly ahora: () => number;

  constructor(defs: readonly DefLogro[], plataforma: PlataformaLogros = new PlataformaNula(), estado?: EstadoLogros, ahora: () => number = () => 0) {
    const ids = new Set<string>();
    for (const d of defs) {
      if (ids.has(d.id)) throw new Error(`Logro repetido: ${d.id}`);
      if (!d.evento === !d.registro) throw new Error(`Logro ${d.id}: necesita evento O registro`);
      ids.add(d.id);
    }
    this.defs = defs;
    this.plataforma = plataforma;
    this.estado = estado ?? { contadores: {}, registros: {}, ganados: {}, pendientes: [] };
    this.ahora = ahora;
  }

  /** Cambiar de plataforma (p. ej. Steam se inicializó tarde) y sincronizar lo pendiente. */
  conectar(p: PlataformaLogros): void {
    this.plataforma = p;
    this.sincronizar();
  }

  /** Suma `n` al evento (y a `evento@contexto` si hay contexto). Devuelve los logros recién ganados. */
  registrar(evento: string, contexto?: string | number, n = 1): DefLogro[] {
    const c = this.estado.contadores;
    c[evento] = (c[evento] ?? 0) + n;
    if (contexto !== undefined) c[`${evento}@${contexto}`] = (c[`${evento}@${contexto}`] ?? 0) + n;
    return this.comprobar();
  }

  /** Registro que solo sube (mejor nivel, profundidad máxima). */
  fijarRegistro(clave: string, valor: number): DefLogro[] {
    const r = this.estado.registros;
    if (valor > (r[clave] ?? -Infinity)) r[clave] = valor;
    return this.comprobar();
  }

  contador(evento: string, contexto?: string | number): number {
    return this.estado.contadores[contexto === undefined ? evento : `${evento}@${contexto}`] ?? 0;
  }

  private actual(d: DefLogro): number {
    if (d.registro) return this.estado.registros[d.registro] ?? 0;
    return this.contador(d.evento!, d.contexto);
  }

  progreso(id: string): number {
    const d = this.defs.find((x) => x.id === id);
    if (!d) return 0;
    return this.ganado(id) ? 1 : Math.min(1, this.actual(d) / d.cantidad);
  }

  ganado(id: string): boolean {
    return id in this.estado.ganados;
  }

  private comprobar(): DefLogro[] {
    const nuevos: DefLogro[] = [];
    for (const d of this.defs) {
      if (this.ganado(d.id)) continue;
      const v = this.actual(d);
      if (v >= d.cantidad) {
        this.estado.ganados[d.id] = this.ahora();
        this.estado.pendientes.push(d.id);
        nuevos.push(d);
      } else if (this.plataforma.disponible && this.plataforma.progreso && d.cantidad > 1) {
        this.plataforma.progreso(d.id, v, d.cantidad);
      }
    }
    this.sincronizar();
    return nuevos;
  }

  /** Envía a la plataforma lo ganado sin conexión. */
  sincronizar(): void {
    if (!this.plataforma.disponible) return;
    for (const id of this.estado.pendientes) this.plataforma.desbloquear(id);
    this.estado.pendientes = [];
  }

  /** Lista para la pantalla de logros (los secretos sin ganar se muestran ocultos). */
  vista(): Array<{ id: string; nombre: string; descripcion: string; categoria: string; progreso: number; ganado: boolean }> {
    return this.defs.map((d) => {
      const g = this.ganado(d.id);
      const oculto = d.secreto && !g;
      return { id: d.id, nombre: oculto ? "???" : d.nombre, descripcion: oculto ? "Logro secreto" : d.descripcion, categoria: d.categoria ?? "", progreso: this.progreso(d.id), ganado: g };
    });
  }
}
