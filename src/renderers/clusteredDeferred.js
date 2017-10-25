import { gl, WEBGL_draw_buffers, canvas } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import toTextureVert from '../shaders/deferredToTexture.vert.glsl';
import toTextureFrag from '../shaders/deferredToTexture.frag.glsl';
import QuadVertSource from '../shaders/quad.vert.glsl';
import fsSource from '../shaders/deferred.frag.glsl.js';
import fsSourceRTT from '../shaders/deferredRTT.frag.glsl.js';
import fsSourceBrightnessFilterRTT from '../shaders/brightnessFilterRTT.frag.glsl';
import TextureBuffer from './textureBuffer';
import ClusteredRenderer from './clustered';
import { MAX_LIGHTS_PER_CLUSTER } from './clustered';


//export const NUM_GBUFFERS = 4;
export const NUM_GBUFFERS = 2;


export default class ClusteredDeferredRenderer extends ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    super(xSlices, ySlices, zSlices);

    this.isBloomPostProcess = true;


    this.setupDrawBuffers(canvas.width, canvas.height);

    // Create a texture to store light data
    this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);

    this._progCopy = loadShaderProgram(toTextureVert, toTextureFrag, {
      uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap', 'u_viewMatrix',],
      attribs:  ['a_position', 'a_normal', 'a_uv'],
    });

    this._progShade = loadShaderProgram(QuadVertSource, fsSource({
      numLights: NUM_LIGHTS,
      numGBuffers: NUM_GBUFFERS,
      maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
      numXSlices: xSlices,
      numYSlices: ySlices,
      numZSlices: zSlices,
    }), {
      uniforms: ['u_gbuffers[0]', 'u_gbuffers[1]', 'u_lightbuffer', 'u_nearClip', 'u_cluster_tile_size', 'u_cluster_depth_stride', 'u_viewMatrix', 'u_clusterbuffer', 'u_invViewProjMatrix', 'u_invViewMatrix'],
      attribs:  ['a_uv'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
    this._invViewMatrix = mat4.create();
    this._invViewProjMatrix = mat4.create();

    // ------------------- Bloom post prcessing configure ---------------------
    if(this.isBloomPostProcess){

      // Configure RTT shder program
      this._progShadeRTT = loadShaderProgram(QuadVertSource, fsSourceRTT({
        numLights: NUM_LIGHTS,
        numGBuffers: NUM_GBUFFERS,
        maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
        numXSlices: xSlices,
        numYSlices: ySlices,
        numZSlices: zSlices,
      }), {
        uniforms: ['u_gbuffers[0]', 'u_gbuffers[1]', 'u_lightbuffer', 'u_nearClip', 'u_cluster_tile_size', 'u_cluster_depth_stride', 'u_viewMatrix', 'u_clusterbuffer', 'u_invViewProjMatrix', 'u_invViewMatrix'],
        attribs:  ['a_uv'],
      });

      this._progBirghtnessFilterRTT = loadShaderProgram(QuadVertSource, fsSourceBrightnessFilterRTT, {
        uniforms: ['u_oriSceenBuffer'],
        attribs:  ['a_uv'],
      });


    }



  }

  setupDrawBuffers(width, height) {
    this._width = width;
    this._height = height;

    this._fbo_gbuffer = gl.createFramebuffer();

    //Create, bind, and store a depth target texture for the FBO
    this._depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_gbuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);


    let attachments = new Array(NUM_GBUFFERS);

    // Create, bind, and store "color" target textures for the FBO
    this._gbuffers = new Array(NUM_GBUFFERS);
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

    // ------------------- add bloom post processing FBOs --------------------------
    if(this.isBloomPostProcess){

      //***********  Origin Screnn frame buffer *************
      this._fbo_oriScreen = gl.createFramebuffer();

      //Create, bind, and store a depth target texture for the FBO
      this._depthTex_postprocess_0 = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_oriScreen);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_postprocess_0, 0);

      let attachments_0 = new Array(1);
      attachments_0[0] = WEBGL_draw_buffers[`COLOR_ATTACHMENT0_WEBGL`];
      this._oriScreenBuffer = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments_0[0], gl.TEXTURE_2D, this._oriScreenBuffer, 0);


      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
        throw "Framebuffer incomplete";
      }

      WEBGL_draw_buffers.drawBuffersWEBGL(attachments_0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);





    }

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

    // -------------------- resize bloom FBOs ----------------------------
    if(this.isBloomPostProcess){
      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);


      gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
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
    mat4.invert(this._invViewMatrix, this._viewMatrix);
    mat4.invert(this._invViewProjMatrix, this._viewProjectionMatrix);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_gbuffer);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the shader program to copy to the draw buffers
    gl.useProgram(this._progCopy.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._progCopy.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
    gl.uniformMatrix4fv(this._progCopy.u_viewMatrix, false, this._viewMatrix);

    // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
    scene.draw(this._progCopy);

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

    // Update the clusters for the frame
    this.updateClusters(camera, this._viewMatrix, scene);

    // ------------------------------- Use g-buffer render starts -------------------------------------
    if(!this.isBloomPostProcess){
      // Bind the default null framebuffer which is the screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Clear the frame
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Use this shader program
      gl.useProgram(this._progShade.glShaderProgram);

      // TODO: Bind any other shader inputs
      // Set the light texture as a uniform input to the shader
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
      gl.uniform1i(this._progShade.u_lightbuffer, 0);

      // Set the cluster texture as a uniform input to the shader
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
      gl.uniform1i(this._progShade.u_clusterbuffer, 1);

      gl.uniform2f(this._progShade.u_cluster_tile_size, (canvas.width )/this._xSlices, (canvas.height)/this._ySlices);
      gl.uniform1f(this._progShade.u_nearClip, camera.near);
      gl.uniform1f(this._progShade.u_cluster_depth_stride, (camera.far - camera.near) / this._zSlices);
      gl.uniformMatrix4fv(this._progShade.u_viewMatrix, false, this._viewMatrix);
      gl.uniformMatrix4fv(this._progShade.u_invViewMatrix, false, this._invViewMatrix);
      gl.uniformMatrix4fv(this._progShade.u_invViewProjMatrix, false, this._invViewProjMatrix);

      // Bind g-buffers
      const firstGBufferBinding = 2; // You may have to change this if you use other texture slots
      for (let i = 0; i < NUM_GBUFFERS; i++) {
        gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
        gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
        gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
      }

      renderFullscreenQuad(this._progShade);
    }

    // ------------------------ bloom post processing ----------------------------
    else{
      // 1. Render origin sceen frame buffer
      // USE FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_oriScreen);

      // Clear the frame
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Use this shader program
      gl.useProgram(this._progShadeRTT.glShaderProgram);

      // Set the light texture as a uniform input to the shader
      gl.activeTexture(gl.TEXTURE0); //gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
      gl.uniform1i(this._progShadeRTT.u_lightbuffer, 0);

      // Set the cluster texture as a uniform input to the shader
      gl.activeTexture(gl.TEXTURE1);//gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
      gl.uniform1i(this._progShadeRTT.u_clusterbuffer, 1);

      gl.uniform2f(this._progShadeRTT.u_cluster_tile_size, (canvas.width )/this._xSlices, (canvas.height)/this._ySlices);
      gl.uniform1f(this._progShadeRTT.u_nearClip, camera.near);
      gl.uniform1f(this._progShadeRTT.u_cluster_depth_stride, (camera.far - camera.near) / this._zSlices);
      gl.uniformMatrix4fv(this._progShadeRTT.u_viewMatrix, false, this._viewMatrix);
      gl.uniformMatrix4fv(this._progShadeRTT.u_invViewMatrix, false, this._invViewMatrix);
      gl.uniformMatrix4fv(this._progShadeRTT.u_invViewProjMatrix, false, this._invViewProjMatrix);

      // Bind g-buffers
      const firstGBufferBinding = 2; // You may have to change this if you use other texture slots
      for (let i = 0; i < NUM_GBUFFERS; i++) {
        gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
        gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
        gl.uniform1i(this._progShadeRTT[`u_gbuffers[${i}]`], i + firstGBufferBinding);
      }

      renderFullscreenQuad(this._progShadeRTT);



      // 2. Brightness filter
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(this._progBirghtnessFilterRTT.glShaderProgram);

      // bind original screen frame buffer
      gl.activeTexture(gl.TEXTURE4); //gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
      gl.uniform1i(this._progBirghtnessFilterRTT.u_oriSceenBuffer, 4);

      renderFullscreenQuad(this._progBirghtnessFilterRTT);

    }

  }
};
