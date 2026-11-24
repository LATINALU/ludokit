//! Balística de shooter (port de `disparos/balistica.ts`): probabilidad de penetrar una clase de blindaje y disparo
//! hitscan con PENETRACIÓN sobre una `Escena3D`. En un servidor de shooter estas funciones corren por cada bala de
//! cada jugador en cada tick (con rebobinado de lag): es el camino caliente número uno del género.

use crate::colision3d::{Escena3D, Impacto, Rayo, SIN_DUENIO};

/// Probabilidad de penetrar (misma fórmula que TypeScript): transición suave alrededor de clase×10, y la
/// durabilidad baja reduce la clase efectiva.
pub fn prob_penetrar(penetracion: f64, clase: f64, durabilidad: f64, durabilidad_max: f64) -> f64 {
    if durabilidad <= 0.0 {
        return 1.0;
    }
    let efectiva = clase * 10.0 * (0.5 + 0.5 * (durabilidad / durabilidad_max));
    (0.5 + 0.5 * (penetracion - efectiva) / 15.0).clamp(0.0, 1.0)
}

/// Pérdida de poder por material: `perdida(etiqueta)` devuelve poder perdido al atravesar esa superficie
/// (`f32::INFINITY` = impenetrable) o `None` si la etiqueta es de un personaje (zona de daño).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ImpactoBala {
    pub impacto: Impacto,
    /// Fracción de daño que llega (1 = completo) tras atravesar paredes.
    pub fraccion: f32,
}

/// Hitscan con penetración: recorre los impactos en orden; las superficies restan poder; cada personaje (dueño)
/// recibe un solo impacto; cada personaje atravesado resta `por_personaje`. Escribe en `salida` (reutilizable).
pub fn disparo_penetrante(
    escena: &mut Escena3D,
    rayo: &Rayo,
    tirador: u32,
    poder: f32,
    por_personaje: f32,
    perdida: impl Fn(u32) -> Option<f32>,
    tmp: &mut Vec<Impacto>,
    salida: &mut Vec<ImpactoBala>,
) {
    salida.clear();
    escena.lanzar_rayo_todos(rayo, tirador, tmp);
    let mut restante = poder;
    let mut ultimo_duenio = SIN_DUENIO;
    for h in tmp.iter() {
        match perdida(h.etiqueta) {
            Some(p) => {
                restante -= p;
                if restante <= 0.0 {
                    return;
                }
            }
            None => {
                if h.duenio == ultimo_duenio && h.duenio != SIN_DUENIO {
                    continue;
                }
                ultimo_duenio = h.duenio;
                salida.push(ImpactoBala { impacto: *h, fraccion: if poder > 0.0 { (restante / poder).max(0.2) } else { 1.0 } });
                restante -= por_personaje;
                if restante <= 0.0 {
                    return;
                }
            }
        }
    }
}
