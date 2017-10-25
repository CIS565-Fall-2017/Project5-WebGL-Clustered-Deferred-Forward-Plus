export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform vec3 u_slices;
  uniform vec2 u_res;
  uniform float u_cameranear;
  uniform float u_camerafar;
  uniform float u_numclusters;

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
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);    

    // determine cluster for fragment
    float x = floor(gl_FragCoord.x * u_slices.x / u_res.x);
    float y = floor(gl_FragCoord.y * u_slices.y / u_res.y); 

    vec4 fragViewSpace = u_viewMatrix * vec4(v_position, 1.0);
    float z = floor((-fragViewSpace.z - u_cameranear) * u_slices.z / (u_camerafar - u_cameranear));

    vec3 fragColor = vec3(0.0);

    float cluster_idx = x + y * u_slices.x + z * u_slices.x * u_slices.y;
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

    // gl_FragColor = vec4(vec3(UnpackLight(int(texture2D(u_clusterbuffer, vec2(u, 0.0))[1])).color), 1.0);
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}