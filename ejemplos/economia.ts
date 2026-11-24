// Simulación: un jugador juega 200 partidas con las reglas del modelo "gacha" + recompensa por partida. Muestra de dónde entra el oro
// (fuentes) y por dónde sale (sumideros), y cuántas cartas le cuesta subir de estrellas.
// Uso: node ejemplos/economia.ts [semilla]

import { AzarSemilla, tirar } from "../src/nucleo/index.ts";
import { Billetera } from "../src/contextos/economia/index.ts";
import { costoFusion, fusionar, probabilidadDesdeCurva, tirarRareza, type CartaBase, type TablaRareza } from "../src/contextos/coleccion/index.ts";
import { curvaDesde, recompensaPartida } from "../src/contextos/progresion/index.ts";
import { modelo, piezas } from "../src/modelos/index.ts";
import type { Curva } from "../src/nucleo/index.ts";

// Reglas tomadas del modelo base (datos, no código): cambiar el modelo cambia la economía entera.
const fusion = modelo("gacha").reglas.fusion as { probabilidad: Curva; costo: Curva };
const CURVA = curvaDesde(piezas.EXP_RPG.costo, piezas.EXP_RPG.nivelMax);
const RAREZA_PARTIDA: TablaRareza = [[0, 0.63], [1, 0.32], [2, 0.04], [3, 0.01]];

const azar = new AzarSemilla(Number(process.argv[2] ?? 1));
const billetera = new Billetera();
const flujo = { partidas: 0, pociones: 0, fusiones: 0 };
let exp = 0;
let cartas: CartaBase[] = [];

for (let i = 0; i < 200; i++) {
  const nivel = CURVA.nivelDe(exp).nivel;
  const gano = tirar(azar, 0.5);
  const r = recompensaPartida({
    nivel,
    gano,
    muertes: Math.floor(azar.siguiente() * 15),
    duracionMs: (120 + azar.siguiente() * 480) * 1000,
    presentes: 8,
    total: 8,
  }, piezas.RECOMPENSA_PARTIDA);
  exp += r.exp;
  billetera.acreditar("oro", r.monedas);
  flujo.partidas += r.monedas;

  // Fuente de cartas: 0,5 + 0,02 por jugador en la partida.
  if (tirar(azar, 0.5 + 8 * 0.02)) {
    cartas.push({ tipo: 0, nivel: tirarRareza(azar, RAREZA_PARTIDA, [4]), personaje: 0 });
  }
  // Sumidero 1: consumibles (40 cada uno, 2 por partida).
  if (billetera.debitar("oro", 80).ok) flujo.pociones += 80;

  // Sumidero 2: fusionar todo lo que se pueda.
  for (let nivelCarta = 0; nivelCarta < 11; nivelCarta++) {
    const iguales = cartas.filter((c) => c.nivel === nivelCarta);
    const costo = costoFusion(fusion.costo, nivelCarta);
    if (iguales.length < 3 || !billetera.debitar("oro", costo).ok) continue;
    flujo.fusiones += costo;
    const usadas = iguales.slice(0, 3);
    cartas = cartas.filter((c) => !usadas.includes(c));
    const f = fusionar(usadas as [CartaBase, CartaBase, CartaBase], {
      azar,
      probabilidad: probabilidadDesdeCurva(fusion.probabilidad),
      nivelMaximo: 11,
      personajesPosibles: () => [0],
      crear: (tipo, n, personaje) => ({ tipo, nivel: n, personaje }),
    });
    if (f.ok) cartas.push(f.valor.carta);
  }
}

const estrellas = new Map<number, number>();
for (const c of cartas) estrellas.set(c.nivel + 1, (estrellas.get(c.nivel + 1) ?? 0) + 1);

console.log(`Nivel final: ${CURVA.nivelDe(exp).nivel} (${exp} EXP)`);
console.log(`Oro ganado en partidas: ${flujo.partidas}`);
console.log(`Gastado en consumibles: ${flujo.pociones}`);
console.log(`Gastado en fusiones:    ${flujo.fusiones}`);
console.log(`Oro final:              ${billetera.saldo("oro")}`);
console.log("Cartas por estrellas:", Object.fromEntries([...estrellas].sort((a, b) => a[0] - b[0])));
