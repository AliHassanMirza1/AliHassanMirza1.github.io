import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import { BLOCK, STREET, PITCH, EDGE, LAKE_X, PIER, LINES, L_LOOP, blockCenter, SIDEWALK } from './layout.js';

// Chicago set pieces: Willis Tower, John Hancock Center, Marina City, Cloud Gate,
// Buckingham Fountain, the elevated Loop with a running train, and Navy Pier.

export function buildChicago(scene, kit, { renderer, addAviation }) {
  const rand = mulberry32(99);
  const updaters = [];
  const themers = [];
  const C = (hex) => new THREE.Color(hex);

  // ------------------------------------------------------------- Willis Tower
  {
    const [cx, cz] = blockCenter(-1, 1);
    const t = 7.6;
    const heights = [
      [122, 200, 167],
      [167, 200, 122],
      [93, 167, 93],
    ];
    const tint = C('#30353d');
    kit.slab({ x0: cx - BLOCK / 2, x1: cx + BLOCK / 2, z0: cz - BLOCK / 2, z1: cz + BLOCK / 2, y1: 0.25, color: C('#c9c5bd') });
    kit.storefront({ x: cx, z: cz, hw: t * 1.5, hd: t * 1.5, color: C('#9aa0a8') });
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const x = cx + (c - 1) * t;
        const z = cz + (r - 1) * t;
        kit.prism('glass', { x, z, y0: 5, y1: heights[r][c], hw: t / 2, hd: t / 2, color: tint, uo: r * 3 + c, vo: c });
      }
    // mechanical bands
    for (const y of [55, 93, 122, 167]) kit.box('plain', cx, y, cz, t * 3 + 0.3, 1.6, t * 3 + 0.3, '#1d2025');
    for (const dx of [-2.2, 2.2]) {
      kit.add('metal', new THREE.CylinderGeometry(0.35, 0.7, 38, 8), kit.mat(cx + dx, 200 + 19, cz - t / 2), '#e8e8e8');
      addAviation(new THREE.Vector3(cx + dx, 238.6, cz - t / 2));
    }
    kit.box('glow', cx, 198.6, cz - t / 2, t + 0.5, 0.5, t * 2 + 0.5, '#d7e8ff');
  }

  // ------------------------------------------------------------- John Hancock Center
  {
    const [cx, cz] = blockCenter(3, -3);
    kit.slab({ x0: cx - BLOCK / 2, x1: cx + BLOCK / 2, z0: cz - BLOCK / 2, z1: cz + BLOCK / 2, y1: 0.25, color: C('#c9c5bd') });
    kit.storefront({ x: cx, z: cz, hw: 18, hd: 14, color: C('#8f8a84') });
    const y0 = 5;
    const y1 = 178;
    const b0 = [18, 14];
    const b1 = [11, 8];
    kit.prism('glass', { x: cx, z: cz, y0, y1, hw: b0[0], hd: b0[1], hw1: b1[0], hd1: b1[1], color: C('#262a30'), uo: 2 });
    // X-bracing on all four faces
    const stages = 5;
    const lerp = (a, b, f) => a + (b - a) * f;
    const at = (f) => [lerp(b0[0], b1[0], f) + 0.25, lerp(b0[1], b1[1], f) + 0.25];
    for (let s = 0; s < stages; s++) {
      const fa = s / stages;
      const fb = (s + 1) / stages;
      const ya = lerp(y0, y1, fa);
      const yb = lerp(y0, y1, fb);
      const [wa, da] = at(fa);
      const [wb, db] = at(fb);
      for (const sz of [-1, 1]) {
        kit.beam('plain', [cx - wa, ya, cz + sz * da], [cx + wb, yb, cz + sz * db], 0.7, '#121418');
        kit.beam('plain', [cx + wa, ya, cz + sz * da], [cx - wb, yb, cz + sz * db], 0.7, '#121418');
        kit.box('plain', cx, yb, cz + sz * db, wb * 2, 0.8, 0.5, '#121418');
      }
      for (const sx of [-1, 1]) {
        kit.beam('plain', [cx + sx * wa, ya, cz - da], [cx + sx * wb, yb, cz + db], 0.7, '#121418');
        kit.beam('plain', [cx + sx * wa, ya, cz + da], [cx + sx * wb, yb, cz - db], 0.7, '#121418');
        kit.box('plain', cx + sx * wb, yb, cz, 0.5, 0.8, db * 2, '#121418');
      }
    }
    kit.box('glow', cx, y1 - 2.5, cz, b1[0] * 2 + 0.8, 1.2, b1[1] * 2 + 0.8, '#f5f7ff');
    for (const [dx, col] of [[-4, '#e8e8e8'], [4, '#2a2a2a']]) {
      kit.add('metal', new THREE.CylinderGeometry(0.3, 0.6, 44, 8), kit.mat(cx + dx, y1 + 22, cz), col);
      addAviation(new THREE.Vector3(cx + dx, y1 + 44.5, cz));
    }
  }

  // ------------------------------------------------------------- Marina City
  {
    const [cx, cz] = blockCenter(-1, -2);
    kit.slab({ x0: cx - BLOCK / 2, x1: cx + BLOCK / 2, z0: cz - BLOCK / 2, z1: cz + BLOCK / 2, y1: 0.25, color: C('#c9c5bd') });
    const petal = new THREE.Shape();
    const P = 64;
    for (let k = 0; k <= P; k++) {
      const a = (k / P) * Math.PI * 2;
      const r = 8.2 + 1.6 * Math.abs(Math.cos(a * 8));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      k === 0 ? petal.moveTo(x, y) : petal.lineTo(x, y);
    }
    const plate = new THREE.ExtrudeGeometry(petal, { depth: 0.35, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
    for (const dx of [-12, 12]) {
      const x = cx + dx;
      const z = cz + 2;
      kit.cylinder('mason', { x, z, y0: 0, y1: 92, r: 6.6, segs: 28, color: C('#d8d4cb'), uo: dx > 0 ? 3 : 0 });
      for (let y = 3; y <= 90; y += y < 22 ? 2.9 : 3.1) kit.add('plain', plate, kit.mat(x, y, z), y < 22 ? '#a9a59d' : '#e9e6df');
      kit.add('plain', new THREE.CylinderGeometry(7, 7, 1.2, 28), kit.mat(x, 92.6, z), '#cfcac0');
    }
    kit.prism('mason', { x: cx, z: cz - 19, y0: 0, y1: 7, hw: 20, hd: 4, color: C('#c9c3b6') });
  }

  // ------------------------------------------------------------- Cloud Gate ("The Bean")
  let bean;
  let beanCam;
  {
    const [cx, cz] = blockCenter(4, -1);
    kit.slab({ x0: cx - 16, x1: cx + 16, z0: cz - 12, z1: cz + 12, y0: 0.2, y1: 0.32, color: C('#e2ddd3') });
    const g = new THREE.SphereGeometry(1, 96, 48);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      let x = pos.getX(k);
      let y = pos.getY(k);
      const z = pos.getZ(k);
      if (y < 0) {
        const pinch = Math.exp(-(x * x) / 0.12) * Math.exp(-(z * z) / 0.6);
        y = y * (1 - 0.9 * pinch);
        y = Math.max(y, -0.62);
      }
      pos.setXYZ(k, x, y, z);
    }
    g.computeVertexNormals();
    g.scale(10, 5.2, 6.2);
    g.translate(0, 0.62 * 5.2 + 0.3, 0);
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    beanCam = new THREE.CubeCamera(1, 3000, rt);
    bean = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#f2f4f7', metalness: 1, roughness: 0.03, envMap: rt.texture, envMapIntensity: 1 }));
    bean.position.set(cx, 0, cz);
    bean.castShadow = true;
    scene.add(bean);
    beanCam.position.set(cx, 4.2, cz);
    scene.add(beanCam);
    // Pritzker-style trellis hint: ring of lamp posts around the plaza
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      kit.add('metal', new THREE.CylinderGeometry(0.12, 0.12, 5, 6), kit.mat(cx + Math.cos(a) * 15, 2.8, cz + Math.sin(a) * 11), '#2b2e33');
      kit.box('glow', cx + Math.cos(a) * 15, 5.4, cz + Math.sin(a) * 11, 0.5, 0.4, 0.5, '#fff1d8');
    }
  }

  // ------------------------------------------------------------- Buckingham Fountain
  {
    const [cx, cz] = blockCenter(4, 0);
    const granite = '#cfa79c';
    kit.add('plain', new THREE.CylinderGeometry(15, 15.4, 1.2, 48, 1, true), kit.mat(cx, 0.6, cz), granite);
    kit.add('plain', new THREE.CylinderGeometry(14.4, 14.4, 1.2, 48, 1, true), kit.mat(cx, 0.6, cz), granite);
    kit.add('plain', new THREE.RingGeometry(14.4, 15.2, 48).rotateX(-Math.PI / 2), kit.mat(cx, 1.21, cz), granite);
    const tiers = [
      [6.4, 1.6, 0.8],
      [4.2, 1.2, 2.4],
      [2.5, 1.0, 3.7],
      [0.9, 2.4, 5.0],
    ];
    for (const [r, h, y] of tiers) kit.add('plain', new THREE.CylinderGeometry(r, r * 0.8, h, 32), kit.mat(cx, y, cz), granite);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(14.4, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#3d7d93', roughness: 0.05, metalness: 0.4 }),
    );
    pool.position.set(cx, 0.85, cz);
    scene.add(pool);
    // seahorses
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      kit.add('metal', new THREE.TorusKnotGeometry(0.7, 0.25, 32, 6), kit.mat(cx + Math.cos(a) * 9.5, 2.2, cz + Math.sin(a) * 9.5), '#3f6b5a');
    }
    // water jets: GPU-animated particles
    const N = 2400;
    const origin = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const jet = k % 9;
      let ox = 0;
      let oz = 0;
      let oy = 6.2;
      let vx = 0;
      let vy = 15;
      let vz = 0;
      if (jet > 0 && jet <= 4) {
        const a = (jet / 4) * Math.PI * 2 + Math.PI / 4;
        ox = Math.cos(a) * 9.5;
        oz = Math.sin(a) * 9.5;
        oy = 2.6;
        vx = -Math.cos(a) * 3.2;
        vz = -Math.sin(a) * 3.2;
        vy = 7.5;
      } else if (jet > 4) {
        const a = (jet / 4) * Math.PI * 2;
        ox = Math.cos(a) * 4;
        oz = Math.sin(a) * 4;
        oy = 2.9;
        vx = Math.cos(a) * 1.2;
        vz = Math.sin(a) * 1.2;
        vy = 6;
      }
      origin.set([cx + ox, oy, cz + oz], k * 3);
      vel.set([vx + (rand() - 0.5) * 0.6, vy * (0.92 + rand() * 0.12), vz + (rand() - 0.5) * 0.6], k * 3);
      phase[k] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(origin, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#cfe8ff') }, uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute vec3 aVel; attribute float aPhase;
        uniform float uTime, uScale;
        varying float vA;
        void main() {
          float t = fract(uTime * 0.45 + aPhase) * 2.2;
          vec3 p = position + aVel * t + vec3(0.0, -9.8, 0.0) * 0.5 * t * t;
          if (p.y < 0.9) p.y = 0.9;
          vA = 1.0 - smoothstep(1.4, 2.2, t);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uScale * 0.18 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * 0.55 * vA);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const jets = new THREE.Points(geo, mat);
    jets.frustumCulled = false;
    scene.add(jets);
    const nightCols = ['#ff6fb1', '#6fd8ff', '#ffd36f', '#9b7bff'].map(C);
    let nCur = 0;
    updaters.push((t, ctx) => {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uScale.value = ctx.pixelHeight;
      const k = Math.floor(t / 4) % nightCols.length;
      const base = C('#d8ecff').multiplyScalar(0.55);
      mat.uniforms.uColor.value.copy(base).lerp(nightCols[k].clone().multiplyScalar(1.8), nCur);
    });
    themers.push((p) => {
      nCur = p.n;
      pool.material.color.set('#3d7d93').lerp(C('#0e2a3a'), p.n);
    });
  }

  // ------------------------------------------------------------- The "L" loop
  const loop = (() => {
    const S = L_LOOP;
    const rc = 9;
    const deckY = 10.6;
    const steel = '#3f4a3e';
    const hs = STREET / 2;
    // pillars + cross girders on the four straight runs
    const sides = [
      { axisX: true, line: -S },
      { axisX: true, line: S },
      { axisX: false, line: -S },
      { axisX: false, line: S },
    ];
    for (const { axisX, line } of sides) {
      const P = (along, across, y = 0) => (axisX ? [along, y, line + across] : [line + across, y, along]);
      for (let s = -S + 4; s <= S - 4; s += 13) {
        if (LINES.some((L) => Math.abs(s - L) < hs + 1.5)) continue;
        for (const ac of [-(hs + 1.3), hs + 1.3]) {
          const [x, , z] = P(s, ac);
          kit.box('plain', x, deckY / 2, z, 0.8, deckY, 0.8, steel);
        }
        const a = P(s, -(hs + 1.3), deckY - 0.6);
        const b = P(s, hs + 1.3, deckY - 0.6);
        kit.beam('plain', a, b, 0.9, steel, 1.1);
      }
      // longitudinal girders, deck, rails
      const len = 2 * S - 2 * rc;
      for (const ac of [-3.2, 3.2]) {
        const [x, , z] = P(0, ac);
        kit.box('plain', x, deckY - 0.2, z, axisX ? len : 0.7, 1.4, axisX ? 0.7 : len, steel);
      }
      {
        const [x, , z] = P(0, 0);
        kit.box('plain', x, deckY + 0.6, z, axisX ? len : 7.4, 0.3, axisX ? 7.4 : len, '#2c302b');
        for (const r of [-0.75, 0.75]) {
          const [rx, , rz] = P(0, r);
          kit.box('metal', rx, deckY + 0.86, rz, axisX ? len : 0.14, 0.18, axisX ? 0.14 : len, '#8e8f8f');
        }
        // side railings
        for (const r of [-3.7, 3.7]) {
          const [rx, , rz] = P(0, r);
          kit.box('plain', rx, deckY + 1.2, rz, axisX ? len : 0.12, 0.9, axisX ? 0.12 : len, steel);
        }
      }
    }
    // corner curves
    // NE, SE, SW, NW (the ring's quarter starts in the +x/−z quadrant)
    const corners = [
      [S - rc, -(S - rc), 0],
      [S - rc, S - rc, -Math.PI / 2],
      [-(S - rc), S - rc, Math.PI],
      [-(S - rc), -(S - rc), Math.PI / 2],
    ];
    const ring = new THREE.RingGeometry(rc - 3.7, rc + 3.7, 16, 1, 0, Math.PI / 2).rotateX(-Math.PI / 2);
    // same quarter, facing down
    const ringBottom = new THREE.RingGeometry(rc - 3.7, rc + 3.7, 16, 1, 0, Math.PI / 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2);
    for (const [x, z, a] of corners) {
      kit.add('plain', ring, kit.mat(x, deckY + 0.75, z, 0, a), '#2c302b');
      kit.add('plain', ringBottom, kit.mat(x, deckY + 0.45, z, 0, a), '#2c302b');
    }
    // a station on the north run
    const st = [-S, 40];
    kit.box('plain', st[1], deckY + 1.0, st[0] - 5.4, 34, 0.5, 3.2, '#5b5f5a');
    kit.box('plain', st[1], deckY + 1.0, st[0] + 5.4, 34, 0.5, 3.2, '#5b5f5a');
    kit.box('plain', st[1], deckY + 5.0, st[0], 36, 0.3, 14, '#3a4a5a');
    for (const dx of [-14, 0, 14]) for (const dz of [-6.6, 6.6]) kit.box('plain', st[1] + dx, deckY + 3, st[0] + dz, 0.25, 4, 0.25, steel);
    kit.box('glow', st[1], deckY + 4.7, st[0] - 5.4, 30, 0.12, 0.4, '#fff1d8');
    kit.box('glow', st[1], deckY + 4.7, st[0] + 5.4, 30, 0.12, 0.4, '#fff1d8');

    // train path: rounded square, clockwise when seen from above
    const straight = 2 * S - 2 * rc;
    const arc = (Math.PI / 2) * rc;
    const total = 4 * (straight + arc);
    const pt = new THREE.Vector3();
    function at(s, out) {
      s = ((s % total) + total) % total;
      const seg = Math.floor(s / (straight + arc));
      let u = s - seg * (straight + arc);
      // start of each side, direction, and corner centre (rotating by 90° per side)
      const rot = (x, z) => {
        const c = Math.cos((seg * Math.PI) / 2);
        const sn = Math.sin((seg * Math.PI) / 2);
        return [x * c - z * sn, x * sn + z * c];
      };
      let lx;
      let lz;
      let tx;
      let tz;
      if (u < straight) {
        lx = -(S - rc) + u;
        lz = -S;
        tx = 1;
        tz = 0;
      } else {
        u -= straight;
        const th = u / rc;
        lx = S - rc + Math.sin(th) * rc;
        lz = -(S - rc) - Math.cos(th) * rc;
        tx = Math.cos(th);
        tz = Math.sin(th);
      }
      const [x, z] = rot(lx, lz);
      const [dx, dz] = rot(tx, tz);
      out.position.set(x, deckY + 2.85, z);
      out.heading = Math.atan2(dx, dz);
      return out;
    }
    // cars
    const cars = [];
    const body = new THREE.MeshStandardMaterial({ color: '#b8bec5', metalness: 0.85, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.6 });
    const windowMat = new THREE.MeshBasicMaterial({ color: '#fff0d0' });
    const stripe = new THREE.MeshStandardMaterial({ color: '#3a6fd8', roughness: 0.5 });
    for (let k = 0; k < 5; k++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.1, 11.2), body);
      b.castShadow = true;
      g.add(b);
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.9, 9.6), windowMat);
      w.position.y = 0.45;
      g.add(w);
      const st2 = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.25, 11.0), stripe);
      st2.position.y = -0.55;
      g.add(st2);
      const u = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 10), dark);
      u.position.y = -1.9;
      g.add(u);
      scene.add(g);
      cars.push(g);
    }
    const head = { position: new THREE.Vector3(), heading: 0 };
    let sHead = 0;
    updaters.push((t, ctx) => {
      sHead = (sHead + ctx.dt * 15) % total;
      cars.forEach((g, k) => {
        at(sHead - k * 11.9, head);
        g.position.copy(head.position);
        g.rotation.y = head.heading;
      });
    });
    themers.push((p) => {
      windowMat.color.set('#cfd6dc').lerp(C('#ffe7b8').multiplyScalar(2.6), p.n);
    });
    return { total };
  })();

  // ------------------------------------------------------------- Navy Pier
  let wheel;
  {
    const z = PIER.z;
    const x0 = EDGE;
    const x1 = PIER.x1;
    // deck over the water: the road strip and end plaza sit at road level so markings show
    const hr = PIER.halfRoad;
    const px = x1 - PIER.plaza;
    const pz = PIER.plaza / 2;
    const deck = C('#b9b3a8');
    const road = C('#5c5e63');
    kit.slab({ x0: LAKE_X, x1, z0: z - hr, z1: z + hr, y0: -2.4, y1: 0, color: road });
    kit.slab({ x0: px, x1, z0: z - pz, z1: z - hr, y0: -2.4, y1: 0, color: road });
    kit.slab({ x0: px, x1, z0: z + hr, z1: z + pz, y0: -2.4, y1: 0, color: road });
    kit.slab({ x0: LAKE_X, x1: px, z0: PIER.deckN, z1: z - hr, y0: -2.4, y1: 0.03, color: deck });
    kit.slab({ x0: px, x1, z0: PIER.deckN, z1: z - pz, y0: -2.4, y1: 0.03, color: deck });
    kit.slab({ x0: LAKE_X, x1: px, z0: z + hr, z1: PIER.deckS, y0: -2.4, y1: 0.03, color: deck });
    kit.slab({ x0, x1: LAKE_X, z0: PIER.deckN, z1: z - hr, y0: -0.2, y1: 0.03, color: deck });
    kit.slab({ x0, x1: LAKE_X, z0: z + hr, z1: PIER.deckS, y0: -0.2, y1: 0.03, color: deck });
    // headhouse buildings on the north side
    kit.prism('mason', { x: LAKE_X + 18, z: PIER.deckN + 6, y0: 0, y1: 16, hw: 14, hd: 5, color: C('#b88d6d'), uo: 2 });
    kit.prism('mason', { x: x1 - 60, z: PIER.deckN + 5, y0: 0, y1: 9, hw: 22, hd: 4, color: C('#c9a283'), uo: 5 });
    kit.box('glow', LAKE_X + 18, 15.2, PIER.deckN + 11.05, 18, 1.2, 0.1, '#ffb347');
    // end-of-pier rail
    for (let k = 0; k < 18; k++) kit.box('plain', x1 - 0.4, 0.6, z - PIER.plaza / 2 + 2 + k * 2, 0.3, 1.2, 0.3, '#3a3a3a');

    // Centennial Wheel
    const R = 27;
    const cxw = LAKE_X + 64;
    const czw = PIER.deckN + 13;
    const cy = R + 6;
    wheel = new THREE.Group();
    wheel.position.set(cxw, cy, czw);
    wheel.rotation.y = -1.0; // face west-southwest, toward downtown
    scene.add(wheel);
    const rot = new THREE.Group();
    wheel.add(rot);
    const steel = new THREE.MeshStandardMaterial({ color: '#e7e9ec', metalness: 0.7, roughness: 0.35 });
    for (const dz of [-1.6, 1.6]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, 96), steel);
      rim.position.z = dz;
      rot.add(rim);
    }
    const spokes = [];
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      for (const dz of [-1.6, 1.6]) spokes.push(0, 0, dz * 0.3, Math.cos(a) * R, Math.sin(a) * R, dz);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
    const spokeMat = new THREE.LineBasicMaterial({ color: '#d9dde2' });
    rot.add(new THREE.LineSegments(sg, spokeMat));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 4.4, 16).rotateX(Math.PI / 2), steel);
    rot.add(hub);
    // rim lights
    const LN = 96;
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), LN * 2);
    const m4 = new THREE.Matrix4();
    const hue = new THREE.Color();
    for (let k = 0; k < LN * 2; k++) {
      const a = ((k % LN) / LN) * Math.PI * 2;
      lights.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * (R + 0.4), Math.sin(a) * (R + 0.4), k < LN ? -1.6 : 1.6));
      lights.setColorAt(k, hue.setHSL((k % LN) / LN, 0.9, 0.6));
    }
    rot.add(lights);
    // gondolas stay upright
    const GN = 40;
    const gond = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 2.2, 2.4), new THREE.MeshStandardMaterial({ color: '#2d6fd6', roughness: 0.4, metalness: 0.3 }), GN);
    gond.castShadow = true;
    wheel.add(gond);
    // A-frame legs
    for (const dz of [-3.5, 3.5]) {
      for (const dx of [-9, 9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1, 8), steel);
        const from = new THREE.Vector3(dx, -cy, dz);
        const to = new THREE.Vector3(0, 0, dz * 0.7);
        leg.position.copy(from).add(to).multiplyScalar(0.5);
        leg.scale.y = from.distanceTo(to);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        leg.castShadow = true;
        wheel.add(leg);
      }
    }
    let ang = 0;
    const lightMat = lights.material;
    updaters.push((t, ctx) => {
      ang += ctx.dt * 0.06;
      rot.rotation.z = ang;
      for (let k = 0; k < GN; k++) {
        const a = (k / GN) * Math.PI * 2 + ang;
        gond.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * (R - 0.4), Math.sin(a) * (R - 0.4) - 1.4, 0));
      }
      gond.instanceMatrix.needsUpdate = true;
    });
    themers.push((p) => {
      lightMat.color.setScalar(0.35 + p.n * 3.2);
      spokeMat.color.set('#d9dde2').lerp(C('#8ac8ff'), p.n);
    });
  }

  // ------------------------------------------------------------- sailboats
  {
    const boats = [];
    const hullMat = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.5 });
    const sailMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let k = 0; k < 7; k++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 7).translate(0, 0.2, 0), hullMat);
      g.add(hull);
      const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.8, -2.5), new THREE.Vector3(0, 11, -0.4), new THREE.Vector3(0, 0.8, 2.6)]), sailMat);
      sail.geometry.computeVertexNormals();
      g.add(sail);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), lampMat);
      lamp.position.y = 11.2;
      g.add(lamp);
      g.position.set(LAKE_X + 90 + rand() * 500, -1.1, -500 + rand() * 1000);
      if (Math.abs(g.position.z - PIER.z) < 60) g.position.z += 120;
      g.rotation.y = rand() * Math.PI * 2;
      g.userData.phase = rand() * 6;
      scene.add(g);
      boats.push(g);
    }
    updaters.push((t, ctx) => {
      for (const b of boats) {
        b.position.y = -1.1 + Math.sin(t * 0.9 + b.userData.phase) * 0.15;
        b.rotation.z = Math.sin(t * 0.7 + b.userData.phase) * 0.05;
        b.translateZ(ctx.dt * 1.2);
      }
    });
    themers.push((p) => lampMat.color.setScalar(0.2 + p.n * 4));
  }

  return {
    bean,
    beanCam,
    wheel,
    loop,
    update(t, ctx) {
      for (const u of updaters) u(t, ctx);
    },
    onTheme(p) {
      for (const f of themers) f(p);
    },
  };
}
