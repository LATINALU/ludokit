//! Multitudes: miles de agentes (zombis, súbditos, unidades de RTS) moviéndose a la vez.
//!   - `CampoFlujo`: Dijkstra desde el/los objetivos sobre una grilla (port exacto de `navegacion/campo-flujo.ts`):
//!     un solo cálculo da la dirección hacia el objetivo para TODAS las celdas.
//!   - `Multitud`: agentes en **estructura de arreglos** (SoA: `x[]`, `y[]`, `vx[]`, `vy[]`) que siguen el campo y se
//!     separan entre sí. La separación usa una grilla reconstruida por **ordenamiento por conteo** en cada paso
//!     (O(n), sin `HashMap`, sin asignar memoria después del primer paso). Es el patrón que hace que 10 000 agentes
//!     quepan en el presupuesto de un tick de 60 Hz, y es donde Rust saca más ventaja sobre JavaScript.

use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Copy, Clone, PartialEq)]
struct Abierto {
    d: f32,
    i: u32,
}
impl Eq for Abierto {}
impl Ord for Abierto {
    fn cmp(&self, o: &Self) -> Ordering {
        o.d.total_cmp(&self.d).then_with(|| o.i.cmp(&self.i))
    }
}
impl PartialOrd for Abierto {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}

pub struct CampoFlujo {
    pub cols: i32,
    pub filas: i32,
    pub distancia: Vec<f32>,
    /// Dirección precalculada de cada celda (se llena al final de `calcular`): leerla es O(1).
    pub direcciones: Vec<(f32, f32)>,
    heap: BinaryHeap<Abierto>,
}

const VECINOS: [(i32, i32); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];

impl CampoFlujo {
    pub fn nuevo(cols: i32, filas: i32) -> Self {
        let n = (cols * filas) as usize;
        CampoFlujo { cols, filas, distancia: vec![f32::INFINITY; n], direcciones: vec![(0.0, 0.0); n], heap: BinaryHeap::new() }
    }

    /// `costo(c, f)`: ≤ 0 o infinito = bloqueada. Mismos resultados que la versión TypeScript.
    pub fn calcular(&mut self, objetivos: &[(i32, i32)], costo: impl Fn(i32, i32) -> f64, max_dist: f64) {
        let cols = self.cols;
        self.distancia.iter_mut().for_each(|d| *d = f32::INFINITY);
        self.heap.clear();
        for &(c, f) in objetivos {
            let i = (f * cols + c) as usize;
            self.distancia[i] = 0.0;
            self.heap.push(Abierto { d: 0.0, i: i as u32 });
        }
        let libre = |k: f64| k > 0.0 && k.is_finite();
        while let Some(Abierto { d, i }) = self.heap.pop() {
            let i = i as usize;
            let base = self.distancia[i];
            if d > base {
                continue;
            }
            if base as f64 > max_dist {
                continue;
            }
            let (c, f) = (i as i32 % cols, i as i32 / cols);
            for &(dc, df) in &VECINOS {
                let (nc, nf) = (c + dc, f + df);
                if nc < 0 || nf < 0 || nc >= cols || nf >= self.filas {
                    continue;
                }
                let k = costo(nc, nf);
                if !libre(k) {
                    continue;
                }
                let diag = dc != 0 && df != 0;
                if diag && !(libre(costo(c + dc, f)) && libre(costo(c, f + df))) {
                    continue;
                }
                let nd = (base as f64 + k * if diag { std::f64::consts::SQRT_2 } else { 1.0 }) as f32;
                let j = (nf * cols + nc) as usize;
                if nd < self.distancia[j] {
                    self.distancia[j] = nd;
                    self.heap.push(Abierto { d: nd, i: j as u32 });
                }
            }
        }
        // Precalcular la dirección de cada celda: los agentes la leen miles de veces por paso.
        for f in 0..self.filas {
            for c in 0..self.cols {
                let d = self.direccion_calculada(c, f);
                self.direcciones[(f * self.cols + c) as usize] = d;
            }
        }
    }

