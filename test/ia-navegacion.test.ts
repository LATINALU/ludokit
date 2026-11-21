import { test } from "node:test";
import assert from "node:assert/strict";
import { aEstrella, grafoGrilla, MonticuloMin, suavizarCamino, visionBresenham } from "../src/contextos/navegacion/dominio/astar.ts";
import { CampoFlujo } from "../src/contextos/navegacion/dominio/campo-flujo.ts";
import { accion, aleatorio, condicion, cooldown, CORRIENDO, esperar, EXITO, FALLO, secuencia, selector, type Ctx } from "../src/contextos/ia/dominio/arbol-comportamiento.ts";
import { CURVAS, elegirAccion } from "../src/contextos/ia/dominio/utilidad.ts";
import { bandada, buscar, evitarObstaculos, integrar, llegar, type Agente } from "../src/contextos/ia/dominio/direccion.ts";
import { AtaquePorFases, ATAQUES_TIPO } from "../src/contextos/ia/dominio/ataque-por-fases.ts";
import { AzarSemilla } from "../src/nucleo/azar.ts";

const MAPA = [
  "..........",
  ".########.",
  ".#......#.",
  ".#.####.#.",
  "...#..#...",
  "####..####",
];
const libre = (c: number, f: number) => f >= 0 && f < MAPA.length && c >= 0 && c < MAPA[0].length && MAPA[f][c] !== "#";

test("montículo binario ordena", () => {
  const h = new MonticuloMin<string>();
  for (const [v, p] of [["c", 3], ["a", 1], ["d", 4], ["b", 2]] as const) h.meter(v, p);
  assert.deepEqual([h.sacar(), h.sacar(), h.sacar(), h.sacar(), h.sacar()], ["a", "b", "c", "d", undefined]);
});

test("A*: camino óptimo, sin cortar esquinas, sin camino y suavizado", () => {
  const g = grafoGrilla({ cols: 10, filas: 6, costo: (c, f) => (libre(c, f) ? 1 : Infinity) });
  const cam = aEstrella(g, [0, 4], [9, 4])!;
  assert.ok(cam, "hay camino");
  assert.deepEqual(cam[0], [0, 4]);
  assert.deepEqual(cam[cam.length - 1], [9, 4]);
  assert.equal(cam.length, 14, "rodea por arriba: 13 pasos");
  assert.equal(aEstrella(g, [0, 0], [4, 4]), null, "el pozo cerrado no es alcanzable");
  const g8 = grafoGrilla({ cols: 10, filas: 6, costo: (c, f) => (libre(c, f) ? 1 : Infinity), diagonal: true });
  const c8 = aEstrella(g8, [0, 0], [9, 0])!;
  assert.equal(c8.length, 10);
  const suave = suavizarCamino(c8, visionBresenham(libre));
  assert.equal(suave.length, 2, "línea recta");
});

test("campo de flujo: dirección hacia el objetivo desde cualquier celda", () => {
  const f = new CampoFlujo(10, 6);
  f.calcular([[9, 4]], (c, r) => (libre(c, r) ? 1 : Infinity));
  assert.equal(f.distanciaEn(9, 4), 0);
  assert.ok(Number.isFinite(f.distanciaEn(0, 4)));
  assert.equal(f.distanciaEn(4, 4), Infinity);
  const [dx] = f.direccion(0, 0);
  assert.ok(dx > 0, "en la fila de arriba va hacia la derecha");
});

test("árbol de comportamiento: selector con prioridad, secuencia con memoria, cooldown", () => {
  type P = { vida: number; enemigo: boolean; log: string[] };
  const p: P = { vida: 100, enemigo: true, log: [] };
  const huir = secuencia<P>(condicion((c) => c.pizarra.vida < 30), accion((c) => (c.pizarra.log.push("huye"), EXITO)));
  const atacar = secuencia<P>(condicion((c) => c.pizarra.enemigo), esperar(0.2), cooldown(accion((c) => (c.pizarra.log.push("golpe"), EXITO)), 1));
  const patrullar = accion<P>((c) => (c.pizarra.log.push("patrulla"), CORRIENDO));
  const raiz = selector(huir, atacar, patrullar);
  const ctx = (dt: number): Ctx<P> => ({ pizarra: p, dt });
  assert.equal(raiz.tick(ctx(0.1)), CORRIENDO);
  assert.equal(raiz.tick(ctx(0.1)), EXITO);
  assert.deepEqual(p.log, ["golpe"]);
  p.vida = 10;
  assert.equal(raiz.tick(ctx(0.1)), EXITO);
  assert.equal(p.log[p.log.length - 1], "huye");
  const az = new AzarSemilla(1);
  const elegidos = new Set<string>();
  const r = aleatorio<P>([[accion(() => (elegidos.add("a"), EXITO)), 1], [accion(() => (elegidos.add("b"), FALLO)), 1]]);
  for (let i = 0; i < 20; i++) r.tick({ pizarra: p, dt: 0, azar: az });
  assert.equal(elegidos.size, 2);
});

test("IA por utilidad: elige según curvas e inercia", () => {
  type C = { vida: number; distancia: number };
  const acciones = [
    { nombre: "curarse", consideraciones: [{ nombre: "vida", entrada: (c: C) => c.vida, curva: CURVAS.inversa() }] },
    { nombre: "atacar", consideraciones: [{ nombre: "cerca", entrada: (c: C) => 1 - c.distancia, curva: CURVAS.logistica(10, 0.5) }] },
  ];
  assert.equal(elegirAccion(acciones, { vida: 0.15, distancia: 0.9 })!.accion.nombre, "curarse");
  assert.equal(elegirAccion(acciones, { vida: 0.95, distancia: 0.1 })!.accion.nombre, "atacar");
});

test("steering: buscar, llegar frena, bandada, evitar obstáculo", () => {
  const a: Agente = { x: 0, y: 0, vx: 0, vy: 0, velMax: 100, fuerzaMax: 400 };
  for (let i = 0; i < 300; i++) integrar(a, [llegar(a, 200, 0, 60)], 1 / 60);
  assert.ok(Math.abs(a.x - 200) < 2 && Math.hypot(a.vx, a.vy) < 5, `llegó y frenó: ${a.x}`);
  const b: Agente = { x: 0, y: 0, vx: 100, vy: 0, velMax: 100, fuerzaMax: 400 };
  const f = evitarObstaculos(b, [{ x: 30, y: 2, r: 10 }]);
  assert.ok(f.y < 0, "esquiva hacia el lado libre");
  const grupo: Agente[] = [0, 1, 2].map((i) => ({ x: i * 5, y: 0, vx: 10, vy: 0, velMax: 50, fuerzaMax: 100 }));
  const fb = bandada(grupo[0], grupo);
  assert.ok(Number.isFinite(fb.x) && Number.isFinite(buscar(grupo[0], 10, 10).x));
});

test("ataque por fases: anticipa → golpe → recupera con cooldown", () => {
  const a = new AtaquePorFases(ATAQUES_TIPO.medio);
  const ev: string[] = [];
  for (let i = 0; i < 120; i++) for (const e of a.actualizar(1 / 60, 10)) ev.push(e.tipo);
  assert.deepEqual(ev.slice(0, 3), ["anticipa", "golpe", "fin"]);
  a.interrumpir();
  assert.equal(a.fase, "patrulla");
});
