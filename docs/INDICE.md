# Índice de ludokit

> Generado por `npm run indice` desde el código. No editar a mano.

**37 espacios de nombres · 152 archivos · 857 exportaciones · 58 modelos · 12 preguntas del asistente.**

Cómo usar este índice:

1. ¿No sabés por dónde empezar? `npm run crear` (preguntas → modelos → plan).
2. Buscá tu género en **Modelos** y mirá qué espacios usa.
3. En **Espacios de nombres** está qué hace cada archivo y cada función/clase.
4. Los asistentes de IA leen `docs/IA.md` y `docs/catalogo.json`.

## Contenido

- [Modelos por género](#modelos-por-género)
- [Preguntas del asistente](#preguntas-del-asistente)
- [Catálogos de datos](#catálogos-de-datos)
- [Espacios de nombres](#espacios-de-nombres)
  - [`(raíz)`](#raíz)
  - [`motor`](#motor)
  - [`espacial`](#espacial)
  - [`red`](#red)
  - [`grafico`](#grafico)
  - [`animacion`](#animacion)
  - [`audio`](#audio)
  - [`balance`](#balance)
  - [`botin`](#botin)
  - [`coleccion`](#coleccion)
  - [`combate`](#combate)
  - [`competitivo`](#competitivo)
  - [`economia`](#economia)
  - [`encuentros`](#encuentros)
  - [`feel`](#feel)
  - [`fisica`](#fisica)
  - [`ia`](#ia)
  - [`inventario`](#inventario)
  - [`mundo`](#mundo)
  - [`narrativa`](#narrativa)
  - [`navegacion`](#navegacion)
  - [`progresion`](#progresion)
  - [`roguelite`](#roguelite)
  - [`social`](#social)
  - [`persistencia`](#persistencia)
  - [`disparos`](#disparos)
  - [`moba`](#moba)
  - [`vision`](#vision)
  - [`grupo`](#grupo)
  - [`supervivencia`](#supervivencia)
  - [`turnos`](#turnos)
  - [`mazo`](#mazo)
  - [`estrategia`](#estrategia)
  - [`carreras`](#carreras)
  - [`feedback`](#feedback)
  - [`datos`](#datos)
  - [`modelos`](#modelos)

## Modelos por género

Bases (un género completo) y modificadores (se suman a cualquier base). Combinar: `modelos.combinar([modelos.modelo("a"), modelos.modelo("b")])`.

| id | tipo | nombre | módulos | descripción |
|---|---|---|---|---|
| `arpg-botin` | base | RPG de acción con botín | `combate` `botin` `progresion` `balance` `ia` `navegacion` `mundo` `encuentros` `inventario` `economia` `feel` | Vista isométrica, matar hordas, botín con rareza y afijos, builds por talentos, jefes y dificultad creciente. |
| `arpg-temporadas` | base | ARPG de temporadas (fin de juego infinito) | `combate` `botin` `progresion` `balance` `competitivo` `encuentros` | Nivel máximo + paragon sin tope, portales de dificultad infinita, temporadas con reinicio y ranking. |
| `looter-shooter` | base | Shooter con botín | `disparos` `fisica` `botin` `combate` `progresion` `balance` `espacial` | Armas generadas con rareza y afijos, niveles de personaje, enemigos con barra de vida, cooperativo. |
| `hack-and-slash` | base | Hack and slash de estilo | `combate` `feel` `fisica` `ia` `encuentros` `animacion` | Combos, cancelaciones, medidor de estilo, enemigos que esperan turno, jefes con patrones. |
| `souls` | base | Acción exigente con estamina | `combate` `fisica` `roguelite` `encuentros` `ia` `progresion` `feel` | Estamina para atacar/esquivar, jefes por fases, morir deja tu moneda de progreso en una tumba recuperable, puntos de descanso que reviven enemigos. |
| `mmo-tematico` | base | MMORPG clásico de objetivo | `combate` `grupo` `progresion` `botin` `economia` `social` `red` `narrativa` `competitivo` | Objetivo con tabulador, recarga global, casteos interrumpibles, amenaza, roles tanque/sanador/daño, mazmorras y bandas con bloqueo semanal, reputación, oficios. |
| `mmo-accion` | base | MMO de acción y territorio | `combate` `fisica` `progresion` `supervivencia` `economia` `competitivo` `grupo` `red` | Combate de apuntar sin objetivo fijo, estamina y esquiva, maestría de armas por uso, recolección y oficios que suben con práctica, territorios por facción. |
| `moba` | base | Arena de batalla 5 contra 5 | `moba` `combate` `vision` `navegacion` `economia` `competitivo` `red` | Tres carriles con súbditos, torres con prioridad, oro por último golpe, experiencia compartida, rangos de habilidad con definitiva, tiendas de objetos con recetas. |
| `arena-heroes` | base | Arena de héroes por rondas | `combate` `competitivo` `red` `feel` | Equipos chicos, rondas cortas, héroes con habilidades y cargas, sin carriles; gana quien gana N rondas. |
| `shooter-arena` | base | Shooter de arena rápido | `disparos` `fisica` `espacial` `red` `competitivo` `feel` | Movimiento veloz con salto aéreo y deslizamiento, armas en el mapa, blindaje y vida recogibles, todos contra todos. |
| `shooter-tactico` | base | Shooter táctico por rondas | `disparos` `fisica` `espacial` `red` `competitivo` `economia` `vision` | Una vida por ronda, economía de compra entre rondas, plantar/desactivar, primer disparo preciso, retroceso con patrón aprendible. |
| `shooter-extraccion` | base | Shooter táctico de extracción | `disparos` `fisica` `espacial` `inventario` `economia` `roguelite` `supervivencia` `ia` `vision` `red` | Entrás con lo que arriesgás, salud por partes, munición con penetración contra clases de blindaje, sangrados y fracturas, botín para vender en el refugio, salir por puntos de extracción. |
| `batalla-real` | base | Batalla real | `disparos` `fisica` `competitivo` `red` `inventario` `botin` | Muchos jugadores, se salta al mapa, se junta equipo del suelo, la zona segura se cierra por fases, gana el último. |
| `shooter-heroes` | base | Shooter de héroes por objetivos | `disparos` `combate` `competitivo` `fisica` `red` | Personajes con armas y habilidades únicas, roles, puntos de captura y escolta. |
| `shooter-coberturas` | base | Shooter en tercera persona con coberturas | `disparos` `fisica` `ia` `navegacion` `encuentros` | Pegarse a coberturas, disparar asomado, enemigos que flanquean, campaña. |
| `hordas-zombis` | base | Hordas de zombis cooperativo | `disparos` `encuentros` `ia` `navegacion` `fisica` `supervivencia` `grupo` | Cuatro jugadores contra hordas manejadas por un director de ritmo, infectados especiales, recursos escasos, ir de refugio en refugio. |
| `guerra-zombis` | base | Guerra contra zombis (escuadras y defensa) | `estrategia` `encuentros` `combate` `ia` `navegacion` `vision` `supervivencia` `disparos` | Comandás escuadras de soldados (fusileros, ametralladores, médicos, ingenieros) que defienden posiciones fortificadas de oleadas zombis cada vez mayores; construís defensas y producís tropas. |
| `supervivencia-sandbox` | base | Supervivencia sandbox | `supervivencia` `economia` `inventario` `mundo` `estrategia` `combate` | Hambre, sed, temperatura, recolectar con herramientas, craftear, construir refugio, día y noche, herramientas que se gastan. |
| `supervivencia-zombi` | base | Supervivencia zombi en mundo abierto | `supervivencia` `vision` `encuentros` `inventario` `disparos` `ia` | Saqueo de casas, ruido que atrae hordas, infección por mordida, comida que se pudre, noches peligrosas, muerte permanente opcional. |
| `extraccion-2d` | base | Extracción de vista superior | `disparos` `fisica` `vision` `inventario` `roguelite` `supervivencia` `economia` `ia` | La versión 2D del shooter de extracción: cono de visión, linterna, sonido, inventario por peso, refugio con estaciones. |
| `roguelite-accion` | base | Roguelite de acción | `mundo` `combate` `encuentros` `roguelite` `progresion` `botin` `feel` | Corridas cortas por salas generadas, mejoras elegidas al azar, jefes, moneda que persiste entre corridas para mejoras permanentes. |
| `roguelike-turnos` | base | Roguelike clásico por turnos | `turnos` `vision` `mundo` `combate` `navegacion` `inventario` | Grilla, cada acción es un turno, niebla de guerra, muerte permanente, identificar objetos. |
| `supervivientes-hordas` | base | Supervivientes de hordas (auto-ataque) | `fisica` `espacial` `encuentros` `progresion` `feel` `navegacion` | El personaje ataca solo, cientos de enemigos, experiencia que se atrae con imán, elegir 1 de 3 mejoras por nivel, 20-30 minutos. |
| `metroidvania` | base | Metroidvania | `fisica` `mundo` `encuentros` `combate` `feel` `progresion` | Mapa interconectado, habilidades de movimiento que abren zonas (doble salto, dash), jefes, mapa explorado. |
| `plataformas-precision` | base | Plataformas de precisión | `fisica` `feel` `mundo` | Niveles cortos y difíciles, reaparición instantánea, control milimétrico, contrarreloj. |
| `lucha-plataformas` | base | Lucha en plataformas | `fisica` `combate` `feel` `competitivo` | El daño acumulado aumenta el empuje; se gana sacando al rival del escenario. |
| `lucha-1v1` | base | Lucha uno contra uno | `combate` `feel` `competitivo` `red` `motor` | Rondas, barra de vida, medidor de especial, combos con cancelaciones, ranking Elo. |
| `jrpg` | base | RPG por turnos de grupo | `turnos` `combate` `progresion` `narrativa` `inventario` `economia` | Grupo de héroes, orden por velocidad con vista previa de turnos, elementos y debilidades, historia. |
| `tactico-grilla` | base | Táctico por turnos en grilla | `turnos` `vision` `navegacion` `combate` `progresion` | Escuadra en grilla, puntos de acción, coberturas media/total, flanqueo, probabilidad de impacto visible, muerte permanente de soldados. |
| `mazo-roguelike` | base | Roguelike de construcción de mazo | `mazo` `turnos` `mundo` `roguelite` `combate` | Mazo que crece en la corrida, energía por turno, enemigos que muestran su intención, reliquias pasivas. |
| `cartas-coleccionables` | base | Cartas coleccionables competitivas | `mazo` `coleccion` `competitivo` `economia` `red` | Colección por sobres con piedad, mazos de N cartas, maná que crece por turno, ranking por temporadas. |
| `gacha` | base | Colección gacha | `coleccion` `economia` `progresion` `inventario` | Personajes por estrellas, probabilidades visibles, piedad, fusión y mejora, eventos por calendario. |
| `rts` | base | Estrategia en tiempo real | `estrategia` `vision` `navegacion` `combate` `ia` `red` | Recolectores, edificios con cola de producción, población, selección por arrastre, grupos de control, formaciones, niebla de guerra. |
| `defensa-torres` | base | Defensa de torres | `estrategia` `encuentros` `combate` `navegacion` | Camino fijo, torres con prioridad de objetivo, oleadas, oro por enemigo e interés, mejorar/vender. |
| `defensa-laberinto` | base | Defensa de torres con laberinto | `estrategia` `navegacion` `encuentros` | Las torres son el laberinto: se construye en campo abierto sin cerrar nunca el camino. |
| `colonia` | base | Gestión de colonia | `supervivencia` `estrategia` `ia` `economia` `navegacion` | Colonos con necesidades y ánimo, trabajos, producción, eventos, día y noche. |
| `incremental` | base | Incremental / inactivo | `progresion` `economia` `motor` | Números que crecen exponencialmente, generadores con costo exponencial, progreso desconectado, prestigio. |
| `carreras-arcade` | base | Carreras arcade | `carreras` `feel` `audio` `competitivo` | Derrape fácil, nitro que se carga derrapando, rivales con rubber banding, atajos. |
| `carreras-simulacion` | base | Carreras de simulación | `carreras` `audio` | Curvas de par reales, cambio manual o automático, superficies con agarre, contrarreloj con fantasma. |
| `rally` | base | Rally y todoterreno | `carreras` `supervivencia` | Etapas punto a punto, superficies cambiantes, daño del vehículo. |
| `combate-vehicular` | base | Combate vehicular | `carreras` `disparos` `competitivo` | Vehículos con armas montadas, recogibles, arena o carrera con combate. |
| `sigilo` | base | Sigilo | `vision` `ia` `navegacion` `combate` | Guardias con conos de visión y medidor de sospecha, luz y sombra, ruido, eliminar sin ser visto. |
| `terror-supervivencia` | base | Terror de supervivencia | `vision` `encuentros` `inventario` `ia` `supervivencia` | Pocos recursos, un perseguidor que el director acerca y aleja, esconderse, inventario chico. |
| `mundo-abierto-rpg` | base | RPG de mundo abierto | `progresion` `narrativa` `combate` `balance` `economia` `mundo` | Zonas con rango de nivel que escalan al jugador, facciones con reputación, misiones con diálogo, oficios. |
| `aventura-narrativa` | base | Aventura narrativa | `narrativa` `progresion` `infraestructura` | Decisiones con consecuencias, variables de mundo, diálogos ramificados, finales múltiples. |
| `granja-vida` | base | Granja y vida | `supervivencia` `progresion` `economia` `narrativa` `inventario` | Cultivos por estación, calendario, amistad con vecinos, oficios, tienda. |
| `cooperativo-mazmorras` | base | Mazmorras cooperativas | `grupo` `combate` `botin` `encuentros` `red` | Grupos de 2 a 6, enemigos que escalan por jugadores, botín personal, crédito por daño. |
| `disparos-naves` | base | Disparos de naves / infierno de balas | `fisica` `encuentros` `feel` `espacial` | Patrones de proyectiles, jefes con fases, puntaje y multiplicador. |
| `mod-zombis` | modificador | + Zombis | `encuentros` `supervivencia` `navegacion` | Agrega hordas de infectados con director, infección por mordida y noches peligrosas. |
| `mod-militar` | modificador | + Militar realista | `disparos` | Armas y munición realistas, blindaje por clases, enemigos tácticos. |
| `mod-supervivencia` | modificador | + Supervivencia | `supervivencia` | Hambre, sed, día/noche y durabilidad sobre cualquier género. |
| `mod-hardcore` | modificador | + Muerte permanente | `roguelite` | Morir borra el personaje (opcionalmente conserva meta-progreso). |
| `mod-extraccion` | modificador | + Extracción | `roguelite` `inventario` | Lo que llevás se arriesga; solo lo extraído queda. |
| `mod-cooperativo` | modificador | + Cooperativo en línea | `red` `grupo` | Servidor autoritativo, escalado por jugadores, reparto de botín. |
| `mod-competitivo` | modificador | + Competitivo clasificatorio | `competitivo` `red` | Ranking con temporadas, emparejamiento, compensación de lag. |
| `mod-servicio-vivo` | modificador | + Servicio en vivo | `progresion` | Pase de temporada, misiones diarias/semanales, eventos por calendario, logros. |
| `mod-infinito` | modificador | + Contenido infinito | `balance` `progresion` | Niveles y dificultad sin tope: paragon y portales con dificultad exponencial. |
| `mod-mundo-persistente` | modificador | + Mundo persistente masivo | `social` `economia` `red` `infraestructura` | Gremios, correo, subasta, interés de red por zonas, persistencia por repositorio. |

## Preguntas del asistente

`modelos.recomendar(respuestas)` · respuestas = `{ id: valor | valor[] }`.

- **`nucleo`** (varias): ¿Qué hace el jugador la mayor parte del tiempo? — `disparar`, `cuerpo-a-cuerpo`, `habilidades`, `estrategia`, `gestion`, `conducir`, `cartas`, `plataformas`, `supervivencia`, `sigilo`, `narrativa`, `coleccion`, `puzle`
- **`perspectiva`**: ¿Cómo se ve el juego? — `primera`, `tercera`, `isometrica`, `superior`, `lateral`, `sin-mapa`
- **`ritmo`**: ¿Tiempo real o por turnos? — `tiempo-real`, `turnos`, `pausa-tactica`, `inactivo`
- **`jugadores`**: ¿Con quién se juega? — `solo`, `cooperativo`, `competitivo`, `masivo`
- **`sesion`**: ¿Cómo es una sesión de juego? — `partidas`, `corridas`, `campania`, `sin-fin`
- **`progresion`** (varias): ¿Qué hace más fuerte al jugador? — `botin`, `niveles`, `habilidad-jugador`, `coleccion`, `base`, `meta`
- **`muerte`**: ¿Qué pasa al morir? — `sin-castigo`, `pierde-lo-que-lleva`, `permanente`, `tumba`, `pierde-experiencia`
- **`realismo`**: ¿Qué tan realista? — `arcade`, `intermedio`, `simulacion`
- **`ambientacion`**: ¿Ambientación? — `fantasia`, `militar`, `zombis`, `ciencia-ficcion`, `motor`, `terror`, `cotidiano`
- **`enemigos`** (varias): ¿Contra qué se pelea? — `hordas`, `tacticos`, `jefes`, `jugadores`
- **`economia`**: ¿Economía? — `ninguna`, `tienda`, `comercio`, `cajas`
- **`contenido`**: ¿Hasta dónde llega el contenido? — `finito`, `infinito`

## Catálogos de datos

Datos PROPIOS de ludokit (`import { datos } from "ludokit"`): puntos de partida para copiar y cambiar.

- **`datos.armas`**: `ACCESORIOS`, `ARMAS`, `BLINDAJES`, `CALIBRES`, `CONVERSION_BALISTICA`, `PARTES_HUMANOIDE`, `TIPOS_MUNICION`, `ZONAS_HUMANOIDE`, `aplicarAccesorios`, `energia`, `ficha`, `municion`
- **`datos.criaturas`**: `ARQUETIPOS`, `arquetipo`, `tiposDeAparicion`
- **`datos.rpg`**: `AFINIDADES`, `CLASES`, `CONJUNTOS_STATS`, `ESTADOS`, `RAREZAS`, `TIPOS_DANIO`, `afinidad`
- **`datos.vehiculos`**: `SUPERFICIES`, `VEHICULOS`, `vehiculo`

## Espacios de nombres

### (raíz)

`import { Pcg32, curva, vec3 } from "ludokit"`

#### `src/nucleo/azar.ts`

Azar inyectable.

| exportación | tipo | descripción |
|---|---|---|
| `Azar` | interface |  |
| `AzarSemilla` | class | Número en [0, 1). */ siguiente(): number; } export class AzarSistema implements Azar { siguiente(): number { return Math.random(); } } /** Generador determinista (mulberry32). Misma semilla = misma se |
| `entero` | function | Entero en [0, max). |
| `tirar` | function | true con probabilidad `prob` (0~1; 1 o más = siempre). |
| `elegirUno` | function |  |
| `elegirPonderado` | function | Tabla de probabilidades acumuladas, como `RandomPicker` del servidor: se recorre restando cada probabilidad. Si la suma no llega a 1, el resto cae en `sobrantes` (elegido al azar) o, sin sobrantes, en |
| `elegirPorPeso` | function | Elección por pesos relativos (no hace falta que sumen 1). |

#### `src/nucleo/eventos.ts`

Eventos de dominio.

| exportación | tipo | descripción |
|---|---|---|
| `EventoDominio` | interface |  |
| `ColaEventos` | class |  |

#### `src/nucleo/geom.ts`

Value objects inmutables de geometría 2D (y hacia abajo, como en pantalla).

| exportación | tipo | descripción |
|---|---|---|
| `V2` | interface |  |
| `v2` | const |  |
| `CERO` | const |  |
| `sumar` | const |  |
| `restar` | const |  |
| `escalar` | const |  |
| `largo` | const |  |
| `distancia` | const |  |
| `lerpV` | const |  |
| `desdeAngulo` | const |  |
| `normalizar` | function |  |
| `Rect` | interface |  |
| `rect` | const |  |
| `seTocan` | const |  |
| `contiene` | const |  |
| `centro` | const |  |
| `inflar` | const |  |

#### `src/nucleo/mates.ts`

Utilidades matemáticas sin estado (clamp, interpolación, curvas).

| exportación | tipo | descripción |
|---|---|---|
| `TAU` | const |  |
| `clamp` | const |  |
| `lerp` | const |  |
| `invLerp` | const |  |
| `remap` | const |  |
| `fract` | const |  |
| `wrap` | const |  |
| `seg` | const | 0..1 dentro de [t0, t1]. |
| `smoothstep` | const |  |
| `bump` | const | Campana 0→1→0 entre t0 y t1. |
| `acercar` | function | Acercar `v` a `objetivo` como máximo `paso`. |
| `interpolarTablas` | function | Curva de potencia interpolada entre dos tablas (rareza por piso): t = ((i-1)/(n-1))^exp. |

#### `src/nucleo/pcg32.ts`

PCG32 (XSH-RR):

| exportación | tipo | descripción |
|---|---|---|
| `derivarSemilla` | function | Semilla derivada para un sub-sistema: semilla + n · φ64 (p. ej. una por nivel o por sala). |
| `Pcg32` | class |  |

#### `src/nucleo/reloj.ts`

Reloj inyectable:

| exportación | tipo | descripción |
|---|---|---|
| `Reloj` | interface |  |
| `RelojSistema` | class |  |
| `RelojManual` | class |  |
| `SEGUNDO` | const |  |
| `MINUTO` | const |  |
| `HORA` | const |  |
| `DIA` | const |  |

#### `src/nucleo/resultado.ts`

Resultado de una operación de dominio:

| exportación | tipo | descripción |
|---|---|---|
| `exito` | function |  |
| `fallo` | function |  |

#### `src/nucleo/textos.ts`

Localización (i18n) por CLAVE:

| exportación | tipo | descripción |
|---|---|---|
| `Textos` | class |  |

#### `src/nucleo/datos/bloques.ts`

Lector de un formato de datos de texto por bloques, cómodo para diseñadores:

| exportación | tipo | descripción |
|---|---|---|
| `Linea` | interface |  |
| `Bloque` | interface |  |
| `separar` | function | Cada clave guarda todas sus apariciones, en orden. */ readonly campos: ReadonlyMap<string, readonly (readonly string[])[]>; } export interface Documento { readonly bloques: readonly Bloque[]; readonly |
| `leerDocumento` | function |  |
| `texto` | function |  |
| `numero` | function |  |
| `todos` | function | Todas las apariciones de una clave repetida (por ejemplo `*BOTIN`). |
| `bloquesDe` | function |  |
| `sueltasDe` | function |  |

#### `src/nucleo/datos/tabla.ts`

Tabla de definiciones:

| exportación | tipo | descripción |
|---|---|---|
| `Tabla` | class |  |

#### `src/nucleo/escalado.ts`

Curvas de escalado como DATOS (serializables a JSON):

| exportación | tipo | descripción |
|---|---|---|
| `evaluar` | function | Valor fijo. */ \| { readonly tipo: "constante"; readonly valor: number } /** base + porNivel·(x − 1). */ \| { readonly tipo: "lineal"; readonly base: number; readonly porNivel: number } /** base·x^exp |
| `progreso` | const | Progreso 0..1 recortado (para mezclar tablas). |
| `mezclarTablas` | function | Mezcla dos tablas con un progreso 0..1 (rareza, composición de enemigos, precios...). |
| `muestrear` | function | Muestra una curva en [desde, hasta] (herramientas, gráficos, tests de balance). |
| `validarCurva` | function | Valida una curva leída de datos. Devuelve la lista de problemas (vacía = válida). |
| `curva` | const | Atajos para escribir curvas en código. |

#### `src/nucleo/vec3.ts`

Vectores 3D inmutables y utilidades de orientación (yaw/pitch, bases ortonormales, conos) para juegos 3D:

| exportación | tipo | descripción |
|---|---|---|
| `V3` | interface |  |
| `v3` | const |  |
| `vec3` | const |  |

### `motor`

`import { motor } from "ludokit"`

Usado por los modelos: `lucha-1v1`, `incremental`

#### `src/motor/animador.ts`

Animador de sprites por hojas:

| exportación | tipo | descripción |
|---|---|---|
| `Clip` | interface |  |
| `clipsDesdeAseprite` | function | Evento por índice de cuadro dentro del clip: { 2: "pisada", 4: "golpe" }. */ readonly eventos?: Readonly<Record<number, string>>; /** Clip al que pasa cuando termina (si no es bucle). */ readonly sigu |

#### `src/motor/bucle.ts`

Bucle de juego de paso fijo con interpolación ("Fix your timestep"):

| exportación | tipo | descripción |
|---|---|---|
| `Simulacion` | interface |  |
| `OpcionesBucle` | interface |  |
| `BucleFijo` | class |  |

#### `src/motor/camara.ts`

Cámara 2D:

| exportación | tipo | descripción |
|---|---|---|
| `OpcionesCamara` | interface |  |
| `Camara` | class |  |

#### `src/motor/consola.ts`

Consola de comandos de desarrollo (y panel de "trucos" para probar el juego sin pasarlo):

| exportación | tipo | descripción |
|---|---|---|
| `DefComando` | interface |  |
| `Consola` | class |  |

#### `src/motor/ecs.ts`

Entity-Component-System con conjuntos dispersos (sparse sets), la estructura de los ECS modernos:

| exportación | tipo | descripción |
|---|---|---|
| `indiceDe` | const |  |
| `generacionDe` | const |  |
| `TipoComponente` | interface | Clave tipada de un componente: `const Posicion = componente<{x:number,y:number}>("posicion")`. |
| `componente` | const |  |
| `MundoEcs` | class |  |

#### `src/motor/entrada.ts`

Entrada por ACCIONES (no por teclas):

| exportación | tipo | descripción |
|---|---|---|
| `MAPA_PLATAFORMAS` | const |  |
| `Entrada` | class |  |

#### `src/motor/fsm.ts`

Máquina de estados jerárquica (HSM):

| exportación | tipo | descripción |
|---|---|---|
| `Estado` | interface |  |
| `Transicion` | interface |  |
| `MaquinaEstados` | class |  |

#### `src/motor/pool.ts`

Pool de objetos:

| exportación | tipo | descripción |
|---|---|---|
| `Pool` | class |  |

#### `src/motor/tactil.ts`

Controles táctiles para móviles:

| exportación | tipo | descripción |
|---|---|---|
| `BotonTactil` | interface |  |
| `ControlesTactiles` | class |  |

#### `src/motor/tiempo.ts`

Tiempo de juego:

| exportación | tipo | descripción |
|---|---|---|
| `EASE` | const | Curvas de easing estándar (Penner). t en [0,1]. |
| `Cooldown` | class | Cooldown simple: listo cuando llega a 0. |
| `Agenda` | class | 0..1 de recarga (para la UI). */ get progreso(): number { return this.duracion <= 0 ? 1 : 1 - Math.max(0, this.restante) / this.duracion; } usar(): boolean { if (!this.listo) return false; this.restan |

### `espacial`

`import { espacial } from "ludokit"`

Usado por los modelos: `looter-shooter`, `shooter-arena`, `shooter-tactico`, `shooter-extraccion`, `supervivientes-hordas`, `disparos-naves`

#### `src/espacial/colision.ts`

Pruebas de colisión (narrowphase) con vector de separación mínimo (MTV), barrido continuo de AABB (sin túnel a alta velocidad), rayos contra cajas y círculos, y SAT para polígonos convexos.

| exportación | tipo | descripción |
|---|---|---|
| `Circulo` | interface |  |
| `Contacto` | interface | Resultado de una colisión: normal (de A hacia afuera de B... apuntando de B a A) y profundidad. |
| `aabbSolapa` | function |  |
| `aabbContacto` | function | MTV entre dos AABB: cuánto mover A (por el eje de menor penetración) para separarlas. |
| `circuloContacto` | function |  |
| `circuloCaja` | function |  |
| `rayoCaja` | function | Rayo vs AABB (slabs). Devuelve t en [0, tMax] del primer impacto y la normal, o null. |
| `barrerCaja` | function | Barrido continuo: caja A moviéndose (vx, vy) durante el paso contra caja quieta B (Minkowski + rayo). Devuelve la fracción del movimiento [0,1] hasta tocar y la normal. Evita que una bala rápida atrav |
| `rayoCirculo` | function |  |
| `satPoligonos` | function | SAT para polígonos convexos (vértices en orden). Normal de B hacia A. |
| `centroide` | function |  |
| `rectAPoligono` | function |  |

#### `src/espacial/hash-espacial.ts`

Hash espacial uniforme (broadphase):

| exportación | tipo | descripción |
|---|---|---|
| `Caja` | interface |  |
| `HashEspacial` | class |  |

#### `src/espacial/raycast-grilla.ts`

Raycast sobre una grilla de tiles con DDA (Amanatides & Woo):

| exportación | tipo | descripción |
|---|---|---|
| `ImpactoGrilla` | interface |  |
| `hayVision` | function | Distancia en px desde el origen. */ readonly distancia: number; readonly x: number; readonly y: number; /** Normal de la cara golpeada. */ readonly nx: number; readonly ny: number; } export function r |

#### `src/espacial/colision3d.ts`

Colisiones y rayos en 3D para shooters, ARPG 3D y cualquier juego con hitboxes volumétricas:

| exportación | tipo | descripción |
|---|---|---|
| `Rayo3D` | interface |  |
| `rayoCapsula3D` | function | Unitario. */ readonly dir: V3; readonly largo: number; } export interface Impacto3D { readonly t: number; readonly punto: V3; readonly normal: V3; } export function rayoEsfera3D(r: Rayo3D, centro: V3, |
| `rayoForma3D` | function |  |
| `distanciaSegmentos` | function | Distancia mínima entre dos segmentos (para cápsula-cápsula). |
| `solapan3D` | function | ¿Se tocan dos formas? (esfera/cápsula entre sí y contra cajas). |
| `Colisionador3D` | interface |  |
| `lanzarRayoTodos` | function | "mundo", "cabeza", "torso", "vehiculo"... la usa el juego para zonas de daño y materiales. */ readonly etiqueta?: string; /** Dueño (entidad) para ignorar al que dispara y agrupar zonas del mismo pers |
| `lanzarRayo` | function | El impacto más cercano o null. |
| `trasladar3D` | function | Desplaza una forma (para mover hitboxes con su entidad o rebobinar con compensación de lag). |

### `red`

`import { red } from "ludokit"`

Usado por los modelos: `mmo-tematico`, `mmo-accion`, `moba`, `arena-heroes`, `shooter-arena`, `shooter-tactico`, `shooter-extraccion`, `batalla-real`, `shooter-heroes`, `lucha-1v1`, `cartas-coleccionables`, `rts`, `cooperativo-mazmorras`, `mod-cooperativo`, `mod-competitivo`, `mod-mundo-persistente`

#### `src/red/delta.ts`

Compresión delta de estados:

| exportación | tipo | descripción |
|---|---|---|
| `Delta` | interface |  |
| `calcularDelta` | function |  |
| `aplicarDelta` | function |  |
| `deltaVacio` | const |  |
| `cuantizar` | const | Cuantiza un número a `pasos` por unidad (posición a 1/16 px: pasos = 16). |
| `HistorialBaselines` | class | Historial de estados enviados por tick, para hacer delta contra el último que el cliente confirmó. |

#### `src/red/interes.ts`

Gestión de interés (AOI, Area Of Interest) para MMO:

| exportación | tipo | descripción |
|---|---|---|
| `CambiosInteres` | interface |  |
| `GestorInteres` | class |  |

#### `src/red/netcode.ts`

Netcode de servidor autoritativo con predicción del lado del cliente (el modelo de los shooters y MMO modernos):

| exportación | tipo | descripción |
|---|---|---|
| `EntradaRed` | interface |  |
| `Snapshot` | interface |  |
| `PrediccionCliente` | class | Última entrada de ESTE cliente que el servidor ya aplicó. */ readonly ackSeq: number; /** Estado propio del jugador (autoritativo). */ readonly propio: S; /** Estado de las entidades visibles (área de |
| `BuferInterpolacion` | class | Error de la última reconciliación (para suavizar visualmente o para métricas). */ ultimoError = 0; private readonly distancia?: (a: S, b: S) => number; constructor(inicial: S, aplicar: (s: S, e: E, dt |
| `MundoServidor` | interface | Estado para dibujar en el tiempo `ahora` (del servidor). Extrapola poco si faltan datos (se queda en el último). */ muestrear(ahora: number): S \| null { const m = this.muestras; if (m.length === 0) r |
| `ServidorAutoritativo` | class |  |

#### `src/red/paquetes.ts`

Protocolo binario little-endian para juegos en red:

| exportación | tipo | descripción |
|---|---|---|
| `EscritorPaquete` | class |  |
| `ErrorLectura` | class |  |
| `LectorPaquete` | class |  |
| `enmarcar` | function | Arma una trama: [u16 largo total][cuerpo]. |
| `ExtractorTramas` | class | TCP no respeta los límites de los paquetes: un `recv` puede traer media trama o tres juntas. Este acumulador (como Session.EndReceive) junta bytes y devuelve solo tramas completas. |
| `Despachador` | class | Despachador por número de paquete. Reemplaza el `switch` de ~120 casos de GameClient.OnPacket. Lección de la auditoría: un error dentro de un manejador desconectaba al jugador; acá se registra y sigue |

#### `src/red/simulacion-red.ts`

Red simulada con latencia, variación (jitter), pérdida y duplicados, sobre un reloj de simulación.

| exportación | tipo | descripción |
|---|---|---|
| `CondicionesRed` | interface |  |
| `RED_LOCAL` | const |  |
| `RED_BUENA` | const |  |
| `RED_MALA` | const |  |
| `CanalSimulado` | class |  |

#### `src/red/utilidades-red.ts`

Piezas de soporte del netcode:

| exportación | tipo | descripción |
|---|---|---|
| `RelojSincronizado` | class | Estima el desfase de reloj con el servidor a partir de pings: offset = ((t1 − t0) + (t2 − t3)) / 2. |
| `HistorialPosiciones` | class | t0: envío cliente · t1: recepción servidor · t2: envío servidor · t3: recepción cliente. */ muestra(t0: number, t1: number, t2: number, t3: number): void { const rtt = t3 - t0 - (t2 - t1); const offse |
| `LimitadorTasa` | class | Posición interpolada de `id` en el tiempo `t` (null si está fuera de la ventana). */ en(id: string, t: number): { x: number; y: number } \| null { const l = this.datos.get(id); if (!l \|\| l.length == |

#### `src/red/compensacion-lag.ts`

Compensación de lag en 3D (la versión 2D es `HistorialPosiciones` en utilidades-red) para shooters y juegos de acción en red:

| exportación | tipo | descripción |
|---|---|---|
| `HistorialPosiciones3D` | class |  |
| `rebobinar` | function | Segundos de historial que se guardan. */ readonly ventana: number; constructor(ventana = 1) { this.ventana = ventana; } registrar(entidad: number, t: number, pos: V3): void { let h = this.hist.get(ent |
| `tiempoVistoPorCliente` | const | Tiempo que veía el cliente: hora del servidor − latencia de ida − retraso de interpolación. |

### `grafico`

`import { grafico } from "ludokit"`

#### `src/grafico/atlas.ts`

Empaquetador de atlas por "skyline" (línea de horizonte):

| exportación | tipo | descripción |
|---|---|---|
| `Region` | interface |  |
| `EmpaquetadorAtlas` | class |  |
| `empaquetar` | function | Coloca un rectángulo; null si no entra. */ colocar(nombre: string, w: number, h: number): Region \| null { const W = w + this.margen, H = h + this.margen; let mejorY = Infinity, mejorI = -1, mejorX =  |

#### `src/grafico/color.ts`

Color:

| exportación | tipo | descripción |
|---|---|---|
| `hexARgb` | const |  |
| `rgbAHex` | const |  |
| `aOklab` | function |  |
| `desdeOklab` | function |  |
| `mezclarOklab` | const | Mezcla perceptual (los degradados no pasan por grises sucios). |
| `Paleta` | class | Paleta precalculada en OKLab para buscar el color más cercano rápido. |
| `Gradacion` | interface |  |
| `aplicarGradacion` | function | 0..1: cuánto se acerca cada color al de la paleta (1 = todo en paleta). */ readonly mezclaPaleta?: number; } export const GRADACION_NEUTRA: Gradacion = { sombras: [1, 1, 1], medios: [1, 1, 1], luces:  |
| `hornearLut` | function | Hornea la LUT 3D (lado³) en una tira (lado² × lado) RGBA8. |

#### `src/grafico/curvas.ts`

Curvas para estelas (tajos de espada, hechizos, rastros de proyectiles) y trayectorias de cámara o UI:

| exportación | tipo | descripción |
|---|---|---|
| `catmullRom` | function | Punto entre p1 y p2 (t 0..1) de la Catmull-Rom centrípeta definida por p0..p3. |
| `suavizar` | function | Curva suave que pasa por todos los puntos (extremos con puntos fantasma reflejados). |
| `bezier2` | const |  |
| `bezier3` | const |  |
| `Tramo` | interface |  |
| `cinta` | function | Estela tipo cinta a partir de nodos (base, punta) del arma en los últimos cuadros. |
| `largoPolilinea` | const | Largo aproximado de una polilínea. |

#### `src/grafico/fuente-pixel.ts`

Fuente pixel de 3×5 guardada en bits (15 bits por glifo, fila por fila de arriba a abajo) para números de daño, contadores y HUD a resolución lógica:

| exportación | tipo | descripción |
|---|---|---|
| `GLIFOS_3X5` | const |  |
| `pixelGlifo` | const | ¿El píxel (cx, cy) del glifo está encendido? (cx 0..2, cy 0..4). |
| `anchoTexto` | function |  |
| `dibujarTexto` | function | Dibuja texto en una imagen con contorno opcional de 1 px (legible sobre cualquier fondo). |
| `TextosFlotantes` | class | Textos flotantes (números de daño, "+50", "¡CRÍTICO!") en arreglos paralelos. |

#### `src/grafico/imagen.ts`

Imagen RGBA8 en memoria (compatible con ImageData del navegador, con texturas de cualquier motor y con PNG decodificados) y operaciones pixel-perfect:

| exportación | tipo | descripción |
|---|---|---|
| `Imagen` | interface |  |
| `desdeAscii` | function | RGBA8, fila por fila. */ readonly datos: Uint8ClampedArray; } export const crearImagen = (w: number, h: number): Imagen => ({ w, h, datos: new Uint8ClampedArray(w * h * 4) }); export function leer(im: |
| `escalarVecino` | function | Reescalado por vecino más cercano a un tamaño exacto (rehacer UNA vez a su tamaño real en píxeles). |
| `alfaBinaria` | function | Alfa binaria: ≥ umbral queda opaco, el resto se borra (bordes limpios a escala entera). |
| `contornear` | function | Contorno de 1 px por fuera de la silueta (4-vecinos). Agranda la imagen 1 px por lado. |
| `silueta` | function | Silueta blanca (mismo alfa): para el destello de un golpe. |
| `cajaVisible` | function | Caja de lo visible (alfa > 0), o null si está vacía. |
| `recortar` | function |  |
| `colorDeContorno` | function | Color de contorno de un dibujo: el color más común entre los píxeles opacos que tocan el aire. |
| `reescalarSprite` | function | Reescalado pixel-perfect de un sprite a un alto dado conservando su contorno original. |
| `girarTono` | function | Variante de color: gira el tono (grados) y escala saturación y brillo, en HSV. |

#### `src/grafico/normales.ts`

Mapas de normales automáticos a partir del arte (para luz 2D con relieve sin dibujar normales a mano):

| exportación | tipo | descripción |
|---|---|---|
| `alturas` | function |  |
| `mapaNormales` | function |  |

#### `src/grafico/parallax.ts`

Fondos con parallax:

| exportación | tipo | descripción |
|---|---|---|
| `CapaParallax` | interface |  |
| `PosicionCapa` | interface |  |
| `posicionesParallax` | function |  |

#### `src/grafico/png.ts`

Codificador PNG puro (sin dependencias, funciona en Node, navegador y servidor):

| exportación | tipo | descripción |
|---|---|---|
| `crc32` | function |  |
| `codificarPng` | function |  |

### `animacion`

`import { animacion } from "ludokit"`

Usado por los modelos: `hack-and-slash`

#### `src/animacion/esqueleto.ts`

Esqueleto humanoide procedural de 21 puntos con cinemática inversa (IK):

| exportación | tipo | descripción |
|---|---|---|
| `ik2Huesos` | function | IK analítica de dos huesos (brazo, pierna, cola de 2 segmentos): desde la raíz `a` hacia `objetivo` con largos L1, L2; la articulación se dobla hacia `polo` (codo atrás, rodilla adelante). Si no alcan |
| `ik2Huesos2D` | function | IK 2D (sprites planos): `doblez` +1 o −1 elige hacia qué lado se dobla la articulación. |
| `Medidas` | interface |  |
| `MEDIDAS_24PX` | const | Medidas para un personaje de ~24 px de alto (escalar con `escalarMedidas`). |
| `escalarMedidas` | const |  |
| `Pose` | interface |  |
| `resolverEsqueleto` | function | Desplazamiento de la cadera (x) y agachado (px hacia abajo). */ readonly x?: number; readonly agachar?: number; /** Inclinación del torso (rad, + hacia adelante) y giro sobre el eje vertical (rad, + m |
| `HUESOS` | const | Huesos para dibujar (pares de articulaciones), ordenados de atrás hacia adelante por profundidad media. |
| `huesosPorProfundidad` | function |  |
| `mezclarPoses` | function |  |
| `ClavePose` | type | Clave de una pista: tiempo, pose y si se salta de golpe ("snap": golpe que llega sin transición). |
| `poseEn` | function | Pose en el tiempo `t` de una pista de claves. `fps` > 0 cuantiza el tiempo a escalones (12 fps da el aspecto de animación dibujada a mano mientras las partículas corren a tasa completa). |

### `audio`

`import { audio } from "ludokit"`

Usado por los modelos: `carreras-arcade`, `carreras-simulacion`

#### `src/contextos/audio/dominio/musica.ts`

Música adaptativa por CAPAS (no por pistas):

| exportación | tipo | descripción |
|---|---|---|
| `ESCALAS` | const |  |
| `IdentidadMusical` | interface |  |
| `grado` | function | Tónica en número MIDI (45 = La2). */ readonly tonica: number; readonly tempo: number; /** Grados de la escala (0 = tónica). */ readonly motivo: readonly number[]; /** Grado de la escala de cada compás |
| `transformarMotivo` | const | Transformaciones clásicas de un motivo. |
| `EstadoJuegoMusica` | interface |  |
| `mezclaPara` | function | 0..1 (por ejemplo del medidor de estilo). */ readonly energia: number; /** 0 sano … 1 al borde de la muerte. */ readonly peligro: number; readonly tension?: boolean; readonly frenesi?: boolean; } expo |
| `DirectorMusical` | class | Director: aplica el estado nuevo al empezar el compás siguiente y emite las notas de cada compás. |

#### `src/contextos/audio/dominio/sintesis.ts`

Síntesis procedural de efectos de sonido:

| exportación | tipo | descripción |
|---|---|---|
| `OpcionesRender` | interface |  |
| `renderizar` | function | Frecuencia de muestreo (Hz). 22050 alcanza para efectos y ahorra memoria. */ readonly fs?: number; /** Multiplica todas las frecuencias (variantes con desafinación). */ readonly afinacion?: number; re |
| `saturar` | function | Saturación suave normalizada (tanh): calidez sin aplastar el transitorio. Una señal de 1 sale a ~0,92. |
| `aWav` | function | PCM flotante → archivo WAV de 16 bits mono (bytes listos para guardar o para `new Blob([...])`). |
| `Material` | interface |  |
| `FUERZAS` | const | Cola FM: frecuencia, ratio (no entero = inarmónico), índice, duración y volumen. f = 0 sin cola tonal. */ readonly f: number; readonly ratio: number; readonly indice: number; readonly cola: number; re |
| `recetaImpacto` | function | Receta de un impacto contra un material, con 3 fuerzas. |
| `recetaRareza` | function | Sonido de botín según rareza (0..7): arpegio por una pentatónica lidia desde C5 con 2 + rareza notas, que "respira" (micro-variación de tempo), FM más profunda e inarmónica con la rareza; acorde desde |
| `recetaCorte` | const | Corte de arma: barrido de ruido que sube (silbido) + transitorio. |
| `BancoSonidos` | class | Banco de sonidos con VARIANTES: cada receta se renderiza N veces con desafinación ±1,5 % y ruido distinto (semilla fija por variante), nunca se toca la misma variante dos veces seguidas, y el mismo so |

### `balance`

`import { balance } from "ludokit"`

Usado por los modelos: `arpg-botin`, `arpg-temporadas`, `looter-shooter`, `mundo-abierto-rpg`, `mod-infinito`

#### `src/contextos/balance/dominio/grados.ts`

Grados de un enemigo:

| exportación | tipo | descripción |
|---|---|---|
| `Grado` | interface |  |
| `gradosEnemigo` | function | Índice de la tabla de botín de este grado. */ readonly tablaBotin: number; /** Moneda [mín, máx] y probabilidad de soltarla. */ readonly moneda: readonly [number, number, number]; } /** `nivelBase`: n |
| `gradoParaNivel` | function | El grado que corresponde a un nivel de zona (el más alto que no lo supera). |
| `tonoDeGrado` | const | Giro de tono sugerido por grado (para variantes de color repartidas en la rueda). |

#### `src/contextos/balance/dominio/poder-esperado.ts`

Balance por PODER ESPERADO:

| exportación | tipo | descripción |
|---|---|---|
| `CurvaPoder` | interface |  |
| `ModeloBalance` | class | Resistencia 0..1 a todo (recortar con `curva.limitar`). */ readonly resistencia: Curva; } export interface Poder { readonly golpe: number; readonly vida: number; readonly defensa: number; readonly res |
| `veredicto` | function | Fracción del daño enemigo que le llega al jugador típico de ese nivel. */ pasaAlJugador(nivel: number): number { const pe = this.poder(nivel); return mitigacionBalance(pe.defensa, this.kJugador(nivel) |
| `Peleador` | interface |  |
| `simularPelea` | function | Golpes por segundo. */ readonly ritmo: number; } /** Simulación "en números" sin azar: cuántos golpes y segundos tarda cada uno en caer. |

#### `src/contextos/balance/dominio/dificultad.ts`

Dificultad SIN TOPE y escalado al jugador:

| exportación | tipo | descripción |
|---|---|---|
| `ReglasNivelesDificultad` | interface |  |
| `escalarAlJugador` | function | Tiempo objetivo (s) para completar. */ readonly tiempo: Curva; /** [fracción de tiempo sobrante mínima, niveles que sube] de mayor a menor; fallar = `alFallar`. */ readonly ascenso: ReadonlyArray<read |
| `escalarPorJugadores` | function | Multiplicadores por cantidad de jugadores (cooperativo): curvas sobre n = jugadores. |
| `DificultadAdaptativa` | class | Dificultad adaptativa: mantiene un multiplicador en [min, max] que sube cuando al jugador le va bien y baja cuando muere seguido. Nunca cambia de golpe (paso máximo por evento). |

### `botin`

`import { botin } from "ludokit"`

Usado por los modelos: `arpg-botin`, `arpg-temporadas`, `looter-shooter`, `mmo-tematico`, `batalla-real`, `roguelite-accion`, `cooperativo-mazmorras`

#### `src/contextos/botin/dominio/conjuntos.ts`

Conjuntos de equipo (set bonuses):

| exportación | tipo | descripción |
|---|---|---|
| `BonoConjunto` | interface |  |
| `estadoConjuntos` | function | Efectos con nombre para el juego: { ondaAlPatear: 1, explotaAlMorir: 1 }. */ readonly efectos?: Readonly<Record<string, number>>; } export interface DefConjunto { readonly id: string; readonly nombre: |
| `modificadoresConjuntos` | function | Modificadores de todos los bonos activos (fuente = "conjunto:id:piezas", para quitarlos al cambiar equipo). |
| `efectosConjuntos` | function | Efectos con nombre activos, sumados. |
| `Runa` | interface |  |
| `Engarces` | class |  |
| `COSTO_FUSION_RUNAS` | const | Tipos permitidos por ranura (null = cualquiera). */ readonly tipos: (string \| null)[]; constructor(cantidad: number, tipos: (string \| null)[] = []) { this.ranuras = Array(cantidad).fill(null); this. |
| `fundirRunas` | function | Tres runas iguales (mismo tipo y rareza) → una de rareza + 1. |

#### `src/contextos/botin/dominio/drops.ts`

Tablas de botín.

| exportación | tipo | descripción |
|---|---|---|
| `tirarDrop` | function |  |
| `probabilidadReal` | function | Probabilidad real de que salga cada objeto en una muerte (para equilibrar y para mostrar al jugador). |
| `tablaPorNivel` | function | Elige la tabla según el nivel: rangos [nivel máximo, tabla] ordenados; si se pasa del último, `defecto`. |

#### `src/contextos/botin/dominio/equipo.ts`

Generador de equipo para juegos de botín (ARPG, looter, RPG):

| exportación | tipo | descripción |
|---|---|---|
| `DefClase` | interface |  |
| `generarPieza` | function | Stat principal → valor por nivel de escala. */ readonly principal: Readonly<Record<string, number>>; /** Stats que pueden salir como afijo (valor por nivel de escala). */ readonly afijos: Readonly<Rec |
| `perfeccion` | const | Perfección 0..1 (media de las tiradas): con tiradaMin 0,5 una pieza perfecta rinde ~2× una mala. |
| `mejorarPieza` | function | Mejora +1: cada stat × multMejora (al menos +1 en los enteros). Devuelve una pieza nueva. |
| `costoMejora` | const |  |
| `valorDesguace` | const |  |
| `puntaje` | function | Puntaje para comparar dos piezas con un peso por stat definido por el juego (o 1). |

#### `src/contextos/botin/dominio/fichas.ts`

Botín por FICHAS:

| exportación | tipo | descripción |
|---|---|---|
| `ContextoBotin` | interface |  |
| `soltarBotin` | function | Multiplicador global de probabilidad (eventos, dificultad). */ readonly mult: number; } export interface TablaFichas { readonly modo: ModoDrop; /** [ficha, probabilidad o peso] */ readonly entradas: R |

#### `src/contextos/botin/dominio/rareza.ts`

Rareza por nivel SIN TOPE:

| exportación | tipo | descripción |
|---|---|---|
| `TablaRarezaNivel` | interface |  |
| `pesosRareza` | function | Pesos en el nivel 1. */ readonly primero: readonly number[]; /** Pesos hacia los que tiende la tabla. */ readonly ultimo: readonly number[]; /** Progreso 0..1 según el nivel (p. ej. `curva.saturacion( |
| `probabilidadesRareza` | function | Porcentajes visibles (para mostrar al jugador y para herramientas de diseño). |
| `tirarRareza` | function | Tira una rareza. `suerte`: inclina la tabla (+inclinación por escalón cada 100 puntos). `minima`: eleva lo que salga por debajo. `multMax`: multiplica el peso de la rareza máxima (eventos, modo difíci |
| `validarTablaRareza` | function | Valida una tabla leída de datos. |

### `coleccion`

`import { coleccion } from "ludokit"`

Usado por los modelos: `cartas-coleccionables`, `gacha`

#### `src/contextos/coleccion/dominio/cartas.ts`

Colección tipo gacha:

| exportación | tipo | descripción |
|---|---|---|
| `TablaRareza` | type | Tabla acumulada [nivel, probabilidad]. |
| `tirarRareza` | function |  |
| `probabilidadesVisibles` | function | Probabilidad de salir con una tabla acumulada (para mostrarla al jugador, obligatorio en muchos países). |
| `CartaBase` | interface |  |
| `ReglasFusion` | interface |  |
| `fusionar` | function | Probabilidad (0~1) de subir desde ese nivel para ese tipo. Sin dato = 1 (siempre). */ readonly probabilidad: (tipo: number, nivel: number) => number \| undefined; readonly nivelMaximo: number; /** Per |
| `probabilidadDesdeCurva` | const | Probabilidad de subir al fusionar desde una curva (nivel → 0..1): sirve para cualquier cantidad de niveles. |
| `costoFusion` | const | Costo de fusionar según el nivel de las cartas, desde una curva (normalmente exponencial). |
| `mejorar` | function | Suma el mismo incremento a todos los stats sin pasar `maximos`. `tabla`: incrementos posibles con su probabilidad (p. ej. [[1, 0.5], [2, 0.35], [3, 0.15]]). Falla si ya están todos al máximo (y el obj |
| `generarStats` | function | Stats de una carta nueva: cada uno al azar entre el mínimo y el máximo de su nivel. |

#### `src/contextos/coleccion/dominio/herencia.ts`

Herencia de rasgos al FUSIONAR (cartas, mascotas, armas, criaturas que se combinan).

| exportación | tipo | descripción |
|---|---|---|
| `DefRasgo` | interface |  |
| `probMutacion` | function | Peso de aparición base (1 por defecto). */ readonly peso?: number; /** Excluido de los sorteos (rasgos especiales que solo trae algo concreto). */ readonly especial?: boolean; } export interface Regla |
| `ResultadoHerencia` | interface |  |
| `heredarRasgos` | function | Rasgos del resultado de fusionar `entradas` (listas de rasgos de cada pieza). `propios`: los que ya trae la pieza nueva (llenan huecos). `nivel`: nivel del resultado. |

#### `src/contextos/coleccion/dominio/piedad.ts`

Piedad (pity) para cajas aleatorias:

| exportación | tipo | descripción |
|---|---|---|
| `DefCaja` | interface |  |
| `abrirConPiedad` | function | Nivel mínimo de la caja y probabilidades por nivel desde ese mínimo. */ readonly minimo: number; readonly prob: readonly number[]; readonly umbral?: { readonly aperturas: number; readonly nivel: numbe |
| `textoProbabilidades` | const | Texto de probabilidades para mostrar: "6★ 48 % · 7★ 28 % · …". |

### `combate`

`import { combate } from "ludokit"`

Usado por los modelos: `arpg-botin`, `arpg-temporadas`, `looter-shooter`, `hack-and-slash`, `souls`, `mmo-tematico`, `mmo-accion`, `moba`, `arena-heroes`, `shooter-heroes`, `guerra-zombis`, `supervivencia-sandbox`, `roguelite-accion`, `roguelike-turnos`, `metroidvania`, `lucha-plataformas`, `lucha-1v1`, `jrpg`, `tactico-grilla`, `mazo-roguelike`, `rts`, `defensa-torres`, `sigilo`, `mundo-abierto-rpg`, `cooperativo-mazmorras`

#### `src/contextos/combate/dominio/afijos.ts`

Afijos de desafío (modificadores de dificultad por nivel):

| exportación | tipo | descripción |
|---|---|---|
| `DefAfijo` | interface |  |
| `escalaDesafio` | const | Nivel desde el que puede salir. */ readonly desde: number; readonly mods?: Readonly<Record<string, number>>; } /** Escala de vida y daño de los enemigos por nivel de desafío: una `Curva` (lineal, expo |
| `sortearAfijos` | function | Afijos de una sala para un nivel: sin repetir, deterministas por semilla. |
| `tiempoDesafio` | const | Contrarreloj: tiempo total = base + oleadas × porOleada(nivel). |
| `cambioDeNivel` | function | Cambio del nivel según la fracción de tiempo sobrante. `escalones`: [fracción mínima, cambio] de mayor a menor (p. ej. [[0.4, 3], [0.2, 2], [0, 1]]); terminar tarde da `tarde` (p. ej. −1). |

#### `src/contextos/combate/dominio/amenaza.ts`

Tabla de amenaza (aggro), el corazón del PvE en grupo:

| exportación | tipo | descripción |
|---|---|---|
| `OpcionesAmenaza` | interface |  |
| `TablaAmenaza` | class |  |

#### `src/contextos/combate/dominio/atributos.ts`

Atributos con modificadores (el sistema de stats de los RPG modernos):

| exportación | tipo | descripción |
|---|---|---|
| `Modificador` | interface |  |
| `Recurso` | class | Quién lo puso (id del objeto, del buff, del talento): para quitarlo junto. */ readonly fuente: string; readonly prioridad?: number; } export interface LimitesAtributo { readonly min?: number; readonly |

#### `src/contextos/combate/dominio/buffs.ts`

Buffs temporales:

| exportación | tipo | descripción |
|---|---|---|
| `DefinicionBuff` | interface |  |
| `BuffActivo` | interface |  |
| `BuffGuardado` | interface |  |
| `GestorBuffs` | class |  |

#### `src/contextos/combate/dominio/danio.ts`

Cálculo de daño con tipos y resistencias, en un orden documentado (el orden importa tanto como los números):

| exportación | tipo | descripción |
|---|---|---|
| `Golpe` | interface |  |
| `danioEsperado` | function | Ignora defensa (daño verdadero). */ readonly verdadero?: boolean; } export interface Defensor { readonly defensa?: number; readonly resistencias?: Readonly<Record<string, number>>; readonly reduccion? |
| `RoboDeVida` | class | Robo de vida desde una reserva por segundo (evita que combinar robo vuelva inmortal al jugador). |

#### `src/contextos/combate/dominio/estados.ts`

Efectos de estado con ticks:

| exportación | tipo | descripción |
|---|---|---|
| `DefEstado` | interface |  |
| `TickEstado` | interface |  |
| `GestorEstados` | class |  |

#### `src/contextos/combate/dominio/estilo.ts`

Medidor de estilo / combo (D → SSS):

| exportación | tipo | descripción |
|---|---|---|
| `RangoEstilo` | interface |  |
| `RANGOS_ESTILO` | const |  |
| `PUNTOS_ESTILO` | const |  |
| `MedidorEstilo` | class |  |

#### `src/contextos/combate/dominio/habilidades.ts`

Sistema de habilidades (al estilo de los sistemas de habilidades de los motores AAA, simplificado):

| exportación | tipo | descripción |
|---|---|---|
| `DefHabilidad` | interface |  |
| `UsuarioHabilidades` | interface |  |
| `Habilidades` | class |  |

#### `src/contextos/combate/dominio/stats.ts`

Composición de stats por capas:

| exportación | tipo | descripción |
|---|---|---|
| `componerStats` | function |  |
| `desglose` | function | Desglose por capa de un stat (para tooltips: "Golpe 540 = 200 base + 310 carta + 30 equipo"). |

#### `src/contextos/combate/dominio/lanzamiento.ts`

Lanzamiento de habilidades estilo MMO/MOBA/ARPG:

| exportación | tipo | descripción |
|---|---|---|
| `DefLanzamiento` | interface |  |
| `ReglasLanzamiento` | interface |  |
| `Lanzador` | class |  |

#### `src/contextos/combate/dominio/recursos.ts`

Modelos de RECURSO de los géneros más comunes.

| exportación | tipo | descripción |
|---|---|---|
| `Recursable` | interface |  |
| `DefRegenerativo` | interface |  |
| `Cargas` | class | Segundos sin gastar antes de volver a regenerar. */ readonly pausaTrasGasto?: number; } export class RecursoRegenerativo implements Recursable { actual: number; max: number; readonly def: DefRegenerat |

#### `src/contextos/combate/dominio/control.ts`

Control de masas (CC) con RENDIMIENTOS DECRECIENTES y TENACIDAD, y selección de OBJETIVO.

| exportación | tipo | descripción |
|---|---|---|
| `ReglasRendimiento` | interface |  |
| `elegirObjetivo` | function | Multiplicador de duración por aplicación seguida: [1, 0.5, 0.25] → la 4.ª es inmune. */ readonly escalones: readonly number[]; /** Segundos sin recibir esa categoría para reiniciar. */ readonly reinic |
| `tabObjetivo` | function | Tab-target: candidatos dentro del cono de la mirada (`dir` en radianes, `cono` semiapertura) ordenados por distancia; `previo` hace ciclar al siguiente. |

### `competitivo`

`import { competitivo } from "ludokit"`

Usado por los modelos: `arpg-temporadas`, `mmo-tematico`, `mmo-accion`, `moba`, `arena-heroes`, `shooter-arena`, `shooter-tactico`, `batalla-real`, `shooter-heroes`, `lucha-plataformas`, `lucha-1v1`, `cartas-coleccionables`, `carreras-arcade`, `combate-vehicular`, `mod-competitivo`

#### `src/contextos/competitivo/dominio/ranking.ts`

Ranking y temporadas:

| exportación | tipo | descripción |
|---|---|---|
| `Puesto` | interface |  |
| `esperadoElo` | function | 1 = primero. Empates comparten puesto (1, 2, 2, 4). */ readonly puesto: number; } export interface PremioPuesto<P> { /** Puesto máximo que cubre (1 = solo el primero, 10 = del puesto anterior hasta el |
| `actualizarElo` | function | Nuevo Elo de A y B. `resultado` = 1 gana A, 0 gana B, 0.5 empate. |

#### `src/contextos/competitivo/dominio/salas.ts`

Salas y emparejamiento:

| exportación | tipo | descripción |
|---|---|---|
| `Participante` | interface |  |
| `OpcionesSala` | interface |  |
| `nivelPromedio` | function | Cada equipo pertenece a un gremio (guerra de gremios). */ readonly porGremio?: boolean; } export type ErrorSala = \| "llena" \| "clave" \| "nivel" \| "ya-esta" \| "no-esta" \| "no-es-anfitrion" \| "gr |
| `EnCola` | interface |  |
| `Emparejador` | class | Cola de emparejamiento por Elo. La ventana aceptada crece con la espera: al principio solo rivales parecidos, después de un rato cualquiera (si no, a horas con poca gente nadie juega nunca). |
| `repartirEquipos` | function | Arma todas las partidas posibles; el que más espera tiene prioridad. */ emparejar(ahora: number): EnCola[][] { const partidas: EnCola[][] = []; const pendientes = [...this.cola].sort((a, b) => a.desde |

#### `src/contextos/competitivo/dominio/torneo.ts`

Torneo de eliminación directa:

| exportación | tipo | descripción |
|---|---|---|
| `Inscripto` | interface |  |
| `Cruce` | interface |  |
| `ordenSiembra` | function | Orden de siembra estándar para n (potencia de 2): 1 vs n, 2 vs n−1… en lados opuestos del cuadro. |
| `Torneo` | class |  |
| `premioRonda` | const | Cruces listos para jugarse (los dos lados definidos y sin ganador). */ pendientes(): Cruce[] { return this.rondas.flat().filter((c) => c.a !== null && c.b !== null && c.ganador === null); } private av |
| `TIEMPOS_TORNEO` | const | Tiempos por estado de un torneo automático (segundos). |

#### `src/contextos/competitivo/dominio/modos.ts`

Modos de juego competitivos y cooperativos (shooters, MOBA, arenas, battle royale):

| exportación | tipo | descripción |
|---|---|---|
| `ReglasCaptura` | interface |  |
| `PuntoCaptura` | class | Progreso por segundo con 1 jugador, extra por jugador adicional y máximo de jugadores que cuentan. */ readonly ritmo: number; readonly porExtra: number; readonly maxContados: number; /** Progreso que  |
| `Marcador` | class |  |
| `Reapariciones` | class | Tickets: quita `n` a un equipo; con 0 gana el otro (si son dos). */ restar(equipo: string, n: number): string \| null { if (this.ganador) return this.ganador; const v = Math.max(0, (this.puntos.get(eq |

### `economia`

`import { economia } from "ludokit"`

Usado por los modelos: `arpg-botin`, `mmo-tematico`, `mmo-accion`, `moba`, `shooter-tactico`, `shooter-extraccion`, `supervivencia-sandbox`, `extraccion-2d`, `jrpg`, `cartas-coleccionables`, `gacha`, `colonia`, `incremental`, `mundo-abierto-rpg`, `granja-vida`, `mod-mundo-persistente`

#### `src/contextos/economia/dominio/billetera.ts`

Billetera multi-moneda y medios de pago.

| exportación | tipo | descripción |
|---|---|---|
| `Billetera` | class |  |
| `MedioDePago` | interface |  |
| `pagoConBilletera` | function |  |
| `pagoConObjeto` | function | Un objeto del inventario usado como moneda (fichas, medallas, tickets). |

#### `src/contextos/economia/dominio/comercio.ts`

Intercambio entre dos jugadores:

| exportación | tipo | descripción |
|---|---|---|
| `Participante` | interface |  |
| `OpcionesComercio` | interface |  |
| `Comercio` | class |  |

#### `src/contextos/economia/dominio/crafteo.ts`

Crafteo y templado:

| exportación | tipo | descripción |
|---|---|---|
| `Receta` | interface |  |
| `faltantes` | function | Objeto que da (si es equipo generado, el juego lo resuelve con `resolverEquipo`). */ readonly resultado: { readonly objeto: number; readonly cantidad: number } \| { readonly equipo: string }; readonly |
| `vecesPosibles` | function | Cuántas veces se puede craftear con lo que hay. |
| `craftear` | function |  |
| `Pacto` | interface |  |
| `ReglasTemplado` | interface |  |
| `costoTemplado` | function | Grado máximo (Infinity = sin tope). */ readonly maximo: number; /** Desde este nivel se elige modo (antes, siempre "normal"). */ readonly nivelEleccion: number; /** Materiales y moneda del siguiente g |
| `templar` | function | Templar: siempre sube. En modo riesgo sella un pacto que la pieza aún no tenga. |
| `sumarPactos` | function | Suma bonos y maldiciones de una lista de pactos (`atenuar`: multiplicadores de bono y maldición). |

#### `src/contextos/economia/dominio/subasta.ts`

Casa de subastas a precio fijo, con vencimiento, límite de publicaciones por jugador y paginado.

| exportación | tipo | descripción |
|---|---|---|
| `Publicacion` | interface |  |
| `OpcionesSubasta` | interface |  |
| `CasaDeSubastas` | class |  |

#### `src/contextos/economia/dominio/tienda.ts`

Tienda con catálogo único.

| exportación | tipo | descripción |
|---|---|---|
| `Articulo` | interface |  |
| `Catalogo` | class |  |
| `PedidoCompra` | interface |  |
| `Compra` | interface |  |
| `comprar` | function |  |

#### `src/contextos/economia/dominio/venta.ts`

Venta a un comerciante:

| exportación | tipo | descripción |
|---|---|---|
| `DatosVenta` | interface |  |
| `precioDeVenta` | function | Precio del objeto en la tienda NPC. */ readonly precio: number; readonly vendible: boolean; /** Objetos con vencimiento no se venden. */ readonly temporal?: boolean; /** Cuántas unidades forman el "lo |

#### `src/contextos/economia/aplicacion/comprar.ts`

Caso de uso:

| exportación | tipo | descripción |
|---|---|---|
| `Jugador` | interface |  |
| `Movimiento` | interface |  |
| `RepositorioJugadores` | interface |  |
| `LibroContable` | interface |  |
| `UnidadDeTrabajo` | interface |  |
| `MemoriaEconomia` | class | Ejecuta `f` en una transacción: si lanza, nada se guarda. */ transaccion<T>(f: (repos: { jugadores: RepositorioJugadores; libro: LibroContable }) => Promise<T>): Promise<T>; } export interface Depende |

#### `src/contextos/economia/aplicacion/compras-reales.ts`

Compras con dinero real (IAP) y anuncios con recompensa, como CASOS DE USO con PUERTOS (la tienda de aplicaciones, el SDK de anuncios y el almacenamiento son adaptadores que implementa el juego).

| exportación | tipo | descripción |
|---|---|---|
| `ProductoReal` | interface |  |
| `PuertoTienda` | interface | Qué entrega: monedas, objetos, suscripción (días). */ readonly entrega: ReadonlyArray<{ readonly tipo: "moneda"; readonly moneda: string; readonly cantidad: number } \| { readonly tipo: "objeto"; read |
| `RepositorioCompras` | interface | Puerto de persistencia: transacciones ya acreditadas y permanentes de cada cuenta. |
| `ComprasEnMemoria` | class | Registra y entrega en UNA transacción (todo o nada). */ acreditar(cuenta: string, transaccion: string, producto: ProductoReal): Promise<void>; } export type ErrorCompraReal = "recibo-invalido" \| "rev |
| `ReglasAnuncios` | interface |  |
| `AnunciosConRecompensa` | class | Segundos mínimos entre anuncios. */ readonly espera: number; /** Duración del "día" en ms y desplazamiento del reinicio (p. ej. medianoche del servidor). */ readonly dia: number; readonly origen: numb |

### `encuentros`

`import { encuentros } from "ludokit"`

Usado por los modelos: `arpg-botin`, `arpg-temporadas`, `hack-and-slash`, `souls`, `shooter-coberturas`, `hordas-zombis`, `guerra-zombis`, `supervivencia-zombi`, `roguelite-accion`, `supervivientes-hordas`, `metroidvania`, `defensa-torres`, `defensa-laberinto`, `terror-supervivencia`, `cooperativo-mazmorras`, `disparos-naves`, `mod-zombis`

#### `src/contextos/encuentros/dominio/jefe.ts`

Jefe configurable por datos:

| exportación | tipo | descripción |
|---|---|---|
| `AtaqueJefe` | interface |  |
| `FaseJefe` | interface |  |
| `DefJefe` | interface |  |
| `CerebroJefe` | class |  |

#### `src/contextos/encuentros/dominio/oleadas.ts`

Encuentros por oleadas (arenas, hordas, defensa de un punto, desafíos opcionales):

| exportación | tipo | descripción |
|---|---|---|
| `VarianteOleadas` | interface |  |
| `varianteParaSala` | function | Segundos de reloj (0 = sin reloj). Puede depender del nivel. */ readonly tiempo?: number \| ((nivel: number) => number); readonly dificultad?: number; readonly cofre?: number; /** Rareza mínima de la  |
| `ReglasOleadas` | interface |  |
| `REGLAS_OLEADAS` | const |  |
| `EncuentroOleadas` | class |  |
| `premioEncuentro` | function | Llamar cada paso con la cantidad de enemigos vivos del encuentro. */ actualizar(dt: number, vivos: number): EventoOleadas[] { const ev: EventoOleadas[] = []; if (this.terminado) return ev; if (this.ti |
| `ReglasDureza` | interface |  |
| `durezaEncuentro` | const | Enemigos extra por oleada. */ readonly extra: Curva; /** Probabilidad de que un enemigo sea élite (recortar con `curva.limitar`). */ readonly probElite: Curva; } /** Escalado por nivel de los enemigos |

#### `src/contextos/encuentros/dominio/director.ts`

Director de ritmo (hordas de zombis, survival cooperativo, juegos de terror):

| exportación | tipo | descripción |
|---|---|---|
| `TipoAparicion` | interface |  |
| `ReglasDirector` | interface |  |
| `Director` | class |  |

### `feel`

`import { feel } from "ludokit"`

Usado por los modelos: `arpg-botin`, `hack-and-slash`, `souls`, `arena-heroes`, `shooter-arena`, `roguelite-accion`, `supervivientes-hordas`, `metroidvania`, `plataformas-precision`, `lucha-plataformas`, `lucha-1v1`, `carreras-arcade`, `disparos-naves`

#### `src/contextos/feel/dominio/campos.ts`

Campos de fuerza con duración que se apagan suavemente:

| exportación | tipo | descripción |
|---|---|---|
| `CampoFuerza` | class |  |
| `Campos` | class |  |

#### `src/contextos/feel/dominio/impacto.ts`

Director de impacto (game feel):

| exportación | tipo | descripción |
|---|---|---|
| `PresetImpacto` | interface |  |
| `IMPACTOS` | const | Presets medidos para acción en 2D. |
| `DirectorImpacto` | class |  |

#### `src/contextos/feel/dominio/muelles.ts`

Muelles amortiguados para animación secundaria:

| exportación | tipo | descripción |
|---|---|---|
| `Muelle` | class |  |
| `muelleDesdeFrecuencia` | function | Empujón instantáneo (velocidad) o desplazamiento. */ impulsar(dv: number): void { this.velocidad += dv; } actualizar(dt: number): number { const f = (this.objetivo - this.valor) * this.k - this.veloci |
| `Deformacion` | interface |  |
| `Elastico` | class | Inclinación (grados o px de cizalla, a criterio del render). */ readonly inclinacion: number; readonly temblor: number; readonly destello: number; } /** Cuerpo elástico de un personaje: aplastar/estir |

#### `src/contextos/feel/dominio/particulas.ts`

Sistema de partículas de CPU en estructura de arrays (SoA:

| exportación | tipo | descripción |
|---|---|---|
| `TipoParticula` | interface |  |
| `TIPOS_PARTICULA` | const |  |
| `Particulas` | class |  |

#### `src/contextos/feel/dominio/remate.ts`

Remate (kill-cam) del golpe final a un jefe:

| exportación | tipo | descripción |
|---|---|---|
| `TiemposRemate` | interface |  |
| `TIEMPOS_REMATE` | const |  |
| `Remate` | class |  |

#### `src/contextos/feel/dominio/verlet.ts`

Cuerdas y telas por integración de Verlet con restricciones de distancia (Jakobsen):

| exportación | tipo | descripción |
|---|---|---|
| `ConfigCuerda` | interface |  |
| `CUERDAS` | const |  |
| `Cuerda` | class |  |

### `fisica`

`import { fisica } from "ludokit"`

Usado por los modelos: `looter-shooter`, `hack-and-slash`, `souls`, `mmo-accion`, `shooter-arena`, `shooter-tactico`, `shooter-extraccion`, `batalla-real`, `shooter-heroes`, `shooter-coberturas`, `hordas-zombis`, `extraccion-2d`, `supervivientes-hordas`, `metroidvania`, `plataformas-precision`, `lucha-plataformas`, `disparos-naves`

#### `src/contextos/fisica/dominio/cuerpo.ts`

Cuerpo AABB y movimiento por ejes separados contra una grilla de tiles.

| exportación | tipo | descripción |
|---|---|---|
| `Cuerpo` | class |  |
| `mover` | function | -1 chocó a la izquierda, 1 a la derecha, 0 nada (último paso). */ pared = 0; techo = false; pinchos = false; constructor(x: number, y: number, w: number, h: number) { this.x = x; this.y = y; this.w =  |
| `sobrePlataforma` | function | ¿Está parado sobre una plataforma de un sentido (y no sobre roca)? Decide si ↓ + salto la atraviesa. |
| `haySuelo` | function | ¿Hay suelo justo debajo del punto? (IA que patrulla sin caerse de las cornisas). |

#### `src/contextos/fisica/dominio/grilla.ts`

Grilla de tiles:

| exportación | tipo | descripción |
|---|---|---|
| `Celda` | const |  |
| `MundoTiles` | interface | De un sentido: se atraviesa desde abajo y se pisa desde arriba (↓ + salto para bajar). */ PLATAFORMA: 2, /** Daña al tocarla con los pies. */ PINCHOS: 3, } as const; export type Celda = (typeof Celda) |
| `esSolida` | const |  |
| `Grilla` | class |  |
| `mascaraAutotile` | function | Qué devuelve fuera de los límites (ROCA = mundo cerrado, VACIO = abierto). */ readonly fuera: Celda; private readonly datos: Uint8Array; constructor(cols: number, filas: number, tile = 16, fuera: Celd |

#### `src/contextos/fisica/dominio/iman.ts`

Botín suelto con IMÁN:

| exportación | tipo | descripción |
|---|---|---|
| `ObjetoSuelto` | interface |  |
| `ReglasIman` | interface |  |
| `soltar` | function | Segundos antes de poder atraerse (que se vea el botín). */ readonly espera: number; readonly radioAtraccion: number; readonly radioRecoger: number; readonly aceleracion: number; readonly velMax: numbe |
| `actualizarSuelto` | function | Un paso. `sueloY(x)` = altura del suelo bajo x. Devuelve true el paso en que se recoge. |

#### `src/contextos/fisica/dominio/perfil.ts`

Perfil de movimiento:

| exportación | tipo | descripción |
|---|---|---|
| `PerfilMovimiento` | interface |  |
| `ARQUETIPOS` | const | Multiplicador de la aceleración al frenar (1 = igual; < 1 patina). */ readonly freno: number; readonly gravedad: number; /** Gravedad extra al caer (caída más firme que la subida). */ readonly multCai |
| `crearPerfil` | function | Perfil = BASE × multiplicadores (los números) y reemplazo directo (booleanos). Límites de seguridad: el salto nunca baja de ×0,96 (los niveles se diseñan para un alto de salto) y la velocidad se queda |
| `alturaSalto` | function | Altura máxima de salto en px: v² / 2g. Úsala para diseñar niveles (los obstáculos del camino base, por debajo). |

#### `src/contextos/fisica/dominio/plataformero.ts`

Controlador de plataformas (agregado):

| exportación | tipo | descripción |
|---|---|---|
| `Mando` | interface | Entrada de un paso. `*Recien` = se apretó en este paso; `saltoSoltado` = se soltó en este paso. |
| `MANDO_QUIETO` | const |  |
| `Plataformero` | class |  |

#### `src/contextos/fisica/dominio/proyectil.ts`

Proyectiles por datos:

| exportación | tipo | descripción |
|---|---|---|
| `DefProyectil` | interface |  |
| `apuntarRecto` | function | Aceleración a lo largo de la dirección de salida (px/s²; negativa frena). */ readonly aceleracion: number; readonly gravedad: number; readonly vida: number; readonly radio: number; readonly atraviesaR |
| `apuntarArco` | function | Tiro parabólico que cae exactamente en el objetivo en `tVuelo` segundos (granadas, lanzadores, flechas en arco). Por defecto el tiempo crece con la distancia: 0.9 + min(\|dx\|/400, 0.5). |

#### `src/contextos/fisica/dominio/vista-superior.ts`

Movimiento en vista superior (RPG, roguelike de acción, twin-stick, juego de granja):

| exportación | tipo | descripción |
|---|---|---|
| `PerfilSuperior` | interface |  |
| `PERFIL_SUPERIOR_BASE` | const |  |
| `MovilSuperior` | class |  |

#### `src/contextos/fisica/dominio/controlador3d.ts`

Controlador de personaje 3D (FPS, TPS, ARPG 3D, acción):

| exportación | tipo | descripción |
|---|---|---|
| `PerfilMovimiento3D` | interface |  |
| `Suelo` | type | Fracción de control en el aire (0..1) y si se permite ganar velocidad girando en el aire. */ readonly controlAire: number; readonly strafeAereo?: boolean; readonly salto: number; readonly gravedad: nu |
| `Controlador3D` | class |  |

### `ia`

`import { ia } from "ludokit"`

Usado por los modelos: `arpg-botin`, `hack-and-slash`, `souls`, `shooter-extraccion`, `shooter-coberturas`, `hordas-zombis`, `guerra-zombis`, `supervivencia-zombi`, `extraccion-2d`, `rts`, `colonia`, `sigilo`, `terror-supervivencia`

#### `src/contextos/ia/dominio/arbol-comportamiento.ts`

Árbol de comportamiento (Behavior Tree), el estándar de la IA de juegos:

| exportación | tipo | descripción |
|---|---|---|
| `EXITO` | const |  |
| `FALLO` | const |  |
| `CORRIENDO` | const |  |
| `Ctx` | interface |  |
| `Nodo` | interface |  |
| `secuencia` | function | Se llama cuando un padre aborta este nodo (para cancelar animaciones, liberar recursos). */ reiniciar?(): void; } export const accion = <P>(f: (ctx: Ctx<P>) => Estado): Nodo<P> => ({ tick: f }); expor |
| `selector` | function | Prueba los hijos en orden hasta que uno no falle. Reactivo: reevalúa desde el primero cada tick (un hijo de mayor prioridad puede interrumpir al que corre). |
| `paralelo` | function | Corre todos a la vez. Éxito cuando `exitosNecesarios` tuvieron éxito; fallo cuando ya no se puede llegar. |
| `aleatorio` | function | Elige un hijo al azar por peso y lo corre hasta que termine (variedad en los ataques de un jefe). |
| `invertir` | const |  |
| `siempreExito` | const |  |
| `repetir` | function | Repite el hijo `n` veces (Infinity = para siempre mientras no falle). |
| `cooldown` | function | Tras un EXITO del hijo, falla durante `seg` segundos (habilidades con recarga). |
| `limiteTiempo` | function | Falla si el hijo sigue CORRIENDO después de `seg` segundos. |
| `esperar` | function |  |
| `si` | function | Solo corre el hijo si la condición se cumple (y lo aborta si deja de cumplirse). |

#### `src/contextos/ia/dominio/ataque-por-fases.ts`

Ataque por fases, la base de un combate legible:

| exportación | tipo | descripción |
|---|---|---|
| `DefAtaque` | interface |  |
| `ATAQUES_TIPO` | const | Alcance en px para empezar el ataque. */ readonly alcance: number; /** Multiplicador de daño del golpe. */ readonly mult: number; /** Segundos entre ataques (desde que termina la recuperación). */ rea |
| `AtaquePorFases` | class |  |

#### `src/contextos/ia/dominio/direccion.ts`

Comportamientos de dirección (steering, Reynolds):

| exportación | tipo | descripción |
|---|---|---|
| `Agente` | interface |  |
| `REACCION` | const | Tiempo de reacción (s): la fuerza es (velocidad deseada − actual) / REACCION. Más chico = más brusco. Con 0.1 s el "llegar" queda sobre-amortiguado (frena sin pasarse). |
| `buscar` | function |  |
| `huir` | function |  |
| `llegar` | function | Como buscar, pero frena dentro de `radioFreno` y se detiene en el objetivo. |
| `perseguir` | function | Persigue la posición futura del objetivo (intercepta en vez de seguir la cola). |
| `evadir` | function |  |
| `deambular` | function | Deambular suave: un punto en un círculo delante del agente que gira un poco al azar cada paso. |
| `bandada` | function | Bandada: separación, alineación y cohesión con los vecinos dentro de `radio`. |
| `evitarObstaculos` | function | Esquiva círculos que estén delante dentro de `anticipo` px. |
| `integrar` | function | Integra: suma fuerzas ya pesadas, limita, aplica a la velocidad y la posición. |

#### `src/contextos/ia/dominio/huella-jugador.ts`

IA que APRENDE DEL JUGADOR:

| exportación | tipo | descripción |
|---|---|---|
| `Huella` | interface |  |
| `habitoDominante` | function | Golpes que empujan / rompen guardia (patadas, embestidas). */ readonly empuje: number; readonly cargado: number; readonly habilidad: number; readonly agresividad: number; readonly estilo: string; } ex |
| `describirHuella` | function | Descripción corta ("ataca desde el aire, esquiva al último instante"). |
| `SituacionEspejo` | interface |  |
| `decidirEspejo` | function | Distancia horizontal al objetivo (px). */ readonly distancia: number; readonly enSuelo: boolean; readonly objetivoContraMuro: boolean; readonly objetivoCargando: boolean; readonly habilidadLista: bool |
| `ajusteDificultad` | function | Dificultad dinámica a partir del rendimiento reciente: devuelve un multiplicador de daño enemigo en [min, max] que sube si el jugador gana con holgura y baja si sufre. `vidaMedia`: vida promedio del j |

#### `src/contextos/ia/dominio/utilidad.ts`

IA por utilidad (Utility AI):

| exportación | tipo | descripción |
|---|---|---|
| `CURVAS` | const | Curvas de respuesta estándar sobre x en [0,1]. |
| `Consideracion` | interface |  |
| `puntuar` | function | Valor de entrada normalizado 0..1 (vida propia, distancia al objetivo / rango, munición...). */ readonly entrada: (ctx: C) => number; readonly curva: Curva; } export interface AccionUtil<C> { readonly |
| `elegirAccion` | function | Elige la acción. `top`: elige al azar entre las `top` mejores ponderando por puntaje (comportamiento menos robótico). `inercia`: bonus a la acción actual para que no cambie de idea a cada tick. |

### `inventario`

`import { inventario } from "ludokit"`

Usado por los modelos: `arpg-botin`, `shooter-extraccion`, `batalla-real`, `supervivencia-sandbox`, `supervivencia-zombi`, `extraccion-2d`, `roguelike-turnos`, `jrpg`, `gacha`, `terror-supervivencia`, `granja-vida`, `mod-extraccion`

#### `src/contextos/inventario/dominio/cajas.ts`

Cajas y paquetes:

| exportación | tipo | descripción |
|---|---|---|
| `abrirCaja` | function | `grupos`: nombre -> ids posibles (por ejemplo "premios" -> objetos de una lista de premios). |
| `entregarPremios` | function | Entrega los premios: si algún objeto no entra, no se entrega nada. |
| `leerContenido` | function | Lee el formato de contenido: `moneda A-B` (u `oro A-B`), `item ID [xN]`, `grupo NOMBRE`, `uno: a / b / c`. `item ID xN @peso` permite pesos dentro de "uno:".  Las entradas propias de cada juego (por e |
| `monedaEsperada` | function | Valor esperado en una moneda (para equilibrar cajas): promedio de los premios en moneda. |

#### `src/contextos/inventario/dominio/inventario.ts`

Inventario por pestañas y casillas, con pilas de tamaño máximo por objeto.

| exportación | tipo | descripción |
|---|---|---|
| `Pila` | interface |  |
| `MaxPila` | type | Datos propios del ejemplar (stats aleatorios, fecha de vencimiento...). Solo pilas de 1. */ readonly extra?: Readonly<Record<string, unknown>>; } export interface Posicion { readonly pestana: number;  |
| `OpcionesInventario` | interface |  |
| `transferir` | function | Pestañas utilizables al empezar (por defecto todas). Las demás existen pero están cerradas (VIP). */ readonly pestanasActivas?: number; } export type ErrorInventario = "objeto-desconocido" \| "cantida |

#### `src/contextos/inventario/dominio/vencimiento.ts`

Objetos con vencimiento (alquileres, pases de temporada) y suscripciones por tiempo que amplían el inventario.

| exportación | tipo | descripción |
|---|---|---|
| `venceEn` | function |  |
| `vencimientoDe` | function |  |
| `estaVencido` | function |  |
| `agregarTemporal` | function | Agrega un objeto temporal (cantidad 1, con su fecha). |
| `quitarVencidos` | function | Quita los objetos vencidos y devuelve qué se quitó (para avisar al jugador). |
| `Suscripcion` | class | Suscripción acumulable por tiempo (VIP, pase de batalla, bonus de EXP de 7 días...). |
| `aplicarVip` | function | Suma tiempo desde el vencimiento actual si sigue activa, o desde ahora si ya venció. */ extender(ms: number): number { this.hasta = Math.max(this.hasta, this.reloj.ahora()) + ms; return this.hasta; }  |

### `mundo`

`import { mundo } from "ludokit"`

Usado por los modelos: `arpg-botin`, `supervivencia-sandbox`, `roguelite-accion`, `roguelike-turnos`, `metroidvania`, `plataformas-precision`, `mazo-roguelike`, `mundo-abierto-rpg`

#### `src/contextos/mundo/dominio/cuevas.ts`

Cuevas por autómata celular (regla 4-5):

| exportación | tipo | descripción |
|---|---|---|
| `OpcionesCuevas` | interface |  |
| `generarCuevas` | function |  |

#### `src/contextos/mundo/dominio/exploracion.ts`

Mapa explorado (niebla de guerra) para el minimapa y el mapa completo:

| exportación | tipo | descripción |
|---|---|---|
| `MapaExplorado` | class |  |

#### `src/contextos/mundo/dominio/mazmorra.ts`

Generador de mazmorras como GRAFO de salas en una grilla, con llave y cerradura (metroidvania, roguelite, zelda-like).

| exportación | tipo | descripción |
|---|---|---|
| `OPUESTA` | const |  |
| `SalaMapa` | interface |  |
| `Conexion` | interface |  |
| `dimensiones` | function | Dirección de a hacia b. */ readonly dir: Dir; cerradura?: string; } export interface MapaMazmorra { readonly ancho: number; readonly alto: number; readonly salas: SalaMapa[]; readonly conexiones: Cone |
| `vecinos` | function |  |
| `alcanzables` | function |  |
| `resolver` | function | Punto fijo: explora, junta las llaves alcanzables, repite hasta que no aparezcan nuevas. |
| `esValido` | function |  |
| `distancias` | function |  |
| `generarMazmorra` | function | Genera un mapa válido (reintenta hasta 60 veces; si no, sin cerraduras). |
| `aberturas` | function | Aberturas de una sala: dir → {destino, cerradura?} (para construir su interior). |

#### `src/contextos/mundo/dominio/plantillas.ts`

Plantillas de salas hechas a mano + procedimiento:

| exportación | tipo | descripción |
|---|---|---|
| `Plantilla` | interface |  |
| `Leyenda` | interface | Aberturas que la plantilla soporta (deben coincidir con las del mapa). */ readonly aberturas: readonly ("izq" \| "der" \| "arr" \| "aba")[]; readonly peso?: number; readonly etiquetas?: readonly strin |
| `LEYENDA_ESTANDAR` | const |  |
| `Marcador` | interface |  |
| `SalaDePlantilla` | interface |  |
| `validarPlantilla` | function | Valida que todas las filas tengan el mismo ancho y que los caracteres estén en la leyenda. |
| `construirDesdePlantilla` | function | Construye una sala desde una plantilla (opcionalmente espejada en horizontal). |
| `elegirPlantilla` | function | Elige una plantilla compatible con las aberturas pedidas (probando también su versión espejada). |

#### `src/contextos/mundo/dominio/ruido.ts`

Ruido procedural determinista:

| exportación | tipo | descripción |
|---|---|---|
| `hash2` | function |  |
| `ruidoValor` | function | Ruido de valor 2D en [0,1). |
| `ruidoGradiente` | function | Ruido de gradiente 2D en aprox. [-0.7, 0.7] (más orgánico que el de valor). |
| `fbm` | function | fBm: suma de octavas con lacunaridad y ganancia. Normalizado a [0,1). |
| `ruidoTileable` | function | Ruido de valor que se repite cada (px, py) celdas: texturas y mapas que tilean sin costura. |
| `ruidoDeformado` | function | Dominio deformado: muestrea el fBm desplazado por otro fBm (formas más naturales: costas, vetas). |
| `bandas` | function | Clasifica un valor 0..1 en bandas (agua, arena, pasto, roca, nieve...). |

#### `src/contextos/mundo/dominio/sala-plataformas.ts`

Interior de una sala de plataformas con GARANTÍA DE RECORRIDO:

| exportación | tipo | descripción |
|---|---|---|
| `OpcionesSala` | interface |  |
| `alturaMaxObstaculo` | function | Alto máximo de un obstáculo en tiles (alto de salto en tiles − 1). */ readonly altoMaxObstaculo?: number; } export interface SalaConstruida { readonly grilla: Grilla; readonly antorchas: Array<readonl |

#### `src/contextos/mundo/aplicacion/generar-nivel.ts`

Caso de uso:

| exportación | tipo | descripción |
|---|---|---|
| `Nivel` | interface |  |
| `generarNivel` | function |  |

### `narrativa`

`import { narrativa } from "ludokit"`

Usado por los modelos: `mmo-tematico`, `jrpg`, `mundo-abierto-rpg`, `aventura-narrativa`, `granja-vida`

#### `src/contextos/narrativa/dominio/dialogo.ts`

Diálogos ramificados por datos:

| exportación | tipo | descripción |
|---|---|---|
| `Condicion` | interface |  |
| `Efecto` | interface |  |
| `Opcion` | interface |  |
| `NodoDialogo` | interface |  |
| `Mundo` | interface |  |
| `MundoVariables` | class |  |
| `cumple` | function |  |
| `cumpleTodas` | const |  |
| `interpolar` | function |  |
| `EventoDialogo` | interface |  |
| `Dialogo` | class |  |

#### `src/contextos/narrativa/dominio/memoria.ts`

MEMORIA NARRATIVA y DISPARADORES de consecuencias:

| exportación | tipo | descripción |
|---|---|---|
| `EventoNarrable` | interface |  |
| `Disparadores` | class | Datos del evento (jefe: "coloso", sinDanio: true, zona: "puerto"...). */ readonly datos?: Readonly<Record<string, Valor>>; } export interface RegistroNarrativo { readonly orden: number; readonly tipo: |

### `navegacion`

`import { navegacion } from "ludokit"`

Usado por los modelos: `arpg-botin`, `moba`, `shooter-coberturas`, `hordas-zombis`, `guerra-zombis`, `roguelike-turnos`, `supervivientes-hordas`, `tactico-grilla`, `rts`, `defensa-torres`, `defensa-laberinto`, `colonia`, `sigilo`, `mod-zombis`

#### `src/contextos/navegacion/dominio/astar.ts`

Búsqueda de caminos A* sobre grilla (4 u 8 direcciones) con montículo binario, costo por celda (barro, agua), prohibición de cortar esquinas en diagonal, límite de nodos expandidos y suavizado por línea de visión.

| exportación | tipo | descripción |
|---|---|---|
| `MonticuloMin` | class |  |
| `Grafo` | interface |  |
| `OpcionesBusqueda` | interface |  |
| `aEstrella` | function | A* genérico. Devuelve el camino [inicio..meta] o null. |
| `OpcionesGrilla` | interface |  |
| `grafoGrilla` | function | Costo de entrar a la celda; Infinity o <= 0 = bloqueada. */ readonly costo: (c: number, f: number) => number; readonly diagonal?: boolean; } const RAIZ2 = Math.SQRT2; /** Grafo de grilla listo para `a |
| `suavizarCamino` | function | Quita puntos intermedios mientras haya línea de visión (caminos naturales, menos zig-zag). |
| `visionBresenham` | function | Línea de visión en grilla por Bresenham (para `suavizarCamino`). |

#### `src/contextos/navegacion/dominio/campo-flujo.ts`

Campo de flujo (Dijkstra desde el objetivo):

| exportación | tipo | descripción |
|---|---|---|
| `CampoFlujo` | class |  |

### `progresion`

`import { progresion } from "ludokit"`

Usado por los modelos: `arpg-botin`, `arpg-temporadas`, `looter-shooter`, `souls`, `mmo-tematico`, `mmo-accion`, `roguelite-accion`, `supervivientes-hordas`, `metroidvania`, `jrpg`, `tactico-grilla`, `gacha`, `incremental`, `mundo-abierto-rpg`, `aventura-narrativa`, `granja-vida`, `mod-servicio-vivo`, `mod-infinito`

#### `src/contextos/progresion/dominio/calendario.ts`

Calendario de contenido vivo:

| exportación | tipo | descripción |
|---|---|---|
| `LUNES_BASE` | const | Lunes de referencia (UTC). Cambiarlo cambia la fase de todas las rotaciones. |
| `semanaDe` | const |  |
| `diaDe` | const |  |
| `hastaProximaSemana` | const | Ms hasta el próximo reinicio semanal (para la cuenta regresiva de la interfaz). |
| `hastaProximoDia` | const |  |
| `rotacion` | const | Elemento de la rotación para una semana (o día): ciclo simple, predecible para la comunidad. |
| `rotacionBarajada` | function | Selección "barajada" sin repetir hasta agotar la lista (cada ciclo completo usa todos una vez). |
| `EventoTemporada` | interface |  |
| `eventosActivos` | const | Inicio y fin en ms UTC. */ readonly desde: number; readonly hasta: number; readonly datos?: Readonly<Record<string, unknown>>; } /** Eventos de temporada activos en `ms`. |
| `eventoAnual` | function | Evento anual que se repite cada año (navidad, aniversario): mes 1-12, día 1-31, duración en días. |
| `ProgresoPeriodico` | class | Progreso que se reinicia por período (cofre semanal, misiones diarias): guarda el período y lo vacía al cambiar. |

#### `src/contextos/progresion/dominio/habilidades.ts`

Puntos de habilidad:

| exportación | tipo | descripción |
|---|---|---|
| `ReglasHabilidades` | interface |  |
| `PuntosHabilidad` | class |  |

#### `src/contextos/progresion/dominio/logros.ts`

Logros con contadores y puente a plataformas (Steam, consolas, móviles):

| exportación | tipo | descripción |
|---|---|---|
| `DefLogro` | interface |  |
| `PlataformaLogros` | interface | Id interno y "API name" de la plataforma. */ readonly id: string; readonly nombre: string; readonly descripcion: string; readonly categoria?: string; /** Evento contado (con `contexto` opcional) o reg |
| `PlataformaNula` | class |  |
| `EstadoLogros` | interface |  |
| `RegistroLogros` | class |  |

#### `src/contextos/progresion/dominio/misiones.ts`

Misiones:

| exportación | tipo | descripción |
|---|---|---|
| `Objetivo` | interface |  |
| `RecompensaMision` | interface |  |
| `DefinicionMision` | interface |  |
| `MisionActiva` | interface |  |
| `RegistroMisiones` | class |  |

#### `src/contextos/progresion/dominio/niveles.ts`

Curvas de experiencia:

| exportación | tipo | descripción |
|---|---|---|
| `CurvaNiveles` | class |  |
| `curvaPolinomica` | function | Nivel y porcentaje hacia el siguiente (0~100). En el nivel máximo el porcentaje es 0. */ nivelDe(experiencia: number): { nivel: number; porcentaje: number } { let nivel = 1; while (nivel < this.nivelM |
| `curvaDesde` | function | Curva de `niveles` niveles con costo del nivel n→n+1 = curva(n) (redondeado, mínimo 1). |
| `CurvaNivelesInfinita` | class | Curva sin nivel máximo: costo del nivel n→n+1 = curva(n). Búsqueda binaria sobre umbrales en caché. |

#### `src/contextos/progresion/dominio/recompensas.ts`

Recompensa de fin de partida (juegos por sesión:

| exportación | tipo | descripción |
|---|---|---|
| `DatosPartida` | interface |  |
| `aplicarBonus` | function | Jugadores que terminaron / jugadores que empezaron. */ readonly presentes: number; readonly total: number; } export interface ParametrosRecompensa { /** EXP base según el nivel de la partida (escalone |
| `PremioDeNivel` | interface |  |
| `premiosPorSubida` | function | Premios de los niveles alcanzados al subir de `antes` a `despues` (también si se saltan niveles). |

#### `src/contextos/progresion/dominio/talentos.ts`

Árbol de talentos genérico:

| exportación | tipo | descripción |
|---|---|---|
| `DefTalento` | interface |  |
| `ArbolTalentos` | class |  |

#### `src/contextos/progresion/dominio/progresion-extendida.ts`

Progresión de largo plazo de los RPG/MMO/shooters modernos:

| exportación | tipo | descripción |
|---|---|---|
| `Paragon` | class |  |
| `prestigiar` | function | Tope de puntos por atributo (Infinity = sin tope). */ readonly topes: Readonly<Record<string, number>>; constructor(costo: Curva, puntosPorNivel = 1, topes: Readonly<Record<string, number>> = {}) { th |
| `ReglasDescanso` | interface |  |
| `Descanso` | class |  |
| `ReglasMaestria` | interface |  |
| `Maestria` | class |  |
| `DefFaccion` | interface |  |
| `Reputacion` | class |  |
| `PremioPase` | interface |  |
| `PaseTemporada` | class |  |

### `roguelite`

`import { roguelite } from "ludokit"`

Usado por los modelos: `souls`, `shooter-extraccion`, `extraccion-2d`, `roguelite-accion`, `mazo-roguelike`, `mod-hardcore`, `mod-extraccion`

#### `src/contextos/roguelite/dominio/extraccion.ts`

Riesgo y extracción (roguelite de extracción, ARPG hardcore, souls-like):

| exportación | tipo | descripción |
|---|---|---|
| `Legado` | interface |  |
| `vidaDeLegado` | const | Instantánea del personaje (para que el legado pelee como él): stats, equipo visible, nombre. */ readonly forma: Readonly<Record<string, unknown>>; readonly causa: string; readonly numero: number; } ex |
| `ReglasInfinito` | interface |  |
| `haySalida` | function | Niveles seguidos sin salida tras los que la salida es segura. */ readonly piedad: number; /** Jefe cada N niveles (punto de inicio desbloqueable). */ readonly jefeCada: number; } export const probSali |
| `iniciosDisponibles` | function | Niveles desde los que se puede empezar: 1 y cada uno posterior a un jefe vencido. |

#### `src/contextos/roguelite/aplicacion/resolver-muerte.ts`

Caso de uso:

| exportación | tipo | descripción |
|---|---|---|
| `EstadoIncursion` | interface |  |
| `recuperarLegado` | function | Lo que se arriesga (equipo puesto, mochila, moneda del viaje). */ llevado: B; nivel: number; vivo: boolean; } export interface ResultadoMuerte<B> { readonly legado: Legado<B>; readonly perdidos: reado |

### `social`

`import { social } from "ludokit"`

Usado por los modelos: `mmo-tematico`, `mod-mundo-persistente`

#### `src/contextos/social/dominio/correo.ts`

Correo con adjuntos (objetos y moneda):

| exportación | tipo | descripción |
|---|---|---|
| `Adjunto` | interface |  |
| `Carta` | interface |  |
| `NuevaCarta` | interface |  |
| `Buzon` | class |  |
| `tieneAdjuntos` | function |  |

#### `src/contextos/social/dominio/gremios.ts`

Gremios / clanes:

| exportación | tipo | descripción |
|---|---|---|
| `Miembro` | interface |  |
| `OpcionesGremio` | interface |  |
| `Gremio` | class |  |

### `persistencia`

`import { persistencia } from "ludokit"`

#### `src/infraestructura/persistencia/guardado.ts`

Guardado versionado con migraciones y almacenes intercambiables (puerto/adaptador):

| exportación | tipo | descripción |
|---|---|---|
| `Almacen` | interface |  |
| `AlmacenMemoria` | class |  |
| `AlmacenLocal` | class | Almacén para navegador (localStorage). |
| `fnv1a` | function | Suma FNV-1a de 32 bits (rápida; no es seguridad, es integridad). |
| `OpcionesGuardado` | interface |  |
| `Repositorio` | class | migraciones[n] convierte de la versión n a la n+1. */ readonly migraciones?: Readonly<Record<number, Migracion>>; /** Versión mínima que se puede migrar; más vieja = se aparta y se empieza de cero. */ |

### `disparos`

`import { disparos } from "ludokit"`

Usado por los modelos: `looter-shooter`, `shooter-arena`, `shooter-tactico`, `shooter-extraccion`, `batalla-real`, `shooter-heroes`, `shooter-coberturas`, `hordas-zombis`, `guerra-zombis`, `supervivencia-zombi`, `extraccion-2d`, `combate-vehicular`, `mod-militar`

#### `src/contextos/disparos/dominio/arma.ts`

Arma de fuego como máquina de estados determinista (shooter en primera/tercera persona, top-down, extracción):

| exportación | tipo | descripción |
|---|---|---|
| `DefArma` | interface |  |
| `dpsArma` | function | Disparos por minuto. */ readonly cadencia: number; readonly modos: readonly ModoFuego[]; readonly balasRafaga?: number; /** Proyectiles por disparo (escopetas: 8-12). */ readonly perdigones?: number;  |
| `tiempoParaMatar` | const | Tiempo para matar (TTK) con `vida` y `danio` por impacto, dada la cadencia (el primer tiro sale en t = 0). |

#### `src/contextos/disparos/dominio/punteria.ts`

Puntería:

| exportación | tipo | descripción |
|---|---|---|
| `DefDispersion` | interface |  |
| `Retroceso` | class | Semiapertura del cono quieto, en grados. */ readonly base: number; readonly postura?: Partial<Record<Postura, number>>; /** Grados que suma cada disparo y grados por segundo que recupera. */ readonly  |
| `asistirMira` | function | Patada del disparo número `n` (1 = primero). `control` 0..1 atenúa (accesorios, habilidad). */ disparar(n: number, azar: Azar, control = 0): { pitch: number; yaw: number } { const p = this.def.patron; |

#### `src/contextos/disparos/dominio/balistica.ts`

Balística y resolución de impactos:

| exportación | tipo | descripción |
|---|---|---|
| `caidaDanio` | const | Multiplicador de daño según la distancia (m) con una curva de tramos: [[0,1],[20,1],[60,0.6]]. |
| `DefZona` | interface |  |
| `MapaZonas` | type | Parte del cuerpo con vida propia (opcional). */ readonly parte?: string; /** Clase de blindaje que cubre esta zona ("casco", "chaleco"...). */ readonly cubre?: string; } /** Zonas estándar de un human |
| `Municion` | interface |  |
| `probPenetrar` | function | Penetración de blindaje (misma escala que la clase × 10: clase 4 ≈ penetración 40). */ readonly penetracion: number; /** Fracción del daño que va al blindaje (desgaste). */ readonly danioBlindaje: num |
| `ResultadoBlindaje` | interface |  |
| `resolverBlindaje` | function | Aplica una bala contra un blindaje (muta su durabilidad). Sin blindaje: daño completo. |
| `TablaMateriales` | type | Pérdida de poder al atravesar un material: [poder perdido por cm]. 1 = poder 100 → 0 en 100 cm. |
| `ImpactoBala` | interface |  |
| `resolverDisparo` | function | Hitscan con penetración: recorre los impactos en orden; los personajes reciben daño (zona por etiqueta) y las superficies con material (etiqueta "mundo:<material>:<espesorCm>") restan poder. Se corta  |
| `EstadoProyectil3D` | interface |  |
| `avanzarProyectil3D` | function | Proyectil balístico: gravedad (m/s²) y arrastre (fracción de velocidad perdida por segundo). |
| `anguloDeTiro` | function | Ángulo de elevación (rad) para acertar a `distancia` horizontal con caída `altura` y velocidad `v` (null = no llega). |
| `puntoDeAdelanto` | function | Adelanto: punto al que apuntar para pegarle a un blanco que se mueve a velocidad constante. |

#### `src/contextos/disparos/dominio/salud-partes.ts`

Salud por PARTES del cuerpo (simuladores tácticos y de extracción, supervivencia):

| exportación | tipo | descripción |
|---|---|---|
| `DefParte` | interface |  |
| `EstadoParte` | interface |  |
| `ReglasSalud` | interface |  |
| `SaludPorPartes` | class |  |

### `moba`

`import { moba } from "ludokit"`

Usado por los modelos: `moba`

#### `src/contextos/moba/dominio/moba.ts`

Mecánicas de arena de batalla multijugador (MOBA) y de cualquier juego con carriles, estructuras y oro por partida:

| exportación | tipo | descripción |
|---|---|---|
| `DefOleadaCarril` | interface |  |
| `oroAsesinato` | function | Segundos entre oleadas y primera oleada. */ readonly cada: number; readonly primera: number; /** Composición base: tipo → cantidad. */ readonly base: Readonly<Record<string, number>>; /** Unidad de as |
| `recompensaUnidad` | function | Muere una unidad: oro para quien dio el último golpe, experiencia repartida entre los cercanos. |
| `tiempoReaparicion` | const | Segundos de reaparición: curva por nivel × multiplicador por minuto de partida. |
| `ReglasRangos` | interface |  |
| `puedeSubirRango` | function | Habilidades normales: rango máximo; definitiva: niveles en que se puede subir. */ readonly rangoMax: number; readonly definitiva: string; readonly nivelesDefinitiva: readonly number[]; /** Una habilid |

### `vision`

`import { vision } from "ludokit"`

Usado por los modelos: `moba`, `shooter-tactico`, `shooter-extraccion`, `guerra-zombis`, `supervivencia-zombi`, `extraccion-2d`, `roguelike-turnos`, `tactico-grilla`, `rts`, `sigilo`, `terror-supervivencia`

#### `src/contextos/vision/dominio/vision.ts`

Visión:

| exportación | tipo | descripción |
|---|---|---|
| `FuenteVision` | interface |  |
| `enConoDeVision` | function | Ve por encima de obstáculos (unidades voladoras, guardianes altos). */ readonly ignoraBloqueo?: boolean; } export class NieblaGuerra { readonly cols: number; readonly filas: number; private readonly c |
| `ReglasSospecha` | interface |  |
| `propagarRuido` | function | Llenado por segundo a distancia 0 con luz plena; cae con la distancia hasta `alcance`. */ readonly llenado: number; readonly alcance: number; readonly decae: number; /** Multiplicadores por postura/mo |

### `grupo`

`import { grupo } from "ludokit"`

Usado por los modelos: `mmo-tematico`, `mmo-accion`, `hordas-zombis`, `cooperativo-mazmorras`, `mod-cooperativo`

#### `src/contextos/grupo/dominio/grupo.ts`

Juego en grupo (MMO, cooperativo, mazmorras y bandas):

| exportación | tipo | descripción |
|---|---|---|
| `Miembro` | interface |  |
| `armarGrupos` | function | Roles que puede cubrir (para el buscador). */ readonly roles?: readonly string[]; } export class Grupo { readonly maximo: number; lider: number; readonly miembros: Miembro[] = []; constructor(lider: M |
| `repartirPorTirada` | function | Necesidad/codicia: gana la mayor tirada dentro de la mejor categoría elegida. Devuelve ganador y tiradas. |
| `repartirPorTurno` | function | Por turnos: cada objeto al siguiente de la lista (estado = índice guardable). |
| `botinPersonal` | function | Botín personal: cada miembro tira su propia tabla (con su propia probabilidad). |
| `Bloqueos` | class |  |
| `Contribucion` | class | Período en ms y desplazamiento del reinicio (p. ej. miércoles 9:00). */ readonly periodo: number; readonly origen: number; private readonly usados = new Map<string, number>(); constructor(periodoMs: n |

### `supervivencia`

`import { supervivencia } from "ludokit"`

Usado por los modelos: `mmo-accion`, `shooter-extraccion`, `hordas-zombis`, `guerra-zombis`, `supervivencia-sandbox`, `supervivencia-zombi`, `extraccion-2d`, `colonia`, `rally`, `terror-supervivencia`, `granja-vida`, `mod-zombis`, `mod-supervivencia`

#### `src/contextos/supervivencia/dominio/supervivencia.ts`

Supervivencia (sandbox, extracción, zombis, náufrago, colonia):

| exportación | tipo | descripción |
|---|---|---|
| `DefNecesidad` | interface |  |
| `temperaturaCorporal` | function | Puntos por segundo que pierde según la actividad ("quieto", "caminando", "corriendo"...); "base" si no hay. */ readonly tasa: Readonly<Record<string, number>>; /** Umbrales [fracción, efecto] de menor |
| `Durabilidad` | class |  |
| `frescura` | const | Eficacia 0..1 (un arma gastada pega menos, por ejemplo: 0.5 + 0.5·fracción). */ eficacia(minimo = 0.5): number { return this.max <= 0 ? 0 : minimo + (1 - minimo) * (this.actual / this.max); } usar(des |

### `turnos`

`import { turnos } from "ludokit"`

Usado por los modelos: `roguelike-turnos`, `jrpg`, `tactico-grilla`, `mazo-roguelike`

#### `src/contextos/turnos/dominio/turnos.ts`

Combate por TURNOS (JRPG, táctico, roguelike, juegos de mesa):

| exportación | tipo | descripción |
|---|---|---|
| `Combatiente` | interface |  |
| `ordenIniciativa` | function | Orden de una ronda: velocidad + tirada (0..`variacion`), desempate por id. |
| `ColaTiempo` | class |  |
| `PuntosAccion` | class | Adelanta (+) o retrasa (−) a una unidad en fracción del umbral. */ empujar(id: number, fraccion: number): void { const c = this.carga.get(id); if (c !== undefined) this.carga.set(id, Math.max(0, c + f |
| `alcanceGrilla` | function | Casillas alcanzables con `presupuesto` de movimiento. `costo(c,f)` = Infinity si no se puede pisar. |
| `ReglasImpactoTactico` | interface |  |
| `probImpactoTactico` | function | Penalización por casilla de distancia más allá de `alcanceOptimo`. */ readonly porDistancia: number; readonly alcanceOptimo: number; readonly coberturaMedia: number; readonly coberturaTotal: number; / |

### `mazo`

`import { mazo } from "ludokit"`

Usado por los modelos: `mazo-roguelike`, `cartas-coleccionables`

#### `src/contextos/mazo/dominio/mazo.ts`

Juegos de cartas con mazo (constructores de mazos, roguelikes de cartas, coleccionables):

| exportación | tipo | descripción |
|---|---|---|
| `barajar` | function |  |
| `ReglasMazo` | interface |  |
| `curvaDeCostos` | function | Qué pasa si se roba con la mano llena. */ readonly manoLlena: "descartar" \| "quemar" \| "no-robar"; readonly energiaPorTurno: number; /** La energía sobrante se pierde (true) o se acumula hasta `ener |
| `probRobarAlMenos` | function | Probabilidad hipergeométrica de robar al menos `k` de `exitos` copias en `robos` cartas de un mazo de `n`. |

### `estrategia`

`import { estrategia } from "ludokit"`

Usado por los modelos: `guerra-zombis`, `supervivencia-sandbox`, `rts`, `defensa-torres`, `defensa-laberinto`, `colonia`

#### `src/contextos/estrategia/dominio/estrategia.ts`

Estrategia en tiempo real (RTS), defensa de torres (TD), construcción de bases y colonias:

| exportación | tipo | descripción |
|---|---|---|
| `Unidad` | interface |  |
| `seleccionarRect` | function | Unidades dentro del rectángulo (arrastre del ratón) del dueño indicado. |
| `GruposControl` | class |  |
| `formacion` | function | Ids vivos del grupo (filtra las unidades que ya no existen). */ obtener(n: number, existe: (id: number) => boolean = () => true): number[] { const g = (this.grupos.get(n) ?? []).filter(existe); this.g |
| `DefProduccion` | interface |  |
| `Economia` | interface |  |
| `ColaProduccion` | class |  |
| `Recolector` | class |  |
| `ReglasTD` | interface |  |
| `interesTD` | const |  |
| `ventaTorre` | const |  |
| `CuadriculaConstruccion` | class |  |

### `carreras`

`import { carreras } from "ludokit"`

Usado por los modelos: `carreras-arcade`, `carreras-simulacion`, `rally`, `combate-vehicular`

#### `src/contextos/carreras/dominio/carreras.ts`

Juegos de CARRERAS (arcade y simulación ligera) y de vehículos en general:

| exportación | tipo | descripción |
|---|---|---|
| `DefMotor` | interface |  |
| `curvaNeumatico` | function | Par en Nm según RPM (tramos). */ readonly par: Curva; readonly rpmRalenti: number; readonly rpmMax: number; /** Relaciones de cada marcha (1.ª, 2.ª...) y del diferencial. */ readonly marchas: readonly |
| `ControlVehiculo` | interface |  |
| `Vehiculo` | class | −1 izquierda .. 1 derecha. */ readonly direccion: number; readonly frenoMano?: boolean; readonly nitro?: boolean; } /** Vehículo en el plano (x, y) con rumbo `angulo` (rad). Modelo de bicicleta simpli |
| `Fantasma` | class | Velocidad en ejes del coche: adelante y lateral (m/s). */ vx = 0; vy = 0; giro = 0; marcha = 1; rpm: number; nitro: number; derrapando = false; readonly def: DefVehiculo; constructor(def: DefVehiculo, |
| `rubberBanding` | function | Rubber banding para la IA: multiplicador de rendimiento según la distancia (m) al jugador. Por detrás acelera hasta `max`, por delante afloja hasta `min`; `alcance` es la distancia a la que se aplica  |

### `feedback`

`import { feedback } from "ludokit"`

#### `src/contextos/feedback/dominio/protocolo.ts`

PROTOCOLO DE FEEDBACK:

| exportación | tipo | descripción |
|---|---|---|
| `TipoEventoJuego` | type | Glosario de eventos de feedback. El juego puede agregar los suyos (string libre). |
| `EventoJuego` | interface |  |
| `RecetaFeedback` | interface | 0..1: cuánto importa (daño/vida, velocidad/tope, rareza/maxima...). */ readonly intensidad: number; readonly x?: number; readonly y?: number; readonly z?: number; /** Material o superficie ("carne", " |
| `intensidadDanio` | const | Nombre del sonido; `{material}` y `{etiqueta}` se reemplazan (p. ej. "impacto_{material}"). */ readonly sonido?: string; readonly volumen?: readonly [min: number, max: number]; readonly tono?: readonl |
| `intensidadCaida` | const | Intensidad de un aterrizaje según la velocidad de caída (0 hasta `minima`, 1 en `maxima`). |
| `intensidadRareza` | const | Intensidad por rareza (botín): 0 la más común, 1 la más alta. |
| `friccionSonora` | function | Fricción sonora continua (deslizar, derrapar, arrastrar): volumen y tono según la velocidad y el agarre de la superficie. Para sonidos en bucle que se actualizan cada paso, no para eventos. |

#### `src/contextos/feedback/dominio/estilos.ts`

Estilos de feedback de partida (PROPIOS de ludokit):

| exportación | tipo | descripción |
|---|---|---|
| `ESTILO_ARCADE` | const | Acción arcade: todo exagerado, mucho impacto de pantalla. |
| `ESTILO_ESTANDAR` | const | Estándar equilibrado (RPG de acción, aventura). |
| `ESTILO_TACTICO` | const | Táctico / simulación: sin congelar, sacudida mínima, el sonido manda (shooters tácticos, extracción). |
| `ESTILO_TERROR` | const | Terror: poco impacto visual, sonidos ajenos tan fuertes como los propios (lo que no ves, lo oís). |
| `ESTILO_ACCESIBLE` | const | Accesible: sin destellos ni sacudidas (fotosensibilidad, mareo), feedback por sonido y efectos estáticos. |
| `ESTILOS_FEEDBACK` | const |  |

### `datos`

`import { datos } from "ludokit"`

#### `src/datos/armas.ts`

Catálogo PROPIO de armas de fuego para juegos tácticos, de extracción, militares y de supervivencia.

| exportación | tipo | descripción |
|---|---|---|
| `Calibre` | interface |  |
| `TIPOS_MUNICION` | const | Masa del proyectil en gramos y velocidad en boca (m/s), aproximadas. */ readonly masa: number; readonly velocidad: number; /** Proyectiles por disparo (perdigones). */ readonly proyectiles?: number; } |
| `ConversionBalistica` | interface |  |
| `CONVERSION_BALISTICA` | const | Conversión por defecto (vida de referencia ~100 por zona vital). |
| `energia` | const |  |
| `municion` | function | Munición lista para `resolverBlindaje` / `resolverDisparo`. |
| `DefBlindaje` | interface | Clases de blindaje 1..6 (penetración necesaria ≈ clase × 10). Material decide desgaste y daño contundente. |
| `ZONAS_HUMANOIDE` | const | kg: penaliza estamina/velocidad. */ readonly peso: number; } export const BLINDAJES: readonly DefBlindaje[] = [ { id: "chaleco-textil-1", clase: 1, durabilidad: 40, desgaste: 0.9, contundente: 0.35, z |
| `PARTES_HUMANOIDE` | const | Partes de salud de un humanoide (vitales: cabeza y torso). |
| `FichaArma` | interface |  |
| `aplicarAccesorios` | function | Caída de daño por distancia (m). */ readonly caida: Curva; /** Alcance máximo útil (m) y masa (kg). */ readonly alcance: number; readonly masa: number; /** Ranuras de accesorios disponibles. */ readon |
| `ficha` | const |  |

#### `src/datos/vehiculos.ts`

Catálogo PROPIO de vehículos para juegos de carreras y combate vehicular.

| exportación | tipo | descripción |
|---|---|---|
| `FichaVehiculo` | interface |  |
| `SUPERFICIES` | const | Clasificación 1..10 para la interfaz (aceleración, velocidad punta, manejo). */ readonly ficha: { readonly aceleracion: number; readonly punta: number; readonly manejo: number }; } const base = { rpmR |

#### `src/datos/criaturas.ts`

Catálogo PROPIO de arquetipos de enemigos y unidades:

| exportación | tipo | descripción |
|---|---|---|
| `Arquetipo` | interface |  |
| `tiposDeAparicion` | function | Velocidad relativa (1 = caminar humano). */ readonly velocidad: number; /** Comportamiento sugerido: "perseguir", "cubrirse", "flanquear", "distancia", "apoyo", "emboscar", "kamikaze", "invocar", "hui |

#### `src/datos/rpg.ts`

Catálogo PROPIO para RPG (acción, MMO, por turnos):

| exportación | tipo | descripción |
|---|---|---|
| `CONJUNTOS_STATS` | const | Conjuntos de stats por estilo de juego. |
| `Clase` | interface |  |
| `TIPOS_DANIO` | const | Peso de cada stat al subir de nivel o al valorar equipo. */ readonly pesos: Readonly<Record<string, number>>; readonly armas: readonly string[]; readonly distancia: boolean; } export const CLASES: rea |
| `AFINIDADES` | const |  |
| `afinidad` | const | Multiplicador de afinidad (1 si no hay dato). |
| `ESTADOS` | const | Estados alterados habituales con su duración/potencia de referencia. |
| `RAREZAS` | const | Rarezas de referencia (nombres y colores); los pesos los decide la tabla de rareza de cada juego. |

#### `src/datos/tipos.ts`

Tipos compartidos por los catálogos de datos.

| exportación | tipo | descripción |
|---|---|---|
| `DefEstadoBasico` | interface | Estado alterado de referencia (el juego lo traduce a `GestorEstados`, `GestorBuffs` o `RendimientosDecrecientes`). |

### `modelos`

`import { modelos } from "ludokit"`

#### `src/modelos/tipos.ts`

Un MODELO es un punto de partida combinable para un tipo de juego:

| exportación | tipo | descripción |
|---|---|---|
| `Modelo` | interface |  |
| `Combinacion` | interface |  |

#### `src/modelos/combinar.ts`

Combinar modelos:

| exportación | tipo | descripción |
|---|---|---|
| `combinar` | function | Combina modelos en orden (los últimos pisan a los primeros). |

#### `src/modelos/catalogo.ts`

Catálogo de MODELOS:

| exportación | tipo | descripción |
|---|---|---|
| `MODELOS` | const |  |
| `modelo` | const |  |
| `modelosBase` | const |  |
| `modificadores` | const |  |

#### `src/modelos/asistente.ts`

ASISTENTE:

| exportación | tipo | descripción |
|---|---|---|
| `Opcion` | interface |  |
| `Pregunta` | interface |  |
| `puntuar` | function | Importancia de la pregunta en el puntaje. */ readonly peso: number; } export const PREGUNTAS: readonly Pregunta[] = [ { id: "nucleo", texto: "¿Qué hace el jugador la mayor parte del tiempo?", multiple |
| `recomendar` | function | Modificadores que se deducen directo de las respuestas (se suman a la base elegida). */ function modificadoresPara(r: Respuestas, base: Modelo): Modelo[] { const ids: string[] = []; const tiene = (p:  |
| `planDeImplementacion` | function | Pasos concretos, en orden, para empezar el juego con la combinación. |

#### `src/modelos/piezas.ts`

PIEZAS de reglas reutilizables (configuraciones ya armadas) con las que se construyen los modelos.

| exportación | tipo | descripción |
|---|---|---|
| `RAREZA_ARPG` | const | Rareza de botín para ARPG: se inclina hacia lo raro con el nivel sin tope (mitad del camino en el nivel 30). |
| `RAREZA_LOOTER` | const | Rareza de looter shooter: más generosa, menos escalones. |
| `RAREZA_MMO` | const | Rareza de MMO: lo épico viene de jefes y bandas, no del mundo. |
| `EQUIPO_ARPG` | const |  |
| `EQUIPO_LOOTER` | const |  |
| `TEMPLADO_BASE` | const |  |
| `PODER_RPG` | const | Jugador de RPG de acción: crece sublineal y se frena (sin parar) después del 50. |
| `PODER_SHOOTER` | const | Shooter: el poder casi no crece (lo decide la habilidad); la vida es fija. |
| `BALANCE_ACCION` | const |  |
| `BALANCE_MMO` | const |  |
| `DIFICULTAD_INFINITA` | const | Dificultad infinita (portales, mazmorras con nivel): +12 % vida y +8 % daño por nivel, compuestos. |
| `EXP_RPG` | const |  |
| `EXP_MMO` | const |  |
| `EXP_INFINITA` | const |  |
| `EXP_PARAGON` | const |  |
| `EXP_CUENTA` | const |  |
| `DESCANSO_MMO` | const |  |
| `MAESTRIA_USO` | const |  |
| `RECOMPENSA_PARTIDA` | const |  |
| `DANIO_ESTANDAR` | const |  |
| `LANZAMIENTO_MMO` | const |  |
| `LANZAMIENTO_MOBA` | const |  |
| `RENDIMIENTOS_PVP` | const |  |
| `MANA` | const |  |
| `ENERGIA` | const |  |
| `FURIA` | const |  |
| `ESTAMINA_ACCION` | const |  |
| `MOV_FPS_ARENA` | const |  |
| `MOV_FPS_TACTICO` | const |  |
| `MOV_TERCERA_PERSONA` | const |  |
| `SALUD_TACTICA` | const |  |
| `ASISTENCIA_MANDO` | const |  |
| `OLEADAS_BASE` | const |  |
| `PREMIO_ENCUENTRO` | const |  |
| `DUREZA_ENCUENTRO` | const |  |
| `DIRECTOR_ZOMBIS` | const |  |
| `DIRECTOR_MILITAR` | const |  |
| `INFINITO_ROGUELITE` | const |  |
| `CARRILES_MOBA` | const |  |
| `RECOMPENSA_MOBA` | const |  |
| `RANGOS_MOBA` | const |  |
| `REAPARICION_MOBA` | const |  |
| `SIGILO_BASE` | const |  |
| `NECESIDADES_SUPERVIVENCIA` | const |  |
| `NECESIDADES_COLONIA` | const |  |
| `DIA_NOCHE` | const |  |
| `IMPACTO_TACTICO` | const |  |
| `MAZO_ROGUELIKE` | const |  |
| `MAZO_COLECCIONABLE` | const |  |
| `TD_BASE` | const |  |
| `CAPTURA_BASE` | const |  |
| `ZONA_BATALLA_REAL` | const |  |
