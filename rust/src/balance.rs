//! Curvas de escalado (`Curva`), daño con defensa de rendimiento decreciente, modelo de PODER ESPERADO (enemigos y
//! jefes derivados de "golpes para matar / golpes para morir") y pesos de rareza por nivel. Port de
//! `nucleo/escalado.ts`, `balance` y `botin` de TypeScript. No trae números de ningún juego: el modelo se construye
//! con curvas (normalmente leídas de los datos del juego) y acepta cualquier nivel ≥ 1.

/// Curva de escalado: mismo significado que en TypeScript (`x` = nivel, 1 = el primero).
#[derive(Clone, Debug, PartialEq)]
pub enum Curva {
    Constante(f64),
    /// base + por_nivel·(x − 1)
    Lineal { base: f64, por_nivel: f64 },
    /// base·x^exp
    Potencia { base: f64, exp: f64 },
    /// base·razon^(x − 1)
    Exponencial { base: f64, razon: f64 },
    /// Progreso 0..1 sin tope: d^e / (d^e + mitad^e), d = x − 1
    Saturacion { mitad: f64, exp: f64 },
    Logistica { centro: f64, pendiente: f64 },
    Tramos { puntos: Vec<(f64, f64)>, extrapolar_lineal: bool },
    Escalones { puntos: Vec<(f64, f64)>, inicial: f64 },
    TopeSuave { curva: Box<Curva>, desde: f64, exp: f64 },
    Limitar { curva: Box<Curva>, min: f64, max: f64 },
    Producto(Vec<Curva>),
    Suma(Vec<Curva>),
    Desplazar { curva: Box<Curva>, desplazar: f64 },
    Escalar { curva: Box<Curva>, valor: f64 },
}

fn pendiente(a: (f64, f64), b: (f64, f64), x: f64) -> f64 {
    let dx = b.0 - a.0;
    if dx == 0.0 { b.1 } else { a.1 + (b.1 - a.1) * (x - a.0) / dx }
}

impl Curva {
    pub fn evaluar(&self, x: f64) -> f64 {
        match self {
            Curva::Constante(v) => *v,
            Curva::Lineal { base, por_nivel } => base + por_nivel * (x - 1.0),
            Curva::Potencia { base, exp } => base * x.max(0.0).powf(*exp),
            Curva::Exponencial { base, razon } => base * razon.powf(x - 1.0),
            Curva::Saturacion { mitad, exp } => {
                let d = (x - 1.0).max(0.0).powf(*exp);
                d / (d + mitad.max(1e-9).powf(*exp))
            }
            Curva::Logistica { centro, pendiente } => {
                let f = |v: f64| 1.0 / (1.0 + (-pendiente * (v - centro)).exp());
                ((f(x) - f(1.0)) / (1.0 - f(1.0))).max(0.0)
            }
            Curva::Tramos { puntos: p, extrapolar_lineal } => {
                if p.is_empty() {
                    return 0.0;
                }
                if p.len() == 1 {
                    return p[0].1;
                }
                if x <= p[0].0 {
                    return if *extrapolar_lineal { pendiente(p[0], p[1], x) } else { p[0].1 };
                }
                for i in 1..p.len() {
                    if x <= p[i].0 {
                        return pendiente(p[i - 1], p[i], x);
                    }
                }
                let n = p.len() - 1;
                if *extrapolar_lineal { pendiente(p[n - 1], p[n], x) } else { p[n].1 }
            }
            Curva::Escalones { puntos, inicial } => puntos.iter().fold(*inicial, |v, (desde, valor)| if x >= *desde { *valor } else { v }),
            Curva::TopeSuave { curva, desde, exp } => {
                if x <= *desde { curva.evaluar(x) } else { curva.evaluar(*desde) * (x / desde).powf(*exp) }
            }
            Curva::Limitar { curva, min, max } => curva.evaluar(x).max(*min).min(*max),
            Curva::Producto(cs) => cs.iter().map(|c| c.evaluar(x)).product(),
            Curva::Suma(cs) => cs.iter().map(|c| c.evaluar(x)).sum(),
            Curva::Desplazar { curva, desplazar } => curva.evaluar(x + desplazar),
            Curva::Escalar { curva, valor } => valor * curva.evaluar(x),
        }
    }
}

pub fn mitigacion(defensa: f64, k: f64) -> f64 {
    k / (k + defensa.max(0.0))
}

/// Redondeo como `Math.round` de JavaScript (mitades hacia +∞), para coincidir con la referencia.
fn round_js(x: f64) -> f64 {
    (x + 0.5).floor()
}

