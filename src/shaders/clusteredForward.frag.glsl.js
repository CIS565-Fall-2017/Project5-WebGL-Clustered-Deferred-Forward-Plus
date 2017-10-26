export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  
  uniform vec3 sizeMin; // 0,0,0 ???
  uniform vec3 sizeMax; // w,h,1000 ???
  uniform vec3 slices;  // 15,15,15

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform mat4 viewMat;
  uniform vec4 sceneDim; // width, height, near, far

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
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
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // Determine the cluster for a fragment
    // Read in the lights in that cluster from the populated data
    // Do shading for just those lights

    // here, Z is not in the correct space..?? Also maybe include screensize as everything is 0-1
    // recompute using view matrix..
    // vec4 clusterPos = vec4(gl_FragCoord.xyz / slices, 1.0); // (v_position - sizeMin) / (sizeMax - sizeMin) * slices;
    
    vec4 clusterPos = viewMatrix * vec4(v_position,1.0); // see google group...
    clusterPos.x = clusterPos.x / sceneDim.x * slices.x;
    clusterPos.y = clusterPos.y / sceneDim.y * slices.y;
    clusterPos.z = clusterPos.z / (sceneDim.w - sceneDim.z) * slices.z;

    clusterPos = vec4(floor(clusterPos.x), floor(clusterPos.y), floor(clusterPos.z), 1.0);

    // optimize z using non linear scale once linear works..
    // show perf. comparison..

    int clusterIdx = int(clusterPos.x + clusterPos.y * slices.x + clusterPos.z * slices.x * slices.y);
    int slicesSize = int(slices.x * slices.y * slices.z);
    int clusterTexCoord = (clusterIdx + 1) / (slicesSize + 1); // like u in UnpackLight()..

    int numLights = int(texture2D(u_clusterbuffer, vec2(clusterTexCoord, 0.0)).x); // clamp to max lights in scene if this misbehaves..

    for (int i = 0; i < ${params.numLights}; i++) {
      if(i >= numLights) {
        break;
      }
      int clusterTex = i / 4; // floors by default..
      int lightIdx = int(ExtractFloat(u_clusterbuffer, slicesSize, ${params.maxLights},clusterIdx, i));

      // shading
      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.1);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
