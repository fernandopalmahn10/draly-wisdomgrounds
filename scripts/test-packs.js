#!/usr/bin/env node
// Checks every built-in curriculum pack (core/packs.js): each round builds, and every question has a text, exactly
// 4 different options with the correct one among them, no hanzi, no tone marks in options/pinyin, no two options
// spelled alike without tones, and a picture only if the file exists. Runs each round several times (random options).
// usage: node scripts/test-packs.js [--show <round-id>]
'use strict';
const fs = require('fs');
const path = require('path');
const Packs = require('../core/packs');

const HANZI = /[㐀-鿿]/;
const TONES = /[āǎàēěèīǐìōǒòūǔùǖǘǚǜ]/i;           // tone marks Spanish never uses
const TONE2 = /[áéíóú]/i;                          // 2nd tone = Spanish accents: checked only on pinyin answers
const PINYIN_ANSWERS = new Set(['es2zh', 'r', 'f']);
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
let fails = 0;
const warn = console.warn;
console.warn = (...a) => { if (String(a[0]).includes('[packs] dropped')) { fails++; console.log('FAIL', ...a); } else warn(...a); };
let total = 0;
const bad = (id, q, why) => { fails++; console.log('FAIL', id, '·', why, '·', JSON.stringify(q).slice(0, 160)); };

const show = process.argv.indexOf('--show') > -1 ? process.argv[process.argv.indexOf('--show') + 1] : null;
const ids = [];
for (const level of Packs.LEVELS) for (const w of level.worlds) for (const r of w.rounds) ids.push(`${level.id}-${w.id}-${r.id}`);

for (const id of ids) {
  for (let run = 0; run < 5; run++) {
    const pack = Packs.loadPack(id);
    if (!pack || !pack.questions.length) { bad(id, {}, 'round did not build'); continue; }
    if (run === 0) total += pack.questions.length;
    pack.questions.forEach((q) => {
      if (!q.text || !q.correct) bad(id, q, 'empty text or answer');
      if (q.answers.length !== 4) bad(id, q, q.answers.length + ' options');
      if (!q.answers.includes(q.correct)) bad(id, q, 'correct answer missing from options');
      if (new Set(q.answers.map(plain)).size !== q.answers.length) bad(id, q, 'two options spelled alike');
      if (HANZI.test(q.text) || q.answers.some((a) => HANZI.test(a))) bad(id, q, 'hanzi in a game question');
      if (TONES.test(q.text) || q.answers.some((a) => TONES.test(a))) bad(id, q, 'tone marks in a game question');
      if (PINYIN_ANSWERS.has(q.kind) && q.answers.some((a) => TONE2.test(a))) bad(id, q, 'tone mark in a pinyin option');
      const quoted = (q.text.match(/«([^»]*)»/) || [])[1];
      if (['w', 'm', 'r'].includes(q.kind) && quoted && TONE2.test(quoted)) bad(id, q, 'tone mark in the quoted pinyin');
      if (q.image !== 'none' && !fs.existsSync(path.join(__dirname, '..', 'public', q.image))) bad(id, q, 'missing picture file');
      if (/^¿Quién es\?/.test(q.text)) bad(id, q, 'bare "¿Quién es?" question');
    });
    // the same word must not be asked twice in a row (word rounds)
    pack.questions.forEach((q, i) => {
      const n = pack.questions[i + 1];
      if (n && ((q.key && q.key === n.key) || (q.kind === 'es2zh' && plain(q.correct) && plain(q.correct) === plain(n.correct)))) bad(id, { q: q.text, next: n.text }, 'same word twice in a row');
    });
  }
  if (show && id === show) Packs.loadPack(id).questions.forEach((q, i) => console.log(String(i + 1).padStart(2), q.text, '→', q.correct, '|', q.answers.filter((a) => a !== q.correct).join(' · '), q.image !== 'none' ? '🖼' : ''));
}
console.log(fails ? `packs: ${fails} FAIL(S)` : `packs: all ${ids.length} rounds, ${total} questions passed (5 builds each)`);
process.exit(fails ? 1 : 0);
