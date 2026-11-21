# Qué lenguaje usar en cada parte de un juego, y por qué

Un juego profesional casi nunca es de un solo lenguaje. La regla: **cada capa en el lenguaje que mejor resuelve su
problema**, y entre capas, **contratos de datos** (JSON, binario) más **vectores de prueba compartidos**, para que
dos implementaciones de la misma regla den exactamente el mismo número.

ludokit trae piezas en cinco lenguajes, y cada una está verificada contra `vectores/vectores.json`:

| Carpeta | Lenguaje | Rol en la librería | Verificación |
|---|---|---|---|
| `src/` | **TypeScript** | Referencia completa: todas las reglas, el motor de tiempo, el netcode y los casos de uso | 151 tests + chequeo estricto de tipos |
| `rust/` | **Rust** | Núcleo de alto rendimiento: azar, física, hash espacial, A*, Verlet, balance, ruido | `cargo test`: idéntico a los vectores |
| `python/` | **Python** | Herramientas: sprites, validador, balance, catálogo CSV → destinos, diff de datos, medición de hitboxes | 10 tests, idéntico a los vectores |
| `cpp/` | **C++17** | Núcleo header-only para motores C++ | `pruebas.cpp`: **no se pudo compilar en la máquina de desarrollo**, compilar antes de usar |
| `shaders/` | **WGSL → GLSL** | Post-proceso, luz 2D, sombras SDF, Jump Flooding, bloom Kawase, LUT | 6 shaders validados con naga; el GLSL se genera |

---

## Mapa de decisión

| Capa del juego | Mejor opción | Alternativas | Por qué |
|---|---|---|---|
| **Reglas de dominio** (combate, botín, economía, progresión) | TypeScript (web, servidor Node) o el lenguaje del motor | C#, GDScript, Rust | Son lógica pura que cambia todo el tiempo: hace falta iterar rápido y tener tests de milisegundos. El lenguaje importa menos que mantenerlas puras. |
| **Juego web / navegador** | TypeScript | JavaScript | Corre en todos lados, tipado para refactorizar seguro, y el mismo código sirve en el servidor. |
| **Servidor de juego** (autoritativo, multijugador) | Rust (miles de entidades) o TypeScript/Node (cooperativo, por turnos, MMO chico) | Go, C#, C++ | Rust: sin pausas de recolector de basura, memoria predecible, seguro con hilos. Node: comparte el código de reglas con el cliente web (la predicción usa la misma función que el servidor). |
| **Camino caliente** (física de miles de cuerpos, pathfinding masivo, simulación de partículas en CPU) | Rust (nativo o WebAssembly) | C++, C# con Burst/Jobs | Entre 10 y 50 veces más rápido que JS en bucles numéricos, y determinista. Se compila a WASM y se llama desde TypeScript. |
| **Motor propio de alto nivel / consolas** | C++ | Rust | Los SDK de consolas y casi todo el middleware (audio, físicas 3D, Unreal) son C++. Para un motor nuevo sin esas ataduras, Rust da la misma velocidad con menos bugs de memoria. |
| **Unreal Engine** | C++ (sistemas) + Blueprints (diseño) | — | Es el lenguaje nativo del motor. `cpp/ludokit.hpp` entra directo en un módulo. |
| **Unity** | C# | — | Lenguaje del motor. Las reglas de `src/` se portan 1:1 (mismas clases e interfaces) y se verifican con los vectores. |
| **Godot** | GDScript (juego) + C# o Rust vía GDExtension (lo pesado) | — | GDScript itera rápido y está integrado con el editor. Lo que pese (pathfinding masivo, simulación) va a GDExtension en Rust. |
| **Shaders** | WGSL como fuente única → GLSL/HLSL/MSL generados | GLSL a mano | Un solo shader para WebGPU, WebGL2, Vulkan, Metal y DX12. naga (o Tint) valida y traduce, y nadie mantiene dos copias que divergen. |
| **Herramientas** (pipeline de arte, validación de datos, balance, exportadores, CI) | Python | Node | Pillow/NumPy para imágenes, CSV y planillas, scripts rápidos de escribir. No corre en el juego, así que su velocidad no importa. |
| **Modding / scripting en el juego** | Lua (LuaJIT, Luau) | JavaScript embebido (QuickJS), Wasm | Es diminuto, rápido, fácil de aislar (sandbox) y lo conocen los modders. El motor expone una API chica (spawn, eventos, UI) y los mods no tocan el núcleo. |
| **Datos de contenido** | JSON / CSV en el repositorio | YAML, planillas exportadas | Legibles, diffables en git y fáciles de validar (`python/…/datos.py`). Binario solo para el build final. |
| **Persistencia en servidor** | SQL (PostgreSQL) para cuentas, economía y ledger; clave-valor (Redis) para sesiones y colas | Documentos (MongoDB) | La economía necesita transacciones e integridad referencial. Un MMO no puede perder ni duplicar oro. |
| **Protocolo de red** | Binario little-endian (`src/red/paquetes.ts`) o JSON con delta para empezar | Protobuf, FlatBuffers | Binario y delta bajan el ancho de banda un orden de magnitud. JSON alcanza para prototipos y juegos por turnos. |
| **UI de herramientas internas** (editor de niveles, panel de balance) | TypeScript + web | Python + Qt | Se comparte el código de reglas con el juego y el equipo lo abre en el navegador. |

