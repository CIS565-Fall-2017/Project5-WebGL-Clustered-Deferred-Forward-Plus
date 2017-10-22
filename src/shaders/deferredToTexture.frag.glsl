#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjectionMatrix;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {

    normap = normap * 2.0 - 1.0;    
    vec3 up = vec3(0, 1, 0);

    vec3 surftan;
    vec3 surfbinor;

    if(abs(geomnor.y) >= 0.999)
    {
       up = vec3(1, 0, 0);      
    }
    
    surftan = normalize(cross(up, geomnor));
    surfbinor = cross(geomnor, surftan);
    return normalize(surftan * normap.x + surfbinor * normap.y + geomnor * normap.z);
}

void main() {
    vec3 norm = vec3(u_viewMatrix * vec4(applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv))), 0.0));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    vec4 DC = u_viewProjectionMatrix * vec4(v_position, 1.0);
    DC /= DC.w;

    float depth = DC.z;

    // TODO: populate your g buffer
     gl_FragData[0] = vec4(col, depth);
     gl_FragData[1] = vec4(norm.x, norm.y, 0.0, v_position.z);
     //gl_FragData[1] = vec4(applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv))), 0.0);
     //gl_FragData[2] = vec4(v_uv,0.0, 1.0);
     //gl_FragData[3] = vec4(v_position, 1.0);
}