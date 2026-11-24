// Ejemplo integrador de un SHOOTER 3D táctico (sin ventana): controlador FPS + arma real del catálogo con
// accesorios + dispersión y retroceso + hitscan con zonas, penetración de paredes y blindaje por clases + salud por
// partes + director de enemigos + compensación de lag + protocolo de feedback. Corre 30 s simulados y muestra un
// resumen. Sirve de plantilla: el motor (Godot/Unity/Three.js) solo dibuja `jugador.ojos`, enemigos y efectos.
// Uso: node ejemplos/shooter3d.ts [semilla]

import { Pcg32, v3, vec3 } from "../src/nucleo/index.ts";
import { BucleFijo } from "../src/motor/index.ts";
import { Controlador3D } from "../src/contextos/fisica/index.ts";
import { Arma, Dispersion, Retroceso, SaludPorPartes, resolverDisparo, resolverBlindaje, type Blindaje } from "../src/contextos/disparos/index.ts";
import { Director } from "../src/contextos/encuentros/index.ts";
import { TraductorFeedback, ESTILO_TACTICO, intensidadDanio, type EventoJuego } from "../src/contextos/feedback/index.ts";
import { HistorialPosiciones3D, rebobinar } from "../src/red/index.ts";
import { DirectorImpacto } from "../src/contextos/feel/index.ts";
import type { Colisionador3D } from "../src/espacial/index.ts";
import { armas, criaturas } from "../src/datos/index.ts";
import { piezas, modelo } from "../src/modelos/index.ts";

const azar = new Pcg32(Number(process.argv[2] ?? 11));
const reglas = modelo("shooter-extraccion").reglas;

// --- Jugador: movimiento táctico, carabina con accesorios, munición perforante
const jugador = new Controlador3D(v3(0, 0, 0), piezas.MOV_FPS_TACTICO);
const fichaArma = armas.aplicarAccesorios(armas.ficha("carabina-556"), ["mira-4x", "compensador", "empunadura-vertical"]);
const arma = new Arma(fichaArma.arma, 120, { azar });
while (arma.modo !== "auto") arma.cambiarModo();
const dispersion = new Dispersion(fichaArma.dispersion);
const retroceso = new Retroceso(fichaArma.retroceso);
const bala = armas.municion("5.56x45", "perforante");

// --- Enemigos: soldados del catálogo con salud por partes y chaleco según su arquetipo
interface Enemigo { id: number; tipo: string; pos: { x: number; z: number }; salud: SaludPorPartes; chaleco?: Blindaje }
const enemigos: Enemigo[] = [];
let siguienteId = 1;
const director = new Director(piezas.DIRECTOR_MILITAR, azar);
const chaleco = (id: string): Blindaje => {
  const b = armas.BLINDAJES.find((x) => x.id === id)!;
  return { clase: b.clase, durabilidad: b.durabilidad, durabilidadMax: b.durabilidad, desgaste: b.desgaste, contundente: b.contundente };
};

