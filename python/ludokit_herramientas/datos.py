"""Validador de contenido: comprueba tipos, rangos y REFERENCIAS CRUZADAS entre tablas antes de que el juego
arranque (un premio que apunta a un objeto inexistente, una probabilidad de 30 escrita como 30 en vez de 0.3,
una misión que pide un enemigo borrado). Falla con mensajes claros: archivo, fila y campo.

    python -I -m ludokit_herramientas.datos reglas.json carpeta_contenido/

reglas.json:
{
  "tablas": {
    "objetos":   {"archivo": "objetos.json", "id": "id",
                  "campos": {"precio": {"tipo": "numero", "min": 0}, "rareza": {"tipo": "entero", "min": 0, "max": 5}}},
    "enemigos":  {"archivo": "enemigos.json", "id": "id",
                  "campos": {"botin": {"ref": "botin"}, "vida": {"tipo": "numero", "min": 1}}},
    "botin":     {"archivo": "botin.json", "id": "id",
                  "campos": {"entradas[].objeto": {"ref": "objetos"}, "entradas[].prob": {"tipo": "prob"}}}
  }
}
Tipos: numero, entero, texto, bool, prob (0..1), lista. `ref`: el valor debe ser un id de otra tabla.
Rutas con `[]` recorren listas. Los .csv se leen con encabezado (separador , o ;).
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


def leer_tabla(ruta: Path) -> list[dict]:
    if ruta.suffix == ".csv":
        texto = ruta.read_text(encoding="utf-8-sig")
        sep = ";" if texto.count(";") > texto.count(",") else ","
        filas = list(csv.DictReader(texto.splitlines(), delimiter=sep))
        for f in filas:
            for k, v in f.items():
                try:
                    f[k] = float(v) if "." in v else int(v)
                except (TypeError, ValueError):
                    pass
        return filas
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    return list(datos.values()) if isinstance(datos, dict) else datos


def valores(fila, ruta: str):
    """Valores de una ruta tipo `entradas[].objeto` (puede devolver varios)."""
    actuales = [fila]
    for parte in ruta.split("."):
        siguientes = []
        lista = parte.endswith("[]")
        clave = parte[:-2] if lista else parte
        for a in actuales:
            if not isinstance(a, dict) or clave not in a:
                continue
            v = a[clave]
            if lista and isinstance(v, list):
                siguientes.extend(v)
            else:
                siguientes.append(v)
        actuales = siguientes
    return actuales


def comprobar_tipo(v, regla: dict) -> str | None:
    t = regla.get("tipo")
    if t in ("numero", "entero", "prob"):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return f"se esperaba número, hay {v!r}"
        if t == "entero" and int(v) != v:
            return f"se esperaba entero, hay {v}"
        if t == "prob" and not 0 <= v <= 1:
            return f"probabilidad fuera de 0..1: {v} (¿escrita en %?)"
        if "min" in regla and v < regla["min"]:
            return f"{v} < mínimo {regla['min']}"
        if "max" in regla and v > regla["max"]:
            return f"{v} > máximo {regla['max']}"
    elif t == "texto" and not isinstance(v, str):
        return f"se esperaba texto, hay {v!r}"
    elif t == "bool" and not isinstance(v, bool):
        return f"se esperaba bool, hay {v!r}"
    elif t == "lista" and not isinstance(v, list):
        return f"se esperaba lista, hay {v!r}"
    return None


def validar(reglas: dict, carpeta: Path) -> list[str]:
    errores: list[str] = []
    tablas: dict[str, list[dict]] = {}
    ids: dict[str, set] = {}
    for nombre, t in reglas["tablas"].items():
        ruta = carpeta / t["archivo"]
        if not ruta.exists():
            errores.append(f"{nombre}: no existe {ruta}")
            continue
        filas = leer_tabla(ruta)
        tablas[nombre] = filas
        campo_id = t.get("id", "id")
        vistos = set()
        for i, f in enumerate(filas):
            k = f.get(campo_id)
            if k is None:
                errores.append(f"{t['archivo']} fila {i}: sin '{campo_id}'")
            elif k in vistos:
                errores.append(f"{t['archivo']} fila {i}: id repetido {k!r}")
            vistos.add(k)
        ids[nombre] = vistos
    for nombre, t in reglas["tablas"].items():
        for i, f in enumerate(tablas.get(nombre, [])):
            for ruta, regla in t.get("campos", {}).items():
                vals = valores(f, ruta)
                if not vals and regla.get("obligatorio"):
                    errores.append(f"{t['archivo']} fila {i} ({f.get(t.get('id', 'id'))}): falta '{ruta}'")
                for v in vals:
                    e = comprobar_tipo(v, regla)
                    if e:
                        errores.append(f"{t['archivo']} fila {i} ({f.get(t.get('id', 'id'))}) '{ruta}': {e}")
                    ref = regla.get("ref")
                    if ref and v not in ids.get(ref, set()):
                        errores.append(f"{t['archivo']} fila {i} ({f.get(t.get('id', 'id'))}) '{ruta}': {v!r} no existe en '{ref}'")
    return errores


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    reglas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    errores = validar(reglas, Path(sys.argv[2]))
    for e in errores:
        print("✖", e)
    print(f"{len(errores)} errores" if errores else "✔ contenido válido")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
