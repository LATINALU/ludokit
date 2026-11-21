//! Cuerdas Verlet con restricciones de distancia y doblado (capas, cadenas, pelo). Port de `feel/dominio/verlet.ts`.

#[derive(Clone, Copy, Debug)]
pub struct ConfigCuerda {
    pub nodos: usize,
    pub segmento: f32,
    pub gravedad: f32,
    pub friccion: f32,
    pub iteraciones: u32,
    pub rigidez: f32,
    pub turbulencia: f32,
}

impl ConfigCuerda {
    pub const CAPA: ConfigCuerda = ConfigCuerda { nodos: 7, segmento: 2.6, gravedad: 420.0, friccion: 0.9, iteraciones: 4, rigidez: 0.35, turbulencia: 30.0 };
    pub const CADENA: ConfigCuerda = ConfigCuerda { nodos: 10, segmento: 5.0, gravedad: 520.0, friccion: 0.97, iteraciones: 8, rigidez: 0.0, turbulencia: 2.0 };
}

pub struct Cuerda {
    pub cfg: ConfigCuerda,
    pub pos: Vec<[f32; 2]>,
    ant: Vec<[f32; 2]>,
    inv_masa: Vec<f32>,
}

impl Cuerda {
    pub fn nueva(ancla: (f32, f32), cfg: ConfigCuerda) -> Self {
        let n = cfg.nodos.max(2);
        let pos: Vec<[f32; 2]> = (0..n).map(|i| [ancla.0, ancla.1 + i as f32 * cfg.segmento]).collect();
        let inv_masa = (0..n).map(|i| if i == 0 { 0.0 } else { 1.0 + 0.6 * i as f32 / (n - 1) as f32 }).collect();
        Cuerda { cfg, ant: pos.clone(), pos, inv_masa }
    }

    pub fn anclar(&mut self, x: f32, y: f32) {
        self.pos[0] = [x, y];
    }

    pub fn simular(&mut self, dt: f32, tiempo: f32, solido: impl Fn(f32, f32) -> bool) {
        let c = self.cfg;
        let dt2 = dt * dt;
        for i in 1..self.pos.len() {
            if self.inv_masa[i] == 0.0 {
                continue;
            }
            let v = [(self.pos[i][0] - self.ant[i][0]) * c.friccion, (self.pos[i][1] - self.ant[i][1]) * c.friccion];
            self.ant[i] = self.pos[i];
            let fase = tiempo * 7.5 + i as f32 * 0.9 + self.pos[i][0] * 0.04;
            let ax = fase.sin() * c.turbulencia;
            let ay = c.gravedad + (fase * 1.3).cos() * c.turbulencia * 0.35;
            let m = self.inv_masa[i];
            self.pos[i][0] += v[0] + ax * m * dt2;
            self.pos[i][1] += v[1] + ay * m * dt2;
        }
        for _ in 0..c.iteraciones {
            for i in 0..self.pos.len() - 1 {
                self.restringir(i, i + 1, c.segmento, 1.0);
            }
            if c.rigidez > 0.0 {
                for i in 0..self.pos.len().saturating_sub(2) {
                    self.restringir(i, i + 2, c.segmento * 1.75, c.rigidez);
                }
            }
            for i in 1..self.pos.len() {
                if solido(self.pos[i][0], self.pos[i][1]) {
                    self.pos[i] = [self.ant[i][0], self.ant[i][1] - 0.5];
                }
            }
        }
    }

    fn restringir(&mut self, i: usize, j: usize, objetivo: f32, rigidez: f32) {
        let (dx, dy) = (self.pos[j][0] - self.pos[i][0], self.pos[j][1] - self.pos[i][1]);
        let d = (dx * dx + dy * dy).sqrt();
        let (w1, w2) = (self.inv_masa[i], self.inv_masa[j]);
        if d < 1e-4 || w1 + w2 == 0.0 {
            return;
        }
        let k = (d - objetivo) / d * rigidez;
        let (a, b) = (w1 / (w1 + w2), w2 / (w1 + w2));
        self.pos[i][0] += dx * k * a;
        self.pos[i][1] += dy * k * a;
        self.pos[j][0] -= dx * k * b;
        self.pos[j][1] -= dy * k * b;
    }

    pub fn largo(&self) -> f32 {
        self.pos.windows(2).map(|w| ((w[1][0] - w[0][0]).powi(2) + (w[1][1] - w[0][1]).powi(2)).sqrt()).sum()
    }
}
