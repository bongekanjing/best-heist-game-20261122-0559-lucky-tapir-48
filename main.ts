// main.ts — the hand-in program for Velvet Hour.
//
// It does three things, in this order:
//   1. checks what is about to be handed over against the scorer's own caps, so
//      a bad frame fails here instead of costing a submission;
//   2. copies the playable game and its screenshots into the output directory;
//   3. writes dossier.json with the kit's buildDossier, so the judge reads the
//      summary the library builds from exactly these bytes.
//
// Run it outside the grader by pointing MAKEFUN_OUTPUT_DIR at a directory:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's limits, copied from the competition's gate. Anything outside one
// of these is refused by the sealed scorer.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const SCREENSHOT_TYPES = new Set(['.png', '.jpg', '.jpeg']);
const SOURCE_TYPES = /\.(js|mjs|html|css|json)$/;

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  console.error(`velvet-hour: ${message}`);
  process.exit(1);
}

// Walk a directory and return every file and directory under it, relative.
function walk(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      found.push(rel, ...walk(full, rel));
    } else {
      found.push(rel);
    }
  }
  return found;
}

function totalBytes(dir: string): number {
  let sum = 0;
  for (const rel of walk(dir)) {
    const full = join(dir, rel);
    const st = statSync(full);
    if (st.isFile()) sum += st.size;
  }
  return sum;
}

// Refuse the gate rows that are cheap to get wrong, before writing anything.
function audit(gameDir: string, shotDir: string): void {
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html is missing: there is no game to hand in');
  }

  const entries = walk(gameDir);
  if (entries.length > CAPS.game_max_files) {
    fail(`game/ holds ${entries.length} files and directories, over the cap of ${CAPS.game_max_files}`);
  }

  const gameBytes = totalBytes(gameDir);
  if (gameBytes > CAPS.game_max_bytes) {
    fail(`game/ is ${gameBytes} bytes, over the cap of ${CAPS.game_max_bytes}`);
  }

  const tooLong = entries.find((rel) => Buffer.byteLength(`game/${rel}`, 'utf8') > CAPS.game_path_max_bytes);
  if (tooLong) fail(`a path under game/ is over ${CAPS.game_path_max_bytes} bytes: ${tooLong}`);

  if (!existsSync(shotDir)) {
    fail('screenshots/ is missing: the judge reads them first');
  }

  const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} files; the gate wants 3 to ${CAPS.screenshots.max}`);
  }

  for (const name of shots) {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (!SCREENSHOT_TYPES.has(ext)) fail(`screenshots/${name} is not a PNG or JPEG`);
    const size = statSync(join(shotDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
    }
  }
}

const gameDir = join(repoRoot, 'game');
const shotDir = join(repoRoot, 'screenshots');

audit(gameDir, shotDir);

// 1. Stage the files the scorer reads.
mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(shotDir, join(outputDir, 'screenshots'), { recursive: true });

// 2. Write the dossier. buildDossier is the kit's own copy: the gate rebuilds
//    this file from the same inputs and compares the two byte for byte.
const dossier = buildDossier(outputDir, CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// 3. Say what was handed over, so a run outside the grader explains itself.
const sources = walk(gameDir).filter((rel) => SOURCE_TYPES.test(rel) && !rel.startsWith('vendor/'));
const shotCount = readdirSync(shotDir).filter((n) => !n.startsWith('.')).length;
console.log(
  `velvet-hour: handed over ${sources.length} source files and ${shotCount} screenshots; ` +
    `dossier ${Buffer.byteLength(dossier, 'utf8')} bytes in ${outputDir}`,
);