---

## Cómo se combinan en la práctica

### 1. Juego web de un jugador (plataformas, roguelike)
- TypeScript: todo `src/` en el navegador. Render con Canvas/WebGL; shaders GLSL generados desde `shaders/`.
- Python: pipeline de sprites y validación de contenido en CI.
- Si el pathfinding o las partículas pesan: compilar `rust/` a WASM (`cargo build --target wasm32-unknown-unknown --release`) y llamar esas funciones desde TS.

### 2. Juego de escritorio con motor (Godot / Unity / Unreal)
- Reglas: portar los contextos necesarios al lenguaje del motor y verificar el port con `vectores/vectores.json`.
- Lo pesado en Rust (GDExtension en Godot) o C++ (`cpp/ludokit.hpp` en Unreal).
- Herramientas en Python, contenido en JSON.

### 3. Cooperativo o competitivo en línea (2-64 jugadores)
- Cliente y servidor en TypeScript: **la misma función de simulación** en ambos (`src/red/netcode.ts`). Es la mayor ventaja de un solo lenguaje en cliente y servidor: la predicción casi nunca falla.
- El servidor en Node con WebSocket. Si hay muchos cuerpos físicos, la simulación se mueve a Rust (nativo en el servidor, WASM en el cliente) y el resultado se mantiene idéntico.

### 4. MMO / RPG multijugador masivo
- **Servidor de zona en Rust**: tick a 20-30 Hz, hash espacial para el área de interés, A* y física nativos.
- **Servicios en TypeScript/Node** (cuentas, tienda, correo, gremios, subasta): los casos de uso de `src/contextos/*/aplicacion`, con PostgreSQL detrás (transacción por operación y ledger de movimientos).
- Cliente en el motor que se elija. Reglas compartidas verificadas por los vectores, y el servidor siempre autoritativo.
- Lua para scripts de misiones y eventos, cargados en caliente sin reiniciar el servidor.

---

## Regla de oro para cualquier port

1. Copiar la **regla** (fórmula, orden de pasos, constantes) desde `src/`, no la sintaxis.
2. Reproducir `vectores/vectores.json` en un test del lenguaje nuevo.
3. Cuidar las trampas numéricas que rompen la igualdad entre lenguajes:
   - multiplicaciones de 32/64 bits: `Math.imul`/BigInt en JS, `wrapping_mul` en Rust, máscaras en Python;
   - redondeo: `Math.round` de JS redondea las mitades hacia +∞ (`floor(x + 0.5)`), no "a par" como Python;
   - desplazamientos: `>>>` sin signo en JS, `>>` sobre `u32` en Rust;
   - números de punto flotante: comparar con tolerancia, nunca con `==` salvo resultados exactos (posiciones en la grilla).
4. Si se agrega una regla nueva, se suman sus casos a `vectores/generar.ts` y se regenera el archivo.
