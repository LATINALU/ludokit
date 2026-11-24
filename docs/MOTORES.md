# ludokit en Unity, Godot y Unreal (referencia interna)

ludokit es el **cerebro** (reglas, simulación determinista); el motor es el **cuerpo** (render, audio, animación,
física de presentación, entrada). Esta guía resume cómo conectar los dos en cada motor y qué piezas del motor
corresponden a cada pieza de ludokit. Al final, fuentes consultadas.

## 1. Arquitectura de adaptación (igual en los tres motores)

```
Entrada del motor ──► acciones (motor.Entrada / tu mapa) ──► SIMULACIÓN ludokit en paso fijo
                                                              │  (TS en web · Rust por FFI en Unity/Unreal/Godot ·
                                                              │   reglas portadas al lenguaje del motor)
                                                              ▼
                    estado (posiciones, vida, munición) + eventos (feedback.EventoJuego, dominio)
                                                              │
Render interpolado (alfa) ◄── adaptadores del motor ◄────────┘  (Transform, AnimationTree, partículas, audio, UI)
```

Reglas que no cambian con el motor:

1. **La simulación corre en el paso fijo del motor** (`FixedUpdate`, `_physics_process`, `Tick` con paso fijo) o en
   un `BucleFijo` propio; el dibujo interpola. Así el juego es determinista y el netcode funciona.
2. **El motor no decide reglas.** Un `MonoBehaviour`/`Node`/`Actor` lee estado y eventos, y dibuja.
3. **Los eventos de feedback** (`feedback.TraductorFeedback`) se convierten en partículas, sonidos y sacudidas en un
   solo adaptador por motor.
4. **Lo caliente va al núcleo Rust por FFI en lotes** (rayos, hordas, visión): `docs/RUST.md`.
5. **La física del motor es presentación** (ragdolls, escombros) salvo que el juego no necesite determinismo ni red.

## 2. Unity (C#)

| ludokit | Unity |
|---|---|
| `BucleFijo` | `FixedUpdate` (Project Settings → Time → Fixed Timestep = 1/60) o un bucle propio en `Update` |
| `Controlador3D` | Reemplaza a `CharacterController`: leer `pos`/`ojos` y asignar al `Transform`/cámara en `Update` interpolando |
| `Escena3D` (Rust) / `colision3d` | Hitboxes como cápsulas por hueso; `LudokitNativo.cs` → `EscenaDisparos.Disparar(lote)` |
| `Multitud` (Rust) | `Horda.Paso(dt)` en `FixedUpdate`; dibujar con `Graphics.RenderMeshInstanced` (miles sin `GameObject`) |
| `feedback` | Un `MonoBehaviour` que traduce órdenes a `ParticleSystem.Emit`, `AudioSource.PlayOneShot`, Cinemachine Impulse |
| `red` | Con Netcode for GameObjects: el servidor corre la simulación; NGO no trae predicción de cliente de serie, así que usar `red.PrediccionCliente`/`reconciliar` propios. Netcode for Entities sí trae predicción. |
| `persistencia` | `Application.persistentDataPath` como `Almacen` |

Plug-in nativo: la biblioteca de Rust (`cdylib`) en `Assets/Plugins/<plataforma>/`, `[DllImport("ludokit")]` sin
extensión; en iOS, biblioteca estática y `[DllImport("__Internal")]`. Adaptador listo:
`rust/integraciones/csharp/LudokitNativo.cs` (probado con .NET 8).

## 3. Godot 4

| ludokit | Godot |
|---|---|
| `BucleFijo` | `_physics_process(delta)` (Physics Ticks per Second = 60) |
| `Controlador3D` | Alternativa determinista a `CharacterBody3D.move_and_slide()`: o usar `move_and_slide` para colisiones del mundo y las reglas de ludokit (coyote, búfer, aceleración, deslizar) para calcular `velocity` |
| `Escena3D` / `Multitud` (Rust) | **GDScript**: la **GDExtension de `rust/godot/`** (`LudoEscena3D`, `LudoHorda`, `LudoNiebla`, `LudoCurva`; guía en `rust/godot/LEEME.md`, demo con 6 000 zombis en un `MultiMesh`). **C#**: el mismo `LudokitNativo.cs` |
| `feedback` | Un nodo autoload que traduce órdenes a `GPUParticles3D.restart()`, `AudioStreamPlayer3D`, sacudida de `Camera3D` |
| `red` | `MultiplayerAPI`/ENet como transporte; la autoridad y la predicción las pone `red` |

