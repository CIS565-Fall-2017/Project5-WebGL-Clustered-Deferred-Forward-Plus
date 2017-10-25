import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../aabb'

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

    // http://www.lighthouse3d.com/tutorials/view-frustum-culling/view-frustums-shape/
    var fov     = camera.fov * (Math.PI / 180);
    var height  = 2 * Math.tan(fov / 2);
    var width   = camera.aspect * height;
    var farZ    = camera.far;
    var nearZ   = camera.near; 

    var farHeight = farZ * height;
    var farWidth = farZ * width;
    var farHeightHalf = farHeight / 2;
    var farWidthHalf = farWidth / 2;

    // Get strides
    var xStride = farWidth / this._xSlices;
    var yStride = farHeight / this._ySlices;
    var zStride = (farZ - nearZ) / this._zSlices;

    var minX = 0;
    var minY = 0;
    var minZ = 0;
    var maxX = this._xSlices - 1;
    var maxY = this._ySlices - 1;
    var maxZ = this._zSlices - 1;

    // Loop through lights and determine which cluster it lies in
    for(let i = 0; i < NUM_LIGHTS; i++) {
      // Light position is in world space
      let lightPos = scene.lights[i].position;
      // Take the light and bring it into camera space
      vec3.transformMat4(lightPos, lightPos, viewMatrix);

      // Get the bounding box for the light
      let lightBB = new AABB(lightPos, scene.lights[i].radius);

      // Loop through the YZ plane to find the minX value
      for(let xSlice = 0; xSlice < this._xSlices; xSlice++) {
        let x = (xSlice * xStride) - farWidthHalf;
        let y = -farHeightHalf;
        let z = farZ;

        let v1 = vec3.fromValues(x, y, z);
        // console.log("Slice " + xSlice + ": " + v1);
        let v2 = vec3.fromValues(x, -y, z);

        // Since we have two vectors towards the far plane,
        // we can use that to find the normal.
        // https://www.3dgep.com/forward-plus/
        let n = vec3.create();
        vec3.cross(n, v2, v1);
        vec3.normalize(n, n);

        // Get signed distance from the light to the plane
        let d = vec3.dot(lightBB.min, n);
        // console.log("d: " + d);       
        
        // Light is on the right side of the plane
        if(d > 0) {
          minX = xSlice;
          break; 
        }
      }

      // Loop through the YZ plane to find the maxX value
      for(let xSlice = this._xSlices - 1; xSlice >= 0; xSlice--) {
        let x = (xSlice * xStride) - farWidthHalf;
        let y = -farHeightHalf;
        let z = farZ;

        let v1 = vec3.fromValues(x, y, z);
        // console.log("Slice " + xSlice + ": " + v1);
        let v2 = vec3.fromValues(x, -y, z);

        // Since we have two vectors towards the far plane,
        // we can use that to find the normal.
        // https://www.3dgep.com/forward-plus/
        let n = vec3.create();
        vec3.cross(n, v2, v1);
        vec3.normalize(n, n);

        // Get signed distance from the light to the plane
        let d = vec3.dot(lightBB.max, n);
        // console.log("d: " + d);       
        
        // Light is on the right side of the plane
        if(d < 0) {
          maxX = xSlice;
          break; 
        }
      }

      if(minX > maxX) {
        let tmp = maxX;
        maxX = minX;
        minX = tmp;
      }

      // Loop through the XZ plane to find the minY value
      for(let ySlice = 0; ySlice < this._ySlices; ySlice++) {
        let x = -farWidthHalf;
        let y = (ySlice * yStride) - farHeightHalf;
        let z = farZ;

        let v1 = vec3.fromValues(x, y, z);
        // console.log("Slice " + xSlice + ": " + v1);
        let v2 = vec3.fromValues(-x, y, z);

        // Since we have two vectors towards the far plane,
        // we can use that to find the normal.
        // https://www.3dgep.com/forward-plus/
        let n = vec3.create();
        vec3.cross(n, v2, v1);
        vec3.normalize(n, n);

        // Get signed distance from the light to the plane
        let d = vec3.dot(lightBB.min, n);
        // console.log("d: " + d);       
        
        // Light is `above the plane
        if(d > 0) {
          minY = ySlice;
          break; 
        }
      }

      // Loop through the YZ plane to find the maxY value
      for(let ySlice = this._ySlices - 1; ySlice >= 0; ySlice--) {
        let x = -farWidthHalf;
        let y = (ySlice * yStride) - farHeightHalf;
        let z = farZ;

        let v1 = vec3.fromValues(x, y, z);
        // console.log("Slice " + xSlice + ": " + v1);
        let v2 = vec3.fromValues(-x, y, z);

        // Since we have two vectors towards the far plane,
        // we can use that to find the normal.
        // https://www.3dgep.com/forward-plus/
        let n = vec3.create();
        vec3.cross(n, v2, v1);
        vec3.normalize(n, n);

        // Get signed distance from the light to the plane
        let d = vec3.dot(lightBB.max, n);
        // console.log("d: " + d);       
        
        // Light is below the plane
        if(d < 0) {
          maxY = ySlice;
          break; 
        }
      }

      if(minY > maxY) {
        let tmp = maxY;
        maxY = minY;
        minY = tmp;
      }

      for(let zSlice = 0; zSlice < this._zSlices; zSlice++) {
        let z = (zSlice * zStride) + nearZ;

        let d = lightBB.min[2] - z;

        if(d > 0) {
          minZ = zSlice;
          break;
        }
      }

      for(let zSlice = 0; zSlice < this._zSlices; zSlice++) {
        let z = (zSlice * zStride) + nearZ;

        let d = lightBB.min[2] - z;

        if(d < 0) {
          maxZ = zSlice;
          break;
        }
      }

      if(minZ > maxZ) {
        let tmp = maxZ;
        maxZ = minZ;
        minY = tmp;
      }

      // minZ = lightBB.min[2] / zStride;
      // maxZ = lightBB.max[2] / zStride;

      console.log("minX: " + minX);
      console.log("maxX: " + maxX);
      console.log("minY: " + minY);
      console.log("maxY: " + maxY);
      console.log("minZ: " + minZ);
      console.log("maxZ: " + maxZ);
      console.log("-----------------");

      for(let z = minZ; z < maxZ; z++) {
        for(let y = minY; y < maxY; y++) {
          for(let x = minX; x < maxX; x++) {
            let index = x + (y * this._xSlices) + (z * this._xSlices * this._ySlices);

            //TODO
          }
        }
      }
    } // End light loop
    
    

    this._clusterTexture.update();
  }
}