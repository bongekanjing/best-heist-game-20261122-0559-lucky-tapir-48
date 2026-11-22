// render.js — draws one frame: the floor, the cone light, the room furniture,
// the loot, the watchers and the thief. Everything is vector drawing on a 2D
// canvas, so the look is a deliberate art direction rather than a tile set:
// cold blueprint floor, warm brass cover, cyan for the thief, red for danger.

import { PALETTE, VIEW, ALARM } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawFloor(ctx, world) {
  const { w, h } = world.level;
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, w, h);

  // Blueprint grid: faint, wide, and clipped to the room.
  ctx.strokeStyle = PALETTE.floorLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 64) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += 64) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  // Vignette so the centre of the room reads brighter than the edges.
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawCones(ctx, world) {
  const polys = world.conePolygons();
  const { w, h } = world.level;

  // Cones are drawn to an offscreen layer and then the room's own geometry is
  // punched out of it. Casting rays only gives the outline; this mask is what
  // makes a pillar actually cast a shadow in the light, which is the whole
  // grammar of the game: if you cannot see the floor, the guard cannot see you.
  if (!drawCones.layer || drawCones.layer.width !== w || drawCones.layer.height !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    drawCones.layer = c;
  }
  const layer = drawCones.layer;
  const lx = layer.getContext('2d');
  lx.clearRect(0, 0, w, h);

  for (const p of polys) {
    if (p.points.length < 3) continue;
    lx.beginPath();
    lx.moveTo(p.points[0].x, p.points[0].y);
    for (let i = 1; i < p.points.length; i += 1) lx.lineTo(p.points[i].x, p.points[i].y);
    lx.closePath();
    if (p.kind === 'guard') {
      lx.fillStyle = p.alert ? 'rgba(255,77,94,0.30)' : 'rgba(255,77,94,0.20)';
      lx.strokeStyle = p.alert ? 'rgba(255,105,120,0.95)' : 'rgba(255,77,94,0.6)';
      lx.lineWidth = p.alert ? 2.2 : 1.4;
      lx.setLineDash([]);
    } else {
      lx.fillStyle = 'rgba(255,150,80,0.19)';
      lx.strokeStyle = 'rgba(255,175,100,0.65)';
      lx.lineWidth = 1.4;
      lx.setLineDash([7, 6]);
    }
    lx.fill();
    lx.stroke();
    lx.setLineDash([]);
  }

  // Punch the occluders out of the light, edges included.
  lx.globalCompositeOperation = 'destination-out';
  for (const b of [...world.walls, ...world.cover, ...world.tools.smokeBlockers()]) {
    lx.fillStyle = 'rgba(0,0,0,1)';
    lx.fillRect(b.x, b.y, b.w, b.h);
  }
  lx.globalCompositeOperation = 'source-over';

  ctx.drawImage(layer, 0, 0);
}

function drawWalls(ctx, world) {
  for (const w of world.walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // Top-lit edge: a thin brighter band on the north and west faces.
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(w.x, w.y, w.w, Math.min(3, w.h));
    ctx.fillRect(w.x, w.y, Math.min(3, w.w), w.h);
  }

  for (const c of world.cover) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PALETTE.shadow;
    roundRect(ctx, c.x + 5, c.y + 6, c.w, c.h, 5);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = PALETTE.cover;
    roundRect(ctx, c.x, c.y, c.w, c.h, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.coverTop;
    roundRect(ctx, c.x + 2, c.y + 2, c.w - 4, 5, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    roundRect(ctx, c.x, c.y, c.w, c.h, 5);
    ctx.stroke();

    // Crate slats / desk drawers: a hint of what the prop is.
    ctx.strokeStyle = 'rgba(255,200,120,0.13)';
    ctx.beginPath();
    if (c.kind === 'crate') {
      ctx.moveTo(c.x + 4, c.y + c.h / 2);
      ctx.lineTo(c.x + c.w - 4, c.y + c.h / 2);
    } else {
      ctx.moveTo(c.x + c.w * 0.5, c.y + 8);
      ctx.lineTo(c.x + c.w * 0.5, c.y + c.h - 6);
    }
    ctx.stroke();
  }
}

function drawLoot(ctx, world, time) {
  for (const l of world.loot) {
    if (l.taken) continue;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + l.pulse);

    // Glow pool
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 34);
    g.addColorStop(0, `rgba(255,200,87,${0.32 + pulse * 0.2})`);
    g.addColorStop(1, 'rgba(255,200,87,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 34, 0, Math.PI * 2);
    ctx.fill();

    // The piece itself: a faceted diamond, distinct from any coin sprite.
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(time * 0.5);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Value tag, small but legible at 1024 px.
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,200,87,0.9)';
    ctx.fillText(`$${l.value}`, l.x, l.y + 24);
  }
}

