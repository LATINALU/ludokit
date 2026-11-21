// ludokit.hpp — núcleo de ludokit en C++17, header-only, sin dependencias.
//
// Para integrar en motores C++ (Unreal, motores propios, consolas, servidores de muy baja latencia) las mismas
// reglas y los mismos números que la referencia TypeScript/Rust: azar determinista (PCG32, mulberry32), física 2D
// por tiles con corrección de esquinas, daño con defensa de rendimiento decreciente, poder esperado y ruido.
// Verificación: `pruebas.cpp` compara contra vectores/vectores.json (ver cpp/LEEME.md para compilar).
//
//   #include "ludokit.hpp"
//   ludokit::Pcg32 azar(42);
//   uint32_t n = azar.u32();

#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace ludokit {

// ------------------------------------------------------------------ Azar

class Pcg32 {
 public:
  explicit Pcg32(uint64_t semilla) : estado_(0), inc_((semilla << 1u) | 1u) {
    u32();
    estado_ += semilla ^ 0x853c49e6748fea9bULL;
    u32();
  }
  uint32_t u32() {
    const uint64_t viejo = estado_;
    estado_ = viejo * 6364136223846793005ULL + inc_;
    const uint32_t xs = static_cast<uint32_t>(((viejo >> 18u) ^ viejo) >> 27u);
    const uint32_t rot = static_cast<uint32_t>(viejo >> 59u);
    return (xs >> rot) | (xs << ((32u - rot) & 31u));
  }
  float f32() { return static_cast<float>(u32() >> 8u) / static_cast<float>(1u << 24u); }
  int32_t rango(int32_t a, int32_t b) { return b <= a ? a : a + static_cast<int32_t>(u32() % static_cast<uint32_t>(b - a + 1)); }
  bool prob(float p) { return f32() < p; }

 private:
  uint64_t estado_;
  uint64_t inc_;
};

inline uint64_t derivarSemilla(uint64_t semilla, uint64_t n) { return semilla + n * 0x9E3779B97F4A7C15ULL; }

class Mulberry32 {
 public:
  explicit Mulberry32(uint32_t semilla) : s_(semilla) {}
  double siguiente() {
    s_ += 0x6d2b79f5u;
    uint32_t t = s_;
    t = (t ^ (t >> 15u)) * (t | 1u);
    t ^= t + (t ^ (t >> 7u)) * (t | 61u);
    return static_cast<double>(t ^ (t >> 14u)) / 4294967296.0;
  }

 private:
  uint32_t s_;
};

// ------------------------------------------------------------------ Física por tiles

enum class Celda : uint8_t { Vacio = 0, Roca = 1, Plataforma = 2, Pinchos = 3 };

class Grilla {
 public:
  Grilla(int cols, int filas, float tile = 16.f, Celda fuera = Celda::Vacio)
      : cols(cols), filas(filas), tile(tile), fuera(fuera), datos_(static_cast<size_t>(cols * filas), Celda::Vacio) {}

  static Grilla desdeTexto(const std::vector<std::string>& lineas, float tile = 16.f) {
    int cols = 0;
    for (const auto& l : lineas) cols = std::max(cols, static_cast<int>(l.size()));
    Grilla g(cols, static_cast<int>(lineas.size()), tile);
    for (int f = 0; f < g.filas; ++f)
      for (int c = 0; c < static_cast<int>(lineas[f].size()); ++c) {
        const char ch = lineas[f][c];
        g.poner(c, f, ch == '#' ? Celda::Roca : ch == '=' ? Celda::Plataforma : ch == '^' ? Celda::Pinchos : Celda::Vacio);
      }
    return g;
  }
  Celda celda(int c, int f) const { return (c < 0 || f < 0 || c >= cols || f >= filas) ? fuera : datos_[static_cast<size_t>(f * cols + c)]; }
  void poner(int c, int f, Celda v) {
    if (c >= 0 && f >= 0 && c < cols && f < filas) datos_[static_cast<size_t>(f * cols + c)] = v;
  }
  bool solida(int c, int f) const { return celda(c, f) == Celda::Roca; }
  /// Autotile 4 bits: 1 arriba · 2 der · 4 abajo · 8 izq.
  uint8_t mascara(int c, int f) const {
    return static_cast<uint8_t>((solida(c, f - 1) ? 0 : 1) | (solida(c + 1, f) ? 0 : 2) | (solida(c, f + 1) ? 0 : 4) | (solida(c - 1, f) ? 0 : 8));
  }

  int cols, filas;
  float tile;
  Celda fuera;

 private:
  std::vector<Celda> datos_;
};

struct Cuerpo {
  float x = 0, y = 0, w = 10, h = 20, vx = 0, vy = 0, antX = 0, antY = 0;
  bool enSuelo = false, techo = false, pinchos = false;
  int pared = 0;
};

inline bool rectLibre(const Grilla& g, float x, float y, float w, float h) {
  const float t = g.tile;
  for (int f = static_cast<int>(std::floor(y / t)); f <= static_cast<int>(std::floor((y + h - 0.01f) / t)); ++f)
    for (int c = static_cast<int>(std::floor(x / t)); c <= static_cast<int>(std::floor((x + w - 0.01f) / t)); ++c)
      if (g.solida(c, f)) return false;
  return true;
}

