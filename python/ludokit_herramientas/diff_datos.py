"""Diff SEMÁNTICO de tablas de contenido entre dos versiones (parches, temporadas, ramas): por id, qué filas se
agregaron, se quitaron y qué campos cambiaron con su valor viejo y nuevo. Sirve para notas de parche, revisión de
balance ("¿quién tocó la vida de los jefes?") y para migrar contenido entre versiones.

    python -I -m ludokit_herramientas.diff_datos viejo.json nuevo.json [--id id] [--campos vida,ataque]
Acepta JSON (lista u objeto) y CSV.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .datos import leer_tabla


def indexar(filas: list[dict], clave: str) -> dict:
    return {f.get(clave): f for f in filas if f.get(clave) is not None}


def diff(viejo: list[dict], nuevo: list[dict], clave: str = "id", campos: list[str] | None = None) -> dict:
    a, b = indexar(viejo, clave), indexar(nuevo, clave)
    cambios = {}
    for k in sorted(set(a) & set(b), key=str):
        claves = campos or sorted(set(a[k]) | set(b[k]))
        d = {c: (a[k].get(c), b[k].get(c)) for c in claves if a[k].get(c) != b[k].get(c)}
        if d:
            cambios[k] = d
    return {
        "agregados": sorted(set(b) - set(a), key=str),
        "quitados": sorted(set(a) - set(b), key=str),
        "cambiados": cambios,
    }


def notas(d: dict, nombre: str = "fila") -> list[str]:
    r = [f"+ {nombre} nuevo: {k}" for k in d["agregados"]] + [f"- {nombre} quitado: {k}" for k in d["quitados"]]
    for k, campos in d["cambiados"].items():
        partes = []
        for c, (v0, v1) in campos.items():
            flecha = "▲" if isinstance(v0, (int, float)) and isinstance(v1, (int, float)) and v1 > v0 else "▼" if isinstance(v0, (int, float)) and isinstance(v1, (int, float)) else "·"
            partes.append(f"{c} {v0} → {v1} {flecha}")
        r.append(f"~ {k}: " + ", ".join(partes))
    return r


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("viejo")
    p.add_argument("nuevo")
    p.add_argument("--id", default="id")
    p.add_argument("--campos")
    p.add_argument("--json", action="store_true", help="salida JSON en vez de notas")
    a = p.parse_args()
    d = diff(leer_tabla(Path(a.viejo)), leer_tabla(Path(a.nuevo)), a.id, a.campos.split(",") if a.campos else None)
    if a.json:
        print(json.dumps(d, ensure_ascii=False, indent=1, default=str))
    else:
        for linea in notas(d):
            print(linea)


if __name__ == "__main__":
    main()
