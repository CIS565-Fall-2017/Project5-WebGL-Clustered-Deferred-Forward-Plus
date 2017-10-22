// Super important reference: --> http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf
// Making a Struct factory --> https://stackoverflow.com/questions/502366/structs-in-javascript
// Enums in javascript --> https://stijndewitt.com/2014/01/26/enums-in-javascript/

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from './AABB'

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
    // Update the cluster texture with the count and indices of the lights in each cluster

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
    var ActualHalfwayPoint = this._xSlices/2;

    var upVec = vec3.create();
    upVec.x = 0;
    upVec.y = 1;
    upVec.z = 0;
    var farPos = vec3.create();
    farPos.y = 0;
    farPos.z = -1;

    var low, high, keepSearching;

    for (let i=0; i<numLights; i++)
    {
      var lightPos = vec3.create();
      lightpos[0] = scene.lights[i].position[0];
      lightpos[1] = scene.lights[i].position[1];
      lightpos[2] = scene.lights[i].position[2];

      var lightAABB = new AABB();
      lightAABB.calcAABB_PointLight(lightPos, scene.lights[i].radius);

      // now using the min and max of the AABB determine which clusters the light lies in
      // x and y planes do not have an angle to them and so can be done similar to grid indexing for boids
      // z under goes perspective correction and so the ZY planes are angled
      
      var lightClusterMinBoundIndex_x, lightClusterMaxBoundIndex_x;
      //binary search for lightClusterMinBound location
      
      keepSearching = true;
      farPos.x = 0;
      low = 0;
      high = this._xSlices;
      //searching for minClusterBounds
      while(keepSearching)
      {        
        if(high>=low)
        {
          var mid = low + (high - 1)/2;
          farPos.x = (mid-actualHalfwayPoint)*xStride;

          var cam_MinusYZ_planeNor = calcPlaneNormal(farPos, upVec);
          var cam_MinusYZ_plane = createPlane(cam_MinusYZ_planeNor, farPos);
          //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

          var minSD = DistanceToPoint(cam_MinusYZ_plane, lightAABB.min); //min signed Distance
          var scaledSD = Math.floor(Math.abs(minSD)/xStride) * ClassifyPointwithSD(d);

          if(scaledSD == 0)
          {
            lightClusterMinBoundIndex_x = Math.floor((farPos.x+1)/xStride);
            keepSearching = false;
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
          lightClusterMinBoundIndex_x = Math.floor((farPos.x+1)/xStride);
          keepSearching = false;
        }        
      }

      keepSearching = true;
      farPos.x = 0;
      low = lightClusterMinBoundIndex;
      high = this._xSlices;
      //searching for maxClusterBounds
      while(keepSearching)
      {        
        if(high>=low)
        {
          var mid = low + (high - 1)/2;
          farPos.x = (mid-actualHalfwayPoint)*xStride;

          var cam_MinusYZ_planeNor = calcPlaneNormal(farPos, upVec);
          var cam_MinusYZ_plane = createPlane(cam_MinusYZ_planeNor, farPos);
          //now that we have the furthest most plane, jump to the closest planes that surround the AABB of the light

          var minSD = DistanceToPoint(cam_MinusYZ_plane, lightAABB.min); //min signed Distance
          var scaledSD = Math.floor(Math.abs(minSD)/xStride) * ClassifyPointwithSD(d);

          if(scaledSD == 0)
          {
            lightClusterMaxBoundIndex_x = Math.floor((farPos.x+1)/xStride);
            keepSearching = false;
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
          lightClusterMaxBoundIndex_x = Math.floor((farPos.x+1)/xStride);
          keepSearching = false;
        }        
      }

      //now find the other two bounds rather easily using the AABB and then fill those clusters with lights
      for (let z = 0; z < this._xSlices; ++z) //CHANGE TO USE AABB
      {
        for (let y = 0; y < this._ySlices; ++y) //CHANGE TO USE AABB
        {
          for (let x = lightClusterMinBoundIndex_x; x <= lightClusterMinBoundIndex_x; ++x) 
          {

          }
        }
      }

    }

    this._clusterTexture.update();
  }
}