#[derive(Clone, Copy, Debug)]
pub struct Poder {
    pub golpe: f64,
    pub vida: f64,
    pub defensa: f64,
    pub resistencia: f64,
}

#[derive(Clone, Debug)]
pub struct CurvaPoder {
    pub golpe: Curva,
    pub vida: Curva,
    pub defensa: Curva,
    pub resistencia: Curva,
}

#[derive(Clone, Debug)]
pub struct ReglasBalance {
    pub golpes_para_matar: f64,
    pub golpes_para_morir: f64,
    pub k_enemigo: f64,
    pub k_jugador_factor: f64,
    pub k_jugador_min: f64,
    pub defensa_enemigo: Curva,
    pub exp_enemigo: Curva,
    pub ritmo_jugador: f64,
    pub duracion_jefe: Curva,
    pub aguante_jefe: Curva,
    pub defensa_jefe: Curva,
    pub exp_jefe: Curva,
    pub mult_vida_jefe: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StatsEnemigo {
    pub vida: f64,
    pub ataque: f64,
    pub defensa: f64,
    pub exp: f64,
}

/// Modelo de balance: curva del jugador + reglas de derivación (port de `balance.ModeloBalance`).
#[derive(Clone, Debug)]
pub struct ModeloBalance {
    pub curva: CurvaPoder,
    pub reglas: ReglasBalance,
}

impl ModeloBalance {
    pub fn poder(&self, nivel: f64) -> Poder {
        let p = nivel.max(1.0);
        Poder {
            golpe: self.curva.golpe.evaluar(p),
            vida: self.curva.vida.evaluar(p),
            defensa: self.curva.defensa.evaluar(p),
            resistencia: self.curva.resistencia.evaluar(p).clamp(0.0, 0.95),
        }
    }

    pub fn k_jugador(&self, nivel: f64) -> f64 {
        (self.reglas.k_jugador_factor * self.poder(nivel).defensa).max(self.reglas.k_jugador_min)
    }

    pub fn pasa_al_jugador(&self, nivel: f64) -> f64 {
        let pe = self.poder(nivel);
        mitigacion(pe.defensa, self.k_jugador(nivel)) * (1.0 - pe.resistencia)
    }

    pub fn enemigo(&self, nivel: f64, peso_vida: f64, peso_ataque: f64) -> StatsEnemigo {
        let r = &self.reglas;
        let n = nivel.max(1.0);
        let pe = self.poder(n);
        let defensa = r.defensa_enemigo.evaluar(n);
        StatsEnemigo {
            vida: round_js(r.golpes_para_matar * pe.golpe * mitigacion(defensa, r.k_enemigo) * peso_vida),
            ataque: round_js(pe.vida / (r.golpes_para_morir * self.pasa_al_jugador(n)) * peso_ataque),
            defensa: round_js(defensa),
            exp: round_js(r.exp_enemigo.evaluar(n)),
        }
    }

    /// Jefe y duración objetivo de la pelea (s).
    pub fn jefe(&self, nivel: f64, peso: f64) -> (StatsEnemigo, f64) {
        let r = &self.reglas;
        let n = nivel.max(1.0);
        let pe = self.poder(n);
        let defensa = r.defensa_jefe.evaluar(n);
        let duracion = r.duracion_jefe.evaluar(n);
        let aguante = r.aguante_jefe.evaluar(n).max(1.0);
        (
            StatsEnemigo {
                vida: round_js(pe.golpe * mitigacion(defensa, r.k_enemigo) * r.ritmo_jugador * duracion * peso * r.mult_vida_jefe),
                ataque: round_js(pe.vida / (aguante * self.pasa_al_jugador(n))),
                defensa: round_js(defensa),
                exp: round_js(r.exp_jefe.evaluar(n)),
            },
            duracion,
        )
    }
}

/// Tabla de rareza por nivel sin tope: mezcla `primero` → `ultimo` con una curva de progreso 0..1.
#[derive(Clone, Debug)]
pub struct TablaRareza {
    pub primero: Vec<f64>,
    pub ultimo: Vec<f64>,
    pub progreso: Curva,
    pub factor: Option<Vec<f64>>,
}

pub fn pesos_rareza(t: &TablaRareza, nivel: f64) -> Vec<f64> {
    let k = t.progreso.evaluar(nivel.max(1.0)).clamp(0.0, 1.0);
    t.primero
        .iter()
        .zip(&t.ultimo)
        .enumerate()
        .map(|(i, (a, b))| (a + (b - a) * k) * t.factor.as_ref().map_or(1.0, |f| f[i]))
        .collect()
}
