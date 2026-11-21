// GENERADO desde bloom_kawase.wgsl [fs_extraer] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Bloom {
    vec4 p;
};
struct Salida {
    vec4 pos;
    vec2 uv;
};
uniform Bloom_block_0Fragment { Bloom _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

smooth in vec2 _vs2fs_location0;
layout(location = 0) out vec4 _fs2p_location0;

void main() {
    Salida e = Salida(gl_FragCoord, _vs2fs_location0);
    vec4 _e4 = texture(_group_0_binding_1_fs, vec2(e.uv));
    vec3 c_2 = _e4.xyz;
    float brillo = max(c_2.x, max(c_2.y, c_2.z));
    float _e14 = _group_0_binding_0_fs.p.w;
    float rodilla = max(_e14, 0.0001);
    float _e20 = _group_0_binding_0_fs.p.z;
    float s_1 = clamp((((brillo - _e20) + rodilla) / (2.0 * rodilla)), 0.0, 1.0);
    _fs2p_location0 = vec4(((c_2 * s_1) * s_1), 1.0);
    return;
}

