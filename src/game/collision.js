import { PITCH, R, BLOCK, boundaryBoxes, BLOCK_HEIGHT, blockKey } from '../world/layout.js';

// Static collision: every city block (curb included) plus the lake / city-limit boxes.
const HB = BLOCK / 2;
const WALLS = boundaryBoxes();

export function isInsideBlock(x, z, margin = 0) {
  const i = Math.round(x / PITCH);
  const j = Math.round(z / PITCH);
  if (Math.abs(i) <= R && Math.abs(j) <= R) {
    if (Math.abs(x - i * PITCH) < HB + margin && Math.abs(z - j * PITCH) < HB + margin) return true;
  }
  for (const w of WALLS) if (x > w.x0 - margin && x < w.x1 + margin && z > w.z0 - margin && z < w.z1 + margin) return true;
  return false;
}

// Push a circle out of all nearby boxes. Returns the accumulated push normal (or null).
export function resolveCircle(p, r) {
  let nx = 0;
  let nz = 0;
  let hit = false;
  const push = (x0, x1, z0, z1) => {
    const cx = p.x < x0 ? x0 : p.x > x1 ? x1 : p.x;
    const cz = p.z < z0 ? z0 : p.z > z1 ? z1 : p.z;
    let dx = p.x - cx;
    let dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    hit = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      dx /= d;
      dz /= d;
      p.x += dx * (r - d);
      p.z += dz * (r - d);
      nx += dx;
      nz += dz;
    } else {
      const l = p.x - x0;
      const rr = x1 - p.x;
      const t = p.z - z0;
      const b = z1 - p.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) {
        p.x = x0 - r;
        nx -= 1;
      } else if (m === rr) {
        p.x = x1 + r;
        nx += 1;
      } else if (m === t) {
        p.z = z0 - r;
        nz -= 1;
      } else {
        p.z = z1 + r;
        nz += 1;
      }
    }
  };
  const ci = Math.round(p.x / PITCH);
  const cj = Math.round(p.z / PITCH);
  for (let i = ci - 1; i <= ci + 1; i++)
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (Math.abs(i) > R || Math.abs(j) > R) continue;
      const bx = i * PITCH;
      const bz = j * PITCH;
      push(bx - HB, bx + HB, bz - HB, bz + HB);
    }
  for (const w of WALLS) push(w.x0, w.x1, w.z0, w.z1);
  if (!hit) return null;
  const l = Math.hypot(nx, nz) || 1;
  return { x: nx / l, z: nz / l };
}

// Is the straight line from the camera to a point blocked by a tall block?
export function lineBlocked(ax, ay, az, bx, by, bz) {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / 7);
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    if (dist * (1 - f) < 14) break; // the target sits just beside its own block
    const x = ax + (bx - ax) * f;
    const z = az + (bz - az) * f;
    const i = Math.round(x / PITCH);
    const j = Math.round(z / PITCH);
    if (Math.abs(x - i * PITCH) > HB - 4 || Math.abs(z - j * PITCH) > HB - 4) continue;
    const h = BLOCK_HEIGHT.get(blockKey(i, j)) || 0;
    if (ay + (by - ay) * f < h * 0.92) return true;
  }
  return false;
}

// Shorten a camera boom so it doesn't end inside a building block.
export function clipBoom(fromX, fromZ, toX, toZ, steps = 12) {
  let t = 1;
  for (let k = 1; k <= steps; k++) {
    const f = k / steps;
    const x = fromX + (toX - fromX) * f;
    const z = fromZ + (toZ - fromZ) * f;
    if (isInsideBlock(x, z, 0.8)) {
      t = Math.max(0.25, (k - 1) / steps);
      break;
    }
  }
  return t;
}
