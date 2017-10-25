export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform vec3 u_slices;

  uniform float u_numclusters;

  varying vec2 v_uv;

  int mod(int x, float y) {
    return x - int(y * floor(float(x) / y));
  }

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
    vec4 gbuff0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gbuff1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gbuff2 = texture2D(u_gbuffers[2], v_uv); 
    vec3 v_position = gbuff0.xyz;
    vec3 albedo = gbuff1.rgb;
    vec3 normal = vec3(gbuff0.a, gbuff1.a, sqrt(1.0 - gbuff0.a * gbuff0.a - gbuff1.a * gbuff1.a));

    vec3 fragColor = vec3(0.0);

    float cluster_idx = gbuff2.x + gbuff2.y * u_slices.x + gbuff2.z * u_slices.x * u_slices.y;
    float u = cluster_idx / u_numclusters;
    int count = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);
    for (int i = 0; i < ${params.numLights}; ++i) {
      
      if (i >= count) {
        break;
      }
      int v = (i + 1)/4;
      int j = int(texture2D(u_clusterbuffer, vec2(u, float(v)))[mod(i + 1, 4.0)]);
      Light light = UnpackLight(j);
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