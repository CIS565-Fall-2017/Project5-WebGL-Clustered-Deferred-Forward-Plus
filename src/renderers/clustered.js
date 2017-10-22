import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 2500;

//from The Avalanche solution
export const SPECIAL_NEARPLANE = 3.0;


// distance between light point and sliceX plane (ignore Y value)
function distanceX(distance, width, lightPos)
{
  distance = (lightPos[0] - width*lightPos[2]) / Math.sqrt(1.0 + width * width);
  return distance;
}

// distance between light point and sliceY plane (ignore X value)
function distanceY(distance, height, lightPos)
{
  distance = (lightPos[1] - height*lightPos[2]) / Math.sqrt(1.0 + height * height);
  return distance;
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene)
  {
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

    const thisLightPosition = vec4.create();  
    const degreeToRadian = Math.PI / 180.0;

    
    const halfSize_Y = Math.tan(camera.fov * 0.5 * degreeToRadian); //maxHieght/farPlane
    const fullSize_Y = 2.0 * halfSize_Y;
    const step_Y = fullSize_Y / parseFloat(this._ySlices);

    //console.log("fullSize_Y : " + fullSize_Y);

    const halfSize_X = camera.aspect * halfSize_Y;
    const fullSize_X= 2.0 * halfSize_X;
    const step_X = fullSize_X / parseFloat(this._xSlices);


    function getViewZ(z, zSlices)
    {
      if (z <= 0)
        return camera.near;  
      else  if (z == 1)
        return SPECIAL_NEARPLANE;
      else
      {
        const normalizedZ = (parseFloat(z) - 1.0) / (parseFloat(zSlices) - 1.0);
        return Math.exp(normalizedZ * Math.log(camera.far - SPECIAL_NEARPLANE + 1.0)) + SPECIAL_NEARPLANE - 1.0;
      }            
    }

    function getIndexZ(ViewZ, zSlices)
    {
      if (ViewZ < SPECIAL_NEARPLANE)
        return 0; 
      else
      {
         return Math.log(ViewZ - SPECIAL_NEARPLANE + 1.0) / Math.log(camera.far - SPECIAL_NEARPLANE + 1.0) * (zSlices - 1) + 1;
      }            
    }

    //per Light
    for(let i = 0; i< NUM_LIGHTS; i++)
    {
         vec4.set(thisLightPosition, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);

         //World to View
         vec4.transformMat4(thisLightPosition, thisLightPosition, viewMatrix);

         //Negative z to Positive z
         thisLightPosition[2] *= -1.0;

         let lightRadius = scene.lights[i].radius;

         let begin_X;  let end_X;
         let begin_Y;  let end_Y;
         let begin_Z;  let end_Z;
         let distance;


         for(begin_X = 0; begin_X <= this._xSlices; begin_X++)
         {
            if( distanceX(distance, step_X * (begin_X + 1 - this._xSlices * 0.5), thisLightPosition) <=  lightRadius)
            {
              break;
            }
         }

         for(end_X = this._xSlices; end_X >= begin_X; end_X--)
         {
            if( -distanceX(distance, step_X * (end_X - 1 - this._xSlices * 0.5), thisLightPosition) <=  lightRadius)
            {
              end_X--;
              break;
            }
         }

         for(begin_Y = 0; begin_Y <= this._ySlices; begin_Y++)
         {
            if( distanceY(distance, step_Y * (begin_Y + 1 - this._ySlices * 0.5), thisLightPosition) <=  lightRadius)
            {
              break;
            }
         }

         for(end_Y = this._ySlices; end_Y >= begin_Y; end_Y--)
         {
            if( -distanceY(distance, step_Y * (end_Y - 1 - this._ySlices * 0.5), thisLightPosition) <=  lightRadius)
            {
              end_Y--;
              break;
            }
         }
         

         const minRadiusDistanceZ = thisLightPosition[2] - lightRadius;
    
         for(begin_Z = 0; begin_Z <= this._zSlices; begin_Z++)
         {
            if( (getViewZ(begin_Z + 1, this._zSlices) > minRadiusDistanceZ))
            {
              //begin_Z += 1;
              break;
            }
         }

         const maxRadiusDistanceZ = thisLightPosition[2] + lightRadius;


         for(end_Z = this._zSlices; end_Z >= begin_Z; end_Z--)
         {
            if((getViewZ(end_Z-1, this._zSlices) <= maxRadiusDistanceZ))
            {
              //console.log(" maxRadiusDistanceZ : " + maxRadiusDistanceZ);
              end_Z += 2;
              break;
            }
         }

/*
         for(let t = 0; t < this._zSlices; t++)
         {
         	console.log(t + " : " + getIndexZ(getViewZ(t, this._zSlices), this._zSlices));
         	
         }
*/       

     


/*
console.log("0 : " + getViewZ(0, this._zSlices));
console.log("1 : " + getViewZ(1, this._zSlices));
console.log("2 : " + getViewZ(2, this._zSlices));
console.log("3 : " + getViewZ(3, this._zSlices));
console.log("4 : " + getViewZ(4, this._zSlices));
console.log("5 : " + getViewZ(5, this._zSlices));
console.log("6 : " + getViewZ(6, this._zSlices));
console.log("7 : " + getViewZ(7, this._zSlices));
console.log("8 : " + getViewZ(8, this._zSlices));
console.log("9 : " + getViewZ(9, this._zSlices));
console.log("10 : " + getViewZ(10, this._zSlices));
*/
/*
        console.log("begin_X : " + begin_X);
        console.log("end_X : " + end_X);

        console.log("begin_Y : " + begin_Y);
        console.log("end_Y : " + end_Y);

        console.log("begin_Z : " + begin_Z);
        console.log("end_Z : " + end_Z);
*/

        for(let x = begin_X; x <= end_X; x++)
        {
          for(let y = begin_Y; y <= end_Y; y++)
          {
            for(let z = begin_Z; z <= end_Z; z++)
            {
              let Index = x + y * this._xSlices + z * this._xSlices * this._ySlices;


              //return 4 * index + 4 * component * this._elementCount;
              let countIndex = this._clusterTexture.bufferIndex(Index, 0);
              let lightCount = this._clusterTexture.buffer[countIndex];
              lightCount++;

              if (lightCount < MAX_LIGHTS_PER_CLUSTER)
              {
              	 this._clusterTexture.buffer[countIndex] = lightCount;

                 let thisLightTexel = Math.floor(lightCount * 0.25);
                 let thisLightTexelIndex = this._clusterTexture.bufferIndex(Index, thisLightTexel);
                 let reminder = lightCount - thisLightTexel * 4;                
                 
                 this._clusterTexture.buffer[thisLightTexelIndex + reminder] = i;
              }
            }
          }
        }
    }
   
    this._clusterTexture.update();
  }
}