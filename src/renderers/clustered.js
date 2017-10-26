import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 1000;
export const SPECIAL_NEARPLANE = 3.0;
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
//Edit: Do not go through every cluster to find lights. Go through every lights to find clusters.


    function getViewZ(z, zSlices)
    {
      if (z == 0)
        return camera.near;  
      if (z == 1)
        return SPECIAL_NEARPLANE;
      else
      {
        const normalizedZ = (parseFloat(z) - 1.0) / (parseFloat(zSlices) - 1.0);
        return Math.exp(normalizedZ * Math.log(camera.far - SPECIAL_NEARPLANE + 1.0)) + SPECIAL_NEARPLANE - 1.0;
      }            
    }
    for(let i = 0; i< NUM_LIGHTS; i++)
    {
         let LightWorldSpce = vec4.create();
         vec4.set(LightWorldSpce, 
          scene.lights[i].position[0], 
          scene.lights[i].position[1], 
          scene.lights[i].position[2], 
          1.0
          );
         //World to View
         let LightCameraSpace = vec4.create();
         vec4.transformMat4(LightCameraSpace, LightWorldSpce, viewMatrix);

         //Negative z to Positive z
         let Width_Y = 2.0 * Math.tan(camera.fov * 0.5 *  Math.PI / 180.0);
         let width_SliceY = Width_Y / parseFloat(this._ySlices);
         let Width_X= 2.0 * camera.aspect * Width_Y / 2.0;
         let width_SliceX = Width_X / parseFloat(this._xSlices);

         LightCameraSpace[2] *= -1.0;

         let lightRadius = scene.lights[i].radius;

         let begin_Z;  let end_Z;
         let distance;


// for x and y can do it simple. But not for z.
//edit: not simple!
//edit: directly find beginx and endx has failed. Try to use something from CIS560
//y i cannot directly do it on the clip?
/*
         let begin_X = parseInt((((LightCameraSpace[0] - lightRadius - (-1.0 * Width_X / 2.0)) > 0)?
         (LightCameraSpace[0] - lightRadius - (-1.0 * Width_X / 2.0)):0) / parseFloat(width_SliceX)) - 1;
         let end_X = parseInt(
          (((LightCameraSpace[0] + lightRadius - (1.0 * Width_X / 2.0)) < 0)?
         (LightCameraSpace[0] + lightRadius - (-1.0 * Width_X / 2.0)):
         (1.0 * Width_X / 2.0))
         / parseFloat(width_SliceX)
         ) + 10;

         let begin_Y = parseInt((((LightCameraSpace[1] - lightRadius - (-1.0 * Width_Y / 2.0)) > 0)?
         (LightCameraSpace[1] - lightRadius - (-1.0 * Width_Y / 2.0)):0) / parseFloat(width_SliceY)) - 1;
         let end_Y = parseInt(
          (((LightCameraSpace[1] + lightRadius) < (1.0 * Width_Y / 2.0))?
         (LightCameraSpace[1] + lightRadius - (-1.0 * Width_Y / 2.0)):
         (1.0 * Width_Y / 2.0))
         / parseFloat(width_SliceY)
         ) + 10;
        */// distance between light point and sliceX plane (ignore Y value)
        function distanceX(distance, width, lightPos)
        {
          distance = (lightPos[0] - width*lightPos[2]) / Math.sqrt(1.0 + width * width);
          return distance;
        }
        let begin_X;
        for(begin_X = 0; begin_X <= this._xSlices; begin_X++){
          if( distanceX(distance, width_SliceX * (begin_X + 1 - this._xSlices * 0.5), LightCameraSpace) <=  lightRadius){
            break;
          }
        }
        let end_X;
        for(end_X = this._xSlices; end_X >= begin_X; end_X--){
          if( -distanceX(distance, width_SliceX * (end_X - 1 - this._xSlices * 0.5), LightCameraSpace) <=  lightRadius){
            end_X--;
            break;
          }
        }
        function distanceY(distance, height, lightPos)
        {
          distance = (lightPos[1] - height*lightPos[2]) / Math.sqrt(1.0 + height * height);
          return distance;
        }
        let begin_Y;
        for(begin_Y = 0; begin_Y <= this._ySlices; begin_Y++){
          if( distanceY(distance, width_SliceY * (begin_Y + 1 - this._ySlices * 0.5), LightCameraSpace) <=  lightRadius){
            break;
          }
        }
        let end_Y;
        for(end_Y = this._ySlices; end_Y >= begin_Y; end_Y--){
          if( -distanceY(distance, width_SliceY * (end_Y - 1 - this._ySlices * 0.5), LightCameraSpace) <=  lightRadius){
            end_Y--;
            break;
          }
        }
        const minZValue = LightCameraSpace[2] - lightRadius;
        for(begin_Z = parseInt(0); begin_Z <= this._zSlices; begin_Z++){
          if( (getViewZ(begin_Z + 1, this._zSlices) >= minZValue)){
            break;
          }
        }
        console
        const maxZValue = LightCameraSpace[2] + lightRadius;
        for(end_Z = parseInt(this._zSlices); end_Z >= begin_Z; end_Z--){
          if((getViewZ(end_Z, this._zSlices) <= maxZValue)){
            end_Z += 1;
            end_Z = Math.min(end_Z,this._zSlices);
            break;
          }
        }
        for(let x = begin_X; x <= end_X; x++){
          for(let y = begin_Y; y <= end_Y; y++){
            for(let z = begin_Z; z <= end_Z; z++){
              let Index = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                 //Bug record: remember to parseInt
              let countIndex = parseInt(this._clusterTexture.bufferIndex(Index, 0));
              let lightCount = parseInt(this._clusterTexture.buffer[countIndex]);
              lightCount++;
              if (lightCount < MAX_LIGHTS_PER_CLUSTER)
              {
                 this._clusterTexture.buffer[countIndex] = lightCount;
                 let rowVector4       =  parseInt(Math.floor(lightCount * 0.25));
                 let rowVector4Index  =  parseInt(this._clusterTexture.bufferIndex(Index, rowVector4));
                 let remainder = lightCount - rowVector4 * 4;                
                 this._clusterTexture.buffer[rowVector4Index + remainder] = i;
              }
            }
          }
        }
    }
    this._clusterTexture.update();
  }
}