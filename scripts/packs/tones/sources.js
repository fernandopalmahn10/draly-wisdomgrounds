// The toned pinyin we can trust, from the books' own data (sources in order):
//   1 La Base (content/audios/<level>-base.json: the study book's words + example sentences, pinyin WITH tones)
//   2 the study books' source modules (roblox/shared*/<Level>Vocab.lua: words + example sentences with tones)
//   3 the exam transcripts (content/golden/<book>.json: every exam line, pinyin with tones)
// load(repo) → { levels: { yct1: {...}, newhsk1: {...}, hsk1: {...} }, lines: [{ t, src, level }], words: [...] }
'use strict';
const fs = require('fs');
const path = require('path');

// the workspace that holds roblox/ (the vocabulary modules): DRALY_WORKSPACE, else the checkout's parent folder
function workspace(repo) {
  const c = [process.env.DRALY_WORKSPACE, path.join(repo, '..'), 'C:\\Users\\ferpa\\ClaudeCode'].filter(Boolean);
  return c.find((d) => fs.existsSync(path.join(d, 'roblox', 'shared'))) || c[c.length - 1];
}
const LUA = { yct1: ['roblox/shared/YCT1Vocab.lua'], newhsk1: ['roblox/shared/NewHSK1Vocab.lua', 'roblox/shared/HSK2Vocab.lua'], hsk1: ['roblox/shared_hsk1/HSK1Vocab.lua'] };
const GOLD = { yct1: 'yct1sim', newhsk1: 'newhsk1sim', hsk1: 'hsk1sim' };

// tone marks only (keep ü's diaeresis apart)
const TONES = /[\u0300\u0301\u0304\u030C]/g;
const nfd = (s) => String(s || '').normalize('NFD');
// the letters of a pinyin string, toneless, ü = u (the key two spellings share)
const letters = (s) => nfd(s).replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const hasTone = (s) => /[̀́̄̌]/.test(nfd(s));

function luaStrings(file, ws) {
  const src = fs.readFileSync(path.join(ws, file), 'utf8');
  const out = [];
  // W("py", "es", "em", "ex", "exes", img)  /  X(…)
  const re = /\b[WX]\(\s*"((?:\\"|[^"])*)"\s*,\s*"((?:\\"|[^"])*)"\s*,\s*"(?:\\"|[^"])*"\s*(?:,\s*"((?:\\"|[^"])*)")?\s*(?:,\s*"((?:\\"|[^"])*)")?/g;
  let m;
  while ((m = re.exec(src))) out.push({ py: m[1], es: m[2], ex: m[3] || '', exes: m[4] || '' });
  return out;
}

function goldLines(obj, acc) {
  if (Array.isArray(obj)) obj.forEach((x) => goldLines(x, acc));
  else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      if (k === 'py' && typeof v === 'string') acc.push(v);
      else goldLines(v, acc);
    });
  }
  return acc;
}

function load(repo) {
  const ws = workspace(repo);
  const levels = {};
  const lines = [];
  for (const lv of ['yct1', 'newhsk1', 'hsk1']) {
    const L = { words: [], lines: [] };
    const base = JSON.parse(fs.readFileSync(path.join(repo, 'content', 'audios', lv + '-base.json'), 'utf8'));
    base.words.forEach((w) => {
      L.words.push({ py: w.py, es: w.es, zh: w.zh || '', src: 'base' });
      const ex = Array.isArray(w.ex) ? w.ex.join('') : '';
      if (ex) L.lines.push({ t: ex, src: 'base' });
    });
    for (const f of LUA[lv]) {
      luaStrings(f, ws).forEach((w) => {
        L.words.push({ py: w.py, es: w.es, zh: '', src: 'lua:' + path.basename(f) });
        if (w.ex) L.lines.push({ t: w.ex, src: 'lua:' + path.basename(f) });
      });
    }
    const g = JSON.parse(fs.readFileSync(path.join(repo, 'content', 'golden', GOLD[lv] + '.json'), 'utf8'));
    goldLines(g, []).forEach((t) => L.lines.push({ t, src: 'golden' }));
    L.words.forEach((w) => lines.push({ t: w.py, src: w.src, level: lv, word: true }));
    L.lines.forEach((x) => lines.push(Object.assign({ level: lv }, x)));
    levels[lv] = L;
  }
  return { levels, lines: lines.filter((x) => x.t && hasTone(x.t)) };
}

module.exports = { load, letters, hasTone, nfd, TONES };
