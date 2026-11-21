import { test } from "node:test";
import assert from "node:assert/strict";
import { RelojManual, Pcg32, economia, inventario, mundo, roguelite, fisica, red, motor } from "../src/index.ts";

test("raíz: espacios de nombres por contexto", () => {
  assert.equal(typeof fisica.Plataformero, "function");
  assert.equal(typeof red.ServidorAutoritativo, "function");
  assert.equal(typeof motor.MundoEcs, "function");
  assert.ok(new Pcg32(1).u32() >= 0);
});

test("caso de uso comprar: transacción + libro contable; inventario lleno no cobra", async () => {
  const uow = new economia.MemoriaEconomia();
  const inv = new inventario.Inventario({ pestanas: 1, casillasPorPestana: 1, maxPila: () => 1 });
  uow.jugadores.set("j1", { id: "j1", nivel: 5, inventario: inv, billetera: new economia.Billetera({ oro: 5000 }) });
  const catalogo = new economia.Catalogo([{ tienda: "npc", pestana: 0, objeto: 7, precio: 2000 }]);
  const dep = { uow, catalogo, reloj: new RelojManual(1000) };
  const r = await economia.casoComprar(dep, "j1", "npc", 7);
  assert.ok(r.ok);
  assert.equal(uow.jugadores.get("j1")!.billetera.saldo("oro"), 3000);
  assert.deepEqual(uow.movimientos.map((m) => [m.delta, m.motivo]), [[-2000, "tienda:npc"]]);
  const r2 = await economia.casoComprar(dep, "j1", "npc", 7);
  assert.equal(r2.ok, false);
  assert.equal(uow.jugadores.get("j1")!.billetera.saldo("oro"), 3000, "sin espacio: no se cobra");
  assert.equal(uow.movimientos.length, 1);
  assert.equal((await economia.casoComprar(dep, "nadie", "npc", 7)).ok, false);
});

test("caso de uso muerte y recuperación del legado", () => {
  const reg = new roguelite.RegistroLegados<string[]>();
  const inc = { llevado: ["espada", "oro:50"], nivel: 4, vivo: true };
  const { legado } = roguelite.resolverMuerte(inc, reg, { nombre: "Ana" }, "caída", () => []);
  assert.deepEqual(inc.llevado, []);
  assert.ok(roguelite.recuperarLegado(inc, reg, legado.uid, (a, b) => [...a, ...b]));
  assert.deepEqual(inc.llevado, ["espada", "oro:50"]);
});

test("caso de uso generar nivel: mismo nivel con la misma semilla, salas construidas a demanda", () => {
  const a = mundo.generarNivel(123, 3, { salas: 18 });
  const b = mundo.generarNivel(123, 3, { salas: 18 });
  assert.deepEqual(a.mapa, b.mapa);
  const s = a.sala(a.mapa.jefe);
  assert.equal(s, a.sala(a.mapa.jefe), "cacheada");
  assert.ok(mundo.alturaMaxObstaculo(s) <= 3);
});
