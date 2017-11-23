export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform mat4 u_invProjectionMatrix;

  uniform vec2 u_camerabuffer;
  uniform vec2 u_canvasbuffer;

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  varying vec2 v_uv;

  vec3 decode (vec4 enc)
  {
    vec4 nn = enc * vec4(2.0, 2.0, 0.0, 0.0) + vec4(-1.0, -1.0, 1.0, -1.0);
    float l = dot(nn.xyz, -nn.xyw);
    nn.z = l;
    nn.xy *= sqrt(l);
    return nn.xyz * 2.0 + vec3(0.0, 0.0, -1.0);
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

    // TODO: extract data from g buffers and do lighting

    vec4 albedo4 = texture2D(u_gbuffers[2], v_uv);
    vec4 normal4 = texture2D(u_gbuffers[1], v_uv);
    vec4 pos_world4 = texture2D(u_gbuffers[0], v_uv);

    //vec4 normal4 = vec4(pos_world4.w, albedo4.w, 0.0, 0.0);

    vec3 albedo = albedo4.rgb;
    vec3 normal = normal4.xyz;
    //vec3 normal = decode(normal4);
    vec3 pos_world = pos_world4.xyz;

    //vec3 albedo = vec3(texture2D(u_gbuffers[2], v_uv)[0], texture2D(u_gbuffers[2], v_uv)[1], texture2D(u_gbuffers[2], v_uv)[2]);
    //vec3 normal = vec3(texture2D(u_gbuffers[1], v_uv)[0], texture2D(u_gbuffers[1], v_uv)[1], texture2D(u_gbuffers[1], v_uv)[2]);
    //vec3 pos_world = vec3(texture2D(u_gbuffers[0], v_uv)[0], texture2D(u_gbuffers[0], v_uv)[1], texture2D(u_gbuffers[0], v_uv)[2]);

    vec3 fragColor = vec3(0.0);

    int numXSlices = int(${params.numXSlices});
    int numYSlices = int(${params.numYSlices});
    int numZSlices = int(${params.numZSlices});
    int numClusters = numXSlices * numYSlices * numZSlices;

    // Compute the fragment's position in camera space
    vec4 fragPos_screen = vec4(gl_FragCoord.xyz, 1.0);
    //vec4 fragPos_camera = u_invProjectionMatrix * fragPos_screen;
    vec4 fragPos_camera = u_viewMatrix * vec4(pos_world, 1.0);
    fragPos_camera /= fragPos_camera[3];

    // Compute cluster index for the fragment.

    int id_x = int(fragPos_screen[0]/u_canvasbuffer[0] * float(${params.numXSlices}));
    int id_y = int(fragPos_screen[1]/u_canvasbuffer[1] * float(${params.numYSlices}));
    
    int id_z = 0;
    float zCoord = - fragPos_camera[2];
    float SPECIAL = float(${params.SPECIAL});
    if(zCoord >= SPECIAL) {
      float dis1 = zCoord - SPECIAL;
      float dis = u_camerabuffer[1] - SPECIAL;
      float frac = log(dis1 + 1.0) / log(dis + 1.0);
      id_z = int(frac * float(numZSlices - 1) + 1.0);
    }
    int id_cluster = id_x + id_y * numXSlices + id_z * numXSlices * numYSlices;

    vec2 uv_clustercount = vec2(float(id_cluster + 1) / float(numClusters + 1), 0.0);
    int countLights = int(texture2D(u_clusterbuffer, uv_clustercount)[0]);
    const int maxLights = int(min(float(${params.numLights}), float(${params.maxLights_perCluster})));

    for (int i = 1; i <= maxLights; ++i) {
      if (countLights < i)
      {
        break;
      }
      vec2 uv_cluster = vec2(uv_clustercount[0], 0.0);
      uv_cluster[1] = float(i / 4 + 1) / ceil((float(${params.maxLights_perCluster}) + 1.0) * 0.25  + 1.0);
      vec4 texel_cluster = texture2D(u_clusterbuffer, uv_cluster);
      
      int id_light;
      int remainder = i - 4 * (i / 4);

      //fetch light
      if (remainder == 0)      
        id_light = int(texel_cluster[0]);      
      else if (remainder == 1)     
        id_light = int(texel_cluster[1]);      
      else if (remainder == 2)      
        id_light = int(texel_cluster[2]);
      else if (remainder == 3)
        id_light = int(texel_cluster[3]);
      else     
        continue;


      Light light = UnpackLight(id_light);
      float lightDistance = distance(light.position, pos_world);
      vec3 L = (light.position - pos_world) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      //Blinn-phong
      vec4 cameraPos_world = u_invViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      
      vec3 V = normalize(cameraPos_world.xyz - pos_world);
      vec3 H = normalize(L + V);
      float specular = max(dot(H, normal), 0.0);
      float speculatTerm = pow(specular, 100.0);      

      fragColor += (albedo + vec3(speculatTerm)) * lambertTerm * light.color * lightIntensity;
    }
    

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(1.0);
  }
  `;
}