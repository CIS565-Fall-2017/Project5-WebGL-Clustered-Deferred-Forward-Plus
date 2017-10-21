import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
//import {scene} from '../scene';
import {canvas} from '../init';

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
    var zinterval = (camera.far - camera.near)/this._zSlices;
    var nearPlaneZ = camera.near;
    

    for (let z = 0; z < this._zSlices; ++z) {
      var zStart = z*zinterval + nearPlaneZ;
      var xLength = zStart* Math.tan((camera.fov/2)*Math.PI/180)*2;
      var yLength = xLength/camera.aspect;
      var xInterval = xLength/this._xSlices;
      var yInterval = yLength/this._ySlices;
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

          var rowShift = 0;
          var pixelShift = 0;

          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0) + 0] = 0;
          pixelShift++;

          let xStart = x*xInterval;
          let xEnd = (x+1)*xInterval;
         
          let yStart = y*yInterval;
          let yEnd = (y+1)*yInterval;
          
          let bottomLeft = vec3.create(xStart, yStart, zStart);
          let bottomRight = vec3.create(xEnd, yEnd, zStart);
          let topLeft = vec3.create(xStart, yEnd, zStart);
          let topRight = vec3.create(xEnd, yEnd, zStart);


          //form the box of the cluster
          //normal vector of the left face of box
          let leftFaceNormal = vec3.create();
          vec3.cross(leftFaceNormal,topLeft,bottomLeft);//change later
          vec3.normalize(leftFaceNormal,leftFaceNormal);

          //normal vector of right face of box
          let rightFaceNormal = vec3.create();
          vec3.cross(rightFaceNormal,bottomRight, topRight);//change later
          vec3.normalize(rightFaceNormal,rightFaceNormal);

          //normal vector of upper face of box
          let upperFaceNormal = vec3.create();
          vec3.cross(upperFaceNormal,topRight, topLeft);//change later
          vec3.normalize(upperFaceNormal,topLeft);

          //normal vector of lower face of box
          let lowerFaceNormal = vec3.create();
          vec3.cross(lowerFaceNormal, bottomLeft, bottomRight);//change later
          vec3.normalize(lowerFaceNormal,lowerFaceNormal);

          //normal vector of front face of box
          let frontFaceNormal = vec3.create(0,0,-1);
          //normal vector of back face of box
          let backFaceNormal = vec3.create(0,0,1);
          
          var lightCount = 0;
          for (let lightIndex = 0; lightIndex < NUM_LIGHTS; ++lightIndex) {
            //get the vector from camera origin to light center
            let lightPosVec4 = vec4.create(scene.lights[lightIndex].position,1);
            let lightPosCamera = viewMatrix * lightPosVec4;
            let lightPos = vec3.create(lightPosCamera.x, lightPosCamera.y, lightPosCamera.z);
            let lightRadius = scene.lights[lightIndex].radius;
             
            let insideLeftFace = isLightInsideFace(lightPos,lightRadius,leftFaceNormal);
            let insideRightFace = isLightInsideFace(lightPos,lightRadius,rightFaceNormal);
            let insideUpperFace = isLightInsideFace(lightPos, lightRadius, upperFaceNormal);
            let insideLowerFace = isLightInsideFace(lightPos, lightRadius, lowerFaceNormal);
            let insideFrontFace = isLightInsideFace(lightPos, lightRadius, frontFaceNormal);
            let insideBackFace = isLightInsideFace(lightPos, lightRadius, backFaceNormal);
            //if light position is within all side of the cluster box, store the light index in _clusterTexture
            
            if(insideLeftFace && insideRightFace && insideUpperFace && insideLowerFace && insideFrontFace && insideBackFace){
              //this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0) + 0] += 1;          
              lightCount++;     
              rowShift = Math.floor(lightCount/4); 
              pixelShift = lightCount-rowShift*4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, rowShift) + pixelShift] = lightIndex;
            }
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0) + 0] = lightCount;
        }
      }
    }
    this._clusterTexture.update();
  }
}

function isLightInsideFace(lightPos, lightRadius, faceNormal){
  var distance = vec3.dot(lightPos, faceNormal);
  if(distance < 0){
    return true;
  }else{
    if(distance < lightRadius){
      return true;
    }else{
      return false;
    }
  }
}