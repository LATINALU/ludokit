import { test } from "node:test";
import assert from "node:assert/strict";
import { curva, evaluar, progreso, validarCurva, muestrear } from "../src/nucleo/escalado.ts";
import { v3, vec3 } from "../src/nucleo/vec3.ts";
import { Pcg32 } from "../src/nucleo/pcg32.ts";
import { lanzarRayo, lanzarRayoTodos, rayoCapsula3D, rayoCaja3D, solapan3D, type Colisionador3D } from "../src/espacial/colision3d.ts";
import { Arma, dpsArma, tiempoParaMatar, type DefArma } from "../src/contextos/disparos/dominio/arma.ts";
import { Dispersion, Retroceso, asistirMira } from "../src/contextos/disparos/dominio/punteria.ts";
import { anguloDeTiro, avanzarProyectil3D, probPenetrar, puntoDeAdelanto, resolverBlindaje, resolverDisparo } from "../src/contextos/disparos/dominio/balistica.ts";
import { SaludPorPartes } from "../src/contextos/disparos/dominio/salud-partes.ts";
import { Controlador3D } from "../src/contextos/fisica/dominio/controlador3d.ts";
import { HistorialPosiciones3D, rebobinar } from "../src/red/compensacion-lag.ts";
import { aplicarAccesorios, ficha, municion, ARMAS, BLINDAJES, PARTES_HUMANOIDE, ZONAS_HUMANOIDE } from "../src/datos/armas.ts";
import { MOV_FPS_ARENA, SALUD_TACTICA } from "../src/modelos/piezas.ts";

test("curvas: todos los tipos, sin tope, validación", () => {
  assert.equal(evaluar(curva.lineal(10, 2), 6), 20);
  assert.equal(evaluar(curva.exponencial(1, 2), 11), 1024);
  assert.equal(evaluar(curva.saturacion(10), 11), 0.5);
  assert.ok(progreso(curva.saturacion(10), 1e6) < 1 && progreso(curva.saturacion(10), 1e6) > 0.99);
  assert.equal(evaluar(curva.tramos([[0, 1], [10, 1], [20, 0.5]]), 15), 0.75);
  assert.equal(evaluar(curva.tramos([[0, 0], [10, 10]], "lineal"), 20), 20);
  assert.equal(evaluar(curva.escalones([[10, 5], [20, 9]], 1), 15), 5);
  const ts = curva.topeSuave(curva.lineal(0, 1), 10, 0.5);
  assert.equal(evaluar(ts, 10), 9);
  assert.ok(evaluar(ts, 1000) > evaluar(ts, 100), "el tope suave sigue creciendo");
  assert.equal(evaluar(curva.limitar(curva.lineal(0, 1), 0, 5), 99), 5);
  assert.ok(evaluar(curva.logistica(20, 0.3), 1) === 0 && evaluar(curva.logistica(20, 0.3), 200) > 0.99);
  assert.deepEqual(validarCurva(curva.exponencial(1, 1.1)), []);
  assert.ok(validarCurva({ tipo: "exponencial", base: 1, razon: -1 }).length > 0);
  assert.equal(muestrear(curva.lineal(0, 1), 1, 5).length, 5);
});

test("vec3: ángulos, cono y rotación", () => {
  const d = vec3.desdeAngulos(0.3, 0.2);
  const a = vec3.aAngulos(d);
  assert.ok(Math.abs(a.yaw - 0.3) < 1e-9 && Math.abs(a.pitch - 0.2) < 1e-9);
  const c = vec3.enCono(v3(0, 0, 1), 0.1, 1.3);
  assert.ok(Math.abs(vec3.angulo(c, v3(0, 0, 1)) - 0.1) < 1e-9);
  const r = vec3.rotar(v3(1, 0, 0), v3(0, 1, 0), Math.PI / 2);
  assert.ok(Math.abs(r.z + 1) < 1e-9);
});

