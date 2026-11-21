// GENERADO desde bloom_kawase.wgsl [fs_bajar] por shaders/compilador (naga). No editar a mano.
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
    Salida e_1 = Salida(gl_FragCoord, _vs2fs_location0);
    vec3 c = vec3(0.0);
    vec4 _e3 = _group_0_binding_0_fs.p;
    vec2 h = _e3.xy;
    vec4 _e8 = texture(_group_0_binding_1_fs, vec2(e_1.uv));
    c = (_e8.xyz * 4.0);
    vec3 _e13 = c;
    vec4 _e18 = texture(_group_0_binding_1_fs, vec2((e_1.uv - h)));
    c = (_e13 + _e18.xyz);
    vec3 _e21 = c;
    vec4 _e26 = texture(_group_0_binding_1_fs, vec2((e_1.uv + h)));
    c = (_e21 + _e26.xyz);
    vec3 _e29 = c;
    vec4 _e38 = texture(_group_0_binding_1_fs, vec2((e_1.uv + vec2(h.x, -(h.y)))));
    c = (_e29 + _e38.xyz);
    vec3 _e41 = c;
    vec4 _e50 = texture(_group_0_binding_1_fs, vec2((e_1.uv - vec2(h.x, -(h.y)))));
    c = (_e41 + _e50.xyz);
    vec3 _e53 = c;
    _fs2p_location0 = vec4((_e53 / vec3(8.0)), 1.0);
    return;
}

