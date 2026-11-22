// levels.js — the three rooms of the Velvet Hour job, written as data. A room
// is a shell of walls, a scatter of cover, the guards and cameras that watch it,
// the loot that pays for the night and the service door that ends it. Every room
// is built to be crossable at least two ways.

const T = 26; // wall thickness

function border(w, h) {
  return [
    { x: 0, y: 0, w, h: T },
    { x: 0, y: h - T, w, h: T },
    { x: 0, y: 0, w: T, h },
    { x: w - T, y: 0, w: T, h },
  ];
}

export function makeLevels() {
  return [
    // ---------------------------------------------------------------- ROOM 1
    {
      name: 'The Reading Room',
      subtitle: 'Vault antechamber — stay off the marble',
      w: 1280,
      h: 720,
      start: { x: 92, y: 626 },
      exit: { x: 1188, y: 96, w: 62, h: 62 },
      walls: [
        ...border(1280, 720),
        // the long central stack you can go either side of
        { x: 470, y: 250, w: 44, h: 250 },
        { x: 690, y: 150, w: 44, h: 230 },
        { x: 690, y: 470, w: 44, h: 150 },
        // short wings that make the top corridor a commitment
        { x: 900, y: 300, w: 190, h: 40 },
        { x: 300, y: 380, w: 150, h: 40 },
      ],
      cover: [
        { x: 200, y: 210, w: 76, h: 54, kind: 'desk' },
        { x: 356, y: 566, w: 88, h: 56, kind: 'crate' },
        { x: 820, y: 560, w: 96, h: 58, kind: 'crate' },
        { x: 1060, y: 430, w: 88, h: 60, kind: 'desk' },
        { x: 566, y: 96, w: 80, h: 52, kind: 'desk' },
      ],
      guards: [
        {
          x: 800, y: 120,
          facing: Math.PI * 0.62,
          path: [[800, 120], [800, 250], [520, 250], [520, 120]],
        },
        {
          x: 240, y: 480,
          facing: 0,
          path: [[240, 480], [240, 300], [420, 300], [420, 480]],
        },
      ],
      cameras: [
        { x: 1218, y: 188, base: Math.PI * 0.86, mount: 'wall' },
        { x: 62, y: 466, base: Math.PI * 0.14, mount: 'wall' },
      ],
      loot: [
        { x: 640, y: 380, value: 120, name: 'Ledger of Hours' },
        { x: 1120, y: 176, value: 80, name: 'Marble Seal' },
      ],
      par: 46,
    },

    // ---------------------------------------------------------------- ROOM 2
    {
      name: 'The Counting Floor',
      subtitle: 'Thirty tellers, one alarm',
      w: 1280,
      h: 720,
      start: { x: 92, y: 96 },
      exit: { x: 1188, y: 566, w: 62, h: 62 },
      walls: [
        ...border(1280, 720),
        // A comb of teller cages, each tooth a different length: the gaps are
        // the crossings, and none of them lines up with another.
        { x: 286, y: 126, w: 38, h: 214 },
        { x: 286, y: 428, w: 38, h: 168 },
        { x: 512, y: 54, w: 38, h: 246 },
        { x: 512, y: 372, w: 38, h: 132 },
        { x: 512, y: 588, w: 38, h: 108 },
        { x: 742, y: 108, w: 38, h: 196 },
        { x: 742, y: 386, w: 38, h: 214 },
        { x: 968, y: 74, w: 38, h: 188 },
        { x: 968, y: 352, w: 38, h: 158 },
      ],
      cover: [
        { x: 160, y: 300, w: 90, h: 58, kind: 'crate' },
        { x: 400, y: 470, w: 84, h: 56, kind: 'desk' },
        { x: 620, y: 250, w: 88, h: 56, kind: 'desk' },
        { x: 840, y: 340, w: 84, h: 58, kind: 'crate' },
        { x: 1060, y: 240, w: 92, h: 56, kind: 'desk' },
        { x: 1060, y: 470, w: 80, h: 54, kind: 'crate' },
      ],
      guards: [
        {
          x: 430, y: 300,
          facing: Math.PI * 0.5,
          path: [[430, 300], [430, 130], [430, 300], [430, 560]],
        },
        {
          x: 860, y: 300,
          facing: Math.PI * 1.5,
          path: [[860, 300], [860, 560], [860, 300], [860, 130]],
        },
        {
          x: 1120, y: 620,
          facing: Math.PI,
          path: [[1120, 620], [760, 620], [1100, 620]],
        },
      ],
      cameras: [
        { x: 640, y: 58, base: Math.PI * 0.5, mount: 'wall' },
        { x: 1218, y: 380, base: Math.PI * 0.9, mount: 'wall' },
        { x: 62, y: 202, base: Math.PI * 0.12, mount: 'wall' },
      ],
      loot: [
        { x: 640, y: 560, value: 140, name: 'Teller Float' },
        { x: 200, y: 620, value: 70, name: 'Deposit Box 9' },
        { x: 1140, y: 96, value: 90, name: 'Brass Keyring' },
      ],
      par: 54,
    },

    // ---------------------------------------------------------------- ROOM 3
    {
      name: 'The Vault Room',
      subtitle: 'One door in, one guard out',
      w: 1280,
      h: 720,
      start: { x: 640, y: 656 },
      exit: { x: 92, y: 92, w: 62, h: 62 },
      walls: [
        ...border(1280, 720),
        // the vault cage, open only at its south face
        { x: 430, y: 120, w: 42, h: 210 },
        { x: 430, y: 400, w: 42, h: 190 },
        { x: 770, y: 120, w: 42, h: 210 },
        { x: 770, y: 400, w: 42, h: 190 },
        { x: 430, y: 120, w: 382, h: 40 },
        // pillars in the escape lane
        { x: 220, y: 330, w: 52, h: 52 },
        { x: 1010, y: 330, w: 52, h: 52 },
        { x: 620, y: 470, w: 52, h: 52 },
      ],
      cover: [
        { x: 300, y: 200, w: 86, h: 56, kind: 'crate' },
        { x: 900, y: 200, w: 86, h: 56, kind: 'crate' },
        { x: 150, y: 470, w: 80, h: 54, kind: 'desk' },
        { x: 1060, y: 480, w: 84, h: 56, kind: 'desk' },
        { x: 830, y: 600, w: 90, h: 56, kind: 'crate' },
      ],
      guards: [
        {
          x: 600, y: 300,
          facing: Math.PI * 0.5,
          path: [[600, 300], [600, 200], [600, 300], [600, 430]],
        },
        {
          x: 300, y: 560,
          facing: 0,
          path: [[300, 560], [980, 560], [300, 560]],
        },
        {
          x: 1100, y: 120,
          facing: Math.PI,
          path: [[1100, 120], [1100, 300], [860, 300]],
        },
      ],
      cameras: [
        { x: 640, y: 58, base: Math.PI * 0.5, mount: 'wall' },
        { x: 62, y: 618, base: Math.PI * 0.86, mount: 'wall' },
        { x: 1218, y: 200, base: Math.PI * 0.88, mount: 'wall' },
      ],
      loot: [
        { x: 600, y: 190, value: 260, name: 'The Velvet Hour' },
        { x: 1180, y: 640, value: 90, name: 'Guard Rotation Sheet' },
      ],
      par: 58,
    },
  ];
}