test("colisiones 3D: rayo contra caja, cápsula, escena ordenada y solapamientos", () => {
  const rayo = { origen: v3(0, 1, 0), dir: v3(0, 0, 1), largo: 100 };
  const caja = rayoCaja3D(rayo, v3(-1, 0, 5), v3(1, 2, 6));
  assert.ok(caja && Math.abs(caja.t - 5) < 1e-9 && caja.normal.z === -1);
  const cap = rayoCapsula3D(rayo, v3(0, 0, 10), v3(0, 2, 10), 0.5);
  assert.ok(cap && Math.abs(cap.t - 9.5) < 1e-9);
  const escena: Colisionador3D[] = [
    { id: 1, forma: { tipo: "capsula", a: v3(0, 0, 10), b: v3(0, 2, 10), radio: 0.5 }, etiqueta: "torso", duenio: 7 },
    { id: 2, forma: { tipo: "caja", min: v3(-1, 0, 5), max: v3(1, 2, 6) }, etiqueta: "mundo:madera:2" },
  ];
  assert.equal(lanzarRayo(escena, rayo)!.colisionador.id, 2);
  assert.deepEqual(lanzarRayoTodos(escena, rayo).map((h) => h.colisionador.id), [2, 1]);
  assert.equal(lanzarRayo(escena, rayo, 7)!.colisionador.id, 2, "ignorar al dueño");
  assert.ok(solapan3D(escena[0].forma, { tipo: "esfera", centro: v3(0.9, 1, 10), radio: 0.5 }));
});

const RIFLE: DefArma = { id: "r", cadencia: 600, modos: ["auto", "rafaga", "semi"], balasRafaga: 3, cargador: 30, recamara: true, recargaTactica: 2, recargaVacia: 3 };

test("arma: cadencia, modos, recarga táctica con recámara y vacía", () => {
  const a = new Arma(RIFLE, 90);
  let disparos = 0;
  for (let i = 0; i < 60; i++) disparos += a.actualizar(1 / 60, true).filter((e) => e.tipo === "disparo").length;
  assert.equal(disparos, 10, "600 rpm = 10 por segundo");
  assert.ok(a.recargar());
  for (let i = 0; i < 130; i++) a.actualizar(1 / 60, false);
  assert.equal(a.balas, 31, "táctica: cargador + 1 en la recámara");
  a.cambiarModo(); // ráfaga
  let r = 0;
  for (let i = 0; i < 60; i++) r += a.actualizar(1 / 60, i < 2).filter((e) => e.tipo === "disparo").length;
  assert.equal(r, 3, "un toque = ráfaga de 3");
  a.cambiarModo(); // semi
  let s = 0;
  for (let i = 0; i < 60; i++) s += a.actualizar(1 / 60, true).filter((e) => e.tipo === "disparo").length;
  assert.equal(s, 1, "semi: uno por apretada");
  const vacia = new Arma({ ...RIFLE, cargador: 2 }, 10);
  for (let i = 0; i < 30; i++) vacia.actualizar(1 / 60, true);
  assert.equal(vacia.balas, 0);
  const ev: { tipo: string; vacia?: boolean }[] = [];
  vacia.recargar(ev as never);
  assert.equal(ev[0].vacia, true);
  assert.equal(dpsArma(RIFLE, 30).rafaga, 300);
  assert.ok(Math.abs(tiempoParaMatar(100, 30, RIFLE) - 0.3) < 1e-9);
});

test("arma: escopeta por cartucho interrumpible y sobrecalentamiento", () => {
  const e = new Arma({ id: "e", cadencia: 60, modos: ["semi"], perdigones: 8, cargador: 4, recargaTactica: 0, recargaVacia: 0, porCartucho: 0.5 }, 10, { cargado: false });
  e.recargar();
  for (let i = 0; i < 70; i++) e.actualizar(1 / 60, false);
  assert.equal(e.balas, 2);
  const ev = e.actualizar(1 / 60, true);
  assert.ok(e.estado === "lista" || ev.some((x) => x.tipo === "disparo"));
  const laser = new Arma({ id: "l", cadencia: 600, modos: ["auto"], cargador: 999, recargaTactica: 1, recargaVacia: 1, calorPorDisparo: 0.25, enfriamiento: 0.5 }, 0);
  const evs: string[] = [];
  for (let i = 0; i < 60; i++) evs.push(...laser.actualizar(1 / 60, true).map((x) => x.tipo));
  assert.ok(evs.includes("sobrecalentada"));
  assert.equal(evs.filter((x) => x === "disparo").length, 5, "se enfría un poco entre disparos: el 5.º la traba");
});

