"""Pipeline de arte pixel: lleva cualquier dibujo u hoja de animación al estilo unificado del juego.

    python -I -m ludokit_herramientas.sprites pixelar  entrada.png salida.png --alto 24 --colores 10
    python -I -m ludokit_herramientas.sprites hoja     carpeta_cuadros/ salida --alto 32 --fps 12

Reglas (las que hacen que el arte de distintas fuentes parezca de un mismo juego):
  1. Recorte a la caja de lo visible y escala al alto FINAL con LANCZOS (dibujar grande y achicar borra caras).
  2. Alfa binaria (sin bordes semitransparentes que se ven sucios a escala entera).
  3. Solo las piezas conectadas grandes (fuera chispas sueltas, humo y sombras del original).
  4. Contraste ×1,2 y saturación ×1,15; UNA paleta para toda la tira (cuantizar por cuadro hace parpadear).
  5. Contorno oscuro de 1 px por fuera de la silueta.
  6. Salida: hoja en grilla + silueta blanca (destello de golpe) + índice JSON {cuadros, fps, w, h, cols}.
Requiere Pillow y NumPy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

CONTORNO = (16, 12, 22, 255)


def piezas_grandes(alfa: np.ndarray, fraccion: float = 0.2, minimo: int = 6) -> np.ndarray:
    """Máscara con solo las componentes conexas (4-vecinas) de tamaño ≥ fraccion × la mayor."""
    h, w = alfa.shape
    etiqueta = np.zeros((h, w), np.int32)
    tamanos = [0]
    n = 0
    for y in range(h):
        for x in range(w):
            if not alfa[y, x] or etiqueta[y, x]:
                continue
            n += 1
            pila = [(y, x)]
            etiqueta[y, x] = n
            t = 0
            while pila:
                cy, cx = pila.pop()
                t += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and alfa[ny, nx] and not etiqueta[ny, nx]:
                        etiqueta[ny, nx] = n
                        pila.append((ny, nx))
            tamanos.append(t)
    if n == 0:
        return alfa
    mayor = max(tamanos)
    validas = {i for i, t in enumerate(tamanos) if i > 0 and t >= max(minimo, mayor * fraccion)}
    return np.isin(etiqueta, list(validas))


def contornear(rgba: np.ndarray, color=CONTORNO) -> np.ndarray:
    m = rgba[..., 3] > 0
    borde = np.zeros_like(m)
    borde[1:, :] |= m[:-1, :]
    borde[:-1, :] |= m[1:, :]
    borde[:, 1:] |= m[:, :-1]
    borde[:, :-1] |= m[:, 1:]
    borde &= ~m
    out = rgba.copy()
    out[borde] = color
    return out


def normalizar_tira(cuadros: list[Image.Image], alto: int, colores: int = 12, umbral: int = 150, contorno: bool = True) -> list[Image.Image]:
    """Normaliza una animación completa con caja y paleta comunes."""
    cuadros = [c.convert("RGBA") for c in cuadros]
    cajas = [c.getbbox() for c in cuadros if c.getbbox()]
    if not cajas:
        return cuadros
    caja = (min(b[0] for b in cajas), min(b[1] for b in cajas), max(b[2] for b in cajas), max(b[3] for b in cajas))
    recortes = [c.crop(caja) for c in cuadros]
    borde = 2 if contorno else 0
    k = (alto - borde) / recortes[0].height
    w, h = max(1, round(recortes[0].width * k)), max(1, alto - borde)
    chicos = [r.resize((w, h), Image.LANCZOS) for r in recortes]
    # Una sola paleta: se cuantiza la tira entera pegada en horizontal.
    tira = Image.new("RGBA", (w * len(chicos), h))
    for i, c in enumerate(chicos):
        tira.paste(c, (i * w, 0))
    arr = np.asarray(tira).copy()
    opaco = arr[..., 3] >= umbral
    rgb = Image.fromarray(arr[..., :3], "RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.2)
    rgb = ImageEnhance.Color(rgb).enhance(1.15)
    rgb = np.asarray(rgb.quantize(colors=colores, method=Image.Quantize.MEDIANCUT).convert("RGB"))
    salida = []
    for i in range(len(chicos)):
        a = opaco[:, i * w:(i + 1) * w]
        a = piezas_grandes(a)
        capa = np.zeros((h + borde, w + borde, 4), np.uint8)
        o = borde // 2
        capa[o:o + h, o:o + w, :3] = rgb[:, i * w:(i + 1) * w]
        capa[o:o + h, o:o + w, 3] = np.where(a, 255, 0)
        salida.append(Image.fromarray(contornear(capa) if contorno else capa, "RGBA"))
    return salida


def pixelar(img: Image.Image, alto: int, colores: int = 10, contorno: bool = True) -> Image.Image:
    return normalizar_tira([img], alto, colores, umbral=120, contorno=contorno)[0]


def silueta(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert("RGBA")).copy()
    a[..., :3] = 255
    return Image.fromarray(a, "RGBA")


def armar_hoja(cuadros: list[Image.Image], salida: Path, fps: int = 12, cols: int | None = None) -> dict:
    """Escribe <salida>.png, <salida>_sil.png y <salida>.json."""
    w, h = cuadros[0].size
    cols = cols or min(len(cuadros), 8)
    filas = (len(cuadros) + cols - 1) // cols
    hoja = Image.new("RGBA", (w * cols, h * filas))
    sil = Image.new("RGBA", hoja.size)
    for i, c in enumerate(cuadros):
        pos = ((i % cols) * w, (i // cols) * h)
        hoja.paste(c, pos)
        sil.paste(silueta(c), pos)
    salida.parent.mkdir(parents=True, exist_ok=True)
    hoja.save(salida.with_suffix(".png"))
    sil.save(salida.parent / f"{salida.name}_sil.png")
    indice = {"cuadros": len(cuadros), "fps": fps, "w": w, "h": h, "cols": cols}
    salida.with_suffix(".json").write_text(json.dumps(indice), encoding="utf-8")
    return indice


def girar_tono(img: Image.Image, grados: float, saturacion: float = 1.0, brillo: float = 1.0) -> Image.Image:
    """Variante de color de un sprite (×4 contenido por criatura): gira el tono en HSV."""
    rgba = img.convert("RGBA")
    a = rgba.getchannel("A")
    hsv = np.asarray(rgba.convert("RGB").convert("HSV")).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + grados / 360 * 255) % 255
    hsv[..., 1] = np.clip(hsv[..., 1] * saturacion, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * brillo, 0, 255)
    out = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGBA")
    out.putalpha(a)
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("pixelar")
    a.add_argument("entrada")
    a.add_argument("salida")
    a.add_argument("--alto", type=int, default=24)
    a.add_argument("--colores", type=int, default=10)
    a.add_argument("--sin-contorno", action="store_true")
    b = sub.add_parser("hoja")
    b.add_argument("carpeta")
    b.add_argument("salida")
    b.add_argument("--alto", type=int, default=32)
    b.add_argument("--colores", type=int, default=12)
    b.add_argument("--fps", type=int, default=12)
    args = p.parse_args()
    if args.cmd == "pixelar":
        pixelar(Image.open(args.entrada), args.alto, args.colores, not args.sin_contorno).save(args.salida)
    else:
        cuadros = [Image.open(f) for f in sorted(Path(args.carpeta).glob("*.png"))]
        print(armar_hoja(normalizar_tira(cuadros, args.alto, args.colores), Path(args.salida), args.fps))


if __name__ == "__main__":
    main()
