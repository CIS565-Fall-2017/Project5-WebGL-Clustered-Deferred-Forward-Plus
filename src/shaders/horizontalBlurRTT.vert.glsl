#version 100
precision highp float;

uniform float u_targetWidth;

attribute vec3 a_position;

varying vec2 blurTextureCoords[11];

void main() {
    gl_Position = vec4(a_position, 1.0);

    vec2 centerTexCoords = a_position.xy * 0.5 + 0.5;

    float pixelSize = 1.0 / u_targetWidth;

    for(int i = -5; i <= 5; i++){
      blurTextureCoords[i + 5] = centerTexCoords + vec2(pixelSize * float(i), 0.0);
    }

}
