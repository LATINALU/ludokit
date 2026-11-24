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


def evaluar(c: dict, x: float) -> float:
    """Evalúa una curva de ludokit (mismo formato JSON que `nucleo/escalado.ts`)."""
    t = c["tipo"]
    if t == "constante":
        return c["valor"]
    if t == "lineal":
        return c["base"] + c["porNivel"] * (x - 1)
    if t == "potencia":
        return c["base"] * max(0.0, x) ** c["exp"]
    if t == "exponencial":
        return c["base"] * c["razon"] ** (x - 1)
    if t == "saturacion":
        e = c.get("exp", 1)
        d = max(0.0, x - 1) ** e
        return d / (d + max(1e-9, c["mitad"]) ** e)
    if t == "logistica":
        f = lambda v: 1 / (1 + math.exp(-c["pendiente"] * (v - c["centro"])))  # noqa: E731
        return max(0.0, (f(x) - f(1)) / (1 - f(1)))
    if t == "tramos":
        p = c["puntos"]
        lin = c.get("extrapolar") == "lineal"
        pend = lambda a, b: b[1] if b[0] == a[0] else a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])  # noqa: E731
        if not p:
            return 0.0
        if len(p) == 1:
            return p[0][1]
        if x <= p[0][0]:
            return pend(p[0], p[1]) if lin else p[0][1]
        for k in range(1, len(p)):
            if x <= p[k][0]:
                return pend(p[k - 1], p[k])
        return pend(p[-2], p[-1]) if lin else p[-1][1]
    if t == "escalones":
        v = c.get("inicial", 0)
        for desde, valor in c["puntos"]:
            if x >= desde:
                v = valor
        return v
    if t == "topeSuave":
        return evaluar(c["curva"], x) if x <= c["desde"] else evaluar(c["curva"], c["desde"]) * (x / c["desde"]) ** c["exp"]
    if t == "limitar":
        v = evaluar(c["curva"], x)
        return min(c.get("max", math.inf), max(c.get("min", -math.inf), v))
    if t == "producto":
        r = 1.0
        for k in c["curvas"]:
            r *= evaluar(k, x)
        return r
    if t == "suma":
        return sum(evaluar(k, x) for k in c["curvas"])
    if t == "desplazar":
        return evaluar(c["curva"], x + c["desplazar"])
    if t == "escalar":
        return c["valor"] * evaluar(c["curva"], x)
    raise ValueError(f"curva desconocida: {t}")


def _round_js(x: float) -> int:
    return math.floor(x + 0.5)


class ModeloBalance:
    """Port de `balance.ModeloBalance`: curva del jugador + reglas, sin nivel máximo."""

    def __init__(self, curva: dict, reglas: dict) -> None:
        self.c = curva
        self.r = reglas

    def poder(self, nivel: float) -> dict:
        p = max(1.0, nivel)
        return {
            "golpe": evaluar(self.c["golpe"], p),
            "vida": evaluar(self.c["vida"], p),
            "defensa": evaluar(self.c["defensa"], p),
            "resistencia": min(0.95, max(0.0, evaluar(self.c["resistencia"], p))),
        }

    def k_jugador(self, nivel: float) -> float:
        return max(self.r["kJugadorMin"], self.r["kJugadorFactor"] * self.poder(nivel)["defensa"])

    def pasa_al_jugador(self, nivel: float) -> float:
        pe = self.poder(nivel)
        return mitigacion(pe["defensa"], self.k_jugador(nivel)) * (1 - pe["resistencia"])

    def enemigo(self, nivel: float, peso_vida: float = 1, peso_ataque: float = 1) -> dict:
        r = self.r
        n = max(1.0, nivel)
        pe = self.poder(n)
        defensa = evaluar(r["defensaEnemigo"], n)
        return {
            "vida": _round_js(r["golpesParaMatar"] * pe["golpe"] * mitigacion(defensa, r["kEnemigo"]) * peso_vida),
            "ataque": _round_js(pe["vida"] / (r["golpesParaMorir"] * self.pasa_al_jugador(n)) * peso_ataque),
            "defensa": _round_js(defensa),
            "exp": _round_js(evaluar(r["expEnemigo"], n)),
        }

    def jefe(self, nivel: float, peso: float = 1) -> dict:
        r = self.r
        n = max(1.0, nivel)
        pe = self.poder(n)
        defensa = evaluar(r["defensaJefe"], n)
        duracion = evaluar(r["duracionJefe"], n)
        aguante = max(1.0, evaluar(r["aguanteJefe"], n))
        return {
            "vida": _round_js(pe["golpe"] * mitigacion(defensa, r["kEnemigo"]) * r["ritmoJugador"] * duracion * peso * r["multVidaJefe"]),
            "ataque": _round_js(pe["vida"] / (aguante * self.pasa_al_jugador(n))),
            "defensa": _round_js(defensa),
            "exp": _round_js(evaluar(r["expJefe"], n)),
            "duracion": duracion,
        }


def pesos_rareza(tabla: dict, nivel: float) -> list[float]:
    """Pesos por rareza en un nivel (tabla con `primero`, `ultimo`, `progreso` y `factor` opcional)."""
    k = min(1.0, max(0.0, evaluar(tabla["progreso"], max(1.0, nivel))))
    factor = tabla.get("factor") or [1] * len(tabla["primero"])
    return [(a + (b - a) * k) * f for a, b, f in zip(tabla["primero"], tabla["ultimo"], factor)]
