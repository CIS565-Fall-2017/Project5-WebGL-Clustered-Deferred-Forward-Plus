#version 100
precision highp float;

attribute vec3 a_position;

varying vec2 f_uv;

void main() {
    gl_Position = vec4(a_position, 1.0);
    f_uv = a_position.xy * 0.5 + 0.5;
}