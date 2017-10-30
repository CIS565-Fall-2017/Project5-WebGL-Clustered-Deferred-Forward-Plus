#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjectionMatrix;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    if(abs(geomnor.y) >= 0.999) {
       up = vec3(1.0, 0.0, 0.0);
    }
    vec3 surftan = normalize(cross(up, geomnor));
    vec3 surfbinor = cross(geomnor, surftan);
    return normalize(surftan * normap.x + surfbinor * normap.y + geomnor * normap.z);
}

void main() {
    vec3 norm = vec3(u_viewMatrix * vec4(applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv))), 0.0));
    vec3 col = vec3(texture2D(u_colmap, v_uv));
    
    vec4 view = u_viewProjectionMatrix * vec4(v_position, 1.0);
    view /= view.w;
    float depth = view.z;

    // TODO: populate your g buffer
    // gl_FragData[0] = ??
    // gl_FragData[1] = ??
    // gl_FragData[2] = ??
    // gl_FragData[3] = ??
    
    gl_FragData[0] = vec4(col, depth);
    gl_FragData[1] = vec4(norm.x, norm.y, 0.0, v_position.z);
}
