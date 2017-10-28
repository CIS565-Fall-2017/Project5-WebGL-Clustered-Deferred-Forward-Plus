WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Mauricio Mutai
* Tested on: **Version 61.0.3163.100 (Official Build) (64-bit)** on
  Windows 10, i7-7700HQ @ 2.2280GHz 16GB, GTX 1050Ti 4GB (Personal Computer)

### Live Online

[![](img/thumb.png)](http://MauKMu.github.io/Project5-WebGL-Clustered-Deferred-Forward-Plus)

### Demo Video/GIF

[![](img/video.png)](TODO)

### Overview

The aim of this project was to implement two different rendering pipelines. Both take advantage of clustered rendering, which, in simple terms, is an optimization in which we determine which lights can affect which parts of our frustum. This allows us to cull lights when shading fragments.

One pipeline is called Clustered Forward+. It takes the basic forward rendering pipeline and applies clustering.

The other pipeline is called Clustered Deferred pipeline. In this pipeline, we *defer* the shading until after we have determined which pieces of geometry will be rendered.

### Features

#### Clustered Forward+

* Keeps track of which lights overlap each subsection of the frustum (cluster)

* Uses exponential partitioning in Z axis for more useful partitioning

* Renders each fragment using only lights that overlap the fragment's cluster

#### Clustered Deferred

* Stores vertex attributes using two g-buffers

* Reads g-buffers and cluster buffer (same as in Clustered Forward+) to render final fragments

### Performance

#### Preface

I would like to preface this performance analysis by mentioning that there is a possibility the results below are influenced by some sort of bug with Chrome/Node.JS/etc. The timing mechanisms I used (`Date.now()` and `Stats.js`) both tell me the Forward pipeline renders all frames with only 0 or 1 ms of delay, which is clearly absurd. It also only registers 10 FPS upon switching to FPS mode, which is incompatible with a 1 ms delay (we would expect 1000 FPS instead). Restarting Chrome and my computer did not help. In summary, I think my measurements may not be correct, but I had no means of fixing this, and received no help after asking the mailing list (it might be a computer-specific problem).

#### Clustered Forward+ vs Clustered Deferred

I got roughly the same performance for both clustered forward+ and clustered deferred. The graph below shows this:

![](img/FvsD.png)

The deferred pipeline is slightly faster, but in practice, both have the same performance even as the number of lights increases. Normally, one would expect the deferred pipeline to handle more lights better, since it spends less time shading fragments with each light -- it only shades the final fragments that need to be shaded, whereas the forward+ pipeline will shade all fragments, even those that won't be rendered. This means the forward+ pipeline should slow down more as lights are added, when compared to the deferred pipeline.

So it is unusual that both have the same performance. I have three hypotheses for this behavior.

* The clustering optimization is bottlenecking both implementations equally. This is definitely possible, due to the large number of memory accesses required by this optimization.

* The deferred pipeline saves time due to its deferred nature (explained above), but is slowed down by the extra work it has to do, such as performing an additional pass to write to the g-buffer and reading from the g-buffer.

* As mentioned in the preface, my measurements might just be incorrect due to some hardware/software fault out of my control.

In general terms, the benefit of using the deferred pipeline would be its better performance in scenes with a high number of lights. However, there is one tradeoff: the additional memory needed for the g-buffer. An environment with a memory-starved GPU may not be able to run a deferred pipeline.

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
