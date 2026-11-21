//! ludokit (Rust): el núcleo de alto rendimiento de la librería. Mismas reglas y mismos números que la
//! implementación de referencia en TypeScript (verificado con `vectores/vectores.json`), para:
//!   - servidores autoritativos con miles de entidades (sin pausas de recolector de basura),
//!   - física, colisiones y pathfinding en el camino caliente de un motor propio,
//!   - WebAssembly (`cargo build --target wasm32-unknown-unknown`) para acelerar un juego web.
//!
//! Sin dependencias. Todo determinista: misma semilla = mismo resultado en cualquier plataforma.

pub mod azar;
pub mod balance;
pub mod espacial;
pub mod fisica;
pub mod navegacion;
pub mod ruido;
pub mod verlet;
