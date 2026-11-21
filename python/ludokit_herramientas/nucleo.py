"""Port en Python del núcleo determinista (PCG32, mulberry32, ruido) y de las fórmulas de balance de ludokit.

Python no es para el bucle de juego: es para HERRAMIENTAS que deben dar los mismos números que el juego
(generar contenido con semilla, simular balance, validar tablas, procesar arte). Verificado contra
vectores/vectores.json con `python -I -m unittest discover -s python/pruebas`.
"""
from __future__ import annotations

import math

M64 = (1 << 64) - 1
M32 = 0xFFFFFFFF


class Pcg32:
    """PCG32 XSH-RR, mismas salidas que la referencia TypeScript y el crate de Rust."""

    def __init__(self, semilla: int) -> None:
        s = semilla & M64
        self.estado = 0
        self.inc = ((s << 1) | 1) & M64
        self.u32()
        self.estado = (self.estado + (s ^ 0x853C49E6748FEA9B)) & M64
        self.u32()

    def u32(self) -> int:
        viejo = self.estado
        self.estado = (viejo * 6364136223846793005 + self.inc) & M64
        xs = (((viejo >> 18) ^ viejo) >> 27) & M32
        rot = viejo >> 59
        return ((xs >> rot) | (xs << ((32 - rot) & 31))) & M32

    def siguiente(self) -> float:
        return (self.u32() >> 8) / (1 << 24)

    def rango(self, a: int, b: int) -> int:
        return a if b <= a else a + self.u32() % (b - a + 1)


def derivar_semilla(semilla: int, n: int) -> int:
    return (semilla + n * 0x9E3779B97F4A7C15) & M64


class Mulberry32:
    def __init__(self, semilla: int) -> None:
        self.estado = semilla & M32

    def siguiente(self) -> float:
        self.estado = (self.estado + 0x6D2B79F5) & M32
        t = self.estado
        t = ((t ^ (t >> 15)) * (t | 1)) & M32
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296


def _i32(x: int) -> int:
    return x & M32


def hash2(x: int, y: int, semilla: int = 0) -> float:
    h = _i32(_i32(x) * 374761393 + _i32(y) * 668265263 + _i32(semilla) * 2147483647)
    h = _i32((h ^ (h >> 13)) * 1274126177)
    return ((h ^ (h >> 16)) & M32) / 4294967296


def _suave(t: float) -> float:
    return t * t * t * (t * (t * 6 - 15) + 10)


def ruido_valor(x: float, y: float, semilla: int = 0) -> float:
    xi, yi = math.floor(x), math.floor(y)
    tx, ty = _suave(x - xi), _suave(y - yi)
    m = lambda a, b, t: a + (b - a) * t  # noqa: E731
    return m(m(hash2(xi, yi, semilla), hash2(xi + 1, yi, semilla), tx), m(hash2(xi, yi + 1, semilla), hash2(xi + 1, yi + 1, semilla), tx), ty)


def mitigacion(defensa: float, k: float) -> float:
    return k / (k + max(0.0, defensa))


def poder_esperado(nivel: float) -> dict:
    p = max(1.0, nivel)
    q = min(p, 24.0)
    hondo = (p / 24) ** 0.8 if p > 24 else 1.0
    return {
        "golpe": 30 * q ** 0.93 * hondo,
        "vida": 115 * q ** 0.78 * hondo,
        "defensa": 12 * q ** 0.92 * (p / 24 if p > 24 else 1.0),
        "resistencia": min(0.12, 0.005 * p),
    }


def _round_js(x: float) -> int:
    return math.floor(x + 0.5)


def pasa_al_jugador(nivel: float) -> float:
    pe = poder_esperado(nivel)
    k = max(30.0, 1.5 * pe["defensa"])
    return mitigacion(pe["defensa"], k) * (1 - pe["resistencia"])


def enemigo_esperado(nivel: float) -> dict:
    p = max(0.0, nivel - 1)
    pe = poder_esperado(nivel)
    defensa = 1 + 0.45 * p
    return {
        "vida": _round_js(6 * pe["golpe"] * mitigacion(defensa, 60)),
        "ataque": _round_js(pe["vida"] / (11 * pasa_al_jugador(nivel))),
        "defensa": _round_js(defensa),
        "exp": _round_js(1 + 0.8 * p),
    }


def jefe_esperado(nivel: float) -> dict:
    p = max(1.0, nivel)
    pe = poder_esperado(p)
    defensa = 6 * (1 + 0.3 * (p - 1))
    duracion = 48 + 1.8 * p
    aguante = max(5.5, 7 - (p - 1) / 6)
    return {
        "vida": _round_js(pe["golpe"] * mitigacion(defensa, 60) * 2 * duracion * (1.6 * 1.2 * 2) / 2),
        "ataque": _round_js(pe["vida"] / (aguante * 1.1 * pasa_al_jugador(p))),
        "defensa": _round_js(defensa),
        "exp": _round_js(120 * (1 + 0.9 * (p - 1))),
        "duracion": duracion,
    }


RAREZA = {"primero": [64, 28, 7.4, 0.5, 0.06, 0.04], "ultimo": [26, 36, 27, 10, 1.2, 0.12], "factor": [1, 1, 0.8, 0.5, 0.4, 0.5]}


def pesos_rareza(nivel: float, niveles: int = 24, exponente: float = 1.7) -> list[float]:
    k = min(1.0, max(0.0, (nivel - 1) / max(1, niveles - 1))) ** exponente
    return [(a + (b - a) * k) * f for a, b, f in zip(RAREZA["primero"], RAREZA["ultimo"], RAREZA["factor"])]
