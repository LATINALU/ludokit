import { test } from "node:test";
import assert from "node:assert/strict";
import { Celda, Grilla, mascaraAutotile } from "../src/contextos/fisica/dominio/grilla.ts";
import { Cuerpo, mover, sobrePlataforma } from "../src/contextos/fisica/dominio/cuerpo.ts";
import { MANDO_QUIETO, Plataformero, type Mando } from "../src/contextos/fisica/dominio/plataformero.ts";
import { alturaSalto, ARQUETIPOS, crearPerfil, PERFIL_BASE } from "../src/contextos/fisica/dominio/perfil.ts";
import { MovilSuperior } from "../src/contextos/fisica/dominio/vista-superior.ts";
import { apuntarArco, Proyectil } from "../src/contextos/fisica/dominio/proyectil.ts";
import { HashEspacial } from "../src/espacial/hash-espacial.ts";
import { aabbContacto, barrerCaja, circuloCaja, rayoCaja, rayoCirculo, rectAPoligono, satPoligonos } from "../src/espacial/colision.ts";
import { hayVision, raycastGrilla } from "../src/espacial/raycast-grilla.ts";

const DT = 1 / 60;
const sala = () =>
  Grilla.desdeTexto([
    "##############################",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#............................#",
    "#...====.............#####...#",
    "#....................#####...#",
    "#....................#####...#",
    "#.........#..........#####...#",
    "#.........#..........#####...#",
    "##############################",
  ]);

const mando = (m: Partial<Mando>): Mando => ({ ...MANDO_QUIETO, ...m });

test("física: cae y se apoya, pared frena, plataforma de un sentido, autotile", () => {
  const g = sala();
  const c = new Cuerpo(40, 100, 10, 20);
  for (let i = 0; i < 120; i++) {
    c.vy = Math.min(430, c.vy + 1100 * DT);
    mover(c, g, DT);
  }
  assert.ok(c.enSuelo);
  assert.equal(c.y, 15 * 16 - 20);
  c.teletransportar(130, 220);
  for (let i = 0; i < 60; i++) {
    c.vx = 120;
    c.vy += 1100 * DT;
    mover(c, g, DT);
  }
  assert.equal(c.x, 160 - 10);
  assert.equal(c.pared, 1);
  const p = new Cuerpo(70, 200, 10, 20);
  p.vy = -400;
  for (let i = 0; i < 60; i++) {
    p.vy += 1100 * DT;
    mover(p, g, DT);
  }
  assert.equal(p.y + p.h, 160, "atraviesa desde abajo y se apoya arriba");
  assert.ok(sobrePlataforma(p, g));
  assert.equal(mascaraAutotile(g, 10, 13), 1 | 2 | 8);
  assert.equal(g.celda(-5, -5), Celda.VACIO);
});

test("física: corrección de esquinas sube una cornisa baja", () => {
  const g = Grilla.desdeTexto(["..........", "..........", "......####", "##########"]);
  const c = new Cuerpo(10, 48 - 20 - 3, 10, 20);
  // Pies 3 px por debajo del borde de la cornisa (fila 2 = y 32..48): con esquinas=4 la sube.
  c.y = 32 + 3 - 20;
  c.vx = 100;
  for (let i = 0; i < 80; i++) mover(c, g, DT, { esquinas: 4 });
  assert.ok(c.x > 96, `pasó por encima: x=${c.x}`);
});

