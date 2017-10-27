export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_depthbuffer;

  // Screen Width & Height
  uniform float u_screenwidth;
  uniform float u_screenheight;

  // Camera Near and Far Clip
  uniform float u_near;
  uniform float u_far;

  //Camera's viewMatrix
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
    // light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);
    light.radius = v1.w;

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
    // The G-Buffers Look like this currently:
	//  - gl_FragData[0] = vec4(v_position, norm.x);
	//  - gl_FragData[1] = vec4(v_col     , norm.y);
    float depth    = texture2D(u_depthbuffer, v_uv).x;
    vec4 gbuffer0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gbuffer1 = texture2D(u_gbuffers[1], v_uv);
    vec3 v_position = gbuffer0.xyz;
    vec3 albedo     = gbuffer1.rgb;
    float n_x = gbuffer0.w;
    float n_y = gbuffer1.w;
    vec3 normal     = vec3(n_x, n_y, sqrt(abs(1.0 - (n_x*n_x) - (n_y*n_y))));


    // get frag position
    vec4 frag_pos = u_viewMatrix * vec4(v_position,1.0);

    // get cluster index in x y and z
    int cluster_x = int(                gl_FragCoord.x / 
                        (float(u_screenwidth) / float(${params.xSlices})) );
    int cluster_y = int(                gl_FragCoord.y /  
                        (float(u_screenheight) / float(${params.ySlices})) );
    int cluster_z = int(               (-frag_pos.z-u_near) / 
                        (float(u_far-u_near) / float(${params.zSlices})) );
    
    //find the index of the cluster and the other stuff we need
    int cluster_i = cluster_x + cluster_y*${params.xSlices} + cluster_z*${params.xSlices}*${params.ySlices};
    int clusters_count = ${params.xSlices}*${params.ySlices}*${params.zSlices};

    float u = float(cluster_i+1) / float(clusters_count+1);
    int cluster_lights_count = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    vec3 fragColor = vec3(0.0);
    int  texel_count = int(float(${params.maxLightsPerCluster}+1) * 0.25) + 1;

    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= cluster_lights_count) { continue;}
          int texel_idx = int(float(i+1) * 0.25);
          float v = float(texel_idx+1) / float(texel_count+1);
          vec4 texel = texture2D(u_clusterbuffer, vec2(u,v));
          
          int l_idx;    
          int texel_comp = (i+1) - (texel_idx * 4);
          
          if (texel_comp == 0) {
              l_idx = int(texel[0]);
          } else if (texel_comp == 1) {
              l_idx = int(texel[1]);
          } else if (texel_comp == 2) {
              l_idx = int(texel[2]);
          } else if (texel_comp == 3) {
              l_idx = int(texel[3]);
          }
          
          Light light = UnpackLight(l_idx);
          float lightDistance = distance(light.position, v_position);
          vec3 L = (light.position - v_position) / lightDistance;
          
          float lightIntensity = cubicGaussian(lightDistance * 2.5 / light.radius);
          float lambertTerm = max(dot(L, normal), 0.0);

          //Blinn-phong
          //Taken straight from 560 Lecture Notes
          //For more, see: http://bit.ly/GPU-HW5-Ref2
          L = vec3(u_viewMatrix * vec4(L,0));
          vec3 view_normal = vec3(u_viewMatrix * vec4(normal,0));
          vec3 V = -normalize(vec3(u_viewMatrix * vec4(v_position,1)));
          vec3 H =  (L + V) / 2.0;
          H = normalize(H);
          float shininess = 45.0;
          float S = max(pow(abs(dot(H,view_normal)), shininess), 0.0);
          
          fragColor += (albedo + S) * lambertTerm * light.color * vec3(lightIntensity);
    } //For loop

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    
    // Normals Debug View:
    // gl_FragColor = vec4(normal, 1.0);
   
    // Depth Debug View:
    //gl_FragColor = vec4(vec3(depth*depth*depth*depth*depth*depth*depth*depth*depth), 1.0);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}