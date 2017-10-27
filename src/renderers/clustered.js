import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

import { MAX_LIGHTS_PER_CLUSTER } from '../scene';

// I've defined this in scene.js now
// export const MAX_LIGHTS_PER_CLUSTER = 100; 

const YZ_PLANE = false;
const XZ_PLANE = false;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  clamp(val, minVal, maxVal)  
  { 
    return Math.max(minVal, Math.min(val, maxVal)); 
    // return Math.min(Math.max(val, minVal), maxVal);  
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    // AKA: For all lights, figure out the clusters that the light overlaps

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }//end for x
      }//end for y
    }//end for z
    
    // =================================== BEGIN CLUSTERING ===================================


    var totalNumLightsInCluster = 0;

    for(let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++)
    {
      // Get light's AABB
      // Multiply by viewMatrix to get point in camera space
      var _lightPos = vec3.fromValues(scene.lights[lightIdx].position[0], 
                                      scene.lights[lightIdx].position[1], 
                                      scene.lights[lightIdx].position[2]);
      vec3.transformMat4(_lightPos, _lightPos, viewMatrix);
      var lightPos = vec3.fromValues(_lightPos[0], _lightPos[1], -1.0 * _lightPos[2]);
      var lightRadius = scene.lights[lightIdx].radius;
      
      // Get min & max AABB positions 
      // NOTE: Consider doing the 45deg boundary check to include those edge case clusters too
      var minBB = vec3.fromValues(lightPos[0] - lightRadius, lightPos[1] - lightRadius, lightPos[2] - lightRadius);
      var maxBB = vec3.fromValues(lightPos[0] + lightRadius, lightPos[1] + lightRadius, lightPos[2] + lightRadius);

      // console.log("minBB: ", minBB[0], ", ", minBB[1], ", ", minBB[2]);
      // console.log("maxBB: ", maxBB[0], ", ", maxBB[1], ", ", maxBB[2]);

      // Calculate frustum width and height
      // Note: camera.fov = vertical fov
      var half_fov_rad = ((camera.fov / 2.0) * Math.PI) / 180.0;

      // console.log("half_fov_rad", half_fov_rad);

      // var frustum_width = 2.0 * Math.atan(Math.tan(half_fov_rad) * camera.aspect);      
      // var frustum_height = 2.0 * Math.tan(half_fov_rad) * camera.far;
      
      // Calculate the frustum width and height according to lightPos
      var light_frustum_height = Math.abs(2 * lightPos[2] * Math.tan(half_fov_rad));
      var light_frustum_width = Math.abs(light_frustum_height * camera.aspect);

      // console.log("light_frustum_height: ", light_frustum_height);
      // console.log("light_frustum_width: ", light_frustum_width);

      // Stride = total distance of frustum / slice size (aka 15)
      var z_stride = (camera.far - camera.near) / this._zSlices;
      var y_stride = light_frustum_height / this._ySlices;
      var x_stride = light_frustum_width / this._xSlices;

      // console.log("zstride: ", z_stride);
      // console.log("ystride: ", y_stride);
      // console.log("xstride: ", x_stride);

      // Divide height and width by 2 because we have 0,0 in the middle
      // Note: Make sure to clamp b/c you might get a light that's outside of frustum, hence index out of bounds
      var z_min = Math.floor(minBB[2] / z_stride) - 1;
      var z_max = Math.floor(maxBB[2] / z_stride) + 1;
      var y_min = Math.floor((minBB[1] + (light_frustum_height / 2.0)) / y_stride);
      var y_max = Math.floor((maxBB[1] + (light_frustum_height / 2.0)) / y_stride);
      var x_min = Math.floor((minBB[0] + (light_frustum_width / 2.0)) / x_stride);
      var x_max = Math.floor((maxBB[0] + (light_frustum_width / 2.0)) / x_stride);

      // console.log("z_min to max: ", z_min, ", ", z_max);
      // console.log("y_min to max: ", y_min, ", ", y_max);
      // console.log("x_min to max: ", x_min, ", ", x_max);

      // NOTE & TODO: If the min and max index in any dimension is out of frustum bounds, then don't include light in any cluster
      // if((z_min < 0 && z_max < 0) || (z_min > this._zSlices - 1 && z_max > this._zSlices - 1))    continue;
      // if((y_min < 0 && y_max < 0) || (y_min > this._ySlices - 1 && y_max > this._ySlices - 1))    continue;
      // if((x_min < 0 && x_max < 0) || (x_min > this._xSlices - 1 && x_max > this._xSlices - 1))    continue;

      if((z_min < 0 && z_max < 0) || (z_min >= this._zSlices && z_max >= this._zSlices))    continue;
      if((y_min < 0 && y_max < 0) || (y_min >= this._ySlices && y_max >= this._ySlices))    continue;
      if((x_min < 0 && x_max < 0) || (x_min >= this._xSlices && x_max >= this._xSlices))    continue;

      z_min = this.clamp(z_min, 0, this._zSlices - 1);
      z_max = this.clamp(z_max, 0, this._zSlices - 1);
      y_min = this.clamp(y_min, 0, this._ySlices - 1);
      y_max = this.clamp(y_max, 0, this._ySlices - 1);
      x_min = this.clamp(x_min, 0, this._xSlices - 1);
      x_max = this.clamp(x_max, 0, this._xSlices - 1);


      for (let _z = z_min; _z <= z_max; ++_z) {
        for (let _y = y_min; _y <= y_max; ++_y) {
          for (let _x = x_min; _x <= x_max; ++_x) {

      // for (let _z = 0; _z < 15; ++_z) {
      //   for (let _y = 0; _y < 15; ++_y) {
      //     for (let _x = 0; _x < 15; ++_x) {

            // Index into texture buffer
            let u = _x + (_y * this._xSlices) + (_z * this._xSlices * this._ySlices);
            
            var v0 = this._clusterTexture.bufferIndex(u, 0);
            totalNumLightsInCluster = this._clusterTexture.buffer[v0 + 0];

            if(totalNumLightsInCluster + 1 <= MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[v0] = totalNumLightsInCluster + 1;

              let v = Math.floor((totalNumLightsInCluster + 1) / 4);

              let pixelIdx = (totalNumLightsInCluster + 1) % 4;
              // let pixelIdx = (totalNumLightsInCluster + 1) - (v * 4);
  
              // Allocate lights into the cluster texture
              // bufferIndex(u, 0) + 0] = LIGHT COUNT and bufferIndex(u, v) + 0...3] = LIGHT ID'S;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(u, v) + pixelIdx] = lightIdx; 
            }//end light if check
               
          }//end for x
        }//end for y
      }//end for z
    }//end for all lights    

    // =================================== END CLUSTERING ===================================

    this._clusterTexture.update();
  }//end updateClusters
}//end ClusteredRenderer