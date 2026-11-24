// ASISTENTE: una serie de preguntas que determina qué estilo de juego se está haciendo y arma la configuración
// inicial combinando modelos. Funciona igual desde la terminal (`npm run crear`), desde una interfaz propia o desde
// otra IA (las preguntas y respuestas son datos):
//
//   const r = recomendar({ perspectiva: "primera", nucleo: ["disparar", "supervivencia"], ambientacion: "zombis" });
//   r.sugeridos      → modelos ordenados por afinidad (con puntaje y por qué)
//   r.combinacion    → combinar(principal + modificadores deducidos de las respuestas)
//   r.plan           → pasos concretos de implementación con los módulos a usar

import { MODELOS } from "./catalogo.ts";
import { combinar } from "./combinar.ts";
import type { Combinacion, Modelo, Rasgo } from "./tipos.ts";

export interface Opcion {
  readonly valor: string;
  readonly texto: string;
}

export interface Pregunta {
  readonly id: string;
  readonly texto: string;
  readonly ayuda?: string;
  readonly multiple?: boolean;
  readonly opciones: readonly Opcion[];
  /** Importancia de la pregunta en el puntaje. */
  readonly peso: number;
}

export const PREGUNTAS: readonly Pregunta[] = [
  { id: "nucleo", texto: "¿Qué hace el jugador la mayor parte del tiempo?", multiple: true, peso: 3, opciones: [
    { valor: "disparar", texto: "Disparar armas" }, { valor: "cuerpo-a-cuerpo", texto: "Pelear cuerpo a cuerpo" },
    { valor: "habilidades", texto: "Usar habilidades / hechizos" }, { valor: "estrategia", texto: "Dar órdenes / estrategia" },
    { valor: "gestion", texto: "Gestionar recursos o una base" }, { valor: "conducir", texto: "Conducir vehículos" },
    { valor: "cartas", texto: "Jugar cartas" }, { valor: "plataformas", texto: "Saltar y explorar plataformas" },
    { valor: "supervivencia", texto: "Sobrevivir (comer, refugio, recolectar)" }, { valor: "sigilo", texto: "Escabullirse sin ser visto" },
    { valor: "narrativa", texto: "Tomar decisiones en una historia" }, { valor: "coleccion", texto: "Coleccionar personajes / cartas" },
    { valor: "puzle", texto: "Resolver puzles" },
  ] },
  { id: "perspectiva", texto: "¿Cómo se ve el juego?", peso: 2, opciones: [
    { valor: "primera", texto: "3D en primera persona" }, { valor: "tercera", texto: "3D en tercera persona" },
    { valor: "isometrica", texto: "Isométrica / cámara alta" }, { valor: "superior", texto: "2D desde arriba" },
    { valor: "lateral", texto: "2D de costado" }, { valor: "sin-mapa", texto: "Sin mapa (menús, cartas, texto)" },
  ] },
  { id: "ritmo", texto: "¿Tiempo real o por turnos?", peso: 1.5, opciones: [
    { valor: "tiempo-real", texto: "Tiempo real" }, { valor: "turnos", texto: "Por turnos" },
    { valor: "pausa-tactica", texto: "Tiempo real con pausa táctica" }, { valor: "inactivo", texto: "Avanza solo (incremental)" },
  ] },
  { id: "jugadores", texto: "¿Con quién se juega?", peso: 1.5, opciones: [
    { valor: "solo", texto: "Un jugador" }, { valor: "cooperativo", texto: "Cooperativo" },
    { valor: "competitivo", texto: "Contra otros jugadores por partidas" }, { valor: "masivo", texto: "Mundo persistente masivo" },
  ] },
  { id: "sesion", texto: "¿Cómo es una sesión de juego?", peso: 1, opciones: [
    { valor: "partidas", texto: "Partidas cortas que empiezan de cero" }, { valor: "corridas", texto: "Corridas que terminan al morir (roguelite)" },
    { valor: "campania", texto: "Campaña / historia" }, { valor: "sin-fin", texto: "Sin fin (servicio, sandbox)" },
  ] },
  { id: "progresion", texto: "¿Qué hace más fuerte al jugador?", multiple: true, peso: 1.5, opciones: [
    { valor: "botin", texto: "Botín y equipo" }, { valor: "niveles", texto: "Niveles y talentos" },
    { valor: "habilidad-jugador", texto: "Solo su habilidad" }, { valor: "coleccion", texto: "Su colección" },
    { valor: "base", texto: "Su base / refugio" }, { valor: "meta", texto: "Mejoras permanentes entre partidas" },
  ] },
  { id: "muerte", texto: "¿Qué pasa al morir?", peso: 1.2, opciones: [
    { valor: "sin-castigo", texto: "Nada grave, reintenta" }, { valor: "pierde-lo-que-lleva", texto: "Pierde lo que llevaba encima" },
    { valor: "permanente", texto: "Muerte permanente" }, { valor: "tumba", texto: "Deja una tumba para recuperar" },
    { valor: "pierde-experiencia", texto: "Pierde experiencia/oro" },
  ] },
  { id: "realismo", texto: "¿Qué tan realista?", peso: 1, opciones: [
    { valor: "arcade", texto: "Arcade" }, { valor: "intermedio", texto: "Intermedio" }, { valor: "simulacion", texto: "Simulación" },
  ] },
  { id: "ambientacion", texto: "¿Ambientación?", peso: 0.8, opciones: [
    { valor: "fantasia", texto: "Fantasía" }, { valor: "militar", texto: "Moderna / militar" }, { valor: "zombis", texto: "Zombis / postapocalipsis" },
    { valor: "ciencia-ficcion", texto: "Ciencia ficción" }, { valor: "motor", texto: "Motor / deportes" },
    { valor: "terror", texto: "Terror" }, { valor: "cotidiano", texto: "Cotidiana / granja / vida" },
  ] },
  { id: "enemigos", texto: "¿Contra qué se pelea?", multiple: true, peso: 1, opciones: [
    { valor: "hordas", texto: "Hordas" }, { valor: "tacticos", texto: "Pocos enemigos inteligentes" },
    { valor: "jefes", texto: "Jefes" }, { valor: "jugadores", texto: "Otros jugadores" },
  ] },
  { id: "economia", texto: "¿Economía?", peso: 0.7, opciones: [
    { valor: "ninguna", texto: "Ninguna" }, { valor: "tienda", texto: "Tienda" },
    { valor: "comercio", texto: "Comercio entre jugadores / subasta" }, { valor: "cajas", texto: "Cajas / gacha" },
  ] },
  { id: "contenido", texto: "¿Hasta dónde llega el contenido?", peso: 0.8, opciones: [
    { valor: "finito", texto: "Tiene un final" }, { valor: "infinito", texto: "Infinito (dificultad y niveles sin tope)" },
  ] },
];