// Hitboxes de un humanoide en (x, z): cápsulas por zona, con dueño para compensar lag y no contar doble.
function hitboxes(e: Enemigo): Colisionador3D[] {
  const { x, z } = e.pos;
  return [
    { id: e.id * 10 + 1, duenio: e.id, etiqueta: "cabeza", forma: { tipo: "esfera", centro: v3(x, 1.62, z), radio: 0.13 } },
    { id: e.id * 10 + 2, duenio: e.id, etiqueta: "torso", forma: { tipo: "capsula", a: v3(x, 1.1, z), b: v3(x, 1.4, z), radio: 0.22 } },
    { id: e.id * 10 + 3, duenio: e.id, etiqueta: "abdomen", forma: { tipo: "capsula", a: v3(x, 0.85, z), b: v3(x, 1.05, z), radio: 0.2 } },
    { id: e.id * 10 + 4, duenio: e.id, etiqueta: "piernaIzq", forma: { tipo: "capsula", a: v3(x - 0.1, 0.1, z), b: v3(x - 0.1, 0.8, z), radio: 0.09 } },
    { id: e.id * 10 + 5, duenio: e.id, etiqueta: "piernaDer", forma: { tipo: "capsula", a: v3(x + 0.1, 0.1, z), b: v3(x + 0.1, 0.8, z), radio: 0.09 } },
  ];
}
// Paredes: una de madera fina (penetrable) y una de concreto.
const mundo: Colisionador3D[] = [
  { id: 9001, etiqueta: "mundo:madera:4", forma: { tipo: "caja", min: v3(-3, 0, 14), max: v3(3, 2.5, 14.04) } },
  { id: 9002, etiqueta: "mundo:concreto:30", forma: { tipo: "caja", min: v3(6, 0, 10), max: v3(7, 2.5, 30) } },
];
const MATERIALES = { madera: 3, concreto: 9 };

// --- Red y feedback
const historial = new HistorialPosiciones3D(1);
const feedback = new TraductorFeedback(ESTILO_TACTICO);
const impacto = new DirectorImpacto();
const resumen = { disparos: 0, impactos: 0, cabezas: 0, penetraciones: 0, bajas: 0, sonidos: new Map<string, number>(), blindajeAbsorbio: 0 };

