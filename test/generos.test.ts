import { test } from "node:test";
import assert from "node:assert/strict";
import { Pcg32 } from "../src/nucleo/pcg32.ts";
import { curva } from "../src/nucleo/escalado.ts";
import { Lanzador } from "../src/contextos/combate/dominio/lanzamiento.ts";
import { Cargas, Estamina, RecursoAcumulativo, RecursoRegenerativo } from "../src/contextos/combate/dominio/recursos.ts";
import { RendimientosDecrecientes, elegirObjetivo, tabObjetivo } from "../src/contextos/combate/dominio/control.ts";
import { Descanso, Maestria, PaseTemporada, Paragon, Reputacion } from "../src/contextos/progresion/dominio/progresion-extendida.ts";
import { DificultadAdaptativa, NivelesDificultad, escalarAlJugador } from "../src/contextos/balance/dominio/dificultad.ts";
import { Estructura, GeneradorCarriles, oroAsesinato, puedeSubirRango, recompensaUnidad } from "../src/contextos/moba/dominio/moba.ts";
import { NieblaGuerra, Sospecha, enConoDeVision, propagarRuido } from "../src/contextos/vision/dominio/vision.ts";
import { Bloqueos, Contribucion, Grupo, armarGrupos, repartirPorTirada } from "../src/contextos/grupo/dominio/grupo.ts";
import { CicloDia, Durabilidad, Infeccion, Necesidades, NodoRecoleccion, temperaturaCorporal } from "../src/contextos/supervivencia/dominio/supervivencia.ts";
import { ColaTiempo, alcanceGrilla, ordenIniciativa, probImpactoTactico } from "../src/contextos/turnos/dominio/turnos.ts";
import { Mazo, probRobarAlMenos } from "../src/contextos/mazo/dominio/mazo.ts";
import { ColaProduccion, CuadriculaConstruccion, Recolector, formacion, seleccionarRect } from "../src/contextos/estrategia/dominio/estrategia.ts";
import { Carrera, Fantasma, Vehiculo, curvaNeumatico, rubberBanding } from "../src/contextos/carreras/dominio/carreras.ts";
import { Marcador, PuntoCaptura, Reapariciones, ZonaSegura } from "../src/contextos/competitivo/dominio/modos.ts";
import { Director } from "../src/contextos/encuentros/dominio/director.ts";
import { vehiculo } from "../src/datos/vehiculos.ts";
import * as P from "../src/modelos/piezas.ts";

test("lanzamiento: casteo, empuje, interrupción con bloqueo de escuela, GCD y cola", () => {
  const l = new Lanzador(P.LANZAMIENTO_MMO);
  const bola = { id: "bola", lanzamiento: 2, escuela: "fuego" };
  assert.equal(l.lanzar(bola, false), null);
  l.actualizar(1, false);
  l.recibirGolpe();
  assert.ok(Math.abs(l.progreso - 0.25) < 1e-9, "el golpe empuja la barra");
  const ev = l.actualizar(0.1, true);
  assert.equal(ev[0].tipo, "cancelado", "moverse corta el casteo");
  l.actualizar(2, false);
  l.lanzar(bola, false);
  l.interrumpir(4);
  assert.equal(l.lanzar(bola, false), "escuela-bloqueada");
  assert.equal(l.lanzar({ id: "hielo", lanzamiento: 0, escuela: "hielo" }, false), "gcd", "el GCD del casteo interrumpido sigue");
  l.actualizar(1.5, false);
  assert.equal(l.lanzar(bola, false), "escuela-bloqueada", "4 s de bloqueo");
  assert.equal(l.lanzar({ id: "hielo", lanzamiento: 0, escuela: "hielo" }, false), null);
  assert.equal(l.lanzar({ id: "otro", lanzamiento: 0 }, false), "gcd");
  l.actualizar(1.2, false);
  const encolado: unknown[] = [];
  assert.equal(l.lanzar({ id: "rayo", lanzamiento: 0 }, false, encolado as never), null);
  assert.ok(l.actualizar(0.4, false).some((e) => e.tipo === "completado" && e.id === "rayo"), "la cola lo lanza al terminar el GCD");
  const canal = new Lanzador(P.LANZAMIENTO_MMO);
  canal.lanzar({ id: "drenar", lanzamiento: 0, canalizar: 3, ticks: 3 }, false);
  const ticks: number[] = [];
  for (let i = 0; i < 200; i++) for (const e of canal.actualizar(1 / 60, false)) if (e.tipo === "tick") ticks.push(e.numero);
  assert.deepEqual(ticks, [1, 2, 3]);
});

