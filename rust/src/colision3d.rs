//! Colisiones 3D para disparos masivos: rayos contra esferas, cajas y cápsulas (mismas fórmulas que
//! `espacial/colision3d.ts`) y una `Escena3D` con **grilla uniforme** + recorrido DDA 3D (Amanatides–Woo): un rayo solo
//! prueba las formas de las celdas que atraviesa, en orden, y corta al primer impacto. Con 2 000 personajes y 100 000
//! rayos por segundo (escopetas, ametralladoras, IA que verifica línea de visión) es la diferencia entre O(n) y
//! O(celdas recorridas) por rayo. Memoria contigua (`Vec`), sin asignaciones en la consulta (`impactos` reutilizable).

/// Vector 3D (`f32`: lo que usan los motores y la GPU).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct V3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl V3 {
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        V3 { x, y, z }
    }
    #[inline]
    pub fn sumar(self, o: V3) -> V3 {
        V3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }
    #[inline]
    pub fn restar(self, o: V3) -> V3 {
        V3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }
    #[inline]
    pub fn escalar(self, k: f32) -> V3 {
        V3::new(self.x * k, self.y * k, self.z * k)
    }
    #[inline]
    pub fn punto(self, o: V3) -> f32 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }
    #[inline]
    pub fn largo(self) -> f32 {
        self.punto(self).sqrt()
    }
    #[inline]
    pub fn normalizar(self) -> V3 {
        let l = self.largo();
        if l > 1e-12 { self.escalar(1.0 / l) } else { V3::default() }
    }
    #[inline]
    fn eje(self, i: usize) -> f32 {
        match i {
            0 => self.x,
            1 => self.y,
            _ => self.z,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Forma {
    Esfera { centro: V3, radio: f32 },
    Caja { min: V3, max: V3 },
    Capsula { a: V3, b: V3, radio: f32 },
}

impl Forma {
    /// Caja envolvente (para la grilla).
    pub fn envolvente(&self) -> (V3, V3) {
        match *self {
            Forma::Esfera { centro, radio } => (centro.restar(V3::new(radio, radio, radio)), centro.sumar(V3::new(radio, radio, radio))),
            Forma::Caja { min, max } => (min, max),
            Forma::Capsula { a, b, radio } => (
                V3::new(a.x.min(b.x) - radio, a.y.min(b.y) - radio, a.z.min(b.z) - radio),
                V3::new(a.x.max(b.x) + radio, a.y.max(b.y) + radio, a.z.max(b.z) + radio),
            ),
        }
    }

    pub fn trasladar(&mut self, d: V3) {
        match self {
            Forma::Esfera { centro, .. } => *centro = centro.sumar(d),
            Forma::Caja { min, max } => {
                *min = min.sumar(d);
                *max = max.sumar(d);
            }
            Forma::Capsula { a, b, .. } => {
                *a = a.sumar(d);
                *b = b.sumar(d);
            }
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Rayo {
    pub origen: V3,
    /// Unitario.
    pub dir: V3,
    pub largo: f32,
}

/// Distancia del primer impacto (o `None`).
pub fn rayo_esfera(r: &Rayo, centro: V3, radio: f32) -> Option<f32> {
    let oc = r.origen.restar(centro);
    let b = oc.punto(r.dir);
    let c = oc.punto(oc) - radio * radio;
    let disc = b * b - c;
    if disc < 0.0 {
        return None;
    }
    if c <= 0.0 {
        return Some(0.0);
    }
    let s = disc.sqrt();
    let mut t = -b - s;
    if t < 0.0 {
        t = -b + s;
    }
    if t < 0.0 || t > r.largo { None } else { Some(t) }
}

pub fn rayo_caja(r: &Rayo, min: V3, max: V3) -> Option<f32> {
    let (mut tmin, mut tmax) = (0.0f32, r.largo);
    for i in 0..3 {
        let (o, d, lo, hi) = (r.origen.eje(i), r.dir.eje(i), min.eje(i), max.eje(i));
        if d.abs() < 1e-12 {
            if o < lo || o > hi {
                return None;
            }
            continue;
        }
        let inv = 1.0 / d;
        let (mut t1, mut t2) = ((lo - o) * inv, (hi - o) * inv);
        if t1 > t2 {
            std::mem::swap(&mut t1, &mut t2);
        }
        tmin = tmin.max(t1);
        tmax = tmax.min(t2);
        if tmin > tmax {
            return None;
        }
    }
    Some(tmin)
}

pub fn rayo_capsula(r: &Rayo, a: V3, b: V3, radio: f32) -> Option<f32> {
    let mut mejor: Option<f32> = None;
    let mut tomar = |t: Option<f32>| {
        if let Some(t) = t {
            if mejor.map_or(true, |m| t < m) {
                mejor = Some(t);
            }
        }
    };
    let ab = b.restar(a);
    let ao = r.origen.restar(a);
    let (abab, abd, abao) = (ab.punto(ab), ab.punto(r.dir), ab.punto(ao));
    let aa = abab - abd * abd;
    let bb = abab * ao.punto(r.dir) - abao * abd;
    let cc = abab * ao.punto(ao) - abao * abao - radio * radio * abab;
    if aa > 1e-12 {
        let disc = bb * bb - aa * cc;
        if disc >= 0.0 {
            let t = (-bb - disc.sqrt()) / aa;
            let y = abao + t * abd;
            if t >= 0.0 && t <= r.largo && y > 0.0 && y < abab {
                tomar(Some(t));
            }
        }
    }
    tomar(rayo_esfera(r, a, radio));
    tomar(rayo_esfera(r, b, radio));
    mejor
}

pub fn rayo_forma(r: &Rayo, f: &Forma) -> Option<f32> {
    match *f {
        Forma::Esfera { centro, radio } => rayo_esfera(r, centro, radio),
        Forma::Caja { min, max } => rayo_caja(r, min, max),
        Forma::Capsula { a, b, radio } => rayo_capsula(r, a, b, radio),
    }
}

/// Colisionador de la escena: `etiqueta` = zona/material que define el juego (cabeza, torso, madera...),
/// `duenio` = entidad (para ignorar al que dispara y no contar dos zonas del mismo personaje).
#[derive(Clone, Copy, Debug)]
pub struct Colisionador {
    pub id: u32,
    pub duenio: u32,
    pub etiqueta: u32,
    pub forma: Forma,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Impacto {
    pub id: u32,
    pub duenio: u32,
    pub etiqueta: u32,
    pub t: f32,
}

/// Sin dueño (paredes, suelo).
pub const SIN_DUENIO: u32 = u32::MAX;

/// Escena 3D con grilla uniforme. `celda` ≈ 2-4× el tamaño típico de un personaje.
pub struct Escena3D {
    celda: f32,
    pub colisionadores: Vec<Colisionador>,
    celdas: std::collections::HashMap<(i32, i32, i32), Vec<u32>>,
    sucia: bool,
    marca: Vec<u32>,
    epoca: u32,
}

impl Escena3D {
    pub fn nueva(celda: f32) -> Self {
        Escena3D { celda, colisionadores: Vec::new(), celdas: Default::default(), sucia: false, marca: Vec::new(), epoca: 0 }
    }

    pub fn agregar(&mut self, c: Colisionador) -> usize {
        self.colisionadores.push(c);
        self.marca.push(0);
        self.sucia = true;
        self.colisionadores.len() - 1
    }

    /// Mueve todas las formas de un dueño (la grilla se reconstruye en la próxima consulta).
    pub fn mover_duenio(&mut self, duenio: u32, d: V3) {
        for c in self.colisionadores.iter_mut().filter(|c| c.duenio == duenio) {
            c.forma.trasladar(d);
        }
        self.sucia = true;
    }

    pub fn limpiar(&mut self) {
        self.colisionadores.clear();
        self.marca.clear();
        self.celdas.clear();
    }

    fn celda_de(&self, v: f32) -> i32 {
        (v / self.celda).floor() as i32
    }

    /// Reconstruye la grilla (O(n)). Se llama sola si hubo cambios.
    pub fn reconstruir(&mut self) {
        for v in self.celdas.values_mut() {
            v.clear();
        }
        for (i, c) in self.colisionadores.iter().enumerate() {
            let (lo, hi) = c.forma.envolvente();
            for x in self.celda_de(lo.x)..=self.celda_de(hi.x) {
                for y in self.celda_de(lo.y)..=self.celda_de(hi.y) {
                    for z in self.celda_de(lo.z)..=self.celda_de(hi.z) {
                        self.celdas.entry((x, y, z)).or_default().push(i as u32);
                    }
                }
            }
        }
        self.celdas.retain(|_, v| !v.is_empty());
        self.sucia = false;
    }

    fn nueva_epoca(&mut self) -> u32 {
        self.epoca = self.epoca.wrapping_add(1);
        if self.epoca == 0 {
            self.marca.iter_mut().for_each(|m| *m = 0);
            self.epoca = 1;
        }
        self.epoca
    }

    /// Recorre las celdas que cruza el rayo (DDA 3D) llamando a `visitar(t_salida_celda)`; corta si devuelve false.
    fn recorrer(&self, r: &Rayo, mut visitar: impl FnMut(&[u32], f32) -> bool) {
        let s = self.celda;
        let mut c = [self.celda_de(r.origen.x), self.celda_de(r.origen.y), self.celda_de(r.origen.z)];
        let d = [r.dir.x, r.dir.y, r.dir.z];
        let o = [r.origen.x, r.origen.y, r.origen.z];
        let mut paso = [0i32; 3];
        let mut t_max = [f32::INFINITY; 3];
        let mut t_delta = [f32::INFINITY; 3];
        for i in 0..3 {
            if d[i] > 0.0 {
                paso[i] = 1;
                t_max[i] = ((c[i] + 1) as f32 * s - o[i]) / d[i];
                t_delta[i] = s / d[i];
            } else if d[i] < 0.0 {
                paso[i] = -1;
                t_max[i] = (c[i] as f32 * s - o[i]) / d[i];
                t_delta[i] = -s / d[i];
            }
        }
        loop {
            let salida = t_max[0].min(t_max[1]).min(t_max[2]);
            if let Some(v) = self.celdas.get(&(c[0], c[1], c[2])) {
                if !visitar(v, salida.min(r.largo)) {
                    return;
                }
            }
            if salida > r.largo {
                return;
            }
            let eje = if t_max[0] <= t_max[1] && t_max[0] <= t_max[2] { 0 } else if t_max[1] <= t_max[2] { 1 } else { 2 };
            c[eje] += paso[eje];
            t_max[eje] += t_delta[eje];
        }
    }

    /// Primer impacto del rayo ignorando a `ignorar` (el tirador). Cada forma se prueba una sola vez.
    pub fn lanzar_rayo(&mut self, r: &Rayo, ignorar: u32) -> Option<Impacto> {
        if self.sucia {
            self.reconstruir();
        }
        let ep = self.nueva_epoca();
        let mut mejor: Option<Impacto> = None;
        let mut marca = std::mem::take(&mut self.marca);
        let cols = &self.colisionadores;
        self.recorrer(r, |ids, t_salida| {
            for &i in ids {
                let i = i as usize;
                if marca[i] == ep {
                    continue;
                }
                marca[i] = ep;
                let c = &cols[i];
                if c.duenio == ignorar && ignorar != SIN_DUENIO {
                    continue;
                }
                if let Some(t) = rayo_forma(r, &c.forma) {
                    if mejor.map_or(true, |m| t < m.t) {
                        mejor = Some(Impacto { id: c.id, duenio: c.duenio, etiqueta: c.etiqueta, t });
                    }
                }
            }
            // Un impacto antes de salir de esta celda no puede ser superado por celdas más lejanas.
            mejor.map_or(true, |m| m.t > t_salida)
        });
        self.marca = marca;
        mejor
    }

    /// Todos los impactos ordenados por distancia (penetración). Reutiliza `salida`.
    pub fn lanzar_rayo_todos(&mut self, r: &Rayo, ignorar: u32, salida: &mut Vec<Impacto>) {
        salida.clear();
        if self.sucia {
            self.reconstruir();
        }
        let ep = self.nueva_epoca();
        let mut marca = std::mem::take(&mut self.marca);
        let cols = &self.colisionadores;
        self.recorrer(r, |ids, _| {
            for &i in ids {
                let i = i as usize;
                if marca[i] == ep {
                    continue;
                }
                marca[i] = ep;
                let c = &cols[i];
                if c.duenio == ignorar && ignorar != SIN_DUENIO {
                    continue;
                }
                if let Some(t) = rayo_forma(r, &c.forma) {
                    salida.push(Impacto { id: c.id, duenio: c.duenio, etiqueta: c.etiqueta, t });
                }
            }
            true
        });
        self.marca = marca;
        salida.sort_by(|a, b| a.t.total_cmp(&b.t));
    }

    /// Versión sin grilla (prueba todas las formas): referencia para medir la ganancia de la grilla.
    pub fn lanzar_rayo_lineal(&self, r: &Rayo, ignorar: u32) -> Option<Impacto> {
        let mut mejor: Option<Impacto> = None;
        for c in &self.colisionadores {
            if c.duenio == ignorar && ignorar != SIN_DUENIO {
                continue;
            }
            if let Some(t) = rayo_forma(r, &c.forma) {
                if mejor.map_or(true, |m| t < m.t) {
                    mejor = Some(Impacto { id: c.id, duenio: c.duenio, etiqueta: c.etiqueta, t });
                }
            }
        }
        mejor
    }
}
