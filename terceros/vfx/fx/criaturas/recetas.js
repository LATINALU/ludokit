// Recetas de criaturas para criatura.js. Coordenadas con el pie en (0, 0) y y hacia abajo (la cabeza en y < 0).
// Piezas: e (elipse x,y,rx,ry) · c (cápsula a→b, r0/r1; o cadena pts) · p (polígono) · px (píxeles sueltos).
// m: movimientos [{r: giro sobre piv, d: desplazamiento, abs, o: onda por punto, f: frecuencia, fase}].
// osc: oscurece la rampa (lo que queda detrás). mate: sin brillo especular. resp: respiración (escala).

export const RAMPAS = {
  hueso: ["#1e1820", "#4a4048", "#7c6f68", "#a99a86", "#d4c6a8", "#f2ead2"],
  cuero: ["#1a1210", "#3e2a1e", "#68462c", "#91663c", "#bc8c56", "#e0b880"],
  tela_azul: ["#0e1020", "#1e2a4a", "#2e4676", "#46679e", "#6f92c6", "#a8c4ea"],
  tela_roja: ["#1a0a0e", "#4a1420", "#7a2030", "#a83440", "#d0584e", "#f0927a"],
  tela_morada: ["#120a1e", "#2a1648", "#46247a", "#6638a8", "#8e5cd0", "#c49af0"],
  tela_parda: ["#140f0c", "#33271e", "#544232", "#77604a", "#9c8466", "#c8b08c"],
  metal: ["#0e1016", "#262a36", "#444a5a", "#686f82", "#959cae", "#cdd2de", "#ffffff"],
  oro: ["#1a1006", "#4a300e", "#7c5418", "#b0802a", "#dcae46", "#f6d876", "#fff6c8"],
  cobre: ["#180c08", "#43200f", "#753a1a", "#a65a2a", "#d0803e", "#f0aa66", "#ffe0b0"],
  piel_verde: ["#0c1408", "#1e3414", "#30561e", "#4a7c2a", "#6ea43c", "#a2cc64"],
  piel_gris: ["#121216", "#2a2a32", "#45454f", "#62626e", "#868694", "#b2b2be"],
  piel_palida: ["#1a1214", "#4a3434", "#7a5a52", "#a8806e", "#d0aa90", "#f0d4bc"],
  cuarzo: ["#1a060c", "#4a0e1e", "#8a1a34", "#c8304e", "#f0607a", "#ffa8b8", "#ffffff"],
  magma: ["#160604", "#401006", "#7a1e08", "#b8380c", "#ec6a14", "#ffa83a", "#ffe28a"],
  bilis: ["#0a1406", "#1c3a0c", "#356a14", "#58a01e", "#8ad43a", "#c8f47a"],
  sombra: ["#08060e", "#14101e", "#221c32", "#342c4a", "#4a4068", "#6c6090"],
  marmol: ["#141418", "#33333c", "#55555e", "#7a7a84", "#a2a0a6", "#c8c6c4", "#ecebe6"],
  piedra: ["#121014", "#2c2830", "#48424c", "#665e68", "#867e86", "#aaa2a6"],
  hongo: ["#1a0810", "#4a1428", "#7c2238", "#b0384a", "#d86460", "#f4a088"],
  tallo: ["#1a1814", "#3e3a30", "#6a6450", "#9a9276", "#c8c0a0", "#ece6cc"],
  quitina: ["#0e0a06", "#2a1e0e", "#4a3414", "#70501c", "#9c7426", "#c89c40", "#f0d080"],
  madera: ["#140c06", "#36200e", "#5a3618", "#804e24", "#a86c34", "#d0944c"],
  vacio: ["#0a0614", "#1a0e32", "#2e1a56", "#4a2c86", "#7048b8", "#a07ae0", "#e0d0ff"],
  eter: ["#06121a", "#0c2a3a", "#14506a", "#1e7c9c", "#38acc8", "#7ad8ec", "#d0f8ff"],
  carne: ["#1a0608", "#4a0e16", "#7c1a24", "#ac2c34", "#d4504e", "#f08a7a"],
  hielo: ["#0a1420", "#14304a", "#24547a", "#3c80aa", "#68aed2", "#a8daf0", "#ffffff"],
  obsidiana: ["#060608", "#121218", "#20202a", "#30303e", "#46465a", "#6c6c86", "#b8b8d8"],
  musgo: ["#0a1006", "#18280e", "#2a4416", "#40621e", "#5c862a", "#84ac40"],
  // Demonio de Brasa (el bruto de spawn/summon-rise de pixelfx): cuerpo de hollín con luz cálida, cuernos de piedra.
  demonio: ["#0e0810", "#1e1220", "#301c30", "#46283e", "#62384c", "#844c5a"],
  demonio_vacio: ["#0a0814", "#161028", "#241a40", "#33265a", "#463478", "#5e4a9a"],
  cuerno: ["#0c080c", "#2a2028", "#45363e", "#665660", "#8e7c84", "#b8a6aa"],
};

// ---------- movimientos de caminata
const PIERNA = (piv, fase, amp = 0.5) => [{ r: amp, piv, fase }];
const BRAZO = (piv, fase, amp = 0.35) => [{ r: amp, piv, fase }];

