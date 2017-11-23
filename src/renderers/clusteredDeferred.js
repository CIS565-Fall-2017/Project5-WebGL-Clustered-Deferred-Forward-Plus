import { gl, WEBGL_draw_buffers, canvas } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import toTextureVert from '../shaders/deferredToTexture.vert.glsl';
import toTextureFrag from '../shaders/deferredToTexture.frag.glsl';
import QuadVertSource from '../shaders/quad.vert.glsl';
import fsSource from '../shaders/deferred.frag.glsl.js';
import TextureBuffer from './textureBuffer';
import ClusteredRenderer from './clustered';
import {MAX_LIGHTS_PER_CLUSTER} from './clustered';

export const NUM_GBUFFERS = 4;

export default class ClusteredDeferredRenderer extends ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    super(xSlices, ySlices, zSlices);
    
    this.setupDrawBuffers(canvas.width, canvas.height);
    
    // Create a texture to store light data
    this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);
    
    this._progCopy = loadShaderProgram(toTextureVert, toTextureFrag, {
      uniforms: [
        'u_viewProjectionMatrix', 
        'u_viewMatrix', 
        'u_colmap', 
        'u_normap'
      ],
      attribs: ['a_position', 'a_normal', 'a_uv'],
    });

    this._progShade = loadShaderProgram(QuadVertSource, fsSource({
      numLights: NUM_LIGHTS,
      numGBuffers: NUM_GBUFFERS,
      xSlices: xSlices,
      ySlices: ySlices,
      zSlices: zSlices,
      maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER
    }), {
      uniforms: ['u_gbuffers[0]', 'u_gbuffers[1]', 'u_gbuffers[2]', 'u_gbuffers[3]',
                 'u_viewProjectionMatrix', 'u_viewMatrix', 'u_invViewMatrix',
                 'u_height', 'u_width', 'u_nearZ', 'u_farZ',
                 'u_lightbuffer', 'u_clusterbuffer'],
      attribs: ['a_uv'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._invViewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
  }

  setupDrawBuffers(width, height) {
    this._width = width;
    this._height = height;

    this._fbo = gl.createFramebuffer();
    
    //Create, bind, and store a depth target texture for the FBO
    this._depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);

    // Create, bind, and store "color" target textures for the FBO
    this._gbuffers = new Array(NUM_GBUFFERS);
    let attachments = new Array(NUM_GBUFFERS);
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      attachments[i] = WEBGL_draw_buffers[`COLOR_ATTACHMENT${i}_WEBGL`];
      this._gbuffers[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, this._gbuffers[i], 0);      
    }

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "Framebuffer incomplete";
    }

    // Tell the WEBGL_draw_buffers extension which FBO attachments are
    // being used. (This extension allows for multiple render targets.)
    WEBGL_draw_buffers.drawBuffersWEBGL(attachments);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(width, height) {
    this._width = width;
    this._height = height;

    gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(camera, scene) {
    if (canvas.width != this._width || canvas.height != this._height) {
      this.resize(canvas.width, canvas.height);
    }

    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

    // Inverse View Matrix
    mat4.invert(this._invViewMatrix, this._viewMatrix);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the shader program to copy to the draw buffers
    gl.useProgram(this._progCopy.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._progCopy.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
    gl.uniformMatrix4fv(this._progCopy.u_viewMatrix, false, this._viewMatrix);

    // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
    scene.draw(this._progCopy);
    
    // Update cluster texture which maps from cluster index to light list
    this.updateClusters(camera, this._viewMatrix, scene, NUM_LIGHTS);
    
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

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._progShade.glShaderProgram);

    // Bind any other shader inputs
    // Upload the camera matrix
    gl.uniformMatrix4fv(this._progShade.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    // Set the light texture as a uniform input to the shader
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
    gl.uniform1i(this._progShade.u_lightbuffer, 2);

    // Set the cluster texture as a uniform input to the shader
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
    gl.uniform1i(this._progShade.u_clusterbuffer, 3);

    gl.uniformMatrix4fv(this._progShade.u_viewMatrix, false, this._viewMatrix);
    gl.uniformMatrix4fv(this._progShade.u_invViewMatrix, false, this._invViewMatrix);

    gl.uniform1f (this._progShade.u_width, canvas.width);
    gl.uniform1f (this._progShade.u_height, canvas.height);

    gl.uniform1f (this._progShade.u_farZ, camera.far);
    gl.uniform1f (this._progShade.u_nearZ, camera.near);

    // Bind g-buffers
    const firstGBufferBinding = 10; // You may have to change this if you use other texture slots
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
    }

    renderFullscreenQuad(this._progShade);
  }
};