export type Respuestas = Readonly<Record<string, string | readonly string[]>>;

export interface Sugerencia {
  readonly modelo: Modelo;
  readonly puntaje: number;
  /** Rasgos que coincidieron. */
  readonly porque: readonly string[];
}

export interface Recomendacion {
  readonly sugeridos: readonly Sugerencia[];
  readonly modificadores: readonly Modelo[];
  readonly combinacion: Combinacion;
  readonly plan: readonly string[];
}

const lista = (v: string | readonly string[] | undefined): readonly string[] => (v === undefined ? [] : typeof v === "string" ? [v] : v);

/** Puntaje de un modelo para unas respuestas: Σ peso(pregunta) × rasgo(modelo), normalizado por lo respondido. */
export function puntuar(m: Modelo, r: Respuestas): Sugerencia {
  let s = 0, max = 0;
  const porque: string[] = [];
  for (const p of PREGUNTAS) {
    const vals = lista(r[p.id]);
    if (!vals.length) continue;
    max += p.peso;
    let mejor = 0;
    for (const v of vals) {
      const w = m.rasgos[`${p.id}:${v}` as Rasgo] ?? 0;
      if (w > 0) porque.push(`${p.id}:${v}`);
      // Respuestas múltiples: cuenta el promedio de lo que el modelo cubre (premia cubrir varias).
      mejor += w / vals.length;
    }
    s += p.peso * Math.min(1, mejor * (vals.length > 1 ? 1.5 : 1));
  }
  return { modelo: m, puntaje: max > 0 ? s / max : 0, porque };
}

