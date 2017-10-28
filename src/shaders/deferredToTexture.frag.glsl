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

vec2 encode(in vec3 nor) {
    /*
    float s = sign(nor.z);
    vec2 temp = 0.5 * nor.xy + 0.5;
    temp.y = s * temp.y;
    return temp;
    */

    nor /= abs(nor.x) + abs(nor.y) + abs(nor.z);
    nor.xy = nor.z >= 0.0 ? nor.xy : (1.0 - abs(nor.yx)) * vec2(sign(nor.x), sign(nor.y));
    nor.xy = nor.xy * 0.5 + 0.5;
    return nor.xy;
}

void main() {
    vec3 norm = applyNormalMap(normalize(v_normal), vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    gl_FragData[0].xyz = col;
    gl_FragData[0].w = v_position.x;
    gl_FragData[1].xy = v_position.yz;
    gl_FragData[1].zw = encode(norm);

}