import { test } from "node:test";
import { curva } from "../src/nucleo/escalado.ts";
import assert from "node:assert/strict";
import { PlataformaNula, RegistroLogros, type PlataformaLogros } from "../src/contextos/progresion/dominio/logros.ts";
import { estadoConjuntos, efectosConjuntos, modificadoresConjuntos, Engarces, fundirRunas, type DefConjunto } from "../src/contextos/botin/dominio/conjuntos.ts";
import { craftear, costoTemplado, faltantes, sumarPactos, templar, vecesPosibles, type Receta, type Pacto } from "../src/contextos/economia/dominio/crafteo.ts";
import { eventoAnual, eventosActivos, hastaProximaSemana, LUNES_BASE, ProgresoPeriodico, rotacion, rotacionBarajada, semanaDe } from "../src/contextos/progresion/dominio/calendario.ts";
import { CatalogoRasgos, heredarRasgos, probMutacion } from "../src/contextos/coleccion/dominio/herencia.ts";
import { ordenSiembra, premioRonda, Torneo } from "../src/contextos/competitivo/dominio/torneo.ts";
import { Inventario } from "../src/contextos/inventario/dominio/inventario.ts";
import { Billetera } from "../src/contextos/economia/dominio/billetera.ts";
import { Atributos } from "../src/contextos/combate/dominio/atributos.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

test("logros: eventos, contexto, registros, secretos y sincronización sin conexión", () => {
  const defs = [
    { id: "MATAR_3", nombre: "x", descripcion: "", evento: "matar", cantidad: 3 },
    { id: "JEFE_12", nombre: "x", descripcion: "", evento: "jefe", contexto: 12, cantidad: 1 },
    { id: "NIVEL_10", nombre: "Hondo", descripcion: "", registro: "mejorNivel", cantidad: 10, secreto: true },
  ];
  const r = new RegistroLogros(defs);
  r.registrar("matar");
  r.registrar("matar");
  assert.ok(Math.abs(r.progreso("MATAR_3") - 2 / 3) < 1e-9);
  assert.deepEqual(r.registrar("matar").map((d) => d.id), ["MATAR_3"]);
  assert.deepEqual(r.registrar("jefe", 5), []);
  assert.deepEqual(r.registrar("jefe", 12).map((d) => d.id), ["JEFE_12"]);
  r.fijarRegistro("mejorNivel", 4);
  assert.equal(r.vista()[2].nombre, "???");
  r.fijarRegistro("mejorNivel", 11);
  r.fijarRegistro("mejorNivel", 2);
  assert.equal(r.estado.registros.mejorNivel, 11, "el registro solo sube");
  assert.equal(r.estado.pendientes.length, 3);
  const steam: PlataformaLogros & { lista: string[] } = { disponible: true, lista: [], desbloquear(id) { this.lista.push(id); } };
  r.conectar(steam);
  assert.deepEqual(steam.lista, ["MATAR_3", "JEFE_12", "NIVEL_10"]);
  assert.equal(r.estado.pendientes.length, 0);
  assert.throws(() => new RegistroLogros([{ id: "a", nombre: "", descripcion: "", cantidad: 1 }]), /evento O registro/);
  assert.equal(new PlataformaNula().disponible, false);
});

