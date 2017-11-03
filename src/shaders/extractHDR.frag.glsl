#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform mat4 u_viewProjectionMatrix;

uniform sampler2D u_sceneTexture;

varying vec2 v_uv;


void main() {

    vec4 SceneColor = texture2D(u_sceneTexture, v_uv);
    //Extract Bright
    float BrightCap = 1.3;
    if(SceneColor.r > BrightCap || SceneColor.g > BrightCap || SceneColor.b > BrightCap)
    {
      vec4 amp = clamp((SceneColor - vec4(BrightCap))*2.0 , vec4(0), vec4(1));
      gl_FragColor = pow(amp, vec4(2.0));
    }
    else
    {
      gl_FragColor = vec4(0);
    }
}