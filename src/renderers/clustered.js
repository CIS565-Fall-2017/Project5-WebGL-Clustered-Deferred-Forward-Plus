import { mat4, vec2, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

class Plane{
  constructor(ori,nor){
      this.ori = ori;
      this.nor = nor;
   }
 } 

class Plane_points{
  constructor(points){
      this.points = points;
   }
 } 

function computesignedDistance_Point_Plane(point, plane){
  //point is vec3,
  let point_3 = vec3.fromValues(point[0], point[1], point[2]);
  let nor = vec3.create();
  vec3.normalize(nor, plane.nor);
  let ori_3 = vec3.fromValues(plane.ori[0], plane.ori[1], plane.ori[2]);
  let dir_3 = vec3.create();
  vec3.subtract(dir_3, point_3, ori_3);
  let distance = vec3.dot(dir_3, nor);
  return distance;
}


function get_2D_Normal(Side2) {
  // because the division happen on the clip whose z = 1
    let Hypot = Math.sqrt(1 + Side2*Side2);
    let normSide1 = 1 / Hypot;
    let normSide2 = -Side2*normSide1;//lhs of plane, 2nd comp needs to be pos, rhs of plane 2nd comp needs to be neg
    return vec2.fromValues(normSide1, normSide2);
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    // construct planes of the slices
  }

// init_Planes(camera){
//     camera.updateMatrixWorld();
//     mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
//     this._xPlanes = [];
//     this._yPlanes = [];
//     this._zPlanes = [];

//     var near_clip = camera.near;
//     var far_clip = camera.far;
//     var FOV = camera.fov * (Math.PI/180.0);
//     var aspect_ratio = camera.aspect;

//     // z = camera.far / 2
//     var clip_width = (far_clip / 2) * Math.tan(FOV/2) * 2;
//     var clip_height = clip_width / aspect_ratio;

//     for(let i = 0; i < this._xSlices + 1; ++i){
//       var ori_camera = vec4.fromValues(0.0,0.0,0.0,1.0);
//       var v1_camera = vec4.create();
//       var v2_camera = vec4.create();
//       var nor_camera = vec3.create();
//       var nor_camera_normalized = vec3.create();
//       vec4.set(v1_camera, -clip_width/2 + clip_width/this._xSlices * i, clip_height / 2, far_clip / 2, 1);
//       vec4.set(v2_camera, -clip_width/2 + clip_width/this._xSlices * i, -clip_height / 2, far_clip / 2, 1);

//       var edge1_3 = vec3.fromValues(v1_camera[0], v1_camera[1], v1_camera[2]);
//       var edge2_3 = vec3.fromValues(v2_camera[0], v2_camera[1], v2_camera[2]);

//       vec3.cross(nor_camera, edge1_3, edge2_3);
//       vec3.normalize(nor_camera_normalized, nor_camera);
//       this._xPlanes[i] = new Plane(ori_camera, nor_camera_normalized);
//     }
//     for(let i = 0; i < this._ySlices + 1; ++i){
//       var ori_camera = vec4.fromValues(0.0,0.0,0.0,1.0);
//       var v1_camera = vec4.create();
//       var v2_camera = vec4.create();
//       var nor_camera = vec3.create();
//       var nor_camera_normalized = vec3.create();
//       vec4.set(v1_camera, -clip_width/2, -clip_height / 2 + clip_height / this._ySlices * i, far_clip / 2, 1);
//       vec4.set(v2_camera, clip_width/2, -clip_height / 2 + clip_height / this._ySlices * i, far_clip / 2, 1);

//       var edge1_3 = vec3.fromValues(v1_camera[0], v1_camera[1], v1_camera[2]);
//       var edge2_3 = vec3.fromValues(v2_camera[0], v2_camera[1], v2_camera[2]);

//       vec3.cross(nor_camera, edge2_3, edge1_3);
//       vec3.normalize(nor_camera_normalized, nor_camera);
//       this._yPlanes[i] = new Plane(ori_camera, nor_camera_normalized);
//     }
//     for(let i = 0; i < this._zSlices + 1; ++i){
//       var z_Depth = near_clip + (far_clip - near_clip) / this._zSlices * i;
//       var ori_camera = vec4.fromValues(0.0,0.0,z_Depth,1.0);
//       var nor_camera = vec3.fromValues(0.0,0.0,1.0);
//       this._zPlanes[i] = new Plane(ori_camera, nor_camera);
//     }
//   }

  test(){
    //console.log(this._xPlanes);
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
       for (let x = 0; x < this._xSlices; ++x) {
        let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
       // Reset the light count to 0 for every cluster
          console.log('x='+x+',y='+y+',z='+z+' - light_count:' +this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]);
        }
      }
    }
  }
  

  updateClusters(camera, viewMatrix, scene) {
    //clear clusterTexture
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
       for (let x = 0; x < this._xSlices; ++x) {
        let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
       // Reset the light count to 0 for every cluster
        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    //
    //this.init_Planes(camera);
    
    //camera.updateMatrixWorld();
    let near_clip = camera.near;
    let far_clip = camera.far;
    let FOV = camera.fov * (Math.PI/180.0);
    let aspect_ratio = camera.aspect;

    let XStride = (Math.tan(FOV/2.0) * 2.0 / this._xSlices) * aspect_ratio;
    let YStride = (Math.tan(FOV/2.0) * 2.0 / this._ySlices);
    let ZStride = (camera.far - camera.near) / this._zSlices;
    // the z of this clip is 1
    let OriX = -Math.tan(FOV/2.0) * aspect_ratio;
    let OriY = -Math.tan(FOV/2.0);
    //console.log(this._xPlanes);
    //console.log(this._yPlanes);
    //console.log(this._zPlanes);

    for(let i = 0; i < NUM_LIGHTS; ++i){
      //iterate through all the lights
      //compute minX, minY, minZ, maxX, maxY, maxZ(which are edge slices no. of the light cover)
      let r = scene.lights[i].radius;
      let lightPos_camera =  vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
      //transform light pos from world space to camera space
      vec4.transformMat4(lightPos_camera, lightPos_camera, viewMatrix);
      lightPos_camera[2] *= -1.0;
      //var s = 1/lightPos_camera[3];
      //vec4.scale(lightPos_camera, 1/lightPos_camera[3]);
      //console.log(lightPos_camera);
      //examine X slices (16+1)

      //find minX
      let minX = this._xSlices;
      for(let x = 0; x < this._xSlices + 1; ++x){
        let norm2 = vec2.clone(get_2D_Normal(OriX+XStride*x));
        let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);     
        if(vec3.dot(lightPos_camera, norm3) < r){
          minX = Math.max(x-1, 0); 
          break;
        }
      }
      //find maxX
      let maxX = this._xSlices;
      for(let x = minX + 1; x < this._xSlices + 1; ++x){
        let norm2 = vec2.clone(get_2D_Normal(OriX+XStride*x));
        let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
        if(vec3.dot(lightPos_camera, norm3) < -r){
          maxX = Math.max(0, x);
          break;
        }
      }

      //find minY
      let minY = this._ySlices;
      for(let y = 0; y < this._ySlices + 1; ++y) {
        let norm2 = vec2.clone(get_2D_Normal(OriY+YStride*y));
        let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);        
        if(vec3.dot(lightPos_camera, norm3) < r){
          minY = Math.max(0, y-1);
          break;
        }
      }
      
      //find maxY
      let maxY = this._ySlices;
      for(let y = minY+1; y < this.ySlices + 1; ++y) {
        let norm2 = vec2.clone(get_2D_Normal(OriY+YStride*y));
        let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
        if(vec3.dot(lightPos_camera, norm3) < -r) {
          maxY = Math.max(0, y);
          break;
        }
      }

      //find minZ
      let minZ = this._zSlices;
      let light_z_start = lightPos_camera[2] - r;
      for(let z = 0; z < this._zSlices + 1; ++z) {
        if(camera.near + z * ZStride > light_z_start){
          minZ = Math.max(0, z-1);
          break;
        }
      }
      //find maxZ
      let maxZ = this._zSlices;
      let light_z_end = lightPos_camera[2] + r;
      for(let z = minZ+1; z < this._zSlices + 1; ++z){
        if(camera.near + z * ZStride > light_z_end){
          maxZ = Math.max(0, z);
          break;
        }
      }
        //in this case, the light is overlapping with the frustum
        //clamp
      // if(maxX < 2){
      //   console.log('light ' + i + ': ' + minX+' ' +maxX+' ' +minY+' ' +maxY+' ' +minZ+' ' +maxZ);
      //   console.log(lightPos_camera);
      //   console.log(this._xPlanes, this._yPlanes, this._zPlanes);
      //   console.log('radiius = ' + r);
      // }
      //console.log('light ' + i + ': ' + minX+' ' +maxX+' ' +minY+' ' +maxY+' ' +minZ+' ' +maxZ);
      //iterate through the overlapping clusters, then write the light index into its texture buffer.
      for(let x = minX; x < maxX; ++x){
        for(let y = minY; y < maxY; ++y){
          for(let z = minZ; z < maxZ; ++z){
            let cluster_linear_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let light_count_idx = this._clusterTexture.bufferIndex(cluster_linear_idx, 0);
            let light_count = this._clusterTexture.buffer[light_count_idx];

            if(light_count < MAX_LIGHTS_PER_CLUSTER){
              //write into the clusterTexture
              //i is light index
              light_count += 1;
              let texel = Math.floor(light_count/4);
              let texel_idx = this._clusterTexture.bufferIndex(cluster_linear_idx, texel);
              let texel_offset = light_count - texel * 4;
              this._clusterTexture.buffer[texel_idx + texel_offset] = i;
              this._clusterTexture.buffer[light_count_idx] = light_count;
            }
          }
        }
      }
    } //light loop ends here

    this._clusterTexture.update();
    //this.test();
    //console.log(this._clusterTexture.buffer);
  }
}