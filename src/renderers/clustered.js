import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 2500;

// Returns distance between light and X plane
function distanceToXPlane(lightPos, width)
{
  var x = lightPos[0];
  var z = lightPos[2];
  return (x - width * z) / Math.sqrt(width * width + 1.0);
}

// Returns distance between light and Y plane
function distanceToYPlane(lightPos, height)
{
  var y = lightPos[1];
  var z = lightPos[2];
  return (y - height * z) / Math.sqrt(height * height + 1.0);
}

function distanceToZPlane(z, slices, camera)
{
  if (z <= 1) {
    return camera.near;
  }
  else
  {
    var n = (parseFloat(z) - 1.0) / (parseFloat(slices) - 1.0);
    return Math.exp(n * Math.log(camera.far - camera.near + 1.0)) + camera.near - 1.0;
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

  updateClusters(camera, viewMatrix, scene)
  {
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
    
    var halfY = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    var yStride = (2.0 * halfY) / parseFloat(this._ySlices);
    var halfX = camera.aspect * halfY;
    var xStride = (2.0 * halfX) / parseFloat(this._xSlices);

    var lightPos = vec4.create();

    // Loop through each light
    for(let lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++)
    {
      lightPos[0] = scene.lights[lightIndex].position[0];
      lightPos[1] = scene.lights[lightIndex].position[1];
      lightPos[2] = scene.lights[lightIndex].position[2];
      lightPos[3] = 1.0;

      // Transform light position from world space to view space
      vec4.transformMat4(lightPos, lightPos, viewMatrix);

      // Make sure z is positive
      lightPos[2] *= -1.0;
      
      let lightRadius = scene.lights[lightIndex].radius;
      let minX; let minY; let minZ;
      let maxX; let maxY; let maxZ;

      // AABB
      for(minX = 0; minX <= this._xSlices; minX++)
      {
        let dist = distanceToXPlane(lightPos, xStride * (minX + 1 - this._xSlices * 0.5));
        if(dist <=  lightRadius)
        {
          break;
        }
      }
      for(maxX = this._xSlices; maxX >= minX; maxX--)
      {
        let dist = distanceToXPlane(lightPos, xStride * (maxX - 1 - this._xSlices * 0.5))
        if(-dist <= lightRadius)
        {
          maxX--;
          break;
        }
      }
      
      for(minY = 0; minY <= this._ySlices; minY++)
      {
        let dist = distanceToYPlane(lightPos, yStride * (minY + 1 - this._ySlices * 0.5));
        if(dist <=  lightRadius)
        {
          break;
        }
      }
      for(maxY = this._ySlices; maxY >= minY; maxY--)
      {
        let dist = distanceToYPlane(lightPos, yStride * (maxY - 1 - this._ySlices * 0.5));
        if(-dist <=  lightRadius)
        {
          maxY--;
          break;
        }
      }
      
      for(minZ = 0; minZ <= this._zSlices; minZ++)
      {
        let zView = distanceToZPlane(minZ + 1, this._zSlices, camera);
        if(zView > (lightPos[2] - lightRadius))
        {
          break;
        }
      }
      for(maxZ = this._zSlices; maxZ >= minZ; maxZ--)
      {
        let zView = distanceToZPlane(maxZ - 1, this._zSlices, camera);
        if(zView <= (lightPos[2] + lightRadius))
        {
          maxZ += 2;
          break;
        }
      }
      
      // Add light indices to corresponding clusters and update light count
      for(let x = minX; x <= maxX; x++) {
        for(let y = minY; y <= maxY; y++) {
          for(let z = minZ; z <= maxZ; z++) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let countIndex = this._clusterTexture.bufferIndex(i, 0);
            let lightCount = this._clusterTexture.buffer[countIndex] + 1;

            if (lightCount < MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[countIndex] = lightCount;
              let texel = Math.floor(lightCount / 4.0);
              let r = lightCount - texel * 4.0;
              let texelIndex = this._clusterTexture.bufferIndex(i, texel);
              this._clusterTexture.buffer[r + texelIndex] = lightIndex;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}