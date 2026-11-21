//! Hash entero y ruido de valor 2D deterministas (mismos valores que `mundo/dominio/ruido.ts`).

pub fn hash2(x: i32, y: i32, semilla: i32) -> f64 {
    let mut h = (x as u32).wrapping_mul(374761393).wrapping_add((y as u32).wrapping_mul(668265263)).wrapping_add((semilla as u32).wrapping_mul(2147483647));
    h = (h ^ (h >> 13)).wrapping_mul(1274126177);
    (h ^ (h >> 16)) as f64 / 4294967296.0
}

fn suave(t: f64) -> f64 {
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}

pub fn ruido_valor(x: f64, y: f64, semilla: i32) -> f64 {
    let (xi, yi) = (x.floor() as i32, y.floor() as i32);
    let (tx, ty) = (suave(x - xi as f64), suave(y - yi as f64));
    let m = |a: f64, b: f64, t: f64| a + (b - a) * t;
    m(m(hash2(xi, yi, semilla), hash2(xi + 1, yi, semilla), tx), m(hash2(xi, yi + 1, semilla), hash2(xi + 1, yi + 1, semilla), tx), ty)
}

pub fn fbm(x: f64, y: f64, semilla: i32, octavas: u32) -> f64 {
    let (mut s, mut amp, mut frec, mut norm) = (0.0, 1.0, 1.0, 0.0);
    for i in 0..octavas {
        s += ruido_valor(x * frec, y * frec, semilla + i as i32 * 101) * amp;
        norm += amp;
        amp *= 0.5;
        frec *= 2.0;
    }
    s / norm
}
