import { test } from "node:test";
import assert from "node:assert/strict";
import { alfaBinaria, cajaVisible, colorDeContorno, contornear, crearImagen, desdeAscii, escalarVecino, girarTono, leer, reescalarSprite, silueta } from "../src/grafico/imagen.ts";
import { aOklab, aplicarGradacion, desdeOklab, GRADACION_NEUTRA, hexARgb, hornearLut, mezclarOklab, Paleta, rgbAHex } from "../src/grafico/color.ts";
import { empaquetar, EmpaquetadorAtlas } from "../src/grafico/atlas.ts";
import { mapaNormales } from "../src/grafico/normales.ts";
import { bezier3, catmullRom, cinta, largoPolilinea, suavizar } from "../src/grafico/curvas.ts";
import { anchoTexto, dibujarTexto, GLIFOS_3X5, pixelGlifo, TextosFlotantes } from "../src/grafico/fuente-pixel.ts";
import { posicionesParallax } from "../src/grafico/parallax.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";

const SPRITE = ["..kk..", ".kRRk.", "kRRRRk", ".kRRk.", "..kk.."];
const PAL = { k: [20, 10, 30] as const, R: [200, 40, 40] as const };

test("imagen: ascii, vecino, alfa binaria, contorno, silueta, caja y color de contorno", () => {
  const im = desdeAscii(SPRITE, PAL);
  assert.equal(im.w, 6);
  assert.deepEqual(leer(im, 2, 2), [200, 40, 40, 255]);
  assert.deepEqual(leer(escalarVecino(im, 12, 10), 5, 5), [200, 40, 40, 255]);
  const c = contornear(im);
  assert.equal(c.w, 8);
  assert.deepEqual(leer(c, 0, 3), [16, 12, 22, 255], "contorno a la izquierda de la k");
  assert.deepEqual(leer(c, 1, 3), [20, 10, 30, 255], "el sprite queda corrido 1 px");
  assert.deepEqual(leer(silueta(im), 2, 2), [255, 255, 255, 255]);
  assert.deepEqual(cajaVisible(im), { x: 0, y: 0, w: 6, h: 5 });
  assert.deepEqual(colorDeContorno(im), [20, 10, 30, 255]);
  const r = reescalarSprite(im, 12);
  assert.equal(r.h, 12);
  const semi = crearImagen(1, 1);
  semi.datos.set([10, 10, 10, 100]);
  assert.equal(leer(alfaBinaria(semi), 0, 0)[3], 0);
  assert.deepEqual(leer(girarTono(desdeAscii(["R"], { R: [255, 0, 0] }), 120), 0, 0), [0, 255, 0, 255]);
});

test("color: OKLab ida y vuelta, mezcla perceptual, paleta, gradación neutra y LUT", () => {
  for (const h of [0x000000, 0xffffff, 0xff8800, 0x3366cc]) {
    const c = hexARgb(h);
    const v = desdeOklab(aOklab(c));
    assert.equal(rgbAHex(v), h, `ida y vuelta ${h.toString(16)}`);
  }
  assert.ok(Math.abs(aOklab([1, 1, 1])[0] - 1) < 1e-6);
  const m = mezclarOklab([1, 0, 0], [0, 0, 1], 0.5);
  assert.ok(m[0] > 0.5 && m[2] > 0.5, "más luminoso que el promedio sRGB (0.5, 0, 0.5): sin gris sucio");
  const p = new Paleta([0x000000, 0xff0000, 0xffffff]);
  assert.deepEqual(p.masCercano([0.9, 0.1, 0.1]), [1, 0, 0]);
  assert.deepEqual(aplicarGradacion(GRADACION_NEUTRA, [0.3, 0.5, 0.7]).map((x) => Math.round(x * 1000)), [300, 500, 700]);
  const pura = aplicarGradacion({ ...GRADACION_NEUTRA, paleta: p, mezclaPaleta: 1 }, [0.2, 0.25, 0.2]);
  assert.deepEqual(pura, [0, 0, 0], "paleta pura: solo colores de la paleta");
  const lut = hornearLut(GRADACION_NEUTRA, 8);
  assert.equal(lut.w, 64);
  assert.deepEqual([...lut.datos.slice((7 * 64 + 7 * 8 + 7) * 4, (7 * 64 + 7 * 8 + 7) * 4 + 4)], [255, 255, 255, 255]);
});

