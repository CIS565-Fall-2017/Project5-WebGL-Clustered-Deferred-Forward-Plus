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
    var _cameraFovTan = Math.tan(((camera.fov/2)*Math.PI)/180);
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
            let lightRadius = scene.lights[iTemp].radius;

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
            // console.log(lightCount);
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
  updateClustersTile(camera,viewMatrix,projectionMatrix,scene)
  {
    var xFarWidth = 2*(camera.far*Math.tan((camera.fov/2)*Math.PI/180));
    var yFarWidth = xFarWidth/camera.aspect;
    var farClip = camera.far;

    var xSliceLength = xFarWidth/_xSlices;
    var ySliceLength = yFarWidth/_ySlices;

    var xInitial = xFarWidth/2;
    var yInitial = yFarWidth/2;
    for (let y = 0; y < this._ySlices; ++y) {
      for (let x = 0; x < this._xSlices; ++x) {

        let i = x + y * this._xSlices;

        let vertLeftTop = vec4.create(); 
        vertLeftTop[0] = xInitial - x*xSliceLength;
        vertLeftTop[1] = yInitial - y*ySliceLength;
        vertLeftTop[2] = farClip;
        vertLeftTop[3] = 1;

        let vertLeftBottom = vec4.create();
        vertLeftBottom[0] = xInitial - x*xSliceLength;
        vertLeftBottom[1] = yInitial = (y+1)*ySliceLength;
        vertLeftBottom[2] = farClip;
        vertLeftBottom[3] = 1;

        let vertRightTop = vec4.create();
        vertRightTop[0] = xInitial - (x+1)*xSliceLength;
        vertRightTop[1] = yInitial - y*ySliceLength;
        vertRightTop[2] = farClip;
        vertRightTop[3] = 1;

        let vertRightBottom = vec4.create();
        vertRightBottom[0] = xInitial - (x+1)*xSliceLength;
        vertRightBottom[1] = yInitial - (y+1)*ySliceLength;
        vertRightBottom[2] = farClip;
        vertRightBottom[3] = 1;

        let screenLeftTop = vec4.create();
        vec4.multiply(screenLeftTop,projectionMatrix,vertLeftTop);
        let pixelLeftTop = vec2.create();
        pixelLeftTop[0] = screenLeftTop[0];
        pixelLeftTop[1] = screenLeftTop[1];

        let screenLeftBottom = vec4.create();
        vec4.multiply(screenLeftBottom,projectionMatrix,vertLeftBottom);
        let pixelLeftBottom = vec2.create();
        pixelLeftBottom[0] = screenLeftBottom[0];
        pixelLeftBottom[1] = screenLeftBottom[1];

        let screenRightTop = vec4.create();
        vec4.multiply(screenRightTop,projectionMatrix,vertRightTop);
        let pixelRightTop = vec2.create();
        pixelRightTop[0] = screenRightTop[0];
        pixelRightTop[1] = screenRightTop[1];

        let screenRightBottom = vec4.create();
        vec4.multiply(screenRightBottom,projectionMatrix,vertRightBottom);
        let pixelRightBottom = vec2.create();
        pixelRightBottom[0] = screenRightBottom[0];
        pixelRightBottom[1] = screenRightBottom[1];    
        
        let lightCount = 0;

        for(let lTemp=0;lTemp<scene.NUM_LIGHTS;++lTemp)
        {
          let lightPos4 = vec4.create();    
          let lightPos4World = vec4.create();
          lightPos4World[0] = scene.lights[lTemp].position[0];
          lightPos4World[1] = scene.lights[lTemp].position[1];
          lightPos4World[2] = scene.lights[lTemp].position[2];
          lightPos4World[3] = 1;
          vec4.multiply(lightPos4,viewMatrix,lightPos4World);
          vec4.multiply(lightPos4,projectionMatrix,lightPos4);

          let lightPos = vec2.create();
          lightPos[0] = lightPos4[0];
          lightPos[1] = lightPos4[1];
          let lightRadius = scene.lights[lTemp].radius;

          let disLT = lightPos.distance(pixelLeftTop);
          let disLB = lightPos.distance(pixelLeftBottom);
          let disRT = lightPos.distance(pixelRightTop);
          let disRB = lightPos.distance(pixelRightBottom);

          let minDis = Math.min(disLT, disLB,disRT,disRB);
          if(minDis<lightRadius)
          {
            lightCount = lightCount+1;
            let lightRowNumer = Math.floor((lightCount+1)/4);
            let lightColumnNumber = lightCount+1 - lightRowNumer*4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightRowNumer)+lightColumnNumber] = lTemp;
          }
        }
        this._clusterTexture._buffer[this._clusterTexture.bufferIndex(i,0)]=lightCount;
      }
    }

    this._clusterTexture.update();
  }
}
