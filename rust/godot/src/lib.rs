//! ludokit para Godot 4 (GDExtension con godot-rust/gdext): expone el núcleo Rust de alto rendimiento como clases
//! que se usan desde GDScript o C# igual que cualquier nodo o recurso de Godot.
//!
//!   LudoEscena3D  — disparos y línea de visión: rayos 3D en lote contra cápsulas/esferas/cajas (grilla + DDA),
//!                   con penetración de paredes y compensación de lag (mover dueños).
//!   LudoHorda     — miles de agentes (zombis, súbditos) con campo de flujo + separación; paso paralelo determinista;
//!                   escribe directo el búfer de un MultiMesh (una llamada dibuja 50 000 instancias).
//!   LudoNiebla    — niebla de guerra por línea de visión para RTS/MOBA; devuelve un PackedByteArray listo para una
//!                   textura (Image.FORMAT_R8).
//!   LudoCurva     — evalúa curvas de escalado de ludokit (las mismas que en TypeScript) desde un Dictionary/JSON.
//!
//! Reglas: llamadas en LOTE (PackedArrays), nada de una llamada por entidad; llamar `paso` desde `_physics_process`.

use godot::classes::{IRefCounted, MultiMesh, RefCounted};
use godot::prelude::*;
use ludokit::balance::Curva;
use ludokit::balistica::{disparo_penetrante, ImpactoBala};
use ludokit::colision3d::{Colisionador, Escena3D, Forma, Impacto, Rayo, SIN_DUENIO, V3};
use ludokit::multitud::{CampoFlujo, Multitud, ReglasMultitud};
use ludokit::niebla::{FuenteVision, NieblaGuerra};

struct ExtensionLudokit;

#[gdextension]
unsafe impl ExtensionLibrary for ExtensionLudokit {}

fn v(x: Vector3) -> V3 {
    V3::new(x.x, x.y, x.z)
}

/// Dueño para Godot: -1 = sin dueño.
fn duenio(d: i64) -> u32 {
    if d < 0 { SIN_DUENIO } else { d as u32 }
}

fn impacto_dict(h: &Impacto) -> VarDictionary {
    vdict! {
        "id" => h.id as i64,
        "duenio" => if h.duenio == SIN_DUENIO { -1 } else { h.duenio as i64 },
        "etiqueta" => h.etiqueta as i64,
        "distancia" => h.t,
    }
}

// =====================================================================================================================
// Escena 3D

/// Escena de colisionadores 3D para disparos masivos (núcleo Rust con grilla + DDA).
#[derive(GodotClass)]
#[class(base = RefCounted)]
pub struct LudoEscena3D {
    escena: Escena3D,
    tmp: Vec<Impacto>,
    balas: Vec<ImpactoBala>,
    /// Pérdida de poder por etiqueta de superficie (paredes); las demás etiquetas son zonas de personaje.
    materiales: std::collections::HashMap<u32, f32>,
    base: Base<RefCounted>,
}

#[godot_api]
impl IRefCounted for LudoEscena3D {
    fn init(base: Base<RefCounted>) -> Self {
        Self { escena: Escena3D::nueva(4.0), tmp: Vec::new(), balas: Vec::new(), materiales: Default::default(), base }
    }
}

#[godot_api]
impl LudoEscena3D {
    /// Tamaño de celda de la grilla (2-4× el tamaño de un personaje). Vacía la escena.
    #[func]
    fn configurar(&mut self, celda: f32) {
        self.escena = Escena3D::nueva(if celda > 0.0 { celda } else { 4.0 });
    }

    #[func]
    fn agregar_esfera(&mut self, id: i64, duenio_: i64, etiqueta: i64, centro: Vector3, radio: f32) {
        self.escena.agregar(Colisionador { id: id as u32, duenio: duenio(duenio_), etiqueta: etiqueta as u32, forma: Forma::Esfera { centro: v(centro), radio } });
    }

    #[func]
    fn agregar_caja(&mut self, id: i64, duenio_: i64, etiqueta: i64, minimo: Vector3, maximo: Vector3) {
        self.escena.agregar(Colisionador { id: id as u32, duenio: duenio(duenio_), etiqueta: etiqueta as u32, forma: Forma::Caja { min: v(minimo), max: v(maximo) } });
    }

