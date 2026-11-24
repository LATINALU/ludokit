# Arquitectura de ludokit

## Capas (Domain-Driven Design)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  TU JUEGO (render, audio, UI, escenas del motor)                                         │
│     consume eventos de dominio · dibuja con alfa del bucle · no contiene reglas           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  contextos/<x>/aplicacion/   CASOS DE USO: orquestan dominio + puertos (repos, reloj)    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  contextos/<x>/dominio/      REGLAS PURAS: agregados, value objects, servicios de dominio │
│  red/                        netcode (servidor autoritativo, predicción, interés, delta)  │
│  motor/  espacial/           bucle fijo, ECS, FSM, tiempo, entrada, cámara · colisiones   │
│  grafico/  animacion/        imagen, color, atlas, normales, curvas · esqueleto e IK      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  nucleo/                     KERNEL COMPARTIDO: Azar, Reloj, Resultado, eventos, geom     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  infraestructura/            ADAPTADORES: persistencia (memoria, localStorage, archivos)  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regla de dependencias**: hacia abajo nada más. El dominio no importa del motor ni de la infraestructura. El motor
no conoce el combate. La infraestructura implementa interfaces (puertos) que declaran el dominio o la aplicación.

## Contextos delimitados

| Contexto | Agregados / servicios principales | Lenguaje propio |
|---|---|---|
| `fisica` | `Grilla`, `Cuerpo`, `mover`, `Plataformero`, `MovilSuperior`, `Proyectil`, perfiles, `Controlador3D` | celda, plataforma, coyote, búfer, ímpetu, cornisa, strafe, pendiente |
| `navegacion` | `aEstrella`, `grafoGrilla`, `CampoFlujo`, suavizado | grafo, heurística, campo |
| `ia` | árbol de comportamiento, IA por utilidad, steering, `AtaquePorFases` | nodo, pizarra, consideración, fase |
| `combate` | `Atributos` + `Recurso`, `calcularDanio`, `Habilidades`, `TablaAmenaza`, `GestorEstados`, `GestorBuffs`, `MedidorEstilo`, afijos, `Lanzador`, recursos (maná, furia, estamina, cargas), `RendimientosDecrecientes`, `elegirObjetivo` | modificador, mitigación, recarga, amenaza, pila, casteo, GCD, escuela, tenacidad |
| `disparos` | `Arma`, `Dispersion`, `Retroceso`, `asistirMira`, `resolverDisparo`, `resolverBlindaje`, proyectil 3D, `SaludPorPartes` | cadencia, recámara, bloom, patrón, zona, penetración, clase, sangrado |
| `encuentros` | `CerebroJefe`, `EncuentroOleadas`, `premioEncuentro`, `Director` | repertorio, fase, aviso, oleada, sello, racha, intensidad, presupuesto |
| `audio` | síntesis por recetas, `BancoSonidos`, `DirectorMusical` | material, fuerza, capa, compás, energía |
| `balance` | `ModeloBalance` (curvas sin tope), `simularPelea`, `NivelesDificultad`, `escalarAlJugador`, `DificultadAdaptativa` | poder esperado, golpes para matar/morir, dificultad infinita |
| `botin` | tablas de drop (3 modos), rareza por nivel, `generarPieza`, fichas | ficha, rareza mínima, tirada, perfección |
| `coleccion` | cartas (rareza, fusión, mejora), `abrirConPiedad` | estrella, fusión, piedad, cuota |
| `inventario` | `Inventario`, vencimiento/suscripciones, cajas | pestaña, casilla, pila |
| `economia` | `Billetera`, `Catalogo`/`comprar`, venta, comercio, subasta, **caso `casoComprar`** | moneda, medio de pago, ledger |
| `progresion` | curvas de nivel (con tope o infinitas), recompensas, misiones, puntos de habilidad, `ArbolTalentos`, `Paragon`, `Descanso`, `Maestria`, `Reputacion`, `PaseTemporada` | umbral, premio, senda, paragon, facción, carril |
| `mundo` | ruido, `generarMazmorra` (llave/cerradura), `construirSala`, cuevas, **caso `generarNivel`** | sala, conexión, cerradura, llave |
| `roguelite` | `RegistroLegados`, modo infinito con piedad, **casos de muerte/recuperación** | incursión, legado, extracción |
| `narrativa` | `Dialogo` con condiciones, efectos e interpolación | nodo, opción, condición, efecto |
| `feel` | `DirectorImpacto`, muelles, `Elastico`, `Cuerda`, `Campos`, `Particulas` | hitstop, trauma, squash & stretch |
| `social` | gremios, correo con adjuntos | rango, buzón |
| `competitivo` | ranking con temporadas + Elo, salas y emparejador, `PuntoCaptura`, `Marcador`, `ZonaSegura`, `Reapariciones` | puesto, temporada, cola, captura, ticket, zona |
| `moba` | `GeneradorCarriles`, `Estructura`, oro y experiencia, reaparición, rangos | carril, oleada, súbdito, último golpe, recompensa por racha |
| `vision` | `NieblaGuerra`, `enConoDeVision`, `Sospecha`, `propagarRuido` | explorado, visible, sospecha, alerta |
| `grupo` | `Grupo`, `armarGrupos`, reparto de botín, `Bloqueos`, `Contribucion` | rol, necesidad, codicia, bloqueo |
| `supervivencia` | `Necesidades`, temperatura, `Durabilidad`, `NodoRecoleccion`, `CicloDia`, `Infeccion` | umbral, desgaste, nodo, fase del día |
| `turnos` | `ordenIniciativa`, `ColaTiempo`, `PuntosAccion`, `alcanceGrilla`, `probImpactoTactico` | iniciativa, carga, PA, cobertura, flanqueo |
| `mazo` | `Mazo`, curva de costos, probabilidad de robo | robo, mano, descarte, agotar, energía |
| `estrategia` | selección, formaciones, `ColaProduccion`, `Recolector`, `CuadriculaConstruccion`, economía TD | formación, población, recolector, interés |
| `carreras` | `Vehiculo`, `Carrera`, `Fantasma`, `rubberBanding` | par, marcha, deslizamiento, control, vuelta |
| `feedback` | `TraductorFeedback`, estilos, normalizadores | evento, intensidad, orden, estilo |

