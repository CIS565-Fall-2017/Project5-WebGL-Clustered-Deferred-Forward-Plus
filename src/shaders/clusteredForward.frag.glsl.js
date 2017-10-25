export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewMatrix;

  uniform float u_vFoV;
  uniform float u_hFoV;
  uniform float u_xStride;
  uniform float u_yStride;
  uniform float u_zStride;
  uniform vec3 u_camRight;
  uniform vec3 u_camDown;

  varying vec3 f_position;
  varying vec3 f_normal;
  varying vec2 f_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) 
  {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) 
  {
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

  float ExtractFloatFromClusterTexture(float u, int lightIndex) 
  {
    int pixel = (lightIndex+1) / 4;
    float v = float(pixel + 1) / float(${params.maxLightsPerCluster} + 1);
    vec4 texel = texture2D(u_clusterbuffer, vec2(u, v));

    //int pixelComponent = (lightIndex+1) % 4;
    int pixelComponent = pixel*4 - (lightIndex+1);
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

  Light UnpackLight(int index) 
  {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) 
  {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  int numXSlices = ${params.numXSlices};
  int numYSlices = ${params.numYSlices};
  int numZSlices = ${params.numZSlices};
  int maxLightsPerCluster = ${params.maxLightsPerCluster};

  void main()
  {
    vec3 albedo = texture2D(u_colmap, f_uv).rgb;
    vec3 normap = texture2D(u_normap, f_uv).xyz;
    vec3 normal = applyNormalMap(f_normal, normap);

    vec3 fragColor = vec3(0.0);

    vec3 fpos = vec3(u_viewMatrix*vec4(f_position, 1.0)); //f_position in viewspace
    vec3 fpos_yz = fpos;
    fpos_yz.y = 0.0;
    vec3 fpos_xz = fpos;
    fpos_xz.x = 0.0;

    float halfspace = 1.0;

    fpos_yz = normalize(fpos_yz);
    if(dot(fpos_yz, u_camRight)<0.0) { halfspace = -1.0; }
    float fragXangle = atan((u_hFoV*0.5 + halfspace*fpos_yz.x) / (length(fpos_yz)));

    fpos_xz = normalize(fpos_xz); 
    if(dot(fpos_xz, u_camDown)<0.0) { halfspace = -1.0; }
    float fragYangle = atan((u_vFoV*0.5 + halfspace*fpos_xz.y) / (length(fpos_xz)));

    int clusterX_index = int( floor(fragXangle/ u_xStride) );
    int clusterY_index = int( floor(fragYangle/ u_yStride) );
    int clusterZ_index = int( floor(fpos.z / u_zStride) );

    float cluster_u = float( clusterX_index + clusterY_index * numXSlices + clusterZ_index * numXSlices * numYSlices );
    vec2 cluster_uv = vec2(cluster_u, 0);
    int clusterNumLights = int ( ExtractFloatFromClusterTexture(cluster_u, 0) );

/*
    for (int i = 0; i < ${params.maxLightsPerCluster}; ++i) 
    {
      if(i >= clusterNumLights)
      {
        break;
      }
      int comp = i+1;
      int lightIndex = int( ExtractFloatFromClusterTexture(cluster_u, comp) );

      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, f_position);
      vec3 L = (light.position - f_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
*/

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(albedo, 1.0);
    // gl_FragColor = vec4(floor((fragXangle/ u_xStride)/float(numXSlices)), 
    //                     floor((fragXangle/ u_xStride)/float(numXSlices)), 
    //                     floor((fragXangle/ u_xStride)/float(numXSlices)), 1.0);

    // gl_FragColor = vec4(float(clusterNumLights/maxLightsPerCluster), 
    //                     float(clusterNumLights/maxLightsPerCluster), 
    //                     float(clusterNumLights/maxLightsPerCluster), 1.0);

  }
  `;
}
