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
  
  

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  
  //Get Params
  const int xsegment=${params.Xsegment};
  const int ysegment=${params.Ysegment};
  const int zsegment=${params.Zsegment};
  const int numLights=${params.numLights};
  const int maxlights=${params.MAXLIGHTSPERCLUSTER};
  const int pixelsperelement=${params.PIXELSPERELEMENT};
  
  const int width=${params.SCREENWIDTH};
  const int height=${params.SCREENHEIGHT};
  

  //get cluster from world position
  int getCluster(vec3 pos)
  {
      int x=int(pos.x* float(xsegment)/ float(width) );
      int y=int(pos.y* float(ysegment)/ float(height) );
      int z=int(pos.z* float(zsegment));     
      int index=x+y*xsegment+z*xsegment*ysegment;     
      return index;
  }

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
    float u = float(index + 1) / float(numLights + 1);
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, numLights, 2, index, 3);

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
    
    //How many clusters we have?
    int numclusters=xsegment*ysegment*zsegment;
     
    vec3 world_pos;
    
    //which cluster is this fragment in?  
    int index=getCluster( vec3(gl_FragCoord.x,gl_FragCoord.y,gl_FragCoord.z) ); //Get cluster index
    
    if(index<0)
    {
        index=0;
    }
    else if(index>numclusters)
    {
        index=numclusters-1;
    }
    
     float u = float(index + 1) / float(numclusters + 1);
     
     //How many lights is in this cluster?
     int NumLightsInCluster = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);

    for(int i=1; i<maxlights; i++)
    {
       //WEBGL DOES NOT SUPPORT NON-FIXED LOOPING!!!
      if(i>=NumLightsInCluster)
      {
        break;
      }     
      
      //WEBGL HAS NO % OPERATION!!!!!!
     
      int clusterTexelIndex = i / 4;  
      int reminder = i - 4 * clusterTexelIndex;
              
      float v = float(clusterTexelIndex + 1) / ceil(float(maxlights + 1) * 0.25  + 1.0);    
     
      vec4 clusterTexel = texture2D(u_clusterbuffer, vec2(u, v));

       //Get light index
       int light_index=1;
       
       //fetch
       if (reminder == 0)      
         light_index = int(clusterTexel[0]);      
       else if (reminder == 1)     
         light_index = int(clusterTexel[1]);      
       else if (reminder == 2)      
         light_index = int(clusterTexel[2]);
       else if (reminder == 3)
        light_index = int(clusterTexel[3]);
       else     
        continue;          
      //
       
    
      Light light = UnpackLight(light_index);     
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      
    }
    
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    
    gl_FragColor = vec4(fragColor, 1.0);
    
    
    //Toon Shader
    //This isn't toon at all !!!
    
     int color_r;
     int color_g;
     int color_b;
    
    fragColor*=30.0;
    
    color_r=int(fragColor.x);
    color_g=int(fragColor.y);
    color_b=int(fragColor.z);
    
    color_r/=3;
    color_g/=3;
    color_b/=3;
    
    fragColor=vec3(color_r,color_g,color_b);

    gl_FragColor = vec4(fragColor/10.0, 1.0);
    
    
    
  }
  `;
}