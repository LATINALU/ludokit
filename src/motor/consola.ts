// Consola de comandos de desarrollo (y panel de "trucos" para probar el juego sin pasarlo): comandos registrados
// con argumentos tipados, ayuda automática, historial, autocompletado y una REGLA DE AISLAMIENTO: el primer comando
// que modifica el estado de la partida avisa (`alModificar`) para que el juego desvíe el guardado a una ranura de
// pruebas y la partida real nunca se ensucie. Los comandos de solo vista (velocidad, cámara, audio) no aíslan.

export type TipoArg = "numero" | "entero" | "texto" | "bool";

export interface DefComando {
  readonly nombre: string;
  readonly ayuda: string;
  readonly args?: ReadonlyArray<{ readonly nombre: string; readonly tipo: TipoArg; readonly opcional?: boolean }>;
  /** true si cambia la partida (nivel, objetos, vida...): activa el aislamiento del guardado. */
  readonly modifica?: boolean;
  readonly ejecutar: (args: ReadonlyArray<number | string | boolean>) => string | void;
}

export class Consola {
  private readonly comandos = new Map<string, DefComando>();
  readonly historial: string[] = [];
  aislada = false;
  /** Se llama una vez, la primera vez que un comando modifica la partida. */
  alModificar?: () => void;
  /** Si es false (versión publicada), solo responden los comandos marcados como públicos. */
  habilitada = true;

  constructor() {
    this.registrar({ nombre: "ayuda", ayuda: "Lista los comandos o explica uno: ayuda [comando]", args: [{ nombre: "comando", tipo: "texto", opcional: true }], ejecutar: ([c]) => this.ayuda(c as string | undefined) });
  }

  registrar(c: DefComando): void {
    if (this.comandos.has(c.nombre)) throw new Error(`Comando repetido: ${c.nombre}`);
    this.comandos.set(c.nombre, c);
  }

  private ayuda(c?: string): string {
    if (c) {
      const d = this.comandos.get(c);
      return d ? `${d.nombre} ${(d.args ?? []).map((a) => (a.opcional ? `[${a.nombre}]` : `<${a.nombre}>`)).join(" ")} — ${d.ayuda}` : `No existe: ${c}`;
    }
    return [...this.comandos.keys()].sort().join(", ");
  }

  /** Divide respetando comillas: dar "espada larga" 2 */
  static separar(linea: string): string[] {
    const r: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(linea))) r.push(m[1] ?? m[2]);
    return r;
  }

  ejecutar(linea: string): { ok: boolean; salida: string } {
    const partes = Consola.separar(linea.trim().replace(/^\//, ""));
    if (partes.length === 0) return { ok: false, salida: "" };
    this.historial.push(linea);
    if (!this.habilitada) return { ok: false, salida: "Consola deshabilitada" };
    const [nombre, ...crudos] = partes;
    const c = this.comandos.get(nombre);
    if (!c) {
      const parecidos = this.completar(nombre);
      return { ok: false, salida: `Comando desconocido: ${nombre}${parecidos.length ? ` (¿${parecidos.join(", ")}?)` : ""}` };
    }
    const defs = c.args ?? [];
    const args: Array<number | string | boolean> = [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const v = crudos[i];
      if (v === undefined) {
        if (d.opcional) break;
        return { ok: false, salida: `Falta <${d.nombre}>. Uso: ${this.ayuda(nombre)}` };
      }
      if (d.tipo === "numero" || d.tipo === "entero") {
        const n = Number(v);
        if (!Number.isFinite(n) || (d.tipo === "entero" && !Number.isInteger(n))) return { ok: false, salida: `<${d.nombre}> debe ser ${d.tipo}: ${v}` };
        args.push(n);
      } else if (d.tipo === "bool") args.push(["1", "si", "sí", "true", "on"].includes(v.toLowerCase()));
      else args.push(defs.length - 1 === i ? crudos.slice(i).join(" ") : v);
    }
    if (c.modifica && !this.aislada) {
      this.aislada = true;
      this.alModificar?.();
    }
    try {
      return { ok: true, salida: c.ejecutar(args) ?? "ok" };
    } catch (e) {
      return { ok: false, salida: `Error: ${(e as Error).message}` };
    }
  }

  /** Autocompletado por prefijo. */
  completar(prefijo: string): string[] {
    return [...this.comandos.keys()].filter((k) => k.startsWith(prefijo)).sort();
  }
}
