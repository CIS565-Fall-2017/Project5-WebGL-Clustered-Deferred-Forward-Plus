#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;
uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

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

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));
    float spec = length(col);
    float exp = 7.5 + 10.0 * spec;

    // Get normal in view space, encode in 2 components
    norm = normalize(mat3(u_viewMatrix) * norm);
    norm.xy = norm.xy * .5 + .5;

    vec4 ssPos = u_viewProjectionMatrix * vec4(v_position, 1.0);
    ssPos /= ssPos.w;
    ssPos.xy = ssPos.xy *.5 + vec2(.5);

    gl_FragData[0] = vec4(col, ssPos.z);
    gl_FragData[1] = vec4(norm.xy, spec, exp);
}