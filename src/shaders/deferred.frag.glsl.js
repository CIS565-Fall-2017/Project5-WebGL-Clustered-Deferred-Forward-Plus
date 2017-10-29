export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform float u_width;
  uniform float u_height;
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

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);


    vec3 normal = gb2.xyz;
    vec3 albedo = gb0.rgb;

    vec3 v_position = gb1.xyz;
   // vec4 worldNorm = u_invViewMatrix * vec4(gb0.w,gb1.w,sqrt(1.0-gb0.w*gb0.w-gb1.w*gb1.w),0.0);
    //vec3 normal = normalize( worldNorm.xyz);


    vec3 fragColor = vec3(0.0);
    vec4 c_pos = u_viewMatrix * vec4(v_position, 1.0);

    float xSlices = float(${params.xSlices});
    float ySlices = float(${params.ySlices});
    float zSlices = float(${params.zSlices});
    int x = int(float(gl_FragCoord.x)/(u_width/xSlices)); 

    float xf = float(x)/xSlices;
    int y = int(float(gl_FragCoord.y)/(u_height/ySlices)); 
    float yf = float(y)/ySlices;
    int z = int((-c_pos.z - u_near)/((u_far-u_near)/zSlices));
    float zf = float(z)/zSlices;

    int cluster_index = x + y * int(xSlices) + z * int(xSlices) * int(ySlices);
    int cluster_texture_h = int(ceil((float(${params.maxLights}) + 1.0) / 4.0));
    int numClusters = int(xSlices * ySlices * zSlices);
    int num_lights = int(ExtractFloat(u_clusterbuffer, numClusters, cluster_texture_h, cluster_index, 0));
    int numLightsInCluster = 0;
    float dist = 0.0;

    for (int i = 1; i <= ${params.numLights}; ++i) {
      if(i > num_lights) {break;}
      numLightsInCluster++;
      int light_idx = int(ExtractFloat(u_clusterbuffer, numClusters, cluster_texture_h, cluster_index, i));
      Light light = UnpackLight(light_idx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      float specular = 0.0;
      vec3 specColor = vec3(1.0,1.0,1.0);

      float shininess = 16.0;
      vec3 halfDir = normalize((light.position - v_position) - v_position);
      float specAngle = max(dot(halfDir, normal), 0.0);
      specular = pow(specAngle, shininess);

      fragColor += (albedo * lambertTerm * light.color  + specular * specColor) * vec3(lightIntensity);

      dist = lightDistance;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);

    float test_col = float(num_lights)/20.0;
    //test_col = float(num_lights)/1.0;
    //test_col = float(numLightsInCluster)/110.0;
    test_col = float(num_lights)/50.0;
    //gl_FragColor = gl_FragColor * zf;
    //gl_FragColor = vec4(xf,yf,zf,1.0);
    if(dist <= 5.0) {
      //gl_FragColor.r += 0.5;
    }
    
    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
    //gl_FragColor = vec4(v_position,1);
    //gl_FragColor = viewNorm;
  }
  `;
}