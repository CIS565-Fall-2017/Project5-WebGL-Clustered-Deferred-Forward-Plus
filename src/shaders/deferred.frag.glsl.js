export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_near;
  uniform float u_far;
  uniform vec3 u_cameraPos;
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

  void main() {
    vec4 col4=texture2D(u_gbuffers[0], v_uv);
    vec4 pos4=texture2D(u_gbuffers[1], v_uv);
    vec3 albedo=col4.rgb;
    vec3 v_position=pos4.xyz;
    
    //Two component normals
    vec3 normal=normalize(vec3(cos(col4.a)*cos(pos4.w),cos(col4.a)*sin(pos4.w),sin(col4.w)));
  

    vec4 CamLocalPos=u_viewMatrix*vec4(v_position,1.0);
    int col=(${params.xSlices})*(${params.ySlices})*(${params.zSlices});
    int row=int((${params.maxLightsPerCluster}+1)/4)+1;
    
    int cluster_X=int(gl_FragCoord.x/float(u_screenWidth)*float(${params.xSlices}));
    int cluster_Y=int(gl_FragCoord.y/float(u_screenHeight)*float(${params.ySlices}));
    int cluster_Z=0;
    if(-CamLocalPos[2]>u_near)
      cluster_Z=int((-CamLocalPos[2]-u_near)/(u_far-u_near)*float(${params.zSlices}));
  
    int idx=cluster_X+cluster_Y*(${params.xSlices})+cluster_Z*(${params.xSlices})*(${params.ySlices});
    
    float U=float(idx+1)/float(col+1);
    int lightNum=int(texture2D(u_clusterbuffer, vec2(U,0)).r);


    vec3 fragColor = vec3(0.0);

    vec3 ambientColor=vec3(1.0);
    vec3 specularColor=vec3(1.0);
    const vec3 ambientLight = vec3(0.025);
    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i>=lightNum) {
        break;
      }
      int rowIdx=int((i+1)/4);
      float V=float(rowIdx+1)/float(row+1);
      vec4 texel=texture2D(u_clusterbuffer,vec2(U,V));

      int texelComponent=i+1-4*rowIdx;
      int lightId;
      if (texelComponent == 0) {
          lightId = int(texel[0]);
      } else if (texelComponent == 1) {
          lightId = int(texel[1]);
      } else if (texelComponent == 2) {
          lightId = int(texel[2]);
      } else if (texelComponent == 3) {
          lightId = int(texel[3]);
      }


      /////////////////////////Blinning Phong Shading model////////////////////////////////

      Light light = UnpackLight(lightId);
      //Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      vec3 View =  normalize(u_cameraPos-v_position);
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      float ka = 0.1;//ambient coefficient
      float kd = lambertTerm;  //diffuse coefficient   
      float ks = 0.0;
      float Shiness = 20.0;
      vec3 H = normalize(L + View);
      ks = 0.75 * pow(max(0.0, dot(H, normal)), Shiness);
      //fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      fragColor += vec3(lightIntensity)*light.color*(ambientLight * ka + kd * lambertTerm * albedo + ks * specularColor);
    }

    //fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
    
    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
    //normal debugging
    //gl_FragColor = vec4(normal, 1.0);
    //camera debugging
    //gl_FragColor = vec4(u_cameraPos.x,u_cameraPos.y,u_cameraPos.z, 1.0);

  }
  `;
}