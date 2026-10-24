#!/usr/bin/env node
// test-pack-tones.js — the pin games show pinyin WITH tone marks (his rule 2026-10-24: "do include the tones in pinyin
// when you're asking the question"), from core/packs/<level>-tones.json; the packs keep the plain form every check uses.
// Reads the packs and the tone files where they live (a new pack line = a new entry there, never a test edit):
//   · every pinyin string a question or an answer tile shows has its toned form: each word («pinyin|meaning»), each
//     line (an «…» or a tile), each written question, and a per-question tile (`items`) only for a key the pack has
//   · the toned form, stripped of its tone marks, is the plain form letter for letter (spaces, capitals, punctuation)
//   · a toned form equal to its plain form only where nothing in it takes a mark (ma, ne, de… or Spanish)
//   · every built round's `show` lines up with its plain question (same text and tiles once the marks are stripped),
//     and forGames() hands the rooms the toned text and tiles with the right answer still among them
//   · the rooms load packs through forGames (server.js host:load-set); homework and El Entrenamiento stay plain
//   node scripts/test-pack-tones.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Packs = require('../core/packs');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, msg) => { if (cond) passed++; else { failed++; if (fails.length < 40) fails.push(msg); } };
const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
const toned = (s) => /[̀́̄̌]/.test(String(s).normalize('NFD'));
// syllables that never carry a mark (the neutral particles and suffixes), names, numbers
const BARE = new Set(['ma', 'ne', 'ba', 'le', 'de', 'men', 'me', 'zi', 'ge', 'r', 'er', 'a', 'la', 'hamdan', 'aileen', 'latifa', 'dralingo', 'fer', 'profe', 'adric', 'adrian']);
const bareOnly = (s) => (String(s).toLowerCase().match(/[a-zü']+/g) || []).every((w) => BARE.has(w.replace(/'/g, '')));

for (const level of Packs.LEVELS) {
  const file = path.join(ROOT, 'core', 'packs', level.id + '-tones.json');
  ok(fs.existsSync(file), level.id + ': core/packs/' + level.id + '-tones.json');
  if (!fs.existsSync(file)) continue;
  const T = JSON.parse(fs.readFileSync(file, 'utf8'));
  const need = { words: new Set(), lines: new Set(), texts: new Set() };
  const keys = new Set();
  for (const world of level.worlds) for (const round of world.rounds) {
    (round.words || []).forEach((x) => need.words.add(x.py + '|' + x.es));
    (round.items || []).forEach((it) => {
      keys.add(it.s || it.t || it.a || it.py);
      if (it.k === 'w' || it.k === 'm') need.lines.add(it.py);
      if (it.k === 'r') [it.a, it.b].concat(it.w || []).forEach((x) => need.lines.add(x));
      if (it.k === 'f') { [it.s, it.a].concat(it.bank || []).forEach((x) => need.lines.add(x)); if (it.t) need.texts.add(it.t); }
      if (it.k === 'q') { need.texts.add(it.t); [it.a].concat(it.w || []).forEach((x) => need.lines.add(x)); }
    });
  }
  const pin = (s) => /[a-z]/i.test(s);
  for (const kind of ['words', 'lines', 'texts']) {
    let n = 0;
    for (const k of need[kind]) {
      if (kind === 'lines' && !pin(k)) continue;
      const v = (T[kind] || {})[k];
      n++;
      ok(typeof v === 'string', `${level.id} ${kind}: «${k}» has its toned form`);
      if (typeof v !== 'string') continue;
      const plainForm = kind === 'words' ? k.split('|')[0] : k;
      ok(strip(v) === strip(plainForm), `${level.id} ${kind}: «${v}» stripped is «${plainForm}»`);
      if (kind !== 'texts') ok(toned(v) || bareOnly(plainForm) || /^[\d\s.,:;!?¡¿—–-]+$/.test(plainForm), `${level.id} ${kind}: «${plainForm}» got its tones`);
    }
    console.log(`· ${level.id} ${kind}: ${n} toned forms`);
  }
  // a written question whose «…» is all pinyin gets its tones there (a Spanish «…» stays as it is)
  const pyWords = new Set([...need.words].map((k) => k.split('|')[0].toLowerCase()).flatMap((w) => w.split(/[^a-zü']+/)).filter(Boolean));
  for (const t of need.texts) {
    const v = (T.texts || {})[t] || '';
    (t.match(/«([^«»]+)»/g) || []).forEach((seg) => {
      const words = (seg.toLowerCase().match(/[a-zü']+/g) || []);
      if (!words.length || !words.every((w) => pyWords.has(w) || BARE.has(w))) return;
      ok(v.includes('«') && !v.includes(seg) || bareOnly(seg), `${level.id} texts: the pinyin «…» of «${t}» got its tones`);
    });
  }
  Object.entries(T.items || {}).forEach(([key, tiles]) => {
    ok(keys.has(key), `${level.id} items: «${key}» is a question of the pack`);
    Object.entries(tiles).forEach(([a, v]) => ok(strip(v) === strip(a), `${level.id} items: «${v}» stripped is «${a}»`));
  });
  // every round, as built: `show` lines up with the plain question, and the rooms get the toned one
  for (const world of level.worlds) for (const round of world.rounds) {
    const qs = Packs.buildRound(level, world, round);
    qs.forEach((q) => {
      const where = `${level.id} ${world.id}/${round.id} «${q.text}»`;
      ok(q.show && typeof q.show.text === 'string' && Array.isArray(q.show.answers) && q.show.answers.length === q.answers.length, where + ': has its toned show');
      if (!q.show) return;
      ok(strip(q.show.text) === strip(q.text), where + ': toned text = plain text without marks (' + q.show.text + ')');
      q.answers.forEach((a, i) => ok(strip(q.show.answers[i]).toLowerCase() === strip(a).toLowerCase(), where + ': tile ' + a + ' / ' + q.show.answers[i]));
      ok(new Set(q.show.answers).size === q.show.answers.length, where + ': four different toned tiles');
    });
    const g = Packs.forGames(qs);
    g.forEach((q, i) => {
      ok(!q.show && q.answers.includes(q.correct), `${level.id} ${world.id}/${round.id}: a room's question keeps its right answer among the tiles`);
      ok(q.answers.indexOf(q.correct) === qs[i].answers.indexOf(qs[i].correct), `${level.id} ${world.id}/${round.id}: the right tile is the same tile`);
    });
  }
}
// an uploaded set (no `show`) passes through untouched
const up = [{ text: 'x', correct: 'a', answers: ['a', 'b'] }];
ok(Packs.forGames(up)[0] === up[0], 'an uploaded set\'s question is unchanged');
// the rooms load packs through forGames; homework (packQuizQuestions) and El Entrenamiento (buildRound) stay plain
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
ok(/g\.questions = Packs\.forGames\(set\.questions\)/.test(server), 'server.js host:load-set loads a pack the way the rooms show it (forGames)');
ok(!/forGames/.test(fs.readFileSync(path.join(ROOT, 'core', 'assignments.js'), 'utf8')) && !/forGames/.test(fs.readFileSync(path.join(ROOT, 'core', 'entrenamiento.js'), 'utf8')),
  'homework and El Entrenamiento keep the plain questions');

fails.forEach((f) => console.log('  ✖ ' + f));
console.log(failed ? `pack tones: ${failed} FAILED, ${passed} passed` : `pack tones: all ${passed} checks pass`);
process.exit(failed ? 1 : 0);
