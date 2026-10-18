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
  'public/audios.html', 'public/js/audios.js', 'public/js/audios-base.js', 'public/js/ruta.js', 'public/js/ruta-auto.js', 'public/js/entrada.js', 'public/js/entrenamiento.js', 'core/entrenamiento.js', 'core/entrenamiento-drills.js', 'public/packs.html', 'public/js/portal.js', 'core/assignments.js', 'core/levels.js',
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
// «Never show a real code as an example» (his rule 2026-10-18: the «Mis tareas» login had «1001» as its placeholder, "a
// clue that that is one of the codes"): no class code, student code, PIN or level key as a placeholder, a default value
// or an example, on the kids' pages AND the teachers' (/maestro may be on the projector). PANDA-12 is the key screen's
// one example on purpose: the server refuses it as a key (core/level-keys.js EXAMPLE).
// (2026-10-18 review: the class tools, the exam players and their scripts too; placeholders set from code; `??` and
// 3-digit PIN defaults; visible examples like «como 1003»; keys in any case. Never uppercase plain words, «300
// palabras» or a year. The rule proves itself on the lines below before it reads a page.)
const CODE_FILES = FILES.concat([
  'public/maestro.html', 'public/js/maestro.js', 'public/sets.html', 'public/packs.html',
  'public/host-warmup.html', 'public/js/host-warmup.js', 'public/host-reading.html', 'public/js/host-reading.js',
  'public/host-hsk.html', 'public/js/host-hsk.js', 'public/js/host-reconnect.js', 'public/js/auto-host.js', 'public/js/host-back.js', 'public/js/enter.js',
  'protected/pages/yct-sim.html', 'public/js/yct-sim.js', 'protected/pages/hsk-sim.html', 'public/js/hsk-sim.js',
]);
// a code as it could be typed: a class code (4 digits) or a PIN (3), never a year; a student code (4-6 of its alphabet
// A-H J-N P-Z 2-9 with a digit, or 4 such capitals), never an uppercase plain word of the pages
const YEAR = /^(?:19|20)\d{2}$/;
const PLAIN = new Set(['PIN', 'HSK', 'YCT', 'NAME', 'TEXT', 'DATE', 'CHAT', 'TEAM', 'MENU', 'PASS', 'SALA', 'MAPA', 'MESA', 'TAREA', 'TAREAS', 'CLAVE', 'PANDA', 'DRALY', 'NUEVA', 'NUEVO', 'BASE', 'FASE', 'META', 'EXAM', 'DUBAI', 'AUDIO', 'VIDEO']);
const codeToken = (s) => (String(s).match(/[A-Za-z0-9]+/g) || []).some((t) => (/^\d{3,4}$/.test(t) && !YEAR.test(t)) ||
  (/^[A-HJ-NP-Z2-9]{4,6}$/.test(t) && !PLAIN.has(t) && (/\d/.test(t) || t.length === 4)));
