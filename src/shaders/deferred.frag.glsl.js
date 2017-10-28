export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  
  uniform float u_screenHeight;
  uniform float u_screenWidth;
  uniform float u_camFar;
  uniform float u_camNear;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_inverseViewMatrix;

  varying vec2 v_uv;
  
  const vec3 specColor = vec3(0.1, 0.1, 0.1);
  const float shininess = 800.0;
  const float screenGamma = 2.0;

  #define GAMMA_CORRECTION true
  #define BLINN_PHONG true


  // ==========================================================================

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------

  Light UnpackLight(int index) {
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

  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------  

  // https://aras-p.info/texts/CompactNormalStorage.html
  vec3 getUnreducedNormal(vec2 reducedNorm)
  {
    vec3 normal;
    normal.xy = (2.0 * reducedNorm) - 1.0;
    normal.z = sqrt(1.0 - ((normal.x * normal.x) + (normal.y * normal.y)));
    return normal;
  }

  // --------------------------------------------------------------------------

  void main() {

    // ============================== Normal Compression ==============================
    
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);


    // Get data from g-buffers
    vec3 albedo = gb0.rgb;
    vec3 v_position = gb1.rgb;

    // Calculate unreduced normal
    // Make sure to multiply inverse view matrix to bring back to world space
    vec2 reducedNormal = vec2(gb0[3], gb1[3]);
    vec3 unReducedNormal = getUnreducedNormal(reducedNormal);
    vec4 _normal = u_inverseViewMatrix * vec4(unReducedNormal, 0.0);
    vec3 normal = vec3(_normal[0], _normal[1], _normal[2]);                               //using world space normal
    // vec3 normal = vec3(unReducedNormal[0], unReducedNormal[1], unReducedNormal[2]);    //using view space normal

    // ============================== No Normal Compression ==============================

    // // TODO: extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    // // Get data from g-buffers
    // vec3 albedo = gb0.rgb;
    // vec3 v_position = gb1.rgb;
    // vec3 normal = gb2.rgb;

    // ============================== End No Normal Compression ==============================


    vec3 fragColor = vec3(0.0);
    
    vec4 _fragPos = u_viewMatrix * vec4(v_position, 1.0);
    vec3 fragPos = vec3(_fragPos[0], _fragPos[1], -1.0 * _fragPos[2]);  // Make sure to negate z

    float z_stride = float(u_camFar - u_camNear) / float(${params.z_slices});
    float y_stride = float(u_screenHeight) / float(${params.y_slices});
    float x_stride = float(u_screenWidth) / float(${params.x_slices});

    // gl_FragCoord.xy are in pixel/screen space, .z is in [0, 1]
    int z_cluster_idx = int(floor((fragPos[2] - u_camNear) / z_stride));

    int y_cluster_idx = int(floor(gl_FragCoord.y / y_stride)); 
    int x_cluster_idx = int(floor(gl_FragCoord.x / x_stride));

    // Calculate u index into cluster texture
    int clusterIdx = x_cluster_idx + 
                    (y_cluster_idx * ${params.x_slices}) + 
                    (z_cluster_idx * ${params.x_slices} * ${params.y_slices});

    int totalNumClusters = ${params.x_slices} * ${params.y_slices} * ${params.z_slices};            
    int texWidth = int(ceil(float(${params.maxLightsPerCluster} + 1) / 4.0)); 
    const int maxLightsPerCluster = int(${params.maxLightsPerCluster});

    // Get the light count from cluster texture, iterate through that
    // Note: Textures go from [0, 1], so divide u and v by width and height before calling texture2D
    // "+ 1" to make sure you hit inside pixel 
    float u = float(clusterIdx + 1) / float(totalNumClusters + 1);
    vec4 firstVComponent = texture2D(u_clusterbuffer, vec2(u, 0));
    int numLightsInCluster = int(firstVComponent.r); 

    // Light Calculation
    for (int i = 0; i < maxLightsPerCluster; ++i) 
    {
      if(i >= numLightsInCluster)  break;

      // Get the light index in cluster texture 
      int lightIdxInTexture = int(ExtractFloat(u_clusterbuffer, totalNumClusters, texWidth, clusterIdx, i+1));  

      Light light = UnpackLight(lightIdxInTexture);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      if(BLINN_PHONG)
      {
        // Blinn Phong Model ----------------------
        // https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model
  
        float specular = 0.0;
        if(lambertTerm > 0.0)
        {
          //Blinn Phong
          vec3 lightDir = light.position - v_position;
          vec3 viewDir = normalize(-v_position);
          
          // vec3 halfDir = normalize(L + viewDir);
          vec3 halfDir = normalize(lightDir + viewDir);
          
          float specAngle = max(dot(halfDir, normal), 0.0);
          specular = pow(specAngle, shininess);
        }
  
        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity) + specular * specColor;
      }
      else
      {
        // Lambert Only ----------------------
        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }

    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    // --------------------- Gamma Correction ---------------------

    if(GAMMA_CORRECTION)
    {
      vec3 gammaCorrectedColor = pow(fragColor, vec3(1.0 / screenGamma));
      gl_FragColor = vec4(gammaCorrectedColor, 1.0);
    }
    else
    {
      gl_FragColor = vec4(fragColor, 1.0);
    }

    


  }
  `;
}