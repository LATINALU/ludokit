//! Verifica los módulos de alto rendimiento contra la referencia TypeScript (vectores compartidos) y entre sí
//! (grilla contra búsqueda lineal), más la ABI C.
use ludokit::{balistica::*, colision3d::*, ffi::*, multitud::*, niebla::*};
use serde_json::Value;

fn vectores() -> Value {
    serde_json::from_str(include_str!("../../vectores/vectores.json")).expect("vectores.json")
}

fn v3(v: &Value) -> V3 {
    V3::new(v["x"].as_f64().unwrap() as f32, v["y"].as_f64().unwrap() as f32, v["z"].as_f64().unwrap() as f32)
}

fn escena(v: &Value) -> (Escena3D, Vec<Rayo>) {
    let mut e = Escena3D::nueva(4.0);
    for f in v["escena3d"]["formas"].as_array().unwrap() {
        let g = &f["forma"];
        let forma = match g["tipo"].as_str().unwrap() {
            "esfera" => Forma::Esfera { centro: v3(&g["centro"]), radio: g["radio"].as_f64().unwrap() as f32 },
            "caja" => Forma::Caja { min: v3(&g["min"]), max: v3(&g["max"]) },
            _ => Forma::Capsula { a: v3(&g["a"]), b: v3(&g["b"]), radio: g["radio"].as_f64().unwrap() as f32 },
        };
        e.agregar(Colisionador { id: f["id"].as_u64().unwrap() as u32, duenio: f["duenio"].as_u64().unwrap() as u32, etiqueta: f["etiqueta"].as_u64().unwrap() as u32, forma });
    }
    let rayos = v["escena3d"]["rayos"].as_array().unwrap().iter().map(|r| Rayo { origen: v3(&r["origen"]), dir: v3(&r["dir"]), largo: r["largo"].as_f64().unwrap() as f32 }).collect();
    (e, rayos)
}

#[test]
fn rayos_3d_identicos_a_typescript() {
    let v = vectores();
    let (mut e, rayos) = escena(&v);
    for (r, esperado) in rayos.iter().zip(v["escena3d"]["impactos"].as_array().unwrap()) {
        let h = e.lanzar_rayo(r, SIN_DUENIO);
        let l = e.lanzar_rayo_lineal(r, SIN_DUENIO);
        assert_eq!(h.map(|x| x.id), l.map(|x| x.id), "la grilla y la búsqueda lineal coinciden");
        match (h, esperado.is_null()) {
            (None, true) => {}
            (Some(h), false) => {
                assert_eq!(h.id as u64, esperado["id"].as_u64().unwrap());
                let t = esperado["t"].as_f64().unwrap() as f32;
                assert!((h.t - t).abs() <= 1e-3 * t.max(1.0), "t {} != {}", h.t, t);
            }
            (h, _) => panic!("diferencia: rust {:?} vs ts {}", h, esperado),
        }
    }
}

