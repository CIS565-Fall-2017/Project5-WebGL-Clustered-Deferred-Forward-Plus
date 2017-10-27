#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_texture;

varying vec2 blurTextureCoords[11];


void main() {

    vec3 fragColor = vec3(0.0);

    fragColor += texture2D(u_texture, blurTextureCoords[0]).rgb * 0.0093;
    fragColor += texture2D(u_texture, blurTextureCoords[1]).rgb * 0.028002;
    fragColor += texture2D(u_texture, blurTextureCoords[2]).rgb * 0.065984;
    fragColor += texture2D(u_texture, blurTextureCoords[3]).rgb * 0.121703;
    fragColor += texture2D(u_texture, blurTextureCoords[4]).rgb * 0.175713;
    fragColor += texture2D(u_texture, blurTextureCoords[5]).rgb * 0.198596;
    fragColor += texture2D(u_texture, blurTextureCoords[6]).rgb * 0.175713;
    fragColor += texture2D(u_texture, blurTextureCoords[7]).rgb * 0.121703;
    fragColor += texture2D(u_texture, blurTextureCoords[8]).rgb * 0.065984;
    fragColor += texture2D(u_texture, blurTextureCoords[9]).rgb * 0.028002;
    fragColor += texture2D(u_texture, blurTextureCoords[10]).rgb * 0.0093;

    //gl_FragColor = vec4(fragColor, 1.0);

    //Render to FBO
    gl_FragData[0] = vec4(fragColor, 1.0);

}