    #[func]
    fn agregar_capsula(&mut self, id: i64, duenio_: i64, etiqueta: i64, a: Vector3, b: Vector3, radio: f32) {
        self.escena.agregar(Colisionador { id: id as u32, duenio: duenio(duenio_), etiqueta: etiqueta as u32, forma: Forma::Capsula { a: v(a), b: v(b), radio } });
    }

    /// Mueve todas las formas de un dueño (personaje que caminó, o rebobinado de lag).
    #[func]
    fn mover_duenio(&mut self, duenio_: i64, desplazamiento: Vector3) {
        self.escena.mover_duenio(duenio(duenio_), v(desplazamiento));
    }

    #[func]
    fn limpiar(&mut self) {
        self.escena.limpiar();
    }

    #[func]
    fn cantidad(&self) -> i64 {
        self.escena.colisionadores.len() as i64
    }

    /// Una etiqueta es superficie (pared, puerta) que resta `perdida` de poder a la bala al atravesarla
    /// (INF = impenetrable). Las etiquetas no registradas son zonas de personaje.
    #[func]
    fn definir_material(&mut self, etiqueta: i64, perdida: f32) {
        self.materiales.insert(etiqueta as u32, perdida);
    }

    /// Primer impacto: {id, duenio, etiqueta, distancia} o diccionario vacío. `ignorar` = dueño del tirador (-1 = nadie).
    #[func]
    fn lanzar_rayo(&mut self, origen: Vector3, direccion: Vector3, largo: f32, ignorar: i64) -> VarDictionary {
        let r = Rayo { origen: v(origen), dir: v(direccion).normalizar(), largo };
        self.escena.lanzar_rayo(&r, duenio(ignorar)).map_or_else(VarDictionary::new, |h| impacto_dict(&h))
    }

    /// LOTE: n rayos en una llamada. Devuelve PackedFloat32Array de n×4: [id, duenio, etiqueta, distancia] por rayo
    /// (distancia < 0 = no pegó). `ignorar` puede estar vacío o tener un dueño por rayo.
    #[func]
    fn lanzar_rayos(&mut self, origenes: PackedVector3Array, direcciones: PackedVector3Array, largo: f32, ignorar: PackedInt32Array) -> PackedFloat32Array {
        let (o, d, ig) = (origenes.as_slice(), direcciones.as_slice(), ignorar.as_slice());
        let n = o.len().min(d.len());
        let mut out = Vec::with_capacity(n * 4);
        for k in 0..n {
            let r = Rayo { origen: v(o[k]), dir: v(d[k]).normalizar(), largo };
            let ign = ig.get(k).map_or(SIN_DUENIO, |&x| duenio(x as i64));
            match self.escena.lanzar_rayo(&r, ign) {
                Some(h) => out.extend_from_slice(&[h.id as f32, if h.duenio == SIN_DUENIO { -1.0 } else { h.duenio as f32 }, h.etiqueta as f32, h.t]),
                None => out.extend_from_slice(&[-1.0, -1.0, -1.0, -1.0]),
            }
        }
        PackedFloat32Array::from(out.as_slice())
    }

    /// Disparo con penetración: atraviesa superficies (`definir_material`) perdiendo poder; cada personaje recibe un
    /// impacto. Devuelve un Array de {id, duenio, etiqueta, distancia, fraccion}.
    #[func]
    fn disparo_penetrante(&mut self, origen: Vector3, direccion: Vector3, largo: f32, tirador: i64, poder: f32, por_personaje: f32) -> Array<VarDictionary> {
        let r = Rayo { origen: v(origen), dir: v(direccion).normalizar(), largo };
        let mats = &self.materiales;
        disparo_penetrante(&mut self.escena, &r, duenio(tirador), poder, por_personaje, |et| mats.get(&et).copied(), &mut self.tmp, &mut self.balas);
        let mut a = Array::new();
        for b in &self.balas {
            let mut d = impacto_dict(&b.impacto);
            d.set("fraccion", b.fraccion);
            a.push(&d);
        }
        a
    }
}

// =====================================================================================================================
// Horda

/// Miles de agentes con campo de flujo + separación (núcleo Rust SoA, paso paralelo determinista).
#[derive(GodotClass)]
#[class(base = RefCounted)]
pub struct LudoHorda {
    campo: CampoFlujo,
    multitud: Multitud,
    bloqueo: Vec<u8>,
    hilos: usize,
    base: Base<RefCounted>,
}

