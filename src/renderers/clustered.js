import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 250;

//Gets the normal for x cluster calculations
function set_normal_x(plane_normal, cluster_plane_x) {
    let c = Math.sqrt(1 + (cluster_plane_x*cluster_plane_x));
    //Zero out y cuz it's normal along x
    vec3.set(plane_normal, 1 / c, 0, -cluster_plane_x/ c);
}

//Gets the normal for y cluster calculations
function set_normal_y(plane_normal, cluster_plane_y) {
    let c = Math.sqrt(1 + (cluster_plane_y*cluster_plane_y));
    //Zero out x cuz it's normal along y
    vec3.set(plane_normal, 0, 1 / c, -cluster_plane_y/ c);
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
   // Using the diagram Austin drew in class, we need to get the 
   // Distance from a point (light_pos) to a plane (chunk boundaries)
   // Using this reference: http://bit.ly/GPU-HW5-Ref1

   for (let z = 0; z < this._zSlices; ++z) {
     for (let y = 0; y < this._ySlices; ++y) {
       for (let x = 0; x < this._xSlices; ++x) {
         let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
         // Reset the light count to 0 for every cluster
         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
       }
     }
   }
   
   // Get Constants:
   //How much to offset each x and y location
   const half_y_dim = Math.tan((camera.fov*0.5) * (Math.PI/180.0));
   const y_offset = -half_y_dim;
   const x_offset = y_offset * camera.aspect;
   
   //Cluster width, height, and depth (respectively)
   const cluster_x = ((-y_offset) * 2.0 / this._xSlices) * camera.aspect;
   const cluster_y = ((-y_offset) * 2.0 / this._ySlices);
   const cluster_z = (camera.far - camera.near) / this._zSlices;
   
   // The Light position
   const light_pos = vec4.create();
  
  for(let i = 0; i < NUM_LIGHTS; ++i) {
       //Get Light Position in Camera/View Space
       vec4.set(light_pos, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
       vec4.transformMat4(light_pos, light_pos, viewMatrix);
       light_pos[2] *= -1.0;

       let light_radius = scene.lights[i].radius;

       //Start, End Cluster Indices
       let x_0 = 0, x_1 = this._xSlices;
       let y_0 = 0, y_1 = this._ySlices;
       let z_0 = 0, z_1 = this._zSlices;
       let plane_normal = vec3.create();

       /**
        * X CLUSTER STUFF
        */
       // X Cluster Start Evalutation
       for(let iter = 0; iter <= this._xSlices; iter++) {
           set_normal_x(plane_normal, x_offset+cluster_x*iter);
           if(vec3.dot(light_pos, plane_normal) < light_radius) {
               x_0 = Math.max(0, iter-1);
               break;
           }
       }

       // X Cluster End Evalutation
       for(let iter = x_0; iter < this.xSlices; iter++) {
           set_normal_x(plane_normal, x_offset+cluster_x* (iter+1));
           if(vec3.dot(light_pos, plane_normal) < -light_radius) {
               x_1 = iter;
               break;
           }
       }

      
       /**
        * Y CLUSTER STUFF
        */
       // Y Cluster Start Evalutation
       for(let iter = 0; iter <= this._ySlices; iter++) {
           set_normal_y(plane_normal, y_offset+cluster_y*iter);
           if(vec3.dot(light_pos, plane_normal) < light_radius) {
               y_0 = Math.max(0, iter-1);
               break;
           }
       }
       // Y Cluster End Evalutation
       for(let iter = y_0; iter < this.ySlices; iter++) {
           set_normal_y(plane_normal, y_offset+cluster_y*(iter+1));
           if(vec3.dot(light_pos, plane_normal) < -light_radius) {
               y_1 = iter;
               break;
           }
       }

      /**
        * Z CLUSTER STUFF:
      */
      let light_z = light_pos[2] - camera.near;
      z_0 = Math.floor((light_z - light_radius)  / cluster_z); 
      z_1 = Math.floor((light_z + light_radius)  / cluster_z); 

      if(z_0 < this._zSlices && z_1 >= 0) {
         // Assign lights to their clusters
         for(let x = x_0; x < x_1; x++) {
            for(let y = y_0; y < y_1; y++) {
                for(let z = z_0; z <= z_1; z++) {
                     let idx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
                     let lc_idx = this._clusterTexture.bufferIndex(idx, 0);
                     let l_count = this._clusterTexture.buffer[lc_idx];
         
                     if(++l_count > MAX_LIGHTS_PER_CLUSTER) { break;}
                     
                     this._clusterTexture.buffer[lc_idx] = l_count;
                     let texel = Math.floor(l_count / 4.0);
                     let component_offset = l_count - (texel*4);
                     this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, texel) + component_offset] = i;
                 }
             }
         }
       }

  }


    this._clusterTexture.update();
  }
}

