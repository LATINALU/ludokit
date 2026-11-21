// Genera archivos .wav con el sintetizador procedural: un impacto por material y fuerza, el sonido de botín de cada
// rareza y cortes de arma. Uso: node ejemplos/sonidos.ts [carpeta]   (por defecto ejemplos/salida/sonidos)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aWav, MATERIALES, recetaCorte, recetaImpacto, recetaRareza, renderizar, saturar } from "../src/contextos/audio/index.ts";
import { AzarSemilla } from "../src/nucleo/index.ts";

const carpeta = process.argv[2] ?? join(import.meta.dirname, "salida", "sonidos");
mkdirSync(carpeta, { recursive: true });
let n = 0;
const guardar = (nombre: string, pcm: Float32Array): void => {
  writeFileSync(join(carpeta, `${nombre}.wav`), aWav(saturar(pcm)));
  n++;
};
for (const m of Object.keys(MATERIALES)) for (const f of [0, 1, 2] as const) guardar(`impacto_${m}_${["leve", "normal", "fuerte"][f]}`, renderizar(recetaImpacto(m, f), { azar: new AzarSemilla(f + 1) }));
for (let r = 0; r <= 7; r++) guardar(`botin_rareza_${r}`, renderizar(recetaRareza(r)));
guardar("corte", renderizar(recetaCorte()));
guardar("corte_pesado", renderizar(recetaCorte(true)));
console.log(`${n} sonidos en ${carpeta}`);
