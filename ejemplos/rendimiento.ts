// Benchmark de TypeScript con las MISMAS cargas que `rust/examples/rendimiento.rs`, para comparar lenguajes y
// estructuras de datos. Uso: node ejemplos/rendimiento.ts   (y en rust/: cargo run --release --example rendimiento)
// La horda usa el mismo algoritmo que el `Multitud` de Rust (estructura de arreglos + grilla por conteo), escrito con
// Float32Array: así la diferencia que se mide es del lenguaje, no del algoritmo.

import { Pcg32, v3, vec3 } from "../src/nucleo/index.ts";
import { lanzarRayo, type Colisionador3D } from "../src/espacial/index.ts";
import { CampoFlujo } from "../src/contextos/navegacion/index.ts";
import { NieblaGuerra } from "../src/contextos/vision/index.ts";

function medir<T>(nombre: string, ops: number, f: () => T): T {
  const t = performance.now();
  const r = f();
  const ms = performance.now() - t;
  console.log(JSON.stringify({ prueba: nombre, ms: Math.round(ms * 100) / 100, us_por_op: Math.round((ms * 1000 / ops) * 1e4) / 1e4 }));
  return r;
}

const p = new Pcg32(7);
const f = (a: number, b: number): number => a + p.siguiente() * (b - a);

// 1) Disparos: 2 000 cápsulas, 20 000 rayos (búsqueda lineal: lo que hace `lanzarRayo`).
const escena: Colisionador3D[] = [];
for (let i = 0; i < 2000; i++) {
  const x = f(-100, 100), z = f(-100, 100);
  escena.push({ id: i, duenio: i, etiqueta: "1", forma: { tipo: "capsula", a: v3(x, 0.3, z), b: v3(x, 1.5, z), radio: 0.35 } });
}
const rayos = Array.from({ length: 20_000 }, () => {
  const d = vec3.normalizar(v3(f(-1, 1), f(-0.05, 0.05), f(-1, 1)));
  return { origen: v3(f(-100, 100), 1.2, f(-100, 100)), dir: d, largo: 150 };
});
const imp = medir("rayos_lineal_20k_x_2000", rayos.length, () => rayos.filter((r) => lanzarRayo(escena, r) !== null).length);
console.log(JSON.stringify({ impactos: imp }));

// 2) Campo de flujo 256×256, 20 recálculos.
const bloq = new Uint8Array(256 * 256).map((_, i) => ((i % 256) % 16 === 8 && Math.floor(i / 256) % 32 < 24 ? 1 : 0));
const campo = new CampoFlujo(256, 256);
medir("campo_flujo_256x256_x20", 20, () => {
  for (let k = 0; k < 20; k++) campo.calcular([[128 + k, 128]], (c, r) => (bloq[r * 256 + c] ? Infinity : 1));
});

