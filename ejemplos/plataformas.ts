// Ejemplo integrador (sin ventana): un plataformas de acción completo en ~100 líneas usando la librería.
// Bucle fijo + entrada por acciones + controlador de plataformas + nivel procedural + enemigos con IA por fases +
// daño + director de impacto + partículas + medidor de estilo. Corre 20 s simulados y muestra un resumen.
// Uso: node ejemplos/plataformas.ts [semilla]

import { Pcg32 } from "../src/nucleo/index.ts";
import { BucleFijo, Entrada } from "../src/motor/index.ts";
import { Plataformero, type Mando } from "../src/contextos/fisica/index.ts";
import { generarNivel } from "../src/contextos/mundo/index.ts";
import { AtaquePorFases, ATAQUES_TIPO } from "../src/contextos/ia/index.ts";
import { calcularDanio, MedidorEstilo } from "../src/contextos/combate/index.ts";
import { ModeloBalance } from "../src/contextos/balance/index.ts";
import { piezas } from "../src/modelos/index.ts";
import { DirectorImpacto, Particulas } from "../src/contextos/feel/index.ts";
import { esSolida } from "../src/contextos/fisica/index.ts";

const semilla = Number(process.argv[2] ?? 7);
const azar = new Pcg32(semilla);
const nivel = generarNivel(semilla, 1, { salas: 12 });
const sala = nivel.sala(nivel.mapa.inicio);
const g = sala.grilla;
const jugador = new Plataformero(40, sala.filaSuelo * 16 - 20);
const entrada = new Entrada();
const impacto = new DirectorImpacto();
const particulas = new Particulas(2048);
const estilo = new MedidorEstilo();
const balance = new ModeloBalance(piezas.PODER_RPG, piezas.BALANCE_ACCION);
const pe = balance.poder(1);
const enemigos = [0, 1, 2].map((i) => ({
  x: 160 + i * 90,
  vida: balance.enemigo(1).vida,
  stats: balance.enemigo(1),
  ia: new AtaquePorFases(ATAQUES_TIPO.medio, azar),
}));
let vidaJugador = pe.vida;
let golpesDados = 0;
let golpesRecibidos = 0;
let cdAtaque = 0;

// "Bot" que juega: corre a la derecha, salta a veces y ataca cuando tiene un enemigo cerca.
function controlar(t: number): void {
  const objetivo = enemigos.find((e) => e.vida > 0);
  const dx = objetivo ? objetivo.x - jugador.cuerpo.centroX : 0;
  entrada.fijarFisico("ArrowRight", dx > 14);
  entrada.fijarFisico("ArrowLeft", dx < -14);
  entrada.fijarFisico("Space", Math.floor(t * 2) % 5 === 0);
  entrada.fijarFisico("KeyJ", Math.abs(dx) < 24);
}

const bucle = new BucleFijo({
  actualizar(dtReal, tick) {
    controlar(tick / 60);
    entrada.muestrear(dtReal);
    const dt = impacto.paso(dtReal);
    estilo.actualizar(dtReal);
    particulas.actualizar(dtReal, { solido: (x, y) => g.solidaPx(x, y) });
    if (dt === 0) return; // hitstop: todo quieto, la entrada ya quedó en el búfer
    const m: Mando = {
      eje: entrada.eje("izq", "der"), arriba: entrada.pulsada("arriba"), abajo: entrada.pulsada("abajo"),
      salto: entrada.pulsada("saltar"), saltoRecien: entrada.recien("saltar"), saltoSoltado: entrada.soltada("saltar"), dashRecien: entrada.recien("dash"),
    };
    jugador.actualizar(dt, m, g);
    jugador.eventos.vaciar();
    cdAtaque -= dt;
    for (const e of enemigos) {
      if (e.vida <= 0) continue;
      const d = Math.abs(e.x - jugador.cuerpo.centroX);
      if (entrada.pulsada("atacar") && cdAtaque <= 0 && d < 24) {
        cdAtaque = 0.3;
        const r = calcularDanio({ ataque: pe.golpe, probCritico: 0.1 }, { defensa: e.stats.defensa }, azar);
        e.vida -= r.danio;
        golpesDados++;
        impacto.aplicar(r.critico ? "critico" : "golpe");
        estilo.registrar(r.critico ? "cargado" : "golpe");
        particulas.rafaga(azar, "chispa", e.x, jugador.cuerpo.centroY, 8);
        if (e.vida <= 0) {
          estilo.registrar("muerte");
          particulas.rafaga(azar, "fragmento", e.x, jugador.cuerpo.centroY, 30, { vida: [3, 5] });
        }
      }
      for (const ev of e.ia.actualizar(dt, d)) {
        if (ev.tipo === "golpe" && d < ATAQUES_TIPO.medio.alcance) {
          vidaJugador -= calcularDanio({ ataque: e.stats.ataque * ev.mult }, { defensa: pe.defensa }, azar, { k: 30, topeResistencia: 0.75, topeVulnerabilidad: 1, topeReduccion: 0.35 }).danio;
          golpesRecibidos++;
          impacto.aplicar("recibido");
          estilo.recibirGolpe();
        }
      }
    }
  },
});

bucle.pasos(60 * 20);
const muertos = enemigos.filter((e) => e.vida <= 0).length;
console.log(`Nivel ${nivel.numero}: ${nivel.mapa.salas.length} salas, jefe en la sala ${nivel.mapa.jefe}`);
console.log(`Jugador x=${jugador.cuerpo.x.toFixed(0)}  vida ${Math.max(0, vidaJugador).toFixed(0)}/${pe.vida.toFixed(0)}`);
console.log(`Enemigos vencidos ${muertos}/3 · golpes dados ${golpesDados} · recibidos ${golpesRecibidos}`);
console.log(`Estilo ${estilo.rango.nombre} · partículas pegadas al suelo ${Array.from({ length: particulas.vivas }, (_, i) => particulas.pegada[i]).filter(Boolean).length}`);
console.log(`Celda bajo el jugador sólida: ${esSolida(g.celda(Math.floor(jugador.cuerpo.centroX / 16), Math.floor((jugador.cuerpo.pies + 1) / 16)))}`);
