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

    // Idea 1: Inefficient, easier to implement but time consuming
    // We can loop over all the slusters and then for each cluster we can loop over all the lights
    // checking if the light belongs inside that cluster and uodate the cluster value based on that.

    // Idea 2: More efficient and maybe faster... not sure
    // We can first loop through each light and for each light find the min and the max dimensions 
    // i.e. Clusters that it might overlapp with (potentially). Then loop thorugh the minified cluster size and
    // check for each cluster inside that smaller cluster search space if they contain the light or not.

    let convertDegreeToRadians = Math.PI / 180.0;

    // Get the dimension of the z axis
    let zFullWidth = (camera.far - camera.near); // Independent of the frustrum position

    // Get the slice offset (width) of each segments
    let zPerFragmentWidth = zFullWidth / this._zSlices;

    // Looping though each light and then for each light we cul the framnegts that are intesrecting
    // to have only those fragments that contain the light.
    // Finally when we are inside the culled search space of the fragmnets we update the light conntained inside the fragment.

    for(let i = 0; i < NUM_LIGHTS; ++i) {
      // Light position and radius
      let lightRadius = scene.lights[i].radius;
      let lightPos = vec4.fromValues(scene.lights[i].position[0], 
                                          scene.lights[i].position[1], 
                                          scene.lights[i].position[2], 1.0);
      lightPos = vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0; // Cam looks in -z flip it to make the z positive                                  
      
      // Bounding box variables for reducing the search space of the frustrum
      let xMinIndex, xMaxIndex;
      let yMinIndex, yMaxIndex;
      let zMinIndex, zMaxIndex;

      // Get the dimension of the y axis
      let yHalfWidth = Math.tan((camera.fov / 2.0) * convertDegreeToRadians) * lightPos[2];
      let yFullWidth = yHalfWidth * 2.0;

      // Get the dimension of the x axis
      let xHalfWidth = yHalfWidth *  camera.aspect;
      let xFullWidth = xHalfWidth * 2.0;

      // Get the slice offset (width) of each segments
      let xPerFragmentWidth = xFullWidth / this._xSlices;
      let yPerFragmentWidth = yFullWidth / this._ySlices;

      // X Min and Max Index position
      let xlightViewPosWRTxPlane = lightPos[0] + xHalfWidth;
      let xlightViewPosWRTxPlaneRadiusLeftOffset = xlightViewPosWRTxPlane - lightRadius;
      let xlightViewPosWRTxPlaneRadiusRightOffset = xlightViewPosWRTxPlane + lightRadius;
      xMinIndex = Math.floor(xlightViewPosWRTxPlaneRadiusLeftOffset / xPerFragmentWidth) - 1; // I don't know why I have to subtract one here but it solved a bug which made the final image have a stripe on the left
      xMaxIndex = Math.floor(xlightViewPosWRTxPlaneRadiusRightOffset / xPerFragmentWidth) + 1;
      if(xMinIndex > this._xSlices-1 || xMaxIndex < 0) { 
        continue; 
      }
      xMinIndex = Math.max(0, xMinIndex);
      xMaxIndex = Math.min(this._xSlices, xMaxIndex);

      // Y Min and Max Index position
      let ylightViewPosWRTyPlane = lightPos[1] + yHalfWidth;
      let ylightViewPosWRTyPlaneRadiusLeftOffset = ylightViewPosWRTyPlane - lightRadius;
      let ylightViewPosWRTyPlaneRadiusRightOffset = ylightViewPosWRTyPlane + lightRadius;
      yMinIndex = Math.floor(ylightViewPosWRTyPlaneRadiusLeftOffset / yPerFragmentWidth) - 1;
      yMaxIndex = Math.floor(ylightViewPosWRTyPlaneRadiusRightOffset / yPerFragmentWidth) + 1;
      if(yMinIndex > this._ySlices-1 || yMaxIndex < 0) { 
        continue; 
      }
      yMinIndex = Math.max(0, yMinIndex);
      yMaxIndex = Math.min(this._ySlices, yMaxIndex);

      // Z Min and Max Index position
      let zlightViewPosWRTzPlane = lightPos[2] - camera.near;
      let zlightViewPosWRTzPlaneRadiusLeftOffset = zlightViewPosWRTzPlane - lightRadius;
      let zlightViewPosWRTzPlaneRadiusRightOffset = zlightViewPosWRTzPlane + lightRadius;
      zMinIndex = Math.floor(zlightViewPosWRTzPlaneRadiusLeftOffset / zPerFragmentWidth);
      zMaxIndex = Math.floor(zlightViewPosWRTzPlaneRadiusRightOffset / zPerFragmentWidth) + 1;
      if(zMinIndex > this._zSlices-1 || zMaxIndex < 0) { 
        continue; 
      }
      zMinIndex = Math.max(0, zMinIndex);
      zMaxIndex = Math.min(this._zSlices, zMaxIndex);
      
      // debugger;
      // console.log("min X: " + xMinIndex);
      // console.log("max X: " + xMaxIndex);

      for(let x = xMinIndex; x < xMaxIndex; ++x) {
        for(let y = yMinIndex; y < yMaxIndex; ++y) {
          for(let z = zMinIndex; z < zMaxIndex; ++z) {
            let indexOfFragment = x + y*this._xSlices + z*this._xSlices*this._ySlices;
            let indexOfLightsPerFragmnet = this._clusterTexture.bufferIndex(indexOfFragment, 0);
            let numberOfLights = this._clusterTexture.buffer[indexOfLightsPerFragmnet];
            numberOfLights++;

            if(numberOfLights <= MAX_LIGHTS_PER_CLUSTER) {
                this._clusterTexture.buffer[indexOfLightsPerFragmnet] = numberOfLights;
                let lightTexel = Math.floor(numberOfLights * 0.25);
                let texelIdx = this._clusterTexture.bufferIndex(indexOfFragment, lightTexel);
                let offset = numberOfLights - lightTexel * 4;
                this._clusterTexture.buffer[texelIdx + offset] = i;
            }
          }
        }
      }
    
    }

    this._clusterTexture.update();
  }
}