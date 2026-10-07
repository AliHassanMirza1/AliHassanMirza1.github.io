import { buildStreetGraph, LANE } from '../world/layout.js';
import { clamp, lerp, wrapAngle } from '../core/util.js';

// Route planning on the street graph + a pure-pursuit autopilot that drives the car there.

export const graph = buildStreetGraph();

function projectOnEdge(e, x, z) {
  const A = graph.nodes[e.a];
  const B = graph.nodes[e.b];
  const dx = B.x - A.x;
  const dz = B.z - A.z;
  const t = clamp(((x - A.x) * dx + (z - A.z) * dz) / (dx * dx + dz * dz), 0, 1);
  const px = A.x + dx * t;
  const pz = A.z + dz * t;
  return { e, t, x: px, z: pz, d: Math.hypot(x - px, z - pz) };
}

export function nearestEdge(x, z) {
  let best = null;
  for (const e of graph.edges) {
    const p = projectOnEdge(e, x, z);
    if (!best || p.d < best.d) best = p;
  }
  return best;
}

// Returns centre-line waypoints from the car to the goal, via intersections.
function centreRoute(x, z, heading, gx, gz) {
  const s = nearestEdge(x, z);
  const g = nearestEdge(gx, gz);
  const start = [s.x, s.z];
  const goal = [g.x, g.z];
  if (s.e === g.e) return [start, goal];

  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const N = graph.nodes.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  for (const id of [s.e.a, s.e.b]) {
    const n = graph.nodes[id];
    const behind = (n.x - x) * fx + (n.z - z) * fz < 0;
    dist[id] = Math.hypot(n.x - x, n.z - z) + (behind ? 70 : 0);
  }
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let k = 0; k < N; k++) if (!done[k] && dist[k] < best) ((best = dist[k]), (u = k));
    if (u < 0) break;
    done[u] = 1;
    for (const e of graph.nodes[u].edges) {
      const v = e.a === u ? e.b : e.a;
      const nd = dist[u] + e.len;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
      }
    }
  }
  let end = -1;
  let bestEnd = Infinity;
  for (const id of [g.e.a, g.e.b]) {
    const n = graph.nodes[id];
    const c = dist[id] + Math.hypot(n.x - g.x, n.z - g.z);
    if (c < bestEnd) ((bestEnd = c), (end = id));
  }
  const ids = [];
  for (let v = end; v >= 0; v = prev[v]) ids.unshift(v);
  return [start, ...ids.map((id) => [graph.nodes[id].x, graph.nodes[id].z]), goal];
}

// Offset a centre-line polyline into the right-hand lane (miter joins at corners).
function laneOffset(pts) {
  const out = [];
  const right = (a, b) => {
    const dx = Math.sign(b[0] - a[0]);
    const dz = Math.sign(b[1] - a[1]);
    return [-dz, dx];
  };
  const clean = pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 0.5);
  for (let k = 0; k < clean.length; k++) {
    const p = clean[k];
    if (k === 0) {
      const r0 = clean.length > 1 ? right(p, clean[1]) : [0, 0];
      out.push([p[0] + r0[0] * LANE, p[1] + r0[1] * LANE]);
      continue;
    }
    const r1 = right(clean[k - 1], p);
    if (k === clean.length - 1) {
      out.push([p[0] + r1[0] * LANE, p[1] + r1[1] * LANE]);
      continue;
    }
    const r2 = right(p, clean[k + 1]);
    if (r1[0] === -r2[0] && r1[1] === -r2[1]) {
      // U-turn at a node: go around it
      out.push([p[0] + r1[0] * LANE, p[1] + r1[1] * LANE], [p[0] + r2[0] * LANE, p[1] + r2[1] * LANE]);
    } else if (r1[0] === r2[0] && r1[1] === r2[1]) out.push([p[0] + r1[0] * LANE, p[1] + r1[1] * LANE]);
    else out.push([p[0] + (r1[0] + r2[0]) * LANE, p[1] + (r1[1] + r2[1]) * LANE]);
  }
  return out;
}

function densify(pts, step = 2) {
  const out = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / step));
    for (let s = 1; s <= n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]);
  }
  // cumulative distance
  const cum = [0];
  for (let k = 1; k < out.length; k++) cum.push(cum[k - 1] + Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
  return { pts: out, cum, length: cum[cum.length - 1] };
}

export function planRoute(x, z, heading, gx, gz) {
  return densify(laneOffset(centreRoute(x, z, heading, gx, gz)));
}

// Closest route point to (x, z), searching a window ahead of `from`. Returns [index, distance].
export function closestOnRoute(route, x, z, from = 0) {
  let best = from;
  let bestD = Infinity;
  for (let k = Math.max(0, from - 5); k < Math.min(route.pts.length, from + 60); k++) {
    const d = Math.hypot(route.pts[k][0] - x, route.pts[k][1] - z);
    if (d < bestD) ((bestD = d), (best = k));
  }
  return [best, bestD];
}

