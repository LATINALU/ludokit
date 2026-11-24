// Genera vectores/vectores.json desde la implementación de referencia (TypeScript). Cada port (Rust, Python, C++)
// tiene un test que reproduce estos números: si un port diverge, el test lo dice. Uso: node vectores/generar.ts
import { writeFileSync } from "node:fs";
import { AzarSemilla, Pcg32, derivarSemilla } from "../src/nucleo/index.ts";
import { mitigacion } from "../src/contextos/combate/index.ts";
import { ModeloBalance } from "../src/contextos/balance/index.ts";
import { pesosRareza } from "../src/contextos/botin/index.ts";
import { evaluar, curva, type Curva } from "../src/nucleo/escalado.ts";
import { PODER_RPG, BALANCE_ACCION, RAREZA_ARPG } from "../src/modelos/piezas.ts";
import { v3 } from "../src/nucleo/vec3.ts";
import { lanzarRayo, type Colisionador3D, type Forma3D } from "../src/espacial/colision3d.ts";
import { CampoFlujo } from "../src/contextos/navegacion/index.ts";
import { NieblaGuerra } from "../src/contextos/vision/index.ts";

// Escena 3D con semilla: 120 formas mezcladas y 60 rayos (los ports deben dar el mismo primer impacto).
const escena3d = (() => {
  const p = new Pcg32(2024);
  const f = (a: number, b: number) => a + p.siguiente() * (b - a);
  const formas: Array<{ id: number; duenio: number; etiqueta: number; forma: Forma3D }> = [];
  for (let i = 0; i < 120; i++) {
    const c = v3(f(-40, 40), f(0, 6), f(-40, 40));
    const t = i % 3;
    const forma: Forma3D = t === 0 ? { tipo: "esfera", centro: c, radio: f(0.2, 1.5) }
      : t === 1 ? { tipo: "caja", min: c, max: v3(c.x + f(0.3, 4), c.y + f(0.3, 3), c.z + f(0.3, 4)) }
      : { tipo: "capsula", a: c, b: v3(c.x + f(-1, 1), c.y + f(0.5, 2), c.z + f(-1, 1)), radio: f(0.2, 0.6) };
    formas.push({ id: i + 1, duenio: Math.floor(i / 3), etiqueta: t, forma });
  }
  const rayos = Array.from({ length: 60 }, () => {
    const o = v3(f(-45, 45), f(0.5, 5), f(-45, 45));
    const d = v3(f(-1, 1), f(-0.2, 0.2), f(-1, 1));
    const l = Math.hypot(d.x, d.y, d.z);
    return { origen: o, dir: v3(d.x / l, d.y / l, d.z / l), largo: 120 };
  });
  const cols: Colisionador3D[] = formas.map((x) => ({ id: x.id, duenio: x.duenio, etiqueta: String(x.etiqueta), forma: x.forma }));
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  return { formas, rayos, impactos: rayos.map((r) => { const h = lanzarRayo(cols, r); return h ? { id: h.colisionador.id, t: r6(h.t) } : null; }) };
})();

const MAPA_FLUJO = ["....................", "..######......#.....", "..#....#......#.....", "..#..........###....", "..######............", "........#####.......", "....................", "...##.........###...", "...#...........#....", "...#....#####..#....", "....................", "...................."];
const flujo = (() => {
  const c = new CampoFlujo(20, 12);
  c.calcular([[17, 10]], (x, y) => (MAPA_FLUJO[y][x] === "#" ? Infinity : 1));
  return { mapa: MAPA_FLUJO, objetivo: [17, 10], distancia: [...c.distancia].map((d) => (Number.isFinite(d) ? Math.round(d * 1e4) / 1e4 : -1)) };
})();
const niebla = (() => {
  const n = new NieblaGuerra(20, 12, (x, y) => MAPA_FLUJO[y][x] === "#");
  n.actualizar([{ x: 4, y: 3, radio: 6 }, { x: 16, y: 6, radio: 4.5 }]);
  n.actualizar([{ x: 10, y: 8, radio: 5 }]);
  return { fuentes1: [[4, 3, 6], [16, 6, 4.5]], fuentes2: [[10, 8, 5]], estados: Array.from({ length: 240 }, (_, i) => n.estado(i % 20, Math.floor(i / 20))) };
})();