test("recursos: maná con pausa, furia que decae, estamina agotada, cargas", () => {
  const m = new RecursoRegenerativo(P.MANA);
  m.gastar(50);
  m.actualizar(1, false);
  assert.equal(m.actual, 50, "regla de pausa tras gastar");
  m.actualizar(2, false);
  assert.ok(m.actual > 50);
  const f = new RecursoAcumulativo(P.FURIA);
  f.golpear(100);
  assert.equal(f.actual, 15);
  f.actualizar(5, false);
  assert.equal(f.actual, 5);
  const e = new Estamina(P.ESTAMINA_ACCION);
  e.gastar(100);
  assert.ok(e.agotada && !e.puedePagar(1));
  for (let i = 0; i < 60; i++) e.actualizar(1 / 30);
  assert.equal(e.agotada, false);
  const c = new Cargas(2, 5);
  c.usar();
  c.usar();
  assert.equal(c.usar(), false);
  c.actualizar(7);
  assert.equal(c.actual, 1);
  c.actualizar(3);
  assert.equal(c.actual, 2);
});

test("control: rendimientos decrecientes, tenacidad, prioridad de torre y tab", () => {
  const r = new RendimientosDecrecientes(P.RENDIMIENTOS_PVP);
  assert.deepEqual([r.aplicar("aturdir", 2), r.aplicar("aturdir", 2), r.aplicar("aturdir", 2), r.aplicar("aturdir", 2)], [2, 1, 0.5, 0]);
  assert.equal(r.aplicar("raiz", 2, 0.5), 1);
  r.actualizar(20);
  assert.equal(r.aplicar("aturdir", 2), 2);
  const cands = [
    { id: 1, x: 3, y: 0, etiquetas: ["subdito"] },
    { id: 2, x: 6, y: 0, etiquetas: ["campeon"], atacandoA: 99 },
    { id: 3, x: 1, y: 0, etiquetas: ["subdito"], vida: 5 },
  ];
  assert.equal(elegirObjetivo({ x: 0, y: 0 }, 8, cands, [{ tipo: "atacaA", ids: [99] }, { tipo: "cercano" }])!.id, 2);
  assert.equal(elegirObjetivo({ x: 0, y: 0 }, 8, cands, [{ tipo: "cercano" }])!.id, 3);
  assert.equal(elegirObjetivo({ x: 0, y: 0 }, 8, cands, [{ tipo: "cercano" }], 1, true)!.id, 1, "pegajoso");
  assert.equal(tabObjetivo({ x: 0, y: 0 }, 0, 0.5, 10, cands)!.id, 3);
  assert.equal(tabObjetivo({ x: 0, y: 0 }, 0, 0.5, 10, cands, 3)!.id, 1);
});

