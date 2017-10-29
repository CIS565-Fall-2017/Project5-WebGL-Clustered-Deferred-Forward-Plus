import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 500;

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
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    // let h_fov = camera.fov;
    // let v_fov = h_fov / camera.aspect;
    let v_fov = camera.fov;
    let h_fov = v_fov * camera.aspect;
    let z_range = camera.far - camera.near;
    let x_stride = h_fov/this._xSlices;
    let y_stride = v_fov/this._ySlices;
    let z_stride = z_range/this._zSlices;
    let DEG2RAD = Math.PI / 180;
    let z_vec = vec3.fromValues(0,0,1.0);
    let y_vec = vec3.fromValues(0,1.0,0);
    let x_vec = vec3.fromValues(1.0,0,0);
    let origin = vec3.fromValues(0,0,0);
    for(let l_idx = 0; l_idx < NUM_LIGHTS; ++l_idx) {
      let pos = scene.lights[l_idx].position;
      let light_w_pos = vec4.fromValues(pos[0],pos[1],pos[2],1);
      let light_c_pos = vec4.create();
      vec4.transformMat4(light_c_pos,light_w_pos,viewMatrix);


      let z_start = Math.floor((-(light_c_pos[2]) - LIGHT_RADIUS - camera.near)/z_stride);
      if(z_start < 0) {
        z_start = 0;
      } 
      let z_end = Math.floor((-(light_c_pos[2]) + LIGHT_RADIUS - camera.near)/z_stride) + 1;
      if(z_end > this._zSlices) {
        z_end = this._zSlices;
      }

      // z_start = 0;
      // z_end = this._zSlices;

      let curr_z = (z_start * z_stride) + camera.near;

    for (let z = z_start; z < z_end; ++z) {
      let z_slice = -(z * z_stride) - camera.near;
      let z_slice_p1 = -((z + 1) * z_stride) - camera.near;

      // Z CLUSTER BACK BOUND
      let zp_norm = vec3.clone(z_vec);
      vec3.negate(zp_norm,zp_norm);
      let zp_point = vec3.fromValues(0, 0, z_slice_p1);
      let zp_plane = vec4.fromValues(0,0,zp_norm[2],-zp_point[2] * zp_norm[2]);
      //vec4.normalize(zp_plane,zp_plane);
      
      // Z CLUSTER FRONT BOUND
      let zn_norm = vec3.clone(z_vec);
      let zn_point = vec3.fromValues(0, 0, z_slice);
      let zn_plane = vec4.fromValues(0,0,zn_norm[2],-zn_point[2] * zn_norm[2]);
      //vec4.normalize(zn_plane,zn_plane);


      let y_upperbound = Math.abs(curr_z * Math.tan(v_fov * DEG2RAD / 2.0));
      let y_temp_stride = y_upperbound * 2.0 / this._ySlices;

      let y_start = Math.floor(((light_c_pos[1] - LIGHT_RADIUS ) + y_upperbound) / y_temp_stride) - 9;
      if(y_start < 0) {
        y_start = 0;
      }
      let y_end = Math.floor(((light_c_pos[1] + LIGHT_RADIUS ) + y_upperbound) / y_temp_stride) + 1;
      if(y_end > this._ySlices) {
        y_end = this._ySlices;
      }

      y_start = 0;
      //y_end = this._ySlices;

      for (let y = y_start; y < y_end; ++y) {
        let y_slice = (y * y_stride) - (v_fov/2.0);
        let y_slice_p1 = ((y + 1) * y_stride) - (v_fov/2.0);

          // Y CLUSTER UPPER BOUND
          let yp_norm = vec3.create();
          vec3.rotateX(yp_norm, y_vec, origin, y_slice_p1 * DEG2RAD);
          let yp_plane = vec4.fromValues(yp_norm[0],yp_norm[1],yp_norm[2],0);
          //vec4.normalize(yp_plane,yp_plane);

          // Y CLUSTER LOWER BOUND
          let yn_norm = vec3.fromValues(0,-1,0);
          vec3.rotateX(yn_norm, yn_norm, origin, y_slice * DEG2RAD);
          let yn_plane = vec4.fromValues(yn_norm[0],yn_norm[1],yn_norm[2],0);
          //ec4.normalize(yn_plane,yn_plane);

          let x_upperbound = curr_z * Math.tan(h_fov * DEG2RAD / 2.0);
          let x_temp_stride = x_upperbound * 2.0 / this._xSlices;
    
          let x_start = Math.floor(((light_c_pos[0] - LIGHT_RADIUS ) + x_upperbound) / x_temp_stride) - 1;
          if(x_start < 0) {
            x_start = 0;
          }
          let x_end = Math.floor(((light_c_pos[0] + LIGHT_RADIUS ) + x_upperbound) / x_temp_stride) + 4;
          if(x_end > this._xSlices) {
            x_end = this._xSlices;
          }

        //x_start = 0;
        //x_end = this._xSlices;

        for (let x = x_start; x < x_end; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          //HI

          //BASED ON THE X, Y, Z, FIGURE OUT WHAT PLANES WE NEED
          let x_slice = (x * x_stride) - (h_fov/2.0);
          let x_slice_p1 = ((x + 1) * x_stride) - (h_fov/2.0);

          // X CLUSTER RIGHT BOUND
          let xp_norm = vec3.create();
          vec3.rotateY(xp_norm, x_vec, origin, -x_slice_p1 * DEG2RAD);
          let xp_plane = vec4.fromValues(xp_norm[0],xp_norm[1],xp_norm[2],0);
          //vec4.normalize(xp_plane,xp_plane);

          // X CLUSTER LEFT BOUND
          let xn_norm = vec3.fromValues(-1,0,0);
          vec3.rotateY(xn_norm, xn_norm, origin, -x_slice * DEG2RAD);
          let xn_plane = vec4.fromValues(xn_norm[0],xn_norm[1],xn_norm[2],0);
          //vec4.normalize(xn_plane,xn_plane);
            
            //X LEFT
            //BOOLS FOR DEBUGGING PURPOSES
            let bool_xp = true;
            let bool_xn = true;
            let bool_yp = true;
            let bool_yn = true;
            let bool_zp = true;
            let bool_zn = true;
            //BOOLS FOR DEBUGGING PURPOSES

            let dist_xp = vec4.dot(light_c_pos,xp_plane);
            if(dist_xp > LIGHT_RADIUS) {continue;}
            //X RIGHT
            let dist_xn = vec4.dot(light_c_pos,xn_plane);
            if(dist_xn > LIGHT_RADIUS) {continue;}

            //Y LOWER
            let dist_yp = vec4.dot(light_c_pos,yp_plane);
            if(dist_yp > LIGHT_RADIUS) {continue;}

            //Y UPPER
            let dist_yn = vec4.dot(light_c_pos,yn_plane);
            if(dist_yn > LIGHT_RADIUS) {continue;}

            //Z BACK
            let dist_zp = vec4.dot(light_c_pos,zp_plane);
            if(dist_zp > LIGHT_RADIUS) {continue;}
            //Z FRONT
            let dist_zn = vec4.dot(light_c_pos,zn_plane);
            if(dist_zn > LIGHT_RADIUS) {continue;}

            
            let num_lights_in_cluster = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]
            //if(bool_xp && bool_xn && bool_yp && bool_yn && bool_zp && bool_zn) {
              if(num_lights_in_cluster < MAX_LIGHTS_PER_CLUSTER){
                let texel = Math.floor((num_lights_in_cluster + 1)/4.0);
                let texel_idx = this._clusterTexture.bufferIndex(i, texel);
                let float_idx = (num_lights_in_cluster + 1) - (texel * 4);
                this._clusterTexture.buffer[texel_idx + float_idx] = l_idx;
                ++num_lights_in_cluster;
              }
            //} 


          //GET THE TOTAL NUMBER OF LIGHTS IN THIS CLUSTER

          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = num_lights_in_cluster;
        }
      }
    }
    //FOR EACH OF THE FOUR PLANES, CHECK IF LIGHT IS "IN"
  }

    this._clusterTexture.update();
  }
}