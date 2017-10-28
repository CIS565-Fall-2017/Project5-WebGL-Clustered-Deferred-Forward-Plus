WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Timothy Clancy
* Tested on: **Google Chrome 61.0.3163.100 (Official Build) (64-bit)** on
  Windows 10, i7-4700MQ @ 2.40GHz 8GB, GT 750M 2GB (Personal)

### A Note on this Analysis

This analysis was performed using a different machine than I normally develop with. Circumstances forced me to work with my old laptop, whose GT 750M might not have actually been working during these tests. The performance numbers measured here might have actually been from the on-board integrated graphics, although everything on my computer reported that they weren't. They just seem pretty low.

### The Shading Scene

In this project, a scene with some alterable number of lights is provided. The goal is to implement multiple shading approaches and compare their performance against one another.

|![The scene with 25 lights.](img/scene_25.PNG)|![The scene with 50 lights.](img/scene_50.PNG)|![The scene with 75 lights.](img/scene_75.PNG)|![The scene with 100 lights.](img/blinn_1000.PNG)|
|:-:|:-:|:-:|:-:|
|The scene with 25 lights.|The scene with 50 lights.|The scene with 75 lights.|The scene with 100 lights.|

### Live Online

[![An online demo of this implemntation is available here.](img/blinn_100)](https://timtinkers.github.io/Project5-WebGL-Clustered-Deferred-Forward-Plus/)

### Demo GIF

|![Sample clip of the renderer.](img/demo_60.gif)|
|:-:|
|Deferred cluster shading with Blinn-Phong in action, 60 lights.|

### Clustered Forward+ Shading

In this feature, the camera's frustum is partitioned into cells and lights are clustered by their cells. The data structure representing groupings of lights and cells is, in this case, a texture buffer used to map the count of lights in a cell to a listing of identifying indices for those lights.

|![Example x-partitioning.](img/x_debug.PNG)|![Example y-partitioning.](img/y_debug.PNG)|![Example z-partitioning.](img/z_debug.PNG)|
|:-:|:-:|:-:|
|Partitioning in the x-dimension.|Partitioning in the y-dimension.|Partitioning in the z-dimension.|

Once partitioned as such, this structure allows an updated fragment shader to more efficiently compute lighting. Fragments to be lit need only have lighting calculations performed for lights in their specific clusters, instead of for every single light.

### Clustered Deferred Shading

The second shading strategy implemented here is a Clustered Deferred shader, whereby fragment data and lighting calculations are performed in two separate passes, with lighting coming second.

### Optimization

Passing data to the lighting calculation of the Deferred clustered shader requires some number of buffers, as seen moving data from "deferredToTexture.frag.glsl" to "deferred.frag.glsl.js." I was able to optimize this from the four buffers provided down to just three: the information I needed is the color, normal, position, and normalized world view data. This required a total of 12 floats in three four-element buffers.

### Performance Analysis

These benchmarks were taken with the scene's camera in the standard, starting position across a variable number of lights. They measure in milliseconds the average time across 10 seconds taken to render a particular frame. Blinn-Phong was disabled for the deferred clustering for these tests. These comparisons illustrate the performance changes seen when adding the new features.

<p align="center">
  <img src="img/stratChart1.png"/>
</p>

As we can see, the deferred clustered shading approach offers the best performance. Surprisingly, the Forward+ clustered shading does not perform as well as the naive forward implementation provided. While this could possibly be a quirk of the scene or my hardware, I am afraid that it's more likely an issue with my implementation. Using three additional buffers to pass data to the Deferred clustered shader yields significant performance improvements. By deferring the lighting calculations until after some of the scene's data has been processed, we can minimize the cost of the shading operation as a whole.

### Blinn-Phong Shading

The deferred shader features additional Blinn-Phong specular highlighting. This is a flag which can be toggled like the other debug views in this implementation, and comes with a configurable value for the specular hardness of every surface. This gallery shows the effect of setting different specular hardness values on the scene.

|![Specular hardness of 1.](img/blinn_1.PNG)|![Specular hardness of 50.](img/blinn_50.PNG)|![Specular hardness of 100.](img/blinn_100.PNG)|![Specular hardness of 1000.](img/blinn_1000.PNG)|
|:-:|:-:|:-:|:-:|
|Specular hardness of 1.|Specular hardness of 50.|Specular hardness of 100.|Specular hardness of 1000.|

The addition of the Blinn-Phong feature did not have any noticeable performance impact. When compared across some variabled number of lights, the deferred cluster shader had very similar performance whether Blinn-Phong mode was enabled or not.

<p align="center">
  <img src="img/blinn_chart.png"/>
</p>

### Debugging Tools

In the course of implementing this shader comparison, I added some debug flags that can be toggled for the following displays.

|![Albedo debug view.](img/albedo_debug.PNG)|![Surface normal deug view.](img/normal_debug.PNG)|![Crazy Blinn-Phong.](img/bloop1.PNG)|
|:-:|:-:|:-:|
|Albedo debug.|Surface normal debug.|Ridiculous Blinn-Phong specular value.|

All of these flags are located in the deferred cluster fragment shader.

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
