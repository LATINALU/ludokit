//! Benchmark del núcleo Rust con las MISMAS cargas que `ejemplos/rendimiento.ts` (TypeScript), para medir por qué
//! conviene mover las rutas calientes a Rust. Correr en release:
//!     cargo run --release --example rendimiento
//! Imprime una línea JSON por prueba (milisegundos totales y por operación).

use ludokit::azar::Pcg32;
use ludokit::colision3d::*;
use ludokit::multitud::*;
use ludokit::niebla::*;
use std::time::Instant;

fn medir<T>(nombre: &str, ops: usize, f: impl FnOnce() -> T) -> T {
    let t = Instant::now();
    let r = f();
    let ms = t.elapsed().as_secs_f64() * 1000.0;
    println!("{{\"prueba\":\"{nombre}\",\"ms\":{ms:.2},\"us_por_op\":{:.4}}}", ms * 1000.0 / ops as f64);
    r
}

fn main() {
    let mut p = Pcg32::nuevo(7);
    let mut f = |a: f32, b: f32| a + p.f32() * (b - a);

    // 1) Disparos: 2 000 personajes (cápsulas) en 200×200 m y 20 000 rayos.
    let mut escena = Escena3D::nueva(4.0);
    for i in 0..2000u32 {
        let (x, z) = (f(-100.0, 100.0), f(-100.0, 100.0));
        escena.agregar(Colisionador { id: i, duenio: i, etiqueta: 1, forma: Forma::Capsula { a: V3::new(x, 0.3, z), b: V3::new(x, 1.5, z), radio: 0.35 } });
    }
    let rayos: Vec<Rayo> = (0..20_000)
        .map(|_| {
            let d = V3::new(f(-1.0, 1.0), f(-0.05, 0.05), f(-1.0, 1.0)).normalizar();
            Rayo { origen: V3::new(f(-100.0, 100.0), 1.2, f(-100.0, 100.0)), dir: d, largo: 150.0 }
        })
        .collect();
    let lineal = medir("rayos_lineal_20k_x_2000", rayos.len(), || rayos.iter().filter(|r| escena.lanzar_rayo_lineal(r, SIN_DUENIO).is_some()).count());
    escena.reconstruir();
    let grilla = medir("rayos_grilla_20k_x_2000", rayos.len(), || rayos.iter().filter(|r| escena.lanzar_rayo(r, SIN_DUENIO).is_some()).count());
    assert_eq!(lineal, grilla, "mismo resultado con y sin grilla");
    println!("{{\"impactos\":{grilla}}}");

    // 2) Campo de flujo 256×256 con paredes, 20 recálculos (el objetivo se mueve).
    let bloq: Vec<u8> = (0..256 * 256).map(|i| ((i % 256) % 16 == 8 && (i / 256) % 32 < 24) as u8).collect();
    let mut campo = CampoFlujo::nuevo(256, 256);
    medir("campo_flujo_256x256_x20", 20, || {
        for k in 0..20 {
            campo.calcular(&[(128 + k, 128)], |c, r| if bloq[(r * 256 + c) as usize] != 0 { f64::INFINITY } else { 1.0 }, f64::INFINITY);
        }
    });

    // 3) Horda: 5 000 agentes, 300 pasos (5 s a 60 Hz) siguiendo el campo con separación.
    let mut m = Multitud::nueva(ReglasMultitud { tile: 1.0, velocidad: 4.0, aceleracion: 20.0, radio: 0.6, separacion: 2.0 });
    for _ in 0..5000 {
        m.agregar(f(1.0, 255.0), f(1.0, 255.0));
    }
    medir("horda_5000_x300_pasos", 300, || {
        for _ in 0..300 {
            m.paso(1.0 / 60.0, &campo, |c, r| c < 0 || r < 0 || c >= 256 || r >= 256 || bloq[(r * 256 + c) as usize] != 0);
        }
    });

    // 3b) La misma carga en paralelo (determinista: mismo resultado que el secuencial) y una horda 10× más grande.
    let hilos = std::thread::available_parallelism().map_or(4, |n| n.get());
    let bloqueo = |c: i32, r: i32| c < 0 || r < 0 || c >= 256 || r >= 256 || bloq[(r * 256 + c) as usize] != 0;
    let mut q = Pcg32::nuevo(99);
    let mut m2 = Multitud::nueva(m.reglas);
    for _ in 0..5000 {
        m2.agregar(1.0 + q.f32() * 254.0, 1.0 + q.f32() * 254.0);
    }
    medir(&format!("horda_5000_x300_pasos_{hilos}_hilos"), 300, || {
        for _ in 0..300 {
            m2.paso_paralelo(1.0 / 60.0, &campo, bloqueo, hilos);
        }
    });
    let mut grande = Multitud::nueva(m.reglas);
    for _ in 0..50_000 {
        grande.agregar(1.0 + q.f32() * 254.0, 1.0 + q.f32() * 254.0);
    }
    let mut grande_sec = Multitud::nueva(m.reglas);
    grande_sec.x = grande.x.clone();
    grande_sec.y = grande.y.clone();
    grande_sec.vx = grande.vx.clone();
    grande_sec.vy = grande.vy.clone();
    medir("horda_50000_x60_pasos_1_hilo", 60, || {
        for _ in 0..60 {
            grande_sec.paso(1.0 / 60.0, &campo, bloqueo);
        }
    });
    medir(&format!("horda_50000_x60_pasos_{hilos}_hilos"), 60, || {
        for _ in 0..60 {
            grande.paso_paralelo(1.0 / 60.0, &campo, bloqueo, hilos);
        }
    });
    assert_eq!(grande.x, grande_sec.x, "paralelo y secuencial dan exactamente lo mismo");

    // 4) Niebla de guerra 256×256, 100 fuentes de radio 10, 30 actualizaciones.
    let mut n = NieblaGuerra::nueva(256, 256, bloq.clone());
    let fuentes: Vec<FuenteVision> = (0..100).map(|_| FuenteVision { x: f(0.0, 256.0), y: f(0.0, 256.0), radio: 10.0, ignora_bloqueo: false }).collect();
    medir("niebla_256x256_100fuentes_x30", 30, || {
        for _ in 0..30 {
            n.actualizar(&fuentes);
        }
    });
}
