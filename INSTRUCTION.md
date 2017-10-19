WebGL Clustered Deferred and Forward+ Shading - Instructions
==========================================================

## Running the code

- Clone this repository
- Download and install [Node.js](https://nodejs.org/en/)
- Run `npm install` in the root directory of this project. This will download and install dependences
- Run `npm start` and navigate to [http://localhost:5650](http://localhost:5650)

This project requires a WebGL-capable browser with support for several extensions. You can check for support on [WebGL Report](http://webglreport.com/):
- OES_texture_float
- OES_texture_float_linear
- OES_element_index_uint
- EXT_frag_depth
- WEBGL_depth_texture
- WEBGL_draw_buffer

Google Chrome seems to work best on all platforms. If you have problems running the starter code, use Chrome or Chromium, and make sure you have updated your browser and video drivers.

## Requirements
**Ask on the mailing list for any clarifications**

In this project, you are given code for:
- Loading glTF models
- Camera control
- Simple forward renderer
- Partial implementation and setup for Clustered Deferred and Forward+ shading
- Many helpful helpers

## Required Tasks

**Before doing performance analysis**, you must disable debug mode by changing `DEBUG` to false in `src/init.js`. Keep it enabled when developing - it helps find WebGL errors *much* more easily.

**Clustered Forward+**
  - Build a data structure to keep track of how many lights are in each cluster and what their indices are
  - Render the scene using only the lights that overlap a given cluster

**Clustered Deferred**
  - Reuse clustering logic from Clustered Forward+
  - Store vertex attributes in g-buffer
  - Read g-buffer in a shader to produce final output

**Effects**
- Implement deferred Blinn-Phong shading (diffuse + specular) for point lights
- OR
- Implement one of the following effects:
  - Bloom using post-process blur (box or Gaussian)
  - Toon shading (with ramp shading + simple depth-edge detection for outlines)

**Optimizations**
  - Optimized g-buffer format - reduce the number and size of g-buffers:
    - Ideas:
      - Pack values together into vec4s
      - Use 2-component normals
      - Quantize values by using smaller texture types instead of gl.FLOAT
      - Reduce number of properties passed via g-buffer, e.g. by:
        - Reconstructing world space position using camera matrices and X/Y/depth
    - For credit, you must show a good optimization effort and record the performance of each version you test, in a simple table.
      - It is expected that you won't need all 4 provided g-buffers for a basic pipeline make sure you disable the unused ones.

## Performance & Analysis

Compare your implementations of Clustered Forward+ and Clustered Deferred shading and analyze their differences.
  - Is one of them faster?
  - Is one of them better at certain types of workloads?
  - What are the benefits and tradeoffs of using one over the other?
  - For any differences in performance, briefly explain what may be causing the difference.

**Before doing performance analysis**, you must disable debug mode by changing `DEBUG` to false in `src/init.js`. Keep it enabled when developing - it helps find WebGL errors *much* more easily.

Optimize your JavaScript and/or GLSL code. Chrome/Firefox's profiling tools (see Resources section) will be useful for this. For each change that improves performance, show the before and after render times.

For each new effect feature (required or extra), please provide the following analysis:
  - Concise overview write-up of the feature.
  - Performance change due to adding the feature.
  - If applicable, how do parameters (such as number of lights, etc.) affect performance? Show data with simple graphs.
    - Show timing in milliseconds, not FPS.
  - If you did something to accelerate the feature, what did you do and why?
  - How might this feature be optimized beyond your current implementation?

For each performance feature (required or extra), please provide:
  - Concise overview write-up of the feature.
  - Detailed performance improvement analysis of adding the feature
    - What is the best case scenario for your performance improvement? What is the worst? Explain briefly.
    - Are there tradeoffs to this performance feature? Explain briefly.
    - How do parameters (such as number of lights, tile size, etc.) affect performance? Show data with graphs.
      - Show timing in milliseconds, not FPS.
    - Show debug views when possible.
      - If the debug view correlates with performance, explain how.

## Starter Code Tour

Initialization happens in `src/init.js`. You don't need to worry about this; it is mostly initializing the gl context, debug modes, extensions, etc.

`src/main.js` is configuration for the renderers. It sets up the gui for switching renderers and initializes the scene and render loop. The only important thing here are the arguments for `ClusteredForwardPlusRenderer` and `ClusteredDeferredRenderer`. These constructors take the number of x, y, and z slices to split the frustum into.

`src/scene.js` handles loading a .gltf scene and initializes the lights. Here, you can modify the number of lights, their positions, and how they move around. Also, take a look at the `draw` function. This handles binding the vertex attributes, which are hardcoded to `a_position`, `a_normal`, and `a_uv`, as well as the color and normal maps to targets `gl.TEXTURE0` and `gl.TEXTURE1`.

**Simple Forward Shading Pipeline**
I've written a simple forward shading pipeline as an example for how everything works. Check out `src/forward.js`.

The constructor for the renderer initializes a `TextureBuffer` to store the lights. This isn't totally necessary for a forward renderer, but you'll need this to do clustered shading. What we're trying to do here is upload to a shader all the positions of our lights. However, we unfortunately can't upload arbitrary data to the GPU with WebGL so we have to pack it as a texture. Figuring out how to do this is terribly painful so I did it for you.

The constructor for `TextureBuffer` takes two arguments, the number of elements, and the size of each element (in floats). It will allocate a floating point texture of dimension `numElements x ceil(elementSize / 4)`. This is because we pack every 4 adjacent values into a single pixel.

Go to the `render` function to see how this is used in practice. Here, the buffer for the texture storing the lights is populated with the light positions. Notice that the first four values get stored at locations: `this._lightTexture.bufferIndex(i, 0) + 0` to `this._lightTexture.bufferIndex(i, 0) + 3` and then the next three are at `this._lightTexture.bufferIndex(i, 1) + 0` to `this._lightTexture.bufferIndex(i, 0) + 2`. Keep in mind that the data is stored as a texture, so the 5th element is actually the 1st element of the pixel in the second row.

Look again at the constructor of `ForwardRenderer`. Also initialized here is the shader program. The shader program takes in a vertex source, a fragment source, and then a map of what uniform and vertex attributes should be extracted from the shader. In this code, the shader location for `u_viewProjectionMatrix` gets stored as `this._shaderProgram.u_viewProjectionMatrix`. If you look at `fsSource`, there's a strange thing happening there. `fsSource` is actually a function and it's being called with a configuration object containing the number of lights. What this is doing is creating a shader source string that is parameterized. We can't have dynamic loops in WebGL, but we can dynamically generate static shaders. If you take a look at `src/shaders/forward.frag.glsl.js`, you'll see that `${numLights}` is used throughout.

Now go look inside `src/shaders/forward.frag.glsl.js`. Here, there is a simple loop which loops over the lights and applies shading for each one. I've written a helper called `UnpackLight(index)` which unpacks the `index`th light from the texture into a struct. Make sure you fully understand how this is working because you will need to implement something similar for clusters. Inside `UnpackLight` I use another helper called `ExtractFloat(texture, textureWidth, textureHeight, index, component)`. This pulls out the `component`th component from the `index`th value packed inside a `textureWidth x textureHeight` texture. Again, this is meant to be an example implementation. Using this function to pull out four values into a `vec4` will be unecessarily slow.

**Getting Started**
Here's a few tips to get you started.

1. Complete `updateClusters` in `src/renderers/clustered.js`. This should update the cluster `TextureBuffer` with a mapping from cluster index to light count and light list (indices).

2. Update `src/shaders/clusteredForward.frag.glsl.js` to
  - Determine the cluster for a fragment
  - Read in the lights in that cluster from the populated data
  - Do shading for just those lights
  - You may find it necessary to bind additional uniforms in `src/renderers/clusteredForwardPlus.js`

3. Update `src/shaders/deferredToTexture.frag.glsl` to write desired data to the g-buffer
4. Update `src/deferred.frag.glsl` to read values from the g-buffer and perform simple forward rendering. (Right now it just outputs the screen xy coordinate)
5. Update it to use clustered shading. You should be able to reuse lots of stuff from Clustered Forward+ for this. You will also likely need to update shader inputs in `src/renderers/clusteredDeferred.js`

## README

Replace the contents of the README.md in a clear manner with the following:
- A brief description of the project and the specific features you implemented.
- At least one screenshot of your project running.
- A 30+ second video/gif of your project running showing all features. (Even though your demo can be seen online, using multiple render targets means it won't run on many computers. A video will work everywhere.)
- Performance analysis (described above)

**GitHub Pages**
Since this assignment is in WebGL, you can make your project easily viewable by taking advantage of GitHub's project pages feature.

Once you are done with the assignment, create a new branch:

`git branch gh-pages`

Run `npm run build` and commit the compiled files

Push the branch to GitHub:

`git push origin gh-pages`

Now, you can go to `<user_name>.github.io/<project_name>` to see your renderer online from anywhere. Add this link to your README.

## Submit

Beware of any build issues discussed on the Google Group.

Open a GitHub pull request so that we can see that you have finished. The title should be "Project 5B: YOUR NAME". The template of the comment section of your pull request is attached below, you can do some copy and paste:

- Repo Link
- (Briefly) Mentions features that you've completed. Especially those bells and whistles you want to highlight
  - Feature 0
  - Feature 1
  - ...
- Feedback on the project itself, if any.

### Third-Party Code Policy

- Use of any third-party code must be approved by asking on our mailing list.
- If it is approved, all students are welcome to use it. Generally, we approve use of third-party code that is not a core part of the project. For example, for the path tracer, we would approve using a third-party library for loading models, but would not approve copying and pasting a CUDA function for doing refraction.
- Third-party code **MUST** be credited in README.md.
- Using third-party code without its approval, including using another student's code, is an academic integrity violation, and will, at minimum, result in you receiving an F for the semester.
