import { BLOCK, PITCH, R, EDGE, LAKE_X, PIER, L_LOOP, SPECIAL_BLOCKS, LANDMARK_PLAN, blockCenter, blockKey } from '../world/layout.js';

// Minimap (follows the car, north-up) and the full city map used for fast travel.

const X0 = -420;
const X1 = LAKE_X + 210;
const Z0 = -420;
const Z1 = 420;
const S = 1.25; // px per metre in the pre-rendered base map

const COLORS = {
  night: { bg: '#090c12', street: '#2b3342', block: '#131923', park: '#16301f', lake: '#0a1b2b', strip: '#132a1c', loop: '#5d6f5f', text: '#c9ced8', tagBg: 'rgba(7,9,13,0.86)', tagInk: '#f1ede4' },
  day: { bg: '#cfd8e1', street: '#fbfcfd', block: '#b9c4cf', park: '#a9d39c', lake: '#8dc0e0', strip: '#b7dca9', loop: '#6e7f70', text: '#1d2733', tagBg: 'rgba(255,255,255,0.92)', tagInk: '#0c1420' },
};

function drawBase(theme, landmarks) {
  const c = COLORS[theme];
  const W = Math.ceil((X1 - X0) * S);
  const H = Math.ceil((Z1 - Z0) * S);
  const cnv = document.createElement('canvas');
  cnv.width = W;
  cnv.height = H;
  const g = cnv.getContext('2d');
  const X = (x) => (x - X0) * S;
  const Z = (z) => (z - Z0) * S;
  g.fillStyle = c.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = c.lake;
  g.fillRect(X(LAKE_X), 0, W, H);
  g.fillStyle = c.strip;
  g.fillRect(X(EDGE), 0, X(LAKE_X) - X(EDGE), H);
  g.fillStyle = c.street;
  g.fillRect(X(-EDGE), Z(-EDGE), (EDGE * 2) * S, (EDGE * 2) * S);
  g.fillRect(X(EDGE), Z(PIER.z - PIER.halfRoad), (PIER.x1 - EDGE) * S, PIER.halfRoad * 2 * S);
  g.fillRect(X(PIER.x1 - PIER.plaza), Z(PIER.z - PIER.plaza / 2), PIER.plaza * S, PIER.plaza * S);
  const lmBlocks = new Map(landmarks.map((l) => [blockKey(...LANDMARK_PLAN[l.id].block), l]));
  const hb = BLOCK / 2;
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const [cx, cz] = blockCenter(i, j);
      const key = blockKey(i, j);
      const sp = SPECIAL_BLOCKS[key];
      g.fillStyle = sp === 'millennium' || sp === 'grant' || sp === 'park' ? c.park : c.block;
      roundRect(g, X(cx - hb), Z(cz - hb), BLOCK * S, BLOCK * S, 5);
      g.fill();
      const lm = lmBlocks.get(key);
      if (lm) {
        g.fillStyle = lm.stop.color + (theme === 'day' ? '66' : '44');
        roundRect(g, X(cx - hb), Z(cz - hb), BLOCK * S, BLOCK * S, 5);
        g.fill();
      }
    }
  // the L loop
  g.strokeStyle = c.loop;
  g.lineWidth = 2;
  g.setLineDash([6, 4]);
  roundRect(g, X(-L_LOOP), Z(-L_LOOP), L_LOOP * 2 * S, L_LOOP * 2 * S, 10);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = c.text;
  g.globalAlpha = 0.6;
  g.font = `600 ${20 * S}px "JetBrains Mono", monospace`;
  g.fillText('LAKE MICHIGAN', X(LAKE_X + 24), Z(230));
  g.font = `600 ${15 * S}px "JetBrains Mono", monospace`;
  g.fillText('NAVY PIER', X(LAKE_X + 30), Z(PIER.z - 34));
  g.fillText('THE LOOP', X(-L_LOOP + 8), Z(-L_LOOP - 8));
  g.globalAlpha = 1;
  return cnv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawCar(g, x, y, heading, size, color) {
  const fx = Math.sin(heading);
  const fy = Math.cos(heading);
  const rx = -fy;
  const ry = fx;
  g.beginPath();
  g.moveTo(x + fx * size, y + fy * size);
  g.lineTo(x - fx * size * 0.7 + rx * size * 0.7, y - fy * size * 0.7 + ry * size * 0.7);
  g.lineTo(x - fx * size * 0.35, y - fy * size * 0.35);
  g.lineTo(x - fx * size * 0.7 - rx * size * 0.7, y - fy * size * 0.7 - ry * size * 0.7);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.stroke();
}