let t = 0;
function paso(dt: number): void {
  const dtSim = impacto.paso(dt);
  t += dt;
  if (dtSim === 0) return;
  // Enemigos nuevos según el director; avanzan hacia el jugador.
  const vivos = new Map<string, number>();
  for (const e of enemigos) vivos.set(e.tipo, (vivos.get(e.tipo) ?? 0) + 1);
  for (const tipo of director.actualizar(dtSim, vivos)) {
    const ang = azar.siguiente() * 0.6 - 0.3;
    const e: Enemigo = { id: siguienteId++, tipo, pos: { x: Math.sin(ang) * 40, z: 20 + Math.cos(ang) * 20 }, salud: new SaludPorPartes(armas.PARTES_HUMANOIDE, piezas.SALUD_TACTICA) };
    if (criaturas.arquetipo(tipo).rasgos?.includes("blindado") || azar.siguiente() < 0.4) e.chaleco = chaleco(azar.siguiente() < 0.5 ? "chaleco-aramida-3" : "placa-acero-4");
    enemigos.push(e);
  }
  for (const e of enemigos) {
    const v = criaturas.arquetipo(e.tipo).velocidad * 1.2 * dtSim;
    const d = Math.hypot(e.pos.x, e.pos.z - jugador.pos.z);
    if (d > 8) { e.pos.x -= (e.pos.x / d) * v; e.pos.z -= ((e.pos.z - jugador.pos.z) / d) * v; }
    historial.registrar(e.id, t, v3(e.pos.x, 0, e.pos.z));
  }
  // Jugador: se mantiene agachado detrás de la pared y apunta al enemigo más cercano.
  jugador.actualizar(dtSim, { adelante: 0, derecha: 0, yaw: 0, saltar: false, correr: false, agachar: true }, () => 0);
  const blanco = [...enemigos].sort((a, b) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x, b.pos.z))[0];
  const eventos: EventoJuego[] = [];
  // Ráfagas cortas para controlar el retroceso: 0,4 s apretado, 0,3 s suelto.
  const gatillo = !!blanco && t % 0.7 < 0.4;
  if (arma.balas === 0 && arma.estado === "lista") arma.recargar();
  for (const ev of arma.actualizar(dtSim, gatillo)) {
    if (ev.tipo !== "disparo" || !blanco) continue;
    resumen.disparos++;
    eventos.push({ tipo: "disparo", intensidad: 0.7, etiqueta: "556", propio: true });
    const ojos = jugador.ojos;
    const objetivo = v3(blanco.pos.x, 1.2 + (azar.siguiente() < 0.25 ? 0.42 : 0), blanco.pos.z);
    let dir = vec3.normalizar(vec3.restar(objetivo, ojos));
    dir = dispersion.disparar(dir, "agachado", azar);
    retroceso.disparar(ev.numero, azar, 0.3);
    // El servidor rebobina a lo que veía el cliente (80 ms de RTT + 100 ms de interpolación).
    const escena = rebobinar([...mundo, ...enemigos.flatMap(hitboxes)], historial, t, t - 0.04 - 0.1);
    for (const h of resolverDisparo(escena, ojos, dir, { alcance: fichaArma.alcance, danio: bala.danio, caida: fichaArma.caida, zonas: armas.ZONAS_HUMANOIDE, materiales: MATERIALES, poder: bala.penetracion })) {
      if (h.colisionador.etiqueta?.startsWith("mundo")) {
        eventos.push({ tipo: "impacto-bala", intensidad: 0.4, material: h.colisionador.etiqueta.split(":")[1] });
        continue;
      }
      const e = enemigos.find((x) => x.id === h.colisionador.duenio)!;
      if (h.danio < bala.danio * 0.999 && h.zona !== "cabeza") resumen.penetraciones++;
      const cubre = armas.ZONAS_HUMANOIDE[h.zona as keyof typeof armas.ZONAS_HUMANOIDE] as { cubre?: string } | undefined;
      const r = resolverBlindaje(h.danio, bala, cubre?.cubre === "chaleco" ? e.chaleco : undefined, azar);
      if (!r.penetro) resumen.blindajeAbsorbio++;
      resumen.impactos++;
      if (h.zona === "cabeza") resumen.cabezas++;
      e.salud.recibir(armas.ZONAS_HUMANOIDE[h.zona as keyof typeof armas.ZONAS_HUMANOIDE]?.parte ?? "torso", r.danio, azar, { sangrado: bala.sangrado, fractura: bala.fractura });
      eventos.push({ tipo: e.salud.muerto ? "muerte" : "golpe", intensidad: intensidadDanio(r.danio, 120), material: r.penetro ? "carne" : "metal", propio: true });
    }
  }
  dispersion.actualizar(dtSim);
  retroceso.actualizar(dtSim);
  for (let i = enemigos.length - 1; i >= 0; i--) {
    enemigos[i].salud.actualizar(dtSim);
    if (enemigos[i].salud.muerto) {
      enemigos.splice(i, 1);
      resumen.bajas++;
      director.murioCerca();
    }
  }
  for (const f of feedback.traducirPaso(eventos)) {
    if (f.impacto) impacto.aplicar(f.impacto);
    if (f.sonido) resumen.sonidos.set(f.sonido.sonido, (resumen.sonidos.get(f.sonido.sonido) ?? 0) + 1);
  }
}

const bucle = new BucleFijo({ actualizar: paso }, { hz: 60 });
for (let ms = 0; ms <= 30_000; ms += 16) bucle.avanzar(ms / 1000);

console.log(`Arma: ${fichaArma.arma.id} + ${fichaArma.accesorios.join(", ")} · munición ${bala.id} (daño ${bala.danio}, penetración ${bala.penetracion})`);
console.log(`Reglas del modelo: ${Object.keys(reglas).join(", ")}`);
console.log(`Disparos ${resumen.disparos} · impactos ${resumen.impactos} (cabeza ${resumen.cabezas}) · atravesaron pared ${resumen.penetraciones} · frenados por chaleco ${resumen.blindajeAbsorbio}`);
console.log(`Bajas ${resumen.bajas} · enemigos vivos ${enemigos.length} · fase del director: ${director.fase} · balas ${arma.balas}/${arma.reserva}`);
console.log("Sonidos pedidos al motor:", Object.fromEntries([...resumen.sonidos].sort((a, b) => b[1] - a[1]).slice(0, 6)));
