"""UNA sola fuente de verdad para el contenido: una planilla CSV (editable por diseño) → varios destinos (el JSON
del cliente, el del servidor, un CSV para la tienda…) y una AUDITORÍA que comprueba que los destinos coinciden con
la fuente. Resuelve el clásico "el cliente muestra un precio y el servidor cobra otro".

    python -I -m ludokit_herramientas.catalogo generar  catalogo.csv destinos.json
    python -I -m ludokit_herramientas.catalogo auditar  catalogo.csv destinos.json

destinos.json:
{
  "cliente":  {"archivo": "cliente/tienda.json",  "campos": ["id", "nombre", "precio", "icono"], "agrupar": "pestana"},
  "servidor": {"archivo": "servidor/tienda.json", "campos": ["id", "precio", "moneda"], "filtro": {"vendible": 1}}
}
`campos`: columnas que van a ese destino · `filtro`: solo filas que cumplen · `agrupar`: {valor: [filas]}.
Las celdas vacías no se escriben; los números se convierten solos.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


def convertir(v: str):
    v = v.strip()
    if v == "":
        return None
    for tipo in (int, float):
        try:
            return tipo(v)
        except ValueError:
            pass
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    return v


def leer_csv(ruta: Path) -> list[dict]:
    texto = ruta.read_text(encoding="utf-8-sig")
    sep = ";" if texto.splitlines()[0].count(";") > texto.splitlines()[0].count(",") else ","
    return [{k: convertir(v or "") for k, v in fila.items()} for fila in csv.DictReader(texto.splitlines(), delimiter=sep)]


def construir(filas: list[dict], destino: dict):
    sel = [f for f in filas if all(f.get(k) == v for k, v in destino.get("filtro", {}).items())]
    salida = [{c: f[c] for c in destino["campos"] if f.get(c) is not None} for f in sel]
    if "agrupar" in destino:
        grupos: dict = {}
        for f, s in zip(sel, salida):
            grupos.setdefault(str(f.get(destino["agrupar"])), []).append(s)
        return grupos
    return salida


def generar(catalogo: Path, destinos: dict, raiz: Path) -> list[Path]:
    filas = leer_csv(catalogo)
    ids = [f.get("id") for f in filas]
    repetidos = {i for i in ids if ids.count(i) > 1}
    if repetidos:
        raise SystemExit(f"ids repetidos en {catalogo}: {sorted(repetidos)}")
    escritos = []
    for nombre, d in destinos.items():
        ruta = raiz / d["archivo"]
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps(construir(filas, d), ensure_ascii=False, indent=1), encoding="utf-8")
        escritos.append(ruta)
    return escritos


def auditar(catalogo: Path, destinos: dict, raiz: Path) -> list[str]:
    filas = leer_csv(catalogo)
    errores = []
    for nombre, d in destinos.items():
        ruta = raiz / d["archivo"]
        if not ruta.exists():
            errores.append(f"{nombre}: falta {ruta} (correr 'generar')")
            continue
        esperado = construir(filas, d)
        actual = json.loads(ruta.read_text(encoding="utf-8"))
        if actual != esperado:
            plano = lambda x: x if isinstance(x, list) else [y for v in x.values() for y in v]  # noqa: E731
            a = {json.dumps(r, sort_keys=True) for r in plano(actual)}
            e = {json.dumps(r, sort_keys=True) for r in plano(esperado)}
            for r in sorted(e - a):
                errores.append(f"{nombre}: falta o difiere {r}")
            for r in sorted(a - e):
                errores.append(f"{nombre}: sobra {r}")
            if a == e:
                errores.append(f"{nombre}: mismo contenido en otro orden o agrupación")
    return errores


def main() -> None:
    if len(sys.argv) != 4 or sys.argv[1] not in ("generar", "auditar"):
        print(__doc__)
        sys.exit(2)
    catalogo, destinos_ruta = Path(sys.argv[2]), Path(sys.argv[3])
    destinos = json.loads(destinos_ruta.read_text(encoding="utf-8"))
    raiz = destinos_ruta.parent
    if sys.argv[1] == "generar":
        for r in generar(catalogo, destinos, raiz):
            print("✔", r)
    else:
        errores = auditar(catalogo, destinos, raiz)
        for e in errores:
            print("✖", e)
        print("✔ destinos al día" if not errores else f"{len(errores)} diferencias")
        sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
