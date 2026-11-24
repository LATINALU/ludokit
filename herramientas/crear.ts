// Asistente de creación: hace las preguntas para determinar qué juego se está desarrollando, recomienda modelos,
// los combina y escribe la configuración inicial + un plan de implementación.
//
//   npm run crear                                   interactivo
//   npm run crear -- --respuestas '{"nucleo":["disparar","supervivencia"],"perspectiva":"primera"}' --sumar mod-zombis
//   npm run crear -- --modelos shooter-extraccion,supervivencia-sandbox,mod-zombis   (sin preguntas)
//   opciones: --salida <carpeta> (por defecto ./mi-juego) · --nombre "Mi juego"
//
// Escribe <salida>/ludokit.juego.json (reglas combinadas, módulos, datos, conflictos) y <salida>/PLAN.md.

import { createInterface } from "node:readline/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PREGUNTAS, MODELOS, combinar, modelo, planDeImplementacion, recomendar, type Combinacion, type Respuestas } from "../src/modelos/index.ts";

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function preguntar(): Promise<Respuestas> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r: Record<string, string | string[]> = {};
  console.log("\nludokit · asistente de creación. Enter para saltear una pregunta.\n");
  for (const p of PREGUNTAS) {
    console.log(`${p.texto}${p.multiple ? "  (varias: 1,3,4)" : ""}`);
    p.opciones.forEach((o, i) => console.log(`  ${i + 1}. ${o.texto}`));
    const linea = (await rl.question("> ")).trim();
    if (!linea) continue;
    const elegidas = linea.split(/[\s,]+/).map((x) => p.opciones[Number(x) - 1]?.valor).filter((x): x is string => !!x);
    if (elegidas.length) r[p.id] = p.multiple ? elegidas : elegidas[0];
    console.log();
  }
  rl.close();
  return r;
}

function plan(c: Combinacion, nombre: string, sugeridos?: string): string {
  const l: string[] = [`# ${nombre}`, "", `Modelos combinados: ${c.ids.map((x) => `\`${x}\``).join(" + ")}`, "", `Géneros: ${c.generos.join(", ")}`, ""];
  if (sugeridos) l.push("## Sugerencias del asistente", "", sugeridos, "");
  l.push("## Módulos de ludokit a usar", "", ...c.modulos.map((m) => `- \`${m}\``), "");
  if (c.datos.length) l.push("## Catálogos de datos", "", ...c.datos.map((d) => `- \`datos.${d}\``), "");
  l.push("## Mecánicas incluidas", "", ...c.mecanicas.map((m) => `- ${m}`), "");
  l.push("## Plan de implementación", "", ...planDeImplementacion(c).map((p) => `- ${p}`), "");
  if (c.conflictos.length) l.push("## Reglas en conflicto (revisar)", "", ...c.conflictos.map((x) => `- \`${x.ruta}\`: ${x.modelos.join(" vs ")} → ganó \`${x.ganador}\``), "");
  l.push("## Siguiente paso", "", "Leer `docs/IA.md` (o pedírselo a tu asistente de IA) y `docs/INDICE.md` para el detalle de cada módulo.", "");
  return l.join("\n");
}

async function main(): Promise<void> {
  const salida = resolve(argumento("salida") ?? "mi-juego");
  const ids = argumento("modelos");
  let c: Combinacion;
  let sugeridos: string | undefined;
  if (ids) {
    c = combinar(ids.split(",").map((x) => modelo(x.trim())));
  } else {
    const crudo = argumento("respuestas");
    const r: Respuestas = crudo ? JSON.parse(crudo) : await preguntar();
    const sumar = (argumento("sumar") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const bases = sumar.filter((x) => MODELOS.find((m) => m.id === x)?.tipo === "base");
    const mods = sumar.filter((x) => MODELOS.find((m) => m.id === x)?.tipo === "modificador");
    const rec = recomendar(r, bases);
    c = mods.length ? combinar([...rec.combinacion.ids.map(modelo), ...mods.map(modelo)]) : rec.combinacion;
    sugeridos = rec.sugeridos.map((s, i) => `${i + 1}. \`${s.modelo.id}\` (${Math.round(s.puntaje * 100)} %) — ${s.modelo.descripcion}`).join("\n");
    console.log("\nSugeridos:\n" + sugeridos.replace(/`/g, ""));
  }
  const nombre = argumento("nombre") ?? c.nombre;
  mkdirSync(salida, { recursive: true });
  writeFileSync(join(salida, "ludokit.juego.json"), JSON.stringify({ ...c, nombre }, null, 2));
  writeFileSync(join(salida, "PLAN.md"), plan(c, nombre, sugeridos));
  console.log(`\nCombinación: ${c.ids.join(" + ")}`);
  console.log(`Módulos: ${c.modulos.join(", ")}`);
  if (c.conflictos.length) console.log(`Conflictos resueltos (revisar): ${c.conflictos.map((x) => x.ruta).join(", ")}`);
  console.log(`\nEscrito: ${join(salida, "ludokit.juego.json")}\n         ${join(salida, "PLAN.md")}`);
}

await main();
