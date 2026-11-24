# ludokit para asistentes de IA: manual de experto

> Este documento enseña ludokit de 0 a 100 a otra IA (o a una persona) para que lo use como un desarrollador de
> videojuegos que lo conoce de memoria. Leelo entero una vez; después usá `docs/INDICE.md` (qué existe) y
> `docs/catalogo.json` (lo mismo en datos) como referencia. **Nunca inventes una función: si no está en el índice, no
> existe.** El índice se regenera desde el código con `npm run indice`.

---

## 0. En una frase

ludokit es una librería de **mecánicas puras de videojuegos** (reglas sin gráficos, sin motor, sin números de ningún
juego concreto) + **58 modelos de género combinables** + un **asistente de preguntas** que arma la configuración
inicial + **catálogos de datos propios** (armas, vehículos, enemigos, clases) + un **protocolo de feedback** para que
arte y sonido consuman la simulación.

## 1. Modelo mental (lo que tenés que saber antes de escribir una línea)

```
Juego (motor: Godot/Unity/Unreal/web)  ← dibuja, suena, lee el mando. NO tiene reglas.
   ▲ eventos de feedback (feedback.EventoJuego)       │ entrada (motor.Entrada) y dt fijo (motor.BucleFijo)
   │                                                   ▼
ludokit dominio (contextos/*/dominio)  ← reglas puras, deterministas, con azar y reloj INYECTADOS
   ▲ curvas y reglas (datos)
   │
modelos (presets combinables) + datos (catálogos)  ← números de partida, siempre reemplazables
```

1. **Las reglas no saben de gráficos.** Una regla devuelve un resultado o emite eventos; el juego decide qué dibujar.
2. **El azar y el tiempo se inyectan.** Toda función con azar recibe un `Azar` (`new Pcg32(semilla)`); todo lo que
   espera recibe `dt`. Prohibido `Math.random()` / `Date.now()` en el dominio (hay un test que lo verifica).
3. **Paso fijo.** La simulación avanza a 60 Hz con `motor.BucleFijo`; el dibujo interpola con `alfa`.
4. **Datos fuera del código.** Toda escala (vida por nivel, rareza, costo de experiencia, oro por minuto) es una
   `Curva` serializable (`nucleo/escalado.ts`). Nada tiene "último nivel" salvo que el juego lo pida.
5. **`Resultado` para lo esperado, excepciones para bugs.** `exito(v)` / `fallo("sin-fondos")`.
6. **Todo o nada** en lo que mueve valor (craftear, comprar, comerciar): se valida todo antes de tocar algo.
7. **Servidor autoritativo** para todo lo que da recompensas.

## 2. Flujo de trabajo de 0 a 100

1. **Descubrir el juego**: `npm run crear` (interactivo) o en código:
   ```ts
   import { modelos } from "ludokit";
   const r = modelos.recomendar({ nucleo: ["disparar", "supervivencia"], perspectiva: "primera", ambientacion: "zombis" });
   r.sugeridos;    // modelos ordenados con puntaje y por qué
   r.combinacion;  // reglas combinadas, módulos, datos, mecánicas, conflictos
   r.plan;         // pasos de implementación con las clases exactas
   ```
   Las preguntas están en `modelos.PREGUNTAS` (ids: nucleo, perspectiva, ritmo, jugadores, sesion, progresion,
   muerte, realismo, ambientacion, enemigos, economia, contenido). Si el usuario ya sabe lo que quiere, combiná a mano:
   `modelos.combinar([modelos.modelo("carreras-arcade"), modelos.modelo("combate-vehicular"), modelos.modelo("mod-competitivo")])`.
2. **Guardar la configuración** (`combinacion.reglas`) como JSON del juego y validarla al arrancar
   (`validarCurva`, `validarTablaRareza`, `python -m ludokit_herramientas.datos`).
3. **Esqueleto**: `BucleFijo` + `Entrada` + `Pcg32` (semilla por partida, `derivarSemilla` por sistema).
4. **Movimiento** del género (sección 4), **combate/disparos**, **enemigos** (balance + director/oleadas/IA).
5. **Progresión y economía** con las reglas del modelo.
6. **Feedback** (sección 6): eventos → `TraductorFeedback` → motor.
7. **Red** si hace falta (sección 7), **persistencia** versionada.
8. **Verificar**: tests con semilla fija, `balance.simularPelea`/`ModeloBalance.tabla`, golden master si tocás
   simulación, `./verificar.sh`.

