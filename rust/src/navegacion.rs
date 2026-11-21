//! A* sobre grilla (4 u 8 direcciones, sin cortar esquinas) con `BinaryHeap`. Port de `navegacion/astar.ts`.

use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Copy, Clone, PartialEq)]
struct Nodo {
    f: f64,
    i: usize,
}
impl Eq for Nodo {}
impl Ord for Nodo {
    fn cmp(&self, o: &Self) -> Ordering {
        o.f.partial_cmp(&self.f).unwrap_or(Ordering::Equal).then_with(|| o.i.cmp(&self.i))
    }
}
impl PartialOrd for Nodo {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}

/// `costo(c, f)`: costo de entrar; `f64::INFINITY` o <= 0 = bloqueada. Devuelve el camino [inicio..meta].
pub fn a_estrella(cols: i32, filas: i32, costo: impl Fn(i32, i32) -> f64, inicio: (i32, i32), meta: (i32, i32), diagonal: bool) -> Option<Vec<(i32, i32)>> {
    let libre = |c: i32, f: i32| c >= 0 && f >= 0 && c < cols && f < filas && { let k = costo(c, f); k > 0.0 && k.is_finite() };
    let idx = |c: i32, f: i32| (f * cols + c) as usize;
    let h = |c: i32, f: i32| {
        let (dx, dy) = ((c - meta.0).abs() as f64, (f - meta.1).abs() as f64);
        if diagonal { dx + dy + (std::f64::consts::SQRT_2 - 2.0) * dx.min(dy) } else { dx + dy }
    };
    let n = (cols * filas) as usize;
    let mut g = vec![f64::INFINITY; n];
    let mut vino = vec![usize::MAX; n];
    let mut cerrado = vec![false; n];
    let mut abiertos = BinaryHeap::new();
    let i0 = idx(inicio.0, inicio.1);
    g[i0] = 0.0;
    abiertos.push(Nodo { f: h(inicio.0, inicio.1), i: i0 });
    let im = idx(meta.0, meta.1);
    while let Some(Nodo { i, .. }) = abiertos.pop() {
        if i == im {
            let mut camino = vec![];
            let mut k = i;
            while k != usize::MAX {
                camino.push(((k as i32) % cols, (k as i32) / cols));
                k = vino[k];
            }
            camino.reverse();
            return Some(camino);
        }
        if cerrado[i] {
            continue;
        }
        cerrado[i] = true;
        let (c, f) = ((i as i32) % cols, (i as i32) / cols);
        let mut vec: Vec<(i32, i32, f64)> = vec![];
        for (dc, df) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            if libre(c + dc, f + df) {
                vec.push((c + dc, f + df, costo(c + dc, f + df)));
            }
        }
        if diagonal {
            for (dc, df) in [(1, 1), (1, -1), (-1, 1), (-1, -1)] {
                if libre(c + dc, f + df) && libre(c + dc, f) && libre(c, f + df) {
                    vec.push((c + dc, f + df, costo(c + dc, f + df) * std::f64::consts::SQRT_2));
                }
            }
        }
        for (nc, nf, w) in vec {
            let j = idx(nc, nf);
            let nuevo = g[i] + w;
            if !cerrado[j] && nuevo < g[j] {
                g[j] = nuevo;
                vino[j] = i;
                abiertos.push(Nodo { f: nuevo + h(nc, nf), i: j });
            }
        }
    }
    None
}
