export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform float u_screenwidth;
  uniform float u_screenheight;
  uniform float u_near;
  uniform float u_far;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
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
    int texelComponent = component - pixel * 4;
    if (texelComponent == 0) {
      return texel[0];
    } else if (texelComponent == 1) {
      return texel[1];
    } else if (texelComponent == 2) {
      return texel[2];
    } else if (texelComponent == 3) {
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
    light.radius = v1.w;//ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

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
      // TODO: extract data from g buffers and do lighting
      //packed normal
      vec4 buf0val = texture2D(u_gbuffers[0], v_uv);
      vec4 buf1val = texture2D(u_gbuffers[1], v_uv);
      vec4 buf2val = texture2D(u_gbuffers[2], v_uv);
      vec3 albedo = buf0val.rgb;
//      vec4 normal4 = u_invViewMatrix * vec4(buf0val.w, buf1val.w, sqrt(1.0-buf0val.w*buf0val.w-buf1val.w*buf1val.w), 0.0);
//      vec3 normal = normalize(normal4.xyz);
      vec3 normal = buf2val.xyz;
      vec3 v_position = buf1val.xyz;

      //find the x,y,z clustser indices for this fragment
      //x starts left, y starts bot(gl_fragcoord origin is lower left), z starts front
      int clusterX = int( gl_FragCoord.x / 
              (float(u_screenwidth) / float(${params.xSlices})) );
      int clusterY = int( gl_FragCoord.y /  
              (float(u_screenheight) / float(${params.ySlices})) );

      vec4 fragCamPos = u_viewMatrix * vec4(v_position,1.0);
      int clusterZ = int( (-fragCamPos.z-u_near) / 
              (float(u_far-u_near) / float(${params.zSlices})) );

      //find clusterIdx then the uv to access the clusterLightCount
      int clusterIdx = clusterX + clusterY*${params.xSlices} 
      + clusterZ*${params.xSlices}*${params.ySlices};
      int totalClusters = ${params.xSlices}*${params.ySlices}*${params.zSlices};
      float U = float(clusterIdx+1) / float(totalClusters+1);
      int clusterLightCount = int(texture2D(u_clusterbuffer, vec2(U,0)).r);


      //light count for the cluster takes up the first component 
      //in the first pixel so we'll need to to +1 in places
      //where were calculating the residing pixel
      int numTexelsInColumn = int(float(${params.maxLightsPerCluster}+1) * 0.25) + 1;
      vec3 fragColor = vec3(0.0);

      //TEST VALS
//          fragColor = albedo;
//          fragColor = normal;
//          fragColor = v_position;
//          fragColor = vec3(float(clusterLightCount)/float(${params.numLights}));
      //    fragColor = vec3(-fragCamPos.z/float(u_far));
//          fragColor = vec3(float(clusterZ)/15.0);
//          fragColor = vec3(U);
//          if(clusterLightCount > 0) {
//              int i = 5;
//              int texelIdx = (i+1) / 4;
//              float V = float(texelIdx+1) / float(numTexelsInColumn+1);
//              vec4 texel = texture2D(u_clusterbuffer, vec2(U,V));
//              
//              int lightIdx;
//              int texelComponent = (i+1) - (texelIdx * 4);
//              if (texelComponent == 0) {
//                  lightIdx = int(texel[0]);
//              } else if (texelComponent == 1) {
//                  lightIdx = int(texel[1]);
//              } else if (texelComponent == 2) {
//                  lightIdx = int(texel[2]);
//              } else if (texelComponent == 3) {
//                  lightIdx = int(texel[3]);
//              }
//            Light light = UnpackLight(lightIdx);
//            fragColor = light.color;
//          } 
      //    fragColor = vec3(gl_FragCoord.z);
      //    fragColor = vec3(gl_FragCoord.x / float(u_screenwidth));
      //    fragColor = vec3(gl_FragCoord.y / float(u_screenheight));
      //    fragColor = vec3(v_position.z);//world z
      //ENDTEST VALS



      //    //no dynamic loop bounds in webGL(wow) so loop for numLights
      //    //and break out when greater or equal to lightCount
      //    //get light index from u_clusterbuffer, get light from upacklight
      //        //need uv's to access the buffer, we have U
      for (int i = 0; i < ${params.numLights}; ++i) {


          if(i >= clusterLightCount) { break; } 
          int texelIdx = int(float(i+1) * 0.25);
          float V = float(texelIdx+1) / float(numTexelsInColumn+1);
          vec4 texel = texture2D(u_clusterbuffer, vec2(U,V));

          int lightIdx;
          int texelComponent = (i+1) - (texelIdx * 4);
          if (texelComponent == 0) {
              lightIdx = int(texel[0]);
          } else if (texelComponent == 1) {
              lightIdx = int(texel[1]);
          } else if (texelComponent == 2) {
              lightIdx = int(texel[2]);
          } else if (texelComponent == 3) {
              lightIdx = int(texel[3]);
          }

          Light light = UnpackLight(lightIdx);
          float lightDistance = distance(light.position, v_position);
          vec3 L = (light.position - v_position) / lightDistance;
          //      vec3 L = vec3(u_viewMatrix * vec4( (light.position - v_position) / lightDistance, 0.0));


          float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
          float lambertTerm = max(dot(L, normal), 0.0);

          fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }//lightloop
      const vec3 ambientLight = vec3(0.025);
      fragColor += albedo * ambientLight;

      gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
