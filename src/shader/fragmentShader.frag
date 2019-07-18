//#define GLSLIFY 1

uniform float time;

varying vec4 vMvPosition;
varying vec3 vColor;

void main() {
    vec2 uv = gl_PointCoord.xy * 2.0 - 1.0;

    float orb = 0.1 / length(uv * 1.0);
    orb = smoothstep(0.0, 1.0, orb);

    vec3 color = vec3(orb) * vColor;

    gl_FragColor = vec4(color, 1.0);
}
