export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_lightbuffer; 
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_clusterbuffer;
  uniform vec4 u_cameraPos;
  uniform mat4 u_viewMatrix;
  
  varying vec2 v_uv;

  const int xSlices = ${params.xSlices};
  const int ySlices = ${params.ySlices};
  const int zSlices = ${params.zSlices};
  const int totalClusters = ${params.xSlices*params.ySlices*params.zSlices};
  const int textureHeight = ${params.textureHeight};
  const float invRange = float(${1/params.rangeScale});

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
    light.radius = v1.a;
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

  float logScale(float z) {
    return log(z-${params.cameraNear+1}) * ${params.invRange};
  }

  vec2 sign_not_zero(vec2 v) {
        return vec2(
            v.x >= 0.0 ? 1.0 : -1.0,
            v.y >= 0.0 ? 1.0 : -1.0
        );
  }

  vec3 unpack_normal_octahedron(vec2 packed_nrm) {
    #if 1
        // Version using newer GLSL capatibilities
        vec3 v = vec3(packed_nrm.xy, 1.0 - abs(packed_nrm.x) - abs(packed_nrm.y));
        #if 1
            // Version with branches, seems to take less cycles than the
            // branch-less version
            if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * sign_not_zero(v.xy);
        #else
            // Branch-Less version
            v.xy = mix(v.xy, (1.0 - abs(v.yx)) * sign_not_zero(v.xy), step(v.z, 0));
        #endif

        return normalize(v);
    #else
        // Version as proposed in the paper. 
        vec3 v = vec3(packed_nrm, 1.0 - dot(vec2(1), abs(packed_nrm)));
        if (v.z < 0.0)
            v.xy = (vec2(1) - abs(v.yx)) * sign_not_zero(v.xy);
        return normalize(v);
    #endif
  }
  
  void main() {
    vec4 position = texture2D(u_gbuffers[0], v_uv);
    vec4 color = texture2D(u_gbuffers[1], v_uv);
    vec3 normal = unpack_normal_octahedron(vec2(position.a,color.a));

    vec3 fragColor = vec3(0,0,0);
    vec4 camPos = u_cameraPos;

    //view space coords
    vec4 viewPos = u_viewMatrix * vec4(position.xyz,1.0);

    //determine total width length at -z
    float halfFrustumHeight = -viewPos.z * ${params.cameraFOVScalar};
    float halfFrustumWidth = halfFrustumHeight * ${params.cameraAspect};

    //get cluster based on these
    int zC;
    if (${params.useLogarithmic}) 
      zC = int( max(0.0, min(float(zSlices-1), 
        logScale(${params.useDynamic ? 'camPos.a' : 'invRange'} * -viewPos.z) * float(${params.zSlices + params.logOffset}) - float(${params.logOffset})
      )));
    else zC = int(min(float(zSlices-1), ${params.useDynamic ? 'camPos.a' : 'invRange'} * -viewPos.z * ${params.invRange} * float(zSlices)));

    //float zC = floor(zSlices * logScale(-15.0 * viewPos.z, ${params.cameraFar - params.cameraNear}, ${params.cameraNear}));
    int yC = int((viewPos.y + halfFrustumHeight) / (2.0 * halfFrustumHeight) * float(ySlices));
    int xC = int((viewPos.x + halfFrustumWidth) / (2.0 * halfFrustumWidth) * float(xSlices));

    int row = xC + yC * xSlices + zC * xSlices * ySlices;
    float u = float(row+1)/float(totalClusters+1); //make sure we're safely within the NEXT row with the +1/+1
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u,0)).r); //pull first "red" value, no need for extractfloat yet

    //gl_FragColor = vec4(float(zC) / float(zSlices), 0,0, 1.0);
    //return;

    for (int i = 1; i < ${params.numLights}; i++) 
    {
      if(i > clusterNumLights) break;
      int lightIndex = int( ExtractFloat(u_clusterbuffer, totalClusters, textureHeight, row, i) );
      vec3 viewDir = normalize(position.xyz - camPos.xyz);
      Light light = UnpackLight(lightIndex);

      //plain lambert shading
      float lightDistance = distance(light.position, position.xyz);
      vec3 L = (light.position - position.xyz) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambTerm = max(dot(L.xyz, normal), 0.0);

      vec3 halfDir = normalize(L - viewDir);
      float dotN = max(dot(normal, halfDir.xyz), 0.0);
      float specTerm = pow(dotN, 32.0);
      fragColor += (lambTerm * color.xyz + specTerm) * light.color * vec3(lightIntensity);
    }
    vec3 ambient = 0.1 * color.xyz;
    gl_FragColor =  vec4(max(ambient,fragColor), 1.0);
  }
  `;
}