export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform mat4 u_invProjectionMatrix;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

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
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 albedo = gb0.rgb;
    float depth = gb0.w;

    vec3 normal;
    normal.xy = gb1.xy * 2.0 - 1.0;
    normal.z = sqrt(1.0 - ((normal.x * normal.x) + (normal.y * normal.y)));

    float spec = gb1.z;
    float specExp = gb1.w;

    vec3 sliceCount = vec3(${params.xSlices}, ${params.ySlices}, ${params.zSlices});
    int totalSliceCount = int(sliceCount.x * sliceCount.y * sliceCount.z);
    vec3 ndcPos = vec3(v_uv, depth);

    ivec3 slicePos = ivec3(min(floor(ndcPos.xyz * sliceCount), vec3(14.0)));
    int index = slicePos.x + slicePos.y * ${params.xSlices} + slicePos.z * ${params.xSlices} * ${params.ySlices};

    int clusterBufferStride = int(ceil(float(${params.numLights} + 1) / 4.0));
    int lightCount = int(ExtractFloat(u_clusterbuffer, totalSliceCount, clusterBufferStride, index, 0));
    vec3 fragColor = vec3(0.0);

    // In view space
    ndcPos.xy = ndcPos.xy * 2.0 - vec2(1.0);
    vec4 vsPos = vec4(u_invProjectionMatrix * (vec4(ndcPos.x, ndcPos.y, ndcPos.z, 1.0) * 1000.0)); // Far clip
    vec3 position = vsPos.xyz / vsPos.w;

    for(int i = 0; i < ${params.numLights}; ++i) {

      if(i >= lightCount)
        break;

      int lightIndex = int(ExtractFloat(u_clusterbuffer, totalSliceCount, clusterBufferStride, index, i + 1));

      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      vec3 R = reflect(L, normal);
      float spec = pow(max(0.0, -R.z), specExp) * spec;

      fragColor += albedo * (lambertTerm + spec) * light.color * vec3(max(0.0, lightIntensity));
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);

    // gl_FragColor = vec4(normal, 1.0);//vec4(v_uv, 0.0, 1.0);
  }
  `;
}