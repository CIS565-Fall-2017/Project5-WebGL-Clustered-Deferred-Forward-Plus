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

// https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

vec2 OctahedronEncodingWrap( vec2 v )
{
    return ( vec2(1.0) - abs( v.yx ) ) * vec2(sign(v.x), sign(v.y));
}
 
vec2 EncodeNormal( vec3 n )
{
    n /= ( abs( n.x ) + abs( n.y ) + abs( n.z ) );
    n.xy = n.z >= 0.0 ? n.xy : OctahedronEncodingWrap( n.xy );
    n.xy = n.xy * 0.5 + 0.5;
    return n.xy;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));
    
    /* Populate G-buffers */

    // Normals, Color red/green channels
    gl_FragData[0] = vec4(EncodeNormal(norm), col.rg);

    // Color blue channel, position
    gl_FragData[1] = vec4(col.b, v_position);
}