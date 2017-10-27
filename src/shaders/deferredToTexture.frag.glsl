#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;
varying float v_depth;

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
    
    /* Populate G-buffers */

    // Normals
    gl_FragData[0] = vec4(norm, 1.0);

    // Depth
    gl_FragData[1] = vec4(v_depth, v_depth, v_depth, 1.0);

    // Diffuse Color
    gl_FragData[2] = vec4(col, 1.0);

    // 
    gl_FragData[3] = vec4(0.0, 0.0, 0.0, 1.0);
}