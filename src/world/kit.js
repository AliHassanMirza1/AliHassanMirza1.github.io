import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeFacadeTextures, WINDOW_CELLS, makeConcrete, makeStorefront } from './textures.js';
import { noteHeight } from './layout.js';

// The kit collects every static piece of the city into a handful of merged meshes
// (one per material), so thousands of boxes cost only a few draw calls.

const FLOOR = 3.3; // metres per floor
const BAY = 2.8; // metres per window bay
const N = WINDOW_CELLS;

// Hand-rolled quad builder: positions, normals, uvs, colours, indices.
class QuadBuilder {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.i = [];
  }
  quad(v, uvs, col, shadeBottom = 1) {
    const base = this.p.length / 3;
    const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const e2 = [v[3][0] - v[0][0], v[3][1] - v[0][1], v[3][2] - v[0][2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (let k = 0; k < 4; k++) {
      this.p.push(v[k][0], v[k][1], v[k][2]);
      this.n.push(nx, ny, nz);
      this.uv.push(uvs[k][0], uvs[k][1]);
      const s = k < 2 ? shadeBottom : 1;
      this.c.push(col.r * s, col.g * s, col.b * s);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  get empty() {
    return this.p.length === 0;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const tmpColor = new THREE.Color();

export function createKit(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const glassTex = makeFacadeTextures('glass', 101);
  const masonTex = makeFacadeTextures('mason', 202);
  const storeTex = makeStorefront(9);
  for (const t of [...Object.values(glassTex), ...Object.values(masonTex), ...Object.values(storeTex)]) t.anisotropy = aniso;

  const facadeMat = (t, metal) =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      emissiveMap: t.emissiveMap,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0,
      roughnessMap: t.roughMap,
      metalnessMap: t.roughMap,
      roughness: 1,
      metalness: metal,
    });

  const materials = {
    glass: facadeMat(glassTex, 1),
    mason: facadeMat(masonTex, 1),
    store: facadeMat(storeTex, 1),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    concrete: new THREE.MeshStandardMaterial({ vertexColors: true, map: makeConcrete(), roughness: 0.92 }),
  };
  materials.concrete.map.anisotropy = aniso;

  const builders = {
    glass: new QuadBuilder(),
    mason: new QuadBuilder(),
    store: new QuadBuilder(),
    concrete: new QuadBuilder(),
  };
  const geoms = { plain: [], metal: [], glow: [] };

  // ------------------------------------------------------------------ facades
  // Prism with (optionally) tapered top. UVs are in window units so every facade lines up.
  function prism(style, { x, z, y0, y1, hw, hd, hw1 = hw, hd1 = hd, color, uo = 0, vo = 0, roof = true, aoBase = true }) {
    const b = builders[style];
    noteHeight(x, z, y1);
    const U = (s) => (s / BAY + uo) / N;
    const V = (y) => (y / FLOOR + vo) / N;
    const shade = aoBase && y0 < 0.5 ? 0.62 : 1;
    const faces = [
      // south (+z)
      [[x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + hw1, y1, z + hd1], [x - hw1, y1, z + hd1], hw, hw1],
      // north (-z)
      [[x + hw, y0, z - hd], [x - hw, y0, z - hd], [x - hw1, y1, z - hd1], [x + hw1, y1, z - hd1], hw, hw1],
      // east (+x)
      [[x + hw, y0, z + hd], [x + hw, y0, z - hd], [x + hw1, y1, z - hd1], [x + hw1, y1, z + hd1], hd, hd1],
      // west (-x)
      [[x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - hw1, y1, z + hd1], [x - hw1, y1, z - hd1], hd, hd1],
    ];
    faces.forEach((f, k) => {
      const w0 = f[4];
      const w1 = f[5];
      const off = (k * 3) % N; // vary lit pattern per face
      b.quad(
        f.slice(0, 4),
        [
          [U(0 + off * BAY), V(y0)],
          [U(2 * w0 + off * BAY), V(y0)],
          [U(w0 + w1 + off * BAY), V(y1)],
          [U(w0 - w1 + off * BAY), V(y1)],
        ],
        color,
        shade,
      );
    });
    if (roof) {
      tmpColor.copy(color).multiplyScalar(0.5);
      const r = 0.02 / N;
      b.quad(
        [
          [x - hw1, y1, z + hd1],
          [x + hw1, y1, z + hd1],
          [x + hw1, y1, z - hd1],
          [x - hw1, y1, z - hd1],
        ],
        [
          [r, r],
          [r, r],
          [r, r],
          [r, r],
        ],
        tmpColor,
      );
    }
  }

  // Ground-floor shopfront band (16 m texture repeat, full height maps to the texture).
  function storefront({ x, z, hw, hd, h = 5, color, uo = 0 }) {
    const b = builders.store;
    const U = (s) => s / 16 + uo;
    const faces = [
      [[x - hw, 0, z + hd], [x + hw, 0, z + hd], [x + hw, h, z + hd], [x - hw, h, z + hd], hw],
      [[x + hw, 0, z - hd], [x - hw, 0, z - hd], [x - hw, h, z - hd], [x + hw, h, z - hd], hw],
      [[x + hw, 0, z + hd], [x + hw, 0, z - hd], [x + hw, h, z - hd], [x + hw, h, z + hd], hd],
      [[x - hw, 0, z - hd], [x - hw, 0, z + hd], [x - hw, h, z + hd], [x - hw, h, z - hd], hd],
    ];
    faces.forEach((f, k) => {
      const o = k * 0.25;
      b.quad(
        f.slice(0, 4),
        [
          [U(0) + o, 0],
          [U(2 * f[4]) + o, 0],
          [U(2 * f[4]) + o, 1],
          [U(0) + o, 1],
        ],
        color,
      );
    });
  }

  // Raised slab (sidewalks, plazas, parks) with world-space UVs.
  function slab({ x0, x1, z0, z1, y0 = 0, y1 = 0.25, color, scale = 4 }) {
    const b = builders.concrete;
    const U = (v) => v / scale;
    b.quad(
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [
        [U(x0), U(z1)],
        [U(x1), U(z1)],
        [U(x1), U(z0)],
        [U(x0), U(z0)],
      ],
      color,
    );
    tmpColor.copy(color).multiplyScalar(0.8);
    const h = y1 - y0;
    const sides = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], x1 - x0],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], x1 - x0],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], z1 - z0],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], z1 - z0],
    ];
    for (const s of sides)
      b.quad(
        s.slice(0, 4),
        [
          [0, 0],
          [U(s[4]), 0],
          [U(s[4]), U(h)],
          [0, U(h)],
        ],
        tmpColor,
      );
  }

  // Generic geometry (any BufferGeometry), baked with a colour into one of the merged groups.
  function add(group, geometry, matrix, color) {
    const g = geometry.index ? geometry.clone() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    const c = color instanceof THREE.Color ? color : tmpColor.set(color);
    for (let k = 0; k < count; k++) {
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    if (!g.index) {
      const idx = [];
      for (let k = 0; k < count; k++) idx.push(k);
      g.setIndex(idx);
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    geoms[group].push(g);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    q.setFromEuler(e.set(rx, ry, rz));
    return m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz)).clone();
  }

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const box = (group, x, y, z, w, h, d, color, ry = 0) => add(group, unitBox, mat(x, y, z, 0, ry, 0, w, h, d), color);

  // Square-section beam between two points (trusses, spokes, bracing).
  const zAxis = new THREE.Vector3(0, 0, 1);
  const dir = new THREE.Vector3();
  function beam(group, a, b, w, color, h = w) {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    q.setFromUnitVectors(zAxis, dir.normalize());
    m4.compose(v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s.set(w, h, len));
    add(group, unitBox, m4.clone(), color);
  }

  // Window-textured cylinder (Marina City cores, arenas).
  function cylinder(style, { x, z, y0, y1, r, segs = 24, color, uo = 0, vo = 0 }) {
    const b = builders[style];
    noteHeight(x, z, y1);
    const circ = 2 * Math.PI * r;
    const U = (t) => ((t * circ) / BAY + uo) / N;
    const V = (y) => (y / FLOOR + vo) / N;
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2;
      const a1 = ((k + 1) / segs) * Math.PI * 2;
      const p0 = [x + Math.sin(a0) * r, z + Math.cos(a0) * r];
      const p1 = [x + Math.sin(a1) * r, z + Math.cos(a1) * r];
      b.quad(
        [
          [p0[0], y0, p0[1]],
          [p1[0], y0, p1[1]],
          [p1[0], y1, p1[1]],
          [p0[0], y1, p0[1]],
        ],
        [
          [U(k / segs), V(y0)],
          [U((k + 1) / segs), V(y0)],
          [U((k + 1) / segs), V(y1)],
          [U(k / segs), V(y1)],
        ],
        color,
      );
    }
  }

  function finalize(scene) {
    const meshes = {};
    const mk = (name, geometry, material, { cast = true, receive = true } = {}) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = name;
      scene.add(mesh);
      meshes[name] = mesh;
    };
    if (!builders.glass.empty) mk('glass', builders.glass.build(), materials.glass);
    if (!builders.mason.empty) mk('mason', builders.mason.build(), materials.mason);
    if (!builders.store.empty) mk('store', builders.store.build(), materials.store);
    if (!builders.concrete.empty) mk('concrete', builders.concrete.build(), materials.concrete, { cast: false });
    if (geoms.plain.length) mk('plain', mergeGeometries(geoms.plain), materials.plain);
    if (geoms.metal.length) mk('metal', mergeGeometries(geoms.metal), materials.metal);
    if (geoms.glow.length) mk('glow', mergeGeometries(geoms.glow), materials.glow, { cast: false, receive: false });
    for (const list of Object.values(geoms)) for (const g of list) g.dispose();
    return meshes;
  }

  return { materials, prism, storefront, slab, add, box, beam, cylinder, mat, finalize, FLOOR, BAY };
}
