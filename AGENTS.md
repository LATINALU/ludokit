# Instrucciones para agentes de IA que trabajan con ludokit

Leé **`docs/IA.md`** antes de escribir código: es el manual completo (modelo mental, flujo de 0 a 100, recetas por
género, feedback, red, errores típicos). Qué existe exactamente: **`docs/INDICE.md`** y **`docs/catalogo.json`**
(generados desde el código; si algo no está ahí, no existe: no lo inventes).

## Comandos

```bash
npm test             # todas las pruebas (incluye golden master y reglas de arquitectura)
npm run tipos        # TypeScript estricto (tsc --noEmit)
npm run indice       # regenera docs/INDICE.md y docs/catalogo.json (correr tras agregar/quitar exportaciones)
npm run golden       # regenera vectores/golden.json (solo si una simulación cambió A PROPÓSITO)
npm run crear        # asistente de preguntas → modelos combinados → ludokit.juego.json + PLAN.md
node vectores/generar.ts && (cd rust && cargo test && cargo build --release) && (cd python && python -I pruebas/test_herramientas.py)
(cd rust && cargo run --release --example rendimiento)   # benchmark (comparar con node ejemplos/rendimiento.ts)
```

Requiere Node ≥ 23.6 (ejecuta `.ts` directo, sin compilar).

## Reglas no negociables

1. **Dominio puro**: `src/contextos/*/dominio` y `src/nucleo` no importan de `motor`, `grafico`, `red`,
   `infraestructura`, `modelos` ni `datos` (hay un test).
2. **Azar y tiempo inyectados**: nada de `Math.random()`, `Date.now()`, `performance.now()` en reglas (hay un test).
3. **Sin números de ningún juego**: las reglas reciben su configuración; los números de partida viven en
   `src/modelos/piezas.ts` y `src/datos/`. Nunca copies estadísticas, nombres o textos de juegos comerciales.
4. **Sin topes artificiales**: todo escalado es una `Curva` (`src/nucleo/escalado.ts`) que acepta cualquier nivel.
5. **`Resultado`** (`exito`/`fallo`) para casos esperados; excepciones solo para bugs.
6. Cada archivo nuevo empieza con un comentario de cabecera y cada exportación con JSDoc (el índice los usa).
7. Cada regla nueva lleva test con semilla fija; cada simulación por pasos nueva, un escenario en `vectores/golden.ts`.
8. Español en nombres y comentarios (convención del proyecto).

## Mapa rápido

- `src/nucleo` azar (Pcg32), reloj, Resultado, eventos, geometría 2D, `vec3`, **curvas**.
- `src/motor` bucle fijo, ECS, FSM, entrada, cámara · `src/espacial` colisiones 2D y **3D** · `src/red` netcode y
  **compensación de lag**.
- `src/contextos/<x>` 28 contextos: combate, disparos, fisica, balance, botin, progresion, economia, encuentros, ia,
  navegacion, mundo, moba, vision, grupo, supervivencia, turnos, mazo, estrategia, carreras, competitivo, feedback,
  feel, audio, coleccion, inventario, narrativa, roguelite, social.
- `src/modelos` 58 modelos combinables, `combinar`, asistente (`PREGUNTAS`, `recomendar`, `planDeImplementacion`).
- `src/datos` catálogos propios: armas, vehículos, criaturas, rpg.
- `rust/` núcleo de ALTO RENDIMIENTO (rayos 3D con grilla, hordas paralelas, niebla, balística) + ABI C
  (`include/ludokit.h`, `src/ffi.rs`) + adaptador C# para Unity/Godot. Cuándo usarlo: `docs/RUST.md`.
- `python/`, `cpp/` ports verificados contra `vectores/vectores.json`.
- Referencias: `docs/SHOOTER-3D.md` (pedido más común), `docs/MOTORES.md` (Unity/Godot/Unreal).
