import { gl, WEBGL_draw_buffers, canvas } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import vsSource from '../shaders/forward.vert.glsl';
import fsSource from '../shaders/forward.frag.glsl.js';

import QuadVertSource from '../shaders/quad.vert.glsl';
import fsSourceRTT from '../shaders/forwardRTT.frag.glsl.js';
import fsSourceBrightnessFilterRTT from '../shaders/brightnessFilterRTT.frag.glsl';
import fsSourceBlurRTT from '../shaders/blurRTT.frag.glsl';
import vsSourceHorizontalBlurRTT from '../shaders/horizontalBlurRTT.vert.glsl';
import vsSourceVerticalBlurRTT from '../shaders/verticalBlurRTT.vert.glsl';
import fsSourceCombine from '../shaders/combineFragment.frag.glsl';

import TextureBuffer from './textureBuffer';

export default class ForwardRenderer {

  // ***********************************************************************
  // ************************* Bloom Part starts ***************************
  // ***********************************************************************

  // ------------- Bloom post prcessing shad program configure ---------------
  bloomConfigration(){
    // Configure RTT shder program
    this._shaderProgramRTT = loadShaderProgram(vsSource, fsSourceRTT({
      numLights: NUM_LIGHTS,
      isToonShading: this.isToonShadingPostProcess,
    }), {
      uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap', 'u_lightbuffer'],
      attribs: ['a_position', 'a_normal', 'a_uv'],
    });


    this._progBirghtnessFilterRTT = loadShaderProgram(QuadVertSource, fsSourceBrightnessFilterRTT, {
      uniforms: ['u_oriSceenBuffer'],
      attribs:  ['a_uv'],
    });

    this._progHorizontalBlurRTT = loadShaderProgram(vsSourceHorizontalBlurRTT, fsSourceBlurRTT, {
      uniforms: ['u_targetWidth', 'u_texture'],
      attribs:  ['a_uv'],
    });

    this._progVerticalBlurRTT = loadShaderProgram(vsSourceVerticalBlurRTT, fsSourceBlurRTT, {
      uniforms: ['u_targetHeight', 'u_texture'],
      attribs:  ['a_uv'],
    });

    this._progCombine = loadShaderProgram(QuadVertSource, fsSourceCombine, {
      uniforms: ['u_colorTexture', 'u_hightlightTexture'],
      attribs:  ['a_uv'],
    });
  }