test("progresión extendida: paragon sin tope, descanso, maestría por dificultad, reputación y pase", () => {
  const p = new Paragon(curva.constante(100), 1, { vida: 3 });
  p.ganar(1050);
  assert.equal(p.nivel, 10);
  assert.ok(p.asignar("vida", 3) && !p.asignar("vida", 1), "tope por atributo");
  p.ganar(1e7);
  assert.ok(p.nivel > 100000, "sin nivel máximo");
  const d = new Descanso(P.DESCANSO_MMO);
  d.descansar(1);
  assert.deepEqual(d.aplicar(1000), { total: 1600, bono: 600 });
  const m = new Maestria(P.MAESTRIA_USO);
  assert.equal(m.dificultad(5), "imposible");
  assert.equal(m.usar(1, 100).dificultad, "dificil");
  m.nivel = 80;
  assert.equal(m.usar(1, 100).dificultad, "trivial");
  const rep = new Reputacion([{ id: "a", relaciones: { b: -1, c: 0.5 } }, { id: "b" }, { id: "c" }], [[-1000, "hostil"], [0, "neutral"], [500, "amistoso"]]);
  rep.ganar("a", 600);
  assert.equal(rep.rango("a"), "amistoso");
  assert.equal(rep.rango("b"), "hostil");
  assert.equal(rep.valor("c"), 300);
  const pase = new PaseTemporada(curva.constante(100), 3, [{ nivel: 1, carril: "gratis", premio: "a" }, { nivel: 2, carril: "premium", premio: "b" }], "extra");
  pase.sumar(550);
  assert.deepEqual(pase.reclamar(), ["a", "extra", "extra"]);
  pase.premium = true;
  assert.deepEqual(pase.reclamar(), ["b"]);
});

test("dificultad: niveles infinitos, ascenso por tiempo, escalado al jugador y adaptativa", () => {
  const n = new NivelesDificultad(P.DIFICULTAD_INFINITA);
  assert.ok(n.multiplicadores(200).vida > n.multiplicadores(100).vida * 1000);
  assert.equal(n.completar(10, 400, true), 13);
  assert.equal(n.completar(10, 2000, true), 9);
  assert.equal(escalarAlJugador(30, 10, 20), 20);
  assert.equal(escalarAlJugador(15, 10, 20), 15);
  const a = new DificultadAdaptativa();
  a.muerte();
  a.muerte();
  assert.ok(a.valor < 1);
});

test("MOBA: oleadas con asedio, torre con calentamiento y protección, oro y rangos", () => {
  const g = new GeneradorCarriles(P.CARRILES_MOBA, ["arriba", "medio", "abajo"]);
  const ol = g.actualizar(65 + 30 * 2 + 1);
  assert.equal(ol.length, 9);
  assert.equal(ol[6].unidades.asedio, 1, "asedio cada 3");
  const t1 = new Estructura({ id: "t1", vida: 100, danio: 10, calentamiento: 0.4, calentamientoMax: 1.2 });
  const t2 = new Estructura({ id: "t2", vida: 100, danio: 10, calentamiento: 0, calentamientoMax: 0, requiere: ["t1"] });
  assert.deepEqual([t1.disparar(5), t1.disparar(5), t1.disparar(5), t1.disparar(5), t1.disparar(6)], [10, 14, 18, 22, 10]);
  assert.equal(t2.recibir(50, new Set()), false);
  assert.equal(t2.recibir(100, new Set(["t1"])), true);
  const oro = oroAsesinato({ asesino: 1, victima: 9, asistentes: [2, 3], rachaVictima: 4 }, P.RECOMPENSA_MOBA);
  assert.equal(oro.get(1), 600);
  assert.equal(oro.get(2), 150);
  const u = recompensaUnidad("melee", 1, [1, 2], P.RECOMPENSA_MOBA);
  assert.equal(u.oro.get(1), 21);
  assert.equal(u.exp.get(2), 60 * 0.65);
  assert.equal(puedeSubirRango("R", 5, { Q: 1, W: 1, E: 1 }, P.RANGOS_MOBA), false);
  assert.equal(puedeSubirRango("R", 6, { Q: 2, W: 2, E: 1 }, P.RANGOS_MOBA), true);
  assert.equal(puedeSubirRango("Q", 3, { Q: 2 }, P.RANGOS_MOBA), false, "límite por nivel");
});

