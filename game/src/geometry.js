// geometry.js — the small set of vector and visibility helpers the rest of the
// game shares. Sight is tested against axis-aligned blockers, which is what
// walls, crates, pillars and smoke clouds all are.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

// Shortest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Rotate `from` toward `to` by at most `step` radians.
export function angleToward(from, to, step) {
  const d = angleDiff(to, from);
  if (Math.abs(d) <= step) return to;
  return from + Math.sign(d) * step;
}

// True when the segment (x1,y1)-(x2,y2) crosses the rectangle r. Slab method:
// no sampling, so a thin wall can never be stepped over.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;

  for (const axis of [0, 1]) {
    const p = axis === 0 ? x1 : y1;
    const d = axis === 0 ? dx : dy;
    const lo = axis === 0 ? r.x : r.y;
    const hi = axis === 0 ? r.x + r.w : r.y + r.h;

    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let t1 = (lo - p) / d;
    let t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Line of sight between two points, blocked by any rect in `blockers`.
export function hasSight(ax, ay, bx, by, blockers) {
  for (const b of blockers) {
    if (b.off) continue;
    if (segmentHitsRect(ax, ay, bx, by, b)) return false;
  }
  return true;
}

// Is (px,py) inside the circle-sector that a watcher sweeps?
export function insideWedge(px, py, wx, wy, facing, halfAngle, range) {
  const d2 = dist2(px, py, wx, wy);
  if (d2 > range * range) return false;
  const a = Math.atan2(py - wy, px - wx);
  return Math.abs(angleDiff(a, facing)) <= halfAngle;
}

// Does the circle (cx,cy,r) overlap the rect?
export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) <= r * r;
}

// Circle vs circle overlap, used for pickups and smoke.
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const rr = ar + br;
  return dist2(ax, ay, bx, by) <= rr * rr;
}

// Push a circle out of any wall it has entered, so movement can never tunnel.
export function resolveWalls(entity, walls) {
  for (const w of walls) {
    if (!circleHitsRect(entity.x, entity.y, entity.radius, w)) continue;
    const nx = clamp(entity.x, w.x, w.x + w.w);
    const ny = clamp(entity.y, w.y, w.y + w.h);
    let dx = entity.x - nx;
    let dy = entity.y - ny;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      // Dead centre: shove out along the shortest axis.
      const left = entity.x - w.x;
      const right = w.x + w.w - entity.x;
      const up = entity.y - w.y;
      const down = w.y + w.h - entity.y;
      const m = Math.min(left, right, up, down);
      if (m === left) entity.x = w.x - entity.radius;
      else if (m === right) entity.x = w.x + w.w + entity.radius;
      else if (m === up) entity.y = w.y - entity.radius;
      else entity.y = w.y + w.h + entity.radius;
      continue;
    }
    dx /= d;
    dy /= d;
    const push = entity.radius - d;
    entity.x += dx * push;
    entity.y += dy * push;
  }
}
