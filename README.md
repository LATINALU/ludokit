# ludokit

**Una librería de mecánicas de videojuegos para cualquier género: RPG de acción, MMO, MOBA, shooters 3D,
extracción, supervivencia, zombis, carreras, estrategia, turnos, cartas, plataformas... y las mezclas entre ellos.**

ludokit reúne las **mecánicas puras** que se repiten en la mayoría de los juegos (movimiento, disparos, combate,
habilidades, botín, progresión, economía, IA, hordas, visión, turnos, vehículos, red, guardado) escritas como reglas
sin gráficos y **sin números de ningún juego concreto**. Encima de eso trae **58 modelos de género combinables**, un
**asistente de preguntas** que detecta qué juego estás haciendo y arma la configuración inicial, **catálogos de datos
propios** (armas y calibres, vehículos, enemigos, clases) y un **protocolo de feedback** para que arte y sonido
consuman la simulación. Sirve igual en la web, en Godot, Unity, Unreal, un motor propio o un servidor.

> **¿Trabajás con un asistente de IA?** Está preparado para eso: tu IA lee [`AGENTS.md`](AGENTS.md) y
> [`docs/IA.md`](docs/IA.md), consulta el [índice generado](docs/INDICE.md) y arma el plan con `npm run crear`. Ver la
> [sección 13](#13-para-asistentes-de-ia) con pedidos de ejemplo.

```ts
import { Pcg32, curva, modelos, disparos, datos, balance } from "ludokit";

// 1) ¿Qué juego estás haciendo? El asistente recomienda y combina modelos.
const r = modelos.recomendar({ nucleo: ["disparar", "supervivencia"], perspectiva: "primera", ambientacion: "zombis" });
r.combinacion.ids;   // ["shooter-extraccion", "mod-zombis"]
r.plan;              // pasos concretos con las clases a usar

// 2) Mecánicas puras con datos propios.
const azar = new Pcg32(42);
const ficha = datos.armas.aplicarAccesorios(datos.armas.ficha("carabina-556"), ["compensador", "mira-4x"]);
const arma = new disparos.Arma(ficha.arma, 120, { azar });
const bala = datos.armas.municion("5.56x45", "perforante");      // daño y penetración por energía

// 3) Escalado sin tope: el nivel 1, el 100 y el 10 000 funcionan igual.
const m = new balance.ModeloBalance(modelos.piezas.PODER_RPG, modelos.piezas.BALANCE_ACCION);
m.enemigo(10_000);
```

---

## Índice

1. [Qué es y qué no es](#1-qué-es-y-qué-no-es)
2. [Empezar: el asistente y los modelos](#2-empezar-el-asistente-y-los-modelos)
3. [Principios de diseño](#3-principios-de-diseño)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Instalación](#5-instalación)
6. [Catálogo de módulos](#6-catálogo-de-módulos)
7. [Datos propios](#7-datos-propios)
8. [Feedback: arte, sonido y sensación](#8-feedback-arte-sonido-y-sensación)
9. [Multijugador](#9-multijugador)
10. [Varios lenguajes](#10-varios-lenguajes)
11. [Ejemplos](#11-ejemplos)
12. [Pruebas, determinismo y verificación](#12-pruebas-determinismo-y-verificación)
13. [Para asistentes de IA: cómo la usa una IA](#13-para-asistentes-de-ia)
14. [Cómo extender la librería](#14-cómo-extender-la-librería)
15. [Crear tu propia versión y licencia](#15-crear-tu-propia-versión-y-licencia)
16. [Preguntas frecuentes](#16-preguntas-frecuentes)

**Todo lo que existe, archivo por archivo: [docs/INDICE.md](docs/INDICE.md)** (generado desde el código).

## 1. Qué es y qué no es

**Es** una caja de herramientas de sistemas de juego escrita como **dominio puro**: funciones y clases que reciben
datos y devuelven datos, sin tocar la pantalla, el teclado, la red ni el disco. Tu juego conecta esas piezas con su
motor de render, su audio y su interfaz.

**No es** un motor gráfico ni un editor, y **no es la copia de ningún juego**: no trae tablas, textos ni estadísticas
de juegos existentes. Las reglas reciben su configuración; los números de partida viven aparte (modelos y datos) y se
reemplazan sin tocar código.

- **Sin topes artificiales**: todo lo que escala (vida, rareza, experiencia, dificultad, oro) es una **curva** que
  acepta cualquier nivel. Nada tiene "último piso" salvo que tu juego lo pida.
- **Determinismo**: con la misma semilla, el mismo resultado en cualquier PC, en el servidor y en una repetición
  (protegido con golden master del estado y vectores compartidos entre lenguajes).
- **Balance derivado, no adivinado**: el modelo de *poder esperado* calcula enemigos y jefes desde cuántos golpes
  deberían aguantar y dar.
- **Lista para red**: el mismo código corre en el cliente (predicción) y en el servidor (autoridad), con
  compensación de lag para disparos.

## 2. Empezar: el asistente y los modelos

```bash
npm run crear            # preguntas → modelos sugeridos → mi-juego/ludokit.juego.json + mi-juego/PLAN.md
npm run crear -- --modelos shooter-extraccion,supervivencia-sandbox,mod-zombis   # combinar sin preguntas
```

Las **12 preguntas** (qué hace el jugador, perspectiva, tiempo real o turnos, con quién juega, cómo es una sesión, qué
lo hace más fuerte, qué pasa al morir, realismo, ambientación, enemigos, economía, si el contenido es infinito)
puntúan los modelos y deducen **modificadores**. El resultado es una configuración combinada (reglas, módulos, datos
sugeridos, mecánicas y conflictos resueltos) y un plan de implementación con las clases exactas.

**58 modelos** (lista completa con módulos en [docs/INDICE.md](docs/INDICE.md#modelos-por-género)):

| Familia | Modelos base |
|---|---|
| RPG de acción y botín | `arpg-botin`, `arpg-temporadas`, `looter-shooter`, `hack-and-slash`, `souls` |
| MMO | `mmo-tematico`, `mmo-accion`, `cooperativo-mazmorras` |
| MOBA y arenas | `moba`, `arena-heroes` |
| Shooters | `shooter-arena`, `shooter-tactico`, `shooter-extraccion`, `batalla-real`, `shooter-heroes`, `shooter-coberturas`, `disparos-naves` |
| Zombis y hordas | `hordas-zombis`, `guerra-zombis`, `supervivientes-hordas` |
| Supervivencia | `supervivencia-sandbox`, `supervivencia-zombi`, `extraccion-2d`, `colonia`, `granja-vida` |
| Roguelites | `roguelite-accion`, `roguelike-turnos` |
| Plataformas y lucha | `metroidvania`, `plataformas-precision`, `lucha-plataformas`, `lucha-1v1` |
| Turnos, cartas, estrategia | `jrpg`, `tactico-grilla`, `mazo-roguelike`, `cartas-coleccionables`, `gacha`, `rts`, `defensa-torres`, `defensa-laberinto`, `incremental` |
| Vehículos | `carreras-arcade`, `carreras-simulacion`, `rally`, `combate-vehicular` |
| Otros | `sigilo`, `terror-supervivencia`, `mundo-abierto-rpg`, `aventura-narrativa` |
| **Modificadores** | `mod-zombis`, `mod-militar`, `mod-supervivencia`, `mod-hardcore`, `mod-extraccion`, `mod-cooperativo`, `mod-competitivo`, `mod-servicio-vivo`, `mod-infinito`, `mod-mundo-persistente` |

```ts
const juego = modelos.combinar([modelos.modelo("carreras-arcade"), modelos.modelo("combate-vehicular"), modelos.modelo("mod-competitivo")]);
juego.reglas;      // reglas fusionadas en profundidad
juego.conflictos;  // [{ ruta: "marcador", modelos: [...], ganador: "..." }]: decidir a conciencia
```

## 3. Principios de diseño

1. **Azar y tiempo inyectados.** Ninguna regla llama a `Math.random()` ni a `Date.now()` (un test lo verifica).
2. **Paso fijo** (60 Hz) con dibujo interpolado.
3. **Curvas como datos** (`nucleo/escalado.ts`): `lineal`, `potencia`, `exponencial`, `saturacion`, `logistica`,
   `tramos`, `escalones`, `topeSuave`, `limitar`, `producto`, `suma`, `desplazar`, `escalar`. Serializables a JSON y
   evaluadas igual en TypeScript, Rust, C++ y Python.
4. **Resultados, no excepciones** para los casos esperados.
5. **Todo o nada** en lo que mueve valor.
6. **Eventos de dominio** hacia afuera; el **protocolo de feedback** los traduce para arte y sonido.
7. **Servidor autoritativo** de todo lo que da recompensa.
8. **Guardado versionado** con migraciones y respaldo.
9. **Capas estrictas**: el dominio no importa del motor, los gráficos, la red ni la infraestructura (un test lo
   verifica).

## 4. Estructura del repositorio

```
ludokit/
├─ src/
│  ├─ nucleo/            Azar (PCG32), reloj, Resultado, eventos, geometría 2D, vec3, curvas de escalado, i18n
│  ├─ motor/             Bucle fijo, ECS, FSM, tiempo, entrada, cámara, animador, pool, consola, táctil
│  ├─ espacial/          Colisiones 2D (AABB, SAT, barrido, DDA) y 3D (esfera, caja, cápsula, rayos sobre escena)
│  ├─ contextos/         28 contextos de dominio (sección 6)
│  ├─ modelos/           58 modelos combinables, piezas de reglas, combinar, asistente
│  ├─ datos/             Catálogos propios: armas, vehículos, criaturas, RPG
│  ├─ grafico/ animacion/ red/ infraestructura/
├─ herramientas/         crear.ts (asistente) · indice.ts (genera docs/INDICE.md y docs/catalogo.json)
├─ rust/                Núcleo de alto rendimiento + ABI C (include/ludokit.h) + adaptador C# (integraciones/)
│  └─ godot/            GDExtension para Godot 4 (godot-rust) + proyecto demo
├─ cpp/ python/          Ports verificados contra vectores/ (Python también usa el núcleo Rust por ctypes)
├─ shaders/              WGSL validados + GLSL generado
├─ vectores/             vectores.json (entre lenguajes) · golden.json (estado de simulaciones)
├─ terceros/vfx/         Motor de VFX por código (licencia MIT propia)
├─ ejemplos/             shooter 3D, plataformas, MMO, economía, sonidos
├─ test/                 Pruebas de TypeScript
├─ docs/                 IA, índice, arquitectura, determinismo, guía de implementación, lenguajes
├─ AGENTS.md CLAUDE.md llms.txt   Para asistentes de IA
└─ LICENSE               LLVA 1.0
```

## 5. Instalación

Requisitos: **Node.js ≥ 23.6** (ejecuta TypeScript directo). Opcional: Rust, Python 3 (Pillow y NumPy para arte),
un compilador de C++17.

```bash
git clone https://github.com/LATINALU/ludokit.git
cd ludokit
npm install
npm test               # 190 pruebas
npm run crear          # asistente
node ejemplos/shooter3d.ts
```

En un juego web con bundler: `npm i github:LATINALU/ludokit` e importar `ludokit` (también `ludokit/modelos` y
`ludokit/datos`). En un servidor Node, copiar `src/` o compilar con `tsc`.

Esqueleto mínimo:

```ts
import { Pcg32, motor } from "ludokit";
const azar = new Pcg32(semilla);
const entrada = new motor.Entrada();
const bucle = new motor.BucleFijo({ actualizar(dt) { entrada.muestrear(dt); /* reglas */ }, dibujar(alfa) { /* render */ } });
requestAnimationFrame(function cuadro(t) { bucle.avanzar(t / 1000); requestAnimationFrame(cuadro); });
```

## 6. Catálogo de módulos

Detalle de cada archivo y exportación: **[docs/INDICE.md](docs/INDICE.md)**.

| Módulo | Qué resuelve |
|---|---|
| (raíz) `nucleo` | `Pcg32`, `derivarSemilla`, `Resultado`, eventos, `V2`, **`vec3`**, **`curva`/`evaluar`**, tablas con validación, i18n |
| `motor` | `BucleFijo`, ECS, FSM jerárquica, `Entrada` con búfer, `Camara`, `Animador`, `Pool`, consola, táctil |
| `espacial` | Hash espacial, colisiones 2D, raycast DDA, **colisiones 3D** (`lanzarRayo`, `lanzarRayoTodos`, cápsulas) |
| `fisica` | Grilla de tiles, `Plataformero`, `MovilSuperior`, proyectiles, imán, **`Controlador3D`** (FPS/TPS: aceleración, strafe aéreo, sprint, agacharse, deslizar, coyote, búfer, doble salto, pendientes) |
| **`disparos`** | `Arma` (cadencia, semi/auto/ráfaga/cerrojo, cargador + recámara, recarga táctica/vacía/por cartucho, calentamiento, sobrecalentamiento, encasquillado), `Dispersion` (postura + bloom), `Retroceso` (patrón + recuperación), `asistirMira`, `resolverDisparo` (zonas, caída por distancia, penetración de paredes), `resolverBlindaje` (clases y penetración), proyectil balístico 3D, adelanto, `SaludPorPartes` (sangrado, fracturas) |
| `combate` | `Atributos` (plano/aumentado/más), `calcularDanio`, `Habilidades`, amenaza, estados, buffs, estilo, afijos, **`Lanzador`** (casteo, canalización, GCD, cola, empuje, interrupción por escuela), **recursos** (maná con pausa, furia, estamina con agotamiento, cargas), **`RendimientosDecrecientes`**, **`elegirObjetivo`** (prioridades de torre/TD) y **`tabObjetivo`** |
| `balance` | **`ModeloBalance`** (poder esperado desde curvas, enemigos y jefes de cualquier nivel), `simularPelea`, grados, **`NivelesDificultad`** (dificultad infinita), `escalarAlJugador`, `escalarPorJugadores`, `DificultadAdaptativa` |
| `botin` | Tablas de drop (3 modos), **rareza por nivel sin tope**, equipo con tiradas y afijos, fichas, conjuntos |
| `progresion` | Curvas de nivel (con tope o **infinitas**), recompensas, misiones, talentos, logros, calendario, **`Paragon`**, `prestigiar`, **`Descanso`**, **`Maestria`** por uso, **`Reputacion`** con facciones, **`PaseTemporada`** |
| `encuentros` | `CerebroJefe`, `EncuentroOleadas` con sellos (códigos), **`Director`** de ritmo (acumular/pico/relajar, presupuesto por tipo) |
| **`moba`** | Oleadas por carril con asedio/súper, estructuras con calentamiento y protección, oro por último golpe y racha, experiencia compartida, reaparición, rangos de habilidad |
| **`vision`** | `NieblaGuerra` con línea de visión, conos de visión, `Sospecha` (sigilo), propagación de ruido |
| **`grupo`** | Grupos y roles, buscador de grupo, necesidad/codicia, turnos, botín personal, bloqueos periódicos, contribución por daño |
| **`supervivencia`** | Necesidades con umbrales, temperatura corporal, durabilidad, nodos de recolección, ciclo día/noche, infección, frescura |
| **`turnos`** | Iniciativa, cola por tiempo con vista previa, puntos de acción, alcance en grilla, probabilidad táctica con cobertura y flanqueo |
| **`mazo`** | Robo/mano/descarte/agotadas, energía, retener, mulligan, búsqueda, curva de costos, probabilidad hipergeométrica |
| **`estrategia`** | Selección, grupos de control, formaciones, cola de producción, recolectores, economía de TD, construcción sin bloquear el camino |
| **`carreras`** | `Vehiculo` (curva de par, marchas, neumáticos con pico de deslizamiento, derrape, freno de mano, nitro), `Carrera` (controles, vueltas, posiciones), `Fantasma`, rubber banding |
| `competitivo` | Ranking, Elo, salas, torneos, **puntos de captura**, **marcador/tickets**, **zona segura** de batalla real, reapariciones por oleada |
| **`feedback`** | Protocolo de eventos → órdenes de impacto, sonido y efectos; estilos arcade/estándar/táctico/terror/accesible |
| `ia`, `navegacion`, `mundo` | Árboles, utilidad, steering, ataques por fases, IA que aprende · A*, campos de flujo · ruido, mazmorras llave/cerradura, cuevas, plantillas |
| `economia`, `inventario`, `coleccion`, `roguelite`, `narrativa`, `social` | Billetera, tienda, comercio, subasta, crafteo, templado, **compras reales (recibos verificados en servidor, idempotentes) y anuncios con recompensa** · inventario, vencimientos · gacha con piedad · extracción y legados · diálogos, **memoria narrativa y disparadores de consecuencias** · gremios y correo |
| `feel`, `audio`, `grafico`, `animacion` | Hitstop, trauma, muelles, Verlet, partículas · síntesis y música por capas · imagen, color, atlas, PNG · IK y esqueleto |
| `red`, `persistencia` | Servidor autoritativo, predicción, interpolación, interés, delta, **rebobinado 3D** · guardado versionado |

## 7. Datos propios

`import { datos } from "ludokit"`: catálogos **propios** (no copiados de ningún juego), pensados para copiar y cambiar.

- `datos.armas`: 15 calibres con física pública aproximada (masa, velocidad), 5 tipos de munición, conversión propia
  energía → daño y penetración, 8 blindajes por clase (1-6), 18 arquetipos de armas (pistolas a antimaterial,
  escopetas por cartucho, ametralladoras) con dispersión, retroceso y caída de daño, 10 accesorios por ranura.
- `datos.vehiculos`: 9 arquetipos (kart, compacto, deportivo, muscle, superdeportivo, rally, camión, fórmula, derrape)
  con curva de par, marchas y agarre; 8 superficies.
- `datos.criaturas`: 24 arquetipos (zombis, soldados, fantasía, bestias, máquinas) con pesos para el balance,
  conducta y costo para el director.
- `datos.rpg`: conjuntos de stats por género, 12 clases con rol y recurso, afinidades por tipo de daño, estados,
  rarezas.

## 8. Feedback: arte, sonido y sensación

El dominio emite `feedback.EventoJuego` (glosario fijo: golpe, crítico, aterrizaje, disparo, botín, alerta...) con
intensidad 0..1. `new feedback.TraductorFeedback(feedback.ESTILO_TACTICO).traducirPaso(eventos)` devuelve órdenes para
`feel.DirectorImpacto` (hitstop, sacudida, destello), para el audio (`audio.BancoSonidos`: nombre, volumen, tono,
prioridad) y para los efectos del motor (efecto, escala, color por rareza). Fusiona eventos repetidos del mismo paso,
pesa menos lo ajeno y trae **`ESTILO_ACCESIBLE`** (sin destellos ni sacudidas). Guías para arte, sonido, interfaz por
género y monetización responsable: [docs/IA.md](docs/IA.md).

## 9. Multijugador

```
CLIENTE                                               SERVIDOR (ServidorAutoritativo)
Entrada → PrediccionCliente.entrada() ──── input ───► descarta entradas viejas, duplicadas o imposibles
reconciliar(snapshot) ◄──────── snapshot + ackSeq ──── solo lo que cada jugador ve (área de interés), en delta
BuferInterpolacion (otros jugadores, −100 ms)          disparos: rebobinar(escena, HistorialPosiciones3D, ...)
```

Probar siempre con la red simulada `RED_MALA`. `node ejemplos/mmo.ts 500` mide el costo por tick con 500 jugadores.

## 10. Varios lenguajes

| Carpeta | Rol | Verificación |
|---|---|---|
| `src/` TypeScript | Referencia completa | 190 pruebas + tipos estrictos + golden master |
| `rust/` | **Núcleo de alto rendimiento**: rayos 3D con grilla + DDA, penetración, campo de flujo y hordas SoA (paralelas y deterministas), niebla de guerra, azar, física, hash espacial, A*, Verlet, curvas y balance, ruido; **ABI C** para Unity, Godot, Unreal y Python | 14 pruebas (igualdad con TS, grilla = lineal, paralelo = secuencial, ABI) + benchmark |
| `python/` | Herramientas: arte, validación, **balance desde curvas** (`--modelo`), catálogo, diff, hitboxes, **núcleo Rust por ctypes** (`nativo.py`) | 11 pruebas |
| `cpp/` C++17 | Header-only para Unreal y motores propios: azar, física, **curvas y `ModeloBalance`**, ruido | `cpp/pruebas.cpp` (todavía sin compilar: ver `cpp/LEEME.md`) |
| `shaders/` | WGSL → GLSL | validados con naga |

Detalle: [docs/LENGUAJES.md](docs/LENGUAJES.md).

### Por qué Rust (medido)

Misma carga, misma máquina (`node ejemplos/rendimiento.ts` contra `cargo run --release --example rendimiento`):

| Carga | TypeScript | Rust |
|---|---:|---:|
| 20 000 rayos contra 2 000 personajes | 2 553 ms | 675 ms con el mismo algoritmo · **23,5 ms con grilla + DDA** (108×) |
| Campo de flujo 256×256 ×20 | 651 ms | 168 ms (3,9×) |
| Horda de 50 000 agentes, por paso | — | 11,9 ms con 1 hilo · **4,2 ms con 24 hilos** (idéntico bit a bit) |
| Niebla de guerra 256×256, 100 fuentes ×30 | 62 ms | 23 ms (2,7×) |

**Godot 4 (GDScript)**: extensión nativa lista en [`rust/godot/`](rust/godot/LEEME.md) (`LudoEscena3D`, `LudoHorda`,
`LudoNiebla`, `LudoCurva`), probada en Godot 4.7.2 con una demo de 6 000 zombis a 60 FPS.

Qué mover a Rust y qué no, patrones (SoA, grilla por conteo, DDA, cero asignaciones, hilos deterministas) y cómo
usarlo desde Unity, Godot, Unreal, C, Python y la web: **[docs/RUST.md](docs/RUST.md)**.

## 11. Ejemplos

```bash
node ejemplos/rendimiento.ts             # benchmark TS (comparar con: cd rust && cargo run --release --example rendimiento)
node ejemplos/shooter3d.ts [semilla]     # shooter 3D táctico: arma + accesorios, penetración, blindaje, partes, director, lag, feedback
node ejemplos/plataformas.ts [semilla]   # plataformas: nivel procedural, controlador, IA, daño, impacto, estilo
node ejemplos/mmo.ts [jugadores]         # servidor autoritativo, interés, delta, anti-trampa
node ejemplos/economia.ts [semilla]      # fuentes y sumideros de oro con las reglas de un modelo
node ejemplos/sonidos.ts [carpeta]       # 31 .wav generados por código
```

## 12. Pruebas, determinismo y verificación

```bash
npm test             # pruebas (incluye golden master y reglas de arquitectura)
npm run tipos        # TypeScript estricto
npm run indice       # regenera el índice
npm run golden       # regenera el golden master (solo si una simulación cambió a propósito)
./verificar.sh       # todo, en todos los lenguajes (Windows: .\verificar.ps1)
```

El **golden master** guarda el estado completo de 7 simulaciones (controlador 3D, arma, salud por partes, vehículo,
director, turnos + mazo, lanzador) cada N pasos: si algo diverge, el test dice el campo y el paso. Tolerancias: exacto
dentro de TypeScript, ε relativo 1e-6 entre lenguajes. Ver [docs/DETERMINISMO.md](docs/DETERMINISMO.md).

## 13. Para asistentes de IA

ludokit está pensado para que **una IA (Claude Code, Cursor, Copilot, Codex, Gemini, un agente propio) lo use como un
desarrollador experto que lo conoce de memoria**, sin inventar funciones y sin repetir errores típicos.

### Qué lee la IA y para qué

| Archivo | La IA lo usa para… | Cuándo |
|---|---|---|
| [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) | Reglas no negociables y comandos | **Automático**: los asistentes de código los cargan al abrir el repo |
| [`docs/IA.md`](docs/IA.md) | Manual de experto de 0 a 100: modelo mental, flujo, recetas por género, feedback, red, rendimiento, errores típicos | Antes de escribir código |
| [`docs/INDICE.md`](docs/INDICE.md) | Saber **qué existe** (cada módulo, archivo, función y clase con su descripción) | Antes de usar una API: si no está acá, no existe |
| [`docs/catalogo.json`](docs/catalogo.json) | Lo mismo en datos: espacios, exportaciones, 58 modelos, preguntas, catálogos | Para buscar por código o filtrar |
| [`llms.txt`](llms.txt) | Resumen y mapa de documentos para modelos de lenguaje | Primer contacto / navegación |
| [`docs/SHOOTER-3D.md`](docs/SHOOTER-3D.md) · [`docs/MOTORES.md`](docs/MOTORES.md) · [`docs/RUST.md`](docs/RUST.md) | Referencias investigadas con fuentes: cómo se hace un shooter, cómo integrar con Unity/Godot/Unreal, cuándo usar Rust | Según el pedido |

Todo el índice se **genera desde el código** (`npm run indice`), así la IA nunca lee documentación desactualizada.

### Cómo trabaja una IA con ludokit (flujo esperado)

1. **Entender el juego** con el asistente en vez de adivinar:
   ```bash
   npm run crear -- --respuestas '{"nucleo":["disparar"],"perspectiva":"primera","jugadores":"competitivo","realismo":"intermedio"}'
   ```
   o en código `modelos.recomendar({...})`. Devuelve modelos sugeridos, reglas combinadas, módulos y un **plan con
   las clases exactas** (`mi-juego/PLAN.md`).
2. **Consultar el índice** para cada clase del plan antes de usarla.
3. **Implementar** siguiendo las reglas: azar (`Pcg32`) y `dt` inyectados, paso fijo, escalas como `Curva`, el
   dominio no dibuja (emite `feedback.EventoJuego`).
4. **Mover a Rust** lo que corre miles de veces por tick (rayos, hordas, visión): `docs/RUST.md`.
5. **Verificar**: `npm run tipos && npm test` (incluye golden master y pruebas de arquitectura que detectan
   `Math.random()` o imports prohibidos), y `npm run indice` si agregó exportaciones.

### Pedidos de ejemplo (copiar y pegar en tu asistente)

> Leé AGENTS.md y docs/IA.md. Quiero un **shooter 3D táctico en primera persona, 5 contra 5, en Godot con C#**.
> Usá `npm run crear` para elegir los modelos, seguí docs/SHOOTER-3D.md y docs/MOTORES.md, usá el núcleo Rust para
> los disparos del servidor y mostrame el plan antes de programar.

> Con ludokit, armá un **juego de guerra contra zombis** con escuadras, defensas y oleadas que crecen de noche. Combiná
> `guerra-zombis` con `mod-cooperativo`, usá `datos.criaturas` y la horda de Rust para 10 000 zombis.

> Agregá a mi ARPG **dificultad infinita y paragon** sin tocar las reglas: solo curvas y los modelos
> `arpg-temporadas` + `mod-infinito`. Escribí pruebas con semilla.

> Hacé un **juego de carreras arcade** web con Three.js: `carreras.Vehiculo` con `datos.vehiculos`, rubber banding
> suave, fantasma de contrarreloj y feedback de derrape con `feedback.friccionSonora`.

### Lo que una IA debe hacer siempre (y lo verifican las pruebas)

- No usar `Math.random()`, `Date.now()` ni `performance.now()` en reglas → **test de arquitectura**.
- No importar motor, gráficos, red, infraestructura, modelos ni datos desde el dominio → **test de arquitectura**.
- No inventar APIs: consultar `docs/INDICE.md`.
- No copiar números, nombres ni textos de juegos comerciales: usar `datos/` propios o los del usuario.
- No poner topes artificiales (niveles, pisos): usar `Curva`.
- Si cambia una simulación a propósito, `npm run golden` y explicar el cambio.
- Ofrecer `feedback.ESTILO_ACCESIBLE` (sin destellos ni sacudidas).

## 14. Cómo extender la librería

1. **Datos antes que código**: curvas, tablas, perfiles y modelos se reemplazan pasando los tuyos.
2. **Regla nueva** → `src/contextos/<x>/dominio/`, con cabecera de comentario y JSDoc (el índice los usa), azar y
   tiempo por parámetro, escalas como `Curva`, y su test con semilla.
3. **Simulación por pasos nueva** → escenario en `vectores/golden.ts` y `npm run golden`.
4. **Género nuevo** → modelo en `src/modelos/catalogo.ts` con rasgos para el asistente (el test valida módulos,
   rasgos y curvas).
5. `npm run verificar`.

## 15. Crear tu propia versión y licencia

ludokit se publica bajo la **Licencia ludokit de Uso y Versiones Abiertas (LLVA) 1.0** ([`LICENSE`](LICENSE)): uso
libre (también comercial) y versiones derivadas públicas permitidas. Para publicar tu versión:

- conservar `LICENSE` y el aviso de copyright;
- decir en tu README que está **basada en ludokit de LATINALU**, con enlace a este repositorio;
- indicar que la modificaste;
- no presentarla como la versión oficial.

Si solo **usás** ludokit en tu juego, alcanza con mencionarlo en los créditos. La carpeta
[`terceros/vfx/`](terceros/vfx/) conserva su **licencia MIT** propia.

## 16. Preguntas frecuentes

**¿Necesito usar todos los módulos?** No. Cada contexto depende solo del núcleo (y a veces de otro contexto).

**¿Funciona con mi motor?** Sí: la librería no dibuja ni lee el teclado. En Godot, Unity o Unreal se usa el núcleo en
Rust/C++ o se porta la regla, y se verifica con los vectores compartidos.

**¿Los números son obligatorios?** No. Las reglas no traen números de ningún juego: los modelos (`modelos.piezas`) y
los catálogos (`datos`) son puntos de partida propios. Cambialos por los tuyos.

**¿Hay un límite de niveles, pisos o dificultad?** No, salvo que tu juego lo defina: todas las curvas aceptan
cualquier nivel (`curva.topeSuave` frena el crecimiento sin cortarlo).

**¿Puedo mezclar géneros?** Sí: `modelos.combinar([...])` fusiona reglas y te muestra los conflictos.

**¿Puedo publicar un juego comercial?** Sí, con la atribución de la sección 15.
