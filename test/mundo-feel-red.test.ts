import { test } from "node:test";
import assert from "node:assert/strict";
import { bandas, fbm, ruidoTileable, ruidoValor } from "../src/contextos/mundo/dominio/ruido.ts";
import { alcanzables, generarMazmorra, resolver } from "../src/contextos/mundo/dominio/mazmorra.ts";
import { alturaMaxObstaculo, construirSala } from "../src/contextos/mundo/dominio/sala-plataformas.ts";
import { generarCuevas } from "../src/contextos/mundo/dominio/cuevas.ts";
import { Celda } from "../src/contextos/fisica/dominio/grilla.ts";
import { haySalida, RegistroLegados } from "../src/contextos/roguelite/dominio/extraccion.ts";
import { DirectorImpacto } from "../src/contextos/feel/dominio/impacto.ts";
import { Elastico, muelleDesdeFrecuencia } from "../src/contextos/feel/dominio/muelles.ts";
import { Cuerda, CUERDAS } from "../src/contextos/feel/dominio/verlet.ts";
import { CampoFuerza, Campos } from "../src/contextos/feel/dominio/campos.ts";
import { Particulas } from "../src/contextos/feel/dominio/particulas.ts";
import { AlmacenMemoria, Guardado } from "../src/infraestructura/persistencia/guardado.ts";
import { BuferInterpolacion, PrediccionCliente, ServidorAutoritativo, type EntradaRed, type MundoServidor, type Snapshot } from "../src/red/netcode.ts";
import { CanalSimulado, RED_MALA } from "../src/red/simulacion-red.ts";
import { GestorInteres } from "../src/red/interes.ts";
import { aplicarDelta, calcularDelta, HistorialBaselines } from "../src/red/delta.ts";
import { HistorialPosiciones, LimitadorTasa, RelojSincronizado } from "../src/red/utilidades-red.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

test("ruido: rango, determinismo y tileable sin costura", () => {
  for (let i = 0; i < 100; i++) {
    const v = fbm(i * 0.37, i * 0.11, { semilla: 3 });
    assert.ok(v >= 0 && v < 1);
  }
  assert.equal(ruidoValor(1.5, 2.5, 9), ruidoValor(1.5, 2.5, 9));
  assert.ok(Math.abs(ruidoTileable(0.3, 0.7, 8, 8) - ruidoTileable(8.3, 8.7, 8, 8)) < 1e-12);
  assert.equal(bandas(0.5, [[0.3, "agua"], [0.6, "pasto"], [1, "roca"]]), "pasto");
});

test("mazmorra: 100 semillas válidas, llave alcanzable antes de la cerradura, especiales", () => {
  const cerraduras = { cristal: "dash" };
  for (let s = 0; s < 100; s++) {
    const m = generarMazmorra({ salas: 20, semilla: s, cerraduras, llaveAColocar: "dash", especiales: [{ tipo: "tesoro", cantidad: 1, donde: "hoja" }, { tipo: "arena", cantidad: 1, donde: "lejos" }] });
    const r = resolver(m, [], cerraduras);
    assert.ok(r.alcanzables.has(m.jefe), `semilla ${s}: jefe alcanzable`);
    assert.equal(r.alcanzables.size, m.salas.length, `semilla ${s}: todo alcanzable con la llave`);
    for (const c of m.conexiones) assert.ok(c.a !== c.b);
  }
  const m = generarMazmorra({ salas: 24, semilla: 4, cerraduras, llavesPoseidas: ["dash"], probCerradura: 1 });
  assert.ok(m.conexiones.some((c) => c.cerradura === "cristal"));
  assert.ok(alcanzables(m, m.inicio, new Set(), cerraduras).size < m.salas.length, "sin la llave hay salas cerradas");
});

test("sala de plataformas: puertas abiertas y obstáculos saltables (200 semillas)", () => {
  for (let s = 0; s < 200; s++) {
    const sala = construirSala({ puertas: { izq: true, der: true, arr: true, aba: true }, semilla: s });
    assert.ok(alturaMaxObstaculo(sala) <= 3, `semilla ${s}`);
    assert.equal(sala.grilla.celda(0, sala.filaSuelo - 2), Celda.VACIO);
    assert.equal(sala.grilla.celda(29, sala.filaSuelo - 2), Celda.VACIO);
    assert.equal(sala.grilla.celda(15, 0), Celda.VACIO);
  }
});

