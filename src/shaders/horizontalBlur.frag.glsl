#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform mat4 u_viewProjectionMatrix;

uniform sampler2D u_sceneTexture;

uniform float u_wieght[5];
uniform float u_gap[5];

varying vec2 v_uv;


void main() {

    vec4 result = texture2D(u_sceneTexture, v_uv) * u_wieght[0];


    
    for(int i=1; i<5; i++)
    {
        result += texture2D(u_sceneTexture, v_uv + vec2(u_gap[i], 0.0)) * u_wieght[i];
        result += texture2D(u_sceneTexture, v_uv - vec2(u_gap[i], 0.0)) * u_wieght[i];
    }

    gl_FragColor = result;
    
}