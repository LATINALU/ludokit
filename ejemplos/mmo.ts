// Ejemplo integrador de un servidor tipo MMO (sin sockets): N jugadores en un mundo grande, servidor autoritativo
// a 20 Hz, área de interés con histéresis, compresión delta contra el último estado confirmado, limitador de tasa
// y validación anti-trampa. Mide el ancho de banda con y sin delta.
// Uso: node ejemplos/mmo.ts [jugadores]

import { Pcg32 } from "../src/nucleo/index.ts";
import { calcularDelta, cuantizar, GestorInteres, LimitadorTasa, ServidorAutoritativo, type MundoServidor } from "../src/red/index.ts";

type Est = { x: number; y: number; hp: number; anim: string };
type Ent = { dx: number; dy: number };

const N = Number(process.argv[2] ?? 200);
const az = new Pcg32(3);
const estados = new Map<string, Est>();
const interes = new GestorInteres(300, 360, 128);
const limitadores = new Map<string, LimitadorTasa>();
let tiempo = 0;
for (let i = 0; i < N; i++) estados.set(`p${i}`, { x: az.rangoF(0, 4000), y: az.rangoF(0, 4000), hp: 100, anim: "quieto" });

const mundo: MundoServidor<Est, Ent> = {
  aplicarEntrada(j, e, dt) {
    const s = estados.get(j)!;
    const nx = s.x + e.dx * 120 * dt, ny = s.y + e.dy * 120 * dt;
    estados.set(j, { ...s, x: cuantizar(nx), y: cuantizar(ny), anim: e.dx || e.dy ? "correr" : "quieto" });
  },
  simular() {
    for (const [id, s] of estados) interes.mover(id, s.x, s.y);
  },
  estadoDe: (id) => estados.get(id),
  visiblesPara: (j) => interes.actualizar(j).visibles,
  validar(j, e) {
    const lim = limitadores.get(j)!;
    return Math.hypot(e.datos.dx, e.datos.dy) <= 1.0001 && lim.permitir(tiempo);
  },
};

const srv = new ServidorAutoritativo(mundo, 20);
for (const id of estados.keys()) {
  srv.conectar(id);
  limitadores.set(id, new LimitadorTasa(10, 40));
}
const ultimoEnviado = new Map<string, Map<string, Est>>();
let bytesCompletos = 0;
let bytesDelta = 0;
const seqs = new Map<string, number>();
const t0 = performance.now();
for (let tick = 0; tick < 200; tick++) {
  tiempo += 1 / 20;
  for (const id of estados.keys()) {
    const a = az.rangoF(0, Math.PI * 2);
    const seq = (seqs.get(id) ?? 0) + 1;
    seqs.set(id, seq);
    srv.recibir(id, { seq, dt: 1 / 20, datos: az.prob(0.7) ? { dx: Math.cos(a), dy: Math.sin(a) } : { dx: 0, dy: 0 } });
  }
  // Un tramposo: velocidad ×5.
  srv.recibir("p0", { seq: 99999 + tick, dt: 1 / 20, datos: { dx: 5, dy: 0 } });
  for (const [j, snap] of srv.paso()) {
    bytesCompletos += JSON.stringify(snap).length;
    const previo = ultimoEnviado.get(j) ?? new Map<string, Est>();
    const deltas: Record<string, unknown> = {};
    for (const [id, s] of Object.entries(snap.otros)) {
      const d = calcularDelta(previo.get(id), s);
      if (Object.keys(d.cambios).length || d.quitados.length) deltas[id] = d.cambios;
      previo.set(id, s);
    }
    for (const id of previo.keys()) if (!(id in snap.otros)) previo.delete(id);
    ultimoEnviado.set(j, previo);
    bytesDelta += JSON.stringify({ t: snap.tick, a: snap.ackSeq, p: snap.propio, d: deltas }).length;
  }
}
const ms = performance.now() - t0;
const vis = [...estados.keys()].map((id) => interes.visiblesDe(id).size);
console.log(`${N} jugadores · 200 ticks a 20 Hz · ${(ms / 200).toFixed(2)} ms por tick (incluye serializar)`);
console.log(`Visibles por jugador: promedio ${(vis.reduce((s, x) => s + x, 0) / N).toFixed(1)}, máximo ${Math.max(...vis)}`);
console.log(`Ancho de banda: completo ${(bytesCompletos / 1024 / 10).toFixed(0)} KB/s · con delta ${(bytesDelta / 1024 / 10).toFixed(0)} KB/s (${((1 - bytesDelta / bytesCompletos) * 100).toFixed(0)} % menos)`);
console.log(`Entradas rechazadas por el anti-trampa: ${srv.rechazadas}`);
