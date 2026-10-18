#!/usr/bin/env node
// test-training-coverage.js — does El Entrenamiento prepare a kid for everything the official simulations ask?
// (his ask 2026-10-18, once the simulations became the teacher's, run in class with a PIN: "we will just need the base
// and the training… Just make sure that the training is actually really covering all the simulations.")
// Per level (YCT 1, New HSK 1, HSK 1) it reads the simulations (content/golden/<book>.json: the same export as the
// printed golden books: every question's part, pinyin with tones, options and bank) and every question El
// Entrenamiento can ask (core/entrenamiento.js, every world: the pack rounds + the exam drills), and reports:
//   (a) words: every word of the simulations (what is heard or read, the options, the word banks): the level's own
//       words apart from the exam's own words above the level; for each, how many practice questions use it and where
//   (b) question types: every kind of exam question (and what is heard or read in it: a word, a sentence, a dialogue,
//       a statement + its question), whether El Entrenamiento has it, listen-only with audio when the exam's is heard
//   (c) exam parts: each part of the real exam layout and the practice behind it
//   (d) sentence patterns: «… shì …», «… yǒu …», measure words, numbers, ages, the clock, dates, prices, questions…
// PASS when, for every level: every level word of the sims is practised in MIN_WORD questions or more (a word spelled
// like another one, shi = ser / diez, also in a question of its own), every exam word above the level in MIN_EXAM_WORD,
// every question type in MIN_TYPE questions (each kind of stimulus it has in the sims in MIN_STIM), heard-only when the
// exam's is heard, and every sentence pattern of the sims in MIN_PATTERN. Why these numbers:
//   MIN_WORD 2     a round draws 10 of a world's questions and a world is played until 70 %: two different questions
//                  about a word (e.g. its own question + a sentence, or heard + read) make it come up, in two forms
//   MIN_TYPE 10    one exam part = 5 questions: the part's kind twice over, so it turns up in most rounds of its worlds
//   MIN_STIM 5     each kind of stimulus of a type (a word, a sentence, a dialogue) at least one exam part's worth
//   MIN_PATTERN 5  a pattern met in five questions is met again and again across a world's rounds
// Never reads data/ (a throw-away folder), never starts a server.
//   node scripts/test-training-coverage.js [--level yct1] [--words] (every word, one per line) [--quiet]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-coverage-'));
process.env.DRALY_DATA_DIR = TMP;
process.env.STUDENT_DATA_DIR = TMP;
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const ONLY = opt('level', null);
const LIST_WORDS = args.includes('--words');
const QUIET = args.includes('--quiet');

