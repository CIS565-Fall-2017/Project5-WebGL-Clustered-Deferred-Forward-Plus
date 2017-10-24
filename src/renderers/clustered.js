// Super important reference: --> http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf
// Making a Struct factory --> https://stackoverflow.com/questions/502366/structs-in-javascript
// Enums in javascript --> https://stijndewitt.com/2014/01/26/enums-in-javascript/

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../AABB'

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class ClusteredRenderer 
{
  constructor(xSlices, ySlices, zSlices) 
  {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    /*
    Layout of _clusterTexture

    ------------------cluster0-----------------cluster1---------------cluster2---------------(u)-
    component0 |count|lid0|lid1|lid2 || count|lid0|lid1|lid2 || count|lid0|lid1|lid2
    component1 |lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6 || lid3 |lid4|lid5|lid6
    component2 |lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10|| lid7 |lid8|lid9|lid10
    (v)

    To get the fourth light in the first cluster, you need the lid3 in the cluster0. 

    The texture is laid out as ceil((maxLightsPerCluster+1)/4.0f) by numClusters, 
    num Rows = ceil((maxLightsPerCluster+1)/4.0f); 
    num Columns = numClusters


    to find v: light_num + 1 (to account for the count) / 4 (cuz 4 values per pixel)
    to find light placement within pixel = (light_num + 1) % 4 
    */
  }

  findMinMaxClusterIndexBounds_Equiangular(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index,
                                           viewMatrix, vertical_FoV, horizontal_FoV, xStride, yStride, zStride, lightAABB)
  {
    // This function finds the lightCluster Index Bounds

    var lightMinXPos = vec3.create();
    var lightMaxXPos = vec3.create();
    var lightMinYPos = vec3.create();
    var lightMaxYPos = vec3.create();

    vec3.set(lightMinXPos, lightAABB.min[0], 0, lightAABB.min[2]);
    vec3.set(lightMaxXPos, lightAABB.max[0], 0, lightAABB.max[2]);
    vec3.set(lightMinYPos, 0, lightAABB.min[1], lightAABB.min[2]);
    vec3.set(lightMaxYPos, 0, lightAABB.max[1], lightAABB.max[2]);

    var temp1 = vec3.create();
    var camRight = vec3.create();
    var camDown = vec3.create();

    vec3.set(camRight, viewMatrix[0], viewMatrix[1], viewMatrix[2]);
    vec3.set(camDown, -viewMatrix[4], -viewMatrix[5], -viewMatrix[6]);

    vec3.normalize(camRight, camRight);
    vec3.normalize(camDown, camDown);
    var halfspace = 1;

    vec3.normalize(temp1, lightMinXPos);
    var dot = vec3.dot(temp1, camRight);
    if(dot<0) { halfspace = -1; }
    var lightMinXangle = Math.atan((horizontal_FoV*0.5 + halfspace*lightMinXPos[0]) / (vec3.length(lightMinXPos)));

    vec3.normalize(temp1, lightMaxXPos);
    var dot = vec3.dot(temp1, camRight);
    if(dot<0) { halfspace = -1; }
    var lightMaxXangle = Math.atan((horizontal_FoV*0.5 + halfspace*lightMaxXPos[0]) / (vec3.length(lightMaxXPos)));

    vec3.normalize(temp1, lightMinYPos);
    var dot = vec3.dot(temp1, camDown);
    if(dot<0) { halfspace = -1; }
    var lightMinYangle = Math.atan((vertical_FoV*0.5 + halfspace*lightMinYPos[1]) / (vec3.length(lightMinYPos)));

    vec3.normalize(temp1, lightMaxYPos);
    var dot = vec3.dot(temp1, camDown);
    if(dot<0) { halfspace = -1; }
    var lightMaxYangle = Math.atan((vertical_FoV*0.5 + halfspace*lightMinYPos[1]) / (vec3.length(lightMinYPos)));

    minX_Index = Math.floor(lightMinXangle / xStride);
    maxX_Index = Math.floor(lightMaxXangle / xStride);

    minY_Index = Math.floor(lightMinYangle / yStride);
    maxY_Index = Math.floor(lightMaxYangle / yStride);

    //now find the other z bounds rather easily using the AABB and then fill those clusters with the current light
    //Assumption: z is in a 0 to 1 range, the camera is at z=0 and 1 is the far_clip_plane
    minZ_Index = Math.floor(lightAABB.min.z / zStride);
    maxZ_Index = Math.floor(lightAABB.max.z / zStride);
  }

  updateClusters(camera, viewMatrix, scene, numLights) 
  {
    //This function updates the cluster texture with the count and indices of the lights in each cluster

    //Reset things for clusters
    for (let z = 0; z < this._zSlices; ++z) 
    {
      for (let y = 0; y < this._ySlices; ++y) 
      {
        for (let x = 0; x < this._xSlices; ++x) 
        {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var farPos = vec3.create();
    var _lightPos = vec4.create();
    var lightPos = vec3.create();

    var lightAABB;
    var clusterLightCount;
    var minZ_Index = 0, maxZ_Index = 0, minY_Index = 0, maxY_Index = 0, minX_Index = 0, maxX_Index = 0;

    //find bounding x and y values of the camera frustum
    var vertical_FoV = camera.fov;
    var tan_Vertical_FoV = Math.tan(vertical_FoV);
    var tan_Horizontal_FoV = camera.aspect * tan_Vertical_FoV;

    var vertical_FoV = camera.fov;
    var horizontal_FoV = Math.atan(tan_Horizontal_FoV);

    var xStride = ((horizontal_FoV)/this._xSlices);
    var yStride = ((vertical_FoV)/this._ySlices);
    var zStride = (camera.far/this._zSlices);

    for (let i=0; i<numLights; i++)
    {
      vec4.set(_lightPos, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);      
      vec4.transformMat4(_lightPos, _lightPos, viewMatrix); //World to View
      vec3.set(lightPos, _lightPos[0], _lightPos[1], _lightPos[2]); //copy into vec3 version of lightPos

      lightAABB = new AABB();
      lightAABB.calcAABB_PointLight(lightPos, scene.lights[i].radius);

      // now using the min and max of the AABB determine which clusters the light lies in
      // x and y planes do not have an angle to them and so can be done similar to grid indexing for boids
      // z under goes perspective correction and so the ZY planes are angled

      this.findMinMaxClusterIndexBounds_Equiangular(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index,
                                                    viewMatrix, vertical_FoV, horizontal_FoV, xStride, yStride, zStride, lightAABB);

      for (let z = minZ_Index; z <= maxZ_Index; ++z)
      {
        for (let y = minY_Index; y <= maxY_Index; ++y)
        {
          for (let x = minX_Index; x <= maxX_Index; ++x) 
          {
            let j = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            // Update the light count for every cluster
            clusterLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, 0) + 0];

            if(clusterLightCount < MAX_LIGHTS_PER_CLUSTER+1)
            {
              clusterLightCount++;

              let clusterLightIndex = Math.floor(clusterLightCount/4);
              let clusterLightSubIndex = clusterLightCount%4;

              // Update the light index for the particular cluster in the light buffer
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, clusterLightIndex) + clusterLightSubIndex] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}