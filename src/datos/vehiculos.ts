// Catálogo PROPIO de vehículos para juegos de carreras y combate vehicular. Valores físicos plausibles (masa, par,
// relaciones de caja) para que el `Vehiculo` de `contextos/carreras` se sienta distinto en cada arquetipo. No
// representan ningún modelo comercial: son arquetipos (compacto, deportivo, muscle, rally...).

import type { DefVehiculo } from "../contextos/carreras/dominio/carreras.ts";
import type { Curva } from "../nucleo/escalado.ts";

const par = (puntos: ReadonlyArray<readonly [number, number]>): Curva => ({ tipo: "tramos", puntos });

export interface FichaVehiculo {
  readonly id: string;
  readonly clase: "kart" | "compacto" | "deportivo" | "muscle" | "super" | "rally" | "camion" | "formula" | "derrape";
  readonly def: DefVehiculo;
  /** Clasificación 1..10 para la interfaz (aceleración, velocidad punta, manejo). */
  readonly ficha: { readonly aceleracion: number; readonly punta: number; readonly manejo: number };
}

const base = {
  rpmRalenti: 900, eficiencia: 0.85, frenoMotor: 0.12,
};

export const VEHICULOS: readonly FichaVehiculo[] = [
  {
    id: "kart", clase: "kart", ficha: { aceleracion: 6, punta: 3, manejo: 10 },
    def: { masa: 160, ejes: 1.05, radioRueda: 0.14, freno: 2200, arrastre: 0.35, rodadura: 6, direccionMax: 0.55, direccionMitadA: 30, agarre: 1.25, picoDeslizamiento: 0.14, frenoMano: 0.5,
      motor: { ...base, rpmRalenti: 1800, par: par([[1800, 14], [6000, 20], [11000, 15]]), rpmMax: 11500, marchas: [1], diferencial: 5.5, subirA: 99999, bajarA: 0 } },
  },
  {
    id: "compacto", clase: "compacto", ficha: { aceleracion: 4, punta: 5, manejo: 7 },
    def: { masa: 1150, ejes: 2.55, radioRueda: 0.31, freno: 9500, arrastre: 0.42, rodadura: 12, direccionMax: 0.6, direccionMitadA: 22, agarre: 0.95, picoDeslizamiento: 0.12, frenoMano: 0.45,
      motor: { ...base, par: par([[900, 110], [2500, 160], [4500, 175], [6500, 140]]), rpmMax: 6800, marchas: [3.5, 2.1, 1.4, 1.05, 0.85], diferencial: 3.9, subirA: 6200, bajarA: 2500 } },
  },
  {
    id: "deportivo", clase: "deportivo", ficha: { aceleracion: 7, punta: 7, manejo: 8 },
    def: { masa: 1350, ejes: 2.5, radioRueda: 0.33, freno: 14000, arrastre: 0.38, rodadura: 12, direccionMax: 0.55, direccionMitadA: 26, agarre: 1.1, picoDeslizamiento: 0.11, frenoMano: 0.4,
      motor: { ...base, par: par([[900, 220], [3000, 360], [5500, 400], [7500, 330]]), rpmMax: 7800, marchas: [3.3, 2.2, 1.6, 1.25, 1.0, 0.82], diferencial: 3.6, subirA: 7300, bajarA: 3200 } },
  },
  {
    id: "muscle", clase: "muscle", ficha: { aceleracion: 8, punta: 7, manejo: 5 },
    def: { masa: 1700, ejes: 2.8, radioRueda: 0.34, freno: 13000, arrastre: 0.45, rodadura: 14, direccionMax: 0.5, direccionMitadA: 22, agarre: 0.95, picoDeslizamiento: 0.1, frenoMano: 0.35,
      motor: { ...base, rpmRalenti: 750, par: par([[750, 420], [2500, 560], [4500, 590], [6200, 470]]), rpmMax: 6500, marchas: [2.9, 1.9, 1.35, 1.0, 0.8], diferencial: 3.3, subirA: 6000, bajarA: 2400 } },
  },
  {
    id: "superdeportivo", clase: "super", ficha: { aceleracion: 10, punta: 10, manejo: 8 },
    def: { masa: 1450, ejes: 2.65, radioRueda: 0.34, freno: 18000, arrastre: 0.33, rodadura: 11, direccionMax: 0.52, direccionMitadA: 30, agarre: 1.25, picoDeslizamiento: 0.1, frenoMano: 0.4,
      motor: { ...base, rpmRalenti: 1000, par: par([[1000, 400], [4000, 680], [6500, 720], [8500, 600]]), rpmMax: 8800, marchas: [3.1, 2.2, 1.7, 1.35, 1.1, 0.92, 0.78], diferencial: 3.4, subirA: 8300, bajarA: 4000 }, nitro: { fuerza: 6000, max: 4, recarga: 0.25 } },
  },
  {
    id: "rally", clase: "rally", ficha: { aceleracion: 7, punta: 6, manejo: 8 },
    def: { masa: 1250, ejes: 2.5, radioRueda: 0.32, freno: 12000, arrastre: 0.42, rodadura: 16, direccionMax: 0.62, direccionMitadA: 24, agarre: 0.9, picoDeslizamiento: 0.16, frenoMano: 0.3,
      motor: { ...base, par: par([[900, 260], [3000, 420], [5000, 440], [7000, 360]]), rpmMax: 7300, marchas: [3.0, 2.1, 1.6, 1.25, 1.0], diferencial: 4.4, subirA: 6800, bajarA: 3400 } },
  },
  {
    id: "camion", clase: "camion", ficha: { aceleracion: 2, punta: 3, manejo: 2 },
    def: { masa: 7500, ejes: 4.2, radioRueda: 0.5, freno: 45000, arrastre: 1.2, rodadura: 60, direccionMax: 0.5, direccionMitadA: 14, agarre: 0.8, picoDeslizamiento: 0.12, frenoMano: 0.6,
      motor: { ...base, rpmRalenti: 650, par: par([[650, 1200], [1400, 1900], [2200, 1700], [2700, 1300]]), rpmMax: 2800, marchas: [7.5, 4.8, 3.2, 2.2, 1.5, 1.0, 0.78], diferencial: 4.1, subirA: 2400, bajarA: 1100 } },
  },
  {
    id: "formula", clase: "formula", ficha: { aceleracion: 10, punta: 10, manejo: 10 },
    def: { masa: 760, ejes: 3.5, radioRueda: 0.33, freno: 22000, arrastre: 0.55, rodadura: 8, direccionMax: 0.4, direccionMitadA: 40, agarre: 1.8, picoDeslizamiento: 0.09, frenoMano: 0.6,
      motor: { ...base, rpmRalenti: 4000, par: par([[4000, 220], [9000, 300], [12000, 310], [14500, 270]]), rpmMax: 15000, marchas: [3.3, 2.5, 2.0, 1.65, 1.4, 1.2, 1.05, 0.95], diferencial: 3.0, subirA: 14200, bajarA: 9000 } },
  },
  {
    id: "derrape", clase: "derrape", ficha: { aceleracion: 7, punta: 6, manejo: 6 },
    def: { masa: 1300, ejes: 2.6, radioRueda: 0.32, freno: 12000, arrastre: 0.4, rodadura: 12, direccionMax: 0.85, direccionMitadA: 30, agarre: 0.85, picoDeslizamiento: 0.09, frenoMano: 0.25,
      motor: { ...base, par: par([[900, 280], [3500, 470], [6000, 500], [7800, 400]]), rpmMax: 8000, marchas: [3.2, 2.2, 1.6, 1.25, 1.0], diferencial: 4.1, subirA: 7500, bajarA: 3500 } },
  },
];

export const vehiculo = (id: string): FichaVehiculo => {
  const v = VEHICULOS.find((x) => x.id === id);
  if (!v) throw new Error(`Vehículo desconocido: ${id}`);
  return v;
};

/** Superficies: multiplicador de agarre y de resistencia de rodadura. */
export const SUPERFICIES: Readonly<Record<string, { readonly agarre: number; readonly rodadura: number }>> = {
  asfalto: { agarre: 1, rodadura: 1 },
  asfaltoMojado: { agarre: 0.7, rodadura: 1.05 },
  tierra: { agarre: 0.65, rodadura: 1.6 },
  grava: { agarre: 0.6, rodadura: 1.8 },
  nieve: { agarre: 0.35, rodadura: 2 },
  hielo: { agarre: 0.12, rodadura: 0.8 },
  pasto: { agarre: 0.5, rodadura: 2.4 },
  arena: { agarre: 0.45, rodadura: 3.5 },
};
