import * as THREE from 'three';
import { makeBeamMaterial, beamGeometry } from './fx.js';
import { makeShadowBlob } from './textures.js';
import { damp, clamp } from '../core/util.js';

// A procedural, Tumbler-inspired armoured car. Local +z is forward.

function extrudeProfile(points, width, bevel = 0.05) {
  const s = new THREE.Shape();
  points.forEach(([z, y], k) => (k === 0 ? s.moveTo(z, y) : s.lineTo(z, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function tireGeometry(r, w) {
  const g = new THREE.CylinderGeometry(r, r, w, 48, 1);
  const pos = g.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    const z = pos.getZ(k);
    const rr = Math.hypot(x, z);
    if (rr > r * 0.98) {
      const a = Math.atan2(z, x);
      const tread = Math.sin(a * 18) > 0 ? 1.0 : 0.955;
      const shoulder = Math.abs(y) > w * 0.42 ? 0.97 : 1;
      pos.setXYZ(k, x * tread * shoulder, y, z * tread * shoulder);
    }
  }
  g.computeVertexNormals();
  g.rotateZ(Math.PI / 2);
  return g;
}

export function createBatmobile() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: '#16181c',
    metalness: 0.65,
    roughness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    flatShading: true,
  });
  const armor = new THREE.MeshStandardMaterial({ color: '#0f1012', roughness: 0.72, metalness: 0.35, flatShading: true });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#06080b', metalness: 0.9, roughness: 0.04, clearcoat: 1, flatShading: true });
  const gun = new THREE.MeshStandardMaterial({ color: '#3b3e44', metalness: 0.9, roughness: 0.32 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92, flatShading: true });
  const headMat = new THREE.MeshBasicMaterial({ color: '#dbe9ff' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2030' });
  const nozzleMat = new THREE.MeshBasicMaterial({ color: '#ff5a14' });

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Hull
  const hull = [
    [3.05, 0.56], [3.0, 0.8], [2.0, 0.95], [1.0, 1.05], [0.1, 1.22], [-1.4, 1.27],
    [-2.35, 1.24], [-3.0, 1.14], [-3.06, 0.62], [-2.6, 0.36], [2.6, 0.36],
  ];
  add(extrudeProfile(hull, 1.9), paint);
  add(extrudeProfile([[1.05, 0.98], [0.0, 1.5], [-1.1, 1.56], [-1.58, 1.16]], 1.36, 0.04), glass);
  // canopy frame spine
  add(new THREE.BoxGeometry(0.12, 0.08, 2.0), gun, 0, 1.57, -0.45, 0.03);
  // nose wedge + splitter
  add(extrudeProfile([[3.18, 0.42], [3.05, 0.6], [2.4, 0.72], [2.4, 0.42]], 2.3, 0.03), armor);
  add(new THREE.BoxGeometry(2.5, 0.07, 0.5), gun, 0, 0.38, 3.0);
  // side pods + intakes
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.42, 2.6), armor, sx * 1.08, 0.72, 0.15, 0, 0, sx * -0.08);
    add(new THREE.BoxGeometry(0.06, 0.22, 1.1), gun, sx * 1.26, 0.8, 0.5);
    // front fender plates
    add(new THREE.BoxGeometry(0.62, 0.14, 1.55), armor, sx * 1.32, 1.08, 1.95, -0.1, 0, sx * -0.12);
    add(new THREE.BoxGeometry(0.5, 0.36, 0.12), armor, sx * 1.32, 0.98, 2.72, 0.5, 0, 0);
    // front strut arms
    add(new THREE.BoxGeometry(0.5, 0.12, 0.2), gun, sx * 1.1, 0.55, 1.95);
    add(new THREE.BoxGeometry(0.45, 0.1, 0.16), gun, sx * 1.08, 0.82, 1.85, 0, 0, sx * 0.5);
    // rear armour over the big wheels
    add(new THREE.BoxGeometry(0.98, 0.42, 2.3), armor, sx * 1.36, 1.42, -1.75, 0, 0, sx * -0.1);
    add(new THREE.BoxGeometry(0.9, 0.5, 0.2), armor, sx * 1.36, 1.2, -0.62, -0.5, 0, 0);
    add(new THREE.BoxGeometry(0.2, 0.55, 1.6), armor, sx * 1.86, 1.2, -1.75, 0, 0, sx * 0.25);
    // rear flaps
    add(new THREE.BoxGeometry(0.62, 0.05, 0.75), armor, sx * 0.62, 1.32, -2.72, 0.32, 0, 0);
    // lights
    add(new THREE.BoxGeometry(0.62, 0.07, 0.05), headMat, sx * 0.58, 0.72, 3.04);
    add(new THREE.BoxGeometry(0.18, 0.12, 0.05), headMat, sx * 1.02, 0.62, 2.96);
    add(new THREE.BoxGeometry(0.62, 0.07, 0.04), tailMat, sx * 0.72, 1.05, -3.07);
    add(new THREE.BoxGeometry(0.08, 0.32, 0.04), tailMat, sx * 1.02, 0.86, -3.05);
  }
  add(new THREE.BoxGeometry(1.5, 0.12, 4.2), armor, 0, 0.36, 0); // undertray
  // afterburner
  const nozzle = add(new THREE.CylinderGeometry(0.36, 0.44, 0.75, 18, 1, true), gun, 0, 0.82, -3.25, Math.PI / 2);
  nozzle.material.side = THREE.DoubleSide;
  add(new THREE.CircleGeometry(0.34, 18), nozzleMat, 0, 0.82, -3.0, 0, Math.PI);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCoreMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = new THREE.Group();
  flame.position.set(0, 0.82, -3.55);
  body.add(flame);
  // cones: wide at the nozzle, tapering backwards (-z)
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.36, 3, 18, 1, true).translate(0, 1.5, 0).rotateX(-Math.PI / 2), flameMat);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 18, 1, true).translate(0, 0.8, 0).rotateX(-Math.PI / 2), flameCoreMat);
  flame.add(f1, f2);
  // soft key light so the dark body reads at night
  // short range so it shapes the car without washing out nearby walls
  const key = new THREE.PointLight('#d6e2ff', 0, 6.5, 1.2);
  key.position.set(0, 3.6, 3.6); // ahead of the car, so its highlight isn't mirrored back at the chase camera
  root.add(key);
  const burner = new THREE.PointLight('#ff7a2a', 0, 22, 2);
  burner.position.set(0, 1.0, -4.2);
  body.add(burner);

  // Wheels
  const wheels = [];
  const makeWheel = (x, y, z, r, w, front) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    root.add(pivot);
    const spin = new THREE.Group();
    pivot.add(spin);
    add(tireGeometry(r, w), rubber, 0, 0, 0, 0, 0, 0, spin);
    add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.02, 6).rotateZ(Math.PI / 2), gun, 0, 0, 0, 0, 0, 0, spin);
    add(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 1.06, 10).rotateZ(Math.PI / 2), armor, 0, 0, 0, 0, 0, 0, spin);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(w * 1.04, r * 1.1, 0.08), armor, 0, 0, 0, (k * Math.PI) / 3, 0, 0, spin);
    wheels.push({ pivot, spin, r, front });
  };
  makeWheel(-1.4, 0.55, 1.95, 0.55, 0.44, true);
  makeWheel(1.4, 0.55, 1.95, 0.55, 0.44, true);
  makeWheel(-1.42, 0.8, -1.75, 0.8, 0.84, false);
  makeWheel(1.42, 0.8, -1.75, 0.8, 0.84, false);

  // Headlights: one real spotlight + two soft visible cones
  const spot = new THREE.SpotLight('#e8f0ff', 0, 110, 0.5, 0.65, 1.6);
  spot.position.set(0, 1.0, 2.8);
  spot.target.position.set(0, 0, 26);
  root.add(spot, spot.target);
  const coneMat = makeBeamMaterial({ color: '#dfe9ff', opacity: 0, falloff: 0.9, edge: 1.4 });
  for (const sx of [-1, 1]) {
    const cone = new THREE.Mesh(beamGeometry(0.14, 4.2, 24, 20), coneMat);
    cone.position.set(sx * 0.58, 0.74, 3.08);
    cone.rotation.x = Math.PI / 2 + 0.07;
    cone.renderOrder = 4;
    body.add(cone);
  }

  // Contact shadow
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 7.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: makeShadowBlob(), transparent: true, depthWrite: false, opacity: 0.8 }),
  );
  blob.position.y = 0.045;
  blob.renderOrder = 1;
  root.add(blob);

  let night = 1;
  let pitch = 0;
  let roll = 0;
  let pitchV = 0;
  let rollV = 0;
  let boostVis = 0;

  return {
    root,
    body,
    setNight(n) {
      night = n;
      spot.intensity = n * 420;
      key.intensity = n * 6;
      coneMat.uniforms.uOpacity.value = n * 0.14;
      headMat.color.set('#dbe9ff').multiplyScalar(0.8 + n * 4.5);
    },
    // state: { speed, steer, accel, lateral, boost, braking, dt }
    update(s) {
      const dt = s.dt;
      for (const w of wheels) {
        w.spin.rotation.x += (s.speed / w.r) * dt;
        if (w.front) w.pivot.rotation.y = -s.steer;
      }
      // spring-damper body motion from longitudinal + lateral acceleration
      const targetPitch = clamp(-s.accel * 0.006, -0.06, 0.06);
      const targetRoll = clamp(s.lateral * 0.006, -0.07, 0.07);
      pitchV += ((targetPitch - pitch) * 90 - pitchV * 12) * dt;
      rollV += ((targetRoll - roll) * 90 - rollV * 12) * dt;
      pitch += pitchV * dt;
      roll += rollV * dt;
      body.rotation.x = pitch;
      body.rotation.z = roll;
      body.position.y = Math.abs(s.speed) > 1 ? Math.sin(performance.now() * 0.03) * 0.006 * Math.min(1, Math.abs(s.speed) / 30) : 0;

      boostVis = damp(boostVis, s.boost ? 1 : 0, 10, dt);
      const flick = 0.85 + Math.random() * 0.3;
      flame.scale.set(1, 1, 0.25 + boostVis * 1.2 * flick);
      flameMat.opacity = boostVis * 0.9;
      flameCoreMat.opacity = boostVis * 0.9;
      flameMat.color.set('#ff8a3a').multiplyScalar(1 + boostVis * 2);
      burner.intensity = boostVis * 70 * flick;
      nozzleMat.color.set('#ff5a14').multiplyScalar(0.6 + boostVis * 4 + night * 0.6);
      tailMat.color.set('#ff2030').multiplyScalar((s.braking ? 4.5 : 0.9) + night * 1.2);
    },
  };
}
