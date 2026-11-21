//! Uso: cargo run --release -- ../postfx.wgsl ../luz2d.wgsl ...
//! Valida cada WGSL (tipos, layouts, control de flujo) y escribe un GLSL ES 3.00 (WebGL2 / OpenGL ES) por cada punto
//! de entrada: <nombre>.vert.glsl para `vs`, <nombre>.frag.glsl para `fs` y <nombre>.<entrada>.glsl para el resto.
use naga::back::glsl;
use naga::valid::{Capabilities, ValidationFlags, Validator};
use std::path::Path;

fn main() {
    let mut fallos = 0;
    for ruta in std::env::args().skip(1) {
        let fuente = std::fs::read_to_string(&ruta).expect("no se pudo leer el shader");
        let modulo = match naga::front::wgsl::parse_str(&fuente) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("✖ {ruta}: {}", e.emit_to_string(&fuente));
                fallos += 1;
                continue;
            }
        };
        let info = match Validator::new(ValidationFlags::all(), Capabilities::empty()).validate(&modulo) {
            Ok(i) => i,
            Err(e) => {
                eprintln!("✖ {ruta}: validación: {e:?}");
                fallos += 1;
                continue;
            }
        };
        let base = Path::new(&ruta).with_extension("");
        let nombre = Path::new(&ruta).file_name().unwrap().to_string_lossy().to_string();
        for ep in &modulo.entry_points {
            let ext = match (ep.stage, ep.name.as_str()) {
                (naga::ShaderStage::Vertex, "vs") => "vert".to_string(),
                (naga::ShaderStage::Fragment, "fs") => "frag".to_string(),
                (_, otro) => otro.to_string(),
            };
            let opciones = glsl::Options { version: glsl::Version::Embedded { version: 300, is_webgl: true }, ..Default::default() };
            let tuberia = glsl::PipelineOptions { shader_stage: ep.stage, entry_point: ep.name.clone(), multiview: None };
            let mut salida = String::new();
            let mut w = match glsl::Writer::new(&mut salida, &modulo, &info, &opciones, &tuberia, naga::proc::BoundsCheckPolicies::default()) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("✖ {ruta} [{}]: {e:?}", ep.name);
                    fallos += 1;
                    continue;
                }
            };
            if let Err(e) = w.write() {
                eprintln!("✖ {ruta} [{}]: {e:?}", ep.name);
                fallos += 1;
                continue;
            }
            let destino = format!("{}.{ext}.glsl", base.display());
            std::fs::write(&destino, format!("// GENERADO desde {nombre} [{}] por shaders/compilador (naga). No editar a mano.\n{salida}", ep.name)).unwrap();
            println!("✔ {ruta} [{}] → {destino}", ep.name);
        }
    }
    std::process::exit(if fallos > 0 { 1 } else { 0 });
}
