import { mat4, vec4, vec3 } from 'gl-matrix';
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


function computeDistance_Point_Plane(point, plane){
  //point is vec3,
  var nor = vec3.create();
  vec3.normalize(nor, plane.nor);
  var ori_3 = vec3.fromValues(plane.ori[0], plane.ori[1], plane.ori[2]);
  var dir_3 = vec3.create();
  vec3.subtract(dir_3, point, ori_3);
  var distance = Math.abs(vec3.dot(dir_3, nor));
  return distance;
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    // construct planes of the slices
    this._xPlanes = [];
    this._yPlanes = [];
    this._zPlanes = [];
  }

init_Planes(camera){
    this._xPlanes = [];
    this._yPlanes = [];
    this._zPlanes = [];
    var inverse_viewMatrix = mat4.create();
    mat4.copy(inverse_viewMatrix, camera.matrixWorld.elements);
    var inverse_ProjectionMatrix = mat4.create();
    mat4.invert(inverse_ProjectionMatrix, camera.projectionMatrix.elements);
    var inverse_viewProjectionMatrix = mat4.create();
    //vp = pv, so inverse(vp) = inverse(v)*inverse(p)
    mat4.multiply(inverse_viewProjectionMatrix, inverse_viewMatrix, inverse_ProjectionMatrix)
    //var minX = -1,maxX = this.xSlices,minY = -1,maxY = this.ySlices,minZ = -1,maxZ = this.zSlices;

    for(let i = 0; i < this._xSlices + 1; ++i){
      var ori_World = vec4.create();
      var v1_World = vec4.create();
      var v2_World = vec4.create();
      var nor_World3 = vec3.create();
      var nor_World3_normalized = vec3.create();
      var edge1_4 = vec4.create();
      var edge2_4 = vec4.create();
      //1. Compute origin: select a point in NDC, then multiply by inverse_viewProjectionMatrix
      var ori_NDC = vec4.fromValues(-1 + 2/this._xSlices*i, -1 + 2/this._xSlices, 0, 1);
      //2. Compute normal: select 2 other points: one on screen, the other is in different Z value,
      var v1_NDC = vec4.fromValues(-1 + 2/this._xSlices*i, -1 + 4/this._xSlices, 0, 1);
      var v2_NDC = vec4.fromValues(-1 + 2/this._xSlices*i, -1 + 2/this._xSlices, 0.5, 1);
      //then do inverse Transformation to world space
      vec4.transformMat4(ori_World, ori_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v1_World, v1_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v2_World, v2_NDC, inverse_viewProjectionMatrix);
      vec4.scale(ori_World, ori_World, 1 / ori_World[3]);
      vec4.scale(v1_World, v1_World, 1 / v1_World[3]);
      vec4.scale(v2_World, v2_World, 1 / v2_World[3]);
      //finally do cross product
      vec4.subtract(edge1_4, v1_World, ori_World);
      vec4.subtract(edge2_4, v2_World, ori_World);
      var edge1_3 = vec3.fromValues(edge1_4[0], edge1_4[1], edge1_4[2]);
      var edge2_3 = vec3.fromValues(edge2_4[0], edge2_4[1], edge2_4[2]);
      vec3.cross(nor_World3, edge2_3, edge1_3);
      vec3.normalize(nor_World3_normalized, nor_World3);
      this._xPlanes[i] = new Plane(ori_World, nor_World3_normalized);
    }
    for(let i = 0; i < this._ySlices + 1; ++i){
      var ori_World = vec4.create();
      var v1_World = vec4.create();
      var v2_World = vec4.create();
      var nor_World3 = vec3.create();
      var nor_World3_normalized = vec3.create();
      var edge1_4 = vec4.create();
      var edge2_4 = vec4.create();
      var ori_NDC = vec4.fromValues(-1 + 2/this._ySlices, -1 + 2/this._ySlices*i, 0, 1);
      var v1_NDC = vec4.fromValues(-1 + 4/this._ySlices, -1 + 2/this._ySlices*i, 0, 1);
      var v2_NDC = vec4.fromValues(-1 + 2/this._ySlices, -1 + 2/this._ySlices*i, 0.5, 1);
      vec4.transformMat4(ori_World, ori_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v1_World, v1_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v2_World, v2_NDC, inverse_viewProjectionMatrix);
      vec4.scale(ori_World, ori_World, 1 / ori_World[3]);
      vec4.scale(v1_World, v1_World, 1 / v1_World[3]);
      vec4.scale(v2_World, v2_World, 1 / v2_World[3]);
      //finally do cross product
      vec4.subtract(edge1_4, v1_World, ori_World);
      vec4.subtract(edge2_4, v2_World, ori_World);
      var edge1_3 = vec3.fromValues(edge1_4[0], edge1_4[1], edge1_4[2]);
      var edge2_3 = vec3.fromValues(edge2_4[0], edge2_4[1], edge2_4[2]);
      vec3.cross(nor_World3, edge2_3, edge1_3);
      vec3.normalize(nor_World3_normalized, nor_World3);
      this._yPlanes[i] = new Plane(ori_World, nor_World3_normalized);
    }
    for(let i = 0; i < this._zSlices + 1; ++i){
      var ori_World = vec4.create();
      var v1_World = vec4.create();
      var v2_World = vec4.create();
      var nor_World3 = vec3.create();
      var nor_World3_normalized = vec3.create();
      var edge1_4 = vec4.create();
      var edge2_4 = vec4.create();
      var origin_NDC = vec4.fromValues(0, 0, 1/this._zSlices*i, 1);
      var v1_NDC = vec4.fromValues(1, 0, 1/this._zSlices*i, 1);
      var v2_NDC = vec4.fromValues(0, 1, 1/this._zSlices*i, 1);
      vec4.transformMat4(ori_World, ori_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v1_World, v1_NDC, inverse_viewProjectionMatrix);
      vec4.transformMat4(v2_World, v2_NDC, inverse_viewProjectionMatrix);
      vec4.scale(ori_World, ori_World, 1 / ori_World[3]);
      vec4.scale(v1_World, v1_World, 1 / v1_World[3]);
      vec4.scale(v2_World, v2_World, 1 / v2_World[3]);
      //finally do cross product
      vec4.subtract(edge1_4, v1_World, ori_World);
      vec4.subtract(edge2_4, v2_World, ori_World);
      var edge1_3 = vec3.fromValues(edge1_4[0], edge1_4[1], edge1_4[2]);
      var edge2_3 = vec3.fromValues(edge2_4[0], edge2_4[1], edge2_4[2]);
      vec3.cross(nor_World3, edge2_3, edge1_3);
      vec3.normalize(nor_World3_normalized, nor_World3);
      this._zPlanes[i] = new Plane(ori_World, nor_World3_normalized);
    }
  }

  test(){
    for(let i = 0; i < 10; ++i){

    }
  }
  /*Is_Intersect_Light_Cluster(scene, lights_index, clusters_index){
    //console.log(this._xSlices);
    //console.log("sadas");
    var cluster_x = (clusters_index % (this._xSlices * this._ySlices))%this._zSlices;
    return true;
  }*/
  

  updateClusters(camera, viewMatrix, scene) {
    //this.test();
    this.init_Planes(camera);
    var total_ligths_num = scene.lights.length;
    //console.log(total_ligths_num);
    for(let i = 0; i < total_ligths_num; ++i){
      //iterate through all the lights
      //compute minX, minY, minZ, maxX, maxY, maxZ(which are edge slices no. of the light cover)
      var maxX = -2,minX = this._xSlices+1,maxY = -2,minY = this._ySlices+1,maxZ = -2,minZ = this._zSlices+1;
      //examine X slices (16+1)
      for(let x = 0; x < this._xSlices + 1; ++x){
        var dist = computeDistance_Point_Plane(scene.lights[i].position, this._xPlanes[x]);
        var r = scene.lights[i].radius;
        if(dist < r){
          //this slice is inside of light radius
          minX = Math.min(minX, x-1);
          maxX = Math.max(maxX, x+1);
        }
      }

      //examine Y slices
      for(let y = 0; y < this._ySlices + 1; ++y){
        var dist = computeDistance_Point_Plane(scene.lights[i].position, this._yPlanes[y]);
        var r = scene.lights[i].radius;
        if(dist < r){
          //this slice is inside of light radius
          minY = Math.min(minY, y-1);
          maxY = Math.max(maxY, y+1);
        }
      }
      //examine Z slices
      for(let z = 0; z < this._zSlices + 1; ++z){
        var dist = computeDistance_Point_Plane(scene.lights[i].position, this._zPlanes[z]);
        var r = scene.lights[i].radius;
        if(dist < r){
          //this slice is inside of light radius
          minZ = Math.min(minZ, z-1);
          maxZ = Math.max(maxZ, z+1);
        }
      }
      if(minX <= maxX && minY <= maxY && minZ <= maxZ){
        //in this case, the light is overlapping with the frustum
        //clamp
        minX = Math.clamp(minX, 0, this._xSlices); 
        maxX = Math.clamp(maxX, 0, this._xSlices); 
        minY = Math.clamp(minY, 0, this._ySlices); 
        maxY = Math.clamp(maxY, 0, this._ySlices); 
        minZ = Math.clamp(minZ, 0, this._zSlices); 
        maxZ = Math.clamp(maxZ, 0, this._zSlices); 
        //iterate through the overlapping clusters, then write the light index into its texture buffer.
      }
    }
    //console.log(this._zPlanes);
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

//     for (let z = 0; z < this._zSlices; ++z) {
//       for (let y = 0; y < this._ySlices; ++y) {
//         for (let x = 0; x < this._xSlices; ++x) {
//           let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
//           // Reset the light count to 0 for every cluster
//           this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
//           var light_count = 0;
//           for(let k = 0; k < NUM_LIGHTS; ++k){
//             if(this.Is_Intersect_Light_Cluster(scene, k, i)){
// //              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, light_count+1)] = k;
// //              light_count += 1;
// //              if(light_count == MAX_LIGHTS_PER_CLUSTER){
// //                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = light_count;
// //                continue;
// //              }
//             }
//           }
//           this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = light_count;
//         }
//       }
//     }

    this._clusterTexture.update();
  }
}