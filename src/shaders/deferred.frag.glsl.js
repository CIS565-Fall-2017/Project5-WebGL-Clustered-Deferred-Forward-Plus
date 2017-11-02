export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjectionMatrix;
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

  ivec3 getClusterIndex(vec3 position) {
    vec4 pos = vec4(position, 1.0);
    vec4 zVec = u_viewMatrix * pos;
    vec4 viewPos = u_viewProjectionMatrix * pos;
    viewPos = viewPos / viewPos.w;

    int x = int(min(floor( (viewPos.x + 1.0) * float(${params.xSlices}) / 2.0) , 14.0));
    int y = int(min(floor( (viewPos.y + 1.0) * float(${params.ySlices}) / 2.0) , 14.0));

    float zPos = - zVec[2];
    zPos = zPos - u_near;

    float zStep = (u_far - u_near)/float(${params.zSlices});

    int z = int( min(floor(zPos/zStep), 14.0));    
    return ivec3(x,y,z);
  }

  void main() {

    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 v_position = gb0.xyz;
    vec3 albedo = gb1.rgb;
    vec3 normal = gb2.xyz;

    vec3 fragColor = vec3(0.0);

    ivec3 index = getClusterIndex(v_position);

    int clusterIdx = index.x + index.y * ${params.xSlices} + index.z * ${params.xSlices} * ${params.ySlices};

    float clusterTotal = float(${params.xSlices} * ${params.ySlices} * ${params.zSlices});
    float clusterU = float(clusterIdx + 1) / (clusterTotal + 1.0);
    int texHeight = int(float(${params.maxLights})*0.25);   

    float lightCount = ExtractFloat(u_clusterbuffer, int(clusterTotal), texHeight, clusterIdx, 0);

    float numLights = float(${params.numLights});

    // fragColor = vec3(float(index.x) / 15.0, float(index.y)/ 15.0, 0.0);

    // fragColor = vec3(float(index.z)/u_far);
    

    for (int i = 0; i < ${params.numLights}; i++) {
      
    if (i >= int(lightCount)) {
      break;
    }
    int l = int (ExtractFloat(u_clusterbuffer, int(clusterTotal), texHeight, clusterIdx, i + 1));

    Light light = UnpackLight(l);
    float lightDistance = distance(light.position, v_position);
    vec3 L = (light.position - v_position) / lightDistance;

    float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
    float lambertTerm = max(dot(L, normal), 0.0);

    float specular = 0.0;
    float shininess = 500.0;
    float gamma = 1.2;
    vec3 specColor = vec3(1.0);

    if (lambertTerm > 0.0) {
      vec3 viewDir = normalize(-v_position);
      vec3 halfDir = normalize(L + viewDir);
      float specAngle = max(dot(halfDir, normal), 0.0);
      specular = pow(specAngle, shininess);
    }
    
    fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity)
     + specular * specColor;
    
  }

  const vec3 ambientLight = vec3(0.025);
  fragColor += albedo * ambientLight;

  gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
