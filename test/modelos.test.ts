import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELOS, PREGUNTAS, combinar, modelo, modelosBase, modificadores, recomendar, puntuar } from "../src/modelos/index.ts";
import { validarCurva } from "../src/nucleo/escalado.ts";
import { validarTablaRareza } from "../src/contextos/botin/dominio/rareza.ts";
import * as raiz from "../src/index.ts";

test("catálogo: más de 50 modelos, ids únicos, módulos que existen, rasgos válidos", () => {
  assert.ok(MODELOS.length >= 50, `${MODELOS.length} modelos`);
  assert.ok(modelosBase().length >= 40 && modificadores().length >= 8);
  assert.equal(new Set(MODELOS.map((m) => m.id)).size, MODELOS.length);
  const espacios = new Set(Object.keys(raiz));
  const preguntas = new Map(PREGUNTAS.map((p) => [p.id, new Set(p.opciones.map((o) => o.valor))]));
  for (const m of MODELOS) {
    for (const mod of m.modulos) assert.ok(espacios.has(mod) || mod === "infraestructura", `${m.id}: módulo ${mod} no existe en ludokit`);
    for (const r of Object.keys(m.rasgos)) {
      const [p, v] = r.split(":");
      assert.ok(preguntas.get(p)?.has(v), `${m.id}: rasgo ${r} no corresponde a ninguna respuesta`);
    }
    assert.ok(m.mecanicas.length > 0 && m.descripcion.length > 20, m.id);
  }
});

test("catálogo: las curvas y tablas de rareza de todos los modelos son válidas", () => {
  const curvas = (v: unknown, ruta: string): void => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.tipo === "string" && ["lineal", "potencia", "exponencial", "saturacion", "logistica", "tramos", "escalones", "topeSuave", "limitar", "producto", "suma", "desplazar", "escalar", "constante"].includes(o.tipo)) {
      assert.deepEqual(validarCurva(o as never), [], ruta);
      return;
    }
    if ("nombres" in o && "primero" in o) assert.deepEqual(validarTablaRareza(o as never), [], ruta);
    for (const [k, x] of Object.entries(o)) curvas(x, `${ruta}.${k}`);
  };
  for (const m of MODELOS) curvas(m.reglas, m.id);
});

test("combinar: une módulos y reglas en profundidad y reporta conflictos", () => {
  const c = combinar([modelo("shooter-extraccion"), modelo("supervivencia-sandbox"), modelo("mod-zombis")]);
  assert.ok(c.modulos.includes("disparos") && c.modulos.includes("supervivencia") && c.modulos.includes("encuentros"));
  assert.ok(c.reglas.director && c.reglas.salud && c.reglas.necesidades);
  const muerte = c.conflictos.find((x) => x.ruta === "muerte");
  assert.ok(muerte && muerte.ganador === "supervivencia-sandbox", "gana el último y queda registrado");
  assert.ok(c.datos.includes("armas") && c.datos.includes("criaturas"));
  const anidado = combinar([
    { ...modelo("mod-cooperativo"), reglas: { red: { autoritativo: true, tick: 30 } } },
    { ...modelo("mod-competitivo"), reglas: { red: { rebobinadoMax: 0.2 } } },
  ]);
  assert.deepEqual(anidado.reglas.red, { autoritativo: true, tick: 30, rebobinadoMax: 0.2 }, "los objetos se fusionan clave a clave");
  assert.equal(anidado.conflictos.length, 0);
});

test("asistente: cada género llega a su modelo con respuestas típicas", () => {
  const casos: Array<[Record<string, string | string[]>, string]> = [
    [{ nucleo: ["disparar", "supervivencia"], perspectiva: "primera", muerte: "pierde-lo-que-lleva", realismo: "simulacion", ambientacion: "militar" }, "shooter-extraccion"],
    [{ nucleo: "conducir", realismo: "arcade", ambientacion: "motor" }, "carreras-arcade"],
    [{ nucleo: "conducir", realismo: "simulacion", ambientacion: "motor", progresion: "habilidad-jugador" }, "carreras-simulacion"],
    [{ nucleo: ["estrategia"], ambientacion: ["zombis", "militar"], enemigos: "hordas" }, "guerra-zombis"],
    [{ nucleo: "habilidades", jugadores: "competitivo", perspectiva: "isometrica", sesion: "partidas" }, "moba"],
    [{ nucleo: "habilidades", jugadores: "masivo", economia: "comercio", progresion: ["niveles", "botin"] }, "mmo-tematico"],
    [{ nucleo: ["habilidades", "cuerpo-a-cuerpo"], perspectiva: "isometrica", progresion: "botin", enemigos: "hordas" }, "arpg-botin"],
    [{ nucleo: "cartas", sesion: "corridas", ritmo: "turnos" }, "mazo-roguelike"],
    [{ nucleo: "plataformas", perspectiva: "lateral", sesion: "campania" }, "metroidvania"],
    [{ nucleo: "sigilo", perspectiva: "tercera" }, "sigilo"],
    [{ ritmo: "inactivo", contenido: "infinito" }, "incremental"],
  ];
  for (const [resp, esperado] of casos) {
    const r = recomendar(resp);
    assert.equal(r.sugeridos[0].modelo.id, esperado, `${JSON.stringify(resp)} → ${r.sugeridos.slice(0, 3).map((s) => `${s.modelo.id} ${s.puntaje.toFixed(2)}`).join(", ")}`);
    assert.ok(r.plan.length >= 3);
  }
});

test("asistente: deduce modificadores, permite mezclar géneros a mano y puntúa 0..1", () => {
  const r = recomendar({ nucleo: "disparar", perspectiva: "primera", jugadores: "cooperativo", ambientacion: "zombis", contenido: "infinito", muerte: "permanente" });
  const mods = r.modificadores.map((m) => m.id);
  assert.ok(mods.includes("mod-infinito") && mods.includes("mod-hardcore"));
  const mezcla = recomendar({ nucleo: "conducir" }, ["shooter-arena"]);
  assert.ok(mezcla.combinacion.ids.includes("shooter-arena") && mezcla.combinacion.modulos.includes("disparos"));
  for (const m of MODELOS) {
    const s = puntuar(m, { nucleo: "disparar", perspectiva: "primera" }).puntaje;
    assert.ok(s >= 0 && s <= 1, `${m.id}: ${s}`);
  }
});
