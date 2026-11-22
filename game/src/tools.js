// tools.js — the three things you can spend to buy a moment. Smoke blinds the
// cone that crosses it, EMP drops a camera for a few seconds, and a decoy makes
// the nearest guard walk off to investigate. Each costs one of three charges,
// so a room is a budgeting problem, not a coin flip.

import { TOOLS } from './config.js';
import { circlesOverlap } from './geometry.js';

export class ToolBelt {
  constructor() {
    this.charges = {
      smoke: TOOLS.smoke.charges,
      emp: TOOLS.emp.charges,
      decoy: TOOLS.decoy.charges,
    };
    this.active = [];
    this.used = 0;
  }

  reset() {
    this.charges = {
      smoke: TOOLS.smoke.charges,
      emp: TOOLS.emp.charges,
      decoy: TOOLS.decoy.charges,
    };
    this.active = [];
    this.used = 0;
  }

  available(kind) {
    return this.charges[kind] > 0;
  }

  // Drop a tool at the thief's feet. Returns a short description or null.
  use(kind, thief, world) {
    if (this.charges[kind] <= 0) return null;
    this.charges[kind] -= 1;
    this.used += 1;

    if (kind === 'smoke') {
      this.active.push({
        kind: 'smoke',
        x: thief.x,
        y: thief.y,
        r: TOOLS.smoke.radius,
        life: TOOLS.smoke.seconds,
        maxLife: TOOLS.smoke.seconds,
      });
      return 'Smoke out — cones crossing it go blind.';
    }

    if (kind === 'emp') {
      for (const cam of world.cameras) {
        cam.disabled = TOOLS.emp.seconds;
      }
      this.active.push({
        kind: 'emp',
        x: thief.x,
        y: thief.y,
        r: 260,
        life: TOOLS.emp.seconds,
        maxLife: TOOLS.emp.seconds,
        ring: true,
      });
      return 'EMP pulse — every camera in the room is dark.';
    }

    if (kind === 'decoy') {
      let best = null;
      let bestD = Infinity;
      for (const g of world.guards) {
        const d = (g.x - thief.x) ** 2 + (g.y - thief.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      const spot = { x: thief.x + Math.cos(thief.facing) * TOOLS.decoy.radius, y: thief.y + Math.sin(thief.facing) * TOOLS.decoy.radius };
      spot.x = Math.max(40, Math.min(world.level.w - 40, spot.x));
      spot.y = Math.max(40, Math.min(world.level.h - 40, spot.y));
      if (best) best.hearNoise(spot.x, spot.y, Infinity, []);
      this.active.push({
        kind: 'decoy',
        x: spot.x,
        y: spot.y,
        r: 26,
        life: TOOLS.decoy.seconds,
        maxLife: TOOLS.decoy.seconds,
      });
      return 'Decoy thrown — a guard is going to look.';
    }
    return null;
  }

  // Blockers that only exist while a smoke cloud is alive.
  smokeBlockers() {
    return this.active
      .filter((a) => a.kind === 'smoke')
      .map((s) => ({ x: s.x - s.r * 0.55, y: s.y - s.r * 0.55, w: s.r * 1.1, h: s.r * 1.1, off: false, smoke: true }));
  }

  inSmoke(x, y) {
    return this.active.some((a) => a.kind === 'smoke' && circlesOverlap(x, y, 4, a.x, a.y, a.r * 0.8));
  }

  update(dt) {
    for (const a of this.active) a.life -= dt;
    this.active = this.active.filter((a) => a.life > 0);
  }
}
