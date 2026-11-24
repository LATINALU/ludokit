/* ludokit.h — ABI C del núcleo Rust de ludokit (ver rust/src/ffi.rs y docs/RUST.md).
 *
 * Compilar la biblioteca:   cd rust && cargo build --release
 *   Windows: target/release/ludokit.dll   Linux: target/release/libludokit.so   macOS: target/release/libludokit.dylib
 *
 * Reglas: los objetos opacos se crean con *_nueva y se liberan con *_liberar. Pasar lotes (muchos rayos, todos los
 * agentes) por llamada: cruzar la frontera nativa cuesta. Punteros nulos devuelven 0/NULL, nunca abortan.
 */
#ifndef LUDOKIT_H
#define LUDOKIT_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct Escena3D Escena3D;
typedef struct Horda Horda;
typedef struct NieblaGuerra NieblaGuerra;

/* Dueño especial: sin dueño (paredes). */
#define LUDO_SIN_DUENIO 0xFFFFFFFFu

typedef struct LudoImpacto {
  uint32_t id;
  uint32_t duenio;
  uint32_t etiqueta;
  float t; /* distancia; negativa = sin impacto */
} LudoImpacto;

uint32_t ludo_version_abi(void);

/* ---- Escena 3D (disparos, línea de visión) ---- */
Escena3D* ludo_escena_nueva(float celda);
void ludo_escena_liberar(Escena3D* e);
void ludo_escena_esfera(Escena3D* e, uint32_t id, uint32_t duenio, uint32_t etiqueta, float x, float y, float z, float radio);
void ludo_escena_caja(Escena3D* e, uint32_t id, uint32_t duenio, uint32_t etiqueta, float x0, float y0, float z0, float x1, float y1, float z1);
void ludo_escena_capsula(Escena3D* e, uint32_t id, uint32_t duenio, uint32_t etiqueta, float ax, float ay, float az, float bx, float by, float bz, float radio);
void ludo_escena_mover(Escena3D* e, uint32_t duenio, float dx, float dy, float dz);
void ludo_escena_limpiar(Escena3D* e);
/* rayos: n × [ox, oy, oz, dx, dy, dz, largo]; ignorar: n dueños (o NULL); salida: n impactos. Devuelve cuántos pegaron. */
uint32_t ludo_escena_rayos(Escena3D* e, const float* rayos, const uint32_t* ignorar, uint32_t n, LudoImpacto* salida);

/* ---- Horda: campo de flujo + multitud ---- */
Horda* ludo_horda_nueva(int32_t cols, int32_t filas, const uint8_t* bloqueo, float tile, float velocidad, float aceleracion, float radio, float separacion);
void ludo_horda_liberar(Horda* h);
uint32_t ludo_horda_agregar(Horda* h, float x, float y);
void ludo_horda_objetivo(Horda* h, int32_t c, int32_t f);
void ludo_horda_paso(Horda* h, float dt);
/* Copia [x0, y0, x1, y1, ...]; devuelve cuántos agentes copió. */
uint32_t ludo_horda_posiciones(const Horda* h, float* salida, uint32_t capacidad);

/* ---- Niebla de guerra ---- */
NieblaGuerra* ludo_niebla_nueva(int32_t cols, int32_t filas, const uint8_t* bloqueo);
void ludo_niebla_liberar(NieblaGuerra* n);
/* fuentes: k × [x, y, radio]. Devuelve cols×filas bytes (0 oculta, 1 explorada, 2 visible) válidos hasta la próxima llamada. */
const uint8_t* ludo_niebla_actualizar(NieblaGuerra* n, const float* fuentes, uint32_t k);

#ifdef __cplusplus
}
#endif

#endif /* LUDOKIT_H */
