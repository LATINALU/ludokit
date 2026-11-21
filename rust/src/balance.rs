//! Daño con defensa de rendimiento decreciente, modelo de PODER ESPERADO (enemigos y jefes derivados de
//! "golpes para matar / golpes para morir") y pesos de rareza por nivel. Port de los contextos balance, combate
//! y botín de TypeScript, con sus mismos valores por defecto.

pub fn mitigacion(defensa: f64, k: f64) -> f64 {
    k / (k + defensa.max(0.0))
}

#[derive(Clone, Copy, Debug)]
pub struct Poder {
    pub golpe: f64,
    pub vida: f64,
    pub defensa: f64,
    pub resistencia: f64,
}

pub fn poder_esperado(nivel: f64) -> Poder {
    let p = nivel.max(1.0);
    let q = p.min(24.0);
    let hondo = if p > 24.0 { (p / 24.0).powf(0.8) } else { 1.0 };
    Poder {
        golpe: 30.0 * q.powf(0.93) * hondo,
        vida: 115.0 * q.powf(0.78) * hondo,
        defensa: 12.0 * q.powf(0.92) * if p > 24.0 { p / 24.0 } else { 1.0 },
        resistencia: (0.005 * p).min(0.12),
    }
}

pub fn k_jugador(nivel: f64) -> f64 {
    (1.5 * poder_esperado(nivel).defensa).max(30.0)
}

pub fn pasa_al_jugador(nivel: f64) -> f64 {
    let pe = poder_esperado(nivel);
    mitigacion(pe.defensa, k_jugador(nivel)) * (1.0 - pe.resistencia)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StatsEnemigo {
    pub vida: f64,
    pub ataque: f64,
    pub defensa: f64,
    pub exp: f64,
}

/// Redondeo como `Math.round` de JavaScript (mitades hacia +∞), para coincidir con la referencia.
fn round_js(x: f64) -> f64 {
    (x + 0.5).floor()
}

pub fn enemigo_esperado(nivel: f64) -> StatsEnemigo {
    let p = (nivel - 1.0).max(0.0);
    let pe = poder_esperado(nivel);
    let defensa = 1.0 + 0.45 * p;
    let golpe_contra = pe.golpe * mitigacion(defensa, 60.0);
    StatsEnemigo {
        vida: round_js(6.0 * golpe_contra),
        ataque: round_js(pe.vida / (11.0 * pasa_al_jugador(nivel))),
        defensa: round_js(defensa),
        exp: round_js(1.0 + 0.8 * p),
    }
}

pub fn jefe_esperado(nivel: f64) -> (StatsEnemigo, f64) {
    let p = nivel.max(1.0);
    let pe = poder_esperado(p);
    let defensa = 6.0 * (1.0 + 0.3 * (p - 1.0));
    let duracion = 48.0 + 1.8 * p;
    let aguante = (7.0 - (p - 1.0) / 6.0).max(5.5);
    let mult_vida = 1.6 * 1.2 * 2.0;
    (
        StatsEnemigo {
            vida: round_js(pe.golpe * mitigacion(defensa, 60.0) * 2.0 * duracion * mult_vida / 2.0),
            ataque: round_js(pe.vida / (aguante * 1.1 * pasa_al_jugador(p))),
            defensa: round_js(defensa),
            exp: round_js(120.0 * (1.0 + 0.9 * (p - 1.0))),
        },
        duracion,
    )
}

pub const RAREZA_PRIMERO: [f64; 6] = [64.0, 28.0, 7.4, 0.5, 0.06, 0.04];
pub const RAREZA_ULTIMO: [f64; 6] = [26.0, 36.0, 27.0, 10.0, 1.2, 0.12];
pub const RAREZA_FACTOR: [f64; 6] = [1.0, 1.0, 0.8, 0.5, 0.4, 0.5];

pub fn pesos_rareza(nivel: f64, niveles: f64, exponente: f64) -> [f64; 6] {
    let k = ((nivel - 1.0) / (niveles - 1.0).max(1.0)).clamp(0.0, 1.0).powf(exponente);
    let mut r = [0.0; 6];
    for i in 0..6 {
        r[i] = (RAREZA_PRIMERO[i] + (RAREZA_ULTIMO[i] - RAREZA_PRIMERO[i]) * k) * RAREZA_FACTOR[i];
    }
    r
}