test("visión: niebla con paredes, cono, sospecha y ruido", () => {
  const mapa = ["..........", ".....#....", ".........."];
  const n = new NieblaGuerra(10, 3, (c, f) => mapa[f][c] === "#");
  n.actualizar([{ x: 2, y: 1, radio: 8 }]);
  assert.ok(n.visible(5, 1), "se ve la pared");
  assert.ok(!n.visible(8, 1), "pero no detrás");
  n.actualizar([]);
  assert.equal(n.estado(5, 1), 1, "queda explorada");
  assert.ok(enConoDeVision(0, 0, 0, 0.5, 10, 5, 1) && !enConoDeVision(0, 0, 0, 0.5, 10, -5, 0));
  const s = new Sospecha(P.SIGILO_BASE);
  for (let i = 0; i < 60; i++) s.actualizar(1 / 60, true, 2, 1, { agachado: true });
  assert.equal(s.estado, "sospechoso");
  for (let i = 0; i < 120; i++) s.actualizar(1 / 60, true, 2, 1);
  assert.equal(s.estado, "alerta");
  const oyen = propagarRuido(0, 0, 10, [{ id: 1, x: 5, y: 0 }, { id: 2, x: 8, y: 0 }], (_a, _b, x) => (x > 6 ? 1 : 0));
  assert.deepEqual(oyen.map((o) => o.id), [1], "la pared atenúa");
});

test("grupo: roles, buscador, necesidad/codicia, bloqueos y contribución", () => {
  const g = new Grupo({ id: 1, rol: "tanque" }, 5);
  g.unir({ id: 2, rol: "danio" });
  assert.deepEqual(g.faltantes({ tanque: 1, sanador: 1, danio: 3 }), { sanador: 1, danio: 2 });
  const cola = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, rol: "danio", roles: id === 1 ? ["tanque", "danio"] : id === 2 ? ["sanador"] : ["danio"] }));
  const { grupos, resto } = armarGrupos(cola, { tanque: 1, sanador: 1, danio: 3 });
  assert.equal(grupos.length, 1);
  assert.equal(resto.length, 2);
  const r = repartirPorTirada(new Map([[1, "codicia"], [2, "necesidad"], [3, "pasar"]] as const), new Pcg32(4));
  assert.equal(r.ganador, 2, "necesidad gana a codicia");
  const b = new Bloqueos(7 * 86400000);
  assert.ok(b.marcar(1, "banda", 1000) && !b.marcar(1, "banda", 2000));
  assert.ok(b.disponible(1, "banda", 7 * 86400000 + 1));
  const c = new Contribucion();
  c.registrar(1, 90);
  c.registrar(2, 5);
  assert.deepEqual([...c.credito(0.1).keys()], [1]);
});

test("supervivencia: necesidades, temperatura, durabilidad, recolección, día y noche, infección", () => {
  const n = new Necesidades(P.NECESIDADES_SUPERVIVENCIA);
  let danio = 0;
  for (let i = 0; i < 2000; i++) danio += n.actualizar(1, "corriendo");
  assert.ok(n.efectos().includes("deshidratado") && danio > 0);
  n.reponer("sed", 50);
  assert.equal(n.valor("sed"), 50);
  assert.ok(temperaturaCorporal(37, -10, 0.9, 1) > temperaturaCorporal(37, -10, 0, 1));
  const d = new Durabilidad(100);
  d.usar(60);
  d.reparar(100, 0.1);
  assert.deepEqual([d.actual, d.max], [90, 90]);
  const nodo = new NodoRecoleccion({ id: "roble", recurso: "madera", porGolpe: [1, 3], golpes: 2, herramienta: 1, reaparicion: 10 });
  assert.equal(nodo.golpear(0, 0.5), "herramienta");
  nodo.golpear(1, 0.5);
  nodo.golpear(2, 0.5);
  assert.equal(nodo.golpear(2, 0.5), "agotado");
  assert.ok(nodo.actualizar(11));
  const dia = new CicloDia(100, P.DIA_NOCHE, 0.7);
  assert.equal(dia.actualizar(3), "atardecer");
  assert.ok(dia.luz < 1);
  const inf = new Infeccion(curva.constante(0.1));
  inf.exponer(0.1);
  let convertido = false;
  for (let i = 0; i < 20 && !convertido; i++) convertido = inf.actualizar(1);
  assert.ok(convertido);
});

