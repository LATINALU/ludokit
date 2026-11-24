//! Verifica el port de Rust contra los vectores compartidos generados por la referencia TypeScript.
use ludokit::{azar::*, balance::*, espacial::*, fisica::*, navegacion::*, ruido::*, verlet::*};
use serde_json::Value;

fn vectores() -> Value {
    serde_json::from_str(include_str!("../../vectores/vectores.json")).expect("vectores.json")
}

fn cerca(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol * b.abs().max(1.0)
}

#[test]
fn pcg32_identico() {
    let v = vectores();
    let semillas = v["pcg32"]["semillas"].as_array().unwrap();
    for (i, s) in semillas.iter().enumerate() {
        let mut p = Pcg32::nuevo(s.as_u64().unwrap());
        for esperado in v["pcg32"]["salidas"][i].as_array().unwrap() {
            assert_eq!(p.u32() as u64, esperado.as_u64().unwrap());
        }
    }
    let d = &v["pcg32_derivar"];
    assert_eq!(derivar_semilla(d["semilla"].as_u64().unwrap(), d["n"].as_u64().unwrap()).to_string(), d["resultado"].as_str().unwrap());
}

#[test]
fn mulberry32_identico() {
    let v = vectores();
    for (i, s) in v["mulberry32"]["semillas"].as_array().unwrap().iter().enumerate() {
        let mut m = Mulberry32::nuevo(s.as_u64().unwrap() as u32);
        for e in v["mulberry32"]["salidas"][i].as_array().unwrap() {
            assert!(cerca(m.siguiente(), e.as_f64().unwrap(), 1e-5));
        }
    }
}

/// Convierte una curva JSON (formato de `nucleo/escalado.ts`) en `Curva`.
fn curva(v: &Value) -> Curva {
    let f = |k: &str| v[k].as_f64().unwrap();
    let pares = |k: &str| v[k].as_array().unwrap().iter().map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap())).collect::<Vec<_>>();
    let sub = |k: &str| Box::new(curva(&v[k]));
    let lista = || v["curvas"].as_array().unwrap().iter().map(curva).collect::<Vec<_>>();
    match v["tipo"].as_str().unwrap() {
        "constante" => Curva::Constante(f("valor")),
        "lineal" => Curva::Lineal { base: f("base"), por_nivel: f("porNivel") },
        "potencia" => Curva::Potencia { base: f("base"), exp: f("exp") },
        "exponencial" => Curva::Exponencial { base: f("base"), razon: f("razon") },
        "saturacion" => Curva::Saturacion { mitad: f("mitad"), exp: v["exp"].as_f64().unwrap_or(1.0) },
        "logistica" => Curva::Logistica { centro: f("centro"), pendiente: f("pendiente") },
        "tramos" => Curva::Tramos { puntos: pares("puntos"), extrapolar_lineal: v["extrapolar"].as_str() == Some("lineal") },
        "escalones" => Curva::Escalones { puntos: pares("puntos"), inicial: v["inicial"].as_f64().unwrap_or(0.0) },
        "topeSuave" => Curva::TopeSuave { curva: sub("curva"), desde: f("desde"), exp: f("exp") },
        "limitar" => Curva::Limitar { curva: sub("curva"), min: v["min"].as_f64().unwrap_or(f64::NEG_INFINITY), max: v["max"].as_f64().unwrap_or(f64::INFINITY) },
        "producto" => Curva::Producto(lista()),
        "suma" => Curva::Suma(lista()),
        "desplazar" => Curva::Desplazar { curva: sub("curva"), desplazar: f("desplazar") },
        "escalar" => Curva::Escalar { curva: sub("curva"), valor: f("valor") },
        t => panic!("curva desconocida {t}"),
    }
}

fn modelo(v: &Value) -> ModeloBalance {
    let c = &v["modelo_balance"]["curva"];
    let r = &v["modelo_balance"]["reglas"];
    let n = |k: &str| r[k].as_f64().unwrap();
    ModeloBalance {
        curva: CurvaPoder { golpe: curva(&c["golpe"]), vida: curva(&c["vida"]), defensa: curva(&c["defensa"]), resistencia: curva(&c["resistencia"]) },
        reglas: ReglasBalance {
            golpes_para_matar: n("golpesParaMatar"), golpes_para_morir: n("golpesParaMorir"), k_enemigo: n("kEnemigo"),
            k_jugador_factor: n("kJugadorFactor"), k_jugador_min: n("kJugadorMin"),
            defensa_enemigo: curva(&r["defensaEnemigo"]), exp_enemigo: curva(&r["expEnemigo"]), ritmo_jugador: n("ritmoJugador"),
            duracion_jefe: curva(&r["duracionJefe"]), aguante_jefe: curva(&r["aguanteJefe"]), defensa_jefe: curva(&r["defensaJefe"]),
            exp_jefe: curva(&r["expJefe"]), mult_vida_jefe: n("multVidaJefe"),
        },
    }
}

#[test]
fn curvas_identicas() {
    let v = vectores();
    for c in v["curvas"].as_array().unwrap() {
        let cu = curva(&c["curva"]);
        for par in c["valores"].as_array().unwrap() {
            let (x, y) = (par[0].as_f64().unwrap(), par[1].as_f64().unwrap());
            assert!(cerca(cu.evaluar(x), y, 1e-5), "{:?} en {x}: {} != {y}", c["curva"]["tipo"], cu.evaluar(x));
        }
    }
}

