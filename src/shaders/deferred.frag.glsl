  #version 100
  precision highp float;
  
  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  
  uniform float u_width;
  uniform float u_height;
  uniform float u_nearZ;
  uniform float u_farZ;
  uniform float u_zStride;

  varying vec2 v_uv;
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }