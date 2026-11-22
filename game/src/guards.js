// guards.js — the patrol brain. A guard walks its route, pauses to look around
// at each waypoint, and reacts to noise: a sprint nearby, a dashed footstep, a
// decoy thrown across the room. While it is investigating it turns toward the
// disturbance, which is the moment its cone swings off your lane.

import { GUARD } from './config.js';
import { angleDiff, angleToward, clamp, dist, hasSight } from './geometry.js';

export class Guard {
  constructor(spec, index) {
    this.x = spec.x;
    this.y = spec.y;
    this.radius = GUARD.radius;
    this.facing = spec.facing ?? 0;
    this.path = spec.path.map(([x, y]) => ({ x, y }));
    this.waypoint = 0;
    this.wait = 0;
    this.index = index;
    this.state = 'patrol';
    this.investigate = 0;
    this.investigateAt = { x: this.x, y: this.y };
    this.alert = 0;
    this.sweepPhase = index * 1.7;
  }

  // Vision cone in world terms, used by the renderer and the alarm system.
  cone() {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      halfAngle: GUARD.coneHalfAngle,
      range: GUARD.coneRange,
    };
  }

  // A noise at (x,y) with a radius; a guard inside it turns to look.
  hearNoise(x, y, radius, blockers) {
    if (this.state === 'alert') return;
    const d = dist(this.x, this.y, x, y);
    if (d > radius) return;
    if (!hasSight(this.x, this.y, x, y, blockers)) return;
    this.investigate = GUARD.investigateSeconds;
    this.investigateAt = { x, y };
    this.state = 'investigate';
  }

  sees(px, py, blockers) {
    const d = dist(this.x, this.y, px, py);
    if (d > GUARD.coneRange) return false;
    if (Math.abs(angleDiff(Math.atan2(py - this.y, px - this.x), this.facing)) > GUARD.coneHalfAngle) return false;
    return hasSight(this.x, this.y, px, py, blockers);
  }

  update(dt, blockers, thief) {
    const target = this.path[this.waypoint];
    let speed = GUARD.speed;
    let desired = this.facing;

    if (this.state === 'investigate') {
      this.investigate -= dt;
      desired = Math.atan2(this.investigateAt.y - this.y, this.investigateAt.x - this.x);
      // Sweep the head while looking, so the cone keeps moving.
      desired += Math.sin(performance.now() / 220 + this.sweepPhase) * 0.42;
      if (this.investigate <= 0) this.state = 'patrol';
    } else if (this.state === 'alert') {
      speed = GUARD.alertSpeed;
      desired = Math.atan2(thief.y - this.y, thief.x - this.x);
      this.alert -= dt;
      if (this.alert <= 0) this.state = 'patrol';
    } else {
      const d = dist(this.x, this.y, target.x, target.y);
      if (d < 6) {
        this.wait += dt;
        // Look around at the waypoint before moving on.
        desired = Math.atan2(target.y - this.y, target.x - this.x) + Math.sin(this.wait * 1.6) * 1.15;
        if (this.wait >= GUARD.pauseAtWaypoint) {
          this.wait = 0;
          this.waypoint = (this.waypoint + 1) % this.path.length;
        }
        speed = 0;
      } else {
        desired = Math.atan2(target.y - this.y, target.x - this.x);
        this.x += Math.cos(desired) * speed * dt;
        this.y += Math.sin(desired) * speed * dt;
      }
    }

    if (this.state === 'alert') {
      const d = dist(this.x, this.y, thief.x, thief.y);
      if (d > 40) {
        this.x += Math.cos(desired) * speed * dt;
        this.y += Math.sin(desired) * speed * dt;
      }
    }

    this.facing = angleToward(this.facing, desired, GUARD.turnRate * dt);
  }

  // Keep the guard out of the walls it shares with the player.
  confine(walls) {
    for (const w of walls) {
      const nx = clamp(this.x, w.x, w.x + w.w);
      const ny = clamp(this.y, w.y, w.y + w.h);
      const dx = this.x - nx;
      const dy = this.y - ny;
      const d = Math.hypot(dx, dy);
      if (d >= this.radius || d === 0) continue;
      this.x += (dx / d) * (this.radius - d);
      this.y += (dy / d) * (this.radius - d);
    }
  }
}