#[test]
fn rayos_todos_ordenados_y_penetracion() {
    let mut e = Escena3D::nueva(2.0);
    e.agregar(Colisionador { id: 1, duenio: SIN_DUENIO, etiqueta: 100, forma: Forma::Caja { min: V3::new(-2.0, 0.0, 5.0), max: V3::new(2.0, 3.0, 5.1) } });
    e.agregar(Colisionador { id: 2, duenio: 7, etiqueta: 1, forma: Forma::Esfera { centro: V3::new(0.0, 1.0, 10.0), radio: 0.3 } });
    e.agregar(Colisionador { id: 3, duenio: 7, etiqueta: 2, forma: Forma::Capsula { a: V3::new(0.0, 0.2, 10.0), b: V3::new(0.0, 1.2, 10.0), radio: 0.3 } });
    e.agregar(Colisionador { id: 4, duenio: 8, etiqueta: 2, forma: Forma::Esfera { centro: V3::new(0.0, 1.0, 20.0), radio: 0.5 } });
    let r = Rayo { origen: V3::new(0.0, 1.0, 0.0), dir: V3::new(0.0, 0.0, 1.0), largo: 100.0 };
    let mut todos = vec![];
    e.lanzar_rayo_todos(&r, SIN_DUENIO, &mut todos);
    assert!(todos.windows(2).all(|w| w[0].t <= w[1].t));
    assert_eq!(todos.len(), 4);
    let (mut tmp, mut salida) = (vec![], vec![]);
    disparo_penetrante(&mut e, &r, SIN_DUENIO, 40.0, 30.0, |et| if et >= 100 { Some(12.0) } else { None }, &mut tmp, &mut salida);
    assert_eq!(salida.len(), 1, "la pared y el primer personaje gastan el poder");
    assert_eq!(salida[0].impacto.duenio, 7);
    assert!((salida[0].fraccion - 0.7).abs() < 1e-6);
    assert!(prob_penetrar(15.0, 5.0, 60.0, 60.0) < 0.01 && prob_penetrar(110.0, 5.0, 60.0, 60.0) > 0.99);
}

#[test]
fn campo_de_flujo_identico_a_typescript() {
    let v = vectores();
    let cf = &v["campo_flujo"];
    let mapa: Vec<Vec<char>> = cf["mapa"].as_array().unwrap().iter().map(|f| f.as_str().unwrap().chars().collect()).collect();
    let mut c = CampoFlujo::nuevo(20, 12);
    c.calcular(&[(17, 10)], |x, y| if mapa[y as usize][x as usize] == '#' { f64::INFINITY } else { 1.0 }, f64::INFINITY);
    for (a, b) in c.distancia.iter().zip(cf["distancia"].as_array().unwrap()) {
        let b = b.as_f64().unwrap();
        if b < 0.0 {
            assert!(a.is_infinite());
        } else {
            assert!((*a as f64 - b).abs() < 1e-3, "{a} != {b}");
        }
    }
}

#[test]
fn niebla_identica_a_typescript() {
    let v = vectores();
    let mapa: Vec<u8> = v["campo_flujo"]["mapa"].as_array().unwrap().iter().flat_map(|f| f.as_str().unwrap().bytes().map(|b| (b == b'#') as u8).collect::<Vec<_>>()).collect();
    let mut n = NieblaGuerra::nueva(20, 12, mapa);
    let fuentes = |k: &str| v["niebla"][k].as_array().unwrap().iter().map(|f| FuenteVision { x: f[0].as_f64().unwrap() as f32, y: f[1].as_f64().unwrap() as f32, radio: f[2].as_f64().unwrap() as f32, ignora_bloqueo: false }).collect::<Vec<_>>();
    n.actualizar(&fuentes("fuentes1"));
    n.actualizar(&fuentes("fuentes2"));
    let esperado: Vec<u8> = v["niebla"]["estados"].as_array().unwrap().iter().map(|x| x.as_u64().unwrap() as u8).collect();
    assert_eq!(n.celdas, esperado);
}

fn simular_multitud(separacion: f32) -> (usize, f32) {
    let mut c = CampoFlujo::nuevo(40, 40);
    c.calcular(&[(20, 20)], |_, _| 1.0, f64::INFINITY);
    let mut m = Multitud::nueva(ReglasMultitud { tile: 1.0, velocidad: 4.0, aceleracion: 20.0, radio: 0.6, separacion });
    for i in 0..200 {
        m.agregar(2.0 + (i % 20) as f32 * 0.3, 2.0 + (i / 20) as f32 * 0.3);
    }
    for _ in 0..600 {
        m.paso(1.0 / 60.0, &c, |x, y| x < 0 || y < 0 || x >= 40 || y >= 40);
    }
    let cerca = (0..m.len()).filter(|&i| (m.x[i] - 20.5).hypot(m.y[i] - 20.5) < 6.0).count();
    // Distancia media al vecino más cercano.
    let mut suma = 0.0;
    for i in 0..m.len() {
        let mut min = f32::INFINITY;
        for j in 0..m.len() {
            if i != j {
                min = min.min((m.x[i] - m.x[j]).hypot(m.y[i] - m.y[j]));
            }
        }
        suma += min;
    }
    (cerca, suma / m.len() as f32)
}