/** Modificadores que se deducen directo de las respuestas (se suman a la base elegida). */
function modificadoresPara(r: Respuestas, base: Modelo): Modelo[] {
  const ids: string[] = [];
  const tiene = (p: string, v: string): boolean => lista(r[p]).includes(v);
  const baseTiene = (rasgo: string): boolean => (base.rasgos[rasgo as Rasgo] ?? 0) >= 0.6;
  if (tiene("ambientacion", "zombis") && !baseTiene("ambientacion:zombis")) ids.push("mod-zombis");
  if (tiene("ambientacion", "militar") && tiene("realismo", "simulacion")) ids.push("mod-militar");
  if (tiene("nucleo", "supervivencia") && !baseTiene("nucleo:supervivencia")) ids.push("mod-supervivencia");
  if (tiene("muerte", "permanente") && !baseTiene("muerte:permanente")) ids.push("mod-hardcore");
  if (tiene("muerte", "pierde-lo-que-lleva") && !baseTiene("muerte:pierde-lo-que-lleva")) ids.push("mod-extraccion");
  if (tiene("jugadores", "cooperativo") && !baseTiene("jugadores:cooperativo")) ids.push("mod-cooperativo");
  if (tiene("jugadores", "competitivo")) ids.push("mod-competitivo");
  if (tiene("jugadores", "masivo") && !baseTiene("jugadores:masivo")) ids.push("mod-mundo-persistente");
  if (tiene("sesion", "sin-fin")) ids.push("mod-servicio-vivo");
  if (tiene("contenido", "infinito") && !baseTiene("contenido:infinito")) ids.push("mod-infinito");
  return MODELOS.filter((m) => ids.includes(m.id));
}

/**
 * Recomienda modelos y arma la combinación. `extras`: ids de modelos base a sumar a mano (mezclar géneros,
 * p. ej. "carreras-arcade" + "shooter-arena"). Si no hay extras, se suma el 2.º sugerido cuando está muy cerca del
 * 1.º y aporta un núcleo distinto (géneros híbridos).
 */
export function recomendar(r: Respuestas, extras: readonly string[] = [], cantidad = 5): Recomendacion {
  const sugeridos = MODELOS.filter((m) => m.tipo === "base").map((m) => puntuar(m, r)).sort((a, b) => b.puntaje - a.puntaje || a.modelo.id.localeCompare(b.modelo.id)).slice(0, cantidad);
  const principal = sugeridos[0].modelo;
  const bases = [principal, ...MODELOS.filter((m) => extras.includes(m.id) && m.id !== principal.id)];
  if (!extras.length && sugeridos[1] && sugeridos[1].puntaje >= sugeridos[0].puntaje * 0.9) {
    const nucleos = (m: Modelo): string[] => Object.keys(m.rasgos).filter((k) => k.startsWith("nucleo:") && (m.rasgos[k as Rasgo] ?? 0) >= 0.8);
    if (nucleos(sugeridos[1].modelo).some((n) => !nucleos(principal).includes(n))) bases.push(sugeridos[1].modelo);
  }
  const mods = modificadoresPara(r, principal);
  const combinacion = combinar([...bases, ...mods]);
  return { sugeridos, modificadores: mods, combinacion, plan: planDeImplementacion(combinacion) };
}

