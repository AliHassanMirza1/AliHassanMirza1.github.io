import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import { BAT_HALF } from '../ui/templates.js';

// Every texture in the city is drawn procedurally, so nothing is downloaded.

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function tex(c, { srgb = true, repeat = false, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  return t;
}

export const WINDOW_CELLS = 8; // windows per texture repeat, both axes

// Facade textures: albedo, emissive (lit windows at night) and roughness/metalness.
// Cells are 64px; the top-left texel of every cell is wall so roofs can sample it.
export function makeFacadeTextures(style, seed) {
  const N = WINDOW_CELLS;
  const S = 64;
  const size = N * S;
  const rand = mulberry32(seed);
  const albedo = canvas(size);
  const emissive = canvas(size);
  const rough = canvas(size);
  const a = albedo.getContext('2d');
  const e = emissive.getContext('2d');
  const r = rough.getContext('2d');

  const glass = style === 'glass';
  a.fillStyle = glass ? '#a7afb8' : '#e6e0d6';
  a.fillRect(0, 0, size, size);
  e.fillStyle = '#000';
  e.fillRect(0, 0, size, size);
  // Roughness in G, metalness in B.
  r.fillStyle = glass ? 'rgb(0,120,140)' : 'rgb(0,225,0)';
  r.fillRect(0, 0, size, size);

  // Window rectangle inside each cell.
  const wx0 = glass ? 5 : 15;
  const wx1 = glass ? 59 : 49;
  const wy0 = glass ? 7 : 12;
  const wy1 = glass ? 58 : 52;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i * S;
      const y = j * S;
      // Masonry: subtle brick/stone grain on the wall.
      if (!glass) {
        a.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`;
        a.fillRect(x, y, S, S);
        a.fillStyle = 'rgba(0,0,0,0.12)';
        a.fillRect(x, y + S - 4, S, 2); // floor ledge shadow
        a.fillStyle = 'rgba(255,255,255,0.18)';
        a.fillRect(x, y + S - 6, S, 2);
      }
      const shade = 0.75 + rand() * 0.25;
      const g = a.createLinearGradient(x, y + wy0, x, y + wy1);
      if (glass) {
        g.addColorStop(0, `rgb(${70 * shade},${100 * shade},${128 * shade})`);
        g.addColorStop(1, `rgb(${34 * shade},${50 * shade},${70 * shade})`);
      } else {
        g.addColorStop(0, `rgb(${52 * shade},${62 * shade},${76 * shade})`);
        g.addColorStop(1, `rgb(${26 * shade},${30 * shade},${38 * shade})`);
      }
      a.fillStyle = g;
      a.fillRect(x + wx0, y + wy0, wx1 - wx0, wy1 - wy0);
      if (!glass) {
        // mullion + sill
        a.fillStyle = 'rgba(210,205,195,0.9)';
        a.fillRect(x + 31, y + wy0, 2, wy1 - wy0);
        a.fillRect(x + wx0 - 2, y + wy1, wx1 - wx0 + 4, 3);
      } else {
        a.fillStyle = 'rgba(255,255,255,0.08)';
        a.fillRect(x + wx0, y + wy0, (wx1 - wx0) * 0.4, wy1 - wy0);
      }
      r.fillStyle = glass ? 'rgb(0,18,200)' : 'rgb(0,60,90)';
      r.fillRect(x + wx0, y + wy0, wx1 - wx0, wy1 - wy0);

      // Night lighting pattern.
      const p = rand();
      let col = null;
      if (p < 0.24) col = [255, 196 + rand() * 30, 120 + rand() * 40]; // warm
      else if (p < 0.36) col = [205, 228, 255]; // cool office
      else if (p < 0.44) col = [120, 90, 60]; // dim lamp
      else if (p < 0.46) col = [120, 200, 255]; // tv glow
      if (col) {
        const lg = e.createLinearGradient(x, y + wy0, x, y + wy1);
        lg.addColorStop(0, `rgb(${col[0] * 0.7},${col[1] * 0.7},${col[2] * 0.7})`);
        lg.addColorStop(1, `rgb(${col[0]},${col[1]},${col[2]})`);
        e.fillStyle = lg;
        e.fillRect(x + wx0, y + wy0, wx1 - wx0, wy1 - wy0);
        // blinds on some windows
        if (rand() < 0.35) {
          e.fillStyle = 'rgba(0,0,0,0.45)';
          const bh = (wy1 - wy0) * (0.2 + rand() * 0.5);
          e.fillRect(x + wx0, y + wy0, wx1 - wx0, bh);
        }
      }
    }
  }
  return {
    map: tex(albedo, { repeat: true }),
    emissiveMap: tex(emissive, { repeat: true }),
    roughMap: tex(rough, { srgb: false, repeat: true }),
  };
}

// Ground-floor shopfronts: 4 shops per 16 m repeat, sign band on top.
const SHOPS = ['CAFE', 'DELI', 'BOOKS', 'BARBER', 'PHARMACY', 'LAUNDRY', 'RECORDS', 'TAILOR', 'DINER', 'BAKERY', 'FLORIST', 'HARDWARE', 'NEWS', 'GYM', 'TACOS', 'NOODLES'];
const SIGN_COLS = ['#7a1d1d', '#1d3b2a', '#1b2a4a', '#141414', '#5a3b12', '#3a1d4a', '#0f3b44'];
export function makeStorefront(seed = 9) {
  const W = 1024;
  const H = 320;
  const rand = mulberry32(seed);
  const a = canvas(W, H);
  const e = canvas(W, H);
  const r = canvas(W, H);
  const ga = a.getContext('2d');
  const ge = e.getContext('2d');
  const gr = r.getContext('2d');
  ga.fillStyle = '#d9d3c8';
  ga.fillRect(0, 0, W, H);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, W, H);
  gr.fillStyle = 'rgb(0,220,0)';
  gr.fillRect(0, 0, W, H);
  const shopW = W / 4;
  for (let k = 0; k < 4; k++) {
    const x = k * shopW;
    // pilaster
    ga.fillStyle = '#bdb6aa';
    ga.fillRect(x, 0, 14, H);
    // sign band
    const sc = SIGN_COLS[Math.floor(rand() * SIGN_COLS.length)];
    ga.fillStyle = sc;
    ga.fillRect(x + 22, 18, shopW - 44, 58);
    const word = SHOPS[Math.floor(rand() * SHOPS.length)];
    for (const [g, col] of [
      [ga, '#f3e6c4'],
      [ge, rand() < 0.5 ? '#ffd9a0' : '#bfe8ff'],
    ]) {
      g.font = '800 40px "Big Shoulders Display", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = col;
      g.fillText(word, x + shopW / 2, 49);
    }
    // awning shadow
    ga.fillStyle = 'rgba(0,0,0,0.25)';
    ga.fillRect(x + 14, 78, shopW - 14, 8);
    // windows + door
    const gy0 = 92;
    const gy1 = H - 22;
    const door = rand() < 0.6;
    const g = ga.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, '#2b3440');
    g.addColorStop(1, '#151a21');
    ga.fillStyle = g;
    ga.fillRect(x + 26, gy0, shopW - 52, gy1 - gy0);
    gr.fillStyle = 'rgb(0,20,160)';
    gr.fillRect(x + 26, gy0, shopW - 52, gy1 - gy0);
    // interior light at night
    const warm = rand() < 0.8;
    const ig = ge.createLinearGradient(0, gy0, 0, gy1);
    ig.addColorStop(0, warm ? 'rgba(255,200,130,0.95)' : 'rgba(190,225,255,0.9)');
    ig.addColorStop(1, warm ? 'rgba(150,95,50,0.8)' : 'rgba(90,120,150,0.8)');
    ge.fillStyle = ig;
    ge.fillRect(x + 26, gy0, shopW - 52, gy1 - gy0);
    // mullions
    ga.fillStyle = '#3a342d';
    ge.fillStyle = '#000';
    for (const mx of [0.33, 0.66]) {
      ga.fillRect(x + 26 + (shopW - 52) * mx, gy0, 5, gy1 - gy0);
      ge.fillRect(x + 26 + (shopW - 52) * mx, gy0, 5, gy1 - gy0);
    }
    if (door) {
      const dx = x + shopW / 2 - 26;
      ga.fillStyle = '#1b1612';
      ga.fillRect(dx, gy0 + 20, 52, gy1 - gy0 - 20);
      ge.fillStyle = 'rgba(80,55,30,1)';
      ge.fillRect(dx + 6, gy0 + 26, 40, gy1 - gy0 - 32);
    }
    // stall riser
    ga.fillStyle = '#5c544a';
    ga.fillRect(x + 22, gy1, shopW - 44, H - gy1);
  }
  return {
    map: tex(a, { repeat: true }),
    emissiveMap: tex(e, { repeat: true }),
    roughMap: tex(r, { srgb: false, repeat: true }),
  };
}

// Asphalt: grain + darker patches; roughness map has puddle-like smooth areas.
export function makeAsphalt() {
  const size = 512;
  const rand = mulberry32(7);
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#6f7277';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 34;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(30,30,32,${0.04 + rand() * 0.08})`;
    g.beginPath();
    g.ellipse(rand() * size, rand() * size, 20 + rand() * 70, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // cracks
  g.strokeStyle = 'rgba(25,25,28,0.35)';
  g.lineWidth = 1;
  for (let k = 0; k < 14; k++) {
    let x = rand() * size;
    let y = rand() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (rand() - 0.5) * 30;
      y += (rand() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const r = canvas(256);
  const rg = r.getContext('2d');
  rg.fillStyle = 'rgb(0,235,0)';
  rg.fillRect(0, 0, 256, 256);
  rg.filter = 'blur(10px)';
  for (let k = 0; k < 16; k++) {
    rg.fillStyle = `rgb(0,${50 + rand() * 60},0)`;
    rg.beginPath();
    rg.ellipse(rand() * 256, rand() * 256, 10 + rand() * 30, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    rg.fill();
  }
  return { map: tex(c, { repeat: true }), roughMap: tex(r, { srgb: false, repeat: true }) };
}

export function makeConcrete() {
  const size = 256;
  const rand = mulberry32(11);
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#bdbab3';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(70,70,70,0.35)';
  g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo((k * size) / 4, 0);
    g.lineTo((k * size) / 4, size);
    g.moveTo(0, (k * size) / 4);
    g.lineTo(size, (k * size) / 4);
    g.stroke();
  }
  return tex(c, { repeat: true });
}

export function makeGrass() {
  const size = 256;
  const rand = mulberry32(5);
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#5d7d3e';
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 2600; k++) {
    const v = rand();
    g.fillStyle = v < 0.5 ? 'rgba(40,70,30,0.35)' : 'rgba(140,170,90,0.25)';
    g.fillRect(rand() * size, rand() * size, 2, 2 + rand() * 3);
  }
  return tex(c, { repeat: true });
}

// Soft radial glow (light pools, halos).
export function makeGlow(inner = 0, hard = false) {
  const size = 128;
  const c = canvas(size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.5 * inner, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(hard ? 0.6 : 0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: false });
}

// Dark blob used as a contact shadow under cars.
export function makeShadowBlob() {
  const size = 128;
  const c = canvas(size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: false });
}

export function traceBat(ctx, scale, cx, cy) {
  for (const sx of [1, -1]) {
    for (const c of BAT_HALF) {
      const X = (x) => cx + x * sx * scale;
      const Y = (y) => cy + y * scale;
      if (c[0] === 'M') ctx.moveTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'L') ctx.lineTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'Q') ctx.quadraticCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]));
    }
  }
}

