// GENERADO desde bloom_kawase.wgsl [fs_subir] por shaders/compilador (naga). No editar a mano.
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
    Salida e_2 = Salida(gl_FragCoord, _vs2fs_location0);
    vec3 c_1 = vec3(0.0);
    vec4 _e3 = _group_0_binding_0_fs.p;
    vec2 h = _e3.xy;
    vec4 _e15 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2((-(h.x) * 2.0), 0.0))));
    c_1 = _e15.xyz;
    vec3 _e18 = c_1;
    vec4 _e27 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(-(h.x), h.y))));
    c_1 = (_e18 + (_e27.xyz * 2.0));
    vec3 _e32 = c_1;
    vec4 _e42 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(0.0, (h.y * 2.0)))));
    c_1 = (_e32 + _e42.xyz);
    vec3 _e45 = c_1;
    vec4 _e53 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(h.x, h.y))));
    c_1 = (_e45 + (_e53.xyz * 2.0));
    vec3 _e58 = c_1;
    vec4 _e68 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2((h.x * 2.0), 0.0))));
    c_1 = (_e58 + _e68.xyz);
    vec3 _e71 = c_1;
    vec4 _e80 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(h.x, -(h.y)))));
    c_1 = (_e71 + (_e80.xyz * 2.0));
    vec3 _e85 = c_1;
    vec4 _e96 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(0.0, (-(h.y) * 2.0)))));
    c_1 = (_e85 + _e96.xyz);
    vec3 _e99 = c_1;
    vec4 _e109 = texture(_group_0_binding_1_fs, vec2((e_2.uv + vec2(-(h.x), -(h.y)))));
    c_1 = (_e99 + (_e109.xyz * 2.0));
    vec3 _e114 = c_1;
    _fs2p_location0 = vec4((_e114 / vec3(12.0)), 1.0);
    return;
}

