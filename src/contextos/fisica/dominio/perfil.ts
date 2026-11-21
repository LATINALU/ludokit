// Perfil de movimiento: todos los números del controlador de plataformas en un objeto de datos. Un personaje
// distinto = un perfil distinto (multiplicadores sobre BASE) + rasgos. Así cada personaje se SIENTE distinto sin
// tocar el código. Unidades: px, px/s, px/s², segundos.

export interface PerfilMovimiento {
  readonly vel: number;
  readonly acelSuelo: number;
  readonly acelAire: number;
  /** Multiplicador de la aceleración al frenar (1 = igual; < 1 patina). */
  readonly freno: number;
  readonly gravedad: number;
  /** Gravedad extra al caer (caída más firme que la subida). */
  readonly multCaida: number;
  readonly caidaMax: number;
  readonly salto: number;
  readonly saltoAereo: number;
  readonly saltosAereos: number;
  /** Al soltar el salto mientras sube: vy *= corteSalto. */
  readonly corteSalto: number;
  readonly coyote: number;
  readonly bufer: number;
  /** Gravedad × este valor cerca de la cima si se mantiene el salto (más control en el aire). */
  readonly flotacionCima: number;
  readonly caidaRapida: boolean;
  readonly paredes: boolean;
  readonly deslizMax: number;
  readonly saltoParedVx: number;
  readonly dashVel: number;
  readonly dashDur: number;
  readonly dashCd: number;
  /** Al saltar desde un dash se conserva vel × este valor durante `impulsoDashT` segundos. */
  readonly impulsoDash: number;
  readonly impulsoDashT: number;
  /** Ímpetu: tras correr `impetuT` s sin parar, el tope sube `impetuBono` (se llena en `impetuLlenado` s). */
  readonly impetuT: number;
  readonly impetuLlenado: number;
  readonly impetuBono: number;
  readonly bordes: boolean;
  /** px por encima de las manos donde puede estar la cornisa para colgarse. */
  readonly alcanceBorde: number;
  readonly duracionSubida: number;
  /** Corrección de esquinas en px. */
  readonly esquinas: number;
  /** Planeo: segundos por despegue que se puede caer lento manteniendo salto (0 = sin planeo). */
  readonly planeo: number;
  readonly caidaPlaneo: number;
}

export const PERFIL_BASE: PerfilMovimiento = {
  vel: 112, acelSuelo: 1300, acelAire: 900, freno: 1,
  gravedad: 980, multCaida: 1.18, caidaMax: 420,
  salto: 348, saltoAereo: 312, saltosAereos: 0, corteSalto: 0.5,
  coyote: 0.12, bufer: 0.15, flotacionCima: 0.55, caidaRapida: true,
  paredes: false, deslizMax: 55, saltoParedVx: 175,
  dashVel: 340, dashDur: 0.19, dashCd: 0.45, impulsoDash: 1.42, impulsoDashT: 0.35,
  impetuT: 0.8, impetuLlenado: 0.35, impetuBono: 0.22,
  bordes: true, alcanceBorde: 5, duracionSubida: 0.2,
  esquinas: 4,
  planeo: 0, caidaPlaneo: 62,
};

export type Peso = "ligero" | "medio" | "pesado" | "etereo";

/** Arquetipos listos: multiplicadores y rasgos que suelen funcionar. */
export const ARQUETIPOS: Readonly<Record<Peso, Partial<PerfilMovimiento>>> = {
  ligero: { vel: 1.06, acelAire: 1.2, gravedad: 0.95 },
  medio: {},
  pesado: { vel: 0.93, acelSuelo: 0.85, freno: 0.8, salto: 0.97, multCaida: 1.1 },
  etereo: { gravedad: 0.8, caidaMax: 0.8, acelAire: 1.3 },
};

const NUMERICOS = new Set(Object.entries(PERFIL_BASE).filter(([, v]) => typeof v === "number").map(([k]) => k));

/**
 * Perfil = BASE × multiplicadores (los números) y reemplazo directo (booleanos).
 * Límites de seguridad: el salto nunca baja de ×0,96 (los niveles se diseñan para un alto de salto) y la
 * velocidad se queda en ±8 % (para no romper el balance de distancias). Pasar `sinLimites` para ignorarlos.
 */
export function crearPerfil(mults: Partial<Record<keyof PerfilMovimiento, number | boolean>> = {}, extra: Partial<PerfilMovimiento> = {}, sinLimites = false): PerfilMovimiento {
  const p: Record<string, number | boolean> = { ...PERFIL_BASE };
  for (const [k, v] of Object.entries(mults)) {
    if (v === undefined) continue;
    if (NUMERICOS.has(k) && typeof v === "number") {
      let m = v;
      if (!sinLimites && k === "salto") m = Math.max(0.96, m);
      if (!sinLimites && k === "vel") m = Math.min(1.08, Math.max(0.92, m));
      p[k] = (PERFIL_BASE[k as keyof PerfilMovimiento] as number) * m;
    } else {
      p[k] = v;
    }
  }
  return { ...(p as unknown as PerfilMovimiento), ...extra };
}

/** Altura máxima de salto en px: v² / 2g. Úsala para diseñar niveles (los obstáculos del camino base, por debajo). */
export function alturaSalto(p: PerfilMovimiento): number {
  return (p.salto * p.salto) / (2 * p.gravedad);
}
