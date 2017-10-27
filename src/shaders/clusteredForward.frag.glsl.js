export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;
  precision highp int;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform int u_xSlice;
  uniform int u_ySlice;
  uniform int u_zSlice;

  uniform float u_far;
  uniform float u_near;
  uniform float u_fov;
  uniform float u_aspect;

  uniform mat4 u_viewMatrix;

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

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);  
    vec4 worldPos = vec4(v_position[0],v_position[1],v_position[2],1.0);
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

    //fragColor = vec3(float(lightCount)/float(${params.numLights}));
    for(int i = 1 ;i < ${params.numLights};++i)
    {
      if(i>lightCount)
      {
        break;
      }
      int rowIndex = i/4;
      int colIndex = i - rowIndex*4;
      float tempRowRatio = float(rowIndex+1)/float((${params.numLights}+1)/4+1);
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
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      
      //TODO
      //the blinn-phong code taking reference from WIKI:https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model
      vec3 specColor = vec3(1.0);
      if(lambertTerm>0.0)
      {
        vec3 viewDir = normalize(-v_position);
        vec3 halfDir = normalize(light.position+viewDir);
        float specAngle = max(dot(halfDir,normal),0.0);
        float specular = pow(specAngle, 2.0);
        specColor = specular*specColor;
      }

      fragColor += albedo * (lambertTerm*0.5+specColor*0.5)  * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = cameraPos;
  }
  `;
}