test("puntería: dispersión por postura y bloom, retroceso con recuperación, asistencia", () => {
  const d = new Dispersion({ base: 1, bloomPorDisparo: 0.5, recuperacion: 2, maxima: 4, postura: { corriendo: 3, apuntando: 0.3 } });
  assert.equal(d.actual("corriendo"), 3);
  const az = new Pcg32(1);
  const dir = v3(0, 0, 1);
  for (let i = 0; i < 100; i++) {
    const s = d.disparar(dir, "quieto", az);
    assert.ok((vec3.angulo(s, dir) * 180) / Math.PI <= 4 + 1e-6);
  }
  assert.equal(d.bloom, 4);
  for (let i = 0; i < 120; i++) d.actualizar(1 / 60);
  assert.ok(d.bloom < 1e-9);
  const r = new Retroceso({ vertical: 0, horizontal: 0, recuperacion: 10, patron: [[1, 0], [2, 0.5]], fraccionRecuperable: 1 });
  r.disparar(1, az);
  r.disparar(2, az);
  r.disparar(3, az, 0.5);
  assert.ok(Math.abs(r.pitch - 4) < 1e-9);
  for (let i = 0; i < 120; i++) r.actualizar(1 / 60);
  assert.ok(Math.abs(r.pitch) < 1e-9, "vuelve al punto inicial");
  const as = asistirMira(v3(0, 0, 0), v3(0, 0, 1), [{ id: 5, pos: v3(0.2, 0, 10) }], { cono: 5, alcance: 50, friccion: 0.5, iman: 2 }, 1 / 60);
  assert.equal(as.objetivo, 5);
  assert.equal(as.sensibilidad, 0.5);
});

test("balística: munición propia vs clases de blindaje, penetración de paredes, proyectil y adelanto", () => {
  const p9 = municion("9x19");
  const pAP = municion("5.56x45", "perforante");
  const p50 = municion("12.7x99");
  assert.ok(p9.penetracion < pAP.penetracion && pAP.penetracion < p50.penetracion);
  assert.ok(municion("9x19", "expansiva").danio > p9.danio);
  const placa = (id: string) => { const b = BLINDAJES.find((x) => x.id === id)!; return { clase: b.clase, durabilidad: b.durabilidad, durabilidadMax: b.durabilidad, desgaste: b.desgaste, contundente: b.contundente }; };
  assert.ok(probPenetrar(p9.penetracion, placa("placa-ceramica-5")) < 0.05, "pistola no pasa clase 5");
  assert.ok(probPenetrar(p50.penetracion, placa("placa-ceramica-5")) > 0.95);
  const b = placa("chaleco-aramida-3");
  const r = resolverBlindaje(p9.danio, p9, b, new Pcg32(3));
  assert.ok(r.desgaste > 0 && b.durabilidad < b.durabilidadMax);
  const escena: Colisionador3D[] = [
    { id: 1, forma: { tipo: "caja", min: v3(-1, 0, 5), max: v3(1, 2, 5.1) }, etiqueta: "mundo:madera:3" },
    { id: 2, forma: { tipo: "esfera", centro: v3(0, 1, 10), radio: 0.2 }, etiqueta: "cabeza", duenio: 9 },
    { id: 3, forma: { tipo: "capsula", a: v3(0, 0, 10), b: v3(0, 0.55, 10), radio: 0.3 }, etiqueta: "torso", duenio: 9 },
  ];
  const sinPen = resolverDisparo(escena, v3(0, 1, 0), v3(0, 0, 1), { alcance: 100, danio: 50, zonas: ZONAS_HUMANOIDE, materiales: { madera: 4 } });
  assert.equal(sinPen.length, 1, "sin poder de penetración la madera la frena");
  const conPen = resolverDisparo(escena, v3(0, 1, 0), v3(0, 0, 1), { alcance: 100, danio: 50, zonas: ZONAS_HUMANOIDE, materiales: { madera: 4 }, poder: 40 });
  const cabeza = conPen.find((i) => i.zona === "cabeza")!;
  assert.ok(cabeza && cabeza.danio > 50 && cabeza.danio < 125, "atravesó la madera perdiendo poder");
  const pr = { pos: v3(0, 0, 0), vel: v3(0, 20, 20), vivo: true, tiempo: 0 };
  for (let i = 0; i < 600 && pr.pos.y >= 0; i++) avanzarProyectil3D(pr, 1 / 120);
  assert.ok(Math.abs(pr.pos.z - (2 * 20 * 20) / 9.81) < 1.5, `alcance parabólico ${pr.pos.z}`);
  const ang = anguloDeTiro(30, 50)!;
  assert.ok(Math.abs((30 * 30 * Math.sin(2 * ang)) / 9.81 - 50) < 1e-6);
  const p = puntoDeAdelanto(v3(0, 0, 0), v3(0, 0, 100), v3(10, 0, 0), 100)!;
  const t = vec3.largo(p) / 100;
  assert.ok(Math.abs(p.x - 10 * t) < 1e-6);
});