export function batShape(scale = 1) {
  // THREE.Shape uses y-up, our path is y-down: flip y.
  const shapes = [];
  for (const sx of [1, -1]) {
    const s = new THREE.Shape();
    for (const c of BAT_HALF) {
      if (c[0] === 'M') s.moveTo(c[1] * sx * scale, -c[2] * scale);
      else if (c[0] === 'L') s.lineTo(c[1] * sx * scale, -c[2] * scale);
      else if (c[0] === 'Q') s.quadraticCurveTo(c[1] * sx * scale, -c[2] * scale, c[3] * sx * scale, -c[4] * scale);
    }
    shapes.push(s);
  }
  return shapes;
}

// The bat-signal as projected onto clouds.
export function makeBatSignal() {
  const size = 512;
  const c = canvas(size);
  const g = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const grd = g.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.5);
  grd.addColorStop(0, 'rgba(255,236,170,1)');
  grd.addColorStop(0.62, 'rgba(255,214,110,0.95)');
  grd.addColorStop(0.8, 'rgba(255,200,90,0.35)');
  grd.addColorStop(1, 'rgba(255,190,80,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, cy, size * 0.5, size * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.beginPath();
  traceBat(g, size * 0.36, cx, cy + size * 0.01);
  g.fill();
  return tex(c, { srgb: true });
}

