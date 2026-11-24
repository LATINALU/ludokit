// Lector de un formato de datos de texto por bloques, cómodo para diseñadores:
//   *ETIQUETA { *CLAVE valor [valor...] }    una fila; una clave repetida = lista
//   *CLAVE valor                              línea suelta de configuración fuera de bloques
// Sirve para cualquier tabla de contenido (objetos, enemigos, zonas, botín) sin escribir un parser por tabla.

export interface Linea {
  readonly clave: string;
  readonly valores: readonly string[];
}

export interface Bloque {
  readonly etiqueta: string;
  /** Cada clave guarda todas sus apariciones, en orden. */
  readonly campos: ReadonlyMap<string, readonly (readonly string[])[]>;
}

export interface Documento {
  readonly bloques: readonly Bloque[];
  readonly sueltas: readonly Linea[];
}

/** Quita el comentario `//` que no esté dentro de comillas. */
function sinComentario(linea: string): string {
  let enComillas = false;
  for (let i = 0; i < linea.length - 1; i++) {
    const c = linea[i];
    if (c === '"') {
      enComillas = !enComillas;
    } else if (!enComillas && c === "/" && linea[i + 1] === "/") {
      return linea.slice(0, i);
    }
  }
  return linea;
}

/** Separa por espacios o tabulaciones respetando "textos entre comillas". */
export function separar(linea: string): string[] {
  const partes: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linea)) !== null) {
    partes.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return partes;
}

export function leerDocumento(texto: string): Documento {
  const bloques: Bloque[] = [];
  const sueltas: Linea[] = [];
  let etiquetaPendiente: string | null = null;
  let actual: { etiqueta: string; campos: Map<string, string[][]> } | null = null;

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = sinComentario(cruda).trim();
    if (linea.length === 0) {
      continue;
    }
    if (linea.startsWith("{")) {
      if (etiquetaPendiente === null) {
        throw new Error(`'{' sin etiqueta antes: "${cruda.trim()}"`);
      }
      actual = { etiqueta: etiquetaPendiente, campos: new Map() };
      etiquetaPendiente = null;
      continue;
    }
    if (linea.startsWith("}")) {
      if (actual !== null) {
        bloques.push(actual);
      }
      actual = null;
      continue;
    }
    if (!linea.startsWith("*")) {
      continue;
    }
    const [claveCruda, ...valores] = separar(linea);
    const clave = claveCruda.slice(1);
    if (actual !== null) {
      const lista = actual.campos.get(clave) ?? [];
      lista.push(valores);
      actual.campos.set(clave, lista);
    } else if (valores.length === 0) {
      // "*OBJETO" solo en su línea: el bloque empieza con la próxima '{'.
      if (etiquetaPendiente !== null) {
        sueltas.push({ clave: etiquetaPendiente, valores: [] });
      }
      etiquetaPendiente = clave;
    } else {
      sueltas.push({ clave, valores });
    }
  }
  return { bloques, sueltas };
}

// ---- Lectura cómoda de campos ----

export function texto(b: Bloque, clave: string, defecto = ""): string {
  return b.campos.get(clave)?.[0]?.[0] ?? defecto;
}

export function numero(b: Bloque, clave: string, defecto = 0): number {
  const v = b.campos.get(clave)?.[0]?.[0];
  if (v === undefined) {
    return defecto;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : defecto;
}

/** Todas las apariciones de una clave repetida (por ejemplo `*BOTIN`). */
export function todos(b: Bloque, clave: string): readonly (readonly string[])[] {
  return b.campos.get(clave) ?? [];
}

export function bloquesDe(doc: Documento, etiqueta: string): Bloque[] {
  return doc.bloques.filter((b) => b.etiqueta === etiqueta);
}

export function sueltasDe(doc: Documento, clave: string): Linea[] {
  return doc.sueltas.filter((l) => l.clave === clave);
}
