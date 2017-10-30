import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
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

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // For each light, determine which clusters are within its radius of influence
    // This computation makes the assumption that the slices are distributed evenly throughout the frustum
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      // First compute the cluster that this light is in along each axis

      let lightPosVec4 = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1);
      var lightPos = vec4.fromValues(0, 0, 0, 1);
      vec4.transformMat4(lightPos, lightPosVec4, viewMatrix);
      
      // Frustum width and height at this light's z-value
      let halfFrustumHeight = Math.abs(Math.tan(camera.fov * 0.00872664625) * -lightPos[2]); // that's pi / 360, since i'm using fov/2
      let halfFrustumWidth = halfFrustumHeight * camera.aspect;
      
      // Cull lights outside of the frustum
      if(Math.abs(lightPos[0] + LIGHT_RADIUS) < -halfFrustumWidth  ||
         Math.abs(lightPos[0] - LIGHT_RADIUS) > halfFrustumWidth   ||
         Math.abs(lightPos[1] + LIGHT_RADIUS) < -halfFrustumHeight  ||
         Math.abs(lightPos[1] - LIGHT_RADIUS) > halfFrustumHeight   ||
         Math.abs(-lightPos[2] + LIGHT_RADIUS) < camera.near  ||
         Math.abs(-lightPos[2] - LIGHT_RADIUS) > camera.far) {
           continue;
      }      

      let denom = 1 / (2 * halfFrustumHeight);
      let denomX = 1 / (2 * halfFrustumWidth);

      // Min and max clusters influenced in the x-direction
      let clusterMinX = Math.min(Math.max(Math.floor((lightPos[0] - LIGHT_RADIUS * 5 + halfFrustumWidth) * denomX * (this._xSlices - 1)), 0), this._xSlices - 1);
      let clusterMaxX = Math.min(Math.max(Math.floor((lightPos[0] + LIGHT_RADIUS * 5 + halfFrustumWidth) * denomX * (this._xSlices - 1)), 0), this._xSlices - 1);

      // Min and max clusters influenced in the y-direction
      let clusterMinY = Math.min(Math.max(Math.floor((lightPos[1] - LIGHT_RADIUS * 5 + halfFrustumHeight) * denom * (this._ySlices - 1)), 0), this._ySlices - 1);
      let clusterMaxY = Math.min(Math.max(Math.floor((lightPos[1] + LIGHT_RADIUS * 5 + halfFrustumHeight) * denom * (this._ySlices - 1)), 0), this._ySlices - 1);

      // Min and max clusters influenced in the z-direction
      let clusterMinZ = Math.min(Math.max(Math.floor((-lightPos[2] - LIGHT_RADIUS * 5 - camera.near) / (camera.far - camera.near) * (this._zSlices - 1)), 0), this._zSlices - 1);
      let clusterMaxZ = Math.min(Math.max(Math.floor((-lightPos[2] + LIGHT_RADIUS * 5 - camera.near) / (camera.far - camera.near) * (this._zSlices - 1)), 0), this._zSlices - 1);

      /*
      clusterMinX = 0;
      clusterMaxX = 14;
      clusterMinY = 0;
      clusterMaxY = 14;
      clusterMinZ = 0;
      clusterMaxZ = 14;
      */

      // For each cluster in the range, add this light to its influencing lights
      for(let x = clusterMinX; x <= clusterMaxX; ++x) {
        for(let y = clusterMinY; y <= clusterMaxY; ++y) {
          for(let z = clusterMinZ; z <= clusterMaxZ; ++z) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let bufferIdx = this._clusterTexture.bufferIndex(idx, 0);
            let numLightsInThisCluster = this._clusterTexture.buffer[bufferIdx];
            if(numLightsInThisCluster < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[bufferIdx]++;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, Math.floor(numLightsInThisCluster / 4)) + numLightsInThisCluster % 4] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}