## 3. Curvas: el vocabulario de todo el escalado

```ts
import { curva, evaluar, progreso } from "ludokit";
curva.lineal(base, porNivel)          // base + porNivel·(x−1)
curva.potencia(base, exp)             // base·x^exp   (exp<1 crece cada vez más lento)
curva.exponencial(base, razon)        // base·razon^(x−1)   dificultad infinita (+12 % por nivel = 1.12)
curva.saturacion(mitad, exp)          // progreso 0..1 sin tope; vale 0,5 en x = 1+mitad
curva.logistica(centro, pendiente)    // progreso en "S"
curva.tramos([[x,y],...], "plano"|"lineal")   // caída de daño por distancia, curvas de par de motor
curva.escalones([[desde,valor],...], inicial)
curva.topeSuave(c, desde, exp)        // igual a c hasta `desde`; después sigue creciendo más lento
curva.limitar(c, min, max) · curva.producto(...) · curva.suma(...) · curva.desplazar(c, d) · curva.escalar(c, k)
```

Reglas de uso: **x = nivel/profundidad/minuto, empieza en 1**. Para "progreso del juego" (mezclar tablas) usá
`saturacion` o `logistica` (nunca llegan a 1: el contenido puede ser infinito). Para "cuánto más fuerte",
`potencia`/`topeSuave`. Para "cuánto más difícil sin fin", `exponencial`. Las curvas son JSON: se guardan en datos,
se grafican con `muestrear`, y Rust/C++/Python las evalúan igual.

## 4. Recetas por género (qué clases usar)

Cada receta es la columna vertebral; el modelo correspondiente trae los números.

| Género (modelo) | Movimiento | Núcleo | Enemigos | Progresión | Extra |
|---|---|---|---|---|---|
| Shooter 3D arena/táctico (`shooter-arena`, `shooter-tactico`) | `fisica.Controlador3D` (`MOV_FPS_ARENA`/`TACTICO`) | `disparos.Arma` + `Dispersion` + `Retroceso` + `resolverDisparo` sobre `espacial.Colisionador3D` | jugadores / `ia` | habilidad | `red.rebobinar` + `HistorialPosiciones3D`, `competitivo.Marcador` |
| Extracción táctica (`shooter-extraccion`) | Controlador3D táctico | + `datos.armas.municion` + `resolverBlindaje` + `SaludPorPartes` + accesorios | `encuentros.Director` (`DIRECTOR_MILITAR`) | botín, base | `supervivencia.Necesidades`, `roguelite.RegistroLegados`, inventario por peso |
| Batalla real (`batalla-real`) | Controlador3D | disparos | jugadores | botín en el suelo | `competitivo.ZonaSegura` |
| Hordas zombi (`hordas-zombis`, `mod-zombis`) | Controlador3D | disparos | `encuentros.Director` (`DIRECTOR_ZOMBIS`), `navegacion.CampoFlujo` | — | `supervivencia.Infeccion`, `balance.escalarPorJugadores` |
| Guerra vs zombis (`guerra-zombis`) | unidades RTS | `estrategia` (selección, formaciones, producción, construcción) + `combate.elegirObjetivo` | Director + oleadas | base | `supervivencia.CicloDia` (noche peligrosa) |
| ARPG (`arpg-botin`, `arpg-temporadas`) | `fisica.MovilSuperior` o 3D | `combate.Atributos`, `calcularDanio`, `Habilidades` | `balance.ModeloBalance.enemigo/jefe`, `encuentros.CerebroJefe` | `botin.tirarRareza` + `generarPieza`, `progresion.ArbolTalentos`, `Paragon` | `balance.NivelesDificultad` |
| MMO de objetivo (`mmo-tematico`) | 3D | `combate.Lanzador` (casteo, GCD, cola), `TablaAmenaza`, `RendimientosDecrecientes` | balance MMO | niveles + `Descanso` + `Reputacion` + `Maestria` | `grupo.*` (roles, reparto, bloqueos), `social`, `economia.subasta` |
| MOBA (`moba`) | superior/isométrica | habilidades con `Cargas`, `Lanzador` sin GCD | `moba.GeneradorCarriles`, `moba.Estructura` | `moba.puedeSubirRango`, oro (`oroAsesinato`, `recompensaUnidad`) | `vision.NieblaGuerra`, `tiempoReaparicion` |
| Carreras (`carreras-arcade`, `-simulacion`, `rally`) | `carreras.Vehiculo` (`datos.vehiculos`) | `carreras.Carrera` (vueltas, posiciones) | IA con `rubberBanding` | — | `Fantasma`, `datos.vehiculos.SUPERFICIES`, `feedback.friccionSonora` |
| Plataformas/metroidvania | `fisica.Plataformero` | `combate` | `ia.AtaquePorFases` | habilidades = llaves | `mundo.generarMazmorra` |
| Roguelite/roguelike | según perspectiva | combate | `encuentros.EncuentroOleadas` | meta-progreso | `roguelite.haySalida`, `mundo` |
| Turnos JRPG / táctico | — | `turnos.ColaTiempo` / `PuntosAccion` + `alcanceGrilla` + `probImpactoTactico` | balance | niveles | `vision` |
| Cartas (`mazo-roguelike`, `cartas-coleccionables`) | — | `mazo.Mazo` | intenciones | colección | `coleccion.abrirConPiedad` |
| RTS / TD | — | `estrategia.*` | oleadas | — | `vision.NieblaGuerra`, `estrategia.interesTD` |
| Supervivencia / colonia | Controlador3D o superior | `supervivencia.*` | Director suave | base | `economia.craftear` |
| Sigilo / terror | 3D | `vision.Sospecha` + `enConoDeVision` + `propagarRuido` | `ia` árboles | — | `feedback.ESTILO_TERROR` |
| Incremental | — | curvas exponenciales | — | `progresion.prestigiar`, `Descanso` (offline) | — |

