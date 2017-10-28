#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

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

    // TODO: populate your g buffer
    // Populate g buffer with depth, normal, color, and anything else 

    // ============================== Non-optimized way ==============================
    //gl_FragData[0] = vec4(col, 0.0);
    //gl_FragData[1] = vec4(v_position, 0.0);
    //gl_FragData[2] = vec4(norm, 0.0);

    // ============================== Optimized way ==============================
    // Use less g buffers 
    // Reduce normals to only 2 components and pack them into already used g buffers 
    // If you reduce normals, must bring to camera space by multiplying view matrix 

    // Compacting normals, resconstructing z --> https://aras-p.info/texts/CompactNormalStorage.html 
    // You want to adjust the normal post normalization so that you can adjust it again in the frag shader 
    // OpenGL apparently clamps values that are stored in a texture because it reads everything as a color 

    // You know the magnitude of the normal is 1, and you have x and y 
    // Use the magnitude formula in the frag shader to reconstruct and find z

    vec3 reducedNorm = 0.5 + (0.5 * normalize(vec3(u_viewMatrix * vec4(norm, 0.0))));
    gl_FragData[0] = vec4(col, reducedNorm.x);
    gl_FragData[1] = vec4(v_position, reducedNorm.y);







}