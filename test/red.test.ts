import { test } from "node:test";
import assert from "node:assert/strict";
import { Despachador, enmarcar, EscritorPaquete, ExtractorTramas, LectorPaquete } from "../src/red/paquetes.ts";

test("escribir y leer un paquete", () => {
  const w = new EscritorPaquete().u8(39).u8(1).i64(123456789012n).i32(-5).i16(3).cadenaCorta("Poción");
  const r = new LectorPaquete(w.aBytes());
  assert.equal(r.u8(), 39);
  assert.equal(r.u8(), 1);
  assert.equal(r.i64(), 123456789012n);
  assert.equal(r.i32(), -5);
  assert.equal(r.i16(), 3);
  assert.equal(r.cadenaCorta(), "Poción");
  assert.equal(r.disponible, 0);
  assert.throws(() => r.u8(), /Paquete corto/);
});

test("el extractor arma tramas partidas o pegadas", () => {
  const t1 = enmarcar(new Uint8Array([1, 2, 3]));
  const t2 = enmarcar(new Uint8Array([9]));
  const todo = new Uint8Array([...t1, ...t2]);
  const ex = new ExtractorTramas();
  assert.deepEqual(ex.empujar(todo.slice(0, 3)), []);
  const tramas = ex.empujar(todo.slice(3));
  assert.deepEqual(tramas.map((t) => [...t]), [[1, 2, 3], [9]]);
});

test("despachador: manejador, desconocido y error aislado", () => {
  const errores: number[] = [];
  const d = new Despachador<{ oro: number }>((id) => errores.push(id));
  d.registrar(33, (ctx, r) => { ctx.oro -= r.i32(); });
  const ctx = { oro: 100 };
  assert.equal(d.manejar(ctx, new EscritorPaquete().u8(33).i32(40).aBytes()), "ok");
  assert.equal(ctx.oro, 60);
  assert.equal(d.manejar(ctx, new Uint8Array([77])), "desconocido");
  assert.equal(d.manejar(ctx, new Uint8Array([33, 1])), "error");
  assert.deepEqual(errores, [33]);
  assert.throws(() => d.registrar(33, () => {}), /ya registrado/);
});
