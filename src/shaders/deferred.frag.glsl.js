export default function(params) {
	return `
	#version 100
	precision highp float;

	uniform sampler2D u_gbuffers[${params.numGBuffers}];

	varying vec2 v_uv;
  
	// You should be able to reuse lots of stuff from Clustered Forward+ for this.
	uniform sampler2D u_colmap;
	uniform sampler2D u_normap;
	uniform sampler2D u_lightbuffer;
	
	// varying vec3 v_position;
	varying vec3 v_normal;
	// varying vec2 v_uv;

	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform mat4 u_viewMatrix;
	uniform sampler2D u_clusterbuffer;
	uniform vec3 u_viewOrigin;
	
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

					
	// A flag for determining which render mode to use.
	// 0 - Blinn-Phong shading, 1 - no Blinn-Phong shading.
	// 2 - albedo-only debug mode, 3 - normal-only debug mode.
	// 4 - x-cluster debug mode, 5 - y-cluster debug mode,
	// 6 - z-cluster debug mode.
	int MODE = 0;
	void main() {
		// TODO: extract data from g buffers and do lighting
		// vec3 albedo = texture2D(u_colmap, v_uv).rgb;
		vec3 albedo = texture2D(u_gbuffers[2], v_uv).rgb;
		// vec3 normap = texture2D(u_normap, v_uv).xyz;
		// vec3 normal = applyNormalMap(v_normal, normap);
		vec3 normal = texture2D(u_gbuffers[0], v_uv).rgb;
		vec3 v_position = texture2D(u_gbuffers[1], v_uv).rgb;
		
		if (MODE == 2) {
			gl_FragColor = vec4(albedo, 1.0);
			return;
		} else if (MODE == 3) {
			gl_FragColor = vec4(normal, 1.0);
			return;
		}
		
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
		vec4 viewPosition = u_viewMatrix * vec4(v_position, 1);
		float depth = (u_cameraFar - u_cameraNear) / 35.0;
		float viewDepth = float(-viewPosition.z - u_cameraNear);
		int z = int(viewDepth) * numSliceZ / int(depth);
		int index = x + y * numSliceX + z * numSliceX * numSliceY;
		
		if (MODE == 4) {
			float elem = float(x) / float(numSliceX);
			gl_FragColor = vec4(elem, elem, elem, 1.0);
			return;
		} else if (MODE == 5) {
			float elem = float(y) / float(numSliceY);
			gl_FragColor = vec4(elem, elem, elem, 1.0);
			return;
		} else if (MODE == 6) {
			// float elem = viewDepth / 100.0;
			float elem = float(z) / float(numSliceZ);
			gl_FragColor = vec4(elem, elem, elem, 1.0);
			return;
		}
		
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
				
				// This specfies specular hardness of Blinn-Phong shading in the deferred shader.
				// https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model
				// Specular hardness of material in scene:
				float specularHardness = 1000.0;
				if (MODE == 0) {
					vec3 viewDir = normalize(u_viewOrigin - v_position);
					vec3 H = normalize(L + viewDir);
					float NdotH = dot(normal, H);
					float intensity = pow(max(NdotH, 0.0), specularHardness);
					albedo.x += intensity;
					albedo.y += intensity;
					albedo.z += intensity;
					fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
				} else if (MODE == 1) {
					fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
				}
			}
		}

		const vec3 ambientLight = vec3(0.025);
		fragColor += albedo * ambientLight;

		gl_FragColor = vec4(fragColor, 1.0);
	}
	`;
}