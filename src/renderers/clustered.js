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
      
      // Transform light position into view space
      let lightPosVec4 = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1);
      var lightPos = vec4.fromValues(0, 0, 0, 1);
      vec4.transformMat4(lightPos, lightPosVec4, viewMatrix);
      
      // Frustum width and height at this light's z-value
      let halfFrustumHeight = Math.abs(Math.tan(camera.fov * 0.00872664625) * lightPos[2]); // that's pi / 360, since i'm using fov/2
      let halfFrustumWidth = halfFrustumHeight * camera.aspect;

      // Min and max clusters influenced in the x-direction
      let clusterMinX = Math.floor((lightPos[0] - LIGHT_RADIUS + halfFrustumWidth) / (halfFrustumWidth * 2) * this._xSlices);
      let clusterMaxX = Math.floor((lightPos[0] + LIGHT_RADIUS + halfFrustumWidth) / (halfFrustumWidth * 2) * this._xSlices);

      // Min and max clusters influenced in the y-direction
      let clusterMinY = Math.floor((lightPos[1] - LIGHT_RADIUS + halfFrustumHeight) / (halfFrustumHeight * 2) * this._ySlices);
      let clusterMaxY = Math.floor((lightPos[1] + LIGHT_RADIUS + halfFrustumHeight) / (halfFrustumHeight * 2) * this._ySlices);

      // Min and max clusters influenced in the z-direction
      let clusterMinZ = Math.floor((-lightPos[2] - LIGHT_RADIUS - camera.near) / (camera.far - camera.near) * this._zSlices);
      let clusterMaxZ = Math.floor((-lightPos[2] + LIGHT_RADIUS - camera.near) / (camera.far - camera.near) * this._zSlices);

      // Cull lights not influencing the frustum
      if((clusterMinX >= this._xSlices && clusterMaxX >= this._xSlices) || (clusterMaxX < 0 && clusterMinX < 0)) {
        continue;
      }

      if((clusterMinY >= this._ySlices && clusterMaxY >= this._ySlices) || (clusterMaxY < 0 && clusterMinY < 0)) {
        continue;
      }

      if((clusterMinZ >= this._zSlices && clusterMaxZ >= this._zSlices) || (clusterMaxZ < 0 && clusterMinZ < 0)) {
        continue;
      }

      // Clamp cluster indices
      clusterMinX = Math.min(Math.max(clusterMinX, 0), this._xSlices - 1);
      clusterMaxX = Math.min(Math.max(clusterMaxX, 0), this._xSlices - 1);
      clusterMinY = Math.min(Math.max(clusterMinY, 0), this._ySlices - 1);
      clusterMaxY = Math.min(Math.max(clusterMaxY, 0), this._ySlices - 1);
      clusterMinZ = Math.min(Math.max(clusterMinZ, 0), this._zSlices - 1);
      clusterMaxZ = Math.min(Math.max(clusterMaxZ, 0), this._zSlices - 1);

      // For each cluster in the range, add this light to its influencing lights
      for(let z = clusterMinZ; z <= clusterMaxZ; ++z) {
        for(let y = clusterMinY; y <= clusterMaxY; ++y) {
          for(let x = clusterMinX; x <= clusterMaxX; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let bufferIdx = this._clusterTexture.bufferIndex(idx, 0);
            let numLightsInThisCluster = this._clusterTexture.buffer[bufferIdx];
            if(numLightsInThisCluster < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[bufferIdx] = numLightsInThisCluster + 1;
              let v = Math.floor((numLightsInThisCluster + 1) / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, v) + numLightsInThisCluster + 1 - v * 4] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}