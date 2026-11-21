// Entrada por ACCIONES (no por teclas): el juego pregunta "¿saltar?" y un mapa traduce teclas, botones de mando y
// toques a acciones. Estados por paso fijo: pulsada / recién (flanco de subida) / soltada (flanco de bajada),
// búfer de entrada (una acción apretada un poco antes cuenta) y ejes con zona muerta. Remapeable y serializable.
// La plataforma (navegador, Electron, motor) solo llama a `fijarFisico(codigo, abajo)` y `fijarEje(codigo, valor)`.

export type MapaAcciones = Readonly<Record<string, readonly string[]>>;

export const MAPA_PLATAFORMAS: MapaAcciones = {
  izq: ["ArrowLeft", "KeyA", "pad:izq", "pad:stickIzq-"],
  der: ["ArrowRight", "KeyD", "pad:der", "pad:stickIzq+"],
  arriba: ["ArrowUp", "KeyW", "pad:arriba"],
  abajo: ["ArrowDown", "KeyS", "pad:abajo"],
  saltar: ["Space", "KeyZ", "pad:A"],
  atacar: ["KeyJ", "KeyX", "pad:X"],
  dash: ["ShiftLeft", "KeyK", "pad:RT"],
  usar: ["KeyE", "pad:Y"],
  pausa: ["Escape", "pad:menu"],
};

export class Entrada {
  private mapa: Map<string, readonly string[]>;
  private readonly fisicos = new Map<string, number>();
  private readonly ahora = new Set<string>();
  private readonly antes = new Set<string>();
  private readonly bufer = new Map<string, number>();
  zonaMuerta = 0.25;

  constructor(mapa: MapaAcciones = MAPA_PLATAFORMAS) {
    this.mapa = new Map(Object.entries(mapa));
  }

  remapear(accion: string, codigos: readonly string[]): void {
    this.mapa.set(accion, codigos);
  }

  exportarMapa(): Record<string, readonly string[]> {
    return Object.fromEntries(this.mapa);
  }

  /** Tecla/botón físico (valor 0 o 1). */
  fijarFisico(codigo: string, abajo: boolean): void {
    this.fisicos.set(codigo, abajo ? 1 : 0);
  }

  /** Eje analógico: crea los códigos virtuales `codigo+` y `codigo-`. */
  fijarEje(codigo: string, valor: number): void {
    this.fisicos.set(codigo + "+", Math.max(0, valor));
    this.fisicos.set(codigo + "-", Math.max(0, -valor));
  }

  private valorAccion(a: string): number {
    let v = 0;
    for (const c of this.mapa.get(a) ?? []) v = Math.max(v, this.fisicos.get(c) ?? 0);
    return v;
  }

  /** Llamar al EMPEZAR cada paso fijo: congela el estado de este paso. */
  muestrear(dt: number): void {
    this.antes.clear();
    for (const a of this.ahora) this.antes.add(a);
    this.ahora.clear();
    for (const a of this.mapa.keys()) if (this.valorAccion(a) > this.zonaMuerta) this.ahora.add(a);
    for (const [a, t] of this.bufer) this.bufer.set(a, t - dt);
    for (const a of this.ahora) if (!this.antes.has(a)) this.bufer.set(a, 0);
  }

  pulsada(a: string): boolean {
    return this.ahora.has(a);
  }
  recien(a: string): boolean {
    return this.ahora.has(a) && !this.antes.has(a);
  }
  soltada(a: string): boolean {
    return !this.ahora.has(a) && this.antes.has(a);
  }
  /** ¿Se apretó en los últimos `ventana` segundos? Consumir con `consumir` para que no dispare dos veces. */
  enBufer(a: string, ventana: number): boolean {
    const t = this.bufer.get(a);
    return t !== undefined && -t <= ventana;
  }
  consumir(a: string): void {
    this.bufer.delete(a);
  }
  /** Eje -1..1 a partir de dos acciones. */
  eje(neg: string, pos: string): -1 | 0 | 1 {
    return ((this.pulsada(pos) ? 1 : 0) - (this.pulsada(neg) ? 1 : 0)) as -1 | 0 | 1;
  }
  /** Valor analógico 0..1 de una acción (gatillos). */
  analogico(a: string): number {
    const v = this.valorAccion(a);
    return v <= this.zonaMuerta ? 0 : (v - this.zonaMuerta) / (1 - this.zonaMuerta);
  }
}
