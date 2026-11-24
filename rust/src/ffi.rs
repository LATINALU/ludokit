//! Interfaz C (ABI estable) para usar el núcleo de Rust desde **Unity** (`[DllImport]`), **Godot** (GDExtension o
//! C#), **Unreal** (C++), C, Python (`ctypes`) o cualquier lenguaje con FFI. Encabezado: `rust/include/ludokit.h`.
//!
//! Reglas de diseño de esta API:
//!   - Objetos opacos (`*mut Escena3D`...) creados con `*_nueva` y liberados con `*_liberar` (nunca `free`).
//!   - Llamadas GRUESAS: se pasan lotes (muchos rayos, todos los agentes) por punteros a arreglos, no una llamada por
//!     entidad. Cruzar la frontera FFI/WASM cuesta; lo que vuela es hacer mucho trabajo por cruce.
//!   - Nunca hay `panic` que cruce la frontera: punteros nulos devuelven 0/false.
//!   - Todo en `f32` y `u32` (lo que usan los motores).

use crate::colision3d::{Colisionador, Escena3D, Forma, Impacto, Rayo, V3};
use crate::multitud::{CampoFlujo, Multitud, ReglasMultitud};
use crate::niebla::{FuenteVision, NieblaGuerra};
use std::slice;

/// Versión de la ABI (subir si cambia una firma).
#[no_mangle]
pub extern "C" fn ludo_version_abi() -> u32 {
    1
}

// ---------------------------------------------------------------- Escena 3D

#[no_mangle]
pub extern "C" fn ludo_escena_nueva(celda: f32) -> *mut Escena3D {
    Box::into_raw(Box::new(Escena3D::nueva(if celda > 0.0 { celda } else { 4.0 })))
}

/// # Safety
/// `e` debe venir de `ludo_escena_nueva` y no usarse después.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_liberar(e: *mut Escena3D) {
    if !e.is_null() {
        drop(Box::from_raw(e));
    }
}

/// # Safety
/// `e` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_esfera(e: *mut Escena3D, id: u32, duenio: u32, etiqueta: u32, x: f32, y: f32, z: f32, radio: f32) {
    if let Some(e) = e.as_mut() {
        e.agregar(Colisionador { id, duenio, etiqueta, forma: Forma::Esfera { centro: V3::new(x, y, z), radio } });
    }
}

/// # Safety
/// `e` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_caja(e: *mut Escena3D, id: u32, duenio: u32, etiqueta: u32, x0: f32, y0: f32, z0: f32, x1: f32, y1: f32, z1: f32) {
    if let Some(e) = e.as_mut() {
        e.agregar(Colisionador { id, duenio, etiqueta, forma: Forma::Caja { min: V3::new(x0, y0, z0), max: V3::new(x1, y1, z1) } });
    }
}

/// # Safety
/// `e` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_capsula(e: *mut Escena3D, id: u32, duenio: u32, etiqueta: u32, ax: f32, ay: f32, az: f32, bx: f32, by: f32, bz: f32, radio: f32) {
    if let Some(e) = e.as_mut() {
        e.agregar(Colisionador { id, duenio, etiqueta, forma: Forma::Capsula { a: V3::new(ax, ay, az), b: V3::new(bx, by, bz), radio } });
    }
}

/// # Safety
/// `e` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_mover(e: *mut Escena3D, duenio: u32, dx: f32, dy: f32, dz: f32) {
    if let Some(e) = e.as_mut() {
        e.mover_duenio(duenio, V3::new(dx, dy, dz));
    }
}

/// # Safety
/// `e` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_limpiar(e: *mut Escena3D) {
    if let Some(e) = e.as_mut() {
        e.limpiar();
    }
}

/// Impacto devuelto por FFI (diseño C plano).
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct LudoImpacto {
    pub id: u32,
    pub duenio: u32,
    pub etiqueta: u32,
    /// Distancia; negativa = sin impacto.
    pub t: f32,
}

impl From<Option<Impacto>> for LudoImpacto {
    fn from(i: Option<Impacto>) -> Self {
        i.map_or(LudoImpacto { t: -1.0, ..Default::default() }, |h| LudoImpacto { id: h.id, duenio: h.duenio, etiqueta: h.etiqueta, t: h.t })
    }
}

/// Lanza `n` rayos en lote. `rayos` = n × [ox, oy, oz, dx, dy, dz, largo] (7 floats), `ignorar` = n dueños a
/// ignorar (o nulo), `salida` = n impactos. Devuelve cuántos rayos pegaron.
///
/// # Safety
/// Punteros válidos con los largos indicados.
#[no_mangle]
pub unsafe extern "C" fn ludo_escena_rayos(e: *mut Escena3D, rayos: *const f32, ignorar: *const u32, n: u32, salida: *mut LudoImpacto) -> u32 {
    let (Some(e), false, false) = (e.as_mut(), rayos.is_null(), salida.is_null()) else { return 0 };
    let n = n as usize;
    let rs = slice::from_raw_parts(rayos, n * 7);
    let out = slice::from_raw_parts_mut(salida, n);
    let ign = if ignorar.is_null() { None } else { Some(slice::from_raw_parts(ignorar, n)) };
    let mut pegaron = 0;
    for k in 0..n {
        let r = &rs[k * 7..k * 7 + 7];
        let rayo = Rayo { origen: V3::new(r[0], r[1], r[2]), dir: V3::new(r[3], r[4], r[5]).normalizar(), largo: r[6] };
        let h = e.lanzar_rayo(&rayo, ign.map_or(u32::MAX, |i| i[k]));
        if h.is_some() {
            pegaron += 1;
        }
        out[k] = h.into();
    }
    pegaron
}