    /// Dirección CONTINUA en una posición del mundo (en celdas): mezcla bilineal de las direcciones de las 4 celdas
    /// más cercanas. Evita que todos los agentes de una celda vayan exactamente igual (filas y "carriles" visibles).
    pub fn direccion_suave(&self, x: f32, y: f32) -> (f32, f32) {
        let (fx, fy) = (x - 0.5, y - 0.5);
        let (c0, f0) = (fx.floor() as i32, fy.floor() as i32);
        let (tx, ty) = (fx - c0 as f32, fy - f0 as f32);
        let (mut dx, mut dy, mut peso) = (0.0f32, 0.0f32, 0.0f32);
        for (dc, df, w) in [(0, 0, (1.0 - tx) * (1.0 - ty)), (1, 0, tx * (1.0 - ty)), (0, 1, (1.0 - tx) * ty), (1, 1, tx * ty)] {
            let (c, f) = (c0 + dc, f0 + df);
            if c < 0 || f < 0 || c >= self.cols || f >= self.filas || !self.distancia[(f * self.cols + c) as usize].is_finite() {
                continue;
            }
            let (a, b) = self.direccion(c, f);
            dx += a * w;
            dy += b * w;
            peso += w;
        }
        if peso <= 0.0 {
            return (0.0, 0.0);
        }
        let l = (dx * dx + dy * dy).sqrt();
        if l > 1e-6 { (dx / l, dy / l) } else { (0.0, 0.0) }
    }

    /// Dirección normalizada hacia la vecina de menor distancia; (0,0) si no hay camino (precalculada).
    #[inline]
    pub fn direccion(&self, c: i32, f: i32) -> (f32, f32) {
        self.direcciones[(f * self.cols + c) as usize]
    }

    fn direccion_calculada(&self, c: i32, f: i32) -> (f32, f32) {
        let mut mejor = self.distancia[(f * self.cols + c) as usize];
        let (mut dx, mut dy) = (0i32, 0i32);
        for ff in -1..=1 {
            for cc in -1..=1 {
                if cc == 0 && ff == 0 {
                    continue;
                }
                let (nc, nf) = (c + cc, f + ff);
                if nc < 0 || nf < 0 || nc >= self.cols || nf >= self.filas {
                    continue;
                }
                let v = self.distancia[(nf * self.cols + nc) as usize];
                if v < mejor {
                    mejor = v;
                    dx = cc;
                    dy = ff;
                }
            }
        }
        let l = ((dx * dx + dy * dy) as f32).sqrt();
        if l > 0.0 { (dx as f32 / l, dy as f32 / l) } else { (0.0, 0.0) }
    }
}

/// Agentes mínimos por hilo en `paso_paralelo`.
pub const MIN_POR_HILO: usize = 4096;

/// Celdas antes del objetivo en las que el agente empieza a frenar.
const LLEGADA: f32 = 3.0;

#[derive(Clone, Copy, Debug)]
pub struct ReglasMultitud {
    /// Tamaño de celda del campo de flujo (unidades del mundo).
    pub tile: f32,
    pub velocidad: f32,
    pub aceleracion: f32,
    /// Radio de separación entre agentes y fuerza.
    pub radio: f32,
    pub separacion: f32,
}

/// Agentes en estructura de arreglos (SoA). Leer `x`/`y` directo para dibujar (o copiarlos por FFI de una vez).
pub struct Multitud {
    pub x: Vec<f32>,
    pub y: Vec<f32>,
    pub vx: Vec<f32>,
    pub vy: Vec<f32>,
    pub reglas: ReglasMultitud,
    // Grilla de separación por conteo (reutilizada entre pasos).
    inicio: Vec<u32>,
    orden: Vec<u32>,
    celda_de: Vec<u32>,
    gcols: i32,
    gfilas: i32,
    gx0: f32,
    gy0: f32,
}

impl Multitud {
    pub fn nueva(reglas: ReglasMultitud) -> Self {
        Multitud { x: vec![], y: vec![], vx: vec![], vy: vec![], reglas, inicio: vec![], orden: vec![], celda_de: vec![], gcols: 0, gfilas: 0, gx0: 0.0, gy0: 0.0 }
    }

