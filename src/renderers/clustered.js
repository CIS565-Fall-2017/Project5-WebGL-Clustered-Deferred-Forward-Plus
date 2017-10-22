import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
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

  createPlane(v0, v1, v2) {
    let norm = vec3.create();
    norm = vec3.cross(norm, v1 - v0, v2 - v0);
    norm = vec3.normalize(norm, norm);
    return norm;
  }

  distanceFromPlane(n, p0, v0) {
    return vec3.dot(n, p0 - v0) / vec3.length(n);
  }

  updateClusters(camera, viewMatrix, scene) {
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

    // create planes (2 or 4 or 1??) (point, normal ??) - 4 in total probably..
    // 
    // loop through the lights and compare the perpedicular dist vs. radius of all planes..

    // Exponential depth...
    // http://www.humus.name/Articles/PracticalClusteredShading.pdf
    // [0.1, 5.0, 6.8, 9.2, 12.6, 17.1, 23.2, 31.5, 42.9, 58.3, 79.2, 108, 146, 199, 271, 368, 500]

    //export const canvas = document.getElementById('canvas');

    // var assigned = [];
    // for(var i=0; i<MAX_LIGHTS_PER_CLUSTER; ++i) {
    //   assigned.push(true);
    // }

    //let expZ = [0.1, 5.0, 6.8, 9.2, 12.6, 17.1, 23.2, 31.5, 42.9, 58.3, 79.2, 108, 146, 199, 271, 368, 500];
    let h = canvas.height;
    let w = canvas.width;
    

    let v0, norm_1, norm_2, norm_3, norm_4; // variables representing planes..
    let v1_1, v1_2, v1_3, v1_4, v2_1, v2_2, v2_3, v2_4, yScaled, xScaled; // helper vars..
    v0 = camera.position;

    let zScale = 1000/this._zSlices;
    for (let z = 0; z < this._zSlices; ++z) {
      let z1 = z * zScale; //expZ[z];
      let z2 = z1 + zScale; //expZ[z + 1];
      for (let y = 0; y < this._ySlices; ++y) {
        // create 2 Y planes
        // 2 points - point and (anything, y, anything or 1000(fcp)), (anything + something, y, anything or 1000(fcp))
        //vec3 rpos1();

        // http://geomalgorithms.com/a04-_planes.html
        // plane: ax + by + cz + d = 0
        // for n=(a,b,c), P=(x,y,z), d=-(n.V0), eq. or plane is
        // n*(P-V0) = ax + by + cz + d = 0
        // here, d is the distance of point from the plane..

        // LOWER PLANE
        if (y === 0) {
          yScaled = 0;
          v1_1 = vec3.fromValues(0, yScaled, 1000);
          v2_1 = vec3.fromValues(10, yScaled, 1000);
          norm_1 = this.createPlane(v0, v1_1, v2_1);
        }
        else {
          norm_1 = norm_2; // use from last iteration..
        }

        // UPPER PLANE
        yScaled += h/this._ySlices;
        v1_2 = vec3.fromValues(0, yScaled, 1000);
        v2_2 = vec3.fromValues(10, yScaled, 1000);
        norm_2 = this.createPlane(v0, v1_2, v2_2);

        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          // this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          // LEFT PLANE
          if (x === 0) {
            xScaled = 0;
            v1_3 = vec3.fromValues(xScaled, 0, 1000);
            v2_3 = vec3.fromValues(xScaled, 10, 1000);
            norm_3 = this.createPlane(v0, v1_3, v2_3);
          }
          else {
            norm_3 = norm_4;
          }

          // RIGHT PLANE
          xScaled += w/this._xSlices;
          v1_4 = vec3.fromValues(xScaled, 0, 1000);
          v2_4 = vec3.fromValues(xScaled, 10, 1000);
          norm_4 = this.createPlane(v0, v1_4, v2_4);

          // create 2 X planes
          // loop and assign lights
          // let ind = 1; // index of next pos to insert the light index..
          for(let l=0; l<MAX_LIGHTS_PER_CLUSTER; l++) {
            //let dist = -norm_1.x * 
            // if(assigned[l] === true) {
            //   continue;
            // }

            let p0 = vec4.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
            vec4.transformMat4(p0, p0, viewMatrix);
            
            // Z planes check
            if (p0.z < z1 || p0 > z2) {
              continue;
            }

            // LOWER PLANE
            let dist = this.distanceFromPlane(norm_1, p0, v0);
            if (dist > scene.LIGHT_RADIUS) {
              continue;
            }

            // UPPER PLANE
            dist = this.distanceFromPlane(norm_2, p0, v0);
            if (dist > scene.LIGHT_RADIUS) {
              continue;
            }

            // lEFT PLANE
            dist = this.distanceFromPlane(norm_3, p0, v0);
            if (dist > scene.LIGHT_RADIUS) {
              continue;
            }

            // RIGHT PLANE
            dist = this.distanceFromPlane(norm_4, p0, v0);
            if (dist > scene.LIGHT_RADIUS) {
              continue;
            }

            let numLights = ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            let texIdx = Math.floor(numLights / 4.0);
            let offset = numLights - texIdx * 4.0;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, texIdx) + offset] = l;
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}
