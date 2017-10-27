export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform mat4 u_invViewProjectionMatrix;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform int u_near;
  uniform int u_far;
  uniform vec3 u_camWorld;
  
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
  
  vec3 UnpackNormal(float nx, float ny, mat4 invViewMatrix)
  {
    float nz = sqrt(1.0 - nx*nx - ny*ny);
    vec4 nor4 = invViewMatrix * vec4(nx, ny, nz, 0.0);
    return vec3(normalize(nor4.xyz));
  }
  
  void main() {
     vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // pos, n.x
     vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // col, n.y
     vec4 gb2 = texture2D(u_gbuffers[2], v_uv); // n
    
    vec3 v_position = gb0.xyz;
    vec3 albedo = gb1.rgb;
    vec3 normal = UnpackNormal(gb0.w, gb1.a, u_invViewMatrix);
    //vec3 normal = gb2.xyz;
    float depth = gb2.w;
    
    vec4 tp = u_invViewProjectionMatrix * vec4(2.0 * v_uv - vec2(1.0), depth, 1.0);
    tp /= tp.w;
    vec4 vp = vec4(tp.xyz, 1.0); 

    
   vec4 camPos = u_viewMatrix * vec4(v_position,1.0);
  
   const int totalClusters = ${params.numX}*${params.numY}*${params.numZ};
   const int nT = int(0.25 * float(${params.maxLights}+1)) + 1;
   
   float far_near = float(u_far - u_near);
   float camera_near = float(-1.0 * camPos.z - float(u_near));
   float sizeX = float(${params.width}) / float(${params.numX});
   float sizeY = float(${params.height}) / float(${params.numY});
   int clusterX = int( gl_FragCoord.x / sizeX);
   int clusterY = int( gl_FragCoord.y / sizeY);
   int clusterZ = int( camera_near / (far_near / float(${params.numZ})));
   int Idx = clusterX + clusterY*${params.numX} + clusterZ*${params.numX}*${params.numY};
   
  
   float Ucoord = float(Idx+1) / float(totalClusters+1);
   int nLights = int(texture2D(u_clusterbuffer, vec2(Ucoord,0))[0]);
  
   vec3 fragColor = vec3(0.0);
   for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= nLights) break;
      
      int lightIdx = 0;
      int tIdx = int(0.25 * float(i+1));
      int tid = (i+1) - (tIdx * 4);
      float Vcoord = float(tIdx+1) / float(nT+1);
      vec2 UV = vec2(Ucoord,Vcoord);
      vec4 tex = texture2D(u_clusterbuffer, UV);
      
      if (tid == 0) {
          lightIdx = int(tex[0]);
      } else if (tid == 1) {
          lightIdx = int(tex[1]);
      } else if (tid == 2) {
          lightIdx = int(tex[2]);
      } else if (tid == 3) {
          lightIdx = int(tex[3]);
      }
      
      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      
      L = vec3(u_viewMatrix * vec4(L, 0.0));
      float shininess = 4.0;
      vec3 eyeDirection = -normalize(vec3(u_viewMatrix * vp));
      vec3 halfDir = normalize(L + eyeDirection);
      float specAngle = clamp(dot(halfDir, normal), 0.0, 1.0);
      float specular = pow(specAngle, shininess);
      
      
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity) + specular * light.color * vec3(lightIntensity);
   }
   const vec3 amb = vec3(0.025);
   fragColor += albedo * amb;
   gl_FragColor = vec4(fragColor, 1.0);
      // gl_FragColor = vec4(normal, 1.0);
  }
  `;
}