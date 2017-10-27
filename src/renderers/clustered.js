import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

const DEG2RAD = Math.PI / 180;
const BEHIND_PLANE_EPSILON = -0.001;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._clusterTexWidth = xSlices * ySlices * zSlices;
    this._clusterTexHeight = Math.ceil((MAX_LIGHTS_PER_CLUSTER + 1) / 4);
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    // Can find normal of plane because we know 3 points
    // For left/right: (0,0,0), (0,1,0), ([-1,1],0,1)
    // For top/bottom: (0,0,0), (0,1,0), (0,[-1,1],1)
    // For near/far: Normal is (0,0,1); Z check is rather trivial
    let projectedLights = [];
    // move lights to camera space
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      let v = vec4.fromValues(scene.lights[lightIdx].position[0], scene.lights[lightIdx].position[1], scene.lights[lightIdx].position[2], 1);
      //console.log("light %d has Z: %f", lightIdx, v[2]);
      vec4.transformMat4(v, v, viewMatrix);
      // "flip" Z so camera is effectively looking down +Z
      vec4.set(v, v[0], v[1], -v[2], v[3]);
      // v should be projected now
      projectedLights.push(v);
      /*
      console.log("AFTER VIEW MATRIX")
      console.log("light %d has Z: %f", lightIdx, v[2]);
      //vec4.set(v, v[0], v[1], -v[2], v[3]);
      let m = mat4.create();
      mat4.copy(m, camera.projectionMatrix.elements);
      vec4.transformMat4(v, v, m);
      vec4.scale(v, v, 1 / v[3]); 
      console.log("AFTER PROJ MATRIX")
      console.log("light %d has Z: %f", lightIdx, v[2]);
      */
    }
    // dist between near and far planes
    let zGap = camera.far - camera.near;
    let zStart = camera.near;
    let zEnd = camera.far;
    // dist between max Y and min Y at far plane
    let yGap = 2 * Math.tan(DEG2RAD * camera.fov * 0.5) * camera.far / camera.zoom;
    let yStart = -0.5 * yGap;
    // dist between max X and min X at far plane
    let xGap = yGap * camera.aspect;
    let xStart = -0.5 * xGap;
    // Compute normal such that it faces "into" frustum; e.g. left plane's normal points right
    // see: http://www.ambrsoft.com/TrigoCalc/Sphere/SpherePlaneIntersection_.htm
    // D is 0 for left/right, top/bottom, since they cross origin
    // Compute d. If d <= R, sphere is partially inside frustum, because it intersects plane.
    // Ignore denominator when computing d because it is 1
    // If d > R, skip light if light is "behind" plane
    // Determine this by checking sign of t?
    let accCount = 0;
    let accComp = 0;
    let leftCt = 0;
    let rightCt = 0;
    let bottomCt = 0;
    let topCt = 0;
    let nearCt = 0;
    let farCt = 0;
    let minComp = 1000;
    let maxComp = -1;
    for (let z = 0; z < this._zSlices; ++z) {
      // planes defined by vec4s which contain (A, B, C, D) as per link above
      let nearPlane = vec4.fromValues(0, 0, 1, zStart + zGap * z / this._zSlices);
      let farPlane = vec4.fromValues(0, 0, -1,  zStart + zGap * (z + 1) / this._zSlices);
      for (let y = 0; y < this._ySlices; ++y) {
        let bottomPlaneNormal = vec3.create();
        // not sure why it's (-1, 0, 0) instead of (1, 0, 0), but...!!
        // I guess the library assumes a left-handed coordinate system
        vec3.cross(bottomPlaneNormal, vec3.fromValues(-1, 0, 0), vec3.fromValues(0, yStart + yGap * y / this._ySlices, zEnd));
        vec3.normalize(bottomPlaneNormal, bottomPlaneNormal);
        let bottomPlane = vec4.fromValues(bottomPlaneNormal[0], bottomPlaneNormal[1], bottomPlaneNormal[2], 0);

        let topPlaneNormal = vec3.create();
        // not sure why it's (-1, 0, 0) instead of (1, 0, 0), but...!!
        // I guess the library assumes a left-handed coordinate system
        vec3.cross(topPlaneNormal, vec3.fromValues(0, yStart + yGap * (y + 1) / this._ySlices, zEnd), vec3.fromValues(-1, 0, 0));
        vec3.normalize(topPlaneNormal, topPlaneNormal);
        let topPlane = vec4.fromValues(topPlaneNormal[0], topPlaneNormal[1], topPlaneNormal[2], 0);

        for (let x = 0; x < this._xSlices; ++x) {

          let leftPlaneNormal = vec3.create();
          vec3.cross(leftPlaneNormal, vec3.fromValues(xStart + xGap * x / this._xSlices, 0, zEnd), vec3.fromValues(0, -1, 0));
          vec3.normalize(leftPlaneNormal, leftPlaneNormal);
          let leftPlane = vec4.fromValues(leftPlaneNormal[0], leftPlaneNormal[1], leftPlaneNormal[2], 0);

          let rightPlaneNormal = vec3.create();
          vec3.cross(rightPlaneNormal, vec3.fromValues(0, -1, 0), vec3.fromValues(xStart + xGap * (x + 1) / this._xSlices, 0, zEnd));
          vec3.normalize(rightPlaneNormal, rightPlaneNormal);
          let rightPlane = vec4.fromValues(rightPlaneNormal[0], rightPlaneNormal[1], rightPlaneNormal[2], 0);

          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          let component = 0;
          for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {

            // Check if light is in cluster
            // Setting pos.w conveniently allows us to account for D in the plane vec4s when it exists
            let pos = vec4.fromValues(projectedLights[lightIdx][0], projectedLights[lightIdx][1], projectedLights[lightIdx][2], 1);
            // "AABB" culling
            let r = scene.lights[lightIdx].radius;
            let AcheckZ = pos[2] + r;
            let AnearZ = (zStart + zGap * z / this._zSlices);
            let AfarZ = zStart + zGap * (z + 1) / this._zSlices;
            if (
                (pos[2] + r < (zStart + zGap * z / this._zSlices)) ||
                (pos[2] - r > zStart + zGap * (z + 1) / this._zSlices)) {
              continue;
            }
            let t = vec4.dot(pos, leftPlane);
            // TODO: less hacky solution
            let radiusSqrd = scene.lights[lightIdx].radius * 1.0025;//Math.sqrt(scene.lights[lightIdx].radius);//scene.lights[lightIdx].radius;// * scene.lights[lightIdx].radius;
            // TODO: if d < rr, keep going
            // d = Math.abs(t)
            // TODO: else, skip light if t < 0
            // skip light if light does not intersect plane AND light is "behind" plane
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by left");
              leftCt++;
              continue;
            }

            t = vec4.dot(pos, rightPlane);
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by right");
              rightCt++;
              continue;
            }

            t = vec4.dot(pos, bottomPlane);
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by bottom");
              bottomCt++;
              continue;
            }

            t = vec4.dot(pos, topPlane);
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by top");
              topCt++;
              continue;
            }

            t = vec4.dot(pos, nearPlane);
            t = 0;
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by near");
              nearCt++;
              continue;
            }

            t = vec4.dot(pos, farPlane);
            t = 0;
            if (Math.abs(t) >= radiusSqrd && t < BEHIND_PLANE_EPSILON) {
              //console.log("culled by far");
              farCt++;
              continue;
            }

            // If we got this far, light is in cluster/mini-frustum
            // Update number of lights
            component++;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = component;
            // Add light index
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, Math.floor(component / 4)) + (component % 4)] = lightIdx;
            // bail if we hit max number of lights
            if (component == MAX_LIGHTS_PER_CLUSTER) {
              break;
            }
          }
          /*
          if (x == 7 && y == 7) {
            console.log("z: %d", z);
            console.log(component);
          }
          */
          accComp += component;
          minComp = Math.min(minComp, component);
          maxComp = Math.max(maxComp, component);
          accCount++;
          //console.log(component);
        }
      }
    }
    /*
    console.log("component: %f", accComp / accCount);
    console.log("min comp:  %d", minComp);
    console.log("max comp:  %d", maxComp);
    console.log("left culled: %d", leftCt);
    console.log("right culled: %d", rightCt);
    console.log("bottom culled: %d", bottomCt);
    console.log("top culled: %d", topCt);
    console.log("near culled: %d", nearCt);
    console.log("far culled: %d", farCt);
    */
    //while(1);

    this._clusterTexture.update();
  }
}