export class Autopilot {
  constructor() {
    this.route = null;
    this.idx = 0;
    this.reversing = 0;
    this.stuck = 0;
    this.remaining = 0;
  }

  start(route) {
    this.route = route;
    this.idx = 0;
    this.reversing = 0;
    this.stuck = 0;
    this.remaining = route.length;
  }

  stop() {
    this.route = null;
  }

  get active() {
    return !!this.route;
  }

  // Returns { input, done, stuck }.
  update(car, dt, traffic = []) {
    const R = this.route;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const v = car.speed;
    // advance to the closest point (search a window ahead)
    let best = this.idx;
    let bestD = Infinity;
    for (let k = this.idx; k < Math.min(R.pts.length, this.idx + 40); k++) {
      const d = Math.hypot(R.pts[k][0] - car.x, R.pts[k][1] - car.z);
      if (d < bestD) ((bestD = d), (best = k));
    }
    this.idx = best;
    const remaining = R.length - R.cum[best] + bestD * 0.5;
    this.remaining = remaining;

    // lookahead target
    const Ld = clamp(5.5 + Math.abs(v) * 0.32, 5.5, 18);
    let ti = best;
    while (ti < R.pts.length - 1 && R.cum[ti] - R.cum[best] < Ld) ti++;
    const T = R.pts[ti];
    const dx = T[0] - car.x;
    const dz = T[1] - car.z;
    const lz = dx * fx + dz * fz;
    const lx = dx * -fz + dz * fx;
    const alpha = Math.atan2(lx, lz);

    const input = { throttle: 0, steer: 0, handbrake: false, boost: false };

    // three-point turn if the route starts behind us
    if (this.reversing > 0 || (Math.abs(alpha) > 1.9 && Math.abs(v) < 6 && remaining > 10)) {
      if (this.reversing <= 0) this.reversing = 2.2;
      this.reversing -= dt;
      input.throttle = -0.8;
      input.steer = -Math.sign(alpha || 1);
      if (Math.abs(alpha) < 0.9) this.reversing = 0;
      return { input, done: false };
    }

    const maxSteer = lerp(0.6, 0.16, clamp(Math.abs(v) / 52, 0, 1));
    const delta = Math.atan2(2 * 3.7 * Math.sin(alpha), Math.max(Ld, 1));
    input.steer = clamp(delta / maxSteer, -1, 1);

    // speed planning: brake for corners and for the finish
    let turnAhead = 0;
    let turnDist = 999;
    const dirAt = (k) => {
      const a = R.pts[Math.max(0, k - 1)];
      const b = R.pts[Math.min(R.pts.length - 1, k + 1)];
      return Math.atan2(b[0] - a[0], b[1] - a[1]);
    };
    const h0 = dirAt(best + 1);
    for (let k = best + 2; k < R.pts.length - 1 && R.cum[k] - R.cum[best] < 45; k += 2) {
      const dh = Math.abs(wrapAngle(dirAt(k) - h0));
      if (dh > 0.5 && dh > turnAhead) {
        turnAhead = dh;
        turnDist = R.cum[k] - R.cum[best];
        break;
      }
    }
    let vt = 36;
    if (turnAhead > 0) vt = Math.min(vt, 11 + Math.max(0, turnDist - 6) * 0.75);
    vt = Math.min(vt, Math.sqrt(2 * 8 * Math.max(0, remaining - 1.2)));
    // traffic ahead
    for (const o of traffic) {
      const rx = o.x - car.x;
      const rz = o.z - car.z;
      const ahead = rx * fx + rz * fz;
      const side = Math.abs(rx * -fz + rz * fx);
      if (ahead > 0 && ahead < 20 && side < 2.8) vt = Math.min(vt, Math.max(0, (ahead - 7) * 1.2));
    }
    const err = vt - v;
    input.throttle = clamp(err * 0.25, -1, 1);
    if (err < -6) input.throttle = -1;
    // stretch the legs on long straights
    let straight = 0;
    for (let k = best; k < R.pts.length - 1; k += 3) {
      if (Math.abs(wrapAngle(dirAt(k) - h0)) > 0.15) break;
      straight = R.cum[k] - R.cum[best];
    }
    input.boost = straight > 140 && v > 24 && remaining > 160;

    // stuck detection
    if (Math.abs(v) < 0.6 && input.throttle > 0.2) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);

    const done = remaining < 2.6 && Math.abs(v) < 2.2;
    return { input, done, stuck: this.stuck > 2.5 };
  }
}
