import * as THREE from 'three';
import { stops } from '../content.js';
import { landmarkGeometry, BLOCK, SIDEWALK } from './layout.js';
import { mulberry32, lerp, smoothstep } from '../core/util.js';
import { makeBeamMaterial, beamGeometry, makePadMaterial, emblemMaterial } from './fx.js';
import { makeRoofSign, makeNeonSign, makeBillboard, batShape, makeBatSignal } from './textures.js';

// One landmark per portfolio stop: a bespoke building, an animated emblem on its plaza,
// a landing pad painted on the street, and a light beacon visible across the city.

const C = (hex) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);

export async function buildLandmarks(scene, kit, { profile, addAviation }) {
  const rand = mulberry32(4242);
  const landmarks = [];
  const themed = { emblemMats: [], lineMats: [], glowSigns: [], dayNightSigns: [], boards: [], beams: [], bands: [] };
  const extras = { batSignal: null, ptz: null };

  for (const stop of stops) {
    const geo = landmarkGeometry(stop.id);
    const [cx, cz] = geo.center;
    const [fx, fz] = geo.facing;
    const rx = -fz;
    const rz = fx;
    const alongX = fx !== 0;
    const W = (a, b) => [cx + fx * a + rx * b, cz + fz * a + rz * b];
    const size = (wa, wb) => (alongX ? [wa, wb] : [wb, wa]);
    const facingY = Math.atan2(fx, fz);
    const color = C(stop.color);

    const ctx = {
      W,
      facingY,
      lbox(group, a, b, y, wa, wb, h, col) {
        const [x, z] = W(a, b);
        const [sx, sz] = size(wa, wb);
        kit.box(group, x, y, z, sx, h, sz, col);
      },
      lprism(style, a0, a1, b0, b1, y0, y1, col, opts = {}) {
        const [x, z] = W((a0 + a1) / 2, (b0 + b1) / 2);
        const [hw, hd] = size((a1 - a0) / 2, (b1 - b0) / 2);
        kit.prism(style, { x, z, y0, y1, hw, hd, color: col, ...opts });
      },
      lstore(a0, a1, b0, b1, col = C('#ffffff')) {
        const [x, z] = W((a0 + a1) / 2, (b0 + b1) / 2);
        const [hw, hd] = size((a1 - a0) / 2, (b1 - b0) / 2);
        kit.storefront({ x, z, hw, hd, color: col, uo: rand() });
      },
      ltilt(group, a, b, y, wa, wb, h, angle, col) {
        const [x, z] = W(a, b);
        const [sx, sz] = size(wa, wb);
        // tilt around the lateral axis so the slope faces the street
        const m = alongX ? kit.mat(x, y, z, 0, 0, angle * -fx, sx, h, sz) : kit.mat(x, y, z, angle * fz, 0, 0, sx, h, sz);
        kit.add(group, new THREE.BoxGeometry(1, 1, 1), m, col);
      },
      plane(mesh, a, b, y) {
        const [x, z] = W(a, b);
        mesh.position.set(x, y, z);
        mesh.rotation.y = facingY;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        scene.add(mesh);
        return mesh;
      },
      signMat(texture, kind = 'glow') {
        const m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: kind !== 'roof', side: THREE.DoubleSide });
        (kind === 'roof' ? themed.dayNightSigns : kind === 'board' ? themed.boards : themed.glowSigns).push(m);
        return m;
      },
    };

    // Block base + plaza
    const hb = BLOCK / 2;
    kit.slab({ x0: cx - hb, x1: cx + hb, z0: cz - hb, z1: cz + hb, y1: 0.25, color: C('#c9c5bd') });
    {
      const [x0, z0] = W(12, -hb + SIDEWALK);
      const [x1, z1] = W(hb - SIDEWALK, hb - SIDEWALK);
      kit.slab({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: 0.2, y1: 0.3, color: C('#e3ddd2') });
    }

    await BUILDINGS[stop.id](ctx, { kit, scene, color, profile, addAviation, themed, extras, rand });

    // Pedestal + emblem on the plaza
    const [px, pz] = geo.plaza;
    kit.add('plain', new THREE.CylinderGeometry(2.6, 3.1, 1.3, 28), kit.mat(px, 0.9, pz), '#bdb6aa');
    kit.add('glow', new THREE.TorusGeometry(2.75, 0.12, 6, 40).rotateX(Math.PI / 2), kit.mat(px, 1.56, pz), color);
    const emblem = EMBLEMS[stop.id](color, themed, rand);
    emblem.object.position.set(px, 0, pz);
    scene.add(emblem.object);

    // Landing pad on the street
    const [padX, padZ] = geo.pad;
    const padMat = makePadMaterial(stop.color);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), padMat);
    pad.position.set(padX, 0.035, padZ);
    pad.renderOrder = 3;
    scene.add(pad);

    // Beacon column
    const beaconMat = makeBeamMaterial({ color: stop.color, opacity: 0.3, falloff: 0.7, edge: 1.1, far: 0.0 });
    const beacon = new THREE.Mesh(beamGeometry(2.2, 2.6, 280, 20), beaconMat);
    beacon.position.set(padX, 0, padZ);
    beacon.renderOrder = 5;
    scene.add(beacon);

    const anchor = new THREE.Object3D();
    anchor.position.set(padX, 19, padZ);
    scene.add(anchor);

    // Camera framing for the showcase view: stand down the street, look at the plaza.
    const [sx, sz] = geo.streetDir;
    let framePos = new THREE.Vector3(padX + sx * 30 + fx * 4, 11, padZ + sz * 30 + fz * 4);
    let frameTarget = new THREE.Vector3(px - fx * 4, stop.id === 'hq' ? 16 : 11.5, pz - fz * 4);
    if (stop.id === 'signal') {
      // look up past the rooftop searchlight to the signal in the clouds
      framePos = new THREE.Vector3(padX + sx * 34, 5, padZ + sz * 34 + fz * 30);
      frameTarget = new THREE.Vector3(px, 52, pz - fz * 30);
    }
    // flat emblems face the showcase camera
    emblem.object.rotation.y = Math.atan2(framePos.x - px, framePos.z - pz);

    landmarks.push({
      id: stop.id,
      stop,
      color,
      geo,
      pad: new THREE.Vector3(padX, 0, padZ),
      plaza: new THREE.Vector3(px, 0, pz),
      facing: new THREE.Vector2(fx, fz),
      streetDir: new THREE.Vector2(sx, sz),
      anchor,
      framePos,
      frameTarget,
      padMat,
      beaconMat,
      emblem,
      visited: false,
      active: 0,
    });
  }

  return {
    list: landmarks,
    byId: Object.fromEntries(landmarks.map((l) => [l.id, l])),
    extras,
    onTheme(p) {
      const n = p.n;
      for (const m of themed.emblemMats) m.emissiveIntensity = lerp(0.55, 1.45, n);
      for (const m of themed.lineMats) m.color.copy(m.userData.base).multiplyScalar(lerp(1.1, 2.2, n));
      for (const m of themed.glowSigns) m.color.setScalar(lerp(0.9, 1.6, n));
      for (const m of themed.dayNightSigns) m.color.setScalar(lerp(0.8, 2.4, n));
      for (const m of themed.boards) m.color.setScalar(lerp(1.0, 0.95, n));
      for (const b of themed.bands) b.color.setScalar(lerp(0.9, 2.6, n));
      for (const l of landmarks) {
        l.beaconBase = lerp(0.2, 0.34, n);
        l.padMat.uniforms.uIntensity.value = lerp(0.85, 1.25, n);
      }
      if (extras.batSignal) extras.batSignal.setNight(n);
      if (extras.ptz) extras.ptz.setNight(n);
      this._n = n;
    },
    update(t, dt, camPos, carPos, focusId = null) {
      for (const l of landmarks) {
        l.emblem.update(t, dt);
        l.padMat.uniforms.uTime.value = t;
        const dCar = carPos ? Math.hypot(carPos.x - l.pad.x, carPos.z - l.pad.z) : 999;
        const target = dCar < 9 ? 1 : 0;
        l.active += (target - l.active) * Math.min(1, dt * 5);
        l.padMat.uniforms.uActive.value = l.active;
        const dCam = Math.hypot(camPos.x - l.pad.x, camPos.z - l.pad.z);
        const fade = l.id === focusId ? 0 : smoothstep(18, 70, dCam) * (l.visited ? 0.45 : 1);
        l.beaconMat.uniforms.uOpacity.value = (l.beaconBase ?? 0.3) * fade;
        l.beaconMat.uniforms.uTime.value = t;
      }
      for (const b of themed.bands) if (b.map) b.map.offset.x = (t * 0.05) % 1;
      extras.ptz?.update(t, dt);
    },
  };
}

