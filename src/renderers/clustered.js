import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function getDistance(ratio, lightPos){
  //only consider 2D space
  //for y: yz plane; for x: xz plane;
  let temp = Math.sqrt(1 + ratio*ratio);
  let a1 = 1 / temp;
  let a2 = -ratio*a1;
  let normal = vec2.create();
  vec2.set(normal, a1, a2);
  return vec2.dot(lightPos, normal);
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

    var zInterval = (camera.far - camera.near)/this._zSlices;
    var yzRatio = Math.tan(camera.fov / 2.0 * Math.PI / 180.0) * 2.0;
    var xzRatio = yzRatio * camera.aspect;
    var xInterval = xzRatio / this._xSlices;
    var yInterval = yzRatio / this._ySlices;
    var xStart = - xzRatio / 2.0;
    var yStart = - yzRatio / 2.0;

    for(let lightIndex = 0; lightIndex < NUM_LIGHTS; ++lightIndex)
    {
      //get light position
      let lightPos = vec4.create();
      vec4.set(lightPos, scene.lights[lightIndex].position[0], scene.lights[lightIndex].position[1], scene.lights[lightIndex].position[2], 1.0);
      vec4.transformMat4(lightPos,lightPos,viewMatrix);
      lightPos[2] *= -1.0;
      let lightRadius = scene.lights[lightIndex].radius;
      let zmin; let zmax;
      let ymin; let ymax;
      let xmin; let xmax;
      let distance;

      //find zmin
      for(zmin = 0; zmin < this._zSlices; ++zmin)
      {
        distance = lightPos[2]-(camera.near + zmin * zInterval);
        if(distance < lightRadius)
        {
          zmin = Math.max(0, zmin-1);
          break;
        }
      }

      //find zmax
      for(zmax = zmin + 1; zmax < this._zSlices; ++zmax)
      {
        distance = lightPos[2]-(camera.near + zmax * zInterval);
        if(distance < -lightRadius)
        {
          break;
        }
      }

      //find xmin
      for(xmin = 0; xmin < this._xSlices; ++xmin)
      {
        let lightPosxz = vec2.create();
        lightPosxz = vec2.set(lightPosxz, lightPos[0], lightPos[2]);
        distance = getDistance(xStart + xmin * xInterval, lightPosxz);
        if(distance < lightRadius)
        {
          xmin = Math.max(0, xmin-1);
          break;
        }
      }

      //find xmax
      for(xmax = xmin + 1; xmax < this._xSlices; ++xmax)
      {
        let lightPosxz = vec2.create();
        lightPosxz = vec2.set(lightPosxz, lightPos[0], lightPos[2]);
        distance = getDistance(xStart + xmax * xInterval, lightPosxz);
        if(distance < -lightRadius)
        {
          break;
        }
      }

      //find ymin
      for(ymin = 0; ymin < this._ySlices; ++ymin)
      {
        let lightPosyz = vec2.create();
        lightPosyz = vec2.set(lightPosyz, lightPos[1], lightPos[2]);
        distance = getDistance(yStart + ymin * yInterval, lightPosyz);
        if(distance < lightRadius)
        {
          ymin = Math.max(0, ymin-1);
          break;
        }
      }

      //find ymax
      for(ymax = ymin + 1; ymax < this._ySlices; ++ymax)
      {
        let lightPosyz = vec2.create();
        lightPosyz = vec2.set(lightPosyz, lightPos[1], lightPos[2]);
        distance = getDistance(yStart + ymax * yInterval, lightPosyz);
        if(distance < -lightRadius)
        {
          break;
        }
      }

      for (let z = zmin ; z < zmax; ++z) {
        for (let y = ymin; y < ymax; ++y) {
          for (let x = xmin; x < xmax; ++x) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            lightCount++;
            if(lightCount<MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightCount;
              let row = Math.floor(lightCount / 4);
              let pixel = lightCount - row * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + pixel] = lightIndex;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}