test("plataformero: salto variable, coyote, búfer, ímpetu, dash y altura de salto", () => {
  const g = sala();
  const j = new Plataformero(40, 200);
  for (let i = 0; i < 30; i++) j.actualizar(DT, MANDO_QUIETO, g);
  assert.ok(j.cuerpo.enSuelo);
  const piso = j.cuerpo.y;
  // Salto completo vs. salto corto
  const alto = (soltarEn: number): number => {
    const k = new Plataformero(40, piso);
    for (let i = 0; i < 5; i++) k.actualizar(DT, MANDO_QUIETO, g);
    let min = k.cuerpo.y;
    for (let i = 0; i < 90; i++) {
      const m = mando({ salto: i < soltarEn, saltoRecien: i === 0, saltoSoltado: i === soltarEn });
      k.actualizar(DT, m, g);
      min = Math.min(min, k.cuerpo.y);
    }
    return piso - min;
  };
  const largo = alto(60);
  const corto = alto(4);
  assert.ok(largo > corto * 1.8, `variable: largo ${largo} corto ${corto}`);
  assert.ok(Math.abs(largo - alturaSalto(PERFIL_BASE)) < 20, `altura ${largo} ≈ ${alturaSalto(PERFIL_BASE)}`);
  // Búfer: apretar salto 5 pasos antes de tocar el suelo también salta.
  const b = new Plataformero(40, piso - 30);
  let salto = false;
  for (let i = 0; i < 60; i++) {
    b.actualizar(DT, mando({ saltoRecien: i === 8, salto: i >= 8 && i < 40 }), g);
    if (b.eventos.vaciar().some((e) => e.tipo === "salto")) salto = true;
  }
  assert.ok(salto, "búfer de salto");
  // Ímpetu: corriendo sin parar se llena.
  const r = new Plataformero(180, piso);
  for (let i = 0; i < 72; i++) r.actualizar(DT, mando({ eje: 1 }), g);
  assert.ok(r.impetu > 0.5, `ímpetu ${r.impetu}`);
  // Dash
  const d = new Plataformero(30, piso);
  d.actualizar(DT, mando({ dashRecien: true }), g);
  assert.ok(d.dashT > 0 && Math.abs(d.cuerpo.vx) > 300);
});

test("plataformero: se cuelga de una cornisa y trepa", () => {
  const g = sala();
  // Columna de roca 22..26 empieza en la fila 10 (y = 160). Saltar contra ella desde la izquierda.
  const j = new Plataformero(330, 220);
  for (let i = 0; i < 20; i++) j.actualizar(DT, MANDO_QUIETO, g);
  let colgo = false;
  let trepo = false;
  for (let i = 0; i < 120; i++) {
    j.actualizar(DT, trepo ? MANDO_QUIETO : mando({ eje: 1, saltoRecien: i === 0, salto: i < 40 }), g);
    for (const e of j.eventos.vaciar()) {
      if (e.tipo === "borde" && e.accion === "colgarse") colgo = true;
      if (e.tipo === "borde" && e.accion === "trepar") trepo = true;
    }
  }
  assert.ok(colgo && trepo, `colgó ${colgo} trepó ${trepo}`);
  assert.ok(j.cuerpo.y + j.cuerpo.h <= 160.01, "terminó arriba de la cornisa");
});

test("perfiles: multiplicadores con límites", () => {
  const p = crearPerfil({ vel: 2, salto: 0.5, paredes: true });
  assert.equal(p.vel, PERFIL_BASE.vel * 1.08);
  assert.equal(p.salto, PERFIL_BASE.salto * 0.96);
  assert.equal(p.paredes, true);
});

test("vista superior: diagonal normalizada y choque con pared", () => {
  const m = new MovilSuperior(100, 100);
  for (let i = 0; i < 60; i++) m.actualizar(DT, 1, 1, null);
  assert.ok(Math.abs(Math.hypot(m.cuerpo.vx, m.cuerpo.vy) - 90) < 1e-6);
  const g = sala();
  const n = new MovilSuperior(20, 100);
  for (let i = 0; i < 60; i++) n.actualizar(DT, -1, 0, g);
  assert.equal(n.cuerpo.x, 16);
});

test("proyectiles: tiro en arco cae en el objetivo", () => {
  const g = 600;
  const v = apuntarArco({ x: 0, y: 0 }, { x: 200, y: 40 }, g);
  const p = new Proyectil(0, 0, v.vx, v.vy, { velocidad: 0, aceleracion: 0, gravedad: g, vida: 10, radio: 2, atraviesaRoca: true, giro: 0 });
  const pasos = Math.round(v.t / 0.001);
  for (let i = 0; i < pasos; i++) p.actualizar(0.001);
  assert.ok(Math.hypot(p.x - 200, p.y - 40) < 1.5, `${p.x},${p.y}`);
});

