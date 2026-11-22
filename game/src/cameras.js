// cameras.js — wall-mounted cameras that sweep a wedge back and forth on a
// fixed period. They are the second watcher type: slower to notice, but their
// arc covers the routes the guards walk away from.

import { CAMERA } from './config.js';
import { angleDiff, clamp, dist, hasSight } from './geometry.js';

export class Camera {
  constructor(spec, index) {
    this.x = spec.x;
    this.y = spec.y;
    this.base = spec.base ?? 0;
    this.index = index;
    this.phase = index * (CAMERA.sweepPeriod / 2.4);
    this.disabled = 0;
    this.facing = this.base;
  }

  update(dt) {
    if (this.disabled > 0) this.disabled -= dt;
    const t = performance.now() / 1000 + this.phase;
    this.facing = this.base + Math.sin((t / CAMERA.sweepPeriod) * Math.PI * 2) * CAMERA.sweepHalf;
  }

  cone() {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      halfAngle: CAMERA.halfAngle,
      range: CAMERA.range,
      dead: this.disabled > 0,
    };
  }

  sees(px, py, blockers) {
    if (this.disabled > 0) return false;
    const d = dist(this.x, this.y, px, py);
    if (d > CAMERA.range) return false;
    if (Math.abs(angleDiff(Math.atan2(py - this.y, px - this.x), this.facing)) > CAMERA.halfAngle) return false;
    return hasSight(this.x, this.y, px, py, blockers);
  }

  // Pull a camera back inside the room so it never renders off-world.
  confine() {
    this.x = clamp(this.x, 24, 1256);
    this.y = clamp(this.y, 24, 696);
  }
}