#[test]
fn multitud_llega_al_objetivo_sin_amontonarse() {
    let (cerca, con) = simular_multitud(2.0);
    let (_, sin) = simular_multitud(0.0);
    assert!(cerca > 150, "{cerca} de 200 llegaron");
    assert!(con > sin * 3.0, "la separación abre espacio entre agentes: {con} con vs {sin} sin");
}

#[test]
fn multitud_paralela_identica_a_secuencial() {
    let mut c = CampoFlujo::nuevo(64, 64);
    c.calcular(&[(50, 40)], |x, _| if x == 30 { f64::INFINITY } else { 1.0 }, f64::INFINITY);
    let reglas = ReglasMultitud { tile: 1.0, velocidad: 4.0, aceleracion: 20.0, radio: 0.6, separacion: 2.0 };
    let (mut a, mut b) = (Multitud::nueva(reglas), Multitud::nueva(reglas));
    // Más que MIN_POR_HILO × 2 para que de verdad use varios hilos.
    for i in 0..10_000 {
        let (x, y) = (1.0 + (i % 100) as f32 * 0.6, 1.0 + (i / 100) as f32 * 0.6);
        a.agregar(x, y);
        b.agregar(x, y);
    }
    let bloq = |x: i32, y: i32| x < 0 || y < 0 || x >= 64 || y >= 64;
    for _ in 0..120 {
        a.paso(1.0 / 60.0, &c, bloq);
        b.paso_paralelo(1.0 / 60.0, &c, bloq, 4);
    }
    assert_eq!(a.x, b.x);
    assert_eq!(a.y, b.y);
}

#[test]
fn abi_c() {
    unsafe {
        assert_eq!(ludo_version_abi(), 1);
        let e = ludo_escena_nueva(4.0);
        ludo_escena_capsula(e, 1, 9, 2, 0.0, 0.0, 10.0, 0.0, 1.8, 10.0, 0.4);
        let rayos = [0.0f32, 1.0, 0.0, 0.0, 0.0, 1.0, 50.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 50.0];
        let mut out = [LudoImpacto::default(); 2];
        assert_eq!(ludo_escena_rayos(e, rayos.as_ptr(), std::ptr::null(), 2, out.as_mut_ptr()), 1);
        assert_eq!(out[0].duenio, 9);
        assert!(out[1].t < 0.0);
        ludo_escena_mover(e, 9, 5.0, 0.0, 0.0);
        assert_eq!(ludo_escena_rayos(e, rayos.as_ptr(), std::ptr::null(), 1, out.as_mut_ptr()), 0, "se movió");
        ludo_escena_liberar(e);
        assert!(ludo_escena_rayos(std::ptr::null_mut(), rayos.as_ptr(), std::ptr::null(), 1, out.as_mut_ptr()) == 0, "nulo no explota");

        let h = ludo_horda_nueva(32, 32, std::ptr::null(), 1.0, 3.0, 15.0, 0.6, 1.5);
        for i in 0..50 {
            ludo_horda_agregar(h, 2.0 + i as f32 * 0.1, 2.0);
        }
        ludo_horda_objetivo(h, 30, 30);
        for _ in 0..120 {
            ludo_horda_paso(h, 1.0 / 60.0);
        }
        let mut pos = vec![0.0f32; 100];
        assert_eq!(ludo_horda_posiciones(h, pos.as_mut_ptr(), 50), 50);
        assert!(pos[0] > 2.5 && pos[1] > 2.5, "avanzaron hacia el objetivo");
        ludo_horda_liberar(h);
    }
}
