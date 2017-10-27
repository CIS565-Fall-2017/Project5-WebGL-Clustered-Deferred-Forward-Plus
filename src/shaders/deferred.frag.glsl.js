export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_clusterbuffer;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  
  uniform float u_width;
  uniform float u_height;

  uniform float u_nearZ;
  uniform float u_farZ;

  varying vec2 v_uv;
  
  vec3 applyNormalMap(vec3 geomnor, vec3 normap) 
  {
      normap = normap * 2.0 - 1.0;
      vec3 up = normalize(vec3(0.001, 1, 0.001));
      vec3 surftan = normalize(cross(geomnor, up));
      vec3 surfbinor = cross(geomnor, surftan);
      return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light 
  {
      vec3 position;
      float radius;
      vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) 
  {
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
  
  Light UnpackLight(int index) 
  {
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
  float cubicGaussian(float h) 
  {
      if (h < 1.0) {
          return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
      } else if (h < 2.0) {
          return 0.25 * pow(2.0 - h, 3.0);
      } else {
          return 0.0;
      }
  }

  vec3 uncompressNormal(vec2 compressed)
  {
    compressed -= 0.5;
    compressed *= 2.0;
    
    float z = sqrt(1.0 - (compressed.x*compressed.x) - (compressed.y*compressed.y));
    vec3 normal = vec3(compressed.x, compressed.y, z);

    return normalize(normal);
  }

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);    // v_position
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);    // albedo
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);    // norm
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    // Grab the individual components from the textures
    vec3 v_position = gb0.rgb;
    vec3 albedo = gb1.rgb;
    vec3 _normal = gb2.rgb;

    vec3 compressed = uncompressNormal(vec2(_normal.x, _normal.y));
    vec3 normal = vec3(u_invViewMatrix * vec4(compressed, 0.0));

    vec3 fragColor = vec3(0.0);

    // GLSL type inconsistencies
    // https://stackoverflow.com/questions/33579110/glsl-type-inconsistencies
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    // Get the position in camera space    
    vec4 v_posCamera = u_viewMatrix * vec4(v_position, 1.0);
    float z = -v_posCamera[2];

    // Use gl_FragCoord to get xyz values
    // http://www.txutxi.com/?p=182
    float xStride = float(u_width) / float(${params.xSlices});  
    float yStride = float(u_height) / float(${params.ySlices});  
    float zStride = float(u_farZ - u_nearZ) / float(${params.zSlices});  
    int xCluster = int(float(x) / xStride);
    int yCluster = int(float(y) / yStride);
    int zCluster = int(float(z - u_nearZ) / zStride);
    
    // Find which cluster the current fragment lies in
    // Cluster index
    int index = xCluster + (yCluster * ${params.xSlices}) + (zCluster * ${params.xSlices} *${params.ySlices});

    int numClusters = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    float u = float(index + 1) / float(numClusters + 1);

    // Get how many lights are in the cluster
    int numLightsInCluster = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    int numTexels = int( ceil( float(${params.maxLightsPerCluster} + 1) / float(4.0)) );

    for(int i = 0; i < ${params.numLights}; i++) {
        if(i >= numLightsInCluster) {
            break;
        }

        int lightIndex = int(ExtractFloat(u_clusterbuffer, numClusters, numTexels, index, i + 1));
        Light light = UnpackLight(lightIndex);
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        vec3 lightPos = light.position;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}