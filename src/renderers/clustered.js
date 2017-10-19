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

    // create planes (2 or 4 or 1??) (point, normal ??) - 4 in total probably..
    // 
    // loop through the lights and compare the perpedicular dist vs. radius of all planes..

    // Exponential depth...
    // http://www.humus.name/Articles/PracticalClusteredShading.pdf
    // [0.1, 5.0, 6.8, 9.2, 12.6, 17.1, 23.2, 31.5, 42.9, 58.3, 79.2, 108, 146, 199, 271, 368, 500]

    let expZ = [0.1, 5.0, 6.8, 9.2, 12.6, 17.1, 23.2, 31.5, 42.9, 58.3, 79.2, 108, 146, 199, 271, 368, 500];

    for (let z = 0; z < this._zSlices; ++z) {
      let yScaled = exp[Z];
      for (let y = 0; y < this._ySlices; ++y) {

        // create 2 Y planes
        // 2 points - point and (anything, y, anything or 1000(fcp)), (anything + something, y, anything or 1000(fcp))
        //vec3 rpos1();
        let yScaled = canvas.height;
        let rpos1 = camera.position;
        let rpos2 = vec3(0, , 1000);

        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          // create 2 X planes
          // loop and assign lights
        }
      }
    }

    this._clusterTexture.update();
  }
}
