// Campo de distancias (SDF) de los oclusores por JUMP FLOODING: cada píxel termina sabiendo cuál es el píxel sólido
// más cercano, en log2(tamaño) pases baratos (8-10). Uso: 1 pase `fs_semilla` (marca los sólidos con su propia
// posición) y luego `fs_paso` con k = N/2, N/4, … 1 haciendo ping-pong entre dos texturas RG32F.
// La distancia es `distance(pixel, texel.xy)`; −1 = sin semilla todavía. Recalcular solo si los oclusores cambian.

struct Paso {
    // x = salto k en píxeles
    k: vec4<f32>,
};

@group(0) @binding(0) var<uniform> J: Paso;
@group(0) @binding(1) var entrada: texture_2d<f32>;

struct Salida {
    @builtin(position) pos: vec4<f32>,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> Salida {
    let x = f32((i << 1u) & 2u);
    let y = f32(i & 2u);
    var s: Salida;
    s.pos = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    return s;
}

// Semilla: la máscara de oclusión (r > 0.5 = sólido) → posición propia; el resto, −1.
@fragment
fn fs_semilla(e: Salida) -> @location(0) vec4<f32> {
    let q = vec2<i32>(floor(e.pos.xy));
    if (textureLoad(entrada, q, 0).r > 0.5) {
        return vec4<f32>(e.pos.xy, 0.0, 1.0);
    }
    return vec4<f32>(-1.0, -1.0, 0.0, 1.0);
}

// Un paso: mira los 8 vecinos a distancia k y se queda con la semilla más cercana.
@fragment
fn fs_paso(e: Salida) -> @location(0) vec4<f32> {
    let k = i32(J.k.x);
    let tam = vec2<i32>(textureDimensions(entrada));
    let p = vec2<i32>(floor(e.pos.xy));
    var mejor = vec2<f32>(-1.0, -1.0);
    var dmin = 1e9;
    for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
            let q = p + vec2<i32>(dx, dy) * k;
            if (q.x < 0 || q.y < 0 || q.x >= tam.x || q.y >= tam.y) {
                continue;
            }
            let s = textureLoad(entrada, q, 0).xy;
            if (s.x < 0.0) {
                continue;
            }
            let d = distance(s, e.pos.xy);
            if (d < dmin) {
                dmin = d;
                mejor = s;
            }
        }
    }
    return vec4<f32>(mejor, 0.0, 1.0);
}
