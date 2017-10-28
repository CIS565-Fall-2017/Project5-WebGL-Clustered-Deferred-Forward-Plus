import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

// A simple helper for taking the dot product of a vector and a matrix.
// I couldn't seem to find a built-in for this anywhere in gl-matrix.
// Will automatically extend Vector3's into homogenous coordinates.
function dot(vector, matrix4) {
	var w = 1;
	if (vector[3] !== undefined) {
		w = vector[3];
	}
	var x = vector[0] * matrix4[0] + vector[1] * matrix4[4] 
		+ vector[2] * matrix4[8] + w * matrix4[12];
	var y = vector[0] * matrix4[1] + vector[1] * matrix4[5] 
		+ vector[2] * matrix4[9] + w * matrix4[13];
	var z = vector[0] * matrix4[2] + vector[1] * matrix4[6] 
		+ vector[2] * matrix4[10] + w * matrix4[14];
	var w = vector[0] * matrix4[3] + vector[1] * matrix4[7] 
		+ vector[2] * matrix4[11] + w * matrix4[15];
	return vec4.fromValues(x, y, z, w);
}

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster.
    // This will take some time. The math is nontrivial...
    for (var z = 0; z < this._zSlices; z++) {
      for (var y = 0; y < this._ySlices; y++) {
        for (var x = 0; x < this._xSlices; x++) {
          var index = x + y * this._xSlices + z * this._xSlices * this._ySlices;
		  
          // Reset the light count to 0 for every cluster.
		  // We store it in the first component slot of every pixel.
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] = 0;
        }
      }
    }

	// This should update the cluster TextureBuffer with a mapping from cluster index
	// to light count and light list (indices).
	// Scan through all lights to begin updating cluster texture with count and indices.
    var lights = scene.lights;
	for (var lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++) {
		var light = lights[lightIndex];

		// Fetch the light's radius and position to look for cluster overlap.
		var radius = light.radius;
		var position = light.position;

		// Use view matrix to convert to view position, must flip z.
		var viewPosition = dot(position, viewMatrix);
		viewPosition[2] = viewPosition[2] * -1;

		// https://threejs.org/docs/#api/cameras/PerspectiveCamera
		// Use vertical FOV and aspect ratio (width / height) to find proper spacings.
		// Begin splitting the frustum into slices. Grid ratio lets us find x and y
		// distances along the frustum.
		var vFOV = camera.fov;
		var aspect = camera.aspect;
		var gridRatio = Math.tan(vFOV * 0.5 * (3.141593 / 180)); 		        

		// Find the beginning and ending indices along the x-dimension.
		var beginningX = -1;
		var endingX = this._xSlices;
		for (var x = 0; x < (this._xSlices + 1); x++) {
			var step = (gridRatio * 2.0 / this._xSlices) * aspect;
			var index = (gridRatio * aspect) + step * x;
			
			// Mark as beginning if first within the light's radius.
			var viewDistance = vec3.dot(viewPosition, 
										vec3.fromValues(
											1 / Math.sqrt(1 + index * index), 
											0, 
											index / -Math.sqrt(1 + index * index)
										));
			if (viewDistance < radius
				&& beginningX === -1) {
					beginningX = x;
			} 
		}

		// Find the beginning and ending indices along the y-dimension.
		var beginningY = -1;
		var endingY = this._ySlices;
		for (var y = 0; y < (this._ySlices + 1); y++) {
			var step = (gridRatio * 2.0 / this._ySlices);
			var index = gridRatio + step * x;

			// Mark as beginning if first within the light's radius.
			var viewDistance = vec3.dot(viewPosition, 
										vec3.fromValues(
											0, 
											1 / Math.sqrt(1 + index * index), 
											index / -Math.sqrt(1 + index * index)
										));
			if (viewDistance < radius
				&& beginningY === -1) {
					beginningY = y;
			} 
		}

		// Find the beginning and ending indices along the z-dimension.
		var step = (camera.far - camera.near) / this._zSlices;
		var depth = (viewPosition[2] - camera.near);
		var beginningZ = parseInt((depth - radius) / step);
		var endingZ = this._zSlices;

		// Iterate through the clusters with lights.
		for (var z = beginningZ; z < (endingZ + 1); z++) {
			for (var y = beginningY; y < (endingY + 1); y++) {
				for (var x = beginningX; x < (endingX + 1); x++) {

					// Find the index: use the same scheme as before.
					var index = x + y * this._xSlices + z * this._xSlices * this._ySlices;

					// Use the bufferIndex function to retrieve the count we stored.
					var countIndex = this._clusterTexture.bufferIndex(index, 0);
					var count = this._clusterTexture.buffer[countIndex];

					// Update the light count of this cluster if it can fit more lights.
					if (count < MAX_LIGHTS_PER_CLUSTER) {
						this._clusterTexture.buffer[countIndex] = (count + 1);
						
						// Add this current light index to mapping from the cluster index to 
						// the light list.
						var pixelOffset = this._clusterTexture.bufferIndex(index, parseInt(count / 4));
						var lightOffset = count % 4;
						this._clusterTexture.buffer[pixelOffset + lightOffset] = lightIndex;
					}
				}
			}
		}
	}

	// Update the cluster state.
    this._clusterTexture.update();
  }
}