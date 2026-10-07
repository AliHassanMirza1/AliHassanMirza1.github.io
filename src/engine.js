import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { isTouchDevice } from './core/util.js';

// Renderer, post-processing and adaptive quality.

export function detectQuality() {
  const touch = isTouchDevice();
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (touch && (small || mem <= 4)) return 'low';
  if (touch || cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

const TIERS = {
  high: { dpr: 1.6, shadows: 2048, bloom: true, fxaa: true, rain: 7000, traffic: 18 },
  medium: { dpr: 1.25, shadows: 1024, bloom: true, fxaa: true, rain: 4000, traffic: 14 },
  low: { dpr: 1.0, shadows: 0, bloom: false, fxaa: false, rain: 1800, traffic: 10 },
};

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.35 }, uGrain: { value: 0.03 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAmount, uGrain, uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
      c.rgb *= mix(1.0 - uAmount, 1.0, v);
      c.rgb += (h(vUv * 1000.0 + uTime) - 0.5) * uGrain * (0.35 + 0.65 * (1.0 - v));
      gl_FragColor = c;
    }`,
};

export function createEngine(container, labelsContainer, quality) {
  const tier = { ...TIERS[quality] };
  const renderer = new THREE.WebGLRenderer({
    antialias: !tier.bloom,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = tier.shadows > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const labels = new CSS2DRenderer({ element: labelsContainer });
  labels.setSize(container.clientWidth, container.clientHeight);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.5, 4000);
  const scene = new THREE.Scene();

  let composer = null;
  let bloom = null;
  let vignette = null;
  if (tier.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.7);
    composer.addPass(bloom);
    vignette = new ShaderPass(VignetteShader);
    composer.addPass(vignette);
    composer.addPass(new OutputPass());
    if (tier.fxaa) composer.addPass(new FXAAPass());
  }

  const viewport = { w: 1, h: 1 };
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    viewport.w = w;
    viewport.h = h;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // Adaptive resolution: drop the pixel ratio if frames are consistently slow.
  const perf = { acc: 0, frames: 0, slow: 0, fast: 0 };
  function adapt(dt) {
    perf.acc += dt;
    perf.frames++;
    if (perf.acc < 2) return;
    const fps = perf.frames / perf.acc;
    perf.acc = 0;
    perf.frames = 0;
    const pr = renderer.getPixelRatio();
    if (fps < 42) perf.slow++;
    else perf.slow = 0;
    if (fps > 58) perf.fast++;
    else perf.fast = 0;
    if (perf.slow >= 2 && pr > 0.7) {
      renderer.setPixelRatio(Math.max(0.7, pr - 0.2));
      resize();
      perf.slow = 0;
    } else if (perf.fast >= 4 && pr < Math.min(window.devicePixelRatio || 1, tier.dpr)) {
      renderer.setPixelRatio(Math.min(tier.dpr, pr + 0.1));
      resize();
      perf.fast = 0;
    }
  }

  return {
    renderer,
    scene,
    camera,
    labels,
    bloom,
    composer,
    tier,
    quality,
    viewport,
    resize,
    adapt,
    setLook(p) {
      renderer.toneMappingExposure = p.exposure;
      if (bloom) {
        bloom.strength = p.bloomStrength;
        bloom.threshold = p.bloomThreshold;
        bloom.radius = p.bloomRadius;
      }
      if (vignette) {
        vignette.uniforms.uAmount.value = 0.18 + p.n * 0.27;
        vignette.uniforms.uGrain.value = 0.012 + p.n * 0.03;
      }
    },
    render(t) {
      if (composer) {
        vignette.uniforms.uTime.value = t % 100;
        composer.render();
      } else renderer.render(scene, camera);
      labels.render(scene, camera);
    },
  };
}
