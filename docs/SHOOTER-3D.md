# Cómo está hecho un shooter 3D (referencia interna)

El pedido más común es "hacé un juego de disparos en 3D". Esta página resume cómo se construye uno de verdad (qué
sistemas tiene, en qué orden, qué decisiones importan) y dónde está cada pieza en ludokit. Al final, fuentes.

## 1. Los sistemas de un shooter, de abajo hacia arriba

| # | Sistema | Decisión clave | ludokit |
|---|---|---|---|
| 1 | **Bucle de paso fijo** | Tick de simulación (60 Hz es buen punto de partida; competitivos usan 64–128) | `motor.BucleFijo({…}, { hz })` |
| 2 | **Movimiento** | Arena (rápido, strafe aéreo) o táctico (lento, inercia) | `fisica.Controlador3D` + `MOV_FPS_ARENA`/`MOV_FPS_TACTICO` |
| 3 | **Cámara y mira** | FOV, sensibilidad, apuntar con mira (ADS) reduce dispersión | `Dispersion` postura `"apuntando"` |
| 4 | **Arma** | Cadencia, modos, cargador, recargas | `disparos.Arma` |
| 5 | **Modelo de bala** | **Hitscan** (instantáneo, barato, imposible de esquivar) o **proyectil** (viaje y caída, más caro); muchos juegos mezclan según el arma o la distancia | `resolverDisparo` / `avanzarProyectil3D`, `puntoDeAdelanto` |
| 6 | **Imprecisión** | Dispersión (cono), *bloom* (crece al disparar seguido), retroceso (la mira se mueve, con patrón aprendible o aleatorio) | `Dispersion`, `Retroceso` |
| 7 | **Hitboxes y daño** | Cápsulas por zona; multiplicador de cabeza; caída por distancia | `espacial.Colisionador3D`, `ZONAS_HUMANOIDE`, `caidaDanio` |
| 8 | **Blindaje / salud** | Arcade (vida + escudo) o simulación (partes, penetración por clase) | `combate` / `SaludPorPartes` + `resolverBlindaje` |
| 9 | **IA** | Coberturas, flanqueo, supresión | `ia` (utilidad, árboles) + `datos.criaturas` |
| 10 | **Modos** | Duelo, equipos, captura, batalla real, extracción, hordas | `competitivo.*`, `encuentros.Director`, `roguelite` |
| 11 | **Red** | Servidor autoritativo + predicción + interpolación + **compensación de lag** | `red.*`, `rebobinar`, `HistorialPosiciones3D` |
| 12 | **Feedback** | Fogonazo, marcador de impacto, sonido por material, sacudida mínima en tácticos | `feedback.ESTILO_TACTICO` / `ARCADE` |

## 2. Red: lo que diferencia a un shooter que "se siente bien"

- **Ticks.** Un motor clásico de shooters simula en pasos discretos (15 ms ≈ 66 ticks/s); su sucesor usa 64 ticks con
  "sub-tick". Un shooter táctico competitivo moderno eligió **128 ticks** para que el que defiende tenga tiempo de
  reaccionar. Más ticks = menos ventaja del que asoma, más costo de servidor.
- **Interpolación.** El cliente dibuja a los demás un poco en el pasado (por defecto 100 ms en el motor clásico, para
  tener siempre dos instantáneas aunque se pierda una; hoy se recomienda menos). En ludokit: `BuferInterpolacion`.
- **Compensación de lag.** El servidor rebobina a los demás jugadores al momento que veía el tirador (latencia +
  interpolación) y resuelve el disparo ahí. En ludokit: `rebobinar(escena, historial, ahora, tiempoVistoPorCliente(ahora, rtt, interp), tope)`.
  Siempre con **tope** (0,2–0,25 s) para que un ping enorme no pegue detrás de las paredes.
