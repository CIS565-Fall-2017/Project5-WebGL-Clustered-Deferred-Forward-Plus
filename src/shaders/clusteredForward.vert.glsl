#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

void main() {
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    v_position = (u_viewMatrix * vec4(a_position, 1.0)).xyz;
    v_normal = normalize(u_viewMatrix * vec4(a_normal, 0.0)).xyz;
    v_uv = a_uv;
}