#[godot_api]
impl IRefCounted for LudoHorda {
    fn init(base: Base<RefCounted>) -> Self {
        let reglas = ReglasMultitud { tile: 1.0, velocidad: 4.0, aceleracion: 20.0, radio: 0.6, separacion: 2.0 };
        Self { campo: CampoFlujo::nuevo(1, 1), multitud: Multitud::nueva(reglas), bloqueo: vec![0], hilos: 1, base }
    }
}

#[godot_api]
impl LudoHorda {
    /// Mapa de `cols`×`filas` celdas de tamaño `tile` (unidades de mundo); `bloqueo` = un byte por celda (1 = pared,
    /// vacío = todo libre). Borra los agentes.
    #[func]
    fn configurar(&mut self, cols: i32, filas: i32, tile: f32, bloqueo: PackedByteArray) {
        let (cols, filas) = (cols.max(1), filas.max(1));
        let n = (cols * filas) as usize;
        let b = bloqueo.as_slice();
        self.bloqueo = if b.len() == n { b.to_vec() } else { vec![0; n] };
        self.campo = CampoFlujo::nuevo(cols, filas);
        let mut r = self.multitud.reglas;
        r.tile = if tile > 0.0 { tile } else { 1.0 };
        self.multitud = Multitud::nueva(r);
    }

    /// Velocidad (u/s), aceleración (u/s²), radio de separación (u) y fuerza de separación.
    #[func]
    fn reglas(&mut self, velocidad: f32, aceleracion: f32, radio: f32, separacion: f32) {
        let tile = self.multitud.reglas.tile;
        self.multitud.reglas = ReglasMultitud { tile, velocidad, aceleracion, radio, separacion };
    }

    /// Hilos para `paso` (0 = todos los núcleos). Con pocos agentes usa uno solo automáticamente.
    #[func]
    fn usar_hilos(&mut self, hilos: i32) {
        self.hilos = if hilos <= 0 { std::thread::available_parallelism().map_or(4, |n| n.get()) } else { hilos as usize };
    }

    #[func]
    fn agregar(&mut self, posicion: Vector2) -> i64 {
        self.multitud.agregar(posicion.x, posicion.y) as i64
    }

    /// Quita el agente `i` (el último ocupa su lugar: los índices cambian).
    #[func]
    fn quitar(&mut self, i: i64) {
        if (i as usize) < self.multitud.len() {
            self.multitud.quitar(i as usize);
        }
    }

    #[func]
    fn cantidad(&self) -> i64 {
        self.multitud.len() as i64
    }

    /// Recalcula el campo hacia la celda objetivo (solo cuando el objetivo cambia de celda, no cada tick).
    #[func]
    fn objetivo(&mut self, celda: Vector2i) {
        let (cols, b) = (self.campo.cols, &self.bloqueo);
        let (c, f) = (celda.x.clamp(0, cols - 1), celda.y.clamp(0, self.campo.filas - 1));
        self.campo.calcular(&[(c, f)], |x, y| if b[(y * cols + x) as usize] != 0 { f64::INFINITY } else { 1.0 }, f64::INFINITY);
    }

    /// Un paso de simulación (llamar desde `_physics_process`).
    #[func]
    fn paso(&mut self, dt: f32) {
        let (cols, filas, b) = (self.campo.cols, self.campo.filas, &self.bloqueo);
        let bloq = |c: i32, f: i32| c < 0 || f < 0 || c >= cols || f >= filas || b[(f * cols + c) as usize] != 0;
        self.multitud.paso_paralelo(dt, &self.campo, bloq, self.hilos.max(1));
    }

    #[func]
    fn posicion(&self, i: i64) -> Vector2 {
        let i = i as usize;
        if i < self.multitud.len() { Vector2::new(self.multitud.x[i], self.multitud.y[i]) } else { Vector2::ZERO }
    }

    /// Todas las posiciones (x, y del plano) en un arreglo.
    #[func]
    fn posiciones(&self) -> PackedVector2Array {
        let m = &self.multitud;
        let v: Vec<Vector2> = (0..m.len()).map(|i| Vector2::new(m.x[i], m.y[i])).collect();
        PackedVector2Array::from(v.as_slice())
    }