test("cuevas: una sola región conectada", () => {
  const g = generarCuevas({ cols: 60, filas: 40, semilla: 2 });
  let vacias = 0;
  let inicio: [number, number] | null = null;
  for (let f = 0; f < 40; f++) for (let c = 0; c < 60; c++) if (g.celda(c, f) === Celda.VACIO) {
    vacias++;
    inicio ??= [c, f];
  }
  assert.ok(vacias > 300);
  const vistos = new Set<number>([inicio![1] * 60 + inicio![0]]);
  const pila = [inicio!];
  while (pila.length) {
    const [c, f] = pila.pop()!;
    for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (f + df) * 60 + c + dc;
      if (g.celda(c + dc, f + df) === Celda.VACIO && !vistos.has(k)) {
        vistos.add(k);
        pila.push([c + dc, f + df]);
      }
    }
  }
  assert.equal(vistos.size, vacias);
});

test("legados: reemplazo por nivel, máximo y recuperar botín; salida con piedad", () => {
  const r = new RegistroLegados<string[]>(2);
  r.morir(3, ["espada"], {}, "caída");
  const { perdidos } = r.morir(3, ["hacha"], {}, "jefe");
  assert.deepEqual(perdidos.map((l) => l.botin), [["espada"]]);
  r.morir(4, ["arco"], {}, "x");
  r.morir(5, ["vara"], {}, "x");
  assert.equal(r.todos.length, 2);
  assert.deepEqual(r.recuperar(r.enNivel(5)[0].uid), ["vara"]);
  const az = new Pcg32(9);
  const est = { sinSalida: 0 };
  let max = 0, seguidas = 0;
  for (let p = 0; p < 300; p++) {
    seguidas = haySalida(az, 60, est, { probBase: 0.55, caidaPorNivel: 0.012, probMin: 0.18, piedad: 3, jefeCada: 5 }) ? 0 : seguidas + 1;
    max = Math.max(max, seguidas);
  }
  assert.ok(max <= 3);
});

test("feel: hitstop devuelve dt 0, cámara lenta, trauma decae", () => {
  const d = new DirectorImpacto();
  d.aplicar("fuerte");
  assert.equal(d.paso(1 / 60), 0);
  for (let i = 0; i < 10; i++) d.paso(1 / 60);
  assert.equal(d.paso(1 / 60), 1 / 60);
  d.aplicar("esquivaPerfecta");
  assert.ok(Math.abs(d.paso(0.1) - 0.035) < 1e-12);
  for (let i = 0; i < 200; i++) d.paso(1 / 60);
  assert.equal(d.trauma, 0);
});

test("muelles: vuelve al reposo; elástico conserva el área", () => {
  const m = muelleDesdeFrecuencia(3, 0.4, 0);
  m.objetivo = 1;
  let pasa = false;
  for (let i = 0; i < 600; i++) if (m.actualizar(1 / 120) > 1) pasa = true;
  assert.ok(pasa, "sub-amortiguado: se pasa del objetivo");
  assert.ok(Math.abs(m.valor - 1) < 0.01);
  const e = new Elastico();
  e.impulsar(-0.4);
  const d = e.deformacion();
  assert.ok(Math.abs(d.escalaX * d.escalaY - 1) < 1e-9);
  for (let i = 0; i < 240; i++) e.actualizar(1 / 60);
  assert.ok(Math.abs(e.deformacion().escalaY - 1) < 0.01);
});

