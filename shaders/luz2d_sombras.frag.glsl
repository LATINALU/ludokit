// GENERADO desde luz2d_sombras.wgsl [fs] por shaders/compilador (naga). No editar a mano.
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
uniform Luces_block_0Fragment { Luces _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

uniform highp sampler2D _group_0_binding_2_fs;

uniform highp sampler2D _group_0_binding_3_fs;

uniform highp sampler2D _group_0_binding_4_fs;

uniform highp sampler2D _group_0_binding_5_fs;

layout(location = 0) out vec4 _fs2p_location0;

float ocl(vec2 p) {
    ivec2 q = ivec2(floor(p));
    ivec2 s_2 = ivec2(uvec2(textureSize(_group_0_binding_4_fs, 0).xy));
    if (((((q.x < 0) || (q.y < 0)) || (q.x >= s_2.x)) || (q.y >= s_2.y))) {
        return 0.0;
    }
    vec4 _e24 = texelFetch(_group_0_binding_4_fs, q, 0);
    return _e24.x;
}

float sdf(vec2 p_1) {
    ivec2 s_3 = ivec2(uvec2(textureSize(_group_0_binding_5_fs, 0).xy));
    ivec2 q_1 = min(max(ivec2(floor(p_1)), ivec2(0, 0)), (s_3 - ivec2(1, 1)));
    vec4 _e16 = texelFetch(_group_0_binding_5_fs, q_1, 0);
    vec2 semilla = _e16.xy;
    if ((semilla.x < 0.0)) {
        return 120.0;
    }
    return min(distance(p_1, semilla), 120.0);
}

float sombra_sdf(vec2 p_2, vec2 lp, float k) {
    float t = 1.0;
    float res = 1.0;
    int i_2 = 0;
    vec2 d = (lp - p_2);
    float dist = length(d);
    if ((dist < 1.5)) {
        return 1.0;
    }
    vec2 dir = (d / vec2(dist));
    bool loop_init = true;
    while(true) {
        if (!loop_init) {
            int _e41 = i_2;
            i_2 = (_e41 + 1);
        }
        loop_init = false;
        int _e16 = i_2;
        if ((_e16 < 48)) {
        } else {
            break;
        }
        {
            float _e19 = t;
            if ((_e19 >= (dist - 1.0))) {
                break;
            }
            float _e23 = t;
            float _e26 = sdf((p_2 + (dir * _e23)));
            if ((_e26 < 0.75)) {
                return 0.0;
            }
            float _e30 = res;
            float _e32 = t;
            res = min(_e30, ((k * _e26) / _e32));
            float _e35 = t;
            t = (_e35 + max((_e26 * 0.9), 1.0));
        }
    }
    float _e44 = res;
    float r = clamp(_e44, 0.0, 1.0);
    return ((r * r) * (3.0 - (2.0 * r)));
}

float ign(vec2 p_3) {
    return fract((52.982918 * fract(dot(p_3, vec2(0.06711056, 0.00583715)))));
}

float sombra_rayos(vec2 p_4, vec2 lp_1) {
    float libre = 0.0;
    int i_3 = 0;
    vec2 d_1 = (lp_1 - p_4);
    float _e3 = ign(p_4);
    bool loop_init_1 = true;
    while(true) {
        if (!loop_init_1) {
            int _e24 = i_3;
            i_3 = (_e24 + 1);
        }
        loop_init_1 = false;
        int _e8 = i_3;
        if ((_e8 < 24)) {
        } else {
            break;
        }
        {
            int _e11 = i_3;
            float t_1 = ((float(_e11) + _e3) / 24.0);
            float _e18 = ocl((p_4 + (d_1 * t_1)));
            if ((_e18 < 0.5)) {
                float _e21 = libre;
                libre = (_e21 + 1.0);
            }
        }
    }
    float _e27 = libre;
    return (_e27 / 24.0);
}

void main() {
    Salida e = Salida(gl_FragCoord);
    vec3 n = vec3(0.0, 0.0, 1.0);
    vec3 luz = vec3(0.0);
    int i_1 = 0;
    float aten = 0.0;
    float vis = 0.0;
    float dentro = 0.0;
    int s_1 = 0;
    ivec2 p_5 = ivec2(floor(e.pos.xy));
    vec4 base = texelFetch(_group_0_binding_1_fs, p_5, 0);
    vec4 _e10 = texelFetch(_group_0_binding_2_fs, p_5, 0);
    vec3 nm = _e10.xyz;
    if ((nm.z > 0.0)) {
        n = normalize(((nm * 2.0) - vec3(1.0, 1.0, 1.0)));
    }
    vec2 px = (vec2(p_5) + vec2(0.5, 0.5));
    float _e33 = ocl(px);
    bool en_roca = (_e33 > 0.5);
    float _e39 = _group_0_binding_0_fs.info.w;
    int modo = int(_e39);
    vec4 _e43 = _group_0_binding_0_fs.ambiente;
    luz = _e43.xyz;
    bool loop_init_2 = true;
    while(true) {
        if (!loop_init_2) {
            int _e178 = i_1;
            i_1 = (_e178 + 1);
        }
        loop_init_2 = false;
        int _e48 = i_1;
        if ((_e48 < 32)) {
        } else {
            break;
        }
        {
            int _e51 = i_1;
            float _e55 = _group_0_binding_0_fs.info.x;
            if ((_e51 >= int(_e55))) {
                break;
            }
            int _e60 = i_1;
            Luz l = _group_0_binding_0_fs.luces[_e60];
            vec2 d_2 = (l.pos_radio_altura.xy - px);
            float dist_1 = length(d_2);
            float radio = l.pos_radio_altura.z;
            if ((dist_1 >= radio)) {
                continue;
            }
            float k_1 = (1.0 - ((dist_1 * dist_1) / (radio * radio)));
            aten = (k_1 * k_1);
            vec3 l3_ = normalize(vec3(d_2.x, -(d_2.y), l.pos_radio_altura.w));
            vec3 _e84 = n;
            float ndl = clamp((1.0 + (1.6 * (dot(_e84, l3_) - l3_.z))), 0.2, 1.9);
            vis = 1.0;
            if (en_roca) {
                vec2 paso = normalize(d_2);
                dentro = 0.0;
                s_1 = 1;
                bool loop_init_3 = true;
                while(true) {
                    if (!loop_init_3) {
                        int _e122 = s_1;
                        s_1 = (_e122 + 1);
                    }
                    loop_init_3 = false;
                    int _e102 = s_1;
                    if ((_e102 <= 8)) {
                    } else {
                        break;
                    }
                    {
                        int _e105 = s_1;
                        float _e110 = _group_0_binding_0_fs.info.z;
                        if ((float(_e105) > _e110)) {
                            break;
                        }
                        int _e112 = s_1;
                        float _e116 = ocl((px + (paso * float(_e112))));
                        if ((_e116 > 0.5)) {
                            float _e119 = dentro;
                            dentro = (_e119 + 1.0);
                        }
                    }
                }
                float _e128 = _group_0_binding_0_fs.info.y;
                float _e131 = dentro;
                float _e135 = _group_0_binding_0_fs.info.z;
                vis = max((_e128 * 0.3), (1.0 - (_e131 / max(_e135, 1.0))));
            } else {
                if (((l.sombra.x > 0.5) && (modo == 1))) {
                    float _e155 = sombra_sdf(px, l.pos_radio_altura.xy, max(l.sombra.y, 1.0));
                    vis = _e155;
                } else {
                    if (((l.sombra.x > 0.5) && (modo == 2))) {
                        float _e165 = sombra_rayos(px, l.pos_radio_altura.xy);
                        vis = _e165;
                    }
                }
            }
            vec3 _e166 = luz;
            float _e172 = aten;
            float _e175 = vis;
            luz = (_e166 + ((((l.color.xyz * l.color.w) * _e172) * ndl) * _e175));
        }
    }
    vec4 _e183 = texelFetch(_group_0_binding_3_fs, p_5, 0);
    vec3 em = _e183.xyz;
    vec3 _e186 = luz;
    _fs2p_location0 = vec4(((base.xyz * _e186) + em), base.w);
    return;
}

