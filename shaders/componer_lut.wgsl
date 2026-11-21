// Composición final: escena + bloom, gradación de color por LUT 3D (la que hornea `hornearLut` de grafico/color.ts:
// tira de lado²×lado, x = azul·lado + rojo, y = verde) con interpolación trilineal manual de 8 lecturas exactas, o
// lectura sin interpolar para PALETA PURA (todo el juego queda dentro de la paleta), viñeta y destello.

struct Comp {
    // bloom, viñeta, destello, lado de la LUT
    p0: vec4<f32>,
    // paleta pura (0/1), -, -, -
    p1: vec4<f32>,
};

@group(0) @binding(0) var<uniform> C: Comp;
@group(0) @binding(1) var escena: texture_2d<f32>;
@group(0) @binding(2) var bloom: texture_2d<f32>;
@group(0) @binding(3) var tabla: texture_2d<f32>;
@group(0) @binding(4) var lineal: sampler;

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

fn celda(r: f32, g: f32, b: f32) -> vec3<f32> {
    let n = C.p0.w;
    return textureLoad(tabla, vec2<i32>(i32(b * n + r), i32(g)), 0).rgb;
}

fn gradar(c0: vec3<f32>) -> vec3<f32> {
    let n = C.p0.w;
    let c = clamp(c0, vec3<f32>(0.0), vec3<f32>(1.0)) * (n - 1.0);
    if (C.p1.x > 0.5) {
        let q = floor(c + vec3<f32>(0.5));
        return celda(q.r, q.g, q.b);
    }
    let f = fract(c);
    let b0 = floor(c);
    let b1 = min(b0 + vec3<f32>(1.0), vec3<f32>(n - 1.0));
    let x00 = mix(celda(b0.r, b0.g, b0.b), celda(b1.r, b0.g, b0.b), f.r);
    let x10 = mix(celda(b0.r, b1.g, b0.b), celda(b1.r, b1.g, b0.b), f.r);
    let x01 = mix(celda(b0.r, b0.g, b1.b), celda(b1.r, b0.g, b1.b), f.r);
    let x11 = mix(celda(b0.r, b1.g, b1.b), celda(b1.r, b1.g, b1.b), f.r);
    return mix(mix(x00, x10, f.g), mix(x01, x11, f.g), f.b);
}

@fragment
fn fs(e: Salida) -> @location(0) vec4<f32> {
    var c = textureSampleLevel(escena, lineal, e.uv, 0.0).rgb;
    c = c + textureSampleLevel(bloom, lineal, e.uv, 0.0).rgb * C.p0.x;
    c = gradar(c);
    let v = e.uv * 2.0 - vec2<f32>(1.0, 1.0);
    c = c * (1.0 - C.p0.y * smoothstep(0.35, 1.25, dot(v, v)));
    c = c + vec3<f32>(C.p0.z);
    return vec4<f32>(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
