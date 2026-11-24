# Rust en ludokit: dónde, por qué y cómo

TypeScript es la **referencia** (todas las reglas, fácil de leer, corre en navegador y servidor). Rust es el **núcleo
de alto rendimiento**: las mismas reglas, verificadas contra los mismos vectores, para las partes donde cada
microsegundo del tick cuenta. Esta guía dice qué mover a Rust, qué dejar en TypeScript/C#/GDScript, y lo demuestra
con números medidos.

## 1. Números medidos (misma carga, misma máquina)

`node ejemplos/rendimiento.ts` contra `cd rust && cargo run --release --example rendimiento`. PC de escritorio
x86-64 (24 hilos), Node 24, Rust 1.96, Windows. Corré los dos en tu máquina: los números absolutos cambian, la
proporción se mantiene.

| Carga | TypeScript | Rust | Ganancia | Por qué |
|---|---:|---:|---:|---|
| 20 000 rayos contra 2 000 personajes, **mismo algoritmo** (búsqueda lineal) | 2 553 ms | 675 ms | **3,8×** | `f32` contiguo, sin objetos ni recolector, inlining |
| Los mismos rayos con **grilla + DDA 3D** (`Escena3D`) | — | **23,5 ms** | **108×** vs TS | Algoritmo + memoria: cada rayo prueba solo las celdas que cruza |
| Campo de flujo 256×256, 20 recálculos | 646 ms | 125 ms | **5,2×** | Montículo sin asignaciones, arreglos planos |
| Horda de 5 000 agentes × 300 pasos (mismo algoritmo, `Float32Array` en TS) | 770 ms | 381 ms | **2×** | V8 optimiza muy bien arreglos tipados: acá la ventaja de Rust es menor |
| Horda de **50 000** agentes × 60 pasos, 1 hilo | — | 758 ms (12,6 ms/paso) | — | No entra en un tick de 60 Hz (16,6 ms) con margen |
| Horda de **50 000** agentes × 60 pasos, 24 hilos (`paso_paralelo`) | — | **255 ms (4,2 ms/paso)** | **3×** vs 1 hilo | Hilos sin copiar memoria y **resultado idéntico bit a bit** |
| Niebla de guerra 256×256, 100 fuentes × 30 | 62 ms | 23 ms | **2,7×** | Bresenham sobre bytes |

Lecciones de los números (también son reglas de diseño):

1. **El mayor salto viene del algoritmo + la memoria** (108× en rayos), no solo del lenguaje (3,8×). Rust hace fácil
   escribir estructuras planas sin asignaciones; ahí está la ganancia grande.
2. **JavaScript moderno es rápido con arreglos tipados** (la horda en TS es solo 2× más lenta). Si tu cuello de
   botella ya es un bucle sobre `Float32Array`, Rust no es magia: ganás con hilos.
3. **Hilos: solo con carga suficiente.** Con 5 000 agentes, 24 hilos creados en cada paso eran *más lentos* que uno
   (808 ms contra 384). Por eso `paso_paralelo` usa un mínimo de 4 096 agentes por hilo (`MIN_POR_HILO`) y, por
   debajo, corre secuencial.
4. **Cruzar la frontera cuesta** (FFI, WebAssembly): una llamada por lote, nunca una por entidad.

## 2. Qué mover a Rust (y qué no)

| Mover a Rust ✅ | Por qué | Módulo Rust |
|---|---|---|
| Rayos y colisiones 3D de disparos (servidor de shooter, IA que verifica línea de visión, escopetas) | se ejecutan miles de veces por tick con rebobinado de lag | `colision3d::Escena3D`, `balistica` |
| Hordas y multitudes (zombis, súbditos, RTS) | O(n) por tick con n en miles; paralelizable | `multitud::{CampoFlujo, Multitud}` |
| Niebla de guerra / visión de RTS y MOBA | fuentes × radio² × radio por tick | `niebla::NieblaGuerra` |
| Pathfinding (A*) masivo, broadphase, física por tiles en el servidor | caliente y sin estado de UI | `navegacion`, `espacial`, `fisica` |
| Simulación del servidor autoritativo con muchos jugadores | sin pausas de recolector = ticks estables | todo el núcleo |
| Herramientas de balance que simulan millones de peleas | velocidad + determinismo | `balance` (curvas), desde Python con `nativo.py` |

| Dejar en TypeScript / C# / GDScript ❌ | Por qué |
|---|---|
| Reglas de diseño que cambian a diario (talentos, misiones, economía, diálogos) | iteración rápida, sin recompilar |
| Lo que corre pocas veces por tick (una compra, abrir una caja, subir de nivel) | no hay ganancia medible |
| Feedback, UI, audio, animación | viven en el motor |
| Cualquier cosa que necesite cruzar la frontera por cada entidad | el costo de la llamada se come la ganancia |

