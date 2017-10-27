// 
// http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 150;

function sinatan(d) {
  return d / Math.sqrt(1 + d * d);
}

function cosatan(d) {
  return 1.0 / Math.sqrt(1 + d * d);
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

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          
        }
      }
    }

    // Perspective Camera attributes (reference: https://threejs.org/docs/index.html#api/cameras/PerspectiveCamera)
    // fov: Camera frustum vertical field of view, from bottom to top of view, in degrees
    // aspect: Camera frustum aspect ratio, usually the canvas width / canvas height.
    // near: Camera frustum near plane
    // far: Camera frustum far plane
    var stride = 2.0 * Math.tan(camera.fov * 0.5 * Math.PI / 180);
    var strideX = stride * camera.aspect / this._xSlices;
    var strideY = stride / this._ySlices;
    var strideZ = (camera.far - camera.near) / this._zSlices;

    var lightPos = vec4.create();
    var lightDir = vec3.create();

    for (var li = 0; li < NUM_LIGHTS; ++li) {
      // light variables
      var lightRadius = scene.lights[li].radius;
      lightPos[0] = scene.lights[li].position[0];
      lightPos[1] = scene.lights[li].position[1];
      lightPos[2] = scene.lights[li].position[2];
      lightPos[3] = 1;

      // transform from World space to eye space
      vec4.transformMat4(lightPos, lightPos, viewMatrix); 

      // determine which cluster contains light center
      // and if it lies within camera frustum
      vec3.set(lightDir, lightPos[0], lightPos[1], -lightPos[2]);
      vec3.normalize(lightDir, lightDir);
      var t = 1.0 / lightDir[2];
      var clusterX = Math.floor((t * lightDir[0] + strideX * (this._xSlices / 2.0)) / strideX);
      // if (clusterX < 0 || clusterX >= this._xSlices) continue;
      var clusterY = Math.floor((t * lightDir[1] + strideY * (this._ySlices / 2.0)) / strideY);
      // if (clusterY < 0 || clusterY >= this._ySlices) continue;
      var clusterZ = Math.floor((-lightPos[2] - camera.near) / strideZ);
      // if (clusterZ < 0 || clusterZ >= this._zSlices) continue;

      var normal = vec4.create();
      normal[3] = 0;
      var d;
      var distance;
      // ----------------------
      // XZ planes (vertical)
      // ----------------------
      normal[1] = 0.0;
      var minX_cluster;
      d = (clusterX - this._xSlices / 2.0) * strideX;
      for (minX_cluster = clusterX; minX_cluster > 0; --minX_cluster, d -= strideX) {
        normal[0] = cosatan(d);
        normal[2] = sinatan(d);
        vec4.normalize(normal, normal);
        distance = Math.abs(vec4.dot(normal, lightPos));
        if (distance > lightRadius) {
          break;
        }
      }
      if (minX_cluster >= this._xSlices) continue;
      minX_cluster = Math.max(minX_cluster, 0);

      var maxX_cluster;
      d = (clusterX + 1 - this._xSlices / 2.0) * strideX;
      for (maxX_cluster = clusterX + 1; maxX_cluster < this._xSlices; ++maxX_cluster, d += strideX) {
        normal[0] = cosatan(d);
        normal[2] = sinatan(d);
        vec4.normalize(normal, normal);
        distance = Math.abs(vec4.dot(normal, lightPos));
        if (distance > lightRadius) {
          break;
        }
      }
      if (maxX_cluster < 0) continue;
      maxX_cluster = Math.min(maxX_cluster, this._xSlices);

      // ----------------------
      // YZ planes (horizontal)
      // ----------------------
      normal[0] = 0.0;
      var minY_cluster;
      d = (clusterY - this._ySlices / 2.0) * strideY;
      for (minY_cluster = clusterY; minY_cluster > 0; --minY_cluster, d -= strideY) {
        normal[1] = cosatan(d);
        normal[2] = sinatan(d);
        vec4.normalize(normal, normal);
        distance = Math.abs(vec4.dot(normal, lightPos));
        if (distance > lightRadius) {
          break;
        }
      }
      if (minY_cluster >= this._ySlices) continue;
      minY_cluster = Math.max(minY_cluster, 0);

      var maxY_cluster;
      d = (clusterY + 1 - this._ySlices / 2.0) * strideY;
      for (maxY_cluster = clusterY + 1; maxY_cluster < this._ySlices; ++maxY_cluster, d += strideY) {
        normal[1] = cosatan(d);
        normal[2] = sinatan(d);
        vec4.normalize(normal, normal);
        distance = Math.abs(vec4.dot(normal, lightPos));
        if (distance > lightRadius) {
          break;
        }
      }
      if (maxY_cluster < 0) continue;
      maxY_cluster = Math.min(maxY_cluster, this._ySlices);

      // ----------------------
      // XY planes (perpendicular to camera)
      // ----------------------
      var minZ_cluster;
      d = - clusterZ * strideZ;
      for (minZ_cluster = clusterZ; minZ_cluster > 0; --minZ_cluster, d += strideZ) {
        distance = - lightPos[2] - camera.near + d;
        if (distance > lightRadius) {
          break;
        }
      }
      if (minZ_cluster >= this._zSlices) continue;
      minZ_cluster = Math.max(minZ_cluster, 0);

      var maxZ_cluster;
      d = (clusterZ + 1) * strideZ;
      for (maxZ_cluster = clusterZ + 1; maxZ_cluster < this._zSlices; ++maxZ_cluster, d += strideZ) {
        distance = d + lightPos[2];
        if (distance > lightRadius) {
          break;
        }
      }
      if (maxZ_cluster < 0) continue;
      maxZ_cluster = Math.min(maxZ_cluster, this._zSlices);

      // update cluster lights
      // ranges partial inclusive [min, max)
      for (let c_z = minZ_cluster; c_z < maxZ_cluster; ++c_z) {
        for (let c_y = minY_cluster; c_y < maxY_cluster; ++c_y) {
          for (let c_x = minX_cluster; c_x < maxX_cluster; ++c_x) {
            let j = c_x + c_y * this._xSlices + c_z * this._xSlices * this._ySlices;

            //     cluster0    |     cluster1    |    cluster 2
            // num, i0, i1, i2 | num, i0, i1, i2 | num, i0, i1, i2
            // i3, i4, i5, i6  | i3, i4, i5, i6  | i3, i4, i5, i6
            //        ...      |       ...       |     ... 
            let lightCountIndex = this._clusterTexture.bufferIndex(j, 0);
            let numLights = this._clusterTexture.buffer[lightCountIndex];
            let nextLightIndex = numLights;
            numLights++;
            if (numLights <= MAX_LIGHTS_PER_CLUSTER) {
              var pixelRow = Math.floor((nextLightIndex + 1) * 0.25);
              var pixelComponent = (nextLightIndex + 1) - 4 * pixelRow;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, pixelRow) + pixelComponent] = li;
              this._clusterTexture.buffer[lightCountIndex] = numLights;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}