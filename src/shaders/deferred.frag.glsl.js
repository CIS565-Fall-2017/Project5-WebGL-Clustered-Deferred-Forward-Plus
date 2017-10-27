export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform mat4 u_viewMatrix;
  uniform sampler2D u_lightbuffer;
  uniform float u_near;
  uniform float u_far;
  uniform float u_screenwidth;
  uniform float u_screenheight;
  uniform mat4 u_invViewMatrix;
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
  
   const int num_xSlices = ${params.xSlices};
   const int num_ySlices = ${params.ySlices};
   const int num_zSlices = ${params.zSlices};
   const int numClusters = num_xSlices * num_ySlices * num_zSlices;
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    
    vec3 fragColor = vec3(0.0);
    
    vec3 alb = gb0.rgb;
    vec3 pos = gb1.xyz;
    
    // vec4 normal4 = vec4(gb1.w, gb1.w, sqrt(1.0-gb0.w*gb0.w-gb1.w*gb1.w), 0.0);
    // vec3 norm = normalize(normal4.xyz);
    vec3 norm = gb2.xyz;

    //same idea as clusteredForward,find cluster index
    vec4 resolution =  vec4(gl_FragCoord.xyz, 1.0);
    vec2 screeninfo = vec2(u_screenwidth, u_screenheight);
    resolution.xy = resolution.xy / screeninfo;
    int xSlice = int(resolution.x * float(num_xSlices));
    int ySlice = int(resolution.y * float(num_ySlices));
    vec4 fragCamPos = u_viewMatrix * vec4(pos,1.0);
    int zSlice = int( (-fragCamPos.z-u_near) / (float(u_far-u_near) / float(num_zSlices)) );
    
    int clusterIndex = xSlice + ySlice * num_xSlices + zSlice * num_xSlices * num_ySlices;
    float clusterUcoord = float(clusterIndex + 1) / float(numClusters + 1);
    int lightCount = int(texture2D(u_clusterbuffer, vec2(clusterUcoord, 0.0))[0]);
    
    for (int i = 1; i < ${params.numLights}; ++i)
    {
      if (lightCount < i)
      {
        break;
      }
      
      int clusterTexelIndex = i / 4;          
      float clustersLightVcoord = float(clusterTexelIndex + 1) / ceil(float(${params.maxLightsPerCluster} + 1) * 0.25  + 1.0);    
     
      vec4 clusterTexel = texture2D(u_clusterbuffer, vec2(clusterUcoord, clustersLightVcoord));
      
      int lightIndex;
      int reminder = i - 4 * clusterTexelIndex;
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
        
      Light thisLight = UnpackLight(lightIndex);
      float lightDistance = distance(thisLight.position, pos);
      vec3 L = (thisLight.position - pos) / lightDistance;
      
      //Blinn-Phong
      // float shininess = 4.0;
      // vec3 specColor = vec3(1.0,1.0,1.0);
      // vec3 viewDir = normalize(-vec3(u_invViewMatrix[3]));
      // vec3 halfDir = normalize(L + viewDir);
      // float specAngle = max(dot(halfDir,norm),0.0);
      // float specular = pow(specAngle,shininess);


      float lightIntensity = cubicGaussian(2.0 * lightDistance / thisLight.radius);
      float NoL = max(dot(L, norm), 0.0);
      float lambertTerm = max(dot(L, norm), 0.0);

      fragColor += alb * lambertTerm * thisLight.color * vec3(lightIntensity);  
      // + specular * specColor * vec3(lightIntensity);
    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += alb * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}