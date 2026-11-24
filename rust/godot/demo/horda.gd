# Demo visual: miles de zombis (cajas) persiguen al objetivo por un mapa con muros, simulados en Rust y dibujados con
# un solo MultiMesh. Clic izquierdo: mover el objetivo. Clic derecho: disparar un rayo desde la cámara (borra al
# zombi alcanzado, resuelto por LudoEscena3D). + / -: sumar o quitar 2 000 zombis.
extends Node3D

const COLS := 160
const FILAS := 160

var horda := LudoHorda.new()
var escena := LudoEscena3D.new()
var multimesh := MultiMesh.new()
var bloqueo := PackedByteArray()
var objetivo := Vector2i(80, 80)
var marcador: MeshInstance3D
var camara: Camera3D
var hud: Label
var ms_paso := 0.0
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed = 1
	_armar_mapa()
	horda.configurar(COLS, FILAS, 1.0, bloqueo)
	horda.reglas(5.0, 25.0, 0.8, 4.0)
	horda.usar_hilos(0)
	_sumar(6000)
	horda.objetivo(objetivo)

	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	var caja := BoxMesh.new()
	caja.size = Vector3(0.5, 1.0, 0.5)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.45, 0.75, 0.35)
	caja.material = mat
	multimesh.mesh = caja
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = multimesh
	add_child(mmi)

	_agregar_suelo_y_muros()
	marcador = MeshInstance3D.new()
	var esfera := SphereMesh.new()
	esfera.radius = 1.2
	esfera.height = 2.4
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color(1, 0.3, 0.2)
	mm.emission_enabled = true
	mm.emission = Color(1, 0.3, 0.2)
	esfera.material = mm
	marcador.mesh = esfera
	add_child(marcador)
	_mover_marcador()

	camara = Camera3D.new()
	camara.position = Vector3(80, 120, 175)
	add_child(camara)
	camara.look_at(Vector3(80, 0, 80))
	var luz := DirectionalLight3D.new()
	luz.rotation_degrees = Vector3(-55, -30, 0)
	add_child(luz)
	var entorno := WorldEnvironment.new()
	entorno.environment = Environment.new()
	entorno.environment.background_mode = Environment.BG_COLOR
	entorno.environment.background_color = Color(0.08, 0.09, 0.11)
	entorno.environment.ambient_light_color = Color(0.5, 0.5, 0.55)
	entorno.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	add_child(entorno)
	hud = Label.new()
	hud.position = Vector2(12, 12)
	var capa := CanvasLayer.new()
	capa.add_child(hud)
	add_child(capa)

func _armar_mapa() -> void:
	bloqueo.resize(COLS * FILAS)
	for f in range(20, 140):
		bloqueo[f * COLS + 50] = 1
		bloqueo[f * COLS + 110] = 1
	for c in range(50, 111):
		if c < 70 or c > 90:
			bloqueo[30 * COLS + c] = 1

func _agregar_suelo_y_muros() -> void:
	var suelo := MeshInstance3D.new()
	var plano := PlaneMesh.new()
	plano.size = Vector2(COLS, FILAS)
	suelo.mesh = plano
	suelo.position = Vector3(COLS / 2.0, 0, FILAS / 2.0)
	add_child(suelo)
	var muros := MultiMesh.new()
	muros.transform_format = MultiMesh.TRANSFORM_3D
	var bloque := BoxMesh.new()
	bloque.size = Vector3(1, 2, 1)
	var gris := StandardMaterial3D.new()
	gris.albedo_color = Color(0.35, 0.35, 0.4)
	bloque.material = gris
	muros.mesh = bloque
	var celdas := []
	for i in bloqueo.size():
		if bloqueo[i] != 0:
			celdas.append(i)
	muros.instance_count = celdas.size()
	for k in celdas.size():
		var i: int = celdas[k]
		muros.set_instance_transform(k, Transform3D(Basis(), Vector3(i % COLS + 0.5, 1, i / COLS + 0.5)))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = muros
	add_child(mi)

func _sumar(n: int) -> void:
	for i in n:
		var c := rng.randi_range(1, 40) if rng.randf() < 0.5 else rng.randi_range(120, 158)
		horda.agregar(Vector2(c + rng.randf(), rng.randf_range(1, FILAS - 1)))

func _mover_marcador() -> void:
	marcador.position = Vector3(objetivo.x + 0.5, 1.2, objetivo.y + 0.5)

func _physics_process(delta: float) -> void:
	var t := Time.get_ticks_usec()
	horda.paso(delta)
	ms_paso = lerpf(ms_paso, (Time.get_ticks_usec() - t) / 1000.0, 0.1)

var cuadros := 0

func _process(_delta: float) -> void:
	horda.escribir_multimesh(multimesh, 0.5)
	# `godot --path demo -- --captura`: guarda captura.png a los 8 s y sale (para documentación y verificación).
	cuadros += 1
	if Time.get_ticks_msec() > 8000 and cuadros > 0 and OS.get_cmdline_user_args().has("--captura"):
		cuadros = -1000000
		get_viewport().get_texture().get_image().save_png("res://captura.png")
		get_tree().quit()
	hud.text = "ludokit + Rust · %d zombis · %.2f ms por paso (%d FPS)\nClic izq: objetivo · Clic der: disparar · +/-: zombis" % [horda.cantidad(), ms_paso, Engine.get_frames_per_second()]

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed:
		if ev.keycode == KEY_KP_ADD or ev.keycode == KEY_PLUS or ev.keycode == KEY_EQUAL:
			_sumar(2000)
		elif ev.keycode == KEY_KP_SUBTRACT or ev.keycode == KEY_MINUS:
			for i in mini(2000, horda.cantidad()):
				horda.quitar(horda.cantidad() - 1)
	if ev is InputEventMouseButton and ev.pressed:
		var origen := camara.project_ray_origin(ev.position)
		var dir := camara.project_ray_normal(ev.position)
		if ev.button_index == MOUSE_BUTTON_LEFT and dir.y < 0:
			var punto := origen + dir * (-origen.y / dir.y)
			var celda := Vector2i(clampi(int(punto.x), 0, COLS - 1), clampi(int(punto.z), 0, FILAS - 1))
			if bloqueo[celda.y * COLS + celda.x] == 0:
				objetivo = celda
				horda.objetivo(objetivo)
				_mover_marcador()
		elif ev.button_index == MOUSE_BUTTON_RIGHT:
			_disparar(origen, dir)

# Disparo: se arma la escena de hitboxes con las posiciones actuales y se lanza un rayo (núcleo Rust).
func _disparar(origen: Vector3, dir: Vector3) -> void:
	escena.limpiar()
	var pos := horda.posiciones()
	for i in pos.size():
		escena.agregar_capsula(i, i, 1, Vector3(pos[i].x, 0.25, pos[i].y), Vector3(pos[i].x, 0.75, pos[i].y), 0.3)
	var h: Dictionary = escena.lanzar_rayo(origen, dir, 500.0, -1)
	if not h.is_empty():
		horda.quitar(h["duenio"])
