import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/util.js';
import { LANE, STREET } from './layout.js';

// Ambient traffic: instanced cars that follow right-hand lanes on the street graph,
// turn through intersections on smooth curves, and brake for whatever is ahead (including you).

const PAINT = ['#f2b705', '#f2b705', '#e9e9e9', '#a9adb3', '#1d1f23', '#1f3b6b', '#7a1d1d', '#5d6168', '#f2b705', '#2f4f3a'];

function colored(geo, hex) {
  const g = geo.toNonIndexed();
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) arr.set([c.r, c.g, c.b], k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function carGeometry() {
  const parts = [
    colored(new THREE.BoxGeometry(2.0, 0.72, 4.6).translate(0, 0.72, 0), '#ffffff'),
    colored(new THREE.BoxGeometry(1.76, 0.62, 2.4).translate(0, 1.38, -0.25), '#ffffff'),
    colored(new THREE.BoxGeometry(1.8, 0.5, 2.2).translate(0, 1.36, -0.25), '#14181e'), // glass band
    colored(new THREE.BoxGeometry(2.04, 0.18, 4.66).translate(0, 0.42, 0), '#1a1a1a'),
  ];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]])
    parts.push(colored(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12).rotateZ(Math.PI / 2).translate(x, 0.36, z), '#0d0d0d'));
  return mergeGeometries(parts);
}

function lightGeometry() {
  const parts = [];
  for (const sx of [-0.7, 0.7]) {
    parts.push(colored(new THREE.BoxGeometry(0.42, 0.16, 0.05).translate(sx, 0.82, 2.31), '#fff6e0'));
    parts.push(colored(new THREE.BoxGeometry(0.42, 0.14, 0.05).translate(sx, 0.86, -2.31), '#ff1a1a'));
  }
  return mergeGeometries(parts);
}