// ---------- base humanoide
// (16 nov: sin escudo en el modelo: el escudo heráldico lo dibuja el juego y muestra la guardia)
// o: piel, ropa, metal, cabeza, arma, escudo, ojos, alto (escala), ancho, extra (piezas delante), atras (piezas detrás)
function humanoide(o) {
  const h = o.alto ?? 1, w = o.ancho ?? 1;
  const piel = o.piel || "piel_gris", ropa = o.ropa || "tela_parda", metal = o.metal || "metal";
  const cadera = [0, -11 * h], hombroA = [-4 * w, -21 * h], hombroD = [4 * w, -21 * h];
  const pie = (s) => [s * 2.5 * w, -0.8];
  const P = [];
  if (o.atras) P.push(...o.atras);
  // brazo de atrás
  P.push({ k: "c", a: hombroA, b: [-5 * w, -13 * h], r0: 2 * w, r1: 1.7 * w, pal: o.brazos || ropa, osc: 1, m: BRAZO(hombroA, Math.PI) });
  // piernas
  P.push({ k: "c", a: [-2 * w, -11 * h], b: pie(-1), r0: 2.2 * w, r1: 1.8 * w, pal: o.piernas || ropa, osc: 1, m: PIERNA([-2 * w, -11 * h], 0) });
  P.push({ k: "e", x: pie(-1)[0] - 0.5, y: -1, rx: 2.6 * w, ry: 1.4, pal: o.botas || "cuero", osc: 1, m: PIERNA([-2 * w, -11 * h], 0) });
  P.push({ k: "c", a: [2 * w, -11 * h], b: pie(1), r0: 2.2 * w, r1: 1.8 * w, pal: o.piernas || ropa, m: PIERNA([2 * w, -11 * h], Math.PI) });
  P.push({ k: "e", x: pie(1)[0] + 0.5, y: -1, rx: 2.6 * w, ry: 1.4, pal: o.botas || "cuero", m: PIERNA([2 * w, -11 * h], Math.PI) });
  // torso
  P.push({ k: "e", x: 0, y: -16.5 * h, rx: 5.2 * w, ry: 6.5 * h, pal: ropa, resp: 0.04 });
  if (o.cinturon !== false) P.push({ k: "c", a: [-4.6 * w, -11.5 * h], b: [4.6 * w, -11.5 * h], r: 1.2, pal: o.cinturon || "cuero" });
  // cabeza
  const cy = -26.5 * h;
  const cab = { k: "e", x: 0.6, y: cy, rx: 5 * (o.cabeza_ancho ?? 1), ry: 5, pal: piel, m: [{ d: [0, 0.4], f: 2 }] };
  switch (o.cabeza) {
    case "casco":
      P.push(cab);
      P.push({ k: "e", x: 0.4, y: cy - 1.4, rx: 4.8, ry: 3.8, pal: metal, m: cab.m });
      P.push({ k: "c", a: [-4.6, cy + 0.6], b: [4.8, cy + 0.6], r: 1, pal: metal, m: cab.m });
      P.push({ k: "px", pts: [[2, cy + 1.8], [3, cy + 1.8]], col: o.ojos || "#ffd27a", m: cab.m });
      break;
    case "capucha":
      P.push({ k: "e", x: 0, y: cy, rx: 5, ry: 5.2, pal: ropa, m: cab.m });
      P.push({ k: "e", x: 1.4, y: cy + 0.8, rx: 3, ry: 3, pal: "sombra", mate: true, m: cab.m });
      P.push({ k: "px", pts: [[1, cy + 0.5], [3, cy + 0.5]], col: o.ojos || "#ffe27a", m: cab.m });
      break;
    case "craneo":
      P.push({ k: "e", x: 0.6, y: cy, rx: 4.2, ry: 4.2, pal: "hueso", m: cab.m });
      P.push({ k: "px", pts: [[1, cy], [2, cy], [4, cy], [5, cy], [3, cy + 2]], col: "#140c10", m: cab.m });
      P.push({ k: "px", pts: [[1, cy], [4, cy]], col: o.ojos || "#ff5a3a", m: cab.m });
      break;
    case "sin_rostro":
      P.push({ k: "e", x: 0.6, y: cy, rx: 4.2, ry: 4.6, pal: piel, mate: true, m: cab.m });
      break;
    case "buzo":
      P.push({ k: "e", x: 0.6, y: cy - 0.5, rx: 5.6, ry: 5.4, pal: o.casco || "cobre", m: cab.m });
      P.push({ k: "e", x: 2.4, y: cy, rx: 2.6, ry: 2.4, pal: "eter", m: cab.m });
      P.push({ k: "px", pts: [[-3, cy - 3], [-4, cy], [-3, cy + 3], [5, cy - 4]], col: "#ffd27a", m: cab.m });
      break;
    default:
      P.push(cab);
      P.push({ k: "px", pts: [[2, cy], [4, cy]], col: o.ojos || "#140c10", m: cab.m, parpadeo: true });
  }
  if (o.extra_cabeza) P.push(...o.extra_cabeza.map((pz) => ({ ...pz, m: cab.m })));
  // brazo de delante
  const mano = [5.5 * w, -13 * h];
  P.push({ k: "c", a: hombroD, b: mano, r0: 2 * w, r1: 1.7 * w, pal: o.brazos || ropa, m: BRAZO(hombroD, 0) });
  P.push({ k: "e", x: mano[0], y: mano[1], rx: 1.6, ry: 1.6, pal: o.manos || piel, m: BRAZO(hombroD, 0) });
  const mA = BRAZO(hombroD, 0);
  switch (o.arma) {
    case "espada":
      P.push({ k: "c", a: [mano[0] + 1, mano[1] - 1], b: [mano[0] + 7, mano[1] - 9], r: 0.9, pal: metal, m: mA });
      P.push({ k: "c", a: [mano[0] - 1, mano[1] + 0.5], b: [mano[0] + 2.5, mano[1] - 2.5], r: 0.8, pal: "oro", m: mA });
      break;
    case "lanza":
    case "arpon":
      P.push({ k: "c", a: [mano[0] - 3, mano[1] + 6], b: [mano[0] + 4, mano[1] - 14], r: 0.7, pal: "madera", m: mA });
      P.push({ k: "p", pts: [[mano[0] + 3, mano[1] - 14], [mano[0] + 6, mano[1] - 19], [mano[0] + 6, mano[1] - 13]], pal: metal, m: mA });
      if (o.arma === "arpon") P.push({ k: "px", pts: [[mano[0] + 2, mano[1] - 12], [mano[0] + 7, mano[1] - 15]], col: "#cdd2de", m: mA });
      break;
    case "martillo":
      P.push({ k: "c", a: [mano[0], mano[1] + 2], b: [mano[0] + 3, mano[1] - 11], r: 0.8, pal: "madera", m: mA });
      P.push({ k: "p", pts: [[mano[0] - 1, mano[1] - 16], [mano[0] + 8, mano[1] - 16], [mano[0] + 8, mano[1] - 10], [mano[0] - 1, mano[1] - 10]], pal: metal, m: mA });
      break;
    case "farol":
      P.push({ k: "c", a: [mano[0], mano[1]], b: [mano[0] + 1, mano[1] + 3], r: 0.5, pal: "metal", m: mA });
      P.push({ k: "e", x: mano[0] + 1, y: mano[1] + 5, rx: 2, ry: 2.4, pal: "oro", m: mA });
      P.push({ k: "px", pts: [[mano[0] + 1, mano[1] + 5], [mano[0] + 1, mano[1] + 4]], col: "#fff6c8", m: mA });
      break;
    case "incensario":
      P.push({ k: "c", a: [mano[0], mano[1]], b: [mano[0] + 4, mano[1] + 5], r: 0.4, pal: "metal", m: [...mA, { r: 0.6, piv: mano, f: 2 }] });
      P.push({ k: "e", x: mano[0] + 4, y: mano[1] + 6.5, rx: 2.2, ry: 2, pal: "oro", m: [...mA, { r: 0.6, piv: mano, f: 2 }] });
      break;
    case "llaves":
      P.push({ k: "e", x: mano[0] + 1, y: mano[1] + 3, rx: 2.4, ry: 2.4, pal: "metal", m: mA });
      P.push({ k: "px", pts: [[mano[0] + 1, mano[1] + 3]], col: "#1a1424", m: mA });
      break;
    case "garras":
      P.push({ k: "px", pts: [[mano[0] + 2, mano[1] - 1], [mano[0] + 3, mano[1]], [mano[0] + 2, mano[1] + 1]], col: "#f2ead2", m: mA });
      break;
  }
  if (o.escudo) {
    P.push({ k: "p", pts: [[2, -23 * h], [10 * w, -23 * h], [10 * w, -13 * h], [6 * w, -8 * h], [2, -13 * h]], pal: o.escudo, m: [{ d: [0, 0.6], f: 2 }] });
    P.push({ k: "px", pts: [[6 * w, -19 * h], [6 * w, -17 * h], [5 * w, -18 * h], [7 * w, -18 * h]], col: o.emblema || "#ffd27a", m: [{ d: [0, 0.6], f: 2 }] });
  }
  if (o.extra) P.push(...o.extra);
  return { anim: o.anim || "andar", partes: P, rebote: o.rebote };
}