export class Minimap {
  constructor(canvas, bigCanvas, landmarks) {
    this.canvas = canvas;
    this.big = bigCanvas;
    this.landmarks = landmarks;
    this.theme = 'night';
    this.base = null;
    this.radius = 235; // metres shown from centre to edge
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    canvas.width = canvas.clientWidth * dpr || 236 * dpr;
    canvas.height = canvas.clientHeight * dpr || 236 * dpr;
  }

  setTheme(theme) {
    this.theme = theme;
    this.base = drawBase(theme, this.landmarks);
  }

  resize() {
    const w = this.canvas.clientWidth || 236;
    this.canvas.width = w * this.dpr;
    this.canvas.height = w * this.dpr;
  }

  draw(car, route, accent) {
    if (!this.base) return;
    const g = this.canvas.getContext('2d');
    const W = this.canvas.width;
    const c = W / 2;
    const k = c / this.radius; // px per metre
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = COLORS[this.theme].bg;
    g.fillRect(0, 0, W, W);
    g.save();
    g.translate(c, c);
    g.scale(k / S, k / S);
    g.drawImage(this.base, -(car.x - X0) * S, -(car.z - Z0) * S);
    g.restore();
    const P = (x, z) => [c + (x - car.x) * k, c + (z - car.z) * k];
    if (route) this.drawRoute(g, route, P, accent, 3 * this.dpr);
    const tags = [];
    for (const l of this.landmarks) {
      let [x, y] = P(l.pad.x, l.pad.z);
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      const edge = c - 9 * this.dpr;
      if (d > edge) {
        // edge indicator
        const ux = dx / d;
        const uy = dy / d;
        x = c + ux * edge;
        y = c + uy * edge;
        g.save();
        g.translate(x, y);
        g.rotate(Math.atan2(uy, ux));
        g.beginPath();
        g.moveTo(5 * this.dpr, 0);
        g.lineTo(-3 * this.dpr, 4 * this.dpr);
        g.lineTo(-3 * this.dpr, -4 * this.dpr);
        g.closePath();
        g.fillStyle = l.stop.color;
        g.globalAlpha = l.visited ? 0.5 : 1;
        g.fill();
        g.restore();
        g.globalAlpha = 1;
        // edge label sits just inside the arrow
        tags.push({ l, x: c + ux * (edge - 13 * this.dpr), y: c + uy * (edge - 13 * this.dpr), edge: true });
      } else {
        this.dot(g, x, y, l, 5 * this.dpr);
        tags.push({ l, x, y, edge: false });
      }
    }
    drawCar(g, c, c, car.heading, 8 * this.dpr, accent);
    // names: in-view places first, then edge hints, skipping any that would overlap
    tags.sort((a, b) => a.edge - b.edge);
    this.drawTags(g, tags, W, 10.5 * this.dpr, c);
    g.restore();
    g.strokeStyle = 'rgba(127,127,127,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c, c, c - 1, 0, Math.PI * 2);
    g.stroke();
  }

