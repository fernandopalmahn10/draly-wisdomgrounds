// Toned forms for every pinyin string the pin games show, from the books' own data (sources.js), never invented:
//   1 a whole match: a source line (or word) with exactly the same letters → its tones copied letter by letter onto the
//     pack's own spelling (spaces, capitals and punctuation stay the pack's, so «toned stripped of tones = plain» holds)
//   2 word by word: each word's tones from the sources; a word with more than one reading (hao/hào, shi/shí, yi/yí/yì…)
//     is decided by its neighbours in the books' sentences, else it is listed for a human check
//   then PER ITEM (2026-10-24: «mai cai» is 买菜 mǎi cài in New HSK 1 sim 1, 卖菜 mài cài in sim 2): an item with hanzi
//   (hanzi.js: every sim line, option and bank word; a sum's numbers) takes its own sim's golden-book line, else a book
//   reading that reads ITS hanzi (check.js), stored in items['<world>/<round>|<item text>']; a fill-in's answer is read
//   inside its own sentence; items.json decides by meaning last. The same-spelling sweep is listed for a person.
//   Before it, when a sim or a word with hanzi changed: node hanzi.js --list <f> && python readings.py <f>
// node scripts/packs/tones/resolve.js [--out <dir>] [--check <file>] [--repo <checkout>]
//   → <out>/<level>-tones.json (default core/packs: what the pin games show) + the list a human must look at
//   (--check, default <tmp>/pack-tones-check.json; node scripts/packs/tones/show.js <that file> prints it). Decisions by
//   meaning go in overrides.json (a whole line) and items.json (a tile that reads differently in one question).
//   Run it after a pack changes, look at the list, then node scripts/test-pack-tones.js.
'use strict';
const fs = require('fs');
const path = require('path');
const { load, letters, hasTone, nfd } = require('./sources');
const { enumerate } = require('./enumerate');

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.indexOf('--' + n) >= 0 && argv[argv.indexOf('--' + n) + 1]) || d;
const repo = path.resolve(arg('repo', path.join(__dirname, '..', '..', '..')));
const outDir = path.resolve(arg('out', path.join(repo, 'core', 'packs')));
const checkFile = path.resolve(arg('check', path.join(require('os').tmpdir(), 'pack-tones-check.json')));
const S = load(repo);
const E = enumerate(repo);
const NAMES = new Set(['hamdan', 'aileen', 'latifa', 'dralingo', 'adric', 'adrian', 'fer', 'profe', 'xie', 'wang', 'li', 'zhang']);

// ---- letters ⇄ marks ----
// a toned string as letters with their marks: [{ b: base letter (ü kept as ü), m: tone mark or '' }]
function marks(s) {
  const out = [];
  const d = nfd(s);
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if (/[a-z]/i.test(c)) {
      let b = c.toLowerCase(), m = '';
      while (i + 1 < d.length && /[̀-ͯ]/.test(d[i + 1])) {
        const k = d[i + 1];
        if (k === '̈') b = 'ü'; else if (/[̀́̄̌]/.test(k)) m = k;
        i++;
      }
      out.push({ b, m });
    }
  }
  return out;
}
// the pack's own string with the source's tones (and ü) on the same letters; null if the letters differ
function transfer(target, source) {
  const src = marks(source);
  if (letters(target) !== letters(source)) return null;
  const t = nfd(target);
  let out = '', j = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (/[a-z]/i.test(c)) {
      while (i + 1 < t.length && /[̀-ͯ]/.test(t[i + 1])) i++;     // the pack's own marks (ü) are replaced
      const s = src[j++];
      let b = s.b === 'ü' ? 'ü' : s.b;
      if (c !== c.toLowerCase()) b = b.charAt(0).toUpperCase() + b.slice(1);
      out += b + s.m;
    } else out += c;
  }
  return out.normalize('NFC');
}
const strip = (s) => nfd(s).replace(/[̀-ͯ]/g, '').normalize('NFC');

