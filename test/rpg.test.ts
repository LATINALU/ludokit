import { test } from "node:test";
import assert from "node:assert/strict";
import { Atributos, Recurso } from "../src/contextos/combate/dominio/atributos.ts";
import { calcularDanio, danioEsperado, RoboDeVida } from "../src/contextos/combate/dominio/danio.ts";
import { Habilidades, type UsuarioHabilidades } from "../src/contextos/combate/dominio/habilidades.ts";
import { TablaAmenaza } from "../src/contextos/combate/dominio/amenaza.ts";
import { GestorEstados } from "../src/contextos/combate/dominio/estados.ts";
import { MedidorEstilo } from "../src/contextos/combate/dominio/estilo.ts";
import { cambioDeNivel, sortearAfijos } from "../src/contextos/combate/dominio/afijos.ts";
import { ModeloBalance, simularPelea, veredicto } from "../src/contextos/balance/dominio/poder-esperado.ts";
import { BALANCE_ACCION, PODER_RPG, RAREZA_ARPG, EQUIPO_ARPG } from "../src/modelos/piezas.ts";
import { curva } from "../src/nucleo/escalado.ts";
import { probabilidadesRareza, tirarRareza } from "../src/contextos/botin/dominio/rareza.ts";
import { generarPieza, mejorarPieza, perfeccion, type DefClase } from "../src/contextos/botin/dominio/equipo.ts";
import { soltarBotin, type TablaFichas } from "../src/contextos/botin/dominio/fichas.ts";
import { abrirConPiedad, piedadInicial, type DefCaja } from "../src/contextos/coleccion/dominio/piedad.ts";

const CAJAS: Readonly<Record<string, DefCaja>> = {
  basica: { minimo: 0, prob: [0.6, 0.3, 0.1], umbral: { aperturas: 10, nivel: 2 } },
  mayor: { minimo: 5, prob: [0.48, 0.28, 0.16, 0.08], cuotas: { bloque: 50, minimos: { 8: 2, 7: 4 } } },
};
import { ArbolTalentos } from "../src/contextos/progresion/dominio/talentos.ts";
import { Dialogo, MundoVariables } from "../src/contextos/narrativa/dominio/dialogo.ts";
import { AzarSemilla } from "../src/nucleo/azar.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

test("atributos: plano → aumentado (suma) → más (multiplica) → límites; quitar por fuente; derivados", () => {
  const a = new Atributos({ fuerza: 10, ataque: 100 }, { critico: { max: 0.5 } });
  a.derivar("vidaMax", (x) => 50 + x.valor("fuerza") * 10);
  a.agregarVarios([
    { atributo: "ataque", tipo: "plano", valor: 20, fuente: "espada" },
    { atributo: "ataque", tipo: "aumentado", valor: 0.2, fuente: "anillo" },
    { atributo: "ataque", tipo: "aumentado", valor: 0.3, fuente: "talento" },
    { atributo: "ataque", tipo: "mas", valor: 0.1, fuente: "furia" },
    { atributo: "critico", tipo: "plano", valor: 0.9, fuente: "trampa" },
    { atributo: "fuerza", tipo: "plano", valor: 5, fuente: "espada" },
  ]);
  assert.equal(a.valor("ataque"), 120 * 1.5 * 1.1);
  assert.equal(a.valor("critico"), 0.5);
  assert.equal(a.valor("vidaMax"), 200);
  assert.equal(a.quitarFuente("espada"), 2);
  assert.equal(a.valor("vidaMax"), 150);
  const vida = new Recurso(() => a.valor("vidaMax"));
  vida.modificar(-75);
  a.agregar({ atributo: "fuerza", tipo: "plano", valor: 10, fuente: "x" });
  vida.sincronizar();
  assert.equal(vida.fraccion, 0.5, "la vida actual escala con el máximo");
});

test("daño: defensa con k, resistencias, vulnerabilidad, bloqueo, mínimo 1 y robo con reserva", () => {
  const az = new AzarSemilla(3);
  const base = { ataque: 100, variacion: 0 };
  assert.equal(calcularDanio(base, { defensa: 60 }, az).danio, 50);
  assert.equal(calcularDanio({ ...base, tipo: "fuego" }, { resistencias: { fuego: 0.5 } }, az).danio, 50);
  assert.equal(calcularDanio({ ...base, tipo: "fuego" }, { resistencias: { fuego: -0.5 } }, az).danio, 150);
  assert.equal(calcularDanio(base, { bloqueando: true, bloqueo: 1 }, az).danio, 0);
  assert.equal(calcularDanio({ ataque: 1, variacion: 0 }, { defensa: 10000 }, az).danio, 1);
  assert.equal(calcularDanio(base, { inmune: true }, az).danio, 0);
  assert.ok(Math.abs(danioEsperado({ ataque: 100, probCritico: 0.5, multCritico: 2 }, {}) - 150) < 1e-9);
  const robo = new RoboDeVida(10, 0.1);
  assert.equal(robo.curar(1000, 0.5), 10, "tope de reserva");
  assert.equal(robo.curar(1000, 0.5), 0);
});

