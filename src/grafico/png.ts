// Codificador PNG puro (sin dependencias, funciona en Node, navegador y servidor): RGBA8 → bytes .png válidos.
// Usa bloques deflate "almacenados" (sin compresión): los archivos son más grandes, pero el código es mínimo y sirve
// para capturas deterministas en tests, herramientas y exportar arte generado por código.

import type { Imagen } from "./imagen.ts";

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array, inicio = 0, fin = datos.length): number {
  let c = 0xffffffff;
  for (let i = inicio; i < fin; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(d: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < d.length; i++) {
    a = (a + d[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** zlib con bloques almacenados (máx. 65535 bytes por bloque). */
function zlibAlmacenado(crudo: Uint8Array): Uint8Array {
  const bloques = Math.max(1, Math.ceil(crudo.length / 65535));
  const out = new Uint8Array(2 + crudo.length + bloques * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let b = 0; b < bloques; b++) {
    const ini = b * 65535;
    const len = Math.min(65535, crudo.length - ini);
    out[o++] = b === bloques - 1 ? 1 : 0;
    out[o++] = len & 0xff;
    out[o++] = len >>> 8;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >>> 8) & 0xff;
    out.set(crudo.subarray(ini, ini + len), o);
    o += len;
  }
  const ad = adler32(crudo);
  out[o++] = ad >>> 24;
  out[o++] = (ad >>> 16) & 0xff;
  out[o++] = (ad >>> 8) & 0xff;
  out[o++] = ad & 0xff;
  return out;
}

export function codificarPng(im: Imagen): Uint8Array {
  const fila = im.w * 4 + 1;
  const crudo = new Uint8Array(fila * im.h);
  for (let y = 0; y < im.h; y++) {
    crudo[y * fila] = 0; // filtro "ninguno"
    crudo.set(im.datos.subarray(y * im.w * 4, (y + 1) * im.w * 4), y * fila + 1);
  }
  const idat = zlibAlmacenado(crudo);
  const trozos: Array<[string, Uint8Array]> = [];
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, im.w);
  v.setUint32(4, im.h);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, sin entrelazado
  trozos.push(["IHDR", ihdr], ["IDAT", idat], ["IEND", new Uint8Array(0)]);
  const total = 8 + trozos.reduce((s, [, d]) => s + 12 + d.length, 0);
  const out = new Uint8Array(total);
  out.set([137, 80, 78, 71, 13, 10, 26, 10]);
  let o = 8;
  const dv = new DataView(out.buffer);
  for (const [tipo, d] of trozos) {
    dv.setUint32(o, d.length);
    for (let i = 0; i < 4; i++) out[o + 4 + i] = tipo.charCodeAt(i);
    out.set(d, o + 8);
    dv.setUint32(o + 8 + d.length, crc32(out, o + 4, o + 8 + d.length));
    o += 12 + d.length;
  }
  return out;
}