test("verlet: cuelga recta, conserva el largo, el repulsor la aparta, no atraviesa roca", () => {
  const c = new Cuerda(100, 50, CUERDAS.cadena);
  for (let k = 0; k < 300; k++) c.simular(1 / 60, k / 60);
  const p = c.puntos();
  assert.ok(Math.abs(p[p.length - 1][0] - 100) < 3);
  const ideal = CUERDAS.cadena.segmento * (CUERDAS.cadena.nodos - 1);
  assert.ok(Math.abs(c.largoActual() - ideal) / ideal < 0.05);
  const c2 = new Cuerda(100, 50, CUERDAS.cadena);
  const campos = new Campos();
  campos.disparar(new CampoFuerza(80, 80, 80, 3000), 10);
  for (let k = 0; k < 20; k++) c2.simular(1 / 60, k / 60, { campos: campos.activos });
  assert.ok(c2.puntos()[CUERDAS.cadena.nodos - 1][0] > 103);
  const c3 = new Cuerda(100, 50, CUERDAS.cadena);
  for (let k = 0; k < 200; k++) c3.simular(1 / 60, k / 60, { solido: (_x, y) => y >= 70 });
  assert.ok(c3.puntos().every(([, y]) => y < 71));
});

test("partículas: SoA, pegarse al suelo, rebotar, morir", () => {
  const ps = new Particulas(100);
  const az = new Pcg32(1);
  ps.rafaga(az, "fragmento", 50, 50, 20, { a0: Math.PI / 2 - 0.3, a1: Math.PI / 2 + 0.3, v0: 50, v1: 100, vida: [5, 5] });
  for (let i = 0; i < 120; i++) ps.actualizar(1 / 60, { solido: (_x, y) => y >= 100 });
  assert.equal(ps.vivas, 20);
  for (let i = 0; i < ps.vivas; i++) assert.ok(ps.pegada[i] === 1 && ps.y[i] < 100);
  ps.rafaga(az, "chispa", 0, 0, 10, { vida: [0.1, 0.2] });
  ps.actualizar(0.5);
  assert.equal(ps.vivas, 20);
});

test("guardado: versión, migraciones, respaldo y apartar corruptos", async () => {
  const al = new AlmacenMemoria();
  const v1 = new Guardado<{ oro: number }>(al, { version: 1, porDefecto: () => ({ oro: 0 }) });
  assert.equal((await v1.cargar()).estado, "nuevo");
  await v1.guardar({ oro: 50 });
  const v2 = new Guardado<{ monedas: { oro: number } }>(al, { version: 2, porDefecto: () => ({ monedas: { oro: 0 } }), migraciones: { 1: (d) => ({ monedas: { oro: d.oro } }) } });
  const r = await v2.cargar();
  assert.equal(r.estado, "cargado");
  assert.deepEqual(r.datos, { monedas: { oro: 50 } });
  await v2.guardar({ monedas: { oro: 60 } });
  assert.ok(al.datos.has("partida.respaldo"));
  al.datos.set("partida", al.datos.get("partida")!.replace('"oro":60', '"oro":99999'));
  const r2 = await v2.cargar();
  assert.equal(r2.estado, "apartado");
  assert.ok(r2.estado === "apartado" && r2.motivo === "suma-invalida");
  assert.ok(await v2.restaurarRespaldo());
  assert.equal((await v2.cargar()).estado, "cargado");
});

// ---- Netcode de punta a punta: 2 clientes, red mala (latencia, jitter, pérdida, desorden), servidor a 30 Hz.
type Est = { x: number; y: number };
type Ent = { dx: number; dy: number };
const VEL = 100;
const aplicar = (s: Est, e: Ent, dt: number): Est => ({ x: s.x + e.dx * VEL * dt, y: s.y + e.dy * VEL * dt });

