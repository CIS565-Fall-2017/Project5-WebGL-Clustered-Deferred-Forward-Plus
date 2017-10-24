import { gl } from '../init';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { loadShaderProgram } from '../utils';
import { NUM_LIGHTS } from '../scene';
import vsSource from '../shaders/clusteredForward.vert.glsl';
import fsSource from '../shaders/clusteredForward.frag.glsl.js';
import TextureBuffer from './textureBuffer';
import ClusteredRenderer from './clustered';

export default class ClusteredForwardPlusRenderer extends ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices, camera, MAX_LIGHTS_PER_CLUSTER) {
    super(xSlices, ySlices, zSlices, camera, MAX_LIGHTS_PER_CLUSTER);

    // Create a texture to store light data
    this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);
    
    this._shaderProgram = loadShaderProgram(vsSource, fsSource({
      numLights: NUM_LIGHTS,
      numXSlices: xSlices,
      numYSlices: ySlices,
      numZSlices: zSlices,
      numClusters: xSlices*ySlices*zSlices,
      maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER
    }), {
      uniforms: ['u_viewProjectionMatrix', 'u_viewMatrix', 
                 'u_vFoV', 'u_hFoV', 'u_xStride', 'u_yStride', 'u_zStride',
                 'u_camRight', 'u_camDown',
                 'u_colmap', 'u_normap', 'u_lightbuffer', 'u_clusterbuffer'],
      attribs: ['a_position', 'a_normal', 'a_uv'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
  }

  render(camera, scene) {
    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

    // Update cluster texture which maps from cluster index to light list
    var camRight = vec3.create();
    var camDown = vec3.create();

    vec3.set(camRight, this._viewMatrix[0], this._viewMatrix[1], this._viewMatrix[2]);
    vec3.set(camDown, -this._viewMatrix[4], -this._viewMatrix[5], -this._viewMatrix[6]);

    this.updateClusters(camera, this._viewMatrix, scene, camRight, camDown, NUM_LIGHTS);
    
    // Update the buffer used to populate the texture packed with light data
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 0] = scene.lights[i].position[0];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 1] = scene.lights[i].position[1];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 2] = scene.lights[i].position[2];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 3] = scene.lights[i].radius;

      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 0] = scene.lights[i].color[0];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 1] = scene.lights[i].color[1];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 2] = scene.lights[i].color[2];
    }
    // Update the light texture
    this._lightTexture.update();

    // Bind the default null framebuffer which is the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._shaderProgram.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    // Set the light texture as a uniform input to the shader
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
    gl.uniform1i(this._shaderProgram.u_lightbuffer, 2);

    // Set the cluster texture as a uniform input to the shader
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
    gl.uniform1i(this._shaderProgram.u_clusterbuffer, 3);

    // Bind any other shader inputs
    gl.uniformMatrix4fv(this._shaderProgram.u_viewMatrix, false, this._viewMatrix);
    gl.uniform1f (this._shaderProgram.u_vFoV, this.vertical_FoV);
    gl.uniform1f (this._shaderProgram.u_hFoV, this.horizontal_FoV);
    gl.uniform1f (this._shaderProgram.u_xStride, this.xStride);
    gl.uniform1f (this._shaderProgram.u_yStride, this.yStride);
    gl.uniform1f (this._shaderProgram.u_zStride, this.zStride);
    gl.uniform3f (this._shaderProgram.u_camRight, camRight[0], camRight[1], camRight[2]);
    gl.uniform3f (this._shaderProgram.u_camDown, camDown[0], camDown[1], camDown[2]);

    // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
    scene.draw(this._shaderProgram);
  }
};