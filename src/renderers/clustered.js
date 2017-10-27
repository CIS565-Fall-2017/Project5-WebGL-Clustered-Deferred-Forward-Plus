import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;


export default class ClusteredRenderer {
    constructor(xSlices, ySlices, zSlices) {
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

        const hfheight = Math.tan((camera.fov*0.5) * (Math.PI/180.0));
        const step_y = (hfheight * 2.0 / this._ySlices);
        const step_x = (hfheight * 2.0 / this._xSlices) * camera.aspect;
        const step_z = (camera.far - camera.near) / this._zSlices;
        const yorigin = -hfheight;
        const xorigin = -hfheight * camera.aspect;


        for(let i = 0; i < NUM_LIGHTS; ++i)
        {
            let radius = scene.lights[i].radius;
            let lightPos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
            vec4.transformMat4(lightPos, lightPos, viewMatrix);
            lightPos[2] *= -1.0;


            let xStartIdx = this._xSlices;
            for(let iter = 0; iter <= this._xSlices; ++iter) {
                let norm2 = vec2.clone(v2Dis(xorigin + step_x * iter));
                let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
                if(vec3.dot(lightPos, norm3) < radius) {
                    xStartIdx = Math.max(0, iter-1);
                    break;
                }
            }

            let xStopIdx = this._xSlices;
            for(let iter = xStartIdx+1; iter<=this.xSlices; ++iter) {
                let norm2 = vec2.clone(v2Dis(xorigin+step_x * iter));
                let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
                if(vec3.dot(lightPos, norm3) < -radius) {
                    xStopIdx = Math.max(0, iter-1);
                    break;
                }
            }


            let yStartIdx = this._ySlices;
            for(let iter = 0; iter <= this._ySlices; ++iter) {
                let norm2 = vec2.clone(v2Dis(yorigin+step_y*iter));
                let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
                if(vec3.dot(lightPos, norm3) < radius) {
                    yStartIdx = Math.max(0, iter-1);
                    break;
                }
            }

            let yStopIdx = this._ySlices;
            for(let iter = yStartIdx+1; iter<=this.ySlices; ++iter) {
                let norm2 = vec2.clone(v2Dis(yorigin + step_y * iter));
                let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
                if(vec3.dot(lightPos, norm3) < -radius) {
                    yStopIdx = Math.max(0, iter-1);
                    break;
                }
            }


            let zStartIdx = this._zSlices;
            let lightZStart = lightPos[2] - radius;
            for(let iter = 0; iter <= this._zSlices; ++iter) {
                if(camera.near + iter* step_z > lightZStart) {
                    zStartIdx = Math.max(0, iter-1);
                    break;
                }
            }

            let zStopIdx = this._zSlices;
            let lightZStop = lightPos[2] + radius;
            for(let iter = zStartIdx+1; iter<=this.zSlices; ++iter) {
                if(camera.near + iter* step_z > lightZStop) {
                    zStopIdx = Math.max(0,iter-1);
                    break;
                }
            }


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
                    }
                }
            }

        }

        this._clusterTexture.update();
    }
}


function v2Dis(width)
{
    let tp0 = Math.sqrt(1 + width * width);
    let tp1 = 1 / tp0;
    let tp2 = -width* tp1;
    return vec2.fromValues(tp1, tp2);
}