- **Ventaja del que asoma (peeker's advantage).** Siempre existe en un juego en línea; se reduce con más ticks,
  menos interpolación y buen ruteo. Como referencia, un estudio de un shooter táctico consideró que unos 80 ms era una
  ventana "justa" en pruebas con profesionales.
- **Predicción + reconciliación.** El cliente aplica su propio movimiento al instante y corrige cuando llega el
  estado del servidor. En una arquitectura ECS de un shooter de héroes conocido, solo tres sistemas (movimiento,
  arma y estado scripteado) participan del netcode de gameplay: aislar lo que se predice simplifica todo.
- **Lockstep determinista** (enviar solo entradas) escala bien en ancho de banda pero se traba ante pérdida de
  paquetes; los shooters usan sincronización de estado/instantáneas.

## 3. Orden de construcción recomendado (para acertar desde el inicio)

1. `BucleFijo` + `Controlador3D` + cámara: **que moverse se sienta bien** antes de disparar.
2. Un arma hitscan (`Arma` + `resolverDisparo`) contra blancos estáticos con zonas.
3. Dispersión + retroceso + feedback (`ESTILO_*`): ajustar sensación con números de `datos.armas`.
4. Enemigos con IA o un segundo jugador local; `datos.criaturas` + `ModeloBalance` para vida/daño.
5. Modo de juego (`competitivo` / `encuentros.Director` / extracción).
6. Red: servidor autoritativo + predicción + rebobinado. **Diseñar para red desde el paso 1** si el juego es en línea
   (la simulación ya es pura y determinista).
7. Rendimiento: si el servidor resuelve muchos disparos o hay hordas, mover `Escena3D`/`Multitud` a Rust
   (`docs/RUST.md`).

Arranque en código: `npm run crear -- --modelos shooter-tactico` (o `shooter-arena`, `shooter-extraccion`,
`batalla-real`, `hordas-zombis`) y el ejemplo completo `node ejemplos/shooter3d.ts`.

## 4. Valores de partida (ajustar con pruebas)

| Parámetro | Arena | Táctico | Simulación / extracción |
|---|---|---|---|
| Velocidad caminar / correr (m/s) | 6 / 9 | 3,2 / 5,5 | 3 / 5 |
| Multiplicador cabeza | 2 | 4 | por partes (`PARTES_HUMANOIDE`) |
| Dispersión al correr | ×3,5 | ×3,5 + primer tiro perfecto quieto | ×3,5, sin primer tiro perfecto |
| Retroceso | aleatorio suave | **patrón fijo aprendible** | patrón + recuperación parcial |
| Hitstop / sacudida | sí | casi nula | nula |
| Tick | 60 | 64–128 | 30–60 (muchos jugadores/IA) |

## Fuentes

- Motor clásico de shooters — redes, interpolación y compensación de lag: <https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking> · ticks: <https://developer.valvesoftware.com/wiki/Tickrate> · interpolación: <https://developer.valvesoftware.com/wiki/Interpolation> · artículo de Yahn Bernier: <https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization>
- Shooter táctico con servidores de 128 ticks: <https://technology.riotgames.com/node/112> · ventaja del que asoma: <https://technology.riotgames.com/node/111> · cobertura con la cifra de 80 ms: <https://www.pcgamer.com/valorant-peekers-advantage-interview>
- Arquitectura ECS y netcode de un shooter de héroes (GDC 2017, Tim Ford): <https://gdcvault.com/play/1024001> · resumen de terceros: <https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback>
- Hitscan contra proyectiles: <https://www.gamedeveloper.com/programming/how-do-bullets-work-in-video-games-> · <https://gamedesignskills.com/game-design/hitscan/>
- Lockstep determinista y sincronización de estado: <https://gafferongames.com/post/deterministic_lockstep/> · <https://gafferongames.com/post/state_synchronization/>
- Campos de flujo para hordas: <https://howtorts.github.io/2014/01/09/continuum-crowds.html> · capítulo de Elijah Emerson en *Game AI Pro 360*: <https://www.taylorfrancis.com/books/9780429055096/chapters/10.1201/9780429055096-8>
