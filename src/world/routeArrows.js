import * as THREE from 'three';
import { damp, smoothstep } from '../core/util.js';

// Game-style GPS guidance: glowing chevrons painted on the road that flow along the
// route toward the next stop, fading in ahead of the car and out into the distance.

const SPACING = 5; // metres between chevrons
const AHEAD = 150; // how far down the route to draw
const COUNT = Math.ceil(AHEAD / SPACING) + 2;

function chevronGeometry() {
  // a thick "^" pointing +Y in shape space
  const s = new THREE.Shape();
  s.moveTo(-1, -0.45);
  s.lineTo(0, 0.55);
  s.lineTo(1, -0.45);
  s.lineTo(1, -1.0);
  s.lineTo(0, 0.0);
  s.lineTo(-1, -1.0);
  s.closePath();
  // lay it flat facing up, pointing +Z (the direction of travel after the instance yaw)
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI).scale(1.5, 1, 1.6);
}

export function createRouteArrows(scene) {
  const mat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.InstancedMesh(chevronGeometry(), mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.setColorAt(0, new THREE.Color('#ffffff')); // allocate colours up front (no shader recompile later)
  mesh.count = 0;
  scene.add(mesh);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const base = new THREE.Color();
  const col = new THREE.Color();
  let fade = 0;
  let flow = 0;

  // point + heading at arc length s along a densified route
  const sample = (route, s, out) => {
    const { pts, cum } = route;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < s) lo = mid;
      else hi = mid;
    }
    const f = cum[hi] > cum[lo] ? (s - cum[lo]) / (cum[hi] - cum[lo]) : 0;
    out.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f;
    out.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
    return out;
  };
  const a = { x: 0, z: 0 };
  const b = { x: 0, z: 0 };
  const p = { x: 0, z: 0 };

  return {
    // route: { pts, cum, length }, idx: the car's closest point on it, active: show or hide
    update(dt, route, idx, color, active, night) {
      fade = damp(fade, active && route ? 1 : 0, 5, dt);
      if (fade < 0.01 || !route) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      flow = (flow + dt * 9) % SPACING; // chevrons glide forward along the route
      if (color) base.set(color);
      // night: glowing additive light; day: solid, saturated paint that reads on bright asphalt
      const glow = night > 0.5;
      mat.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = glow ? 1 : 0.95 * fade;
      const gain = glow ? 1.9 * fade : 1.05;
      const sCar = route.cum[Math.min(idx, route.cum.length - 1)];
      const end = route.length - 2.5; // stop short of the landing pad
      let n = 0;
      for (let k = 0; k < COUNT; k++) {
        const s = sCar + 4 + k * SPACING + flow;
        if (s > end) break;
        const d = s - sCar;
        const alpha = smoothstep(4, 11, d) * (1 - smoothstep(AHEAD * 0.65, AHEAD, d)) * smoothstep(0, 6, end - s);
        if (alpha <= 0.01) continue;
        // heading from a short chord so corners turn smoothly
        sample(route, Math.max(0, s - 1.5), a);
        sample(route, Math.min(route.length, s + 1.5), b);
        sample(route, s, p);
        q.setFromAxisAngle(up, Math.atan2(b.x - a.x, b.z - a.z));
        const sc = 0.45 + 0.55 * alpha; // chevrons grow in as they appear and shrink into the distance
        m4.compose(pos.set(p.x, 0.06, p.z), q, scale.set(sc, 1, sc));
        mesh.setMatrixAt(n, m4);
        mesh.setColorAt(n, col.copy(base).multiplyScalar(glow ? alpha * gain : gain));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
