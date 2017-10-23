#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;
uniform float u_fov;
uniform float u_aspectRatio;
uniform int u_zSliceNum;
uniform int u_xSliceNum;
uniform int u_ySliceNum;
uniform float u_zFar;
uniform float u_zNear;
uniform int u_maxlightsPerCluster;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec4 v_lightInfo;
varying vec4 v_positionEye;

void main() {
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    v_position = a_position;
    v_normal = a_normal;
    v_uv = a_uv;
    v_lightInfo = vec4(u_xSliceNum, u_ySliceNum, u_zSliceNum, u_maxlightsPerCluster);
}