    pub fn agregar(&mut self, x: f32, y: f32) -> usize {
        self.x.push(x);
        self.y.push(y);
        self.vx.push(0.0);
        self.vy.push(0.0);
        self.x.len() - 1
    }

    pub fn len(&self) -> usize {
        self.x.len()
    }

    pub fn is_empty(&self) -> bool {
        self.x.is_empty()
    }

    /// Quita el agente `i` en O(1) (el último ocupa su lugar).
    pub fn quitar(&mut self, i: usize) {
        self.x.swap_remove(i);
        self.y.swap_remove(i);
        self.vx.swap_remove(i);
        self.vy.swap_remove(i);
    }

    fn armar_grilla(&mut self) {
        let n = self.x.len();
        let r = self.reglas.radio.max(1e-3);
        let (mut x0, mut y0, mut x1, mut y1) = (f32::INFINITY, f32::INFINITY, f32::NEG_INFINITY, f32::NEG_INFINITY);
        for i in 0..n {
            x0 = x0.min(self.x[i]);
            y0 = y0.min(self.y[i]);
            x1 = x1.max(self.x[i]);
            y1 = y1.max(self.y[i]);
        }
        self.gx0 = x0;
        self.gy0 = y0;
        self.gcols = (((x1 - x0) / r) as i32 + 1).max(1);
        self.gfilas = (((y1 - y0) / r) as i32 + 1).max(1);
        let total = (self.gcols * self.gfilas) as usize;
        self.inicio.clear();
        self.inicio.resize(total + 1, 0);
        self.celda_de.resize(n, 0);
        self.orden.resize(n, 0);
        for i in 0..n {
            let c = ((self.x[i] - x0) / r) as i32;
            let f = ((self.y[i] - y0) / r) as i32;
            let k = (f * self.gcols + c) as u32;
            self.celda_de[i] = k;
            self.inicio[k as usize + 1] += 1;
        }
        for k in 0..total {
            self.inicio[k + 1] += self.inicio[k];
        }
        let mut cursor = self.inicio.clone();
        for i in 0..n {
            let k = self.celda_de[i] as usize;
            self.orden[cursor[k] as usize] = i as u32;
            cursor[k] += 1;
        }
    }

    /// Un paso: seguir el campo (aceleración hacia la velocidad deseada) + separación de vecinos + integrar.
    /// `bloqueada(c, f)`: celdas del campo que no se pueden pisar (el agente se frena en ese eje).
    pub fn paso(&mut self, dt: f32, campo: &CampoFlujo, bloqueada: impl Fn(i32, i32) -> bool) {
        if self.x.is_empty() {
            return;
        }
        self.armar_grilla();
        let nuevas: Vec<(f32, f32)> = {
            let lectura = Lectura { m: self, campo };
            (0..self.x.len()).map(|i| lectura.velocidad(i, dt)).collect()
        };
        for (i, (vx, vy)) in nuevas.into_iter().enumerate() {
            self.vx[i] = vx;
            self.vy[i] = vy;
        }
        self.integrar(dt, &bloqueada);
    }

    /// Igual que `paso` pero repartiendo el cálculo de velocidades en `hilos` hilos (std::thread::scope, sin
    /// dependencias). Cada agente solo escribe su propia velocidad y lee posiciones compartidas: el resultado es
    /// IDÉNTICO al secuencial (determinista) y escala con los núcleos. JavaScript no puede hacer esto sin copiar
    /// memoria entre workers.
    pub fn paso_paralelo(&mut self, dt: f32, campo: &CampoFlujo, bloqueada: impl Fn(i32, i32) -> bool, hilos: usize) {
        let n = self.x.len();
        if n == 0 {
            return;
        }
        self.armar_grilla();
        // Mínimo de agentes por hilo: crear hilos cuesta (~decenas de µs); con poca carga conviene menos hilos.
        let hilos = hilos.max(1).min(n.div_ceil(MIN_POR_HILO));
        if hilos == 1 {
            return self.paso(dt, campo, bloqueada);
        }
        let tam = n.div_ceil(hilos);
        let mut nuevas = vec![(0.0f32, 0.0f32); n];
        {
            let lectura = Lectura { m: self, campo };
            std::thread::scope(|s| {
                for (k, trozo) in nuevas.chunks_mut(tam).enumerate() {
                    let l = &lectura;
                    s.spawn(move || {
                        for (o, v) in trozo.iter_mut().enumerate() {
                            *v = l.velocidad(k * tam + o, dt);
                        }
                    });
                }
            });
        }
        for (i, (vx, vy)) in nuevas.into_iter().enumerate() {
            self.vx[i] = vx;
            self.vy[i] = vy;
        }
        self.integrar(dt, &bloqueada);
    }

