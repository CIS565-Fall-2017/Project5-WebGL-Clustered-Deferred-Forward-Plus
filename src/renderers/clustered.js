import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

  function distance(light_pos, idx, length) {
    return (light_pos[idx] - length * light_pos[2]) / Math.sqrt(1 + length * length);
  }
 
  function upper_bound(light_pos, light_radius, num_slices, stride, idx) {

    var hi;
    for(hi = num_slices; hi >= 0; hi--) {
      let len = stride * (hi - 1 - num_slices * 0.5);
      if (distance(light_pos, idx, len) >= -light_radius) {
        break;
      }
    }
  }

  function lower_bound(light_pos, light_radius, num_slices, stride, idx) {
    var lo;
    for(lo = 0; lo < num_slices; lo++) {
      let len = stride * (lo + 1 - num_slices * 0.5);
      if (distance(light_pos, idx, len) <= light_radius){
        break;
      }
    }
    return lo;
  }

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

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var radian = Math.PI/180.0;
    var y_len = 2.0 * Math.tan(camera.fov * 0.5 * radian);
    var y_stride = y_len / this._ySlices;

    var x_len = camera.aspect * y_len;
    var x_stride = x_len / this._xSlices;

    var z_stride = (camera.far - camera.near) / this._zSlices;

    for (let i = 0; i < NUM_LIGHTS; i++) {
      let radius = scene.lights[i].radius;
      let light_pos = vec4.fromValues(scene.lights[i].position[0],
                                      scene.lights[i].position[1],
                                      scene.lights[i].position[2],
                                      1.0);
      vec4.transformMat4(light_pos, light_pos, viewMatrix);
      light_pos[2] *= -1.0;

      let x_lo = lower_bound(light_pos, radius, this._xSlices, x_stride, 0);
      let y_lo = lower_bound(light_pos, radius, this._ySlices, y_stride, 1);

      let x_hi = upper_bound(light_pos, radius, this._xSlices, x_stride, 0);
      let y_hi = upper_bound(light_pos, radius, this._ySlices, y_stride, 1);

      let shifted_z = light_pos[2] - camera.near;
      let min_z = shifted_z - radius;
      let max_z = shifted_z + radius;

      let z_lo = Math.floor(min_z / z_stride);
      let z_hi = Math.floor(max_z / z_stride) + 1;
      z_lo = Math.max(z_lo, 0);
      z_hi = Math.min(z_hi, this._zSlices);


      for(let x = x_lo; x <= x_hi; x++) {
        for(let y = y_lo; y <= y_hi; y++) {
          for(let z = z_lo; z <= z_hi; z++) {
            let cluster_idx = x + y * this._xSlices + z * this._xSlices * this._xSlices;
            let counts_idx = this._clusterTexture.bufferIndex(cluster_idx, 0);
            let counts_lights = this._clusterTexture.bufferIndex[counts_idx] + 1;

            if (counts_lights < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[counts_idx] = counts_lights;
              let light_texel = Math.floor(counts_lights * 0.25);
              let light_texel_idx = this._clusterTexture.bufferIndex(cluster_idx, light_texel);

              let rem = counts_lights - light_texel * 4
              this._clusterTexture[light_texel_idx + rem] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}