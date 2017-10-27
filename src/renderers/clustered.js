import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

const DEBUG_SHADER = false;

function clamp(num, min, max)
{
  let flooredNum = Math.floor(num);

  if(flooredNum < min) {
    return min;
  }
  else if(flooredNum > max) {
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
    var fov = camera.fov * (Math.PI / 180.0);
    var screenHeight = 2.0 * Math.tan(fov / 2); 
    var screenWidth = camera.aspect * screenHeight;

    // Z logistics
    var near = camera.near;
    var far = camera.far;
    var depth = (far - near);
    var zStride = depth / this._zSlices;

    for(let i = 0; i < NUM_LIGHTS; i++) {
      let light = scene.lights[i];
      let lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      let lightRad = light.radius;

      // Take the lightPos from world to camera space
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1;

      // Get height and width based on the light's position
      let height = screenHeight * lightPos[2];
      let width = screenWidth * lightPos[2]; 

      // Strides
      let yStride = height / this._ySlices; 
      let xStride = width / this._xSlices;

      // Min and Max bounds for the cluster
      let minX, maxX;
      let minY, maxY;
      let minZ, maxZ;

      if(DEBUG_SHADER) {
        minX = 0;
        maxX = 14;

        minY = 0;
        maxY = 14;

        minZ = 0;
        maxZ = 14;
      }
      else {
        let lightMin = vec3.fromValues( lightPos[0] - lightRad,
                                        lightPos[1] - lightRad,
                                        lightPos[2] - lightRad);
        let lightMax = vec3.fromValues( lightPos[0] + lightRad,
                                        lightPos[1] + lightRad,
                                        lightPos[2] + lightRad);

        // Offset the min/max values by the slices since the clusters will be indexed [0, slices - 1]
        minX = clamp((lightMin[0]) / xStride, 0, this._xSlices - 1);
        maxX = clamp((lightMax[0]) / xStride, 0, this._xSlices - 1);

        minY = clamp((lightMin[1]) / yStride, 0, this._ySlices - 1);
        maxY = clamp((lightMax[1]) / yStride, 0, this._ySlices - 1);

        minZ = clamp(lightMin[2] / zStride, 0, this._zSlices - 1);
        maxZ = clamp(lightMax[2] / zStride, 0, this._zSlices- 1);

        // if( minX <= 0 && maxX >= this._xSlices - 1 ||
        //     minY <= 0 && maxY >= this._ySlices - 1 || 
        //     minZ <= 0 && maxZ >= this._zSlices - 1) {
        //   continue;
        // }
      }
      
      // Update the buffer 
      for(let z = minZ; z <= maxZ; z++) {
        for(let y = minY; y <= maxY; y++) {
          for(let x = minX; x <= maxX; x++) {
            // ------------------cluster0-----------------cluster1---------------cluster2---------------(u)-
            // component0 |count|lid0|lid1|lid2 || count|lid0|lid1|lid2 || count|lid0|lid1|lid2
            // component1 |lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6
            // component2 |lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10
            // (v)

            // Cluster Index (u)
            // ------------------cluster0-----------------cluster1---------------cluster2---------------(u)-
            let clusterIndex = x + (y * this._xSlices) + (z * this._xSlices * this._ySlices);

            // Index of where the count lies in each cluster
            let lightCountIndex = this._clusterTexture.bufferIndex(clusterIndex, 0);
            // Get the number of lights
            let lightCount = this._clusterTexture.buffer[lightCountIndex];
            // Increment the number of lights
            lightCount++;

            // Safety check to make sure we don't exceed the amount of lights allowed
            if(lightCount <= MAX_LIGHTS_PER_CLUSTER) {
              // Update the light count 
              this._clusterTexture.buffer[lightCountIndex] = lightCount;

              // Find the component (v)
              // component0
              let component = Math.floor((lightCount + 1) / 4);

              // Get the light id in the cluster (lid0, lid1, etc.)
              // |count|lid0|lid1|lid2
              let lightClusterID = (lightCount + 1) % 4;

              // Update the pixel to include the current light
              let texelIndex = this._clusterTexture.bufferIndex(clusterIndex, component);
              let componentIndex = (lightCount + 1) - (component * 4);
              this._clusterTexture.buffer[texelIndex + componentIndex] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}