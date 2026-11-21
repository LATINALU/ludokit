import { test } from "node:test";
import assert from "node:assert/strict";
import { escalarMedidas, huesosPorProfundidad, ik2Huesos, ik2Huesos2D, MEDIDAS_24PX, mezclarPoses, POSE_DE_PIE, poseEn, resolverEsqueleto, ARTICULACIONES, type V3 } from "../src/animacion/esqueleto.ts";

const d = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("IK de 2 huesos: llega exacto si alcanza, se estira sin romperse si no, y se dobla hacia el polo", () => {
  const r = ik2Huesos([0, 0, 0], [6, 2, 0], 5, 5, [0, -1, 0]);
  assert.ok(d(r.extremo, [6, 2, 0]) < 1e-6);
  assert.ok(Math.abs(d([0, 0, 0], r.articulacion) - 5) < 1e-6 && Math.abs(d(r.articulacion, r.extremo) - 5) < 1e-6);
  assert.ok(r.articulacion[1] < 0, "se dobla hacia el polo (arriba)");
  const lejos = ik2Huesos([0, 0, 0], [100, 0, 0], 5, 5, [0, 1, 0]);
  assert.ok(Math.abs(d([0, 0, 0], lejos.extremo) - 10) < 1e-3, "estirado al máximo, sin estirar huesos");
  const k2 = ik2Huesos2D(0, 0, 4, 4, 4, 4, -1);
  assert.ok(Math.abs(Math.hypot(k2.ex - 4, k2.ey - 4)) < 1e-6);
});

test("esqueleto: 21 puntos, huesos de largo fijo en cualquier pose, giro mueve los hombros", () => {
  const m = MEDIDAS_24PX;
  const poses = [POSE_DE_PIE, { ...POSE_DE_PIE, agachar: 3, inclinar: 0.4, giro: 0.6, manoN: [10, -14, 4] as V3, pieN: [5, 0, 1] as V3 }];
  for (const p of poses) {
    const e = resolverEsqueleto(p, m);
    assert.equal(Object.keys(e).length, ARTICULACIONES.length);
    assert.equal(ARTICULACIONES.length, 21);
    assert.ok(Math.abs(d(e.hombroN, e.codoN) - m.brazo) < 1e-6);
    assert.ok(Math.abs(d(e.codoN, e.manoN) - m.antebrazo) < 1e-6);
    assert.ok(Math.abs(d(e.caderaF, e.rodillaF) - m.muslo) < 1e-6);
    assert.ok(Math.abs(d(e.pelvis, e.cintura) - m.espina1) < 1e-6);
    assert.ok(e.coronilla[1] < e.pecho[1] && e.pecho[1] < e.pelvis[1], "la cabeza arriba (y negativa)");
  }
  const sin = resolverEsqueleto(POSE_DE_PIE), con = resolverEsqueleto({ ...POSE_DE_PIE, giro: 1 });
  assert.ok(Math.abs(con.hombroN[0] - sin.hombroN[0]) > 1, "el giro trae el hombro");
  assert.equal(huesosPorProfundidad(sin).length, 18);
  const grande = escalarMedidas(m, 2);
  assert.equal(grande.brazo, m.brazo * 2);
});

test("pistas de poses: escalones a 12 fps, snap y mezcla suave", () => {
  const golpe = { ...POSE_DE_PIE, manoN: [12, -12, 2] as V3 };
  const pista = [[0, POSE_DE_PIE], [0.5, golpe]] as const;
  const a = poseEn(pista, 0.26), b = poseEn(pista, 0.3);
  assert.deepEqual(a, b, "dentro del mismo escalón de 1/12 s la pose no cambia");
  const medio = poseEn(pista, 0.25, 0);
  assert.ok(medio.manoN[0] > 3 && medio.manoN[0] < 12);
  const snap = [[0, POSE_DE_PIE], [0.5, golpe, "snap"]] as const;
  assert.deepEqual(poseEn(snap, 0.4, 0).manoN, POSE_DE_PIE.manoN, "snap: mantiene la anterior hasta la clave");
  assert.deepEqual(poseEn(snap, 0.6).manoN, golpe.manoN);
  assert.deepEqual(mezclarPoses(POSE_DE_PIE, golpe, 1).manoN, golpe.manoN);
});
