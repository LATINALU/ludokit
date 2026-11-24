// Golden master del ESTADO completo de simulaciones deterministas + reglas de arquitectura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { generar } from "../vectores/golden.ts";

const GOLDEN = JSON.parse(readFileSync(new URL("../vectores/golden.json", import.meta.url), "utf8"));

/** Primera diferencia entre dos valores JSON (ruta + valores), con tolerancia relativa para flotantes. */
function diferencia(a: unknown, b: unknown, eps: number, ruta = ""): string | null {
  if (typeof a === "number" && typeof b === "number") {
    if (a === b || (eps > 0 && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)))) return null;
    return `${ruta}: ${a} != ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${ruta}: largo ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = diferencia(a[i], b[i], eps, `${ruta}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${ruta}: claves ${ka} != ${kb}`;
    for (const k of ka) {
      const d = diferencia((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], eps, `${ruta}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${ruta}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

test("golden master: el estado de cada simulación es idéntico al registrado (ε = 0 en TypeScript)", () => {
  const ahora = generar();
  for (const [esc, esperado] of Object.entries(GOLDEN.escenarios)) {
    const d = diferencia(ahora[esc], esperado, GOLDEN.tolerancia.typescript, esc);
    assert.equal(d, null, `${d}\nSi el cambio es intencional: npm run golden y documentar por qué en el commit.`);
  }
  assert.deepEqual(Object.keys(ahora).sort(), Object.keys(GOLDEN.escenarios).sort(), "escenarios agregados o quitados sin regenerar");
});

test("golden master: correr dos veces da lo mismo (sin estado global escondido)", () => {
  assert.equal(diferencia(generar(), generar(), 0), null);
});

// ---------------------------------------------------------------- Arquitectura

const SRC = new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith(".ts") ? [p] : [];
  });
}

test("arquitectura: el dominio no importa del motor, gráficos, red, infraestructura, modelos ni datos", () => {
  const prohibidos = ["/motor/", "/grafico/", "/red/", "/infraestructura/", "/modelos/", "/datos/", "/animacion/"];
  const malos: string[] = [];
  for (const f of archivos(SRC)) {
    const r = relative(SRC, f).replace(/\\/g, "/");
    if (!r.includes("/dominio/") && !r.startsWith("nucleo/")) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/from "([^"]+)"/g)) {
      const destino = join(f, "..", m[1]).replace(/\\/g, "/");
      if (prohibidos.some((p) => destino.includes(`/src${p}`))) malos.push(`${r} → ${m[1]}`);
    }
  }
  assert.deepEqual(malos, []);
});

test("arquitectura: ninguna regla usa Math.random() ni Date.now() (azar y tiempo inyectados)", () => {
  const malos: string[] = [];
  for (const f of archivos(SRC)) {
    const r = relative(SRC, f).replace(/\\/g, "/");
    const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Únicas excepciones: el adaptador de azar del sistema y el reloj del sistema.
    if (r === "nucleo/azar.ts" || r === "nucleo/reloj.ts") continue;
    if (/Math\.random\(|Date\.now\(|performance\.now\(/.test(src)) malos.push(r);
  }
  assert.deepEqual(malos, []);
});
