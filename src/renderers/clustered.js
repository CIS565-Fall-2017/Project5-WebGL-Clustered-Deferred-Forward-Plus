// Super important reference: --> http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf
// Making a Struct factory --> https://stackoverflow.com/questions/502366/structs-in-javascript
// Enums in javascript --> https://stijndewitt.com/2014/01/26/enums-in-javascript/

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../AABB'

export default class ClusteredRenderer 
{
  constructor(xSlices, ySlices, zSlices, camera, MaxLightsPerCluster) 
  {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MaxLightsPerCluster + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._MaxLightsPerCluster = MaxLightsPerCluster;

    //find bounding x and y values of the camera frustum    
    this.vertical_FoV = camera.fov;
    var tan_Vertical_FoV_by_2 = Math.tan(this.vertical_FoV * (Math.PI/180.0) * 0.5);
    var tan_Horizontal_FoV_by_2 = camera.aspect * tan_Vertical_FoV_by_2;    
    this.horizontal_FoV = 2 * Math.atan(tan_Horizontal_FoV_by_2) * (180.0/Math.PI);

    this.xStride = ((this.horizontal_FoV)/this._xSlices);
    this.yStride = ((this.vertical_FoV)/this._ySlices);
    this.zStride = (camera.far/this._zSlices);

    this.hLeftVec = vec3.create();
    var hleftPoint = camera.far*tan_Horizontal_FoV_by_2;
    vec3.set(this.hLeftVec, -hleftPoint, 0, camera.far);

    this.vTopVec = vec3.create();
    var vTopPoint = camera.far*tan_Vertical_FoV_by_2;
    vec3.set(this.vTopVec, vTopPoint, 0, camera.far);

    this.centerVec = vec3.create();
    vec3.set(this.vTopVec, 0, 0, camera.far);

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

  findMinMaxClusterIndexBounds_Equiangular(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index, viewMatrix, camRight, camDown, lightAABB)
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
    vec3.normalize(camRight, camRight);
    vec3.normalize(camDown, camDown);
    var halfspace = 1;
    var theta1, theta2, theta3, theta4;
    
    var curr_hLeft = vec3.create();
    var curr_vTop = vec3.create();
    vec3.normalize(curr_hLeft, this.hLeftVec);
    vec3.normalize(curr_vTop, this.vTopVec);

    debugger;
    //_____________________________MinXIndex________________________
    if(lightAABB.min[0] < this.hLeftVec[0])
    {
      minX_Index = 0;
    }
    else if(lightAABB.min[0] > -this.hLeftVec[0])
    {
      minX_Index = this._xSlices; // purposefully set to outside of the index --> for loop wont go through
    }
    else
    {
      vec3.normalize(temp1, lightMinXPos);
      var dot = vec3.dot(temp1, curr_hLeft);
      if(dot<0)
      {
        //beyond midway point and could possibly go over 90 degrees
        dot = vec3.dot(temp1, this.centerVec);
        theta1 = this.horizontal_FoV * 0.5 + Math.acos(dot) * (180.0/Math.PI);
      }
      else
      {
        theta1 = Math.acos(dot) * (180.0/Math.PI);
      }

      minX_Index = Math.floor(theta1 / this.xStride);
    }

    //_____________________________MaxXIndex________________________
    if(lightAABB.max[0] < this.hLeftVec[0])
    {
      maxX_Index = 0;
    }
    else if(lightAABB.min[0] > -this.hLeftVec[0])
    {
      maxX_Index = this._xSlices; // purposefully set to outside of the index --> for loop wont go through
    }
    else
    {
      vec3.normalize(temp1, lightMaxXPos);
      var dot = vec3.dot(temp1, curr_hLeft);
      if(dot<0)
      {
        //beyond midway point and could possibly go over 90 degrees
        dot = vec3.dot(temp1, this.centerVec);
        theta2 = this.horizontal_FoV * 0.5 + Math.acos(dot) * (180.0/Math.PI);
      }
      else
      {
        theta2 = Math.acos(dot) * (180.0/Math.PI);
      }

      maxX_Index = Math.floor(theta2 / this.xStride);
    }

    //_____________________________MinYIndex________________________
    if(lightAABB.min[1] < this.vTopVec[1])
    {
      minY_Index = 0;
    }
    else if(lightAABB.min[1] > -this.vTopVec[1])
    {
      minY_Index = this._ySlices; // purposefully set to outside of the index --> for loop wont go through
    }
    else
    {
      vec3.normalize(temp1, lightMinYPos);
      var dot = vec3.dot(temp1, curr_vTop);
      if(dot<0)
      {
        //beyond midway point and could possibly go over 90 degrees
        dot = vec3.dot(temp1, this.centerVec);
        theta3 = this.vertical_FoV * 0.5 + Math.acos(dot) * (180.0/Math.PI);
      }
      else
      {
        theta3 = Math.acos(dot) * (180.0/Math.PI);
      }

      minY_Index = Math.floor(theta3 / this.yStride);
    }

    //_____________________________MaxYIndex________________________
    if(lightAABB.max[1] < this.vTopVec[1])
    {
      maxY_Index = 0;
    }
    else if(lightAABB.max[1] > -this.vTopVec[1])
    {
      maxY_Index = this._ySlices; // purposefully set to outside of the index --> for loop wont go through
    }
    else
    {
      vec3.normalize(temp1, lightMaxYPos);
      var dot = vec3.dot(temp1, curr_vTop);
      if(dot<0)
      {
        //beyond midway point and could possibly go over 90 degrees
        dot = vec3.dot(temp1, this.centerVec);
        theta4 = this.vertical_FoV * 0.5 + Math.acos(dot) * (180.0/Math.PI);
      }
      else
      {
        theta4 = Math.acos(dot) * (180.0/Math.PI);
      }

      maxY_Index = Math.floor(theta4 / this.yStride);
    }
    
    //now find the other z bounds rather easily using the AABB and then fill those clusters with the current light
    //Assumption: z is in a 0 to 1 range, the camera is at z=0 and 1 is the far_clip_plane
    if(lightAABB.min[2] < 0.01)
    {
      minZ_Index = 0;
    }
    else if(lightAABB.min[2] > 1000)
    {
      minZ_Index = this._zSlices;
    }
    else
    {
      minZ_Index = Math.floor(lightAABB.min.z / this.zStride);
    }

    if(lightAABB.max[2] < 0.01)
    {
      maxZ_Index = 0;
    }
    else if(lightAABB.max[2] > 1000)
    {
      maxZ_Index = this._zSlices;
    }
    else
    {
      maxZ_Index = Math.floor(lightAABB.max.z / this.zStride);
    }    
  }

  updateClusters(camera, viewMatrix, scene, camRight, camDown, numLights) 
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
      var minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index;
      this.findMinMaxClusterIndexBounds_Equiangular(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index, 
                                                    viewMatrix, camRight, camDown, lightAABB);

      console.log("min max X:   " + minX_Index + "   " + maxX_Index);
      console.log("min max Y:   " + minY_Index + "   " + maxY_Index);
      console.log("min max Z:   " + minZ_Index + "   " + maxZ_Index);

      for (let z = minZ_Index; z <= maxZ_Index; ++z)
      {
        for (let y = minY_Index; y <= maxY_Index; ++y)
        {
          for (let x = minX_Index; x <= maxX_Index; ++x) 
          {
            let j = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            // Update the light count for every cluster
            clusterLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, 0) + 0];

            if(clusterLightCount < this._MaxLightsPerCluster+1)
            {
              //console.log("updating cluster" + j);
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