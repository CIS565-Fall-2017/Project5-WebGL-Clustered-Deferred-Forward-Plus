import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class ClusteredRenderer {
    constructor(xSlices, ySlices, zSlices) {
        this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
        this._xSlices = xSlices;
        this._ySlices = ySlices;
        this._zSlices = zSlices;

        this._deg2rad = Math.PI/180.0;
    }

    updateClusters(camera, viewMatrix, scene) {

        // Constant Values
        const _yHalf = Math.tan((camera.fov*0.5) * this._deg2rad);
        const _yFull = _yHalf * 2.0;
        const _zFull = camera.far - camera.near;

        for (let z = 0; z < this._zSlices; ++z) {
            for (let y = 0; y < this._ySlices; ++y) {
                for (let x = 0; x < this._xSlices; ++x) {
                    let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
                }
            }
        }

        let ySize = _yFull / this._ySlices;
        let xSize = ySize * camera.aspect;
        let zSize = _zFull / this._zSlices;
        let yPStart = -_yHalf;
        let xPStart = -_yHalf * camera.aspect;

        for(let i = 0; i < NUM_LIGHTS; ++i) {
            let lightPos = vec4.create();
            lightPos[0] = scene.lights[i].position[0];
            lightPos[1] = scene.lights[i].position[1];
            lightPos[2] = scene.lights[i].position[2];
            lightPos[3] = 1.0;

            vec4.transformMat4(lightPos, lightPos, viewMatrix);
            lightPos[2] = -lightPos[2];

            let lightRadius = scene.lights[i].radius;
            let found = true;

            let xBegin = this._xSlices;
            let xEnd = this._xSlices;

            for(let k = 0; k <= this._xSlices; ++k) {

                let nor = vec3.create();
                let xLeft = xPStart + k * xSize;
                nor[0] = 1 / Math.sqrt(xLeft * xLeft + 1);
                nor[2] = -xLeft * nor[0];

                let dist = vec3.dot(lightPos,nor);
                if(lightRadius > dist && found)
                {
                    xBegin = Math.max(0, k - 1);
                    found = false;
                    continue;
                }
                if(-lightRadius > dist && !found)
                {
                    xEnd = k;
                    break;
                }
            }

            found = true;
            let yBegin = this._ySlices;
            let yEnd = this._ySlices;

            for(let k = 0; k <= this._ySlices; ++k)
            {
                let nor = vec3.create();
                let yTop = yPStart + k *ySize;
                nor[1] = 1 / Math.sqrt(yTop * yTop + 1);
                nor[2] = -yTop * nor[1];

                let dist = vec3.dot(lightPos,nor);
                if(lightRadius > dist && found)
                {
                    yBegin = Math.max(0, k - 1);
                    found = false;
                    continue;
                }
                if(-lightRadius > dist && !found)
                {
                    yEnd = k;
                    break;
                }
            }

            found = true;
            let zF = lightPos[2] - lightRadius;
            let zR = lightPos[2] + lightRadius;
            let zBegin = 0;
            let zEnd = this._zSlices;

            for(let k = 0; k <= this._zSlices; ++k)
            {
                let zFront = camera.near + k * zSize;
                if(zFront > zF && found)
                {
                    zBegin = Math.max(0, k - 1);
                    found = false;
                    continue;
                }

                if(zFront > zR && !found)
                {
                    zEnd = k;
                    break;
                }
            }


            for(let z = zBegin; z < zEnd; ++z) {
                for(let y = yBegin; y < yEnd; ++y) {
                    for(let x = xBegin; x < xEnd; ++x) {
                        let idx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
                        let nLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] + 1;
                        let _n4t = Math.floor(0.25 * nLights);

                        if(nLights < MAX_LIGHTS_PER_CLUSTER) {
                            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = nLights;
                            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, _n4t) + (nLights - 4 * _n4t)] = i;
                        }
                    }
                }
            }
        }

        this._clusterTexture.update();
    }
}