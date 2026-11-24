# Guía de implementación: de un juego de un jugador a un RPG multijugador

> Para empezar un juego nuevo, correr `npm run crear` (asistente de preguntas → modelos combinados → plan). Recetas
> por género actualizadas (shooter 3D, MOBA, MMO, carreras, supervivencia, zombis...) en [IA.md](IA.md#4-recetas-por-género-qué-clases-usar).

La librería no es un motor que te obliga a un género: es un conjunto de **contextos independientes**. Cada juego toma
los que necesita y les pone sus datos. Esta guía muestra qué tomar para cada tipo de juego, en qué orden, y el
código mínimo para arrancar.

## 0. Arranque común a cualquier juego

```ts
import { Pcg32, RelojSistema, motor } from "ludokit";
const { BucleFijo, Entrada } = motor;

const azar = new Pcg32(semillaDeLaPartida);       // TODO el azar sale de aquí (o de semillas derivadas)
const reloj = new RelojSistema();
const entrada = new Entrada();                     // mapa de acciones remapeable
window.addEventListener("keydown", (e) => entrada.fijarFisico(e.code, true));
window.addEventListener("keyup", (e) => entrada.fijarFisico(e.code, false));

const bucle = new BucleFijo({
  actualizar(dt, tick) { entrada.muestrear(dt); /* … tu simulación … */ },
  dibujar(alfa) { /* … tu render, interpolando con alfa … */ },
}, { hz: 60 });
requestAnimationFrame(function cuadro(t) { bucle.avanzar(t / 1000); requestAnimationFrame(cuadro); });
```

Orden de trabajo recomendado para cualquier proyecto:
1. Bucle + entrada + una sala de prueba fija (sin arte).
2. Movimiento o control del jugador hasta que "se sienta bien" (es lo que más tiempo lleva y lo que más importa).
3. Una mecánica central completa (combate, construcción, cartas…).
4. **Balance por poder esperado** + simulador, *antes* de crear contenido.
5. Contenido como datos (JSON) con el validador en CI.
6. Guardado versionado desde el primer día.
7. Juice (`feel`): hitstop, trauma, partículas, muelles.
8. Si es en línea: netcode desde el principio (agregar red después obliga a reescribir).

---

## 1. Plataformas de acción / metroidvania (un jugador)

| Necesidad | Contexto | Piezas |
|---|---|---|
| Control fino | `fisica` | `Plataformero` + `crearPerfil`, `Grilla` |
| Mundo | `mundo` | `generarNivel` (mazmorra + salas recorribles), o niveles a mano con `Grilla.desdeTexto` |
| Habilidades que abren caminos | `mundo` | `cerraduras: { cristal: "dash" }`, `llaveAColocar` |
| Enemigos | `ia`, `balance` | `AtaquePorFases` + `ModeloBalance.enemigo(nivel)` |
| Combate | `combate` | `calcularDanio`, `MedidorEstilo` |
| Sensación | `feel` | `DirectorImpacto`, `Elastico`, `Particulas`, `Cuerda` (capa) |
| Cámara | `motor` | `Camara` con zona muerta y límites |
| Guardado | `persistencia` | `Guardado` + `AlmacenLocal`/`AlmacenArchivos` |

```ts
import { fisica, mundo, feel } from "ludokit";
const nivel = mundo.generarNivel(semilla, 1, { salas: 18, cerraduras: { cristal: "dash" }, llaveAColocar: "dash" });
const sala = nivel.sala(nivel.mapa.inicio);
const perfil = fisica.crearPerfil(fisica.ARQUETIPOS.ligero, { saltosAereos: 1 }); // multiplicadores + reemplazos
const jugador = new fisica.Plataformero(40, 200, 10, 20, perfil);
const impacto = new feel.DirectorImpacto();
// en actualizar(dt):
const dtSim = impacto.paso(dt);
if (dtSim > 0) jugador.actualizar(dtSim, mando, sala.grilla);
for (const ev of jugador.eventos.vaciar()) if (ev.tipo === "aterrizaje" && ev.velocidad > 300) impacto.aplicar("golpe", 0.5);
```
Ejemplo ejecutable completo: `node ejemplos/plataformas.ts`.

## 2. Roguelike / ARPG de vista superior con botín

| Necesidad | Piezas |
|---|---|
| Movimiento 8 direcciones | `fisica.MovilSuperior` |
| Mapas | `mundo.generarCuevas` o `generarMazmorra` con `dimensiones` propias |
| Enemigos que persiguen en masa | `navegacion.CampoFlujo` (una búsqueda para todos) + `ia.bandada` |
| Jefes con varias opciones | `ia` árbol de comportamiento (`selector`, `aleatorio`, `cooldown`) |
| Stats con equipo | `combate.Atributos` (plano/aumentado/más) + `botin.generarPieza` |
| Botín | `botin.soltarBotin` (fichas) + `tirarRareza` con `suerte` y `minima` |
| Habilidades | `combate.Habilidades` (costo, recarga, cargas, canal) |
| Muerte con riesgo | `roguelite.RegistroLegados` + `resolverMuerte` |
| Mejora de equipo | `botin.mejorarPieza`, `costoMejora`, `valorDesguace` |

```ts
import { combate, botin, Pcg32 } from "ludokit";
const stats = new combate.Atributos({ ataque: 10, vida: 100 });
const pieza = botin.generarPieza(azar, MIS_CLASES, nivelZona, { suerte: stats.valor("suerte") });
for (const [s, v] of Object.entries(pieza.stats)) stats.agregar({ atributo: s, tipo: "plano", valor: v, fuente: pieza.uid });
// al desequipar:
stats.quitarFuente(pieza.uid);
```

## 3. RPG por turnos / táctico

No usa `fisica` ni el bucle de acción para las reglas: el turno es el paso.

| Necesidad | Piezas |
|---|---|
| Orden de turnos | `motor.MaquinaEstados` (elegir → apuntar → resolver → animar) |
| Movimiento en grilla | `navegacion.aEstrella` con `costo` por terreno (bosque 2, agua ∞) |
| Daño, tipos y debilidades | `combate.calcularDanio` (`resistencias` negativas = debilidad) |
| Estados alterados por turno | `combate.GestorEstados` con `actualizar(1)` por turno (1 = un turno) |
| IA enemiga | `ia.elegirAccion` (utilidad: curarse si vida baja, atacar al débil) |
| Historia | `narrativa.Dialogo` + `progresion.RegistroMisiones` |
| Progresión | `progresion.CurvaNiveles`, `ArbolTalentos` |

Truco: con `GestorEstados.actualizar(1)` y `Habilidades.actualizar(1)`, las duraciones y recargas pasan a contarse en
turnos en vez de segundos, y no hay que tocar el código.

## 4. Juego de cartas coleccionables / gacha

| Necesidad | Piezas |
|---|---|
| Rareza y cajas | `coleccion.tirarRareza`, `abrirConPiedad` (umbral, cuotas por bloque, probabilidad suave) |
| Probabilidades visibles (obligatorio en muchos países) | `coleccion.probabilidadesVisibles`, `textoProbabilidades` |
| Fusión y mejora | `coleccion.fusionar`, `mejorar` |
| Economía | `economia.Billetera` (moneda blanda + premium separadas), `casoComprar` |
| Temporadas | `competitivo.Ranking` (cierre de temporada, premios por puesto) |
| Emparejar por habilidad | `competitivo.Emparejador`, `actualizarElo` |

## 5. Tycoon / granja / simulación

| Necesidad | Piezas |
|---|---|
| Tiempo de juego | `motor.Agenda` (`cada`, `en`) con el reloj del juego (acelerable con `escalaTiempo`) |
| Producción con mejoras | `combate.Atributos` usado como "atributos de la fábrica" (velocidad, rendimiento) |
| Inventario y ventas | `inventario.Inventario`, `economia.precioDeVenta`, `Catalogo` |
| Bonos temporales | `combate.GestorBuffs` (fertilizante +20 % por 2 h, persistencia "tiempo-real") |
| NPC con rutinas | `motor.MaquinaEstados` + `navegacion.aEstrella` |
| Mapa | `mundo.fbm` + `bandas` (agua, arena, pasto, roca) |
| Meta-progresión | `progresion.ArbolTalentos` como árbol de tecnologías |

## 6. Shooter / acción en arena (twin-stick, bullet hell)

| Necesidad | Piezas |
|---|---|
| Miles de balas | `motor.Pool` + `espacial.HashEspacial` (`pares()` para colisiones) + `barrerCaja` (sin túnel) |
| Hitscan y visión | `espacial.raycastGrilla`, `hayVision` |
| Oleadas con dificultad | `combate.sortearAfijos`, `escalaDesafio`, `tiempoDesafio` |
| Enemigos voladores | `ia.perseguir`, `evadir`, `evitarObstaculos` |
| Sensación | `feel` completo (trauma con techo para ráfagas) |

## 7. Cooperativo o competitivo en línea (2 a 64 jugadores)

1. Escribir la simulación del jugador como **función pura** `aplicar(estado, entrada, dt)` y usarla igual en el
   cliente y en el servidor.
2. Servidor: `red.ServidorAutoritativo` con tu `MundoServidor` (aplicarEntrada, simular, estadoDe, visiblesPara,
   validar).
3. Cliente: `red.PrediccionCliente` para el jugador propio y `red.BuferInterpolacion` para los demás.
4. Transporte: WebSocket (orden garantizado) con `red/paquetes.ts` o JSON. Probar SIEMPRE con
   `red.CanalSimulado` y `RED_MALA` (latencia 120 ms, jitter 40 ms, 5 % de pérdida, desorden).
5. Disparos: `red.HistorialPosiciones` para validar en el servidor lo que el tirador vio (compensación de lag).
6. Reloj: `red.RelojSincronizado` con pings periódicos.
7. Anti-trampa: `validar` en el `MundoServidor` (velocidad máxima, cooldowns de servidor) + `LimitadorTasa`.

```ts
const cli = new red.PrediccionCliente(estadoInicial, aplicar, distancia);
// cada paso:
const msg = cli.entrada(leerMando(), dt);   socket.send(msg);
socket.onmessage = (snap) => { cli.reconciliar(snap); for (const [id, s] of Object.entries(snap.otros)) bufer(id).agregar(snap.tiempo, s); };
```
La prueba de integración `test/mundo-feel-red.test.ts` → "netcode" muestra todo junto con pérdida de paquetes.

## 8. RPG multijugador masivo (MMO)

Arquitectura de servicios (cada uno, un contexto con su caso de uso y su base de datos):

```
            ┌──────────── puerta de entrada (WebSocket, sesiones, LimitadorTasa) ───────────┐
            │                                                                               │
  SERVIDORES DE ZONA (Rust o Node)                         SERVICIOS (Node + PostgreSQL)
  ServidorAutoritativo a 20 Hz por zona                     cuentas · personajes (Guardado/Repositorio)
  GestorInteres (AOI con histéresis)                        economía: casoComprar, subasta, comercio (ledger)
  HashEspacial + aEstrella + Atributos + Habilidades        social: gremios, correo · competitivo: ranking
  TablaAmenaza por enemigo (tanque, sanador, DPS)           misiones, diálogos, talentos
  delta contra baseline confirmado (HistorialBaselines)     contenido validado (python …datos)
```

Claves de MMO incluidas:
- **Área de interés** (`GestorInteres`): con 200 jugadores, cada uno recibe unas 4 entidades en vez de 200 (ejemplo `ejemplos/mmo.ts`).
- **Aggro de grupo** (`TablaAmenaza`): el tanque mantiene al enemigo y nadie lo "roba" por un golpe de suerte.
- **Economía segura**: toda operación de valor es un caso de uso transaccional con ledger (`casoComprar`).
- **Contenido vivo**: afijos y eventos por semilla y fecha, misiones y diálogos por datos.
- **Persistencia**: `Repositorio` sobre un `Almacen` (en producción, un adaptador SQL que implementa la misma interfaz).

Ejemplo ejecutable: `node ejemplos/mmo.ts 500` (500 jugadores, mide ms por tick y ancho de banda con delta).

## 9. Sistemas transversales (cualquier género)

| Necesidad | Piezas | Notas |
|---|---|---|
| Jefes por datos | `encuentros.CerebroJefe` | Define ataques (patrón, aviso, duración, recarga, desde qué fase) y fases por vida; el juego ejecuta el patrón al recibir el evento `ataque`. Todo ataque se avisa antes. |
| Arenas, hordas, defensa de un punto | `encuentros.EncuentroOleadas` + `premioEncuentro` | El anti-bloqueo (acercar a los 25 s, retirar a los 45 s sin bajas) hace que ningún encuentro sea imposible de terminar. |
| Rival espejo / jefe adaptativo / dificultad dinámica | `ia.RastreadorHabitos`, `decidirEspejo`, `ajusteDificultad` | Registrar golpes, esquivas y habilidades durante la partida; la huella se guarda con el legado del jugador. |
| Sonido sin archivos | `audio.BancoSonidos` + `recetaImpacto(material, fuerza)` | Asignar un `material` a cada entidad en los datos. `node ejemplos/sonidos.ts` genera los .wav para escucharlos. |
| Música adaptativa | `audio.DirectorMusical` | Enviar `estado({modo, energia, peligro})` cada cuadro; los cambios entran al compás siguiente. La energía puede venir de `combate.MedidorEstilo.energia`. |
| Logros y plataformas (Steam, consolas, móviles) | `progresion.RegistroLogros` + una `PlataformaLogros` | Los mismos eventos que cuentan las misiones. Funciona sin conexión y sincroniza después. |
| Contenido semanal y eventos | `progresion.semanaDe`, `rotacion`, `eventoAnual`, `ProgresoPeriodico` | Sin servidor: todos los jugadores ven la misma rotación. |
| Equipo con conjuntos y gemas | `botin.estadoConjuntos`, `modificadoresConjuntos`, `Engarces`, `fundirRunas` | Los bonos entran a `combate.Atributos` con fuente `conjunto:id:piezas`. |
| Crafteo y mejora | `economia.craftear`, `templar` | El templado nunca falla; el modo riesgo cambia moneda por un pacto (bono + maldición). |
| Fusionar criaturas o cartas con rasgos | `coleccion.heredarRasgos` | Herencia, resonancia, mutación y transmutación. |
| Torneos | `competitivo.Torneo`, `premioRonda` | Siembra estándar y pases libres automáticos. |
| Arte por código | `grafico.*`, `terceros/vfx` (efectos y criaturas por receta) | Reescalado pixel-perfect, atlas, normales para luz 2D, LUT por zona. |
| Personajes sin hojas de sprites | `animacion.resolverEsqueleto`, `poseEn` | Dibujar los `HUESOS` por profundidad; las armas van en `manoN`. |
| Herramientas de desarrollo | `motor.Consola` (`alModificar` → `Guardado.ranura = "pruebas"`) | Un truco nunca ensucia la partida real. |
| Móvil | `motor.ControlesTactiles.aplicarA(entrada)` | El juego no distingue teclado, mando o pantalla. |
| Idiomas | `Textos` (núcleo) | Claves con respaldo y plurales; `sinTraducir("en")` lista lo que falta traducir. |
| Contenido en planillas | `python -I -m ludokit_herramientas.catalogo generar/auditar`, `diff_datos` | Una planilla → cliente + servidor, y notas de parche automáticas. |

---

## Cómo adaptar un contexto a un juego que no existe todavía

1. **Lee el lenguaje del contexto** (tabla en `ARQUITECTURA.md`) y tradúcelo al de tu juego: "carta" puede ser
   mascota, arma o tripulante, y "piso" puede ser planeta, temporada o capítulo.
2. **Cambia datos, no código**: perfiles de movimiento, tablas de rareza, curvas de poder, cajas, afijos y tablas de
   botín son objetos `const` que se reemplazan pasando los tuyos.
3. **Extiende por composición**: tu `MundoServidor`, tu `Resolutor` de fichas, tu `Mundo` de diálogos, tus
   `DefHabilidad`. La librería define la interfaz y tu juego la implementa.
4. **Mantén el dominio puro**: si una regla nueva necesita azar o tiempo, recíbelos por parámetro.
5. **Agrega tests con semilla** junto a cada regla nueva, y si la portas a otro lenguaje, súmala a los vectores.
