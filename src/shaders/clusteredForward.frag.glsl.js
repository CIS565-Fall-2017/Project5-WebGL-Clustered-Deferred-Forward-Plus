export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform mat4 u_invProjectionMatrix;
  uniform mat4 u_invViewMatrix;
  uniform sampler2D u_clusterbuffer;
  uniform vec4 u_screenbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    if(abs(geomnor.y) >= 0.999) {
       up = vec3(1.0, 0.0, 0.0);
    }
    vec3 surftan = normalize(cross(up, geomnor));
    vec3 surfbinor = cross(geomnor, surftan);
    return normalize(surftan * normap.x + surfbinor * normap.y + geomnor * normap.z);
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
    } else {
      return -1.0;
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
  const float num_maxLightsPerClust = float(${params.num_maxLightsPerCluster});
  const int num_lights = int(min(float(${params.numLights}), num_maxLightsPerClust));
  
  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);
    
    vec3 fragColor = vec3(0.0);

    vec4 screenToView =  vec4(gl_FragCoord.xyz, 1.0);
    vec4 view = u_invProjectionMatrix * screenToView;
    view /= view.w;
    screenToView.xy /= u_screenbuffer.xy;
    
    int xSlice = int(screenToView.x * float(num_xSlices));
    int ySlice = int(screenToView.y * float(num_ySlices));
    int zSlice = 0;
    
    float nearPlane = u_screenbuffer.z;

    if(-view.z >= nearPlane) {
      float n = log(-view.z - nearPlane + 1.0) / log(u_screenbuffer.w - nearPlane + 1.0);
      zSlice =  int(n * float(num_zSlices - 1))  + 1;
    }
    
    int numClusters = num_xSlices * num_ySlices * num_zSlices;
    int clusterIndex = xSlice + ySlice * num_xSlices + zSlice * num_xSlices * num_ySlices;
    float uCoord = float(clusterIndex + 1) / float(numClusters + 1);
    int lightCount = int(texture2D(u_clusterbuffer, vec2(uCoord, 0.0))[0]);
   
    for (int lightIndex = 1; lightIndex <= num_lights; lightIndex++) {
      if (lightCount < lightIndex) {
        break;
      }

      int texelIndex = lightIndex / 4;
      float vCoord = float(texelIndex + 1) / ceil(float(${params.num_maxLightsPerCluster} + 1) / 4.0  + 1.0);
      vec4 texel = texture2D(u_clusterbuffer, vec2(uCoord, vCoord));
      int r = lightIndex - 4 * texelIndex;
      int index;
      
      if (r == 0) {
        index = int(texel[0]);
      }
      else if (r == 1) {
        index = int(texel[1]);
      }
      else if (r == 2) {
        index = int(texel[2]);
      }
      else if (r == 3) {
        index = int(texel[3]);
      }
      else {
        continue;
      }

      // Blinn-Phong shading (diffuse + specular)
      Light currLight = UnpackLight(index);
      float lightDistance = distance(currLight.position, v_position);
      vec3 L = (currLight.position - v_position) / lightDistance;
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / currLight.radius);
      float NdotL = max(dot(L, normal), 0.0);
      
      vec4 cameraWorldPos = u_invViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec3 V = normalize(cameraWorldPos.xyz - v_position);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(H, normal), 0.0);
      float specular = pow(NdotH, 100.0);

      fragColor += (albedo + vec3(specular)) * NdotL * lightIntensity * currLight.color;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