    /// Escribe las transformaciones de todos los agentes en un MultiMesh 3D (x → X, y → Z, a la altura `y`),
    /// orientados según su velocidad. Una sola llamada por cuadro para dibujar miles de instancias.
    #[func]
    fn escribir_multimesh(&self, mut multimesh: Gd<MultiMesh>, altura: f32) {
        let m = &self.multitud;
        let n = m.len();
        if multimesh.get_instance_count() as usize != n {
            multimesh.set_instance_count(n as i32);
        }
        let mut buf = Vec::with_capacity(n * 12);
        for i in 0..n {
            let (vx, vz) = (m.vx[i], m.vy[i]);
            let l = (vx * vx + vz * vz).sqrt();
            // Base: Z hacia la velocidad (o identidad si está quieto); filas de una Transform3D (formato de MultiMesh).
            let (fx, fz) = if l > 1e-4 { (vx / l, vz / l) } else { (0.0, 1.0) };
            let (rx, rz) = (fz, -fx);
            buf.extend_from_slice(&[rx, 0.0, fx, m.x[i], 0.0, 1.0, 0.0, altura, rz, 0.0, fz, m.y[i]]);
        }
        multimesh.set_buffer(&PackedFloat32Array::from(buf.as_slice()));
    }

    /// Distancia al objetivo (en celdas) desde una posición del mundo; -1 si no hay camino.
    #[func]
    fn distancia_objetivo(&self, posicion: Vector2) -> f32 {
        let t = self.multitud.reglas.tile;
        let (c, f) = ((posicion.x / t).floor() as i32, (posicion.y / t).floor() as i32);
        if c < 0 || f < 0 || c >= self.campo.cols || f >= self.campo.filas {
            return -1.0;
        }
        let d = self.campo.distancia[(f * self.campo.cols + c) as usize];
        if d.is_finite() { d } else { -1.0 }
    }
}

// =====================================================================================================================
// Niebla de guerra

/// Niebla de guerra por línea de visión (0 oculta, 1 explorada, 2 visible).
#[derive(GodotClass)]
#[class(base = RefCounted)]
pub struct LudoNiebla {
    niebla: NieblaGuerra,
    base: Base<RefCounted>,
}

#[godot_api]
impl IRefCounted for LudoNiebla {
    fn init(base: Base<RefCounted>) -> Self {
        Self { niebla: NieblaGuerra::nueva(1, 1, vec![0]), base }
    }
}

#[godot_api]
impl LudoNiebla {
    #[func]
    fn configurar(&mut self, cols: i32, filas: i32, bloqueo: PackedByteArray) {
        let (cols, filas) = (cols.max(1), filas.max(1));
        let n = (cols * filas) as usize;
        let b = bloqueo.as_slice();
        self.niebla = NieblaGuerra::nueva(cols, filas, if b.len() == n { b.to_vec() } else { vec![0; n] });
    }

    /// `fuentes`: Vector3(x, y, radio) en celdas. Devuelve cols×filas bytes (0/1/2), listos para
    /// `Image.create_from_data(cols, filas, false, Image.FORMAT_R8, bytes)` (multiplicar por 127 para verlos).
    #[func]
    fn actualizar(&mut self, fuentes: PackedVector3Array) -> PackedByteArray {
        let fs: Vec<FuenteVision> = fuentes.as_slice().iter().map(|f| FuenteVision { x: f.x, y: f.y, radio: f.z, ignora_bloqueo: false }).collect();
        self.niebla.actualizar(&fs);
        PackedByteArray::from(self.niebla.celdas.as_slice())
    }

    #[func]
    fn estado(&self, celda: Vector2i) -> i64 {
        self.niebla.estado(celda.x, celda.y) as i64
    }

    #[func]
    fn hay_linea(&self, desde: Vector2i, hasta: Vector2i) -> bool {
        let n = &self.niebla;
        let dentro = |p: Vector2i| p.x >= 0 && p.y >= 0 && p.x < n.cols && p.y < n.filas;
        dentro(desde) && dentro(hasta) && n.linea_libre(desde.x, desde.y, hasta.x, hasta.y)
    }
}

// =====================================================================================================================
// Curvas

/// Curvas de escalado de ludokit (mismo formato JSON que `nucleo/escalado.ts`): vida por nivel, rareza, experiencia.
#[derive(GodotClass)]
#[class(base = RefCounted, init)]
pub struct LudoCurva {
    curva: Option<Curva>,
    base: Base<RefCounted>,
}

