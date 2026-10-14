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
  'public/audios.html', 'public/js/audios.js', 'public/js/audios-base.js', 'public/packs.html', 'public/js/portal.js', 'core/assignments.js', 'core/levels.js',
  'public/host-snow.html', 'public/js/host-snow.js', 'public/js/player-snow.js', 'public/js/player-kingdoms-skin.js',
  'public/host-escape.html', 'public/js/host-escape.js', 'public/js/player-escape.js', 'public/js/escape-render.js', 'public/js/escape-map.js',
  'core/escape.js', 'public/js/cast.js',
  'public/games.html',
  'public/host-halcon.html', 'public/js/host-halcon.js', 'public/js/player-halcon.js', 'public/js/halcon-board.js', 'core/halcon.js',
  'public/host.html', 'public/js/host-mochi.js', 'public/js/player-mochi.js', 'public/js/mochi-stage.js', 'core/mochi.js',
  ...fs.readdirSync(path.join(ROOT, 'core/packs')).filter((f) => f.endsWith('.js')).map((f) => 'core/packs/' + f),
];
const RULES = [
  { re: /(?<!New )\bHSK ?2\b/, why: 'kids/parents see "New HSK 1", never "HSK 2" (root CLAUDE.md, 2026-10-11)' },
  { re: /pollinations/i, why: 'no outside AI pictures drawn at runtime (mochi-mash CLAUDE.md, 2026-10-11)' },
  { re: /\bChinese\b/, why: 'Spanish text says "Chino Mandarín", never "Chinese"', only: /\.(html)$/ },
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