export function makeSteam() {
  const size = 128;
  const rand = mulberry32(3);
  const c = canvas(size);
  const g = c.getContext('2d');
  for (let k = 0; k < 18; k++) {
    const x = size / 2 + (rand() - 0.5) * size * 0.4;
    const y = size / 2 + (rand() - 0.5) * size * 0.4;
    const r = size * (0.15 + rand() * 0.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  return tex(c, { srgb: false });
}

// Tileable water normals from layered sine waves.
export function makeWaterNormals() {
  const size = 256;
  const c = canvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rand = mulberry32(21);
  const waves = Array.from({ length: 10 }, () => ({
    kx: Math.round((rand() - 0.5) * 12),
    ky: Math.round((rand() - 0.5) * 12),
    a: 0.3 + rand() * 0.7,
    p: rand() * Math.PI * 2,
  }));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const ph = ((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.p;
        const d = Math.cos(ph) * w.a;
        dx += d * w.kx * 0.05;
        dy += d * w.ky * 0.05;
      }
      const n = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / n) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / n) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / n) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false, repeat: true });
}

// Glowing neon sign text.
export function makeNeonSign(text, color, { vertical = false, w = 512, h = 160, font = 'Big Shoulders Display' } = {}) {
  const c = vertical ? canvas(h, w) : canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#060608';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeRect(8, 8, c.width - 16, c.height - 16);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (vertical) {
    const letters = text.split('');
    const step = (c.height - 40) / letters.length;
    g.font = `900 ${Math.min(step * 0.9, c.width * 0.75)}px "${font}", sans-serif`;
    letters.forEach((ch, k) => {
      g.shadowBlur = 18;
      g.fillStyle = color;
      g.fillText(ch, c.width / 2, 20 + step * (k + 0.5));
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(ch, c.width / 2, 20 + step * (k + 0.5));
    });
  } else {
    g.font = `900 ${h * 0.62}px "${font}", sans-serif`;
    g.shadowBlur = 20;
    g.fillStyle = color;
    g.fillText(text, c.width / 2, c.height / 2 + 4);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(text, c.width / 2, c.height / 2 + 4);
  }
  return tex(c);
}

