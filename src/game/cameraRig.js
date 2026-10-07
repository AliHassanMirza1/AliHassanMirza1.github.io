import * as THREE from 'three';
import { damp, clamp, easeInOutCubic } from '../core/util.js';
import { clipBoom } from './collision.js';

// Camera director: intro orbit → cinematic swoop → chase cam, plus a showcase framing
// for landmarks (with the frame shifted left when the side panel is open).

const PRESETS = [
  { dist: 10.5, height: 3.6, look: 1.4 },
  { dist: 17, height: 6.5, look: 1.8 },
  { dist: 6.8, height: 2.4, look: 1.3 },
];

export class CameraRig {
  constructor(camera, { reducedMotion = false } = {}) {
    this.camera = camera;
    this.mode = 'orbit';
    this.preset = 0;
    this.reduced = reducedMotion;
    this.pos = camera.position.clone();
    this.look = new THREE.Vector3();
    this.orbitAngle = 0.6;
    this.yawOffset = 0;
    this.pitchOffset = 0;
    this.zoom = 1;
    this.dragging = false;
    this.lastDrag = -10;
    this.shake = 0;
    this.clock = 0;
    this.viewShift = 0;
    this.viewShiftTarget = 0;
    this.fov = camera.fov;
    this.transition = null;
    this.showcase = null;
  }

  cyclePreset() {
    this.preset = (this.preset + 1) % PRESETS.length;
  }

  chaseTarget(car, out = {}) {
    const p = PRESETS[this.preset];
    const sp = Math.abs(car.speed);
    const yaw = car.heading + Math.PI + this.yawOffset;
    const dist = (p.dist + sp * 0.035) * this.zoom;
    const height = (p.height + sp * 0.012) * this.zoom + this.pitchOffset * dist;
    let cx = car.x + Math.sin(yaw) * dist;
    let cz = car.z + Math.cos(yaw) * dist;
    const k = clipBoom(car.x, car.z, cx, cz);
    cx = car.x + (cx - car.x) * k;
    cz = car.z + (cz - car.z) * k;
    out.pos = (out.pos || new THREE.Vector3()).set(cx, Math.max(1.2, height * (k < 1 ? 1.15 : 1)), cz);
    const ahead = 3.5 + Math.max(0, car.speed) * 0.08;
    out.look = (out.look || new THREE.Vector3()).set(car.x + Math.sin(car.heading) * ahead, p.look, car.z + Math.cos(car.heading) * ahead);
    return out;
  }

  // Cinematic move from the current pose to the chase pose.
  swoopTo(car, duration = 2.6, onDone) {
    const from = this.camera.position.clone();
    const fromLook = this.look.clone();
    this.transition = { from, fromLook, t: 0, duration: this.reduced ? 0.01 : duration, car, onDone };
    this.mode = 'transition';
  }

  // The reverse: rise from wherever we are back to the skyline orbit behind the home screen.
  flyToOrbit(duration = 2.6, onDone) {
    const from = this.camera.position.clone();
    const fromLook = this.look.clone();
    this.orbitAngle = Math.atan2(from.x, from.z); // start orbiting from our side of the city
    this.showcase = null;
    this.viewShiftTarget = 0;
    this.yawOffset = this.pitchOffset = 0;
    this.transition = { from, fromLook, t: 0, duration: this.reduced ? 0.01 : duration, goal: () => this.orbitPose(this.clock), toMode: 'orbit', onDone };
    this.mode = 'transition';
  }

  orbitPose(t, out = {}) {
    const r = 430;
    out.pos = (out.pos || new THREE.Vector3()).set(Math.sin(this.orbitAngle) * r, 175 + Math.sin(t * 0.1) * 14, Math.cos(this.orbitAngle) * r);
    out.look = (out.look || new THREE.Vector3()).set(0, 55, 0);
    return out;
  }

  showLandmark(lm) {
    this.showcase = lm;
    this.mode = 'showcase';
  }

  endShowcase() {
    if (this.mode === 'showcase') this.mode = 'chase';
    this.showcase = null;
  }

  onDrag(dx, dy) {
    this.dragging = true;
    this.lastDrag = performance.now();
    this.yawOffset = clamp(this.yawOffset - dx * 0.006, -Math.PI, Math.PI);
    this.pitchOffset = clamp(this.pitchOffset + dy * 0.003, -0.15, 0.9);
  }

