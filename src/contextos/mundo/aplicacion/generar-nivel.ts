// Caso de uso: generar un nivel completo y jugable de un metroidvania/roguelite: el grafo de salas (con llave y
// cerradura validado) + el interior de cada sala con garantía de recorrido. Todo derivado de una semilla: el mismo
// nivel en el cliente, en el servidor y en una repetición.

import { derivarSemilla } from "../../../nucleo/pcg32.ts";
import { aberturas, generarMazmorra, type MapaMazmorra, type OpcionesMazmorra } from "../dominio/mazmorra.ts";
import { construirSala, type SalaConstruida } from "../dominio/sala-plataformas.ts";

export interface Nivel {
  readonly numero: number;
  readonly mapa: MapaMazmorra;
  /** Interiores construidos bajo demanda (una sala se construye al entrar). */
  sala(id: number): SalaConstruida;
}

const TIPOS_SALA = new Set(["normal", "jefe", "tesoro", "arena", "inicio"]);

export function generarNivel(semillaPartida: number, numero: number, op: Omit<OpcionesMazmorra, "semilla"> & { altoMaxObstaculo?: number }): Nivel {
  const semilla = Number(derivarSemilla(semillaPartida, numero) & 0x7fffffffn);
  const mapa = generarMazmorra({ ...op, semilla });
  const cache = new Map<number, SalaConstruida>();
  return {
    numero,
    mapa,
    sala(id: number): SalaConstruida {
      let s = cache.get(id);
      if (!s) {
        const info = mapa.salas[id];
        const ab = aberturas(mapa, id);
        s = construirSala({
          puertas: { izq: !!ab.izq, der: !!ab.der, arr: !!ab.arr, aba: !!ab.aba },
          tipo: (TIPOS_SALA.has(info.tipo) ? info.tipo : "normal") as "normal",
          semilla: info.semilla,
          altoMaxObstaculo: op.altoMaxObstaculo,
        });
        cache.set(id, s);
      }
      return s;
    },
  };
}
