export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewMatrix;

  uniform sampler2D u_dirtTexture;
  uniform sampler2D u_starburstTexture;
  uniform sampler2D u_sceneTexture;
  uniform sampler2D u_HDR;
  uniform vec4 u_screenInfobuffer;

  varying vec2 v_uv;


vec4 textureDistorted(sampler2D tex, vec2 texcoord,  vec2 direction, // direction of distortion
              vec3 distortion)
  {
    return vec4
      (
      texture2D(tex, texcoord + direction * distortion.r).r,
      texture2D(tex, texcoord + direction * distortion.g).g,
      texture2D(tex, texcoord + direction * distortion.b).b,
        0.0
      );
  }
  

void main()
{
 

  const int uGhosts = 2; // number of ghost samples
  float uGhostDispersal = 0.5; // dispersion factor

  float uDistortion = 4.0;
  const float u_intensity = 5.0;

  vec2 texcoord = v_uv;// + vec2(1.0, 1.0);

  vec2 texelSize = vec2(u_screenInfobuffer.x, u_screenInfobuffer.x);
  vec3 distortion = vec3(-texelSize.x * uDistortion, 0.0, texelSize.x * uDistortion);

  


  // ghost vector to image centre:
  vec2 ghostVec = (vec2(0.5, 0.5) - texcoord) * uGhostDispersal;
  
  vec3 direction = normalize(vec3(ghostVec, 0.0));

  // sample ghosts:  
  vec4 result = vec4(0,0,0,0);
  vec4 ghost = vec4(0, 0, 0, 0);
  
  for (int i = 0; i < uGhosts; ++i)
  {
    vec2 offset = fract(texcoord + ghostVec * float(i));
    ghost += textureDistorted(u_HDR, offset, direction.xy, distortion);
  }

  float weightLens = length(vec2(0.5, 0.5) - texcoord) / length(vec2(0.5, 0.5));
  weightLens = pow( clamp(1.0 - clamp(weightLens, 0.0, 1.0), 0.0, 1.0), 3.0);
  weightLens *= 2.0;

  ghost *= weightLens;


  // sample halo:

  float uHaloWidth = 0.4;

  vec2 haloVec = normalize(ghostVec) * uHaloWidth;
  float weight = length(vec2(0.5, 0.5) - fract(texcoord + haloVec)) / length(vec2(0.5, 0.5));
  
  weight = pow(1.0 - clamp(weight, 0.0, 1.0), 20.0);

  result = textureDistorted(u_sceneTexture, texcoord + haloVec, direction.xy, distortion) * textureDistorted(u_HDR, texcoord + haloVec, direction.xy, distortion) *weight;
  result *= 5.0;

  result += ghost;

  //Rotating starburst texture's coordinate
  mat3 viewMat;
  viewMat[0] = vec3(u_viewMatrix[0]);
  viewMat[1] = vec3(u_viewMatrix[1]);
  viewMat[2] = vec3(u_viewMatrix[2]);

  vec3 camx = viewMat * vec3(1.0, 0.0, 0.0);
  vec3 camz = viewMat * vec3(0.0, 1.0, 0.0);
    
  float camrot = dot(camx, vec3(0, 0, 1)) + dot(camz, vec3(0, 1, 0));
  camrot *= -3.0;

  mat3 rotation;
  rotation[0] = vec3(cos(camrot), sin(camrot) ,0);
  rotation[1] = vec3(-sin(camrot), cos(camrot) ,0);
  rotation[2] = vec3(0, 0, 1);

    vec3 st1 = vec3(texcoord, 1.0) * 2.0  - vec3(1.0);
    st1.z = 1.0;
    vec3 st2 = rotation * st1;
    st2.z = 1.0;

    vec3 st3 = st2 * 0.5 + vec3(0.5, 0.5, 0.5);
    
    vec2 lensStarTexcoord = st3.xy; 

  gl_FragColor = result * u_intensity * (texture2D(u_dirtTexture, texcoord) * 0.9 + 0.1) * (texture2D(u_starburstTexture, lensStarTexcoord)) + texture2D(u_sceneTexture, texcoord);
}
  
  `;
}