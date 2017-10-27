import { mat4, vec4, vec3,vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }
  
  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    var DegreeToRadian=Math.PI/180.0;
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

        }
      }
    }
    var x_begin=this._xSlices,x_end=this._xSlices;
    var y_begin=this._ySlices,y_end=this._ySlices;
    var z_begin=this._zSlices,z_end=this._zSlices;
    var z_step=(camera.far-camera.near)/parseFloat(this._zSlices);
    //Define which plane along z direction we use as the reference for x and y
    var z_plane=(camera.far-camera.near)/2.0;
    var y_min=-z_plane*Math.tan(camera.fov * 0.5 *DegreeToRadian);
    var x_min=y_min*camera.aspect;
    var x_step=-2.0*x_min/parseFloat(this._xSlices),y_step=-2.0*y_min/parseFloat(this._ySlices);
    var lightLocalPos,radius,lightLocalPosVec3;
    function DistanceX(x_value,z_value,lightPos){
      var l1=vec3.fromValues(x_value,0,z_value);
      var l2=vec3.fromValues(0,1,0);
      var nor=vec3.create();
      vec3.cross(nor,l1,l2);
      vec3.normalize(nor,nor);
      return Math.abs(vec3.dot(lightPos,nor));
    }
    function DistanceY(y_value,z_value,lightPos){
      var l1=vec3.fromValues(0,y_value,z_value);
      var l2=vec3.fromValues(1,0,0);
      var nor=vec3.create();
      vec3.cross(nor,l1,l2);
      vec3.normalize(nor,nor);
      return Math.abs(vec3.dot(lightPos,nor));
    }
    for(var i=0;i<NUM_LIGHTS;i++){
      //light position in camera space
      lightLocalPos=vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
      radius=scene.lights[i].radius;
      vec4.transformMat4(lightLocalPos, lightLocalPos, viewMatrix);
      //lightLocalPos[2]*=-1.0;
      lightLocalPosVec3=vec3.fromValues(lightLocalPos[0],lightLocalPos[1],lightLocalPos[2])
      x_begin=this._xSlices;
      x_end=this._xSlices;
      y_begin=this._ySlices;
      y_end=this._ySlices;
      z_begin=this._zSlices;
      z_end=this._zSlices;
      //console.log(this._xSlices,this._ySlices,this._zSlices);
      for(var j=0;j<=this._xSlices;j++){
        if(DistanceX(x_min+x_step*j,-z_plane,lightLocalPosVec3)<radius){
          x_begin=Math.max(0,j-1);
          break;
        }
      }
      
      for(var j=x_begin+1;j<=this._xSlices;j++){
        if(DistanceX(x_min+j*x_step,-z_plane,lightLocalPosVec3)>=radius){
          x_end=j;
          break;
        }
      }
      for(var j=0;j<=this._ySlices;j++){
        if(DistanceY(y_min+y_step*j,-z_plane,lightLocalPosVec3)<radius){
          y_begin=Math.max(0,j-1);
          break;
        }
      }
      for(var j=y_begin+1;j<=this._ySlices;j++){
        if(DistanceY(y_min+y_step*j,-z_plane,lightLocalPosVec3)>=radius){
          y_end=j;
          break;
        }
      }
      // for(var j=0;j<this._zSlices;j++){
      //   if(Math.abs(-camera.near-(j+1)*z_step-(lightLocalPosVec3[2]))<radius){
      //     z_begin=j;
      //     break;
      //   }
      // }
      // for(var j=0;j<this._zSlices;j++){
      //   if(Math.abs(-camera.far+(j+1)*z_step-(lightLocalPosVec3[2]))<radius){
      //     z_end=this._zSlices-j-1;
      //     break;
      //   }
      // }
      z_begin  = Math.floor(((-lightLocalPosVec3[2]) - camera.near-radius) / z_step); 
      z_end   = Math.floor(((-lightLocalPosVec3[2]) - camera.near+radius)/ z_step)+1; 
      if(z_begin > this._zSlices-1 || z_end < 0) { continue; }
      z_begin = Math.max(0, z_begin);
      z_end = Math.min(this._zSlices, z_end);

      for(var z=z_begin;z<z_end;z++)
        for(var y=y_begin;y<y_end;y++)
          for(var x=x_begin;x<x_end;x++){
            var idx=x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var countIdx=this._clusterTexture.bufferIndex(idx,0);
            var lightsNum=this._clusterTexture.buffer[countIdx]+1;

            //console.log(lightsNum);
            if(lightsNum<=MAX_LIGHTS_PER_CLUSTER){
              this._clusterTexture.buffer[countIdx]=lightsNum;
              var component=Math.floor(lightsNum/4);
              var reminder=lightsNum-4*component;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx,component)+reminder]=i;
            }     
          }
    }
    this._clusterTexture.update();
  }
}


