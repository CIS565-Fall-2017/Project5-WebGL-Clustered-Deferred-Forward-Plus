#version 100
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;
uniform sampler2D u_lightbuffer;

uniform mat4 u_viewMatrix;

uniform int u_width;
uniform int u_height;
uniform float u_nearZ;
uniform float u_farZ;
uniform int u_xSlices;
uniform int u_ySlices;
uniform int u_zSlices;

// TODO: Read this buffer to determine the lights influencing a cluster
uniform sampler2D u_clusterbuffer;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) 
{
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

struct Light 
{
    vec3 position;
    float radius;
    vec3 color;
};

float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) 
{
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

Light UnpackLight(int index) 
{
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
float cubicGaussian(float h) 
{
    if (h < 1.0) {
        return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
        return 0.25 * pow(2.0 - h, 3.0);
    } else {
        return 0.0;
    }
}

void main() 
{
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // GLSL type inconsistencies
    // https://stackoverflow.com/questions/33579110/glsl-type-inconsistencies
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;


    // Get the position in camera space    
    vec4 v_posCamera = u_viewMatrix * vec4(v_position, 1.0);

    // Use gl_FragCoord to get xyz values
    // http://www.txutxi.com/?p=182
    // Essentially have to divide the gl_FragCoord by the stride
    int xCluster = int(x) / (u_width / u_xSlices);
    int yCluster = int(y) / (u_height / u_ySlices);
    int zCluster = int(-v_posCamera.z - u_nearZ) / (int(u_farZ - u_nearZ) / u_zSlices);
    
    // Find which cluster the current fragment lies in
    // Cluster index
    int index = xCluster + (yCluster * u_xSlices) + (zCluster * u_ySlices * u_zSlices);

    int totalClusters = u_xSlices * u_ySlices * u_zSlices;
    float u = float(index + 1) / float(totalClusters + 1);

    int numLightsInCluster = int(texture2D(u_clusterbuffer, vec2(u,0)).r);

    for (int i = 0; i < ${params.numLights}; ++i) {
        Light light = UnpackLight(i);
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        vec3 lightPos = light.position;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
}