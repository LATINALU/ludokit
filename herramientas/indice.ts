// Genera el ÍNDICE de ludokit desde el código (nunca queda desactualizado):
//   docs/INDICE.md       para personas: cada espacio de nombres, sus archivos, qué hace cada uno, sus exportaciones
//                        con su descripción, qué modelos lo usan, más los modelos, preguntas y catálogos de datos.
//   docs/catalogo.json   lo mismo en datos, para herramientas y para asistentes de IA.
// Uso: npm run indice   (verificar.sh lo corre y falla si el índice quedó viejo)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELOS, PREGUNTAS } from "../src/modelos/index.ts";
import * as datos from "../src/datos/index.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p: string): string => readFileSync(p, "utf8");
const rel = (p: string): string => relative(RAIZ, p).replace(/\\/g, "/");

interface Exportacion {
  readonly nombre: string;
  readonly tipo: string;
  readonly doc: string;
}

interface Archivo {
  readonly ruta: string;
  readonly descripcion: string;
  readonly exportaciones: Exportacion[];
}

interface Espacio {
  readonly nombre: string;
  readonly importar: string;
  readonly archivos: Archivo[];
  readonly usadoPor: string[];
}

/** Comentario de cabecera (líneas `//` iniciales) en un párrafo. */
function cabecera(src: string): string {
  const l: string[] = [];
  for (const linea of src.split(/\r?\n/)) {
    if (!linea.startsWith("//")) break;
    l.push(linea.replace(/^\/\/ ?/, ""));
  }
  return l.join("\n").trim();
}

function exportaciones(src: string): Exportacion[] {
  const r: Exportacion[] = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?export\s+(?:declare\s+)?(abstract\s+class|class|function|const|let|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const doc = (m[1] ?? "").split(/\r?\n/).map((x) => x.replace(/^\s*\*\s?/, "").trim()).filter(Boolean).join(" ");
    r.push({ nombre: m[3], tipo: m[2].replace("abstract ", ""), doc });
  }
  return r;
}

/** Archivos que reexporta un index (recursivo). */
function archivosDe(indice: string): string[] {
  const src = leer(indice);
  const r: string[] = [];
  for (const m of src.matchAll(/export \*(?: as \w+)? from "(\.[^"]+)"/g)) {
    const p = join(dirname(indice), m[1]);
    if (p.endsWith("index.ts")) r.push(...archivosDe(p));
    else r.push(p);
  }
  for (const m of src.matchAll(/export type \* from "(\.[^"]+)"/g)) r.push(join(dirname(indice), m[1]));
  return r;
}

function espacios(): Espacio[] {
  const raiz = join(RAIZ, "src", "index.ts");
  const src = leer(raiz);
  const r: Espacio[] = [];
  const flat = src.match(/export \* from "(\.\/nucleo\/index\.ts)"/);
  if (flat) r.push(armar("(raíz)", 'import { Pcg32, curva, vec3 } from "ludokit"', join(RAIZ, "src", "nucleo", "index.ts")));
  for (const m of src.matchAll(/export \* as (\w+) from "(\.[^"]+)"/g)) {
    r.push(armar(m[1], `import { ${m[1]} } from "ludokit"`, join(RAIZ, "src", m[2])));
  }
  return r;
}

function armar(nombre: string, importar: string, indice: string): Espacio {
  const files = indice.endsWith("index.ts") ? archivosDe(indice) : [indice];
  const archivos = files.map((f) => {
    const s = leer(f);
    return { ruta: rel(f), descripcion: cabecera(s), exportaciones: exportaciones(s) };
  });
  const usadoPor = MODELOS.filter((mo) => mo.modulos.includes(nombre)).map((mo) => mo.id);
  return { nombre, importar, archivos, usadoPor };
}

const primeraFrase = (t: string): string => {
  const plano = t.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const i = plano.search(/[.:](\s|$)/);
  return (i > 0 ? plano.slice(0, i + 1) : plano).slice(0, 220);
};

function catalogosDatos(): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const [k, mod] of Object.entries(datos)) r[k] = Object.keys(mod as object).sort();
  return r;
}

