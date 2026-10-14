#!/usr/bin/env node
// =========================================================================
// test-audios-base.js · «La base · Empieza aquí» (/audios/yct1-base) and the /audios library
// =========================================================================
// The base page must be the printed book «YCT 1 · Vocabulario», digitally, with a voice for everything:
//   - 83 words in the book's order, 6 worlds; when the study book's build is on this PC (../study/yct1/build/),
//     every card (number, pinyin, Spanish, sentence, red word, its Spanish) and every repaso tile matches it
//   - every word and sentence clip exists and really speaks (ffprobe: > 0.3 s)
//   - nothing people see holds hanzi or an em dash (the voice's hanzi stay in content/, never in public/)
//   - pictures: one WebP per card, <= 60 KB; the book's PDF is downloadable and under 10 MB
//   - the library: every level folder named as core/levels.js says, every old homework address still has its audio
//   - the seals are saved under a key the move bridge carries (draly…)
//     node scripts/test-audios-base.js
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Levels = require('../core/levels');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const ID = 'yct1-base';
const FFDIR = 'C:/Users/ferpa/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const FFPROBE = process.env.FFPROBE || (fs.existsSync(FFDIR + 'ffprobe.exe') ? FFDIR + 'ffprobe.exe' : 'ffprobe');
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL ' + msg); } };
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const file = (url) => path.join(PUB, decodeURIComponent(url.split('?')[0]).replace(/^\//, ''));   // ?v= content stamps stay out

const src = read(path.join(ROOT, 'content', 'audios', ID + '.json'));
const web = read(path.join(PUB, 'assets', 'audios', ID, 'base.json'));
const cat = read(path.join(PUB, 'assets', 'audios', 'catalog.json'));

// ── shape: 83 words, 6 worlds, in order ─────────────────────────────
ok(web.words.length === 83, `83 words (got ${web.words.length})`);
ok(web.words.every((w, i) => w.n === i + 1), 'words numbered 1-83 in order');
ok(web.worlds.length === 6, `6 worlds (got ${web.worlds.length})`);
ok(web.worlds.reduce((s, w) => s + w.count, 0) === 83, 'world counts add up to 83');
let first = 1;
web.worlds.forEach((w) => {
  ok(w.first === first, `world ${w.n} starts at word ${first}`);
  ok(web.words.slice(first - 1, first - 1 + w.count).every((x) => x.world === w.n), `world ${w.n} holds its ${w.count} words`);
  first += w.count;
});
ok(src.words.length === web.words.length && src.words.every((w, i) => w.py === web.words[i].py && w.zh), 'content and page data list the same words, each with what the voice reads');
web.words.forEach((w) => {
  ok(Array.isArray(w.ex) && w.ex.length === 3 && w.ex[1].length > 0, `word ${w.n}: its sentence marks the word in red`);
  ok(w.py && w.es && w.exes && w.hint, `word ${w.n}: pinyin, Spanish, sentence Spanish and repaso hint present`);
});

// ── the printed book, when its build is on this PC ──────────────────
function findUp(rel) {
  let dir = ROOT;
  for (let i = 0; i < 8; i++) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) return p;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const bookHtml = findUp(path.join('study', 'yct1', 'build', 'book.html'));   // built by ../study/yct1/make.py
if (bookHtml) {
  const html = fs.readFileSync(bookHtml, 'utf8');
  const cards = [...html.matchAll(/<article class="cell card">\s*<span class="num">(\d+)<\/span>[\s\S]*?<h3 class="py[^"]*"[^>]*>([^<]*)<\/h3>\s*<p class="es[^"]*">([^<]*)<\/p>\s*<p class="ex[^"]*"><span class="ex-py"[^>]*>([\s\S]*?)<\/span><span class="ex-es">([^<]*)<\/span>/g)];
  ok(cards.length === 83, `the book has 83 cards (found ${cards.length} in ${bookHtml})`);
  cards.forEach((m, i) => {
    const w = web.words[i];
    if (!w) return;
    const red = (m[4].match(/<b>([\s\S]*?)<\/b>/) || [])[1];
    ok(+m[1] === w.n, `card ${i + 1}: number ${m[1]} vs ${w.n}`);
    ok(unescape(m[2]) === w.py, `card ${w.n}: pinyin «${unescape(m[2])}» in the book vs «${w.py}»`);
    ok(unescape(m[3]) === w.es, `card ${w.n}: Spanish «${unescape(m[3])}» in the book vs «${w.es}»`);
    ok(unescape(m[4].replace(/<\/?b>/g, '')) === w.ex.join(''), `card ${w.n}: sentence «${unescape(m[4].replace(/<\/?b>/g, ''))}» in the book vs «${w.ex.join('')}»`);
    ok(red != null && unescape(red) === w.ex[1], `card ${w.n}: red word «${red && unescape(red)}» in the book vs «${w.ex[1]}»`);
    ok(unescape(m[5]) === w.exes, `card ${w.n}: sentence Spanish «${unescape(m[5])}» in the book vs «${w.exes}»`);
  });
  const tiles = [...html.matchAll(/<div class="rp"><span>(\d+)<\/span><img [^>]*><em>([^<]*)<\/em><\/div>/g)];
  ok(tiles.length === 83, `the book's repaso has 83 tiles (found ${tiles.length})`);
  // the book glues « / » to the word before it with a no-break space (no line starts with "/")
  tiles.forEach((m) => { const w = web.words[+m[1] - 1]; const t = unescape(m[2]).replace(/ /g, ' '); ok(w && t === w.hint, `repaso ${m[1]}: «${t}» in the book vs «${w && w.hint}»`); });
  const toneEs = [...html.matchAll(/<p class="tn-py"[^>]*>([^<]*)<\/p>\s*<p class="tn-es">([^<]*)<\/p>/g)];
  ok(toneEs.length === web.tones.length, `the book's tones page has ${web.tones.length} tone words`);
  toneEs.forEach((m, i) => { const t = web.tones[i]; ok(t && unescape(m[1]) === t.py && unescape(m[2]) === t.es, `tone ${i + 1}: «${unescape(m[1])} ${unescape(m[2])}» in the book vs «${t && t.py} ${t && t.es}»`); });
} else {
  console.log('note: the study book build (../study/yct1/build/) is not on this machine: compared with the content file only');
}

// ── every clip exists and speaks ────────────────────────────────────
let probe = true;
try { execFileSync(FFPROBE, ['-version'], { stdio: 'ignore' }); } catch (_) { probe = false; console.log('note: no ffprobe here: clip lengths judged by file size'); }
const clips = new Set();
web.words.forEach((w) => { clips.add(w.au); clips.add(w.exau); });
(web.toneNote || []).forEach((t) => clips.add(t.au));
ok(clips.size >= 83 + 70, `a clip for every word and sentence (${clips.size} clips)`);
let shortest = Infinity;
for (const url of clips) {
  const f = file(url);
  if (!fs.existsSync(f)) { ok(false, `missing clip ${url}`); continue; }
  if (probe) {
    const d = parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
    shortest = Math.min(shortest, d);
    ok(d > 0.3, `${url} speaks for ${d.toFixed(2)} s (must be > 0.3 s)`);
  } else ok(fs.statSync(f).size > 3000, `${url} is ${fs.statSync(f).size} bytes`);
}
web.tones.forEach((t) => ok(web.words[t.word - 1] && web.words[t.word - 1].py === t.py, `tone ${t.mark}: plays word ${t.word} (${t.py})`));

// ── nothing people see holds hanzi or an em dash ───────────────────
const baseText = JSON.stringify(web);
ok(!CJK.test(baseText), 'no hanzi anywhere in the page data (base.json)');
ok(!/[—]/.test(baseText), 'no em dash in the page data');
const catText = JSON.stringify(cat);
ok(!CJK.test(catText), 'no hanzi in the catalog');
ok(!/[—]/.test(JSON.stringify(cat.bases || [])) && !/[—]/.test(JSON.stringify(cat.levels || [])), 'no em dash in the folders and bases');
for (const f of ['public/audios.html', 'public/js/audios.js', 'public/js/audios-base.js', 'public/css/audios.css']) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
  ok(!CJK.test(t), `${f}: no hanzi`);
  ok(!/—/.test(t), `${f}: no em dash`);
}

// ── pictures and the book ───────────────────────────────────────────
const pics = new Set(web.words.map((w) => w.pic));
for (const url of pics) {
  const f = file(url);
  ok(fs.existsSync(f) && /\.webp$/.test(f), `picture ${url} exists as WebP`);
  if (fs.existsSync(f)) ok(fs.statSync(f).size <= 60 * 1024, `${url} is ${(fs.statSync(f).size / 1024).toFixed(0)} KB (max 60)`);
}
ok(web.book && fs.existsSync(file(web.book.pdf)), 'the book PDF is in public/');
if (web.book && fs.existsSync(file(web.book.pdf))) ok(fs.statSync(file(web.book.pdf)).size < 10 * 1048576, 'the book PDF is under 10 MB');

// ── the library: folders, the base, old addresses ───────────────────
const names = Levels.LEVELS.map((l) => ({ id: l.pack, name: l.name }));
ok(JSON.stringify(cat.levels) === JSON.stringify(names), 'catalog folders = core/levels.js (YCT 1 · New HSK 1 · HSK 1)');
ok(!/\bHSK ?2\b/.test(JSON.stringify(cat.levels)), 'no folder says HSK 2');
const base = (cat.bases || []).find((b) => b.id === ID);
ok(base && base.level === 'yct1' && base.words === 83 && base.data === '/assets/audios/' + ID + '/base.json', 'the YCT 1 folder pins its base');
cat.homeworks.forEach((h) => {
  ok(cat.levels.some((f) => f.id === h.level), `homework ${h.id} sits in a folder (${h.level})`);
  ok(fs.existsSync(path.join(ROOT, 'content', 'audios', h.id + '.json')), `homework ${h.id}: its script is in content/audios`);
  h.tracks.forEach((t) => {
    ok(fs.existsSync(file(t.src)), `homework ${h.id}: ${t.src}`);
    t.items.forEach((it) => ok(fs.existsSync(file(it.clip)), `homework ${h.id}: ${it.clip}`));
  });
});
['hsk1-e01-r1', 'hsk1-e02-r2', 'hsk1-e03-r1', 'hsk1-e04-r1', 'newhsk1-e01-r1', 'newhsk1-e03-r1'].forEach((id) =>
  ok(cat.homeworks.some((h) => h.id === id), `the printed PDFs' address /audios/${id} still opens its homework`));
const js = fs.readFileSync(path.join(PUB, 'js', 'audios.js'), 'utf8');
// the page maps a level's stored id to its folder with catalog.aliases (same rule as audios.js route())
const aliases = cat.aliases || {};
const resolve = (id) => { id = id.toLowerCase(); Object.keys(aliases).forEach((a) => { if (id === a || id.indexOf(a + '-') === 0) id = aliases[a] + id.slice(a.length); }); return id; };
ok(aliases.hsk2 === 'newhsk1', 'catalog aliases: hsk2 → newhsk1 (from core/levels.js)');
ok(cat.homeworks.some((h) => h.id === resolve('HSK2-E01-R1')), 'old /audios/hsk2-e01-r1 (any case) opens newhsk1-e01-r1');
ok(cat.levels.some((f) => f.id === resolve('hsk2')), 'old /audios/hsk2 opens the New HSK 1 folder');
ok(resolve('hsk1-e03-r1') === 'hsk1-e03-r1' && resolve('yct1-base') === 'yct1-base', 'other addresses are left alone');
ok(/catalog\.aliases/.test(js) && /id\.indexOf\(a \+ '-'\) === 0/.test(js), 'audios.js resolves addresses with catalog.aliases');
const bjs = fs.readFileSync(path.join(PUB, 'js', 'audios-base.js'), 'utf8');
const key = (bjs.match(/const KEY = \(level\) => '([^']+)'/) || [])[1];
ok(key && /^(draly|mochi\.|hw_|em_|wu_)/i.test(key), `seals saved under a key the move bridge carries (${key})`);

console.log(`audios base: ${checks} checks, ${fails ? fails + ' FAIL(S)' : 'all pass'}` + (probe && isFinite(shortest) ? ` · shortest clip ${shortest.toFixed(2)} s` : ''));
process.exit(fails ? 1 : 0);
