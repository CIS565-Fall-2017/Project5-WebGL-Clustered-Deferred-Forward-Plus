export default function(params) {
  return `
  #version 100
  precision highp float;
  
    uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];


  uniform vec4 u_cameraInfo;//canvas.width, canvas.height, camera.near, camera.far
  uniform mat4 u_viewMatrix;

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
    light.radius = v1.w;//ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

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

  const int xSlices = ${params.num_xSlices};
  const int ySlices = ${params.num_ySlices};
  const int zSlices = ${params.num_zSlices};
  const int total_num_Clusters = xSlices * ySlices * zSlices;

  void main() {
  //0. read gbuffers
    vec4 gbuffer0 = texture2D(u_gbuffers[0], v_uv); //r,g,b
    vec4 gbuffer1 = texture2D(u_gbuffers[1], v_uv); //v_position
    vec4 gbuffer2 = texture2D(u_gbuffers[2], v_uv); //normal

    vec3 albedo = gbuffer0.rgb;
    vec3 v_position = gbuffer1.xyz;
    vec3 normal = gbuffer2.xyz;

  // //Spherical Representation of normal
  //   vec2 normal_sph = vec2(gbuffer0.w, gbuffer1.w);
  //   vec3 normal;
  //   normal.x = sin(normal_sph.x)*cos(normal_sph.y);
  //   normal.y = sin(normal_sph.x)*sin(normal_sph.y);
  //   normal.z = cos(normal_sph.x);

    vec3 fragColor = vec3(0.0);

  //1. compute the cluster index of this fragment
    //1.1
    vec4 screen_Coords = gl_FragCoord;
    screen_Coords.xy /= u_cameraInfo.xy;

    vec4 view_Coords = u_viewMatrix * vec4(v_position, 1.0);
    view_Coords /= view_Coords.w;

    //1.2 get the index of x y z of cluster which the fragment is in
    int x, y, z;
    x = int((screen_Coords.x) * float(xSlices));
    y = int((screen_Coords.y) * float(ySlices));
    z = int( (-view_Coords.z-u_cameraInfo.z) / float(u_cameraInfo.w-u_cameraInfo.z) * float(zSlices));

    int cluster_index = x + y * xSlices + z * xSlices * ySlices;

  //2. unpack the cluster Texture according to the cluster index
    float u = float(cluster_index + 1) / float(total_num_Clusters + 1);
    float v = 0.0;
    vec4 v0 = texture2D(u_clusterbuffer, vec2(u,v));
    int light_count = int(v0[0]);
    
    const int maxLights = int(min(float(${params.numLights}), float(${params.num_maxLightsPerCluster})));;  
    for (int i = 1; i <= maxLights; ++i){
      if(i > light_count){
        break;
      }
      int clusterTexelIndex = int(float(i) * 0.25);
      v = float(clusterTexelIndex + 1) / ceil(float(${params.num_maxLightsPerCluster} + 1) * 0.25  + 1.0); 
      vec4 v_current = texture2D(u_clusterbuffer, vec2(u,v));
      int offset = i - clusterTexelIndex * 4;
      
      int light_index;
      if (offset == 0)      
        light_index = int(v_current[0]);      
      else if (offset == 1)     
        light_index = int(v_current[1]);      
      else if (offset == 2)      
        light_index = int(v_current[2]);
      else if (offset == 3)
        light_index = int(v_current[3]);
      else     
        continue;

// Same as forward.frag.glsl.js
      Light light = UnpackLight(light_index);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

// Regular
      // float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      // float lambertTerm = max(dot(L, normal), 0.0);
      // fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

// //Blinn-Phong
//       vec3 specColor = vec3(1.0);

//       vec3 viewDir = normalize(-vec3(view_Coords));
//       vec3 halfDir = normalize(L + viewDir);

//       float specAngle = max(dot(halfDir, normal), 0.0);
//       float specularTerm = pow(specAngle, 32.0);
      

//       float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
//       float lambertTerm = max(dot(L, normal), 0.0);
      
//       //fragColor += specColor * specularTerm * light.color * vec3(lightIntensity);
//       fragColor += (albedo * lambertTerm + specColor * specularTerm) * light.color * vec3(lightIntensity);

//Toon Shading
      float steps = 2.5;
      float toonEffect = 0.8;
      //----lambert
      //vec3 I = normalize() L
      float lambertTerm = max(dot(L, normal), 0.0);
      float toon = floor(lambertTerm * steps) / steps;
      lambertTerm = lambertTerm * (1.0 - toonEffect) + toon * toonEffect;

      //----specular
      vec3 specColor = vec3(1.0);
      vec3 viewDir = normalize(-vec3(view_Coords));
      vec3 halfDir = normalize(L + viewDir);
      float specAngle = max(dot(halfDir, normal), 0.0);
      float specularTerm = pow(specAngle, 32.0);
      float toonSpec = floor(specularTerm * 2.0) / 2.0;
      specularTerm = specularTerm * (1.0 - toonEffect) + toon * toonEffect;
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);

      // Compute final color
      fragColor += (albedo * lambertTerm + specColor * specularTerm) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    
    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(normal, 1.0);

    // int k = maxLights;
    // float t = float(light_count)/float(k);
    // gl_FragColor = vec4(t,t,t, 1.0);
  }
  `;
}