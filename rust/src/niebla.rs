//! Niebla de guerra en grilla (port exacto de `vision.NieblaGuerra`): 0 oculta, 1 explorada, 2 visible. En un RTS o
//! MOBA se recalcula cada tick para cientos de fuentes de visión con línea de visión (Bresenham): es O(fuentes ×
//! radio² × radio) y por eso conviene en Rust. `bloquea` es una máscara de bytes (1 = pared) para no llamar a una
//! función por celda.

pub struct NieblaGuerra {
    pub cols: i32,
    pub filas: i32,
    pub celdas: Vec<u8>,
    pub bloquea: Vec<u8>,
}

#[derive(Clone, Copy, Debug)]
pub struct FuenteVision {
    pub x: f32,
    pub y: f32,
    pub radio: f32,
    pub ignora_bloqueo: bool,
}

impl NieblaGuerra {
    pub fn nueva(cols: i32, filas: i32, bloquea: Vec<u8>) -> Self {
        assert_eq!(bloquea.len(), (cols * filas) as usize, "máscara de bloqueo con tamaño incorrecto");
        NieblaGuerra { cols, filas, celdas: vec![0; (cols * filas) as usize], bloquea }
    }

    #[inline]
    fn bloq(&self, c: i32, f: i32) -> bool {
        self.bloquea[(f * self.cols + c) as usize] != 0
    }

    pub fn estado(&self, c: i32, f: i32) -> u8 {
        if c < 0 || f < 0 || c >= self.cols || f >= self.filas { 0 } else { self.celdas[(f * self.cols + c) as usize] }
    }

    /// Línea de visión por Bresenham: la celda destino se ve aunque sea pared.
    pub fn linea_libre(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> bool {
        let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
        let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
        let (mut err, mut x, mut y) = (dx + dy, x0, y0);
        while x != x1 || y != y1 {
            if (x != x0 || y != y0) && self.bloq(x, y) {
                return false;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
        true
    }

    pub fn actualizar(&mut self, fuentes: &[FuenteVision]) {
        for c in self.celdas.iter_mut() {
            if *c == 2 {
                *c = 1;
            }
        }
        for s in fuentes {
            let r = s.radio.ceil() as i32;
            let (cx, cy) = (s.x.floor() as i32, s.y.floor() as i32);
            let r2 = s.radio * s.radio;
            for dy in -r..=r {
                for dx in -r..=r {
                    if (dx * dx + dy * dy) as f32 > r2 {
                        continue;
                    }
                    let (c, f) = (cx + dx, cy + dy);
                    if c < 0 || f < 0 || c >= self.cols || f >= self.filas {
                        continue;
                    }
                    let i = (f * self.cols + c) as usize;
                    if self.celdas[i] == 2 {
                        continue;
                    }
                    if s.ignora_bloqueo || self.linea_libre(cx, cy, c, f) {
                        self.celdas[i] = 2;
                    }
                }
            }
        }
    }
}
