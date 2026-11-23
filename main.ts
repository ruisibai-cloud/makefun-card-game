// Emberfall Duel, our entry for make.fun's best card game bounty (Node 22, stdlib only).
//
// The game itself lives in game/ next to this file: plain static files (index.html plus ES
// modules, no libraries, no network) that a desktop browser opens offline. This program is only
// the hand-in step: it copies game/ and screenshots/ into the output directory and writes
// dossier.json there, the summary the judge reads, using the vendored make.fun helper.
// The four screenshots cover the title screen, a mid-game table, a win and a loss;
// the first by name is the cover.
//
// To try the game locally: `node serve.ts`, then open http://localhost:8080.
// Outside the grader, point the output somewhere handy:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier as makeDossier } from './vendor/makefun-game.ts';

// Where this file sits, and where the hand-in goes (the grader's /output, or the override).
const root = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy one whole directory tree, creating the target first.
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

fs.mkdirSync(dest, { recursive: true });
copyTree(path.join(root, 'game'), path.join(dest, 'game'));
fs.mkdirSync(path.join(dest, 'screenshots'), { recursive: true });
if (fs.existsSync(path.join(root, 'screenshots'))) {
  copyTree(path.join(root, 'screenshots'), path.join(dest, 'screenshots'));
}

// The scorer's own limits (reference/gate.json). Only text_max_bytes changes the bytes
// written; the rest reject an entry the scorer would reject anyway: at most 4 screenshots,
// each at most 256 KiB; game/ at most 993 files and 48 MiB in total, no path over 1000 bytes
// (game/ is counted next to /output's own 1000-entry cap, plus screenshots/ and dossier.json).
const gate = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

fs.writeFileSync(path.join(dest, 'dossier.json'), makeDossier(dest, gate));
