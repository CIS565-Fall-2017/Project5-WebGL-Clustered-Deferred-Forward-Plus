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

    The texture is laid out as ceil((maxLightsPerCluster+1)/4.0f) by numClusters, 
    num Rows = ceil((maxLightsPerCluster+1)/4.0f); 
    num Columns = numClusters


    to find v: light_num + 1 (to account for the count) / 4 (cuz 4 values per pixel)
    to find light placement within pixel = (light_num + 1) % 4 
    */
  }

  createPlane(planeNormal, pointOnPlane)
  {
    var d = vec3.dot(planeNormal, pointOnPlane);
    var plane = new Plane(planeNormal[0], planeNormal[1], planeNormal[2], d);
    return plane;
  }

  calcPlaneNormal(farPos, upVec)
  {
    //returns a vec3
    var planeNormal = vec3.create();
    // console.log("plane before normalization:" + planeNormal.x + planeNormal.y + planeNormal.z);
    vec3.cross(planeNormal, upVec, farPos); // this makes the normal of all the planes be in the same hemisphere as the +ve x axis
    vec3.normalize(planeNormal, planeNormal);

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

  distanceToPoint(plane, point)
  {
    //this assumes the plane has been normalized
    var signedDistance = plane.a*point.x + plane.b*point.y + plane.c*point.z + plane.d;
    return signedDistance;
  }

  classifyPoint(plane, point)
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

  classifyPointwithSD(d)
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

  FindMinMaxviaBinarySearch(high, low, mid, pointOnPlane, pointCompIndex, directionVecOnPlane, 
                            actualHalfwayPoint, stride, numSlices, camFrustumFarPlaneSize,
                            lightAABB, minIndex, maxIndex)
  {
    //Binary search for cluster minXIndex
    low = 0;
    high = numSlices;
    var flag_keepSearching = true;

    debugger;

    for(var id = 0; id<numSlices; id++)
    {
      if(high>=low)
      {
        mid = low + (high - 1)/2;
        pointOnPlane[pointCompIndex] = (mid-actualHalfwayPoint)*stride;

        var planeNor = this.calcPlaneNormal(pointOnPlane, directionVecOnPlane);
        // console.log("plane before normalization:" + planeNor.x + planeNor.y + planeNor.z);
        var plane = this.createPlane(planeNor, pointOnPlane);
        //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light
        //console.log("plane before normalization:" + plane.a + plane.b + plane.c + plane.d);
        this.normalizePlane(plane);
        //console.log("plane after normalization:" + plane.a + " " + plane.b + " " + plane.c + " " + plane.d);

        var minSD = this.distanceToPoint(plane, lightAABB.min); //min signed Distance
        var scaledSD = Math.floor(Math.abs(minSD)/stride) * this.classifyPointwithSD(minSD);

        // console.log("minSD:" + minSD);
        if(scaledSD == 0)
        {
          minIndex = Math.floor((pointOnPlane[pointCompIndex]+1)/stride);
          console.log("found");
          flag_keepSearching = false;
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
        minIndex = low;
        flag_keepSearching = false;
        console.log("failed");
        break;
      }
    }
    //console.log("here");

    //Binary search for cluster maxXIndex
    pointOnPlane[pointCompIndex] = 0;
    low = minIndex;
    high = numSlices;

    // while(flag_keepSearching)
    // {
    //   if(high>=low)
    //   {
    //     mid = low + (high - 1)/2;
    //     pointOnPlane[pointCompIndex] = (mid-actualHalfwayPoint)*stride;

    //     var planeNor = this.calcPlaneNormal(pointOnPlane, directionVecOnPlane);
    //     var plane = this.createPlane(planeNor, pointOnPlane);
    //     //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

    //     this.normalizePlane(plane);
    //     var maxSD = this.distanceToPoint(plane, lightAABB.min); //min signed Distance
    //     var scaledSD = Math.floor(Math.abs(maxSD)/stride) * this.classifyPointwithSD(minSD);

    //     if(scaledSD == 0)
    //     {
    //       maxIndex = Math.floor((pointOnPlane[pointCompIndex]+1)/stride);
    //       flag_keepSearching = false;
    //       break;
    //     }
    //     else if(scaledSD>0)
    //     {
    //       low = mid+1;
    //     }
    //     else if(scaledSD<0)
    //     {
    //       high = mid-1;
    //     }
    //   }
    //   else
    //   {
    //     maxIndex = high;
    //     flag_keepSearching = false;
    //     break;
    //   }        
    // }
  }

  findMinMaxClusterIndexBounds(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index,
                               camFrustumFarPlaneWidth, camFrustumFarPlaneHeight, camFar,
                               xStride, yStride, zStride, actualHalfwayPoint_x, actualHalfwayPoint_y, actualHalfwayPoint_z,
                               upVec, rightVec, farPos, lightAABB, low, high, mid)
  {
    // This function finds the lightCluster Index Bounds

    vec3.set(farPos, 0, 0, camFar);
    this.FindMinMaxviaBinarySearch(high, low, mid, farPos, 0, upVec, 
                                   actualHalfwayPoint_x, xStride, this._xSlices,
                                   camFrustumFarPlaneWidth,
                                   lightAABB, minX_Index, maxX_Index);

    vec3.set(farPos, 0, 0, camFar);
    this.FindMinMaxviaBinarySearch(high, low, mid, farPos, 1, rightVec, 
                                   actualHalfwayPoint_y, yStride, this._ySlices,
                                   camFrustumFarPlaneHeight,
                                   lightAABB, minY_Index, maxY_Index);

    //now find the other z bounds rather easily using the AABB and then fill those clusters with the current light
    //Assumption: z is in a 0 to 1 range, the camera is at z=0 and 1 is the far_clip_plane
    minZ_Index = Math.floor(lightAABB.min.z / zStride);
    maxZ_Index = Math.ceil(lightAABB.max.z / zStride);
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

    var actualHalfwayPoint_x = this._xSlices/2;
    var actualHalfwayPoint_y = this._ySlices/2;
    var actualHalfwayPoint_z = this._zSlices/2;

    var upVec = vec3.create();
    var rightVec = vec3.create();

    vec3.set(upVec, 0, 1, 0);
    vec3.set(rightVec, 1, 0, 0);

    var farPos = vec3.create();
    var _lightPos = vec4.create();
    var lightPos = vec3.create();

    var lightAABB;
    var clusterLightCount;
    var minZ_Index = 0, maxZ_Index = 0, minY_Index = 0, maxY_Index = 0, minX_Index = 0, maxX_Index = 0;
    var low, high, mid;

    //find bounding x and y values of the camera frustum
    var vertical_FoV_by_2 = camera.fov / 2.0;
    var tan_Vertical_FoV_by_2 = Math.tan(vertical_FoV_by_2);
    var tan_Horizontal_FoV_by_2 = camera.aspect * tan_Vertical_FoV_by_2;

    var camFrustumFarPlaneWidth = tan_Horizontal_FoV_by_2 * camera.far;
    var camFrustumFarPlaneHeight = tan_Vertical_FoV_by_2 * camera.far;

    var xStride = ((2*camFrustumFarPlaneWidth)/this._xSlices);
    var yStride = ((2*camFrustumFarPlaneHeight)/this._ySlices);
    var zStride = ((2*camera.far)/this._zSlices);

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
      
      this.findMinMaxClusterIndexBounds(minZ_Index, maxZ_Index, minY_Index, maxY_Index, minX_Index, maxX_Index,
                                        camFrustumFarPlaneWidth, camFrustumFarPlaneHeight, camera.far,
                                        xStride, yStride, zStride, actualHalfwayPoint_x, actualHalfwayPoint_y, actualHalfwayPoint_z,
                                        upVec, rightVec, farPos, lightAABB, low, high, mid);

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