    fn integrar(&mut self, dt: f32, bloqueada: &impl Fn(i32, i32) -> bool) {
        let tile = self.reglas.tile;
        for i in 0..self.x.len() {
            let nx = self.x[i] + self.vx[i] * dt;
            let ny = self.y[i] + self.vy[i] * dt;
            let cf = (self.y[i] / tile).floor() as i32;
            if bloqueada((nx / tile).floor() as i32, cf) {
                self.vx[i] = 0.0;
            } else {
                self.x[i] = nx;
            }
            if bloqueada((self.x[i] / tile).floor() as i32, (ny / tile).floor() as i32) {
                self.vy[i] = 0.0;
            } else {
                self.y[i] = ny;
            }
        }
    }
}

/// Vista de solo lectura para calcular velocidades (compartible entre hilos).
struct Lectura<'a> {
    m: &'a Multitud,
    campo: &'a CampoFlujo,
}

impl Lectura<'_> {
    fn velocidad(&self, i: usize, dt: f32) -> (f32, f32) {
        let (m, campo) = (self.m, self.campo);
        let ReglasMultitud { tile, velocidad, aceleracion, radio, separacion } = m.reglas;
        let r2 = radio * radio;
        let (px, py) = (m.x[i], m.y[i]);
        let (c, f) = ((px / tile).floor() as i32, (py / tile).floor() as i32);
        let dentro = c >= 0 && f >= 0 && c < campo.cols && f < campo.filas;
        let (mut dx, mut dy) = if dentro { campo.direccion_suave(px / tile, py / tile) } else { (0.0, 0.0) };
        // Llegada: frenar en las últimas celdas para no apilarse sobre el objetivo.
        let llegada = if dentro { (campo.distancia[(f * campo.cols + c) as usize] / LLEGADA).clamp(0.0, 1.0) } else { 1.0 };
        dx *= velocidad * llegada;
        dy *= velocidad * llegada;
        // Separación: vecinos en las 9 celdas de la grilla de radio.
        let (gc, gf) = (((px - m.gx0) / radio) as i32, ((py - m.gy0) / radio) as i32);
        let (mut sx, mut sy) = (0.0f32, 0.0f32);
        for ff in (gf - 1).max(0)..=(gf + 1).min(m.gfilas - 1) {
            for cc in (gc - 1).max(0)..=(gc + 1).min(m.gcols - 1) {
                let k = (ff * m.gcols + cc) as usize;
                for &j in &m.orden[m.inicio[k] as usize..m.inicio[k + 1] as usize] {
                    let j = j as usize;
                    if j == i {
                        continue;
                    }
                    let (ox, oy) = (px - m.x[j], py - m.y[j]);
                    let d2 = ox * ox + oy * oy;
                    if d2 < r2 && d2 > 1e-9 {
                        let d = d2.sqrt();
                        let w = (radio - d) / (radio * d);
                        sx += ox * w;
                        sy += oy * w;
                    }
                }
            }
        }
        dx += sx * separacion;
        dy += sy * separacion;
        let paso = aceleracion * dt;
        let (ex, ey) = (dx - m.vx[i], dy - m.vy[i]);
        let el = (ex * ex + ey * ey).sqrt();
        if el <= paso { (dx, dy) } else { (m.vx[i] + ex / el * paso, m.vy[i] + ey / el * paso) }
    }
}
