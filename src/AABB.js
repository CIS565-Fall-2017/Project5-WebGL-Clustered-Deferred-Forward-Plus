import { mat4, vec4, vec3 } from 'gl-matrix';
const THREE = require('three')

export default class AABB //class for Axis Aligned Bounding Boxes
{
  constructor()
  {
    this.min = vec3.create();
    this.max = vec3.create();
  }

  calcAABB_PointLight(lightPos, radius)
  {
    this.min[0] = lightPos.x - radius;
    this.min[1] = lightPos.y - radius;
    this.min[2] = lightPos.z - radius;

    this.max[0] = lightPos.x + radius;
    this.max[1] = lightPos.y + radius;
    this.max[2] = lightPos.z + radius;
  }
}