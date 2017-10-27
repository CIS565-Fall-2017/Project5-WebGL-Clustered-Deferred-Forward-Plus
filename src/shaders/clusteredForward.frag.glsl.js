export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_near;
  uniform float u_far;

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

      Light light = UnpackLight(lightId);
      //Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
    
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
