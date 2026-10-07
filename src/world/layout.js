// City plan. Coordinates are metres; +x is east, -z is north.
// The city is a Chicago-style grid of square blocks separated by streets.

export const BLOCK = 56; // block footprint including sidewalk
export const STREET = 18; // curb-to-curb street width
export const PITCH = BLOCK + STREET; // 74
export const R = 4; // drivable grid is (2R+1)² blocks
export const HALF = (R + 0.5) * PITCH; // centre line of the outer ring road
export const EDGE = HALF + STREET / 2; // outer edge of the drivable city
export const SIDEWALK = 3.2;
export const LANE = 2.4; // inner-lane centre offset from the street centre line
export const LAKE_X = EDGE + 24; // Lake Michigan shoreline (east)
export const FILLER = 3; // rings of decorative blocks outside the drivable grid (not on the lake side)

// Navy Pier: a drivable spur running east from the outer road into the lake.
export const PIER = {
  z: -1.5 * PITCH, // aligned with an east–west street
  x0: EDGE,
  x1: LAKE_X + 170,
  halfRoad: STREET / 2,
  deckN: -1.5 * PITCH - 35, // deck extends north of the road for the Ferris wheel
  deckS: -1.5 * PITCH + 11,
  plaza: 36, // square turnaround at the end
};

// Street centre lines, west→east (x) and north→south (z) share the same values.
export const LINES = [];
for (let k = -R - 1; k <= R; k++) LINES.push((k + 0.5) * PITCH);

export const blockCenter = (i, j) => [i * PITCH, j * PITCH];

// Portfolio landmarks: which block they occupy and which side faces the road.
// Tour order follows content order and loops clockwise around downtown.
export const LANDMARK_PLAN = {
  hq: { block: [0, 0], side: 'S' },
  neuro: { block: [1, -2], side: 'E' },
  ccrl: { block: [3, -1], side: 'W' },
  field: { block: [4, 1], side: 'E' },
  projects: { block: [2, 3], side: 'N' },
  records: { block: [0, 3], side: 'N' },
  academy: { block: [-2, 2], side: 'E' },
  arena: { block: [-3, 0], side: 'E' },
  armory: { block: [-2, -2], side: 'S' },
  signal: { block: [0, -3], side: 'S' },
};

export const SIDE_DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// Blocks reserved for Chicago set pieces (not filled with generic buildings).
export const SPECIAL_BLOCKS = {
  '4,-1': 'millennium', // Cloud Gate
  '4,0': 'grant', // Buckingham Fountain
  '4,2': 'park',
  '-1,1': 'willis',
  '3,-3': 'hancock',
  '-1,-2': 'marina',
};

// The elevated "L" loop runs above the four streets around the central 3×3 blocks.
export const L_LOOP = 1.5 * PITCH;

export const blockKey = (i, j) => `${i},${j}`;

// Tallest structure per block (filled in while the city is generated); used to hide labels behind buildings.
export const BLOCK_HEIGHT = new Map();
export function noteHeight(x, z, h) {
  const key = blockKey(Math.round(x / PITCH), Math.round(z / PITCH));
  BLOCK_HEIGHT.set(key, Math.max(BLOCK_HEIGHT.get(key) || 0, h));
}

export function landmarkGeometry(id) {
  const plan = LANDMARK_PLAN[id];
  const [cx, cz] = blockCenter(...plan.block);
  const [dx, dz] = SIDE_DIR[plan.side];
  const off = BLOCK / 2 + STREET / 2;
  return {
    id,
    block: plan.block,
    side: plan.side,
    center: [cx, cz],
    facing: [dx, dz],
    pad: [cx + dx * off, cz + dz * off],
    plaza: [cx + dx * (BLOCK / 2 - 10), cz + dz * (BLOCK / 2 - 10)],
    // Cars parked on the pad run along the street (perpendicular to `facing`).
    streetDir: [Math.abs(dz), Math.abs(dx)],
  };
}

// ---------------------------------------------------------------------------
// Street graph: intersections are nodes, street segments are edges.

export function buildStreetGraph() {
  const nodes = [];
  const index = new Map();
  const add = (x, z) => {
    const key = `${x.toFixed(1)},${z.toFixed(1)}`;
    if (index.has(key)) return index.get(key);
    const id = nodes.length;
    nodes.push({ id, x, z, edges: [] });
    index.set(key, id);
    return id;
  };
  const edges = [];
  const link = (a, b) => {
    const A = nodes[a];
    const B = nodes[b];
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    const e = { id: edges.length, a, b, len };
    edges.push(e);
    A.edges.push(e);
    B.edges.push(e);
  };
  const n = LINES.length;
  const grid = [];
  for (let a = 0; a < n; a++) {
    grid[a] = [];
    for (let b = 0; b < n; b++) grid[a][b] = add(LINES[a], LINES[b]);
  }
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      if (a + 1 < n) link(grid[a][b], grid[a + 1][b]);
      if (b + 1 < n) link(grid[a][b], grid[a][b + 1]);
    }
  // Navy Pier spur.
  const pierStart = index.get(`${HALF.toFixed(1)},${PIER.z.toFixed(1)}`);
  const pierEnd = add(PIER.x1 - PIER.plaza / 2, PIER.z);
  link(pierStart, pierEnd);
  return { nodes, edges, pierEnd };
}

// Axis-aligned obstacles the car can't enter (in addition to the blocks).
export function boundaryBoxes() {
  const far = 4000;
  const px = PIER.x1 - PIER.plaza;
  const pz0 = PIER.z - PIER.halfRoad;
  const pz1 = PIER.z + PIER.halfRoad;
  const plz0 = PIER.z - PIER.plaza / 2;
  const plz1 = PIER.z + PIER.plaza / 2;
  return [
    { x0: -far, x1: -EDGE, z0: -far, z1: far }, // west
    { x0: -far, x1: far, z0: -far, z1: -EDGE }, // north
    { x0: -far, x1: far, z0: EDGE, z1: far }, // south
    { x0: EDGE, x1: px, z0: -far, z1: pz0 }, // lake, north of pier road
    { x0: EDGE, x1: px, z0: pz1, z1: far }, // lake, south of pier road
    { x0: px, x1: far, z0: -far, z1: plz0 }, // north of plaza
    { x0: px, x1: far, z0: plz1, z1: far }, // south of plaza
    { x0: PIER.x1, x1: far, z0: -far, z1: far }, // past the end of the pier
  ];
}
