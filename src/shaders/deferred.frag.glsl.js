export default function(params) {
  return `

  #version 100
  precision highp float;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform vec3 u_slices;
  uniform vec2 u_res;
  uniform float u_cameranear;
  uniform float u_camerafar;
  uniform vec3 u_camerapos;

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
    vec4 gbuff0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gbuff1 = texture2D(u_gbuffers[1], v_uv);
    vec3 v_position = gbuff0.xyz;
    vec3 albedo = gbuff1.rgb;
    vec3 normal = vec3(gbuff0.a, gbuff1.a, sqrt(1.0 - gbuff0.a * gbuff0.a - gbuff1.a * gbuff1.a));   
    if ((v_position - u_camerapos).z < 0.0) normal.z *= -1.0;

    // determine cluster for fragment
    float x = floor(gl_FragCoord.x * u_slices.x  / u_res.x);
    float y = floor(gl_FragCoord.y * u_slices.y / u_res.y); 

    vec4 fragViewSpace = u_viewMatrix * vec4(v_position, 1.0);
    float z = floor((-fragViewSpace.z - u_cameranear) * u_slices.z / (u_camerafar - u_cameranear));

    vec3 fragColor = vec3(0.0);

    float cluster_idx = x + y * u_slices.x + z * u_slices.x * u_slices.y;
    float numclusters = u_slices.x * u_slices.y * u_slices.z;
    float u = (cluster_idx + 1.0) / (numclusters + 1.0);
    int count = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);
    for (int i = 0; i < ${params.numLightsPerCluster}; ++i) {  
      if (i >= count) {
        break;
      }

      float j = ExtractFloat(u_clusterbuffer, int(numclusters), ${Math.floor((params.numLightsPerCluster + 1) / 4)}, int(cluster_idx), i + 1);
      Light light = UnpackLight(int(j));
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