export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;

  varying vec2 v_uv;
  
  // Camera parameters
  uniform float u_camera_fov; // already in radians
  uniform float u_camera_aspect;
  uniform float u_camera_near;
  uniform float u_camera_far;

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

  // https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

  vec2 OctahedronEncodingWrap( vec2 v )
  {
    return ( vec2(1.0) - abs( v.yx ) ) * vec2(sign(v.x), sign(v.y));
  }

  vec3 DecodeNormal( vec2 encodedNormal ) {
    encodedNormal = encodedNormal * 2.0 - 1.0;
    
       vec3 n;
       n.z = 1.0 - abs( encodedNormal.x ) - abs( encodedNormal.y );
       n.xy = n.z >= 0.0 ? encodedNormal.xy : OctahedronEncodingWrap( encodedNormal.xy );
       n = normalize( n );
       return n;
  }

  void main() {
    // Extract data from G-buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // Normals
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // Depth

    vec3 normal = normalize(DecodeNormal(gb0.rg));
    vec3 albedo = vec3(gb0.ba, gb1.r);
    vec3 position = (u_viewMatrix * vec4(gb1.gba, 1.0)).xyz;
    
    //gl_FragColor = vec4(gb1.gba, 1.0); return;

    // Compute the same stuff we computed on the CPU for each light
    const float lightRadius = float(${params.lightRadius});
    const float numClusters = 15.0;

    // Frustum width and height at this light's z-value
    float halfFrustumHeight  = abs(tan(u_camera_fov) * -position.z);
    float halfFrustumWidth = halfFrustumHeight * u_camera_aspect;
    float denom = 1.0 / (2.0 * halfFrustumHeight);
    float denomX = 1.0 / (2.0 * halfFrustumWidth);

    // Min and max clusters influenced in the x-direction
    float clusterX = floor(((position.x + halfFrustumWidth) * denomX) * numClusters);

    // Min and max clusters influenced in the y-direction
    float clusterY = floor(((position.y + halfFrustumHeight) * denom) * numClusters);

    // Min and max clusters influenced in the z-direction
    float clusterZ = floor(((-position.z - u_camera_near) / (u_camera_far - u_camera_near)) * numClusters);

    // Now read from the cluster texture to find out what lights are in the same cluster as this fragment
    vec2 uv_cluster = vec2(0.0, 0.0);

    float clusterIndex = clusterX + clusterY * (numClusters) + clusterZ * (numClusters) * (numClusters);
    uv_cluster.x = clusterIndex / (15.0 * 15.0 * 15.0);

    int numLightsInThisCluster = int(texture2D(u_clusterbuffer, uv_cluster).r);
    
    const float MAX_LIGHTS_PER_CLUSTER_RATIO = 1.0 / ceil(100.0 / 4.0);
    const int MAX_LIGHTS_PER_CLUSTER = int(ceil(100.0 / 4.0)); // max number of rows in the clusterbuffer texture

    vec3 fragColor = vec3(0.0);
    
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
        float lightDistance = distance(lightPos, position);
        vec3 L = (lightPos - position) / lightDistance;
  
        // Blinn Phong
        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal.xyz), 0.0);
        float shininess = 128.0;
        float specularTerm = pow(max(dot(normal, normalize(0.5 * (-position + normalize(L)))), 0.0), shininess);
  
        fragColor += albedo.xyz * light.color * (vec3(lightIntensity) * lambertTerm + vec3(0.4, 0.4, 0.4) * specularTerm);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo.xyz * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}