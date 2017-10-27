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

void main() {
    float PI = 3.1415926535897;
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer
    //the normal version 
     gl_FragData[0] = vec4(v_position,1.0);
     gl_FragData[1] = vec4(norm,1.0);
     gl_FragData[2] = vec4(col,1.0);
     gl_FragData[3] = vec4(0.0);

     //TODO: gbuffer improvement version 
     /*float theta;
     if(norm[0] != 0.0)
     {
         if(norm[2] > 0.0)
         {
            theta = -atan(norm[2]/norm[0]) + PI/2.0;
         } 
         else if((norm[2] == 0.0)&&(norm[0] < 0.0))
         {
             theta = PI;
         }
     }
     else
     {
        if(norm[2] > 0.0)
        {
            theta = 1.5*PI;
        }
        else
        {
            theta = PI/2.0;
        }
     }
     gl_FragData[0] = vec4(v_position[0],v_position[1],v_position[2],norm[1]);
     gl_FragData[1] = vec4(col[0],col[1],col[2],theta);*/
     /////////////////////
}