WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Jiawei Wang
* Tested on: **Google Chrome 62.0.3202.75 (Official Build) (64-bit)** on
  Windows 10, i7-6700 @ 2.60GHz 16.0GB, GTX 970M 3072MB (Personal)
___
### Overview
* Realized a demo of ** Clustered Forward Plus Shading **and** Clustered Deferred Shading ** based on WebGL. Here are the more thorough explanations of the Deferred Shading and Clustered Shading.
  * **Deferred Shading**: https://docs.google.com/presentation/d/1W-Gp9mWvZ8DlppiNFJu_RngFVB34r9CXq4BhQEPbJYM/edit#slide=id.p3
  * **Cluster Shading**: https://docs.google.com/presentation/d/18yvym_tmSDnVC-mXRO9ykgP0RnBPoS5xgkzPt9EZNUk/edit#slide=id.p3
* The following are the results of **Clustered-Deferred Shading** with different shaders:
  
 | **Regular Shading (200 lights)** |
|---|
|<img src="./results/regular.gif" width="1200" height="500">|

| **Blinn-Phong Shading (200 lights)**|
|---|
|<img src="./results/blinn_phong.gif" width="1200" height="500">|

| **Toon Shading (200 lights)**|
|---|
|<img src="./results/toon.gif" width="1200" height="500">|

___
### Method Overview
* You can find detailed explanations of **Deferred Shading** and **Clustered Shading** in the former slides I mentioned, here are the concise pipeline of how the **Clustered Forward Plus** and **Clustered Deferred** work in this project:
* **Clustered Forward Plus**: 
  * For each frame: *Update the cluster Buffer* --> *Update Light Buffer* --> *Shading Pass*
  * During the Shading Pass: *Compute which cluster the current fragment is in* --> *Examine the Cluster Buffer* --> *Iterate the lights in that CLuster and do the shading*
* **Clustered Deferred**:
  * For each frame: *Render to Texture Pass(Writting to the G-Buffers)* --> *Update Cluster Buffer* --> *Update Light Buffer* --> *Shading Pass*
  * During the Shading Pass: *Read the G-Buffers of this fragment(color, normal, v_position)* --> *Compute which cluster the current fragment is in* --> *Examine the Cluster Buffer* --> *Iterate the lights in that CLuster and do the shading*
* The main **Difference** between these 2 methods are: in *Clustered Deferred*, we only need to compute the light shading once for each fragment, while in the other method we have to compute the shading multiple times for each fragment and then find the nearest shading result. 

___
### Method Highlight
* **Cluster Update**: Before shading, we have to update the cluster buffer, to determine which light and how many lights are overlapping with each cluster. We can realize this by checking the min and max in three dimensions and then iterate inside of the min and max in three dimensions to update the cluster buffer. I came up 2 methods as following, the first one is very explicit but slow, the other is better but a little bit tricky.
  * **Create Planes and Check distance**: in this method, first thing to do is to initialize the planes according to the camera state, each plane can be represented by a normal and an origin. And then for each light position, check the distance of each plane to find the max and min slice contain the light. The optimization of this method is that, all of the computations happen in view space, so  if the camera's projection matrix doen't change, the planes in view space doesn't change at all, we are able to just compute the planes info once during the constructor, and just check distance in each iteration. (But the truth is in real cases, the projection matrix can be changable and we have to recompute the planes info every time)
  * **Compute 2D normal and check dot product**: Because it is in view space, so the position of the camera is always (0,0,0), and for x and y slices, the normals only need 2-dimension value and the other one value equals to 0. And finally use the dot product of the normal and light pos, we can get the signed distance. Here is how we compute the 2D normal:
  ```js
  function get_2D_Normal(Side2) { //Side2 = IH
  // because the division happen on the clip whose z = 1
    let Hypot = Math.sqrt(1 + Side2*Side2); //IC
    let normSide1 = 1 / Hypot;
    let normSide2 = -Side2*normSide1;//lhs of plane, 2nd comp needs to be pos, rhs of plane 2nd comp needs to be neg
    return vec2.fromValues(normSide1, normSide2);
  }
  ```
  ![]("./results/ex01.JPG")</br>
  The orange line is the target normal we want to compute, we also know that `IH = i * Stride + Orig`, and triangle IJH and triangle CIH are similar, Also, extend the target till its length equals to 1. then we can get the target direction.

* **G-Buffer Optimization**: I used 2 methods to compress the G-buffer to reduce the memory usages, first one is to pack the data into `vec4`s, which is the unit size of texture data. The second one is to compress the 3D normal into 2-component normal.
  * **normal compression**: Here I used spherical coordinates to represent the normals in 3D world, because the length of the normal vector is always 1, which means the radius in spherical coordinates is always 1, so we only need to store the theta and fi angles to represent the normals. The good thing is that we only need 2 `vec4`s to construct our G-Buffer, but bad thing is that we increase the computation complexity due to the encoding and decoding of the spherical normals. (We also can transform the normals into view space, because the z coordinate of the normal in view space is always positive, but it also contain matrix computation during the encoding and decoding procedures)
  * **Final G-Buffer Structure**: 2 G-buffers
    * G-buffer[0] = color.r, color.g, color.b, normal_sph.theta
    * G-buffer[1] = v_position.x, v_position.y, v_position.z, normal_sph.fi
  * **Other Methods**: there are also some other methods on compression of g-buffers, for example, compress the normal from 32-bit to 8-bit storage. I didn't do more things on that.

| **Cluster Lights Distribution(200 lights)** | **Normal Display** |
|---|---|
|<img src="./results/regular.gif" width="600" height="250">|<img src="./results/regular.gif" width="600" height="250">

___
### Performance Analysis
* ***Num of Lights***: According to the results above, we can find that the rendering time per frame is increasing with the number of the lights growing. Also, with the number of lights increasing, the difference between these three methods becomes more obvious. The reason I've already mentioned on the former part and the slides I provided before.

* ***Num of Clusters***: According to the results above, we can find that at first, with the number of clusters growing, the rendering of both these 2 methods becomes faster, this is because the cluster becomes smaller than before, then for each fragment, we will examine less lights than before, this will save lots of time. But when the number of clusters reaches some levels, the speed reduce than before, this is because even though we decrease the time on lights shading, we also increase lots of time on cluster update.

* ***G-buffer Compression***: As I said before, using 3 buffers can save the time of encoding and decoding the normals, but will add an extra buffer on G-buffer.

___
### Debugging 

| **Cluster Lights Number Distribution(200 lights)** | **Lights Color Distribution(200 lights)** |
|---|---|
|<img src="./results/regular.gif" width="600" height="250">|<img src="./results/regular.gif" width="600" height="250">

| **Albedo Display** | **Normal Display** |
|---|---|
|<img src="./results/regular.gif" width="600" height="250">|<img src="./results/regular.gif" width="600" height="250">

| **XSlices Display** | **ZSlices Display** |
|---|---|
|<img src="./results/regular.gif" width="600" height="250">|<img src="./results/regular.gif" width="600" height="250">

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