test("habilidades: costo, recarga, cargas, global, lanzamiento interrumpible y canal", () => {
  let mana = 100;
  const estados = new Set<string>();
  const p: UsuarioHabilidades = { estados, tiene: (_r, n) => mana >= n, gastar: (_r, n) => (mana >= n ? ((mana -= n), true) : false) };
  const h = new Habilidades([
    { id: "bola", costo: { recurso: "mana", cantidad: 30 }, recarga: 2, lanzamiento: 0.5, usaGlobal: true },
    { id: "dash", recarga: 3, cargas: 2 },
    { id: "rayo", recarga: 5, canal: { duracion: 1, cadaPulso: 0.25 } },
  ], 1);
  assert.ok(h.usar("dash", p).ok && h.usar("dash", p).ok);
  assert.equal(h.usar("dash", p).ok, false, "sin cargas");
  const r = h.usar("bola", p);
  assert.ok(r.ok && mana === 70);
  assert.equal(h.usar("rayo", p).ok, false, "ocupado lanzando");
  const ev = h.actualizar(0.6);
  assert.ok(ev.some((e) => e.tipo === "efecto" && e.id === "bola"));
  assert.equal(h.usar("bola", p).ok, false);
  for (let i = 0; i < 40; i++) h.actualizar(0.1);
  assert.equal(h.cargasDe("dash"), 1, "a los 4,6 s volvió una carga (3 s cada una)");
  for (let i = 0; i < 20; i++) h.actualizar(0.1);
  assert.equal(h.cargasDe("dash"), 2, "y a los 6 s la segunda");
  assert.ok(h.usar("rayo", p).ok);
  let pulsos = 0;
  for (let i = 0; i < 12; i++) pulsos += h.actualizar(0.1).filter((e) => e.tipo === "pulso").length;
  assert.equal(pulsos, 4);
  h.usar("bola", p);
  estados.add("aturdido");
  assert.ok(h.actualizar(0.1, p).some((e) => e.tipo === "interrumpida"));
});

test("amenaza: el tanque retiene, margen 110 %/130 %, provocar", () => {
  const t = new TablaAmenaza();
  t.sumar("tanque", 1000);
  t.actualizar(0.1);
  t.sumar("mago", 1200);
  assert.equal(t.actualizar(0.1, (j) => j !== "mago"), "tanque", "mago a distancia necesita 130 %");
  t.sumar("mago", 200);
  assert.equal(t.actualizar(0.1, (j) => j !== "mago"), "mago");
  t.provocar("tanque", 2);
  assert.equal(t.actualizar(0.1), "tanque");
});

test("estados: veneno apila con ticks, aturdido con rendimiento decreciente, inmunidad", () => {
  const g = new GestorEstados();
  const veneno = { id: "veneno", duracion: 3, apilado: "apilar" as const, maxPilas: 5, cadaTick: 1, porTick: 4, etiquetas: ["veneno"] };
  g.aplicar(veneno);
  g.aplicar(veneno);
  let danio = 0;
  for (let i = 0; i < 40; i++) for (const t of g.actualizar(0.1)) danio += t.valor;
  assert.equal(danio, 24, "2 pilas × 4 × 3 ticks");
  const aturdir = { id: "aturdido", duracion: 2, apilado: "renovar" as const, etiquetas: ["aturdido"], control: true };
  g.aplicar(aturdir);
  for (let i = 0; i < 21; i++) g.actualizar(0.1);
  assert.ok(!g.tiene("aturdido"));
  g.aplicar(aturdir);
  for (let i = 0; i < 11; i++) g.actualizar(0.1);
  assert.ok(!g.tiene("aturdido"), "el segundo dura la mitad");
  g.inmunidades.add("veneno");
  assert.equal(g.aplicar(veneno), false);
});

test("estilo: variedad, rangos y corte por ventana", () => {
  const m = new MedidorEstilo();
  for (const a of ["golpe", "patada", "tecnica", "cargado", "esquiva"]) m.registrar(a);
  assert.ok(m.indice >= 1);
  const igual = new MedidorEstilo();
  for (let i = 0; i < 5; i++) igual.registrar("golpe");
  assert.ok(igual.puntos < m.puntos, "repetir rinde menos");
  m.actualizar(5);
  assert.equal(m.indice, 0);
});

