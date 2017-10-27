export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_near;
  uniform float u_far;

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
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 v_position = gb0.rgb;
    vec3 albedo = gb1.rgb;
    vec3 normal = gb2.rgb;

    vec3 fragColor = vec3(0.0);

    vec4 viewPos = u_viewMatrix * vec4(v_position, 1.0);
    viewPos.z = -viewPos.z;

    float clusterXStride = float(u_screenWidth) / float(${params.xSlices}); 
    float clusterYStride = float(u_screenHeight) / float(${params.ySlices});
    float clusterZStride = float(u_far - u_near) / float(${params.zSlices});

    int clusterX = int(gl_FragCoord.x / clusterXStride);
    int clusterY = int(gl_FragCoord.y / clusterYStride);
    int clusterZ = int( (viewPos.z - u_near) / clusterZStride);

    int clusterIndex = clusterX + clusterY * ${params.xSlices} + clusterZ * ${params.xSlices} * ${params.ySlices};

    int numClusters = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    float u = float(clusterIndex+1)/float(numClusters+1);
    int textureHeight = int(ceil(float(${params.maxLightsPerCluster}+1) / 4.0));
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    for (int i = 0; i < ${params.numLights}; ++i) {

      if (i >= clusterNumLights) {
        break;
      }

      Light light = UnpackLight(int(ExtractFloat(u_clusterbuffer, numClusters, textureHeight, clusterIndex, i+1)));
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}