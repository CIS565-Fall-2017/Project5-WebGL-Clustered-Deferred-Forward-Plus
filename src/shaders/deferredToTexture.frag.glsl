#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform mat4 u_viewMatrix;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec3 norm = applyNormalMap(f_normal, vec3(texture2D(u_normap, f_uv)));
    vec3 col = vec3(texture2D(u_colmap, f_uv));

    norm = normalize(vec3(u_viewMatrix*vec4(norm, 0.0)));
    norm *= 0.5; //colors can't be negative so shift normal into positive viewspace
    norm += 0.5;

    // TODO: populate your g buffer
    gl_FragData[0] = vec4(f_position, norm.x);
    gl_FragData[1] = vec4(col, norm.y);
    // gl_FragData[2] = vec4(norm.x, norm.y, norm.z, 0);
    // gl_FragData[3] = ??
}