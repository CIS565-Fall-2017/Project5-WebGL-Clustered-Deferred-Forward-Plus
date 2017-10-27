import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

import { canvas } from '../init';

/*
  Since so far, I just naviely evenly divide view space
  when total light number incease, this number should also increase!
  Say, change it to 1000 when NUM_LIGHTS in scene.js is 1000
*/
export const MAX_LIGHTS_PER_CLUSTER = 100;

// Used in cluster update, 1 offset (in X, Y) is acceptable to eliminate some erros arised by accuracy
const cluster_adjustment_x_y = 2;
const cluster_adjustment_z   = 0;

// Adapted from paper Clusterd Defferred and Forwar Shading by Olsson
//function getCulsterIndexK(z_EyeSpace, nearClip, fovby2, ySlices) {
  //let deg2rad = Math.PI/180.0;

  //let tmp1 = Math.log(-z_EyeSpace / nearClip) / Math.LN10; // convert from natural logarithm to a base 10 logarithm
  //let tmp2 = Math.log(1.0 + 2.0 * Math.tan(fovby2 * deg2rad) / ySlices) / Math.LN10; // convert from natural logarithm to a base 10 logarithm

  //return Math.floor(0.12 * tmp1 / tmp2); // 0.2 is a cluster depth division scale

  //return 0.0;
//}

// Slice view depth in a log way
function getCulsterDepthIndex(viewSpaceDepth, nearClip) {
  if(viewSpaceDepth < nearClip){
    return -1.0;
  }
  else{
      //2.15 is calculated based on near and far clip
      //near Clip : 0.1
      //far  Clip : 1000.0
      return Math.floor(2.15 * Math.log(viewSpaceDepth - nearClip + 1.0));
  }
}

function clamp(n, min, max){
  return Math.max(min, Math.min(n, max));
}

// math here, similar triangle is used
// to get the distance of centroid of the sphere(of point light) to plane
// function distanceToPlaneY(theta_radius_y, pointLightPos_ViewSpace){
//   var y1 = Math.tan(theta_radius_y) * (-pointLightPos_ViewSpace[2]);
//   var tmp = Math.abs(y1 - pointLightPos_ViewSpace[1]); // delta Y
//
//   return Math.cos(theta_radius_y) * tmp;
// }
//
// function distanceToPlaneX(theta_radius_x, pointLightPos_ViewSpace){
//   var x1 = Math.tan(theta_radius_x) * (-pointLightPos_ViewSpace[2]);
//   var tmp = Math.abs(x1 - pointLightPos_ViewSpace[0]); // delta X
//
//   return Math.cos(theta_radius_x) * tmp;
// }


