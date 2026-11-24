"""Simulador de balance: tabla nivel a nivel del poder esperado del jugador, los enemigos y jefes derivados, y
cuántos golpes/segundos dura cada pelea. Exporta CSV para abrirlo en una planilla y discutir números con el
equipo de diseño ANTES de tocar el juego. El modelo (curvas del jugador + reglas) se lee de un JSON con el mismo
formato que `ModeloBalance` en TypeScript; sin `--modelo` usa el de los vectores compartidos. No hay nivel máximo:
`--hasta` puede ser 50, 500 o 5000.

    python -I -m ludokit_herramientas.balance --hasta 100 --csv balance.csv [--modelo modelo.json]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

from .nucleo import ModeloBalance, mitigacion

VECTORES = Path(__file__).resolve().parents[2] / "vectores" / "vectores.json"


def modelo_por_defecto() -> ModeloBalance:
    m = json.loads(VECTORES.read_text(encoding="utf-8"))["modelo_balance"]
    return ModeloBalance(m["curva"], m["reglas"])


def pelea(vida_a, atk_a, def_a, k_a, ritmo_a, vida_b, atk_b, def_b, k_b, ritmo_b) -> dict:
    danio_a = max(1, atk_a * mitigacion(def_b, k_b))
    danio_b = max(1, atk_b * mitigacion(def_a, k_a))
    golpes_ab = math.ceil(vida_b / danio_a)
    golpes_ba = math.ceil(vida_a / danio_b)
    return {"golpes_para_matar": golpes_ab, "golpes_para_morir": golpes_ba, "segundos_matar": golpes_ab / ritmo_a, "segundos_morir": golpes_ba / ritmo_b}


def tabla(hasta: int, modelo: ModeloBalance | None = None) -> list[dict]:
    m = modelo or modelo_por_defecto()
    ke = m.r["kEnemigo"]
    filas = []
    for n in range(1, hasta + 1):
        pe = m.poder(n)
        k = m.k_jugador(n)
        e = m.enemigo(n)
        j = m.jefe(n)
        pc = pelea(pe["vida"], pe["golpe"], pe["defensa"], k, 2, e["vida"], e["ataque"], e["defensa"], ke, 1)
        pj = pelea(pe["vida"], pe["golpe"], pe["defensa"], k, 2, j["vida"], j["ataque"], j["defensa"], ke, 1)
        filas.append({
            "nivel": n,
            "jugador_golpe": round(pe["golpe"], 1), "jugador_vida": round(pe["vida"], 1), "jugador_defensa": round(pe["defensa"], 1),
            "comun_vida": e["vida"], "comun_ataque": e["ataque"], "comun_golpes_para_matar": pc["golpes_para_matar"], "comun_golpes_para_morir": pc["golpes_para_morir"],
            "jefe_vida": j["vida"], "jefe_ataque": j["ataque"], "jefe_segundos": round(pj["segundos_matar"], 1), "jefe_golpes_para_morir": pj["golpes_para_morir"],
        })
    return filas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hasta", type=int, default=60)
    p.add_argument("--modelo", help="JSON {curva, reglas} con curvas de ludokit")
    p.add_argument("--csv")
    a = p.parse_args()
    modelo = None
    if a.modelo:
        d = json.loads(Path(a.modelo).read_text(encoding="utf-8"))
        modelo = ModeloBalance(d["curva"], d["reglas"])
    filas = tabla(a.hasta, modelo)
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
