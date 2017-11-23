import { mat4, vec4, vec3 } from 'gl-matrix';

export default class AABB
{
    constructor(pos, radius)
    {
        this.min = vec3.fromValues( pos[0] - radius,
                                    pos[1] - radius,
                                    pos[2] - radius);

        this.max = vec3.fromValues( pos[0] + radius,
                                    pos[1] + radius,
                                    pos[2] + radius);
    }
}