  // ---------------- add bloom post processing FBOs ----------------------
  setupBloomDrawBuffers(width, height){
    this._width = width;
    this._height = height;

    let attachments_0 = new Array(1);
    attachments_0[0] = WEBGL_draw_buffers[`COLOR_ATTACHMENT0_WEBGL`];

    //***********  Origin Screnn frame buffer *************
    this._fbo_oriScreen = gl.createFramebuffer();

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

    //************** brightness filter frame buffer ********************
    this._fbo_brightnessFilter = gl.createFramebuffer();

    this._depthTex_postprocess_1_downScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_1_downScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_brightnessFilter);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_postprocess_1_downScale, 0);

    this._birghtnessFilterBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments_0[0], gl.TEXTURE_2D, this._birghtnessFilterBuffer, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "Framebuffer incomplete";
    }

    WEBGL_draw_buffers.drawBuffersWEBGL(attachments_0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    //**************** down scale frame buffer 1******************
    this._fbo_downScale1 = gl.createFramebuffer();

    this._depthTex_postprocess_2_downScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_2_downScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_downScale1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_postprocess_2_downScale, 0);

    this._downScale1Buffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments_0[0], gl.TEXTURE_2D, this._downScale1Buffer, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "Framebuffer incomplete";
    }

    WEBGL_draw_buffers.drawBuffersWEBGL(attachments_0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    //**************** down scale frame buffer 2******************
    this._fbo_downScale2 = gl.createFramebuffer();

    this._depthTex_postprocess_3_downScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_3_downScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_downScale2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_postprocess_3_downScale, 0);

    this._downScale2Buffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments_0[0], gl.TEXTURE_2D, this._downScale2Buffer, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "Framebuffer incomplete";
    }

    WEBGL_draw_buffers.drawBuffersWEBGL(attachments_0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  // ---------------- Resize bloom buffers ----------------------
  bloomBufferResize(width, height){
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_1_downScale);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.RGBA, gl.FLOAT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_2_downScale);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_postprocess_3_downScale);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

    gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);
  }


  // ---------------- Render bloom buffers ----------------------
  renderBloom(camera, scene){
    // 1. Render origin sceen frame buffer
    // Bind the default null framebuffer which is the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_oriScreen);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._shaderProgramRTT.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._shaderProgramRTT.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    // Set the light texture as a uniform input to the shader
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
    gl.uniform1i(this._shaderProgramRTT.u_lightbuffer, 2);

    // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
    scene.draw(this._shaderProgramRTT);



    // 2. Brightness filter
    //since our Brightness frame buffer is downscale by 2
    gl.viewport(0, 0, canvas.width / this._brightnessFilterDownScale, canvas.height / this._brightnessFilterDownScale);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_brightnessFilter);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progBirghtnessFilterRTT.glShaderProgram);

    // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE4); //gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
    gl.uniform1i(this._progBirghtnessFilterRTT.u_oriSceenBuffer, 4);

    renderFullscreenQuad(this._progBirghtnessFilterRTT);



    // 3. Horizontal BLur
    gl.viewport(0, 0, canvas.width / this._blurDownScale, canvas.height / this._blurDownScale);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_downScale1);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progHorizontalBlurRTT.glShaderProgram);

    // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE5); //gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
    gl.uniform1i(this._progHorizontalBlurRTT.u_texture, 5);

    gl.uniform1f(this._progHorizontalBlurRTT.u_targetWidth, this._width / this._brightnessFilterDownScale);

    renderFullscreenQuad(this._progHorizontalBlurRTT);


    // 4. Vertical BLur
    gl.viewport(0, 0, canvas.width / this._blurDownScale, canvas.height / this._blurDownScale);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_downScale2);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progVerticalBlurRTT.glShaderProgram);

    // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE6); //gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
    gl.uniform1i(this._progVerticalBlurRTT.u_texture, 6);

    gl.uniform1f(this._progVerticalBlurRTT.u_targetHeight, this._height / this._blurDownScale);

    renderFullscreenQuad(this._progVerticalBlurRTT);


    // 5. Combine results
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progCombine.glShaderProgram);

    // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._oriScreenBuffer);
    gl.uniform1i(this._progCombine.u_colorTexture, 4);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
    gl.uniform1i(this._progCombine.u_hightlightTexture, 7);

    renderFullscreenQuad(this._progCombine);
  }
  // ***********************************************************************
  // ************************* Bloom Part ends *****************************
  // ***********************************************************************


  constructor(isBloom, isToonShading) {

    this.isBloomPostProcess = isBloom;
    this.isToonShadingPostProcess = isToonShading;

    if(this.isBloomPostProcess){
        this._brightnessFilterDownScale = 2.0;
        this._blurDownScale = 6.0;

        this.setupBloomDrawBuffers(canvas.width, canvas.height);
    }


    // Create a texture to store light data
    this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);

    // Initialize a shader program. The fragment shader source is compiled based on the number of lights
    this._shaderProgram = loadShaderProgram(vsSource, fsSource({
      numLights: NUM_LIGHTS,
      isToonShading: this.isToonShadingPostProcess,
    }), {
      uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap', 'u_lightbuffer'],
      attribs: ['a_position', 'a_normal', 'a_uv'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();

    if(this.isBloomPostProcess){
      this.bloomConfigration();
    }

  }

  resize(width, height) {
    this._width = width;
    this._height = height;

    // -------------------- resize bloom FBOs ----------------------------
    if(this.isBloomPostProcess){
        this.bloomBufferResize(width, height);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(camera, scene) {

    if(this.isBloomPostProcess){
      if (canvas.width != this._width || canvas.height != this._height) {
        this.resize(canvas.width, canvas.height);
      }
    }

    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

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

    if(!this.isBloomPostProcess){
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

      // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
      scene.draw(this._shaderProgram);
    }
    else{
      // Bloom Post processing
      this.renderBloom(camera, scene);
    }
  }
};
