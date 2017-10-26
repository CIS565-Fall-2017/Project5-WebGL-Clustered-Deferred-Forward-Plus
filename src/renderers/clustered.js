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

  // function for computing adjacent and opposite side lengths for a RIGHT triangle
  computeComponents(dist) {
    // adj = 1; opp = d;
    let hyp = Math.sqrt(1 / (1 + dist*dist)); 
    return [hyp, dist*hyp]; // [cos,sin] // explaination in notes... todo: put an image in readme..
  }

  updateClustersOptimized2(camera, viewMatrix, scene) {
    //console.log("hi");
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // LOOP OVER THE LIGHTS
    // FIND THE NDC COORDS
    // DIRECTLY GET THE X AND Y - USE VIEWPROJ MATRIX ??
    // GET Z BASED ON THE DEPTH VALUE OR FROM AN ARRAY FOR EXPONENTIAL - USE VIEW MATRIX ONLY ??
    // LOOP AROUND AND EXPAND THE RANGE BASED ON THE RADIUS
    
    let rad = Math.PI / 180;
    let halfY = Math.tan((camera.fov / 2) * rad);
    let halfX = camera.aspect * halfY;

    let stepY = 2 * halfY / this._ySlices;
    let stepX = 2 * halfX / this._xSlices;
    let stepZ = (camera.far-camera.near) / this._zSlices; // has nothing to do with FOV...
    

    let lRad, lPos, lViewPos = vec4.create();

    // RUN THREE SEPERATE LOOPS FOR X,Y,Z INSTEAD OF NESTED...
    for(let l=0; l<MAX_LIGHTS_PER_CLUSTER; l++) {
      // let p0 = vec4.fromValues(scene.lights[l].position[0] - scene.LIGHT_RADIUS, 
      //                         scene.lights[l].position[1] - scene.LIGHT_RADIUS, 
      //                         scene.lights[l].position[2] - scene.LIGHT_RADIUS, 1.0);
      // let p0View = vec4.create();
      // let p0ViewProj = vec4.create();
      // vec4.transformMat4(p0View, p0, viewMatrix);
      // vec4.transformMat4(p0ViewProj, p0, viewProjMatrix); // persp projected coords in NDC

      // let p1 = vec4.fromValues(scene.lights[l].position[0] + scene.LIGHT_RADIUS, 
      //                         scene.lights[l].position[1] + scene.LIGHT_RADIUS, 
      //                         scene.lights[l].position[2] + scene.LIGHT_RADIUS, 1.0);
      // let p1View = vec4.create();
      // let p1ViewProj = vec4.create();
      // vec4.transformMat4(p1View, p1, viewMatrix);
      // vec4.transformMat4(p1ViewProj, p1, viewProjMatrix); // persp projected coords in NDC

      //let xmin, xmax, ymin, ymax, zmin, zmax;

      lRad = scene.lights[l].radius;
      lPos = vec4.fromValues(scene.lights[l].position[0], 
                            scene.lights[l].position[1], 
                            scene.lights[l].position[2], 1.0);
      lViewPos = vec4.transformMat4(lViewPos, lPos, viewMatrix);
      lPos[2] = -lPos[2]; // flip z because it is inverted..

      let xmin = -1; 
      let ymin = -1;
      let zmin = -1;
      let xmax = -1; 
      let ymax = -1;
      let zmax = -1;

      // compute zmin and zmax just by getting lpos.z-radius and lpos.z+radius...
      let zcam = lPos[2] - camera.near;
      zmin = Math.floor((zcam - lRad) / stepZ);
      if(zmin > this._zSlices) {
        continue;
      }
      zmax = Math.floor((zcam + lRad) / stepZ);
      if(zmax < 0) {
        continue;
      }

      for(let i = 0; i < this._xSlices; i++) {
        let nor = this.computeComponents(i * stepX - halfX);
        if (vec3.dot(lPos, vec3.fromValues(nor[0], 0, -nor[1])) < lRad) {
          xmin = i;
          break;
        }
      }

      for(let i = xmin + 1; i < this._xSlices; i++) {
        let nor = this.computeComponents(i * stepX - halfX);
        if (vec3.dot(lPos, vec3.fromValues(nor[0], 0, -nor[1])) > lRad) {
          xmax = i;
          break;
        }
      }

      for(let i = 0; i < this._ySlices; i++) {
        let nor = this.computeComponents(i * stepY - halfY);
        if (vec3.dot(lPos, vec3.fromValues(0, nor[0], -nor[1])) < lRad) {
          ymin = i;
          break;
        }
      }

      for(let i = ymin + 1; i < this._xSlices; i++) {
        let nor = this.computeComponents(i * stepY - halfY);
        if (vec3.dot(lPos, vec3.fromValues(0, nor[0], -nor[1])) > lRad) {
          ymax = i;
          break;
        }
      }

      if(xmin === -1 || xmax === -1 || ymin === -1 || ymax === -1) {
        continue;
      }

      xmin = Math.max(0, xmin);
      ymin = Math.max(0, ymin);
      zmin = Math.max(0, zmin);
      xmax = Math.min(this._xSlices, xmax);
      ymax = Math.min(this._ySlices, ymax);
      zmax = Math.min(this._zSlices, zmax);

      for (let z = zmin; z < zmax; ++z) {
        for (let y = ymin; y < ymax; ++y) {
          for (let x = xmin; x < xmax; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let numLights = ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];
            if(numLights > MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)]--;
              break;
            }
            let texIdx = Math.floor(numLights / 4);
            let offset = numLights - texIdx * 4.0;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, texIdx) + offset] = l;
          }
        }
      }


    }

    this._clusterTexture.update();
  }

  /*
  * Create an empty PLANES CACHE with a default null value
  * loop through the LIGHTS
  *   BINARY SEARCH IN X, Y, Z to find the matching slices for the center of the light
  *     if the neighboring 4 planes are not computed, compute them and store in PLANE CACHE
  *   go in -ve and +ve of all 3 dirs and check using cache if the light is inside the buckets
  *     stop and move on to the next light when all nearby buckets are covered..
  */
  updateClustersOptimized(camera, viewMatrix, scene) {
    //console.log("hi");
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    let h = canvas.height;
    let w = canvas.width;
    
    let v0, norm_1, norm_2, norm_3, norm_4; // variables representing planes..
    let v1_1, v1_2, v1_3, v1_4, v2_1, v2_2, v2_3, v2_4, yScaled, xScaled; // helper vars..
    v0 = camera.position;

    let zScale = 1000/this._zSlices;
    // for (let z = 0; z < this._zSlices; ++z) {
    //   let z1 = z * zScale; //expZ[z];
    //   let z2 = z1 + zScale; //expZ[z + 1];
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
          //console.log("hi");
          for(let l=0; l<MAX_LIGHTS_PER_CLUSTER; l++) {
            //let dist = -norm_1.x * 
            // if(assigned[l] === true) {
            //   continue;
            // }

            let p0 = vec4.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
            vec4.transformMat4(p0, p0, viewMatrix);
            //console.log("p0.z = "+ p0[2]);
            for (let z = Math.floor(p0[2]/zScale); z < this._zSlices; ++z) {
              let z1 = z * zScale; //expZ[z];
              let z2 = z1 + zScale; //expZ[z + 1];
              //console.log("hi");
              // console.log(po.z);
              // console.log(z1);
              // console.log(z2);
              // console.log();
              // Z planes check
              //console.log("hi");
              if (p0[2] + scene.LIGHT_RADIUS < z1 || p0[2] - scene.LIGHT_RADIUS > z2) {
                break;
              }
             // console.log("hi");
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

              let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
              let numLights = ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
              let texIdx = Math.floor(numLights / 4.0);
              let offset = numLights - texIdx * 4.0;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, texIdx) + offset] = l;
            }

            for (let z = Math.floor(p0[2]/zScale) - 1; z > 0; --z) {
              let z1 = z * zScale; //expZ[z];
              let z2 = z1 + zScale; //expZ[z + 1];

              // Z planes check
              if (p0[2] + scene.LIGHT_RADIUS < z1 || p0[2] - scene.LIGHT_RADIUS > z2) {
                break;
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

              let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
              let numLights = ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
              let texIdx = Math.floor(numLights / 4.0);
              let offset = numLights - texIdx * 4.0;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, texIdx) + offset] = l;
            }
          }

        }
      }
    //}

    this._clusterTexture.update();
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
          //// let ind = 1; // index of next pos to insert the light index..
          for(let l=0; l<MAX_LIGHTS_PER_CLUSTER; l++) {
            //let dist = -norm_1.x * 
            // if(assigned[l] === true) {
            //   continue;
            // }

            let p0 = vec4.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
            vec4.transformMat4(p0, p0, viewMatrix);
            
            // Z planes check
            if (p0[2] + scene.LIGHT_RADIUS < z1 || p0[2] - scene.LIGHT_RADIUS > z2) {
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
