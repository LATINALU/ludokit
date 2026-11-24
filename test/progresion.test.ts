import { test } from "node:test";
import assert from "node:assert/strict";
import { CurvaNiveles, CurvaNivelesInfinita, curvaDesde, curvaPolinomica } from "../src/contextos/progresion/dominio/niveles.ts";
import { curva } from "../src/nucleo/escalado.ts";
import type { ParametrosRecompensa } from "../src/contextos/progresion/dominio/recompensas.ts";
import {
  aplicarBonus,
  premiosPorSubida,
  recompensaPartida,
} from "../src/contextos/progresion/dominio/recompensas.ts";

test("curva con tope: niveles y porcentaje", () => {
  const c = new CurvaNiveles([0, 300, 640, 1020], 4);
  assert.deepEqual(c.nivelDe(0), { nivel: 1, porcentaje: 0 });
  assert.deepEqual(c.nivelDe(150), { nivel: 1, porcentaje: 50 });
  assert.equal(c.nivelDe(300).nivel, 2);
  assert.deepEqual(c.nivelDe(99999999), { nivel: 4, porcentaje: 0 });
  assert.equal(c.experienciaPara(2), 300);
  const d = curvaDesde(curva.potencia(100, 1.5), 60);
  assert.equal(d.nivelMaximo, 60);
  assert.equal(d.experienciaPara(2), 100);
});

test("curva infinita: sin nivel máximo, consistente y rápida con números enormes", () => {
  const c = new CurvaNivelesInfinita(curva.potencia(100, 1.5));
  assert.equal(c.experienciaPara(2), 100);
  assert.equal(c.nivelDe(c.experienciaPara(500)).nivel, 500);
  assert.equal(c.nivelDe(c.experienciaPara(500) - 1).nivel, 499);
  assert.ok(c.nivelDe(1e15).nivel > 10000);
});

test("curva polinómica crece y es válida", () => {
  const c = curvaPolinomica(50, 100, 1.5);
  assert.equal(c.nivelMaximo, 50);
  assert.equal(c.nivelDe(c.experienciaPara(10)).nivel, 10);
});

const PARTIDA = { nivel: 45, gano: true, muertes: 5, duracionMs: 360_000, presentes: 8, total: 8 };
const REGLAS: ParametrosRecompensa = {
  base: curva.escalones([[30, 300], [40, 400], [50, 500]], 100), factorDerrota: 2 / 3,
  segundosSinPremio: 60, segundosMaximos: 600, divisorTiempoExp: 5, divisorTiempoMonedas: 3,
  expPorMuerte: 20, monedasPorMuerte: 20, muertesSinPenalidad: 20,
  monedasBase: 120, monedasParticipacion: 400, multiplicadorMonedas: 20, tope: 30000,
};

test("recompensa de partida", () => {
  // EXP = 400 (nivel 40-49) + (360-60)/5 = 60 + 20*5 = 100 -> 560
  // Monedas = (120 + 400 + 300/3) + 100 = 720 -> ×20 = 14400
  assert.deepEqual(recompensaPartida(PARTIDA, REGLAS), { exp: 560, monedas: 14400 });
});

test("perder da 2/3 de la base; más de 20 muertes rinden menos; tope 30000", () => {
  const perdio = recompensaPartida({ ...PARTIDA, gano: false }, REGLAS);
  assert.equal(perdio.exp, Math.floor(400 * 2 / 3) + 60 + 100);
  const muchas = recompensaPartida({ ...PARTIDA, muertes: 30 }, REGLAS);
  assert.equal(muchas.exp, 400 + 60 + 20 * 20);
  assert.equal(recompensaPartida({ ...PARTIDA, muertes: 500 }, REGLAS).monedas, 30000);
});

test("el tiempo premiado va de 60 s a 660 s", () => {
  assert.equal(recompensaPartida({ ...PARTIDA, muertes: 0, duracionMs: 30_000 }, REGLAS).exp, 400);
  assert.equal(recompensaPartida({ ...PARTIDA, muertes: 0, duracionMs: 3_600_000 }, REGLAS).exp, 400 + 120);
});

test("variante: la muerte vale 4", () => {
  assert.equal(recompensaPartida(PARTIDA, { ...REGLAS, expPorMuerte: 4 }).exp, 400 + 60 + 20);
});

test("bonus porcentual y premios por nivel", () => {
  assert.equal(aplicarBonus(1000, 50), 1500);
  assert.equal(aplicarBonus(1000, 0), 1000);
  const tabla = [
    { nivel: 2, objeto: 1507, cantidad: 1, monedas: 1000 },
    { nivel: 3, objeto: 2, cantidad: 5, monedas: 1000 },
    { nivel: 5, objeto: 5055, cantidad: 1, monedas: 1000 },
  ];
  assert.deepEqual(premiosPorSubida(tabla, 1, 3).map((p) => p.nivel), [2, 3]);
  assert.deepEqual(premiosPorSubida(tabla, 3, 3), []);
});
