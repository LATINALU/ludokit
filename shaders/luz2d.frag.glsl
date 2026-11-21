// GENERADO desde luz2d.wgsl [fs] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Luz {
    vec4 pos_radio_altura;
    vec4 color;
};
struct Luces {
    vec4 ambiente;
    vec2 resolucion;
    float cantidad;
    float especular;
    Luz luces[32];
};
struct Salida {
    vec4 pos;
    vec2 uv;
};
uniform Luces_block_0Fragment { Luces _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

uniform highp sampler2D _group_0_binding_2_fs;

uniform highp sampler2D _group_0_binding_3_fs;

smooth in vec2 _vs2fs_location0;
layout(location = 0) out vec4 _fs2p_location0;

void main() {
    Salida e = Salida(gl_FragCoord, _vs2fs_location0);
    vec3 n = vec3(0.0, 0.0, 1.0);
    vec3 luz = vec3(0.0);
    int i_1 = 0;
    vec2 _e4 = _group_0_binding_0_fs.resolucion;
    ivec2 p = ivec2((e.uv * _e4));
    vec4 base = texelFetch(_group_0_binding_1_fs, p, 0);
    if ((base.w <= 0.0)) {
        discard;
    }
    vec4 _e15 = texelFetch(_group_0_binding_2_fs, p, 0);
    vec3 nm = _e15.xyz;
    if ((nm.z > 0.0)) {
        n = normalize(((nm * 2.0) - vec3(1.0, 1.0, 1.0)));
    }
    vec2 px = (vec2(p) + vec2(0.5, 0.5));
    vec4 _e40 = _group_0_binding_0_fs.ambiente;
    luz = _e40.xyz;
    float _e45 = _group_0_binding_0_fs.cantidad;
    int cuantas = int(_e45);
    bool loop_init = true;
    while(true) {
        if (!loop_init) {
            int _e116 = i_1;
            i_1 = (_e116 + 1);
        }
        loop_init = false;
        int _e49 = i_1;
        if ((_e49 < 32)) {
        } else {
            break;
        }
        {
            int _e52 = i_1;
            if ((_e52 >= cuantas)) {
                break;
            }
            int _e56 = i_1;
            Luz l = _group_0_binding_0_fs.luces[_e56];
            vec2 d = (l.pos_radio_altura.xy - px);
            float dist = length(d);
            float radio = l.pos_radio_altura.z;
            if ((dist >= radio)) {
                continue;
            }
            float k = (1.0 - ((dist * dist) / (radio * radio)));
            float aten = (k * k);
            vec3 l3_ = normalize(vec3(d.x, -(d.y), l.pos_radio_altura.w));
            vec3 _e79 = n;
            float ndl = clamp((1.0 + (1.6 * (dot(_e79, l3_) - l3_.z))), 0.2, 1.9);
            vec3 h = normalize((l3_ + vec3(0.0, 0.0, 1.0)));
            vec3 _e96 = n;
            float _e104 = _group_0_binding_0_fs.especular;
            float spec = (pow(max(dot(_e96, h), 0.0), 24.0) * _e104);
            vec3 _e106 = luz;
            luz = (_e106 + (((l.color.xyz * l.color.w) * aten) * (ndl + spec)));
        }
    }
    vec4 _e121 = texelFetch(_group_0_binding_3_fs, p, 0);
    vec3 em = _e121.xyz;
    vec3 _e124 = luz;
    _fs2p_location0 = vec4(((base.xyz * _e124) + em), base.w);
    return;
}

