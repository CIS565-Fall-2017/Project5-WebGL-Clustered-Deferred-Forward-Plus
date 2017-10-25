export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform float u_nearClip;
  uniform vec2 u_cluster_tile_size;
  uniform float u_cluster_depth_stride;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform mat4 u_invViewProjMatrix;
  uniform sampler2D u_clusterbuffer;


  uniform sampler2D u_lightbuffer;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {

    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // color / albedo
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // normal
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv); // depth
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv); // v_position

    // optimized g-buffer

    // g-buffer[0] : color.x   | color.y   | color.z   | viewSpaceDepth
    // g-buffer[1] : normal.x  | normal.y  | 0.0       | NDC_Depth

    vec3 albedo = texture2D(u_gbuffers[0], v_uv).rgb;
    // vec3 normal = texture2D(u_gbuffers[1], v_uv).xyz;
    vec2 enc_nor = texture2D(u_gbuffers[1], v_uv).xy;
    // vec3 v_position = texture2D(u_gbuffers[3], v_uv).xyz;

    float NDC_depth = texture2D(u_gbuffers[1], v_uv).w;

    // reconstruct v_position
    vec4 screenPos = vec4(v_uv * 2.0 - vec2(1.0), NDC_depth, 1.0);
    vec4 tmp_pos = u_invViewProjMatrix * screenPos;
    tmp_pos = tmp_pos / tmp_pos.w;
    vec3 v_position = tmp_pos.xyz;

    // reconstruct normal
    // when reconstruct a normal, it should happen on view space,
    // so that we can really handle normals of fragment we really see(deferred shading)
    // But in our case, v_position and normal should on world space
    // so we tranform normal back to world space
    vec3 normal;
    normal.xy = enc_nor;
    normal.z  = sqrt(1.0 - dot(normal.xy, normal.xy));
    normal    = vec3(u_invViewMatrix * vec4(normal, 0.0));

    vec3 fragColor = vec3(0.0);

    //vec3 pos_viewSpace = vec3(u_viewMatrix * vec4(v_position, 1.0));

    float viewSpaceDepth = texture2D(u_gbuffers[0], v_uv).w;

    // determine which cluster this fragment is in
    int cluster_Idx_x = int(gl_FragCoord.x / u_cluster_tile_size.x);
    int cluster_Idx_y = int(gl_FragCoord.y / u_cluster_tile_size.y);
    int cluster_Idx_z = int((-viewSpaceDepth - u_nearClip) / u_cluster_depth_stride);

    // clusterTexture Size
    const int clusterTexutreWidth  = int(${params.numXSlices}) * int(${params.numYSlices}) * int(${params.numZSlices});
    const int clusterTextureHeight = int(ceil((float(${params.maxLightsPerCluster}) + 1.0) / 4.0));

    // extract lights influencing this cluster from u_clusterbuffer
    int clusterIdx = cluster_Idx_x + cluster_Idx_y * int(${params.numXSlices}) + cluster_Idx_z * int(${params.numXSlices}) * int(${params.numYSlices});

    float cluster_u = float(clusterIdx + 1) / float(clusterTexutreWidth + 1);

    float cluster_v = 0.0; // because the texture space origin is at lower left, not upper left!

    float cluster_v_step = 1.0 / float(clusterTextureHeight + 1);

    cluster_v += cluster_v_step;

    vec4 cluster_texel = texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v));

    int lightCountInCluster = int(cluster_texel[0]);

    int cluster_texel_fetch_Idx = 1;

    const int maxNumLights = int(min(float(${params.maxLightsPerCluster}),float(${params.numLights})));



    for (int i = 0; i < maxNumLights; ++i) {
      if(i == lightCountInCluster) {break;}

      // Fetch light index
      int lightIdx;
      if(cluster_texel_fetch_Idx == 0){
        lightIdx = int(cluster_texel[0]);
      }
      else if(cluster_texel_fetch_Idx == 1){
        lightIdx = int(cluster_texel[1]);
      }
      else if(cluster_texel_fetch_Idx == 2){
        lightIdx = int(cluster_texel[2]);
      }
      else if(cluster_texel_fetch_Idx == 3){
        lightIdx = int(cluster_texel[3]);
      }

      cluster_texel_fetch_Idx++;

      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      if(cluster_texel_fetch_Idx == 4){
        cluster_texel_fetch_Idx = 0;
        cluster_v += cluster_v_step;
        cluster_texel = texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v));
      }

    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
