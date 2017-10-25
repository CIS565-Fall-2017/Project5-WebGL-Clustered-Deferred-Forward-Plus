WebGL Clustered Deferred and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Ricky Rajani
* Tested on: **Google Chrome 62.0.3202** on
  Windows 10, i5-6200U @ 2.30GHz, Intel(R) HD Graphics 520 4173MB (Personal Computer)

This project implements Clustered Deferred and Forward+ Shading using WebGL.

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5B-WebGL-Deferred-Shading)

### Demo Video/GIF

[![](img/video.png)](TODO)

### Features
- Clustered Forward+
- Clustered Deferred
- Blinn-Phong shading
- Optimizations of g-buffers

### Performance Analysis

- Clustered Shading
  - TODO: Overview
  - Per-cluster light backface culling
  - Better worse case performance with large depth discontinuities

- Clustered Forward+
  - TODO: Overview
  - Forward shading with light culling for screen-space tiles
  - Designed for today’s GPUs
  - High compute-to-memory ratio

- Clustered Deferred
  - TODO: Overview
  - Performance depends more on screen resolution than scene complexity.

Testing number of lights
  - Number of Lights : 500, 1000, 1500
  - Light's radius	: 3.0
  - Resolution	: 1920 x 1080
  - Cluster Dimension : 16 x 16 x 16
  
Testing light radius
  - Number of Lights : 500, 1000, 1500
  - Light's radius	: 1.0, 3.0, 5.0
  - Resolution	: 1920 x 1080
  - Cluster Dimension : 16 x 16 x 16

Testing resolution
  - Number of Lights : 500, 1000, 1500
  - Light's radius	: 3.0
  - Resolution	: 800 X 600, 1280 x 1084, 1920 x 1080
  - Cluster Dimension : 16 x 16 x 16
  
Testing cluster sizes
  - Number of Lights : 1000
  - Light's radius	: 3.0
  - Resolution	: 1920 x 1080
  - Cluster Dimension : 1 X 1 X 1, 4 x 4 x 4, 16 x 16 x 16,
  
- TODO: Add analysis
  
Blinn Phone Shading Model:
  - TODO: Add graph comparing times of labert and blinn phong on Forward+ and Deferred with 500, 1000, 1500 lights
  - TODO: Add analysis
  
Optimized g-buffer format:
  - TODO: Overview
  - Used two rather than four g-buffers
    - Use 2-component normals
    - Reduce number of properties passed via g-buffer by reconstructing world space position using camera matrices and X/Y/depth
      - G-buffer01: {color.r, color.g, color.b, depth}
      - G-buffer02: {normal.x, normal.y, - , - }
  - TODO: Add graph comparing times of 2 versus 4 g-buffers on Forward+ and Deferred with 500, 1000, 1500 lights

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
