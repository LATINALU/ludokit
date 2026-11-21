//! Hash espacial uniforme (broadphase) para consultas "¿quién está cerca?" en O(vecindario).
//! Pensado para un servidor: ids `u32`, sin asignaciones en las consultas (usa un búfer de salida).

use std::collections::HashMap;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Caja {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Caja {
    pub fn toca(&self, o: &Caja) -> bool {
        self.x <= o.x + o.w && o.x <= self.x + self.w && self.y <= o.y + o.h && o.y <= self.y + self.h
    }
}

pub struct HashEspacial {
    celda: f32,
    celdas: HashMap<(i32, i32), Vec<u32>>,
    cajas: HashMap<u32, Caja>,
}

impl HashEspacial {
    pub fn nuevo(celda: f32) -> Self {
        HashEspacial { celda, celdas: HashMap::new(), cajas: HashMap::new() }
    }

    fn rango(&self, c: &Caja) -> (i32, i32, i32, i32) {
        let s = self.celda;
        ((c.x / s).floor() as i32, (c.y / s).floor() as i32, ((c.x + c.w) / s).floor() as i32, ((c.y + c.h) / s).floor() as i32)
    }

    pub fn insertar(&mut self, id: u32, c: Caja) {
        self.quitar(id);
        let (x0, y0, x1, y1) = self.rango(&c);
        for cy in y0..=y1 {
            for cx in x0..=x1 {
                self.celdas.entry((cx, cy)).or_default().push(id);
            }
        }
        self.cajas.insert(id, c);
    }

    pub fn quitar(&mut self, id: u32) {
        if let Some(c) = self.cajas.remove(&id) {
            let (x0, y0, x1, y1) = self.rango(&c);
            for cy in y0..=y1 {
                for cx in x0..=x1 {
                    if let Some(v) = self.celdas.get_mut(&(cx, cy)) {
                        v.retain(|&o| o != id);
                        if v.is_empty() {
                            self.celdas.remove(&(cx, cy));
                        }
                    }
                }
            }
        }
    }

    /// Ids cuyas cajas tocan la región, sin duplicados, en `salida` (se vacía antes).
    pub fn consultar(&self, region: Caja, salida: &mut Vec<u32>) {
        salida.clear();
        let (x0, y0, x1, y1) = self.rango(&region);
        for cy in y0..=y1 {
            for cx in x0..=x1 {
                if let Some(v) = self.celdas.get(&(cx, cy)) {
                    for &id in v {
                        if !salida.contains(&id) && self.cajas[&id].toca(&region) {
                            salida.push(id);
                        }
                    }
                }
            }
        }
    }

    pub fn len(&self) -> usize {
        self.cajas.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cajas.is_empty()
    }
}
