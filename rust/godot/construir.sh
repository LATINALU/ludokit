#!/usr/bin/env bash
# Compila la extensión y la copia al proyecto demo. Uso: ./construir.sh [debug]
set -e
cd "$(dirname "$0")"
perfil=release; [ "${1:-}" = "debug" ] && perfil=debug
cargo build $([ "$perfil" = release ] && echo --release)
copiados=0
for f in ludokit_godot.dll libludokit_godot.so libludokit_godot.dylib; do
  if [ -f "target/$perfil/$f" ]; then
    cp "target/$perfil/$f" demo/bin/
    echo "copiado demo/bin/$f"
    copiados=$((copiados + 1))
  fi
done
[ "$copiados" -gt 0 ] || { echo "no se encontró la biblioteca compilada" >&2; exit 1; }