  // Short place names in small pills beside their dot: try right, left, above, below and keep
  // the first spot that overlaps nothing (and, on the round minimap, stays inside the circle).
  drawTags(g, tags, W, size, circleR = 0) {
    const col = COLORS[this.theme];
    const placed = [];
    g.font = `650 ${size}px "Inter Variable", system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const padX = size * 0.6;
    const h = size * 1.65;
    const gap = size * 0.8;
    const inside = (x0, y0, x1, y1) =>
      !circleR || [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].every(([x, y]) => Math.hypot(x - circleR, y - circleR) < circleR - 2);
    for (const t of tags) {
      const text = t.l.stop.short || t.l.stop.label;
      const w = g.measureText(text).width + padX * 2;
      const spots = t.edge
        ? [[t.x - w / 2, t.y - h / 2]]
        : [
            [t.x + gap, t.y - h / 2],
            [t.x - gap - w, t.y - h / 2],
            [t.x - w / 2, t.y - gap - h],
            [t.x - w / 2, t.y + gap],
          ];
      const spot = spots.find(([bx, by]) => {
        const box = [bx - 2, by - 2, bx + w + 2, by + h + 2];
        if (box[0] < 0 || box[2] > W || box[1] < 0 || box[3] > W) return false;
        if (!inside(...box)) return false;
        return !placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
      });
      if (!spot) continue;
      const [bx, by] = spot;
      placed.push([bx - 2, by - 2, bx + w + 2, by + h + 2]);
      g.globalAlpha = t.edge ? 0.85 : 1;
      g.fillStyle = col.tagBg;
      roundRect(g, bx, by, w, h, h / 2);
      g.fill();
      g.lineWidth = Math.max(1, size * 0.12);
      g.strokeStyle = t.l.stop.color;
      g.stroke();
      g.fillStyle = col.tagInk;
      g.fillText(text, bx + padX, by + h / 2 + 0.5);
      g.globalAlpha = 1;
    }
  }

  dot(g, x, y, l, r) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (l.visited) {
      g.lineWidth = 2.2 * this.dpr;
      g.strokeStyle = l.stop.color;
      g.stroke();
    } else {
      g.fillStyle = l.stop.color;
      g.fill();
      g.lineWidth = 1.5 * this.dpr;
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.stroke();
    }
  }

  drawRoute(g, route, P, color, width) {
    g.beginPath();
    route.pts.forEach((p, k) => {
      const [x, y] = P(p[0], p[1]);
      k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    });
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.globalAlpha = 0.9;
    g.stroke();
    g.globalAlpha = 1;
  }

  // Full map for the fast-travel overlay. Returns a hit-test function.
  drawBig(car, route, accent) {
    if (!this.base) return () => null;
    const cnv = this.big;
    const dpr = this.dpr;
    const size = cnv.clientWidth || 560;
    cnv.width = size * dpr;
    cnv.height = size * dpr;
    const g = cnv.getContext('2d');
    const span = Math.max(X1 - X0, Z1 - Z0) + 40;
    const k = (size * dpr) / span;
    const ox = (size * dpr - (X1 - X0) * k) / 2;
    const oz = (size * dpr - (Z1 - Z0) * k) / 2;
    g.fillStyle = COLORS[this.theme].bg;
    g.fillRect(0, 0, cnv.width, cnv.height);
    g.drawImage(this.base, ox, oz, (X1 - X0) * k, (Z1 - Z0) * k);
    const P = (x, z) => [ox + (x - X0) * k, oz + (z - Z0) * k];
    if (route) this.drawRoute(g, route, P, accent, 3 * dpr);
    this.drawTags(
      g,
      this.landmarks.map((l) => {
        const [x, y] = P(l.pad.x, l.pad.z);
        return { l, x: x + 4 * dpr, y, edge: false };
      }),
      cnv.width,
      11 * dpr,
    );
    this.landmarks.forEach((l, i) => {
      const [x, y] = P(l.pad.x, l.pad.z);
      this.dot(g, x, y, l, 9 * dpr);
      g.fillStyle = l.visited ? COLORS[this.theme].text : '#0b0b0b';
      g.font = `700 ${9 * dpr}px "JetBrains Mono", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), x, y + 0.5);
    });
    const [cx, cy] = P(car.x, car.z);
    drawCar(g, cx, cy, car.heading, 10 * dpr, accent);
    return (px, py) => {
      let best = null;
      let bd = 24 * dpr;
      for (const l of this.landmarks) {
        const [x, y] = P(l.pad.x, l.pad.z);
        const d = Math.hypot(px * dpr - x, py * dpr - y);
        if (d < bd) ((bd = d), (best = l));
      }
      return best;
    };
  }
}