test("conjuntos: bonos 2/4/6, faltantes, modificadores al sistema de atributos; engarces y fusión de runas", () => {
  const set: DefConjunto = {
    id: "acero", nombre: "Acero", clases: ["casco", "pecho", "botas", "guantes", "anillo", "anillo"],
    bonos: [{ piezas: 2, texto: "+10 def", mods: [{ atributo: "defensa", tipo: "plano", valor: 10 }] }, { piezas: 4, texto: "+20 %", mods: [{ atributo: "defensa", tipo: "aumentado", valor: 0.2 }] }, { piezas: 6, texto: "onda", efectos: { onda: 1 } }],
  };
  const eq = ["casco", "pecho", "botas", "anillo", "anillo"].map((c) => ({ clase: c, conjunto: "acero" }));
  const [e] = estadoConjuntos(eq, [set]);
  assert.equal(e.puestas, 5);
  assert.equal(e.activos.length, 2);
  assert.deepEqual(e.faltan, ["guantes"]);
  assert.equal(e.siguiente!.piezas, 6);
  const a = new Atributos({ defensa: 50 });
  a.agregarVarios(modificadoresConjuntos([e]));
  assert.equal(a.valor("defensa"), 72);
  assert.deepEqual(efectosConjuntos([e]), {});
  const g = new Engarces(2, ["gema", null]);
  assert.equal(g.engarzar(0, { id: "r1", tipo: "runa", rareza: 0 }).ok, false, "la ranura 0 solo acepta gemas");
  assert.ok(g.engarzar(1, { id: "r1", tipo: "runa", rareza: 0 }).ok);
  assert.equal(g.engarzar(1, { id: "r2", tipo: "runa", rareza: 0 }).ok, false);
  const r = fundirRunas([{ id: "a", tipo: "fuego", rareza: 1 }, { id: "b", tipo: "fuego", rareza: 1 }, { id: "c", tipo: "fuego", rareza: 1 }], "d");
  assert.ok(r.ok && r.valor.runa.rareza === 2 && r.valor.costo === 250);
});

test("crafteo todo o nada y templado sin fallos con pactos", () => {
  const inv = new Inventario({ pestanas: 1, casillasPorPestana: 3, maxPila: () => 10 });
  inv.agregar(1, 5);
  inv.agregar(2, 2);
  const b = new Billetera({ oro: 100 });
  const receta: Receta = { id: "espada", ingredientes: [[1, 3], [2, 1]], costo: { moneda: "oro", monto: 40 }, resultado: { objeto: 9, cantidad: 1 } };
  assert.equal(vecesPosibles(receta, inv, b), 1);
  assert.ok(craftear(receta, inv, b).ok);
  assert.deepEqual([inv.contar(1), inv.contar(2), inv.contar(9), b.saldo("oro")], [2, 1, 1, 60]);
  assert.equal(craftear(receta, inv, b).ok, false);
  assert.deepEqual(faltantes(receta, inv), [{ objeto: 1, tiene: 2, necesita: 3 }]);
  const lleno = new Inventario({ pestanas: 1, casillasPorPestana: 2, maxPila: () => 1 });
  lleno.agregar(1, 1);
  lleno.agregar(5, 1);
  const r2 = craftear({ id: "x", ingredientes: [[5, 1]], resultado: { objeto: 7, cantidad: 2 } }, lleno, b);
  assert.ok(!r2.ok && r2.error === "sin-espacio");
  assert.equal(lleno.contar(5), 1, "no consumió nada");
  const TEMPLADO = { maximo: 10, nivelEleccion: 5, materiales: curva.lineal(1, 0.5), moneda: curva.lineal(100, 100), seguro: { materiales: 2, moneda: 3 }, riesgo: { materiales: 0.5, moneda: 0.5 } };
  const PACTOS: Pacto[] = [{ id: "cristal", nombre: "Cristal", bono: { danio: 0.3 }, maldicion: { danioRecibido: 0.25 } }, { id: "frio", nombre: "Frío", bono: { celeridad: 0.15 }, maldicion: { vida: -0.12 } }];
  assert.deepEqual(costoTemplado(6, "normal", TEMPLADO), { materiales: 4, moneda: 700 });
  assert.deepEqual(costoTemplado(6, "seguro", TEMPLADO), { materiales: 8, moneda: 2100 });
  assert.deepEqual(costoTemplado(6, "riesgo", TEMPLADO), { materiales: 2, moneda: 350 });
  const t = templar(6, "riesgo", [], new Pcg32(1), PACTOS, TEMPLADO);
  assert.ok(t.ok && t.valor.nivel === 7 && t.valor.pacto !== null);
  assert.equal(templar(10, "normal", [], new Pcg32(1), PACTOS, TEMPLADO).ok, false);
  assert.equal(templar(500, "normal", [], new Pcg32(1), PACTOS, { ...TEMPLADO, maximo: Infinity }).ok, true, "sin tope si el juego lo pide");
  assert.deepEqual(sumarPactos(["cristal"], PACTOS, { bono: 1.25, maldicion: 0.5 }), { danio: 0.375, danioRecibido: 0.125 });
});

