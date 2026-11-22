// thief.js — the player. Movement is velocity based with a short dash that is
// quick but loud: the dash clears a cone, the noise it makes turns a head.

import { THIEF, PALETTE } from './config.js';
import { resolveWalls } from './geometry.js';

export class Thief {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = THIEF.radius;
    this.vx = 0;
    this.vy = 0;
    this.facing = -Math.PI / 2;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = { x: 0, y: -1 };
    this.bob = 0;
    this.hidden = 0;
    this.loot = [];
    this.carryValue = 0;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.loot = [];
    this.carryValue = 0;
    this.hidden = 0;
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  tryDash(input, dt) {
    if (this.dashCooldown > 0) return false;
    const mv = input.moveVector();
    if (mv.x === 0 && mv.y === 0) {
      this.dashDir = { x: Math.cos(this.facing), y: Math.sin(this.facing) };
    } else {
      this.dashDir = mv;
    }
    this.dashTimer = THIEF.dashTime;
    this.dashCooldown = THIEF.dashCooldown;
    return true;
  }

  update(dt, input, walls) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDir.x * THIEF.dashSpeed;
      this.vy = this.dashDir.y * THIEF.dashSpeed;
    } else {
      const mv = input.moveVector();
      const sprinting = input.held('shift');
      const speed = sprinting ? THIEF.sprintSpeed : THIEF.speed;
      // Ease toward the target velocity so direction changes feel weighted.
      const targetVx = mv.x * speed;
      const targetVy = mv.y * speed;
      const ease = 1 - Math.pow(0.0009, dt);
      this.vx += (targetVx - this.vx) * ease;
      this.vy += (targetVy - this.vy) * ease;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    resolveWalls(this, walls);

    const speedNow = Math.hypot(this.vx, this.vy);
    if (speedNow > 8) {
      this.facing = Math.atan2(this.vy, this.vx);
      this.bob += dt * (speedNow / 40);
    }
  }

  // Loudness of the current frame: sprinting and dashing carry.
  noise() {
    const speedNow = Math.hypot(this.vx, this.vy);
    if (this.dashing) return { radius: THIEF.noiseRadius * 1.5, loud: true };
    if (speedNow > THIEF.speed * 1.15) return { radius: THIEF.noiseRadius, loud: true };
    if (speedNow > 30) return { radius: THIEF.noiseRadius * 0.45, loud: false };
    return { radius: 0, loud: false };
  }

  draw(ctx) {
    const { x, y } = this;

    // A wide cyan halo puts the thief in a different visual class from every
    // watcher on the floor: nothing else in the palette is this saturated.
    const halo = ctx.createRadialGradient(x, y, 2, x, y, 34);
    halo.addColorStop(0, 'rgba(126,240,255,0.30)');
    halo.addColorStop(1, 'rgba(126,240,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();

    // A soft pool of shadow keeps the thief anchored to the floor.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 7, this.radius * 1.15, this.radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body: a hooded silhouette with a cyan rim so it reads on dark floor.
    const bob = Math.sin(this.bob * 2) * 1.4;

    ctx.save();
    ctx.translate(x, y + bob);

    // Coat
    ctx.fillStyle = '#16202e';
    ctx.strokeStyle = PALETTE.thief;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.quadraticCurveTo(-11, -4, 0, -10);
    ctx.quadraticCurveTo(11, -4, 9, 6);
    ctx.quadraticCurveTo(0, 10, -9, 6);
    ctx.fill();
    ctx.stroke();

    // Head / hood
    ctx.fillStyle = '#0d1520';
    ctx.beginPath();
    ctx.arc(0, -11, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye glint in the facing direction
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(Math.cos(this.facing) * 2.6, -11 + Math.sin(this.facing) * 2.0, 1.7, 0, Math.PI * 2);
    ctx.fill();

    // Carried loot glows at the hip
    if (this.loot.length) {
      ctx.fillStyle = PALETTE.gold;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(7, 1, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
