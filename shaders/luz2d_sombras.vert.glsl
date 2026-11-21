// GENERADO desde luz2d_sombras.wgsl [vs] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Luz {
    vec4 pos_radio_altura;
    vec4 color;
    vec4 sombra;
};
struct Luces {
    vec4 ambiente;
    vec4 info;
    Luz luces[32];
};
struct Salida {
    vec4 pos;
};

float ign(vec2 p_3) {
    return fract((52.982918 * fract(dot(p_3, vec2(0.06711056, 0.00583715)))));
}

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