test("hash espacial: consulta, mover, cercanos y pares", () => {
  const h = new HashEspacial<string>(32);
  h.insertar("a", { x: 0, y: 0, w: 10, h: 10 });
  h.insertar("b", { x: 5, y: 5, w: 10, h: 10 });
  h.insertar("c", { x: 500, y: 500, w: 10, h: 10 });
  assert.deepEqual(h.consultar({ x: 0, y: 0, w: 20, h: 20 }).sort(), ["a", "b"]);
  assert.deepEqual(h.pares().map((p) => p.sort().join()), ["a,b"]);
  h.mover("c", { x: 12, y: 0, w: 4, h: 4 });
  assert.deepEqual(h.cercanos(0, 0, 30), ["a", "b", "c"]);
  h.quitar("a");
  assert.equal(h.tamano, 2);
});

test("colisión: AABB, círculo, barrido continuo, rayos y SAT", () => {
  const c = aabbContacto({ x: 0, y: 0, w: 10, h: 10 }, { x: 8, y: 0, w: 10, h: 10 });
  assert.deepEqual(c, { nx: -1, ny: 0, profundidad: 2 });
  assert.ok(circuloCaja({ x: 5, y: -2, r: 3 }, { x: 0, y: 0, w: 10, h: 10 })!.ny === -1);
  const b = barrerCaja({ x: 0, y: 0, w: 4, h: 4 }, 1000, 0, { x: 100, y: -10, w: 10, h: 30 });
  assert.ok(b && Math.abs(b.t - 0.096) < 1e-9 && b.nx === -1, "la bala rápida no atraviesa");
  assert.equal(rayoCaja(0, 5, 1, 0, { x: 10, y: 0, w: 5, h: 10 })!.t, 10);
  assert.equal(rayoCirculo(0, 0, 1, 0, { x: 10, y: 0, r: 2 }), 8);
  const s = satPoligonos(rectAPoligono({ x: 0, y: 0, w: 10, h: 10 }, Math.PI / 4), rectAPoligono({ x: 12, y: 0, w: 10, h: 10 }));
  assert.ok(s && s.profundidad > 0 && s.nx < 0);
  assert.equal(satPoligonos(rectAPoligono({ x: 0, y: 0, w: 10, h: 10 }), rectAPoligono({ x: 30, y: 0, w: 10, h: 10 })), null);
});

test("raycast DDA en grilla y línea de visión", () => {
  const g = sala();
  const sol = (c: number, f: number) => g.celda(c, f) === Celda.ROCA;
  const r = raycastGrilla(40, 220, 1, 0, 1000, 16, sol);
  assert.equal(r!.c, 10);
  assert.ok(Math.abs(r!.x - 160) < 1e-9 && r!.nx === -1);
  assert.ok(hayVision(40, 100, 300, 100, 16, sol));
  assert.ok(!hayVision(40, 220, 300, 220, 16, sol));
});

test("guía: arquetipo + reemplazos (saltos aéreos) dan doble salto", () => {
  const p = crearPerfil(ARQUETIPOS.ligero, { saltosAereos: 1 });
  assert.equal(p.saltosAereos, 1);
  assert.ok(p.vel > PERFIL_BASE.vel);
  const g = sala();
  const j = new Plataformero(40, 200, 10, 20, p);
  for (let i = 0; i < 30; i++) j.actualizar(DT, MANDO_QUIETO, g);
  const clases: string[] = [];
  for (let i = 0; i < 40; i++) {
    j.actualizar(DT, mando({ saltoRecien: i === 0 || i === 20, salto: true }), g);
    for (const e of j.eventos.vaciar()) if (e.tipo === "salto") clases.push(e.clase);
  }
  assert.deepEqual(clases, ["suelo", "aereo"]);
});
