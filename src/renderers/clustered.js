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

  //special function to calculate the coordinate of the near-bottom-left corner 
  //of the cluster

  //special function to calculate the x min and max that the light might influence


  //special function to calculate the y min and max that the light might influence

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    var zClusterDis = (camera.far - camera.near)/this._zSlices;
    var _cameraAspect = camera.aspect;
    var _cameraFovTan = Math.tan(camera.fov/2);
    var farWidth = 2*(camera.far*_cameraFovTan);
    var farHeight = farWidth/_cameraAspect;
    var NearNormal = [0,0,-1];
    var farNormal = [0,0,1];

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          
          let lightCount = 0;   
          
          let zPosNear = z*zClusterDis + camera.near;
          let xWidthFull = 2*zPosNear*_cameraFovTan;
          let yHeightFull = xWidthFull/_cameraAspect;
          
          let clusterWidth = xWidthFull/this._xSlices;
          let clusterHeight = yHeightFull/this._ySlices;
          
          let xPosNear = (xWidthFull/2) - x*clusterWidth;
          let yPosNear = (yHeightFull/2) - y*clusterHeight;
          let xPosNearPlus = (xWidthFull/2) - (x+1)*clusterWidth;
          let yPosNearPlus = (yHeightFull/2) - (y+1)*clusterHeight;

          let nearTopLeft = [xPosNear, yPosNear, zPosNear];
          let nearBottomLeft = [xPosNear,yPosNearPlus,zPosNear];
          let nearTopRight = [xPosNearPlus,yPosNear,zPosNear];
          let nearBottomRight = [xPosNearPlus,yPosNearPlus,zPosNear];

          let upNormal = vec3.create();
          vec3.cross(upNormal,nearTopRight,nearTopLeft);
          vec3.normalize(upNormal,upNormal);
          let downNormal = vec3.create();
          vec3.cross(downNormal,nearBottomLeft,nearBottomRight);
          vec3.normalize(downNormal,downNormal);
          let leftNormal = vec3.create();
          vec3.cross(leftNormal,nearTopLeft,nearBottomLeft);
          vec3.normalize(leftNormal,leftNormal);
          let rightNormal = vec3.create();
          vec3.cross(rightNormal,nearBottomRight,nearTopRight);
          vec3.normalize(rightNormal,rightNormal);

          for(let iTemp = 0;iTemp<scene.NUM_LIGHTS;++iTemp)
          {
            let judgeInOut = true;  
            let lightPos4 = vec4.create();    
            let lightPos4World = vec4.create();
            lightPos4World[0] = scene.lights[iTemp].position[0];
            lightPos4World[1] = scene.lights[iTemp].position[1];
            lightPos4World[2] = scene.lights[iTemp].position[2];
            lightPos4World[3] = 1;
            vec4.multiply(lightPos4,viewMatrix,lightPos4World);

            let lightPos = vec3.create();
            lightPos[0] = lightPos4[0];
            lightPos[1] = lightPos4[1];
            lightPos[2] = lightPos4[2];
            lightRadius = scene.lights[iTemp].radius;

            //left
            leftProjection = vec3.dot(lightPos,leftNormal);
            if((leftProjection>0)&&(lightRadius<Math.abs(leftProjection)))
            {
              judgeInOut = false;
            }
            //right
            rightProjection = vec3.dot(lightPos,rightNormal);
            if((rightProjection>0)&&(lightRadius<Math.abs(rightProjection)))
            {
              judgeInOut = false;
            }
            //up
            upProjection = vec3.dot(lightPos,upNormal);
            if((upProjection>0)&&(lightRadius<Math.abs(upProjection)))
            {
              judgeInOut = false;
            }
            //down
            downProjection = vec3.dot(lightPos,downNormal);
            if((downProjection>0)&&(lightRadius<Math.abs(downProjection)))
            {
              judgeInOut = false;
            }
            //near
            nearProjection = vec3.dot(lightPos,nearNormal);
            if((nearProjection>0)&&(lightRadius<Math.abs(nearProjection)))
            {
              judgeInOut = false;
            }
            //far
            farProjection = vec3.dot(lightPos,farNormal);
            if((farProjection>0)&&(lightRadius<Math.abs(farProjection)))
            {
              judgeInOut = false;
            }

            //judgeInOut has to be true to make the light inside the special 
            //cluster 

            if(judgeInOut)
            {
              lightCount = lightCount+1;
              let lightRowNumer = Math.floor((lightCount+1)/4);
              let lightColumnNumber = lightCount+1 - lightRowNumer*4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightRowNumer)+lightColumnNumber] = iTemp;
            }
          }
          this._clusterTexture._buffer[this._clusterTexture.bufferIndex(i,0)]=lightCount;
        }
      }
    }

    this._clusterTexture.update();
  }

  //TODO
  //another method specially for the deferred shading
  //used only for tiles not clusters
  updateClustersTile(camera,viewMatrix,scene)
  {

  }
}
