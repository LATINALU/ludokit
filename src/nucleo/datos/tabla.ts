// Tabla de definiciones: cada fila es la definición de algo (objeto, enemigo, buff) y la tabla es un índice por id.
// `requerir` falla en voz alta si falta una referencia: se usa al arrancar para validar referencias cruzadas.

export class Tabla<T> {
  readonly nombre: string;
  private readonly filas = new Map<number, T>();

  constructor(nombre: string, filas: Iterable<T>, idDe: (fila: T) => number) {
    this.nombre = nombre;
    for (const fila of filas) {
      const id = idDe(fila);
      if (this.filas.has(id)) {
        throw new Error(`${nombre}: id repetido ${id}`);
      }
      this.filas.set(id, fila);
    }
  }

  get tamano(): number {
    return this.filas.size;
  }

  buscar(id: number): T | undefined {
    return this.filas.get(id);
  }

  /** Igual que buscar, pero un id inexistente es un error de datos. */
  requerir(id: number): T {
    const fila = this.filas.get(id);
    if (fila === undefined) {
      throw new Error(`${this.nombre}: no existe el id ${id}`);
    }
    return fila;
  }

  existe(id: number): boolean {
    return this.filas.has(id);
  }

  todas(): IterableIterator<T> {
    return this.filas.values();
  }
}
