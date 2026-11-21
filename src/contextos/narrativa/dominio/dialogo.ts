// Diálogos ramificados por datos: nodos con texto, hablante y opciones; condiciones sobre variables del mundo
// (banderas, reputación, objetos, misiones) y efectos al elegir (dar objeto, cambiar bandera, iniciar misión).
// Interpolación de variables en el texto ("Hola, {nombre}"). Validación del grafo al cargar (referencias rotas).
// El motor de diálogo no sabe de UI: expone el nodo actual y las opciones disponibles.

export type Valor = number | string | boolean;

export interface Condicion {
  readonly var: string;
  readonly op: "==" | "!=" | ">=" | "<=" | ">" | "<" | "tiene" | "no-tiene";
  readonly valor?: Valor;
}

export interface Efecto {
  readonly tipo: "fijar" | "sumar" | "evento";
  readonly var?: string;
  readonly valor?: Valor;
  /** Para "evento": nombre que la capa de juego interpreta (dar-objeto, iniciar-mision, abrir-tienda). */
  readonly evento?: string;
  readonly datos?: Readonly<Record<string, Valor>>;
}

export interface Opcion {
  readonly texto: string;
  readonly ir?: string;
  readonly si?: readonly Condicion[];
  readonly efectos?: readonly Efecto[];
  /** Mostrar aunque no se cumpla la condición (gris, con el motivo). */
  readonly mostrarBloqueada?: boolean;
}

export interface NodoDialogo {
  readonly id: string;
  readonly hablante?: string;
  readonly texto: string;
  readonly opciones?: readonly Opcion[];
  /** Sin opciones: ir automáticamente a este nodo al continuar. */
  readonly siguiente?: string;
  readonly efectos?: readonly Efecto[];
  /** Entrada condicional: el primer nodo de la lista cuya condición se cumple (saludos según reputación). */
  readonly redirigir?: ReadonlyArray<{ readonly si: readonly Condicion[]; readonly ir: string }>;
}

export interface Mundo {
  obtener(v: string): Valor | undefined;
  fijar(v: string, valor: Valor): void;
  /** Para "tiene": objetos en el inventario, misiones activas... */
  tiene?(v: string, valor?: Valor): boolean;
}

export class MundoVariables implements Mundo {
  readonly vars = new Map<string, Valor>();
  readonly conjuntos = new Map<string, Set<Valor>>();
  obtener(v: string): Valor | undefined {
    return this.vars.get(v);
  }
  fijar(v: string, valor: Valor): void {
    this.vars.set(v, valor);
  }
  tiene(v: string, valor?: Valor): boolean {
    return valor === undefined ? !!this.vars.get(v) : (this.conjuntos.get(v)?.has(valor) ?? false);
  }
}

export function cumple(c: Condicion, m: Mundo): boolean {
  const v = m.obtener(c.var);
  switch (c.op) {
    case "tiene":
      return m.tiene ? m.tiene(c.var, c.valor) : !!v;
    case "no-tiene":
      return !(m.tiene ? m.tiene(c.var, c.valor) : !!v);
    case "==":
      return v === c.valor;
    case "!=":
      return v !== c.valor;
    default: {
      const a = Number(v ?? 0), b = Number(c.valor ?? 0);
      return c.op === ">=" ? a >= b : c.op === "<=" ? a <= b : c.op === ">" ? a > b : a < b;
    }
  }
}

export const cumpleTodas = (cs: readonly Condicion[] | undefined, m: Mundo): boolean => (cs ?? []).every((c) => cumple(c, m));

export function interpolar(texto: string, m: Mundo): string {
  return texto.replace(/\{(\w[\w.]*)\}/g, (_, k: string) => String(m.obtener(k) ?? `{${k}}`));
}

export interface EventoDialogo {
  readonly evento: string;
  readonly datos?: Readonly<Record<string, Valor>>;
}

export class Dialogo {
  private readonly nodos: ReadonlyMap<string, NodoDialogo>;
  private readonly mundo: Mundo;
  actual: NodoDialogo | null = null;
  readonly eventos: EventoDialogo[] = [];
  readonly historial: string[] = [];

  constructor(nodos: readonly NodoDialogo[], mundo: Mundo) {
    this.nodos = new Map(nodos.map((n) => [n.id, n]));
    this.mundo = mundo;
  }

  /** Errores de referencias (validar al cargar el contenido). */
  static validar(nodos: readonly NodoDialogo[]): string[] {
    const ids = new Set(nodos.map((n) => n.id));
    const e: string[] = [];
    for (const n of nodos) {
      for (const o of n.opciones ?? []) if (o.ir && !ids.has(o.ir)) e.push(`${n.id}: opción "${o.texto}" va a ${o.ir} (no existe)`);
      if (n.siguiente && !ids.has(n.siguiente)) e.push(`${n.id}: siguiente ${n.siguiente} no existe`);
      for (const r of n.redirigir ?? []) if (!ids.has(r.ir)) e.push(`${n.id}: redirige a ${r.ir} (no existe)`);
    }
    return e;
  }

  iniciar(id: string): void {
    this.entrar(id);
  }

  private entrar(id: string | undefined): void {
    if (!id) {
      this.actual = null;
      return;
    }
    let n: NodoDialogo | undefined = this.nodos.get(id);
    if (!n) throw new Error(`Diálogo: nodo ${id}`);
    for (let guarda = 0; n.redirigir && guarda < 16; guarda++) {
      const r: { readonly si: readonly Condicion[]; readonly ir: string } | undefined = n.redirigir.find((x) => cumpleTodas(x.si, this.mundo));
      if (!r) break;
      n = this.nodos.get(r.ir)!;
    }
    this.actual = n;
    this.historial.push(n.id);
    this.aplicar(n.efectos);
  }

  private aplicar(efs: readonly Efecto[] | undefined): void {
    for (const e of efs ?? []) {
      if (e.tipo === "fijar" && e.var) this.mundo.fijar(e.var, e.valor ?? true);
      else if (e.tipo === "sumar" && e.var) this.mundo.fijar(e.var, Number(this.mundo.obtener(e.var) ?? 0) + Number(e.valor ?? 1));
      else if (e.tipo === "evento" && e.evento) this.eventos.push({ evento: e.evento, datos: e.datos });
    }
  }

  get texto(): string {
    return this.actual ? interpolar(this.actual.texto, this.mundo) : "";
  }

  /** Opciones visibles con su estado. */
  opciones(): Array<{ indice: number; texto: string; disponible: boolean }> {
    const n = this.actual;
    if (!n) return [];
    return (n.opciones ?? [])
      .map((o, i) => ({ indice: i, texto: interpolar(o.texto, this.mundo), disponible: cumpleTodas(o.si, this.mundo), mostrar: o.mostrarBloqueada }))
      .filter((o) => o.disponible || o.mostrar)
      .map(({ indice, texto, disponible }) => ({ indice, texto, disponible }));
  }

  elegir(indice: number): boolean {
    const o = this.actual?.opciones?.[indice];
    if (!o || !cumpleTodas(o.si, this.mundo)) return false;
    this.aplicar(o.efectos);
    this.entrar(o.ir);
    return true;
  }

  /** Avanzar un nodo sin opciones. */
  continuar(): void {
    if (this.actual && !(this.actual.opciones?.length)) this.entrar(this.actual.siguiente);
  }

  get terminado(): boolean {
    return this.actual === null;
  }
}
