import * as THREE from 'three';
import { mulberry32, pick } from '../core/util.js';
import {
  BLOCK, STREET, PITCH, R, HALF, EDGE, SIDEWALK, LAKE_X, FILLER, PIER, LINES,
  blockCenter, blockKey, SPECIAL_BLOCKS, LANDMARK_PLAN,
} from './layout.js';
import { makeAsphalt, makeGlow, makeNeonSign, makeGrass, makeWaterNormals } from './textures.js';

const MASON_TINTS = ['#d9cfbf', '#b0705a', '#8f5c47', '#a3a19c', '#77726c', '#cbb593', '#9c8f80', '#c4bfb6'];
const GLASS_TINTS = ['#a5b9cc', '#c3cbd3', '#73818f', '#8fa49d', '#454b55', '#b6c4cf'];
const SIDEWALK_COL = new THREE.Color('#c9c5bd');
const PARK_COL = new THREE.Color('#ffffff');

const landmarkBlocks = new Set(Object.values(LANDMARK_PLAN).map((p) => blockKey(...p.block)));

export function buildCity(scene, kit, renderer) {
  const rand = mulberry32(1337);
  const facadeSpots = [];
  const aviation = [];
  const tall = [];
  const C = (hex) => new THREE.Color(hex);

  // ------------------------------------------------------------------ ground
  const asphalt = makeAsphalt();
  asphalt.map.repeat.set(220, 220);
  asphalt.roughMap.repeat.set(160, 160);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  asphalt.map.anisotropy = asphalt.roughMap.anisotropy = Math.min(16, aniso);
  const groundMat = new THREE.MeshStandardMaterial({
    color: '#4a4c51',
    map: asphalt.map,
    roughnessMap: asphalt.roughMap,
    roughness: 1,
    metalness: 0.0,
  });
  const groundW = LAKE_X + 3000;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundW, 6000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(LAKE_X - groundW / 2, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Lake Michigan
  const waterNormals = makeWaterNormals();
  waterNormals.repeat.set(60, 90);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#2c5f7c',
    roughness: 0.12,
    metalness: 0.35,
    normalMap: waterNormals,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(4000, 6000), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE_X + 2000, -1.1, 0);
  lake.receiveShadow = true;
  scene.add(lake);
  kit.box('plain', LAKE_X + 0.8, -1.4, 0, 1.6, 2.2, 6000, '#8d8a84'); // seawall

  // Lakefront park strip (between Lake Shore Drive and the water).
  const grassTex = makeGrass();
  grassTex.repeat.set(4, 220);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: grassTex, roughness: 0.95 });
  // split around the Navy Pier entrance
  for (const [z0, z1] of [[-3000, PIER.deckN], [PIER.deckS, 3000]]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(LAKE_X - EDGE, z1 - z0), grassMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((EDGE + LAKE_X) / 2, 0.2, (z0 + z1) / 2);
    strip.receiveShadow = true;
    scene.add(strip);
    kit.slab({ x0: EDGE, x1: EDGE + 1.2, z0, z1, y1: 0.28, color: SIDEWALK_COL });
  }

  // ------------------------------------------------------------------ blocks
  const parkMeshes = [];
  const addPark = (cx, cz, w = BLOCK, d = BLOCK) => {
    kit.slab({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y1: 0.25, color: SIDEWALK_COL });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w - SIDEWALK * 2, d - SIDEWALK * 2), grassMat.clone());
    g.material.map = grassTex.clone();
    g.material.map.repeat.set(3, 3);
    g.material.map.needsUpdate = true;
    g.rotation.x = -Math.PI / 2;
    g.position.set(cx, 0.27, cz);
    g.receiveShadow = true;
    scene.add(g);
    parkMeshes.push(g);
  };

  function building(lot, d, opts = {}) {
    const { x0, x1, z0, z1, streets } = lot;
    let w = x1 - x0;
    let dd = z1 - z0;
    const hw = Math.max(4, Math.floor((w * (opts.fill ?? 1)) / 4) * 2);
    const hd = Math.max(4, Math.floor((dd * (opts.fill ?? 1)) / 4) * 2);
    // keep the building flush with the street-facing sides
    let x = (x0 + x1) / 2;
    let z = (z0 + z1) / 2;
    if (streets.E && !streets.W) x = x1 - hw;
    if (streets.W && !streets.E) x = x0 + hw;
    if (streets.S && !streets.N) z = z1 - hd;
    if (streets.N && !streets.S) z = z0 + hd;

    const base = 22 + 98 * Math.exp(-(d * d) / 7.5);
    let h = base * (0.45 + rand() * 0.9);
    if (rand() < 0.07 && d < 4) h *= 1.75;
    if (opts.maxH) h = Math.min(h, opts.maxH);
    h = Math.max(12, h);
    const floors = Math.round((h - 5) / kit.FLOOR);
    h = 5 + floors * kit.FLOOR;

    const glass = h > 55 ? rand() < 0.62 : rand() < 0.12;
    const style = glass ? 'glass' : 'mason';
    const tint = C(pick(rand, glass ? GLASS_TINTS : MASON_TINTS));
    const uo = Math.floor(rand() * 8);
    const vo = Math.floor(rand() * 8);

    if (!opts.noStore) kit.storefront({ x, z, hw, hd, color: C('#ffffff').lerp(tint, 0.25), uo: rand() });
    const y0 = opts.noStore ? 0 : 5;

    // setbacks
    let tiers = [[y0, h, hw, hd]];
    if (h > 48 && rand() < 0.65) {
      const t1 = 5 + Math.round(((h - 5) * (0.5 + rand() * 0.2)) / kit.FLOOR) * kit.FLOOR;
      const s1 = 0.72 + rand() * 0.12;
      const hw1 = Math.max(4, Math.floor((hw * s1) / 2) * 2);
      const hd1 = Math.max(4, Math.floor((hd * s1) / 2) * 2);
      tiers = [[y0, t1, hw, hd], [t1, h, hw1, hd1]];
      if (h > 90 && rand() < 0.6) {
        const t2 = t1 + Math.round(((h - t1) * 0.6) / kit.FLOOR) * kit.FLOOR;
        const hw2 = Math.max(4, Math.floor((hw1 * 0.7) / 2) * 2);
        const hd2 = Math.max(4, Math.floor((hd1 * 0.7) / 2) * 2);
        tiers = [[y0, t1, hw, hd], [t1, t2, hw1, hd1], [t2, h + 7, hw2, hd2]];
      }
    }
    for (const [a, b, tw, td] of tiers) kit.prism(style, { x, z, y0: a, y1: b, hw: tw, hd: td, color: tint, uo, vo });
    const top = tiers[tiers.length - 1];
    const topY = top[1];
    const thw = top[2];
    const thd = top[3];

    // cornice / parapet
    if (!glass) kit.box('plain', x, topY + 0.4, z, thw * 2 + 0.6, 0.8, thd * 2 + 0.6, tint.clone().multiplyScalar(0.8));

    // roof furniture
    if (!opts.noProps) {
      if (topY > 95 && rand() < 0.45) {
        // art-deco spire with lit crown
        const sh = 10 + rand() * 18;
        kit.add('plain', new THREE.CylinderGeometry(0.2, Math.min(thw, thd) * 0.9, sh, 4), kit.mat(x, topY + sh / 2, z, 0, Math.PI / 4), tint.clone().multiplyScalar(0.9));
        kit.box('glow', x, topY + 1.2, z, thw * 2 + 0.3, 0.5, thd * 2 + 0.3, pick(rand, ['#ffd9a8', '#9fd2ff', '#ff6b6b', '#ffffff']));
        aviation.push(new THREE.Vector3(x, topY + sh + 0.4, z));
      } else if (topY > 70) {
        const ah = 8 + rand() * 16;
        kit.add('metal', new THREE.CylinderGeometry(0.18, 0.3, ah, 6), kit.mat(x + thw * 0.4, topY + ah / 2, z), '#cfcfcf');
        kit.box('plain', x - thw * 0.3, topY + 1.8, z, Math.min(8, thw), 3.6, Math.min(8, thd), '#6f6c68');
        aviation.push(new THREE.Vector3(x + thw * 0.4, topY + ah + 0.3, z));
        if (rand() < 0.5) kit.box('glow', x, topY - 1.5, z, thw * 2 + 0.25, 0.35, thd * 2 + 0.25, pick(rand, ['#ffe2b0', '#a8d8ff', '#ffffff']));
      } else {
        if (rand() < 0.5 && !glass) waterTower(x - thw * 0.4 + rand() * thw * 0.8, topY, z - thd * 0.4 + rand() * thd * 0.8);
        const units = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < units; k++)
          kit.box('plain', x + (rand() - 0.5) * thw, topY + 0.7, z + (rand() - 0.5) * thd, 1.6 + rand(), 1.4, 1.6 + rand(), '#8a8784');
      }
    }
    if (h > 60) tall.push({ x, z, h: topY });

    // street-facing facades for neon signs
    const spot = (fx, fz, nx, nz, width) => facadeSpots.push({ x: fx, z: fz, nx, nz, width, h });
    if (streets.S) spot(x, z + hd, 0, 1, hw * 2);
    if (streets.N) spot(x, z - hd, 0, -1, hw * 2);
    if (streets.E) spot(x + hw, z, 1, 0, hd * 2);
    if (streets.W) spot(x - hw, z, -1, 0, hd * 2);
  }

  function waterTower(x, y, z) {
    const wood = '#6d5340';
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('plain', x + dx * 1.2, y + 1.4, z + dz * 1.2, 0.2, 2.8, 0.2, '#3d3a37');
    kit.add('plain', new THREE.CylinderGeometry(1.7, 1.7, 3.2, 12), kit.mat(x, y + 4.4, z), wood);
    kit.add('plain', new THREE.ConeGeometry(1.9, 1.5, 12), kit.mat(x, y + 6.75, z), '#4a3a2e');
  }

  const LOT_PATTERNS = [
    [[-1, 1, -1, 1]],
    [[-1, 0, -1, 1], [0, 1, -1, 1]],
    [[-1, 1, -1, 0], [-1, 1, 0, 1]],
    [[-1, 0, -1, 0], [0, 1, -1, 0], [-1, 0, 0, 1], [0, 1, 0, 1]],
    [[-1, 0, -1, 1], [0, 1, -1, 0], [0, 1, 0, 1]],
    [[-1, 1, -1, 0], [-1, 0, 0, 1], [0, 1, 0, 1]],
  ];

  function fillBlock(i, j, { filler = false } = {}) {
    const [cx, cz] = blockCenter(i, j);
    const hb = BLOCK / 2;
    kit.slab({ x0: cx - hb, x1: cx + hb, z0: cz - hb, z1: cz + hb, y1: 0.25, color: SIDEWALK_COL });
    const inner = hb - SIDEWALK;
    const d = Math.hypot(i, j * 1.1);
    const pattern = filler ? pick(rand, LOT_PATTERNS.slice(0, 3)) : pick(rand, LOT_PATTERNS);
    const gap = 1.4;
    for (const [a0, a1, b0, b1] of pattern) {
      const x0 = cx + a0 * inner + (a0 > -1 ? gap / 2 : 0);
      const x1 = cx + a1 * inner - (a1 < 1 ? gap / 2 : 0);
      const z0 = cz + b0 * inner + (b0 > -1 ? gap / 2 : 0);
      const z1 = cz + b1 * inner - (b1 < 1 ? gap / 2 : 0);
      const streets = { W: a0 === -1, E: a1 === 1, N: b0 === -1, S: b1 === 1 };
      building({ x0, x1, z0, z1, streets }, d, filler ? { noProps: rand() < 0.5, noStore: Math.abs(i) > R + 1 || Math.abs(j) > R + 1 } : {});
    }
  }

  for (let i = -R - FILLER; i <= R; i++) {
    for (let j = -R - FILLER; j <= R + FILLER; j++) {
      const key = blockKey(i, j);
      const inGrid = Math.abs(i) <= R && Math.abs(j) <= R;
      if (inGrid) {
        if (landmarkBlocks.has(key)) continue;
        const special = SPECIAL_BLOCKS[key];
        if (special === 'millennium' || special === 'grant' || special === 'park') {
          addPark(...blockCenter(i, j));
          continue;
        }
        if (special) continue; // built by chicago.js
        fillBlock(i, j);
      } else {
        fillBlock(i, j, { filler: true });
      }
    }
  }

  // ------------------------------------------------------------------ road markings
  const markWhite = [];
  const markYellow = [];
  const pushMark = (list, x, z, len, wid, alongX) => list.push([x, z, alongX ? len : wid, alongX ? wid : len]);
  function segment(axisX, line, s0, s1) {
    // axisX: segment runs along x at z=line; otherwise along z at x=line
    const len = s1 - s0;
    const mid = (s0 + s1) / 2;
    const P = (along, across) => (axisX ? [along, line + across] : [line + across, along]);
    for (const off of [-0.2, 0.2]) pushMark(markYellow, ...P(mid, off), len, 0.16, axisX);
    for (const lane of [-4.5, 4.5]) {
      for (let s = s0 + 6; s < s1 - 6; s += 7.5) pushMark(markWhite, ...P(s + 1.5, lane), 3, 0.16, axisX);
    }
    // crosswalk zebras + stop lines at both ends
    for (const [end, dir] of [[s0, 1], [s1, -1]]) {
      for (let a = -7.7; a <= 7.7; a += 1.4) pushMark(markWhite, ...P(end + dir * 1.9, a), 2.8, 0.6, axisX);
      // stop line on the lane approaching this end (right-hand traffic)
      const side = axisX ? -dir : dir;
      pushMark(markWhite, ...P(end + dir * 4.1, side * 4.5), 0.45, 8.6, axisX);
    }
  }
  const hs = STREET / 2;
  for (const L of LINES) {
    for (let b = 0; b + 1 < LINES.length; b++) {
      segment(false, L, LINES[b] + hs, LINES[b + 1] - hs);
      segment(true, L, LINES[b] + hs, LINES[b + 1] - hs);
    }
  }
  segment(true, PIER.z, EDGE, PIER.x1 - PIER.plaza);

  const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const markMat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m4 = new THREE.Matrix4();
  for (const [list, color] of [[markWhite, '#d8d8d4'], [markYellow, '#e2ac22']]) {
    const im = new THREE.InstancedMesh(planeGeo, markMat(color), list.length);
    list.forEach(([x, z, w, d], k) => im.setMatrixAt(k, m4.makeScale(w, 1, d).setPosition(x, 0.02, z)));
    im.receiveShadow = true;
    im.matrixAutoUpdate = false;
    scene.add(im);
  }

  // ------------------------------------------------------------------ street lamps
  const lamps = [];
  const lampAlong = [-18, 0, 18];
  const addLampsForBlock = (cx, cz, sides = ['N', 'S', 'E', 'W'], skipMid = null) => {
    const off = BLOCK / 2 - 1.1;
    for (const side of sides) {
      const [nx, nz] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[side];
      for (const a of lampAlong) {
        if (a === 0 && skipMid === side) continue;
        const x = cx + nx * off + (nz !== 0 ? a : 0);
        const z = cz + nz * off + (nx !== 0 ? a : 0);
        lamps.push({ x, z, nx, nz });
      }
    }
  };
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const lm = Object.values(LANDMARK_PLAN).find((p) => p.block[0] === i && p.block[1] === j);
      addLampsForBlock(...blockCenter(i, j), undefined, lm?.side);
    }
  // across the ring road
  for (let k = -R; k <= R; k++) {
    addLampsForBlock(...blockCenter(k, -R - 1), ['S']);
    addLampsForBlock(...blockCenter(k, R + 1), ['N']);
    addLampsForBlock(...blockCenter(-R - 1, k), ['E']);
    for (const a of lampAlong) lamps.push({ x: EDGE + 1.2, z: k * PITCH + a, nx: -1, nz: 0 });
  }
  // pier
  for (let x = EDGE + 20; x < PIER.x1 - PIER.plaza; x += 24) {
    lamps.push({ x, z: PIER.z - PIER.halfRoad - 1, nx: 0, nz: 1 });
    lamps.push({ x: x + 12, z: PIER.z + PIER.halfRoad + 1, nx: 0, nz: -1 });
  }

  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 7.6, 6).translate(0, 3.8, 0);
  const armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2).translate(0, 7.5, 1.0);
  const headGeo = new THREE.BoxGeometry(0.55, 0.22, 1.0).translate(0, 7.42, 2.1);
  const bulbGeo = new THREE.PlaneGeometry(0.42, 0.85).rotateX(Math.PI / 2).translate(0, 7.3, 2.1);
  const lampMetal = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5, metalness: 0.7 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffb46b' });
  const poolTex = makeGlow(0.0);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex,
    color: '#ff9a45',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const poolGeo = new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2);
  const lampMeshes = [
    new THREE.InstancedMesh(poleGeo, lampMetal, lamps.length),
    new THREE.InstancedMesh(armGeo, lampMetal, lamps.length),
    new THREE.InstancedMesh(headGeo, lampMetal, lamps.length),
    new THREE.InstancedMesh(bulbGeo, bulbMat, lamps.length),
  ];
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  lamps.forEach((l, k) => {
    // arm points from the sidewalk toward the street (+z of the lamp's local frame)
    q.setFromAxisAngle(up, Math.atan2(l.nx, l.nz));
    m4.compose(new THREE.Vector3(l.x, 0.25, l.z), q, new THREE.Vector3(1, 1, 1));
    for (const im of lampMeshes) im.setMatrixAt(k, m4);
    m4.makeTranslation(l.x + l.nx * 3.2, 0.05, l.z + l.nz * 3.2);
    pools.setMatrixAt(k, m4);
  });
  for (const im of lampMeshes) {
    im.castShadow = im.material !== bulbMat;
    im.matrixAutoUpdate = false;
    scene.add(im);
  }
  pools.renderOrder = 2;
  pools.matrixAutoUpdate = false;
  scene.add(pools);

  // ------------------------------------------------------------------ trees
  const trees = [];
  const parkBlocks = Object.entries(SPECIAL_BLOCKS).filter(([, v]) => v === 'park' || v === 'grant' || v === 'millennium');
  for (const [key, kind] of parkBlocks) {
    const [i, j] = key.split(',').map(Number);
    const [cx, cz] = blockCenter(i, j);
    for (let a = -2; a <= 2; a++)
      for (let b = -2; b <= 2; b++) {
        if (kind !== 'park' && Math.abs(a) < 2 && Math.abs(b) < 2) continue; // keep the plaza clear
        trees.push([cx + a * 9.5 + (rand() - 0.5) * 3, cz + b * 9.5 + (rand() - 0.5) * 3, 0.85 + rand() * 0.5]);
      }
  }
  for (let z = -HALF - 300; z < HALF + 300; z += 11) {
    if (Math.abs(z - PIER.z) < 34) continue;
    trees.push([EDGE + 8 + rand() * 6, z + rand() * 4, 0.8 + rand() * 0.6]);
    if (rand() < 0.6) trees.push([EDGE + 16 + rand() * 4, z + 5 + rand() * 4, 0.8 + rand() * 0.5]);
  }
  // sidewalk trees on outer residential blocks
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      if (Math.hypot(i, j) < 2.6 || rand() < 0.4) continue;
      const key = blockKey(i, j);
      if (landmarkBlocks.has(key) || SPECIAL_BLOCKS[key]) continue;
      const [cx, cz] = blockCenter(i, j);
      const off = BLOCK / 2 - 1.6;
      for (const a of [-9, 9, -26, 26].slice(0, 2 + Math.floor(rand() * 2))) {
        if (rand() < 0.5) trees.push([cx + a, cz + off, 0.6 + rand() * 0.3]);
        if (rand() < 0.5) trees.push([cx + off, cz + a, 0.6 + rand() * 0.3]);
      }
    }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 5).translate(0, 1.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.6, 0);
  const trunkIM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 }), trees.length);
  const crownIM = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), trees.length);
  const greens = ['#4f7a35', '#5d8a3c', '#3f6b2f', '#6f9440', '#55803a'].map((c) => new THREE.Color(c));
  trees.forEach(([x, z, s], k) => {
    q.setFromAxisAngle(up, rand() * 6.28);
    m4.compose(new THREE.Vector3(x, 0.25, z), q, new THREE.Vector3(s, s * (0.9 + rand() * 0.3), s));
    trunkIM.setMatrixAt(k, m4);
    crownIM.setMatrixAt(k, m4);
    crownIM.setColorAt(k, greens[k % greens.length]);
  });
  for (const im of [trunkIM, crownIM]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.matrixAutoUpdate = false;
    scene.add(im);
  }

  // ------------------------------------------------------------------ neon signs
  const NEON = [
    ['DINER', '#2fe6ff'], ['HOTEL', '#ff3b3b', true], ['JAZZ', '#ff4fd8'], ['BLUES', '#4f86ff'],
    ['PIZZA', '#ff7a2f'], ['BAR', '#ffb02e'], ['24H', '#38ff8b'], ['CHICAGO', '#ff2d2d', true],
    ['MOTEL', '#ff3b6b', true], ['CINEMA', '#ffd23f'], ['NOODLES', '#ff5f5f'], ['ARCADE', '#b46bff'],
  ];
  const neonMats = NEON.map(([text, color, vertical]) => ({
    vertical: !!vertical,
    material: new THREE.MeshBasicMaterial({ map: makeNeonSign(text, color, { vertical: !!vertical }), color: '#ffffff', side: THREE.DoubleSide }),
  }));
  const signs = [];
  const candidates = facadeSpots.filter((s) => s.width >= 8 && Math.abs(s.x) < EDGE - 20 && Math.abs(s.z) < EDGE - 20 && s.h > 14);
  for (let k = 0; k < 34 && candidates.length; k++) {
    const idx = Math.floor(rand() * candidates.length);
    const s = candidates.splice(idx, 1)[0];
    const nm = neonMats[k % neonMats.length];
    let mesh;
    if (nm.vertical) {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.7), nm.material);
      // blade sign perpendicular to the wall
      const along = (rand() - 0.5) * (s.width - 3);
      mesh.position.set(s.x + s.nx * 1.1 + Math.abs(s.nz) * along, 8.6, s.z + s.nz * 1.1 + Math.abs(s.nx) * along);
      mesh.rotation.y = Math.atan2(s.nx, s.nz) + Math.PI / 2;
    } else {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.45), nm.material);
      const along = (rand() - 0.5) * (s.width - 6);
      mesh.position.set(s.x + s.nx * 0.08 + Math.abs(s.nz) * along, 6.0, s.z + s.nz * 0.08 + Math.abs(s.nx) * along);
      mesh.rotation.y = Math.atan2(s.nx, s.nz);
    }
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    signs.push(mesh);
  }

  // ------------------------------------------------------------------ aviation lights
  const aviGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const aviMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
  const avi = new THREE.InstancedMesh(aviGeo, aviMat, Math.max(1, aviation.length + 16));
  avi.count = 0;
  const addAviation = (p) => {
    avi.setMatrixAt(avi.count++, m4.makeTranslation(p.x, p.y, p.z));
    avi.instanceMatrix.needsUpdate = true;
  };
  aviation.forEach(addAviation);
  scene.add(avi);

  return {
    tall,
    addAviation,
    onTheme(p) {
      const n = p.n;
      groundMat.roughness = p.groundRough;
      // sun-bleached grey asphalt by day, dark and wet-looking by night
      groundMat.color.set('#a3a6ab').lerp(new THREE.Color('#3f4146'), n);
      waterMat.color.set('#2c5f7c').lerp(new THREE.Color('#0b1622'), n);
      bulbMat.color.set('#ffcf9a').multiplyScalar(0.6 + n * 5.5);
      poolMat.opacity = n * 0.55;
      pools.visible = n > 0.02;
      for (const nm of neonMats) nm.material.color.setScalar(0.75 + n * 2.1);
      kit.materials.glow.color.setScalar(0.5 + n * 2.6);
      kit.materials.glass.emissiveIntensity = n * 0.8;
      kit.materials.mason.emissiveIntensity = n * 0.85;
      kit.materials.store.emissiveIntensity = 0.06 + n * 0.85;
      this._n = n;
    },
    update(t) {
      waterNormals.offset.set(t * 0.004, t * 0.0025);
      const blink = Math.sin(t * 3.1) > 0.55 ? 1 : 0.15;
      aviMat.color.set('#ff2a2a').multiplyScalar((0.4 + (this._n ?? 1) * 4.5) * blink);
    },
  };
}
