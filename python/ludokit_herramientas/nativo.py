"""Acceso al núcleo Rust de ludokit desde Python por la ABI C (ctypes), sin dependencias.

Sirve para herramientas pesadas (simular miles de disparos para balancear armas, probar hordas, precalcular visión)
con la velocidad de Rust. Compilar antes:  cd rust && cargo build --release

    from ludokit_herramientas.nativo import Nativo
    n = Nativo()                       # busca rust/target/release/ludokit.(dll|so|dylib)
    e = n.escena(4.0); n.capsula(e, 1, 9, 2, (0, 0, 10), (0, 1.8, 10), 0.4)
    n.rayos(e, [((0, 1, 0), (0, 0, 1), 50)])   # -> [(id, duenio, etiqueta, t) | None]
"""
from __future__ import annotations

import ctypes
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


class LudoImpacto(ctypes.Structure):
    _fields_ = [("id", ctypes.c_uint32), ("duenio", ctypes.c_uint32), ("etiqueta", ctypes.c_uint32), ("t", ctypes.c_float)]


def ruta_biblioteca() -> Path:
    nombre = {"win32": "ludokit.dll", "darwin": "libludokit.dylib"}.get(sys.platform, "libludokit.so")
    return RAIZ / "rust" / "target" / "release" / nombre


class Nativo:
    SIN_DUENIO = 0xFFFFFFFF

    def __init__(self, ruta: str | Path | None = None) -> None:
        self.lib = ctypes.CDLL(str(ruta or ruta_biblioteca()))
        L, f, u, i, p = self.lib, ctypes.c_float, ctypes.c_uint32, ctypes.c_int32, ctypes.c_void_p
        firmas = {
            "ludo_version_abi": ([], u),
            "ludo_escena_nueva": ([f], p),
            "ludo_escena_liberar": ([p], None),
            "ludo_escena_capsula": ([p, u, u, u, f, f, f, f, f, f, f], None),
            "ludo_escena_esfera": ([p, u, u, u, f, f, f, f], None),
            "ludo_escena_caja": ([p, u, u, u, f, f, f, f, f, f], None),
            "ludo_escena_mover": ([p, u, f, f, f], None),
            "ludo_escena_rayos": ([p, ctypes.POINTER(f), ctypes.POINTER(u), u, ctypes.POINTER(LudoImpacto)], u),
            "ludo_horda_nueva": ([i, i, ctypes.POINTER(ctypes.c_uint8), f, f, f, f, f], p),
            "ludo_horda_liberar": ([p], None),
            "ludo_horda_agregar": ([p, f, f], u),
            "ludo_horda_objetivo": ([p, i, i], None),
            "ludo_horda_paso": ([p, f], None),
            "ludo_horda_posiciones": ([p, ctypes.POINTER(f), u], u),
        }
        for nombre, (args, res) in firmas.items():
            fn = getattr(L, nombre)
            fn.argtypes = args
            fn.restype = res

    def version(self) -> int:
        return self.lib.ludo_version_abi()

    def escena(self, celda: float = 4.0):
        return self.lib.ludo_escena_nueva(celda)

    def capsula(self, e, id_: int, duenio: int, etiqueta: int, a, b, radio: float) -> None:
        self.lib.ludo_escena_capsula(e, id_, duenio, etiqueta, *a, *b, radio)

    def mover(self, e, duenio: int, d) -> None:
        self.lib.ludo_escena_mover(e, duenio, *d)

    def rayos(self, e, lista, ignorar: list[int] | None = None):
        n = len(lista)
        plano = (ctypes.c_float * (n * 7))(*[x for (o, d, largo) in lista for x in (*o, *d, largo)])
        ign = (ctypes.c_uint32 * n)(*ignorar) if ignorar else None
        out = (LudoImpacto * n)()
        self.lib.ludo_escena_rayos(e, plano, ign, n, out)
        return [(h.id, h.duenio, h.etiqueta, h.t) if h.t >= 0 else None for h in out]

    def liberar_escena(self, e) -> None:
        self.lib.ludo_escena_liberar(e)

    def horda(self, cols: int, filas: int, bloqueo: bytes | None = None, tile=1.0, velocidad=4.0, aceleracion=20.0, radio=0.6, separacion=2.0):
        b = (ctypes.c_uint8 * len(bloqueo)).from_buffer_copy(bloqueo) if bloqueo else None
        return self.lib.ludo_horda_nueva(cols, filas, b, tile, velocidad, aceleracion, radio, separacion)

    def horda_posiciones(self, h, cantidad: int) -> list[tuple[float, float]]:
        out = (ctypes.c_float * (cantidad * 2))()
        n = self.lib.ludo_horda_posiciones(h, out, cantidad)
        return [(out[k * 2], out[k * 2 + 1]) for k in range(n)]
