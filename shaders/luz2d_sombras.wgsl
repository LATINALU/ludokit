// Luz 2D con SOMBRAS SUAVES: igual que luz2d.wgsl (relieve relativo al plano, atenuación suave, emisivo) más
// sombras de los oclusores con dos métodos elegibles en vivo:
//   modo 1 · SDF: sphere tracing sobre el campo de distancias (sdf_jfa.wgsl) con penumbra k·h/t. Continua, sin
//            ruido ni parpadeo; el campo se reutiliza mientras los oclusores no cambien.
//   modo 2 · Rayos: 24 muestras con jitter IGN FIJO en pantalla (no parpadea en el tiempo). Más barato si todo se
//            mueve cada cuadro.
// Además, CONTORNO: la luz entra `penetracion` px en la roca por el borde que da a la luz.

struct Luz {
    pos_radio_altura: vec4<f32>,
    // rgb, intensidad
    color: vec4<f32>,
    // proyecta sombra (0/1), dureza k, -, -
    sombra: vec4<f32>,
};

struct Luces {
    ambiente: vec4<f32>,
    // cantidad, luz en roca, penetración, modo (0 sin sombras, 1 SDF, 2 rayos)
    info: vec4<f32>,
    luces: array<Luz, 32>,
};

@group(0) @binding(0) var<uniform> L: Luces;
@group(0) @binding(1) var albedo: texture_2d<f32>;
@group(0) @binding(2) var normales: texture_2d<f32>;
@group(0) @binding(3) var emisivo: texture_2d<f32>;
@group(0) @binding(4) var oclusion: texture_2d<f32>;
@group(0) @binding(5) var jfa: texture_2d<f32>;

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

fn ocl(p: vec2<f32>) -> f32 {
    let q = vec2<i32>(floor(p));
    let s = vec2<i32>(textureDimensions(oclusion));
    if (q.x < 0 || q.y < 0 || q.x >= s.x || q.y >= s.y) {
        return 0.0;
    }
    return textureLoad(oclusion, q, 0).r;
}

fn sdf(p: vec2<f32>) -> f32 {
    let s = vec2<i32>(textureDimensions(jfa));
    let q = clamp(vec2<i32>(floor(p)), vec2<i32>(0, 0), s - vec2<i32>(1, 1));
    let semilla = textureLoad(jfa, q, 0).xy;
    if (semilla.x < 0.0) {
        return 120.0;
    }
    return min(distance(p, semilla), 120.0);
}

fn sombra_sdf(p: vec2<f32>, lp: vec2<f32>, k: f32) -> f32 {
    let d = lp - p;
    let dist = length(d);
    if (dist < 1.5) {
        return 1.0;
    }
    let dir = d / dist;
    var t = 1.0;
    var res = 1.0;
    for (var i = 0; i < 48; i = i + 1) {
        if (t >= dist - 1.0) {
            break;
        }
        let h = sdf(p + dir * t);
        if (h < 0.75) {
            return 0.0;
        }
        res = min(res, k * h / t);
        t = t + max(h * 0.9, 1.0);
    }
    let r = clamp(res, 0.0, 1.0);
    return r * r * (3.0 - 2.0 * r);
}

// Interleaved Gradient Noise: fijo en pantalla, así la penumbra no titila entre cuadros.
fn ign(p: vec2<f32>) -> f32 {
    return fract(52.9829189 * fract(dot(p, vec2<f32>(0.06711056, 0.00583715))));
}

fn sombra_rayos(p: vec2<f32>, lp: vec2<f32>) -> f32 {
    let d = lp - p;
    let j = ign(p);
    var libre = 0.0;
    for (var i = 0; i < 24; i = i + 1) {
        let t = (f32(i) + j) / 24.0;
        if (ocl(p + d * t) < 0.5) {
            libre = libre + 1.0;
        }
    }
    return libre / 24.0;
}

@fragment
fn fs(e: Salida) -> @location(0) vec4<f32> {
    let p = vec2<i32>(floor(e.pos.xy));
    let base = textureLoad(albedo, p, 0);
    let nm = textureLoad(normales, p, 0).rgb;
    var n = vec3<f32>(0.0, 0.0, 1.0);
    if (nm.b > 0.0) {
        n = normalize(nm * 2.0 - vec3<f32>(1.0, 1.0, 1.0));
    }
    let px = vec2<f32>(p) + vec2<f32>(0.5, 0.5);
    let en_roca = ocl(px) > 0.5;
    let modo = i32(L.info.w);
    var luz = L.ambiente.rgb;
    for (var i = 0; i < 32; i = i + 1) {
        if (i >= i32(L.info.x)) {
            break;
        }
        let l = L.luces[i];
        let d = l.pos_radio_altura.xy - px;
        let dist = length(d);
        let radio = l.pos_radio_altura.z;
        if (dist >= radio) {
            continue;
        }
        let k = 1.0 - (dist * dist) / (radio * radio);
        var aten = k * k;
        let l3 = normalize(vec3<f32>(d.x, -d.y, l.pos_radio_altura.w));
        let ndl = clamp(1.0 + 1.6 * (dot(n, l3) - l3.z), 0.2, 1.9);
        var vis = 1.0;
        if (en_roca) {
            // Contorno: dentro de la roca solo llega la luz por el borde que la mira, hasta `penetracion` px.
            let paso = normalize(d);
            var dentro = 0.0;
            for (var s = 1; s <= 8; s = s + 1) {
                if (f32(s) > L.info.z) {
                    break;
                }
                if (ocl(px + paso * f32(s)) > 0.5) {
                    dentro = dentro + 1.0;
                }
            }
            vis = max(L.info.y * 0.3, 1.0 - dentro / max(L.info.z, 1.0));
        } else if (l.sombra.x > 0.5 && modo == 1) {
            vis = sombra_sdf(px, l.pos_radio_altura.xy, max(l.sombra.y, 1.0));
        } else if (l.sombra.x > 0.5 && modo == 2) {
            vis = sombra_rayos(px, l.pos_radio_altura.xy);
        }
        luz = luz + l.color.rgb * l.color.a * aten * ndl * vis;
    }
    let em = textureLoad(emisivo, p, 0).rgb;
    return vec4<f32>(base.rgb * luz + em, base.a);
}
