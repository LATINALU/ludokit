# ludokit

**Una librería de dominio para construir videojuegos de cualquier género: desde un plataformas de un jugador hasta
un RPG multijugador masivo.**

ludokit reúne en un solo lugar las reglas, los sistemas y las herramientas que se repiten en casi todos los juegos:
física y movimiento que se sienten bien, combate de RPG, inteligencia artificial, botín y economía, generación
procedural de mundos, sensación de impacto (*game feel*), audio generado por código, netcode autoritativo y guardado
seguro. Todo está separado del motor gráfico, así que sirve igual en un juego web, en Godot, en Unity, en Unreal, en
un motor propio o en un servidor.

```ts
import { Pcg32, fisica, combate, mundo } from "ludokit";

const azar = new Pcg32(42);                                       // todo el azar sale de una semilla
const nivel = mundo.generarNivel(42, 1, { salas: 18 });           // un nivel jugable, siempre el mismo con la misma semilla
const jugador = new fisica.Plataformero(40, 200);                 // coyote time, búfer, salto variable, dash, bordes...
const golpe = combate.calcularDanio({ ataque: 30, probCritico: 0.1 }, { defensa: 12 }, azar);
```

---

## Índice

1. [Qué es y qué no es](#1-qué-es-y-qué-no-es)
2. [Principios de diseño](#2-principios-de-diseño)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Instalación y primeros pasos](#4-instalación-y-primeros-pasos)
5. [Arquitectura en capas (DDD)](#5-arquitectura-en-capas-ddd)
6. [Catálogo completo de módulos](#6-catálogo-completo-de-módulos)
7. [Recetas por género](#7-recetas-por-género)
8. [Multijugador: del cooperativo al MMO](#8-multijugador-del-cooperativo-al-mmo)
9. [Varios lenguajes: Rust, Python, C++ y shaders](#9-varios-lenguajes-rust-python-c-y-shaders)
10. [Ejemplos ejecutables](#10-ejemplos-ejecutables)
11. [Pruebas y verificación](#11-pruebas-y-verificación)
12. [Cómo extender la librería](#12-cómo-extender-la-librería)
13. [Crear tu propia versión](#13-crear-tu-propia-versión)
14. [Licencia](#14-licencia)
15. [Preguntas frecuentes](#15-preguntas-frecuentes)

---

## 1. Qué es y qué no es

**Es** una caja de herramientas de sistemas de juego, escrita como **dominio puro**: funciones y clases que reciben
datos y devuelven datos, sin tocar la pantalla, el teclado, la red ni el disco. Tu juego conecta esas piezas con su
motor de render, su audio y su interfaz.

**No es** un motor gráfico ni un editor. No dibuja nada por sí sola, aunque trae lo necesario para que dibujar sea
fácil: operaciones de imagen *pixel-perfect*, atlas, mapas de normales, shaders listos y un motor de efectos
visuales por código.

Qué ganas al usarla:

- **Sistemas probados**: 151 pruebas en TypeScript más pruebas en Rust y Python que comprueban que los números
  coinciden entre lenguajes.
- **Determinismo**: con la misma semilla, el mismo resultado en cualquier PC, en el servidor y en una repetición.
- **Balance derivado, no adivinado**: un modelo de *poder esperado* calcula la vida y el daño de enemigos y jefes
  a partir de cuántos golpes deberían aguantar y dar.
- **Lista para red**: el mismo código de simulación corre en el cliente (predicción) y en el servidor (autoridad).
- **Datos fuera del código**: perfiles de movimiento, tablas de botín, curvas de nivel, afijos y cajas son objetos
  que se reemplazan, no código que se reescribe.

## 2. Principios de diseño

1. **Azar y tiempo inyectados.** Ninguna regla llama a `Math.random()` ni a `Date.now()`: recibe un `Azar`
   (`Pcg32`, `AzarSemilla`) y un `Reloj`. Así hay repeticiones, tests reproducibles y bugs que se pueden investigar.
2. **Paso fijo.** La simulación avanza en pasos iguales (60 Hz) y el dibujo interpola. Los efectos hacen sub-pasos a
   120 Hz y las animaciones van en escalones de 12 fps.
3. **Resultados, no excepciones.** Los casos esperados (`"sin-fondos"`, `"en-recarga"`) se devuelven como
   `{ ok: false, error }`. Las excepciones quedan para los bugs.
4. **Todo o nada** en lo que mueve valor (compras, intercambios, crafteo): validar → entregar → cobrar.
5. **Eventos de dominio.** El dominio no reproduce sonidos ni crea partículas: emite `salto`, `aterrizaje` o
   `golpe`, y tu juego decide qué hacer con cada uno.
6. **Servidor autoritativo** de todo lo que da recompensa. El cliente predice, pero no decide.
7. **Guardado versionado** con migraciones, suma de integridad y respaldo: un guardado viejo o corrupto nunca hace
   crashear el juego.

## 3. Estructura del repositorio

```
ludokit/
├─ src/                  Implementación de referencia en TypeScript (Node ≥ 23.6 o cualquier bundler)
│  ├─ nucleo/            Azar (PCG32, mulberry32), Reloj, Resultado, eventos, geometría, tablas de datos, i18n
│  ├─ motor/             Bucle de paso fijo, ECS, FSM jerárquica, tiempo y tweens, entrada, cámara, animador, pool,
│  │                     consola de depuración, controles táctiles
│  ├─ espacial/          Hash espacial, colisiones (AABB, círculo, SAT, barrido continuo), raycast DDA
│  ├─ contextos/         18 contextos de dominio (ver sección 6), cada uno con dominio/ y, si hace falta, aplicacion/
│  ├─ grafico/           Imagen RGBA pixel-perfect, color OKLab + LUT, atlas, normales, curvas, fuente 3×5, PNG
│  ├─ animacion/         Esqueleto procedural de 21 puntos con IK y pistas de poses
│  ├─ red/               Netcode completo + red simulada para probarlo
│  └─ infraestructura/   Persistencia: memoria, localStorage y archivos con escritura atómica
├─ rust/                 Núcleo de alto rendimiento en Rust (nativo y WebAssembly)
├─ cpp/                  Núcleo header-only en C++17
├─ python/               Herramientas: sprites, validador, balance, catálogo, diff de datos, hitboxes
├─ shaders/              6 shaders WGSL validados + su versión GLSL ES 3.0 generada; compilador con naga
├─ vectores/             Vectores de prueba compartidos por todos los lenguajes
├─ terceros/vfx/         Motor de efectos visuales por código y criaturas por receta (licencia MIT propia)
├─ ejemplos/             Plataformas, servidor MMO, economía, generación de sonidos
├─ test/                 Pruebas de TypeScript
├─ docs/                 Arquitectura, guía de implementación por género, guía de lenguajes
├─ verificar.sh/.ps1     Verificación completa en todos los lenguajes
└─ LICENSE               Licencia LLVA 1.0 (sección 14)
```

## 4. Instalación y primeros pasos

**Requisitos:** Node.js 23.6 o más nuevo. Node ejecuta TypeScript directamente, sin compilar. Para el resto de las
piezas: Rust (opcional), Python 3 con Pillow y NumPy (opcional, para las herramientas de arte) y un compilador de
C++17 (opcional).

```bash
git clone https://github.com/LATINALU/ludokit.git
cd ludokit
npm install                    # solo herramientas de desarrollo (TypeScript para el chequeo de tipos)
npm test                       # 151 pruebas
npm run tipos                  # chequeo estricto de tipos
node ejemplos/plataformas.ts   # un plataformas completo, sin ventana, en la consola
```

**Usarla en tu proyecto:**

- **Copiar la carpeta** `src/` (o solo los contextos que necesites: cada uno depende únicamente de `nucleo/` y, a
  veces, de otro contexto).
- **Con un bundler** (Vite, esbuild, webpack) en un juego web: `npm i github:LATINALU/ludokit` e importar
  `ludokit`; el bundler compila los `.ts`. (Node no ejecuta TypeScript que esté dentro de `node_modules`: para
  un servidor en Node, copia `src/` a tu proyecto o compílala con `tsc`.)

**El esqueleto mínimo de cualquier juego:**

```ts
import { Pcg32, motor } from "ludokit";

const azar = new Pcg32(semilla);
const entrada = new motor.Entrada();                       // acciones remapeables: "saltar", "atacar"...
addEventListener("keydown", (e) => entrada.fijarFisico(e.code, true));
addEventListener("keyup", (e) => entrada.fijarFisico(e.code, false));

const bucle = new motor.BucleFijo({
  actualizar(dt) { entrada.muestrear(dt); /* reglas del juego */ },
  dibujar(alfa) { /* render interpolado con alfa */ },
});
requestAnimationFrame(function cuadro(t) { bucle.avanzar(t / 1000); requestAnimationFrame(cuadro); });
```

## 5. Arquitectura en capas (DDD)

```
TU JUEGO  (render, audio, UI, escenas del motor que elijas)
   │  consume eventos de dominio · dibuja interpolando · no contiene reglas
contextos/<x>/aplicacion/   casos de uso: orquestan dominio + puertos (repositorios, reloj)
contextos/<x>/dominio/      reglas puras
motor/ espacial/ grafico/ animacion/ red/
nucleo/                     kernel compartido
infraestructura/            adaptadores (persistencia)
```

- Las dependencias solo apuntan hacia abajo: el dominio no conoce el motor ni el disco.
- Cada **contexto delimitado** tiene su propio lenguaje, y los nombres pueden repetirse entre contextos. Por eso la
  raíz los exporta como espacios de nombres: `fisica.Plataformero`, `combate.Habilidades`, `red.ServidorAutoritativo`.
- Los **casos de uso** (`casoComprar`, `resolverMuerte`, `generarNivel`) muestran el patrón de una operación
  completa: cargar el agregado, aplicar la regla, guardar y registrar en una transacción.

Detalle completo, con el flujo de un paso de simulación y el flujo de red: **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

## 6. Catálogo completo de módulos

### Base

| Módulo | Qué resuelve |
|---|---|
| `nucleo` | `Pcg32`/`derivarSemilla` y `AzarSemilla` (azar determinista), `elegirPonderado`/`elegirPorPeso`, `RelojManual`, `Resultado`, `ColaEventos`, `V2`/`Rect`, `Tabla` con validación de referencias, lector de datos por bloques, `Textos` (i18n con respaldo y plurales) |
| `motor` | `BucleFijo` (paso fijo con interpolación y tope anti espiral), `MundoEcs` (ECS con sparse sets, generaciones, fases y comandos diferidos), `MaquinaEstados` jerárquica, `Agenda`, `Cooldown`, easing, `Entrada` por acciones con búfer, `Camara` (zona muerta, anticipo, límites, sacudida por trauma, sub-píxel), `Animador` compatible con Aseprite, `Pool`, `Consola` de depuración con guardado aislado, `ControlesTactiles` |
| `espacial` | `HashEspacial` (consultas, cercanos, pares), colisiones AABB, círculo, círculo-caja, SAT para polígonos, barrido continuo sin túnel, rayos contra cajas y círculos, `raycastGrilla` (DDA), `hayVision` |

### Movimiento, mundo e IA

| Módulo | Qué resuelve |
|---|---|
| `fisica` | `Grilla` de tiles con autotile de 4 bits, `Cuerpo` + `mover` (ejes separados, plataformas de un sentido, pinchos, corrección de esquinas), `Plataformero` (coyote time, búfer, salto variable, ímpetu, dash, paredes, colgarse de bordes, planeo, caída rápida), perfiles y arquetipos de personaje, `MovilSuperior` (8 direcciones), `Proyectil` y tiro en arco, botín con imán |
| `navegacion` | A* genérico con montículo binario, grafo de grilla de 4 u 8 direcciones sin cortar esquinas, suavizado por línea de visión, `CampoFlujo` para hordas |
| `ia` | Árboles de comportamiento, IA por utilidad con curvas de respuesta, steering (buscar, llegar, perseguir, evadir, deambular, bandada, evitar obstáculos), `AtaquePorFases` (anticipa → golpe → recupera), **IA que aprende del jugador** (`RastreadorHabitos`, `decidirEspejo`) y dificultad dinámica |
| `mundo` | Ruido (valor, gradiente, fBm, tileable, deformado), `generarMazmorra` con llave y cerradura validado por punto fijo, `construirSala` con recorrido garantizado, cuevas por autómata celular, plantillas ASCII con marcadores y espejo, `MapaExplorado` (niebla de guerra), caso de uso `generarNivel` |

### Combate y encuentros

| Módulo | Qué resuelve |
|---|---|
| `combate` | `Atributos` con modificadores en orden fijo (plano → aumentado → más → fijar) por fuente y derivados, `Recurso` (vida, maná), `calcularDanio` (tipos, resistencias, penetración, crítico, bloqueo), robo de vida con reserva, `Habilidades` (costo, recarga, cargas, recarga global, lanzamiento, canalización, interrupción), `TablaAmenaza` (aggro de grupo), `GestorEstados` (apilado, ticks, rendimiento decreciente de control), buffs, medidor de estilo D→SSS, afijos deterministas |
| `encuentros` | `CerebroJefe` (repertorio de ataques por datos, fases por vida, cada ataque avisado, nunca repite, recargas), `EncuentroOleadas` (variantes, élites, contrarreloj con tiempo extra, anti-bloqueo), premios con sellos de mérito y racha |
| `balance` | Modelo de **poder esperado** (`poderEsperado`, `enemigoEsperado`, `jefeEsperado`), `simularPelea`, puntaje requerido por nivel, grados de enemigo |

### Progresión, botín y economía

| Módulo | Qué resuelve |
|---|---|
| `progresion` | Curvas de nivel, recompensa de fin de partida, bonificaciones, misiones, puntos de habilidad, árbol de talentos, **logros** con contadores y puente a plataformas, **calendario** de contenido semanal y eventos anuales |
| `botin` | Tablas de botín en 3 modos con su probabilidad real, rareza por nivel con suerte y mínima garantizada, generador de equipo con tiradas, perfección, afijos y mejoras, botín por fichas, **conjuntos** con bonos de 2/4/6 piezas, engarces y fusión de runas |
| `coleccion` | Rareza tipo gacha con porcentajes visibles, fusión 3→1, mejora, cajas con **piedad** (umbral, cuotas por bloque, probabilidad suave), herencia de rasgos (resonancia, mutación, transmutación) |
| `inventario` | Inventario por pestañas con pilas (todo o nada), objetos con vencimiento, suscripciones, cajas con contenido |
| `economia` | Billetera multi-moneda, tienda con catálogo (lo que se muestra es lo que se cobra), venta, intercambio seguro entre jugadores, casa de subastas, **crafteo** y **templado**, caso de uso `casoComprar` con libro contable |
| `roguelite` | Riesgo y extracción con **legados** (lo que llevabas te espera donde caíste), modo infinito con piedad, casos de uso de muerte y recuperación |
| `narrativa` | Diálogos ramificados con condiciones, efectos, redirección, variables en el texto y validación del grafo |
| `social` · `competitivo` | Gremios y correo con adjuntos · ranking con temporadas, Elo, salas, emparejador y torneos por llaves |

### Sensación, audio, gráficos y animación

| Módulo | Qué resuelve |
|---|---|
| `feel` | `DirectorImpacto` (hitstop, trauma, cámara lenta, destello), remate de jefe en 3 tiempos, muelles amortiguados, squash & stretch que conserva el área, cuerdas y capas Verlet, campos de fuerza, partículas en arrays (SoA) |
| `audio` | Síntesis de sonido por código (tono, ruido, FM, grano, barrido), impactos por 7 materiales × 3 fuerzas, sonido de botín según la rareza, banco con variantes y antirepetición, exportación a WAV, **música adaptativa** por capas que cambia al compás |
| `grafico` | Imagen RGBA, reescalado pixel-perfect con contorno, silueta de golpe, giro de tono, color OKLab, paletas, gradación por LUT, empaquetador de atlas, mapas de normales automáticos, curvas centrípetas y estelas, fuente pixel 3×5 con números de daño, codificador PNG, parallax |
| `animacion` | IK de 2 huesos (2D y 3D con vector polo), esqueleto humanoide de 21 puntos resuelto desde manos y pies, orden de dibujo por profundidad, pistas de poses a 12 fps |

### Red y persistencia

| Módulo | Qué resuelve |
|---|---|
| `red` | Servidor autoritativo por ticks, predicción y reconciliación del cliente, interpolación de entidades remotas, áreas de interés con histéresis, compresión delta, sincronización de reloj, compensación de lag, limitador de tasa, protocolo binario, red simulada con latencia y pérdida |
| `persistencia` | `Guardado` (versión, integridad, migraciones, respaldo, apartar corruptos), repositorios y almacenes (memoria, localStorage, archivos atómicos) |

## 7. Recetas por género

La guía **[docs/GUIA-IMPLEMENTACION.md](docs/GUIA-IMPLEMENTACION.md)** explica, para cada género, qué contextos
tomar, en qué orden construir y con qué código arrancar:

| Género | Contextos principales |
|---|---|
| Plataformas / metroidvania | `fisica`, `mundo`, `ia`, `combate`, `feel` |
| ARPG / roguelike con botín | `fisica.MovilSuperior`, `navegacion`, `combate`, `botin`, `roguelite` |
| RPG por turnos / táctico | `motor.MaquinaEstados`, `navegacion`, `combate`, `narrativa`, `progresion` |
| Cartas coleccionables / gacha | `coleccion`, `economia`, `competitivo` |
| Tycoon / granja / simulación | `motor.Agenda`, `inventario`, `economia`, `progresion`, `mundo` |
| Shooter / bullet hell | `espacial`, `motor.Pool`, `ia`, `encuentros`, `feel` |
| Cooperativo / competitivo en línea | todo lo anterior + `red` |
| MMO / RPG multijugador | `red`, `combate.TablaAmenaza`, `economia` (casos de uso), `social`, `persistencia` |

El orden de construcción que se recomienda para cualquier proyecto es: bucle y entrada → control del jugador hasta
que se sienta bien → una mecánica central completa → balance por poder esperado → contenido como datos validados →
guardado versionado → *game feel* → red (si aplica, desde el principio).

## 8. Multijugador: del cooperativo al MMO

```
CLIENTE                                               SERVIDOR (ServidorAutoritativo)
Entrada → PrediccionCliente.entrada() ──── input ───► descarta entradas viejas, duplicadas o imposibles
         (aplica ya, guarda historial)                aplica ≤ N entradas por jugador por tick, simula el mundo
reconciliar(snapshot) ◄──────── snapshot + ackSeq ──── solo lo que cada jugador ve (área de interés)
BuferInterpolacion (otros jugadores, −100 ms)          delta contra el último estado que el cliente confirmó
```

1. Escribe la simulación del jugador como una **función pura** `aplicar(estado, entrada, dt)` y úsala igual en el
   cliente y en el servidor.
2. Prueba siempre con la red simulada `RED_MALA` (120 ms de latencia, 40 ms de variación, 5 % de pérdida y
   paquetes desordenados). La prueba de integración del repositorio lo hace con dos clientes.
3. Para un MMO: servidores de zona con `GestorInteres` y servicios transaccionales (tienda, correo, gremios) con
   libro contable. `node ejemplos/mmo.ts 500` mide el costo por tick y el ancho de banda con 500 jugadores.

## 9. Varios lenguajes: Rust, Python, C++ y shaders

Cada lenguaje cumple un rol, y todos reproducen los mismos números gracias a `vectores/vectores.json`:

| Carpeta | Lenguaje | Rol | Verificación |
|---|---|---|---|
| `src/` | TypeScript | Referencia completa | 151 pruebas + tipos estrictos |
| `rust/` | Rust | Núcleo rápido para servidores y WebAssembly: azar, física, hash espacial, A*, Verlet, balance, ruido | 6 pruebas contra los vectores |
| `python/` | Python | Herramientas de producción: arte, validación de contenido, balance, catálogos, notas de parche, hitboxes | 10 pruebas contra los vectores |
| `cpp/` | C++17 | Núcleo header-only para Unreal, motores propios y consolas | `cpp/pruebas.cpp` (ver `cpp/LEEME.md`) |
| `shaders/` | WGSL → GLSL | Postproceso, luz 2D, sombras por SDF, Jump Flooding, bloom Kawase, LUT | validados con naga; el GLSL se genera |

Por qué cada lenguaje va en cada capa, cómo combinarlos y cómo portar una regla sin que cambie un solo número:
**[docs/LENGUAJES.md](docs/LENGUAJES.md)**.

## 10. Ejemplos ejecutables

```bash
node ejemplos/plataformas.ts [semilla]   # nivel procedural, controlador, IA, daño, impacto, partículas, estilo
node ejemplos/mmo.ts [jugadores]         # servidor autoritativo, interés, delta, anti-trampa, ms por tick
node ejemplos/economia.ts [semilla]      # 200 partidas: de dónde entra el oro y por dónde sale
node ejemplos/sonidos.ts [carpeta]       # genera 31 .wav con el sintetizador (materiales, rarezas, cortes)
```

## 11. Pruebas y verificación

```bash
npm test                 # pruebas de TypeScript
npm run tipos            # chequeo estricto de tipos
./verificar.sh           # TODO: tipos, pruebas TS, Rust, shaders, Python y C++ si hay compilador (Windows: .\verificar.ps1)
```

Las pruebas cubren reglas con semilla fija, física con posiciones exactas, invariantes procedurales sobre cientos de
semillas (todo nivel es alcanzable, toda sala es recorrible), balance simulado nivel a nivel, netcode con pérdida de
paquetes y la igualdad numérica entre lenguajes.

## 12. Cómo extender la librería

1. **Cambia datos antes que código**: perfiles, tablas, curvas, afijos, cajas y recetas son objetos que se
   reemplazan pasando los tuyos.
2. **Implementa las interfaces**: `MundoServidor`, `PlataformaLogros`, `Almacen`, `Resolutor` de fichas, `Mundo` de
   diálogos. La librería define el contrato y tu juego lo cumple.
3. **Mantén el dominio puro**: si una regla nueva necesita azar o tiempo, recíbelos como parámetro.
4. **Prueba con semilla**: cada regla nueva lleva su test; si la portas a otro lenguaje, agrega sus casos a
   `vectores/generar.ts` y regenera el archivo.

## 13. Crear tu propia versión

La licencia permite **crear y publicar tus propias versiones** de ludokit: forks, ports a otros lenguajes o motores,
recortes, ampliaciones o traducciones, gratis o comerciales. Solo te pide:

- conservar el archivo `LICENSE` y el aviso de copyright;
- decir en tu README que tu versión está **basada en ludokit de LATINALU**, con un enlace a este repositorio;
- indicar que la modificaste (alcanza con un archivo de cambios o una nota);
- no presentarla como la versión oficial ni el original como obra propia.

Si solo **usas** ludokit dentro de tu juego, alcanza con mencionarlo en los créditos o en un archivo de licencias de
terceros.

## 14. Licencia

ludokit se publica bajo la **Licencia ludokit de Uso y Versiones Abiertas (LLVA) 1.0**: ver [`LICENSE`](LICENSE).
En resumen: uso libre (también comercial), versiones derivadas públicas permitidas con atribución, cambios
identificados y sin garantía.

La carpeta [`terceros/vfx/`](terceros/vfx/) contiene un motor de efectos visuales de terceros con **licencia MIT**
propia ([`LICENSE`](terceros/vfx/LICENSE) y [`NOTICE.md`](terceros/vfx/NOTICE.md)). Esa licencia se mantiene: si
redistribuyes esa carpeta, conserva sus avisos.

## 15. Preguntas frecuentes

**¿Necesito usar todos los módulos?** No. Cada contexto depende solo del núcleo (y a veces de otro contexto). Se
pueden copiar sueltos.

**¿Funciona con mi motor?** Sí: la librería no dibuja ni lee el teclado. En Godot, Unity o Unreal se porta la regla
al lenguaje del motor (o se usa el núcleo en Rust/C++) y se verifica con los vectores compartidos.

**¿Por qué TypeScript como referencia?** Corre en el navegador, en Node y en el servidor con el mismo código, que es
justo lo que la predicción de red necesita. Lo pesado tiene su versión en Rust.

**¿Los números por defecto son obligatorios?** No. Los presets (`*_ESTANDAR`, `REGLAS_*`, `*_EJEMPLO`) son puntos de
partida medidos. Cámbialos por los de tu juego.

**¿Puedo publicar un juego comercial hecho con esto?** Sí, con la atribución de la sección 13.