// ---------------------------------------------------------------------------
// Buildings

const BUILDINGS = {
  async hq(c, { kit, color, profile, addAviation, themed }) {
    const lime = C('#d9cfbd');
    c.lstore(-24, 10, -22, 22);
    c.lprism('mason', -24, 10, -22, 22, 5, 30, lime, { uo: 1 });
    c.lbox('plain', -7, 30.4, 0, 34.8, 44.8, 0.8, lime.clone().multiplyScalar(0.85));
    c.lprism('glass', -20, 6, -14, 14, 30, 118, C('#9fb3c6'), { uo: 3 });
    c.lprism('glass', -17, 3, -10, 10, 118, 156, C('#b6c4cf'), { uo: 6 });
    c.lprism('mason', -14, 0, -6, 6, 156, 168, lime, { uo: 2 });
    for (const [y, wa, wb] of [[118.4, 26.6, 28.6], [156.4, 20.6, 20.6], [167.6, 14.6, 12.6]]) c.lbox('glow', -7, y, 0, wa, wb, 0.7, '#ffcf7a');
    const [x, z] = c.W(-7, 0);
    kit.add('metal', new THREE.CylinderGeometry(0.25, 3.4, 36, 4), kit.mat(x, 168 + 18, z, 0, Math.PI / 4), '#e8e8e8');
    addAviation(new THREE.Vector3(x, 204.5, z));
    const tex = await makeBillboard(profile);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(28, 12), c.signMat(tex, 'board'));
    board.material.transparent = false;
    c.plane(board, 10.12, 0, 17.4);
    c.lbox('plain', 10.05, 17.4, 0, 0.2, 29, 13, '#111317');
    c.lbox('glow', 10.2, 11.2, 0, 0.12, 28.4, 0.18, '#ffd23f');
  },

  async neuro(c, { kit, color }) {
    c.lstore(-24, 8, -22, 22);
    c.lprism('glass', -24, 8, -22, 22, 5, 34, C('#a5b9cc'), { uo: 2 });
    c.lprism('glass', -20, 12, -4, 22, 34, 54, C('#c3cbd3'), { uo: 5 });
    c.lbox('plain', 10, 33.85, 9, 4, 26, 0.3, '#2a2f36');
    c.lbox('glow', 12.1, 34.3, 9, 0.12, 26, 0.25, color);
    c.lbox('glow', 12.1, 53.6, 9, 0.12, 26, 0.25, color);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.9), c.signMat(makeRoofSign('TIBBLING LABS', '#b9a6ff'), 'roof'));
    c.plane(sign, 12.25, 9, 57);
    // rooftop dome
    const [x, z] = c.W(-12, -12);
    kit.add('metal', new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(x, 34, z), '#cfd6de');
  },

  async ccrl(c, { kit, color }) {
    c.lstore(-24, 8, -22, 22, C('#b9b4ad'));
    c.lprism('mason', -24, 8, -22, 22, 5, 44, C('#6d6a66'), { uo: 4 });
    for (let b = -20; b <= 20; b += 4) c.lbox('glow', 8.14, 25, b, 0.12, 0.32, 36, color);
    c.lbox('plain', -8, 44.4, 0, 32.6, 44.6, 0.8, '#5d5a57');
    for (let k = 0; k < 6; k++) {
      const [x, z] = c.W(-18 + (k % 3) * 10, -10 + Math.floor(k / 3) * 16);
      kit.add('metal', new THREE.CylinderGeometry(2.6, 2.6, 2.4, 16), kit.mat(x, 46, z), '#9aa1a8');
      kit.add('plain', new THREE.CylinderGeometry(2.2, 2.2, 0.2, 16), kit.mat(x, 47.25, z), '#1e2125');
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.1), c.signMat(makeRoofSign('CCRL · LUMS', '#7fefff'), 'roof'));
    c.plane(sign, 8.3, 0, 47.6);
  },

  async field(c, { kit, scene, color, addAviation, extras }) {
    c.lstore(-20, 4, -4, 22, C('#ffffff'));
    c.lprism('mason', -20, 4, -4, 22, 5, 12, C('#cbb593'), { uo: 6 });
    for (let k = 0; k < 6; k++) c.ltilt('metal', -16 + (k % 3) * 7, 2 + Math.floor(k / 3) * 9, 13.4, 5, 7, 0.25, 0.45, '#22324f');
    // lattice watchtower
    const [tx, tz] = c.W(-8, -14);
    const H = 36;
    const legs = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
    const top = (k) => [tx + legs[k][0] * 0.4, H, tz + legs[k][1] * 0.4];
    const bot = (k) => [tx + legs[k][0], 0.25, tz + legs[k][1]];
    const steel = '#c8c3b8';
    for (let k = 0; k < 4; k++) kit.beam('plain', bot(k), top(k), 0.35, steel);
    for (let s = 0; s < 5; s++) {
      const f0 = s / 5;
      const f1 = (s + 1) / 5;
      const at = (k, f) => bot(k).map((v, i) => v + (top(k)[i] - v) * f);
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        kit.beam('plain', at(k, f0), at(k2, f1), 0.18, steel);
        kit.beam('plain', at(k2, f0), at(k, f1), 0.18, steel);
        kit.beam('plain', at(k, f1), at(k2, f1), 0.22, steel);
      }
    }
    kit.box('plain', tx, H + 1.6, tz, 4.4, 3.2, 4.4, '#e1dccf');
    kit.box('plain', tx, H + 3.4, tz, 5.2, 0.4, 5.2, '#4a4642');
    kit.box('glow', tx, H + 1.8, tz, 4.5, 1.0, 4.5, '#ffe0a8');
    kit.add('metal', new THREE.CylinderGeometry(0.08, 0.12, 9, 6), kit.mat(tx + 1.8, H + 8, tz + 1.8), '#dddddd');
    addAviation(new THREE.Vector3(tx + 1.8, H + 12.7, tz + 1.8));
    // PTZ camera that sweeps the lake with a searchlight
    const head = new THREE.Group();
    head.position.set(tx, H + 4.2, tz);
    const camMat = new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.4, metalness: 0.4 });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.9), camMat);
    housing.position.y = 0.6;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a3d' }));
    lens.position.set(0, 0.6, 1.0);
    head.add(housing, lens);
    const sweepMat = makeBeamMaterial({ color: '#ffe2b0', opacity: 0.0, falloff: 0.8, edge: 1.4 });
    const sweep = new THREE.Mesh(beamGeometry(0.4, 16, 150, 24), sweepMat);
    sweep.rotation.x = Math.PI / 2 - 0.1;
    sweep.position.set(0, 0.6, 1.1);
    head.add(sweep);
    scene.add(head);
    const baseYaw = c.facingY;
    extras.ptz = {
      update(t) {
        head.rotation.y = baseYaw + Math.sin(t * 0.25) * 1.3;
        lens.material.color.setScalar(1).multiplyScalar(0.8 + Math.sin(t * 4) * 0.3);
      },
      setNight(n) {
        sweepMat.uniforms.uOpacity.value = 0.03 + n * 0.17;
      },
    };
  },

  async projects(c, { kit, color }) {
    const brick = C('#8f5c47');
    c.lprism('mason', -24, 8, -22, 22, 0, 15, brick, { uo: 3 });
    for (let k = 0; k < 5; k++) c.ltilt('plain', -21 + k * 6.4, 0, 17.2, 6.6, 43.6, 0.35, 0.5, '#4a4642');
    for (let k = 0; k < 5; k++) c.lbox('glow', -18.6 + k * 6.4, 17.9, 0, 0.2, 42, 1.4, '#cfe8ff');
    // garage door
    c.lbox('plain', 8.06, 4.2, 0, 0.2, 14, 8.4, '#0b0c0e');
    c.lbox('glow', 8.12, 8.2, 0, 0.12, 13.2, 0.25, color);
    c.lbox('plain', 8.3, 8.9, 0, 0.6, 15, 0.6, '#3a3631');
    for (const b of [-7.2, 7.2]) c.lbox('plain', 8.3, 4.4, b, 0.6, 0.6, 8.8, '#3a3631');
    c.lbox('plain', 7.6, 7.6, 0, 0.3, 13.6, 1.4, '#6b6f75');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.06), c.signMat(makeNeonSign('THE GARAGE', '#34d399')));
    c.plane(sign, 8.2, 0, 12);
    const [x, z] = c.W(-14, 14);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('plain', x + dx * 1.3, 16.6, z + dz * 1.3, 0.22, 3, 0.22, '#3d3a37');
    kit.add('plain', new THREE.CylinderGeometry(1.9, 1.9, 3.6, 14), kit.mat(x, 19.9, z), '#6d5340');
    kit.add('plain', new THREE.ConeGeometry(2.1, 1.6, 14), kit.mat(x, 22.5, z), '#4a3a2e');
  },

  async records(c, { kit, addAviation }) {
    const lime = C('#dcd3c2');
    c.lbox('plain', 7, 0.45, 0, 6, 34, 0.9, '#cfc6b4');
    c.lbox('plain', 6, 1.2, 0, 4, 32, 0.8, '#d6cdbb');
    c.lbox('plain', 5, 1.95, 0, 2, 30, 0.8, '#ddd4c2');
    c.lprism('mason', -22, 4, -20, 20, 0, 24, lime, { uo: 2 });
    for (let b = -14; b <= 14; b += 4) {
      const [x, z] = c.W(7.4, b);
      kit.add('plain', new THREE.CylinderGeometry(0.85, 0.95, 16, 14), kit.mat(x, 10.4, z), '#ece6da');
    }
    c.lbox('plain', 7, 19.2, 0, 4.6, 34, 1.6, lime);
    const tri = new THREE.Shape();
    tri.moveTo(-17, 0);
    tri.lineTo(17, 0);
    tri.lineTo(0, 5.5);
    tri.closePath();
    const ped = new THREE.ExtrudeGeometry(tri, { depth: 4.6, bevelEnabled: false }).translate(0, 0, -2.3);
    const [px, pz] = c.W(7, 0);
    kit.add('plain', ped, kit.mat(px, 20, pz, 0, c.facingY), lime);
    c.lbox('glow', 9.4, 2.6, 0, 0.12, 30, 0.2, '#ffd9a0');
    c.lprism('mason', -14, -2, -8, 8, 24, 72, lime, { uo: 5 });
    c.lbox('glow', -8, 71.6, 0, 12.5, 16.5, 0.6, '#ffd9a0');
    const [tx, tz] = c.W(-8, 0);
    kit.add('plain', new THREE.CylinderGeometry(0.4, 8 * 1.41, 16, 4), kit.mat(tx, 80, tz, 0, Math.PI / 4), '#5f6b62');
    kit.add('metal', new THREE.CylinderGeometry(0.45, 0.6, 3.4, 8), kit.mat(tx, 89.6, tz), '#c9a227');
    kit.add('metal', new THREE.SphereGeometry(0.55, 10, 8), kit.mat(tx, 91.7, tz), '#c9a227');
    addAviation(new THREE.Vector3(tx, 92.6, tz));
  },

  async academy(c, { kit }) {
    const brick = C('#a8664e');
    c.lprism('mason', -24, 6, -22, 22, 0, 22, brick, { uo: 1 });
    c.lbox('plain', -9, 22.4, 0, 30.8, 44.8, 0.8, '#d8cfc0');
    for (const b of [-6, -2, 2, 6]) {
      const [x, z] = c.W(9, b);
      kit.add('plain', new THREE.CylinderGeometry(0.7, 0.8, 12, 14), kit.mat(x, 6.25, z), '#efe9de');
    }
    c.lbox('plain', 8.5, 12.8, 0, 4, 15, 1.2, '#e6dfd2');
    const tri = new THREE.Shape();
    tri.moveTo(-7.5, 0);
    tri.lineTo(7.5, 0);
    tri.lineTo(0, 3.6);
    tri.closePath();
    const [px, pz] = c.W(8.5, 0);
    kit.add('plain', new THREE.ExtrudeGeometry(tri, { depth: 4, bevelEnabled: false }).translate(0, 0, -2), kit.mat(px, 13.4, pz, 0, c.facingY), '#e6dfd2');
    c.lprism('mason', -8, 2, -5, 5, 22, 50, brick, { uo: 3 });
    const [tx, tz] = c.W(-3, 0);
    kit.add('plain', new THREE.CylinderGeometry(0.3, 5 * 1.41, 12, 4), kit.mat(tx, 56, tz, 0, Math.PI / 4), '#4f7a6a');
    // clock face
    const [fx2, fz2] = c.W(2.08, 0);
    kit.add('glow', new THREE.CircleGeometry(2.6, 32), kit.mat(fx2, 44, fz2, 0, c.facingY), '#fff4dc');
    kit.add('plain', new THREE.BoxGeometry(0.22, 2.0, 0.1).translate(0, 0.9, 0), kit.mat(fx2, 44, fz2, 0, c.facingY, 0.6), '#1b1b1b');
    kit.add('plain', new THREE.BoxGeometry(0.22, 1.4, 0.1).translate(0, 0.6, 0), kit.mat(fx2, 44, fz2, 0, c.facingY, -1.9), '#1b1b1b');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), c.signMat(makeRoofSign('THE ACADEMY', '#1f3557'), 'roof'));
    c.plane(sign, 9.15, 0, 12.8);
  },

  async arena(c, { kit, scene, color, themed }) {
    const [x, z] = c.W(-5, 0);
    kit.cylinder('mason', { x, z, y0: 0, y1: 16, r: 20, segs: 44, color: C('#8a8f98'), uo: 2 });
    kit.add('metal', new THREE.SphereGeometry(20.6, 44, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1), kit.mat(x, 16, z), '#c9ced6');
    kit.add('plain', new THREE.CylinderGeometry(20.8, 20.8, 0.8, 44, 1, true), kit.mat(x, 16, z), '#5c616a');
    // LED ribbon
    const cnv = document.createElement('canvas');
    cnv.width = 1024;
    cnv.height = 32;
    const g = cnv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 1024, 0);
    ['#ff5fa2', '#8b6cff', '#22d3ee', '#ff5fa2', '#ffd23f', '#ff5fa2'].forEach((col, k, arr) => grd.addColorStop(k / (arr.length - 1), col));
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 32);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let k = 0; k < 64; k++) g.fillRect(k * 16 + 12, 0, 4, 32);
    const t = new THREE.CanvasTexture(cnv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    const bandMat = new THREE.MeshBasicMaterial({ map: t });
    themed.bands.push(bandMat);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(20.25, 20.25, 3.2, 64, 1, true), bandMat);
    band.position.set(x, 12.2, z);
    scene.add(band);
    // entrance canopy
    c.lbox('plain', 15.5, 6.5, 0, 4, 18, 0.6, '#3a3f47');
    for (const b of [-8, 8]) c.lbox('plain', 17, 3.2, b, 0.4, 0.4, 6.4, '#3a3f47');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.75), c.signMat(makeNeonSign('THE ARENA', '#ff5fa2')));
    c.plane(sign, 17.55, 0, 8.9);
  },

  async armory(c, { kit, color }) {
    const stone = C('#57534e');
    c.lprism('mason', -24, 6, -22, 22, 0, 18, stone, { uo: 7 });
    for (let s = -22; s <= 22; s += 3.2) {
      c.lbox('plain', 6, 18.9, s, 1.2, 1.6, 1.8, '#4a4743');
      c.lbox('plain', -24, 18.9, s, 1.2, 1.6, 1.8, '#4a4743');
    }
    for (let a = -24; a <= 6; a += 3.2) {
      c.lbox('plain', a, 18.9, -22, 1.6, 1.2, 1.8, '#4a4743');
      c.lbox('plain', a, 18.9, 22, 1.6, 1.2, 1.8, '#4a4743');
    }
    for (const a of [-21, 3])
      for (const b of [-19, 19]) {
        const [x, z] = c.W(a, b);
        kit.cylinder('mason', { x, z, y0: 0, y1: 26, r: 4, segs: 16, color: stone });
        kit.add('plain', new THREE.ConeGeometry(4.8, 7, 16), kit.mat(x, 29.5, z), '#2f3437');
        kit.add('glow', new THREE.CylinderGeometry(4.05, 4.05, 0.35, 16, 1, true), kit.mat(x, 22, z), color);
      }
    c.lbox('metal', 6.3, 4, 0, 0.6, 9, 8, '#2b2f33');
    for (let k = -3; k <= 3; k++) c.lbox('plain', 6.65, 4, k * 1.2, 0.12, 0.25, 7.6, '#1c1f22');
    c.lbox('glow', 6.7, 8.6, 0, 0.12, 9, 0.25, color);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.4), c.signMat(makeNeonSign('ARMORY', '#b7f34a')));
    c.plane(sign, 6.4, 0, 12.5);
  },

  async signal(c, { kit, scene, extras, addAviation }) {
    const stone = C('#6d6a66');
    c.lstore(-24, 8, -22, 22, C('#c8c2b8'));
    c.lprism('mason', -24, 8, -22, 22, 5, 46, stone, { uo: 2 });
    c.lprism('mason', -20, 2, -16, 16, 46, 64, stone, { uo: 6 });
    c.lbox('plain', -9, 64.4, 0, 22.6, 32.6, 0.8, '#5a5754');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.1), c.signMat(makeNeonSign('POLICE', '#5aa9ff')));
    c.plane(sign, 8.2, 0, 7.4);
    // the bat-signal searchlight on the roof
    const [lx, lz] = c.W(-4, 8);
    const lampPos = new THREE.Vector3(lx, 67.2, lz);
    // low over the northern skyline so it reads from street level and from the intro orbit
    const target = new THREE.Vector3(0, 150, -440);
    const dir = target.clone().sub(lampPos);
    const dist = dir.length();
    dir.normalize();
    kit.box('plain', lx, 65.4, lz, 3.2, 2, 3.2, '#3b3f44');
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 3.2, 20), new THREE.MeshStandardMaterial({ color: '#4c5157', metalness: 0.8, roughness: 0.35 }));
    housing.position.copy(lampPos);
    housing.quaternion.setFromUnitVectors(UP, dir);
    housing.castShadow = true;
    scene.add(housing);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), lensMat);
    lens.position.copy(lampPos).addScaledVector(dir, 1.65);
    lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    scene.add(lens);
    const beamMat = makeBeamMaterial({ color: '#ffe3a0', opacity: 0, falloff: 1.0, edge: 1.3, far: 0.25 });
    const beam = new THREE.Mesh(beamGeometry(1.6, 44, dist, 32), beamMat);
    beam.position.copy(lampPos);
    beam.quaternion.setFromUnitVectors(UP, dir);
    beam.renderOrder = 6;
    scene.add(beam);
    const symMat = new THREE.MeshBasicMaterial({ map: makeBatSignal(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const sym = new THREE.Mesh(new THREE.PlaneGeometry(160, 115), symMat);
    sym.position.copy(target);
    sym.lookAt(0, 30, 0);
    sym.renderOrder = 7;
    scene.add(sym);
    addAviation(new THREE.Vector3(lx + 6, 66, lz + 6));
    let flash = 0;
    let night = 0;
    extras.batSignal = {
      setNight(n) {
        night = n;
        this.refresh();
      },
      flash() {
        flash = 1;
      },
      refresh() {
        const k = smoothstep(0.55, 1, night);
        beamMat.uniforms.uOpacity.value = k * (0.16 + flash * 0.25);
        symMat.opacity = k * (0.85 + flash * 0.15);
        lensMat.color.set('#ffe9a8').multiplyScalar(0.6 + k * 5 + flash * 4);
      },
      update(dt) {
        if (flash > 0) {
          flash = Math.max(0, flash - dt * 0.6);
          this.refresh();
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Emblems (animated, on the plaza pedestal)

function trackMat(themed, m) {
  themed.emblemMats.push(m);
  return m;
}
function trackLine(themed, color, opts = {}) {
  const m = new THREE.LineBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  m.userData.base = new THREE.Color(color);
  themed.lineMats.push(m);
  return m;
}

const EMBLEMS = {
  hq(color, themed) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), trackMat(themed, emblemMaterial('#ffd23f', { base: '#c9ced6', metalness: 0.95, roughness: 0.15 })));
    const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4, 0)), trackLine(themed, '#ffd23f'));
    const inner = new THREE.Group();
    inner.add(core, shell);
    inner.position.y = 9;
    g.add(inner);
    return {
      object: g,
      update(t) {
        core.rotation.y = t * 0.7;
        core.rotation.x = Math.sin(t * 0.5) * 0.3;
        shell.rotation.y = -t * 0.25;
        shell.rotation.z = t * 0.1;
        inner.position.y = 9 + Math.sin(t * 1.3) * 0.35;
      },
    };
  },

  neuro(color, themed, rand) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 9.5;
    g.add(inner);
    const N = 130;
    const pts = [];
    for (let k = 0; k < N; k++) {
      const y = 1 - (k / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = k * 2.39996;
      const R = 3.6 + (rand() - 0.5) * 1.2;
      pts.push(new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R));
    }
    const lines = [];
    for (let k = 0; k < N; k++) {
      const d = pts.map((p, j) => [p.distanceToSquared(pts[k]), j]).sort((a, b) => a[0] - b[0]);
      for (let m = 1; m <= 2; m++) lines.push(pts[k], pts[d[m][1]]);
    }
    for (let k = 0; k < 10; k++) lines.push(new THREE.Vector3(), pts[Math.floor(rand() * N)]);
    const pg = new THREE.BufferGeometry().setFromPoints(pts);
    const pm = new THREE.PointsMaterial({ color, size: 0.42, sizeAttenuation: true });
    pm.userData.base = color.clone();
    themed.lineMats.push(pm);
    const lm = trackLine(themed, color, { transparent: true, opacity: 0.6 });
    inner.add(new THREE.Points(pg, pm), new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), lm));
    const soma = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 2), trackMat(themed, emblemMaterial(color, { base: '#2a2140' })));
    inner.add(soma);
    return {
      object: g,
      update(t) {
        inner.rotation.y = t * 0.3;
        inner.rotation.x = Math.sin(t * 0.2) * 0.2;
        lm.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6));
        soma.scale.setScalar(1 + Math.sin(t * 2.6) * 0.12);
      },
    };
  },

  ccrl(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 9;
    g.add(inner);
    const cubes = [];
    const mat = trackMat(themed, emblemMaterial(color, { base: '#0d2a33', transparent: true, opacity: 0.88 }));
    const edge = trackLine(themed, color);
    const boxGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const linkPts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k - 2) * 0.62;
      const p = new THREE.Vector3(Math.sin(a) * 5, Math.cos(a * 1.2) * 1.4 - 0.6, Math.cos(a) * 1.2);
      const cube = new THREE.Group();
      cube.position.copy(p);
      cube.add(new THREE.Mesh(boxGeo, mat), new THREE.LineSegments(edgeGeo, edge));
      inner.add(cube);
      cubes.push(cube);
      if (k > 0) linkPts.push(cubes[k - 1].position, p);
    }
    inner.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linkPts), trackLine(themed, color, { transparent: true, opacity: 0.7 })));
    return {
      object: g,
      update(t) {
        cubes.forEach((c, k) => {
          c.rotation.set(t * 0.4 + k, t * 0.6 + k * 0.5, 0);
          c.position.y = Math.cos((k - 2) * 0.62 * 1.2) * 1.4 - 0.6 + Math.sin(t * 2 + k) * 0.25;
        });
        inner.rotation.y = Math.sin(t * 0.3) * 0.5;
      },
    };
  },

  field(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 6.5;
    g.add(inner);
    const flames = [];
    [['#ff5a1f', 2.0, 5.6], ['#ffb02e', 1.35, 4.2], ['#fff1c2', 0.7, 2.6]].forEach(([c, r, h], k) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 - k * 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
      m.userData.base = new THREE.Color(c);
      themed.lineMats.push(m);
      const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true).translate(0, h / 2, 0), m);
      inner.add(f);
      flames.push(f);
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.09, 6, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
    ring.material.userData.base = color.clone();
    themed.lineMats.push(ring.material);
    const sweepM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const sweep = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24, 0, Math.PI / 3).rotateX(-Math.PI / 2), sweepM);
    inner.add(ring, sweep);
    return {
      object: g,
      update(t) {
        flames.forEach((f, k) => {
          const s = 1 + Math.sin(t * (9 + k * 3)) * 0.06 + Math.sin(t * 4.3 + k) * 0.05;
          f.scale.set(s, 1 + Math.sin(t * 7 + k * 2) * 0.12, s);
          f.rotation.y = t * (0.5 + k);
        });
        sweep.rotation.y = -t * 1.4;
      },
    };
  },

  projects(color, themed, rand) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 8.5;
    g.add(inner);
    const nodes = [];
    const nodeMat = trackMat(themed, emblemMaterial(color, { base: '#0f2a20' }));
    const leaderMat = trackMat(themed, emblemMaterial('#eafff5', { base: '#bfffe4' }));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), nodeMat);
      n.position.set(Math.cos(a) * 4, 0, Math.sin(a) * 4);
      inner.add(n);
      nodes.push(n);
    }
    const circle = [];
    for (let k = 0; k <= 64; k++) circle.push(new THREE.Vector3(Math.cos((k / 64) * Math.PI * 2) * 4, 0, Math.sin((k / 64) * Math.PI * 2) * 4));
    inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle), trackLine(themed, color, { transparent: true, opacity: 0.5 })));
    const packetMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const packets = [0, 1, 2, 3].map(() => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), packetMat);
      inner.add(p);
      return p;
    });
    let leader = 0;
    let lastElection = 0;
    return {
      object: g,
      update(t) {
        if (t - lastElection > 7) {
          lastElection = t;
          leader = (leader + 1 + Math.floor(rand() * 4)) % 5;
        }
        const electing = t - lastElection < 0.8;
        nodes.forEach((n, k) => {
          const isL = k === leader;
          n.material = isL ? leaderMat : nodeMat;
          n.scale.setScalar(isL ? 1.35 + Math.sin(t * 6) * 0.05 : 1);
          n.position.y = electing ? Math.sin(t * 20 + k) * 0.15 : 0;
        });
        const ph = (t * 1.2) % 1;
        let k2 = 0;
        for (let k = 0; k < 5; k++) {
          if (k === leader) continue;
          const p = packets[k2++];
          p.visible = !electing;
          p.position.lerpVectors(nodes[leader].position, nodes[k].position, ph);
        }
        inner.rotation.y = t * 0.25;
      },
    };
  },

  records(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 9.5;
    g.add(inner);
    const star = new THREE.Shape();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 === 0 ? 4.2 : 2.0;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      k === 0 ? star.moveTo(x, y) : star.lineTo(x, y);
    }
    star.closePath();
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.7, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 1 }).translate(0, 0, -0.35);
    const sm = trackMat(themed, emblemMaterial(color, { base: '#e4002b', metalness: 0.4, roughness: 0.3 }));
    inner.add(new THREE.Mesh(sg, sm));
    const barMat = trackMat(themed, emblemMaterial('#41b6e6', { base: '#41b6e6', metalness: 0.2, roughness: 0.4 }));
    for (const y of [-5.2, 5.2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, 0.3), barMat);
      bar.position.y = y;
      inner.add(bar);
    }
    return {
      object: g,
      update(t) {
        inner.rotation.y = Math.sin(t * 0.6) * 0.9;
        inner.position.y = 9.5 + Math.sin(t * 1.1) * 0.3;
      },
    };
  },

  academy(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 9;
    g.add(inner);
    const m = trackMat(themed, emblemMaterial(color, { base: '#162235', metalness: 0.3, roughness: 0.5 }));
    const board = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 7), m);
    board.rotation.y = Math.PI / 4;
    board.position.y = 1.2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 1.8, 24), m);
    cap.position.y = 0.2;
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12), m);
    button.position.y = 1.45;
    const tasselMat = trackMat(themed, emblemMaterial('#ffd23f', { base: '#c9a227' }));
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.8), tasselMat);
    cord.position.set(0, 1.42, 2.4);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.8, 10), tasselMat);
    tassel.position.set(0, 0.4, 4.8);
    inner.add(board, cap, button, cord, tassel);
    return {
      object: g,
      update(t) {
        inner.rotation.y = t * 0.45;
        inner.rotation.z = Math.sin(t * 0.9) * 0.08;
        inner.position.y = 9 + Math.sin(t * 1.2) * 0.4;
        tassel.rotation.x = Math.sin(t * 2.2) * 0.25;
      },
    };
  },

  arena(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 5.5;
    g.add(inner);
    const m = trackMat(themed, emblemMaterial(color, { base: '#2b1020' }));
    const bars = [];
    for (let k = 0; k < 15; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1, 0.46).translate(0, 0.5, 0), m);
      b.position.x = (k - 7) * 0.78;
      inner.add(b);
      bars.push(b);
    }
    return {
      object: g,
      update(t) {
        bars.forEach((b, k) => {
          const v = Math.abs(Math.sin(t * 3.1 + k * 0.55) * Math.cos(t * 1.7 - k * 0.3)) + 0.12 * Math.sin(t * 9 + k);
          b.scale.y = 0.5 + v * 6.5 * (1 - Math.abs(k - 7) / 11);
        });
      },
    };
  },

  armory(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 8.5;
    inner.rotation.x = 0.3;
    g.add(inner);
    const m = trackMat(themed, emblemMaterial(color, { base: '#28301a', metalness: 0.85, roughness: 0.25 }));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.42, 10, 48).rotateX(Math.PI / 2), m);
    inner.add(belt);
    const pouchMat = new THREE.MeshStandardMaterial({ color: '#2a2d30', metalness: 0.5, roughness: 0.5 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.9), k === 0 ? m : pouchMat);
      p.position.set(Math.cos(a) * 4.15, 0, Math.sin(a) * 4.15);
      p.rotation.y = -a + Math.PI / 2;
      inner.add(p);
    }
    return {
      object: g,
      update(t) {
        inner.rotation.y = t * 0.5;
        inner.position.y = 8.5 + Math.sin(t * 1.4) * 0.3;
      },
    };
  },

  signal(color, themed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 10;
    g.add(inner);
    const ellipseMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    ellipseMat.userData.base = color.clone();
    themed.lineMats.push(ellipseMat);
    const ellipse = new THREE.Mesh(new THREE.CircleGeometry(1, 48), ellipseMat);
    ellipse.scale.set(5.6, 3.9, 1);
    const shapes = batShape(5);
    const bat = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shapes, { depth: 0.5, bevelEnabled: false }).translate(0, 0, -0.25),
      new THREE.MeshStandardMaterial({ color: '#0b0c0e', metalness: 0.6, roughness: 0.4 }),
    );
    bat.position.z = 0.05;
    const back = bat.clone();
    back.position.z = -0.05;
    inner.add(ellipse, bat);
    return {
      object: g,
      update(t) {
        inner.rotation.y = Math.sin(t * 0.5) * 0.6;
        inner.position.y = 10 + Math.sin(t * 1.2) * 0.3;
      },
    };
  },
};
