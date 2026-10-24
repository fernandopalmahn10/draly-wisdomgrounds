// Question packs organised like the curriculum: test family → level → experience (world) → round.
// GET /api/packs returns the tree for the picker (public/packs.html); a round points either to a built-in pack
// ('pack:<level>-<world>-<round>', questions built here from core/packs/<level>.js) or to an older uploaded set
// file (setId). Rules: no hanzi, every question names exactly what it asks; the pack data keeps pinyin WITHOUT tone
// marks (the plain form every check uses: grading, homework, El Entrenamiento), and the pin games show it WITH tones
// (his rule 2026-10-24): each question carries `show` = its text and answers toned, from core/packs/<level>-tones.json
// (the books' own pinyin: La Base, the vocabulary modules, the golden books; how it was made and what a person checked:
// that file's `about`), and forGames() swaps it in for the rooms only.
'use strict';

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const LEVELS = [require('./packs/yct1'), require('./packs/hsk1'), require('./packs/newhsk1')];

// the toned forms of a level (null = none: the question shows its plain form)
const _tones = {};
function tonesOf(level) {
  if (!(level.id in _tones)) {
    let t = null;
    try { t = JSON.parse(fs.readFileSync(path.join(__dirname, 'packs', level.id + '-tones.json'), 'utf8')); } catch (_) { /* none */ }
    _tones[level.id] = t ? { words: t.words || {}, lines: t.lines || {}, texts: t.texts || {}, items: t.items || {} } : null;
  }
  return _tones[level.id] || { words: {}, lines: {}, texts: {}, items: {} };
}

// ---------- helpers ----------
// "Ni hao!" → "nihao", "na'er" → "nar": spelling without tones (homograph and duplicate checks)
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/([a-z])'er\b/g, '$1r').replace(/[^a-z0-9]/g, '');
// meaning parts: "mirar / ver" → [mirar, ver]; "ver (alcanzar a ver)" → [ver]
const parts = (es) => String(es || '').toLowerCase().split('/')
  .map((x) => x.replace(/\(.*?\)/g, '').replace(/[¿?¡!.,]/g, '').trim()).filter(Boolean);
const sharesPart = (a, b) => { const pa = parts(a); return parts(b).some((x) => pa.includes(x)); };
const meanings = (list) => list.filter((x) => !x.gram).map((x) => x.es);

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// up to n options from the pools in order (closest first), never equal to / clashing with the correct one
function options(correct, pools, n, clash) {
  const out = [];
  const seen = new Set([plain(correct)]);
  for (const pool of pools) {
    for (const opt of shuffle(pool || [])) {
      if (out.length >= n) return out;
      const key = plain(opt);
      if (!opt || seen.has(key) || (clash && clash(opt))) continue;
      seen.add(key);
      out.push(opt);
    }
  }
  return out;
}

function picture(level, world, img) {
  if (!img) return 'none';
  const rel = `/assets/packs/${level.dir}/${world.id}/${img}.webp`;
  return fs.existsSync(path.join(PUBLIC, rel)) ? rel : 'none';   // 'none' = no picture (never a generated one)
}

// a question reaches the phones only if it is complete: text, the correct answer and 4 different options
function valid(q) {
  return Boolean(q && q.text && q.correct && Array.isArray(q.answers) && q.answers.length === 4 &&
    q.answers.every((a) => typeof a === 'string' && a.trim()) && q.answers.includes(q.correct) &&
    new Set(q.answers.map(plain)).size === 4);
}

// no two neighbours ask about the same word (key = its pinyin without tones)
function spreadKeys(list) {
  const out = list.slice();
  const clashAt = (i) => i > 0 && i < out.length && out[i].key && out[i].key === out[i - 1].key;
  const fine = (...at) => at.every((k) => !clashAt(k));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length; i++) {
      if (!clashAt(i)) continue;
      for (let j = 0; j < out.length; j++) {                   // any slot in the round, not only later ones
        if (j === i || j === i - 1) continue;
        [out[i], out[j]] = [out[j], out[i]];
        if (fine(i, i + 1, j, j + 1)) break;
        [out[i], out[j]] = [out[j], out[i]];                   // undo, try the next one
      }
    }
  }
  return out;
}

