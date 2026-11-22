// main.js — the game loop. It owns the state machine (title, playing, caught,
// won), advances the world, and answers the one query the screenshot harness
// makes: ?shot=<name>&seed=<n> puts the game in a chosen pose, plays nothing,
// and leaves the frame for the browser to capture.

import { VIEW, SHOT, ALARM } from './config.js';
import { Input } from './input.js';
import { Thief } from './thief.js';
import { World } from './world.js';
import { makeLevels } from './levels.js';
import { drawFrame, drawOverlay } from './render.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const levels = makeLevels();

const game = {
  totalRooms: levels.length,
  attemptsLeft: ALARM.attempts,
  levelIndex: 0,
  mode: 'title',
  time: 0,
  runStart: 0,
  caughtReason: '',
  toolsUsed: 0,
  toast: '',
  toastTimer: 0,
};

let world = null;
let thief = null;

function startRoom(index) {
  game.levelIndex = index;
  const level = levels[index];
  world = new World(level, index);
  thief = new Thief(level.start.x, level.start.y);
  game.mode = 'playing';
  game.runStart = performance.now();
}

function say(text) {
  game.toast = text;
  game.toastTimer = 2.6;
}

function restartJob() {
  game.attemptsLeft = ALARM.attempts;
  game.toolsUsed = 0;
  startRoom(0);
}

function nextRoom() {
  if (game.levelIndex + 1 >= levels.length) {
    game.mode = 'won';
    return;
  }
  say(`Room cleared — ${levels[game.levelIndex + 1].name}`);
  startRoom(game.levelIndex + 1);
}

function handleCaught() {
  game.attemptsLeft -= 1;
  game.caughtReason = world.caughtReason;
  if (game.attemptsLeft <= 0) {
    game.mode = 'caught';
    game.attemptsLeft = 0;
  } else {
    game.mode = 'caught';
  }
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function update(dt) {
  game.time += dt;
  if (game.toastTimer > 0) game.toastTimer -= dt;

  if (game.mode !== 'playing') return;

  // Tools are chosen before movement so a dash can follow a smoke drop.
  if (input.hit('1')) {
    const msg = world.tools.use('smoke', thief, world);
    if (msg) {
      say(msg);
      game.toolsUsed += 1;
    } else say('No smoke left.');
  }
  if (input.hit('2')) {
    const msg = world.tools.use('emp', thief, world);
    if (msg) {
      say(msg);
      game.toolsUsed += 1;
    } else say('No EMP charges left.');
  }
  if (input.hit('3')) {
    const msg = world.tools.use('decoy', thief, world);
    if (msg) {
      say(msg);
      game.toolsUsed += 1;
    } else say('No decoys left.');
  }

  if (input.hit(' ') && thief.tryDash(input, dt)) {
    // The dash is a gamble: fast, but everything nearby hears it.
    game.toolsUsed += 0;
  }

  thief.update(dt, input, world.walls);

  const tripped = world.update(dt, thief);
  if (tripped) {
    handleCaught();
    return;
  }

  if (world.atExit(thief)) {
    if (world.lootTaken === world.lootTotal) {
      nextRoom();
    } else {
      say(`The door is sealed — ${world.lootTotal - world.lootTaken} piece(s) still in the room.`);
    }
  }
}

function rankFor(value, elapsedMs, toolsUsed) {
  const total = levels.reduce((s, l) => s + l.loot.reduce((a, x) => a + x.value, 0), 0);
  const share = value / total;
  const fast = elapsedMs < 150000;
  const thrifty = toolsUsed <= 2;
  if (share >= 0.99 && fast && thrifty) return 'S — GHOST';
  if (share >= 0.99 && thrifty) return 'A — CLEAN';
  if (share >= 0.8) return 'B — PAID';
  if (share > 0) return 'C — PARTIAL';
  return 'D — EMPTY HANDED';
}

function render() {
  if (!world) {
    ctx.fillStyle = '#0b111c';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    drawOverlay(ctx, 'title', {});
    return;
  }

  drawFrame(ctx, world, thief, game, game.time);

  if (game.mode === 'caught') {
    drawOverlay(ctx, 'caught', {
      reason: game.caughtReason,
      room: world.level.name,
      value: thief.carryValue,
      attemptsLeft: game.attemptsLeft,
    });
  }

  if (game.mode === 'won') {
    const elapsed = performance.now() - game.runStart;
    const value = levels.reduce((s, l) => s + l.loot.reduce((a, x) => a + x.value, 0), 0);
    drawOverlay(ctx, 'won', {
      value,
      loot: levels.reduce((s, l) => s + l.loot.length, 0),
      rooms: levels.length,
      tools: game.toolsUsed,
      time: formatTime(elapsed),
      rank: rankFor(value, elapsed, game.toolsUsed),
    });
  }

  if (game.toastTimer > 0 && game.mode === 'playing') {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.toastTimer);
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.toast).width + 36;
    ctx.fillStyle = 'rgba(16,23,37,0.92)';
    ctx.fillRect(VIEW.w / 2 - w / 2, VIEW.h - 118, w, 34);
    ctx.strokeStyle = 'rgba(120,150,190,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(VIEW.w / 2 - w / 2, VIEW.h - 118, w, 34);
    ctx.fillStyle = '#e8eef7';
    ctx.fillText(game.toast, VIEW.w / 2, VIEW.h - 96);
    ctx.restore();
  }
}