// 3) Horda: 5 000 agentes, 300 pasos (mismo algoritmo que Rust: direcciones precalculadas por celda + mezcla bilineal).
const DIRX = new Float32Array(256 * 256), DIRY = new Float32Array(256 * 256);
for (let r = 0; r < 256; r++) for (let c = 0; c < 256; c++) { const [a, b] = campo.direccion(c, r); DIRX[r * 256 + c] = a; DIRY[r * 256 + c] = b; }
function direccionSuave(x: number, y: number): [number, number] {
  const fx = x - 0.5, fy = y - 0.5, c0 = Math.floor(fx), f0 = Math.floor(fy), tx = fx - c0, ty = fy - f0;
  let dx = 0, dy = 0, peso = 0;
  for (const [dc, df, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
    const c = c0 + dc, f = f0 + df;
    if (c < 0 || f < 0 || c >= 256 || f >= 256 || !Number.isFinite(campo.distancia[f * 256 + c])) continue;
    dx += DIRX[f * 256 + c] * w; dy += DIRY[f * 256 + c] * w; peso += w;
  }
  const l = Math.hypot(dx, dy);
  return peso > 0 && l > 1e-6 ? [dx / l, dy / l] : [0, 0];
}
const N = 5000, tile = 1, vel = 4, acel = 20, radio = 0.6, sep = 2, LLEGADA = 3;
const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
for (let i = 0; i < N; i++) { X[i] = f(1, 255); Y[i] = f(1, 255); }
const celdaDe = new Uint32Array(N), orden = new Uint32Array(N);
let inicio = new Uint32Array(1);
const bloqueada = (c: number, r: number): boolean => c < 0 || r < 0 || c >= 256 || r >= 256 || bloq[r * 256 + c] !== 0;
function paso(dt: number): void {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); y0 = Math.min(y0, Y[i]); x1 = Math.max(x1, X[i]); y1 = Math.max(y1, Y[i]); }
  const gcols = Math.max(1, Math.floor((x1 - x0) / radio) + 1), gfilas = Math.max(1, Math.floor((y1 - y0) / radio) + 1);
  const total = gcols * gfilas;
  if (inicio.length < total + 1) inicio = new Uint32Array(total + 1); else inicio.fill(0, 0, total + 1);
  for (let i = 0; i < N; i++) {
    const k = Math.floor((Y[i] - y0) / radio) * gcols + Math.floor((X[i] - x0) / radio);
    celdaDe[i] = k;
    inicio[k + 1]++;
  }
  for (let k = 0; k < total; k++) inicio[k + 1] += inicio[k];
  const cursor = inicio.slice(0, total + 1);
  for (let i = 0; i < N; i++) orden[cursor[celdaDe[i]]++] = i;
  const r2 = radio * radio;
  for (let i = 0; i < N; i++) {
    const px = X[i], py = Y[i];
    const c = Math.floor(px / tile), r = Math.floor(py / tile);
    const dentro = c >= 0 && r >= 0 && c < 256 && r < 256;
    let [dx, dy] = dentro ? direccionSuave(px / tile, py / tile) : [0, 0];
    const lleg = dentro ? Math.min(1, Math.max(0, campo.distancia[r * 256 + c] / LLEGADA)) : 1;
    dx *= vel * lleg; dy *= vel * lleg;
    const gc = Math.floor((px - x0) / radio), gf = Math.floor((py - y0) / radio);
    let sx = 0, sy = 0;
    for (let ff = Math.max(0, gf - 1); ff <= Math.min(gfilas - 1, gf + 1); ff++) {
      for (let cc = Math.max(0, gc - 1); cc <= Math.min(gcols - 1, gc + 1); cc++) {
        const k = ff * gcols + cc;
        for (let q = inicio[k]; q < inicio[k + 1]; q++) {
          const j = orden[q];
          if (j === i) continue;
          const ox = px - X[j], oy = py - Y[j], d2 = ox * ox + oy * oy;
          if (d2 < r2 && d2 > 1e-9) { const d = Math.sqrt(d2), w = (radio - d) / (radio * d); sx += ox * w; sy += oy * w; }
        }
      }
    }
    dx += sx * sep; dy += sy * sep;
    const pa = acel * dt, ex = dx - VX[i], ey = dy - VY[i], el = Math.hypot(ex, ey);
    if (el <= pa) { VX[i] = dx; VY[i] = dy; } else { VX[i] += (ex / el) * pa; VY[i] += (ey / el) * pa; }
  }
  for (let i = 0; i < N; i++) {
    const nx = X[i] + VX[i] * dt, ny = Y[i] + VY[i] * dt;
    if (bloqueada(Math.floor(nx / tile), Math.floor(Y[i] / tile))) VX[i] = 0; else X[i] = nx;
    if (bloqueada(Math.floor(X[i] / tile), Math.floor(ny / tile))) VY[i] = 0; else Y[i] = ny;
  }
}
medir("horda_5000_x300_pasos", 300, () => { for (let s = 0; s < 300; s++) paso(1 / 60); });

// 4) Niebla de guerra 256×256, 100 fuentes de radio 10, 30 actualizaciones.
const n = new NieblaGuerra(256, 256, (c, r) => bloq[r * 256 + c] !== 0);
const fuentes = Array.from({ length: 100 }, () => ({ x: f(0, 256), y: f(0, 256), radio: 10 }));
medir("niebla_256x256_100fuentes_x30", 30, () => { for (let k = 0; k < 30; k++) n.actualizar(fuentes); });
