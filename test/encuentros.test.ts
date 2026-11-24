import { test } from "node:test";
import assert from "node:assert/strict";
import { CerebroJefe, type DefJefe } from "../src/contextos/encuentros/dominio/jefe.ts";
import { EncuentroOleadas, premioEncuentro, varianteParaSala, durezaEncuentro, type VarianteOleadas, type ReglasOleadas } from "../src/contextos/encuentros/dominio/oleadas.ts";
import { PREMIO_ENCUENTRO } from "../src/modelos/piezas.ts";
import { curva } from "../src/nucleo/escalado.ts";

const REGLAS: ReglasOleadas = { acercarTras: 25, retirarTras: 45, esperaEntreOleadas: 1, tiempoPorOleada: 24, tiempoExtraPorOleadaHecha: 2 };
const VARIANTES: readonly VarianteOleadas[] = [
  { id: "creciente", nombre: "Crecientes", regla: "", desde: 1, peso: 1.2, oleadas: (n) => 2 + Math.floor(n / 6), enemigosBase: (n) => 3 + Math.floor(n / 4), enemigosPorOleada: 1, elites: "ultimo" },
  { id: "contrarreloj", nombre: "Contrarreloj", regla: "", desde: 2, peso: 1, oleadas: 3, enemigosBase: 2, enemigosPorOleada: 1, elites: "ultimo", tiempo: 90 },
  { id: "elite", nombre: "Élites", regla: "", desde: 3, peso: 0.9, oleadas: 2, enemigosBase: 2, enemigosPorOleada: 0, elites: "todos", cofre: 1, pieza: 3 },
];
import { ajusteDificultad, decidirEspejo, describirHuella, habitoDominante, HUELLA_NEUTRA, RastreadorHabitos } from "../src/contextos/ia/dominio/huella-jugador.ts";
import { Remate } from "../src/contextos/feel/dominio/remate.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

const JEFE: DefJefe = {
  id: "coloso",
  intro: 1,
  ataques: [
    { id: "carga", patron: "carga", aviso: 0.6, duracion: 0.8, recarga: 4 },
    { id: "salto", patron: "salto", aviso: 0.7, duracion: 1 },
    { id: "lluvia", patron: "lluvia", aviso: 0.5, duracion: 1.2, desdeFase: 1, peso: 2 },
  ],
  fases: [{ desdeVida: 1, rapidez: 1 }, { desdeVida: 0.5, rapidez: 1.3, multAviso: 0.7, nombre: "Furia" }],
};

test("jefe: aviso antes de cada ataque, sin repetir, recarga propia, fases y vencido", () => {
  const j = new CerebroJefe(JEFE, new Pcg32(4));
  const secuencia: string[] = [];
  let avisos = 0;
  let vida = 1;
  for (let i = 0; i < 60 * 40; i++) {
    if (i === 60 * 20) vida = 0.4;
    for (const e of j.actualizar(1 / 60, vida)) {
      if (e.tipo === "aviso") avisos++;
      if (e.tipo === "ataque") secuencia.push(e.ataque.id);
      if (e.tipo === "fase") assert.equal(e.nombre, "Furia");
    }
  }
  assert.ok(secuencia.length > 10);
  assert.equal(avisos, secuencia.length + (j.estado === "aviso" ? 1 : 0), "todo ataque fue avisado");
  for (let i = 1; i < secuencia.length; i++) assert.notEqual(secuencia[i], secuencia[i - 1], "nunca repite");
  assert.ok(!secuencia.slice(0, 3).includes("lluvia"), "la lluvia es de fase 2");
  assert.ok(secuencia.includes("lluvia"));
  assert.ok(j.aturdir(0.8)[0].tipo === "aturdido");
  assert.deepEqual(j.actualizar(0.1, 0).map((e) => e.tipo), ["vencido"]);
});