export function createTraffic(scene, graph, count = 16) {
  const rand = mulberry32(777);
  const { nodes } = graph;
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55 });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const bodies = new THREE.InstancedMesh(carGeometry(), bodyMat, count);
  const lights = new THREE.InstancedMesh(lightGeometry(), lightMat, count);
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  bodies.frustumCulled = false;
  lights.frustumCulled = false;
  scene.add(bodies, lights);

  const POLICE = 2;
  const barMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const bar = new THREE.InstancedMesh(
    mergeGeometries([colored(new THREE.BoxGeometry(0.6, 0.18, 0.3).translate(-0.32, 1.78, -0.2), '#ff1030'), colored(new THREE.BoxGeometry(0.6, 0.18, 0.3).translate(0.32, 1.78, -0.2), '#1050ff')]),
    barMat,
    POLICE,
  );
  bar.frustumCulled = false;
  scene.add(bar);

  // Edges usable by traffic (no pier spur).
  const usable = (e) => e.a !== graph.pierEnd && e.b !== graph.pierEnd;
  const neighbours = nodes.map((n) => n.edges.filter(usable).map((e) => (e.a === n.id ? e.b : e.a)));

  const hs = STREET / 2;
  const tmp = new THREE.Vector3();
  function laneSegment(fromId, toId) {
    const A = nodes[fromId];
    const B = nodes[toId];
    const dx = Math.sign(B.x - A.x);
    const dz = Math.sign(B.z - A.z);
    const rx = -dz;
    const rz = dx;
    return {
      dir: [dx, dz],
      p0: [A.x + dx * hs + rx * LANE, A.z + dz * hs + rz * LANE],
      p1: [B.x - dx * hs + rx * LANE, B.z - dz * hs + rz * LANE],
    };
  }

  function planNext(car) {
    const opts = neighbours[car.to].filter((n) => n !== car.from);
    const weights = opts.map((n) => {
      const s1 = laneSegment(car.from, car.to).dir;
      const s2 = laneSegment(car.to, n).dir;
      return s1[0] === s2[0] && s1[1] === s2[1] ? 2.2 : 1; // prefer straight on
    });
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let pick = opts[0];
    for (let k = 0; k < opts.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        pick = opts[k];
        break;
      }
    }
    return pick;
  }

  function buildLeg(car) {
    // straight run along the current edge, then a curve through the next intersection
    const seg = laneSegment(car.from, car.to);
    const next = planNext(car);
    const seg2 = laneSegment(car.to, next);
    const B = nodes[car.to];
    const same = seg.dir[0] === seg2.dir[0] && seg.dir[1] === seg2.dir[1];
    const ctrl = same
      ? [(seg.p1[0] + seg2.p0[0]) / 2, (seg.p1[1] + seg2.p0[1]) / 2]
      : [B.x + (-seg.dir[1]) * LANE + (-seg2.dir[1]) * LANE, B.z + seg.dir[0] * LANE + seg2.dir[0] * LANE];
    // quadratic bezier length by sampling
    let len = 0;
    let prev = seg.p1;
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const p = bez(seg.p1, ctrl, seg2.p0, t);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    car.leg = {
      a: seg.p0,
      b: seg.p1,
      lineLen: Math.hypot(seg.p1[0] - seg.p0[0], seg.p1[1] - seg.p0[1]),
      c0: seg.p1,
      c1: ctrl,
      c2: seg2.p0,
      curveLen: len,
      next,
    };
    car.s = 0;
  }

  const bez = (a, b, c, t) => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
  };

  const cars = [];
  const used = new Set();
  for (let k = 0; k < count; k++) {
    let from;
    let to;
    do {
      from = Math.floor(rand() * nodes.length);
      const ns = neighbours[from];
      to = ns[Math.floor(rand() * ns.length)];
    } while (used.has(`${from}-${to}`) || nodes[from].id === graph.pierEnd);
    used.add(`${from}-${to}`);
    const car = { from, to, s: 0, speed: 8, cruise: 10 + rand() * 5, x: 0, z: 0, heading: 0 };
    buildLeg(car);
    car.s = rand() * car.leg.lineLen;
    cars.push(car);
    bodies.setColorAt(k, new THREE.Color(k < POLICE ? '#e9e9e9' : PAINT[k % PAINT.length]));
  }
  // police: black & white
  for (let k = 0; k < POLICE; k++) bodies.setColorAt(k, new THREE.Color('#1b1d22'));

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  function place(car) {
    const L = car.leg;
    let x;
    let z;
    let dx;
    let dz;
    if (car.s <= L.lineLen) {
      const t = car.s / L.lineLen;
      x = L.a[0] + (L.b[0] - L.a[0]) * t;
      z = L.a[1] + (L.b[1] - L.a[1]) * t;
      dx = L.b[0] - L.a[0];
      dz = L.b[1] - L.a[1];
    } else {
      const t = Math.min(1, (car.s - L.lineLen) / L.curveLen);
      [x, z] = bez(L.c0, L.c1, L.c2, t);
      const u = 1 - t;
      dx = 2 * u * (L.c1[0] - L.c0[0]) + 2 * t * (L.c2[0] - L.c1[0]);
      dz = 2 * u * (L.c1[1] - L.c0[1]) + 2 * t * (L.c2[1] - L.c1[1]);
    }
    car.x = x;
    car.z = z;
    car.heading = Math.atan2(dx, dz);
  }
  cars.forEach(place);

  return {
    cars,
    update(dt, player, t) {
      const fx = [];
      for (const car of cars) {
        // look ahead for the player or another car
        const hx = Math.sin(car.heading);
        const hz = Math.cos(car.heading);
        let gap = 99;
        const check = (ox, oz) => {
          const rx = ox - car.x;
          const rz = oz - car.z;
          const ahead = rx * hx + rz * hz;
          const side = Math.abs(rx * hz - rz * hx);
          if (ahead > 0 && ahead < 22 && side < 2.6) gap = Math.min(gap, ahead);
        };
        if (player) check(player.x, player.z);
        // Always queue behind cars in the same lane. After a long wait, stop yielding to
        // crossing traffic so intersections can't gridlock.
        const impatient = car.waited > 4;
        for (const o of cars) {
          if (o === car) continue;
          if (impatient && Math.abs(Math.cos(o.heading - car.heading)) < 0.7) continue;
          check(o.x, o.z);
        }
        const target = gap < 7.5 ? 0 : gap < 18 ? car.cruise * ((gap - 7.5) / 10.5) : car.cruise;
        car.speed += Math.max(-14 * dt, Math.min(6 * dt, target - car.speed));
        car.waited = car.speed < 0.5 ? (car.waited || 0) + dt : 0;
        car.s += car.speed * dt;
        const L = car.leg;
        if (car.s > L.lineLen + L.curveLen) {
          const over = car.s - (L.lineLen + L.curveLen);
          car.from = car.to;
          car.to = L.next;
          buildLeg(car);
          car.s = over;
        }
        place(car);
      }
      cars.forEach((car, k) => {
        q.setFromAxisAngle(up, car.heading);
        m4.compose(tmp.set(car.x, 0, car.z), q, one);
        bodies.setMatrixAt(k, m4);
        lights.setMatrixAt(k, m4);
        if (k < POLICE) bar.setMatrixAt(k, m4);
      });
      bodies.instanceMatrix.needsUpdate = true;
      lights.instanceMatrix.needsUpdate = true;
      bar.instanceMatrix.needsUpdate = true;
      const flash = Math.sin(t * 14) > 0;
      barMat.color.setRGB(flash ? 3 : 0.3, 0.3, flash ? 0.3 : 3);
      return fx;
    },
    setNight(n) {
      lightMat.color.setScalar(0.7 + n * 3.6);
    },
  };
}
