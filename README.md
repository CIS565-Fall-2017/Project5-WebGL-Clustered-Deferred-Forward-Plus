WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Yuxin Hu
* Tested on: Windows 10, i7-6700HQ @ 2.60GHz 8GB, GTX 960M 4096MB (Personal Laptop)

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5B-WebGL-Deferred-Shading)

### Demo Video/GIF

![](img/RenderResultSame.gif)

![](img/RenderResultBlinn.gif)

![](img/BlinnPhongBetter.gif)

![](img/ZLogIntervalResult.gif)

### Yuxin Hu

### Overview
* This is a WebGL based project. There are three rendering methods implemented for performance comparason.
* Forward Rendering: For each geometry, loop over all lights in the scene.
* Forward Plus Clustered Rendering: Divide frustrum into 15*15*15 clusters. For each geometry, only loop over lights within the same cluster.
* Deferred Clustered Rendering: Generate gBuffer maps by 1st pass of scene. Each gBuffer stores the information of fragment that is going to be rendered on screen: such as normal, color, and position. In the second pass, for each fragment in gBuffer, applies the light in the same cluster.
* Cluster will improve the performance when the number of lights in scene increase. A preprocess to build the light cluster structure will increase the render speed. Deferred clustered rendering filters out the fragments that are occluded or outof screen in the first pass, and it saves computation over lights for these fragment in second pass, thus in general it is faster than forward plus rendering. However, deferred clustered does not handle transparent objects in scene.

### Features implemented:
* Create light cluster map storing light count and light index in each cluster. The clusters are divided by logarithmic in z direction, and equally divided in x and y directions. For each light, I checked its 6 bounding planes in x, y and z directions, and adding this light to the clusteres within these 6 bounding planes.
* Clustered deferred rendering. I reuse the light cluster map created for forward plus rendering, and create gBuffers to store fragment information, and then I pass the gBuffers to another fragment shader for light shading.
* Blinn-Phong shading model in clustered deferred rendering.

### Performance Analysis
## Performance Comparason between Clustered Forward+ and Clustered Deferred shading
![Performance Comparason between Clustered Forward+ and Clustered Deferred shading](/img/Performance1.PNG)
<p align="center"><b>Performance Comparason between Clustered Forward+ and Clustered Deferred shading</b></p>

![Performance Comparason between Clustered Forward+ and Clustered Deferred shading](/img/Performance2.PNG)
<p align="center"><b>Performance Comparason between Clustered Forward+ and Clustered Deferred shading</b></p>

Clustered Deferred shading is more than 2 times faster than Clustered Forward+ when the rendering is taken place inside castle. However, when the rendering is taken palce outside of the whole castle, the performance of Clustered Forward+ starts to get better than clustered deferred. Both shading methods use the same clustered lights calculations, so the performance difference arises from the calculation of which cluster does the fragment belong to. In clustered forward+, we loop over all vertex of geometries, calculate their clusteres, and find lights in those clusteres, no matter they will be rendered out in the final image or not. A lots of geometry vertice are out of screen space, or are being occluded, when the camera is inside the castle, which result in many calculations wasted. While clustered deferred shading has avoided this problem by filtering out the vertices that are occluded or out of screen in the first pass.

![Performance Comparason between Clustered Forward+ and Clustered Deferred shading](/img/Performance3.PNG)
<p align="center"><b>Performance Comparason between Clustered Forward+ and Clustered Deferred shading</b></p> 

As light number increases, the performance clustered deferred shading becomes much better than forward plus. While forward plus takes more time to do light calculation of geometry vertices that do not contribute to final rendering result, clustered deferred shading avoids the problem by first pass.

## Z Interval Slice By Log
![Performance Comparason between Z Slice Method](/img/Performance4.PNG)
<p align="center"><b>Performance Comparason between Z Slice Method</b></p> 

![Equal Z Slice Method](/img/equalZ.PNG)
<p align="center"><b>Equal Z Slice Method</b></p> 

![Log Z Slice Method](/img/logZ2.PNG)
<p align="center"><b>Log Z Slice Method</b></p> 

![Log Z Slice Method](/img/LogZ.PNG)
<p align="center"><b>Log Z Slice Method</b></p> 

Z interval is the length between far plane and near plane, which is a large range. If we divide the Z direction equally, then almost everything in the scene is going to be clustered in the first cluster along Z direction. By changing the division method from equally division to logarithmic division, so that intervalLenth^(_zSliceNum) equals total range along z direction, we can get more clusters along z direction to cover the geometries in scene. There will be fewer lights in each cluster, and the rendering of each fragment will be faster.


### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
