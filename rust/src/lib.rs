//! ludokit (Rust): el núcleo de ALTO RENDIMIENTO de la librería. Mismas reglas y mismos números que la referencia
//! TypeScript (verificado con `vectores/vectores.json`), para las rutas calientes donde importa cada microsegundo:
//!   - disparos masivos: rayos 3D contra escenas con grilla + DDA (`colision3d`), penetración (`balistica`);
//!   - multitudes de miles de agentes: campo de flujo + separación SoA (`multitud`);
//!   - visión de RTS/MOBA: niebla de guerra por línea de visión (`niebla`);
//!   - física por tiles, hash espacial, A*, Verlet, ruido, azar determinista, curvas y balance.
//! Se usa desde Rust, desde C/C++/C#/Godot/Unreal por la ABI C (`ffi`, encabezado `include/ludokit.h`) y en la web
//! compilado a WebAssembly. Sin dependencias. Todo determinista. Guía: `docs/RUST.md`.

pub mod azar;
pub mod balance;
pub mod balistica;
pub mod colision3d;
pub mod espacial;
pub mod ffi;
pub mod fisica;
pub mod multitud;
pub mod navegacion;
pub mod niebla;
pub mod ruido;
pub mod verlet;