// ---------- build one round ----------
function buildRound(level, world, round) {
  const levelWords = level.worlds.flatMap((wd) => wd.rounds.flatMap((r) => r.words || []));
  const worldWords = world.rounds.flatMap((r) => r.words || []);
  const roundWords = round.words || [];
  const allItems = level.worlds.flatMap((wd) => wd.rounds.flatMap((r) => r.items || []));
  const worldItems = world.rounds.flatMap((r) => r.items || []);
  const items = round.items || [];
  const py = (list) => list.map((x) => x.py.toLowerCase());
  // a Spanish option can never be a meaning of a word spelled like the target (他/她 ta, 是/十 shi…) nor share a
  // meaning with the correct answer ("mirar / ver" vs "ver (alcanzar a ver)", "leer / estudiar" vs "leer")
  const spanishClash = (targetPy, correct) => (opt) => sharesPart(opt, correct) ||
    levelWords.some((x) => x.es === opt && plain(x.py) === plain(targetPy));
  // a pinyin option can never be a word that also means the asked Spanish (kan / kanjian → ver)
  const pinyinClash = (askedEs) => (opt) => levelWords.some((x) => plain(x.py) === plain(opt) && sharesPart(x.es, askedEs));

  // the toned forms the pin games show (`show`): a word by its own pinyin + meaning, a pinyin option tile by the first
  // word of the pools spelled like it, a line or a written question by its exact text
  const T = tonesOf(level);
  const tWord = (x) => T.words[x.py + '|' + x.es] || T.lines[x.py] || x.py;
  const tLine = (s) => T.lines[s] || s;
  const pyTile = new Map();
  [roundWords, worldWords, levelWords].forEach((l) => l.forEach((x) => { const k = x.py.toLowerCase(); if (!pyTile.has(k)) pyTile.set(k, tWord(x).toLowerCase()); }));
  const tPy = (s) => pyTile.get(s) || tLine(s);

  const asked = [];      // es2zh: Spanish → pinyin (with the word's own picture)
  const meaning = [];    // zh2es: pinyin → Spanish (no picture: it would give the answer away)
  const askedEs = new Set();                                   // zher / zheli are both «aquí»: ask «aquí» once per round
  roundWords.filter((x) => !x.gram).forEach((x) => {
    if (askedEs.has(x.es)) return;
    askedEs.add(x.es);
    const correct = x.py.toLowerCase();
    const answers = [correct, ...options(correct, [py(roundWords), py(worldWords), py(levelWords)], 3, pinyinClash(x.es))];
    asked.push({ kind: 'es2zh', key: plain(x.py), text: `¿Cómo se dice «${x.es}» en Chino Mandarín?`, correct, answers,
      image: picture(level, world, x.img),
      show: { text: `¿Cómo se dice «${x.es}» en Chino Mandarín?`, answers: answers.map((a, i) => (i === 0 ? tWord(x).toLowerCase() : tPy(a))) } });
  });
  const seenPy = new Set();
  roundWords.filter((x) => !x.gram).forEach((x) => {
    if (seenPy.has(plain(x.py))) return;                       // ta (él / ella): one meaning question
    seenPy.add(plain(x.py));
    const correct = roundWords.filter((y) => plain(y.py) === plain(x.py) && !y.gram).map((y) => y.es).join(' / ');
    const answers = [correct, ...options(correct, [meanings(roundWords), meanings(worldWords), meanings(levelWords)], 3, spanishClash(x.py, correct))];
    meaning.push({ kind: 'zh2es', key: plain(x.py), text: `¿Qué significa «${x.py}»?`, correct, answers, image: 'none',
      show: { text: `¿Qué significa «${tWord(x)}»?`, answers: answers.slice() } });
  });

  const ctx = { level, world, items, worldItems, allItems, levelWords, worldWords, spanishClash, T, tWord, tLine };
  const authored = items.map((it) => itemQuestion(it, ctx));

  let out;
  if (round.keepOrder) out = authored;
  else {
    // interleave picture question, meaning question, sentence question…, then pull apart any same-word neighbours
    const lists = [shuffle(asked), shuffle(meaning), authored.slice()];
    out = [];
    while (lists.some((l) => l.length)) lists.forEach((l) => { if (l.length) out.push(l.shift()); });
    out = spreadKeys(out);
  }
  const ok = out.filter(valid);
  if (ok.length !== out.length) console.warn('[packs] dropped', out.length - ok.length, 'incomplete question(s) in', level.id, world.id, round.id);
  return ok;
}

