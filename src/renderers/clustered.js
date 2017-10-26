import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../aabb'

export const MAX_LIGHTS_PER_CLUSTER = 100;

function clamp(num, min, max)
{
  let flooredNum = Math.floor(num);

  if(num < min) {
    return min;
  }
  else if(num > max) {
    return max;
  }
  else {
    return flooredNum;
  }
}

function printClusterBounds(minX, maxX, minY, maxY, minZ, maxZ)
{
  console.log("xMin: " + minX);
  console.log("xMax: " + maxX);
  // if(minX > maxX) {
  //   console.log("FUHX");
  // }

  console.log("yMin: " + minY);
  console.log("yMax: " + maxY);
  // if(minY > maxY) {
  //   console.log("FUHX");
  // }

  console.log("zMin: " + minZ);
  console.log("zMax: " + maxZ);
  // if(minZ > maxZ) {
  //   console.log("FUHX");
  // }

  console.log("--------------");
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateBuffer(lightIndex, minX, maxX, minY, maxY, minZ, maxZ)
  {
    let tooManyLights = false;
    for(let z = minZ; z <= maxZ; z++) {
      for(let y = minY; y <= maxY; y++) {
        for(let x = minX; x <= maxX; x++) {
          // ------------------cluster0-----------------cluster1---------------cluster2---------------(u)-
          // component0 |count|lid0|lid1|lid2 || count|lid0|lid1|lid2 || count|lid0|lid1|lid2
          // component1 |lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6
          // component2 |lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10
          // (v)

          // Cluster index (u)
          // ------------------cluster0-----------------cluster1---------------cluster2---------------(u)-
          let clusterIndex = x + (y * this._xSlices) + (z * this._xSlices * this._ySlices);
  
          // Index of where count lies in each cluster
          let numLightsIndex = this._clusterTexture.bufferIndex(clusterIndex, 0);

          // Get the number of lights
          let numLights = this._clusterTexture.buffer[numLightsIndex];
          // Increment light count since this light is in the cluster
          numLights++;
  
          // Safety check to make sure we don't exceed max lights
          if(numLights < MAX_LIGHTS_PER_CLUSTER) {
            // Update the light count in the texture buffer
            this._clusterTexture.buffer[numLightsIndex] = numLights;
            
            // Find the component (v)
            // component0 
            let component = Math.floor((numLights + 1) / 4);

            // Get the light id in the cluster (lid0, lid1, etc.)
            // |count|lid0|lid1|lid2
            let lightClusterID = (numLights + 1) % 4;
  
            // Update the pixel to include the current light index
            let texelIndex = this._clusterTexture.bufferIndex(clusterIndex, component);
            let componentIndex = (numLights + 1) - (component * 4);
            this._clusterTexture.buffer[texelIndex + componentIndex] = lightIndex;
          }
          else {
            tooManyLights = true;
            break;
          }
        } // End x loop
  
        if(tooManyLights) {
          break;
        }
      } // End y loop
      
      if(tooManyLights) {
        break;
      }
    } // End z loop
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

    // Convert fov from degrees to radians
    var fov = camera.fov * (Math.PI / 180);

    // Far plane components
    var screenHeight = 2 * Math.tan(fov / 2);
    var screenWidth = screenHeight * camera.aspect; 
    var nearZ = camera.near;
    var farZ = camera.far;    

    // Strides
    // var xStride = screenWidth / this._xSlices;
    // var yStride = screenHeight / this._ySlices;
    var zStride = (farZ - nearZ) / this._zSlices;

    // Loop through each light to find the cluster it lies in
    for(let i = 0; i < NUM_LIGHTS; i++) {
      let light = scene.lights[i];
      let lightRad = light.radius;
      // World space
      let lightPos = light.position;
      // Take lightPos to camera space
      vec3.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1;
            
      // Get AABB for light to make the search relatively easier
      let lightBB = new AABB(lightPos, lightRad);

      // x and y strides change based on the position of the light
      let xStride = lightPos[2] * screenWidth / this._xSlices;
      let yStride = lightPos[2] * screenHeight / this._ySlices;

      // Offset the min/max values by the slices since the clusters will be indexed [0, slices - 1]
      let minX = clamp((lightBB.min[0] + this._xSlices) / xStride, 0, this._xSlices - 1);
      let maxX = clamp((lightBB.max[0] + this._xSlices) / xStride, 0, this._xSlices - 1);

      let minY = clamp((lightBB.min[1] + this._ySlices) / yStride, 0, this._ySlices - 1);
      let maxY = clamp((lightBB.max[1] + this._ySlices) / yStride, 0, this._ySlices - 1);

      let minZ = clamp(lightBB.min[2] / zStride, 0, this._zSlices - 1);
      let maxZ = clamp(lightBB.max[2] / zStride, 0, this._zSlices- 1);
      
      printClusterBounds(minX, maxX, minY, maxY, minZ, maxZ);

      this.updateBuffer(i, minX, maxX, minY, maxY, minZ, maxZ);
    } // End light loop
    
    this._clusterTexture.update();
  }
}