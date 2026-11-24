// ludokit.hpp — núcleo de ludokit en C++17, header-only, sin dependencias.
//
// Para integrar en motores C++ (Unreal, motores propios, consolas, servidores de muy baja latencia) las mismas
// reglas y los mismos números que la referencia TypeScript/Rust: azar determinista (PCG32, mulberry32), física 2D
// por tiles con corrección de esquinas, curvas de escalado sin tope, daño con defensa de rendimiento decreciente,
// modelo de poder esperado (configurable con curvas) y ruido.
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
#include <utility>
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

// Curva de escalado: mismo formato y resultados que `nucleo/escalado.ts` (x = nivel, 1 = el primero). Sin tope.
struct Curva {
  enum class Tipo { Constante, Lineal, Potencia, Exponencial, Saturacion, Logistica, Tramos, Escalones, TopeSuave, Limitar, Producto, Suma, Desplazar, Escalar };
  Tipo tipo = Tipo::Constante;
  double a = 0, b = 0, c = 0;  // parámetros según el tipo (ver fábricas)
  bool lineal = false;          // tramos: extrapolar con la última pendiente
  std::vector<std::pair<double, double>> puntos;
  std::vector<Curva> hijas;     // topeSuave/limitar/desplazar/escalar: una; producto/suma: varias

  static Curva constante(double v) { Curva k; k.tipo = Tipo::Constante; k.a = v; return k; }
  static Curva linealC(double base, double porNivel) { Curva k; k.tipo = Tipo::Lineal; k.a = base; k.b = porNivel; return k; }
  static Curva potencia(double base, double exp) { Curva k; k.tipo = Tipo::Potencia; k.a = base; k.b = exp; return k; }
  static Curva exponencial(double base, double razon) { Curva k; k.tipo = Tipo::Exponencial; k.a = base; k.b = razon; return k; }
  static Curva saturacion(double mitad, double exp = 1) { Curva k; k.tipo = Tipo::Saturacion; k.a = mitad; k.b = exp; return k; }
  static Curva logistica(double centro, double pendiente) { Curva k; k.tipo = Tipo::Logistica; k.a = centro; k.b = pendiente; return k; }
  static Curva tramos(std::vector<std::pair<double, double>> p, bool extrapolarLineal = false) { Curva k; k.tipo = Tipo::Tramos; k.puntos = std::move(p); k.lineal = extrapolarLineal; return k; }
  static Curva escalones(std::vector<std::pair<double, double>> p, double inicial = 0) { Curva k; k.tipo = Tipo::Escalones; k.puntos = std::move(p); k.a = inicial; return k; }
  static Curva topeSuave(Curva h, double desde, double exp) { Curva k; k.tipo = Tipo::TopeSuave; k.hijas = {std::move(h)}; k.a = desde; k.b = exp; return k; }
  static Curva limitar(Curva h, double mn, double mx) { Curva k; k.tipo = Tipo::Limitar; k.hijas = {std::move(h)}; k.a = mn; k.b = mx; return k; }
  static Curva producto(std::vector<Curva> hs) { Curva k; k.tipo = Tipo::Producto; k.hijas = std::move(hs); return k; }
  static Curva suma(std::vector<Curva> hs) { Curva k; k.tipo = Tipo::Suma; k.hijas = std::move(hs); return k; }
  static Curva desplazar(Curva h, double d) { Curva k; k.tipo = Tipo::Desplazar; k.hijas = {std::move(h)}; k.a = d; return k; }
  static Curva escalar(Curva h, double v) { Curva k; k.tipo = Tipo::Escalar; k.hijas = {std::move(h)}; k.a = v; return k; }