test("turnos: iniciativa, cola por tiempo con vista previa, alcance y probabilidad táctica", () => {
  assert.deepEqual(ordenIniciativa([{ id: 1, velocidad: 5 }, { id: 2, velocidad: 9 }, { id: 3, velocidad: 5 }]), [2, 1, 3]);
  const c = new ColaTiempo([{ id: 1, velocidad: 10 }, { id: 2, velocidad: 20 }]);
  const vista = c.previsualizar(6);
  const reales: number[] = [];
  for (let i = 0; i < 6; i++) {
    const id = c.siguiente()!;
    reales.push(id);
    c.actuo(id);
  }
  assert.deepEqual(reales, vista);
  assert.equal(reales.filter((x) => x === 2).length, 4, "el doble de rápido actúa el doble");
  const alc = alcanceGrilla(5, 5, [0, 0], 3, (c2, f) => (c2 === 1 && f < 4 ? Infinity : 1));
  assert.ok(alc.has("0,3") && !alc.has("2,0"));
  assert.ok(probImpactoTactico(P.IMPACTO_TACTICO, 0, 5, "total", true) > probImpactoTactico(P.IMPACTO_TACTICO, 0, 5, "total", false));
});

test("mazo: robar, barajar descarte, energía, retener, mano llena", () => {
  const m = new Mazo([1, 2, 3, 4, 5, 6, 7], P.MAZO_ROGUELIKE, new Pcg32(1));
  m.empezarTurno();
  assert.equal(m.mano.length, 5);
  assert.equal(m.energia, 3);
  assert.notEqual(m.jugar(0, 2), null);
  assert.equal(m.jugar(0, 2), null, "sin energía");
  m.terminarTurno((c) => c === m.mano[0]);
  assert.equal(m.mano.length, 1);
  const ev = m.empezarTurno();
  assert.ok(ev.some((e) => e.tipo === "barajar"));
  assert.equal(m.total, 7);
  assert.ok(Math.abs(probRobarAlMenos(30, 3, 5) - 0.4335) < 0.001);
});

test("estrategia: selección, formaciones, producción, recolector y construcción sin bloquear", () => {
  const us = [{ id: 1, x: 1, y: 1, duenio: 0 }, { id: 2, x: 5, y: 5, duenio: 0 }, { id: 3, x: 2, y: 2, duenio: 1 }];
  assert.deepEqual(seleccionarRect(us, 0, 0, 3, 3, 0).map((u) => u.id), [1]);
  const f = formacion("linea", 3, 0, 0, 0, 2);
  assert.deepEqual(f.map((p) => Math.round(p.y)), [-2, 0, 2]);
  const eco = { recursos: { oro: 100 }, poblacion: 0, poblacionMax: 2 };
  const cola = new ColaProduccion();
  assert.equal(cola.encolar({ id: "a", tiempo: 1, costo: { oro: 50 }, poblacion: 1 }, eco), "ok");
  assert.equal(cola.encolar({ id: "a", tiempo: 1, costo: { oro: 60 }, poblacion: 1 }, eco), "sin-recursos");
  assert.deepEqual(cola.actualizar(1.5).map((d) => d.id), ["a"]);
  const rec = new Recolector(10, 5);
  let deposito = 0, mina = 100;
  for (let i = 0; i < 600; i++) deposito += rec.actualizar(1 / 60, 1, () => mina, (q) => { const t = Math.min(q, mina); mina -= t; return t; });
  assert.ok(deposito >= 20);
  const g = new CuadriculaConstruccion(3, 3);
  const hayCamino = (ocup: (c: number, f: number) => boolean) => !ocup(0, 1) || !ocup(1, 1) || !ocup(2, 1);
  assert.ok(g.colocar(1, 0, 1, 1, 1, hayCamino));
  assert.ok(g.colocar(2, 1, 1, 1, 1, hayCamino));
  assert.equal(g.colocar(3, 2, 1, 1, 1, hayCamino), false, "no se puede cerrar el camino");
});

