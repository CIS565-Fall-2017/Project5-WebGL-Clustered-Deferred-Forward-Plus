import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function getNormalComponents(bigSide2) {
    //normal connects from point on hypot to end of view vec, can form 4 similar triangles 
    //for the normal triangle, extend the hypot so it's 1 and we get the side lengths for a normalized normal
    //bigSide1 is 1 // view vec
//    let bigSide2 = xPlaneStrideStart+xPlaneStride*iter;
    let bigHypot = Math.sqrt(1 + bigSide2*bigSide2);
    let normSide1 = 1 / bigHypot;
    let normSide2 = -bigSide2*normSide1;//lhs of plane, 2nd comp needs to be pos, rhs of plane 2nd comp needs to be neg
    return vec2.fromValues(normSide1, normSide2);
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

    //loop lights
    //find the 6 planes out of all the planes that divide up the frustrum that contain the light
    //use those indices to loop over our cluster texture, update each cluster's light count and add the light 
    //to their buckets
    //need functions for figuring out planes based on camera space positions on the near plane(for x and y) and -z axis

    //Anther idea: + cleaner code probably, - more math
    //or for x and y slice plane tests you could premult the view matrix by a rotation amount to rotate that
    //plane to the y = 0 or x = 0 plane of the original camera space and check to see if the lights x or y 
    //pos is less than the radius. this rotation angle wont be an integer mult of some base value but you'll need
    //to calc the angle based on the num of pixels it covers from the middle of the screen

    //apply the pixel length calc from path tracer(scene.cpp)(looks wrong, didn't do fov/2) to the num of slices to find the stepping
    //along x or y from the head of vector len 1 from the cam pos, use these vecs to find the norm of the plane
    //and a point on the plane
    //the trianlge formed by the (0,0,1) vec, the step vec and the sum of these vecs, is similar to the triangle
    //form by the normal coming off the sum vec(connects to the 90 corner of the larger triangle),
    //the step vec, and the little vec from the base of the normal to the head of the larger triangle's hypot

    //another idea: + cleaner code, + less math, - bounds
    //mult the point by the view mat, figure out which xy quadrant it is in
    //get the aabb of the light and pick 2 corners(1 frontface and 1 backface) based on which quadrant it is in
    //^ this can prob be done using the sign of x and y components to skip the quadrant test
    //multiply these two points by the persp projection mat, would need slice lengths for xy ndc 
    //i.e. 2/slices length's for x and y
    //with that, you no longer have to form a plane and do a dot product and 
    //see if its within range of the radius just figure out the aabb ndc xy point's plane bounds using the 
    // ndc slice strides


    //one side of the triangle is the view vector (0,0,1) and the other is the length to the top frust plane
    //mult by 2 to get total vertical length then chop this length up
    const yhalflength = Math.tan((camera.fov*0.5) * (Math.PI/180.0));
    const yPlaneStride = (yhalflength * 2.0 / this._ySlices);
    const xPlaneStride = (yhalflength * 2.0 / this._xSlices) * camera.aspect;
    const zPlaneStride = (camera.far - camera.near) / this._zSlices;
    const yPlaneStrideStart = -yhalflength;
    const xPlaneStrideStart = -yhalflength * camera.aspect;

    //https://www.npmjs.com/package/gl-vec4
    //plato's response: http://mathhelpforum.com/calculus/46006-shortest-distance-plane-sphere-difficult.html
    //the signed distance from a point A to a plane containing a point P and a normal n is: dot(A-P, n)
    //https://mathbitsnotebook.com/Geometry/Similarity/SMProofs.html
    for(let i = 0; i < NUM_LIGHTS; ++i) {
        let radius = scene.lights[i].radius;
        let lightPos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
        vec4.transformMat4(lightPos, lightPos, viewMatrix);
        lightPos[2] *= -1.0;//cam looks down neg Z, make z positive
        
        //X//
        let xStartIdx = this._xSlices;
        for(let iter = 0; iter <= this._xSlices; ++iter) {
            let norm2 = vec2.clone(getNormalComponents(xPlaneStrideStart+xPlaneStride*iter));
            let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
            if(vec3.dot(lightPos, norm3) < radius) {
                xStartIdx = Math.max(0, iter-1);
                break;
            }
        }
        
        let xStopIdx = this._xSlices;
        for(let iter = xStartIdx+1; iter<=this.xSlices; ++iter) {
            let norm2 = vec2.clone(getNormalComponents(xPlaneStrideStart+xPlaneStride*iter));
            let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
//            if(Math.abs(vec3.dot(lightPos, norm3)) > radius) {//could also try < -radius
            if(vec3.dot(lightPos, norm3) < -radius) {
                xStopIdx = iter;
                break;
            }
        }

        //Y//
        let yStartIdx = this._ySlices;
        for(let iter = 0; iter <= this._ySlices; ++iter) {
            let norm2 = vec2.clone(getNormalComponents(yPlaneStrideStart+yPlaneStride*iter));
            let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
            if(vec3.dot(lightPos, norm3) < radius) {
                yStartIdx = Math.max(0, iter-1);
                break;
            }
        }
      
        let yStopIdx = this._ySlices;
        for(let iter = yStartIdx+1; iter<=this.ySlices; ++iter) {
            let norm2 = vec2.clone(getNormalComponents(yPlaneStrideStart+yPlaneStride*iter));
            let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
//            if(Math.abs(vec3.dot(lightPos, norm3)) > radius) {
            if(vec3.dot(lightPos, norm3) < -radius) {
                yStopIdx = iter;
                break;
            }
        }

        //Z//
        let zStartIdx = this._zSlices;
        let lightZStart = lightPos[2] - radius;
        for(let iter = 0; iter <= this._zSlices; ++iter) {
            if(camera.near + iter*zPlaneStride > lightZStart) {
                zStartIdx = Math.max(0, iter-1);
                break;
            }
        }
      
        let zStopIdx = this._zSlices;
        let lightZStop = lightPos[2] + radius;
        for(let iter = zStartIdx+1; iter<=this.zSlices; ++iter) {
            if(camera.near + iter*zPlaneStride > lightZStop) {
                zStopIdx = iter;
                break;
            }
        }


        //update count, make sure we're not going over the max lights
        //put i in the correct component of the correct pixel
        for(let z = zStartIdx; z < zStopIdx; ++z) {
            for(let y = yStartIdx; y < yStopIdx; ++y) {
                for(let x = xStartIdx; x < xStopIdx; ++x) {
                    let clusterIdx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
                    let lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);
                    let lightCount = 1 + this._clusterTexture.buffer[lightCountIdx];

                    if(lightCount < MAX_LIGHTS_PER_CLUSTER) {
                        this._clusterTexture.buffer[lightCountIdx] = lightCount;
                        let texel = Math.floor(lightCount*0.25);
                        let texelIdx = this._clusterTexture.bufferIndex(clusterIdx, texel);
                        let componentIdx = lightCount - texel*4;
                        this._clusterTexture.buffer[texelIdx+componentIdx] = i;
                    }
                }//x
            }//y 
        }//z

    }//end light loop

    this._clusterTexture.update();
  }//end updateClusters
}//end clusteredrenderer class
