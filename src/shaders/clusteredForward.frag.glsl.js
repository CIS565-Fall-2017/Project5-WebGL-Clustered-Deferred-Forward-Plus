export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform vec2 u_frustrumRatios;
  uniform mat4 u_viewMatrix;
  uniform vec2 u_nearFar;

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

  int getContainingZPlane(float posZ) {
    bool firstPlane = posZ > -5.0;
    if (firstPlane) {
      return 0;
    } else {
      float logPosZ = log2(abs(posZ) - 5.0);
      if (logPosZ < 0.0) return 1;
      return int(floor(logPosZ) + 1.0);
    }
  }

  int getClusterID(vec3 position) {
    //useWidth ratio and multiply the z coordinate by that ratio to obtain the width where the
    //fragment is, and then find the 
    float frustrumWidth = u_frustrumRatios.x * abs(position.z);
    float frustrumHeight = u_frustrumRatios.y * abs(position.z);
    vec3 sliceDimensions = vec3(float(${params.xSliceNum}), float(${params.ySliceNum}), float(${params.zSliceNum}));
    int clusterXID = int(floor((0.5 * frustrumWidth + position.x)/frustrumWidth * sliceDimensions.x));
    int clusterYID = int(floor((0.5 * frustrumHeight + position.y)/frustrumHeight * sliceDimensions.y));
    int clusterZID = getContainingZPlane(position.z);
    return clusterXID + clusterYID * int(sliceDimensions.x) + clusterZID * int(sliceDimensions.y * sliceDimensions.z);
  }

  vec3 getClusterColor(vec3 position) {
    float frustrumWidth = u_frustrumRatios.x * abs(position.z);
    float frustrumHeight = u_frustrumRatios.y * abs(position.z);
    vec3 sliceDimensions = vec3(float(${params.xSliceNum}), float(${params.ySliceNum}), float(${params.zSliceNum}));
    float clusterXID = floor((0.5 * frustrumWidth + position.x)/frustrumWidth * sliceDimensions.x);
    float clusterYID = floor((.5 * frustrumHeight + position.y)/frustrumHeight * sliceDimensions.y);
    float clusterZID = float(getContainingZPlane(position.z));
    if (clusterXID < 0.0 || clusterXID > 14.5) clusterXID = 0.0;
    if (clusterYID < 0.0 || clusterYID > 14.5) clusterYID = 0.0;
    if (clusterZID < 0.0 || clusterZID > 14.5) clusterZID = 0.0;
    
    return vec3(clusterXID / sliceDimensions.x, clusterYID / sliceDimensions.y, clusterZID / sliceDimensions.z);
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);
    int numClusters = ${params.xSliceNum} * ${params.ySliceNum} * ${params.zSliceNum};
    int clusterBufferHeight = int(ceil((float(${params.numLights}) + 1.0) / 4.0));
    int clusterIndex = getClusterID(vec3(u_viewMatrix * vec4(v_position, 1.0)));

    float numAffectingLights = ExtractFloat(u_clusterbuffer, numClusters, clusterBufferHeight, clusterIndex, 0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i < int(numAffectingLights)) {
        int lid = int(ExtractFloat(u_clusterbuffer, numClusters, clusterBufferHeight, clusterIndex, i));
        Light light = UnpackLight(lid);
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;  

    fragColor = 0.6 * fragColor;
    
    fragColor += 0.4 * getClusterColor(vec3(u_viewMatrix * vec4(v_position, 1.0)));

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}