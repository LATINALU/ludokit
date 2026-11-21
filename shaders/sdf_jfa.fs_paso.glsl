// GENERADO desde sdf_jfa.wgsl [fs_paso] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Paso {
    vec4 k;
};
struct Salida {
    vec4 pos;
};
uniform Paso_block_0Fragment { Paso _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

layout(location = 0) out vec4 _fs2p_location0;

void main() {
    Salida e_1 = Salida(gl_FragCoord);
    vec2 mejor = vec2(-1.0, -1.0);
    float dmin = 1000000000.0;
    int dy = -1;
    int dx = 0;
    float _e4 = _group_0_binding_0_fs.k.x;
    int k = int(_e4);
    ivec2 tam = ivec2(uvec2(textureSize(_group_0_binding_1_fs, 0).xy));
    ivec2 p = ivec2(floor(e_1.pos.xy));
    bool loop_init = true;
    while(true) {
        if (!loop_init) {
            int _e64 = dy;
            dy = (_e64 + 1);
        }
        loop_init = false;
        int _e21 = dy;
        if ((_e21 <= 1)) {
        } else {
            break;
        }
        {
            dx = -1;
            bool loop_init_1 = true;
            while(true) {
                if (!loop_init_1) {
                    int _e61 = dx;
                    dx = (_e61 + 1);
                }
                loop_init_1 = false;
                int _e26 = dx;
                if ((_e26 <= 1)) {
                } else {
                    break;
                }
                {
                    int _e29 = dx;
                    int _e30 = dy;
                    ivec2 q = (p + (ivec2(_e29, _e30) * k));
                    if (((((q.x < 0) || (q.y < 0)) || (q.x >= tam.x)) || (q.y >= tam.y))) {
                        continue;
                    }
                    vec4 _e51 = texelFetch(_group_0_binding_1_fs, q, 0);
                    vec2 s_1 = _e51.xy;
                    if ((s_1.x < 0.0)) {
                        continue;
                    }
                    float d = distance(s_1, e_1.pos.xy);
                    float _e59 = dmin;
                    if ((d < _e59)) {
                        dmin = d;
                        mejor = s_1;
                    }
                }
            }
        }
    }
    vec2 _e67 = mejor;
    _fs2p_location0 = vec4(_e67, 0.0, 1.0);
    return;
}

