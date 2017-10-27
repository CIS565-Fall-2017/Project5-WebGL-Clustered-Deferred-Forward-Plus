export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewMatrix;
  uniform float u_fov;
  uniform float u_aspectRatio;
  uniform int u_zSliceNum;
  uniform int u_xSliceNum;
  uniform int u_ySliceNum;
  uniform float u_zFar;
  uniform float u_zNear;
  uniform vec3 u_cameraPosition;
  
  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  const float shiness = 3.0;

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
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
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
    // TODO: extract data from g buffers and do lighting
    //************No Optimization************//
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); //normal
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); //col
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv); //position in world 
    vec4 gb3 = texture2D(u_gbuffers[3], v_uv); //texture

    vec3 fragColor = vec3(0.0);
    vec3 normal = vec3(gb0);
    vec3 position = vec3(gb2);
    vec3 albedo = vec3(gb1);
    //************No Optimization************//


    //**********Optimization*************//
    /*vec4 gb0 = texture2D(u_gbuffers[0], v_uv); //col + v_pos.z
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); //norm Tan angle of z and x+norm.y+v_pos.x+v_pos.y

    vec3 fragColor = vec3(0.0);
    vec3 position = vec3(gb1.z, gb1.w, gb0.w);
    vec3 albedo = vec3(gb0.x, gb0.y, gb0.z);
    float normx = cos(gb1[0])*sqrt(1.0-gb1[1]*gb1[1]);
    float normz = sin(gb1[0])*sqrt(1.0-gb1[1]*gb1[1]);
    vec3 normal = vec3(normx, gb1[1],normz);*/
    //**********Optimization*************//


    //*********Find which cluster is this fragment in**********//
    vec3 v_position_eye = vec3(u_viewMatrix * vec4(position, 1.0));
    float z = -v_position_eye.z;
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
    //*********Find which cluster is this fragment in**********//

    
    //*********************Clustered Rendering**********************//
    int col = xIdx + yIdx * u_xSliceNum + zIdx * u_xSliceNum* u_ySliceNum;
    int clusterTextureWidth = u_xSliceNum*u_ySliceNum*u_zSliceNum;
    int clusterTextureHeight = (${params.maxLightsPerCluster} + 1) / 4 + 1; //change later

    float uv_u = float(col+1)/float(clusterTextureWidth+1);
    float uv_v = float(0)/float(clusterTextureHeight);
    vec4 v1 = texture2D(u_clusterbuffer, vec2(uv_u, uv_v));
    int numberOfLights = int (v1.x);
    //fragColor += vec3(u_cameraPosition.y);
    for (int i = 1; i <= ${params.maxLightsPerCluster}; ++i) {
      if (i > numberOfLights) {
        break;
      }else{
        int lightIdx = getLightIdx(col , i, clusterTextureWidth, clusterTextureHeight);
        Light light = UnpackLight(lightIdx);
        float lightDistance = distance(light.position, position);
        vec3 L = (light.position - position) / lightDistance;
        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);        
        fragColor += 0.7*albedo * lambertTerm * light.color * vec3(lightIntensity);
        
        //Added Blinn-Phong Shading Model Here
        vec3 VDir = normalize(u_cameraPosition - position);
        vec3 HDir = normalize((VDir+L)*0.5);
        float blinnPhongTerm = max(pow(dot(HDir, normal), shiness), 0.0);
        fragColor += 0.3*albedo * blinnPhongTerm * light.color * vec3(lightIntensity);
      } 
    }
    //*********************Clustered Rendering**********************//
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0); 
  }
  `;
}