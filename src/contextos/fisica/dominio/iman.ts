// Botín suelto con IMÁN: al soltarse sale disparado (salto con dispersión), rebota contra el suelo perdiendo energía,
// se asienta, espera un instante (para que se vea qué cayó) y, cuando el jugador se acerca, lo atrae con aceleración
// creciente hasta recogerlo. Monedas, orbes de experiencia, materiales.

export interface ObjetoSuelto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  atraido: boolean;
  recogido: boolean;
}

export interface ReglasIman {
  readonly gravedad: number;
  readonly rebote: number;
  readonly friccionSuelo: number;
  /** Segundos antes de poder atraerse (que se vea el botín). */
  readonly espera: number;
  readonly radioAtraccion: number;
  readonly radioRecoger: number;
  readonly aceleracion: number;
  readonly velMax: number;
}

export const REGLAS_IMAN: ReglasIman = { gravedad: 700, rebote: 0.45, friccionSuelo: 6, espera: 0.4, radioAtraccion: 48, radioRecoger: 8, aceleracion: 900, velMax: 420 };

/** Botín que sale de un punto con una velocidad al azar (r1, r2 en 0..1). */
export function soltar(x: number, y: number, r1: number, r2: number): ObjetoSuelto {
  return { x, y, vx: (r1 * 2 - 1) * 60, vy: -140 - r2 * 80, t: 0, atraido: false, recogido: false };
}

/** Un paso. `sueloY(x)` = altura del suelo bajo x. Devuelve true el paso en que se recoge. */
export function actualizarSuelto(o: ObjetoSuelto, dt: number, jx: number, jy: number, sueloY: (x: number) => number, r: ReglasIman = REGLAS_IMAN): boolean {
  if (o.recogido) return false;
  o.t += dt;
  const dx = jx - o.x, dy = jy - o.y;
  const d = Math.hypot(dx, dy);
  if (!o.atraido && o.t >= r.espera && d <= r.radioAtraccion) o.atraido = true;
  if (o.atraido) {
    // Atracción por DIRECCIÓN (no aceleración pura, que orbita sin llegar nunca): la velocidad converge a la deseada
    // hacia la mano, que crece con el tiempo atraído; así el objeto "vuela" a la mano y llega siempre.
    const ta = Math.min(1, (o.t - r.espera) * 2);
    const deseada = Math.min(r.velMax, 120 + r.aceleracion * ta * 0.3);
    const conv = Math.min(1, dt * 12);
    o.vx += ((dx / (d || 1)) * deseada - o.vx) * conv;
    o.vy += ((dy / (d || 1)) * deseada - o.vy) * conv;
    if (d < deseada * dt) {
      o.x = jx;
      o.y = jy;
      o.vx = o.vy = 0;
    }
    o.x += o.vx * dt;
    o.y += o.vy * dt;
  } else {
    o.vy += r.gravedad * dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    const s = sueloY(o.x);
    if (o.y >= s) {
      o.y = s;
      if (Math.abs(o.vy) > 40) o.vy = -o.vy * r.rebote;
      else o.vy = 0;
      o.vx -= o.vx * Math.min(1, r.friccionSuelo * dt);
    }
  }
  if (Math.hypot(jx - o.x, jy - o.y) <= r.radioRecoger && o.t >= r.espera) {
    o.recogido = true;
    return true;
  }
  return false;
}
