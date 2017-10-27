export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform mat4 u_viewMatrix;
  uniform float u_fov;
  uniform float u_aspectRatio;
  //uniform int u_zSliceNum;
  //uniform int u_xSliceNum;
  //uniform int u_ySliceNum;
  uniform float u_zFar;
  uniform float u_zNear;
  //uniform int u_maxlightsPerCluster; 

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec4 v_lightInfo;

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

  //get Light Idex from u_clusterbuffer;
  int getLightIdx(int u , int lightIndex, int clusterTextureWidth, int clusterTextureHeight){
    int row = lightIndex/4;
    float uv_u = float(u+1)/float(clusterTextureWidth+1);
    float uv_v = float(row+1)/float(clusterTextureHeight+1);
    vec4 v = texture2D(u_clusterbuffer, vec2(uv_u, uv_v));
    int pixelComponent = lightIndex - row*4;
    if (pixelComponent == 0) {
      return int(v[0]);
    } else if (pixelComponent == 1) {
      return int(v[1]);
    } else if (pixelComponent == 2) {
      return int(v[2]);
    } else if (pixelComponent == 3) {
      return int(v[3]);
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    //*********Find which cluster is this fragment in**********//
    vec3 v_position_eye = vec3(u_viewMatrix * vec4(v_position, 1.0));
    float z = -v_position_eye.z;
    int u_xSliceNum = int(v_lightInfo.x);
    int u_ySliceNum = int(v_lightInfo.y);
    int u_zSliceNum = int(v_lightInfo.z);
    int u_maxlightsPerCluster = int(v_lightInfo.w);
    //float zInterval = (u_zFar - u_zNear) / float(u_zSliceNum);
    //int zIdx = int((z-u_zNear)/zInterval);
    
    float zInterval = exp(log(u_zFar - u_zNear)/float(u_zSliceNum));
    int zIdx = int(log(z-u_zNear)/log(zInterval));
    float yClusterLength = z*tan(u_fov/float(2))*float(2);
    float yInterval = yClusterLength/float(u_ySliceNum);
    int yIdx = int((v_position_eye.y + yClusterLength / float(2)) / yInterval);
    float xClusterLength = yClusterLength*u_aspectRatio;
    float xInterval = xClusterLength/float(u_xSliceNum);
    int xIdx = int((v_position_eye.x + xClusterLength / float(2)) / xInterval);

    bool outOfCluster = false;
    if(yIdx>=u_ySliceNum || xIdx>=u_xSliceNum || zIdx>=u_zSliceNum){
      outOfCluster = true;
    }
    //*********Find which cluster is this fragment in**********//

    int col = xIdx + yIdx * u_xSliceNum + zIdx * u_xSliceNum* u_ySliceNum;
    vec3 fragColor = vec3(0.0);
    //fragColor+=vec3(float(zIdx+1)/float(u_zSliceNum));
    if(!outOfCluster){
      int clusterTextureWidth = u_xSliceNum*u_ySliceNum*u_zSliceNum;
      //int clusterTextureHeight = u_maxlightsPerCluster+1; //change later
      //int clusterTextureWidth = 15*15*15;
      int clusterTextureHeight = (${params.maxLightsPerCluster} + 1) / 4 + 1; //change later
  
      float uv_u = float(col+1)/float(clusterTextureWidth+1);
      float uv_v = float(0)/float(clusterTextureHeight);
      vec4 v1 = texture2D(u_clusterbuffer, vec2(uv_u, uv_v));
      int numberOfLights = int (v1.x);
      
      for (int i = 1; i <= ${params.maxLightsPerCluster}; ++i) {
        if (i > numberOfLights) {
          break;
        }else{
          int lightIdx = getLightIdx(col , i, clusterTextureWidth, clusterTextureHeight);
          Light light = UnpackLight(lightIdx);
          float lightDistance = distance(light.position, v_position);
          vec3 L = (light.position - v_position) / lightDistance;
          float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
          float lambertTerm = max(dot(L, normal), 0.0);        
          fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
        }  
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
