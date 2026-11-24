# Determinismo, regresión y tolerancias

La promesa de ludokit: **misma semilla + mismas entradas = mismo resultado**, en cualquier PC, en el servidor y en
una repetición. Esta página define cómo se protege esa promesa.

## Qué se verifica

| Capa | Qué | Dónde |
|---|---|---|
| Reglas | resultados con semilla fija | `test/*.test.ts` |
| Simulación | **estado completo** tras N pasos (golden master) | `vectores/golden.ts` → `vectores/golden.json`, `test/golden.test.ts` |
| Entre lenguajes | mismas salidas en TS, Rust, Python y C++ | `vectores/generar.ts` → `vectores/vectores.json`, tests de cada port |
| Arquitectura | el dominio no importa del motor/gráficos/red/infraestructura/modelos/datos; nada usa `Math.random()` ni `Date.now()` | `test/golden.test.ts` |
| Repetibilidad | correr una simulación dos veces da lo mismo (sin estado global escondido) | `test/golden.test.ts` |

## Golden master

Escenarios actuales: controlador 3D sobre terreno, arma con dispersión y retroceso, salud por partes con sangrado,
vehículo con derrape, director de hordas, turnos + mazo, lanzador con GCD/canalización. Cada uno guarda un estado
cada cierto número de pasos, así la falla dice **dónde empezó** a divergir (`arma[3].bloom: 0.41 != 0.40`).

Cuando una simulación cambia **a propósito**:

1. `npm run golden` (regenera `vectores/golden.json`);
2. revisar el diff (¿cambió solo lo esperado?);
3. explicar el cambio en el commit.

Agregar un escenario: una función en `ESCENARIOS` de `vectores/golden.ts` que corra N pasos con semilla y entradas
fijas y devuelva estados planos (números, booleanos, textos).

## Tolerancias (ε)

| Comparación | Flotantes | Enteros, booleanos, textos |
|---|---|---|
| TypeScript contra su golden | **exacto** (ε = 0) | exacto |
| Entre lenguajes (Rust, C++, Python) | relativo **ε = 1e-6** (`|a−b| ≤ ε·max(1,|b|)`) | exacto |

Por qué hay ε entre lenguajes: `Math.pow`, `exp` y `sin` pueden diferir en el último bit entre bibliotecas
matemáticas. Para que eso **no** cambie decisiones:
- los valores que deciden ramas (vida ≤ 0, ¿le pegó?) se redondean o se comparan con margen;
- las estadísticas derivadas se redondean como `Math.round` de JavaScript (`round_js` en los ports);
- el azar es entero (PCG32) y se convierte a flotante una sola vez.

Si un juego necesita **lockstep** exacto entre plataformas distintas (RTS en red sin servidor), usar aritmética de
punto fijo en la simulación de ese juego; las reglas de ludokit aceptan cualquier número.

## Casos de borde que tienen prueba

coyote al final de un salto, búfer de salto durante el hitstop, cadencia exacta con intervalos que no son múltiplos
de dt, recarga por cartucho interrumpida, sobrecalentamiento, rebobinado recortado, penetración que pierde poder,
reparto de daño en partes destruidas, rendimientos decrecientes que se reinician, cola de casteo al terminar el GCD,
vueltas que solo cuentan al cruzar todos los controles, zona segura contenida en la anterior.
