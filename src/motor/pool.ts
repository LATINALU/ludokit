// Pool de objetos: reutiliza instancias (balas, partículas, textos flotantes) para no crear basura en el bucle
// caliente. `adquirir` reinicia un objeto libre o crea uno nuevo; `liberar` lo devuelve.

export class Pool<T> {
  private readonly libres: T[] = [];
  private readonly crear: () => T;
  private readonly reiniciar: (o: T) => void;
  creados = 0;

  constructor(crear: () => T, reiniciar: (o: T) => void, precalentar = 0) {
    this.crear = crear;
    this.reiniciar = reiniciar;
    for (let i = 0; i < precalentar; i++) {
      this.libres.push(crear());
      this.creados++;
    }
  }

  adquirir(): T {
    const o = this.libres.pop();
    if (o !== undefined) {
      this.reiniciar(o);
      return o;
    }
    this.creados++;
    const n = this.crear();
    this.reiniciar(n);
    return n;
  }

  liberar(o: T): void {
    this.libres.push(o);
  }

  get disponibles(): number {
    return this.libres.length;
  }
}
