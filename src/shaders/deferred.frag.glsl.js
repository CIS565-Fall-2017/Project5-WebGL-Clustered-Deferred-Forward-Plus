export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_lightbuffer; 
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  
  varying vec2 v_uv;

  const int xSlices = ${params.xSlices};
  const int ySlices = ${params.ySlices};
  const int zSlices = ${params.zSlices};
  const int totalClusters = ${params.xSlices*params.ySlices*params.zSlices};
  const int textureHeight = ${params.textureHeight};

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
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec3 position = vec3(texture2D(u_gbuffers[0], v_uv));
    vec3 normal = vec3(texture2D(u_gbuffers[1], v_uv));
    vec3 color = vec3(texture2D(u_gbuffers[2], v_uv));

    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);
    vec4 viewPos = u_viewMatrix * vec4(position,1.0);

    //determine total width length at -z
    float halfFrustumHeight = -viewPos.z * ${params.cameraFOVScalar};
    float halfFrustumWidth = halfFrustumHeight * ${params.cameraAspect};

    //get cluster based on these
    int zC = int(min(14.0, -50.0 * viewPos.z / ${params.cameraFar + '.0'} * float(zSlices)));
    //float zC = floor(zSlices * logScale(-15.0 * viewPos.z, ${params.cameraFar - params.cameraNear}, ${params.cameraNear}));
    int yC = int((viewPos.y + halfFrustumHeight) / (2.0 * halfFrustumHeight) * float(ySlices));
    int xC = int((viewPos.x + halfFrustumWidth) / (2.0 * halfFrustumWidth) * float(xSlices));

    int row = xC + yC * xSlices + zC * xSlices * ySlices;
    float u = float(row+1)/float(totalClusters+1); //make sure we're safely within the NEXT row with the +1/+1
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u,0)).r); //pull first "red" value, no need for extractfloat yet

    //gl_FragColor = vec4(float(clusterNumLights)/15.0, 0.0 / 15.0, 0.0/15.0, 1.0);
    //return;

    vec3 fragColor = vec3(0,0,0);

    for (int i = 1; i < ${params.numLights}; i++) 
    {
      if(i > clusterNumLights) break;
      int lightIndex = int( ExtractFloat(u_clusterbuffer, totalClusters, textureHeight, row, i) );
      Light light = UnpackLight(lightIndex);

      //plain lambert shading
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += color * lambertTerm * light.color * vec3(lightIntensity);
    }

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}