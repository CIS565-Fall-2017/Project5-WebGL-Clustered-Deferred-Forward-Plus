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

  getContainingZPlane(posZ) {
    if (posZ > -5) {
      return 0;
    } else {
      let logPosZ = Math.log2(Math.abs(posZ) - 5.0);
      if (logPosZ < 0.0) return 1;
      return Math.floor(logPosZ) + 1.0;
    }
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

  clamp(a, b, c) {
    return Math.max(b, Math.min(c, a));
  }
  
  //Calculate the normalized frustrum space coordinates given a position
  getClusterUVD(options) {
    let absZ = Math.abs(options.position[2]);
    let radius = options.radius;

    let height = options.fovTan * absZ * 2;
    let pHeight = (options.position[1] + height / 2);

    let pv1 = (pHeight - radius) / height;
    let pv2 = (pHeight + radius) / height;

    let width = height * options.aspect;
    let pWidth = (options.position[0] + width / 2);

    let pu1 = (pWidth - radius) / width;
    let pu2 = (pWidth + radius) / width;

    let pd1 = ((absZ - radius) - options.near) / (options.far - options.near);
    let pd2 = ((absZ + radius) - options.near) / (options.far - options.near);

    return {
      x1 : pu1,
      y1 : pv1,
      z1 : pd1,
      x2 : pu2,
      y2 : pv2,
      z2 : pd2
    };

    //vec3.set(options.output, pu, pv, pd);
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    var fovTan = this.getTanDeg(camera.fov / 2);
    var minClusterUVDScratch = vec3.create();
    var maxClusterUVDScratch = vec3.create();
        

    //scratch variables for normals
    /*
    var origin = vec3.create();
    var z1OriginScratch = vec3.create();
    var z2OriginScratch = vec3.create();
    var x1NormalScratch = vec3.create();
    var x2NormalScratch = vec3.create();
    var y1NormalScratch = vec3.create();
    var y2NormalScratch = vec3.create();
    var zNormal = vec3.create();
    zNormal.z = 1;
    */
    var lightPositionScratch = vec3.create();

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    for (let l = 0; l < scene.lights.length; ++l) {
      let light = scene.lights[l];
      let radius = light.radius * 1.5;
      let outOfView = false;
      vec3.copy(lightPositionScratch, light.position);
      vec3.transformMat4(lightPositionScratch, lightPositionScratch, viewMatrix);

      let boundingBox = this.getClusterUVD({
        radius : radius,
        position : lightPositionScratch, 
        fovTan : fovTan, 
        aspect : camera.aspect, 
        near : camera.near, 
        far : camera.far
      });
      
      if (boundingBox.x1 > 0.999 && boundingBox.x2 > 0.999) {
        outOfView = true;
      } else if (boundingBox.y1 > 0.999 && boundingBox.y2 > 0.999) {
        outOfView = true;
      } else if (boundingBox.z1 > 0.999 && boundingBox.z2 > 0.999) {
        outOfView = true;
      } else if (boundingBox.x1 < 0 && boundingBox.x2 < 0) {
        outOfView = true;
      } else if (boundingBox.y1 < 0 && boundingBox.y2 < 0) {
        outOfView = true;
      } else if (boundingBox.z1 < 0 && boundingBox.z2 < 0) {
        outOfView = true;
      }

      if (!outOfView) {
        let pu1 = this.clamp(boundingBox.x1, 0, 0.999);
        let pu2 = this.clamp(boundingBox.x2, 0, 0.999);

        let minX = Math.floor(pu1 * this._xSlices);
        let maxX = Math.floor(pu2 * this._xSlices);

        let pv1 = this.clamp(boundingBox.y1, 0, 0.999);
        let pv2 = this.clamp(boundingBox.y2, 0, 0.999);
        
        let minY = Math.floor(pv1 * this._ySlices);
        let maxY = Math.floor(pv2 * this._ySlices);

        //Exponential zplanes
        let pd1 = this.clamp(boundingBox.z1, 0, 0.999);
        let pd2 = this.clamp(boundingBox.z2, 0, 0.999);

        pd1 = pd1 * pd1 * (3.0 - 2.0 * pd1);
        Math.pow(pd1, 0.25);

        pd2 = pd2 * pd2 * (3.0 - 2.0 * pd2);
        Math.pow(pd2, 0.25);

        let minZ = Math.floor(pd1 * this._zSlices);
        let maxZ = Math.floor(pd2 *  this._zSlices);
      
      
        // loop through bounding frustrum
          for (let cz = minZ; cz < maxZ + 1; ++cz) {
            for (let cy = minY; cy < maxY + 1; ++cy) {
              for (let cx = minX; cx < maxX + 1; ++cx) {
                let clusterId = cx + cy * this._xSlices + cz * this._xSlices * this._ySlices;
                let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)];
                ++numLights;
                let lidInBuffer = this._clusterTexture.bufferIndex(clusterId, Math.floor(numLights / 4));
                lidInBuffer += numLights % 4;
                this._clusterTexture.buffer[lidInBuffer] = l;
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)] = numLights;
              }
            }
          }
      }
    }

    this._clusterTexture.update();
  }
}