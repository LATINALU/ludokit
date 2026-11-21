// GENERADO desde componer_lut.wgsl [fs] por shaders/compilador (naga). No editar a mano.
#version 300 es

precision highp float;
precision highp int;

struct Comp {
    vec4 p0_;
    vec4 p1_;
};
struct Salida {
    vec4 pos;
    vec2 uv;
};
uniform Comp_block_0Fragment { Comp _group_0_binding_0_fs; };

uniform highp sampler2D _group_0_binding_1_fs;

uniform highp sampler2D _group_0_binding_2_fs;

uniform highp sampler2D _group_0_binding_3_fs;

smooth in vec2 _vs2fs_location0;
layout(location = 0) out vec4 _fs2p_location0;

vec3 celda(float r, float g, float b) {
    float n = _group_0_binding_0_fs.p0_.w;
    vec4 _e14 = texelFetch(_group_0_binding_3_fs, ivec2(int(((b * n) + r)), int(g)), 0);
    return _e14.xyz;
}

vec3 gradar(vec3 c0_) {
    float n_1 = _group_0_binding_0_fs.p0_.w;
    vec3 c_1 = (clamp(c0_, vec3(0.0), vec3(1.0)) * (n_1 - 1.0));
    float _e16 = _group_0_binding_0_fs.p1_.x;
    if ((_e16 > 0.5)) {
        vec3 q = floor((c_1 + vec3(0.5)));
        vec3 _e26 = celda(q.x, q.y, q.z);
        return _e26;
    }
    vec3 f = fract(c_1);
    vec3 b0_ = floor(c_1);
    vec3 b1_ = min((b0_ + vec3(1.0)), vec3((n_1 - 1.0)));
    vec3 _e39 = celda(b0_.x, b0_.y, b0_.z);
    vec3 _e43 = celda(b1_.x, b0_.y, b0_.z);
    vec3 x00_ = mix(_e39, _e43, f.x);
    vec3 _e49 = celda(b0_.x, b1_.y, b0_.z);
    vec3 _e53 = celda(b1_.x, b1_.y, b0_.z);
    vec3 x10_ = mix(_e49, _e53, f.x);
    vec3 _e59 = celda(b0_.x, b0_.y, b1_.z);
    vec3 _e63 = celda(b1_.x, b0_.y, b1_.z);
    vec3 x01_ = mix(_e59, _e63, f.x);
    vec3 _e69 = celda(b0_.x, b1_.y, b1_.z);
    vec3 _e73 = celda(b1_.x, b1_.y, b1_.z);
    vec3 x11_ = mix(_e69, _e73, f.x);
    return mix(mix(x00_, x10_, f.y), mix(x01_, x11_, f.y), f.z);
}

void main() {
    Salida e = Salida(gl_FragCoord, _vs2fs_location0);
    vec3 c = vec3(0.0);
    vec4 _e5 = textureLod(_group_0_binding_1_fs, vec2(e.uv), 0.0);
    c = _e5.xyz;
    vec3 _e8 = c;
    vec4 _e13 = textureLod(_group_0_binding_2_fs, vec2(e.uv), 0.0);
    float _e18 = _group_0_binding_0_fs.p0_.x;
    c = (_e8 + (_e13.xyz * _e18));
    vec3 _e21 = c;
    vec3 _e22 = gradar(_e21);
    c = _e22;
    vec2 v = ((e.uv * 2.0) - vec2(1.0, 1.0));
    vec3 _e30 = c;
    float _e34 = _group_0_binding_0_fs.p0_.y;
    c = (_e30 * (1.0 - (_e34 * smoothstep(0.35, 1.25, dot(v, v)))));
    vec3 _e43 = c;
    float _e47 = _group_0_binding_0_fs.p0_.z;
    c = (_e43 + vec3(_e47));
    vec3 _e50 = c;
    _fs2p_location0 = vec4(clamp(_e50, vec3(0.0), vec3(1.0)), 1.0);
    return;
}

