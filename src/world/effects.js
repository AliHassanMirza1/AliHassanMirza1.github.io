import * as THREE from 'three';
import { mulberry32, smoothstep } from '../core/util.js';
import { LINES, STREET } from './layout.js';
import { makeSteam } from './textures.js';
import { makeBeamMaterial, beamGeometry } from './fx.js';

// Atmosphere: night drizzle, steam rising from manholes, and searchlights sweeping the clouds.

export function createEffects(scene, { tall, rainCount = 6000 }) {
  const rand = mulberry32(55);
  const updaters = [];
  const themers = [];

  // ------------------------------------------------------------------ rain
  if (rainCount > 0) {
    const N = rainCount;
    const seed = new Float32Array(N * 2 * 3);
    const end = new Float32Array(N * 2);
    for (let k = 0; k < N; k++) {
      const s = [rand(), rand(), rand()];
      seed.set(s, k * 6);
      seed.set(s, k * 6 + 3);
      end[k * 2] = 0;
      end[k * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(110, 60, 110) },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color('#aab8cc') },
      },
      vertexShader: /* glsl */ `
        attribute float aEnd;
        uniform float uTime; uniform vec3 uCam, uBox;
        varying float vEnd;
        void main() {
          vec3 p = position * uBox;
          p.y = mod(p.y - uTime * 32.0, uBox.y) + uCam.y - uBox.y * 0.45;
          p.xz = uCam.xz + mod(p.xz - uCam.xz + uTime * vec2(2.0, 1.0), uBox.xz) - uBox.xz * 0.5;
          p += vec3(0.06, 1.0, 0.03) * aEnd * 0.9;
          vEnd = aEnd;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; uniform vec3 uColor; varying float vEnd;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity * mix(0.0, 1.0, vEnd));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const rain = new THREE.LineSegments(g, mat);
    rain.frustumCulled = false;
    rain.renderOrder = 8;
    scene.add(rain);
    updaters.push((t, ctx) => {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uCam.value.copy(ctx.camera.position);
    });
    themers.push((p) => {
      mat.uniforms.uOpacity.value = smoothstep(0.5, 1, p.n) * 0.32;
      rain.visible = p.n > 0.5;
    });
  }

  // ------------------------------------------------------------------ steam vents
  {
    const vents = [];
    for (let k = 0; k < 18; k++) {
      const along = LINES[Math.floor(rand() * (LINES.length - 1))] + STREET / 2 + 10 + rand() * 36;
      const line = LINES[1 + Math.floor(rand() * (LINES.length - 2))];
      const across = (rand() < 0.5 ? -1 : 1) * (1.2 + rand() * 2);
      vents.push(rand() < 0.5 ? [along, line + across] : [line + across, along]);
    }
    const PER = 7;
    const tex = makeSteam();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff' });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, vents.length * PER);
    im.frustumCulled = false;
    im.renderOrder = 9;
    scene.add(im);
    // manhole covers
    const cover = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.75, 18).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 }),
      vents.length,
    );
    const m4 = new THREE.Matrix4();
    vents.forEach(([x, z], k) => cover.setMatrixAt(k, m4.makeTranslation(x, 0.03, z)));
    cover.receiveShadow = true;
    scene.add(cover);
    const life = Array.from({ length: vents.length * PER }, (_, k) => (k % PER) / PER + rand() * 0.1);
    const col = new THREE.Color();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let strength = 1;
    updaters.push((t, ctx) => {
      const q = ctx.camera.quaternion;
      for (let k = 0; k < life.length; k++) {
        life[k] += ctx.dt * 0.16;
        if (life[k] > 1) life[k] -= 1;
        const L = life[k];
        const [x, z] = vents[Math.floor(k / PER)];
        const s = 1.4 + L * 6.5;
        pos.set(x + Math.sin(L * 5 + k) * 0.6 + L * 1.5, 0.4 + L * 9, z + Math.cos(L * 4 + k) * 0.6);
        m4.compose(pos, q, scl.set(s, s, s));
        im.setMatrixAt(k, m4);
        const a = Math.sin(L * Math.PI) * strength;
        im.setColorAt(k, col.setScalar(a));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
    themers.push((p) => {
      strength = 0.06 + p.n * 0.06;
      mat.color.set('#ffffff').lerp(new THREE.Color('#ffd2a8'), p.n);
    });
  }

  // ------------------------------------------------------------------ searchlights
  {
    const spots = [...tall].sort((a, b) => b.h - a.h).slice(0, 12).filter((_, k) => k % 4 === 1).slice(0, 3);
    const beams = spots.map((s, k) => {
      const mat = makeBeamMaterial({ color: '#cfd8ff', opacity: 0, falloff: 1.2, edge: 1.5, far: 0.0 });
      const mesh = new THREE.Mesh(beamGeometry(0.8, 26, 520, 20), mat);
      mesh.position.set(s.x, s.h + 1, s.z);
      mesh.renderOrder = 6;
      scene.add(mesh);
      return { mesh, mat, phase: k * 2.1, speed: 0.12 + k * 0.05 };
    });
    let k0 = 0;
    updaters.push((t) => {
      for (const b of beams) {
        const a = t * b.speed + b.phase;
        b.mesh.rotation.set(Math.sin(a * 0.7) * 0.32, a, Math.cos(a) * 0.35, 'YXZ');
      }
    });
    themers.push((p) => {
      k0 = smoothstep(0.6, 1, p.n);
      for (const b of beams) {
        b.mat.uniforms.uOpacity.value = k0 * 0.07;
        b.mesh.visible = k0 > 0.01;
      }
    });
  }

  return {
    update(t, ctx) {
      for (const u of updaters) u(t, ctx);
    },
    onTheme(p) {
      for (const f of themers) f(p);
    },
  };
}