Mezclar géneros = combinar modelos. Ejemplo "carreras + disparos": `carreras.Vehiculo` mueve, una `disparos.Arma`
montada dispara con `puntoDeAdelanto` para apuntar a blancos en movimiento.

### Snippets mínimos

```ts
// Shooter: un paso
for (const ev of arma.actualizar(dt, gatillo)) if (ev.tipo === "disparo") {
  const dir = dispersion.disparar(mira, postura, azar);
  retroceso.disparar(ev.numero, azar, control);
  const escena = rebobinar(colisionadores, historial, ahora, tiempoVistoPorCliente(ahora, rtt, 0.1));
  for (const h of disparos.resolverDisparo(escena, ojos, dir, { alcance, danio: bala.danio, caida, zonas, materiales, poder: bala.penetracion })) { /* blindaje → salud → feedback */ }
}
dispersion.actualizar(dt); retroceso.actualizar(dt);

// RPG: enemigo de cualquier nivel desde el modelo
const m = new balance.ModeloBalance(reglas.balance.curva, reglas.balance.reglas);
const stats = m.enemigo(nivel, arquetipo.pesoVida, arquetipo.pesoAtaque);

// MMO: casteo
lanzador.lanzar({ id: "bola", lanzamiento: 2, escuela: "fuego" }, moviendose);
for (const e of lanzador.actualizar(dt, moviendose)) if (e.tipo === "completado") aplicarHechizo(e.id);

// Hordas
for (const tipo of director.actualizar(dt, vivosPorTipo)) aparecer(tipo);
```

## 5. Datos propios (`import { datos } from "ludokit"`)

- `datos.armas`: `CALIBRES` (físicos públicos aproximados), `municion(calibre, tipo)` → daño/penetración por energía,
  `BLINDAJES` (clases 1-6), `ZONAS_HUMANOIDE`, `PARTES_HUMANOIDE`, `ARMAS` (18 arquetipos con dispersión, retroceso,
  caída), `ACCESORIOS` + `aplicarAccesorios`. Son **arquetipos propios**, no copias de ningún juego: no agregues
  nombres ni estadísticas de juegos comerciales.
- `datos.vehiculos`: 9 arquetipos con curva de par, marchas, agarre; `SUPERFICIES`.
- `datos.criaturas`: arquetipos (zombis, soldados, fantasía, bestias, máquinas) con pesos de vida/ataque, conducta,
  costos para el director; `tiposDeAparicion(ids)`.
- `datos.rpg`: conjuntos de stats por género, clases con rol y recurso, `AFINIDADES`, `ESTADOS`, `RAREZAS`.

## 6. Protocolo de feedback (arte, sonido, sensación)