test("carreras: el vehículo acelera, cambia de marcha y dobla; vueltas, posiciones y fantasma", () => {
  const v = new Vehiculo(vehiculo("deportivo").def);
  for (let i = 0; i < 60 * 6; i++) v.actualizar(1 / 60, { acelerador: 1, freno: 0, direccion: 0 });
  assert.ok(v.kmh > 80 && v.marcha >= 2, `${v.kmh.toFixed(0)} km/h en ${v.marcha}.ª`);
  const ang = v.angulo;
  for (let i = 0; i < 60; i++) v.actualizar(1 / 60, { acelerador: 0.5, freno: 0, direccion: 1 });
  assert.ok(v.angulo > ang + 0.2, "dobla");
  for (let i = 0; i < 60 * 8; i++) v.actualizar(1 / 60, { acelerador: 0, freno: 1, direccion: 0 });
  assert.ok(v.velocidad < 0.5, "frena");
  assert.ok(curvaNeumatico(0.3, 0.1) < curvaNeumatico(0.1, 0.1), "pasado el pico pierde agarre");
  const c = new Carrera([{ x: 0, y: 0, radio: 1 }, { x: 10, y: 0, radio: 1 }], 2, [1]);
  const ruta = [[0, 0], [10, 0], [0, 0], [10, 0], [0, 0]];
  const ev = ruta.flatMap(([x, y]) => c.actualizar(1, new Map([[1, { x, y }]])));
  assert.deepEqual(ev.filter((e) => e.tipo !== "control").map((e) => e.tipo), ["vuelta", "vuelta", "meta"]);
  const f = new Fantasma();
  f.grabar(0, 0, 0, 0);
  f.grabar(1, 10, 0, 0);
  assert.equal(f.en(0.5)!.x, 5);
  assert.ok(rubberBanding(-100, 100) < 1 && rubberBanding(100, 100) > 1);
});

test("modos: captura disputada, marcador, zona segura y reapariciones", () => {
  const p = new PuntoCaptura(P.CAPTURA_BASE);
  let duenio = null;
  for (let i = 0; i < 600 && !duenio; i++) duenio = p.actualizar(1 / 60, 2, 0);
  assert.equal(duenio, "A");
  p.actualizar(1, 1, 1);
  assert.ok(p.disputado);
  const m = new Marcador(["A", "B"], 3, 10);
  m.sumar("A", 3);
  assert.equal(m.ganador, "A");
  const t = new Marcador(["A", "B"], 1000, 5, 100);
  assert.equal(t.restar("B", 100), "A");
  const z = new ZonaSegura(0, 0, 2000, P.ZONA_BATALLA_REAL, new Pcg32(5));
  const prox = z.proxima!;
  for (let i = 0; i < 400; i++) z.actualizar(1);
  assert.ok(z.radio < 1200 && Math.hypot(prox.x, prox.y) <= 2000 - prox.radio + 1e-6);
  const r = new Reapariciones(5, { A: 1 });
  assert.ok(r.morir(1, "A") && !r.morir(2, "A"));
  assert.deepEqual(r.actualizar(5), [1]);
});

test("director de hordas: acumula, pico, relaja y respeta máximos y recargas", () => {
  const d = new Director(P.DIRECTOR_ZOMBIS, new Pcg32(3));
  const vivos = new Map<string, number>();
  const fases = new Set<string>();
  let total = 0;
  for (let i = 0; i < 60 * 120; i++) {
    for (const t of d.actualizar(1 / 60, vivos)) {
      vivos.set(t, (vivos.get(t) ?? 0) + 1);
      total++;
    }
    if (i % 60 === 0) d.recibioDanio(0.05);
    if (i % 30 === 0) for (const [k, v] of vivos) vivos.set(k, Math.max(0, v - 1));
    fases.add(d.fase);
  }
  assert.ok(total > 50);
  assert.ok(fases.has("pico") && fases.has("relajar"));
  let suma = 0;
  for (const v of vivos.values()) suma += v;
  assert.ok(suma <= P.DIRECTOR_ZOMBIS.maxVivos);
});