test("afijos deterministas y contrarreloj", () => {
  const AFIJOS = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, nombre: id, descripcion: "", desde: 1 + i }));
  const umbrales = [2, 4, 7, 10];
  assert.deepEqual(sortearAfijos(42, 7, AFIJOS, umbrales).map((a) => a.id), sortearAfijos(42, 7, AFIJOS, umbrales).map((a) => a.id));
  assert.equal(sortearAfijos(42, 7, AFIJOS, umbrales).length, 3);
  const escalones = [[0.4, 3], [0.2, 2], [0, 1]] as const;
  assert.equal(cambioDeNivel(50, 100, escalones, -1), 3);
  assert.equal(cambioDeNivel(0, 100, escalones, -1), -1);
});

test("balance por poder esperado: golpes para matar/morir y duración del jefe en CUALQUIER nivel", () => {
  const m = new ModeloBalance(PODER_RPG, BALANCE_ACCION);
  for (const n of [1, 6, 12, 24, 40, 100, 500]) {
    const pe = m.poder(n);
    const e = m.enemigo(n);
    const jugador = { vida: pe.vida, ataque: pe.golpe, defensa: pe.defensa, k: m.kJugador(n), ritmo: 2 };
    const r = simularPelea(jugador, { vida: e.vida, ataque: e.ataque, defensa: e.defensa, k: BALANCE_ACCION.kEnemigo, ritmo: 1 });
    assert.ok(Math.abs(r.golpesAaB - BALANCE_ACCION.golpesParaMatar) <= 1, `nivel ${n}: ${r.golpesAaB} golpes para matar`);
    assert.ok(Math.abs(r.golpesBaA - BALANCE_ACCION.golpesParaMorir) <= 1, `nivel ${n}: ${r.golpesBaA} golpes para morir`);
    const j = m.jefe(n);
    const rj = simularPelea(jugador, { vida: j.vida, ataque: j.ataque, defensa: j.defensa, k: BALANCE_ACCION.kEnemigo, ritmo: 1 });
    const esperado = j.duracion * BALANCE_ACCION.multVidaJefe;
    assert.ok(Math.abs(rj.segundosA - esperado) / esperado < 0.05, `jefe ${n}: ${rj.segundosA}s`);
  }
  assert.ok(m.poder(1000).golpe > m.poder(100).golpe, "la curva no tiene techo");
  assert.equal(m.tabla(1, 10).length, 10);
  assert.equal(veredicto(0, 0), "listo");
  assert.equal(veredicto(10, 100), "peligroso");
});

test("rareza por nivel: curva, suerte y mínima que eleva sin inflar el máximo", () => {
  const p1 = probabilidadesRareza(RAREZA_ARPG, 1);
  const p60 = probabilidadesRareza(RAREZA_ARPG, 60);
  assert.ok(p60[3] > p1[3] * 5);
  const p1000 = probabilidadesRareza(RAREZA_ARPG, 1000);
  assert.ok(p1000[5] > p60[5], "sigue mejorando sin tope de niveles");
  const az = new Pcg32(7);
  let miticos = 0;
  for (let i = 0; i < 20000; i++) if (tirarRareza(az, RAREZA_ARPG, 1, { minima: 4 }) === 5) miticos++;
  assert.ok(miticos < 40, `con mínima legendaria el mítico sigue siendo raro (${miticos}/20000)`);
  const conSuerte = probabilidadesRareza(RAREZA_ARPG, 10, 100);
  assert.ok(conSuerte[5] > probabilidadesRareza(RAREZA_ARPG, 10)[5]);
});

test("equipo: tiradas, perfección, afijos por rareza y mejora", () => {
  const clases: DefClase[] = [{ id: "pecho", principal: { vida: 6, defensa: 2 }, afijos: { critico: 0.4, robo: 0.1, velocidad: 0.3, ataque: 1 } }];
  const az = new Pcg32(11);
  const p = generarPieza(az, clases, 10, EQUIPO_ARPG, { minima: 3 });
  assert.ok(p.rareza >= 3 && Object.keys(p.stats).length >= 5);
  assert.ok(perfeccion(p) >= 0 && perfeccion(p) <= 1);
  const m = mejorarPieza(p, EQUIPO_ARPG)!;
  assert.equal(m.mejora, 1);
  assert.ok(m.stats.vida > p.stats.vida);
});