const UNITS = /^\s*(?:%|palabras|preguntas|mundos|minutos|segundos|sellos|veces|años|niños|alumnos|words|questions|px)\b/i;
const CODE_RULES = [
  // a placeholder: the HTML attribute, `.placeholder = …`, setAttribute('placeholder', …), or `placeholder: …`
  { test: (l) => { const out = []; const re = /placeholder\s*(?:=\s*\\?|:\s*|['"]\s*,\s*)["'`]([^"'`]*)["'`]/g; let m; while ((m = re.exec(l))) out.push(m[1]); return out.some(codeToken); },
    why: 'a code-shaped placeholder (a class code, student code or PIN): use words («Tu código o tu nombre») or neutral dots' },
  // a default value: value="1001", .value = '1001', || '1001', ?? '1001', a 3-digit PIN too
  // (a slider's or a number box's value is a setting, never a code: type="range" / "number", min / max / step)
  { test: (l) => { if (/type\s*=\s*["'](?:range|number)["']|\b(?:min|max|step)\s*=/.test(l)) return false;
      const re = /(?:\bvalue\s*=\s*|\|\|\s*|\?\?\s*)["'`](\d{3,4})["'`]/g; let m; while ((m = re.exec(l))) if (!YEAR.test(m[1])) return true; return false; },
    why: 'a class code or PIN as a default value' },
  // a visible example: «como 1003», «por ejemplo K7P2Q9», «e.g. 1001» (never «como 300 palabras»)
  { test: (l) => { const re = /(?:\b[Cc]omo|\b[Ee]jemplo:?|\b[Ee]j\.|\bp\. ?ej\.|\be\.g\.|\b[Ee]xample:?|\bsuch as|\blike)\s*[«"'(]?\s*(?:<b[^>]*>)?\s*([A-Za-z0-9]{3,6})\b/g; let m;
      while ((m = re.exec(l))) { const rest = l.slice(m.index + m[0].length); if (codeToken(m[1]) && !UNITS.test(rest) && !/^[-\s]?\d/.test(rest)) return true; } return false; },
    why: 'a code as a visible example («como 1003»): say it in words' },
  // a level key as an example, any case: DRAGON-47, DRAGON47, DRAGON 47, Dragon-47 (only PANDA-12: the server refuses it)
  // (a dash or nothing between: «¡ÚLTIMOS 30 SEGUNDOS!» is a plain word and a number)
  { test: (l) => /\b(?!PANDA-?12\b)[A-ZÁÉÍÓÚÑ]{4,}-?\d{2,}\b/.test(l) ||
      /(?<![\w/.\-])(?![Pp]anda-12\b)[A-ZÁÉÍÓÚÑ]?[a-záéíóúñ]{3,}-\d{2,}(?![\w.\-])/.test(l),
    why: 'a level key as an example (only PANDA-12, which the server refuses as a key)' },
];
const codeHits = (line) => CODE_RULES.filter((r) => r.test(line));
// the rule proves itself first: what it must catch, and what it must leave alone
const MUST_FAIL = [
  '<input id="hw-access-code" placeholder="1001">', '<input placeholder="XYZN o tu nombre">', '<input placeholder="/player.html?pin=1234">',
  "input.setAttribute('placeholder', '1002');", "el.placeholder = 'K7P2Q9';", "inp.value = codes[0] ?? '1001';", "const pin = saved || '123';",
  'Escribe el código de tu clase, como 1003.', 'Una palabra y un número (por ejemplo DRAGON-47).', 'como Dragon-47', 'la clave DRAGON47', '<input value="1002">',
];
const MUST_PASS = [
  'Es una palabra y un número, como <b translate="no">PANDA-12</b> (con o sin guion).', 'como PANDA-12', '300 palabras con audio', 'como 300 palabras',
  'Simulacros de 2026', '<input placeholder="PIN de la sala">', '<input placeholder="Tu código o tu nombre">', '<input placeholder="••••">',
  'HOLA MUNDO · PANDA · DUBAI', '¡ÚLTIMOS 30 SEGUNDOS!', '<input type="range" id="duration-slider" min="60" max="600" step="30" value="180">', '<link rel="preload" href="/assets/fonts/study/noto-sans-800.woff2">', 'como el día del examen', 'value="2026"',
  '<input placeholder="New class name (e.g. HSK1 Saturday AM)">', 'Lesson 1 · Week 1',
];
let codeFails = 0;
MUST_FAIL.forEach((l) => { if (!codeHits(l).length) { codeFails++; console.log('FAIL the code rule misses: ' + l); } });
MUST_PASS.forEach((l) => { const h = codeHits(l); if (h.length) { codeFails++; console.log('FAIL the code rule wrongly flags: ' + l + ' · ' + h[0].why); } });
for (const rel of [...new Set(CODE_FILES)]) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { if (CODE_FILES.indexOf(rel) >= FILES.length) { codeFails++; console.log('FAIL a page the code rule must read is missing: ' + rel); } continue; }
  strip(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
    for (const r of codeHits(line)) { codeFails++; console.log(`FAIL ${rel}:${i + 1} · ${r.why}\n     ${line.trim().slice(0, 140)}`); }
  });
}
fails += codeFails;
console.log(fails ? `wording: ${fails} FAIL(S)` : `wording: ${FILES.length} kid/parent files clean, no code as an example in ${CODE_FILES.length} pages`);
process.exit(fails ? 1 : 0);
