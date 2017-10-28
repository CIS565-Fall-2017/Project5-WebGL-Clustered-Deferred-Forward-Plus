import { mat4, vec4, vec3 } from 'gl-matrix';
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

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var halfHeight = Math.tan(camera.fov / 2.0 * (Math.PI/180.0));
    var halfWidth = halfHeight * camera.aspect;

    for (let l = 0; l < NUM_LIGHTS; ++l) {
      let radius = scene.lights[l].radius;
      var lightPos = vec4.fromValues(scene.lights[l].position[0],
        scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      let lightPosX = lightPos[0];
      let lightPosY = lightPos[1];
      let lightPosZ = lightPos[2];

      let sliceYHalfHeight = halfHeight * lightPosZ;
      let sliceYHeight = sliceYHalfHeight * 2.0;
      let sliceYstride = sliceYHeight / this._ySlices;

      let startY = Math.floor((lightPosY - radius + sliceYHalfHeight) / sliceYstride);
      let endY = Math.floor((lightPosY + radius + sliceYHalfHeight) / sliceYstride);

      let sliceXHalfHeight = halfWidth * lightPosZ;
      let sliceXHeight = sliceXHalfHeight * 2.0;
      let sliceXstride = sliceXHeight / this._xSlices;

      let startX = Math.floor((lightPosX - radius + sliceXHalfHeight) / sliceXstride) - 1;
      let endX = Math.floor((lightPosX + radius + sliceXHalfHeight) / sliceXstride) + 1;

      let sliceZHeight = (camera.far - camera.near);
      let sliceZstride = sliceZHeight / this._zSlices;

      let startZ = Math.floor((lightPosZ - radius) / sliceZstride);
      let endZ = Math.floor((lightPosZ + radius) / sliceZstride);

      if((startZ < 0 && endZ < 0) || (startZ >= this._zSlices && endZ >= this._zSlices)) continue;
      if((startY < 0 && endY < 0) || (startY >= this._ySlices && endY >= this._ySlices)) continue;
      if((startX < 0 && endX < 0) || (startX >= this._xSlices && endX >= this._xSlices)) continue;

      startX = startX.clamp(0, this._xSlices-1);
      endX = endX.clamp(0, this._xSlices-1);
      startY = startY.clamp(0, this._ySlices-1);
      endY = endY.clamp(0, this._ySlices-1);
      startZ = startZ.clamp(0, this._zSlices-1);
      endZ = endZ.clamp(0, this._zSlices-1);

      for (let z = startZ; z <= endZ; z++) {
        for (let y = startY; y <= endY; y++) {
          for (let x = startX; x <= endX; x++) {
            let i = x + y*this._xSlices + z *this._ySlices*this._xSlices;
            let lightIndex = this._clusterTexture.bufferIndex(i, 0);
            let numLights = 1 + this._clusterTexture.buffer[lightIndex];

            if (numLights <= MAX_LIGHTS_PER_CLUSTER) {           
              let col = Math.floor(numLights / 4);
              let row = Math.floor(numLights % 4);    
              this._clusterTexture.buffer[lightIndex] = numLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, col) + row] = l;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}

Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};