/** Pasos concretos, en orden, para empezar el juego con la combinación. */
export function planDeImplementacion(c: Combinacion): string[] {
  const usa = (m: string): boolean => c.modulos.includes(m);
  const pasos: string[] = [
    "1. Bucle de paso fijo (motor.BucleFijo a 60 Hz) + entrada (motor.Entrada) + Azar con semilla (Pcg32) y Reloj inyectados.",
    "2. Copiar `combinacion.reglas` a un archivo de datos del juego (JSON) y validarlo al arrancar.",
  ];
  if (usa("disparos")) pasos.push("3. Armas: `new disparos.Arma(def)` + `Dispersion` + `Retroceso` por arma; cada evento 'disparo' → `disparos.resolverDisparo(escena, ojos, dir, {...})` contra `espacial.Colisionador3D`.");
  if (c.reglas.movimiento3d) pasos.push("4. Movimiento: `new fisica.Controlador3D(pos, reglas.movimiento3d)` y `actualizar(dt, entrada, suelo)`; la cámara usa `ojos`.");
  if (usa("carreras")) pasos.push("4. Vehículo: `new carreras.Vehiculo(datos.vehiculos.vehiculo(id).def)`; pista con `carreras.Carrera(controles, vueltas, ids)`.");
  if (c.reglas.balance) pasos.push("5. Balance: `new balance.ModeloBalance(reglas.balance.curva, reglas.balance.reglas)`; enemigos con `.enemigo(nivel, pesoVida, pesoAtaque)` (pesos en datos.criaturas).");
  if (c.reglas.rareza) pasos.push("6. Botín: `botin.tirarRareza(azar, reglas.rareza, nivel)` y `botin.generarPieza(azar, clases, nivel, reglas.equipo)`.");
  if (c.reglas.director) pasos.push("7. Enemigos: `new encuentros.Director(reglas.director, azar)`; cada paso `actualizar(dt, vivosPorTipo)` devuelve qué hacer aparecer.");
  if (c.reglas.oleadas) pasos.push("7. Oleadas: `encuentros.EncuentroOleadas(variante, nivel, reglas.oleadas)` y `premioEncuentro(..., reglas.premio)`.");
  if (c.reglas.necesidades) pasos.push("8. Supervivencia: `new supervivencia.Necesidades(reglas.necesidades)`; el daño que devuelve `actualizar` se resta a la vida.");
  if (c.reglas.salud) pasos.push("8. Salud por partes: `new disparos.SaludPorPartes(datos.armas.PARTES_HUMANOIDE, reglas.salud)`; blindaje con `disparos.resolverBlindaje`.");
  if (usa("moba")) pasos.push("9. Carriles: `new moba.GeneradorCarriles(reglas.carriles, ['arriba','medio','abajo'])`; torres `moba.Estructura`; oro con `moba.recompensaUnidad`.");
  if (usa("turnos")) pasos.push("9. Turnos: `new turnos.ColaTiempo(combatientes)`; `siguiente()` → actuar → `actuo(id, costo)`.");
  if (usa("mazo")) pasos.push("9. Cartas: `new mazo.Mazo(cartas, reglas.mazo, azar)`; `empezarTurno` / `jugar` / `terminarTurno`.");
  if (usa("estrategia")) pasos.push("9. Estrategia: selección `estrategia.seleccionarRect`, `formacion`, `ColaProduccion`, `CuadriculaConstruccion`.");
  if (usa("vision")) pasos.push("10. Visión: `vision.NieblaGuerra` (RTS/MOBA/roguelike) o `vision.Sospecha` + `enConoDeVision` (sigilo).");
  if (usa("grupo")) pasos.push("11. Grupo: `grupo.Grupo`, `armarGrupos`, `repartirPorTirada` / `botinPersonal`, `Bloqueos`.");
  const g = c.generos;
  const estilo = g.includes("terror") ? "ESTILO_TERROR" : g.some((x) => ["tactico", "extraccion", "simulacion"].includes(x)) ? "ESTILO_TACTICO" : g.some((x) => ["arcade", "shmup", "hordas", "lucha"].includes(x)) ? "ESTILO_ARCADE" : "ESTILO_ESTANDAR";
  pasos.push(`11. Feedback: el dominio emite \`feedback.EventoJuego\`; \`new feedback.TraductorFeedback(feedback.${estilo})\` → órdenes de impacto (feel.DirectorImpacto), sonido (audio.BancoSonidos) y efectos del motor. Ofrecer \`ESTILO_ACCESIBLE\` en opciones.`);
  if (usa("red")) pasos.push("12. Red: `red.ServidorAutoritativo` + `PrediccionCliente`; si hay disparos, `red.rebobinar` con `HistorialPosiciones3D`.");
  if (c.reglas.experiencia || c.reglas.paragon) pasos.push("13. Progresión: `progresion.curvaDesde(costo, nivelMax)` o `CurvaNivelesInfinita(costo)`; paragon con `progresion.Paragon`.");
  pasos.push(`${pasos.length + 1}. Persistencia: \`persistencia.Guardado\` versionado con migraciones. Verificar balance con \`balance.simularPelea\` y tests deterministas.`);
  if (c.conflictos.length) pasos.push(`Revisar ${c.conflictos.length} reglas que dos modelos definían distinto: ${c.conflictos.map((x) => `${x.ruta} (ganó ${x.ganador})`).join(", ")}.`);
  return pasos;
}