El dominio emite `feedback.EventoJuego { tipo, intensidad 0..1, material?, etiqueta?, propio? }` con el glosario fijo
(golpe, critico, recibir-golpe, parada, esquiva-perfecta, muerte, muerte-jefe, salto, aterrizaje, dash, disparo,
impacto-bala, explosion, recarga, vacio, curacion, nivel-subido, botin, alerta, sospecha, fase-jefe, derrape,
choque...). `new feedback.TraductorFeedback(estilo).traducirPaso(eventos)` devuelve órdenes:
- `impacto` → `feel.DirectorImpacto.aplicar(orden)` (hitstop, trauma, cámara lenta, destello);
- `sonido` → `audio.BancoSonidos.tocar(nombre, ...)` o el motor de audio (volumen, tono, prioridad);
- `visual` → partículas/VFX del motor (efecto, escala, color por rareza/elemento, duración).

Normalizadores: `intensidadDanio(danio, vidaMax)`, `intensidadCaida`, `intensidadRareza`, `friccionSonora(velocidad,
tope, agarre)` (bucles de deslizamiento/derrape). Estilos: `ESTILO_ARCADE`, `ESTANDAR`, `TACTICO`, `TERROR` y
**`ESTILO_ACCESIBLE`** (sin destellos ni sacudidas; ofrecerlo siempre en opciones).

Guías para arte:
- **Hitbox ≠ dibujo.** La hitbox del jugador es un poco más chica que su arte (perdona); la de los enemigos, igual o
  un poco más grande (se siente justo). Documentá la relación por estilo (pixel art: en píxeles enteros; 3D: cápsulas).
- **Todo ataque enemigo se telegrafía** (`encuentros.CerebroJefe` da `aviso` en segundos; `ia.AtaquePorFases` tiene
  anticipación): el arte debe mostrar la anticipación durante ese tiempo exacto.
- **Rareza = color + sonido + altura del haz** coherentes en todo el juego (`datos.rpg.RAREZAS`).
- **Legibilidad antes que detalle**: siluetas distintas por arquetipo (`datos.criaturas`), contraste de amenazas.

Guías para sonido: el sintetizador (`audio`) genera impactos por material y fuerza, rarezas, cortes y música por
capas (`audio.DirectorMusical`: subir energía con el `Director` de enemigos o con la intensidad de combate). Los
sonidos de eventos se disparan en el mismo paso fijo en que ocurre el evento; los ajenos pesan menos que los propios
salvo en terror.

Ajuste de sensación (rangos de partida): coyote 0,06–0,12 s · búfer de salto 0,08–0,15 s · hitstop 30–80 ms
(críticos hasta 120) · trauma por golpe 0,1–0,3 · aceleración FPS arena 60–80 m/s², táctico 20–30.

## 7. Red

- Servidor autoritativo (`red.ServidorAutoritativo`), predicción y reconciliación en el cliente
  (`PrediccionCliente`), interpolación de otros (`BuferInterpolacion`), interés por zona, delta.
- Shooters: rebobinado (`red.rebobinar` + `HistorialPosiciones3D`, tope 0,2–0,25 s), `tiempoVistoPorCliente`.
- Todo lo que da recompensa se decide en el servidor; el cliente predice movimiento y feedback, nunca botín.

## 8. Diseño de experiencia e interfaz por género

| Género | Lo que el HUD debe mostrar siempre | Arco emocional |
|---|---|---|
| Shooter | munición (cargador/reserva), estado del arma (recargando/encasquillada), indicador de daño direccional | tensión → descarga → respiro |
| Extracción | peso, partes del cuerpo y estados, tiempo/puntos de extracción | riesgo creciente → huida → alivio/pérdida |
| ARPG | vida/recurso, recargas, botín con color de rareza, comparación de equipo | poder que crece; picos de botín |
| MMO | barra de casteo, GCD, amenaza, marcos de grupo, rendimientos decrecientes | rutina social; picos en bandas |
| MOBA | oro, nivel, rangos, mini mapa con niebla, temporizadores de reaparición | ventaja que se acumula; remontadas |
| Carreras | posición, vuelta, tiempo de vuelta/mejor, velocímetro y marcha, nitro | duelo cerrado (rubber banding suave) |
| Turnos | vista previa de turnos (`ColaTiempo.previsualizar`), probabilidad de impacto | planificación → resultado |
| Supervivencia | necesidades con umbrales, hora del día, durabilidad | escasez → estabilidad → amenaza |
| Sigilo | medidor de sospecha por guardia, ruido propio | tensión sostenida |

## 9. Monetización responsable

