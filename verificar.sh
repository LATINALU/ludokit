#!/usr/bin/env bash
# Verifica toda la librería en todos los lenguajes disponibles. Sale con error si algo falla.
set -u
cd "$(dirname "$0")"
fallos=0
paso() { echo; echo "== $1"; }

paso "TypeScript: tipos"
npx tsc -p tsconfig.json || fallos=$((fallos + 1))

paso "TypeScript: pruebas"
node --test test/*.test.ts test/*.test.mjs || fallos=$((fallos + 1))

paso "Vectores: regenerar y comprobar que no cambiaron"
cp vectores/vectores.json /tmp/vectores.antes.json 2>/dev/null
node vectores/generar.ts && (cmp -s vectores/vectores.json /tmp/vectores.antes.json && echo "sin cambios" || echo "AVISO: vectores.json cambió (revisar y volver a correr los ports)")

if command -v cargo >/dev/null; then
  paso "Rust: pruebas contra los vectores"
  (cd rust && cargo test --quiet) || fallos=$((fallos + 1))
  paso "Shaders: validar WGSL y generar GLSL"
  (cd shaders/compilador && cargo run --quiet --release -- ../*.wgsl) || fallos=$((fallos + 1))
else
  echo "(cargo no está instalado: se saltan Rust y shaders)"
fi

if command -v python >/dev/null || command -v python3 >/dev/null; then
  paso "Python: pruebas contra los vectores"
  (cd python && "$(command -v python || command -v python3)" -I pruebas/test_herramientas.py) || fallos=$((fallos + 1))
fi

CXX=""
for c in g++ clang++; do command -v $c >/dev/null && CXX=$c && break; done
if [ -n "$CXX" ]; then
  paso "C++: pruebas contra los vectores ($CXX)"
  (cd cpp && $CXX -std=c++17 -O2 -Wall -Wextra pruebas.cpp -o /tmp/ludokit_pruebas && /tmp/ludokit_pruebas) || fallos=$((fallos + 1))
else
  echo; echo "(sin compilador de C++: se saltan las pruebas de cpp/)"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "✔ todo verificado"; else echo "✖ $fallos etapas fallaron"; exit 1; fi
