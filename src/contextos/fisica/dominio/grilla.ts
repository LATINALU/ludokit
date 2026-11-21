// Grilla de tiles: el mundo sólido de un juego 2D (plataformas, top-down, puzzles, roguelikes).
// Valores de celda como constantes numéricas para poder guardarlas en un Uint8Array (rápido y serializable).

export const Celda = {
  VACIO: 0,
  ROCA: 1,
  /** De un sentido: se atraviesa desde abajo y se pisa desde arriba (↓ + salto para bajar). */
  PLATAFORMA: 2,
  /** Daña al tocarla con los pies. */
  PINCHOS: 3,
} as const;
export type Celda = (typeof Celda)[keyof typeof Celda];

/** Lo único que la física necesita saber del mundo. Cualquier mapa (array, chunks infinitos, ruido) puede cumplirlo. */
export interface MundoTiles {
  readonly tile: number;
  celda(c: number, f: number): Celda;
}

export const esSolida = (c: Celda): boolean => c === Celda.ROCA;

export class Grilla implements MundoTiles {
  readonly cols: number;
  readonly filas: number;
  readonly tile: number;
  /** Qué devuelve fuera de los límites (ROCA = mundo cerrado, VACIO = abierto). */
  readonly fuera: Celda;
  private readonly datos: Uint8Array;

  constructor(cols: number, filas: number, tile = 16, fuera: Celda = Celda.VACIO) {
    this.cols = cols;
    this.filas = filas;
    this.tile = tile;
    this.fuera = fuera;
    this.datos = new Uint8Array(cols * filas);
  }

  /** Desde filas de texto: '#' roca, '=' plataforma, '^' pinchos, cualquier otro carácter vacío. */
  static desdeTexto(filas: readonly string[], tile = 16, fuera: Celda = Celda.VACIO): Grilla {
    const g = new Grilla(Math.max(...filas.map((f) => f.length)), filas.length, tile, fuera);
    filas.forEach((linea, f) => {
      for (let c = 0; c < linea.length; c++) {
        const ch = linea[c];
        g.poner(c, f, ch === "#" ? Celda.ROCA : ch === "=" ? Celda.PLATAFORMA : ch === "^" ? Celda.PINCHOS : Celda.VACIO);
      }
    });
    return g;
  }

  dentro(c: number, f: number): boolean {
    return c >= 0 && f >= 0 && c < this.cols && f < this.filas;
  }

  celda(c: number, f: number): Celda {
    return this.dentro(c, f) ? (this.datos[f * this.cols + c] as Celda) : this.fuera;
  }

  poner(c: number, f: number, v: Celda): void {
    if (this.dentro(c, f)) this.datos[f * this.cols + c] = v;
  }

  llenar(c0: number, f0: number, c1: number, f1: number, v: Celda): void {
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) this.poner(c, f, v);
  }

  solidaPx(x: number, y: number): boolean {
    return esSolida(this.celda(Math.floor(x / this.tile), Math.floor(y / this.tile)));
  }

  aTexto(): string[] {
    const r: string[] = [];
    for (let f = 0; f < this.filas; f++) {
      let s = "";
      for (let c = 0; c < this.cols; c++) s += ".#=^"[this.celda(c, f)];
      r.push(s);
    }
    return r;
  }

  /** Copia cruda (para guardar o enviar por red). */
  bytes(): Uint8Array {
    return this.datos.slice();
  }
}

/**
 * Autotile de 4 bits: bordes expuestos de una roca. 1 arriba · 2 derecha · 4 abajo · 8 izquierda.
 * Con 16 variantes de tile (índice = máscara) cualquier forma se dibuja sin costuras.
 * `fueraEsRoca`: el borde del mapa cuenta como roca (el marco no muestra bordes falsos).
 */
export function mascaraAutotile(m: MundoTiles, c: number, f: number, fueraEsRoca = true, dentro?: (c: number, f: number) => boolean): number {
  const roca = (cc: number, ff: number): boolean => {
    if (dentro && !dentro(cc, ff)) return fueraEsRoca;
    return m.celda(cc, ff) === Celda.ROCA;
  };
  let k = 0;
  if (!roca(c, f - 1)) k |= 1;
  if (!roca(c + 1, f)) k |= 2;
  if (!roca(c, f + 1)) k |= 4;
  if (!roca(c - 1, f)) k |= 8;
  return k;
}