test("salud por partes: reparto al destruir, vitales, sangrado y movilidad", () => {
  const s = new SaludPorPartes(PARTES_HUMANOIDE, SALUD_TACTICA);
  const az = new Pcg32(2);
  s.recibir("brazoIzq", 100, az);
  assert.equal(s.partes.get("brazoIzq")!.vida, 0);
  const antes = s.total;
  s.recibir("brazoIzq", 60, az);
  assert.ok(s.total < antes && !s.muerto, "el daño a una parte destruida se reparte");
  s.recibir("piernaDer", 10, az, { fractura: 1 });
  assert.ok(s.movilidad() < 1);
  s.recibir("pecho", 999, az);
  const ev = s.recibir("cabeza", 999, az);
  assert.ok(s.muerto && ev.some((e) => e.tipo === "muerte"));
});

test("accesorios: uno por ranura, solo los que entran", () => {
  const f = aplicarAccesorios(ficha("carabina-556"), ["compensador", "silenciador", "cargador-ampliado", "bipode"]);
  assert.deepEqual(f.accesorios, ["compensador", "cargador-ampliado"]);
  assert.equal(f.arma.cargador, 40);
  assert.ok(f.retroceso.vertical < ficha("carabina-556").retroceso.vertical);
  assert.ok(ARMAS.length >= 15);
});

test("controlador 3D: acelera, salta con búfer, aterriza, resbala en pendientes", () => {
  const c = new Controlador3D(v3(0, 0, 0), MOV_FPS_ARENA);
  const plano = () => 0;
  const quieto = { adelante: 0, derecha: 0, yaw: 0, saltar: false, correr: false, agachar: false };
  for (let i = 0; i < 60; i++) c.actualizar(1 / 60, { ...quieto, adelante: 1 }, plano);
  assert.ok(Math.abs(c.velocidadHorizontal - MOV_FPS_ARENA.caminar) < 0.01 && c.pos.z > 3);
  const ev = c.actualizar(1 / 60, { ...quieto, saltar: true }, plano);
  assert.ok(ev.includes("salto") && !c.enSuelo);
  const todos: string[] = [];
  for (let i = 0; i < 120; i++) todos.push(...c.actualizar(1 / 60, quieto, plano));
  assert.ok(todos.includes("aterrizaje") && c.enSuelo && c.pos.y === 0);
  const empinada = new Controlador3D(v3(0, 5, 0), MOV_FPS_ARENA);
  const ladera = (x: number) => -x * 3; // ~72°
  const ev2: string[] = [];
  for (let i = 0; i < 60; i++) ev2.push(...empinada.actualizar(1 / 60, quieto, ladera));
  assert.ok(ev2.includes("resbala"));
});

test("compensación de lag: rebobina hitboxes al tiempo que veía el tirador", () => {
  const h = new HistorialPosiciones3D(1);
  for (let k = 0; k <= 10; k++) h.registrar(9, k / 10, v3(k, 0, 10));
  const escena: Colisionador3D[] = [{ id: 1, forma: { tipo: "esfera", centro: v3(10, 1, 10), radio: 0.5 }, duenio: 9 }];
  const rayo = { origen: v3(8, 1, 0), dir: v3(0, 0, 1), largo: 50 };
  assert.equal(lanzarRayo(escena, rayo), null, "ahora ya no está ahí");
  const viejo = rebobinar(escena, h, 1, 0.8);
  assert.equal(lanzarRayo(viejo, rayo)!.colisionador.id, 1, "hace 200 ms sí estaba");
  const tope = rebobinar(escena, h, 1, 0, 0.1);
  assert.equal(lanzarRayo(tope, { ...rayo, origen: v3(9, 1, 0) })!.colisionador.id, 1, "el rebobinado se recorta al máximo");
});
