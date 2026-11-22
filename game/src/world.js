// world.js — assembles one room from its level data and advances it. The world
// owns the walls, the watchers, the loot and the alarm, and answers the one
// question the rest of the game asks: what can see the thief right now?

import { ALARM, GUARD, CAMERA } from './config.js';
import { Guard } from './guards.js';
import { Camera } from './cameras.js';
import { Alarm } from './alarm.js';
import { ToolBelt } from './tools.js';
import { dist, hasSight, circlesOverlap } from './geometry.js';

export class World {
  constructor(level, levelIndex) {
    this.level = level;
    this.levelIndex = levelIndex;
    this.walls = level.walls.map((w) => ({ ...w }));
    this.cover = level.cover.map((c) => ({ ...c }));
    this.guards = level.guards.map((g, i) => new Guard(g, i));
    this.cameras = level.cameras.map((c, i) => new Camera(c, i));
    this.loot = level.loot.map((l, i) => ({ ...l, taken: false, id: `${levelIndex}-${i}`, pulse: i * 1.3 }));
    this.alarm = new Alarm();
    this.tools = new ToolBelt();
    this.elapsed = 0;
    this.caught = false;
    this.caughtReason = '';
    this.freezes = 0;
  }

  // Walls plus cover plus live smoke: the complete blocker set for sight.
  blockers() {
    return [...this.walls, ...this.cover, ...this.tools.smokeBlockers()];
  }

  // Which watchers have the thief in view, and how hard each one pushes.
  exposure(thief) {
    const results = [];
    if (this.tools.inSmoke(thief.x, thief.y)) return results;
    const block = this.blockers();

    for (const g of this.guards) {
      if (g.sees(thief.x, thief.y, block)) {
        results.push({ rate: ALARM.guardRate, source: 'guard', who: g.index });
      }
    }
    for (const c of this.cameras) {
      if (c.sees(thief.x, thief.y, block)) {
        results.push({ rate: ALARM.cameraRate, source: 'camera', who: c.index });
      }
    }
    return results;
  }

  update(dt, thief) {
    this.elapsed += dt;
    this.tools.update(dt);

    for (const g of this.guards) {
      g.update(dt, this.blockers(), thief);
      g.confine(this.walls);
    }
    for (const c of this.cameras) c.update(dt);

    // Sprinting and dashing are heard; standing still is not.
    const n = thief.noise();
    if (n.radius > 0) {
      for (const g of this.guards) g.hearNoise(thief.x, thief.y, n.radius, this.blockers());
    }

    const exposure = this.exposure(thief);
    const tripped = this.alarm.update(dt, exposure, n.loud);

    if (exposure.length) {
      // Being seen also pulls a guard toward you: the room closes in.
      for (const e of exposure) {
        if (e.source === 'guard') {
          const g = this.guards[e.who];
          if (g.state !== 'alert') {
            g.state = 'alert';
            g.alert = ALARM.spottedFreeze;
          }
        }
      }
      this.freezes = ALARM.spottedFreeze;
    } else if (this.freezes > 0) {
      this.freezes -= dt;
    }

    // Loot pickups: walk over it to take it. Taking it rings the bell.
    for (const l of this.loot) {
      if (l.taken) continue;
      if (circlesOverlap(thief.x, thief.y, thief.radius, l.x, l.y, 15)) {
        l.taken = true;
        thief.loot.push(l);
        thief.carryValue += l.value;
        this.alarm.bump(l.name);
      }
    }

    if (tripped) {
      this.caught = true;
      this.caughtReason = 'The alarm peaked — the floor went dark and the doors sealed.';
      return true;
    }
    return false;
  }

  // Everything of value already in hand?
  get lootTaken() {
    return this.loot.filter((l) => l.taken).length;
  }

  get lootTotal() {
    return this.loot.length;
  }

  get lootValue() {
    return this.loot.filter((l) => l.taken).reduce((s, l) => s + l.value, 0);
  }

  get totalValue() {
    return this.loot.reduce((s, l) => s + l.value, 0);
  }

  atExit(thief) {
    const e = this.level.exit;
    return thief.x > e.x && thief.x < e.x + e.w && thief.y > e.y && thief.y < e.y + e.h;
  }

  // Cone arcs, pre-clipped to the first wall they hit. Done once per frame per
  // watcher so the flood-fill look of the light stays cheap and crisp.
  conePolygons() {
    const out = [];
    const block = this.blockers();

    const cast = (from, facing, half, range, steps) => {
      const pts = [{ x: from.x, y: from.y }];
      for (let i = 0; i <= steps; i += 1) {
        const a = facing - half + (half * 2 * i) / steps;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        let reach = range;
        for (const b of block) {
          // Walk the ray in coarse steps, then refine: cheap and stable.
          for (let t = 12; t < reach; t += 9) {
            const px = from.x + dx * t;
            const py = from.y + dy * t;
            if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) {
              reach = t;
              break;
            }
          }
        }
        pts.push({ x: from.x + dx * reach, y: from.y + dy * reach });
      }
      return pts;
    };

    for (const g of this.guards) {
      const c = g.cone();
      out.push({ kind: 'guard', who: g.index, points: cast(c, c.facing, c.halfAngle, c.range, 22), alert: g.state !== 'patrol' });
    }
    for (const cam of this.cameras) {
      const c = cam.cone();
      if (c.dead) continue;
      out.push({ kind: 'camera', who: cam.index, points: cast(c, c.facing, c.halfAngle, c.range, 16), alert: false });
    }
    return out;
  }
}
