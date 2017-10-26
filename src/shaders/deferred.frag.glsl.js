export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_lightbuffer;  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  
  uniform mat4 u_viewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float camNear;
  uniform float u_zStride;

  varying vec2 f_uv;

  const int numXSlices = int(${params.numXSlices});
  const int numYSlices = int(${params.numYSlices});
  const int numZSlices = int(${params.numZSlices});
  const int numLights = int(${params.numLights});
  const int totalClusters = numXSlices*numYSlices*numZSlices;
  const int maxLightsPerCluster = int(${params.maxLightsPerCluster});
  const int numTexelsInColumn = int(ceil(float(${params.maxLightsPerCluster}+1) * 0.25)); 
  
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
    // extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], f_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], f_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], f_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], f_uv);

    vec3 f_position = gb0.rgb;
    vec3 albedo = gb1.rgb;
    vec3 normal = vec3(gb0.a, gb1.a, gb2.r);

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < numLights; ++i) 
    {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, f_position);
      vec3 L = (light.position - f_position) / lightDistance;

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