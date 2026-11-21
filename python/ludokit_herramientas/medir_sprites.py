"""Mide el arte para sacar datos de combate: por cada cuadro de una hoja de sprites, la caja visible, el ALCANCE
desde el pivote (hasta dónde llega el arma en el cuadro de golpe) y una HITBOX sugerida (la caja del cuerpo sin
los extremos finos). Así las hitboxes salen del dibujo y no se desincronizan cuando cambia el arte.

    python -I -m ludokit_herramientas.medir_sprites hoja.png --cuadro 32x32 --pivote 16,30 [--json salida.json]
Requiere Pillow y NumPy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def medir_cuadro(alfa: np.ndarray, pivote: tuple[int, int], recorte_cuerpo: float = 0.15) -> dict | None:
    ys, xs = np.nonzero(alfa > 0)
    if len(xs) == 0:
        return None
    px, py = pivote
    caja = {"x": int(xs.min()), "y": int(ys.min()), "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1)}
    # Alcance: el píxel opaco más lejano hacia adelante (+x) y hacia arriba desde el pivote.
    alcance = {"adelante": int(xs.max() - px), "atras": int(px - xs.min()), "arriba": int(py - ys.min())}
    # Hitbox del cuerpo: columnas con al menos `recorte_cuerpo` de la altura opaca (descarta armas y pelos finos).
    columnas = (alfa > 0).sum(axis=0)
    cuerpo = np.nonzero(columnas >= columnas.max() * recorte_cuerpo * 2)[0]
    filas = (alfa > 0).sum(axis=1)
    cuerpo_f = np.nonzero(filas >= filas.max() * recorte_cuerpo)[0]
    hitbox = {"x": int(cuerpo.min()), "y": int(cuerpo_f.min()), "w": int(cuerpo.max() - cuerpo.min() + 1), "h": int(cuerpo_f.max() - cuerpo_f.min() + 1)}
    return {"caja": caja, "alcance": alcance, "hitbox": hitbox}


def medir_hoja(ruta: Path, cw: int, ch: int, pivote: tuple[int, int]) -> list[dict | None]:
    im = np.asarray(Image.open(ruta).convert("RGBA"))
    filas, cols = im.shape[0] // ch, im.shape[1] // cw
    r = []
    for f in range(filas):
        for c in range(cols):
            r.append(medir_cuadro(im[f * ch:(f + 1) * ch, c * cw:(c + 1) * cw, 3], pivote))
    return r


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("hoja")
    p.add_argument("--cuadro", required=True, help="ANCHOxALTO")
    p.add_argument("--pivote", required=True, help="X,Y dentro del cuadro (los pies)")
    p.add_argument("--json")
    a = p.parse_args()
    cw, ch = (int(x) for x in a.cuadro.lower().split("x"))
    px, py = (int(x) for x in a.pivote.split(","))
    datos = medir_hoja(Path(a.hoja), cw, ch, (px, py))
    if a.json:
        Path(a.json).write_text(json.dumps(datos, indent=1), encoding="utf-8")
    alcances = [d["alcance"]["adelante"] for d in datos if d]
    print(f"{len(datos)} cuadros · alcance máximo {max(alcances) if alcances else 0} px")


if __name__ == "__main__":
    main()