/*** REJECTED CODE: LEFT FOR LEGACY PURPOSES

I Tried To Do it Using Avalanche's slide notes. For some reason that failed.
Instead I'm doing it using what Austin explained in recitation

// distance between light and the x_plane
function x_distance(dx, light_pos, width) {
    dx = (light_pos[0] - (width * light_pos[2]))
          / Math.sqrt(1.0 + (width * width));
    return dx;
}

// distance between light and the y_plane
function y_distance(dy, light_pos, height) {
    dy = (light_pos[1] - (height * light_pos[2]))
          / Math.sqrt(1.0 + (height * height));
    return dy;
}

function project_z(camera, z, z_slice_count) {
    if (z <= 1) {
        return camera.near;
    } else {
        const z_normalized = (parseFloat(z) - 1.0)
                    / (parseFloat(z_slice_count) - 1.0);

        return Math.exp(z_normalized * Math.log(camera.far - camera.near + 1.0)) + camera.near - 1.0;
    }
}

***/

/************

//   // Creating the lights because of the whole type-safety thing austin talked about
//   const light_pos = vec4.create();
//   
//   // How big the y-axis is
//   const y_dim = Math.tan((camera.fov * 0.5) * Math.PI / 180.0) * 2.0;
//   
//   //  Starting x and y
//   const y_offset = - y_dim / 2.0;
//   const x_offset = y_offset * camera.aspect;
//   
//   // chunk_i = how big a chunk is in dimension i
//   const cluster_x = camera.aspect * parseFloat(y_dim) / parseFloat(this._xSlices);
//   const cluster_y = (parseFloat(y_dim) / parseFloat(this._xSlices));
//   // const cluster_z = (camera.far - camera.near) / parseFloat(this._zSlices);
//   
//   for (let i = 0; i < NUM_LIGHTS; i++) {
//      //Get Light Position in Camera/View Space
//       vec4.set(light_pos, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
//       vec4.transformMat4(light_pos, light_pos, viewMatrix);
//       light_pos[2] *= -1.0
//   
//       let light_radius = scene.lights[i].radius;
//   
//   
//       let y_0 = 0; let y_end = this._ySlices;
//       let z_0 = 0; let z_end = this._zSlices;
//       let dx, dy;
//   
//       //Move x and squeeze in from the left
//       let x_0 = 0; let x_end = this._xSlices;
//       while (x_0 <= this._xSlices && x_distance(dx, light_pos, cluster_x * (x_0 + 1 - this._xSlices / 2.0)) > light_radius) {
//          x_0++;
//       }
//   
//       //Move x_end and squeeze in from the right
//       while (x_end >= x_0 && -x_distance(dx, light_pos, cluster_x * (x_end - 1 - this._xSlices / 2.0)) > light_radius) {
//           x_end--;
//       } 
//       x_end--;
//   
//       //Move x and squeeze in from the left
//       while (y_0 <= this._xSlices && y_distance(dy, light_pos, cluster_y * (y_0 + 1 - this._ySlices / 2.0)) > light_radius) {
//           y_0++;
//       }
//   
//       //Move x_end and squeeze in from the right
//       while (y_end >= y_0 && -y_distance(dy, light_pos, cluster_y * (y_end - 1 - this._ySlices / 2.0)) > light_radius) {
//           y_end--;
//       }
//       y_end--;
//   
//       const min_z_radius = light_pos[2] - light_radius;
//       while (z_0 <= this._zSlices && z_view_space(camera, z_0 + 1, this._zSlices) <= min_z_radius) {
//           z_0++;
//       }
//       
//       const max_z_radius = light_pos[2] + light_radius;
//       while (z_end >= z_0 && z_view_space(camera, z_end - 1, this._zSlices) > max_z_radius) {
//           z_end--;
//       }
//       z_end +=2;
//   
//       for (let x = x_0; x <= x_end; x++) {
//           for (let y = y_0; y <= y_end; y++) {
//               for (let z = z_0; z <= z_end; z++) {
//                   //Cluster stuff
//                   let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
//                   let count_idx = this._clusterTexture.bufferIndex(i, 0);
//                   // Current lights in cluster + 1
//                   let light_count = this._clusterTexture.buffer[count_idx] +1;
//   
//                   if (light_count < MAX_LIGHTS_PER_CLUSTER) {
//                       this._clusterTexture.buffer[count_idx] = light_count;
//                       let light_tex = Math.floor(light_count / 4.0);
//                       let tex_idx   = this._clusterTexture.bufferIndex(i, light_tex);
//                       let component_offset = light_count - light_tex * 4;
//   
//                       this._clusterTexture.buffer[tex_idx + component_offset] = i;
//                   }
//   
//               }//for z
//           } //for y
//       } //for x
//   
//   } //End for each light
    //}

**/
