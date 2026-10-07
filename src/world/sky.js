import * as THREE from 'three';

// Gradient sky dome with sun, moon, twinkling stars and procedural clouds.
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#fff4e0') },
    uCloud: { value: new THREE.Color() },
    uCloudShadow: { value: new THREE.Color() },
    uCover: { value: 0.4 },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        // the dome follows the camera and draws first without writing depth
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop, uHorizon, uBottom, uGlow, uSunColor, uCloud, uCloudShadow;
      uniform vec3 uSunDir, uMoonDir;
      uniform float uCover, uNight, uTime;

      float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float f = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { f += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
        return f;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.48));
        col = mix(col, uBottom, smoothstep(0.0, -0.2, h));
        col += uGlow * pow(1.0 - clamp(abs(h) * 2.6, 0.0, 1.0), 2.5);

        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (smoothstep(0.99955, 0.9997, sd) * 18.0 + pow(sd, 10.0) * 0.22 + pow(sd, 120.0) * 0.6) * (1.0 - uNight);

        float md = max(dot(d, uMoonDir), 0.0);
        float moon = smoothstep(0.99935, 0.9995, md);
        // crude terminator for a gibbous moon
        float shade = smoothstep(-0.2, 0.6, dot(normalize(d - uMoonDir * md), normalize(vec3(0.6, 0.3, 0.2))) + 0.4);
        col += vec3(1.0, 0.97, 0.9) * moon * mix(0.35, 2.6, shade) * uNight;
        col += vec3(0.55, 0.62, 0.8) * pow(md, 260.0) * 0.5 * uNight;

        if (h > 0.0) {
          vec3 sp = d * 420.0;
          vec3 cell = floor(sp);
          float s = hash3(cell);
          vec3 off = vec3(hash3(cell + 3.1), hash3(cell + 7.7), hash3(cell + 1.3)) - 0.5;
          float r = length(fract(sp) - 0.5 - off * 0.5);
          float star = step(0.9965, s) * smoothstep(0.32, 0.0, r);
          float tw = 0.55 + 0.45 * sin(uTime * (1.5 + s * 3.0) + s * 91.0);
          col += vec3(0.85, 0.9, 1.0) * star * tw * uNight * smoothstep(0.05, 0.35, h) * 2.2;

          vec2 uv = d.xz / (h + 0.12) * 0.75 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(uv * 1.3);
          float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.38, n);
          vec3 cc = mix(uCloudShadow, uCloud, smoothstep(0.35, 0.85, n));
          // clouds lit by the sun / city from below
          cc += uSunColor * pow(sd, 6.0) * 0.25 * (1.0 - uNight);
          col = mix(col, cc, c * smoothstep(0.0, 0.16, h) * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    uniforms,
    apply(p) {
      uniforms.uTop.value.copy(p.skyTop);
      uniforms.uHorizon.value.copy(p.skyHorizon);
      uniforms.uBottom.value.copy(p.skyBottom);
      uniforms.uGlow.value.copy(p.glow);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uMoonDir.value.copy(p.moonDir);
      uniforms.uCloud.value.copy(p.cloud);
      uniforms.uCloudShadow.value.copy(p.cloudShadow);
      uniforms.uCover.value = p.cloudCover;
      uniforms.uNight.value = p.n;
    },
    update(t, camera) {
      uniforms.uTime.value = t;
      mesh.position.copy(camera.position);
    },
  };
}