function markdown(es: Espacio[]): string {
  const l: string[] = [];
  const total = es.reduce((s, e) => s + e.archivos.reduce((t, a) => t + a.exportaciones.length, 0), 0);
  l.push("# Índice de ludokit", "");
  l.push("> Generado por `npm run indice` desde el código. No editar a mano.", "");
  l.push(`**${es.length} espacios de nombres · ${es.reduce((s, e) => s + e.archivos.length, 0)} archivos · ${total} exportaciones · ${MODELOS.length} modelos · ${PREGUNTAS.length} preguntas del asistente.**`, "");
  l.push("Cómo usar este índice:", "", "1. ¿No sabés por dónde empezar? `npm run crear` (preguntas → modelos → plan).",
    "2. Buscá tu género en **Modelos** y mirá qué espacios usa.", "3. En **Espacios de nombres** está qué hace cada archivo y cada función/clase.",
    "4. Los asistentes de IA leen `docs/IA.md` y `docs/catalogo.json`.", "");
  l.push("## Contenido", "", "- [Modelos por género](#modelos-por-género)", "- [Preguntas del asistente](#preguntas-del-asistente)", "- [Catálogos de datos](#catálogos-de-datos)", "- [Espacios de nombres](#espacios-de-nombres)");
  for (const e of es) l.push(`  - [\`${e.nombre}\`](#${e.nombre === "(raíz)" ? "raíz" : e.nombre.toLowerCase()})`);
  l.push("");

  l.push("## Modelos por género", "", "Bases (un género completo) y modificadores (se suman a cualquier base). Combinar: `modelos.combinar([modelos.modelo(\"a\"), modelos.modelo(\"b\")])`.", "");
  l.push("| id | tipo | nombre | módulos | descripción |", "|---|---|---|---|---|");
  for (const m of MODELOS) l.push(`| \`${m.id}\` | ${m.tipo} | ${m.nombre} | ${m.modulos.map((x) => `\`${x}\``).join(" ")} | ${m.descripcion} |`);
  l.push("");

  l.push("## Preguntas del asistente", "", "`modelos.recomendar(respuestas)` · respuestas = `{ id: valor | valor[] }`.", "");
  for (const p of PREGUNTAS) l.push(`- **\`${p.id}\`**${p.multiple ? " (varias)" : ""}: ${p.texto} — ${p.opciones.map((o) => `\`${o.valor}\``).join(", ")}`);
  l.push("");

  l.push("## Catálogos de datos", "", "Datos PROPIOS de ludokit (`import { datos } from \"ludokit\"`): puntos de partida para copiar y cambiar.", "");
  for (const [k, v] of Object.entries(catalogosDatos())) l.push(`- **\`datos.${k}\`**: ${v.map((x) => `\`${x}\``).join(", ")}`);
  l.push("");

  l.push("## Espacios de nombres", "");
  for (const e of es) {
    l.push(`### ${e.nombre === "(raíz)" ? "(raíz)" : `\`${e.nombre}\``}`, "", `\`${e.importar}\``, "");
    if (e.usadoPor.length) l.push(`Usado por los modelos: ${e.usadoPor.map((x) => `\`${x}\``).join(", ")}`, "");
    for (const a of e.archivos) {
      l.push(`#### \`${a.ruta}\``, "");
      if (a.descripcion) l.push(primeraFrase(a.descripcion), "");
      const ex = a.exportaciones.filter((x) => x.tipo !== "type" || x.doc);
      if (ex.length) {
        l.push("| exportación | tipo | descripción |", "|---|---|---|");
        for (const x of ex) l.push(`| \`${x.nombre}\` | ${x.tipo} | ${x.doc.replace(/\|/g, "\\|").slice(0, 200)} |`);
        l.push("");
      }
    }
  }
  return l.join("\n");
}

const es = espacios();
writeFileSync(join(RAIZ, "docs", "INDICE.md"), markdown(es));
writeFileSync(join(RAIZ, "docs", "catalogo.json"), JSON.stringify({
  generado: "npm run indice",
  espacios: es,
  modelos: MODELOS.map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, generos: m.generos, descripcion: m.descripcion, modulos: m.modulos, datos: m.datos ?? [], mecanicas: m.mecanicas, rasgos: m.rasgos, reglas: Object.keys(m.reglas) })),
  preguntas: PREGUNTAS,
  datos: catalogosDatos(),
}));
console.log(`docs/INDICE.md y docs/catalogo.json: ${es.length} espacios, ${MODELOS.length} modelos`);
