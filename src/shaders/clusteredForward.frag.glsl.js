export default function(params) {
	return `
	// TODO: This is pretty much just a clone of forward.frag.glsl.js

	#version 100
	precision highp float;

	uniform sampler2D u_colmap;
	uniform sampler2D u_normap;
	uniform sampler2D u_lightbuffer;

	// TODO: Read this buffer to determine the lights influencing a cluster
	uniform sampler2D u_clusterbuffer;

	varying vec3 v_position;
	varying vec3 v_normal;
	varying vec2 v_uv;

	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform mat4 u_viewMatrix;
	
	vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
		normap = normap * 2.0 - 1.0;
		vec3 up = normalize(vec3(0.001, 1, 0.001));
		vec3 surftan = normalize(cross(geomnor, up));
		vec3 surfbinor = cross(geomnor, surftan);
		return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
	}

	struct Light {
		vec3 position;
		float radius;
		vec3 color;
	};

	float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
		float u = float(index + 1) / float(textureWidth + 1);
		int pixel = component / 4;
		float v = float(pixel + 1) / float(textureHeight + 1);
		vec4 texel = texture2D(texture, vec2(u, v));
		int pixelComponent = component - pixel * 4;
		if (pixelComponent == 0) {
			return texel[0];
		} else if (pixelComponent == 1) {
			return texel[1];
		} else if (pixelComponent == 2) {
			return texel[2];
		} else if (pixelComponent == 3) {
			return texel[3];
		}
	}

	Light UnpackLight(int index) {
		Light light;
		float u = float(index + 1) / float(${params.numLights + 1});
		vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
		vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
		light.position = v1.xyz;

		// LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
		// Note that this is just an example implementation to extract one float.
		// There are more efficient ways if you need adjacent values
		light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

		light.color = v2.rgb;
		return light;
	}

	// Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
	float cubicGaussian(float h) {
		if (h < 1.0) {
			return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
		} else if (h < 2.0) {
			return 0.25 * pow(2.0 - h, 3.0);
		} else {
			return 0.0;
		}
	}

	void main() {
		vec3 albedo = texture2D(u_colmap, v_uv).rgb;
		vec3 normap = texture2D(u_normap, v_uv).xyz;
		vec3 normal = applyNormalMap(v_normal, normap);

		// Read constants.
		int numLights = ${params.numLights};
		int maxClusterLights = ${params.maxClusterLights};
		int numSliceX = ${params.numSliceX};
		int numSliceY = ${params.numSliceY};
		int numSliceZ = ${params.numSliceZ};
		int width = ${params.width};
		int height = ${params.width};
		
		// Determine the cluster for a fragment.
		int x = int((gl_FragCoord.x * float(numSliceX)) / float(width));
		int y = int((gl_FragCoord.y * float(numSliceY)) / float(height));

		// Find the z-dimension based on the camera position.
		vec4 cameraPosition = vec4(v_position, 1) * u_viewMatrix;
		float depth = u_cameraFar - u_cameraNear;
		float viewDepth = float(-cameraPosition.z - u_cameraNear);
		int z = int(viewDepth) * numSliceZ / int(depth);
		int index = x + y * numSliceX + z * numSliceX * numSliceY;

		// Read in the lights in that cluster from the populated data.
		// Must convert index into texture coordinates; use a large height to zero out v.
		int clusterCount = numSliceX * numSliceY * numSliceZ;
		int clusterLightCount = int(ExtractFloat(u_clusterbuffer, clusterCount, 100000, index, 0));
	
		// Do shading for just those lights.
		vec3 fragColor = vec3(0.0);
		for (int i = 1; i <= ${params.numLights}; i++) {
			
			// Find the index of a specific light if it is valid in this cluster.
			if (i < clusterLightCount) {
				float lightID = ExtractFloat(u_clusterbuffer, clusterCount, 
					maxClusterLights / 4, index, i);
				
				// Render the light effects just as in the forward fragment shader.
				Light light = UnpackLight(int(lightID));
				float lightDistance = distance(light.position, v_position);
				vec3 L = (light.position - v_position) / lightDistance;

				float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
				float lambertTerm = max(dot(L, normal), 0.0);

				fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
			}
		}

		const vec3 ambientLight = vec3(0.025);
		fragColor += albedo * ambientLight;

		gl_FragColor = vec4(fragColor, 1.0);
	}
	`;
}