// ---------- criaturas no humanas
function alas(cx, cy, pal, envergadura = 10, f = 2) {
  const mov = (s) => [{ r: 0.7 * s, piv: [cx + s * 2, cy], f }];
  return [
    { k: "p", pts: [[cx - 2, cy - 1], [cx - envergadura, cy - 6], [cx - envergadura + 2, cy + 1], [cx - envergadura + 5, cy + 3], [cx - 2, cy + 2]], pal, osc: 1, m: mov(-1) },
    { k: "p", pts: [[cx + 2, cy - 1], [cx + envergadura, cy - 6], [cx + envergadura - 2, cy + 1], [cx + envergadura - 5, cy + 3], [cx + 2, cy + 2]], pal, m: mov(1) },
  ];
}

function patas(n, cx, cy, largo, pal, alto = 4) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1, k = Math.floor(i / 2), x0 = cx + (k - (n / 4 - 0.5)) * 3;
    const piv = [x0, cy];
    P.push({ k: "c", pts: [piv, [x0 + s * largo * 0.6, cy - alto], [x0 + s * largo, 0]], r0: 1.1, r1: 0.7, pal, osc: s < 0 ? 1 : 0,
      m: [{ r: 0.25, piv, fase: i * 1.3, f: 2 }] });
  }
  return P;
}