inline void mover(Cuerpo& cu, const Grilla& g, float dt, bool atravesar = false, int esquinas = 0) {
  const float t = g.tile, eps = 0.001f;
  cu.antX = cu.x;
  cu.antY = cu.y;
  cu.pared = 0;
  cu.techo = cu.pinchos = false;
  if (cu.vx != 0.f) {
    cu.x += cu.vx * dt;
    const int f0 = static_cast<int>(std::floor(cu.y / t)), f1 = static_cast<int>(std::floor((cu.y + cu.h - eps) / t));
    const int col = cu.vx > 0 ? static_cast<int>(std::floor((cu.x + cu.w - eps) / t)) : static_cast<int>(std::floor(cu.x / t));
    for (int f = f0; f <= f1; ++f) {
      if (!g.solida(col, f)) continue;
      if (esquinas > 0) {  // subir cornisa baja
        const float borde = std::floor((cu.y + cu.h - 0.01f) / t) * t, sube = cu.y + cu.h - borde;
        if (sube > 0 && sube <= esquinas && rectLibre(g, cu.x, cu.y - sube - 0.01f, cu.w, cu.h) && !g.solida(col, static_cast<int>(std::floor((borde - 1) / t)))) {
          cu.y -= sube + 0.01f;
          break;
        }
      }
      if (cu.vx > 0) { cu.x = col * t - cu.w; cu.pared = 1; } else { cu.x = (col + 1) * t; cu.pared = -1; }
      cu.vx = 0;
      break;
    }
  }
  const float pieAntes = cu.y + cu.h;
  cu.y += cu.vy * dt;
  cu.enSuelo = false;
  const int c0 = static_cast<int>(std::floor(cu.x / t)), c1 = static_cast<int>(std::floor((cu.x + cu.w - eps) / t));
  if (cu.vy >= 0) {
    const int fila = static_cast<int>(std::floor((cu.y + cu.h - eps) / t));
    const float tope = fila * t;
    for (int c = c0; c <= c1; ++c) {
      const Celda cel = g.celda(c, fila);
      if (cel == Celda::Roca || (cel == Celda::Plataforma && !atravesar && pieAntes <= tope + 0.5f)) {
        cu.y = tope - cu.h; cu.vy = 0; cu.enSuelo = true;
        break;
      }
    }
  } else {
    const int fila = static_cast<int>(std::floor(cu.y / t));
    for (int c = c0; c <= c1; ++c) {
      if (!g.solida(c, fila)) continue;
      bool deslizo = false;
      for (int d = 1; d <= esquinas && !deslizo; ++d)
        for (int lado : {-1, 1})
          if (!deslizo && rectLibre(g, cu.x + lado * d, cu.y, cu.w, cu.h)) { cu.x += static_cast<float>(lado * d); deslizo = true; }
      if (deslizo) break;
      cu.y = (fila + 1) * t; cu.vy = 0; cu.techo = true;
      break;
    }
  }
  const int fPie = static_cast<int>(std::floor((cu.y + cu.h - 1) / t));
  for (int c = static_cast<int>(std::floor((cu.x + 2) / t)); c <= static_cast<int>(std::floor((cu.x + cu.w - 2) / t)); ++c)
    if (g.celda(c, fPie) == Celda::Pinchos) cu.pinchos = true;
}

// ------------------------------------------------------------------ Daño y balance

inline double mitigacion(double defensa, double k) { return k / (k + std::max(0.0, defensa)); }
inline double redondearJs(double x) { return std::floor(x + 0.5); }

struct Poder { double golpe, vida, defensa, resistencia; };

inline Poder poderEsperado(double nivel) {
  const double p = std::max(1.0, nivel), q = std::min(p, 24.0), hondo = p > 24 ? std::pow(p / 24, 0.8) : 1.0;
  return {30 * std::pow(q, 0.93) * hondo, 115 * std::pow(q, 0.78) * hondo, 12 * std::pow(q, 0.92) * (p > 24 ? p / 24 : 1.0), std::min(0.12, 0.005 * p)};
}

struct StatsEnemigo { double vida, ataque, defensa, exp; };

inline double pasaAlJugador(double nivel) {
  const Poder pe = poderEsperado(nivel);
  return mitigacion(pe.defensa, std::max(30.0, 1.5 * pe.defensa)) * (1 - pe.resistencia);
}

inline StatsEnemigo enemigoEsperado(double nivel) {
  const double p = std::max(0.0, nivel - 1), def = 1 + 0.45 * p;
  const Poder pe = poderEsperado(nivel);
  return {redondearJs(6 * pe.golpe * mitigacion(def, 60)), redondearJs(pe.vida / (11 * pasaAlJugador(nivel))), redondearJs(def), redondearJs(1 + 0.8 * p)};
}

// ------------------------------------------------------------------ Ruido

inline double hash2(int32_t x, int32_t y, int32_t semilla = 0) {
  uint32_t h = static_cast<uint32_t>(x) * 374761393u + static_cast<uint32_t>(y) * 668265263u + static_cast<uint32_t>(semilla) * 2147483647u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return static_cast<double>(h ^ (h >> 16u)) / 4294967296.0;
}

inline double ruidoValor(double x, double y, int32_t semilla = 0) {
  auto suave = [](double t) { return t * t * t * (t * (t * 6 - 15) + 10); };
  auto mezcla = [](double a, double b, double t) { return a + (b - a) * t; };
  const int xi = static_cast<int>(std::floor(x)), yi = static_cast<int>(std::floor(y));
  const double tx = suave(x - xi), ty = suave(y - yi);
  return mezcla(mezcla(hash2(xi, yi, semilla), hash2(xi + 1, yi, semilla), tx), mezcla(hash2(xi, yi + 1, semilla), hash2(xi + 1, yi + 1, semilla), tx), ty);
}

}  // namespace ludokit
