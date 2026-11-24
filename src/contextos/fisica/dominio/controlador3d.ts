// Controlador de personaje 3D (FPS, TPS, ARPG 3D, acción): movimiento cinemático sobre un SUELO dado por una
// función de altura (terreno, o el resultado de un raycast hacia abajo del motor). Incluye:
//   - aceleración/fricción en suelo, control en el aire (y "strafe" aéreo opcional, estilo shooter arena);
//   - caminar, correr (sprint con estamina opcional), agacharse y DESLIZARSE al agacharse corriendo;
//   - salto con tiempo coyote y búfer, doble salto opcional;
//   - pendiente máxima: en laderas más empinadas se resbala.
// El motor gráfico solo lee `pos`, `vel`, `enSuelo`, `agachado` y los eventos. Determinista con paso fijo.

import { v3, vec3, type V3 } from "../../../nucleo/vec3.ts";

export interface PerfilMovimiento3D {
  readonly caminar: number;
  readonly correr: number;
  readonly agachado: number;
  readonly aceleracion: number;
  readonly friccion: number;
  /** Fracción de control en el aire (0..1) y si se permite ganar velocidad girando en el aire. */
  readonly controlAire: number;
  readonly strafeAereo?: boolean;
  readonly salto: number;
  readonly gravedad: number;
  readonly caidaMax: number;
  readonly coyote: number;
  readonly bufer: number;
  readonly saltosAire?: number;
  /** Deslizamiento: impulso inicial y fricción reducida mientras dura. */
  readonly deslizar?: { readonly impulso: number; readonly duracion: number; readonly friccion: number };
  /** Pendiente máxima caminable, en grados. */
  readonly pendienteMax: number;
  /** Altura de los ojos de pie y agachado (cámara). */
  readonly ojos: number;
  readonly ojosAgachado: number;
}

export interface Entrada3D {
  /** Ejes de movimiento -1..1 relativos a la mirada (adelante, derecha). */
  readonly adelante: number;
  readonly derecha: number;
  /** Yaw de la cámara en radianes. */
  readonly yaw: number;
  readonly saltar: boolean;
  readonly correr: boolean;
  readonly agachar: boolean;
}

export type EventoMov3D = "salto" | "salto-aire" | "aterrizaje" | "deslizar" | "resbala";

/** Suelo: altura en (x, z) o null si no hay (vacío). */
export type Suelo = (x: number, z: number) => number | null;

export class Controlador3D {
  pos: V3;
  vel: V3 = v3(0, 0, 0);
  enSuelo = false;
  agachado = false;
  deslizando = 0;
  private coyote = 0;
  private bufer = 0;
  private saltosRestantes = 0;
  private saltarPrevio = false;
  readonly perfil: PerfilMovimiento3D;

  constructor(pos: V3, perfil: PerfilMovimiento3D) {
    this.pos = pos;
    this.perfil = perfil;
  }

  get ojos(): V3 {
    return v3(this.pos.x, this.pos.y + (this.agachado ? this.perfil.ojosAgachado : this.perfil.ojos), this.pos.z);
  }

