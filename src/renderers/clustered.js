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
      let lightPos = scene.lights[i].position;
      
      // Frustum width and height at this light's z-value
      let oneOver180 = 0.00555555555;
      let halfFrustumWidth = Math.tan(camera.fov / 2 * Math.PI * oneOver180) * lightPos.z;
      let halfFrustumHeight = Math.tan(camera.fov / 2 * Math.PI * oneOver180) / camera.aspect * lightPos.z;
      
      // Min and max clusters influenced in the x-direction
      let clusterMinX = Math.floor(Math.max(Math.min(lightPos[0] - LIGHT_RADIUS, halfFrustumWidth), -halfFrustumWidth) / (2 * halfFrustumWidth));
      let clusterMaxX = Math.floor(Math.max(Math.min(lightPos[0] + LIGHT_RADIUS, halfFrustumWidth), -halfFrustumWidth) / (2 * halfFrustumWidth));

      // Min and max clusters influenced in the y-direction
      let clusterMinY = Math.floor(Math.max(Math.min(lightPos[1] - LIGHT_RADIUS, halfFrustumHeight), -halfFrustumHeight) / (2 * halfFrustumHeight));
      let clusterMaxY = Math.floor(Math.max(Math.min(lightPos[1] + LIGHT_RADIUS, halfFrustumHeight), -halfFrustumHeight) / (2 * halfFrustumHeight));

      // Min and max clusters influenced in the z-direction
      let clusterMinZ = Math.floor(Math.max(Math.min(lightPos[2] - LIGHT_RADIUS, camera.far), camera.near) / (camera.far - camera.near));
      let clusterMaxZ = Math.floor(Math.max(Math.min(lightPos[2] + LIGHT_RADIUS, camera.far), camera.near) / (camera.far - camera.near));

      // For each cluster in the range, add this light to its influencing lights
      for(let x = clusterMinX; x <= clusterMaxX; ++x) {
        for(let y = clusterMinY; y <= clusterMaxY; ++y) {
          for(let z = clusterMinZ; z <= clusterMaxZ; ++z) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let numLightsInThisCluster = ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, ceil(numLightsInThisCluster / 4)) + numLightsInThisCluster % 4] = i;
          }
        }
      }
    }



    this._clusterTexture.update();
  }
}