// PCG32 (XSH-RR): generador determinista de período 2^64 con BigInt para los 64 bits. Implementa `Azar`.
// Ventaja sobre mulberry32: secuencias independientes por semilla derivada (una por nivel, sala o sistema).
import type { Azar } from "./azar.ts";

const M64 = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;

/** Semilla derivada para un sub-sistema: semilla + n · φ64 (p. ej. una por nivel o por sala). */
export function derivarSemilla(semilla: number | bigint, n: number): bigint {
  return (BigInt(semilla) + BigInt(n) * 0x9e3779b97f4a7c15n) & M64;
}

export class Pcg32 implements Azar {
  private estado = 0n;
  private readonly inc: bigint;

  constructor(semilla: number | bigint) {
    const s = BigInt(semilla) & M64;
    this.inc = ((s << 1n) | 1n) & M64;
    this.u32();
    this.estado = (this.estado + (s ^ 0x853c49e6748fea9bn)) & M64;
    this.u32();
  }

  u32(): number {
    const viejo = this.estado;
    this.estado = (viejo * MULT + this.inc) & M64;
    const xs = Number((((viejo >> 18n) ^ viejo) >> 27n) & 0xffffffffn);
    const rot = Number(viejo >> 59n);
    return ((xs >>> rot) | (xs << ((32 - rot) & 31))) >>> 0;
  }

  /** [0, 1) con 24 bits. */
  siguiente(): number {
    return (this.u32() >>> 8) / (1 << 24);
  }

  /** Entero en [a, b] inclusive. */
  rango(a: number, b: number): number {
    return b <= a ? a : a + (this.u32() % (b - a + 1));
  }

  rangoF(a: number, b: number): number {
    return a + (b - a) * this.siguiente();
  }

  prob(p: number): boolean {
    return this.siguiente() < p;
  }

  signo(): 1 | -1 {
    return (this.u32() & 1) === 0 ? 1 : -1;
  }

  elegir<T>(v: readonly T[]): T {
    if (v.length === 0) throw new Error("Pcg32.elegir: lista vacía");
    return v[this.u32() % v.length];
  }
}
