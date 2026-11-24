// GOLDEN MASTER: corre simulaciones deterministas de N pasos y guarda el ESTADO COMPLETO (no solo una salida).
// `test/golden.test.ts` las vuelve a correr y compara campo por campo. Si un cambio altera la simulación, el test
// dice exactamente qué campo divergió y en qué escenario. Si el cambio es intencional: `npm run golden` y revisar el
// diff de vectores/golden.json en el commit (documentar por qué cambió).
//
// Política de tolerancia (ver docs/DETERMINISMO.md): dentro de TypeScript la comparación es EXACTA (ε = 0); entre
// lenguajes (Rust, C++, Python) se acepta ε relativo = 1e-6 en flotantes y exactitud en enteros, booleanos y textos.

import { writeFileSync } from "node:fs";
import { Pcg32 } from "../src/nucleo/pcg32.ts";
import { v3, vec3 } from "../src/nucleo/vec3.ts";
import { Controlador3D } from "../src/contextos/fisica/dominio/controlador3d.ts";
import { Arma } from "../src/contextos/disparos/dominio/arma.ts";
import { Dispersion, Retroceso } from "../src/contextos/disparos/dominio/punteria.ts";
import { SaludPorPartes } from "../src/contextos/disparos/dominio/salud-partes.ts";
import { Vehiculo } from "../src/contextos/carreras/dominio/carreras.ts";
import { Director } from "../src/contextos/encuentros/dominio/director.ts";
import { ColaTiempo } from "../src/contextos/turnos/dominio/turnos.ts";
import { Mazo } from "../src/contextos/mazo/dominio/mazo.ts";
import { Lanzador } from "../src/contextos/combate/dominio/lanzamiento.ts";
import { ficha, municion, PARTES_HUMANOIDE } from "../src/datos/armas.ts";
import { vehiculo } from "../src/datos/vehiculos.ts";
import * as P from "../src/modelos/piezas.ts";

const DT = 1 / 60;

