#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

vec2 sign_not_zero(vec2 v) {
    return vec2(
        v.x >= 0.0 ? 1.0 : -1.0,
        v.y >= 0.0 ? 1.0 : -1.0
    );
}

// Packs a 3-component normal to 2 channels using octahedron normals
vec2 pack_normal_octahedron(vec3 v) {
    v.xy /= dot(abs(v), vec3(1));
    if (v.z <= 0.0) v.xy = (1.0 - abs(v.yx)) * sign_not_zero(v.xy);
    return v.xy;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    vec2 n = pack_normal_octahedron(norm);

    gl_FragData[0] = vec4(v_position.x,v_position.y,v_position.z,n.x);
    gl_FragData[1] = vec4(col, n.y);
}