import { test } from "node:test";
import assert from "node:assert/strict";
import { aWav, BancoSonidos, MATERIALES, recetaCorte, recetaImpacto, recetaRareza, renderizar, saturar } from "../src/contextos/audio/dominio/sintesis.ts";
import { DirectorMusical, ESCALAS, grado, IDENTIDADES_EJEMPLO, mezclaPara, midiAHz, transformarMotivo } from "../src/contextos/audio/dominio/musica.ts";
import { AzarSemilla } from "../src/nucleo/azar.ts";

const pico = (b: Float32Array): number => b.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const energia = (b: Float32Array): number => b.reduce((s, x) => s + x * x, 0);

test("síntesis: cada material suena, es determinista, y la fuerza cambia el sonido", () => {
  for (const m of Object.keys(MATERIALES)) {
    const a = renderizar(recetaImpacto(m, 1), { azar: new AzarSemilla(7) });
    const b = renderizar(recetaImpacto(m, 1), { azar: new AzarSemilla(7) });
    assert.ok(pico(a) > 0.05 && pico(a) < 3, `${m}: ${pico(a)}`);
    assert.deepEqual(a, b, `${m} determinista`);
  }
  const leve = renderizar(recetaImpacto("metal", 0));
  const fuerte = renderizar(recetaImpacto("metal", 2));
  assert.ok(fuerte.length > leve.length && energia(fuerte) > energia(leve) * 2, "fuerte = más largo y más energía");
  assert.ok(renderizar(recetaCorte(true)).length > renderizar(recetaCorte()).length);
});

test("rareza: más rareza = más notas, más largo; saturación acotada; WAV válido", () => {
  const r0 = recetaRareza(0), r7 = recetaRareza(7);
  assert.ok(r7.length > r0.length);
  const b7 = renderizar(r7);
  assert.ok(b7.length > renderizar(r0).length);
  const s = saturar(Float32Array.from([0, 0.5, 1, 5, -5]));
  assert.ok(Math.abs(s[2] - 0.92) < 1e-6 && Math.abs(s[3]) <= 1 && s[4] >= -1);
  const wav = aWav(Float32Array.from([0, 0.5, -0.5]));
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(wav.length, 44 + 6);
  assert.equal(new DataView(wav.buffer).getInt16(46, true), 16000);
});

test("banco: variantes distintas, nunca la misma dos veces, antirepetición", () => {
  const b = new BancoSonidos(4);
  b.registrar("golpe", recetaImpacto("piedra"));
  const a = b.tocar("golpe", 0, 0.1)!;
  const c = b.tocar("golpe", 0.01, 0.1);
  assert.equal(c, null, "dentro de 35 ms no se repite");
  const d = b.tocar("golpe", 0.1, 0.1)!;
  assert.notEqual(a, d, "nunca la misma variante seguida");
  assert.throws(() => b.tocar("nada", 0, 0), /desconocido/);
});

test("música: escalas, transformaciones y capas por energía/estado", () => {
  assert.equal(grado(ESCALAS.mayor, 60, 7), 72);
  assert.equal(grado(ESCALAS.mayor, 60, -1), 59);
  assert.ok(Math.abs(midiAHz(69) - 440) < 1e-9);
  assert.deepEqual(transformarMotivo([0, 2, 4], "inversion"), [0, -2, -4]);
  assert.deepEqual(transformarMotivo([0, 2, 4], "retrogrado"), [4, 2, 0]);
  const id = IDENTIDADES_EJEMPLO.ruinas;
  const calma = mezclaPara(id, { modo: "combate", energia: 0.3, peligro: 0 });
  const furia = mezclaPara(id, { modo: "combate", energia: 0.9, peligro: 0 });
  assert.equal(calma.volumen.filo, 0);
  assert.ok(furia.volumen.filo > 0 && furia.volumen.coro > 0 && furia.tempo > calma.tempo);
  assert.ok(mezclaPara(id, { modo: "jefe", energia: 0, peligro: 0 }).volumen.motivo > 0, "el jefe sube la energía mínima");
  const peligro = mezclaPara(id, { modo: "combate", energia: 0.5, peligro: 1 });
  assert.ok(peligro.volumen.latido > 0 && peligro.corte < 2000);
  assert.equal(mezclaPara(id, { modo: "combate", energia: 0.5, peligro: 0, tension: true }).tempo, 140);
});

test("director: los cambios caen al empezar el compás siguiente", () => {
  const d = new DirectorMusical(IDENTIDADES_EJEMPLO.ruinas, { modo: "explora", energia: 0, peligro: 0 });
  const compas = d.duracionCompas;
  let notas = d.actualizar(compas * 0.5);
  assert.ok(notas.length > 0);
  assert.ok(notas.every((n) => n.capa !== "filo"));
  d.estado({ modo: "combate", energia: 1, peligro: 0 });
  notas = d.actualizar(compas * 0.4);
  assert.ok(notas.every((n) => n.capa !== "filo"), "a mitad de compás no cambia");
  notas = d.actualizar(compas * 0.2);
  const filo = notas.filter((n) => n.capa === "filo");
  assert.ok(filo.length > 0 && filo[0].t >= compas - 1e-9, "el filo entra en el compás siguiente");
  d.cambiarZona(IDENTIDADES_EJEMPLO.forja);
  d.actualizar(d.duracionCompas * 2);
  assert.equal(d.identidad.nombre, "Forja");
});
