"""Simulador de balance: tabla nivel a nivel del poder esperado del jugador, los enemigos y jefes derivados, y
cuántos golpes/segundos dura cada pelea. Exporta CSV para abrirlo en una planilla y discutir números con el
equipo de diseño ANTES de tocar el juego.

    python -I -m ludokit_herramientas.balance --hasta 40 --csv balance.csv
"""
from __future__ import annotations

import argparse
import csv
import math
import sys

from .nucleo import enemigo_esperado, jefe_esperado, mitigacion, poder_esperado


def pelea(vida_a, atk_a, def_a, k_a, ritmo_a, vida_b, atk_b, def_b, k_b, ritmo_b) -> dict:
    danio_a = max(1, atk_a * mitigacion(def_b, k_b))
    danio_b = max(1, atk_b * mitigacion(def_a, k_a))
    golpes_ab = math.ceil(vida_b / danio_a)
    golpes_ba = math.ceil(vida_a / danio_b)
    return {"golpes_para_matar": golpes_ab, "golpes_para_morir": golpes_ba, "segundos_matar": golpes_ab / ritmo_a, "segundos_morir": golpes_ba / ritmo_b}


def tabla(hasta: int) -> list[dict]:
    filas = []
    for n in range(1, hasta + 1):
        pe = poder_esperado(n)
        k = max(30, 1.5 * pe["defensa"])
        e = enemigo_esperado(n)
        j = jefe_esperado(n)
        pc = pelea(pe["vida"], pe["golpe"], pe["defensa"], k, 2, e["vida"], e["ataque"], e["defensa"], 60, 1)
        pj = pelea(pe["vida"], pe["golpe"], pe["defensa"], k, 2, j["vida"], j["ataque"], j["defensa"], 60, 1)
        filas.append({
            "nivel": n,
            "jugador_golpe": round(pe["golpe"], 1), "jugador_vida": round(pe["vida"], 1), "jugador_defensa": round(pe["defensa"], 1),
            "comun_vida": e["vida"], "comun_ataque": e["ataque"], "comun_golpes_para_matar": pc["golpes_para_matar"], "comun_golpes_para_morir": pc["golpes_para_morir"],
            "jefe_vida": j["vida"], "jefe_ataque": j["ataque"], "jefe_segundos": round(pj["segundos_matar"], 1), "jefe_golpes_para_morir": pj["golpes_para_morir"],
        })
    return filas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hasta", type=int, default=24)
    p.add_argument("--csv")
    a = p.parse_args()
    filas = tabla(a.hasta)
    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(filas[0]))
            w.writeheader()
            w.writerows(filas)
        print(f"{len(filas)} niveles → {a.csv}")
    else:
        w = csv.DictWriter(sys.stdout, fieldnames=list(filas[0]))
        w.writeheader()
        w.writerows(filas)


if __name__ == "__main__":
    main()
