WebGL Clustered Deferred and Forward+ Shading
================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Xincheng Zhang
* Tested on:
  *Windows 10, i7-4702HQ @ 2.20GHz 8GB, GTX 870M 3072MB (Personal Laptop)


### Description&Features
-------------
**In this project, I use WebGL to implement clustered forward plus and clustered deferred shading as well as optimization of g-buffer.**

Task Done:
* Clustered Forward+: 
Build a data structure to keep track of how many lights are in each cluster and what their indices are
Render the scene using only the lights that overlap a given cluster
* Clustered Deferred:
Reuse clustering logic from Clustered Forward+
Store vertex attributes in g-buffer
Read g-buffer in a shader to produce final output
* Effects
Implement the **Blinn-Phong** shading for point lights
* Optimizations
Optimized g-buffer format - reduce the number and size of g-buffers


.
### Result in Progress
-------------
**Result GIF**

* Clustered forward plus

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/clusted%20forward%20plus.gif)

* Clustered deferred (lambert)

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/clustered%20deferred%20lambert.gif)

* Clustered deferred (Blinn-Phong)

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/clustered%20deferred%20blinn-phong.gif)

* 80 lights for each scene above
* Rendered in Google Chrome Version 62.0.3202.75
* Explore resolution is set to be 875 * 604

.
**Implementation**
* clustered forward plus:
Basically I build a data structure to divide the space into clusters and check the indice of lights that have influence on these clusters. Then render the scene using only the lights that overlap a given cluster.

* clustered deferred:
Share the same data structure as clustered forward plus: clusters. But use gBuffer to store information of fragments and read gBuffer in glsl to get correct output.

* Effects:
Implement Blinn-Phong shading of point lights by modifying general blinn-phong shading. I find that the vertex position stored in gBuffer is not the position in world space. So I use the third element of inverse view matrix of camera to get the camera position and set it to be negative to get the vertex position in world space:
```
      //Blinn-Phong
      // float shininess = 4.0;
      // vec3 specColor = vec3(1.0,1.0,1.0);
      // vec3 viewDir = normalize(-vec3(u_invViewMatrix[3]));
      // vec3 halfDir = normalize(L + viewDir);
      // float specAngle = max(dot(halfDir,norm),0.0);
      // float specular = pow(specAngle,shininess);
```
.
**Optimization**

* Only first two elements instead of four are read and used in glsl to get enought information of vertex position, color and normal. The x and y component of normal is saved in these two elements so that the z component can be calculated since z = sqrt(1 - xsquare - ysquare).
```
    gl_FragData[0] = vec4(col, nv.x);
    gl_FragData[1] = vec4(v_position, nv.y);
```
```
vec4 alb = texture2D(u_gbuffers[0], v_uv);
vec4 pos = texture2D(u_gbuffers[1], v_uv);
vec3 fragColor = vec3(0.0);
vec3 albedo = alb.xyz;
vec3 position = pos.xyz;
vec4 abnormal = vec4(pos.x, pos.x, sqrt(1.0-alb.x * alb.x - pos.x * pos.x), 0.0);
vec3 norm = normalize(abnormal.xyz);
}
```

.

### Performance Analysis
-------------
* The Clustered Forward Plus shading is only a little bit faster than forward. Clustered Deferred shading is much faster than the other two. Here is the chart:

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/FPS.png)

* By the optimization introduced above (use only 2 elements of gBuffer), the frame rate of clustered deferred shading slightly increases. Here is the result:

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/FPS2.png)

* Screenshot of origin and optimized with 80 lights

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/basic%20deferred%20fps.png)

![](https://github.com/XinCastle/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/optimized%20deferred%20fps.png)