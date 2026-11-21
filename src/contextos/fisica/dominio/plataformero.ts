// Controlador de plataformas (agregado): entrada + perfil → velocidad → `mover`. Lógica pura, sin dibujo ni nodos.
// Incluye todo lo que hace que un plataformas "se sienta bien":
//   suelo: aceleración/freno, giro seco, ÍMPETU (correr sin parar acelera), atravesar plataformas (↓ + salto)
//   aire:  coyote time, búfer de salto, salto variable, flotación en la cima, caída firme, CAÍDA RÁPIDA, saltos aéreos,
//          planeo opcional
//   pared: deslizarse y saltar (si el perfil lo permite)
//   dash:  con cooldown, y salto desde el dash que conserva el impulso
//   bordes: colgarse de una cornisa, trepar, soltarse o saltar hacia afuera
// Emite eventos (salto, aterrizaje, dash, borde) para que la capa de juego ponga sonido, polvo y animación.

import { ColaEventos } from "../../../nucleo/eventos.ts";
import { Cuerpo, mover, rectLibre, sobrePlataforma } from "./cuerpo.ts";
import { esSolida, type MundoTiles } from "./grilla.ts";
import { PERFIL_BASE, type PerfilMovimiento } from "./perfil.ts";

/** Entrada de un paso. `*Recien` = se apretó en este paso; `saltoSoltado` = se soltó en este paso. */
export interface Mando {
  readonly eje: -1 | 0 | 1;
  readonly arriba: boolean;
  readonly abajo: boolean;
  readonly salto: boolean;
  readonly saltoRecien: boolean;
  readonly saltoSoltado: boolean;
  readonly dashRecien: boolean;
}

export const MANDO_QUIETO: Mando = { eje: 0, arriba: false, abajo: false, salto: false, saltoRecien: false, saltoSoltado: false, dashRecien: false };

export type EventoMovimiento =
  | { readonly tipo: "salto"; readonly clase: "suelo" | "aereo" | "pared" | "borde" }
  | { readonly tipo: "aterrizaje"; readonly velocidad: number; readonly caida: number }
  | { readonly tipo: "dash" }
  | { readonly tipo: "borde"; readonly accion: "colgarse" | "trepar" | "soltar" }
  | { readonly tipo: "pinchos" };

export class Plataformero {
  readonly cuerpo: Cuerpo;
  perfil: PerfilMovimiento;
  readonly eventos = new ColaEventos<EventoMovimiento>();
  /** 1 mira a la derecha, -1 a la izquierda. */
  dir: 1 | -1 = 1;
  /** 0..1: lo lleno que está el ímpetu. */
  impetu = 0;
  /** Una acción (ataque) frena el movimiento: 1 libre, 0.3 típico al atacar, 0 quieto. */
  factorAccion = 1;
  /** Mientras > 0 la entrada horizontal no cuenta (salto de pared, retroceso). */
  bloqueoX = 0;
  colgado: 0 | 1 | -1 = 0;
  dashT = 0;
  planeando = false;
  caeRapido = false;
  deslizando = false;

  private coyote = 0;
  private bufer = 0;
  private aereos = 0;
  private atravesando = 0;
  private dashCd = 0;
  private impulsoDash = 0;
  private gracia = 0;
  private ultimaPared = 0;
  private tCorriendo = 0;
  private dirImpetu = 0;
  private sinBorde = 0;
  private tColgado = 0;
  private subida = 0;
  private subidaDesde = { x: 0, y: 0 };
  private subidaHasta = { x: 0, y: 0 };
  private bordeTile = { c: 0, f: 0 };
  private estabaEnAire = false;
  private cima = Infinity;
  private tPlaneo = 0;

  constructor(x: number, y: number, w = 10, h = 20, perfil: PerfilMovimiento = PERFIL_BASE) {
    this.cuerpo = new Cuerpo(x, y, w, h);
    this.perfil = perfil;
    this.recargarAire();
  }

  get subiendoBorde(): boolean {
    return this.subida > 0;
  }

  private recargarAire(): void {
    this.aereos = this.perfil.saltosAereos;
    this.tPlaneo = this.perfil.planeo;
  }

