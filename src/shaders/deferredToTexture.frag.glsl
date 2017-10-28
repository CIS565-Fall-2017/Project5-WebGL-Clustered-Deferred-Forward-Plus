#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

uniform mat4 u_viewMatrix;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
	vec4 norm = vec4(applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv))), 1);
	vec3 col = vec3(texture2D(u_colmap, v_uv));
	vec4 normalizedView = normalize(u_viewMatrix * norm);
	
	// TODO: populate your g buffer
	gl_FragData[0] = norm;
	gl_FragData[1] = vec4(v_position, normalizedView.y);
	gl_FragData[2] = vec4(col, normalizedView.x);
	// gl_FragData[3] = ??
}