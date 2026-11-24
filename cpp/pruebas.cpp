// Pruebas del port C++ contra los vectores compartidos (valores copiados de vectores/vectores.json v2).
// Compilar:  g++ -std=c++17 -O2 -Wall -Wextra pruebas.cpp -o pruebas && ./pruebas
//            cl /std:c++17 /EHsc /W4 pruebas.cpp && pruebas.exe
#include <cstdio>
#include <cstdlib>
#include "ludokit.hpp"

static int fallos = 0;
#define VERIFICAR(c) do { if (!(c)) { std::printf("FALLA %s:%d  %s\n", __FILE__, __LINE__, #c); ++fallos; } } while (0)
static bool cerca(double a, double b, double tol) { return std::fabs(a - b) <= tol * std::max(1.0, std::fabs(b)); }

int main() {
  using namespace ludokit;
  {
    Pcg32 p(42);
    const uint32_t esperado[] = {3413346080u, 3508673569u, 3540666473u, 2418394718u, 3479502473u, 1971234469u, 1351393083u, 267883417u};
    for (uint32_t e : esperado) VERIFICAR(p.u32() == e);
    Pcg32 q(0);
    VERIFICAR(q.u32() == 1774745655u);
    VERIFICAR(derivarSemilla(7, 3) == 15755400384260043846ULL);
  }
  {
    Mulberry32 m(1);
    VERIFICAR(cerca(m.siguiente(), 0.627074, 1e-5));
    VERIFICAR(cerca(m.siguiente(), 0.002736, 1e-3));
  }
  VERIFICAR(cerca(mitigacion(120, 60), 0.333333, 1e-5));
  {
    // Modelo de los vectores (modelo_balance): PODER_RPG + BALANCE_ACCION de `modelos/piezas.ts`.
    using C = Curva;
    ModeloBalance m{
      {C::topeSuave(C::potencia(25, 0.95), 50, 0.7), C::topeSuave(C::potencia(110, 0.8), 50, 0.6), C::topeSuave(C::potencia(10, 0.95), 50, 0.8), C::limitar(C::linealC(0, 0.004), 0, 0.15)},
      {5, 12, 60, 1.5, 30, C::linealC(1, 0.5), C::linealC(2, 1), 2, C::limitar(C::linealC(45, 1.5), 0, 150), C::limitar(C::linealC(8, -0.1), 5, 8), C::linealC(6, 1.5), C::linealC(100, 80), 2},
    };
    const Poder p = m.poder(12);
    VERIFICAR(cerca(p.golpe, 264.948944, 1e-6) && cerca(p.vida, 803.040931, 1e-6) && cerca(p.defensa, 105.979577, 1e-6));
    const StatsEnemigo e = m.enemigo(12);
    VERIFICAR(e.vida == 1195 && e.ataque == 117 && e.defensa == 7 && e.exp == 13);
    double dur = 0;
    const StatsEnemigo j = m.jefe(12, &dur);
    VERIFICAR(j.vida == 47402 && j.ataque == 203 && j.defensa == 23 && j.exp == 980 && cerca(dur, 61.5, 1e-9));
    const StatsEnemigo e300 = m.enemigo(300);
    VERIFICAR(e300.vida == 5135 && e300.ataque == 1204 && e300.defensa == 151 && e300.exp == 301);
    const std::vector<double> w = pesosRareza({70, 24, 5, 0.8, 0.15, 0.02}, {30, 34, 22, 9, 3, 0.6}, C::saturacion(30, 1.5), 12);
    VERIFICAR(cerca(w[0], 62.732482, 1e-5) && cerca(w[5], 0.125379, 1e-5));
    VERIFICAR(cerca(C::exponencial(1, 1.12).evaluar(60), 801.425833, 1e-5));
    VERIFICAR(cerca(C::saturacion(30, 1.5).evaluar(60), 0.733902, 1e-5));
    VERIFICAR(cerca(C::producto({C::linealC(1, 1), C::exponencial(2, 1.01)}).evaluar(60), 215.845152, 1e-5));
    VERIFICAR(cerca(C::escalar(C::saturacion(10), 100).evaluar(60), 85.507246, 1e-5));
    VERIFICAR(C::tramos({{0, 1}, {10, 1}, {60, 0.4}}).evaluar(60) == 0.4);
  }
  {
    const Grilla g = Grilla::desdeTexto({"#####", "#...#", "#.#.#", "#...#", "#####"});
    VERIFICAR(g.mascara(2, 2) == 15 && g.mascara(0, 0) == 9 && g.mascara(1, 1) == 6);
    const Grilla piso = Grilla::desdeTexto({"..........", "..........", "..........", "##########"});
    Cuerpo c;
    c.x = 20; c.y = 0;
    for (int i = 0; i < 60; ++i) {
      c.vy = std::min(430.f, c.vy + 1100.f / 60.f);
      mover(c, piso, 1.f / 60.f);
    }
    VERIFICAR(c.x == 20.f && c.y == 28.f && c.enSuelo);
  }
  VERIFICAR(cerca(hash2(1, 2, 0), 0.883086, 1e-5));
  VERIFICAR(cerca(hash2(10, -3, 7), 0.496876, 1e-5));
  VERIFICAR(cerca(ruidoValor(3.25, 7.75, 9), 0.836213, 1e-5));
  std::printf(fallos ? "%d FALLOS\n" : "OK: todas las pruebas pasan\n", fallos);
  return fallos ? EXIT_FAILURE : EXIT_SUCCESS;
}
