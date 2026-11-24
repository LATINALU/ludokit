# Prueba headless de la extensión: ejercita LudoEscena3D, LudoHorda, LudoNiebla y LudoCurva y mide tiempos.
# godot --headless --path rust/godot/demo --script res://prueba.gd     (sale con código 1 si algo falla)
extends SceneTree

var fallos := 0

func comprobar(cond: bool, texto: String) -> void:
	if cond:
		print("  ok  ", texto)
	else:
		fallos += 1
		printerr("  FALLA  ", texto)

func _init() -> void:
	print("== ludokit GDExtension")
	comprobar(ClassDB.class_exists("LudoEscena3D") and ClassDB.class_exists("LudoHorda"), "clases registradas")

	# --- Disparos: una pared de madera (material penetrable) y un personaje con cabeza y torso.
	var e := LudoEscena3D.new()
	e.configurar(4.0)
	e.definir_material(100, 12.0)
	e.agregar_caja(1, -1, 100, Vector3(-2, 0, 5), Vector3(2, 3, 5.1))
	e.agregar_esfera(2, 7, 1, Vector3(0, 1.7, 10), 0.15)
	e.agregar_capsula(3, 7, 2, Vector3(0, 0.2, 10), Vector3(0, 1.3, 10), 0.3)
	var h: Dictionary = e.lanzar_rayo(Vector3(0, 1.7, 0), Vector3(0, 0, 1), 100.0, -1)
	comprobar(h.get("id") == 1, "el rayo pega primero en la pared (id %s)" % h.get("id"))
	var p: Array = e.disparo_penetrante(Vector3(0, 1.7, 0), Vector3(0, 0, 1), 100.0, -1, 40.0, 25.0)
	comprobar(p.size() == 1 and p[0]["duenio"] == 7 and p[0]["etiqueta"] == 1, "la bala atraviesa la madera y da en la cabeza")
	comprobar(absf(p[0]["fraccion"] - 0.7) < 0.001, "pierde poder al atravesar (fracción %.2f)" % p[0]["fraccion"])

	# Lote: 2 000 personajes y 20 000 rayos en una llamada.
	var escena := LudoEscena3D.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 2000:
		var x := rng.randf_range(-100, 100)
		var z := rng.randf_range(-100, 100)
		escena.agregar_capsula(i, i, 1, Vector3(x, 0.3, z), Vector3(x, 1.5, z), 0.35)
	var origenes := PackedVector3Array()
	var dirs := PackedVector3Array()
	for i in 20000:
		origenes.push_back(Vector3(rng.randf_range(-100, 100), 1.2, rng.randf_range(-100, 100)))
		dirs.push_back(Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.05, 0.05), rng.randf_range(-1, 1)))
	var t := Time.get_ticks_usec()
	var res: PackedFloat32Array = escena.lanzar_rayos(origenes, dirs, 150.0, PackedInt32Array())
	var ms := (Time.get_ticks_usec() - t) / 1000.0
	var pegaron := 0
	for i in 20000:
		if res[i * 4 + 3] >= 0.0:
			pegaron += 1
	comprobar(res.size() == 80000 and pegaron > 1000, "20 000 rayos contra 2 000 cápsulas en %.1f ms (%d impactos)" % [ms, pegaron])

	# --- Horda: 10 000 agentes hacia el centro de un mapa con una pared.
	var bloqueo := PackedByteArray()
	bloqueo.resize(128 * 128)
	for f in range(20, 100):
		bloqueo[f * 128 + 64] = 1
	var horda := LudoHorda.new()
	horda.configurar(128, 128, 1.0, bloqueo)
	horda.reglas(4.0, 20.0, 0.6, 2.0)
	horda.usar_hilos(0)
	for i in 10000:
		horda.agregar(Vector2(rng.randf_range(1, 40), rng.randf_range(1, 127)))
	horda.objetivo(Vector2i(110, 64))
	var d0 := horda.distancia_objetivo(horda.posicion(0))
	t = Time.get_ticks_usec()
	for paso in 120:
		horda.paso(1.0 / 60.0)
	ms = (Time.get_ticks_usec() - t) / 1000.0
	var d1 := horda.distancia_objetivo(horda.posicion(0))
	comprobar(d1 < d0, "la horda avanza hacia el objetivo (%.1f -> %.1f celdas)" % [d0, d1])
	comprobar(horda.posiciones().size() == 10000, "10 000 agentes, 120 pasos en %.1f ms (%.2f ms/paso)" % [ms, ms / 120.0])
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	horda.escribir_multimesh(mm, 0.5)
	# Se lee el búfer (en modo headless el servidor de render es ficticio y get_instance_transform no se actualiza).
	var buf := mm.buffer
	var pos0 := horda.posicion(0)
	comprobar(mm.instance_count == 10000 and absf(buf[3] - pos0.x) < 0.001 and absf(buf[7] - 0.5) < 0.001 and absf(buf[11] - pos0.y) < 0.001, "MultiMesh escrito en una llamada (10 000 instancias)")

	# --- Niebla de guerra.
	var n := LudoNiebla.new()
	var muro := PackedByteArray()
	muro.resize(20 * 12)
	for f in 12:
		muro[f * 20 + 10] = 1
	n.configurar(20, 12, muro)
	var celdas: PackedByteArray = n.actualizar(PackedVector3Array([Vector3(4, 6, 8)]))
	comprobar(celdas.size() == 240 and n.estado(Vector2i(6, 6)) == 2 and n.estado(Vector2i(14, 6)) == 0, "niebla: ve su lado, no detrás del muro")
	comprobar(not n.hay_linea(Vector2i(4, 6), Vector2i(14, 6)), "línea de visión bloqueada")

	# --- Curvas (mismo JSON que en TypeScript).
	var c := LudoCurva.new()
	var err := c.cargar(JSON.parse_string('{"tipo":"topeSuave","curva":{"tipo":"potencia","base":25,"exp":0.95},"desde":50,"exp":0.7}'))
	comprobar(err == "" and absf(c.evaluar(1) - 25.0) < 0.001 and c.evaluar(1000) > c.evaluar(100), "curva sin tope desde JSON")
	comprobar(c.cargar({"tipo": "inventada"}) != "", "curva inválida informa el error")

	print("== %s" % ("todo ok" if fallos == 0 else "%d fallos" % fallos))
	quit(1 if fallos > 0 else 0)