  double evaluar(double x) const {
    auto pend = [x](std::pair<double, double> p, std::pair<double, double> q) { const double dx = q.first - p.first; return dx == 0 ? q.second : p.second + (q.second - p.second) * (x - p.first) / dx; };
    switch (tipo) {
      case Tipo::Constante: return a;
      case Tipo::Lineal: return a + b * (x - 1);
      case Tipo::Potencia: return a * std::pow(std::max(0.0, x), b);
      case Tipo::Exponencial: return a * std::pow(b, x - 1);
      case Tipo::Saturacion: { const double d = std::pow(std::max(0.0, x - 1), b); return d / (d + std::pow(std::max(1e-9, a), b)); }
      case Tipo::Logistica: { auto f = [this](double v) { return 1 / (1 + std::exp(-b * (v - a))); }; return std::max(0.0, (f(x) - f(1)) / (1 - f(1))); }
      case Tipo::Tramos: {
        if (puntos.empty()) return 0;
        if (puntos.size() == 1) return puntos[0].second;
        if (x <= puntos[0].first) return lineal ? pend(puntos[0], puntos[1]) : puntos[0].second;
        for (size_t i = 1; i < puntos.size(); ++i) if (x <= puntos[i].first) return pend(puntos[i - 1], puntos[i]);
        const size_t n = puntos.size() - 1;
        return lineal ? pend(puntos[n - 1], puntos[n]) : puntos[n].second;
      }
      case Tipo::Escalones: { double v = a; for (const auto& p : puntos) if (x >= p.first) v = p.second; return v; }
      case Tipo::TopeSuave: return x <= a ? hijas[0].evaluar(x) : hijas[0].evaluar(a) * std::pow(x / a, b);
      case Tipo::Limitar: return std::min(b, std::max(a, hijas[0].evaluar(x)));
      case Tipo::Producto: { double r = 1; for (const auto& h : hijas) r *= h.evaluar(x); return r; }
      case Tipo::Suma: { double r = 0; for (const auto& h : hijas) r += h.evaluar(x); return r; }
      case Tipo::Desplazar: return hijas[0].evaluar(x + a);
      case Tipo::Escalar: return a * hijas[0].evaluar(x);
    }
    return 0;
  }
};

struct Poder { double golpe, vida, defensa, resistencia; };
struct StatsEnemigo { double vida, ataque, defensa, exp; };
struct CurvaPoder { Curva golpe, vida, defensa, resistencia; };

struct ReglasBalance {
  double golpesParaMatar, golpesParaMorir, kEnemigo, kJugadorFactor, kJugadorMin;
  Curva defensaEnemigo, expEnemigo;
  double ritmoJugador;
  Curva duracionJefe, aguanteJefe, defensaJefe, expJefe;
  double multVidaJefe;
};

// Modelo de balance por poder esperado (port de `balance.ModeloBalance`): sin nivel máximo.
struct ModeloBalance {
  CurvaPoder curva;
  ReglasBalance reglas;

  Poder poder(double nivel) const {
    const double p = std::max(1.0, nivel);
    return {curva.golpe.evaluar(p), curva.vida.evaluar(p), curva.defensa.evaluar(p), std::min(0.95, std::max(0.0, curva.resistencia.evaluar(p)))};
  }
  double kJugador(double nivel) const { return std::max(reglas.kJugadorMin, reglas.kJugadorFactor * poder(nivel).defensa); }
  double pasaAlJugador(double nivel) const { const Poder pe = poder(nivel); return mitigacion(pe.defensa, kJugador(nivel)) * (1 - pe.resistencia); }

  StatsEnemigo enemigo(double nivel, double pesoVida = 1, double pesoAtaque = 1) const {
    const double n = std::max(1.0, nivel), def = reglas.defensaEnemigo.evaluar(n);
    const Poder pe = poder(n);
    return {redondearJs(reglas.golpesParaMatar * pe.golpe * mitigacion(def, reglas.kEnemigo) * pesoVida),
            redondearJs(pe.vida / (reglas.golpesParaMorir * pasaAlJugador(n)) * pesoAtaque), redondearJs(def), redondearJs(reglas.expEnemigo.evaluar(n))};
  }

  StatsEnemigo jefe(double nivel, double* duracion = nullptr, double peso = 1) const {
    const double n = std::max(1.0, nivel), def = reglas.defensaJefe.evaluar(n), dur = reglas.duracionJefe.evaluar(n);
    const double aguante = std::max(1.0, reglas.aguanteJefe.evaluar(n));
    const Poder pe = poder(n);
    if (duracion) *duracion = dur;
    return {redondearJs(pe.golpe * mitigacion(def, reglas.kEnemigo) * reglas.ritmoJugador * dur * peso * reglas.multVidaJefe),
            redondearJs(pe.vida / (aguante * pasaAlJugador(n))), redondearJs(def), redondearJs(reglas.expJefe.evaluar(n))};
  }
};

// Pesos de rareza por nivel sin tope: mezcla primero → ultimo con una curva de progreso 0..1.
inline std::vector<double> pesosRareza(const std::vector<double>& primero, const std::vector<double>& ultimo, const Curva& progreso, double nivel, const std::vector<double>& factor = {}) {
  const double k = std::min(1.0, std::max(0.0, progreso.evaluar(std::max(1.0, nivel))));
  std::vector<double> r(primero.size());
  for (size_t i = 0; i < r.size(); ++i) r[i] = (primero[i] + (ultimo[i] - primero[i]) * k) * (i < factor.size() ? factor[i] : 1.0);
  return r;
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
