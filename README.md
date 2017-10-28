WebGL Clustered Deferred and Forward+ Shading
======================

**Course project #5 for CIS 565: GPU Programming and Architecture, University of Pennsylvania**

* (TODO) YOUR NAME HERE
* Tested on: (TODO) **Google Chrome 62.0.3202.62** on
  - Mac OSX 10.10.5
  - Processor: 2.5 GHz Intel Core i7
  - Memory: 16 GB 1600 MHz DDR3
  - Graphics: Intel Iris Pro 1536 MB


## Project Overview
The goal of this project was to get an introduction to Clustered Deferred and Forward+ Shading in WebGL. 

This algorithm is 

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5B-WebGL-Deferred-Shading)




### Demo Video/GIF

[![](img/video.png)](TODO)

#### Forward+
![](./renders/cluster-1.gif)

#### Deferred 
![](./renders/deferred-1.gif)

### Features and Optimizations
* Clustered Forward+ shading
* Clustered Deferred shading with g-buffers 
* Blinn-Phong shading (diffuse + specular) for point lights
* Gamma Correction
* Optimized g-buffer format (by reducing the number and size of g-buffers)
  - Packing values together into vec4s
  - Using 2-component normals


### Algorithm Descriptions

#### Forward Rendering

#### Clustered Forward+

#### Clustered Deferred



## Performance Analysis

Compare your implementations of Clustered Forward+ and Clustered Deferred shading and analyze their differences.

Is one of them faster?
Is one of them better at certain types of workloads?
What are the benefits and tradeoffs of using one over the other?
For any differences in performance, briefly explain what may be causing the difference.


![](./renders/renderer-comparison-graph.png)

==================================================================================================================

Effect Features:
Concise overview write-up of the feature.
Performance change due to adding the feature.
If applicable, how do parameters (such as number of lights, etc.) affect performance? Show data with simple graphs.
    Show timing in milliseconds, not FPS.
If you did something to accelerate the feature, what did you do and why?
How might this feature be optimized beyond your current implementation?

![](./renders/effects-graph.png)


==================================================================================================================

Performance Features:
Concise overview write-up of the feature.
Detailed performance improvement analysis of adding the feature
    What is the best case scenario for your performance improvement? What is the worst? Explain briefly.
    Are there tradeoffs to this performance feature? Explain briefly.
    How do parameters (such as number of lights, tile size, etc.) affect performance? Show data with graphs.
        Show timing in milliseconds, not FPS.
    Show debug views when possible.
        If the debug view correlates with performance, explain how.


TALK ABOUT ---> Optimization for normals to get more correct output: utilizing octahedron normal encoding instead
TALK ABOUT --> DOING VIEW MATRIX * VPOS IS BETTER IN VERTEX SHADER THAN IN FRAGMENT SHADER???


![](./renders/optimization-graph.png)

### Credits and Resources

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)

* [CIS 460 lecture notes on camera frustum](https://docs.google.com/presentation/d/e/2PACX-1vQrlrzC6XQCvRCQTr9k5dtUCpZFnbqlbcYXoFt1lcjBRdn_r4HD7GabLiGo7Ht0Dxvp4w_cWdV_ZaYh/pub?start=false&loop=false&delayms=60000&slide=id.g2492ec6f45_0_215)
* [Blinn-Phong Shading Model](https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model)
* [Foward vs Deferred Rendering](https://gamedevelopment.tutsplus.com/articles/forward-rendering-vs-deferred-rendering--gamedev-12342)
* [glMatrix Documentation](http://glmatrix.net/docs/module-vec3.html)
* [Intro to real-time shading of many lights SIGGRAPH course notes](https://newq.net/dl/pub/SA2014ManyLightIntro.pdf)
* [Practical Clustered Shading - Avalanche Studios](http://www.humus.name/Articles/PracticalClusteredShading.pdf)

**Normal Compression** 
* [Compact Normals for g-buffers](https://aras-p.info/texts/CompactNormalStorage.html)
* [(Not implemented) Octahedron Normal Encoding](https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/)

**Other good resources (unused)**
* [Extracting View Frustum Plans From Projection Matrix](http://gamedevs.org/uploads/fast-extraction-viewing-frustum-planes-from-world-view-projection-matrix.pdf)
* [BVH light storage](https://worldoffries.wordpress.com/2015/02/19/simple-alternative-to-clustered-shading-for-thousands-of-lights/)
* [Deferred Rendering Tutorial](http://www.codinglabs.net/tutorial_simple_def_rendering.aspx)
* [Deferred Lighting](https://www.opengl.org/discussion_boards/showthread.php/167687-Deferred-lighting)