import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 1000;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, projectionMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    const radian = Math.PI / 180.0;
    const y_len = Math.tan(camera.fov * 0.5 * radian);
    const x_len = y_len * camera.aspect;
    const z_step = (camera.far - camera.near) / this._zSlices;

   for(let i = 0; i < NUM_LIGHTS; i++) {
       let radius = scene.lights[i].radius;
       let light_pos = vec4.fromValues(scene.lights[i].position[0], 
                                      scene.lights[i].position[1], 
                                      scene.lights[i].position[2], 1.0);
       vec4.transformMat4(light_pos, light_pos, viewMatrix);
       light_pos[2] *= -1.0;
       
       let light_x_len = y_len*light_pos[2];        
       let light_y_len = x_len*light_pos[2];
       let y_step = 2 * light_x_len / this._ySlices;
       let x_step = 2 * light_y_len / this._xSlices;
       let lightPosNewY = light_x_len + light_pos[1];
       let lightPosNewX = light_y_len + light_pos[0];


       let lightStartY = lightPosNewY - radius;
       let lightStopY = lightPosNewY + radius;
       let lightStartX = lightPosNewX - radius;
       let lightStopX = lightPosNewX + radius;

       let y_lo  = Math.floor(lightStartY / y_step); 
       let y_hi   = Math.floor(lightStopY  / y_step); 
       let x_lo  = Math.floor(lightStartX / x_step); 
       let x_hi   = Math.floor(lightStopX  / x_step); 

       if(y_lo > this._ySlices-1 || y_hi < 0)  continue; 
       if(x_lo > this._xSlices-1 || x_hi < 0) { continue; }
       y_lo = Math.max(0, y_lo);
       x_lo = Math.max(0, x_lo);
       y_hi = Math.min(this._ySlices, y_hi);
       x_hi = Math.min(this._xSlices, x_hi);

       let lightPosNewZ = light_pos[2] - camera.near;
       let lightStartZ = lightPosNewZ - radius;
       let lightStopZ = lightPosNewZ + radius; 
       let z_lo  = Math.floor(lightStartZ / z_step); 
       let z_hi   = Math.floor(lightStopZ  / z_step)+1;
       if(z_lo > this._zSlices-1 || z_hi < 0) { continue; }
       z_lo = Math.max(0, z_lo);
       z_hi = Math.min(this._zSlices, z_hi);

      for(let x = x_lo; x <= x_hi; ++x) {
        for(let y = y_lo; y < y_hi; ++y) {
          for(let z = z_lo; z < z_hi; ++z) {
             let cluster_idx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
             let light_num_idx = this._clusterTexture.bufferIndex(cluster_idx, 0);
             let light_nums = 1 + this._clusterTexture.buffer[light_num_idx];

             if(light_nums < MAX_LIGHTS_PER_CLUSTER) {
                 this._clusterTexture.buffer[light_num_idx] = light_nums;
                 let light_texel = Math.floor(light_nums*0.25);
                 let texel_idx = this._clusterTexture.bufferIndex(cluster_idx, light_texel);
                 let comp_idx = light_nums - light_texel*4;
                 this._clusterTexture.buffer[texel_idx+comp_idx] = i;
              }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}
