import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100; //for conservation sake; theoretically possible to overcome

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each row is a cluster, each column stores 4 light indices (1st column stores numlights and 3 indices)
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, (MAX_LIGHTS_PER_CLUSTER + 1 / 4) + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    /* TEST FOR LOGARITHMIC Z- PARTITION
    for (let i = 0; i < 500; i+= 2.0) {
        let z = this.scaleLogarithmically(i*10, 499.8, 0.1)
        console.log ("Dist: " + i + "    zCluster: " + Math.floor(z * 14.99));
    }*/

  }

  /*
  scaleLogarithmically(z, range, min) {
    let a = Math.min(Math.max(0,z-min),range);
    a = 0.9 * (a/range) + 0.1;
    return Math.log10(a) + 1;
  }
  */

  updateClusters(camera, viewMatrix, scene) {

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

    //this will be the same no matter where the light is 
    var range = camera.far - camera.near;
    var fovScalar = Math.tan(camera.fov * (Math.PI/360.0));

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
      //let closeZ = this.scaleLogarithmically(15 * (pos[2] - LIGHT_RADIUS), range, camera.near);
      //let farZ = this.scaleLogarithmically(15 * (pos[2] + LIGHT_RADIUS), range, camera.near);
      let closeZ = 50 * (pos[2] - LIGHT_RADIUS) / camera.far;
      let farZ = 50 * (pos[2] + LIGHT_RADIUS) / camera.far;
      if (closeZ > 0.999 || farZ < 0) continue; //check boundaries

      //now we can convert the to indices
      closeZ = Math.max(0,Math.floor(closeZ*this._zSlices));
      farZ = Math.min(this._zSlices-1, Math.floor(farZ*this._zSlices));

//Y-CLUSTERS
      let halfFrustumHeight = pos[2] * fovScalar;

      //as fraction of frustum
      let topY = (pos[1] + LIGHT_RADIUS + halfFrustumHeight) / (2 * halfFrustumHeight);
      let bottomY = (pos[1] - LIGHT_RADIUS + halfFrustumHeight) / (2 * halfFrustumHeight);
      if (bottomY > 0.999 || topY < 0) continue; //check boundaries

      //to indices
      topY = Math.min(this._ySlices-1,Math.floor(topY*this._ySlices));
      bottomY = Math.max(0,Math.floor(bottomY*this._ySlices));

//X-CLUSTERS
      let halfFrustumWidth = camera.aspect * halfFrustumHeight;

      //as fraction of frustum
      let leftX = (pos[0] - LIGHT_RADIUS + halfFrustumWidth) / (2 * halfFrustumWidth);
      let rightX = (pos[0] + LIGHT_RADIUS + halfFrustumWidth) / (2 * halfFrustumWidth);
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
              let column = Math.floor((currentLightCount)/4);

              //determine remainder... fourth light has remainder 0, 9 has remainder 1
              let vec4Subscript = (currentLightCount) - column*4;

              // Update the light index for the particular cluster in the light buffer
              let pixelIndex = this._clusterTexture.bufferIndex(row, column);
              this._clusterTexture.buffer[pixelIndex + vec4Subscript] = i;
          }
        }
      }
    }
  }

  this._clusterTexture.update();
  }
}