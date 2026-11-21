// Criaturas por receta (terceros/vfx, MIT): cada receta se dibuja y anima.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite } from "../terceros/vfx/core/index.js";
import * as criatura from "../terceros/vfx/fx/criaturas/criatura.js";
import { RECETAS } from "../terceros/vfx/fx/criaturas/recetas.js";

test("criaturas: todas las recetas se dibujan y la animación cambia entre cuadros", () => {
  const tipos = Object.keys(RECETAS);
  assert.ok(tipos.length >= 20, `${tipos.length} recetas`);
  for (const tipo of tipos) {
    const f = createFrame(96, 96);
    const out = new Uint8ClampedArray(96 * 96 * 4);
    const fx = createFx(criatura, { x: 48, y: 86, tipo, escala: 0.68 });
    const huella = [];
    for (let i = 0; i < 2; i++) {
      fx.update(0.4);
      clearFrame(f);
      fx.draw(f);
      composite(f, out, null);
      let n = 0, s = 0;
      for (let k = 3; k < out.length; k += 4) if (out[k] > 0) { n++; s += k; }
      huella.push(s);
      assert.ok(n > 30, `${tipo}: dibuja (${n} píxeles)`);
    }
    assert.notEqual(huella[0], huella[1], `${tipo}: se anima`);
  }
});
