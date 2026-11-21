// Controles táctiles para móviles: joystick virtual FLOTANTE (aparece donde se apoya el dedo en la mitad izquierda,
// con zona muerta y radio máximo, y sigue al dedo si se pasa del radio) y botones circulares en la derecha, con
// soporte multitáctil (cada dedo se asigna a un control y lo suelta al levantarse). Se conecta a `Entrada` con
// `aplicarA`, así el juego no distingue entre teclado, mando y pantalla.

import type { Entrada } from "./entrada.ts";

export interface BotonTactil {
  readonly accion: string;
  readonly x: number;
  readonly y: number;
  readonly radio: number;
}

export class ControlesTactiles {
  readonly ancho: number;
  readonly alto: number;
  readonly radioJoystick: number;
  readonly zonaMuerta: number;
  readonly botones: readonly BotonTactil[];
  /** Centro del joystick (si está activo) y valor -1..1. */
  centro: { x: number; y: number } | null = null;
  eje = { x: 0, y: 0 };
  private dedoJoystick: number | null = null;
  private readonly dedosBoton = new Map<number, string>();

  constructor(ancho: number, alto: number, botones: readonly BotonTactil[], radioJoystick = 60, zonaMuerta = 0.18) {
    this.ancho = ancho;
    this.alto = alto;
    this.botones = botones;
    this.radioJoystick = radioJoystick;
    this.zonaMuerta = zonaMuerta;
  }

  tocar(id: number, x: number, y: number): void {
    const b = this.botones.find((b) => Math.hypot(x - b.x, y - b.y) <= b.radio);
    if (b) {
      this.dedosBoton.set(id, b.accion);
      return;
    }
    if (x < this.ancho / 2 && this.dedoJoystick === null) {
      this.dedoJoystick = id;
      this.centro = { x, y };
      this.eje = { x: 0, y: 0 };
    }
  }

  mover(id: number, x: number, y: number): void {
    if (id !== this.dedoJoystick || !this.centro) return;
    let dx = x - this.centro.x, dy = y - this.centro.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radioJoystick) {
      // El joystick sigue al dedo: el centro se arrastra para que nunca "se trabe" en el borde.
      this.centro = { x: x - (dx / d) * this.radioJoystick, y: y - (dy / d) * this.radioJoystick };
      dx = (dx / d) * this.radioJoystick;
      dy = (dy / d) * this.radioJoystick;
    }
    const k = Math.hypot(dx, dy) / this.radioJoystick;
    if (k < this.zonaMuerta) this.eje = { x: 0, y: 0 };
    else {
      const escala = (k - this.zonaMuerta) / (1 - this.zonaMuerta) / (k || 1);
      this.eje = { x: (dx / this.radioJoystick) * escala, y: (dy / this.radioJoystick) * escala };
    }
  }

  soltar(id: number): void {
    if (id === this.dedoJoystick) {
      this.dedoJoystick = null;
      this.centro = null;
      this.eje = { x: 0, y: 0 };
    }
    this.dedosBoton.delete(id);
  }

  pulsado(accion: string): boolean {
    for (const a of this.dedosBoton.values()) if (a === accion) return true;
    return false;
  }

  /** Vuelca el estado en la entrada por acciones (códigos virtuales "tactil:*"). */
  aplicarA(e: Entrada): void {
    e.fijarEje("tactil:x", this.eje.x);
    e.fijarEje("tactil:y", this.eje.y);
    for (const b of this.botones) e.fijarFisico(`tactil:${b.accion}`, this.pulsado(b.accion));
  }
}
