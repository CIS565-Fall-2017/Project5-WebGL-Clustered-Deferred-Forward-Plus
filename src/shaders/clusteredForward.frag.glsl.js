export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;
  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform float u_near;
  uniform float u_far;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

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



   const int num_xSlices = ${params.num_xSlices};
   const int num_ySlices = ${params.num_ySlices};
   const int num_zSlices = ${params.num_zSlices};
   const int numClusters = num_xSlices * num_ySlices * num_zSlices;
   const int width = ${params.canvaswidth};
   const int height = ${params.canvasheight};


  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);
    
    vec4 resolution =  vec4(gl_FragCoord.xyz, 1.0);
    
    vec2 screeninfo = vec2(width,height);
    
    resolution.xy = resolution.xy / screeninfo;
    
    
    int xSlice = int(resolution.x * float(num_xSlices));
    int ySlice = int(resolution.y * float(num_ySlices));
    vec4 fragCamPos = u_viewMatrix * vec4(v_position,1.0);
    int zSlice = int( (-fragCamPos.z-u_near) / 
                        (float(u_far-u_near) / float(num_zSlices)) );
    
    int clusterIndex = xSlice + ySlice * num_xSlices + zSlice * num_xSlices * num_ySlices;
    float clusterUcoord = float(clusterIndex + 1) / float(numClusters + 1);
    int lightCount = int(texture2D(u_clusterbuffer, vec2(clusterUcoord, 0.0))[0]);
    

    for (int i = 1; i <${params.numLights}; ++i) {
      if (lightCount < i)
      {
        break;
      }
      
      int clusterTexelIndex = i / 4;          
      float clustersLightVcoord = float(clusterTexelIndex + 1) / ceil(float(${params.num_maxLightsPerCluster} + 1) * 0.25  + 1.0);    
     
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
      float lightDistance = distance(thisLight.position, v_position);
      vec3 L = (thisLight.position - v_position) / lightDistance;
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / thisLight.radius);
      float NoL = max(dot(L, normal), 0.0);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * thisLight.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