Si el juego monetiza, usá lo que ya existe y separá **cosmético** de **poder**:
- **Pase de temporada** (`progresion.PaseTemporada`: carril gratis/premium, niveles extra infinitos).
- **Cajas**: siempre con **probabilidades visibles** (`coleccion.probabilidadesVisibles`, obligatorio en muchos
  países) y **piedad** (`coleccion.abrirConPiedad`). Nunca vender poder directo en modos competitivos.
- **Suscripciones** (`inventario.Suscripcion`, `aplicarVip`) para comodidad (más espacio), no para poder.
- Economía sana: medí fuentes y sumideros (`ejemplos/economia.ts`). No diseñes para "forzar" la repetición: premiá
  volver (misiones, calendario) sin castigar no volver.

## 10. Errores típicos que tenés que evitar

- Usar `Math.random()` o el reloj del sistema en reglas → rompe repeticiones, red y tests.
- Escribir fórmulas de escalado a mano o tablas de largo fijo → usá `Curva` (sin tope).
- Inventar funciones que no existen → consultá `docs/INDICE.md`.
- Meter números de un juego comercial (armas, tablas, textos) → usá `datos/` propios o datos del usuario.
- Mover el dominio dentro del motor (lógica en scripts de nodos) → el motor solo adapta.
- Cambiar una simulación sin regenerar el golden master (`npm run golden`) y sin explicar el cambio.
- Olvidar `ESTILO_ACCESIBLE` y las opciones de accesibilidad.

## 11. Cómo extender ludokit

1. Regla nueva → `src/contextos/<contexto>/dominio/<archivo>.ts` con cabecera de comentario (la usa el índice) y
   JSDoc en cada exportación. Azar y tiempo por parámetro. Escalas con `Curva`.
2. Exportarla en el `index.ts` del contexto (y el contexto en `src/index.ts`).
3. Test en `test/` con semilla fija. Si es simulación por pasos, agregar un escenario a `vectores/golden.ts`.
4. Si se usa en un género, sumarla a las `mecanicas`/`modulos` del modelo en `src/modelos/catalogo.ts` (y si hace
   falta, reglas en `piezas.ts`).
5. `npm run verificar` (tipos + tests + índice). Si toca números compartidos, `node vectores/generar.ts` y los ports.

## 12. Rendimiento: cuándo usar el núcleo Rust

Regla práctica (medida en `docs/RUST.md`): **si algo corre miles de veces por tick** (rayos de disparos con
rebobinado, hordas de miles, niebla de RTS, pathfinding masivo, simulación de servidor con muchos jugadores), usar
el núcleo Rust: `rust/src/colision3d.rs` (`Escena3D`: 108× más rápido que la búsqueda lineal en TS),
`multitud.rs` (`Multitud::paso_paralelo`, determinista), `niebla.rs`, `balistica.rs`. Desde Unity/Godot C#:
`rust/integraciones/csharp/LudokitNativo.cs`; desde C/C++/Unreal: `rust/include/ludokit.h`; desde Python:
`ludokit_herramientas.nativo`. **Una llamada por lote**, nunca una por entidad. Lo que cambia seguido (reglas de
diseño) se queda en TypeScript/C#.

Para pedidos de "un shooter 3D", seguir `docs/SHOOTER-3D.md` (sistemas, orden de construcción, red con fuentes).
Para integrar con un motor, `docs/MOTORES.md`.

## 13. Narrativa y monetización como sistemas

- `narrativa.MemoriaNarrativa` + `narrativa.Disparadores`: el dominio emite eventos ("jefe-vencido" con datos), los
  disparadores (datos) registran hechos, cambian relaciones con personajes y piden acciones (abrir diálogo, iniciar
  misión). La memoria implementa `Mundo`: los diálogos leen `relacion.herrero`, `leyenda`, `veces.muerte`.
- `economia.canjearRecibo` (puerto `PuertoTienda`, repositorio idempotente por transacción) y
  `economia.AnunciosConRecompensa` (tope diario, espera, confirmación del SDK): el cliente nunca acredita.

## 14. Verificación

```bash
npm run tipos      # TypeScript estricto
npm test           # todas las pruebas (incluye golden master y reglas de arquitectura)
npm run indice     # regenera docs/INDICE.md y docs/catalogo.json
./verificar.sh     # además Rust, Python y C++ (si hay compilador)
```

Determinismo y tolerancias: `docs/DETERMINISMO.md`.