fn num(d: &VarDictionary, k: &str, def: f64) -> f64 {
    d.get(k).and_then(|x| x.try_to::<f64>().ok()).unwrap_or(def)
}

fn curva_desde(d: &VarDictionary) -> Result<Curva, String> {
    let tipo: String = d.get("tipo").and_then(|x| x.try_to::<GString>().ok()).map(|s| s.to_string()).ok_or("falta 'tipo'")?;
    let sub = |k: &str| -> Result<Box<Curva>, String> {
        let x = d.get(k).ok_or(format!("falta '{k}'"))?;
        Ok(Box::new(curva_desde(&x.try_to::<VarDictionary>().map_err(|_| format!("'{k}' no es un diccionario"))?)?))
    };
    let pares = |k: &str| -> Result<Vec<(f64, f64)>, String> {
        let a = d.get(k).ok_or(format!("falta '{k}'"))?.try_to::<VarArray>().map_err(|_| format!("'{k}' no es un arreglo"))?;
        a.iter_shared()
            .map(|p| {
                let p = p.try_to::<VarArray>().map_err(|_| "punto inválido".to_string())?;
                Ok((p.get(0).and_then(|x| x.try_to::<f64>().ok()).unwrap_or(0.0), p.get(1).and_then(|x| x.try_to::<f64>().ok()).unwrap_or(0.0)))
            })
            .collect()
    };
    let lista = || -> Result<Vec<Curva>, String> {
        let a = d.get("curvas").ok_or("falta 'curvas'")?.try_to::<VarArray>().map_err(|_| "'curvas' no es un arreglo".to_string())?;
        a.iter_shared().map(|c| curva_desde(&c.try_to::<VarDictionary>().map_err(|_| "curva inválida".to_string())?)).collect()
    };
    Ok(match tipo.as_str() {
        "constante" => Curva::Constante(num(d, "valor", 0.0)),
        "lineal" => Curva::Lineal { base: num(d, "base", 0.0), por_nivel: num(d, "porNivel", 0.0) },
        "potencia" => Curva::Potencia { base: num(d, "base", 0.0), exp: num(d, "exp", 1.0) },
        "exponencial" => Curva::Exponencial { base: num(d, "base", 0.0), razon: num(d, "razon", 1.0) },
        "saturacion" => Curva::Saturacion { mitad: num(d, "mitad", 1.0), exp: num(d, "exp", 1.0) },
        "logistica" => Curva::Logistica { centro: num(d, "centro", 0.0), pendiente: num(d, "pendiente", 1.0) },
        "tramos" => Curva::Tramos { puntos: pares("puntos")?, extrapolar_lineal: d.get("extrapolar").map(|x| x.to_string()) == Some("lineal".into()) },
        "escalones" => Curva::Escalones { puntos: pares("puntos")?, inicial: num(d, "inicial", 0.0) },
        "topeSuave" => Curva::TopeSuave { curva: sub("curva")?, desde: num(d, "desde", 1.0), exp: num(d, "exp", 1.0) },
        "limitar" => Curva::Limitar { curva: sub("curva")?, min: num(d, "min", f64::NEG_INFINITY), max: num(d, "max", f64::INFINITY) },
        "producto" => Curva::Producto(lista()?),
        "suma" => Curva::Suma(lista()?),
        "desplazar" => Curva::Desplazar { curva: sub("curva")?, desplazar: num(d, "desplazar", 0.0) },
        "escalar" => Curva::Escalar { curva: sub("curva")?, valor: num(d, "valor", 1.0) },
        otro => return Err(format!("tipo de curva desconocido: {otro}")),
    })
}

#[godot_api]
impl LudoCurva {
    /// Carga la curva desde un diccionario (p. ej. `JSON.parse_string(texto)`). Devuelve "" si es válida o el error.
    #[func]
    fn cargar(&mut self, datos: VarDictionary) -> GString {
        match curva_desde(&datos) {
            Ok(c) => {
                self.curva = Some(c);
                GString::new()
            }
            Err(e) => {
                self.curva = None;
                GString::from(e.as_str())
            }
        }
    }

    /// Valor en el nivel `x` (1 = el primero). Sin curva cargada devuelve 0.
    #[func]
    fn evaluar(&self, x: f64) -> f64 {
        self.curva.as_ref().map_or(0.0, |c| c.evaluar(x))
    }
}