export default class ClusteredRenderer {

  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

  }


  updateClusters(camera, viewMatrix, scene, viewProjectionMatrix) {
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

    // Just evenly divide cluster in view space(frustrum) here
    //var cluster_depth_array_stride = (camera.far - camera.near) / this._zSlices;

    // Update the buffer used to populate the texture packed with light data
    for (let i = 0; i < NUM_LIGHTS; ++i) {

      // Get light view space position
      let lightPos = vec4.create();
      lightPos[0] = scene.lights[i].position[0];
      lightPos[1] = scene.lights[i].position[1];
      lightPos[2] = scene.lights[i].position[2];
      lightPos[3] = 1.0;

      // tranfomr light Pos from world to view space
      vec4.transformMat4(lightPos, lightPos, viewMatrix);

      var pointLightRadius = scene.lights[i].radius;


      // Clip sphere in z direction in view space
      // Set clipping threshold values
      var cluster_StartIdx_z_threshold = -lightPos[2] - pointLightRadius;
      var cluster_EndIdx_z_threshold   = -lightPos[2] + pointLightRadius;

      //var cluster_StartIdx_z = Math.floor((cluster_StartIdx_z_threshold - camera.near) / cluster_depth_array_stride);
      //var cluster_EndIdx_z   = Math.floor((cluster_EndIdx_z_threshold   - camera.near) / cluster_depth_array_stride);
      var cluster_StartIdx_z = getCulsterDepthIndex(cluster_StartIdx_z_threshold, camera.near);
      var cluster_EndIdx_z   = getCulsterDepthIndex(cluster_EndIdx_z_threshold,   camera.near);


      if(cluster_StartIdx_z > this._zSlices + cluster_adjustment_z || cluster_EndIdx_z < -cluster_adjustment_z){ continue; } // culling
      cluster_StartIdx_z = clamp(cluster_StartIdx_z - cluster_adjustment_z, 0, this._zSlices - 1);
      cluster_EndIdx_z   = clamp(cluster_EndIdx_z + cluster_adjustment_z,   0, this._zSlices - 1);


/*
      let cluster_StartIdx_z = 0; // 0 -> this._zSlices - 1
      let cluster_EndIdx_z = this._zSlices; // 0 -> this._zSlices - 1

      let cluster_depth_distance = camera.near;
      while(cluster_StartIdx_z <= this._zSlices){
        if(cluster_depth_distance >= cluster_StartIdx_z_threshold){
          break;
        }
        cluster_depth_distance += cluster_depth_array_stride;
        cluster_StartIdx_z++;
      }
      if(cluster_StartIdx_z != 0){cluster_StartIdx_z--;}

      cluster_depth_distance= camera.far;
      while(cluster_EndIdx_z >= cluster_StartIdx_z){
        if(cluster_depth_distance <= cluster_EndIdx_z_threshold){
          break;
        }
        cluster_depth_distance -= cluster_depth_array_stride;
        cluster_EndIdx_z--;
      }
      if(cluster_EndIdx_z == this._zSlices){cluster_EndIdx_z--;}
      else if(cluster_EndIdx_z != this._zSlices - 1){cluster_EndIdx_z++;}
*/


      // should be in the view space
      let lightPos_vec3 = vec3.create();
      lightPos_vec3[0] = lightPos[0];
      lightPos_vec3[1] = lightPos[1];
      lightPos_vec3[2] = -lightPos[2]; // to positve
      let lightCentroidDistance = vec3.length(lightPos_vec3);

      var cluster_StartIdx_x;
      var cluster_EndIdx_x;
      var cluster_StartIdx_y;
      var cluster_EndIdx_y;

      // If eye is in the light (sphere)
      if(lightCentroidDistance <= pointLightRadius){
        cluster_StartIdx_x = 0;
        cluster_EndIdx_x = this._xSlices - 1;

        cluster_StartIdx_y = 0;
        cluster_EndIdx_y = this._ySlices - 1;
      }
      // If eye is outside the light (sphere)
      else{
        /*
          This is one of the several cluster assignment methods I try.
          It's based on pure angle, which have the best effect here.
          Other methods like projecting sphere / Bounding box of light to screen,
          or calculating distance to division plane (X, Y) all have some side effects,
          and don't run very well in my case
        */
        let rad2deg = 180.0 / Math.PI;

        let deltaAngle = rad2deg * Math.asin(pointLightRadius / lightCentroidDistance); // should always between 0 -> PI/2 (0->90)
        let startAngle = -camera.fov / 2.0;

        //handle x direction, ignore y, on the x-z plane
        let centroidAngle = rad2deg * Math.atan2(lightPos_vec3[0], lightPos_vec3[2]);
        let minAngle = centroidAngle - deltaAngle;
        let maxAngle = centroidAngle + deltaAngle;

        let x_angle_stride = camera.fov / this._xSlices;
        cluster_StartIdx_x = Math.floor((minAngle - startAngle) / x_angle_stride);
        cluster_EndIdx_x   = Math.floor((maxAngle - startAngle) / x_angle_stride);
        if(cluster_StartIdx_x > this._xSlices + cluster_adjustment_x_y || cluster_EndIdx_x < -cluster_adjustment_x_y){ continue; } // culling
        cluster_StartIdx_x = clamp(cluster_StartIdx_x - cluster_adjustment_x_y, 0, this._xSlices - 1);
        cluster_EndIdx_x   = clamp(cluster_EndIdx_x + cluster_adjustment_x_y,   0, this._xSlices - 1);

        //handle y direction, ignore x, on the y-z plane
        centroidAngle = rad2deg * Math.atan2(lightPos_vec3[1], lightPos_vec3[2]);
        minAngle = centroidAngle - deltaAngle;
        maxAngle = centroidAngle + deltaAngle;

        let y_angle_stride = camera.fov / this._ySlices;
        cluster_StartIdx_y = Math.floor((minAngle - startAngle) / y_angle_stride);
        cluster_EndIdx_y   = Math.floor((maxAngle - startAngle) / y_angle_stride);
        if(cluster_StartIdx_y > this._ySlices + cluster_adjustment_x_y || cluster_EndIdx_y < -cluster_adjustment_x_y){ continue; } // culling
        cluster_StartIdx_y = clamp(cluster_StartIdx_y - cluster_adjustment_x_y, 0, this._ySlices - 1);
        cluster_EndIdx_y   = clamp(cluster_EndIdx_y + cluster_adjustment_x_y,   0, this._ySlices - 1);
      }


      // loop through clusters in clipped z direction
      for (let z = cluster_StartIdx_z; z <= cluster_EndIdx_z; ++z) {
/*
          // Clip based on dividing planes of view frustrum
          // this is independent of depth
          let deg2rad = Math.PI / 180.0;
          let angle_stride_y = camera.fov / this._ySlices;
          let angle_stride_x = camera.fov / this._xSlices;

          // x direction
          let cluster_StartIdx_x = 0; // should between 0 -> this._xSlices - 1 finally
          let cluster_EndIdx_x = this._xSlices; // 0 -> this._xSlices - 1

          let view_angle_x = -camera.fov / 2.0;
          while(cluster_StartIdx_x <= this._xSlices){
            if(distanceToPlaneX(view_angle_x * deg2rad, lightPos) <= pointLightRadius){
              break;
            }
            view_angle_x += angle_stride_x;
            cluster_StartIdx_x ++;
          }
          if(cluster_StartIdx_x > this._xSlices){continue;} // no dividing plane is in the sphere
          if(cluster_StartIdx_x != 0){cluster_StartIdx_x--;} // 0 -> this._xSlices - 1

          view_angle_x = camera.fov / 2.0;
          while(cluster_EndIdx_x >= cluster_StartIdx_x){
            if(distanceToPlaneX(view_angle_x * deg2rad, lightPos) <= pointLightRadius){
              break;
            }
            view_angle_x -= angle_stride_x;
            cluster_EndIdx_x --;
          }
          if(cluster_EndIdx_x == this._xSlices){cluster_EndIdx_x--;}
          else if(cluster_EndIdx_x != this._xSlices - 1){cluster_EndIdx_x++;}

          console.log("start idx x");
          console.log(cluster_StartIdx_x);
          console.log("end idx x");
          console.log(cluster_EndIdx_x);

          // Y direction
          let cluster_StartIdx_y = 0; // 0 -> this._ySlices - 1
          let cluster_EndIdx_y = this._ySlices; // 0 -> this._ySlices - 1

          let view_angle_y = -camera.fov / 2.0;
          while(cluster_StartIdx_y <= this._ySlices){
            if(distanceToPlaneY(view_angle_y * deg2rad, lightPos) <= pointLightRadius){
              break;
            }
            view_angle_y += angle_stride_y;
            cluster_StartIdx_y ++;
          }
          if(cluster_StartIdx_y > this._ySlices){continue;} // no dividing plane is in the sphere
          if(cluster_StartIdx_y != 0){cluster_StartIdx_y--;}

          view_angle_y = camera.fov / 2.0;
          while(cluster_EndIdx_y >= cluster_StartIdx_y){
            if(distanceToPlaneY(view_angle_y * deg2rad, lightPos) <= pointLightRadius){
              break;
            }
            view_angle_y -= angle_stride_y;
            cluster_EndIdx_y --;
          }
          if(cluster_EndIdx_y == this._ySlices){cluster_EndIdx_y--;}
          else if(cluster_EndIdx_y != this._ySlices - 1){cluster_EndIdx_y++;}
*/


          // fill cluster buffer
          for(let y = cluster_StartIdx_y; y <= cluster_EndIdx_y; ++y){
            for(let x = cluster_StartIdx_x; x <= cluster_EndIdx_x; ++x){
              let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;

               // assume account will always <= MAX_LIGHTS_PER_CLUSTER here
               let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)];
               count++; // add influenced count number
               let pixelIdx = Math.floor(count / 4.0);
               let offsetWithinPixel = count % 4;
               this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, pixelIdx) + offsetWithinPixel] = i;  // add an light index
               this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)] = count;      // update influenced light count for this cluster
            }
          }
      }

    }
    this._clusterTexture.update();
  }
}