test("feedback: traduce eventos a impacto/sonido/visual según estilo, fusiona repetidos y normaliza", async () => {
  const { TraductorFeedback, ESTILO_ARCADE, ESTILO_TACTICO, ESTILO_ACCESIBLE, intensidadDanio, intensidadRareza, friccionSonora } = await import("../src/contextos/feedback/index.ts");
  const t = new TraductorFeedback(ESTILO_ARCADE);
  const f = t.traducir({ tipo: "golpe", intensidad: 1, material: "metal", propio: true });
  assert.equal(f.sonido!.sonido, "impacto_metal_normal");
  assert.ok(f.impacto!.hitstop > 0.05 && f.visual!.efecto === "chispa_metal");
  assert.equal(t.traducir({ tipo: "golpe", intensidad: 0.1 }).impacto, undefined, "golpes chicos no sacuden la pantalla");
  assert.equal(new TraductorFeedback(ESTILO_ACCESIBLE).traducir({ tipo: "critico", intensidad: 1 }).impacto, undefined, "modo accesible sin destellos");
  assert.ok(new TraductorFeedback(ESTILO_TACTICO).traducir({ tipo: "golpe", intensidad: 1 }).impacto!.hitstop === 0);
  const b = t.traducir({ tipo: "botin", intensidad: intensidadRareza(4, 6), etiqueta: "4" });
  assert.equal(b.sonido!.sonido, "botin_rareza_4");
  assert.equal(b.visual!.color, "#ffa531");
  const paso = t.traducirPaso(Array.from({ length: 10 }, () => ({ tipo: "impacto-bala", intensidad: 0.3, material: "piedra" })));
  assert.equal(paso.length, 1, "diez impactos iguales en un paso = uno");
  assert.ok(paso[0].evento.intensidad > 0.3);
  assert.ok(intensidadDanio(25, 100) === 0.5);
  assert.ok(friccionSonora(30, 30).tono > friccionSonora(5, 30).tono);
});

test("narrativa: memoria y disparadores de consecuencias por eventos de dominio", async () => {
  const { MemoriaNarrativa, Disparadores, Dialogo } = await import("../src/contextos/narrativa/index.ts");
  const m = new MemoriaNarrativa();
  const d = new Disparadores([
    { id: "jefe-limpio", evento: "jefe-vencido", datos: { sinDanio: true }, consecuencias: [{ tipo: "hecho", var: "leyenda", valor: true }, { tipo: "disparar", accion: "dialogo", datos: { id: "herrero-admira" } }] },
    { id: "salvo-aldea", evento: "aldea-salvada", consecuencias: [{ tipo: "relacion", personaje: "herrero", delta: 30 }], repetible: true },
    { id: "amigo", evento: "aldea-salvada", si: [{ var: "relacion.herrero", op: ">=", valor: 50 }], consecuencias: [{ tipo: "disparar", accion: "mision", datos: { id: "espada-ancestral" } }], prioridad: -1 },
  ], m);
  assert.deepEqual(d.procesar({ tipo: "jefe-vencido", datos: { sinDanio: false } }), []);
  assert.deepEqual(d.procesar({ tipo: "jefe-vencido", datos: { sinDanio: true } }).map((a) => a.accion), ["dialogo"]);
  assert.deepEqual(d.procesar({ tipo: "jefe-vencido", datos: { sinDanio: true } }), [], "una sola vez");
  d.procesar({ tipo: "aldea-salvada" });
  const segunda = d.procesar({ tipo: "aldea-salvada" });
  assert.equal(m.relacion("herrero"), 60);
  assert.deepEqual(segunda.map((a) => a.accion), ["mision"], "la prioridad aplica la relación antes de evaluar la misión");
  assert.equal(m.obtener("veces.jefe-vencido"), 3);
  assert.ok(m.ocurrio("jefe-vencido", { sinDanio: true }));
  const dlg = new Dialogo([{ id: "a", texto: "x", redirigir: [{ si: [{ var: "leyenda", op: "==", valor: true }], ir: "b" }] }, { id: "b", texto: "¡La leyenda!" }], m);
  dlg.iniciar("a");
  assert.equal(dlg.actual?.id, "b", "los diálogos leen la memoria");
  const copia = new MemoriaNarrativa();
  copia.importar(JSON.parse(JSON.stringify(m.exportar())));
  assert.equal(copia.relacion("herrero"), 60);
});