test("calendario: semanas, rotaciones, eventos anuales y progreso periódico", () => {
  const lunes = LUNES_BASE + 10 * 7 * 86_400_000;
  assert.equal(semanaDe(lunes), 10);
  assert.equal(semanaDe(lunes - 1), 9);
  assert.equal(hastaProximaSemana(lunes), 7 * 86_400_000);
  assert.equal(rotacion(["a", "b", "c"], 10), "b");
  const vistos = new Set([0, 1, 2, 3].map((p) => rotacionBarajada(["a", "b", "c", "d"], p, 7)));
  assert.equal(vistos.size, 4, "un ciclo completo usa todos");
  const navidad = eventoAnual("navidad", 12, 20, 14, Date.UTC(2026, 11, 25));
  assert.equal(eventosActivos([navidad], Date.UTC(2026, 11, 25)).length, 1);
  assert.equal(eventosActivos([navidad], Date.UTC(2027, 0, 10)).length, 0);
  const p = new ProgresoPeriodico((ms) => semanaDe(ms), lunes);
  p.sumar(lunes, 3);
  p.sumar(lunes + 86_400_000, 20, 10);
  assert.equal(p.leer(lunes), 10);
  assert.equal(p.leer(lunes + 8 * 86_400_000), 0, "semana nueva");
  assert.equal(p.cobrarAnterior(lunes + 8 * 86_400_000), 10);
  assert.equal(p.cobrarAnterior(lunes + 8 * 86_400_000), 0, "se cobra una vez");
});

test("herencia de rasgos: hereda, resonancia, mutación y transmutación respetan el tope", () => {
  const cat = new CatalogoRasgos([
    ...["c1", "c2", "c3", "c4", "c5", "c6"].map((id) => ({ id, rareza: 0 })),
    ...["r1", "r2", "r3"].map((id) => ({ id, rareza: 1 })),
    ...["e1", "e2"].map((id) => ({ id, rareza: 2 })),
    { id: "l1", rareza: 3 },
  ]);
  const r = heredarRasgos(new Pcg32(3), cat, [["c1", "c2"], ["c1", "r1"], ["e1"]], [], 5);
  assert.ok(r.rasgos.length <= 5);
  assert.ok(r.heredados.includes("e1") && r.heredados.includes("c1"));
  assert.equal(r.despertados.length, 1, "c1 repetido despierta uno (queda 1 lugar de 5)");
  assert.equal(new Set(r.rasgos).size, r.rasgos.length, "sin duplicados");
  const muchos = heredarRasgos(new Pcg32(9), cat, [["c1", "c2", "c3"], ["c4", "c5"], ["c6", "r1", "r2"]], [], 3);
  assert.ok(muchos.mejorados.length > 0, "lo que no entra mejora a otros");
  assert.equal(probMutacion(2, 0), 0);
  assert.ok(probMutacion(5, 0) > 0);
});

test("torneo: siembra, pases libres, avance, campeón y premios", () => {
  assert.deepEqual(ordenSiembra(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const t = new Torneo(["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, puntaje: 10 - i })));
  assert.equal(t.tamano, 8);
  assert.equal(t.cantidadRondas, 3);
  assert.equal(t.rondas[1][0].a, "a", "el primer sembrado pasa libre");
  while (t.pendientes().length) {
    const c = t.pendientes()[0];
    assert.ok(t.reportar(c.ronda, c.indice, c.a!).ok);
  }
  assert.equal(t.campeon, "a");
  assert.equal(t.rondaAlcanzada("a"), 3);
  assert.equal(t.reportar(0, 0, "zzz").ok, false);
  assert.equal(premioRonda(0, 16), 400);
  assert.equal(premioRonda(3, 32), 2400);
});
