import { test } from "node:test";
import assert from "node:assert/strict";
import { Consola } from "../src/motor/consola.ts";
import { ControlesTactiles } from "../src/motor/tactil.ts";
import { Entrada } from "../src/motor/entrada.ts";
import { Textos } from "../src/nucleo/textos.ts";
import { actualizarSuelto, soltar } from "../src/contextos/fisica/dominio/iman.ts";
import { elegirPlantilla, validarPlantilla, type Plantilla } from "../src/contextos/mundo/dominio/plantillas.ts";
import { MapaExplorado } from "../src/contextos/mundo/dominio/exploracion.ts";
import { generarMazmorra } from "../src/contextos/mundo/dominio/mazmorra.ts";
import { Celda } from "../src/contextos/fisica/dominio/grilla.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

test("consola: argumentos tipados, comillas, ayuda, error aislado y aislamiento del guardado", () => {
  const c = new Consola();
  let oro = 0;
  let aislado = 0;
  c.alModificar = () => aislado++;
  c.registrar({ nombre: "oro", ayuda: "Da oro", args: [{ nombre: "cantidad", tipo: "entero" }], modifica: true, ejecutar: ([n]) => void (oro += n as number) });
  c.registrar({ nombre: "decir", ayuda: "Eco", args: [{ nombre: "texto", tipo: "texto" }], ejecutar: ([t]) => String(t) });
  c.registrar({ nombre: "romper", ayuda: "Falla", ejecutar: () => { throw new Error("ups"); } });
  assert.equal(c.ejecutar("decir hola").salida, "hola", "un comando de solo lectura no aísla");
  assert.equal(aislado, 0);
  assert.ok(c.ejecutar("/oro 50").ok);
  c.ejecutar("oro 10");
  assert.equal(oro, 60);
  assert.equal(aislado, 1, "aísla una sola vez");
  assert.equal(c.ejecutar("oro abc").ok, false);
  assert.match(c.ejecutar("oro").salida, /Falta/);
  assert.match(c.ejecutar("ror").salida, /desconocido/);
  assert.deepEqual(Consola.separar('dar "espada larga" 2'), ["dar", "espada larga", "2"]);
  assert.match(c.ejecutar("romper").salida, /Error: ups/);
  assert.deepEqual(c.completar("d"), ["decir"]);
  assert.match(c.ejecutar("ayuda oro").salida, /<cantidad>/);
});

test("táctil: joystick flotante con zona muerta que sigue al dedo, botones multitáctiles", () => {
  const t = new ControlesTactiles(800, 450, [{ accion: "saltar", x: 700, y: 380, radio: 40 }], 60, 0.2);
  t.tocar(1, 100, 300);
  t.mover(1, 105, 300);
  assert.deepEqual(t.eje, { x: 0, y: 0 }, "zona muerta");
  t.mover(1, 160, 300);
  assert.ok(Math.abs(t.eje.x - 1) < 1e-9);
  t.mover(1, 300, 300);
  assert.equal(t.centro!.x, 240, "el centro sigue al dedo");
  t.tocar(2, 700, 380);
  assert.ok(t.pulsado("saltar"));
  const e = new Entrada({ saltar: ["tactil:saltar"], der: ["tactil:x+"] });
  t.aplicarA(e);
  e.muestrear(1 / 60);
  assert.ok(e.pulsada("saltar") && e.pulsada("der"));
  t.soltar(1);
  t.soltar(2);
  assert.ok(!t.pulsado("saltar") && t.centro === null);
});

test("textos: claves, respaldo, variables, plurales, faltantes y tabla de texto", () => {
  const tx = new Textos("en", "es");
  tx.cargar("es", { "tienda.comprar": "Comprar {objeto}", "enemigos": "Quedan {n} {n|enemigo|enemigos}", "solo.es": "Hola" });
  tx.cargar("en", { "tienda.comprar": "Buy {objeto}", "enemigos": "{n} {n|enemy|enemies} left" });
  assert.equal(tx.t("tienda.comprar", { objeto: "Sword" }), "Buy Sword");
  assert.equal(tx.t("enemigos", { n: 1 }), "1 enemy left");
  assert.equal(tx.t("enemigos", { n: 3 }), "3 enemies left");
  assert.equal(tx.t("solo.es"), "Hola", "respaldo");
  assert.equal(tx.t("no.existe"), "no.existe");
  assert.ok(tx.faltantes.has("no.existe"));
  assert.deepEqual(tx.sinTraducir("en"), ["solo.es"]);
  assert.deepEqual(Textos.leerTabla("# comentario\nA.B\tHola mundo\nC  Dos\\nlíneas"), { "A.B": "Hola mundo", C: "Dos\nlíneas" });
});

test("imán: cae, rebota, espera y vuela a la mano", () => {
  const o = soltar(100, 100, 0.5, 0.5);
  let recogido = false;
  for (let i = 0; i < 30; i++) actualizarSuelto(o, 1 / 60, 400, 100, () => 120);
  assert.ok(o.y <= 120 && !o.atraido, "lejos: queda en el suelo");
  for (let i = 0; i < 240 && !recogido; i++) recogido = actualizarSuelto(o, 1 / 60, 120, 110, () => 120);
  assert.ok(recogido && o.recogido);
});

test("plantillas: validación, compatibilidad con aberturas (incluido espejo) y marcadores", () => {
  const p: Plantilla = { id: "pasillo", aberturas: ["izq"], filas: ["#####", "....#", ".E.C#", "#####"] };
  assert.deepEqual(validarPlantilla(p), []);
  assert.equal(validarPlantilla({ ...p, filas: ["##", "#"] }).length, 1);
  assert.equal(validarPlantilla({ ...p, filas: ["#Z"] }).length, 1);
  const az = new Pcg32(1);
  const normal = elegirPlantilla(az, [p], ["izq"])!;
  assert.equal(normal.espejada, false);
  assert.deepEqual(normal.marcadores.map((m) => [m.tipo, m.c, m.f]), [["enemigo", 1, 2], ["cofre", 3, 2]]);
  const espejo = elegirPlantilla(az, [p], ["der"])!;
  assert.ok(espejo.espejada);
  assert.equal(espejo.grilla.celda(0, 1), Celda.ROCA);
  assert.equal(elegirPlantilla(az, [p], ["arr"]), null);
});

test("mapa explorado: visitadas, vistas por adyacencia, marcas, porcentaje y guardado", () => {
  const m = generarMazmorra({ salas: 12, semilla: 3 });
  const ex = new MapaExplorado(m);
  assert.equal(ex.vista().length, 0);
  ex.visitar(m.inicio);
  assert.ok(ex.vista().some((s) => s.estado === "vista"));
  ex.marcar(m.jefe, "jefe");
  const g = ex.exportar();
  const otro = new MapaExplorado(m, g);
  assert.equal(otro.porcentaje, 1 / m.salas.length);
  assert.ok(otro.marcadores.get(m.jefe)!.has("jefe"));
  assert.equal(ex.visitar(m.inicio), false);
});