// Rooftop sign letters (lit at night, painted by day).
export function makeRoofSign(text, color) {
  const c = canvas(1024, 192);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = `900 150px "Big Shoulders Display", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 16;
  g.fillText(text, c.width / 2, c.height / 2 + 8);
  return tex(c);
}

// The HQ billboard: portrait + name card.
export async function makeBillboard(profile) {
  const W = 1400;
  const H = 600;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1118');
  bg.addColorStop(1, '#1a1f2a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = profile.avatar;
    });
    g.save();
    g.beginPath();
    g.rect(0, 0, H, H);
    g.clip();
    g.drawImage(img, 0, 0, H, H);
    const fade = g.createLinearGradient(H * 0.6, 0, H, 0);
    fade.addColorStop(0, 'rgba(13,17,24,0)');
    fade.addColorStop(1, 'rgba(16,20,28,1)');
    g.fillStyle = fade;
    g.fillRect(0, 0, H, H);
    g.restore();
  } catch {
    /* portrait is optional */
  }
  const x = H + 30;
  g.fillStyle = '#ffd23f';
  g.font = '600 25px "JetBrains Mono", monospace';
  g.fillText(`${profile.role} · Fulbright Scholar`.toUpperCase(), x, 120);
  g.fillStyle = '#f4f0e6';
  g.font = '900 150px "Big Shoulders Display", sans-serif';
  g.fillText('ALI', x, 270);
  g.fillText('HASSAN', x, 410);
  g.fillStyle = 'rgba(244,240,230,0.75)';
  g.font = '500 34px "Inter Variable", sans-serif';
  g.fillText('MS CS @ UIC · Chicago', x, 485);
  g.fillStyle = '#ffd23f';
  g.fillRect(x, 520, 120, 6);
  return tex(c);
}

// Labels painted onto the minimap / generic text sprites.
export function makeTextTexture(text, { size = 64, color = '#fff', font = 'Big Shoulders Display', weight = 800, pad = 16 } = {}) {
  const measure = canvas(8).getContext('2d');
  measure.font = `${weight} ${size}px "${font}", sans-serif`;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const c = canvas(w, size + pad * 2);
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px "${font}", sans-serif`;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, pad, c.height / 2);
  return { texture: tex(c), aspect: c.width / c.height };
}