Cápsula como forma de personaje y paso fijo con interpolación visual son las prácticas recomendadas también para el
controlador propio del motor.

## 4. Unreal Engine 5 (C++)

| ludokit | Unreal |
|---|---|
| `BucleFijo` | Subsistema (`UTickableWorldSubsystem`) con acumulador de paso fijo, o *async physics tick* |
| Núcleo Rust | Módulo con `PublicAdditionalLibraries` → `ludokit.lib`/`.so` y `#include "ludokit.h"`; o portar reglas a C++ (`cpp/ludokit.hpp`) |
| `combate` (`Lanzador`, `Atributos`, `recursos`, `RendimientosDecrecientes`) | Equivalente conceptual del **Gameplay Ability System**: habilidades ↔ `GameplayAbility`, atributos ↔ `AttributeSet`, estados ↔ `GameplayEffect`. Se puede usar GAS para presentación/red y ludokit para las reglas y el balance (curvas, poder esperado) |
| `disparos` | Hitscan con `Escena3D` (Rust) o `LineTraceByChannel` para el mundo + zonas de ludokit para el daño |
| `feedback` | Niagara, MetaSounds, `CameraShake` desde un componente adaptador |
| `red` | Replicación de Unreal como transporte; el servidor es autoritativo de las reglas de ludokit |

El juego de muestra **Lyra** organiza casi todo el gameplay con GAS: habilidades innatas, por equipo o por
experiencia, un `AbilitySystemComponent` por `PlayerState` (jugadores y bots) y las fases de partida como
habilidades. Es la referencia de cómo Epic estructura un shooter modular.

## 5. Elegir motor (resumen práctico)

| Si el juego es… | Sugerencia |
|---|---|
| Web, 2D, prototipo rápido, servidor en Node | TypeScript de ludokit directo + Canvas/WebGL/Three.js |
| 2D/3D indie, código abierto, liviano | Godot 4 (+ Rust por GDExtension para lo caliente) |
| 3D multiplataforma con mucho asset store, móvil | Unity (+ Rust por plug-in nativo) |
| 3D de alta gama, shooter AAA | Unreal (+ C++/Rust para reglas, GAS para presentación) |
| Servidor dedicado de cualquiera de los anteriores | Rust (núcleo) + `red` |

## Fuentes

- Unity — plug-ins nativos: <https://docs.unity3d.com/Manual/plug-ins-native-overview.html> · DllImport y `__Internal`: <https://docs.unity.com/en-us/engine/6000.7/manual/programming-environment/plug-ins/native/overview>
- Unity — predicción en Netcode for Entities: <https://docs.unity3d.com/Packages/com.unity.netcode@1.3/manual/intro-to-prediction.html> · Foro sobre predicción en NGO: <https://discussions.unity.com/t/netcode-for-gameobjects-custom-client-prediction-tips/1535760>
- Rust ↔ C#: csbindgen <https://docs.rs/crate/csbindgen/1.9.8/source/README.md>
- Godot — `CharacterBody3D`: <https://docs.godotengine.org/en/4.3/classes/class_characterbody3d.html> · godot-rust (gdext): <https://github.com/godot-rust/gdext> · libro: <https://godot-rust.github.io/book/intro/hello-world.html>
- Unreal — Gameplay Ability System: <https://dev.epicgames.com/documentation/en-us/unreal-engine/understanding-the-unreal-engine-gameplay-ability-system> · Lyra: <https://dev.epicgames.com/documentation/en-us/unreal-engine/lyra-sample-game-in-unreal-engine> · Habilidades en Lyra: <https://dev.epicgames.com/documentation/en-us/unreal-engine/abilities-in-lyra-in-unreal-engine>
- Paso fijo: Glenn Fiedler, *Fix Your Timestep!* <https://gafferongames.com/post/fix_your_timestep/>
