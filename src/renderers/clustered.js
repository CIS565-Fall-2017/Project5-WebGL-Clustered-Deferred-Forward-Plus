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

  //Helper function to convert degrees to radians
  getTanDeg(deg) {
    var rad = deg * Math.PI/180;
    return Math.tan(rad);

  }
  /*
  Options parameter includes: 
  stride : distance between clusters
  strideMultiple : how many strides to take for the given plane
  axis : which axis of cluster we are using
  output : output vec3
  */
  calculatePlaneNormal(options) {
    if (options.axis === 'horizontal') {
      let d = options.stride * options.strideMultiple;
      let x = 1 / Math.sqrt(1 + d * d);
      let z = d / Math.sqrt(1 + d * d);
      options.output.x = x;
      options.output.y = 0;
      options.output.z = z;
    } else {
      let d = options.stride * options.strideMultiple;
      let y = 1 / Math.sqrt(1 + d * d);
      let z = d / Math.sqrt(1 + d * d);
      options.output.x = 0;
      options.output.y = y;
      options.output.z = z;
    }
  }

  //Take in light position in view space FOR
  intersectsPlane(planeNormal, planeOrigin, position, radius) {
    let relativePosition = vec3.create();
    vec3.subtract(relativePosition, position, planeOrigin);
    return radius > Math.abs(vec3.dot(planeNormal, relativePosition));
  }



  //scratch variables to prevent recreating vectors every scene
  

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    var tanTheta = this.getTanDeg(camera.fov / 2);
    var vDimension = tanTheta;
    var hDimension = vDimension * camera.aspect;
    var clusterWidth = hDimension / this._xSlices;
    var clusterHeight = vDimension / this._ySlices;
        

    //scratch variables for normals
    var origin = vec3.create();
    var z1OriginScratch = vec3.create();
    var z2OriginScratch = vec3.create();
    var x1NormalScratch = vec3.create();
    var x2NormalScratch = vec3.create();
    var y1NormalScratch = vec3.create();
    var y2NormalScratch = vec3.create();
    var zNormal = vec3.create();
    zNormal.z = 1;
    var lightPositionScratch = vec3.create();

    for (let z = 0; z < this._zSlices; ++z) {
      z1OriginScratch.z = 5 + z * ((camera.far - camera.near) / this._zSlices); 
      z2OriginScratch.z = 5 + (z + 1) * ((camera.far - camera.near) / this._zSlices); 
      for (let y = 0; y < this._ySlices; ++y) {
        this.calculatePlaneNormal({
          stride : clusterHeight,
          strideMultiple : y - this._ySlices / 2,
          axis : 'vertical',
          output : y1NormalScratch,
        });
        this.calculatePlaneNormal({
          stride : clusterHeight,
          strideMultiple : (y - this._ySlices / 2) + 1,
          axis : 'vertical',
          output : y2NormalScratch,
        });
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          //Calculate normals for planes
          this.calculatePlaneNormal({
            stride : clusterWidth,
            strideMultiple : x - this._xSlices / 2,
            axis : 'horizontal',
            output : x1NormalScratch,
          });
          this.calculatePlaneNormal({
            stride : clusterWidth,
            strideMultiple : (x - this._xSlices / 2) + 1,
            axis : 'horizontal',
            output : x2NormalScratch,
          });

          // //Loop through lights
          let numLights = 0;
          for (let l = 0; l < scene.lights.length; ++l) {
            let light = scene.lights[l];
            vec3.copy(lightPositionScratch, light.position)
            vec3.transformMat4(lightPositionScratch, lightPositionScratch, viewMatrix);
            if ((this.intersectsPlane(x1NormalScratch, origin, lightPositionScratch) || 
                 this.intersectsPlane(x2NormalScratch, origin, lightPositionScratch))
                && (this.intersectsPlane(y1NormalScratch, origin, lightPositionScratch) || 
                    this.intersectsPlane(y2NormalScratch, origin, lightPositionScratch)) 
                && (this.intersectsPlane(zNormal, z1OriginScratch, lightPositionScratch) || 
                    this.intersectsPlane(zNormal, z2OriginScratch, lightPositionScratch))) {
                  //This could be optimized with better frustrum culling by Austin Eng
                  ++numLights;
                  this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLights;
                  this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, numLights)] = l;
                  
                }
          }
          // // loop through lights
          // convert light to view space - helper function
          // perform intersection test - helper function
          // if intersect with multiple planes, update light count

          

        }
      }
    }

    this._clusterTexture.update();
  }
}