// El modelo de balance viaja EN los vectores: los ports lo leen y evalúan las mismas curvas (nada de números fijos).
const modelo = new ModeloBalance(PODER_RPG, BALANCE_ACCION);
const CURVAS_PRUEBA: Curva[] = [
  curva.constante(7), curva.lineal(10, 2.5), curva.potencia(30, 0.93), curva.exponencial(1, 1.12), curva.saturacion(30, 1.5),
  curva.logistica(20, 0.3), curva.tramos([[0, 1], [10, 1], [60, 0.4]]), curva.tramos([[0, 0], [10, 5]], "lineal"),
  curva.escalones([[10, 2], [30, 5]], 1), curva.topeSuave(curva.potencia(25, 0.95), 50, 0.7), curva.limitar(curva.lineal(8, -0.1), 5, 8),
  curva.producto(curva.lineal(1, 1), curva.exponencial(2, 1.01)), curva.suma(curva.constante(3), curva.potencia(1, 2)),
  curva.desplazar(curva.lineal(0, 1), 9), curva.escalar(curva.saturacion(10), 100),
];
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
  version: 2,
  pcg32: { semillas: [0, 1, 42, 123456789], salidas: [0, 1, 42, 123456789].map(pcg) },
  pcg32_derivar: { semilla: 7, n: 3, resultado: derivarSemilla(7, 3).toString() },
  mulberry32: { semillas: [1, 42], salidas: [1, 42].map(mul) },
  mitigacion: [[0, 60], [60, 60], [120, 60], [30, 100]].map(([d, k]) => ({ defensa: d, k, resultado: r6(mitigacion(d, k)) })),
  curvas: CURVAS_PRUEBA.map((c) => ({ curva: c, valores: [1, 2, 7, 25, 60, 250].map((x) => [x, r6(evaluar(c, x))]) })),
  modelo_balance: { curva: PODER_RPG, reglas: BALANCE_ACCION },
  poder_esperado: [1, 6, 12, 24, 40, 75, 300].map((n) => ({ nivel: n, ...Object.fromEntries(Object.entries(modelo.poder(n)).map(([k, x]) => [k, r6(x)])) })),
  enemigo_esperado: [1, 12, 24, 75, 300].map((n) => ({ nivel: n, ...modelo.enemigo(n) })),
  jefe_esperado: [1, 12, 24, 75, 300].map((n) => ({ nivel: n, ...modelo.jefe(n) })),
  tabla_rareza: RAREZA_ARPG,
  escena3d,
  campo_flujo: flujo,
  niebla,
  pesos_rareza: [1, 12, 24, 100, 1000].map((n) => ({ nivel: n, pesos: pesosRareza(RAREZA_ARPG, n).map(r6) })),
  autotile: { grilla: ["#####", "#...#", "#.#.#", "#...#", "#####"], celdas: [[2, 2], [0, 0], [1, 1]].map(([c, f]) => ({ c, f, mascara: mascaraAutotile(g, c, f) })) },
  fisica_caida: { inicio: { x: 20, y: 0, w: 10, h: 20 }, gravedad: 1100, caidaMax: 430, pasos: 60, dt: "1/60", resultado: caida },
  astar: { mapa, desde: [0, 4], hasta: [9, 4], largo: camino!.length },
  ruido: { hash2: [[1, 2, 0], [10, -3, 7]].map(([x, y, s]) => r6(hash2(x, y, s))), valor: [[0.5, 0.5, 0], [3.25, 7.75, 9]].map(([x, y, s]) => r6(ruidoValor(x, y, s))) },
};
writeFileSync(new URL("./vectores.json", import.meta.url), JSON.stringify(v, null, 1));
console.log("vectores.json escrito");
