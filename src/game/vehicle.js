import { clamp, lerp } from '../core/util.js';
import { resolveCircle } from './collision.js';

// Arcade car physics: bicycle-model steering, grip-based lateral friction (handbrake drifts),
// afterburner boost with a recharging tank, and two-circle collision against the city.

const STEP = 1 / 120;
const WHEELBASE = 3.7;
const MAX_SPEED = 46; // ≈165 km/h
const BOOST_SPEED = 70; // ≈250 km/h
const MAX_REVERSE = 15;

export class Vehicle {
  constructor(x = 0, z = 0, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0; // wheel angle (rad), +right
    this.speed = 0; // signed forward speed
    this.accel = 0;
    this.lateral = 0;
    this.boostTank = 1;
    this.boosting = false;
    this.braking = false;
    this.impact = 0;
    this._acc = 0;
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = this.speed = this.steer = 0;
  }

  update(input, dt, obstacles = []) {
    this._acc += Math.min(dt, 0.1);
    const before = this.speed;
    this.impact = 0;
    while (this._acc >= STEP) {
      this._acc -= STEP;
      this.step(input, STEP, obstacles);
    }
    this.accel = (this.speed - before) / Math.max(dt, 1e-3);
  }

  step(inp, h, obstacles) {
    let fx = Math.sin(this.heading);
    let fz = Math.cos(this.heading);
    let rx = -fz;
    let rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;
    const t = inp.throttle;
    const abs = Math.abs(vf);

    // boost tank
    this.boosting = !!inp.boost && this.boostTank > 0.02 && t >= 0;
    this.boostTank = clamp(this.boostTank + (this.boosting ? -0.26 : 0.12) * h, 0, 1);
    const vmax = this.boosting ? BOOST_SPEED : MAX_SPEED;

    this.braking = false;
    if (t > 0.02) {
      if (vf < -0.5) {
        vf += 40 * t * h;
        this.braking = true;
      } else {
        const a = (this.boosting ? 46 : 24) * (1 - Math.pow(Math.min(1, Math.max(0, vf) / vmax), 2));
        vf += a * t * h;
      }
    } else if (t < -0.02) {
      if (vf > 0.5) {
        vf -= 52 * -t * h;
        this.braking = true;
      } else {
        vf = Math.max(vf - 16 * -t * h, -MAX_REVERSE);
      }
    } else {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 5 * h);
    }
    if (this.boosting && t <= 0.02) vf += 18 * h;
    if (vf > vmax) vf = Math.max(vmax, vf - 22 * h);
    vf -= vf * 0.05 * h;
    if (inp.handbrake) {
      vf -= vf * 0.8 * h;
      this.braking = true;
    }

    this.vx = fx * vf + rx * vr;
    this.vz = fz * vf + rz * vr;

    // steering (bicycle model)
    const maxSteer = lerp(0.6, 0.16, clamp(abs / 52, 0, 1));
    const target = clamp(inp.steer, -1, 1) * maxSteer;
    const rate = Math.abs(target) < Math.abs(this.steer) ? 5 : 3.2;
    this.steer += clamp(target - this.steer, -rate * h, rate * h);
    let yaw = (vf / WHEELBASE) * Math.tan(this.steer);
    if (inp.handbrake) yaw *= 1.45;
    this.heading -= yaw * h;
    this.lateral = yaw * vf;

    // re-project velocity on the new heading, then apply lateral grip
    fx = Math.sin(this.heading);
    fz = Math.cos(this.heading);
    rx = -fz;
    rz = fx;
    vf = this.vx * fx + this.vz * fz;
    vr = this.vx * rx + this.vz * rz;
    const grip = inp.handbrake ? 1.5 : 9;
    vr *= Math.exp(-grip * h);
    this.vx = fx * vf + rx * vr;
    this.vz = fz * vf + rz * vr;
    this.speed = vf;
    this.drift = Math.abs(vr);

    this.x += this.vx * h;
    this.z += this.vz * h;
    this.collide(obstacles);
  }

  collide(obstacles) {
    const [fx, fz] = this.forward;
    let pushX = 0;
    let pushZ = 0;
    let normal = null;
    for (const off of [1.7, -1.6]) {
      const p = { x: this.x + fx * off, z: this.z + fz * off };
      const ox = p.x;
      const oz = p.z;
      let n = resolveCircle(p, 1.45);
      for (const o of obstacles) {
        const dx = p.x - o.x;
        const dz = p.z - o.z;
        const d = Math.hypot(dx, dz);
        const min = 1.45 + (o.r ?? 2.1);
        if (d < min && d > 1e-4) {
          p.x += (dx / d) * (min - d);
          p.z += (dz / d) * (min - d);
          n = { x: dx / d, z: dz / d };
        }
      }
      if (n) {
        pushX += p.x - ox;
        pushZ += p.z - oz;
        normal = n;
      }
    }
    if (!normal) return;
    this.x += pushX;
    this.z += pushZ;
    const vn = this.vx * normal.x + this.vz * normal.z;
    if (vn < 0) {
      this.impact = Math.max(this.impact, -vn);
      this.vx -= normal.x * vn * 1.25;
      this.vz -= normal.z * vn * 1.25;
      this.vx *= 0.93;
      this.vz *= 0.93;
    }
  }
}