test("netcode: predicción + reconciliación convergen con red mala; interpolación y AOI", () => {
  const az = new Pcg32(77);
  const jugadores = new Map<string, Est>([["a", { x: 0, y: 0 }], ["b", { x: 50, y: 0 }]]);
  const interes = new GestorInteres(400, 480);
  const mundo: MundoServidor<Est, Ent> = {
    aplicarEntrada: (j, e, dt) => jugadores.set(j, aplicar(jugadores.get(j)!, e, dt)),
    simular: () => {
      for (const [id, p] of jugadores) interes.mover(id, p.x, p.y);
    },
    estadoDe: (id) => jugadores.get(id),
    visiblesPara: (j) => interes.actualizar(j).visibles,
    validar: (_j, e) => Math.abs(e.datos.dx) <= 1 && Math.abs(e.datos.dy) <= 1,
  };
  const srv = new ServidorAutoritativo(mundo, 30);
  srv.conectar("a");
  srv.conectar("b");
  const subida = new CanalSimulado<EntradaRed<Ent>>(RED_MALA, az);
  const bajada = new CanalSimulado<Snapshot<Est>>(RED_MALA, az);
  const cli = new PrediccionCliente<Est, Ent>({ x: 0, y: 0 }, aplicar, (p, q) => Math.hypot(p.x - q.x, p.y - q.y));
  const remoto = new BuferInterpolacion<Est>((p, q, k) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }), 0.1);
  const dt = 1 / 30;
  let t = 0;
  let ultimaEntrada: EntradaRed<Ent> | null = null;
  for (let i = 0; i < 300; i++) {
    t += dt;
    const e = cli.entrada({ dx: i < 200 ? 1 : 0, dy: 0 }, dt);
    // Redundancia: se reenvía también la entrada anterior (cubre la pérdida de un paquete).
    if (ultimaEntrada) subida.enviar(ultimaEntrada, t);
    subida.enviar(e, t);
    ultimaEntrada = e;
    for (const m of subida.recibir(t)) srv.recibir("a", m);
    srv.recibir("b", { seq: i + 1, dt, datos: { dx: 0, dy: 0.5 } });
    const snaps = srv.paso();
    bajada.enviar(snaps.get("a")!, t);
    for (const s of bajada.recibir(t)) {
      cli.reconciliar(s);
      if (s.otros.b) remoto.agregar(s.tiempo, s.otros.b);
    }
  }
  // Dejar que llegue todo lo que está en vuelo.
  for (let i = 0; i < 30; i++) {
    t += dt;
    for (const m of subida.recibir(t)) srv.recibir("a", m);
    const s = srv.paso().get("a")!;
    bajada.enviar(s, t);
    for (const x of bajada.recibir(t)) cli.reconciliar(x);
  }
  const real = jugadores.get("a")!;
  assert.ok(subida.perdidos > 0, "hubo pérdida de paquetes");
  assert.ok(Math.abs(cli.estado.x - real.x) < 1e-6, `cliente ${cli.estado.x} = servidor ${real.x}`);
  assert.ok(real.x > 600, `el servidor aplicó casi todas las entradas (${real.x})`);
  const b = remoto.muestrear(srv.tiempo)!;
  assert.ok(b && b.y > 0 && b.x === 50, "b interpolado");
});

test("interés: entra/sale con histéresis", () => {
  const g = new GestorInteres(100, 150);
  g.mover("yo", 0, 0);
  g.mover("o", 90, 0);
  assert.deepEqual(g.actualizar("yo").entran, ["o"]);
  g.mover("o", 130, 0);
  assert.equal(g.actualizar("yo").salen.length, 0, "dentro de la histéresis sigue visible");
  g.mover("o", 200, 0);
  assert.deepEqual(g.actualizar("yo").salen, ["o"]);
});

test("delta, baselines, reloj sincronizado, compensación de lag y limitador", () => {
  const a = { x: 1, y: 2, hp: 10 };
  const b = { x: 1, y: 3, mp: 5 };
  const d = calcularDelta(a, b);
  assert.deepEqual(d, { cambios: { y: 3, mp: 5 }, quitados: ["hp"] });
  assert.deepEqual(aplicarDelta(a, d), b);
  const h = new HistorialBaselines<typeof a>();
  h.registrar(1, a);
  assert.equal(h.deltaDesde(1, a).base, 1);
  assert.equal(h.deltaDesde(99, a).base, null);
  const r = new RelojSincronizado();
  r.muestra(0, 10.05, 10.06, 0.11);
  assert.ok(Math.abs(r.offset - 10) < 1e-9 && Math.abs(r.rtt - 0.1) < 1e-9);
  const hp = new HistorialPosiciones(1);
  hp.registrar("e", 0, 0, 0);
  hp.registrar("e", 0.1, 10, 0);
  assert.deepEqual(hp.en("e", 0.05), { x: 5, y: 0 });
  const lim = new LimitadorTasa(3, 1, 0);
  assert.deepEqual([lim.permitir(0), lim.permitir(0), lim.permitir(0), lim.permitir(0), lim.permitir(1)], [true, true, true, false, true]);
});
