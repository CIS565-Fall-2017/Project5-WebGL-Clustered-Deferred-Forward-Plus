export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform int u_xSlice;
  uniform int u_ySlice;
  uniform int u_zSlice;

  uniform float u_far;
  uniform float u_near;
  uniform float u_fov;
  uniform float u_aspect;

  uniform mat4 u_viewMatrix;
  
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
    vec3 fragColor = vec3(0.0);
    // TODO: extract data from g buffers and do lighting
     vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
     vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
     vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
     vec4 gb3 = texture2D(u_gbuffers[3], v_uv);
     
     vec3 albedo = vec3(gb2[0],gb2[1],gb2[2]);
     vec3 normal = vec3(gb1[0],gb1[1],gb1[2]); 
     vec3 position = vec3(gb0[0],gb0[1],gb0[2]);
     
     //TODO: for the gbuffer improvement
    //  vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    //  vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    //  vec3 albedo = vec3(gb1[0],gb1[1],gb1[2]);
    //  vec3 position = vec3(gb0[0],gb0[1],gb0[2]);

    //  float y = gb0[3];
    //  float r = sqrt(1.0 - y*y);
    //  float x = r * cos(gb1[3]);
    //  float z = -r * sin(gb1[3]);
    //  vec3 normal = vec3(x,y,z);
     /////////////////////////

     vec4 worldPos = vec4(position[0],position[1],position[2],1.0);
     vec4 cameraPos = u_viewMatrix * worldPos;
     cameraPos[2] = -cameraPos[2];
 
     float farHeight = 2.0 * ( abs(cameraPos[2]) * tan((u_fov*0.5*3.1415926)/180.0));
     float farWidth = farHeight*u_aspect;
 
     float xSliceLength = farWidth/float(u_xSlice);
     float ySliceLength = farHeight/float(u_ySlice);
     float zSliceLength = abs(u_far-u_near)/float(u_zSlice);
 
     float xInitial = -farWidth/2.0;
     float yInitial = farHeight/2.0;
 
     int zSliceCoord = int(abs(cameraPos[2]-u_near)/zSliceLength);
     int xSliceCoord = int((cameraPos[0]-xInitial)/xSliceLength);
     int ySliceCoord = int((yInitial-cameraPos[1])/ySliceLength);
 
     int index = xSliceCoord + ySliceCoord * u_xSlice + zSliceCoord * u_xSlice * u_ySlice;
   
     float uRatio = float(index)/float(u_xSlice*u_ySlice*u_zSlice);
     int lightCount = int(texture2D(u_clusterbuffer,vec2(uRatio,0.0))[0]);

     for(int i = 1 ;i < ${params.numLights};++i)
     {
       if(i>lightCount)
       {
         break;
       }
       int rowIndex = i/4;
       int colIndex = i - rowIndex*4;
       float tempRowRatio = float(rowIndex)/float((${params.numLights}+1)/4+1);
       int tempLightIndex; 
       if(colIndex == 0)
       {
         tempLightIndex = int(texture2D(u_clusterbuffer,vec2(uRatio,tempRowRatio))[0]);
       }
       if(colIndex == 1)
       {
         tempLightIndex = int(texture2D(u_clusterbuffer,vec2(uRatio,tempRowRatio))[1]);
       }
       if(colIndex == 2)
       {
         tempLightIndex = int(texture2D(u_clusterbuffer,vec2(uRatio,tempRowRatio))[2]);
       }
       if(colIndex == 3)
       {
         tempLightIndex = int(texture2D(u_clusterbuffer,vec2(uRatio,tempRowRatio))[3]);
       }
       Light light = UnpackLight(tempLightIndex);
       float lightDistance = distance(light.position, position);
       vec3 L = (light.position - position) / lightDistance;
 
       float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
       float lambertTerm = max(dot(L, normal), 0.0);
 
       //TODO
       //the blinn-phong code taking reference from WIKI:https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model
       vec3 specColor = vec3(1.0);
       if(lambertTerm>0.0)
       {
         vec3 viewDir = normalize(-position);
         vec3 halfDir = normalize(light.position+viewDir);
         float specAngle = max(dot(halfDir,normal),0.0);
         float specular = pow(specAngle, 1.5);
         specColor = specular*specColor;
       }
       //fragColor += albedo * (lambertTerm*0.5+specColor*0.5) * light.color * vec3(lightIntensity);
       fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor,1.0);
  }
  `;
}