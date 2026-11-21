// Genera vectores/vectores.json desde la implementación de referencia (TypeScript). Cada port (Rust, Python, C++)
// tiene un test que reproduce estos números: si un port diverge, el test lo dice. Uso: node vectores/generar.ts
import { writeFileSync } from "node:fs";
import { AzarSemilla, Pcg32, derivarSemilla } from "../src/nucleo/index.ts";
import { mitigacion } from "../src/contextos/combate/index.ts";
import { poderEsperado, enemigoEsperado, jefeEsperado } from "../src/contextos/balance/index.ts";
import { pesosRareza, RAREZA_ESTANDAR } from "../src/contextos/botin/index.ts";
import { Grilla, mascaraAutotile, Cuerpo, mover } from "../src/contextos/fisica/index.ts";
import { aEstrella, grafoGrilla } from "../src/contextos/navegacion/index.ts";
import { hash2, ruidoValor } from "../src/contextos/mundo/index.ts";

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const pcg = (s: number) => { const p = new Pcg32(s); return Array.from({ length: 8 }, () => p.u32()); };
const mul = (s: number) => { const a = new AzarSemilla(s); return Array.from({ length: 8 }, () => r6(a.siguiente())); };
const g = Grilla.desdeTexto(["#####", "#...#", "#.#.#", "#...#", "#####"]);
const caida = (() => {
  const piso = Grilla.desdeTexto(["..........", "..........", "..........", "##########"]);
  const c = new Cuerpo(20, 0, 10, 20);
  for (let i = 0; i < 60; i++) { c.vy = Math.min(430, c.vy + 1100 / 60); mover(c, piso, 1 / 60); }
  return { x: r6(c.x), y: r6(c.y), enSuelo: c.enSuelo };
})();
const mapa = ["..........", ".########.", ".#......#.", ".#.####.#.", "...#..#...", "####..####"];
const camino = aEstrella(grafoGrilla({ cols: 10, filas: 6, costo: (c, f) => (mapa[f]?.[c] === "#" ? Infinity : 1) }), [0, 4], [9, 4]);
const v = {
  version: 1,
  pcg32: { semillas: [0, 1, 42, 123456789], salidas: [0, 1, 42, 123456789].map(pcg) },
  pcg32_derivar: { semilla: 7, n: 3, resultado: derivarSemilla(7, 3).toString() },
  mulberry32: { semillas: [1, 42], salidas: [1, 42].map(mul) },
  mitigacion: [[0, 60], [60, 60], [120, 60], [30, 100]].map(([d, k]) => ({ defensa: d, k, resultado: r6(mitigacion(d, k)) })),
  poder_esperado: [1, 6, 12, 24, 40].map((n) => ({ nivel: n, ...Object.fromEntries(Object.entries(poderEsperado(n)).map(([k, x]) => [k, r6(x)])) })),
  enemigo_esperado: [1, 12, 24].map((n) => ({ nivel: n, ...enemigoEsperado(n) })),
  jefe_esperado: [1, 12, 24].map((n) => ({ nivel: n, ...jefeEsperado(n) })),
  pesos_rareza: [1, 12, 24].map((n) => ({ nivel: n, pesos: pesosRareza(RAREZA_ESTANDAR, n).map(r6) })),
  autotile: { grilla: ["#####", "#...#", "#.#.#", "#...#", "#####"], celdas: [[2, 2], [0, 0], [1, 1]].map(([c, f]) => ({ c, f, mascara: mascaraAutotile(g, c, f) })) },
  fisica_caida: { inicio: { x: 20, y: 0, w: 10, h: 20 }, gravedad: 1100, caidaMax: 430, pasos: 60, dt: "1/60", resultado: caida },
  astar: { mapa, desde: [0, 4], hasta: [9, 4], largo: camino!.length },
  ruido: { hash2: [[1, 2, 0], [10, -3, 7]].map(([x, y, s]) => r6(hash2(x, y, s))), valor: [[0.5, 0.5, 0], [3.25, 7.75, 9]].map(([x, y, s]) => r6(ruidoValor(x, y, s))) },
};
writeFileSync(new URL("./vectores.json", import.meta.url), JSON.stringify(v, null, 1));
console.log("vectores.json escrito");
