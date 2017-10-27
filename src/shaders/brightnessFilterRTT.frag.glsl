#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_oriSceenBuffer;

varying vec2 v_uv;


void main() {

    vec3 OriCol = vec3(texture2D(u_oriSceenBuffer, v_uv));

    float brightness = OriCol.r * 0.2126 + OriCol.g * 0.7152 + OriCol.b * 0.0722;

    OriCol = brightness * OriCol;

    //gl_FragColor = vec4(OriCol, 1.0);

    //Render to FBO
    gl_FragData[0] = vec4(OriCol, 1.0);

}