  onDragEnd() {
    this.dragging = false;
    this.lastDrag = performance.now();
  }

  onZoom(delta) {
    this.zoom = clamp(this.zoom * (1 + delta * 0.001), 0.6, 2.2);
  }

  bump(strength) {
    if (!this.reduced) this.shake = Math.min(1, this.shake + strength);
  }

  update(dt, t, car, { boosting = false, viewport } = {}) {
    const cam = this.camera;
    this.clock = t;
    let fovTarget = 58;

    if (this.mode === 'orbit') {
      this.orbitAngle += dt * (this.reduced ? 0.01 : 0.035);
      const o = this.orbitPose(t);
      this.pos.copy(o.pos);
      this.look.copy(o.look);
      fovTarget = 50;
      cam.position.copy(this.pos);
    } else if (this.mode === 'transition') {
      const tr = this.transition;
      tr.t += dt;
      const f = easeInOutCubic(clamp(tr.t / tr.duration, 0, 1));
      const goal = tr.goal ? tr.goal() : this.chaseTarget(tr.car);
      // arc through a high midpoint for a swooping feel
      const mid = goal.pos.clone().lerp(tr.from, 0.35);
      mid.y = Math.max(tr.from.y, goal.pos.y) * 0.6 + 20;
      const a = tr.from.clone().lerp(mid, f);
      const b = mid.clone().lerp(goal.pos, f);
      this.pos.copy(a.lerp(b, f));
      this.look.copy(tr.fromLook).lerp(goal.look, easeInOutCubic(clamp(f * 1.3, 0, 1)));
      cam.position.copy(this.pos);
      fovTarget = tr.toMode === 'orbit' ? 50 : 58;
      if (tr.t >= tr.duration) {
        this.mode = tr.toMode || 'chase';
        this.transition = null;
        tr.onDone?.();
      }
    } else if (this.mode === 'showcase' && this.showcase) {
      const lm = this.showcase;
      const sway = this.reduced ? 0 : Math.sin(t * 0.12) * 0.18;
      const off = lm.framePos.clone().sub(lm.frameTarget);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), sway);
      const goal = lm.frameTarget.clone().add(off);
      this.pos.x = damp(this.pos.x, goal.x, 2.4, dt);
      this.pos.y = damp(this.pos.y, goal.y, 2.4, dt);
      this.pos.z = damp(this.pos.z, goal.z, 2.4, dt);
      this.look.x = damp(this.look.x, lm.frameTarget.x, 3, dt);
      this.look.y = damp(this.look.y, lm.frameTarget.y, 3, dt);
      this.look.z = damp(this.look.z, lm.frameTarget.z, 3, dt);
      cam.position.copy(this.pos);
      fovTarget = 52;
    } else {
      // chase
      if (!this.dragging && performance.now() - this.lastDrag > 1400) {
        this.yawOffset = damp(this.yawOffset, 0, 2.2, dt);
        this.pitchOffset = damp(this.pitchOffset, 0, 2.2, dt);
      }
      const goal = this.chaseTarget(car);
      const k = this.dragging ? 14 : 9.5;
      this.pos.x = damp(this.pos.x, goal.pos.x, k, dt);
      this.pos.y = damp(this.pos.y, goal.pos.y, k * 0.7, dt);
      this.pos.z = damp(this.pos.z, goal.pos.z, k, dt);
      this.look.x = damp(this.look.x, goal.look.x, 12, dt);
      this.look.y = damp(this.look.y, goal.look.y, 12, dt);
      this.look.z = damp(this.look.z, goal.look.z, 12, dt);
      cam.position.copy(this.pos);
      if (!this.reduced) fovTarget = 58 + clamp(Math.abs(car.speed) / 70, 0, 1) * 9 + (boosting ? 7 : 0);
    }

    if (this.shake > 0) {
      const s = this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    cam.lookAt(this.look);
    this.fov = damp(this.fov, fovTarget, 3, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }

    // shift the frame left while the side panel is open
    this.viewShift = damp(this.viewShift, this.viewShiftTarget, 5, dt);
    if (viewport) {
      if (Math.abs(this.viewShift) > 0.5) cam.setViewOffset(viewport.w, viewport.h, this.viewShift, 0, viewport.w, viewport.h);
      else if (cam.view?.enabled) cam.clearViewOffset();
    }
  }
}