// ---- indexes ----
const levelOrder = (lv) => [lv].concat(['yct1', 'newhsk1', 'hsk1'].filter((x) => x !== lv));
// whole lines by letters: key → [{ t, src, level }]
const byLetters = new Map();
S.lines.forEach((x) => { const k = letters(x.t); if (!k) return; if (!byLetters.has(k)) byLetters.set(k, []); byLetters.get(k).push(x); });
// tokens of every source line, for word-by-word: key → Map(toned lower → count)
const TOK = /[A-Za-zÀ-ɏ̀-ͯ']+/g;
const toks = (s) => (nfd(s).match(TOK) || []).map((t) => ({ raw: t, k: letters(t), toned: t.normalize('NFC').toLowerCase() }));
const tokDict = new Map();
const seqs = [];      // [{ level, list: [{ k, toned }] }]
S.lines.forEach((x) => {
  const list = toks(x.t);
  seqs.push({ level: x.level, list });
  list.forEach((t) => { if (!t.k) return; if (!tokDict.has(t.k)) tokDict.set(t.k, new Map()); const m = tokDict.get(t.k); m.set(t.toned, (m.get(t.toned) || 0) + 1); });
});
// readings of a word key, most common first
const readings = (k) => [...(tokDict.get(k) || new Map()).entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);

// one whole match: the same level's sources first; several different tonings → the first (same level, base first) + a note
// (the old HSK 1 sets' «na'er» / «zhe'er» are matched as the books' nàr / nǎr / zhèr, then written back their way)
function whole(s, lv) {
  if (/\b(na|zhe)'er\b/i.test(s)) {
    const short = s.replace(/\b([Nn])a'er\b/g, '$1ar').replace(/\b([Zz])he'er\b/g, '$1her');
    const r = whole0(short, lv);
    if (!r || !r.toned) return r;
    const back = r.toned.replace(/\b([Nn][aàǎ])r\b/g, "$1'er").replace(/\b([Zz]h[eè])r\b/g, "$1'er");
    return strip(back) === strip(s) ? Object.assign({}, r, { toned: back, how: r.how + " (books: nàr/nǎr/zhèr)" }) : null;
  }
  return whole0(s, lv);
}
function whole0(s, lv) {
  const hits = byLetters.get(letters(s));
  if (!hits) return null;
  const order = levelOrder(lv);
  const rank = (x) => order.indexOf(x.level) * 10 + (x.src === 'base' ? 0 : x.src === 'golden' ? 1 : 2);
  const sorted = hits.slice().sort((a, b) => rank(a) - rank(b));
  const tonings = [...new Set(sorted.map((x) => marks(x.t).map((m) => m.m).join('|')))];
  const pick = sorted[0];
  return { toned: transfer(s, pick.t), how: 'whole:' + pick.src + ':' + pick.level, alt: tonings.length > 1 ? [...new Set(sorted.map((x) => x.t))].slice(0, 4) : null };
}

// the old HSK 1 sets spell 哪儿 / 这儿 «na'er» / «zhe'er» (the books print nǎr / zhèr): the same tones on their letters
const ALIAS = { naer: "nǎ'er", zheer: "zhè'er" };
// a word the books never wrote alone: cut into words they did write (bushi = bu + shi, kanjianle = kanjian + le)
function split(k) {
  const best = new Array(k.length + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < k.length; i++) {
    if (!best[i]) continue;
    for (let j = k.length; j > i; j--) {
      const part = k.slice(i, j);
      if (!tokDict.has(part)) continue;
      const cand = best[i].concat([part]);
      if (!best[j] || cand.length < best[j].length) best[j] = cand;
    }
  }
  return best[k.length];
}
// the tone of a toned syllable's first vowel: 1-4, 0 = neutral
const toneOf = (t) => { const m = /[̄́̌̀]/.exec(nfd(t || '')); return m ? '̄́̌̀'.indexOf(m[0]) + 1 : 0; };

// word by word, with the neighbours deciding a word that reads two ways
function byWords(s, lv) {
  const list = toks(s);
  const notes = [];
  let doubt = false;
  const buRule = [];
  const chosen = list.map((t, i) => {
    if (!t.k) return null;
    if (/^\d+$/.test(t.k)) return t.raw;
    if (ALIAS[t.k]) { notes.push('«' + t.raw + '» = ' + ALIAS[t.k] + ' (the books print it ' + (t.k === 'naer' ? 'nǎr' : 'zhèr') + ')'); return ALIAS[t.k]; }
    // 第一 dì yī: an ordinal keeps yī whatever follows
    if (t.k === 'yi' && list[i - 1] && list[i - 1].k === 'di') { notes.push('«' + t.raw + '» → yī (dì yī, an ordinal)'); return 'yī'; }
    let r = readings(t.k);
    if (!r.length) {
      if (NAMES.has(t.k)) return t.raw;
      const parts = split(t.k);
      if (parts) {
        const sub = parts.map((p) => { const rr = readings(p); if (rr.length > 1) { doubt = true; notes.push('«' + p + '» (in «' + t.raw + '») reads ' + rr.join(' / ') + ' → took ' + rr[0]); } return rr[0]; });
        if (parts[0] === 'bu' && sub.length > 1) sub[0] = toneOf(sub[1]) === 4 ? 'bú' : 'bù';
        notes.push('«' + t.raw + '» = ' + parts.join(' + ') + ' → ' + sub.join(''));
        return sub.join('');
      }
      doubt = true; notes.push('«' + t.raw + '» no source'); return null;
    }
    if (r.length === 1) return r[0];
    // the neighbours: a source sentence with the same word and the same word before / after
    const prev = list[i - 1] && list[i - 1].k, next = list[i + 1] && list[i + 1].k;
    const votes = new Map();
    for (const q of seqs) {
      for (let j = 0; j < q.list.length; j++) {
        if (q.list[j].k !== t.k) continue;
        const pm = prev && q.list[j - 1] && q.list[j - 1].k === prev, nm = next && q.list[j + 1] && q.list[j + 1].k === next;
        const w = (pm ? 1 : 0) + (nm ? 1 : 0);
        if (w) votes.set(q.list[j].toned, (votes.get(q.list[j].toned) || 0) + w * (q.level === lv ? 2 : 1));
      }
    }
    const v = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (v.length === 1 || (v.length > 1 && v[0][1] >= 3 * v[1][1])) { notes.push('«' + t.raw + '» → ' + v[0][0] + ' (its neighbours in the books)'); return v[0][0]; }
    // 不 changes by the next syllable, as the books print it (bú before a 4th tone, else bù)
    if (t.k === 'bu') { buRule.push(i); return 'bù'; }
    doubt = true;
    notes.push('«' + t.raw + '» reads ' + r.join(' / ') + (v.length ? ' (neighbours: ' + v.map((x) => x[0] + ' ' + x[1]).join(', ') + ')' : ' (no neighbour in the books)') + ' → took ' + (v.length ? v[0][0] : r[0]));
    return v.length ? v[0][0] : r[0];
  });
  buRule.forEach((i) => {
    const nx = chosen.slice(i + 1).find((c, j) => list[i + 1 + j].k && c);
    chosen[i] = toneOf(nx) === 4 ? 'bú' : 'bù';
    notes.push('«' + list[i].raw + '» → ' + chosen[i] + ' (before ' + (nx || 'nothing') + ', like the books)');
  });
  if (chosen.some((c, i) => list[i].k && c === null)) return { toned: null, how: 'none', notes, doubt: true };
  // the pack's spelling with each word's tones
  const src = list.map((t, i) => (t.k ? chosen[i] : '')).join(' ');
  return { toned: transfer(s, src), how: doubt ? 'words?' : 'words', notes, doubt };
}

// the head of a toned string holding exactly n letters, and the rest
function sliceLetters(toned, n) {
  const chars = [...String(toned).normalize('NFC')];
  let c = 0, i = 0;
  for (; i < chars.length && c < n; i++) if (letters(chars[i])) c++;
  return [chars.slice(0, i).join(''), chars.slice(i).join('')];
}
function resolveLine(s, lv, fill) {
  // the exam's own line with its blank, as the golden books print it
  const w0 = whole(s, lv);
  if (w0 && w0.toned) return w0;
  // a sentence with a blank is read whole, filled with its answer (the blank hides the neighbours: «dì ___ yī tiān»)
  if (fill && s.includes('___')) {
    const at = s.indexOf('___');
    const pre = s.slice(0, at), post = s.slice(at + 3);
    const r = resolveLine(pre + fill + post, lv);
    if (!r.toned) return r;
    const [tp, rest] = sliceLetters(r.toned, letters(pre).length);
    const tpost = sliceLetters(rest, letters(fill).length)[1];
    const a = transfer(pre, tp), b = transfer(post, tpost);
    return Object.assign({}, r, { toned: (a === null ? pre : a) + '___' + (b === null ? post : b), how: r.how + '+filled' });
  }
  const w = whole(s, lv);
  if (w && w.toned) return w;
  return byWords(s, lv);
}

// a word of the pack: the level's own base word first (same meaning, then same hanzi), then the modules, then by letters
const esKey = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
function resolveWord(x, lv) {
  const L = S.levels[lv];
  const sameL = (w) => letters(w.py) === letters(x.py);
  const pick = (w, how) => ({ toned: transfer(x.py, w.py), how });
  let w = L.words.find((y) => y.src === 'base' && sameL(y) && esKey(y.es) === esKey(x.es));
  if (w) return pick(w, 'word:base');
  if (x.hz) { w = L.words.find((y) => y.src === 'base' && y.zh === x.hz && sameL(y)); if (w) return pick(w, 'word:base-hanzi'); }
  w = L.words.find((y) => y.src !== 'base' && sameL(y) && esKey(y.es) === esKey(x.es));
  if (w) return pick(w, 'word:' + w.src);
  for (const o of levelOrder(lv).slice(1)) {
    w = S.levels[o].words.find((y) => sameL(y) && esKey(y.es) === esKey(x.es));
    if (w) return pick(w, 'word:' + w.src + ':' + o);
  }
  // same letters, one reading among the level's words → fine; several → the line resolver decides and it is listed
  const all = [...new Set(L.words.filter(sameL).map((y) => y.py.toLowerCase()))];
  if (all.length === 1) return Object.assign(pick(L.words.find(sameL), 'word:letters'), { notes: ['meaning «' + x.es + '» not in the books: tones of the same spelling'] });
  const r = resolveLine(x.py, lv);
  return Object.assign({}, r, { doubt: true, notes: (r.notes || []).concat(['word «' + x.py + '» = «' + x.es + '» not found by meaning' + (all.length ? ' (the books have ' + all.join(' / ') + ')' : '')]) });
}

// ---- text with «…» parts: only the parts that are pinyin get tones ----
function isPinyinLine(s, lv) {
  const list = toks(s);
  if (!list.length) return false;
  return list.every((t) => !t.k || /^\d+$/.test(t.k) || tokDict.has(t.k) || NAMES.has(t.k)) && !/[áéíóúñ¿¡]/i.test(strip(s) === s ? s : '') && whole(s, lv) !== undefined;
}
// Spanish words that are also pinyin syllables: a «…» made only of these is Spanish
const SPANISH = /\b(yo|y|mi|tu|es|la|el|de|en|que|se|ya|un|una|me|te|lo|le|su|no|da|a|o)\b/i;

// ---- decided by meaning (not written in the books this way): each listed in the check file for a human glance ----
// level → { exact pack string: [toned, why] }
const OVER = require('./overrides.json');
const ITEMS = require('./items.json');
function over(lv, s) {
  const [toned, why] = OVER[lv][s];
  return { toned, how: 'meaning', notes: [why], doubt: false, decided: true };
}

const untouched = [];   // «…» parts of a question left as they are (Spanish): printed for a look
// a written question: its «…» parts that are pinyin, and the simulacros' reading question after «Lees: «…»», toned;
// own(seg) → a toned part decided for this one item (from its hanzi), else the books' reading
function toneText(text, lv, fill, own, log) {
  let doubt = false; const notes = [];
  const part = (seg) => {
    const mine = own && own(seg);
    if (mine) return { toned: mine, how: 'item' };
    return OVER[lv] && OVER[lv][seg] ? over(lv, seg) : resolveLine(seg, lv, fill);
  };
  let t = text.replace(/«([^«»]+)»/g, (all, seg) => {
    if (!(own && own(seg)) && !toks(seg).every((k) => !k.k || /^\d+$/.test(k.k) || tokDict.has(k.k) || NAMES.has(k.k) || ALIAS[k.k])) { if (log) untouched.push(lv + ' «' + seg + '» in: ' + text); return all; }
    const r = part(seg);
    if (r.doubt || !r.toned) { doubt = true; notes.push(...(r.notes || []), '«' + seg + '» ' + r.how); }
    return r.toned ? '«' + r.toned + '»' : all;
  });
  const tail = /^(Lees: «[^»]*» )(.+)$/.exec(t);
  if (tail) {
    const r = part(tail[2]);
    if (r.doubt || !r.toned) { doubt = true; notes.push(...(r.notes || []), 'question «' + tail[2] + '» ' + r.how); }
    if (r.toned) t = tail[1] + r.toned;
  }
  return { toned: t, how: doubt ? 'text?' : 'text', notes, doubt };
}

// ---- per item, from the item's own hanzi (2026-10-24: 买菜 mǎi cài in one sim, 卖菜 mài cài in the next) ----
const Packs = require(path.join(repo, 'core', 'packs.js'));
const HZ = require('./hanzi');
const CK = require('./check');
// the golden book's own lines of one simulation, by their letters (the exact item, as the printed book reads it)
const _gold = {};
function goldOf(lv, n) {
  const k = lv + n;
  if (_gold[k]) return _gold[k];
  const m = new Map();
  try {
    const g = JSON.parse(fs.readFileSync(path.join(repo, 'content', 'golden', { yct1: 'yct1sim', newhsk1: 'newhsk1sim', hsk1: 'hsk1sim' }[lv] + '.json'), 'utf8'));
    const sim = (g.sims || []).find((s) => Number(s.n) === n) || (g.sims || [])[n - 1];
    (function walk(o) {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') Object.entries(o).forEach(([key, v]) => {
        if (key === 'py' && typeof v === 'string' && hasTone(v)) { const kk = letters(v); if (!m.has(kk)) m.set(kk, []); if (!m.get(kk).includes(v)) m.get(kk).push(v); }
        else if (v && typeof v === 'object') walk(v);
      });
    })(sim);
  } catch (_) { /* no golden book */ }
  return (_gold[k] = m);
}
// a source's tones on the pack's own spelling (the old HSK sets' «na'er» against the books' nǎr too)
function onto(s, src) {
  const t = transfer(s, src);
  if (t) return t;
  if (/\b(na|zhe)'er\b/i.test(s)) {
    const short = s.replace(/\b([Nn])a'er\b/g, '$1ar').replace(/\b([Zz])he'er\b/g, '$1her');
    const t2 = transfer(short, src);
    if (!t2) return null;
    const back = t2.replace(/\b([Nn][aàǎ])r\b/g, "$1'er").replace(/\b([Zz]h[eè])r\b/g, "$1'er");
    return strip(back) === strip(s) ? back : null;
  }
  return null;
}
const erLetters = (s) => letters(String(s).replace(/\b([Nn])a'er\b/g, '$1ar').replace(/\b([Zz])he'er\b/g, '$1her'));
// one string of one item: { toned, how, note } (note = why a person should look)
function itemString(lv, n, st, globalToned) {
  const s = st.s;
  const cands = [];
  const add = (src, how) => { if (!src) return; const v = onto(s, src); if (v && !cands.some((c) => c.t === v)) cands.push({ t: v, how }); };
  const gold = n ? (goldOf(lv, n).get(letters(s)) || goldOf(lv, n).get(erLetters(s)) || []) : [];
  gold.forEach((g) => add(g, 'the golden book, sim ' + n));
  add(globalToned, 'the books');
  (byLetters.get(letters(s)) || byLetters.get(erLetters(s)) || []).forEach((x) => add(x.t, 'the books (' + x.src + ', ' + x.level + ')'));
  if (st.hz) {
    const sy = CK.fromHanzi(s, st.hz);
    if (sy && sy.every(Boolean)) add(sy.join(' '), 'its hanzi (pypinyin)');
    const rated = cands.map((c) => Object.assign({}, c, { r: CK.readsAs(c.t, st.hz) }));
    // the golden book's line of this very item first, when it reads this hanzi; then any reading that fits it
    const g = rated.filter((c) => c.how.startsWith('the golden book') && c.r.hard);
    const pick = g.find((c) => c.r.ctx) || g[0] || rated.find((c) => c.r.ok) || rated.find((c) => c.r.hard);
    if (!pick) return { toned: globalToned || null, how: 'no reading fits ' + st.hz, note: 'no source reads ' + st.hz + ': ' + rated.map((c) => c.t + ' (' + c.r.problems.join('; ') + ')').join(' · ') };
    return { toned: pick.t, how: pick.how + ' · ' + st.hz, note: pick.r.ctx ? null : 'context: ' + pick.r.problems.join('; ') };
  }
  // no hanzi (old HSK's reading words): the golden book of this sim when it prints one reading, else the books
  const g = cands.filter((c) => c.how.startsWith('the golden book'));
  if (g.length === 1) return { toned: g[0].t, how: g[0].how };
  if (g.length > 1) return { toned: globalToned || g[0].t, how: 'the books', note: 'the golden book of sim ' + n + ' prints it ' + g.map((c) => c.t).join(' and ') };
  return { toned: globalToned || null, how: 'the books' };
}
// a fill-in's answer as its own sentence reads it (the blank filled), when the books read it surely
function fillTone(s, a, lv) {
  if (!s || !a || !s.includes('___')) return null;
  const at = s.indexOf('___');
  const pre = s.slice(0, at), post = s.slice(at + 3);
  const r = resolveLine(pre + a + post, lv);
  if (!r.toned || /\?/.test(r.how)) return null;
  const rest = sliceLetters(r.toned, letters(pre).length)[1];
  const mid = sliceLetters(rest, letters(a).length)[0];
  return transfer(a, mid);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const check = [];
  const stats = {};
  for (const lv of Object.keys(E)) {
    const out = { about: 'The pinyin WITH tone marks the pin games show for ' + lv + ' (his rule 2026-10-24), keyed by the pack\'s own plain text: words by «pinyin|meaning», lines and written questions by their exact text, items = a tile that reads differently in one question. Copied from the books (La Base content/audios/' + lv + '-base.json first, then the vocabulary modules roblox/shared*/…Vocab.lua, then the golden book content/golden/), letter by letter onto the pack\'s spelling; where they differ or are silent, a word\'s neighbours in the books decide, and anything decided by meaning is listed in the hand-back\'s tones check (2026-10-24). A new pack line needs its entry here: scripts/test-pack-tones.js says which.', words: {}, lines: {}, texts: {} };
    const st = stats[lv] = { words: 0, lines: 0, texts: 0, doubt: 0, none: 0, how: {} };
    const note = (kind, s, r, where, extra) => {
      st.how[r.how.split(':').slice(0, 2).join(':')] = (st.how[r.how.split(':').slice(0, 2).join(':')] || 0) + 1;
      if (r.doubt || !r.toned || r.alt || r.decided) {
        if (!r.toned) st.none++; else st.doubt++;
        check.push({ level: lv, kind, s, toned: r.toned, how: r.how, notes: r.notes || [], alt: r.alt || null, where: (where || []).slice(0, 3), extra });
      }
    };
    for (const x of E[lv].words) {
      const r = resolveWord(x, lv);
      st.words++;
      if (r.toned && strip(r.toned) === strip(x.py)) out.words[x.py + '|' + x.es] = r.toned;
      note('word', x.py, r, x.where, '«' + x.es + '»' + (x.hz ? ' ' + x.hz : ''));
    }
    for (const x of E[lv].lines) {
      st.lines++;
      const r = OVER[lv] && OVER[lv][x.s] ? over(lv, x.s) : resolveLine(x.s, lv, x.fill);
      if (r.toned && strip(r.toned) === strip(x.s)) out.lines[x.s] = r.toned;
      note('line', x.s, r, x.where);
    }
    for (const x of E[lv].texts) {
      st.texts++;
      const r = toneText(x.s, lv, x.fill, null, true);
      if (strip(r.toned) === strip(x.s)) out.texts[x.s] = r.toned;
      note('text', x.s, r, x.where);
    }
    // per item (core/packs.js looks up T.items['<world>/<round>|<item text>']): every simulacro item from its own hanzi
    // and its sim's golden book, a fill-in's answer as its own sentence reads it, and the tiles decided by meaning
    // (items.json). The maps above stay for everything else (the authored lines of the regular worlds have no hanzi).
    out.items = {};
    const level = Packs.LEVELS.find((l) => l.id === lv);
    const levelWords = level.worlds.flatMap((w) => w.rounds.flatMap((r) => r.words || []));
    const usedItems = new Set();
    for (const x of HZ.levelItems(level)) {
      const n = x.world === 'simulacro' && /^s(\d+)/.test(x.round) ? Number(/^s(\d+)/.exec(x.round)[1]) : 0;
      const it = x.it;
      const fill = it.k === 'f' || /___/.test(it.t || '') ? it.a : null;
      const entry = {};
      const segs = new Map();
      // what a room showed before this pass (the maps above, as core/packs.js read them)
      const shownBefore = (st0) => {
        if (st0.role.endsWith(':seg')) return OVER[lv] && OVER[lv][st0.s] ? OVER[lv][st0.s][0] : resolveLine(st0.s, lv, fill).toned;
        if (it.k === 'w' && st0.role === 'line') {
          const word = levelWords.find((y) => Packs.plain(y.py) === Packs.plain(it.py) && !y.gram && (!it.es || y.es === it.es));
          if (word && word.py === it.py && out.words[word.py + '|' + word.es]) return out.words[word.py + '|' + word.es];
        }
        return out.lines[st0.s];
      };
      if (n || x.strings.some((s) => s.hz)) {
        for (const st0 of x.strings) {
          if (!letters(st0.s)) continue;
          const was = shownBefore(st0);
          const r = itemString(lv, n, st0, was);
          if (!r.toned || strip(r.toned) !== strip(st0.s)) {
            check.push({ level: lv, kind: 'item', s: st0.s, toned: r.toned || null, was: was || null, how: r.how, notes: [r.note || 'no toned form'], where: [x.key], hz: st0.hz || null });
            continue;
          }
          if (st0.role.endsWith(':seg')) segs.set(st0.s, r.toned); else entry[st0.s] = r.toned;
          const changed = !!was && was !== r.toned;
          if (changed || r.note) check.push({ level: lv, kind: 'item', s: st0.s, toned: r.toned, was: was || null, how: r.how, notes: r.note ? [r.note] : [], where: [x.key], changed, hz: st0.hz || null });
        }
        if (it.t) { const tt = toneText(it.t, lv, fill, (seg) => segs.get(seg), false); if (strip(tt.toned) === strip(it.t)) entry[it.t] = tt.toned; }
      } else if (it.k === 'f') {
        const a = fillTone(it.s, it.a, lv);
        const was = out.lines[it.a];
        if (a && was && a !== was) {
          entry[it.a] = a;
          check.push({ level: lv, kind: 'item', s: it.a, toned: a, was, how: 'its own sentence', notes: ['the answer of «' + it.s + '», read with the blank filled'], where: [x.key], changed: true });
        }
      }
      // decided by meaning (items.json, by the item's text): over everything else
      const mine = (ITEMS[lv] || {})[HZ.itemText(it)];
      if (mine) {
        usedItems.add(HZ.itemText(it));
        Object.entries(mine).forEach(([a, toned]) => {
          if (strip(toned) !== strip(a)) throw new Error('items.json ' + lv + ' «' + HZ.itemText(it) + '»: ' + toned + ' is not ' + a);
          const was = entry[a] || out.lines[a];
          entry[a] = toned;
          check.push({ level: lv, kind: 'tile', s: a, toned, was: was || null, how: 'meaning', notes: ['in «' + HZ.itemText(it) + '» (the particle 吧; elsewhere «' + a + '» is ' + (out.lines[a] || a) + ')'], where: [x.key] });
        });
      }
      if (Object.keys(entry).length) out.items[x.key] = entry;
    }
    Object.keys(ITEMS[lv] || {}).forEach((k) => { if (!usedItems.has(k)) throw new Error('items.json ' + lv + ': «' + k + '» is no item of the pack'); });
    // the sweep: a spelling that is two words of this level (mai 买 / 卖, hao 好 / 号…) shown alone in an item with no
    // hanzi (the regular worlds): listed with what the game shows, so a person sees every one
    const spell = new Map();
    E[lv].words.forEach((w) => {
      const t = out.words[w.py + '|' + w.es];
      if (!t) return;
      const k = Packs.plain(w.py);
      if (!spell.has(k)) spell.set(k, new Map());
      const m = spell.get(k), tl = t.toLowerCase();
      m.set(tl, (m.get(tl) || []).concat([w.es]));
    });
    for (const x of HZ.levelItems(level)) {
      if (x.world === 'simulacro' || x.strings.some((s) => s.hz)) continue;
      const it = x.it;
      for (const st0 of x.strings) {
        const m = spell.get(Packs.plain(st0.s));
        if (!m || m.size < 2) continue;
        const seg = st0.role.endsWith(':seg');
        const fill = it.k === 'f' || /___/.test(it.t || '') ? it.a : null;
        const shown = (out.items[x.key] || {})[st0.s] || (seg ? (OVER[lv] && OVER[lv][st0.s] ? OVER[lv][st0.s][0] : resolveLine(st0.s, lv, fill).toned) : out.lines[st0.s]) || st0.s;
        const answer = !seg && st0.role !== 'line' && (it.k === 'r' ? it.b : it.a) === st0.s;
        const why = seg || st0.role === 'line' ? 'the asked word: the books\' reading of that line'
          : (out.items[x.key] || {})[st0.s] ? 'this item: ' + (answer ? 'the answer read in its own sentence' : 'decided by meaning')
          : answer ? 'the answer: the books\' reading of the whole line' : 'a wrong tile: the level\'s book reading of that spelling';
        check.push({ level: lv, kind: 'sweep', s: st0.s, toned: shown, how: why, answer, notes: [[...m.entries()].map(([t, es]) => t + ' = ' + es.join(' / ')).join(' · ')], where: [x.key], q: HZ.itemText(it) });
      }
    }
    // the pack's words with their own hanzi read them (the meaning chose the reading)
    for (const x of E[lv].words) {
      const t = out.words[x.py + '|' + x.es];
      if (!x.hz || !t) continue;
      const r = CK.readsAs(t, x.hz);
      if (!r.ok) check.push({ level: lv, kind: 'wordhz', s: x.py, toned: t, how: 'word', notes: [(r.hard ? 'context: ' : 'NOT ITS HANZI: ') + r.problems.join('; ')], where: x.where.slice(0, 2), hz: x.hz, extra: '«' + x.es + '» ' + x.hz });
    }
    fs.writeFileSync(path.join(outDir, lv + '-tones.json'), JSON.stringify(out, null, 1));
  }
  fs.writeFileSync(checkFile, JSON.stringify(check, null, 1));
  console.log('the list to look at: ' + checkFile);
  console.log(JSON.stringify(stats, null, 1));
  console.log('left as Spanish:\n  ' + untouched.join('\n  '));
  console.log('to check:', check.length);
}
main();
