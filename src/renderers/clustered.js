import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = Math.max(50, NUM_LIGHTS/3); //for conservation sake; theoretically possible to overcome
export const USE_DYNAMIC = true;
export const USE_LOGARITHMIC = false;
export const LOG_OFFSET = USE_LOGARITHMIC ? 25.0 : 0.0;
export const RANGE_SCALE = 0.02;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices, camera) {
    // Create a texture to store cluster data. Each row is a cluster, each column stores 4 light indices (1st column stores numlights and 3 indices)
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, (MAX_LIGHTS_PER_CLUSTER + 1 / 4) + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._farLight = 2000;
    this._nextFarLight = 20;

    this._isRendering = true;
    this.invRange = USE_LOGARITHMIC ?  (1 / Math.log(camera.far - camera.near + 1)) : 1 / (camera.far - camera.near);
    this.fovScalar = Math.tan(camera.fov * (Math.PI/360.0));
    this.min = camera.near;
  }

  
  scaleLogarithmically(z) {
    if (z < 0) return -1;
    return Math.log(z-this.min+1) * this.invRange;
  }
  

  updateClusters(camera, viewMatrix, scene) {

    this._farLight = this._nextFarLight;
    this._nextFarLight = 0.0;
    let invDist = USE_DYNAMIC ? (camera.far / this._farLight) : 1/RANGE_SCALE;

    //clear light counts
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    //for each light
    //determine which boxes it falls into
    //minimize false positives based on slides
    //count++ and add light index to each cluster
    for (let i = 0; i < NUM_LIGHTS; i++) {

      let currentLight = scene.lights[i];

      //get the position of the light in camera space
      let pos = vec4.fromValues(currentLight.position[0],
                                currentLight.position[1],
                                currentLight.position[2],
                                1.0);
      vec4.transformMat4(pos,pos,viewMatrix);
      pos[2] = -pos[2]; //for sanity

//Z-CLUSTERS
      //get the log-scaled z values of the sphere intercepts (I multiplied by 10 for this confined scene)
      let closeZ = 0.0;
      let farZ = 0.0;
      if (USE_LOGARITHMIC) {
        closeZ = this.scaleLogarithmically(invDist * (pos[2] - LIGHT_RADIUS));
        farZ = this.scaleLogarithmically(invDist * (pos[2] + LIGHT_RADIUS)); 

      } else {
        closeZ = invDist * (pos[2] - LIGHT_RADIUS) * this.invRange;
        farZ = invDist * (pos[2] + LIGHT_RADIUS) * this.invRange;
      }
      if (farZ < 0) continue; //check boundaries

      //now we can convert the to indices
      closeZ =  Math.max(0,Math.min(this._zSlices-1, Math.floor(closeZ*(this._zSlices+LOG_OFFSET) - LOG_OFFSET)));
      farZ =    Math.max(0,Math.min(this._zSlices-1, Math.floor(farZ  *(this._zSlices+LOG_OFFSET) - LOG_OFFSET)));
      //console.log(closeZ+" "+farZ);

//Y-CLUSTERS
      let halfFrustumHeight = Math.abs(pos[2]) * this.fovScalar;

      //as fraction of frustum
      let invH = 1 / (2 * halfFrustumHeight);
      let topY = (pos[1] + LIGHT_RADIUS + halfFrustumHeight) * invH;
      let bottomY = (pos[1] - LIGHT_RADIUS + halfFrustumHeight) * invH;
      if (bottomY > 0.999 || topY < 0) continue; //check boundaries

      //to indices
      topY = Math.min(this._ySlices-1,Math.floor(topY*this._ySlices));
      bottomY = Math.max(0,Math.floor(bottomY*this._ySlices));

//X-CLUSTERS
      let halfFrustumWidth = camera.aspect * halfFrustumHeight;

      //as fraction of frustum
      let invW = 1 / (2 * halfFrustumWidth);
      let leftX = (pos[0] - LIGHT_RADIUS + halfFrustumWidth) * invW;
      let rightX = (pos[0] + LIGHT_RADIUS + halfFrustumWidth) * invW;
      if (leftX > 0.999 || rightX < 0) continue; //check boundaries

      //to indices
      leftX = Math.max(0, Math.floor(leftX * this._xSlices));
      rightX = Math.min(this._xSlices-1,Math.floor(rightX * this._xSlices));

      //console.log("X: " + leftX + " -> " + rightX);
      //console.log("Y: " + bottomY + " -> " + topY);
      //console.log("Z: " + closeZ + " -> " + farZ + "\n");
      
      //add the light to every member of its bounding box (corners will be wasted as it stands)
      for (let x = leftX; x <= rightX; x++) {
        for (let y = bottomY; y <= topY; y++) {
          for (let z = closeZ; z <= farZ; z++) {
            //increment count
            let row = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            //get the 1D index from the 2D coordinates
            let numLightsIndex = this._clusterTexture.bufferIndex(row, 0);
            //access the raw data directly
            let currentLightCount = this._clusterTexture.buffer[numLightsIndex];

            if(currentLightCount < MAX_LIGHTS_PER_CLUSTER)
            {
              /*
              if (x > 14 || x < 0 || y > 14 || y < 0 || z > 14 || z < 0) {
                console.log("Error: Light Classified Outside Boundaries");
                this._clusterTexture.update();
                continue;
              }*/

              //increment count
              this._clusterTexture.buffer[numLightsIndex] = ++currentLightCount;

              //determine the proper 2D coordinate of the light to place --- at the fourth light, we move on to pixel (index,2)
              let column = Math.floor((currentLightCount) * 0.25);

              //determine remainder... fourth light has remainder 0, 9 has remainder 1
              let vec4Subscript = (currentLightCount) - column*4;

              // Update the light index for the particular cluster in the light buffer
              let pixelIndex = this._clusterTexture.bufferIndex(row, column);
              this._clusterTexture.buffer[pixelIndex + vec4Subscript] = i;
          }
        }
      }
    }

    if (pos[2] > this._nextFarLight) this._nextFarLight = pos[2];
  }

  this._clusterTexture.update();
  }
}