// Super important reference: --> http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf
// Making a Struct factory --> https://stackoverflow.com/questions/502366/structs-in-javascript
// Enums in javascript --> https://stijndewitt.com/2014/01/26/enums-in-javascript/

import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import AABB from '../AABB'

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
    this.tan_Vertical_FoV_by_2 = Math.tan(this.vertical_FoV * (Math.PI/180.0) * 0.5);
    var tan_Horizontal_FoV_by_2 = camera.aspect * this.tan_Vertical_FoV_by_2;    
    this.horizontal_FoV = 2 * Math.atan(tan_Horizontal_FoV_by_2) * (180.0/Math.PI);

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
    var plane = vec4.create();
    plane[0] = planeNormal[0];
    plane[1] = planeNormal[1];
    plane[2] = planeNormal[2];
    plane[3] = d;
    return plane;
  }

  calcPlaneNormal(pointOnPlane, perpendicularVectorOnPlane)
  {
    //returns a vec3
    var planeNormal = vec3.create();
    var normalizedVec = vec3.create();
    vec3.normalize(normalizedVec, pointOnPlane);
    vec3.cross(planeNormal, perpendicularVectorOnPlane, normalizedVec ); // this makes the normal of all the 
                                                                //planes be in the same hemisphere as the +ve x axis
    vec3.normalize(planeNormal, planeNormal);

    return planeNormal;
  }

  normalizePlane(plane)
  {
    //returns a Plane
    var mag;
    mag = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] = plane[0] / mag;
    plane[1] = plane[1] / mag;
    plane[2] = plane[2] / mag;
    plane[3] = plane[3] / mag;
  }

  distanceToPoint(plane, point)
  {
    //returns a signed Distance
    var SD = plane[0]*point[0] + plane[1]*point[1] + plane[2]*point[2] + plane[3];
    return SD;
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

    //instead of using the farclip plane as the arbitrary plane to base all our calculations and division splitting off of
    const yStride = (this.tan_Vertical_FoV_by_2 * 2.0 / this._ySlices);
    const xStride = (this.tan_Vertical_FoV_by_2 * 2.0 / this._xSlices) * camera.aspect;
    const zStride = (camera.far - camera.near) / this._zSlices;
    const yStrideStart = -this.tan_Vertical_FoV_by_2;
    const xStrideStart = -this.tan_Vertical_FoV_by_2 * camera.aspect;

    var xStartIndex, yStartIndex, zStartIndex;
    var xEndIndex, yEndIndex, zEndIndex;
    var lightPos, lightAABB;
    var clusterLightCount;

    for (let i=0; i<numLights; i++)
    {
      let lightRadius = scene.lights[i].radius;
      var _lightPos = vec4.fromValues(scene.lights[i].position[0], 
                                      scene.lights[i].position[1], 
                                      scene.lights[i].position[2], 
                                      1.0);
      vec4.transformMat4(_lightPos, _lightPos, viewMatrix); //World to View

      var lightPos = vec3.fromValues(_lightPos[0], 
                                     _lightPos[1], 
                                     _lightPos[2] );

      lightPos[2] *= -1; //camera looks down negative z, make z axis positive to make calculations easier
      
      // now using the min and max of the AABB determine which clusters the light lies in
      // x and y planes do not have an angle to them and so can be done similar to grid indexing for boids
      // z under goes perspective correction and so the ZY planes are angled

      //_____________________________________________________
      //__________Update Start and Stop Indices______________
      //_____________________________________________________
      xStartIndex = this._xSlices; xEndIndex = this._xSlices;
      yStartIndex = this._ySlices; yEndIndex = this._ySlices;
      zStartIndex = this._zSlices; zEndIndex = this._zSlices;

      var pointOnPlane = vec3.fromValues(0.0, 0.0, 1.0);
      var upVec = vec3.fromValues(0.0, 1.0, 0.0);
      var rightVec = vec3.fromValues(1.0, 0.0, 0.0);

      //________________________startX___________________________
      for(let i=0; i<this._xSlices; i++)
      {
        pointOnPlane[0] = xStrideStart + xStride*i;
        
        var planeNor = this.calcPlaneNormal(pointOnPlane, upVec);
        var plane = this.createPlane(planeNor, pointOnPlane);
        this.normalizePlane(plane);
        var minSD = this.distanceToPoint(plane, lightPos);

        if(minSD<lightRadius)
        {
          xStartIndex = Math.max(0, i-1); //i-1 because if it the plane is inside the radial 
          //extent of the light then the light also has an effect beyond that plane
          break;
        }
      }

      //________________________endX_____________________________
      for(let i=xStartIndex; i<this._xSlices; i++)
      {
        pointOnPlane[0] = xStrideStart + xStride*i;
        
        var planeNor = this.calcPlaneNormal(pointOnPlane, upVec);
        var plane = this.createPlane(planeNor, pointOnPlane);
        this.normalizePlane(plane);
        var minSD = this.distanceToPoint(plane, lightPos);

        if(minSD<-lightRadius) //-ve light radius because the signed Distance is defined along the normal of the plane
        {
          xEndIndex = Math.max(xStartIndex, i-1);; //i-1 because if it the plane is inside the radial 
          //extent of the light then the light also has an effect beyond that plane
          break;
        }
      }

      //debugger;
      pointOnPlane[0] = 0;
      //________________________startY___________________________
      for(let i=0; i<this._ySlices; i++)
      {
        pointOnPlane[1] = yStrideStart + yStride*i;
        
        var planeNor = this.calcPlaneNormal(pointOnPlane, rightVec);
        var plane = this.createPlane(planeNor, pointOnPlane);
        this.normalizePlane(plane);
        var minSD = this.distanceToPoint(plane, lightPos);

        if(minSD<lightRadius)
        {
          yStartIndex = Math.max(0, i-1); //i-1 because if it the plane is inside the radial 
          //extent of the light then the light also has an effect beyond that plane
          break;
        }
      }
      
      //________________________endY_____________________________
      for(let i=yStartIndex; i<this._ySlices; i++)
      {
        pointOnPlane[1] = yStrideStart + yStride*i;
        
        var planeNor = this.calcPlaneNormal(pointOnPlane, rightVec);
        var plane = this.createPlane(planeNor, pointOnPlane);
        this.normalizePlane(plane);
        var minSD = this.distanceToPoint(plane, lightPos);

        if(minSD<-lightRadius) //-ve light radius because the signed Distance is defined along the normal of the plane
        {
          yEndIndex = Math.max(yStartIndex, i-1); //i-1 because if it the plane is inside the radial 
          //extent of the light then the light also has an effect beyond that plane
          break;
        }
      }
      
      //________________________startZ___________________________
      let lightZnear = lightPos[2] - lightRadius;
      for(let i=0; i<this._zSlices; i++)
      {
          if(camera.near + i*zStride > lightZnear)
          {
              zStartIndex = Math.max(0, i-1);
              break;
          }
      }
      
      //________________________endZ_____________________________
      let lightZfar = lightPos[2] + lightRadius;
      for(let i=zStartIndex; i<this._zSlices; i++)
      {
        if(camera.near + i*zStride > lightZfar)
        {
            zEndIndex = Math.max(0, i-1);
            break;
        }
      }
      //_____________________________________________________
      //_____________________________________________________

      for (let z = zStartIndex; z <= zEndIndex; ++z)
      {
        for (let y = yStartIndex; y <= yEndIndex; ++y)
        {
          for (let x = xStartIndex; x <= xEndIndex; ++x) 
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
          }//x
        }//y
      }//z
    }//loop over lights

    this._clusterTexture.update();
  }
}