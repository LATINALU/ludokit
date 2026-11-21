//! Física 2D por tiles con ejes separados, plataformas de un sentido, pinchos y corrección de esquinas.
//! Port 1:1 de `contextos/fisica/dominio/cuerpo.ts`.

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Celda {
    Vacio = 0,
    Roca = 1,
    Plataforma = 2,
    Pinchos = 3,
}

#[derive(Clone, Debug)]
pub struct Grilla {
    pub cols: i32,
    pub filas: i32,
    pub tile: f32,
    pub fuera: Celda,
    datos: Vec<Celda>,
}

impl Grilla {
    pub fn nueva(cols: i32, filas: i32, tile: f32, fuera: Celda) -> Self {
        Grilla { cols, filas, tile, fuera, datos: vec![Celda::Vacio; (cols * filas) as usize] }
    }

    /// '#' roca, '=' plataforma, '^' pinchos, otro = vacío.
    pub fn desde_texto(filas: &[&str], tile: f32) -> Self {
        let cols = filas.iter().map(|f| f.chars().count()).max().unwrap_or(0) as i32;
        let mut g = Grilla::nueva(cols, filas.len() as i32, tile, Celda::Vacio);
        for (f, linea) in filas.iter().enumerate() {
            for (c, ch) in linea.chars().enumerate() {
                let v = match ch {
                    '#' => Celda::Roca,
                    '=' => Celda::Plataforma,
                    '^' => Celda::Pinchos,
                    _ => Celda::Vacio,
                };
                g.poner(c as i32, f as i32, v);
            }
        }
        g
    }

    pub fn celda(&self, c: i32, f: i32) -> Celda {
        if c < 0 || f < 0 || c >= self.cols || f >= self.filas {
            self.fuera
        } else {
            self.datos[(f * self.cols + c) as usize]
        }
    }

    pub fn poner(&mut self, c: i32, f: i32, v: Celda) {
        if c >= 0 && f >= 0 && c < self.cols && f < self.filas {
            self.datos[(f * self.cols + c) as usize] = v;
        }
    }

    pub fn solida(&self, c: i32, f: i32) -> bool {
        self.celda(c, f) == Celda::Roca
    }

    /// Autotile de 4 bits (1 arriba · 2 der · 4 abajo · 8 izq) con la convención de `celda` para lo de afuera.
    pub fn mascara(&self, c: i32, f: i32) -> u8 {
        let roca = |c: i32, f: i32| self.celda(c, f) == Celda::Roca;
        (if !roca(c, f - 1) { 1 } else { 0 }) | (if !roca(c + 1, f) { 2 } else { 0 }) | (if !roca(c, f + 1) { 4 } else { 0 }) | (if !roca(c - 1, f) { 8 } else { 0 })
    }
}

#[derive(Clone, Debug, Default)]
pub struct Cuerpo {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub vx: f32,
    pub vy: f32,
    pub ant_x: f32,
    pub ant_y: f32,
    pub en_suelo: bool,
    pub pared: i8,
    pub techo: bool,
    pub pinchos: bool,
}

impl Cuerpo {
    pub fn nuevo(x: f32, y: f32, w: f32, h: f32) -> Self {
        Cuerpo { x, y, w, h, ant_x: x, ant_y: y, ..Default::default() }
    }

    pub fn visual(&self, alfa: f32) -> (f32, f32) {
        (self.ant_x + (self.x - self.ant_x) * alfa, self.ant_y + (self.y - self.ant_y) * alfa)
    }
}

const EPS: f32 = 0.001;

pub fn rect_libre(g: &Grilla, x: f32, y: f32, w: f32, h: f32) -> bool {
    let t = g.tile;
    for f in (y / t).floor() as i32..=((y + h - 0.01) / t).floor() as i32 {
        for c in (x / t).floor() as i32..=((x + w - 0.01) / t).floor() as i32 {
            if g.solida(c, f) {
                return false;
            }
        }
    }
    true
}

fn deslizar_techo(cu: &mut Cuerpo, g: &Grilla, n: i32) -> bool {
    for d in 1..=n {
        for lado in [-1.0f32, 1.0] {
            if rect_libre(g, cu.x + lado * d as f32, cu.y, cu.w, cu.h) {
                cu.x += lado * d as f32;
                return true;
            }
        }
    }
    false
}

fn subir_cornisa(cu: &mut Cuerpo, g: &Grilla, col: i32, n: i32) -> bool {
    let t = g.tile;
    let borde = ((cu.y + cu.h - 0.01) / t).floor() * t;
    let sube = cu.y + cu.h - borde;
    if sube <= 0.0 || sube > n as f32 {
        return false;
    }
    if !rect_libre(g, cu.x, cu.y - sube - 0.01, cu.w, cu.h) || g.solida(col, ((borde - 1.0) / t).floor() as i32) {
        return false;
    }
    cu.y -= sube + 0.01;
    true
}

/// Un paso de movimiento. `esquinas` en px (0 = sin corrección).
pub fn mover(cu: &mut Cuerpo, g: &Grilla, dt: f32, atravesar: bool, esquinas: i32) {
    let t = g.tile;
    cu.ant_x = cu.x;
    cu.ant_y = cu.y;
    cu.pared = 0;
    cu.techo = false;
    cu.pinchos = false;
    if cu.vx != 0.0 {
        cu.x += cu.vx * dt;
        let f0 = (cu.y / t).floor() as i32;
        let f1 = ((cu.y + cu.h - EPS) / t).floor() as i32;
        let col = if cu.vx > 0.0 { ((cu.x + cu.w - EPS) / t).floor() as i32 } else { (cu.x / t).floor() as i32 };
        for f in f0..=f1 {
            if !g.solida(col, f) {
                continue;
            }
            if esquinas > 0 && subir_cornisa(cu, g, col, esquinas) {
                break;
            }
            if cu.vx > 0.0 {
                cu.x = col as f32 * t - cu.w;
                cu.pared = 1;
            } else {
                cu.x = (col + 1) as f32 * t;
                cu.pared = -1;
            }
            cu.vx = 0.0;
            break;
        }
    }
    let pie_antes = cu.y + cu.h;
    cu.y += cu.vy * dt;
    cu.en_suelo = false;
    let c0 = (cu.x / t).floor() as i32;
    let c1 = ((cu.x + cu.w - EPS) / t).floor() as i32;
    if cu.vy >= 0.0 {
        let fila = ((cu.y + cu.h - EPS) / t).floor() as i32;
        let tope = fila as f32 * t;
        for c in c0..=c1 {
            let cel = g.celda(c, fila);
            let plataforma = cel == Celda::Plataforma && !atravesar && pie_antes <= tope + 0.5;
            if cel == Celda::Roca || plataforma {
                cu.y = tope - cu.h;
                cu.vy = 0.0;
                cu.en_suelo = true;
                break;
            }
        }
    } else {
        let fila = (cu.y / t).floor() as i32;
        for c in c0..=c1 {
            if !g.solida(c, fila) {
                continue;
            }
            if esquinas > 0 && deslizar_techo(cu, g, esquinas) {
                break;
            }
            cu.y = (fila + 1) as f32 * t;
            cu.vy = 0.0;
            cu.techo = true;
            break;
        }
    }
    let f_pie = ((cu.y + cu.h - 1.0) / t).floor() as i32;
    for c in ((cu.x + 2.0) / t).floor() as i32..=((cu.x + cu.w - 2.0) / t).floor() as i32 {
        if g.celda(c, f_pie) == Celda::Pinchos {
            cu.pinchos = true;
        }
    }
}
