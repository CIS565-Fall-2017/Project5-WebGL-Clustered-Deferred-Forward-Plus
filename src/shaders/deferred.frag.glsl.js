export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform vec2 u_frustrumRatios;
  uniform mat4 u_viewMatrix;
  uniform vec2 u_nearFar;
  uniform vec3 u_camerapos;
  
  varying vec2 v_uv;

  //Extract float from a texture
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
  
  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

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


  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  //Get normalized coordinates in cluster space for fragment
  vec3 getClusterUVD(vec3 pos, vec2 frustrumRatios, vec2 nearFar) {
    float height = abs(pos.z) * frustrumRatios.y;
    float pHeight = (pos.y + height / 2.0);
    float pv = pHeight / height;

    float width = abs(pos.z) * frustrumRatios.x;
    float pWidth = (pos.x + width / 2.0);
    float pu = pWidth / width;

    float pd = (abs(pos.z) - nearFar.x) / (nearFar.y - nearFar.x);

    pu = max(0.0, min(pu, 0.999));
    pv = max(0.0, min(pv, 0.999));
    pd = max(0.0, min(pd, 0.999));
    
    return vec3(pu, pv, pd);
  }

  //calculate cluster id given position
  int getClusterID(vec3 position) {
    vec3 clusterUVD = getClusterUVD(position, u_frustrumRatios, u_nearFar);
    vec3 sliceDimensions = vec3(float(${params.xSliceNum}), float(${params.ySliceNum}), float(${params.zSliceNum}));
    
    int clusterXID = int(floor(clusterUVD.x * sliceDimensions.x));
    
    int clusterYID = int(floor(clusterUVD.y * sliceDimensions.y));
    
    float pd = clusterUVD.z;
    pd = pd * pd * (3.0 - 2.0 * pd);
    pow(pd, 0.25);

    int clusterZID = int(floor(pd * sliceDimensions.z));

    return clusterXID + clusterYID * int(sliceDimensions.x) + clusterZID * int(sliceDimensions.y * sliceDimensions.z);
  }

  vec3 getClusterColor(vec3 position) {
    vec3 clusterUVD = getClusterUVD(position, u_frustrumRatios, u_nearFar);
    vec3 sliceDimensions = vec3(float(${params.xSliceNum}), float(${params.ySliceNum}), float(${params.zSliceNum}));
    
    float clusterXID = floor(clusterUVD.x * sliceDimensions.x);
    
    float clusterYID = floor(clusterUVD.y * sliceDimensions.y);
    
    float pd = clusterUVD.z;
    pd = pd * pd * (3.0 - 2.0 * pd);
    pow(pd, 0.25);
    float clusterZID = floor(pd * sliceDimensions.z);

    if (clusterUVD.x == 0.999) clusterXID = 0.0;
    if (clusterUVD.y == 0.999) clusterYID = 0.0;
    
    return vec3(clusterXID / sliceDimensions.x, clusterYID / sliceDimensions.y, (15.0 - clusterZID) / sliceDimensions.z);
  }

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 albedo = texture2D(u_gbuffers[0], v_uv);
    vec4 normal = texture2D(u_gbuffers[1], v_uv);
    vec4 position = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 fragColor = vec3(0.0);

    int numClusters = ${params.xSliceNum} * ${params.ySliceNum} * ${params.zSliceNum};
    int clusterBufferHeight = int(ceil((float(${params.numLights}) + 1.0) / 4.0));
    vec3 viewSpacePosition = vec3(u_viewMatrix * position);
    int clusterIndex = getClusterID(viewSpacePosition);    

    float numAffectingLights = ExtractFloat(u_clusterbuffer, numClusters, clusterBufferHeight, clusterIndex, 0);

    for (int i = 1; i < ${params.numLights}; ++i) {
      if (i < int(numAffectingLights)) {
        int lid = int(ExtractFloat(u_clusterbuffer, numClusters, clusterBufferHeight, clusterIndex, i));
        Light light = UnpackLight(lid);
        float lightDistance = distance(light.position, vec3(position));
        vec3 L = (light.position - vec3(position)) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, vec3(normal)), 0.0);

        fragColor += vec3(albedo) * lambertTerm * light.color * vec3(lightIntensity);

        //Calculate specular
        vec3 viewSpaceL = vec3(u_viewMatrix * vec4(L, 1.0));
        vec3 viewSpaceNormal = vec3(u_viewMatrix * normal);
        float cameraDistance = length(viewSpacePosition);
        vec3 cameraVector = (-viewSpacePosition) / cameraDistance;
        vec3 halfVector = (viewSpaceL + cameraVector) / length(viewSpaceL + cameraVector);
        float blinnPhongTerm = max(0.0, dot(viewSpaceNormal, halfVector));

        fragColor += 2.0 * vec3(albedo) * blinnPhongTerm * light.color * vec3(lightIntensity);

      }
    }

    fragColor += vec3(0.05);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}