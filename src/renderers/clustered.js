import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function crossVertical (direction) {
  var outVec;
  vec3.normalize(outVec, vec3.fromValues(-direction[2], 0, direction[0]));
  return outVec;
}

function crossHorizontal (direction) {
  var outVec;
  vec3.normalize(outVec, vec3.fromValues(0, direction[2], -direction[1]));
  return outvec;
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
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

    // going to split x and y by NDC. Get the bottom left position of the frustum near plane
    let FOV = Math.abs(Math.tan(camera.fov * Math.PI / 180.0 / 2.0));
    // let corner = camera.near * vec3.fromValues(0, 0, 1) + 
    // (camera.aspect * camera.near * FOV * .fromValues(-1, 0, 0)) + 
    // (camera.near * FOV * vec3.fromValues(0, -1, 0));
    // let frustXStep = camera.near * camera.aspect * FOV * (2.0 / this.xSlices) * vec3(1, 0, 0);
    // let frustYStep = camera.near * FOV * (2.0 / this._ySlices) * vec3(0, 1, 0);
    // let frustZStep = (camera.far - camera.near) / this._zSlices;

    for (let l = 0; l < NUM_LIGHTS; l++) {
      // find the bounds of this light
      let origLPos = vec4.fromValues(scene.lights[l].position[0], 
        scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
      let radius = scene.lights[l].radius;
      var lPos = vec4.fromValues(0, 0, 0, 0);
      vec4.transformMat4(lPos, origLPos, this._viewMatrix);
      
      let vLength = Math.abs(FOV * lPos[2]);
      let hLength = Math.abs(camera.aspect * vLength);

      let vInterp = (lPos[1] - radius + vLength) / (vLength + vLength);
      let hInterp = (lPos[0] - radius + hLength) / (hLength + hLength);
      let dInterp = (-lPos[2] - radius - camera.near) / (camera.far - camera.near);

      

      //if (hInterp > 1 || vInterp > 1 || dInterp > 1) continue; //out of bounds minima

      dInterp = dInterp * dInterp * (3.0 - 2.0 * dInterp); // smoothstep
      dInterp = Math.pow(dInterp, 0.25); // more clusters towards camera

      let xMin = Math.floor(hInterp * this._xSlices);
      let yMin = Math.floor(vInterp * this._ySlices);
      let zMin = Math.floor(dInterp * this._zSlices);

      let vInterpMax = (lPos[1] + radius + vLength) / (vLength + vLength);
      let hInterpMax = (lPos[0] + radius + hLength) / (hLength + hLength);
      let dInterpMax = (-lPos[2] + radius - camera.near) / (camera.far - camera.near);

      // out of bounds maxima

      dInterpMax = dInterpMax * dInterpMax * (3.0 - 2.0 * dInterpMax); // smoothstep
      dInterpMax = Math.pow(dInterpMax, 0.25); // more clusters towards camera


      if (hInterpMax <= 0 && hInterp <= 0|| 
        vInterpMax <= 0 && vInterp <= 0 || 
        dInterpMax <= 0 && dInterp <= 0) continue; 
      if (hInterpMax >= 1 && hInterp >= 1|| 
        vInterpMax >= 1 && vInterp >= 1 || 
        dInterpMax >= 1 && dInterp >= 1) continue; 


      let xMax = Math.floor(hInterpMax * this._xSlices);
      let yMax = Math.floor(vInterpMax * this._ySlices);
      let zMax = Math.floor(dInterpMax * this._zSlices);

      xMin = Math.min(this._xSlices-1, Math.max(0, xMin));
      yMin = Math.min(this._ySlices-1, Math.max(0, yMin));
      zMin = Math.min(this._zSlices-1, Math.max(0, zMin));

      xMax = Math.min(this._xSlices-1, Math.max(0, xMax));
      yMax = Math.min(this._ySlices-1, Math.max(0, yMax));
      zMax = Math.min(this._zSlices-1, Math.max(0, zMax));

      // for (let z = 0; z < this._zSlices; z++) {
       // for (let y = 0; y < this._ySlices; y++) {
        //  for (let x = 0; x < this._xSlices; x++) {


      for (let z = zMin; z <= zMax; z++) {
        for (let y = yMin; y <= yMax; y++) {
          for (let x = xMin; x <= xMax; x++) {

            // add the light to this cluster if the cluster can handle it
            // get the current number of lights
            let cluster = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let clNumLiIdx = this._clusterTexture.bufferIndex(cluster, 0);
            let clNumLights = this._clusterTexture._buffer[clNumLiIdx];

            if (clNumLights < MAX_LIGHTS_PER_CLUSTER) {
              clNumLights++;
              this._clusterTexture._buffer[clNumLiIdx] = clNumLights;
              let texV = Math.floor(clNumLights / 4);
              let remainder = clNumLights - texV * 4;
              this._clusterTexture._buffer[this._clusterTexture.bufferIndex(cluster, texV) + remainder] = l;
            }    

            //console.log("BUCKET: " + x +", " + y + ", " + z + ", num lights:" + clNumLights);
          }
        }
      }
    }


    this._clusterTexture.update();
  }
}