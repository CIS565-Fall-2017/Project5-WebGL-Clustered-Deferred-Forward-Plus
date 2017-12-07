WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Daniel Daley-Mongtomery
* Tested on: Google Chrome v62.0.3202.94
  MacBook Pro, OSX 10.12, i7 @ 2.3GHz, 16GB RAM, GT 750M 2048MB (Personal Machine)

### Live Online

[![Live Test Thumbnail](img/testshot.png)](https://illdivino.github.io/Project5-WebGL-Clustered-Deferred-Forward-Plus/)

### Demo Video/GIF

[![Video Thumbnail](img/video.png)](https://www.youtube.com/watch?v=9cHoAc6pyD4)

### Motivation
A basic forward shading system works as follows:
```
for every fragment {
  for every light {
    shade(light, fragment);
  }
}
```
  This results in a serious increase in work for every light added, even if that light affects one pixel of the final image. The goal of this project is to devise a means of reducing lights' impact on realtime rendering by clustering the lights into areas of influence and by preventing per-light shading work on fragments that don't make it to the frame buffer. To this effect I've implemented the following features:
* Viewspace Light Clustering on the CPU
* Clustered Forward+ Rendering
* Deferred Rendering
* Blinn-Phong shading
* Dynamic and Logarithmic Z-Division for Cluster Generation
* 2-Component Normals for Reduced GBuffer Size

### Clustering
  On every frame the renderer iterates through every light on the CPU, processing its radius and position in view space to determine which parts of the camera frustum (clusters) it can influence. With this information, it updates WebGL texture, filling each column with a cluster's number of relevant lights and the index of each light.
```
              Column 0               Column 1
        _________________________________________________      
Row 0  | Cluster 0 numLights  | Cluster 1 numLights |
       | first light index    | first light index   |
       | second light index   | second light index  |     ...
       | third light index    | third light index   |
       |----------------------|---------------------|----
Row 0  | fourth light index   | fourth light index  |
       | fifth light index    | fifth light index   |
       |        ...           |        ...          |
```
  These indices refer to another texture packed with the lights' data, and are stored this way so as to be read by the fragment shader later on. The cluster volumes are, most simply, linear divisions of the screen and camera depth. Below is a render the clusters used for most of this project, with 15 divisions in each dimension. Each pixel's R,G, and B channels are mapped to their X, Y, and Z cluster index respectively:

![Cluster Image](img/ClusterRender.png)

### Clustered Forward+ Rendering
  While not strictly identical to the the [original idea](https://takahiroharada.files.wordpress.com/2015/04/forward_plus.pdf), my version of Forward+ makes use of the above clusters to prevent fragments from computing contributions from irrelevant lights. In all, the process looks a something like this:
```
for each fragment {

  cluster = determineCluster(fragment.position);
  relevantLights = getLights(cluster);
  
  for each light in relevantLights {
    shade(light, fragment);
  }
}
```
  While the relationship between geometry and lighting is still nested, we've decreased the marginal cost of a light. If we consider a 15x15x15 cluster setup and a light radius straddling **27** clusters, there could be as low as a **27 / (15\*15\*15) = 0.8%** chance that an added light will increase the cost of rendering any given fragment. To further illustrate, the rendering below displays the number of lights influencing each cluster in the green channel, and the z cluster index in red:

![Number of Lights gif](img/numlights.gif)

### Clustered Deferred Rendering

  Deferred rendering makes use of two passes to decouple the nested relationship between geometry and lights. In the first pass, every fragment is checked and, if it passes a depth test, sends all necessary shading information to a geometry buffer (g-buffer) texture. In a scene with 3,000 lights, a forward renderer would perform many, many lighting calculations even for fragments that don't reach the frame buffer; a deferred renderer will eliminate these fragments before any lighting is done.
  
  We can now be guaranteed that every fragment that reaches the second pass will become a pixel. To get the necessary data for a shading, the second pass can read the g-buffer, determine the cluster, then compute lighting as usual.
  
```
for each fragment {
  gbuffer.write(position, normal, albedo);
}

for each pixel {
  gbuffer.read(position,normal, albedo);
  
  cluster = determineCluster(fragment.viewPosition);
  relevantLights = getLights(cluster);
  
  for each light in relevantLights {
    shade(light, fragment);
  }
}
```

This efficient dismissal of non-important fragments comes at a cost: deferred rendering has difficulty rendering transparent materials. For scenes with few such materials, it's sometimes useful to render everything deffered, *then* render transparent materials forward. For this project's test scene, there were no such materials. You can see a breakdown of my g-uffer composition below:

![gbuffer gif](img/gbuffer.gif)

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
