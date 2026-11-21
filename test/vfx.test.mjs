// VFX de terceros (MIT, ver terceros/vfx/LICENSE): verifica que el motor de efectos funciona desde la librería.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite } from "../terceros/vfx/core/index.js";
import * as nova from "../terceros/vfx/fx/ice/frost-nova.js";

test("vfx: un efecto se simula, se dibuja en dos capas y se compone", () => {
  const f = createFrame(160, 120);
  const out = new Uint8ClampedArray(160 * 120 * 4);
  const e = createFx(nova, { x: 80, y: 100, seed: 3 });
  for (let i = 0; i < 30; i++) {
    e.update(1 / 60);
    clearFrame(f);
    e.draw(f, "back");
    e.draw(f, "front");
    composite(f, out, 0xff000000);
  }
  let encendidos = 0;
  for (let i = 0; i < out.length; i += 4) if (out[i] + out[i + 1] + out[i + 2] > 0) encendidos++;
  assert.ok(encendidos > 1000);
});