test("botín por fichas: resolutor del juego y garantizadas", () => {
  const az = new Pcg32(5);
  const jefe: TablaFichas = { modo: "cada-uno", garantizadas: ["equipo"], entradas: [["carta", 0.6], ["unico", 0.05]], moneda: [180, 270], monedaPorNivel: curva.lineal(1, 0.6) };
  const b = soltarBotin(az, jefe, { nivel: 5, minima: 2, suerte: 0, mult: 1 }, (f) => `${f}!`);
  assert.ok(b.premios.includes("equipo!"));
  assert.ok(b.moneda >= 180 * 3.4 && b.moneda <= 270 * 3.4 + 1);
});

test("piedad: umbral, cuotas por bloque y probabilidad suave", () => {
  const az = new Pcg32(1);
  const e = piedadInicial();
  let maxSeguidas = 0, seguidas = 0;
  for (let i = 0; i < 500; i++) {
    const r = abrirConPiedad(az, CAJAS.basica, e);
    seguidas = r.nivel >= 2 ? 0 : seguidas + 1;
    maxSeguidas = Math.max(maxSeguidas, seguidas);
  }
  assert.ok(maxSeguidas <= 9, `nunca más de 9 sin premio (${maxSeguidas})`);
  const e2 = piedadInicial();
  const conteo: Record<number, number> = {};
  for (let i = 0; i < 50; i++) {
    const r = abrirConPiedad(new Pcg32(1000 + i), { ...CAJAS.mayor, prob: [1, 0, 0, 0] }, e2);
    conteo[r.nivel] = (conteo[r.nivel] ?? 0) + 1;
  }
  assert.ok((conteo[8] ?? 0) >= 2 && (conteo[7] ?? 0) >= 4, JSON.stringify(conteo));
});

test("talentos: sendas, requisitos, exclusión, reinicio y modificadores", () => {
  const a = ArbolTalentos.porSendas({ filo: [{ id: "f1", rangos: 3, mods: [{ atributo: "ataque", tipo: "aumentado", valor: 0.05 }] }, { id: "f2" }] }, 4);
  assert.equal(a.aprender("f2").ok, false);
  a.aprender("f1");
  a.aprender("f1");
  assert.ok(a.aprender("f2").ok);
  assert.ok(Math.abs(a.modificadores()[0].valor - 0.1) < 1e-12);
  assert.equal(a.reiniciar(), 3);
  assert.equal(a.puntos, 4);
});

test("diálogo: condiciones, efectos, redirección e interpolación; validación", () => {
  const m = new MundoVariables();
  m.fijar("nombre", "Ana");
  const nodos = [
    { id: "inicio", texto: "", redirigir: [{ si: [{ var: "amigos", op: "==" as const, valor: true }], ir: "amigo" }], siguiente: "hola" },
    { id: "hola", texto: "Hola, {nombre}.", opciones: [{ texto: "Ser amigos", ir: "amigo", efectos: [{ tipo: "fijar" as const, var: "amigos", valor: true }, { tipo: "evento" as const, evento: "dar-objeto", datos: { id: 7 } }] }, { texto: "Pagar", si: [{ var: "oro", op: ">=" as const, valor: 10 }], mostrarBloqueada: true }] },
    { id: "amigo", texto: "¡Amigo!" },
  ];
  assert.deepEqual(Dialogo.validar(nodos), []);
  const d = new Dialogo(nodos, m);
  d.iniciar("inicio");
  d.continuar();
  assert.equal(d.texto, "Hola, Ana.");
  assert.deepEqual(d.opciones().map((o) => o.disponible), [true, false]);
  d.elegir(0);
  assert.equal(d.actual!.id, "amigo");
  assert.equal(d.eventos[0].evento, "dar-objeto");
  const d2 = new Dialogo(nodos, m);
  d2.iniciar("inicio");
  assert.equal(d2.actual!.id, "amigo", "redirige si ya son amigos");
  assert.equal(Dialogo.validar([{ id: "a", texto: "", siguiente: "x" }]).length, 1);
});

test("grados de enemigo: niveles, tablas, moneda y grado por zona", async () => {
  const { gradosEnemigo, gradoParaNivel, tonoDeGrado } = await import("../src/contextos/balance/dominio/grados.ts");
  const g = gradosEnemigo(1, 16, 6, 167);
  assert.deepEqual(g.map((x) => x.nivel), [1, 17, 33, 49, 65, 81]);
  assert.deepEqual(g[2].moneda, [33, 67, 0.5]);
  assert.equal(g[5].tablaBotin, 167 + 80);
  assert.equal(gradoParaNivel(g, 40).nivel, 33);
  assert.equal(gradoParaNivel(g, 0).nivel, 1);
  assert.equal(tonoDeGrado(4, 6), 180);
});
