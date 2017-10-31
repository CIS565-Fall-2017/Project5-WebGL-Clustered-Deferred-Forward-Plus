export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invProjectionMatrix;
  uniform mat4 u_invViewProjectionMatrix;

  uniform vec4 u_screenInfobuffer;

  uniform sampler2D u_depthBuffer;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
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
    } else
      return -1.0;
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


  const int num_xSlices = ${params.num_xSlices};
  const int num_ySlices = ${params.num_ySlices};
  const int num_zSlices = ${params.num_zSlices};
  const int numClusters = num_xSlices * num_ySlices * num_zSlices;

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 albedo = texture2D(u_gbuffers[0], v_uv); // r : albedo.r   g : albedo.g   b : albedo.b   a : depth
    vec4 normal = texture2D(u_gbuffers[1], v_uv); // r : normal.x   g : normal.y   b : empty   a : empty

    //this is for very far depthCulling
    float depthfromDepthMap = texture2D(u_depthBuffer, v_uv).x;
    float depth = albedo.w;

    vec4 screenPos;

    // Reconstructing world space position

    if(depthfromDepthMap == 1.0)
       screenPos = vec4(v_uv * 2.0 - vec2(1.0), depthfromDepthMap, 1.0);
     else
       screenPos = vec4(v_uv * 2.0 - vec2(1.0), depth, 1.0);
     
    vec4 worldSpacePos = u_invViewProjectionMatrix * screenPos;
    worldSpacePos /= worldSpacePos.w; //WorldSpace

    vec4 vertexPos = vec4(worldSpacePos.xyz, 1.0);

    // Reconstructing View normal
    normal.z = sqrt(1.0 - (normal.x*normal.x + normal.y*normal.y));    

    vec3 fragColor = vec3(0.0);

    int xSlice = int(v_uv.x * float(num_xSlices));
    int ySlice = int(v_uv.y * float(num_ySlices));

    vec4 viewCoords = u_viewMatrix * worldSpacePos;
    
    float nearPlane = u_screenInfobuffer.z;
    float farPlane = u_screenInfobuffer.w;

    float specialNearPlane = float(${params.special_near});

    float viewZ = -viewCoords.z;

    int zSlice = 0;
        
    //special near depth slice    
    if(viewZ >= specialNearPlane)
    {
      //0....1
      float normalizedZ = log(viewZ - specialNearPlane + 1.0) / log(farPlane - specialNearPlane + 1.0);
      zSlice =  int(normalizedZ * float(num_zSlices - 1))  + 1;
    }   


    //0 ~ MAX-1
    int clusterIndex = xSlice + ySlice * num_xSlices + zSlice * num_xSlices * num_ySlices;

    float clusterUcoord = float(clusterIndex + 1) / float(numClusters + 1);

    int lightCount = int(texture2D(u_clusterbuffer, vec2(clusterUcoord, 0.0))[0]);


    const int maxNumLights = int(min(float(${params.numLights}), float(${params.num_maxLightsPerCluster})));
    
    for (int i = 1; i <= maxNumLights; i++)
    {
      if (lightCount < i)
      {
        break;
      }

      int clusterTexelIndex = i / 4;          
      float clustersLightVcoord = float(clusterTexelIndex + 1) / ceil(float(${params.num_maxLightsPerCluster} + 1) * 0.25  + 1.0);    
     
      vec4 clusterTexel = texture2D(u_clusterbuffer, vec2(clusterUcoord, clustersLightVcoord));

      int lightIndex;
      int reminder = i - 4 * clusterTexelIndex;

      //fetch
      if (reminder == 0)      
        lightIndex = int(clusterTexel[0]);      
      else if (reminder == 1)     
        lightIndex = int(clusterTexel[1]);      
      else if (reminder == 2)      
        lightIndex = int(clusterTexel[2]);
      else if (reminder == 3)
        lightIndex = int(clusterTexel[3]);
      else     
        continue;     
      
      
      //from forward.frag.glsl.js
      //assume that only point light will be used
    
      Light thisLight = UnpackLight(lightIndex);

      float lightDistance = distance(thisLight.position, vertexPos.xyz);
      vec3 L = (thisLight.position - vertexPos.xyz) / lightDistance;

      //world to View
      L = vec3(u_viewMatrix * vec4(L, 0.0));
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / thisLight.radius);
      float NoL = max(dot(L, normal.xyz), 0.0);

      //Blinn-phong
      vec4 viewPos = u_viewMatrix*vertexPos;
      vec3 viewVec = -normalize(vec3(viewPos));//-vec3(0,0,1);
      vec3 halfVec = normalize(L + viewVec);

      float NoH = max(dot(halfVec, normal.xyz), 0.0);

      vec3 diffuseTerm = albedo.xyz;
      float speculatTerm = pow(NoH, 100.0);      
      fragColor += (diffuseTerm + vec3(speculatTerm)) * NoL * lightIntensity * thisLight.color;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo.xyz * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(depth);

  }
  
  `;
}