// ---------- el Demonio de Brasa: la anatomía exacta del bruto de spawn/summon-rise (pixelfx), en bucle de mob.
// Coordenadas del original (rejilla 46 × 46, centro 22,5) pasadas a pie en (0, 0): x − 22,5, y − 46.
function demonio(cuerpo, ojos, luz) {
  const P = [];
  const hombro = (s) => [s * 14.5, -29.5], cadera = (s) => [s * 5.5, -15];
  const brazo = (s) => [{ r: 0.12 * s, piv: hombro(s), fase: s > 0 ? 0 : Math.PI }];
  const pierna = (s) => [{ r: 0.2, piv: cadera(s), fase: s > 0 ? Math.PI : 0 }];
  // cola (detrás de todo), con onda
  P.push({ k: "c", pts: [[0, -16], [0.5, -10], [2.5, -4.5], [7, -1.4], [12.5, -1.8], [14.5, -3.5]], r0: 2.3, r1: 0.6, pal: cuerpo, osc: 1,
    m: [{ d: [0, -0.8], o: 0.9, f: 1 }] });
  for (const s of [-1, 1]) {
    P.push({ k: "c", pts: [[s * 5.5, -15], [s * 8, -9], [s * 7.5, -4]], r0: 4, r1: 3, pal: cuerpo, m: pierna(s) });
    P.push({ k: "e", x: s * 8.5, y: -1.7, rx: 4.2, ry: 1.7, pal: cuerpo, m: pierna(s) });
  }
  P.push({ k: "e", x: 0, y: -16.5, rx: 6.2, ry: 4.5, pal: cuerpo, resp: 0.04 });
  P.push({ k: "e", x: 0, y: -23.5, rx: 8.2, ry: 7.5, pal: cuerpo, resp: 0.05 });
  for (const s of [-1, 1]) {
    P.push({ k: "e", x: s * 10, y: -30, rx: 7, ry: 5, pal: cuerpo });
    P.push({ k: "e", x: s * 8.5, y: -26.5, rx: 5.5, ry: 4.2, pal: cuerpo });
  }
  for (const s of [-1, 1]) {
    P.push({ k: "c", pts: [[s * 14.5, -29.5], [s * 17.5, -24], [s * 18.5, -18]], r0: 4, r1: 3.2, pal: cuerpo, m: brazo(s) });
    P.push({ k: "c", pts: [[s * 18.5, -18], [s * 19, -13], [s * 19.2, -9.5]], r0: 3.4, r1: 2.8, pal: cuerpo, m: brazo(s) });
    P.push({ k: "e", x: s * 19.2, y: -8.2, rx: 3, ry: 2.3, pal: cuerpo, m: brazo(s) });
    P.push({ k: "px", pts: [[s * 17.2, -6.5], [s * 17, -5], [s * 19.2, -6], [s * 19.3, -4], [s * 21.2, -6.8], [s * 21.8, -5.2]], col: "#d8c8b8", m: brazo(s) });
  }
  for (const s of [-1, 1])
    P.push({ k: "c", pts: [[s * 4, -35], [s * 8, -38], [s * 12, -39.5], [s * 15, -42], [s * 16, -44.5], [s * 15.2, -46]], r0: 2.3, r1: 0.45, pal: "cuerno" });
  P.push({ k: "e", x: 0, y: -33.5, rx: 5.2, ry: 4.6, pal: cuerpo, m: [{ d: [0, 0.4], f: 2 }] });
  P.push({ k: "e", x: 0, y: -30, rx: 4.2, ry: 2.8, pal: cuerpo, m: [{ d: [0, 0.4], f: 2 }] });
  P.push({ k: "px", pts: [[-3.5, -34], [-2.5, -34], [2, -34], [3, -34]], col: ojos, m: [{ d: [0, 0.4], f: 2 }] });
  P.push({ k: "px", pts: [[-3.5, -30], [-3.5, -31], [3, -30], [3, -31]], col: "#efe2bf", m: [{ d: [0, 0.4], f: 2 }] });
  return { anim: "andar", rebote: 0.7, brillo: [0, -12, 26, luz], partes: P };
}

const H = humanoide;

