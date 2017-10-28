import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
export const MAX_LIGHTS_PER_CLUSTER = 500;

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
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var pos = vec4.create();
    
    var ta = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    var tb = camera.aspect * ta;

    var stepy = (2.0 * ta) / parseFloat(this._ySlices);
    var stepx = (2.0 * tb) / parseFloat(this._xSlices);

    for(let li = 0; li < NUM_LIGHTS; li++)
    {
      pos[0] = scene.lights[li].position[0];
      pos[1] = scene.lights[li].position[1];
      pos[2] = scene.lights[li].position[2];
      pos[3] = 1.0;
      vec4.transformMat4(pos, pos, viewMatrix);

      pos[2] *= -1.0;
      let r = scene.lights[li].radius;
      let lx; let ly; let lz;
      let ux; let uy; let uz;

      for(lx = 0; lx <= this._xSlices; lx++)
      {
        let w = calx(pos, stepx * (lx + 1 - this._xSlices * 0.5));
        if(w <=  r)
        {
          break;
        }
      }
      for(ux = this._xSlices; ux >= lx; ux--)
      {
        let w = calx(pos, stepx * (ux - 1 - this._xSlices * 0.5))
        if(-w <= r)
        {
          ux--;
          break;
        }
      }
      
      for(ly = 0; ly <= this._ySlices; ly++)
      {
        let h = caly(pos, stepy * (ly + 1 - this._ySlices * 0.5));
        if(h <=  r)
        {
          break;
        }
      }
      for(uy = this._ySlices; uy >= ly; uy--)
      {
        let h = caly(pos, stepy * (uy - 1 - this._ySlices * 0.5));
        if(-h <=  r)
        {
          uy--;
          break;
        }
      }
      
      for(lz = 0; lz <= this._zSlices; lz++)
      {
        let ow = calz(lz + 1, this._zSlices, camera);
        if(ow > (pos[2] - r))
        {
          break;
        }
      }
      for(uz = this._zSlices; uz >= lz; uz--)
      {
        let ow = calz(uz - 1, this._zSlices, camera);
        if(ow <= (pos[2] + r))
        {
          uz += 2;
          break;
        }
      }
      
      for(let x = lx; x <= ux; x++) {
        for(let y = ly; y <= uy; y++) {
          for(let z = lz; z <= uz; z++) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let idx = this._clusterTexture.bufferIndex(i, 0);
            let c = this._clusterTexture.buffer[idx] + 1;
            if (c < MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[idx] = c;
              let ft = Math.floor(c / 4.0);
              let tidx = this._clusterTexture.bufferIndex(i, ft);
              this._clusterTexture.buffer[c  + tidx - (ft * 4.0)] = li;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}


function calx(pos, width)
{
  var x = pos[0];
  var z = pos[2];
  return (x - width * z) / Math.sqrt(width * width + 1.0);
}

function caly(pos, height)
{
  var y = pos[1];
  var z = pos[2];
  return (y - height * z) / Math.sqrt(height * height + 1.0);
}

function calz(z, slices, camera)
{
  if (z <= 1) {
    return camera.near;
  }
  else
  {
    var n = (parseFloat(z) - 1.0) / (parseFloat(slices) - 1.0);
    return Math.exp(n * Math.log(camera.far - camera.near + 1.0)) + camera.near - 1.0;
  }    
}
