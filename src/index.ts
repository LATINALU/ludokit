// ludokit — punto de entrada.
//
// Capas (DDD):
//   nucleo/          Kernel compartido: azar con semilla, reloj, Resultado, eventos, geometría, tablas de datos.
//   motor/           Infraestructura de juego: bucle de paso fijo, ECS, FSM jerárquica, tiempo/tweens, entrada,
//                    cámara, animador, pool.
//   espacial/        Broadphase y narrowphase: hash espacial, colisiones (AABB, círculo, SAT, barrido), raycast.
//   contextos/<x>/   Contextos delimitados. `dominio/` = reglas puras; `aplicacion/` = casos de uso con puertos.
//   grafico/         Imagen RGBA pixel-perfect, color OKLab + LUT, atlas, normales, curvas, fuente pixel, parallax.
//   animacion/       Esqueleto procedural de 21 puntos con IK y pistas de poses.
//   red/             Netcode: servidor autoritativo, predicción, interpolación, interés, delta, red simulada.
//   infraestructura/ Adaptadores: persistencia (memoria, localStorage, archivos con escritura atómica).
//
// El núcleo se exporta plano; el resto, por espacio de nombres (cada contexto tiene su propio lenguaje y los
// nombres pueden repetirse entre contextos sin chocar):
//   import { Pcg32, exito, fisica, combate, red } from "ludokit";
//   const j = new fisica.Plataformero(40, 200);

export * from "./nucleo/index.ts";

export * as motor from "./motor/index.ts";
export * as espacial from "./espacial/index.ts";
export * as red from "./red/index.ts";
export * as grafico from "./grafico/index.ts";
export * as animacion from "./animacion/index.ts";

export * as audio from "./contextos/audio/index.ts";
export * as balance from "./contextos/balance/index.ts";
export * as botin from "./contextos/botin/index.ts";
export * as coleccion from "./contextos/coleccion/index.ts";
export * as combate from "./contextos/combate/index.ts";
export * as competitivo from "./contextos/competitivo/index.ts";
export * as economia from "./contextos/economia/index.ts";
export * as encuentros from "./contextos/encuentros/index.ts";
export * as feel from "./contextos/feel/index.ts";
export * as fisica from "./contextos/fisica/index.ts";
export * as ia from "./contextos/ia/index.ts";
export * as inventario from "./contextos/inventario/index.ts";
export * as mundo from "./contextos/mundo/index.ts";
export * as narrativa from "./contextos/narrativa/index.ts";
export * as navegacion from "./contextos/navegacion/index.ts";
export * as progresion from "./contextos/progresion/index.ts";
export * as roguelite from "./contextos/roguelite/index.ts";
export * as social from "./contextos/social/index.ts";

export * as persistencia from "./infraestructura/persistencia/guardado.ts";

// Géneros y modos nuevos
export * as disparos from "./contextos/disparos/index.ts";
export * as moba from "./contextos/moba/index.ts";
export * as vision from "./contextos/vision/index.ts";
export * as grupo from "./contextos/grupo/index.ts";
export * as supervivencia from "./contextos/supervivencia/index.ts";
export * as turnos from "./contextos/turnos/index.ts";
export * as mazo from "./contextos/mazo/index.ts";
export * as estrategia from "./contextos/estrategia/index.ts";
export * as carreras from "./contextos/carreras/index.ts";
export * as feedback from "./contextos/feedback/index.ts";

// Datos propios, modelos combinables y asistente
export * as datos from "./datos/index.ts";
export * as modelos from "./modelos/index.ts";