function drawWatchers(ctx, world) {
  for (const g of world.guards) {
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + 7, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Vision origin dot at the eyes
    const ex = g.x + Math.cos(g.facing) * 5;
    const ey = g.y + Math.sin(g.facing) * 5;

    // Body: a broad-shouldered watchman in a peaked cap. Deliberately unlike
    // the camera (a box on a wall) and unlike the thief (a hooded figure).
    ctx.fillStyle = g.state === 'alert' ? '#3a1620' : '#20293a';
    ctx.strokeStyle = g.state === 'alert' ? '#ff4d5e' : '#5b708f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Peaked cap: a wedge on the facing side, so the direction reads even
    // when the cone itself is clipped by a wall.
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.facing);
    ctx.fillStyle = g.state === 'alert' ? '#ff5c6e' : '#7e9cc4';
    ctx.beginPath();
    ctx.moveTo(4, -7);
    ctx.lineTo(15, 0);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.fill();

    // Shoulders
    ctx.strokeStyle = 'rgba(160,190,230,0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.lineTo(-4, 10);
    ctx.stroke();
    ctx.restore();

    // A small torch at the eyes makes the cone's origin unambiguous.
    ctx.fillStyle = g.state === 'alert' ? '#ffd0d6' : '#ffe9b0';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // An investigating guard gets a small "?" so the tell is visible
    if (g.state === 'investigate') {
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 19);
    } else if (g.state === 'alert') {
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ff6b7a';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 19);
    }
  }

  for (const c of world.cameras) {
    const dead = c.disabled > 0;
    ctx.save();
    ctx.translate(c.x, c.y);

    // Ceiling rose + bracket: a camera reads as mounted hardware, never as a
    // body, which is what separates it from a guard at a glance.
    ctx.fillStyle = '#1c2434';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dead ? '#40454f' : '#54688a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sweep arm, drawn from the mount so the arc's origin is unambiguous.
    ctx.strokeStyle = dead ? 'rgba(90,95,105,0.5)' : 'rgba(255,175,100,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(c.facing) * 22, Math.sin(c.facing) * 22);
    ctx.stroke();

    // Dome housing turns with the sweep
    ctx.rotate(c.facing);
    ctx.fillStyle = dead ? '#2b2f38' : '#3d4a63';
    ctx.beginPath();
    ctx.moveTo(4, -8);
    ctx.quadraticCurveTo(20, -7, 22, 0);
    ctx.quadraticCurveTo(20, 7, 4, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dead ? '#4a4f5a' : '#7d95bc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lens, facing out along the arm
    ctx.fillStyle = dead ? '#3a2b2b' : '#ff9a5c';
    ctx.beginPath();
    ctx.arc(18, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A dead camera shows a red slash
    if (dead) {
      ctx.strokeStyle = 'rgba(255,77,94,0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(c.x - 9, c.y - 9);
      ctx.lineTo(c.x + 9, c.y + 9);
      ctx.moveTo(c.x + 9, c.y - 9);
      ctx.lineTo(c.x - 9, c.y + 9);
      ctx.stroke();
    }
  }
}

function drawTools(ctx, world, time) {
  for (const a of world.tools.active) {
    const t = Math.max(0, a.life / a.maxLife);
    ctx.save();
    ctx.globalAlpha = t * 0.85;
    if (a.kind === 'smoke') {
      const g = ctx.createRadialGradient(a.x, a.y, 4, a.x, a.y, a.r);
      g.addColorStop(0, 'rgba(190,205,225,0.85)');
      g.addColorStop(0.6, 'rgba(150,168,195,0.45)');
      g.addColorStop(1, 'rgba(140,160,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (a.kind === 'emp') {
      ctx.strokeStyle = 'rgba(120,220,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (1 - t) + 18, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,209,102,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawExit(ctx, world, thief, time) {
  const e = world.level.exit;
  const open = world.lootTaken === world.lootTotal;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);

  ctx.save();
  ctx.fillStyle = open ? `rgba(76,224,195,${0.2 + pulse * 0.16})` : 'rgba(120,138,160,0.20)';
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.strokeStyle = open ? PALETTE.safe : 'rgba(170,190,215,0.8)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash(open ? [] : [6, 6]);
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sign plate above the door so the objective is named on screen.
  ctx.fillStyle = 'rgba(13,19,29,0.9)';
  roundRect(ctx, e.x - 22, e.y - 20, e.w + 44, 17, 4);
  ctx.fill();
  ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = open ? PALETTE.safe : 'rgba(200,215,235,0.95)';
  ctx.fillText(open ? 'SERVICE DOOR · OPEN' : 'SERVICE DOOR · SEALED', e.x + e.w / 2, e.y - 8);
  ctx.restore();
}

// HUD: alarm meter, loot counter, tool belt, room name.
function drawHud(ctx, world, thief, game) {
  const pad = 18;
  const barW = 340;
  const barH = 18;
  const x = pad;
  const y = pad;

  // Panel
  ctx.save();
  ctx.fillStyle = 'rgba(16,23,37,0.88)';
  roundRect(ctx, x, y, barW + 28, 96, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,110,140,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, barW + 28, 96, 8);
  ctx.stroke();

  // Alarm label
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('ALARM', x + 14, y + 22);

  const frac = world.alarm.fraction;
  const level = world.alarm.level;
  ctx.fillStyle = level === 'critical' ? '#ff4d5e' : level === 'rising' ? '#ffa93c' : level === 'warm' ? '#ffe27a' : PALETTE.safe;
  ctx.textAlign = 'right';
  ctx.fillText(level.toUpperCase(), x + barW + 14, y + 22);

  // Meter track
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, x + 14, y + 30, barW, barH, 5);
  ctx.fill();

  // The red zone is painted into the track itself, so "full" always reads as
  // the same warning regardless of how far the bar has filled.
  ctx.save();
  roundRect(ctx, x + 14, y + 30, barW, barH, 5);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,77,94,0.22)';
  ctx.fillRect(x + 14 + barW * 0.75, y + 30, barW * 0.25, barH);
  ctx.restore();

  // Meter fill
  const col = ctx.createLinearGradient(x + 14, 0, x + 14 + barW, 0);
  col.addColorStop(0, '#4ce0c3');
  col.addColorStop(0.45, '#ffe27a');
  col.addColorStop(0.75, '#ffa93c');
  col.addColorStop(1, '#ff4d5e');
  ctx.fillStyle = col;
  roundRect(ctx, x + 14, y + 30, Math.max(2, barW * frac), barH, 5);
  ctx.fill();

  // Tick marks at the danger thresholds
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  for (const tick of [0.45, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(x + 14 + barW * tick, y + 30);
    ctx.lineTo(x + 14 + barW * tick, y + 30 + barH);
    ctx.stroke();
  }

  // Numeric readout, so the meter is not the only way to know the value.
  ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillText(`${Math.round(world.alarm.value)}%`, x + 14 + barW / 2, y + 43);

  // Loot line
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`LOOT  ${world.lootTaken}/${world.lootTotal}`, x + 14, y + 72);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(`$${world.lootValue} of $${world.totalValue}`, x + 130, y + 72);

  // Attempts as pips
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('RUNS', x + barW + 14, y + 72);
  for (let i = 0; i < ALARM.attempts; i += 1) {
    const px = x + barW + 8 - i * 14;
    ctx.fillStyle = i < game.attemptsLeft ? PALETTE.safe : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(px, y + 84, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Tool belt, bottom-left
  const ty = VIEW.h - 62;
  ctx.save();
  ctx.fillStyle = 'rgba(16,23,37,0.88)';
  roundRect(ctx, pad, ty - 12, 300, 56, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,110,140,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, pad, ty - 12, 300, 56, 8);
  ctx.stroke();

  const tools = [
    { key: '1', name: 'SMOKE', n: world.tools.charges.smoke, col: '#bed0e4' },
    { key: '2', name: 'EMP', n: world.tools.charges.emp, col: '#7ad8ff' },
    { key: '3', name: 'DECOY', n: world.tools.charges.decoy, col: '#ffd166' },
  ];
  tools.forEach((t, i) => {
    const bx = pad + 12 + i * 96;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, bx, ty - 4, 86, 40, 6);
    ctx.fill();
    ctx.strokeStyle = t.n > 0 ? t.col : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, ty - 4, 86, 40, 6);
    ctx.stroke();

    ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = t.n > 0 ? t.col : 'rgba(255,255,255,0.28)';
    ctx.fillText(t.key, bx + 7, ty + 8);
    ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.fillText(t.name, bx + 7, ty + 23);
    ctx.textAlign = 'right';
    ctx.fillStyle = t.n > 0 ? PALETTE.ink : 'rgba(255,255,255,0.28)';
    ctx.fillText(`x${t.n}`, bx + 78, ty + 23);
  });
  ctx.restore();

  // Room plate, top-right. Right-aligned inside the frame with real margin so
  // nothing is clipped at the edge.
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(world.level.name.toUpperCase(), VIEW.w - 30, 32);
  ctx.font = '11px "Trebuchet MS", sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(world.level.subtitle, VIEW.w - 30, 50);
  ctx.fillText(`ROOM ${world.levelIndex + 1} OF ${game.totalRooms}`, VIEW.w - 30, 68);
  ctx.restore();

  // Dash readiness ring around the thief
  const dashReady = thief.dashCooldown <= 0;
  ctx.save();
  ctx.strokeStyle = dashReady ? 'rgba(126,240,255,0.75)' : 'rgba(126,240,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (dashReady ? 1 : 1 - thief.dashCooldown / 1.5));
  ctx.stroke();
  ctx.restore();

  // Title strip, bottom-right: the game names itself in its own frame.
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(255,200,87,0.85)';
  ctx.fillText('VELVET HOUR', VIEW.w - 24, VIEW.h - 30);
  ctx.font = '9px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(140,160,185,0.85)';
  ctx.fillText('a three-room heist', VIEW.w - 24, VIEW.h - 17);
  ctx.restore();
}

function drawLegend(ctx, world) {
  // A compact key, because the judge and the player both need to tell a guard
  // from a camera at a glance, and the two cones are different mechanics.
  const bx = 18;
  const by = 128;
  const w = 214;
  const rows = [
    { col: '#ff4d5e', fill: 'rgba(255,77,94,0.30)', label: 'GUARD CONE — fills fast', dash: false },
    { col: '#ffaf64', fill: 'rgba(255,150,80,0.28)', label: 'CAMERA ARC — sweeps, fills slow', dash: true },
    { col: '#7ef0ff', fill: 'rgba(126,240,255,0.5)', label: 'YOU — the thief', dash: false },
    { col: '#ffc857', fill: 'rgba(255,200,87,0.55)', label: 'LOOT — take all of it', dash: false },
  ];

  ctx.save();
  ctx.fillStyle = 'rgba(16,23,37,0.88)';
  roundRect(ctx, bx, by, w, 22 + rows.length * 19, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,110,140,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, w, 22 + rows.length * 19, 8);
  ctx.stroke();

  ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('HOW TO READ THE FLOOR', bx + 12, by + 15);

  rows.forEach((r, i) => {
    const y = by + 32 + i * 19;
    // Swatch: a wedge for cones, a dot for entities.
    if (r.label.includes('CONE') || r.label.includes('ARC')) {
      ctx.beginPath();
      ctx.moveTo(bx + 12, y - 3);
      ctx.lineTo(bx + 30, y - 8);
      ctx.lineTo(bx + 30, y + 2);
      ctx.closePath();
      ctx.fillStyle = r.fill;
      ctx.fill();
      ctx.strokeStyle = r.col;
      ctx.lineWidth = 1.2;
      if (r.dash) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = r.fill;
      ctx.beginPath();
      ctx.arc(bx + 21, y - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r.col;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.font = '10px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(220,232,247,0.92)';
    ctx.fillText(r.label, bx + 40, y);
  });
  ctx.restore();
}

function drawIdentityTags(ctx, world) {
  // Short tags on each watcher, so a camera is never counted as a guard.
  ctx.save();
  ctx.font = 'bold 8px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';

  for (const g of world.guards) {
    ctx.fillStyle = 'rgba(255,120,135,0.95)';
    ctx.fillText(`G${g.index + 1}`, g.x, g.y - 20);
  }
  for (const c of world.cameras) {
    const dead = c.disabled > 0;
    ctx.fillStyle = dead ? 'rgba(150,150,160,0.9)' : 'rgba(255,180,110,0.95)';
    ctx.fillText(dead ? 'CAM·OFF' : 'CAM', c.x, c.y + 25);
  }
  ctx.restore();
}

export function drawFrame(ctx, world, thief, game, time) {
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  drawFloor(ctx, world);
  drawCones(ctx, world);
  drawExit(ctx, world, thief, time);
  drawWalls(ctx, world);
  drawLoot(ctx, world, time);
  drawTools(ctx, world, time);
  drawWatchers(ctx, world);
  drawIdentityTags(ctx, world);
  thief.draw(ctx);
  drawHud(ctx, world, thief, game);
  drawLegend(ctx, world);
}

// Full-screen overlays for the title, the caught screen and the win screen.
export function drawOverlay(ctx, kind, data) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  ctx.textAlign = 'center';

  if (kind === 'title') {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 64px "Trebuchet MS", sans-serif';
    ctx.fillText('VELVET HOUR', VIEW.w / 2, 250);

    ctx.fillStyle = PALETTE.thief;
    ctx.font = 'italic 20px "Trebuchet MS", sans-serif';
    ctx.fillText('three rooms, one night, no second chances', VIEW.w / 2, 288);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = '15px "Trebuchet MS", sans-serif';
    const lines = [
      'WASD or arrows to move   ·   SHIFT to sprint (loud)   ·   SPACE to dash',
      '1 smoke blinds a cone   ·   2 EMP drops the cameras   ·   3 decoy pulls a guard',
      'Take every piece of loot, then reach the service door',
      'Guard cones and camera arcs fill the alarm meter. Full meter, room lost.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.w / 2, 380 + i * 30));

    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText('PRESS ENTER TO BEGIN THE JOB', VIEW.w / 2, 580);
  }

  if (kind === 'caught') {
    ctx.fillStyle = '#ff4d5e';
    ctx.font = 'bold 54px "Trebuchet MS", sans-serif';
    ctx.fillText('CAUGHT', VIEW.w / 2, 280);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = '17px "Trebuchet MS", sans-serif';
    ctx.fillText(data.reason, VIEW.w / 2, 330);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillText(`Room: ${data.room}   ·   Loot in hand: $${data.value}`, VIEW.w / 2, 372);

    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText(`PRESS ENTER — ${data.attemptsLeft} RUNS LEFT`, VIEW.w / 2, 470);
  }

  if (kind === 'won') {
    ctx.fillStyle = PALETTE.safe;
    ctx.font = 'bold 60px "Trebuchet MS", sans-serif';
    ctx.fillText('CLEAN GETAWAY', VIEW.w / 2, 250);

    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${data.value}`, VIEW.w / 2, 310);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(`${data.loot} pieces · ${data.rooms} rooms · ${data.tools} tools spent · ${data.time}`, VIEW.w / 2, 356);

    const grade = data.rank;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillText(`RATING: ${grade}`, VIEW.w / 2, 410);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillText('PRESS ENTER TO PLAN ANOTHER JOB', VIEW.w / 2, 500);
  }

  ctx.restore();
}