// Enter advances the state machine: begin, retry a lost room, or restart.
function handleEnter() {
  if (game.mode === 'title') {
    game.attemptsLeft = ALARM.attempts;
    startRoom(0);
  } else if (game.mode === 'caught') {
    if (game.attemptsLeft > 0) {
      // Retrying a room costs a run and resets that room only.
      const idx = game.levelIndex;
      startRoom(idx);
    } else {
      restartJob();
    }
  } else if (game.mode === 'won') {
    game.attemptsLeft = ALARM.attempts;
    game.toolsUsed = 0;
    game.mode = 'title';
    world = null;
    thief = null;
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (input.hit('enter')) handleEnter();
  if (game.mode === 'playing') update(dt);
  else game.time += dt;

  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- shot mode
// The screenshot harness loads the page with ?shot=<name>. Each pose is built by
// playing the real game forward for a fixed number of deterministic steps, so the
// frame is a render of the game's own code and never a staged picture.
function runFixedSteps(seconds) {
  const step = SHOT.fastForward;
  const count = Math.round(seconds / step);
  for (let i = 0; i < count; i += 1) {
    if (game.mode !== 'playing') break;
    // A scripted walk so the room has motion in it: drift right, then up.
    const scripted = {
      moveVector: () => {
        const t = i * step;
        if (game.levelIndex === 0) return t < 2.2 ? { x: 1, y: 0 } : { x: 0.2, y: -1 };
        if (game.levelIndex === 1) return t < 1.6 ? { x: 0, y: 1 } : { x: 1, y: 0.15 };
        return t < 1.4 ? { x: 1, y: 0 } : { x: 0, y: -1 };
      },
      held: (k) => k === 'shift' && i * step > 0.6,
      hit: () => false,
    };
    thief.update(step, scripted, world.walls);
    world.update(step, thief);
  }
}

function setupShot(name) {
  const cfg = {
    start: { room: 0, seconds: 0.1, mode: 'playing' },
    'room1-smoke': { room: 0, seconds: 3.1, mode: 'playing', smoke: true },
    room2: { room: 1, seconds: 2.4, mode: 'playing' },
    'room2-alarm': { room: 1, seconds: 4.0, mode: 'playing', hurt: 62 },
    'room3-vault': { room: 2, seconds: 2.1, mode: 'playing' },
    'room3-close': { room: 2, seconds: 3.4, mode: 'playing', hurt: 74 },
    caught: { room: 1, seconds: 3.0, mode: 'caught' },
  }[name];
  if (!cfg) return false;

  startRoom(cfg.room);
  game.mode = 'playing';
  runFixedSteps(cfg.seconds);

  if (cfg.smoke && world.tools.available('smoke')) {
    world.tools.use('smoke', thief, world);
    game.toolsUsed += 1;
  }
  if (cfg.hurt) {
    world.alarm.value = cfg.hurt;
  }
  if (cfg.mode === 'caught') {
    game.mode = 'caught';
    game.caughtReason = 'The alarm peaked — the floor went dark and the doors sealed.';
  }
  return true;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

if (shotName) {
  // Static pose for screenshots: no loop, no input, one settle frame.
  if (setupShot(shotName)) {
    if (world) {
      // Advance the sway a touch so cones and cameras are mid-sweep, not at rest.
      for (let i = 0; i < 40; i += 1) {
        for (const c of world.cameras) c.update(SHOT.fastForward);
        for (const g of world.guards) g.update(SHOT.fastForward, world.blockers(), thief);
      }
      game.time = 1.7;
    }
    render();
  }
} else {
  requestAnimationFrame(frame);
}

// A tiny hook so a screenshot run or a playtest can read what the game drew.
// Getters, not values: world and thief are replaced on every room entry.
window.__velvet = {
  game,
  levels,
  get world() {
    return world;
  },
  get thief() {
    return thief;
  },
  startRoom,
};