  get velocidadHorizontal(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** Normal del suelo en (x, z) por diferencias finitas. */
  static normal(suelo: Suelo, x: number, z: number, e = 0.1): V3 {
    const h = suelo(x, z) ?? 0;
    const hx = (suelo(x + e, z) ?? h) - h, hz = (suelo(x, z + e) ?? h) - h;
    return vec3.normalizar(v3(-hx / e, 1, -hz / e));
  }

  actualizar(dt: number, e: Entrada3D, suelo: Suelo): EventoMov3D[] {
    const p = this.perfil;
    const ev: EventoMov3D[] = [];
    const flanco = e.saltar && !this.saltarPrevio;
    this.saltarPrevio = e.saltar;
    if (flanco) this.bufer = p.bufer;
    else this.bufer = Math.max(0, this.bufer - dt);
    this.coyote = this.enSuelo ? p.coyote : Math.max(0, this.coyote - dt);

    // Agacharse / deslizarse
    const corriendo = e.correr && e.adelante > 0.3 && !this.agachado;
    if (e.agachar && !this.agachado && this.enSuelo && p.deslizar && this.velocidadHorizontal > p.caminar * 1.1) {
      const d = vec3.normalizar(vec3.plano(this.vel));
      this.vel = vec3.sumarEscalado(this.vel, d, p.deslizar.impulso);
      this.deslizando = p.deslizar.duracion;
      ev.push("deslizar");
    }
    this.agachado = e.agachar;
    this.deslizando = Math.max(0, this.deslizando - dt);

    // Deseo de movimiento en el plano
    const fw = v3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
    const rt = v3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
    let deseo = vec3.sumar(vec3.escalar(fw, e.adelante), vec3.escalar(rt, e.derecha));
    const l = vec3.largo(deseo);
    if (l > 1) deseo = vec3.escalar(deseo, 1 / l);
    const tope = this.agachado ? p.agachado : corriendo ? p.correr : p.caminar;
    const objetivo = vec3.escalar(deseo, tope);

    const horiz = vec3.plano(this.vel);
    if (this.enSuelo && this.deslizando <= 0) {
      // Fricción + aceleración hacia el objetivo
      const fr = Math.max(0, 1 - p.friccion * dt);
      let h = vec3.escalar(horiz, fr);
      const dif = vec3.restar(objetivo, h);
      const dl = vec3.largo(dif);
      const paso = p.aceleracion * dt;
      h = dl <= paso ? objetivo : vec3.sumarEscalado(h, dif, paso / dl);
      this.vel = v3(h.x, this.vel.y, h.z);
    } else if (this.enSuelo) {
      const fr = Math.max(0, 1 - (p.deslizar?.friccion ?? p.friccion) * dt);
      this.vel = v3(horiz.x * fr, this.vel.y, horiz.z * fr);
    } else if (l > 0.01) {
      if (p.strafeAereo) {
        // Aceleración proyectada: solo suma en la dirección deseada si no supera el tope en ESA dirección.
        const actual = vec3.punto(horiz, vec3.normalizar(deseo));
        const suma = Math.max(0, Math.min(p.aceleracion * p.controlAire * dt, tope - actual));
        this.vel = vec3.sumarEscalado(this.vel, vec3.normalizar(deseo), suma);
      } else {
        const dif = vec3.restar(objetivo, horiz);
        const dl = vec3.largo(dif);
        const paso = p.aceleracion * p.controlAire * dt;
        const h = dl <= paso ? objetivo : vec3.sumarEscalado(horiz, dif, paso / dl);
        this.vel = v3(h.x, this.vel.y, h.z);
      }
    }

    // Salto
    if (this.bufer > 0 && this.coyote > 0) {
      this.vel = v3(this.vel.x, p.salto, this.vel.z);
      this.enSuelo = false;
      this.coyote = 0;
      this.bufer = 0;
      this.saltosRestantes = p.saltosAire ?? 0;
      ev.push("salto");
    } else if (flanco && !this.enSuelo && this.saltosRestantes > 0) {
      this.vel = v3(this.vel.x, p.salto, this.vel.z);
      this.saltosRestantes--;
      this.bufer = 0;
      ev.push("salto-aire");
    }

    // Gravedad e integración
    if (!this.enSuelo) this.vel = v3(this.vel.x, Math.max(-p.caidaMax, this.vel.y - p.gravedad * dt), this.vel.z);
    let np = vec3.sumarEscalado(this.pos, this.vel, dt);
    const h = suelo(np.x, np.z);
    const estaba = this.enSuelo;
    if (h !== null && np.y <= h + (estaba ? 0.3 : 0) && this.vel.y <= 0.01) {
      const n = Controlador3D.normal(suelo, np.x, np.z);
      const pendiente = (Math.acos(Math.min(1, n.y)) * 180) / Math.PI;
      np = v3(np.x, h, np.z);
      if (pendiente > p.pendienteMax) {
        // Resbala: empujado hacia abajo de la ladera.
        this.vel = vec3.sumarEscalado(v3(this.vel.x, 0, this.vel.z), vec3.normalizar(v3(n.x, 0, n.z)), p.gravedad * dt);
        this.enSuelo = false;
        ev.push("resbala");
      } else {
        if (!estaba) ev.push("aterrizaje");
        this.enSuelo = true;
        this.vel = v3(this.vel.x, 0, this.vel.z);
      }
    } else this.enSuelo = false;
    this.pos = np;
    return ev;
  }
}
