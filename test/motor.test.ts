import { test } from "node:test";
import assert from "node:assert/strict";
import { BucleFijo } from "../src/motor/bucle.ts";
import { MundoEcs, componente, generacionDe } from "../src/motor/ecs.ts";
import { MaquinaEstados } from "../src/motor/fsm.ts";
import { Agenda, Cooldown, EASE } from "../src/motor/tiempo.ts";
import { Entrada } from "../src/motor/entrada.ts";
import { Camara } from "../src/motor/camara.ts";
import { Animador, clipsDesdeAseprite } from "../src/motor/animador.ts";
import { Pool } from "../src/motor/pool.ts";

test("bucle fijo: pasos iguales, alfa, tope y escala de tiempo", () => {
  const pasos: number[] = [];
  let alfa = -1;
  const b = new BucleFijo({ actualizar: (dt, n) => pasos.push(n + dt * 0), dibujar: (a) => (alfa = a) }, { hz: 60 });
  b.avanzar(0);
  assert.equal(b.avanzar(0.05), 3); // 3 pasos de 1/60 caben en 50 ms
  assert.ok(alfa > 0 && alfa < 1);
  assert.equal(b.avanzar(10), 8, "tirón: como mucho maxPasos");
  b.escalaTiempo = 0;
  assert.equal(b.avanzar(10.1), 0, "pausa");
  b.pasos(5);
  assert.equal(b.tick, 16);
});

test("ECS: crear, consultar, destruir, generación y comandos diferidos", () => {
  const Pos = componente<{ x: number }>("pos");
  const Vel = componente<{ vx: number }>("vel");
  const m = new MundoEcs();
  const a = m.crear();
  const b = m.crear();
  m.poner(a, Pos, { x: 0 }).poner(a, Vel, { vx: 10 });
  m.poner(b, Pos, { x: 5 });
  m.sistema("mover", (w, dt) => {
    for (const [, p, v] of w.consultar(Pos, Vel)) p.x += v.vx * dt;
  });
  let xFinal = -1;
  m.sistema("limpiar", (w) => {
    xFinal = w.requerir(a, Pos).x;
    for (const [e, p] of w.consultar(Pos)) if (p.x > 5) w.diferir(() => w.destruir(e));
  });
  m.actualizar(1);
  assert.equal(xFinal, 10);
  assert.equal(m.vive(a), false, "destruida por comando diferido");
  const c = m.crear();
  assert.equal(generacionDe(c), 1, "reutiliza el índice con otra generación");
  assert.equal(m.obtener(c, Pos), undefined);
  assert.equal(m.cantidad, 2);
});

test("FSM jerárquica: transiciones por condición y sub-estados", () => {
  const ctx = { vista: false, cerca: false, log: [] as string[] };
  const ataque = new MaquinaEstados<typeof ctx>({ anticipa: {}, golpe: {} }, [{ desde: "anticipa", hacia: "golpe", cuando: (_c, t) => t >= 0.3 }]);
  const ia = new MaquinaEstados<typeof ctx>(
    { patrulla: { entrar: (c) => c.log.push("patrulla") }, combate: { hija: ataque } },
    [{ desde: "patrulla", hacia: "combate", cuando: (c) => c.vista }, { desde: "*", hacia: "patrulla", cuando: (c) => !c.vista }],
  );
  ia.iniciar(ctx, "patrulla");
  ctx.vista = true;
  ia.actualizar(ctx, 0.1);
  assert.equal(ia.ruta, "combate/anticipa");
  for (let i = 0; i < 4; i++) ia.actualizar(ctx, 0.1);
  assert.equal(ia.ruta, "combate/golpe");
  ctx.vista = false;
  ia.actualizar(ctx, 0.1);
  assert.equal(ia.estado, "patrulla");
});

test("agenda, tweens, easing y cooldown", () => {
  const ag = new Agenda();
  let disparos = 0;
  let v = 0;
  ag.cada(0.5, () => disparos++, 3);
  ag.tween(0, 100, 1, (x) => (v = x), EASE.lineal);
  for (let i = 0; i < 20; i++) ag.actualizar(0.1);
  assert.equal(disparos, 3);
  assert.equal(v, 100);
  assert.equal(ag.pendientes, 0);
  assert.ok(Math.abs(EASE.salidaRebote(1) - 1) < 1e-9 && EASE.salidaElastica(0) === 0);
  const cd = new Cooldown(1);
  assert.ok(cd.usar());
  assert.ok(!cd.usar());
  cd.actualizar(1);
  assert.ok(cd.listo);
});

test("entrada: acciones, flancos, búfer, ejes y remapeo", () => {
  const e = new Entrada();
  e.fijarFisico("Space", true);
  e.muestrear(1 / 60);
  assert.ok(e.recien("saltar") && e.pulsada("saltar"));
  e.muestrear(1 / 60);
  assert.ok(!e.recien("saltar") && e.enBufer("saltar", 0.1));
  e.fijarFisico("Space", false);
  e.muestrear(1 / 60);
  assert.ok(e.soltada("saltar"));
  e.fijarEje("pad:stickIzq", -0.9);
  e.muestrear(1 / 60);
  assert.equal(e.eje("izq", "der"), -1);
  e.remapear("saltar", ["KeyQ"]);
  e.fijarFisico("KeyQ", true);
  e.muestrear(1 / 60);
  assert.ok(e.recien("saltar"));
});

test("cámara: zona muerta, límites y sacudida", () => {
  const c = new Camara({ ancho: 320, alto: 180, limites: { x: 0, y: 0, w: 1000, h: 180 } });
  c.centrarEn(160, 90);
  c.actualizar(1 / 60, 165, 90);
  assert.equal(c.x, 0, "dentro de la zona muerta no se mueve");
  for (let i = 0; i < 300; i++) c.actualizar(1 / 60, 2000, 90);
  assert.equal(c.x, 680, "se detiene en el límite del mundo");
  c.sacudir(1);
  c.actualizar(0.016, 2000, 90);
  const s = c.sacudida;
  assert.ok(Math.abs(s.x) + Math.abs(s.y) > 0);
});

test("animador: eventos por cuadro sin saltarse ninguno y clips de Aseprite", () => {
  const a = new Animador({ correr: { cuadros: [0, 1, 2, 3], fps: 10, bucle: true, eventos: { 1: "pisada", 3: "pisada" } }, golpe: { cuadros: [4, 5], fps: 10, bucle: false, siguiente: "correr" } }, "correr");
  assert.deepEqual(a.actualizar(0.45), ["pisada", "pisada"]);
  a.reproducir("golpe");
  a.actualizar(0.25);
  assert.equal(a.clip, "correr");
  const clips = clipsDesdeAseprite({ frames: [{ duration: 100 }, { duration: 100 }, { duration: 50 }], meta: { frameTags: [{ name: "idle", from: 0, to: 1 }, { name: "hit", from: 2, to: 2 }] } }, ["idle"]);
  assert.equal(clips.idle.fps, 10);
  assert.equal(clips.hit.fps, 20);
});

test("pool reutiliza objetos", () => {
  const p = new Pool(() => ({ v: 0 }), (o) => (o.v = 0), 2);
  const a = p.adquirir();
  a.v = 9;
  p.liberar(a);
  assert.equal(p.adquirir().v, 0);
  assert.equal(p.creados, 2);
});