  /** Un paso de simulación de `dt` segundos. */
  actualizar(dt: number, e: Mando, mundo: MundoTiles): void {
    const p = this.perfil;
    const c = this.cuerpo;
    this.relojes(dt);
    if (e.saltoRecien) this.bufer = p.bufer;

    if (this.subida > 0) return this.pasoSubida(dt);
    if (this.colgado !== 0) return this.pasoColgado(dt, e, mundo);
    if (this.dashT > 0) return this.pasoDash(dt, e, mundo);

    if (e.dashRecien && this.dashCd <= 0) {
      this.dashT = p.dashDur;
      this.dashCd = p.dashDur + p.dashCd;
      if (e.eje !== 0) this.dir = e.eje;
      this.perderImpetu();
      this.eventos.emitir({ tipo: "dash" });
      return this.pasoDash(dt, e, mundo);
    }

    this.pasoHorizontal(dt, e);
    this.pasoSalto(e, mundo);
    this.pasoGravedad(dt, e);
    this.pasoFisica(dt, e, mundo);
    void c;
  }

  private relojes(dt: number): void {
    const c = this.cuerpo;
    this.coyote = c.enSuelo ? this.perfil.coyote : Math.max(0, this.coyote - dt);
    this.bufer = Math.max(0, this.bufer - dt);
    this.atravesando = Math.max(0, this.atravesando - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.impulsoDash = c.enSuelo ? 0 : Math.max(0, this.impulsoDash - dt);
    this.gracia = Math.max(0, this.gracia - dt);
    this.sinBorde = Math.max(0, this.sinBorde - dt);
    this.bloqueoX = Math.max(0, this.bloqueoX - dt);
    if (c.enSuelo) this.recargarAire();
  }

  private medirImpetu(dt: number, eje: number): void {
    const c = this.cuerpo;
    const p = this.perfil;
    if (c.enSuelo && eje !== 0 && this.factorAccion >= 1 && Math.sign(c.vx) === eje && Math.abs(c.vx) > p.vel * 0.8) {
      if (eje !== this.dirImpetu) {
        this.dirImpetu = eje;
        this.tCorriendo = 0;
      }
      this.tCorriendo += dt;
    } else if (c.enSuelo || eje !== this.dirImpetu) {
      this.tCorriendo = 0;
    }
    this.impetu = Math.min(1, Math.max(0, (this.tCorriendo - p.impetuT) / p.impetuLlenado));
  }

  private perderImpetu(): void {
    this.tCorriendo = 0;
    this.impetu = 0;
  }

  private pasoHorizontal(dt: number, e: Mando): void {
    const c = this.cuerpo;
    const p = this.perfil;
    const eje = this.bloqueoX > 0 ? 0 : e.eje;
    this.medirImpetu(dt, eje);
    if (this.bloqueoX > 0) return;
    const objetivo = eje * p.vel * this.factorAccion * (1 + p.impetuBono * this.impetu);
    let acel = c.enSuelo ? p.acelSuelo : p.acelAire;
    // Giro seco en el suelo: cambiar de dirección corta la inercia (reactivo). Quien patina, derrapa.
    if (c.enSuelo && eje !== 0 && Math.sign(c.vx) === -eje && Math.abs(c.vx) > 20) c.vx *= p.freno >= 1 ? 0.35 : 0.8;
    if (c.enSuelo && Math.abs(objetivo) < Math.abs(c.vx)) acel *= p.freno;
    // Salto desde un dash: la inercia se conserva.
    if (this.impulsoDash > 0 && Math.abs(c.vx) > Math.abs(objetivo) && Math.sign(c.vx) === Math.sign(objetivo || c.vx)) acel *= 0.15;
    c.vx = c.vx < objetivo ? Math.min(objetivo, c.vx + acel * dt) : Math.max(objetivo, c.vx - acel * dt);
    if (eje !== 0) this.dir = eje;
  }

  private pasoSalto(e: Mando, m: MundoTiles): void {
    const c = this.cuerpo;
    const p = this.perfil;
    if (this.bufer > 0) {
      if (e.abajo && c.enSuelo && sobrePlataforma(c, m)) {
        this.atravesando = 0.2;
        this.bufer = 0;
      } else if (this.coyote > 0) {
        c.vy = -p.salto;
        // Saltar en el coyote (ya fuera de la cornisa) da un empujoncito hacia donde vas.
        if (!c.enSuelo && e.eje !== 0) c.vx += e.eje * 18;
        this.coyote = 0;
        this.bufer = 0;
        this.eventos.emitir({ tipo: "salto", clase: "suelo" });
      } else if (p.paredes && this.gracia > 0 && this.ultimaPared !== 0) {
        c.vy = -p.salto * 0.95;
        c.vx = -this.ultimaPared * p.saltoParedVx;
        this.dir = this.ultimaPared > 0 ? -1 : 1;
        this.bloqueoX = 0.16;
        this.gracia = 0;
        this.bufer = 0;
        this.eventos.emitir({ tipo: "salto", clase: "pared" });
      } else if (this.aereos > 0) {
        this.aereos--;
        c.vy = -p.saltoAereo;
        this.bufer = 0;
        this.eventos.emitir({ tipo: "salto", clase: "aereo" });
      }
    }
    // Salto variable: soltar corta la subida.
    if (e.saltoSoltado && c.vy < -120) c.vy *= p.corteSalto;
  }

  private pasoGravedad(dt: number, e: Mando): void {
    const c = this.cuerpo;
    const p = this.perfil;
    this.planeando = false;
    this.caeRapido = false;
    let g = p.gravedad;
    let tope = p.caidaMax;
    if (Math.abs(c.vy) < 55 && e.salto) g *= p.flotacionCima;
    else if (c.vy > 0) g *= p.multCaida;
    if (!c.enSuelo && c.vy > 0 && e.salto && this.tPlaneo > 0 && !e.abajo) {
      this.tPlaneo -= dt;
      this.planeando = true;
      tope = p.caidaPlaneo;
      g *= 0.4;
    } else if (p.caidaRapida && !c.enSuelo && c.vy > -20 && e.abajo) {
      this.caeRapido = true;
      g *= 1.45;
      tope *= 1.25;
    }
    c.vy += g * dt;
    if (c.vy > tope) c.vy = Math.max(tope, c.vy - 2600 * dt); // entrar al planeo frena suave, no en seco
    this.deslizando = p.paredes && !c.enSuelo && this.gracia > 0 && this.ultimaPared !== 0 && e.eje === this.ultimaPared && c.vy > 0;
    if (this.deslizando) c.vy = Math.min(c.vy, p.deslizMax);
  }

  private pasoFisica(dt: number, e: Mando, m: MundoTiles): void {
    const c = this.cuerpo;
    const vyAntes = c.vy;
    mover(c, m, dt, { atravesar: this.atravesando > 0, esquinas: this.perfil.esquinas });
    if (c.enSuelo && this.estabaEnAire) this.eventos.emitir({ tipo: "aterrizaje", velocidad: vyAntes, caida: c.pies - this.cima });
    this.estabaEnAire = !c.enSuelo;
    this.cima = c.enSuelo ? c.pies : Math.min(this.cima, c.pies);
    if (c.pared !== 0 && !c.enSuelo) {
      this.ultimaPared = c.pared;
      this.gracia = 0.1;
    } else if (c.enSuelo) {
      this.gracia = 0;
    }
    if (c.pared !== 0) this.perderImpetu();
    if (c.pinchos) this.eventos.emitir({ tipo: "pinchos" });
    if (this.perfil.bordes && !c.enSuelo && !e.abajo) this.intentarBorde(m, e.eje);
  }

  private pasoDash(dt: number, e: Mando, m: MundoTiles): void {
    const c = this.cuerpo;
    const p = this.perfil;
    this.dashT -= dt;
    c.vx = this.dir * p.dashVel;
    c.vy = 0;
    if (this.bufer > 0 && (c.enSuelo || this.coyote > 0)) {
      // Salto de dash: sale con el impulso conservado.
      this.dashT = 0;
      this.bufer = 0;
      c.vy = -p.salto;
      c.vx = this.dir * p.vel * p.impulsoDash;
      this.impulsoDash = p.impulsoDashT;
      this.eventos.emitir({ tipo: "salto", clase: "suelo" });
    } else if (this.dashT <= 0) {
      c.vx = this.dir * p.vel * 0.9;
    }
    mover(c, m, dt, { esquinas: p.esquinas });
    void e;
  }

  /** Cayendo junto a una pared y apuntando a ella: si el filo queda a la altura de las manos y arriba hay lugar, se cuelga. */
  private intentarBorde(m: MundoTiles, eje: number): boolean {
    const c = this.cuerpo;
    const p = this.perfil;
    if (eje === 0 || this.sinBorde > 0 || this.factorAccion < 1 || c.vy < -40) return false;
    const T = m.tile;
    const col = eje > 0 ? Math.floor((c.x + c.w + 2) / T) : Math.floor((c.x - 2) / T);
    for (let f = Math.floor((c.y - p.alcanceBorde) / T); f <= Math.floor((c.y + 6) / T); f++) {
      const filo = f * T;
      if (filo < c.y - p.alcanceBorde || filo > c.y + 6) continue;
      if (!esSolida(m.celda(col, f)) || esSolida(m.celda(col, f - 1))) continue;
      const cuelgaX = eje > 0 ? col * T - c.w - 0.001 : (col + 1) * T + 0.001;
      const cuelgaY = filo - 3;
      if (!rectLibre(m, cuelgaX, cuelgaY, c.w, c.h)) continue;
      const arribaX = eje > 0 ? col * T + 1 : (col + 1) * T - c.w - 1;
      if (!rectLibre(m, arribaX, filo - c.h - 0.01, c.w, c.h)) continue;
      this.colgado = eje > 0 ? 1 : -1;
      this.dir = this.colgado;
      c.x = cuelgaX;
      c.y = cuelgaY;
      c.vx = c.vy = 0;
      this.tColgado = 0;
      this.bordeTile = { c: col, f };
      this.subidaHasta = { x: arribaX, y: filo - c.h };
      this.recargarAire();
      this.perderImpetu();
      this.eventos.emitir({ tipo: "borde", accion: "colgarse" });
      return true;
    }
    return false;
  }

  private soltarBorde(): void {
    this.colgado = 0;
    this.sinBorde = 0.25;
  }

  private pasoColgado(dt: number, e: Mando, m: MundoTiles): void {
    const c = this.cuerpo;
    c.vx = c.vy = 0;
    c.enSuelo = false;
    c.congelar();
    this.tColgado += dt;
    if (!esSolida(m.celda(this.bordeTile.c, this.bordeTile.f))) return this.soltarBorde();
    if (e.abajo) {
      this.soltarBorde();
      this.eventos.emitir({ tipo: "borde", accion: "soltar" });
      return;
    }
    if (this.bufer > 0 && e.eje === -this.colgado) {
      const lado = this.colgado;
      this.soltarBorde();
      this.bufer = 0;
      c.vy = -this.perfil.salto * 0.92;
      c.vx = -lado * 165;
      this.dir = lado > 0 ? -1 : 1;
      this.bloqueoX = 0.14;
      this.eventos.emitir({ tipo: "salto", clase: "borde" });
      return;
    }
    // Un instante colgado para que el agarre se lea; después trepar es inmediato.
    if (this.tColgado >= 0.07 && (this.bufer > 0 || e.arriba || e.eje === this.colgado)) {
      this.bufer = 0;
      this.subida = this.perfil.duracionSubida;
      this.subidaDesde = { x: c.x, y: c.y };
      this.eventos.emitir({ tipo: "borde", accion: "trepar" });
    }
  }

  /** Trepar: interpolación sin física (el camino ya se comprobó libre). */
  private pasoSubida(dt: number): void {
    const c = this.cuerpo;
    c.antX = c.x;
    c.antY = c.y;
    this.subida = Math.max(0, this.subida - dt);
    const k = 1 - this.subida / this.perfil.duracionSubida;
    // Primero sube pegado a la pared, después entra a la cornisa.
    const ky = Math.min(1, k / 0.6);
    const kx = Math.max(0, (k - 0.5) / 0.5);
    c.y = this.subidaDesde.y + (this.subidaHasta.y - this.subidaDesde.y) * ky;
    c.x = this.subidaDesde.x + (this.subidaHasta.x - this.subidaDesde.x) * kx;
    if (this.subida <= 0) {
      this.colgado = 0;
      c.x = this.subidaHasta.x;
      c.y = this.subidaHasta.y;
      c.enSuelo = true;
    }
  }
}