## 3. Patrones de rendimiento que usa el núcleo (copiarlos en tu código)

- **Estructura de arreglos (SoA)**: `x: Vec<f32>, y: Vec<f32>, vx, vy` en vez de `Vec<Agente>`; el bucle recorre
  memoria contigua y el compilador puede vectorizar.
- **Grilla por ordenamiento por conteo**: reconstruir la grilla de vecinos en O(n) cada paso, reutilizando buffers
  (`Multitud::armar_grilla`). Sin `HashMap` en el bucle caliente.
- **Recorrido DDA 3D** (Amanatides–Woo) para rayos: visitar celdas en orden y cortar al primer impacto seguro.
- **Marca por época** para no probar dos veces la misma forma sin limpiar un arreglo (`Escena3D::nueva_epoca`).
- **Cero asignaciones en el tick**: los resultados se escriben en `Vec` que pasa el que llama (`salida`, `tmp`).
- **Paralelismo determinista**: fase de lectura (calcular velocidades) en paralelo con `std::thread::scope`, fase
  de escritura (integrar) secuencial. Mismo resultado que con un hilo: apto para red y repeticiones.
- **API gruesa por FFI**: `ludo_escena_rayos(…, n, …)` lanza n rayos en una llamada.

## 4. Cómo usarlo en cada plataforma

```bash
cd rust && cargo build --release      # target/release/ludokit.dll | libludokit.so | libludokit.dylib (+ .rlib)
cargo test                            # 14 pruebas, incluidas las de igualdad con TypeScript y la ABI C
cargo run --release --example rendimiento
```

| Plataforma | Cómo | Archivo |
|---|---|---|
| **Rust** (servidor dedicado, motor propio, Bevy) | `ludokit = { path = "…/rust" }` en Cargo.toml | `rust/src/lib.rs` |
| **Unity** (C#) | Plug-in nativo: la biblioteca en `Assets/Plugins/<plataforma>/` + `[DllImport]` (iOS: `__Internal`) | `rust/integraciones/csharp/LudokitNativo.cs` (verificado con .NET 8) |
| **Godot 4** (C#) | El mismo archivo C# | ídem |
| **Godot 4** (GDScript) | Envolver en una GDExtension con el crate `godot` (godot-rust/gdext) y exponer `Escena3D`/`Multitud` como clases | ver docs/MOTORES.md |
| **Unreal** (C++) | Módulo con `PublicAdditionalLibraries` apuntando a la biblioteca e `#include "ludokit.h"` | `rust/include/ludokit.h` |
| **C / C++** | `#include "ludokit.h"` y enlazar | ídem |
| **Python** (herramientas) | `ctypes`, sin dependencias | `python/ludokit_herramientas/nativo.py` (con prueba) |
| **Web** | `cargo build --target wasm32-unknown-unknown --release` (o `wasm-bindgen`) y llamar en lotes con memoria compartida | — |

Ejemplo mínimo en Rust:

```rust
use ludokit::colision3d::*;
let mut escena = Escena3D::nueva(4.0);
escena.agregar(Colisionador { id: 1, duenio: 7, etiqueta: CABEZA, forma: Forma::Esfera { centro: V3::new(0.0, 1.7, 10.0), radio: 0.13 } });
let rayo = Rayo { origen: ojos, dir: mira.normalizar(), largo: 300.0 };
if let Some(h) = escena.lanzar_rayo(&rayo, id_tirador) { /* h.duenio, h.etiqueta (zona), h.t */ }
```

## 5. Garantías

- **Mismos resultados que TypeScript**: `rust/tests/nucleo_rapido.rs` compara rayos 3D, campo de flujo y niebla con
  `vectores/vectores.json` generado por la referencia; `rust/tests/vectores.rs` hace lo mismo con azar, curvas,
  balance, física, A* y ruido. Tolerancia: ver `docs/DETERMINISMO.md` (los rayos usan `f32` en Rust y `f64` en TS:
  distancias con ε 1e-3; en una escena de 20 000 rayos hubo 1 impacto de diferencia en el borde exacto de una forma).
- **La grilla da lo mismo que la búsqueda lineal** (probado rayo por rayo).
- **`paso_paralelo` da lo mismo que `paso`** (probado con 10 000 agentes y en el benchmark con 50 000).
- **La ABI no aborta con punteros nulos** (probado), y se usa desde Python y C# en pruebas reales.