test("atlas skyline: sin solapes, dentro de la textura, crece a potencia de 2", () => {
  const az = new Pcg32(5);
  const rects = Array.from({ length: 120 }, (_, i) => ({ nombre: `s${i}`, w: az.rango(4, 40), h: az.rango(4, 40) }));
  const r = empaquetar(rects);
  const lista = [...r.regiones.values()];
  assert.equal(lista.length, 120);
  for (const a of lista) assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= r.lado && a.y + a.h <= r.lado);
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i], b = lista[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.nombre} y ${b.nombre} se solapan`);
  }
  assert.ok(r.ocupacion > 0.2, `ocupación ${r.ocupacion}`);
  const exacto = new EmpaquetadorAtlas(128, 128, 0);
  for (let i = 0; i < 64; i++) assert.ok(exacto.colocar(`t${i}`, 16, 16), "64 tiles de 16 llenan 128² sin desperdicio");
  assert.equal(exacto.ocupacion, 1);
  assert.equal(new EmpaquetadorAtlas(16, 16).colocar("x", 20, 4), null);
});

test("normales: plano hacia la cámara, rampa inclina, bisel en la silueta", () => {
  const plano = desdeAscii(["RRRR", "RRRR", "RRRR"], { R: [128, 128, 128] });
  assert.deepEqual(leer(mapaNormales(plano), 1, 1), [128, 128, 255, 255]);
  const rampa = crearImagen(8, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) rampa.datos.set([x * 30, x * 30, x * 30, 255], (y * 8 + x) * 4);
  assert.ok(leer(mapaNormales(rampa), 4, 1)[0] < 128, "la normal se inclina contra la subida");
  const n = mapaNormales(desdeAscii(SPRITE, PAL));
  assert.deepEqual(leer(n, 0, 0), [128, 128, 255, 255], "lo transparente es plano");
});

test("curvas: centrípeta pasa por los puntos y no hace lazos; bezier; cinta", () => {
  const a: [number, number] = [0, 0], b: [number, number] = [10, 0], c: [number, number] = [10.5, 0.2], d: [number, number] = [0, 1];
  assert.deepEqual(catmullRom(a, b, c, d, 0).map(Math.round), [10, 0]);
  const curva = Array.from({ length: 21 }, (_, i) => catmullRom(a, b, c, d, i / 20));
  for (const p of curva) assert.ok(p[0] <= 10.6 && p[0] >= 9.9, "sin lazo entre b y c");
  const s = suavizar([[0, 0], [10, 10], [20, 0]], 4);
  assert.equal(s.length, 9);
  assert.deepEqual(s[4].map((x) => Math.round(x)), [10, 10]);
  assert.deepEqual(bezier3([0, 0], [0, 10], [10, 10], [10, 0], 0.5), [5, 7.5]);
  const t = cinta([[[0, 0], [0, -10]], [[5, 0], [8, -8]], [[10, 0], [15, 0]]], 3);
  assert.equal(t.length, 6);
  assert.equal(t[t.length - 1].u1, 1);
  assert.equal(largoPolilinea([[0, 0], [3, 4]]), 5);
});

test("fuente 3×5 y textos flotantes", () => {
  assert.ok(pixelGlifo(GLIFOS_3X5["1"], 1, 0) && !pixelGlifo(GLIFOS_3X5["1"], 0, 0));
  assert.equal(anchoTexto("123"), 11);
  const im = crearImagen(20, 9);
  dibujarTexto(im, "7", 2, 2, [255, 255, 255, 255], { contorno: [0, 0, 0, 255] });
  assert.deepEqual(leer(im, 2, 2), [255, 255, 255, 255]);
  assert.deepEqual(leer(im, 1, 2), [0, 0, 0, 255]);
  const t = new TextosFlotantes(2);
  t.agregar("12", 50, 50);
  t.agregar("99", 50, 50, 0xff0000ff, true);
  t.agregar("3", 50, 50);
  assert.equal(t.vivos, 2, "lleno: reemplaza el más viejo");
  t.actualizar(0.3);
  assert.ok(t.y[0] < 50);
  t.actualizar(2);
  assert.equal(t.vivos, 0);
});

test("parallax: factor, repetición y deriva", () => {
  const [cielo, montes] = posicionesParallax([{ id: "cielo", factor: [0, 0], repetir: [0, 0] }, { id: "montes", factor: [0.5, 0], repetir: [100, 0], deriva: [10, 0] }], 250, 40, 1, 320, 180);
  assert.deepEqual([cielo.x, cielo.y], [0, 0]);
  assert.ok(montes.x <= 0 && montes.x > -100);
  assert.equal(montes.copiasX, 5);
});

test("png: archivo válido (firma, CRC de cada trozo) y decodificable", async () => {
  const { codificarPng, crc32 } = await import("../src/grafico/png.ts");
  const { inflateSync } = await import("node:zlib");
  const im = desdeAscii(SPRITE, PAL);
  const png = codificarPng(im);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer);
  let o = 8;
  const trozos: string[] = [];
  let idat = new Uint8Array(0);
  while (o < png.length) {
    const len = dv.getUint32(o);
    const tipo = String.fromCharCode(...png.slice(o + 4, o + 8));
    assert.equal(dv.getUint32(o + 8 + len), crc32(png, o + 4, o + 8 + len), `CRC ${tipo}`);
    if (tipo === "IDAT") idat = png.slice(o + 8, o + 8 + len);
    trozos.push(tipo);
    o += 12 + len;
  }
  assert.deepEqual(trozos, ["IHDR", "IDAT", "IEND"]);
  const crudo = inflateSync(idat);
  assert.equal(crudo.length, (6 * 4 + 1) * 5);
  assert.deepEqual([...crudo.slice(1 + 2 * 25 + 2 * 4, 1 + 2 * 25 + 2 * 4 + 4)], [200, 40, 40, 255], "píxel (2,2) intacto");
});
