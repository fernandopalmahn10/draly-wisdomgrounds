// Toned forms for every pinyin string the pin games show, from the books' own data (sources.js), never invented:
//   1 a whole match: a source line (or word) with exactly the same letters → its tones copied letter by letter onto the
//     pack's own spelling (spaces, capitals and punctuation stay the pack's, so «toned stripped of tones = plain» holds)
//   2 word by word: each word's tones from the sources; a word with more than one reading (hao/hào, shi/shí, yi/yí/yì…)
//     is decided by its neighbours in the books' sentences, else it is listed for a human check
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
      let doubt = false; const notes = [];
      // «…» parts, and the simulacros' reading question after «Lees: «…»»
      let t = x.s.replace(/«([^«»]+)»/g, (all, seg) => {
        if (!toks(seg).every((k) => !k.k || /^\d+$/.test(k.k) || tokDict.has(k.k) || NAMES.has(k.k) || ALIAS[k.k])) { untouched.push(lv + ' «' + seg + '» in: ' + x.s); return all; }
        const r = OVER[lv] && OVER[lv][seg] ? over(lv, seg) : resolveLine(seg, lv, x.fill);
        if (r.doubt || !r.toned) { doubt = true; notes.push(...(r.notes || []), '«' + seg + '» ' + r.how); }
        return r.toned ? '«' + r.toned + '»' : all;
      });
      const tail = /^(Lees: «[^»]*» )(.+)$/.exec(t);
      if (tail) {
        const r = resolveLine(tail[2], lv);
        if (r.doubt || !r.toned) { doubt = true; notes.push(...(r.notes || []), 'question «' + tail[2] + '» ' + r.how); }
        if (r.toned) t = tail[1] + r.toned;
      }
      if (strip(t) === strip(x.s)) out.texts[x.s] = t;
      const r = { toned: t, how: doubt ? 'text?' : 'text', notes, doubt };
      note('text', x.s, r, x.where);
    }
    // a tile that reads differently in one question (吧 ba in the particle fill-ins, 八 bā in a sum): per question,
    // keyed by the item's sentence (f), written question (q) or line (r)
    out.items = {};
    Object.entries(ITEMS[lv] || {}).forEach(([key, tiles]) => {
      Object.entries(tiles).forEach(([a, toned]) => {
        if (strip(toned) !== strip(a)) throw new Error('items.json ' + lv + ' ' + key + ': ' + toned + ' is not ' + a);
        (out.items[key] = out.items[key] || {})[a] = toned;
        check.push({ level: lv, kind: 'tile', s: a, toned, how: 'meaning', notes: ['in «' + key + '» (the particle 吧; elsewhere «' + a + '» is ' + (out.lines[a] || a) + ')'], where: [] });
      });
    });
    fs.writeFileSync(path.join(outDir, lv + '-tones.json'), JSON.stringify(out, null, 1));
  }
  fs.writeFileSync(checkFile, JSON.stringify(check, null, 1));
  console.log('the list to look at: ' + checkFile);
  console.log(JSON.stringify(stats, null, 1));
  console.log('left as Spanish:\n  ' + untouched.join('\n  '));
  console.log('to check:', check.length);
}
main();
