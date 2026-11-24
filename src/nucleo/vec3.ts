// Vectores 3D inmutables y utilidades de orientación (yaw/pitch, bases ortonormales, conos) para juegos 3D:
// shooters en primera/tercera persona, ARPG en 3D, simuladores. Se agrupan en el objeto `vec3` para no chocar con
// los nombres 2D de `geom.ts`. Convención: Y hacia arriba, yaw 0 mira a +Z, pitch positivo mira hacia arriba.

export interface V3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });

export const vec3 = {
  CERO: v3(0, 0, 0) as V3,
  ARRIBA: v3(0, 1, 0) as V3,
  sumar: (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z),
  restar: (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z),
  escalar: (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k),
  /** a + b·k (avanzar por una dirección). */
  sumarEscalado: (a: V3, b: V3, k: number): V3 => v3(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k),
  punto: (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  cruz: (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x),
  largo: (a: V3): number => Math.hypot(a.x, a.y, a.z),
  largo2: (a: V3): number => a.x * a.x + a.y * a.y + a.z * a.z,
  distancia: (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  normalizar(a: V3): V3 {
    const l = Math.hypot(a.x, a.y, a.z);
    return l > 1e-12 ? v3(a.x / l, a.y / l, a.z / l) : v3(0, 0, 0);
  },
  lerp: (a: V3, b: V3, t: number): V3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t),
  /** Componente horizontal (XZ), útil para movimiento sobre el suelo. */
  plano: (a: V3): V3 => v3(a.x, 0, a.z),
  /** Ángulo entre dos vectores, en radianes. */
  angulo(a: V3, b: V3): number {
    const la = Math.hypot(a.x, a.y, a.z), lb = Math.hypot(b.x, b.y, b.z);
    if (la < 1e-12 || lb < 1e-12) return 0;
    return Math.acos(Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb))));
  },
  /** Dirección unitaria desde yaw (alrededor de Y) y pitch (arriba/abajo). */
  desdeAngulos: (yaw: number, pitch: number): V3 => v3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)),
  /** Inversa de `desdeAngulos`. */
  aAngulos(d: V3): { yaw: number; pitch: number } {
    const n = vec3.normalizar(d);
    return { yaw: Math.atan2(n.x, n.z), pitch: Math.asin(Math.min(1, Math.max(-1, n.y))) };
  },
  /** Base ortonormal (derecha, arriba) perpendicular a una dirección (para conos de dispersión y cámaras). */
  base(d: V3): { derecha: V3; arriba: V3 } {
    const f = vec3.normalizar(d);
    const ref = Math.abs(f.y) > 0.999 ? v3(1, 0, 0) : v3(0, 1, 0);
    const derecha = vec3.normalizar(vec3.cruz(ref, f));
    return { derecha, arriba: vec3.cruz(f, derecha) };
  },
  /**
   * Rota `d` dentro de un cono: `angulo` (radianes) de desvío y `giro` (radianes) alrededor del eje.
   * Con (u1, u2) uniformes en [0,1): angulo = semiapertura·√u1 (distribución uniforme en el disco), giro = 2π·u2.
   */
  enCono(d: V3, angulo: number, giro: number): V3 {
    const f = vec3.normalizar(d);
    const { derecha, arriba } = vec3.base(f);
    const s = Math.sin(angulo), c = Math.cos(angulo);
    return vec3.normalizar(v3(
      f.x * c + (derecha.x * Math.cos(giro) + arriba.x * Math.sin(giro)) * s,
      f.y * c + (derecha.y * Math.cos(giro) + arriba.y * Math.sin(giro)) * s,
      f.z * c + (derecha.z * Math.cos(giro) + arriba.z * Math.sin(giro)) * s,
    ));
  },
  /** Rotación de `a` alrededor del eje unitario `eje` (Rodrigues). */
  rotar(a: V3, eje: V3, ang: number): V3 {
    const k = vec3.normalizar(eje), c = Math.cos(ang), s = Math.sin(ang);
    const kxa = vec3.cruz(k, a), kda = vec3.punto(k, a);
    return v3(a.x * c + kxa.x * s + k.x * kda * (1 - c), a.y * c + kxa.y * s + k.y * kda * (1 - c), a.z * c + kxa.z * s + k.z * kda * (1 - c));
  },
  /** Punto más cercano a `p` sobre el segmento [a, b] y su parámetro t ∈ [0,1]. */
  cercanoEnSegmento(p: V3, a: V3, b: V3): { punto: V3; t: number } {
    const ab = vec3.restar(b, a);
    const l2 = vec3.largo2(ab);
    const t = l2 < 1e-12 ? 0 : Math.min(1, Math.max(0, vec3.punto(vec3.restar(p, a), ab) / l2));
    return { punto: vec3.sumarEscalado(a, ab, t), t };
  },
} as const;
