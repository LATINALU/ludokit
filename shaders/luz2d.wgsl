// Iluminación 2D diferida para vista lateral o superior: albedo + mapa de normales + emisivo, ambiente y hasta 32
// luces puntuales con atenuación suave y RELIEVE RELATIVO AL PLANO: en 2D lateral la pared ES el plano, así que una
// superficie plana recibe la luz completa y el relieve solo suma o resta: ndl = clamp(1 + 1.6·(N·L − L.z), 0.2, 1.9).
// (Con Lambert puro una antorcha baja deja todo negro a 20 px.) El emisivo se suma al final (y alimenta el bloom).
// Fuente única: luz2d.glsl se GENERA desde aquí (shaders/compilador).

struct Luz {
    // x, y (px), radio (px), altura (px sobre el plano)
    pos_radio_altura: vec4<f32>,
    // rgb, intensidad
    color: vec4<f32>,
};

struct Luces {
    ambiente: vec4<f32>,
    resolucion: vec2<f32>,
    cantidad: f32,
    especular: f32,
    luces: array<Luz, 32>,
};

@group(0) @binding(0) var<uniform> L: Luces;
@group(0) @binding(1) var albedo: texture_2d<f32>;
@group(0) @binding(2) var normales: texture_2d<f32>;
@group(0) @binding(3) var emisivo: texture_2d<f32>;

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

@fragment
fn fs(e: Salida) -> @location(0) vec4<f32> {
    let p = vec2<i32>(e.uv * L.resolucion);
    let base = textureLoad(albedo, p, 0);
    if (base.a <= 0.0) {
        discard;
    }
    // Normal codificada en [0,1] (rg = xy, b = z); sin mapa (b = 0) se asume plana hacia la cámara.
    let nm = textureLoad(normales, p, 0).rgb;
    var n = vec3<f32>(0.0, 0.0, 1.0);
    if (nm.b > 0.0) {
        n = normalize(nm * 2.0 - vec3<f32>(1.0, 1.0, 1.0));
    }
    let px = vec2<f32>(p) + vec2<f32>(0.5, 0.5);
    var luz = L.ambiente.rgb;
    let cuantas = i32(L.cantidad);
    for (var i = 0; i < 32; i = i + 1) {
        if (i >= cuantas) {
            break;
        }
        let l = L.luces[i];
        let d = l.pos_radio_altura.xy - px;
        let dist = length(d);
        let radio = l.pos_radio_altura.z;
        if (dist >= radio) {
            continue;
        }
        // Atenuación suave: (1 − (d/r)²)², sin borde duro y sin infinito en el centro.
        let k = 1.0 - (dist * dist) / (radio * radio);
        let aten = k * k;
        let l3 = normalize(vec3<f32>(d.x, -d.y, l.pos_radio_altura.w));
        let ndl = clamp(1.0 + 1.6 * (dot(n, l3) - l3.z), 0.2, 1.9);
        // Especular Blinn simple con el observador mirando de frente.
        let h = normalize(l3 + vec3<f32>(0.0, 0.0, 1.0));
        let spec = pow(max(dot(n, h), 0.0), 24.0) * L.especular;
        luz = luz + l.color.rgb * l.color.a * aten * (ndl + spec);
    }
    let em = textureLoad(emisivo, p, 0).rgb;
    return vec4<f32>(base.rgb * luz + em, base.a);
}
