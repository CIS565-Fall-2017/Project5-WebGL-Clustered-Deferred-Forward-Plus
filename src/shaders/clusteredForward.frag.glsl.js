export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform float u_nearPlane; // camera clip
  uniform float u_farPlane; // camera clip
  uniform float u_aspect; // aspect ratio
  uniform float u_tanfov2; // tangent of half fov
  uniform vec3 u_slices;

  //uniform int u_MAX_LIGHTS_PER_CLUSTER;

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

  int clusterIndexFromPt (in vec3 pos) {
    float vl = abs(u_tanfov2 * pos.z);
    float hl = vl * u_aspect;

    float hi = clamp((pos.x + hl) / (hl + hl), 0.0, 0.999); // horizontal
    float vi = clamp((pos.y + vl) / (vl + vl), 0.0, 0.999); // vertical
    float di = clamp((-pos.z - u_nearPlane) / (u_farPlane - u_nearPlane), 0.0, 0.999);

    di = di * di * (3.0 - 2.0 * di);
    di = pow(di, 0.25);

    return int(floor(hi * u_slices.x) + floor(vi * u_slices.y) * u_slices.x + floor(di * u_slices.z) * u_slices.y * u_slices.x);
  }

  vec3 debugClusterColor (in vec3 pos) {
    float vl = abs(u_tanfov2 * pos.z);
    float hl = vl * u_aspect;

    float hi = clamp((pos.x + hl) / (hl + hl), 0.0, 0.999); // horizontal
    float vi = clamp((pos.y + vl) / (vl + vl), 0.0, 0.999); // vertical
    float di = clamp((-pos.z - u_nearPlane) / (u_farPlane - u_nearPlane), 0.0, 0.999);

    di = di * di * (3.0 - 2.0 * di);
    di = pow(di, 0.25);


    return vec3(floor(hi * u_slices.x) / u_slices.x, floor(vi * u_slices.y) / u_slices.y, floor(di * u_slices.z) / u_slices.z);
  }

  vec3 debugNormalized(in vec3 pos) {
    float vl = abs(u_tanfov2 * pos.z);
    float hl = vl * u_aspect;

    float hi = clamp((pos.x + hl) / (hl + hl), 0.0, 0.999); // horizontal
    float vi = clamp((pos.y + vl) / (vl + vl), 0.0, 0.999); // vertical
    float di = clamp((-pos.z - u_nearPlane) / (u_farPlane - u_nearPlane), 0.0, 0.999);

    di = di * di * (3.0 - 2.0 * di);
    di = pow(di, 0.25);

    return vec3(hi, vi, di);
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);
    int clusterIDX = clusterIndexFromPt(v_position);
    float cl_u = float(clusterIDX + 1) / (1.0 + u_slices.x * u_slices.y * u_slices.z);
    float numLights = texture2D(u_clusterbuffer, vec2(cl_u, 0.0)).x;


    float saved = 0.0;
    //numLights /= 10.0;//float(${params.numLights});
    for (int i = 0; i < ${params.numLights}; i+=4) {
      if (i > int(numLights)) break;
      float cl_v = float(i/4 + 1)/ (26.0 + 1.0);
      vec2 uv = vec2(cl_u, cl_v);
      vec4 sample = texture2D(u_clusterbuffer, uv);

      saved = cl_v;
      for (int j = 0; j < 4; j++) {
        if (i + j == 0) continue; //blech
        if (i + j > int(numLights)) break;
        int indirection;
        if (j == 0) indirection = int(sample[0]);
        else if (j == 1) indirection = int(sample[1]);
        else if (j == 2) indirection = int(sample[2]);
        else indirection = int(sample[3]);

        Light light = UnpackLight(indirection);
        light.position = (u_viewMatrix * vec4(light.position, 1.0)).xyz;
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }
    }
    /*
    for (int i = 0; i < ${params.numLights}; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    */
    //gl_FragColor = vec4(debugClusterColor(v_position), 1.0);
    //if (dot(fragColor, fragColor) < 0.001) fragColor = debugClusterColor(v_position).zzz;
    //gl_FragColor = vec4(cl_u, cl_u, cl_u, 1.0);
    //gl_FragColor = vec4(vec3(saved), 1.0);
    //gl_FragColor = vec4(vec3(numLights / 100.0), 1.0);
    //gl_FragColor = vec4(debugNormalized(v_position), 1.0);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
