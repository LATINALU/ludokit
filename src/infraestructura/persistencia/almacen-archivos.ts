// Adaptador de almacén en disco para Node/Electron/servidor: escritura atómica (temporal + renombrar), así un
// corte de luz a mitad de guardado nunca deja un archivo roto. Se importa aparte (usa node:fs).

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Almacen } from "./guardado.ts";

export class AlmacenArchivos implements Almacen {
  private readonly carpeta: string;

  constructor(carpeta: string) {
    this.carpeta = carpeta;
  }

  private ruta(clave: string): string {
    return join(this.carpeta, clave.replace(/[^a-zA-Z0-9._/-]/g, "_") + ".json");
  }

  async leer(clave: string): Promise<string | null> {
    try {
      return await readFile(this.ruta(clave), "utf8");
    } catch {
      return null;
    }
  }

  async escribir(clave: string, contenido: string): Promise<void> {
    const r = this.ruta(clave);
    await mkdir(dirname(r), { recursive: true });
    const tmp = `${r}.tmp`;
    await writeFile(tmp, contenido, "utf8");
    await rename(tmp, r);
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }
}