Encima del dominio, sin que el dominio los conozca: `modelos/` (58 modelos combinables, piezas de reglas,
asistente) y `datos/` (catálogos propios). Un test verifica que ningún archivo de dominio importe de `motor`,
`grafico`, `red`, `infraestructura`, `modelos` ni `datos`.

## Principios no negociables

1. **Azar y tiempo inyectados.** Ninguna regla llama a `Math.random()` ni a `Date.now()`. Recibe un `Azar`
   (`Pcg32`, `AzarSemilla`) y un `Reloj`. Eso permite repeticiones, tests deterministas, servidor y cliente iguales,
   y bugs reproducibles.
2. **Paso fijo.** La simulación avanza en pasos iguales (`BucleFijo`, 60 Hz), el dibujo interpola, el VFX hace
   sub-pasos a 120 Hz y las animaciones van a 12 fps.
3. **`Resultado`, no excepciones**, para los casos esperados (`"sin-fondos"`, `"en-recarga"`). Las excepciones son
   para bugs.
4. **Todo o nada** en lo que mueve valor: validar → entregar → cobrar, en una transacción con registro.
5. **Eventos de dominio** hacia afuera. El dominio no reproduce sonidos ni crea partículas: emite `salto`,
   `aterrizaje`, `golpe`, y la capa del juego decide qué hacer con eso.
6. **Datos fuera del código**, validados al arrancar (referencias cruzadas). Probabilidades siempre en 0..1.
7. **Servidor autoritativo** de todo lo que da recompensas. El cliente predice, pero no decide.
8. **Balance derivado**: primero el poder esperado del jugador, después los enemigos; verificado con simulación.
9. **Guardado versionado** con migraciones y respaldo. Un guardado viejo nunca hace crashear el juego.

## Flujo de un paso de simulación (juego de acción)

```
BucleFijo.avanzar(ahora)
 └─ por cada paso fijo:
     entrada.muestrear(dt)                    estados recién/pulsada/soltada + búfer
     dt' = director.paso(dt)                  0 en hitstop, ×0.35 en cámara lenta
     si dt' == 0: seguir (la entrada quedó en el búfer)
     ecs.actualizar(dt')                      fases: entrada → ia → fisica → combate → limpieza
       ├─ Plataformero.actualizar / MovilSuperior.actualizar
       ├─ AtaquePorFases / árbol de comportamiento
       ├─ calcularDanio → GestorEstados → Recurso.modificar
       └─ eventos de dominio → director.aplicar(...), particulas.rafaga(...), sonido
     particulas.actualizar(dt) · campos.actualizar(dt) · camara.actualizar(dt)
 └─ dibujar(alfa)                              Cuerpo.visual(alfa), Camara.vista()
```

## Flujo de red (multijugador)

```
CLIENTE                                               SERVIDOR (ServidorAutoritativo)
Entrada → PrediccionCliente.entrada() ──── input ───► recibir(): descarta viejas/duplicadas/inválidas
         (aplica ya, guarda historial)                paso(): ≤ N entradas por jugador por tick,
                                                         mundo.simular(), interés por jugador
reconciliar(snapshot) ◄──────── snapshot + ackSeq ──── delta contra el último estado confirmado
BuferInterpolacion (otros jugadores, −100 ms)
```
