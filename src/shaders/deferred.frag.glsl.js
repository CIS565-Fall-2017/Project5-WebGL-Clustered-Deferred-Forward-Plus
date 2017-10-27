export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;
  
  void main() {
    // Extract data from G-buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // Normals
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // Depth
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv); // Diffuse color
    vec4 gb3 = texture2D(u_gbuffers[3], v_uv); // ??
    
    gl_FragColor = vec4(gb0.xyz, 1.0);

    // TODO: Perform Blinn-Phong shading, using whatever lights we care about in the cluster
  }
  `;
}