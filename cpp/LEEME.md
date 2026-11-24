# ludokit en C++17 (header-only)

Copiar `ludokit.hpp` al proyecto y hacer `#include "ludokit.hpp"`. No tiene dependencias.

Contenido: `Pcg32`, `derivarSemilla`, `Mulberry32`, `Grilla` + autotile, `Cuerpo` + `mover` (ejes separados,
plataformas de un sentido, pinchos, corrección de esquinas), `Curva` (curvas de escalado sin tope),
`mitigacion`, `ModeloBalance` (poder esperado, enemigos y jefes desde curvas), `pesosRareza`, `hash2`, `ruidoValor`. Mismos números que la referencia TypeScript y el crate de Rust.

## Verificar antes de usar

```bash
g++ -std=c++17 -O2 -Wall -Wextra pruebas.cpp -o pruebas && ./pruebas
clang++ -std=c++17 -O2 -Wall -Wextra pruebas.cpp -o pruebas && ./pruebas
cl /std:c++17 /EHsc /W4 pruebas.cpp && pruebas.exe
```

**Estado:** este port se escribió en una máquina sin compilador de C++, así que todavía no se compiló. Las pruebas
comparan contra `vectores/vectores.json` (versión 2): si alguna falla, comparar el paso con el crate de Rust
(`rust/src/`), que sí está verificado.

## En Unreal Engine

Poner `ludokit.hpp` en `Source/<Modulo>/Public/` y usarlo desde los sistemas (`UGameInstanceSubsystem`,
componentes). Para el azar de la partida, guardar la semilla en el `GameState` y derivar una por sistema con
`derivarSemilla`. Así el servidor dedicado y los clientes generan lo mismo.
