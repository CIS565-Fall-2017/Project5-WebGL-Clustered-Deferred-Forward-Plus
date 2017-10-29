import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function getIndex(lightPos, min, max, numSlices) {
  let z = lightPos;
  let step = (max - min)/numSlices;
  if (z < min) {
    return -1;
  } else if (z > max) {
    return 15;
  } else {
    let bound = numSlices - 1;
    return Math.floor((z - min)/ step);
    //return (Math.max(Math.min(Math.floor((z - min)/ step), bound), 0 ) );
  }
  // return Math.floor((z - min)/ step);
}

// Unused attempt at getting z in NDC
function getZIndex(z, lPos, camera, viewmat, numSlices) {
  let min = camera.near;
  let max = camera.far;
  if (z < min) {
    return -1;
  } else if (z > max) {
    return 15;
  } else {
    let ndc = vec4.create();
    let pMat = mat4.create();
    mat4.copy(pMat, camera.projectionMatrix.elements);
    ndc[0] = lPos[0];
    ndc[1] = lPos[1];
    ndc[2] = lPos[2];
    ndc[3] = lPos[3];
    vec4.transformMat4(ndc, ndc, pMat);

    let ndcZ = (ndc[2]/ndc[3])/2;
    
    return(Math.floor(ndcZ * numSlices));
  }
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

    // For each light
    // 1. Get bounding indices for x, y z
    // 2. Add light to clusterTexture for indices between
    for (let l = 0; l < NUM_LIGHTS; l++) {
      let lightPos = vec4.create();
      lightPos[0] = scene.lights[l].position[0];
      lightPos[1] = scene.lights[l].position[1];
      lightPos[2] = scene.lights[l].position[2];
      lightPos[3] = 1;

      let r = scene.lights[l].radius;

      // Light position in camera space
      vec4.transformMat4(lightPos, lightPos, viewMatrix);

      let projection = camera.projectionMatrix;

      let posZ = -lightPos[2]; 
      let posY = lightPos[1]; 
      let posX = lightPos[0];
      
      // y = z * tan(FOV)
      // max yPosition at z plane of intersection
      let maxPosY = posZ * Math.tan(Math.PI/180 * camera.fov * 0.5);
      let minPosY = - maxPosY;

      let maxPosX = maxPosY* camera.aspect;
      let minPosX = -maxPosX; 

      let minX = getIndex(posX - r, minPosX, maxPosX, this._xSlices);
      let maxX = getIndex(posX + r, minPosX, maxPosX, this._xSlices);

      let minY = getIndex(posY - r, minPosY, maxPosY, this._ySlices);
      let maxY = getIndex(posY + r, minPosY, maxPosY, this._ySlices);

      let minZ = getIndex(posZ - r, camera.near, camera.far, this._zSlices);
      let maxZ = getIndex(posZ + r, camera.near, camera.far, this._zSlices);

      if (minX == 15 || minY == 15 || minZ == 15 
        || maxY == -1 || maxX == -1 || maxZ == -1) {
          continue;
        }
      // if (minX > this._xSlices - 1 || minY > this._ySlices - 1 || minZ > this._zSlices - 1 
      //   || maxY < 0 || maxX < 0 || maxZ < 0) {
      //     continue;
      //   }

      minX = Math.max(minX, 0);
      maxX = Math.min(maxX, this._xSlices - 1);
      minY = Math.max(minY, 0);
      maxY = Math.min(maxY, this._ySlices - 1);
      minZ = Math.max(minZ, 0);
      maxZ = Math.min(maxZ, this._zSlices - 1);

      for (let p = minZ; p <= maxZ; ++p) {
        for (let q = minY; q <= maxY; ++q) {
          for (let r = minX; r <= maxX; ++r) {
            let idx = r + q * this._xSlices + p * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];
            lightCount++;            
            if (lightCount <= MAX_LIGHTS_PER_CLUSTER) {
              let pixelNum = Math.floor(lightCount / 4.0);
              let pixelIdx = lightCount % 4;
              let clusterIdx = this._clusterTexture.bufferIndex(idx, pixelNum) + pixelIdx;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = lightCount;
              this._clusterTexture.buffer[clusterIdx] = l;
            }
          }
        }
      }
      
    }

    this._clusterTexture.update();
  }



}