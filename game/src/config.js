// config.js — every tunable number in one place, so the feel can be adjusted
// without touching the systems that read them.

export const VIEW = { w: 1280, h: 720 };

export const PALETTE = {
  floor: '#0b111c',
  floorLine: '#142033',
  wall: '#1b2534',
  wallTop: '#2b3a50',
  cover: '#2a2118',
  coverTop: '#3d3023',
  shadow: 'rgba(0,0,0,0.55)',
  danger: 'rgba(255,77,94,0.16)',
  dangerEdge: 'rgba(255,77,94,0.75)',
  cameraCone: 'rgba(255,140,80,0.13)',
  cameraEdge: 'rgba(255,160,90,0.7)',
  gold: '#ffc857',
  safe: '#4ce0c3',
  thief: '#7ef0ff',
  ink: '#e8eef7',
  muted: '#7f8ea6',
  panel: '#101725',
};

export const THIEF = {
  radius: 11,
  speed: 168,
  sprintSpeed: 252,
  dashSpeed: 520,
  dashTime: 0.16,
  dashCooldown: 1.5,
  noiseRadius: 190,
  shadowMultiplier: 0.34,
};

export const ALARM = {
  max: 100,
  guardRate: 62,
  cameraRate: 44,
  decay: 21,
  snatchBump: 7,
  spottedFreeze: 1.15,
  attempts: 3,
};

export const GUARD = {
  radius: 13,
  speed: 66,
  alertSpeed: 104,
  coneRange: 232,
  coneHalfAngle: 0.44,
  pauseAtWaypoint: 1.25,
  turnRate: 3.4,
  investigateSeconds: 3.2,
};

export const CAMERA = {
  range: 292,
  halfAngle: 0.26,
  sweepPeriod: 6.4,
  sweepHalf: 0.72,
};

export const TOOLS = {
  smoke: { key: '1', label: 'Smoke', cost: 1, charges: 1, seconds: 4.6, radius: 96 },
  emp: { key: '2', label: 'EMP', cost: 2, charges: 2, seconds: 5.2 },
  decoy: { key: '3', label: 'Decoy', cost: 1, charges: 1, seconds: 3.4, radius: 420 },
};

export const SHOT = { fastForward: 1 / 60 };