function itemQuestion(it, ctx) {
  const { level, world, items, worldItems, allItems, levelWords, worldWords, spanishClash, T, tWord, tLine } = ctx;
  const single = (s) => plain(s) || undefined;   // the answer's spelling is its key (no same word twice in a row)
  // a pinyin tile: its own tone in this question when it reads differently here (吧 ba in a particle fill-in), else the
  // level's tile form; a written question: its toned text
  const own = T.items[it.s || it.t || it.a] || {};
  const tile = (a) => own[a] || tLine(a);
  const tText = (s) => T.texts[s] || s;
  if (it.k === 'w') {                                           // exam word → its meaning
    const word = levelWords.find((x) => plain(x.py) === plain(it.py) && !x.gram && (!it.es || x.es === it.es));
    const correct = it.es || (word && word.es);
    const answers = [correct, ...options(correct, [meanings(worldWords), meanings(levelWords)], 3, spanishClash(it.py, correct))];
    return { kind: 'w', key: plain(it.py), text: `¿Qué significa «${it.py}»?`, correct, answers, image: 'none',
      show: { text: `¿Qué significa «${word && plain(word.py) === plain(it.py) && word.py === it.py ? tWord(word) : tLine(it.py)}»?`, answers: answers.slice() } };
  }
  if (it.k === 'm') {                                           // phrase / sentence → meaning
    const other = (list) => list.filter((x) => x.k === 'm' && plain(x.py) !== plain(it.py)).map((x) => x.es);
    const answers = [it.es, ...options(it.es, [it.w, other(items), other(worldItems), other(allItems)], 3)];
    return { kind: 'm', text: `¿Qué significa «${it.py}»?`, correct: it.es, answers, image: picture(level, world, it.img),
      show: { text: `¿Qué significa «${tLine(it.py)}»?`, answers: answers.slice() } };
  }
  if (it.k === 'r') {                                           // dialogue → best reply: hand-picked or same-world options
    const other = (list) => list.filter((x) => x.k === 'r' && x !== it).map((x) => x.b);
    const answers = [it.b, ...options(it.b, it.w ? [it.w] : [other(items), other(worldItems)], 3)];
    return { kind: 'r', key: single(it.b), text: `Alguien te dice: «${it.a}» ¿Qué respondes?`, correct: it.b, answers, image: 'none',
      show: { text: `Alguien te dice: «${tLine(it.a)}» ¿Qué respondes?`, answers: answers.map(tile) } };
  }
  if (it.k === 'f') {                                           // fill the blank from the exam's word bank
    const answers = [it.a, ...options(it.a, [it.bank], 3)];
    return { kind: 'f', key: single(it.a), text: it.t || `Completa la frase: «${it.s}»`, correct: it.a, answers, image: 'none',
      show: { text: it.t ? tText(it.t) : `Completa la frase: «${tLine(it.s)}»`, answers: answers.map(tile) } };
  }
  const answers = [it.a, ...(it.w || []).slice(0, 3)];
  return { kind: 'q', key: single(it.a), text: it.t, correct: it.a, answers, image: picture(level, world, it.img),
    show: { text: tText(it.t), answers: answers.map(tile) } };
}

// the questions as a pin-game room shows them: `show`'s toned text and answers in place of the plain ones (the right
// answer is the same tile, so every game judges as before). Questions without `show` (an uploaded set) are unchanged.
function forGames(questions) {
  return (questions || []).map((q) => {
    if (!q || !q.show || !Array.isArray(q.show.answers) || q.show.answers.length !== (q.answers || []).length) return q;
    const at = q.answers.indexOf(q.correct);
    if (at < 0) return q;
    const out = Object.assign({}, q, { text: q.show.text, answers: q.show.answers.slice(), correct: q.show.answers[at] });
    delete out.show;
    return out;
  });
}

// ---------- lookup ----------
function findRound(id) {
  for (const level of LEVELS) {
    for (const world of level.worlds) {
      for (const round of world.rounds) {
        if (`${level.id}-${world.id}-${round.id}` === id) return { level, world, round };
      }
    }
  }
  return null;
}

function loadPack(id) {
  const hit = findRound(id);
  if (!hit) return null;
  const { level, world, round } = hit;
  return { id: 'pack:' + id, title: `${level.name} · ${world.name} · ${round.name}`, filename: null,
    questions: buildRound(level, world, round) };
}

// ---------- catalog (what the picker shows) ----------
function levelCatalog(level) {
  return {
    id: level.id, name: level.name,
    worlds: level.worlds.map((world) => ({
      name: world.name, emoji: world.emoji,
      rounds: world.rounds.map((round) => ({
        name: round.name, blurb: round.blurb, setId: `pack:${level.id}-${world.id}-${round.id}`,
      })),
    })),
  };
}

function catalog() {
  return [
    { id: 'yct', name: 'YCT', emoji: '🧒', blurb: 'Exámenes para niños',
      levels: [levelCatalog(LEVELS[0]), { id: 'yct2', name: 'YCT 2', worlds: [] }] },
    { id: 'newhsk', name: 'New HSK', emoji: '🆕', blurb: 'El HSK nuevo', levels: [levelCatalog(LEVELS[2])] },
    { id: 'hsk', name: 'HSK', emoji: '📘', blurb: 'El HSK de siempre', levels: [levelCatalog(LEVELS[1])] },
  ];
}

// the words of a level per world (parents' «Nivel» list in /homework), grammar words included (they are on the
// official list): [{ id, name, emoji, words: [{ hz, py, es, image }] }] — image = the word's question picture or null.
// Built once per level (pictures only change with a deploy, which restarts the server).
const _wordLists = {};
function wordLists(levelId) {
  if (!_wordLists[levelId]) _wordLists[levelId] = buildWordLists(levelId);
  return _wordLists[levelId];
}
function buildWordLists(levelId) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return [];
  return level.worlds.map((w) => {
    const seen = new Set();
    const words = w.rounds.flatMap((r) => r.words || []).filter((x) => !seen.has(x.hz || x.py + '|' + x.es) && seen.add(x.hz || x.py + '|' + x.es))
      .map((x) => {
        const image = picture(level, w, x.img);
        return { hz: x.hz || '', py: x.py, es: x.es, image: image === 'none' ? null : image };
      });
    return { id: w.id, name: w.name, emoji: w.emoji, words };
  }).filter((w) => w.words.length);
}

module.exports = { loadPack, catalog, buildRound, wordLists, forGames, tonesOf, LEVELS, plain };