export const RECETAS = {
  // ======== Estrato I
  rondador: H({ piel: "piel_palida", ropa: "tela_parda", cabeza: "casco", metal: "cobre", arma: "farol", ojos: "#ffd27a", alto: 0.9, ancho: 1.1, rebote: 0.8,
    atras: [{ k: "e", x: -3, y: -18, rx: 4, ry: 5, pal: "cuero", osc: 1 }] }),
  falange: H({ piel: "hueso", ropa: "metal", brazos: "hueso", piernas: "hueso", cabeza: "craneo", arma: "espada", ojos: "#c9b8ff", alto: 1.05 }),
  craneo_eter: {
    anim: "flotar", altura: 4, brillo: [0, -16, 18, "#9fe8ff"],
    partes: [
      ...alas(0, -16, "eter", 13, 3),
      { k: "e", x: 0, y: -16, rx: 6, ry: 5.5, pal: "hueso" },
      { k: "e", x: 0.5, y: -12, rx: 3.6, ry: 2.4, pal: "hueso", osc: 1 },
      { k: "px", pts: [[-2, -16], [-1, -16], [2, -16], [3, -16], [-2, -15], [2, -15]], col: "#0c0910" },
      { k: "px", pts: [[-2, -16], [2, -16]], col: "#7af0ff" },
      { k: "px", pts: [[-1, -11], [1, -11], [3, -11]], col: "#1a1424" },
    ],
  },
  bombardo: {
    anim: "saltar", rebote: 3,
    partes: [
      { k: "c", a: [0, -1], b: [0, -9], r0: 3.2, r1: 2.8, pal: "tallo", resp: 0.05 },
      { k: "e", x: 0, y: -13, rx: 8.5, ry: 5.5, pal: "hongo", resp: 0.08 },
      { k: "e", x: -3.5, y: -15, rx: 1.5, ry: 1.2, pal: "tallo" },
      { k: "e", x: 3, y: -16, rx: 1.2, ry: 1, pal: "tallo" },
      { k: "e", x: 5.5, y: -13, rx: 1, ry: 0.9, pal: "tallo" },
      { k: "px", pts: [[-1, -6], [2, -6]], col: "#1a0a10", parpadeo: true },
      { k: "c", a: [0, -18], b: [1, -21], r: 0.5, pal: "cuero", m: [{ d: [0.5, 0], f: 4 }] },
      { k: "px", pts: [[1, -22]], col: "#ffb23d", m: [{ d: [0.5, -0.5], f: 6 }] },
    ],
  },
  acechador: {
    anim: "andar", rebote: 0.6,
    partes: [
      ...patas(6, -1, -5, 7, "quitina", 4),
      { k: "e", x: -4, y: -6, rx: 6, ry: 4, pal: "quitina", resp: 0.04 },
      { k: "e", x: 4, y: -6.5, rx: 4, ry: 3.4, pal: "quitina" },
      { k: "c", a: [-8, -7], b: [-10, -4], r: 1.4, pal: "quitina", osc: 1 },
      { k: "px", pts: [[5, -7], [7, -7], [6, -8]], col: "#ff6a3a" },
      { k: "c", a: [7, -5], b: [9, -3], r: 0.6, pal: "hueso", m: [{ r: 0.3, piv: [7, -5], f: 4 }] },
    ],
  },
  buzo: H({ piel: "piel_gris", ropa: "cuero", cabeza: "buzo", casco: "cobre", arma: "ninguna", alto: 1, ancho: 1.3, rebote: 0.6, botas: "metal",
    atras: [{ k: "e", x: -5, y: -17, rx: 3, ry: 5.5, pal: "cobre", osc: 1 }, { k: "c", a: [-5, -22], b: [-1, -27], r: 0.8, pal: "cuero", osc: 1 }] }),
  // ======== Estrato II
  golem_cuarzo: H({ piel: "piedra", ropa: "piedra", brazos: "piedra", piernas: "piedra", botas: "piedra", manos: "piedra", cabeza: "sin_rostro", alto: 1.1, ancho: 1.45, rebote: 0.5, cinturon: false,
    extra: [
      { k: "p", pts: [[-4, -24], [-1.5, -33], [1, -24]], pal: "cuarzo" },
      { k: "p", pts: [[1, -23], [4, -35], [6.5, -23]], pal: "cuarzo" },
      { k: "p", pts: [[4, -18], [9, -22], [7, -14]], pal: "cuarzo" },
      { k: "p", pts: [[-7, -21], [-6, -27], [-4.5, -21]], pal: "cuarzo" },
      { k: "px", pts: [[1, -28], [3, -28]], col: "#ff6a8a" },
    ] }),
  arponero: H({ piel: "piel_verde", ropa: "tela_azul", cabeza: "normal", arma: "arpon", ojos: "#d8ff8a", alto: 1, rebote: 1,
    extra_cabeza: [{ k: "c", a: [-3, -24], b: [-6, -20], r: 1, pal: "musgo" }, { k: "c", a: [4, -24], b: [5, -20], r: 0.9, pal: "musgo" }] }),
  monje: H({ piel: "piel_palida", ropa: "tela_roja", cabeza: "capucha", arma: "incensario", ojos: "#ffb23d", alto: 1, rebote: 0.7,
    extra: [{ k: "p", pts: [[-5, -11], [5, -11], [6, -2], [-6, -2]], pal: "tela_roja" }] }),
  tomo: {
    anim: "flotar", altura: 6, brillo: [0, -16, 16, "#ffb060"],
    partes: [
      { k: "p", pts: [[-9, -20], [0, -17], [0, -9], [-9, -12]], pal: "tela_roja", m: [{ r: -0.25, piv: [0, -13], f: 2 }] },
      { k: "p", pts: [[9, -20], [0, -17], [0, -9], [9, -12]], pal: "tela_roja", m: [{ r: 0.25, piv: [0, -13], f: 2 }] },
      { k: "p", pts: [[-7.5, -18.5], [-0.5, -16.2], [-0.5, -11], [-7.5, -13]], pal: "hueso", m: [{ r: -0.25, piv: [0, -13], f: 2 }] },
      { k: "p", pts: [[7.5, -18.5], [0.5, -16.2], [0.5, -11], [7.5, -13]], pal: "hueso", m: [{ r: 0.25, piv: [0, -13], f: 2 }] },
      { k: "px", pts: [[-5, -16], [-3, -15], [-6, -14], [4, -16], [6, -15], [3, -14]], col: "#ff7a2a", m: [{ d: [0, -0.3], f: 4 }] },
      { k: "e", x: 0, y: -14, rx: 1.4, ry: 1.4, pal: "oro" },
    ],
  },
  carcelero: H({ piel: "piel_gris", ropa: "metal", brazos: "cuero", cabeza: "casco", metal: "metal", arma: "llaves", alto: 1.1, ancho: 1.3, rebote: 0.7,
    extra: [{ k: "c", pts: [[5, -13], [3, -9], [6, -6], [4, -3]], r0: 0.6, r1: 0.6, pal: "metal", m: [{ d: [0.6, 0], o: 1, f: 2 }] }] }),
  centinela: H({ piel: "marmol", ropa: "marmol", brazos: "marmol", piernas: "marmol", cabeza: "casco", metal: "marmol", arma: "lanza", ojos: "#ffe08a",
    alto: 1.1, ancho: 1.15, rebote: 0.5, cinturon: "oro" }),
  // ======== Estrato III
  espectro_espejo: {
    anim: "flotar", altura: 3, brillo: [0, -16, 16, "#c8e0ff"],
    partes: [
      { k: "c", pts: [[0, -6], [-1, -2], [1, 2]], r0: 4, r1: 1, pal: "hielo", m: [{ d: [1.2, 0], o: 1.4, f: 2 }] },
      { k: "e", x: 0, y: -13, rx: 5, ry: 7, pal: "hielo", resp: 0.05 },
      { k: "p", pts: [[-3, -19], [3, -19], [4, -11], [-4, -11]], pal: "marmol" },
      { k: "e", x: 0.5, y: -23, rx: 4, ry: 4.2, pal: "hielo" },
      { k: "p", pts: [[-1, -26], [3, -26], [3, -20], [-1, -20]], pal: "marmol" },
      { k: "px", pts: [[0, -23], [2, -23]], col: "#0c0910" },
      { k: "c", a: [-4, -18], b: [-8, -12], r0: 1.6, r1: 1, pal: "hielo", osc: 1, m: [{ r: 0.3, piv: [-4, -18], f: 1 }] },
      { k: "c", a: [4, -18], b: [8, -12], r0: 1.6, r1: 1, pal: "hielo", m: [{ r: -0.3, piv: [4, -18], f: 1 }] },
    ],
  },
  mimico: {
    anim: "saltar", rebote: 3,
    partes: [
      ...patas(4, 0, -4, 7, "carne", 3),
      { k: "p", pts: [[-8, -12], [8, -12], [8, -2], [-8, -2]], pal: "madera" },
      { k: "p", pts: [[-8, -18], [8, -18], [8, -13], [-8, -13]], pal: "madera", m: [{ r: -0.18, piv: [-8, -13], f: 2 }] },
      { k: "c", a: [-8, -7], b: [8, -7], r: 0.8, pal: "oro" },
      { k: "px", pts: [[-6, -12], [-4, -11], [-2, -12], [0, -11], [2, -12], [4, -11], [6, -12]], col: "#f2ead2" },
      { k: "e", x: 0, y: -12.5, rx: 5, ry: 1, pal: "carne", m: [{ d: [0, -1], f: 2 }] },
      { k: "px", pts: [[-3, -15], [3, -15]], col: "#ffd23d", m: [{ r: -0.18, piv: [-8, -13], f: 2 }] },
    ],
  },
  automata: H({ piel: "cobre", ropa: "cobre", brazos: "metal", piernas: "metal", cabeza: "casco", metal: "cobre", arma: "ninguna", ancho: 1.35, alto: 1, rebote: 0.4,
    ojos: "#ff8a3a", botas: "metal", cinturon: "metal",
    extra: [
      { k: "e", x: 0, y: -17, rx: 2.4, ry: 2.4, pal: "magma", resp: 0.2 },
      { k: "c", a: [-4, -27], b: [-4, -33], r: 1, pal: "metal" },
      { k: "e", x: -4, y: -35, rx: 1.6, ry: 1.6, pal: "piel_gris", m: [{ d: [0.4, -1.2], f: 2 }] },
    ] }),
  babosa: {
    anim: "quieto",
    partes: [
      { k: "c", pts: [[-12, -2.5], [-6, -3.5], [0, -4.5], [5, -5]], r0: 2.4, r1: 5, pal: "magma", m: [{ d: [0, -0.8], o: 1.2, f: 2 }] },
      { k: "e", x: 6, y: -6, rx: 5, ry: 5, pal: "magma", resp: 0.06 },
      { k: "c", a: [7, -10], b: [9, -15], r0: 1, r1: 0.6, pal: "magma", m: [{ r: 0.3, piv: [7, -10], f: 2 }] },
      { k: "c", a: [4, -10], b: [4, -14], r0: 1, r1: 0.6, pal: "magma", osc: 1, m: [{ r: -0.3, piv: [4, -10], f: 2 }] },
      { k: "px", pts: [[9, -15], [4, -14]], col: "#fff6c8" },
      { k: "px", pts: [[-4, -6], [0, -8], [3, -6], [-8, -4]], col: "#ffe28a", m: [{ d: [0, -0.5], f: 3 }] },
    ],
  },
  tejedor: {
    anim: "flotar", altura: 5, brillo: [0, -14, 18, "#7af0ff"],
    partes: [
      { k: "c", a: [-9, -14], b: [9, -14], r: 0.8, pal: "cobre", m: [{ r: 0.5, piv: [0, -14], f: 1 }] },
      { k: "e", x: 0, y: -14, rx: 6, ry: 6, pal: "cobre" },
      { k: "e", x: 0, y: -14, rx: 6.4, ry: 2, pal: "metal", m: [{ r: 0.4, piv: [0, -14], f: 2 }] },
      { k: "e", x: 1, y: -14.5, rx: 2.4, ry: 2.4, pal: "eter" },
      { k: "px", pts: [[-9, -14], [9, -14], [-8, -15], [8, -13]], col: "#d0f8ff", m: [{ r: 0.5, piv: [0, -14], f: 1 }] },
    ],
  },
  martillador: H({ piel: "piel_gris", ropa: "cuero", brazos: "piel_gris", cabeza: "sin_rostro", arma: "martillo", metal: "magma", alto: 1.15, ancho: 1.4, rebote: 0.8,
    extra: [{ k: "c", a: [-5, -21], b: [5, -21], r: 1.4, pal: "metal" }] }),
  // ======== Estrato IV
  engendro: {
    anim: "saltar", rebote: 2,
    partes: [
      { k: "e", x: 0, y: -7, rx: 9, ry: 7, pal: "bilis", resp: 0.1 },
      { k: "e", x: -4, y: -11, rx: 3, ry: 2.6, pal: "bilis" },
      { k: "e", x: 4, y: -12, rx: 2.4, ry: 2.2, pal: "bilis" },
      { k: "e", x: 2, y: -6, rx: 4, ry: 2, pal: "carne" },
      { k: "px", pts: [[-2, -7], [0, -5], [2, -7], [4, -5], [6, -7]], col: "#f2ead2" },
      { k: "px", pts: [[-4, -12], [4, -13], [-1, -10]], col: "#ffe84a", parpadeo: true },
    ],
  },
  doppel: H({ piel: "obsidiana", ropa: "obsidiana", brazos: "obsidiana", piernas: "obsidiana", botas: "obsidiana", manos: "obsidiana", cabeza: "sin_rostro", arma: "espada",
    metal: "vacio", cinturon: "vacio", alto: 1.05, extra: [{ k: "px", pts: [[2, -26], [4, -26]], col: "#c9a7ff" }] }),
  parasito: {
    anim: "quieto",
    partes: [
      ...patas(4, 0, -6, 6, "carne", 2),
      { k: "e", x: 0, y: -8, rx: 7.5, ry: 6.5, pal: "carne", resp: 0.12 },
      { k: "e", x: -2, y: -10, rx: 3.5, ry: 2.5, pal: "carne", osc: 1 },
      { k: "c", pts: [[-7, -9], [-12, -12], [-16, -10]], r0: 1.6, r1: 1, pal: "carne", m: [{ d: [0, 1], o: 1, f: 2 }] },
      { k: "px", pts: [[3, -10], [5, -9]], col: "#ffe84a" },
      { k: "px", pts: [[1, -4], [3, -3], [5, -4]], col: "#f2ead2" },
    ],
  },
  armadura: H({ piel: "obsidiana", ropa: "metal", brazos: "metal", piernas: "metal", botas: "metal", manos: "metal", cabeza: "casco", metal: "metal", arma: "espada",
    escudo: "carne", emblema: "#ff5a5a", ojos: "#ff3a4a", alto: 1.1, ancho: 1.2, rebote: 0.6,
    extra: [{ k: "c", a: [-5, -22], b: [-8, -24], r: 1.6, pal: "metal" }, { k: "px", pts: [[-1, -18], [1, -16], [-1, -14]], col: "#ff5a5a" }] }),
  devorador: {
    anim: "flotar", altura: 6, brillo: [0, -15, 20, "#c9a7ff"],
    partes: [
      { k: "c", pts: [[-6, -10], [-9, -4], [-7, 0]], r0: 1.4, r1: 0.6, pal: "vacio", osc: 1, m: [{ d: [1, 0], o: 1, f: 2 }] },
      { k: "c", pts: [[6, -10], [9, -4], [7, 0]], r0: 1.4, r1: 0.6, pal: "vacio", m: [{ d: [-1, 0], o: 1, f: 2 }] },
      { k: "e", x: 0, y: -15, rx: 8, ry: 7, pal: "vacio", resp: 0.05 },
      { k: "e", x: 1, y: -13, rx: 5, ry: 3, pal: "sombra", mate: true, m: [{ d: [0, 0.8], f: 2 }] },
      { k: "px", pts: [[-3, -14], [-1, -15], [1, -14], [3, -15], [5, -14], [-2, -11], [2, -11], [4, -12]], col: "#e0d0ff" },
      { k: "px", pts: [[-3, -19], [3, -20], [0, -21]], col: "#ffe84a", parpadeo: true },
    ],
  },
  fragmento: {
    anim: "flotar", altura: 5, brillo: [0, -15, 18, "#ffffff"],
    partes: [
      { k: "p", pts: [[0, -26], [6, -15], [0, -4], [-6, -15]], pal: "hielo", m: [{ r: 0.12, piv: [0, -15], f: 1 }] },
      { k: "p", pts: [[0, -22], [3, -15], [0, -8], [-3, -15]], pal: "vacio", m: [{ r: 0.12, piv: [0, -15], f: 1 }] },
      { k: "p", pts: [[-9, -20], [-6, -16], [-9, -12], [-11, -16]], pal: "hielo", m: [{ d: [-1, 0], f: 2 }] },
      { k: "p", pts: [[9, -20], [11, -16], [9, -12], [6, -16]], pal: "hielo", m: [{ d: [1, 0], f: 2 }] },
      { k: "px", pts: [[0, -16], [0, -15]], col: "#ffffff" },
    ],
  },
  // ======== Demonios (el bruto que emergía en las arenas, 16 nov noche 7)
  demonio: demonio("demonio", "#ffb23d", "#ff6a2a"),
  demonio_vacio: demonio("demonio_vacio", "#c9a7ff", "#8a5aff"),
  // ======== Genéricos por conducta (cuando el piso no tiene arquetipo para esa conducta)
  caminante: H({ piel: "hueso", ropa: "hueso", brazos: "hueso", piernas: "hueso", botas: "hueso", cabeza: "craneo", arma: "espada", cinturon: "cuero", alto: 0.95, ancho: 0.85 }),
  saltador: {
    anim: "saltar", rebote: 4,
    partes: [
      { k: "e", x: 0, y: -6, rx: 8, ry: 6, pal: "piel_verde", resp: 0.12 },
      { k: "e", x: -3, y: -9, rx: 2, ry: 1.5, pal: "piel_verde" },
      { k: "px", pts: [[1, -7], [4, -7]], col: "#0c0910", parpadeo: true },
      { k: "px", pts: [[2, -4], [3, -4]], col: "#1a0a10" },
    ],
  },
  volador: {
    anim: "flotar", altura: 4,
    partes: [
      ...alas(0, -15, "tela_morada", 12, 3),
      { k: "e", x: 0, y: -14, rx: 4.5, ry: 5, pal: "tela_morada" },
      { k: "c", a: [-2, -18], b: [-3, -22], r0: 1, r1: 0.4, pal: "tela_morada" },
      { k: "c", a: [2, -18], b: [3, -22], r0: 1, r1: 0.4, pal: "tela_morada" },
      { k: "px", pts: [[-1, -15], [2, -15]], col: "#ffde59" },
      { k: "c", pts: [[0, -10], [-1, -6], [1, -3]], r0: 0.8, r1: 0.4, pal: "tela_morada", m: [{ d: [1, 0], o: 1, f: 2 }] },
    ],
  },
  torreta: H({ piel: "piel_gris", ropa: "tela_morada", cabeza: "capucha", arma: "ninguna", anim: "quieto", ojos: "#ff8a3d", alto: 1,
    extra: [
      { k: "p", pts: [[-5, -11], [5, -11], [7, 0], [-7, 0]], pal: "tela_morada" },
      { k: "e", x: 7, y: -16, rx: 2.4, ry: 2.4, pal: "magma", m: [{ d: [0, -1], f: 2 }] },
    ] }),
  escudero: H({ piel: "piel_verde", ropa: "cuero", cabeza: "normal", arma: "espada", ojos: "#ff3a3a", alto: 1, ancho: 1.2,
    extra_cabeza: [{ k: "px", pts: [[1, -23], [3, -23]], col: "#f2ead2" }] }),
  cargador: {
    anim: "andar", rebote: 0.8,
    partes: [
      ...patas(4, 0, -6, 4, "cuero", 1),
      { k: "e", x: -1, y: -9, rx: 9, ry: 6, pal: "cuero", resp: 0.05 },
      { k: "e", x: 8, y: -9, rx: 4, ry: 3.6, pal: "cuero" },
      { k: "c", a: [10, -8], b: [13, -13], r0: 1, r1: 0.4, pal: "hueso" },
      { k: "px", pts: [[9, -11]], col: "#ff3a3a" },
      { k: "c", pts: [[-6, -14], [-2, -16], [2, -15]], r0: 1, r1: 0.6, pal: "tela_parda" },
    ],
  },
  explosivo: {
    anim: "saltar", rebote: 3, brillo: [0, -9, 14, "#ff9a3d"],
    partes: [
      { k: "e", x: 0, y: -7, rx: 6, ry: 6, pal: "obsidiana", resp: 0.1 },
      { k: "c", a: [1, -13], b: [3, -17], r: 0.6, pal: "cuero" },
      { k: "px", pts: [[3, -18], [4, -18]], col: "#ffe28a", m: [{ d: [0.6, -0.6], f: 6 }] },
      { k: "px", pts: [[-2, -8], [1, -8]], col: "#ff9a3d", parpadeo: true },
      { k: "px", pts: [[-3, -5], [-1, -4], [1, -5]], col: "#ff9a3d" },
    ],
  },
  lanzador: H({ piel: "piel_verde", ropa: "cuero", cabeza: "normal", arma: "ninguna", ojos: "#ffe84a", alto: 0.85, ancho: 0.95, anim: "quieto",
    extra: [{ k: "e", x: 6, y: -24, rx: 2, ry: 2, pal: "hueso", m: [{ d: [1, -2], f: 1 }] }],
    extra_cabeza: [{ k: "c", a: [-3, -25], b: [-7, -27], r0: 1, r1: 0.4, pal: "piel_verde" }, { k: "c", a: [4, -25], b: [7, -28], r0: 1, r1: 0.4, pal: "piel_verde" }] }),
  espectro: {
    anim: "flotar", altura: 3, brillo: [0, -14, 18, "#c9b8ff"],
    partes: [
      { k: "c", pts: [[0, -8], [-1, -3], [1, 1]], r0: 4.5, r1: 0.8, pal: "tela_morada", m: [{ d: [1.4, 0], o: 1.3, f: 2 }] },
      { k: "e", x: 0, y: -14, rx: 5.5, ry: 7, pal: "tela_morada", resp: 0.05 },
      { k: "e", x: 0.5, y: -21, rx: 4.6, ry: 4.6, pal: "tela_morada" },
      { k: "e", x: 1.5, y: -20.5, rx: 3, ry: 3, pal: "sombra", mate: true },
      { k: "px", pts: [[0, -21], [3, -21]], col: "#c9b8ff" },
      { k: "c", a: [4, -16], b: [9, -12], r0: 1.4, r1: 0.6, pal: "tela_morada", m: [{ r: -0.4, piv: [4, -16], f: 1 }] },
    ],
  },
};
