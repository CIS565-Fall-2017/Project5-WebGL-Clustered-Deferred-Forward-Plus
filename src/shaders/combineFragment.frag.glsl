#version 100
precision highp float;

uniform sampler2D u_colorTexture;
uniform sampler2D u_hightlightTexture;

varying vec2 v_uv;

void main() {

    vec3 fragColor = vec3(0.0);

    vec3 sceneColor     = texture2D(u_colorTexture, v_uv).rgb;
    vec3 highlightColor = texture2D(u_hightlightTexture, v_uv).rgb;

    gl_FragColor = vec4(0.8 * sceneColor + 2.5 * highlightColor, 1.0);
}
