import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 1000;

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

  updateClusters(camera, viewMatrix, projectionMatrix, scene) {
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
    //find the 6 planes out of all the planes that divide up the camera frustrum that contain the light
    //use those indices to loop over our cluster texture, update each cluster's light count and add the light 
    //to theri buckets
    //need functions for figuring out planes based on camera space positions on the view vector(for x and y) and -z axis

    //Anther idea: + cleaner code probably?, - more math
    //or for x and y slice plane tests you could premult(local rotation) the view matrix by a rotation amount to rotate the cluster plane
    //plane in question to the y = 0 or x = 0 plane of the original camera space and check to see if the lights x or y 
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
    //^^ dont think this will work when the point is near the center of the screen. Instead get the camera space xy bound
    //then rotate this square(2 points, ll, ur) in model space about y then x (euler order yx) to have it face the viewer,
    //(orthogonal to the ray from the eye to the center of the light sphere) translate to world light position, 
    //then transform to ndc using viewprojection, do perspective divide. divide ndc into slices and step until you find the bounds.
//    one side of the triangle is the view vector (0,0,1) and the other is the length to the top frust plane
//    mult by 2 to get total vertical length then chop this length up



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
            if(vec3.dot(lightPos, norm3) < -radius) {
                xStopIdx = Math.max(0, iter-1);
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
            if(vec3.dot(lightPos, norm3) < -radius) {
                yStopIdx = Math.max(0, iter-1);
                break;
            }
        }

//        //Z//
//        let zStartIdx = this._zSlices;
//        let lightZStart = lightPos[2] - radius;
//        for(let iter = 0; iter <= this._zSlices; ++iter) {
//            if(camera.near + iter*zPlaneStride > lightZStart) {
//                zStartIdx = Math.max(0, iter-1);
//                break;
//            }
//        }
//      
//        let zStopIdx = this._zSlices;
//        let lightZStop = lightPos[2] + radius;
//        for(let iter = zStartIdx+1; iter<=this.zSlices; ++iter) {
//            if(camera.near + iter*zPlaneStride > lightZStop) {
//                zStopIdx = Math.max(0,iter-1);
//                break;
//            }
//        }

        //Z//
        let lightPosNewZ = lightPos[2] - camera.near;
        let lightStartZ = lightPosNewZ - radius;
        let lightStopZ = lightPosNewZ + radius; 
        let zStartIdx  = Math.floor(lightStartZ / zPlaneStride); 
        let zStopIdx   = Math.floor(lightStopZ  / zPlaneStride)+1; 
        if(zStartIdx > this._zSlices-1 || zStopIdx < 0) { continue; }
        zStartIdx = Math.max(0, zStartIdx);
        zStopIdx = Math.min(this._zSlices, zStopIdx);


        //update count, make sure we're not going over the max lights
        //put i in the correct component of the correct pixel
        for(let z = zStartIdx; z < zStopIdx; ++z) {
            for(let y = yStartIdx; y < yStopIdx; ++y) {
                for(let x = xStartIdx; x < xStopIdx; ++x) {
                    let clusterIdx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
                    let lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);
                    let lightCount = 1 + this._clusterTexture.buffer[lightCountIdx];

                    if(lightCount <= MAX_LIGHTS_PER_CLUSTER) {
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



//
//    const yhalflength = Math.tan((camera.fov*0.5) * (Math.PI/180.0));
//    const ylength = 2*yhalflength;
//    const xhalflength = yhalflength * camera.aspect;
//    const xlength = 2*xhalflength;
//    const zPlaneSegLength = (camera.far - camera.near) / this._zSlices;
//
//    //https://www.npmjs.com/package/gl-vec4
//    //plato's response: http://mathhelpforum.com/calculus/46006-shortest-distance-plane-sphere-difficult.html
//    //the signed distance from a point A to a plane containing a point P and a normal n is: dot(A-P, n)
//    //https://mathbitsnotebook.com/Geometry/Similarity/SMProofs.html
//    for(let i = 0; i < NUM_LIGHTS; ++i) {
//        let radius = scene.lights[i].radius;
//        let lightPos = vec4.fromValues(scene.lights[i].position[0], 
//                                       scene.lights[i].position[1], 
//                                       scene.lights[i].position[2], 1.0);
//        vec4.transformMat4(lightPos, lightPos, viewMatrix);
//        lightPos[2] *= -1.0;//cam looks down neg Z, make z positive
//        
//        //Y// and //X//
//        let yPlaneHalfLength = yhalflength*lightPos[2];        
//        let xPlaneHalfLength = xhalflength*lightPos[2];
//        let yPlaneLength = yPlaneHalfLength*2.0;
//        let xPlaneLength = xPlaneHalfLength*2.0;
//        let yPlaneSegLength = yPlaneLength / this._ySlices;
//        let xPlaneSegLength = xPlaneLength / this._xSlices;
//        let lightPosNewY = yPlaneHalfLength + lightPos[1];
//        let lightPosNewX = xPlaneHalfLength + lightPos[0];
//        let lightStartY = lightPosNewY - radius;
//        let lightStopY = lightPosNewY + radius;
//        let lightStartX = lightPosNewX - radius;
//        let lightStopX = lightPosNewX + radius;
//
//        let yStartIdx  = Math.floor(lightStartY / yPlaneSegLength); 
//        let yStopIdx   = Math.floor(lightStopY  / yPlaneSegLength); 
//        let xStartIdx  = Math.floor(lightStartX / xPlaneSegLength); 
//        let xStopIdx   = Math.floor(lightStopX  / xPlaneSegLength); 
//        if(yStartIdx > this._ySlices-1 || yStopIdx < 0) { continue; }
//        if(xStartIdx > this._xSlices-1 || xStopIdx < 0) { continue; }
//        yStartIdx = Math.max(0, yStartIdx);
//        xStartIdx = Math.max(0, xStartIdx);
//        yStopIdx = Math.min(this._ySlices, yStopIdx);
//        xStopIdx = Math.min(this._xSlices, xStopIdx);
//
//        //Z//
//        let lightPosNewZ = lightPos[2] - camera.near;
//        let lightStartZ = lightPosNewZ - radius;
//        let lightStopZ = lightPosNewZ + radius; 
//        let zStartIdx  = Math.floor(lightStartZ / zPlaneSegLength); 
//        let zStopIdx   = Math.floor(lightStopZ  / zPlaneSegLength)+1;
//        if(zStartIdx > this._zSlices-1 || zStopIdx < 0) { continue; }
//        zStartIdx = Math.max(0, zStartIdx);
//        zStopIdx = Math.min(this._zSlices, zStopIdx);
//
////        console.log("xStartIdx: " + xStartIdx);
////        console.log("xStopdx: "   + xStopIdx);
////        console.log("yStartIdx: " + yStartIdx);
////        console.log("yStopdx: "   + yStopIdx);
////        console.log("zStartIdx: " + zStartIdx);
////        console.log("zStopdx: "   + zStopIdx);
//
//        //update count, make sure we're not going over the max lights
//        //put i in the correct component of the correct pixel
//        for(let z = zStartIdx; z < zStopIdx; ++z) {
//            for(let y = yStartIdx; y < yStopIdx; ++y) {
//                for(let x = xStartIdx; x < xStopIdx; ++x) {
//                    let clusterIdx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
//                    let lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);
//                    let lightCount = 1 + this._clusterTexture.buffer[lightCountIdx];
//
//                    if(lightCount <= MAX_LIGHTS_PER_CLUSTER) {
//                        this._clusterTexture.buffer[lightCountIdx] = lightCount;
//                        let texel = Math.floor(lightCount*0.25);
//                        let texelIdx = this._clusterTexture.bufferIndex(clusterIdx, texel);
//                        let componentIdx = lightCount - texel*4;
//                        this._clusterTexture.buffer[texelIdx+componentIdx] = i;
//                    }
//                }//x
//            }//y 
//        }//z
//

//    //one side of the triangle is the view vector (0,0,1) and the other is the length to the top frust plane
//    //mult by 2 to get total vertical length then chop this length up
//    const yPlaneStride = (2.0 / this._ySlices);
//    const xPlaneStride = (2.0 / this._xSlices);
//    const zPlaneStride = (camera.far - camera.near) / this._zSlices;
//    const yPlaneStrideStart = -1.0;
//    const xPlaneStrideStart = -1.0;
//
//    //https://www.npmjs.com/package/gl-vec4
//    //plato's response: http://mathhelpforum.com/calculus/46006-shortest-distance-plane-sphere-difficult.html
//    //the signed distance from a point A to a plane containing a point P and a normal n is: dot(A-P, n)
//    //https://mathbitsnotebook.com/Geometry/Similarity/SMProofs.html
//    for(let i = 0; i < NUM_LIGHTS; ++i) {
//        let radius = scene.lights[i].radius;
//        let lightPos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
//        vec4.transformMat4(lightPos, lightPos, viewMatrix);
//        lightPos[2] *= -1.0;//cam looks down neg Z, make z positive
//        let lightPos3 = vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]);
//       
//        //additional work
//        let signx = 1;
//        let signy = 1;
//        if(0 > lightPos[0]) {signx = -1.0;}
//        if(0 > lightPos[1]) {signy = -1.0;}
//        let xzLightPos = vec2.fromValues(lightPos[0],lightPos[2]);
//        let yzLightPos = vec2.fromValues(lightPos[1],lightPos[2]);
//        let xzLightPosLen = vec2.length(xzLightPos);
//        let yzLightPosLen = vec2.length(yzLightPos);
//        let cosx = xzLightPos[1] / xzLightPosLen;//angle formed between z axis and yz plane light pos
//        let cosy = yzLightPos[1] / yzLightPosLen;//angle formed between z axis and xz plane light pos
//        let sinx = Math.sqrt(1.0-cosx*cosx);
//        let siny = Math.sqrt(1.0-cosy*cosy);
//
//        //rotate the points
//        //Y rotation first then x(by that i mean successive local rotate(euler), euler x then y would be skewed i think)
//        let modelAABBMin = vec3.fromValues(-radius,-radius, 0.0);
//        let modelAABBMax = vec3.fromValues( radius, radius, 0.0);
//
//        let rotXAABBMin = vec3.fromValues(modelAABBMin[0], cosy*modelAABBMin[1], signy*-siny*modelAABBMin[1]);
//        let rotXAABBMax = vec3.fromValues(modelAABBMax[0], cosy*modelAABBMax[1], signy*-siny*modelAABBMax[1]);
//
//        let rotYXAABBMin = vec3.fromValues(cosx*rotXAABBMin[0] + -signx*sinx*rotXAABBMin[2], rotXAABBMin[1],
//                                           -signx*-sinx*rotXAABBMin[0] + cosx*rotXAABBMin[2]);
//        let rotYXAABBMax = vec3.fromValues(cosx*rotXAABBMax[0] + -signx*sinx*rotXAABBMax[2], rotXAABBMax[1],
//                                           -signx*-sinx*rotXAABBMax[0] + cosx*rotXAABBMax[2]);
//
//        //translate back into camera space
//        vec3.add(rotYXAABBMin, rotYXAABBMin, lightPos3);
//        vec3.add(rotYXAABBMax, rotYXAABBMax, lightPos3);
//
//        //project onto screen
//        let projectedAABBMin = vec2.fromValues(projectionMatrix[0]*rotYXAABBMin[0] / rotYXAABBMin[2],
//                                               projectionMatrix[5]*rotYXAABBMin[1] / rotYXAABBMin[2]);
//        let projectedAABBMax = vec2.fromValues(projectionMatrix[0]*rotYXAABBMax[0] / rotYXAABBMax[2],
//                                               projectionMatrix[5]*rotYXAABBMax[1] / rotYXAABBMax[2]);
//
//        //end addtional work
//        
//        //X//
//        //TODO: turn start and end idx find into function
//        let xStartIdx = this._xSlices;
//        let xndc = -1.0 - xPlaneStride;
//        for(let iter = 0; iter <= this._xSlices; ++iter) {
//            xndc += xPlaneStride;
//            if(xndc > projectedAABBMin[0]) {
//                xStartIdx = Math.max(0, iter-1);
//                break;
//            }
//        }
//        
//        let xStopIdx = this._xSlices;
//        for(let iter = xStartIdx+1; iter<=this.xSlices; ++iter) {
//            if(xndc > projectedAABBMax[0]) {
//                xStopIdx = Math.max(0, iter-1);
//                break;
//            }
//            xndc += xPlaneStride;
//        }
//
//        //Y//
//        let yStartIdx = this._ySlices;
//        let yndc = -1.0 - yPlaneStride;
//        for(let iter = 0; iter <= this._ySlices; ++iter) {
//            yndc += yPlaneStride;
//            if(yndc > projectedAABBMin[1]) {
//                yStartIdx = Math.max(0, iter-1);
//                break;
//            }
//        }
//
//        let yStopIdx = this._ySlices;
//        for(let iter = 0; iter <= this._ySlices; ++iter) {
//            if(yndc > projectedAABBMax[1]) {
//                yStartIdx = Math.max(0, iter-1);
//                break;
//            }
//            yndc += yPlaneStride;
//        }
//        
//
//        //Z//
//        let zStartIdx = this._zSlices;
//        let lightZStart = lightPos[2] - radius;
//        for(let iter = 0; iter <= this._zSlices; ++iter) {
//            if(camera.near + iter*zPlaneStride > lightZStart) {
//                zStartIdx = Math.max(0, iter-1);
//                break;
//            }
//        }
//      
//        let zStopIdx = this._zSlices;
//        let lightZStop = lightPos[2] + radius;
//        for(let iter = zStartIdx+1; iter<=this.zSlices; ++iter) {
//            if(camera.near + iter*zPlaneStride > lightZStop) {
//                zStopIdx = Math.max(0,iter-1);
//                break;
//            }
//        }
//
//
//        //update count, make sure we're not going over the max lights
//        //put i in the correct component of the correct pixel
//        for(let z = zStartIdx; z < zStopIdx; ++z) {
//            for(let y = yStartIdx; y < yStopIdx; ++y) {
//                for(let x = xStartIdx; x < xStopIdx; ++x) {
//                    let clusterIdx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
//                    let lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);
//                    let lightCount = 1 + this._clusterTexture.buffer[lightCountIdx];
//
//                    if(lightCount <= MAX_LIGHTS_PER_CLUSTER) {
//                        this._clusterTexture.buffer[lightCountIdx] = lightCount;
//                        let texel = Math.floor(lightCount*0.25);
//                        let texelIdx = this._clusterTexture.bufferIndex(clusterIdx, texel);
//                        let componentIdx = lightCount - texel*4;
//                        this._clusterTexture.buffer[texelIdx+componentIdx] = i;
//                    }
//                }//x
//            }//y 
//        }//z
//
//    }//end light loop
