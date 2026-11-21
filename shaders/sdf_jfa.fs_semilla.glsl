// GENERADO desde sdf_jfa.wgsl [fs_semilla] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Paso {
    vec4 k;
};
struct Salida {
    vec4 pos;
};
uniform highp sampler2D _group_0_binding_1_fs;

layout(location = 0) out vec4 _fs2p_location0;

void main() {
    Salida e = Salida(gl_FragCoord);
    ivec2 q = ivec2(floor(e.pos.xy));
    vec4 _e7 = texelFetch(_group_0_binding_1_fs, q, 0);
    if ((_e7.x > 0.5)) {
        _fs2p_location0 = vec4(e.pos.xy, 0.0, 1.0);
        return;
    }
    _fs2p_location0 = vec4(-1.0, -1.0, 0.0, 1.0);
    return;
}