test("oleadas: secuencia, élite al final, reloj con tiempo extra, anti-bloqueo y premio con sellos", () => {
  const v = VARIANTES.find((x) => x.id === "contrarreloj")!;
  const e = new EncuentroOleadas(v, 5, REGLAS);
  const ev: string[] = [];
  let vivos = 0;
  let extra = 0;
  for (let i = 0; i < 60 * 30 && !e.terminado; i++) {
    for (const x of e.actualizar(1 / 60, vivos)) {
      ev.push(x.tipo);
      if (x.tipo === "oleada") {
        vivos = x.enemigos;
        if (x.ultima) assert.equal(x.elites, 1);
      }
      if (x.tipo === "tiempo-extra") extra += x.segundos;
    }
    if (vivos > 0 && i % 30 === 0) vivos--;
  }
  assert.deepEqual(ev.filter((x) => x === "oleada").length, 3);
  assert.equal(extra, 24 + 2 + 24 + 4);
  assert.equal(ev[ev.length - 1], "fin");
  const p = premioEncuentro(e, true, 1, PREMIO_ENCUENTRO);
  assert.ok(p.sellos.some((s) => s.sello === "intocable") && p.sellos.some((s) => s.sello === "a-tiempo"));
  assert.equal(p.racha, 2);
  const trabado = new EncuentroOleadas(VARIANTES[0], 1, REGLAS);
  const ev2: string[] = [];
  for (let i = 0; i < 60 * 50; i++) for (const x of trabado.actualizar(1 / 60, 3)) ev2.push(x.tipo);
  assert.ok(ev2.includes("acercar") && ev2.includes("retirar"), "nunca queda imposible de terminar");
  assert.equal(varianteParaSala(99, 10, VARIANTES).id, varianteParaSala(99, 10, VARIANTES).id);
  assert.equal(varianteParaSala(99, 1, VARIANTES).id, "creciente", "en nivel 1 solo hay una desbloqueada");
  const dureza = { vida: curva.lineal(1, 0.05), danio: curva.lineal(1, 0.02), extra: curva.lineal(0, 1 / 8), probElite: curva.limitar(curva.lineal(0, 0.02), 0, 0.4) };
  assert.equal(durezaEncuentro(25, dureza).extra, 3);
  assert.equal(durezaEncuentro(500, dureza).probElite, 0.4, "sin tope de nivel: la curva sigue y se recorta donde se pide");
});

test("huella del jugador: hábito dominante, descripción, espejo y dificultad dinámica", () => {
  const r = new RastreadorHabitos();
  assert.deepEqual(r.huella(), HUELLA_NEUTRA, "con pocos datos, neutra");
  for (let i = 0; i < 40; i++) {
    r.paso(0.5, true, 60);
    r.golpe(40, true, "normal", "lanza");
  }
  const h = r.huella();
  assert.equal(habitoDominante(h), "aereo");
  assert.equal(h.estilo, "lanza");
  assert.match(describirHuella(h), /desde el aire/);
  const az = new Pcg32(1);
  let asaltos = 0;
  for (let i = 0; i < 200; i++) if (decidirEspejo(h, { distancia: 150, enSuelo: true, objetivoContraMuro: false, objetivoCargando: false, habilidadLista: false, disparoListo: false }, az).accion === "asalto-aereo") asaltos++;
  assert.ok(asaltos > 100, `el espejo salta como el jugador (${asaltos}/200)`);
  assert.ok(ajusteDificultad(0.9, 0) > 1 && ajusteDificultad(0.2, 3) < 1);
});

test("remate: tres tiempos en reloj real, haces y estallido una vez", () => {
  const r = new Remate();
  const ev: string[] = [];
  let escalaEnLenta = -1;
  for (let i = 0; i < 120; i++) {
    for (const e of r.actualizar(1 / 60)) ev.push(e.tipo === "fase" ? `fase:${e.fase}` : e.tipo);
    if (r.fase === "lenta") escalaEnLenta = r.escalaMundo;
  }
  assert.equal(ev[0], "fase:impacto");
  assert.ok(ev.includes("fase:lenta") && ev.includes("fase:estallido") && ev.includes("fase:fin"));
  assert.equal(ev.filter((x) => x === "haz").length, 6);
  assert.equal(ev.filter((x) => x === "estallar").length, 1);
  assert.equal(escalaEnLenta, 0.2);
  assert.ok(r.terminado);
});
