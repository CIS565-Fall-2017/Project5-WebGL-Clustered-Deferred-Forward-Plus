export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform mat4 u_viewMatrix;

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform float u_nearPlane; // camera clip
  uniform float u_farPlane; // camera clip
  uniform float u_aspect; // aspect ratio
  uniform float u_tanfov2; // tangent of half fov
  uniform vec3 u_slices;
  
  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;
    light.radius = v1.w;
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

  // Otahedron encoding
  //https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/
  vec3 decodeNormal(in vec2 enc) {
    /*vec3 n;
    float temp = sign(encoded.y);
    encoded.y = temp * encoded.y;
    n.xy = 2.0 * encoded - 1.0;
    n.z = sqrt(abs(1.0 - n.x * n.x - n.y * n.y) + 0.0001);
    n.z *= temp;
    return n;*/
    enc = 2.0 * enc - 1.0;
    vec3 n;
    n.z = 1.0 - abs(enc.x) - abs(enc.y);
    n.xy = n.z >= 0.0 ? enc.xy : (1.0 - abs(enc.yx)) * vec2(sign(enc.x), sign(enc.y));
    return normalize(n);
  }

  int clusterIndexFromPt (in vec3 pos) {
    float vl = abs(u_tanfov2 * pos.z);
    float hl = vl * u_aspect;

    float hi = clamp((pos.x + hl) / (hl + hl), 0.0, 0.999); // horizontal
    float vi = clamp((pos.y + vl) / (vl + vl), 0.0, 0.999); // vertical
    float di = clamp((-pos.z - u_nearPlane) / (u_farPlane - u_nearPlane), 0.0, 0.999);

    return int(floor(hi * u_slices.x) + floor(vi * u_slices.y) * u_slices.x + floor(di * u_slices.z) * u_slices.y * u_slices.x);
  }


  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 nor = decodeNormal(gb1.zw);
    vec3 col = gb0.xyz;
    vec3 pos = vec3(gb0.w, gb1.xy);

    vec3 fragColor = vec3(0.0);
    int clusterIDX = clusterIndexFromPt(pos);
    float cl_u = float(clusterIDX + 1) / (1.0 + u_slices.x * u_slices.y * u_slices.z);
    float numLights = texture2D(u_clusterbuffer, vec2(cl_u, 0.0)).x;

    //numLights /= 10.0;//float(${params.numLights});
    for (int i = 0; i < ${params.numLights}; i+=4) {
      if (i > int(numLights)) break;
      float cl_v = float(i/4 + 1)/ (26.0 + 1.0);
      vec2 uv = vec2(cl_u, cl_v);
      vec4 sample = texture2D(u_clusterbuffer, uv);

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
        float lightDistance = distance(light.position, pos);
        vec3 L = (light.position - pos) / lightDistance;

        vec3 H = normalize(normalize(light.position - pos) + normalize(-pos));

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, nor), 0.0);
        float specularTerm = pow(max(dot(H, nor), 0.0), 64.0);

        fragColor += lightIntensity * light.color * (col * lambertTerm + specularTerm * vec3(0.5));
      }
    }


    const vec3 ambientLight = vec3(0.025);
    fragColor += col * ambientLight;

    
    
    //gl_FragColor = vec4(clamp(pos, vec3(0), vec3(1)), 1.0);
    gl_FragColor = vec4(fragColor.xyz, 1.0);
  }
  `;
}