// Calendario de contenido vivo: semanas desde un lunes fijo (la rotación es la misma para todos los jugadores sin
// consultar un servidor), elección determinista de lo de la semana, ventanas de eventos de temporada por fecha y
// reinicios diarios/semanales (misiones diarias, cofre semanal). Todo recibe la hora: se prueba con un reloj manual.

const DIA = 86_400_000;
const SEMANA = 7 * DIA;

/** Lunes de referencia (UTC). Cambiarlo cambia la fase de todas las rotaciones. */
export const LUNES_BASE = Date.UTC(2026, 0, 5);

export const semanaDe = (ms: number, base = LUNES_BASE): number => Math.max(0, Math.floor((ms - base) / SEMANA));
export const diaDe = (ms: number, base = LUNES_BASE): number => Math.max(0, Math.floor((ms - base) / DIA));

/** Ms hasta el próximo reinicio semanal (para la cuenta regresiva de la interfaz). */
export const hastaProximaSemana = (ms: number, base = LUNES_BASE): number => base + (semanaDe(ms, base) + 1) * SEMANA - ms;
export const hastaProximoDia = (ms: number, base = LUNES_BASE): number => base + (diaDe(ms, base) + 1) * DIA - ms;

/** Elemento de la rotación para una semana (o día): ciclo simple, predecible para la comunidad. */
export const rotacion = <T>(lista: readonly T[], periodo: number): T => lista[((periodo % lista.length) + lista.length) % lista.length];

/** Selección "barajada" sin repetir hasta agotar la lista (cada ciclo completo usa todos una vez). */
export function rotacionBarajada<T>(lista: readonly T[], periodo: number, semilla = 1): T {
  const n = lista.length;
  const ciclo = Math.floor(periodo / n);
  const orden = [...Array(n).keys()];
  let s = (semilla * 2654435761 + ciclo * 40503) >>> 0;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    const j = s % (i + 1);
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return lista[orden[periodo % n]];
}

export interface EventoTemporada {
  readonly id: string;
  /** Inicio y fin en ms UTC. */
  readonly desde: number;
  readonly hasta: number;
  readonly datos?: Readonly<Record<string, unknown>>;
}

/** Eventos de temporada activos en `ms`. */
export const eventosActivos = (eventos: readonly EventoTemporada[], ms: number): EventoTemporada[] => eventos.filter((e) => ms >= e.desde && ms < e.hasta);

/** Evento anual que se repite cada año (navidad, aniversario): mes 1-12, día 1-31, duración en días. */
export function eventoAnual(id: string, mes: number, dia: number, dias: number, ms: number): EventoTemporada {
  const anio = new Date(ms).getUTCFullYear();
  for (const a of [anio - 1, anio]) {
    const desde = Date.UTC(a, mes - 1, dia);
    if (ms < desde + dias * DIA && ms >= desde) return { id, desde, hasta: desde + dias * DIA };
  }
  const desde = Date.UTC(ms < Date.UTC(anio, mes - 1, dia) ? anio : anio + 1, mes - 1, dia);
  return { id, desde, hasta: desde + dias * DIA };
}

/** Progreso que se reinicia por período (cofre semanal, misiones diarias): guarda el período y lo vacía al cambiar. */
export class ProgresoPeriodico {
  periodo: number;
  valor = 0;
  /** Lo acumulado en el período anterior (para cobrar el cofre de la semana pasada). */
  anterior: { periodo: number; valor: number } | null = null;
  private readonly periodoDe: (ms: number) => number;

  constructor(periodoDe: (ms: number) => number, ahora: number) {
    this.periodoDe = periodoDe;
    this.periodo = periodoDe(ahora);
  }

  private sincronizar(ms: number): void {
    const p = this.periodoDe(ms);
    if (p !== this.periodo) {
      if (this.valor > 0) this.anterior = { periodo: this.periodo, valor: this.valor };
      this.periodo = p;
      this.valor = 0;
    }
  }

  sumar(ms: number, n = 1, tope = Infinity): number {
    this.sincronizar(ms);
    this.valor = Math.min(tope, this.valor + n);
    return this.valor;
  }

  leer(ms: number): number {
    this.sincronizar(ms);
    return this.valor;
  }

  /** Cobra lo acumulado del período anterior (una vez). */
  cobrarAnterior(ms: number): number {
    this.sincronizar(ms);
    const v = this.anterior?.valor ?? 0;
    this.anterior = null;
    return v;
  }
}
