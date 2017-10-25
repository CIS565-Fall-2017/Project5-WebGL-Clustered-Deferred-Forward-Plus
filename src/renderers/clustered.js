import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

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

    var totalNumLights = 0;

    for(let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++)
    {
      // Get light's AABB
      // Multiply by viewMatrix to get point in camera space
      var _lightPos = viewMatrix * vec4.fromValues(scene.lights[lightIdx].position[0], scene.lights[lightIdx].position[1], scene.lights[lightIdx].position[2], 1.0);
      var lightPos = vec3.fromValues(_lightPos[0], _lightPos[1], _lightPos[2]);
      lightPos[2] *= -1;    // Looking down -z, so make it positive
      var lightRadius = scene.lights[lightIdx].radius;
      
      // Get min & max AABB positions 
      var minBB = lightPos - lightRadius;
      var maxBB = lightPos + lightRadius;

      // Calculate frustum width and height
      // Note: camera.fov = vertical fov
      var half_fov_rad = ((camera.fov / 2.0) * Math.PI) / 180.0;
      
      var frustum_width = 2.0 * Math.atan(Math.tan(half_fov_rad) * camera.aspect);      
      var frustum_height = 2.0 * Math.tan(half_fov_rad) * camera.far;
      
      // Calculate the frustum width and height according to lightPos
      var light_frustum_height = 2.0 * lightPos[2] * Math.tan(half_fov_rad);
      var light_frustum_width = light_frustum_height * camera.aspect;

      // Stride = total distance of frustum / slice size (aka 15)
      var z_stride = (camera.far - camera.near) / this._zSlices;
      var y_stride = light_frustum_height / this._ySlices;
      var x_stride = light_frustum_width / this._xSlices;

      var z_min = minBB[2] / z_stride;
      var z_max = maxBB[2] / z_stride;
      var y_min = (minBB[1] + (light_frustum_height / 2.0)) / y_stride;
      var y_max = (maxBB[1] + (light_frustum_height / 2.0)) / y_stride;
      var x_min = (minBB[0] + (light_frustum_width / 2.0)) / x_stride;
      var x_max = (maxBB[0] + (light_frustum_width / 2.0)) / x_stride;

      // totalNumLights++;

      for (let _z = z_min; _z < z_max; ++_z) {
        for (let _y = y_min; _y < y_max; ++_y) {
          for (let _x = x_min; _x < x_max; ++_x) {

            // Index into texture buffer
            let u = _x + _y * this._xSlices + _z * this._xSlices * this._ySlices;
            
            totalNumLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(u, 0) + 0];

            if(totalNumLights < MAX_LIGHTS_PER_CLUSTER)
            {
              let v = floor((totalNumLights) / 4);
              let pixelIdx = (totalNumLights) % 4;
  
              // Allocate lights into the cluster texture
              // bufferIndex(u, 0) + 0] = LIGHT COUNT;
              // bufferIndex(u, v) + 0...3] = LIGHT ID'S;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(u, v) + pixelIdx] = lightIdx; 
            }
               
          }//end for x
        }//end for y
      }//end for z

    }//end for all lights    

    this._clusterTexture.update();
  }//end updateClusters
}//end ClusteredRenderer