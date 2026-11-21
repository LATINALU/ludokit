"""Pruebas de las herramientas Python contra los vectores compartidos y casos propios.

    cd python && python -I pruebas/test_herramientas.py
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from ludokit_herramientas import nucleo  # noqa: E402
from ludokit_herramientas.balance import tabla  # noqa: E402
from ludokit_herramientas.datos import validar  # noqa: E402

V = json.loads((RAIZ.parent / "vectores" / "vectores.json").read_text(encoding="utf-8"))


class Vectores(unittest.TestCase):
    def test_pcg32(self):
        for s, salidas in zip(V["pcg32"]["semillas"], V["pcg32"]["salidas"]):
            p = nucleo.Pcg32(s)
            self.assertEqual([p.u32() for _ in salidas], salidas)
        d = V["pcg32_derivar"]
        self.assertEqual(str(nucleo.derivar_semilla(d["semilla"], d["n"])), d["resultado"])

    def test_mulberry32(self):
        for s, salidas in zip(V["mulberry32"]["semillas"], V["mulberry32"]["salidas"]):
            m = nucleo.Mulberry32(s)
            for e in salidas:
                self.assertAlmostEqual(m.siguiente(), e, places=5)

    def test_balance(self):
        for m in V["mitigacion"]:
            self.assertAlmostEqual(nucleo.mitigacion(m["defensa"], m["k"]), m["resultado"], places=5)
        for p in V["poder_esperado"]:
            r = nucleo.poder_esperado(p["nivel"])
            for k in ("golpe", "vida", "defensa", "resistencia"):
                self.assertAlmostEqual(r[k], p[k], places=4)
        for e in V["enemigo_esperado"]:
            r = nucleo.enemigo_esperado(e["nivel"])
            self.assertEqual({k: r[k] for k in ("vida", "ataque", "defensa", "exp")}, {k: e[k] for k in ("vida", "ataque", "defensa", "exp")})
        for j in V["jefe_esperado"]:
            r = nucleo.jefe_esperado(j["nivel"])
            self.assertEqual((r["vida"], r["ataque"], r["defensa"], r["exp"]), (j["vida"], j["ataque"], j["defensa"], j["exp"]))
        for p in V["pesos_rareza"]:
            for a, b in zip(nucleo.pesos_rareza(p["nivel"]), p["pesos"]):
                self.assertAlmostEqual(a, b, places=4)

    def test_ruido(self):
        self.assertAlmostEqual(nucleo.hash2(1, 2, 0), V["ruido"]["hash2"][0], places=5)
        self.assertAlmostEqual(nucleo.hash2(10, -3, 7), V["ruido"]["hash2"][1], places=5)
        self.assertAlmostEqual(nucleo.ruido_valor(0.5, 0.5, 0), V["ruido"]["valor"][0], places=5)
        self.assertAlmostEqual(nucleo.ruido_valor(3.25, 7.75, 9), V["ruido"]["valor"][1], places=5)


class Herramientas(unittest.TestCase):
    def test_tabla_balance(self):
        filas = tabla(30)
        for f in filas:
            self.assertTrue(5 <= f["comun_golpes_para_matar"] <= 7, f)
            self.assertTrue(10 <= f["comun_golpes_para_morir"] <= 12, f)

    def test_validador(self):
        with tempfile.TemporaryDirectory() as d:
            c = Path(d)
            (c / "objetos.json").write_text(json.dumps([{"id": 1, "precio": 10}, {"id": 2, "precio": -5}]), encoding="utf-8")
            (c / "botin.json").write_text(json.dumps([{"id": "a", "entradas": [{"objeto": 1, "prob": 0.3}, {"objeto": 9, "prob": 30}]}]), encoding="utf-8")
            reglas = {"tablas": {
                "objetos": {"archivo": "objetos.json", "campos": {"precio": {"tipo": "numero", "min": 0}}},
                "botin": {"archivo": "botin.json", "campos": {"entradas[].objeto": {"ref": "objetos"}, "entradas[].prob": {"tipo": "prob"}}},
            }}
            errores = validar(reglas, c)
            self.assertEqual(len(errores), 3, errores)
            self.assertTrue(any("no existe en 'objetos'" in e for e in errores))
            self.assertTrue(any("¿escrita en %?" in e for e in errores))

    def test_sprites(self):
        try:
            from PIL import Image, ImageDraw
            from ludokit_herramientas.sprites import armar_hoja, girar_tono, normalizar_tira
        except ImportError:
            self.skipTest("Pillow/NumPy no instalados")
        cuadros = []
        for i in range(4):
            im = Image.new("RGBA", (64, 64))
            dr = ImageDraw.Draw(im)
            dr.ellipse((10 + i, 10, 50 + i, 60), fill=(200, 80, 40, 255))
            dr.point((2, 2), fill=(255, 255, 255, 255))  # chispa suelta: debe desaparecer
            cuadros.append(im)
        tira = normalizar_tira(cuadros, alto=24)
        self.assertTrue(all(c.size == tira[0].size and c.size[1] == 24 for c in tira))
        import numpy as np
        alfas = {int(a) for c in tira for a in np.unique(np.asarray(c.getchannel("A")))}
        self.assertEqual(alfas, {0, 255}, "alfa binaria")
        with tempfile.TemporaryDirectory() as d:
            idx = armar_hoja(tira, Path(d) / "bicho", fps=12)
            self.assertEqual(idx["cuadros"], 4)
            self.assertTrue((Path(d) / "bicho_sil.png").exists())
        self.assertEqual(girar_tono(tira[0], 120).size, tira[0].size)


class CatalogoYDiff(unittest.TestCase):
    def test_catalogo_generar_y_auditar(self):
        from ludokit_herramientas.catalogo import auditar, generar
        with tempfile.TemporaryDirectory() as d:
            c = Path(d)
            (c / "cat.csv").write_text("id;nombre;precio;pestana;vendible" + chr(10) + "1;Poción;20;0;1" + chr(10) + "2;Espada;300;1;1" + chr(10) + "3;Secreto;9;1;0" + chr(10), encoding="utf-8")
            destinos = {"cliente": {"archivo": "cli/tienda.json", "campos": ["id", "nombre", "precio"], "agrupar": "pestana", "filtro": {"vendible": 1}},
                        "servidor": {"archivo": "srv/tienda.json", "campos": ["id", "precio"], "filtro": {"vendible": 1}}}
            generar(c / "cat.csv", destinos, c)
            cli = json.loads((c / "cli/tienda.json").read_text(encoding="utf-8"))
            self.assertEqual(cli["1"], [{"id": 2, "nombre": "Espada", "precio": 300}])
            self.assertEqual(auditar(c / "cat.csv", destinos, c), [])
            (c / "srv/tienda.json").write_text(json.dumps([{"id": 1, "precio": 20}, {"id": 2, "precio": 299}]), encoding="utf-8")
            errores = auditar(c / "cat.csv", destinos, c)
            self.assertTrue(any("299" in e for e in errores) and any("300" in e for e in errores), errores)

    def test_diff_y_notas(self):
        from ludokit_herramientas.diff_datos import diff, notas
        v = [{"id": "a", "vida": 10, "nombre": "x"}, {"id": "b", "vida": 5}]
        n = [{"id": "a", "vida": 12, "nombre": "x"}, {"id": "c", "vida": 1}]
        d = diff(v, n)
        self.assertEqual(d["agregados"], ["c"])
        self.assertEqual(d["quitados"], ["b"])
        self.assertEqual(d["cambiados"], {"a": {"vida": (10, 12)}})
        self.assertIn("~ a: vida 10 → 12 ▲", notas(d))


class MedirSprites(unittest.TestCase):
    def test_alcance_y_hitbox(self):
        try:
            import numpy as np
            from ludokit_herramientas.medir_sprites import medir_cuadro
        except ImportError:
            self.skipTest("NumPy no instalado")
        a = np.zeros((20, 20), np.uint8)
        a[8:20, 8:12] = 255   # cuerpo
        a[10, 12:19] = 255    # espada fina hacia adelante
        m = medir_cuadro(a, (10, 19))
        self.assertEqual(m["alcance"]["adelante"], 8)
        self.assertEqual(m["hitbox"]["w"], 4, "la espada fina no entra en la hitbox")


if __name__ == "__main__":
    unittest.main()
