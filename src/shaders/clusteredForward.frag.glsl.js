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
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float camNear;
  uniform float u_zStride;

  varying vec3 f_position;
  varying vec3 f_normal;
  varying vec2 f_uv;

  const int numXSlices = int(${params.numXSlices});
  const int numYSlices = int(${params.numYSlices});
  const int numZSlices = int(${params.numZSlices});
  const int numLights = int(${params.numLights});
  const int totalClusters = numXSlices*numYSlices*numZSlices;
  const int maxLightsPerCluster = int(${params.maxLightsPerCluster});
  const int numTexelsInColumn = int(ceil(float(${params.maxLightsPerCluster}+1) * 0.25)); 

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
    int texelID = int(floor((float(lightIndex)+1.0) / 4.0));
    float v = float(texelID) / float(numTexelsInColumn);
    vec4 texel = texture2D(u_clusterbuffer, vec2(u, v));

    //int pixelComponent = (lightIndex+1) % 4;
    int pixelComponent = texelID*4 - (lightIndex+1);
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

  void main()
  {
    vec3 albedo = texture2D(u_colmap, f_uv).rgb;
    vec3 normap = texture2D(u_normap, f_uv).xyz;
    vec3 normal = applyNormalMap(f_normal, normap);

    vec3 fragColor = vec3(0.0);

    vec3 fpos = vec3(u_viewMatrix*vec4(f_position, 1.0)); //f_position in viewspace
    //fpos.z = -fpos.z;

    float xStride = float(u_screenWidth)/float(numXSlices);
    float yStride = float(u_screenHeight)/float(numYSlices);

    int clusterX_index = int( floor(gl_FragCoord.x/ xStride) );
    int clusterY_index = int( floor(gl_FragCoord.y/ yStride) );
    int clusterZ_index = int( floor( (fpos.z-camNear) / (float(u_zStride)) ) );

    int clusterID = clusterX_index + 
                    clusterY_index * float(numXSlices) + 
                    clusterZ_index * float(numXSlices) * float(numYSlices);

    float u = float(clusterID/totalClusters);
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    for (int i = 0; i < maxLightsPerCluster; ++i) 
    {
      //if(i >= clusterNumLights)
      //{
        fragColor = vec3(float(numXSlices)/20.0,
                         float(numYSlices)/20.0,
                         float(numZSlices)/20.0);
        // fragColor = vec3(float(clusterID)/float(3375),
        //                  float(clusterID)/float(3375),
        //                  float(clusterID)/float(3375));
        //fragColor = f_normal;
        //fragColor = fpos/70.0;
        break;
     // }
      int lightIndex = int( ExtractFloatFromClusterTexture(u, i) );

      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, f_position);
      vec3 L = (light.position - f_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      //Tests
      fragColor = vec3(float(lightIndex)/float(numYSlices),float(lightIndex)/float(numYSlices),float(lightIndex)/float(numYSlices));
    }

    const vec3 ambientLight = vec3(0.025);
    //fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(albedo, 1.0);
    // gl_FragColor = vec4(clusterX_index/numXSlices, 
    //                     clusterX_index/numXSlices, 
    //                     clusterX_index/numXSlices, 1.0);

    // gl_FragColor = vec4(clusterNumLights/10, 
    //                     clusterNumLights/10, 
    //                     clusterNumLights/10, 1.0);
  }
  `;
}
