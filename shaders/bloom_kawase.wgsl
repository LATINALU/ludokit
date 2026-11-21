// Bloom Dual-Kawase: se extrae el brillo (solo lo emisivo, o lo que supere un umbral), se baja 3 veces a la mitad
// con 5 lecturas en diagonal y se sube 2 veces con 8 lecturas. Halo limpio y estable, mucho más barato que un
// gaussiano grande. Cadena: fs_extraer → fs_bajar ×3 (1/2, 1/4, 1/8) → fs_subir ×2 (1/4, 1/2) → sumar en la
// composición. Aplicarlo SOLO al emisivo evita el "todo brilla" que lava el pixel art.

struct Bloom {
    // 0,5 / tamaño de la textura de ORIGEN (xy), umbral (z), suavidad del umbral (w)
    p: vec4<f32>,
};

@group(0) @binding(0) var<uniform> B: Bloom;
@group(0) @binding(1) var origen: texture_2d<f32>;
@group(0) @binding(2) var lineal: sampler;

struct Salida {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> Salida {
    let x = f32((i << 1u) & 2u);
    let y = f32(i & 2u);
    var s: Salida;
    s.pos = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    s.uv = vec2<f32>(x, y);
    return s;
}

// Umbral suave: lo que supera `umbral` pasa, con una rodilla de ancho `suavidad`.
@fragment
fn fs_extraer(e: Salida) -> @location(0) vec4<f32> {
    let c = textureSample(origen, lineal, e.uv).rgb;
    let brillo = max(c.r, max(c.g, c.b));
    let rodilla = max(B.p.w, 1e-4);
    let s = clamp((brillo - B.p.z + rodilla) / (2.0 * rodilla), 0.0, 1.0);
    return vec4<f32>(c * s * s, 1.0);
}

@fragment
fn fs_bajar(e: Salida) -> @location(0) vec4<f32> {
    let h = B.p.xy;
    var c = textureSample(origen, lineal, e.uv).rgb * 4.0;
    c = c + textureSample(origen, lineal, e.uv - h).rgb;
    c = c + textureSample(origen, lineal, e.uv + h).rgb;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(h.x, -h.y)).rgb;
    c = c + textureSample(origen, lineal, e.uv - vec2<f32>(h.x, -h.y)).rgb;
    return vec4<f32>(c / 8.0, 1.0);
}

@fragment
fn fs_subir(e: Salida) -> @location(0) vec4<f32> {
    let h = B.p.xy;
    var c = textureSample(origen, lineal, e.uv + vec2<f32>(-h.x * 2.0, 0.0)).rgb;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(-h.x, h.y)).rgb * 2.0;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(0.0, h.y * 2.0)).rgb;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(h.x, h.y)).rgb * 2.0;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(h.x * 2.0, 0.0)).rgb;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(h.x, -h.y)).rgb * 2.0;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(0.0, -h.y * 2.0)).rgb;
    c = c + textureSample(origen, lineal, e.uv + vec2<f32>(-h.x, -h.y)).rgb * 2.0;
    return vec4<f32>(c / 12.0, 1.0);
}
