#!/usr/bin/env node
// Words kids and parents must never see (rules in ../CLAUDE.md files), checked in the kid/parent-facing files with
// comments stripped. Run before every deploy (deploy-platform skill). 2026-10-12: "HSK2" texts survived in the New HSK 1
// tareas and the parents' view for a day after the rename rule existed — a machine check catches it every time.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'public/index.html', 'public/homework.html', 'public/js/homework.js', 'public/player.html', 'public/js/player.js',
  'public/audios.html', 'public/js/audios.js', 'public/js/audios-base.js', 'public/js/ruta.js', 'public/js/ruta-auto.js', 'public/js/entrenamiento.js', 'core/entrenamiento.js', 'public/packs.html', 'public/js/portal.js', 'core/assignments.js', 'core/levels.js',
  'public/host-snow.html', 'public/js/host-snow.js', 'public/js/player-snow.js', 'public/js/player-kingdoms-skin.js',
  'public/host-escape.html', 'public/js/host-escape.js', 'public/js/player-escape.js', 'public/js/escape-render.js', 'public/js/escape-map.js',
  'core/escape.js', 'public/js/cast.js',
  'public/games.html', 'protected/pages/level-key.html', 'public/js/teacher-gate.js',
  'public/host-halcon.html', 'public/js/host-halcon.js', 'public/js/player-halcon.js', 'public/js/halcon-board.js', 'core/halcon.js',
  'public/host.html', 'public/js/host-mochi.js', 'public/js/player-mochi.js', 'public/js/mochi-stage.js', 'core/mochi.js',
  'public/host-monopoly.html', 'public/js/host-monopoly.js', 'public/js/player-monopoly.js', 'public/js/monopoly-board.js', 'public/js/monopoly-map.js', 'core/monopoly.js',
  'public/host-pinata.html', 'public/js/host-pinata.js', 'public/js/player-pinata.js', 'public/js/pinata-stage.js', 'core/pinata.js',
  'public/host-sixseven.html', 'public/js/host-sixseven.js', 'public/js/player-sixseven.js', 'public/js/sixseven-stage.js', 'core/sixseven.js',
  'public/host-dragon.html', 'public/js/host-dragon.js', 'public/js/player-dragon.js', 'public/js/dragon-sky.js', 'public/js/dragon-course.js', 'core/dragon.js',
  // the Mario Party ending of Reinos / Pintores / Nieve / La Gran Fuga (2026-10-16) and the two games not listed above
  'public/js/party.js', 'core/party.js', 'public/host-kingdoms.html', 'public/js/host-kingdoms.js', 'public/js/player-kingdoms.js', 'core/kingdoms.js',
  'public/host-paint.html', 'public/js/host-paint.js', 'public/js/player-paint.js', 'core/paint.js', 'core/snow.js', 'core/escape.js', 'public/js/cast.js',
  'public/js/paint-render.js', 'public/js/paint-worlds.js',
  // Las Trampillas (2026-10-17)
  'public/host-trapdoor.html', 'public/js/host-trapdoor.js', 'public/js/player-trapdoor.js', 'public/js/trapdoor-render.js', 'public/js/trapdoor-arena.js', 'core/trapdoor.js',
  ...fs.readdirSync(path.join(ROOT, 'core/packs')).filter((f) => f.endsWith('.js')).map((f) => 'core/packs/' + f),
];
const RULES = [
  { re: /(?<!New )\bHSK ?2\b/, why: 'kids/parents see "New HSK 1", never "HSK 2" (root CLAUDE.md, 2026-10-11)' },
  { re: /pollinations/i, why: 'no outside AI pictures drawn at runtime (mochi-mash CLAUDE.md, 2026-10-11)' },
  { re: /\bChinese\b/, why: 'Spanish text says "Chino Mandarín", never "Chinese"', only: /\.(html)$/ },
  // (Spanish never uses macrons or carons: any of these in a game file is pinyin WITH tone marks)
  { re: /[āēīōūǎěǐǒǔǖǘǚǜ]/, why: 'games show pinyin without tone marks (mochi-mash CLAUDE.md)', only: /sixseven|dragon|party|paint|trapdoor/ },
  // (the old Vuelo del Dragón showed hanzi on the projector and the phone: the remake must never bring them back)
  { re: /[㐀-鿿]/, why: 'no hanzi on game screens (root CLAUDE.md: games show pinyin, no hanzi)', only: /dragon|party|paint|trapdoor/ },
];

// blank out comments but keep line numbers
const strip = (src) => src
  .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

let fails = 0;
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  strip(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
    for (const r of RULES) {
      if (r.only && !r.only.test(rel)) continue;
      if (r.re.test(line)) { fails++; console.log(`FAIL ${rel}:${i + 1} · ${r.why}\n     ${line.trim().slice(0, 140)}`); }
    }
  });
}
console.log(fails ? `wording: ${fails} FAIL(S)` : `wording: ${FILES.length} kid/parent files clean`);
process.exit(fails ? 1 : 0);
