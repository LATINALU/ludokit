// GENERADO desde luz2d.wgsl [vs] por shaders/compilador (naga). No editar a mano.
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
smooth out vec2 _vs2fs_location0;

void main() {
    uint i = uint(gl_VertexID);
    Salida s = Salida(vec4(0.0), vec2(0.0));
    float x = float(((i << 1u) & 2u));
    float y = float((i & 2u));
    s.pos = vec4(((x * 2.0) - 1.0), (1.0 - (y * 2.0)), 0.0, 1.0);
    s.uv = vec2(x, y);
    Salida _e24 = s;
    gl_Position = _e24.pos;
    _vs2fs_location0 = _e24.uv;
    gl_Position.yz = vec2(-gl_Position.y, gl_Position.z * 2.0 - gl_Position.w);
    return;
}

