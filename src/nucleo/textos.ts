// Localización (i18n) por CLAVE: los textos viven en tablas por idioma ({ "tienda.comprar": "Comprar {objeto}" }),
// con idioma de respaldo, interpolación de variables, plurales simples ({n|objeto|objetos}), detección de claves
// faltantes (para que no llegue "tienda.comprar" a la pantalla sin aviso) y formato de números por idioma.

export type TablaTextos = Readonly<Record<string, string>>;

export class Textos {
  private readonly tablas = new Map<string, TablaTextos>();
  idioma: string;
  readonly respaldo: string;
  readonly faltantes = new Set<string>();

  constructor(idioma: string, respaldo = idioma) {
    this.idioma = idioma;
    this.respaldo = respaldo;
  }

  cargar(idioma: string, tabla: TablaTextos): void {
    this.tablas.set(idioma, { ...(this.tablas.get(idioma) ?? {}), ...tabla });
  }

  /** Texto de una clave con variables. Plurales: "{n|enemigo|enemigos}" elige por la variable n (1 = singular). */
  t(clave: string, vars: Readonly<Record<string, string | number>> = {}): string {
    const crudo = this.tablas.get(this.idioma)?.[clave] ?? this.tablas.get(this.respaldo)?.[clave];
    if (crudo === undefined) {
      this.faltantes.add(clave);
      return clave;
    }
    return crudo.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, v: string, uno: string, varios: string) => (Number(vars[v]) === 1 ? uno : varios)).replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? this.formato(vars[v]) : m));
  }

  private formato(v: string | number): string {
    return typeof v === "number" ? v.toLocaleString(this.idioma) : v;
  }

  /** Claves que existen en el respaldo pero no en `idioma` (para el equipo de traducción). */
  sinTraducir(idioma: string): string[] {
    const base = this.tablas.get(this.respaldo) ?? {};
    const t = this.tablas.get(idioma) ?? {};
    return Object.keys(base).filter((k) => !(k in t)).sort();
  }

  /** Lee el formato de texto simple `CLAVE<tab>texto` por línea (ignora vacías y las que empiezan con #). */
  static leerTabla(texto: string): Record<string, string> {
    const r: Record<string, string> = {};
    for (const linea of texto.split(/\r?\n/)) {
      if (!linea.trim() || linea.startsWith("#")) continue;
      const m = /^(\S+)\s+(.*)$/.exec(linea);
      if (m) r[m[1]] = m[2].replace(/\\n/g, "\n");
    }
    return r;
  }
}
