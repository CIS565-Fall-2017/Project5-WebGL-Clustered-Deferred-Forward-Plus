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

  // returns the index as vec3
  getPointClusterIndex(point, viewProjectionMatrix) {
    var wsPos = vec4.create();
    wsPos[0] = point[0];
    wsPos[1] = point[1];
    wsPos[2] = point[2];
    wsPos[3] = 1.0;

    var ndcPos = vec4.create();

    // ndcPos = mul(viewProj, vec4(wsPos, 1.0));
    vec4.transformMat4(ndcPos, wsPos, viewProjectionMatrix);

    // Convert to actual ndc, [0,1]
    var w = ndcPos[3];
    var x = (ndcPos[0] / w) * .5 + .5;
    var y = (ndcPos[1] / w) * .5 + .5;
    var z = ndcPos[2] / w;

    if(w < 1.0 / this._zSlices)
    {
      x = 0;
      y = 0;
      z = 0;
    }
    else
    {
      // Get cluster indices
      x = x * this._xSlices;
      y = y * this._ySlices;
      z = z * this._zSlices;
    }

    return vec3.fromValues(x,y,z);
  }

  updateClusters(camera, viewProjectionMatrix, scene) {
    // Reset the cluster texture
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var aabbVectors = [];
    aabbVectors.push(vec3.fromValues(1, 1, 1));
    aabbVectors.push(vec3.fromValues(1, -1, -1));
    aabbVectors.push(vec3.fromValues(1, 1, -1));
    aabbVectors.push(vec3.fromValues(1, -1, 1));

    aabbVectors.push(vec3.fromValues(-1, 1, 1));
    aabbVectors.push(vec3.fromValues(-1, -1, -1));
    aabbVectors.push(vec3.fromValues(-1, 1, -1));
    aabbVectors.push(vec3.fromValues(-1, -1, 1));

    var minBound = vec3.fromValues(0, 0, 0);
    var maxBound = vec3.fromValues(this._xSlices - 1, this._ySlices - 1, this._zSlices - 1);

    var viewMatrix = mat4.create();
    mat4.invert(viewMatrix, camera.matrixWorld.elements);

    for(let l = 0; l < scene.lights.length; ++l) 
    {
      var lightIndex = l;
      var light = scene.lights[l];
      var wsLightPos = vec3.fromValues(light.position[0], light.position[1], light.position[2]);
      var radius = light.radius;

      var minIndex = vec3.clone(maxBound);
      var maxIndex = vec3.clone(minBound);

      var scaledAABB = vec3.create();
      for(let v = 0; v < aabbVectors.length; v++)
      {
          var pos = vec3.create();
          vec3.scale(scaledAABB, aabbVectors[v], radius);
          vec3.add(pos, wsLightPos, scaledAABB);

          var pointIndex = this.getPointClusterIndex(pos, viewProjectionMatrix);

          vec3.min(minIndex, minIndex, pointIndex);
          vec3.max(maxIndex, maxIndex, pointIndex);
      }

      // If the aabb is out of the frustum, ignore the light
      if((maxIndex[0] < 0 || maxIndex[1] < 0 || maxIndex[2] < 0)
        || (minIndex[0] >= this._xSlices || minIndex[1] >= this._ySlices || minIndex[2] >= this._zSlices))
        continue;

      // Clamp min indices
      vec3.min(minIndex, minIndex, maxBound);
      vec3.max(minIndex, minIndex, minBound);
      vec3.floor(minIndex, minIndex);

      // Clamp max indices
      vec3.min(maxIndex, maxIndex, maxBound);
      vec3.max(maxIndex, maxIndex, minBound);
      vec3.ceil(maxIndex, maxIndex);
      
      for(var x = minIndex[0]; x <= maxIndex[0]; ++x)
      {
        for(var y = minIndex[1]; y <= maxIndex[1]; ++y)
        {
          for(var z = minIndex[2]; z <= maxIndex[2]; ++z)
          {
            var index = x + (y * this._xSlices) + (z * this._xSlices * this._ySlices);

            // Get amount of lights, increment it
            var clusterLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)];

            if(clusterLightCount < MAX_LIGHTS_PER_CLUSTER) 
            {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] = clusterLightCount + 1;

              var clusterLightIndex = Math.floor(clusterLightCount + 1); // + 1 comes from the light count
              var offset = Math.floor(clusterLightIndex / 4);
              var component = Math.floor(clusterLightIndex % 4);

              // Save the light index on the list
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, offset) + component] = lightIndex;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}