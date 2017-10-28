import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

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

    let h_fov = camera.fov;
    let v_fov = h_fov / camera.aspect;
    let z_range = camera.far - camera.near;
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          
          let num_lights_in_cluster = 0;
          //HI

          //BASED ON THE X, Y, Z, FIGURE OUT WHAT PLANES WE NEED
          let DEG2RAD = Math.PI / 180;
          let x_slice = (x/this._xSlices) * h_fov - (h_fov/2.0);
          let x_slice_p1 = ((x + 1)/this._xSlices) * h_fov - (h_fov/2.0);
          let y_slice = (y/this._ySlices) * v_fov - (v_fov/2.0);
          let y_slice_p1 = ((y + 1)/this._ySlices) * v_fov - (v_fov/2.0);
          let z_slice = -(z/this._zSlices) * (camera.far - camera.near) - camera.near;
          let z_slice_p1 = -((z + 1)/this._zSlices) * (camera.far - camera.near) - camera.near;

          let z_vec = vec3.fromValues(0,0,1);
          let y_vec = vec3.fromValues(0,1,0);
          let x_vec = vec3.fromValues(1,0,0);

          let origin = vec3.fromValues(0,0,0);
          // X CLUSTER RIGHT BOUND
          let xp_norm = vec3.create();
          vec3.rotateY(xp_norm, x_vec, origin, -x_slice_p1 * DEG2RAD);
          let xp_plane = vec4.fromValues(xp_norm[0],xp_norm[1],xp_norm[2],0);

          // X CLUSTER LEFT BOUND
          let xn_norm = vec3.create();
          vec3.rotateY(xn_norm, x_vec, origin, -x_slice * DEG2RAD);
          vec3.negate(xn_norm,xn_norm);
          let xn_plane = vec4.fromValues(xn_norm[0],xn_norm[1],xn_norm[2],0);

          // Y CLUSTER UPPER BOUND
          let yp_norm = vec3.create();
          vec3.rotateX(yp_norm, y_vec, origin, y_slice_p1 * DEG2RAD);
          let yp_plane = vec4.fromValues(yp_norm[0],yp_norm[1],yp_norm[2],0);

          // Y CLUSTER LOWER BOUND
          let yn_norm = vec3.create();
          vec3.rotateX(yn_norm, y_vec, origin, y_slice * DEG2RAD);
          vec3.negate(yn_norm,yn_norm);
          let yn_plane = vec4.fromValues(yn_norm[0],yn_norm[1],yn_norm[2],0);

          // Z CLUSTER BACK BOUND
          let zp_norm = vec3.clone(z_vec);
          vec3.negate(zp_norm,zp_norm);
          let zp_point = vec3.fromValues(0, 0, z_slice_p1);
          let zp_plane = vec4.fromValues(0,0,zp_norm[2],-zp_point[2] * zp_norm[2]);

          // Z CLUSTER FRONT BOUND
          let zn_norm = vec3.clone(z_vec);
          let zn_point = vec3.fromValues(0, 0, z_slice);
          let zn_plane = vec4.fromValues(0,0,zn_norm[2],-zn_point[2] * zn_norm[2]);

          //FOR EACH LIGHT, TRANSFORM INTO VIEW SPACE
          for(let l_idx = 0; l_idx < NUM_LIGHTS; l_idx++) {
            let pos = scene.lights[l_idx].position;
            let light_w_pos = vec4.fromValues(pos[0],pos[1],pos[2],1);
            let light_c_pos = vec4.create();
            vec4.transformMat4(light_c_pos,light_w_pos,viewMatrix);
            
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
            if(dist_yn > LIGHT_RADIUS) {continue}

            //Z BACK
            let dist_zp = vec4.dot(light_c_pos,zp_plane);
            if(dist_zp > LIGHT_RADIUS) {continue;}
            //Z FRONT
            let dist_zn = vec4.dot(light_c_pos,zn_plane);
            if(dist_zn > LIGHT_RADIUS) {continue;}

            
            //if(bool_xp && bool_xn && bool_yp && bool_yn && bool_zp && bool_zn) {
              if(num_lights_in_cluster < MAX_LIGHTS_PER_CLUSTER){
                let texel = Math.floor((num_lights_in_cluster + 1)/4.0);
                let texel_idx = this._clusterTexture.bufferIndex(i, texel);
                let float_idx = (num_lights_in_cluster + 1) - (texel * 4);
                this._clusterTexture.buffer[texel_idx + float_idx] = l_idx;
                ++num_lights_in_cluster;
              }
            //} 


            //FOR EACH OF THE FOUR PLANES, CHECK IF LIGHT IS "IN"
          }
          //GET THE TOTAL NUMBER OF LIGHTS IN THIS CLUSTER

          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = num_lights_in_cluster;
        }
      }
    }

    this._clusterTexture.update();
  }
}