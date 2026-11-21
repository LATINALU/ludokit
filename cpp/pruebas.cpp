// Pruebas del port C++ contra los vectores compartidos (valores copiados de vectores/vectores.json v1).
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
    const Poder p = poderEsperado(12);
    VERIFICAR(cerca(p.golpe, 302.523986, 1e-6) && cerca(p.vida, 798.838913, 1e-6) && cerca(p.defensa, 118.039672, 1e-6));
    const StatsEnemigo e = enemigoEsperado(12);
    VERIFICAR(e.vida == 1651 && e.ataque == 129 && e.defensa == 6 && e.exp == 10);
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
