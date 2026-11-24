// Un MODELO es un punto de partida combinable para un tipo de juego: qué módulos de ludokit usa, qué reglas trae
// configuradas (curvas, tablas, perfiles de movimiento...), qué catálogos de datos sugiere y qué rasgos tiene para
// que el asistente lo recomiende. Los modelos se COMBINAN (`combinar`) para mezclar géneros: "shooter de extracción"
// + "supervivencia" + "hordas de zombis" = un juego nuevo con todas esas reglas, y la lista de conflictos resueltos.

export type Rasgo =
  | `perspectiva:${"lateral" | "superior" | "isometrica" | "primera" | "tercera" | "sin-mapa"}`
  | `nucleo:${"disparar" | "cuerpo-a-cuerpo" | "habilidades" | "estrategia" | "gestion" | "conducir" | "cartas" | "plataformas" | "supervivencia" | "sigilo" | "narrativa" | "puzle" | "coleccion"}`
  | `ritmo:${"tiempo-real" | "turnos" | "pausa-tactica" | "inactivo"}`
  | `jugadores:${"solo" | "cooperativo" | "competitivo" | "masivo"}`
  | `sesion:${"partidas" | "corridas" | "campania" | "sin-fin"}`
  | `progresion:${"botin" | "niveles" | "habilidad-jugador" | "coleccion" | "base" | "meta"}`
  | `muerte:${"sin-castigo" | "pierde-lo-que-lleva" | "permanente" | "tumba" | "pierde-experiencia"}`
  | `realismo:${"arcade" | "intermedio" | "simulacion"}`
  | `ambientacion:${"fantasia" | "militar" | "zombis" | "ciencia-ficcion" | "motor" | "cotidiano" | "terror"}`
  | `enemigos:${"hordas" | "tacticos" | "jefes" | "jugadores"}`
  | `economia:${"ninguna" | "tienda" | "comercio" | "cajas"}`
  | `contenido:${"finito" | "infinito"}`;

export interface Modelo {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** "base" = género completo; "modificador" = capa que se suma a otro (hardcore, cooperativo, servicio en vivo...). */
  readonly tipo: "base" | "modificador";
  readonly generos: readonly string[];
  /** Rasgos con peso 0..1 (qué tan característico es) para el asistente. */
  readonly rasgos: Readonly<Partial<Record<Rasgo, number>>>;
  /** Espacios de nombres de ludokit que usa (`disparos`, `combate`, `fisica.Controlador3D`...). */
  readonly modulos: readonly string[];
  /** Catálogos de `datos/` sugeridos. */
  readonly datos?: readonly string[];
  /** Reglas configuradas por sistema (objetos planos; se combinan en profundidad). */
  readonly reglas: Readonly<Record<string, unknown>>;
  /** Mecánicas en palabras (para la guía generada). */
  readonly mecanicas: readonly string[];
}

export interface Combinacion {
  readonly ids: readonly string[];
  readonly nombre: string;
  readonly generos: readonly string[];
  readonly modulos: readonly string[];
  readonly datos: readonly string[];
  readonly mecanicas: readonly string[];
  readonly reglas: Record<string, unknown>;
  /** Claves de reglas definidas por más de un modelo con valores distintos: gana el último (`ganador`). */
  readonly conflictos: ReadonlyArray<{ readonly ruta: string; readonly modelos: readonly string[]; readonly ganador: string }>;
}
