import * as THREE from 'three';

// Soft "volumetric" beam for cones and columns: brightest at the source (uv.y = 0),
// fading along its length and toward silhouette edges.
export function makeBeamMaterial({ color = '#ffffff', opacity = 0.3, falloff = 1.2, edge = 1.6, far = 0.0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uFalloff: { value: falloff },
      uEdge: { value: edge },
      uFar: { value: far },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vH = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity, uFalloff, uEdge, uFar, uTime;
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), uEdge);
        float along = mix(1.0, uFar, pow(vH, uFalloff));
        float a = uOpacity * f * along;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Open cylinder/cone whose uv.y runs 0 at the source → 1 at the far end, pointing +Y.
export function beamGeometry(rSource, rFar, length, radial = 24) {
  const g = new THREE.CylinderGeometry(rFar, rSource, length, radial, 1, true);
  g.translate(0, length / 2, 0);
  return g;
}

// Animated landing pad painted on the road.
export function makePadMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uActive: { value: 0 },
      uIntensity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime, uActive, uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float ring = smoothstep(0.035, 0.0, abs(r - 0.92)) * 1.4;
        float inner = smoothstep(0.02, 0.0, abs(r - 0.78)) * step(0.5, fract(ang * 6.0 / 6.2832 + uTime * 0.15));
        float wave = smoothstep(0.05, 0.0, abs(r - fract(uTime * 0.5) * 0.92)) * 0.6;
        float fill = (1.0 - r) * 0.08;
        float chevrons = 0.0;
        for (int k = 0; k < 4; k++) {
          float a = float(k) * 1.5708;
          vec2 d = vec2(cos(a), sin(a));
          float along = dot(p, d);
          float across = abs(dot(p, vec2(-d.y, d.x)));
          float c = fract(along * 2.4 - uTime * 0.9);
          chevrons += step(0.42, along) * step(along, 0.7) * smoothstep(0.08, 0.0, abs(c - 0.5 - across * 1.4) - 0.04);
        }
        float a = (ring + inner + wave + fill + chevrons * 0.6) * mix(0.32, 0.75, uActive) * uIntensity;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Emissive-ish standard material for emblems (blooms at night).
export function emblemMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: opts.base ?? '#1a1d22',
    emissive: new THREE.Color(color),
    emissiveIntensity: 1,
    metalness: opts.metalness ?? 0.6,
    roughness: opts.roughness ?? 0.35,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}
