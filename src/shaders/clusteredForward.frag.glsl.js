export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform vec4 u_cameraPos;
  uniform mat4 u_viewMatrix;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  const int xSlices = ${params.xSlices};
  const int ySlices = ${params.ySlices};
  const int zSlices = ${params.zSlices};
  const int totalClusters = ${params.xSlices*params.ySlices*params.zSlices};
  const int textureHeight = ${params.textureHeight};
  const float invRange = float(${1/params.rangeScale});

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normalize(normap.y * surftan + normap.x * surfbinor + normap.z * geomnor);
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

  void main() {
    vec3 color = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);
    vec3 fragColor = vec3(0.0);
    vec4 camPos = u_cameraPos;

    //view space coords
    vec4 viewPos = u_viewMatrix * vec4(position,1.0);

    //determine total width length at -z
    float halfFrustumHeight = -viewPos.z * ${params.cameraFOVScalar};
    float halfFrustumWidth = halfFrustumHeight * ${params.cameraAspect};

    //get cluster based on these
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
      vec3 viewDir = normalize(position - camPos.xyz);
      Light light = UnpackLight(lightIndex);

      //plain lambert shading
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambTerm = max(dot(L.xyz, normal), 0.0);

      vec3 halfDir = normalize(L - viewDir);
      float dotN = max(dot(normal, halfDir.xyz), 0.0);
      float specTerm = pow(dotN, 32.0);
      fragColor += (lambTerm * color + specTerm) * light.color * vec3(lightIntensity);
    }

    gl_FragColor =  vec4(fragColor, 1.0);
  }
  `;
}