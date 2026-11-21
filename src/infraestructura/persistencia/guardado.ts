// Guardado versionado con migraciones y almacenes intercambiables (puerto/adaptador):
//   - Formato: { version, guardadoEn, datos, suma } — `suma` detecta archivos corruptos o editados a mano.
//   - Migraciones encadenadas v1→v2→…→actual; si una versión es demasiado vieja (o falla), se APARTA el archivo
//     (respaldo) y se empieza limpio: nunca se crashea por un guardado viejo.
//   - Escritura segura: se escribe un temporal y se renombra (en el adaptador de archivos), y se rota un respaldo.
//   - Ranuras (partida, meta, ajustes) y modo aislado (para trucos/depuración sin tocar la partida real).

export interface Almacen {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, contenido: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}

export class AlmacenMemoria implements Almacen {
  readonly datos = new Map<string, string>();
  async leer(k: string): Promise<string | null> {
    return this.datos.get(k) ?? null;
  }
  async escribir(k: string, c: string): Promise<void> {
    this.datos.set(k, c);
  }
  async borrar(k: string): Promise<void> {
    this.datos.delete(k);
  }
}

/** Almacén para navegador (localStorage). */
export class AlmacenLocal implements Almacen {
  private readonly prefijo: string;
  constructor(prefijo = "juego:") {
    this.prefijo = prefijo;
  }
  async leer(k: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(this.prefijo + k) ?? null;
  }
  async escribir(k: string, c: string): Promise<void> {
    globalThis.localStorage?.setItem(this.prefijo + k, c);
  }
  async borrar(k: string): Promise<void> {
    globalThis.localStorage?.removeItem(this.prefijo + k);
  }
}

/** Suma FNV-1a de 32 bits (rápida; no es seguridad, es integridad). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type Migracion = (datos: any) => any;

export interface OpcionesGuardado<T> {
  readonly version: number;
  /** migraciones[n] convierte de la versión n a la n+1. */
  readonly migraciones?: Readonly<Record<number, Migracion>>;
  /** Versión mínima que se puede migrar; más vieja = se aparta y se empieza de cero. */
  readonly versionMinima?: number;
  readonly porDefecto: () => T;
  readonly validar?: (d: unknown) => d is T;
  readonly ahora?: () => number;
}

export type ResultadoCarga<T> =
  | { readonly estado: "nuevo"; readonly datos: T }
  | { readonly estado: "cargado"; readonly datos: T; readonly migradoDesde?: number }
  | { readonly estado: "apartado"; readonly datos: T; readonly motivo: string };

export class Guardado<T> {
  private readonly almacen: Almacen;
  private readonly o: OpcionesGuardado<T>;
  /** Ranura activa (cambiar a "gm" para pruebas sin tocar la partida real). */
  ranura = "partida";

  constructor(almacen: Almacen, o: OpcionesGuardado<T>) {
    this.almacen = almacen;
    this.o = o;
  }

  async guardar(datos: T): Promise<void> {
    const cuerpo = JSON.stringify(datos);
    const sobre = JSON.stringify({ version: this.o.version, guardadoEn: (this.o.ahora ?? Date.now)(), suma: fnv1a(cuerpo), datos });
    const previo = await this.almacen.leer(this.ranura);
    if (previo !== null) await this.almacen.escribir(`${this.ranura}.respaldo`, previo);
    await this.almacen.escribir(this.ranura, sobre);
  }

  async cargar(): Promise<ResultadoCarga<T>> {
    const crudo = await this.almacen.leer(this.ranura);
    if (crudo === null) return { estado: "nuevo", datos: this.o.porDefecto() };
    const apartar = async (motivo: string): Promise<ResultadoCarga<T>> => {
      await this.almacen.escribir(`${this.ranura}.apartado`, crudo);
      return { estado: "apartado", datos: this.o.porDefecto(), motivo };
    };
    let sobre: { version?: number; suma?: string; datos?: unknown };
    try {
      sobre = JSON.parse(crudo);
    } catch {
      return apartar("json-invalido");
    }
    if (typeof sobre.version !== "number") return apartar("sin-version");
    if (sobre.suma !== undefined && sobre.suma !== fnv1a(JSON.stringify(sobre.datos))) return apartar("suma-invalida");
    let v = sobre.version;
    if (v > this.o.version) return apartar("version-futura");
    if (v < (this.o.versionMinima ?? 1)) return apartar("version-vieja");
    let datos: any = sobre.datos;
    const desde = v;
    try {
      while (v < this.o.version) {
        const m = this.o.migraciones?.[v];
        if (!m) return apartar(`sin-migracion-${v}`);
        datos = m(datos);
        v++;
      }
    } catch {
      return apartar("migracion-fallo");
    }
    if (this.o.validar && !this.o.validar(datos)) return apartar("invalido");
    return desde < this.o.version ? { estado: "cargado", datos, migradoDesde: desde } : { estado: "cargado", datos };
  }

  /** Intenta recuperar el respaldo (último guardado bueno). */
  async restaurarRespaldo(): Promise<boolean> {
    const r = await this.almacen.leer(`${this.ranura}.respaldo`);
    if (r === null) return false;
    await this.almacen.escribir(this.ranura, r);
    return true;
  }
}

/** Repositorio genérico por id (jugadores, cuentas, gremios) sobre un Almacen: base para servidor o local. */
export class Repositorio<T extends { readonly id: string }> {
  private readonly almacen: Almacen;
  private readonly espacio: string;

  constructor(almacen: Almacen, espacio: string) {
    this.almacen = almacen;
    this.espacio = espacio;
  }

  async obtener(id: string): Promise<T | null> {
    const c = await this.almacen.leer(`${this.espacio}/${id}`);
    return c === null ? null : (JSON.parse(c) as T);
  }

  async guardar(e: T): Promise<void> {
    await this.almacen.escribir(`${this.espacio}/${e.id}`, JSON.stringify(e));
  }

  async borrar(id: string): Promise<void> {
    await this.almacen.borrar(`${this.espacio}/${id}`);
  }
}
