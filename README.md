WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Fengkai Wu
* Tested on: **Google Chrome 61.0.3163.100 (64bit)** on
  Windows 10, i7-4700HQ @ 2.40GHz 4GB, GT 745M 2048MB (Personal)

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5B-WebGL-Deferred-Shading)

### Demo Video/GIF

[![](img/video.png)](TODO)

### Analysis

#### Clustered Forward+
* Divides the space in clusters (or small blocks) and only render when lights overlapped on a cluster.
* Keeps track of the indices of lights based on a data structure to enable fast look up.

#### Clustered Deferred
* Using clusteres to keep track of lights. (Same as above)
* Stores attributes in g-buffers and renders on the last pass.
* Uses three g buffers to store the attributes.
* Adds Bling-Phong shading model

This figure shows the data g-buffers are storing, which corresponds to albedo, normal and position.
![g-buffers](https://github.com/wufk/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/gbuffers.png)

Below shows the performance using different rendering strategies.

![](https://github.com/wufk/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/numLights.PNG)

As the graph shows, the rendering time varies significantly with different strategies. Naive forward is the simplest way, which iterates all the lights and does computation on all of them, which is very slow, and the running time increasing very fast when we have more lights to render. 

Clustered forward+ is a good technique, which only computes the lights are overlapped in clusteres, which greately reduces the amount of work. When the number of lights is relatively small. the speed is considerably reduced. 

Clustered deferred stores the vertex attributes in g-buffers and only do the computation at the last pass. This technique is much more faster than the previous two especially when number of lights is large.


### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
