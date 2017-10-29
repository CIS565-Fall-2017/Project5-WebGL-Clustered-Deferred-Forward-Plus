export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;
  
  // Newly added
  uniform mat4 u_viewMatrix;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform vec2 u_screenDimension;
  uniform vec2 u_cameraClipPlanes;
  uniform vec3 u_cameraPos;

  // Blinn-Phong Shading Variables
  const float shininess = 100.0;

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
    // TODO: extract data from g buffers and do lighting
    vec4 gb0Pos = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1Normal = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2Color = texture2D(u_gbuffers[2], v_uv);
    vec3 albedo = gb2Color.rgb;
    vec3 normal = gb1Normal.xyz;
    vec3 v_position = gb0Pos.xyz;

    //<Optimization> Uncomment this region and the respective regions to use optimized g buffers
    // vec4 gb0Pos = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1Color = texture2D(u_gbuffers[1], v_uv);
    // vec3 albedo = gb1Color.rgb;
    // vec3 v_position = gb0Pos.xyz;
    // vec3 normal = normalize(vec3(gb0Pos.w, gb1Color.w, sqrt(abs(1.0 - gb0Pos.w * gb0Pos.w - gb1Color.w * gb1Color.w))));
    //</Optimization>

    vec3 fragColor = vec3(0.0);

    // Fisrt the start position of the fragmnets
    int clusterPosX = int( gl_FragCoord.x / (u_screenDimension.x / float(${params.xSlices})) );
    int clusterPosY = int( gl_FragCoord.y / (u_screenDimension.y / float(${params.ySlices})) );
    int clusterPosZ = int( ((-(u_viewMatrix * vec4(v_position, 1.0)).z) - u_cameraClipPlanes.x) / ((u_cameraClipPlanes.y - u_cameraClipPlanes.x) / float(${params.zSlices})) );

    // Cluster Index
    int clusterIndex = clusterPosX + clusterPosY * ${params.xSlices} + clusterPosZ * ${params.xSlices} * ${params.ySlices};
    int clusterSize = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    int numOfClustersAlongY = int(float(${params.maxLightsPerCluster}+1) * 0.25) + 1;

    // In order to find out the number of lights in the cluster we need to find out the U which will be used with u_clusterbuffer
    float clusterTextureU = float(clusterIndex+1) / float(clusterSize+1);
    int clusterLightCount = int(texture2D(u_clusterbuffer, vec2(clusterTextureU,0)).x);

    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= clusterLightCount) {
        break;
      }

      // The index of light that are stored inside the texture are differenet
      int lightIndex;

      int textureIndex = int(float(i+1) * 0.25);
      float clusterTextureV = float(textureIndex+1) / float(numOfClustersAlongY + 1);
      vec4 texel = texture2D(u_clusterbuffer, vec2(clusterTextureU, clusterTextureV));

      int clusterTexelComponent = (i+1) - (textureIndex * 4);
      if (clusterTexelComponent == 0) {
        lightIndex = int(texel[0]);
      } else if (clusterTexelComponent == 1) {
        lightIndex = int(texel[1]);
      } else if (clusterTexelComponent == 2) {
        lightIndex = int(texel[2]);
      } else if (clusterTexelComponent == 3) {
        lightIndex = int(texel[3]);
      }

      // Shading part of the base code
      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // Blinn Phong
      float specular = 0.0;
      vec3 lightDirection = normalize(u_cameraPos - v_position);
      if(lambertTerm > 0.0) {
        vec3 viewDir = normalize(u_cameraPos - v_position);
        vec3 halfDir = normalize(L + viewDir);
        float specAngle = max(dot(halfDir, normal), 0.0);
        specular = pow(specAngle, shininess);
      }
      albedo += vec3(specular);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}