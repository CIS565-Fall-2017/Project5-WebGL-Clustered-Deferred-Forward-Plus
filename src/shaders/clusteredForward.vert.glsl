#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;

void main() 
{
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    f_position = a_position;
    f_normal = a_normal;
    f_uv = a_uv;
}