// GENERADO desde sdf_jfa.wgsl [vs] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Paso {
    vec4 k;
};
struct Salida {
    vec4 pos;
};

void main() {
    uint i = uint(gl_VertexID);
    Salida s = Salida(vec4(0.0));
    float x = float(((i << 1u) & 2u));
    float y = float((i & 2u));
    s.pos = vec4(((x * 2.0) - 1.0), (1.0 - (y * 2.0)), 0.0, 1.0);
    Salida _e22 = s;
    gl_Position = _e22.pos;
    gl_Position.yz = vec2(-gl_Position.y, gl_Position.z * 2.0 - gl_Position.w);
    return;
}

