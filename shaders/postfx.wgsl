// Postproceso de pantalla para pixel art: hasta 4 ondas de choque que desplazan PÍXELES ENTEROS (no difuminan),
// aberración cromática proporcional al trauma², viñeta, destello de color y tinte de "poca vida". Se aplica sobre
// la escena ya compuesta a resolución lógica (480×270), antes del escalado entero a la ventana.
// Fuente única: postfx.glsl se GENERA desde aquí (shaders/compilador).

struct Onda {
    // centro (px lógicos), radio actual, fuerza (px)
    centro_radio_fuerza: vec4<f32>,
    // grosor del anillo (px), -, -, -
    grosor: vec4<f32>,
};

struct Post {
    resolucion: vec2<f32>,
    tiempo: f32,
    trauma: f32,
    vineta: f32,
    vida: f32,
    cantidad_ondas: f32,
    _relleno: f32,
    destello: vec4<f32>,
    ondas: array<Onda, 4>,
};

@group(0) @binding(0) var<uniform> P: Post;
@group(0) @binding(1) var escena: texture_2d<f32>;
@group(0) @binding(2) var muestreo: sampler;

struct Salida {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Triángulo que cubre la pantalla, sin buffers de vértices.
@vertex
fn vs(@builtin(vertex_index) i: u32) -> Salida {
    let x = f32((i << 1u) & 2u);
    let y = f32(i & 2u);
    var s: Salida;
    s.pos = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    s.uv = vec2<f32>(x, y);
    return s;
}

fn leer(px: vec2<f32>) -> vec3<f32> {
    let uv = (floor(px) + vec2<f32>(0.5, 0.5)) / P.resolucion;
    return textureSampleLevel(escena, muestreo, uv, 0.0).rgb;
}

@fragment
fn fs(e: Salida) -> @location(0) vec4<f32> {
    var px = e.uv * P.resolucion;
    // Ondas: el anillo desplaza los píxeles hacia afuera; cuantizado al píxel para no "derretir" el pixel art.
    let n = i32(P.cantidad_ondas);
    for (var k = 0; k < 4; k = k + 1) {
        if (k >= n) {
            break;
        }
        let o = P.ondas[k];
        let c = o.centro_radio_fuerza.xy;
        let r = o.centro_radio_fuerza.z;
        let f = o.centro_radio_fuerza.w;
        let g = max(o.grosor.x, 1.0);
        let d = px - c;
        let dist = length(d);
        let banda = 1.0 - clamp(abs(dist - r) / g, 0.0, 1.0);
        if (banda > 0.0 && dist > 0.001) {
            px = px - round(d / dist * f * banda);
        }
    }
    // Aberración cromática: separa rojo y azul en horizontal según el trauma².
    let ab = round(P.trauma * P.trauma * 2.0);
    var color = vec3<f32>(leer(px + vec2<f32>(ab, 0.0)).r, leer(px).g, leer(px - vec2<f32>(ab, 0.0)).b);
    // Poca vida: desaturación y tinte rojo que late.
    if (P.vida < 0.25) {
        let k = (0.25 - P.vida) * 4.0 * (0.6 + 0.4 * sin(P.tiempo * 6.0));
        let gris = dot(color, vec3<f32>(0.299, 0.587, 0.114));
        color = mix(color, vec3<f32>(gris * 1.1, gris * 0.4, gris * 0.4), k * 0.5);
    }
    // Viñeta suave (elíptica, respeta la proporción de pantalla).
    let q = e.uv - vec2<f32>(0.5, 0.5);
    let v = 1.0 - P.vineta * smoothstep(0.35, 0.85, length(q * vec2<f32>(1.0, P.resolucion.y / P.resolucion.x) * 1.4));
    color = color * v;
    // Destello (golpe recibido, crítico): mezcla aditiva con el color del destello.
    color = mix(color, P.destello.rgb, clamp(P.destello.a, 0.0, 1.0));
    return vec4<f32>(color, 1.0);
}