const Levels = require('../core/levels');
const E = require('../core/entrenamiento');
// the platform's own pinyin → hanzi list, as server.js gives it to El Entrenamiento's voice (_pinyinTokenHanzi)
(function () {
  const withTone = new Map(), flat = new Map();
  try {
    const src = fs.readFileSync(path.join(ROOT, 'public', 'js', 'warmup-vocab.js'), 'utf8');
    const re = /w\('exp\d+',\s*'[^']+',\s*'([^']+)',\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const t = m[1].toLowerCase().replace(/['ʼ]/g, '');
      withTone.set(t, m[2]);
      const f = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!flat.has(f)) flat.set(f, m[2]);
    }
  } catch (_) { /* the voice falls back to the curriculum's words */ }
  E.configure({ tokenHanzi: (tok) => { const s = String(tok || '').toLowerCase().replace(/['ʼ]/g, ''); return withTone.get(s) || flat.get(s.normalize('NFD').replace(/[̀-ͯ]/g, '')) || null; } });
})();

const MIN_WORD = 2, MIN_EXAM_WORD = 1, MIN_TYPE = 10, MIN_STIM = 5, MIN_PATTERN = 5;

// ── spelling keys ───────────────────────────────────────────────────────────────────────────────────────────────
const toneless = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// a word without tones (as El Entrenamiento writes it): «nǚ'ér» → nuer, «na'er» → nar (erhua; «xīngqī'èr» stays xingqier), «Zhōngguó rén» → zhongguoren
const key = (s) => toneless(s).replace(/[’`]/g, "'").replace(/^(na|zhe)'er$/, '$1r').replace(/[^a-z0-9]/g, '');
// with tones (the simulations and La Base write them): yi / bu change tone before another syllable (yí ge, bú shì),
// so their tone is not compared
const TONED = 'a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü0-9';
const tkey = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[’`]/g, "'")
  .replace(/^(n[aà]|zh[eè])'(er|r)$/, '$1r').replace(/y[īíǐì]/g, 'yī').replace(/b[úù]/g, 'bù')
  .replace(new RegExp('[^' + TONED + ']', 'g'), '');
// a line → its tokens: { k (toneless key), t (toned key), cap (written with a capital), end (a clause ends after it), q (… ?) }
function tokens(line) {
  const out = [];
  const raw = String(line || '').replace(/_{2,}/g, ' ').replace(/[«»"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  raw.forEach((w) => {
    if (/^\d{1,2}:\d{2}$/.test(w.replace(/[.,!?]$/, ''))) { out.push({ k: 'TIME', t: 'TIME', cap: false, end: /[.!?]$/.test(w), q: /\?$/.test(w), time: true }); return; }
    const parts = w.split(/[,.!?;:…—–\-/]+/);
    parts.forEach((p, j) => {
      if (!p) return;
      const k = key(p);
      if (!k) return;
      out.push({ k, t: tkey(p), cap: /^[A-ZĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]/.test(p), end: j < parts.length - 1 || /[.!?]$/.test(w), q: /\?/.test(w) });
    });
  });
  // a question mark ends the clause it closes: mark every token of that clause
  for (let i = out.length - 1, inQ = false; i >= 0; i--) {
    if (out[i].end) inQ = out[i].q;
    out[i].inQ = inQ;
  }
  return out;
}

// ── the level's words (La Base: the official word list, with tones and meaning) ──────────────────────────────────
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
const BASES = {};
Levels.LEVELS.filter((l) => l.base).forEach((l) => {
  const b = readJson(path.join(ROOT, 'protected', 'base', l.base, 'base.json'));
  BASES[l.id] = b.words.map((w) => ({ n: w.n, world: w.world, py: w.py, es: w.es, k: key(w.py), t: tkey(w.py) }));
});
const NAMES = new Set(['aileen', 'hamdan', 'latifa', 'adric', 'adrian', 'dralingo', 'fer', 'wang', 'li', 'zhang', 'xiaoming', 'xiaowang', 'xiaoli', 'damao', 'xiaomao']);
const SURNAME = new Set(['wang', 'li', 'zhang', 'xie', 'liu', 'chen']);
// meanings: «mirar / ver» vs «ver (alcanzar a ver)», «en / estar» vs «estar en»
const STOP = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'los', 'las', 'para', 'con', 'por', 'que', 'algo', 'cosa', 'y', 'a', 'o', 'al', 'del', 'lo', 'su', 'mi', 'tu']);
// the packs and La Base sometimes word a meaning differently (回 «volver» / «regresar», 坐 «ir en» / «sentarse»)
const SYN = [['volver', 'regresar'], ['sentarse', 'ir en'], ['ese', 'eso'], ['este', 'esto'], ['casa', 'familia'], ['plato', 'platillo']];
const meaningParts = (es) => String(es || '').toLowerCase().split('/').map((x) => x.replace(/\(.*?\)/g, '').replace(/[¿?¡!.,…]/g, '').trim()).filter(Boolean);
const meaningWords = (es) => new Set(String(es || '').toLowerCase().replace(/[()¿?¡!.,…/]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)));
function meaningMatch(a, b) {
  const pa = meaningParts(a), pb = meaningParts(b);
  if (pa.some((x) => pb.includes(x))) return true;
  if (SYN.some(([x, y]) => (pa.includes(x) && pb.includes(y)) || (pa.includes(y) && pb.includes(x)))) return true;
  const wa = meaningWords(a), wb = meaningWords(b);
  return [...wa].some((w) => wb.has(w));
}
// of several words spelled alike, the one(s) a meaning names: an exact meaning first, else any that shares a word
function byMeaning(cands, es) {
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const exact = cands.filter((w) => norm(w.es) === norm(es));
  if (exact.length) return exact;
  return cands.filter((w) => meaningMatch(w.es, es));
}
// a fill-in's blank is a grammar word more often than not (gè, ba, de, ma…): the meanings that read like grammar
const GRAMMAR = /para contar|medida|¿…\?|sugerencia|plural|ya pasó|acción terminada|orden|de \(mi|devuelve la pregunta/;

// segment a token sequence into dictionary words: tokens joined whole (a word written in two, «dǎ diànhuà»), or one
// token cut into words («xingqiliu» = xingqi + liu); the fewest pieces win. dict: key → [entries]. → [{ k, words, tok }]
function segment(toks, dict, useToned) {
  const kOf = (x) => (useToned ? x.t : x.k);
  const n = toks.length;
  const best = new Array(n + 1).fill(null);
  best[0] = { cost: 0, pieces: [] };
  const inner = (s) => {                           // one token → fewest dictionary pieces, else null
    const b = [{ c: 0, p: [] }];
    for (let i = 1; i <= s.length; i++) {
      b[i] = null;
      for (let j = Math.max(0, i - 14); j < i; j++) {
        const piece = s.slice(j, i);
        if (b[j] && dict.has(piece) && (!b[i] || b[j].c + 1 < b[i].c)) b[i] = { c: b[j].c + 1, p: b[j].p.concat(piece) };
      }
    }
    return b[s.length];
  };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    const here = best[i];
    // tokens i..j joined (2-3 tokens) = one word
    let joined = kOf(toks[i]);
    for (let j = i + 1; j < Math.min(n, i + 3); j++) {
      joined += kOf(toks[j]);
      if (dict.has(joined)) {
        const c = here.cost + 1;
        if (!best[j + 1] || c < best[j + 1].cost) best[j + 1] = { cost: c, pieces: here.pieces.concat({ k: joined, words: dict.get(joined), tok: toks.slice(i, j + 1) }) };
      }
    }
    const one = kOf(toks[i]);
    const seg = toks[i].time ? null : inner(one);
    const c = here.cost + (seg ? seg.c : 3);
    const add = seg ? seg.p.map((p) => ({ k: p, words: dict.get(p), tok: [toks[i]] })) : [{ k: one, words: null, tok: [toks[i]] }];
    if (!best[i + 1] || c < best[i + 1].cost) best[i + 1] = { cost: c, pieces: here.pieces.concat(add) };
  }
  return best[n].pieces;
}
const dictOf = (words, field) => {
  const m = new Map();
  words.forEach((w) => { const k = w[field]; if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(w); });
  return m;
};

// ── the simulations (content/golden/<book>.json) ─────────────────────────────────────────────────────────────────
// every question → { sim, num, sec, part, kind, type, stim, lines: [heard / read lines], right (the right text answer,
// if the options are texts), opts (option texts), bank (the part's word bank) }
const TYPE_NAMES = {
  'L-tf': 'Listen · is it the picture? (✓ / ✕)', 'L-pic': 'Listen · choose the picture', 'L-text': 'Listen · choose the written answer',
  'R-tf': 'Read a word · is it the picture? (✓ / ✕)', 'R-pic': 'Read a sentence · choose the picture', 'R-reply': 'Read · choose the reply',
  'R-fill': 'Read · fill the blank from the word bank', 'R-text': 'Read a short text + a question · choose the answer',
};
const stripWen = (s) => String(s || '').replace(/^\s*(Wèn|Wen)\s*:\s*/i, '');
function stimOf(lines) {
  if (lines.length >= 2) return 'dialogue';
  const t = tokens(lines[0] || '');
  return t.length <= 2 && !/[.?!。？！]\s*$/.test(String(lines[0] || '').trim()) ? 'word' : 'sentence';
}
function simQuestions(level) {
  const info = Levels.info(level);
  const g = readJson(path.join(ROOT, 'content', 'golden', info.golden + '.json'));
  const out = [];
  const names = new Set(NAMES);
  g.sims.forEach((s) => s.parts.forEach((p) => (p.items || []).forEach((it) => {
    if (it.ex) return;
    const q = { sim: s.n, num: it.num, sec: p.sec, part: p.part, kind: p.kind, lines: [], opts: [], bank: [], right: null };
    // the book's Spanish keeps names in pinyin between braces («{Tiāntiān}», «{Lǐ Míng}»): those are names, not words
    (JSON.stringify(it).match(/\{([^{}"]+)\}/g) || []).forEach((m) => m.slice(1, -1).split(/\s+/).forEach((x) => { if (/^[A-ZĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]/.test(x)) names.add(key(x)); }));
    const bank = (p.bank || []).map((b) => b.py);
    if (p.kind === 'tf') q.lines = [it.py];
    else if (p.kind === 'abc' || p.kind === 'gal') q.lines = it.lines ? it.lines.map((l) => l.py) : [it.py];
    else if (p.kind === 'text') {
      q.lines = (it.said || []).map((x) => stripWen(x.py));
      q.opts = (it.opts || []).map((o) => o.py);
      const r = (it.opts || []).find((o) => o.l === it.ans);
      q.right = r ? r.py : null;
    } else if (p.kind === 'reply') {
      q.lines = [it.lines[0].py];
      q.right = it.lines[1] ? it.lines[1].py : null;
      q.bank = bank;
    } else if (p.kind === 'fill') {
      q.lines = it.lines.map((l) => (l.fw ? l.py.replace(/_{2,}/, l.fw) : l.py));
      q.right = (it.lines.find((l) => l.fw) || {}).fw || null;
      q.bank = bank;
    }
    q.type = p.sec + '-' + ({ tf: 'tf', abc: 'pic', gal: 'pic', text: 'text', reply: 'reply', fill: 'fill' }[p.kind]);
    if (q.type === 'R-pic' || q.type === 'R-tf') q.stim = stimOf(q.lines);
    else if (q.type === 'L-text' || q.type === 'R-text') q.stim = q.lines.length > 1 ? 'statement+question' : 'sentence';
    else if (q.type === 'R-reply' || q.type === 'R-fill') q.stim = 'sentence';
    else q.stim = stimOf(q.lines);
    out.push(q);
  })));
  // the layout of the exam: [{ sec, part, type, stim: Set, n }]
  const layout = [];
  out.forEach((q) => {
    let L = layout.find((x) => x.sec === q.sec && x.part === q.part);
    if (!L) { L = { sec: q.sec, part: q.part, type: q.type, stims: new Set(), n: 0 }; layout.push(L); }
    L.stims.add(q.stim);
    L.n++;
  });
  return { book: info.golden, sims: g.sims.length, questions: out, layout, names };
}

// ── El Entrenamiento's questions ─────────────────────────────────────────────────────────────────────────────────
// every question of every world (a world's pool is every question its rounds can draw) → { world, kind, type, stim,
// listen, audio, word (the La Base word it asks about, by number), texts: [what it asks, says or answers, in pinyin] }
const groups = (t) => (String(t || '').match(/«([^«»]+)»/g) || []).map((g) => g.slice(1, -1).trim());
function trainQuestions(level) {
  const out = [];
  const W = E.worldsOf(level) || [];
  W.forEach((w) => E._poolOf(level, w).forEach((q) => {
    const plan = E._voicePlan(q);
    const texts = [];
    // (a «¿Cómo se dice «casa»?» asks Spanish in its «…», even when it spells like pinyin)
    if (q.kind !== 'es2zh') groups(q.text).filter((g) => E._isPinyin(g.replace(/_{2,}/g, ' '))).forEach((g) => texts.push(g.replace(/_{2,}/g, ' ')));
    [plan.ask, plan.after, q.say && q.say.py, q.show && q.show.py].forEach((t) => { if (t && E._isPinyin(t)) texts.push(t); });
    // a short text's question written after it, outside «…» («Lees: «…» Tamen jinwan:»): on the screen too
    if (/^(Lees|Escuchas):/.test(q.text)) { const tail = q.text.slice(q.text.lastIndexOf('»') + 1).replace(/^\s*Pregunta:\s*/, '').trim(); if (tail && E._isPinyin(tail)) texts.push(tail); }
    // the right answer when the options are pinyin (a Spanish answer can spell like pinyin: «hermana mayor»)
    const pyOpts = !['zh2es', 'w', 'm'].includes(q.kind) && !q.pics && q.answers.every((a) => E._isPinyin(a));
    if (pyOpts) texts.push(q.correct);
    // the exam type it practises: the drills say it; of the pack's kinds, the reply and the fill-in are exam kinds
    // (read, their line on screen), «Lees: …» the short text with its question
    let type = q.ex || null, stim = q.stim || null;
    if (!type) {
      if (q.kind === 'r') { type = 'R-reply'; stim = 'sentence'; }
      else if (q.kind === 'f') { type = 'R-fill'; stim = 'sentence'; }
      else if (q.kind === 'q' && /^Lees:/.test(q.text)) { type = 'R-text'; stim = 'statement+question'; }
    }
    // heard only: its line is not on the screen, and it has its own audio
    const listen = !!q.listen && !!plan.ask;
    // a fill-in or a written question whose answer is one word: a question about that word too (its Spanish around
    // it says which meaning: «Yo y mi hermana» → hé = y)
    let target = ['es2zh', 'zh2es', 'w'].includes(q.kind) ? { py: q.kind === 'es2zh' ? q.correct : groups(q.text)[0], es: q.kind === 'es2zh' ? groups(q.text)[0] : q.correct } : null;
    if (!target && ['f', 'q'].includes(q.kind) && pyOpts && tokens(q.correct).length === 1) target = { py: q.correct, es: null, fill: q.text.replace(/«[^«»]*_{2,}[^«»]*»/g, ' ') };
    out.push({ world: w.key, worldKind: w.kind, kind: q.kind, type, stim, listen, audio: !!(plan.ask || plan.opts), word: q.word || null,
      target, texts, text: q.text, answers: pyOpts ? q.answers : [], raw: q.answers, drill: !!q.drill, say: q.say || null, plan,
      files: [q.imageFile].concat(q.pics ? Object.values(q.pics) : []).filter(Boolean),
      id: q.drill ? q.text + '|' + q.answers.slice().sort().join('|') + '|' + (q.imageFile || '') + '|' + (q.say.file || q.say.hz || q.say.py) : null, correct: q.correct });
  }));
  return out;
}

// ── sentence patterns ────────────────────────────────────────────────────────────────────────────────────────────
const NUMSYL = /^(yi|er|san|si|wu|liu|qi|ba|jiu|shi|liang|ling|bai)+$/;
const COUNTED = new Set(['ge', 'ben', 'bei', 'kou', 'zhi', 'jian', 'kuai', 'yuan', 'sui', 'dian', 'fen', 'fenzhong', 'yue', 'hao', 'tian', 'nian', 'ci', 'zhang', 'xiaoshi', 'ri', 'mao']);
const MEASURE = new Set(['ge', 'ben', 'bei', 'kou', 'zhi', 'jian', 'kuai', 'zhang']);
const VERBS = new Set(['chi', 'he', 'kan', 'zuo', 'xue', 'xuexi', 'mai', 'shuo', 'ting', 'du', 'xie', 'shuijiao', 'gongzuo', 'wan', 'da', 'chang', 'kanshu', 'dushu', 'xiuxi', 'zuofan', 'kandianshi']);
const DRINKS = new Set(['shui', 'cha', 'niunai', 'kafei', 'shenme', 'jiu', 'nainiu', 'zhege', 'yidianr', 'yibei', 'dian']);
const PLACEISH = /^(nar|naer|nali|zher|zheer|zheli|nabian|zhebian|jia|jiali|xuexiao|shangdian|yiyuan|fandian|chaoshi|shudian|gongsi|beijing|zhongguo|xuexiaoli|jiali|limian|waimian|shangmian|xiamian|qianmian|houmian|qianbian|houbian|waibian|pangbian|dianyingyuan|daxue|zhongxue|xiaoxue|nali)$/;
function isNumTok(toks, i, toned) {
  const x = toks[i];
  if (!x) return false;
  if (x.k === 'TIME' || /^\d+$/.test(x.k)) return true;
  if (x.k === 'shi') {
    if (toned) return /shí/.test(x.t);
    const nx = toks[i + 1], pv = toks[i - 1];
    return !!(nx && COUNTED.has(nx.k) && nx.k !== 'hao') || !!(pv && (NUMSYL.test(pv.k) && pv.k !== 'shi' || /^\d+$/.test(pv.k)));
  }
  if (x.k === 'ba' && toned) return /bā/.test(x.t);
  if (x.k === 'ba') { const nx = toks[i + 1]; return !!(nx && (COUNTED.has(nx.k) || NUMSYL.test(nx.k))) || !x.end; }
  if (x.k === 'qi' && toned) return /qī/.test(x.t);
  return NUMSYL.test(x.k) && x.k.length > 0 && !['shi', 'ba'].includes(x.k);
}
// pattern → (tokens, toned: the simulation side, with tones) → true when the line uses it
const PATTERNS = [
  ['shi', '«A shì B» (to be)', (t, T) => t.some((x, i) => (x.k === 'shi' && !isNumTok(t, i, T) && (!T || /shì|shi$/.test(x.t))) || x.k === 'bushi' || x.k === 'shide')],
  ['you', '«… yǒu …» (to have / there is)', (t) => t.some((x) => x.k === 'you' || x.k === 'meiyou')],
  ['measure', 'number / zhè / nà + measure word (ge, ben, bei, kou…)', (t, T) => t.some((x, i) => (MEASURE.has(x.k) && i > 0 && (isNumTok(t, i - 1, T) || ['zhe', 'na', 'ji', 'nei', 'zhei', 'mei'].includes(t[i - 1].k))) ||
    /^(zhe|na|nei|zhei|ji|yi|liang|san|si|wu|liu|qi|ba|jiu|shi|\d+)(ge|ben|bei|kou|zhi|jian|kuai|zhang)$/.test(x.k))],
  ['number', 'numbers', (t, T) => t.some((x, i) => isNumTok(t, i, T))],
  ['age', 'age: «… suì» / «duō dà?»', (t) => t.some((x, i) => x.k === 'sui' || (x.k === 'duo' && t[i + 1] && t[i + 1].k === 'da') || x.k === 'duoda')],
  ['clock', 'the clock: «… diǎn (… fēn)», «jǐ diǎn?»', (t, T) => t.some((x, i) => x.k === 'TIME' || ((x.k === 'dian' || x.k === 'fen') && i > 0 && (isNumTok(t, i - 1, T) || t[i - 1].k === 'ji')) || x.k === 'jidian')],
  ['date', 'dates: «… yuè … hào», «xīngqī …»', (t, T) => t.some((x, i) => /^xingqi/.test(x.k) || ((x.k === 'yue' || x.k === 'hao' || x.k === 'ri' || x.k === 'nian') && i > 0 && (isNumTok(t, i - 1, T) || t[i - 1].k === 'ji')) || /^(\d+|yi|er|san|si|wu|liu|qi|ba|jiu|shi)+(yue|hao)$/.test(x.k))],
  ['price', 'prices: «… kuài / yuán», «duōshao qián?»', (t, T) => t.some((x, i) => ((x.k === 'kuai' || x.k === 'yuan') && i > 0 && isNumTok(t, i - 1, T)) || (x.k === 'duoshao' && t[i + 1] && t[i + 1].k === 'qian') || x.k === 'duoshaoqian')],
  ['ma', 'yes / no question «… ma?»', (t) => t.some((x) => x.k === 'ma' && x.end)],
  ['qword', 'question words (shénme, shéi, nǎr, jǐ, duōshao, zěnme…)', (t, T) => t.some((x) => ['shenme', 'shei', 'nar', 'naer', 'nali', 'zenme', 'zenmeyang', 'duoshao', 'weishenme', 'naxie', 'natian', 'jige', 'jidian', 'jihao', 'jisui'].includes(x.k) ||
    ((x.k === 'na' || x.k === 'nage') && (T ? /nǎ/.test(x.t) : x.inQ)) || (x.k === 'ji' && x.inQ))],
  ['place', 'where things are: «zài + place», «… zài nǎr?», shàngmian / qiánbian…', (t) => t.some((x, i) => (x.k === 'zai' && t[i + 1] && !VERBS.has(t[i + 1].k) && (PLACEISH.test(t[i + 1].k) || t[i + 2] && /^(shang|xia|li|wai|qian|hou|pang)(bian|mian)?$/.test(t[i + 2].k))) ||
    /^(shang|xia|li|wai|qian|hou|pang)(bian|mian)$/.test(x.k))],
  ['progressive', 'doing it now: «zài / zhèngzài + verb»', (t) => t.some((x, i) => x.k === 'zhengzai' || (x.k === 'zai' && t[i + 1] && VERBS.has(t[i + 1].k)))],
  ['de', '«… de …» (mine, his…)', (t) => t.some((x) => x.k === 'de')],
  ['neg', 'no: «bù / méi»', (t) => t.some((x) => ['bu', 'bushi', 'mei', 'meiyou', 'buyao', 'buhui'].includes(x.k))],
  ['want', '«xǐhuan / ài / xiǎng / yào + …» (like, love, want)', (t) => t.some((x, i) => ['xihuan', 'ai', 'xiang', 'yao'].includes(x.k) && !!t[i + 1])],
  ['hen', '«hěn + adjective»', (t) => t.some((x, i) => x.k === 'hen' && !!t[i + 1])],
  ['le', '«… le» (done, changed)', (t) => t.some((x) => x.k === 'le')],
  ['ne_ba', '«… ne?» / «… ba» (and you? / let\'s)', (t, T) => t.some((x, i) => x.k === 'ne' || (x.k === 'ba' && x.end && !isNumTok(t, i, T)))],
  ['go', '«qù / lái / huí + place»', (t) => t.some((x, i) => ['qu', 'lai', 'hui', 'huijia', 'huilai', 'huiqu'].includes(x.k) && (!!t[i + 1] || /jia|lai|qu/.test(x.k.slice(3))))],
  ['he_and', '«A hé B» (and)', (t, T) => t.some((x, i) => x.k === 'he' && (T ? /hé/.test(x.t) : !(t[i + 1] && DRINKS.has(t[i + 1].k)) && !(t[i - 1] && ['ai', 'xiang', 'yao', 'xihuan', 'bu', 'zai', 'mei', 'qing'].includes(t[i - 1].k))))],
  ['time', 'when: jīntiān, míngtiān, xiànzài, zǎoshang…', (t) => t.some((x) => ['jintian', 'mingtian', 'zuotian', 'xianzai', 'zaoshang', 'shangwu', 'zhongwu', 'xiawu', 'wanshang', 'jinnian', 'mingnian', 'qunian', 'jinwan', 'baitian', 'mingzao'].includes(x.k))],
  ['polite', 'greetings and manners: nǐ hǎo, xièxie, zàijiàn, duìbuqǐ, bú kèqi…', (t) => t.some((x, i) => ['xiexie', 'zaijian', 'duibuqi', 'bukeqi', 'meiguanxi', 'nihao', 'qingwen'].includes(x.k) ||
    (x.k === 'ni' && t[i + 1] && t[i + 1].k === 'hao') || (x.k === 'bu' && t[i + 1] && t[i + 1].k === 'keqi') || (x.k === 'mei' && t[i + 1] && t[i + 1].k === 'guanxi'))],
];

// ── one level ────────────────────────────────────────────────────────────────────────────────────────────────────
const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, Math.max(n, String(s).length));
const say = (s) => { if (!QUIET) console.log(s); };
function checkLevel(level) {
  const info = Levels.info(level);
  const S = simQuestions(level);
  const T = trainQuestions(level);
  const words = BASES[level];
  const others = Object.keys(BASES).filter((l) => l !== level).flatMap((l) => BASES[l]);
  const dictT = dictOf(words, 't'), dictK = dictOf(words, 'k');
  const allK = dictOf(words.concat(others), 'k');
  const fails = [];
  say('');
  say('━━ ' + info.name + ' ━━ ' + S.sims + ' simulations, ' + S.questions.length + ' questions · El Entrenamiento: ' + (E.worldsOf(level) || []).length + ' worlds, ' + T.length + ' questions');

  // (a) words of the simulations → level words (by tone first) and the exam's own words above the level
  const simWord = new Map();        // La Base n → { w, n (times), sims:Set }
  const examWord = new Map();       // key → { k, py, n, sims:Set, es }
  const addSim = (w, q) => { const e = simWord.get(w.n) || { w, n: 0, sims: new Set() }; e.n++; e.sims.add(q.sim); simWord.set(w.n, e); };
  S.questions.forEach((q) => {
    q.lines.concat(q.opts, q.bank, q.right ? [q.right] : []).forEach((line) => {
      const toks = tokens(line);
      const seg = segment(toks, dictT, true);
      // pieces the tones did not find: their toneless spelling (a tone the book writes differently), else above the level
      seg.forEach((p) => {
        if (p.words) { p.words.forEach((w) => addSim(w, q)); return; }
        const tok = p.tok[0];
        if (tok.time || /^\d+$/.test(tok.k)) return;                                     // a number written in digits
        const loose = segment([tok], dictK, false);
        if (loose.every((x) => x.words)) { loose.forEach((x) => { const tw = x.words.filter((w) => w.t === tkey(x.k)); (tw.length ? tw : x.words).forEach((w) => addSim(w, q)); }); return; }
        if ((tok.cap && SURNAME.has(tok.k)) || S.names.has(tok.k)) return;              // a name (Wáng, Lǐ, Tiāntiān…)
        const e = examWord.get(tok.k) || { k: tok.k, py: (line.split(/\s+/).find((x) => key(x) === tok.k) || tok.k).replace(/[^\p{L}']/gu, ''), n: 0, sims: new Set(), es: ((allK.get(tok.k) || [])[0] || {}).es || '' };
        e.n++; e.sims.add(q.sim);
        examWord.set(tok.k, e);
      });
    });
  });
  // practice: what each training question asks, says or answers → level words (toneless: El Entrenamiento has no
  // tones; a spelling shared by two words counts for both, its own question by its meaning) and exam words
  const practice = new Map();       // La Base n → { n, own, worlds: Map }
  const examPractice = new Map();   // key → count
  const outside = new Map();        // a key in El Entrenamiento that is neither the level's nor the exam's → example
  const bump = (n, world, own) => { const e = practice.get(n) || { n: 0, own: 0, worlds: new Map() }; e.n++; if (own) e.own++; e.worlds.set(world, (e.worlds.get(world) || 0) + 1); practice.set(n, e); };
  T.forEach((q) => {
    const seen = new Set(), seenX = new Set();
    let ownN = null;
    if (q.word) ownN = q.word;
    else if (q.target) {
      const cands = dictK.get(key(q.target.py)) || [];
      let pick = [];
      if (cands.length === 1) pick = cands;
      else if (q.target.es != null) pick = byMeaning(cands, q.target.es);
      else {
        // a fill-in: the meaning its Spanish names, else the grammar word of the spelling
        const sp = new Set(String(q.target.fill || '').toLowerCase().replace(/[«»()¿?¡!.,:=]/g, ' ').split(/\s+/).filter(Boolean));
        pick = cands.filter((w) => meaningParts(w.es).some((m) => m.split(/\s+/).every((x) => sp.has(x))));
        if (pick.length !== 1) pick = cands.filter((w) => GRAMMAR.test(w.es));
      }
      if (pick.length === 1) ownN = pick[0].n;
    }
    if (ownN) { seen.add(ownN); bump(ownN, q.world, true); }
    q.texts.forEach((line) => segment(tokens(line), dictK, false).forEach((p) => {
      if (p.words) {
        const cands = p.words;
        // a spelling shared by words: the one the question asks about, else every one of them
        const pick = ownN && cands.some((w) => w.n === ownN) ? cands.filter((w) => w.n === ownN) : cands;
        pick.forEach((w) => { if (!seen.has(w.n)) { seen.add(w.n); bump(w.n, q.world, false); } });
        return;
      }
      const tok = p.tok[0];
      if (tok.time || /^\d+$/.test(tok.k) || S.names.has(tok.k)) return;
      if (examWord.has(tok.k)) { if (!seenX.has(tok.k)) { seenX.add(tok.k); examPractice.set(tok.k, (examPractice.get(tok.k) || 0) + 1); } return; }
      if (!outside.has(tok.k)) outside.set(tok.k, { world: q.world, text: q.text.slice(0, 90) });
    }));
    // what is on the options (wrong ones too) is seen as well: only for the «outside the level» check
    (q.answers || []).filter((a) => E._isPinyin(a)).forEach((line) => segment(tokens(line), dictK, false).forEach((p) => {
      if (p.words) return;
      const tok = p.tok[0];
      if (tok.time || /^\d+$/.test(tok.k) || S.names.has(tok.k) || examWord.has(tok.k)) return;
      if (!outside.has(tok.k)) outside.set(tok.k, { world: q.world, text: 'option «' + line + '» in ' + q.text.slice(0, 70) });
    }));
  });
  const homograph = (w) => (dictK.get(w.k) || []).length > 1;
  const wordRows = [...simWord.values()].sort((a, b) => a.w.n - b.w.n).map((e) => {
    const p = practice.get(e.w.n) || { n: 0, own: 0, worlds: new Map() };
    const okW = p.n >= MIN_WORD && (!homograph(e.w) || p.own >= 1);
    return { e, p, ok: okW };
  });
  const weak = wordRows.filter((r) => !r.ok);
  const examRows = [...examWord.values()].sort((a, b) => b.n - a.n).map((e) => ({ e, n: examPractice.get(e.k) || 0, ok: (examPractice.get(e.k) || 0) >= MIN_EXAM_WORD }));
  const examWeak = examRows.filter((r) => !r.ok);
  say('(a) words · ' + simWord.size + ' of the level\'s ' + words.length + ' words are in the simulations: ' + (wordRows.length - weak.length) + ' practised (' + MIN_WORD + '+ questions), ' + weak.length + ' not enough');
  weak.forEach((r) => say('    ✖ ' + pad(r.e.w.py + ' (' + r.e.w.es + ')', 40) + ' ' + r.e.n + '× in sims ' + [...r.e.sims].join(',') + ' · practice ' + r.p.n + (homograph(r.e.w) ? ', own ' + r.p.own : '')));
  const counts = wordRows.map((r) => r.p.n).sort((a, b) => a - b);
  if (counts.length) say('    practice per word: min ' + counts[0] + ', median ' + counts[Math.floor(counts.length / 2)] + ', max ' + counts[counts.length - 1]);
  say('    exam words above the level: ' + examRows.length + ' (' + (examRows.length - examWeak.length) + ' practised, marked as the exam\'s own)');
  examWeak.forEach((r) => say('    ✖ ' + pad(r.e.py + (r.e.es ? ' (' + r.e.es + ')' : ''), 40) + ' ' + r.e.n + '× in sims ' + [...r.e.sims].join(',') + ' · practice ' + r.n));
  if (LIST_WORDS) {
    wordRows.forEach((r) => say('      ' + (r.ok ? '✔' : '✖') + ' ' + pad(r.e.w.py, 16) + pad(r.e.w.es, 30) + ' sims ' + pad(r.e.n + '×', 5) + ' practice ' + pad(r.p.n, 4) +
      [...r.p.worlds.entries()].map(([w, c]) => w + ' ' + c).join(', ')));
    examRows.forEach((r) => say('      ' + (r.ok ? '✔' : '✖') + ' [exam] ' + pad(r.e.py, 14) + pad(r.e.es, 24) + ' sims ' + pad(r.e.n + '×', 5) + ' practice ' + r.n));
  }
  if (outside.size) say('    · ' + outside.size + ' spelling(s) in El Entrenamiento that are neither the level\'s words nor the exam\'s: ' + [...outside.entries()].slice(0, 12).map(([k, v]) => k + ' [' + v.world + ']').join(', ') + (outside.size > 12 ? '…' : ''));
  if (weak.length) fails.push(weak.length + ' level word(s) of the sims not practised enough');
  if (examWeak.length) fails.push(examWeak.length + ' exam word(s) above the level not practised');

  // (b) question types and (c) exam parts
  const typeNeed = new Map();       // type → Set(stims) in the sims
  S.questions.forEach((q) => { if (!typeNeed.has(q.type)) typeNeed.set(q.type, new Set()); typeNeed.get(q.type).add(q.stim); });
  const typeHave = (type, stim) => T.filter((q) => q.type === type && (!stim || q.stim === stim) && (type[0] !== 'L' || q.listen));
  say('(b) question types · ' + typeNeed.size + ' kinds in the simulations');
  const typeOk = new Map();
  [...typeNeed.entries()].sort().forEach(([type, stims]) => {
    const all = typeHave(type);
    const per = [...stims].map((s) => [s, typeHave(type, s).length]);
    const okT = all.length >= MIN_TYPE && per.every(([, n]) => n >= MIN_STIM);
    typeOk.set(type, okT);
    const worlds = [...new Set(all.map((q) => q.world))];
    say('    ' + (okT ? '✔' : '✖') + ' ' + pad(type, 8) + pad(TYPE_NAMES[type] || type, 52) + ' ' + pad(all.length, 4) + ' practice questions' +
      (type[0] === 'L' ? ' (heard only, with audio)' : '') + ' · ' + per.map(([s, n]) => s + ' ' + n).join(', ') + (worlds.length ? ' · worlds: ' + worlds.join(', ') : ''));
    if (!okT) fails.push('question type ' + type + ' (' + per.map(([s, n]) => s + ' ' + n).join(', ') + ')');
  });
  // listening practice that shows its line on the screen is reading, not listening: report it
  const shown = T.filter((q) => q.type && q.type[0] === 'L' && !q.listen).length;
  if (shown) say('    · ' + shown + ' «listening» question(s) show their line on the screen (counted as reading only)');
  say('(c) exam parts');
  S.layout.forEach((L) => say('    ' + (typeOk.get(L.type) ? '✔' : '✖') + ' ' + (L.sec === 'L' ? 'Listening' : 'Reading  ') + ' part ' + L.part + ' · ' + pad(TYPE_NAMES[L.type], 52) + ' (' + [...L.stims].join(' / ') + ', ' + L.n + ' questions in the sims)'));

  // (d) sentence patterns
  say('(d) sentence patterns');
  const simTok = S.questions.map((q) => q.lines.concat(q.right ? [q.right] : []).map((l) => tokens(l)));
  const trTok = T.map((q) => q.texts.map((l) => tokens(l)));
  PATTERNS.forEach(([id, name, fn]) => {
    const inSims = simTok.filter((ls) => ls.some((t) => fn(t, true))).length;
    if (!inSims) return;
    const inTrain = trTok.filter((ls) => ls.some((t) => fn(t, false))).length;
    const okP = inTrain >= MIN_PATTERN;
    say('    ' + (okP ? '✔' : '✖') + ' ' + pad(name, 74) + ' sims ' + pad(inSims, 4) + ' practice ' + inTrain);
    if (!okP) fails.push('pattern ' + id + ' (' + inTrain + ' practice questions)');
  });
  // (e) the drills themselves: heard lines the voice can really say, pictures that exist, the same look → the same
  // answer, and only the level's words (plus the exam's own)
  say('(e) exam drills');
  const drills = T.filter((q) => q.drill);
  const deaf = [];
  T.filter((q) => q.listen).forEach((q) => {
    const s = q.say;
    if (s && s.file) { if (!fs.existsSync(s.file)) deaf.push('missing clip ' + s.file); return; }
    if (s && s.hz) { if (/[A-Za-z]/.test(s.hz)) deaf.push(s.hz); return; }
    const sp = E._speechFor(level, s ? s.py : q.plan.ask, s && s.es);
    if (sp.file) return;
    if (!sp.text || /[A-Za-z]{2,}/.test(sp.text.replace(/\b(Aileen|Hamdan|Latifa|Adric|Adrian|Dralingo|Fer)\b/g, ''))) deaf.push((s ? s.py : q.plan.ask) + ' → ' + sp.text);
  });
  const clips = T.filter((q) => q.listen && q.say && q.say.file).length, exact = T.filter((q) => q.listen && q.say && !q.say.file && q.say.hz).length;
  const voiced = T.filter((q) => q.listen).length - clips - exact;
  say('    ' + (deaf.length ? '✖' : '✔') + ' heard-only questions: ' + T.filter((q) => q.listen).length + ' (' + clips + ' with La Base\'s own clip, ' + exact + ' with the exam\'s own Chinese, ' +
    voiced + ' by the platform voice from pinyin)' + (deaf.length ? ': ' + deaf.length + ' the voice can\'t say well: ' + deaf.slice(0, 6).join(' | ') : ''));
  if (deaf.length) fails.push(deaf.length + ' heard-only line(s) the voice can\'t say');
  const noPic = drills.filter((q) => q.files.some((f) => !fs.existsSync(f)));
  say('    ' + (noPic.length ? '✖' : '✔') + ' pictures: ' + drills.filter((q) => q.files.length).length + ' picture drills, every picture on disk' + (noPic.length ? ' (missing in ' + noPic.length + ')' : ''));
  if (noPic.length) fails.push(noPic.length + ' drill(s) with a missing picture');
  const look = new Map();
  drills.forEach((q) => { const id = q.world + '|' + q.text + '|' + q.raw.slice().sort().join('|'); if (!look.has(id)) look.set(id, new Set()); look.get(id).add(q.correct); });
  const twoFaced = [...look.entries()].filter(([, s]) => s.size > 1);
  say('    ' + (twoFaced.length ? '✖' : '✔') + ' two written drills that look the same always have the same answer' + (twoFaced.length ? ' (' + twoFaced.length + ' don\'t: ' + twoFaced.slice(0, 2).map(([k]) => k).join(' | ') + ')' : ''));
  if (twoFaced.length) fails.push(twoFaced.length + ' drill(s) look alike with different answers');
  const drillOutside = [];
  drills.forEach((q) => q.texts.concat(q.answers).forEach((line) => segment(tokens(line), dictK, false).forEach((p) => {
    if (p.words) return;
    const tok = p.tok[0];
    if (tok.time || /^\d+$/.test(tok.k) || S.names.has(tok.k) || examWord.has(tok.k)) return;
    drillOutside.push(tok.k + ' [' + q.world + ']');
  })));
  say('    ' + (drillOutside.length ? '✖' : '✔') + ' the drills use only the level\'s words (and the exam\'s own)' + (drillOutside.length ? ': ' + [...new Set(drillOutside)].slice(0, 10).join(', ') : ''));
  if (drillOutside.length) fails.push('drills with words outside the level: ' + [...new Set(drillOutside)].slice(0, 5).join(', '));
  say('  → ' + (fails.length ? 'FAIL: ' + fails.join('; ') : 'PASS'));
  return { level, name: info.name, fails, words: simWord.size, weak: weak.length, exam: examRows.length, examWeak: examWeak.length, types: typeNeed.size,
    typesOk: [...typeOk.values()].filter(Boolean).length, parts: S.layout.length, partsOk: S.layout.filter((L) => typeOk.get(L.type)).length, outside: outside.size };
}

let results = [];
try {
  results = Levels.LEVELS.filter((l) => l.base && l.golden && (!ONLY || Levels.normalize(ONLY) === l.id)).map((l) => checkLevel(l.id));
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
}
const bad = results.filter((r) => r.fails.length);
console.log('');
results.forEach((r) => console.log((r.fails.length ? '✖ ' : '✔ ') + pad(r.name, 10) + ' words ' + (r.words - r.weak) + '/' + r.words + ' · exam words ' + (r.exam - r.examWeak) + '/' + r.exam +
  ' · question types ' + r.typesOk + '/' + r.types + ' · exam parts ' + r.partsOk + '/' + r.parts));
console.log(bad.length ? 'test-training-coverage: ' + bad.length + ' level(s) not covered (' + bad.map((r) => r.name).join(', ') + ')' : 'test-training-coverage: every level\'s simulations are covered');
process.exit(bad.length ? 1 : 0);