/** Escenarios: cada uno devuelve una lista de estados (uno cada `cada` pasos) para ver DÓNDE empieza a divergir. */
export const ESCENARIOS: Readonly<Record<string, () => unknown[]>> = {
  controlador3d: () => {
    const c = new Controlador3D(v3(0, 0, 0), P.MOV_FPS_ARENA);
    const suelo = (x: number, z: number) => Math.sin(x * 0.1) * 0.5 + Math.cos(z * 0.13) * 0.4;
    const r: unknown[] = [];
    for (let i = 0; i < 600; i++) {
      c.actualizar(DT, { adelante: 1, derecha: Math.sin(i / 40), yaw: i * 0.01, saltar: i % 90 < 3, correr: i > 200, agachar: i > 400 && i < 430 }, suelo);
      if (i % 60 === 59) r.push({ pos: c.pos, vel: c.vel, enSuelo: c.enSuelo, agachado: c.agachado, deslizando: c.deslizando });
    }
    return r;
  },
  arma: () => {
    const f = ficha("carabina-556");
    const az = new Pcg32(77);
    const a = new Arma(f.arma, 90, { azar: az });
    const d = new Dispersion(f.dispersion);
    const re = new Retroceso(f.retroceso);
    const r: unknown[] = [];
    let dir = v3(0, 0, 1);
    for (let i = 0; i < 600; i++) {
      for (const e of a.actualizar(DT, i % 200 < 120)) {
        if (e.tipo === "disparo") {
          dir = d.disparar(v3(0, 0, 1), i % 300 < 150 ? "quieto" : "caminando", az);
          re.disparar(e.numero, az, 0.2);
        }
      }
      if (a.balas === 0) a.recargar();
      d.actualizar(DT);
      re.actualizar(DT);
      if (i % 60 === 59) r.push({ balas: a.balas, reserva: a.reserva, estado: a.estado, bloom: d.bloom, pitch: re.pitch, yaw: re.yaw, dir });
    }
    return r;
  },
  saludPartes: () => {
    const s = new SaludPorPartes(PARTES_HUMANOIDE, P.SALUD_TACTICA);
    const az = new Pcg32(5);
    const m = municion("7.62x39");
    const partes = Object.keys(PARTES_HUMANOIDE);
    const r: unknown[] = [];
    for (let i = 0; i < 40 && !s.muerto; i++) {
      s.recibir(partes[Math.floor(az.siguiente() * partes.length)], m.danio * 0.3, az, { sangrado: m.sangrado, fractura: m.fractura });
      s.actualizar(0.5);
      r.push({ total: s.total, muerto: s.muerto, partes: Object.fromEntries([...s.partes].map(([k, p]) => [k, [p.vida, p.sangrado, p.fractura]])) });
    }
    return r;
  },
  vehiculo: () => {
    const v = new Vehiculo(vehiculo("rally").def);
    const r: unknown[] = [];
    for (let i = 0; i < 900; i++) {
      v.actualizar(DT, { acelerador: i < 600 ? 1 : 0, freno: i >= 700 ? 1 : 0, direccion: Math.sin(i / 50), frenoMano: i > 400 && i < 420 });
      if (i % 60 === 59) r.push({ x: v.x, y: v.y, angulo: v.angulo, vx: v.vx, vy: v.vy, giro: v.giro, marcha: v.marcha, rpm: v.rpm, derrapando: v.derrapando });
    }
    return r;
  },
  director: () => {
    const d = new Director(P.DIRECTOR_ZOMBIS, new Pcg32(9));
    const vivos = new Map<string, number>();
    const r: unknown[] = [];
    for (let i = 0; i < 3600; i++) {
      for (const t of d.actualizar(DT, vivos)) vivos.set(t, (vivos.get(t) ?? 0) + 1);
      if (i % 45 === 0) d.recibioDanio(0.04);
      if (i % 20 === 0) for (const [k, n] of vivos) vivos.set(k, Math.max(0, n - 1));
      if (i % 300 === 299) r.push({ fase: d.fase, intensidad: d.intensidad, vivos: Object.fromEntries([...vivos].sort()) });
    }
    return r;
  },
  turnosYMazo: () => {
    const c = new ColaTiempo([{ id: 1, velocidad: 13 }, { id: 2, velocidad: 21 }, { id: 3, velocidad: 8 }]);
    const orden: number[] = [];
    for (let i = 0; i < 30; i++) {
      const id = c.siguiente()!;
      orden.push(id);
      c.actuo(id, id === 2 ? 0.6 : 1);
    }
    const m = new Mazo([...Array(15).keys()], P.MAZO_ROGUELIKE, new Pcg32(3));
    const manos: number[][] = [];
    for (let t = 0; t < 6; t++) {
      m.empezarTurno();
      manos.push([...m.mano]);
      m.jugar(0, 1);
      m.terminarTurno();
    }
    return [{ orden, manos }];
  },
  lanzador: () => {
    const l = new Lanzador(P.LANZAMIENTO_MMO);
    l.celeridad = 0.15;
    const r: unknown[] = [];
    for (let i = 0; i < 600; i++) {
      if (i % 50 === 0) l.lanzar({ id: `h${i}`, lanzamiento: i % 100 === 0 ? 1.5 : 0, canalizar: i % 150 === 0 ? 2 : undefined, ticks: 4 }, false);
      if (i % 70 === 0) l.recibirGolpe();
      const ev = l.actualizar(DT, i % 230 === 0);
      if (ev.length) r.push({ i, ev: ev.map((e) => `${e.tipo}:${"id" in e ? e.id : ""}`), gcd: l.gcdRestante, progreso: l.progreso });
    }
    return r;
  },
};

export function generar(): Record<string, unknown[]> {
  // JSON de ida y vuelta: el golden se compara contra lo que se lee del archivo (mismas reglas de serialización).
  return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(ESCENARIOS).map(([k, f]) => [k, f()]))));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!)) {
  writeFileSync(new URL("./golden.json", import.meta.url), JSON.stringify({ version: 1, tolerancia: { typescript: 0, entreLenguajes: 1e-6 }, escenarios: generar() }, null, 1));
  console.log(`golden.json escrito (${Object.keys(ESCENARIOS).length} escenarios)`);
  void vec3;
}
