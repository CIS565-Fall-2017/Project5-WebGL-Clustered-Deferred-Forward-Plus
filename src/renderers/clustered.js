import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 1000;

export const SPECIAL = 5.0;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene)
  {
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

    const lightPos = vec4.create();  

    let lenY = 2.0 * Math.tan(camera.fov * 0.5 * Math.PI / 180.0);
    let lenX = camera.aspect * lenY;
    
    let deltaY = lenY / parseFloat(this._ySlices);
    let deltaX = lenX / parseFloat(this._xSlices);

    let startX;  
    let endX;
    let startY;  
    let endY;
    let startZ;  
    let endZ;

    for(let i = 0; i< NUM_LIGHTS; i++)
    {
         vec4.set(lightPos, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
         vec4.transformMat4(lightPos, lightPos, viewMatrix);
         lightPos[2] *= -1.0;

         let r = scene.lights[i].radius + 2;
         let minDisZ = lightPos[2] - r;
         let maxDisZ = lightPos[2] + r;

         // Compute index of X
         for(startX = 0; startX <= this._xSlices; startX++) {
            let dis1 = deltaX * (startX + 1 - this._xSlices * 0.5);
            let dis = (lightPos[0] - dis1 * lightPos[2]) / Math.sqrt(1.0 + dis1 * dis1);
            if( dis <=  r) break;
         }

         for(endX = this._xSlices; endX >= startX; endX--) {
            let dis1 = deltaX * (endX - 1 - this._xSlices * 0.5);
            let dis = (lightPos[0] - dis1 * lightPos[2]) / Math.sqrt(1.0 + dis1 * dis1);
            if( - dis <=  r) {
              endX--;
              break;
            }
         }

         // Compute index of Y
         for(startY = 0; startY <= this._ySlices; startY++) {
            let dis1 = deltaY * (startY + 1 - this._ySlices * 0.5);
            let dis = (lightPos[1] - dis1 * lightPos[2]) / Math.sqrt(1.0 + dis1 * dis1);
            if( dis <=  r) break;
         }

         for(endY = this._ySlices; endY >= startY; endY--) {
            let dis1 = deltaY * (endY - 1 - this._ySlices * 0.5);
            let dis = (lightPos[1] - dis1 * lightPos[2]) / Math.sqrt(1.0 + dis1 * dis1);
            if( - dis <=  r) {
              endY--;
              break;
            }
         }
          
         // Compute index of Z  
         for(startZ = 0; startZ <= this._zSlices; startZ++) {
            let dis = camera.near;
            if (startZ + 1 == 1) dis = SPECIAL;
            else {
              const normalizedZ = (parseFloat(startZ + 1) - 1.0) / (parseFloat(this._zSlices) - 1.0);
              dis =  Math.exp(normalizedZ * Math.log(camera.far - SPECIAL + 1.0)) + SPECIAL - 1.0;
            }
            if( dis > minDisZ) break;
         }

         for(endZ = this._zSlices; endZ >= startZ; endZ--) {
            let dis = camera.near;
            if (endZ + 1 == 1) dis = SPECIAL;
            else {
              const normalizedZ = (parseFloat(endZ + 1) - 1.0) / (parseFloat(this._zSlices) - 1.0);
              dis =  Math.exp(normalizedZ * Math.log(camera.far - SPECIAL + 1.0)) + SPECIAL - 1.0;
            }
            if( dis <= maxDisZ) {
              endZ += 2;
              break;
            }
         }
     
        for(let x = startX; x <= endX; x++) {
          for(let y = startY; y <= endY; y++) {
            for(let z = startZ; z <= endZ; z++) {
              
              let id = x + y * this._xSlices + z * this._xSlices * this._ySlices;
              let id_count = parseInt(this._clusterTexture.bufferIndex(id, 0));
              let count = parseInt(this._clusterTexture.buffer[id_count]);
              count++;

              if (count < MAX_LIGHTS_PER_CLUSTER) {
                 this._clusterTexture.buffer[id_count] = count;

                 let row = parseInt(Math.floor(count * 0.25));
                 let id_light = parseInt(this._clusterTexture.bufferIndex(id, row)) + count - row * 4;               
                 
                 this._clusterTexture.buffer[id_light] = i;
              }
            }
          }
        }
    }
   
    this._clusterTexture.update();
  }
}