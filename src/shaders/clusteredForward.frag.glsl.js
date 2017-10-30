export default function(params) {
  return `
  // This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  
  // Camera parameters
  uniform float u_camera_fov; // already in radians
  uniform float u_camera_aspect;
  uniform float u_camera_near;
  uniform float u_camera_far;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec3 v_positionVC; // position in view space

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

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    // Determine the cluster that this fragment is in - 
    vec3 fragCluster;

    // Compute the same stuff we computed on the CPU for each light
    const float lightRadius = float(${params.lightRadius});
    const float numClusters = 15.0; // actually 15 but for math reasons, do numClusters - 1

    // Frustum width and height at this light's z-value
    float halfFrustumHeight  = abs(tan(u_camera_fov) * -v_positionVC.z);
    float halfFrustumWidth = halfFrustumHeight * u_camera_aspect;
    float denom = 1.0 / (2.0 * halfFrustumHeight);
    float denomX = 1.0 / (2.0 * halfFrustumWidth);

    // Min and max clusters influenced in the x-direction
    float clusterX = floor(((v_positionVC.x + halfFrustumWidth) * denomX) * numClusters);

    // Min and max clusters influenced in the y-direction
    float clusterY = floor(((v_positionVC.y + halfFrustumHeight) * denom) * numClusters);

    // Min and max clusters influenced in the z-direction
    float clusterZ = floor(((-v_positionVC.z - u_camera_near) / (u_camera_far - u_camera_near)) * numClusters);

    // Now read from the cluster texture to find out what lights are in the same cluster as this fragment
    vec2 uv_cluster = vec2(0.0, 0.0);

    float clusterIndex = clusterX + clusterY * (numClusters) + clusterZ * (numClusters) * (numClusters);
    uv_cluster.x = clusterIndex / (15.0 * 15.0 * 15.0);

    int numLightsInThisCluster = int(texture2D(u_clusterbuffer, uv_cluster).r);
    
    const float MAX_LIGHTS_PER_CLUSTER_RATIO = 1.0 / 26.0; // 1 / ceil(100 / 4)
    const int MAX_LIGHTS_PER_CLUSTER = 26; // max number of rows in the clusterbuffer texture

    vec3 fragColor = vec3(0.0);
    //gl_FragColor = vec4(normalize(normal), 1.0); return;
    for(int i = 0; i <= ${params.numLights}; i += 4) {
      if(i > numLightsInThisCluster) {
        break;
      }
      uv_cluster.y = floor(float(i) / 4.0) * MAX_LIGHTS_PER_CLUSTER_RATIO;

      vec4 lightIds = texture2D(u_clusterbuffer, uv_cluster);
      
      // Shade using each light in this cluster
      for(int l = 0; l < 4; ++l) {
        if(l + i == 0) {
          continue;
        }
        if(l + i > numLightsInThisCluster) {
          break;
        }

        Light light = UnpackLight(int(lightIds[l]));
        vec3 lightPos = (u_viewMatrix * vec4(light.position, 1.0)).xyz;
        float lightDistance = distance(lightPos, v_positionVC);
        vec3 L = (lightPos - v_positionVC) / lightDistance;
  
        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);
  
        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
