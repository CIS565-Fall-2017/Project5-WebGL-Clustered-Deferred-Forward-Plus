export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;

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

  // https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

  vec2 OctahedronEncodingWrap( vec2 v )
  {
    return ( vec2(1.0) - abs( v.yx ) ) * vec2(sign(v.x), sign(v.y));
  }

  vec3 DecodeNormal( vec2 encodedNormal ) {
    encodedNormal = encodedNormal * 2.0 - 1.0;
    
       vec3 n;
       n.z = 1.0 - abs( encodedNormal.x ) - abs( encodedNormal.y );
       n.xy = n.z >= 0.0 ? encodedNormal.xy : OctahedronEncodingWrap( encodedNormal.xy );
       n = normalize( n );
       return n;
  }

  void main() {
    // Extract data from G-buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // Normals
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // Depth

    vec3 normal = normalize(DecodeNormal(gb0.rg));
    vec3 albedo = vec3(gb0.ba, gb1.r);
    vec3 position = gb1.gba;
    //gl_FragColor = vec4(normal, 1.0); return;
    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, position.xyz);
      vec3 L = (light.position - position.xyz) / lightDistance;

      // Blinn Phong
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal.xyz), 0.0);
      float specularTerm = pow(max(dot(L, 0.5 * (normal.xyz + L)), 0.0), 128.0);

      fragColor += albedo.xyz * lambertTerm * light.color * vec3(lightIntensity) + albedo.xyz * light.color * vec3(0.4, 0.4, 0.4) * specularTerm;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo.xyz * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}