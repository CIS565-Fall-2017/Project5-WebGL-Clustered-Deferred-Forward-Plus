WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Byumjin Kim
* Tested on: **Firefox 47.0.2**
  Windows 10, i7-6700HQ @ 2.60GHz 15.89GB GTX 1060 (mobile)


<br />
### Overview
<br />
In this project, I have used WebGL to implement Clustered Forward+ and Clustered Deferred renderer.<br />
<br />
<br />
#### Clustered Forward + Rendering & Clustered deferred Rendering
<br />
[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/Wck9Nlaz0s4/0.jpg)](https://www.youtube.com/watch?v=Wck9Nlaz0s4)
<br />
<br />
#### Lensflare Effect
<br />
[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/mQs093y-Xtc/0.jpg)](https://www.youtube.com/watch?v=mQs093y-Xtc)
<br />
<br />
<br />
<br />
### Complete requirements
<br />
- Basic Features
	- Clustered Forward+
	- Clustered Deferred
	- Blinn-Phong shading
	- Optimizations using two G- buffers (use total 6 channels)
		- Use 2-component normals
		- Reconstructing world space position
		- Use a screen-filling triangular instead of using quadrilateral

- Additional Features
	- Lensflare with Bloom using post-process Gaussian blur
<br />
<br />
<br />
#### Clustered Forward+
<br />
Build a data structure to keep track of how many lights are in each cluster and what their indices are.<br />
Then, render the scene using only the lights that overlap a given cluster.<br /><br />
<br />
I refered the Avalanche slides' solution for slicing frustum (Speacial Near).<br />
<br />
<br />
<br />
#### Clustered Deferred
<br />
Reuse clustering logic from Clustered Forward+.<br />
Store vertex attributes in g-buffers.<br />
Read g-buffers in a shader to produce final output.<br />
<br />
I used two G-buffers of which structure like below.
<br />
![](img/gbuffers.png) 
<br />
Instead of making vertex position G-buffer, reconstructing world space position with depth can prevent the artifact which happens on the area of screen where nothing be drawn.<br />
And, also it can save two channels.<br />
<br />
|  albedo | normal | position | depth | 
| ----------- | ----------- | ----------- | ----------- |
| ![](img/albedo-buffers.png) | ![](img/normal-buffers.png) | ![](img/position-buffers.png) | ![](img/depth-buffers.png) |
<br />
And, using a screen-filling triangular instead of using quadrilateral reduces overload of rendering.<br />
I used this only for one post-processing (Lensflare). But, the more post processes be used, the better rendering performance can be gotten.<br />
<br />
![](img/filling.png) 
<br />
<br />
<br />
#### Lensflare effect
<br />
Lens flare refers to a phenomenon wherein light is scattered or flared in a lens system, often in response to a bright light, producing an undesirable effect on the image.<br />
In order to create this effect, I referred to John chapman’s Lens flare which is not physically-based model.<br />
Of course, Physically-based Lens flare can generate more accurate effects but it is much expensive.<br />
To do this, it needs several independent effects ghosts, halo, diffraction created by very bright Scene color.<br />
And, at the final stage, composite the all effects with dirtmask texture and star burst texture. (below images are designed by me.)<br />
<br />
|  Dirt Mask Texture | Star Burst Texture | 
| ----------- | ----------- |
| ![](textures/DirtMask.png) | ![](textures/StarBurst.png) |
<br />
<br />
<br />
<br />
### Performance Analysis
<br />
#### Forward vs Clustered Forward+ vs Clustered Deferred
<br />
Resolution		  : 960 x 540<br />
Number of Lights  : 2500<br />
Light's radius	  : 3.0<br />
Cluster Dimension : 16 x 16 x 16<br />
<br />
![](img/second.png) 
<br />
|   | Forward | Clustered Forward+ | Clustered Deferred | 
| ----------- | ----------- | ----------- | ----------- |
| ms | 125 | 34 | 33 |
<br />
<br />
Resolution		  : 1920 x 1080<br />
Number of Lights  : 2500<br />
Light's radius	  : 3.0<br />
Cluster Dimension : 16 x 16 x 16  <br />
<br />
![](img/first.png) 
<br />
|   | Forward | Clustered Forward+ | Clustered Deferred | 
| ----------- | ----------- | ----------- | ----------- |
| ms | 333 | 66 | 32 |
<br />
The efficient of deferred rendering increases when the scene is drawn on larger screen space.
<br />
<br />
#### 2 Compacted G-buffer vs 4 G-buffer
<br />
Resolution		  : 1920 x 1080
Number of Lights  : 2500
Light's radius	  : 3.0
Cluster Dimension : 16 x 16 x 16  
<br />
![](img/third.png) 
<br />
|   | 2 | 4 |
| -- | -- | -- |
| ms | 34 | 34 |
<br />
As we can see, the difference of performance between former and later is really tiny.<br />
I think the time of fetching texels from g-buffers is similar to the time consumed by additional shader codes such as Reconstructing world space position and normal.<br />
But, obviously, in terms of memory, using 2 Compacted G-buffer can save the memory equivalent to 2 G-buffer textures.<br />
<br />
<br />
#### Quadrilateral vs Triangular Screen filling
<br />
Resolution		  : 1920 x 1080<br />
Number of Lights  : 2500<br />
Light's radius	  : 3.0<br />
Cluster Dimension : 16 x 16 x 16 <br />
RenderMode		  : Clustered Deferred Effect<br />
<br />
![](img/fourth.png) 
<br />
|   | Quadrilateral | Triangular |
| -- | -- | -- |
| ms | 32 | 32 |
<br />
<br />
### Credits
<br />
* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