test("compras reales: verificación en servidor, idempotencia, permanentes y anuncios con tope", async () => {
  const { canjearRecibo, ComprasEnMemoria, AnunciosConRecompensa } = await import("../src/contextos/economia/index.ts");
  const { RelojManual } = await import("../src/nucleo/reloj.ts");
  const catalogo = new Map([
    ["gemas-100", { sku: "gemas-100", consumible: true, entrega: [{ tipo: "moneda" as const, moneda: "gemas", cantidad: 100 }] }],
    ["sin-anuncios", { sku: "sin-anuncios", consumible: false, entrega: [] }],
  ]);
  const recibos: Record<string, { transaccion: string; sku: string; cuenta: string; valido: boolean; revocado?: boolean }> = {
    r1: { transaccion: "t1", sku: "gemas-100", cuenta: "ana", valido: true },
    r2: { transaccion: "t2", sku: "sin-anuncios", cuenta: "ana", valido: true },
    r3: { transaccion: "t3", sku: "sin-anuncios", cuenta: "ana", valido: true },
    falso: { transaccion: "x", sku: "gemas-100", cuenta: "ana", valido: false },
  };
  const repo = new ComprasEnMemoria();
  const dep = { tienda: { verificar: async (r: string) => recibos[r] }, repo, catalogo };
  const a = await canjearRecibo(dep, "ana", "r1");
  assert.ok(a.ok && a.valor.acreditado);
  const b = await canjearRecibo(dep, "ana", "r1");
  assert.ok(b.ok && !b.valor.acreditado, "reintento: no acredita dos veces");
  assert.equal(repo.entregas.length, 1);
  assert.deepEqual(await canjearRecibo(dep, "ana", "falso"), { ok: false, error: "recibo-invalido" });
  assert.deepEqual(await canjearRecibo(dep, "beto", "r1"), { ok: false, error: "cuenta-distinta" });
  assert.ok((await canjearRecibo(dep, "ana", "r2")).ok);
  assert.deepEqual(await canjearRecibo(dep, "ana", "r3"), { ok: false, error: "permanente-ya-comprado" });
  const reloj = new RelojManual();
  const ads = new AnunciosConRecompensa({ maxPorDia: 2, espera: 30, dia: 86_400_000, origen: 0 }, reloj);
  assert.deepEqual(ads.completar("ana", null), { ok: false, error: "sin-confirmacion" });
  assert.ok(ads.completar("ana", "c1").ok);
  assert.deepEqual(ads.completar("ana", "c1"), { ok: true, valor: { recompensar: false } }, "confirmación repetida");
  assert.deepEqual(ads.completar("ana", "c2"), { ok: false, error: "esperar" });
  reloj.avanzar(31_000);
  assert.ok(ads.completar("ana", "c2").ok);
  reloj.avanzar(31_000);
  assert.deepEqual(ads.disponible("ana"), { ok: false, error: "tope-diario" });
  reloj.avanzar(86_400_000);
  assert.ok(ads.disponible("ana").ok, "nuevo día");
});
