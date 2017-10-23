// Super important reference: --> http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf
// Making a Struct factory --> https://stackoverflow.com/questions/502366/structs-in-javascript
// Enums in javascript --> https://stijndewitt.com/2014/01/26/enums-in-javascript/

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../AABB'

export const MAX_LIGHTS_PER_CLUSTER = 100;

//struct factory
function makeStruct(names) {
  var names = names.split(' ');
  var count = names.length;
  function constructor() {
    for (var i = 0; i < count; i++) 
    {
      this[names[i]] = arguments[i];
    }
  }
  return constructor;
}

// halfspace enum
var Halfspace = {
  NEGATIVE: -1,
  ON_PLANE: 0,
  POSITIVE: 1,
};

var Plane = makeStruct("a b c d");

export default class ClusteredRenderer {
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

    The texture is laid out as ceil((maxNumLights+1)/4.0f) by numClusters, 
    num Rows = ceil((maxNumLights+1)/4.0f); 
    num Columns = numClusters
    */
  }

  createPlane(planeNormal, pointOnPlane)
  {
    var d = dot(planeNormal, pointOnPlane);
    var plane = new Plane(planeNormal.x, planeNormal.y, planeNormal.z, d);
    return plane;
  }

  calcPlaneNormal(farPos, upVec)
  {
    //returns a vec3
    var planeNormal = vec3.create();
    cross(planeNormal, upVec, farPos); // this makes the normal of all the planes be in the same hemisphere as the +ve x axis
    normalize(planeNormal, planeNormal);
    return planeNormal;
  }

  normalizePlane(plane)
  {
    //returns a Plane
    var mag;
    mag = Math.sqrt(plane.a * plane.a + plane.b * plane.b + plane.c * plane.c);
    plane.a = plane.a / mag;
    plane.b = plane.b / mag;
    plane.c = plane.c / mag;
    plane.d = plane.d / mag;
  }

  DistanceToPoint(plane, point)
  {
    //this assumes the plane has been normalized
    var signedDistance = plane.a*point.x + plane.b*point.y + plane.c*point.z + plane.d;
    return signedDistance;
  }

  ClassifyPoint(plane, point)
  {
    //returns a Halfspace
    var d = plane.a*point.x + plane.b*point.y + plane.c*point.z + plane.d;

    if (d < 0)
    {
      return Halfspace.NEGATIVE;
    }
    else if (d > 0)
    {
      return Halfspace.POSITIVE;
    }
    else
    {
      return Halfspace.ON_PLANE;
    }
  }

  ClassifyPointwithSD(d)
  {
    //returns a Halfspace
    if (d < 0)
    {
      return Halfspace.NEGATIVE;
    }
    else if (d > 0)
    {
      return Halfspace.POSITIVE;
    }
    else
    {
      return Halfspace.ON_PLANE;
    }
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

    var xStride = (2/this._xSlices);
    var yStride = (2/this._ySlices);
    var zStride = (2/this._zSlices);
    var ActualHalfwayPoint_x = this._xSlices/2;
    var ActualHalfwayPoint_y = this._ySlices/2;
    var ActualHalfwayPoint_z = this._zSlices/2;

    var upVec = vec3.create();
    upVec.x = 0;
    upVec.y = 1;
    upVec.z = 0;
    var rightVec = vec3.create();
    rightVec.x = 1;
    rightVec.y = 0;
    rightVec.z = 0;
    var farPos = vec3.create();
    farPos.x = 0;
    farPos.y = 0;
    farPos.z = -1;

    var lightPos, lightAABB;
    var clusterLightCount;
    var minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index;
    var low, high, flag_keepSearching;

    for (let i=0; i<numLights; i++)
    {
      lightPos = vec3.create();
      lightpos[0] = scene.lights[i].position[0];
      lightpos[1] = scene.lights[i].position[1];
      lightpos[2] = scene.lights[i].position[2];

      lightAABB = new AABB();
      lightAABB.calcAABB_PointLight(lightPos, scene.lights[i].radius);

      // now using the min and max of the AABB determine which clusters the light lies in
      // x and y planes do not have an angle to them and so can be done similar to grid indexing for boids
      // z under goes perspective correction and so the ZY planes are angled
      
      //-----------------------------------------------
      //------- Find lightCluster Index Bounds --------
      //-----------------------------------------------
      {
        //Binary search for cluster minXIndex
        farPos.x = 0;
        low = 0;
        high = this._xSlices;
        //searching for minClusterBounds
        while(true)
        {
          if(high>=low)
          {
            var mid = low + (high - 1)/2;
            farPos.x = (mid-actualHalfwayPoint_x)*xStride;

            var YZ_planeNor = calcPlaneNormal(farPos, upVec);
            var YZ_plane = createPlane(YZ_planeNor, farPos);
            //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

            normalizePlane(YZ_plane);
            var minSD = DistanceToPoint(YZ_plane, lightAABB.min); //min signed Distance
            var scaledSD = Math.floor(Math.abs(minSD)/xStride) * ClassifyPointwithSD(minSD);

            if(scaledSD == 0)
            {
              minX_Index = Math.floor((farPos.x+1)/xStride);
              break;
            }
            else if(scaledSD>0)
            {
              low = mid+1;
            }
            else if(scaledSD<0)
            {
              high = mid-1;
            }
          }
          else
          {
            //incase the above checks miss everything
            minX_Index = low;
            break;
          }        
        }

        //Binary search for cluster maxXIndex
        keepSearching = true;
        farPos.x = 0;
        low = lightClusterMinBoundIndex;
        high = this._xSlices;
        //searching for maxClusterBounds
        while(true)
        {
          if(high>=low)
          {
            var mid = low + (high - 1)/2;
            farPos.x = (mid-actualHalfwayPoint_x)*xStride;

            var YZ_planeNor = calcPlaneNormal(farPos, upVec);
            var YZ_plane = createPlane(YZ_planeNor, farPos);
            //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

            normalizePlane(YZ_plane);
            var minSD = DistanceToPoint(YZ_plane, lightAABB.min); //min signed Distance
            var scaledSD = Math.floor(Math.abs(minSD)/xStride) * ClassifyPointwithSD(minSD);

            if(scaledSD == 0)
            {
              maxX_Index = Math.floor((farPos.x+1)/xStride);
              break;
            }
            else if(scaledSD>0)
            {
              low = mid+1;
            }
            else if(scaledSD<0)
            {
              high = mid-1;
            }
          }
          else
          {
            maxX_Index = high;
            break;
          }        
        }

        //Binary search for cluster minYIndex
        farPos.x = 0;
        farPos.y = 0;
        low = 0;
        high = this._ySlices;
        //searching for minClusterBounds
        while(true)
        {
          if(high>=low)
          {
            var mid = low + (high - 1)/2;
            farPos.y = (mid-actualHalfwayPoint_y)*yStride;

            var XZ_planeNor = calcPlaneNormal(farPos, rightVec);
            var XZ_plane = createPlane(XZ_planeNor, farPos);
            //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

            normalizePlane(XZ_plane);
            var minSD = DistanceToPoint(XZ_plane, lightAABB.min); //min signed Distance
            var scaledSD = Math.floor(Math.abs(minSD)/yStride) * ClassifyPointwithSD(minSD);

            if(scaledSD == 0)
            {
              minY_Index = Math.floor((farPos.y+1)/yStride);
              break;
            }
            else if(scaledSD>0)
            {
              low = mid+1;
            }
            else if(scaledSD<0)
            {
              high = mid-1;
            }
          }
          else
          {
            //incase the above checks miss everything
            minY_Index = low;
            break;
          }        
        }

        //Binary search for cluster maxYIndex
        keepSearching = true;
        farPos.y = 0;
        low = lightClusterMinBoundIndex;
        high = this._ySlices;
        //searching for maxClusterBounds
        while(true)
        {
          if(high>=low)
          {
            var mid = low + (high - 1)/2;
            farPos.y = (mid-actualHalfwayPoint_y)*yStride;

            var XZ_planeNor = calcPlaneNormal(farPos, rightVec);
            var XZ_plane = createPlane(XZ_planeNor, farPos);
            //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

            normalizePlane(XZ_plane);
            var minSD = DistanceToPoint(XZ_plane, lightAABB.min); //min signed Distance
            var scaledSD = Math.floor(Math.abs(minSD)/yStride) * ClassifyPointwithSD(minSD);

            if(scaledSD == 0)
            {
              maxY_Index = Math.floor((farPos.y+1)/yStride);
              break;
            }
            else if(scaledSD>0)
            {
              low = mid+1;
            }
            else if(scaledSD<0)
            {
              high = mid-1;
            }
          }
          else
          {
            maxY_Index = high;
            break;
          }        
        }

        //now find the other z bounds rather easily using the AABB and then fill those clusters with the current light
        //Assumption: z is in a 0 to 1 range, the camera is at z=0 and 1 is the far_clip_plane
        minZ_Index = Math.floor(lightAABB.min.z / zStride);
        maxZ_Index = Math.ceil(lightAABB.max.z / zStride);
      }

      for (let z = minZ_Index; z <= maxZ_Index; ++z)
      {
        for (let y = minY_Index; y <= maxY_Index; ++y)
        {
          for (let x = lightClusterMinBoundIndex_x; x <= lightClusterMinBoundIndex_x; ++x) 
          {
            let j = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            // Update the light count for every cluster
            clusterLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, 0) + 0];
            clusterLightCount++;

            var clusterLightIndex = Math.floor(clusterLightCount/4);
            var clusterLightSubIndex = clusterLightCount%4;

            // Update the light index for the particular cluster in the light buffer
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(j, clusterLightIndex) + clusterLightSubIndex] = i;
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}