// ---------------------------------------------------------------- Campo de flujo + multitud

/// Campo de flujo + multitud en un solo objeto para FFI.
pub struct Horda {
    campo: CampoFlujo,
    multitud: Multitud,
    bloqueo: Vec<u8>,
}

/// `bloqueo`: cols×filas bytes (1 = pared), copiados.
///
/// # Safety
/// `bloqueo` válido con cols×filas bytes (o nulo = todo libre).
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_nueva(cols: i32, filas: i32, bloqueo: *const u8, tile: f32, velocidad: f32, aceleracion: f32, radio: f32, separacion: f32) -> *mut Horda {
    if cols <= 0 || filas <= 0 {
        return std::ptr::null_mut();
    }
    let n = (cols * filas) as usize;
    let b = if bloqueo.is_null() { vec![0; n] } else { slice::from_raw_parts(bloqueo, n).to_vec() };
    Box::into_raw(Box::new(Horda {
        campo: CampoFlujo::nuevo(cols, filas),
        multitud: Multitud::nueva(ReglasMultitud { tile, velocidad, aceleracion, radio, separacion }),
        bloqueo: b,
    }))
}

/// # Safety
/// `h` de `ludo_horda_nueva`.
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_liberar(h: *mut Horda) {
    if !h.is_null() {
        drop(Box::from_raw(h));
    }
}

/// # Safety
/// `h` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_agregar(h: *mut Horda, x: f32, y: f32) -> u32 {
    h.as_mut().map_or(u32::MAX, |h| h.multitud.agregar(x, y) as u32)
}

/// Recalcula el campo hacia (c, f) (llamar cuando el objetivo cambia de celda, no cada tick).
///
/// # Safety
/// `h` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_objetivo(h: *mut Horda, c: i32, f: i32) {
    if let Some(h) = h.as_mut() {
        let (cols, b) = (h.campo.cols, &h.bloqueo);
        h.campo.calcular(&[(c, f)], |x, y| if b[(y * cols + x) as usize] != 0 { f64::INFINITY } else { 1.0 }, f64::INFINITY);
    }
}

/// # Safety
/// `h` válido.
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_paso(h: *mut Horda, dt: f32) {
    if let Some(h) = h.as_mut() {
        let (cols, filas, b) = (h.campo.cols, h.campo.filas, &h.bloqueo);
        let bloq = |c: i32, f: i32| c < 0 || f < 0 || c >= cols || f >= filas || b[(f * cols + c) as usize] != 0;
        h.multitud.paso(dt, &h.campo, bloq);
    }
}

/// Copia las posiciones intercaladas [x0, y0, x1, y1, ...] en `salida` (capacidad en agentes). Devuelve cuántos.
///
/// # Safety
/// `salida` con espacio para `capacidad`×2 floats.
#[no_mangle]
pub unsafe extern "C" fn ludo_horda_posiciones(h: *const Horda, salida: *mut f32, capacidad: u32) -> u32 {
    let (Some(h), false) = (h.as_ref(), salida.is_null()) else { return 0 };
    let n = h.multitud.len().min(capacidad as usize);
    let out = slice::from_raw_parts_mut(salida, n * 2);
    for i in 0..n {
        out[i * 2] = h.multitud.x[i];
        out[i * 2 + 1] = h.multitud.y[i];
    }
    n as u32
}

// ---------------------------------------------------------------- Niebla de guerra

/// # Safety
/// `bloqueo` con cols×filas bytes (o nulo).
#[no_mangle]
pub unsafe extern "C" fn ludo_niebla_nueva(cols: i32, filas: i32, bloqueo: *const u8) -> *mut NieblaGuerra {
    if cols <= 0 || filas <= 0 {
        return std::ptr::null_mut();
    }
    let n = (cols * filas) as usize;
    let b = if bloqueo.is_null() { vec![0; n] } else { slice::from_raw_parts(bloqueo, n).to_vec() };
    Box::into_raw(Box::new(NieblaGuerra::nueva(cols, filas, b)))
}

/// # Safety
/// `n` de `ludo_niebla_nueva`.
#[no_mangle]
pub unsafe extern "C" fn ludo_niebla_liberar(n: *mut NieblaGuerra) {
    if !n.is_null() {
        drop(Box::from_raw(n));
    }
}

/// `fuentes` = k × [x, y, radio] (en celdas). Devuelve un puntero a cols×filas bytes (0/1/2) válido hasta la
/// próxima llamada o liberar.
///
/// # Safety
/// Punteros válidos.
#[no_mangle]
pub unsafe extern "C" fn ludo_niebla_actualizar(n: *mut NieblaGuerra, fuentes: *const f32, k: u32) -> *const u8 {
    let Some(n) = n.as_mut() else { return std::ptr::null() };
    let fs: Vec<FuenteVision> = if fuentes.is_null() {
        vec![]
    } else {
        slice::from_raw_parts(fuentes, k as usize * 3).chunks_exact(3).map(|c| FuenteVision { x: c[0], y: c[1], radio: c[2], ignora_bloqueo: false }).collect()
    };
    n.actualizar(&fs);
    n.celdas.as_ptr()
}
