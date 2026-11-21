// GENERADO desde postfx.wgsl [fs] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Onda {
    vec4 centro_radio_fuerza;
    vec4 grosor;
};
struct Post {
    vec2 resolucion;
    float tiempo;
    float trauma;
    float vineta;
    float vida;
    float cantidad_ondas;
    float _relleno;
    vec4 destello;
    Onda ondas[4];
};
struct Salida {
    vec4 pos;
    vec2 uv;
};
uniform Post_block_0Fragment { Post _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

smooth in vec2 _vs2fs_location0;
layout(location = 0) out vec4 _fs2p_location0;

vec3 leer(vec2 px_1) {
    vec2 _e8 = _group_0_binding_0_fs.resolucion;
    vec2 uv = ((floor(px_1) + vec2(0.5, 0.5)) / _e8);
    vec4 _e13 = textureLod(_group_0_binding_1_fs, vec2(uv), 0.0);
    return _e13.xyz;
}

void main() {
    Salida e = Salida(gl_FragCoord, _vs2fs_location0);
    vec2 px = vec2(0.0);
    int k = 0;
    vec3 color = vec3(0.0);
    vec2 _e4 = _group_0_binding_0_fs.resolucion;
    px = (e.uv * _e4);
    float _e9 = _group_0_binding_0_fs.cantidad_ondas;
    int n = int(_e9);
    bool loop_init = true;
    while(true) {
        if (!loop_init) {
            int _e56 = k;
            k = (_e56 + 1);
        }
        loop_init = false;
        int _e13 = k;
        if ((_e13 < 4)) {
        } else {
            break;
        }
        {
            int _e16 = k;
            if ((_e16 >= n)) {
                break;
            }
            int _e20 = k;
            Onda o = _group_0_binding_0_fs.ondas[_e20];
            vec2 c = o.centro_radio_fuerza.xy;
            float r = o.centro_radio_fuerza.z;
            float f = o.centro_radio_fuerza.w;
            float g = max(o.grosor.x, 1.0);
            vec2 _e33 = px;
            vec2 d = (_e33 - c);
            float dist = length(d);
            float banda = (1.0 - clamp((abs((dist - r)) / g), 0.0, 1.0));
            if (((banda > 0.0) && (dist > 0.001))) {
                vec2 _e49 = px;
                px = (_e49 - roundEven((((d / vec2(dist)) * f) * banda)));
            }
        }
    }
    float _e61 = _group_0_binding_0_fs.trauma;
    float _e64 = _group_0_binding_0_fs.trauma;
    float ab = roundEven(((_e61 * _e64) * 2.0));
    vec2 _e69 = px;
    vec3 _e73 = leer((_e69 + vec2(ab, 0.0)));
    vec2 _e75 = px;
    vec3 _e76 = leer(_e75);
    vec2 _e78 = px;
    vec3 _e82 = leer((_e78 - vec2(ab, 0.0)));
    color = vec3(_e73.x, _e76.y, _e82.z);
    float _e88 = _group_0_binding_0_fs.vida;
    if ((_e88 < 0.25)) {
        float _e93 = _group_0_binding_0_fs.vida;
        float _e100 = _group_0_binding_0_fs.tiempo;
        float k_1 = (((0.25 - _e93) * 4.0) * (0.6 + (0.4 * sin((_e100 * 6.0)))));
        vec3 _e109 = color;
        float gris = dot(_e109, vec3(0.299, 0.587, 0.114));
        vec3 _e115 = color;
        color = mix(_e115, vec3((gris * 1.1), (gris * 0.4), (gris * 0.4)), (k_1 * 0.5));
    }
    vec2 q = (e.uv - vec2(0.5, 0.5));
    float _e133 = _group_0_binding_0_fs.vineta;
    float _e137 = _group_0_binding_0_fs.resolucion.y;
    float _e141 = _group_0_binding_0_fs.resolucion.x;
    float v = (1.0 - (_e133 * smoothstep(0.35, 0.85, length(((q * vec2(1.0, (_e137 / _e141))) * 1.4)))));
    vec3 _e155 = color;
    color = (_e155 * v);
    vec3 _e157 = color;
    vec4 _e160 = _group_0_binding_0_fs.destello;
    float _e165 = _group_0_binding_0_fs.destello.w;
    color = mix(_e157, _e160.xyz, clamp(_e165, 0.0, 1.0));
    vec3 _e170 = color;
    _fs2p_location0 = vec4(_e170, 1.0);
    return;
}