#[test]
fn balance_identico() {
    let v = vectores();
    for m in v["mitigacion"].as_array().unwrap() {
        assert!(cerca(mitigacion(m["defensa"].as_f64().unwrap(), m["k"].as_f64().unwrap()), m["resultado"].as_f64().unwrap(), 1e-5));
    }
    let mo = modelo(&v);
    for p in v["poder_esperado"].as_array().unwrap() {
        let r = mo.poder(p["nivel"].as_f64().unwrap());
        assert!(cerca(r.golpe, p["golpe"].as_f64().unwrap(), 1e-6));
        assert!(cerca(r.vida, p["vida"].as_f64().unwrap(), 1e-6));
        assert!(cerca(r.defensa, p["defensa"].as_f64().unwrap(), 1e-6));
    }
    for e in v["enemigo_esperado"].as_array().unwrap() {
        let r = mo.enemigo(e["nivel"].as_f64().unwrap(), 1.0, 1.0);
        assert_eq!((r.vida, r.ataque, r.defensa, r.exp), (e["vida"].as_f64().unwrap(), e["ataque"].as_f64().unwrap(), e["defensa"].as_f64().unwrap(), e["exp"].as_f64().unwrap()));
    }
    for j in v["jefe_esperado"].as_array().unwrap() {
        let (r, dur) = mo.jefe(j["nivel"].as_f64().unwrap(), 1.0);
        assert_eq!((r.vida, r.ataque, r.defensa), (j["vida"].as_f64().unwrap(), j["ataque"].as_f64().unwrap(), j["defensa"].as_f64().unwrap()));
        assert!(cerca(dur, j["duracion"].as_f64().unwrap(), 1e-9));
    }
    let t = &v["tabla_rareza"];
    let lista = |k: &str| t[k].as_array().map(|a| a.iter().map(|x| x.as_f64().unwrap()).collect::<Vec<_>>());
    let tabla = TablaRareza { primero: lista("primero").unwrap(), ultimo: lista("ultimo").unwrap(), progreso: curva(&t["progreso"]), factor: lista("factor") };
    for p in v["pesos_rareza"].as_array().unwrap() {
        let r = pesos_rareza(&tabla, p["nivel"].as_f64().unwrap());
        for (a, b) in r.iter().zip(p["pesos"].as_array().unwrap()) {
            assert!(cerca(*a, b.as_f64().unwrap(), 1e-5));
        }
    }
}

#[test]
fn fisica_y_autotile_identicos() {
    let v = vectores();
    let filas: Vec<&str> = v["autotile"]["grilla"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect();
    let g = Grilla::desde_texto(&filas, 16.0);
    for c in v["autotile"]["celdas"].as_array().unwrap() {
        assert_eq!(g.mascara(c["c"].as_i64().unwrap() as i32, c["f"].as_i64().unwrap() as i32) as u64, c["mascara"].as_u64().unwrap());
    }
    let piso = Grilla::desde_texto(&["..........", "..........", "..........", "##########"], 16.0);
    let mut cu = Cuerpo::nuevo(20.0, 0.0, 10.0, 20.0);
    for _ in 0..60 {
        cu.vy = (cu.vy + 1100.0 / 60.0).min(430.0);
        mover(&mut cu, &piso, 1.0 / 60.0, false, 0);
    }
    let r = &v["fisica_caida"]["resultado"];
    assert_eq!((cu.x as f64, cu.y as f64, cu.en_suelo), (r["x"].as_f64().unwrap(), r["y"].as_f64().unwrap(), r["enSuelo"].as_bool().unwrap()));
}

#[test]
fn astar_y_ruido_identicos() {
    let v = vectores();
    let mapa: Vec<Vec<char>> = v["astar"]["mapa"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().chars().collect()).collect();
    let camino = a_estrella(10, 6, |c, f| if mapa[f as usize][c as usize] == '#' { f64::INFINITY } else { 1.0 }, (0, 4), (9, 4), false).unwrap();
    assert_eq!(camino.len() as u64, v["astar"]["largo"].as_u64().unwrap());
    let h = v["ruido"]["hash2"].as_array().unwrap();
    assert!(cerca(hash2(1, 2, 0), h[0].as_f64().unwrap(), 1e-5));
    assert!(cerca(hash2(10, -3, 7), h[1].as_f64().unwrap(), 1e-5));
    let rv = v["ruido"]["valor"].as_array().unwrap();
    assert!(cerca(ruido_valor(0.5, 0.5, 0), rv[0].as_f64().unwrap(), 1e-5));
    assert!(cerca(ruido_valor(3.25, 7.75, 9), rv[1].as_f64().unwrap(), 1e-5));
    assert!(fbm(1.3, 2.7, 1, 4) < 1.0);
}

#[test]
fn hash_espacial_y_verlet() {
    let mut h = HashEspacial::nuevo(32.0);
    h.insertar(1, Caja { x: 0.0, y: 0.0, w: 10.0, h: 10.0 });
    h.insertar(2, Caja { x: 5.0, y: 5.0, w: 10.0, h: 10.0 });
    h.insertar(3, Caja { x: 500.0, y: 500.0, w: 10.0, h: 10.0 });
    let mut r = vec![];
    h.consultar(Caja { x: 0.0, y: 0.0, w: 20.0, h: 20.0 }, &mut r);
    r.sort();
    assert_eq!(r, vec![1, 2]);
    h.quitar(1);
    assert_eq!(h.len(), 2);
    let mut c = Cuerda::nueva((100.0, 50.0), ConfigCuerda::CADENA);
    for k in 0..300 {
        c.simular(1.0 / 60.0, k as f32 / 60.0, |_, _| false);
    }
    let ideal = 5.0 * 9.0;
    assert!((c.largo() - ideal).abs() / ideal < 0.05);
    assert!((c.pos[9][0] - 100.0).abs() < 3.0);
}
