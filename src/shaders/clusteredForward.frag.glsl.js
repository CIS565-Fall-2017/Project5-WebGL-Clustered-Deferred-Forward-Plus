export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;
  uniform mat4 u_viewMatrix;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  const int xSlices = ${params.xSlices};
  const int ySlices = ${params.ySlices};
  const int zSlices = ${params.zSlices};
  const int totalClusters = ${params.xSlices*params.ySlices*params.zSlices};
  const int textureHeight = ${params.textureHeight};

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

/*
  float logScale(float z, float range, float near) {
    float a = min(max(0.0,z-near),range);
    a = 0.9 * (a/range) + 0.1;
    return log(a)/2.3025850 + 1.0;
  }
*/

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

    //view space coords
    vec4 viewPos = u_viewMatrix * vec4(v_position,1.0);

    //determine total width length at -z
    float halfFrustumHeight = -viewPos.z * ${params.cameraFOVScalar};
    float halfFrustumWidth = halfFrustumHeight * ${params.cameraAspect};

    //get cluster based on these
    int zC = int(min(14.0, -50.0 * viewPos.z / ${params.cameraFar + '.0'} * float(zSlices)));
    //float zC = floor(zSlices * logScale(-15.0 * viewPos.z, ${params.cameraFar - params.cameraNear}, ${params.cameraNear}));
    int yC = int((viewPos.y + halfFrustumHeight) / (2.0 * halfFrustumHeight) * float(ySlices));
    int xC = int((viewPos.x + halfFrustumWidth) / (2.0 * halfFrustumWidth) * float(xSlices));

    int clusterIndex = xC + yC * xSlices + zC * xSlices * ySlices;
    float u = float(clusterIndex+1)/float(totalClusters+1); //make sure we're safely within the NEXT row with the +1/+1
    int clusterNumLights = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    //gl_FragColor = vec4(xC / 15.0, 0.0 / 15.0, 0.0/15.0, 1.0);
    //return;

    for (int i = 1; i < ${params.numLights}; i++) 
    {
      if(i > clusterNumLights) break;
      int lightIndex = int( ExtractFloat(u_clusterbuffer, totalClusters, textureHeight, clusterIndex, i) );
      Light light = UnpackLight(lightIndex);

      //plain lambert shading
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
