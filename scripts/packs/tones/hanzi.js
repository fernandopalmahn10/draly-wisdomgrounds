// The hanzi behind each pinyin string a pin game shows, per item (2026-10-24, the coordinator's accuracy fix: the
// plain «mai cai» is 买菜 mǎi cài in New HSK 1 sim 1 L2-9 and 卖菜 mài cài in sim 2 R4-38, so a sim item's tones are
// decided from ITS OWN hanzi, never from one map per spelling).
//   · the simulacro rounds come from the official sims, which carry every line, option and bank word in hanzi:
//     YCT 1 core/yct/yct1-sim<n>.json, New HSK 1 core/yct/newhsk1-sim<n>.json, old HSK 1 core/hsk-sim.js (its reading
//     part; the pack keeps the reading questions 21-40); a pack string is matched by its letters inside ITS sim only
//   · the words carry their own hanzi (`hz`: YCT 1 and New HSK 1; old HSK 1's words have none)
//   · a question about numbers («¿Cuánto es «shi» − «si»?»): its parts and number tiles are 十, 四… (2026-10-24 the
//     global map showed «shì» − «sì», 是 minus 四)
//   · the regular worlds' authored lines have no hanzi: their tones come from the books (resolve.js), and a fill-in
//     answer is read inside its own sentence
// itemKey(world, round, it) is the key core/packs.js looks up (T.items): one entry per item of a round.
// node scripts/packs/tones/hanzi.js [--list <file>]   (--list: every hanzi string, for readings.py)
'use strict';
const fs = require('fs');
const path = require('path');
const { letters } = require('./sources');

const itemText = (it) => it.s || it.t || it.a || it.py || '';
const itemKey = (world, round, it) => world.id + '/' + round.id + '|' + itemText(it);
const isHan = (c) => /\p{Script=Han}/u.test(c);

// every {hanzi, pinyin} pair of a sim (any depth), plus the two halves of a heard «… Wen: …» / «…问：…» line and a
// dialogue's lines joined the way the packs join them (« — »)
function units(sim) {
  const out = [];
  const add = (hz, py, where) => { if (hz && py && letters(py)) out.push({ hz: String(hz), py: String(py), k: letters(py), where }); };
  (function walk(o, where) {
    if (Array.isArray(o)) {
      o.forEach((x, i) => walk(x, where));
      const lines = o.filter((x) => x && typeof x === 'object' && typeof x.hanzi === 'string' && typeof x.pinyin === 'string');
      if (lines.length > 1 && lines.length === o.length) add(lines.map((x) => x.hanzi).join(' — '), lines.map((x) => x.pinyin).join(' — '), where + ' (joined)');
      return;
    }
    if (!o || typeof o !== 'object') return;
    const w = o.qid || o.id || (o.num != null ? 'n' + o.num : '') || where;
    if (typeof o.hanzi === 'string' && typeof o.pinyin === 'string') {
      add(o.hanzi, o.pinyin, w);
      const p = String(o.pinyin).split(/\s*W[eè]n\s*:\s*/i), h = String(o.hanzi).split(/\s*问[：:]\s*/);
      if (p.length === 2 && h.length === 2) { add(h[0], p[0], w + ' said'); add(h[1], p[1], w + ' asked'); }
    }
    Object.entries(o).forEach(([k, v]) => { if (v && typeof v === 'object') walk(v, w || where); });
  })(sim, '');
  return out;
}

const _sims = {};
function simOf(levelId, n) {
  const key = levelId + n;
  if (key in _sims) return _sims[key];
  const repo = path.join(__dirname, '..', '..', '..');
  let sim = null;
  try {
    if (levelId === 'hsk1') sim = require(path.join(repo, 'core', 'hsk-sim.js')).SIMULATIONS['hsk1-sim' + n] || null;
    else sim = JSON.parse(fs.readFileSync(path.join(repo, 'core', 'yct', levelId + '-sim' + n + '.json'), 'utf8'));
  } catch (_) { sim = null; }
  _sims[key] = sim ? { n, units: units(sim) } : null;
  return _sims[key];
}
const simNumber = (world, round) => (world.id === 'simulacro' && /^s(\d+)/.test(round.id) ? Number(/^s(\d+)/.exec(round.id)[1]) : 0);

// the hanzi of one pack string inside a sim: a unit with the same letters (one hanzi, or several when the sim spells two
// different things the same way: then `amb` lists them), or its « — » parts one by one; null when the sim has none
function find(sim, s) {
  if (!sim || !s) return null;
  const k = letters(s);
  if (!k) return null;
  // the same Han characters with other punctuation («谢谢» / «谢谢。», a dialogue's line alone or joined to «— 7:15。») are one
  const han = (h) => [...h].filter(isHan).join('');
  const byHan = new Map();
  sim.units.filter((u) => u.k === k).forEach((u) => { const h = han(u.hz); if (!byHan.has(h) || u.hz.length < byHan.get(h).length) byHan.set(h, u.hz); });
  const hits = [...byHan.values()];
  if (hits.length === 1) return { hz: hits[0] };
  if (hits.length > 1) return { hz: hits[0], amb: hits };
  if (/ — /.test(s)) {
    const parts = s.split(' — ').map((p) => find(sim, p));
    if (parts.every((p) => p && !p.amb)) return { hz: parts.map((p) => p.hz).join(' — ') };
  }
  return null;
}

// a question about numbers (its «…» parts are number words: «¿Cuánto es «shi» − «si»?»): its parts and number tiles are
// numbers, whatever the spelling means elsewhere (shi 十, not 是; ba 八, not 吧)
const NUM = { ling: '零', yi: '一', er: '二', san: '三', si: '四', wu: '五', liu: '六', qi: '七', ba: '八', jiu: '九', shi: '十' };
const numHz = (s) => { const w = String(s || '').toLowerCase().split(/[\s']+/).filter(Boolean); return w.length && w.every((x) => NUM[x]) ? w.map((x) => NUM[x]).join('') : null; };
const numberQuestion = (it) => { const segs = ((it.t || '').match(/«([^«»]+)»/g) || []).map((x) => x.slice(1, -1)); return segs.length > 0 && segs.every((x) => numHz(x)); };

// one item's strings with their hanzi: [{ role, s, hz, amb }] (texts: their «…» parts and the «Lees» question)
function itemStrings(level, world, round, it) {
  const sim = simOf(level.id, simNumber(world, round));
  const nums = numberQuestion(it);
  const out = [];
  const one = (role, s) => {
    if (!s) return;
    if (nums && numHz(s)) { out.push({ role, s, hz: numHz(s), amb: null, num: true }); return; }
    const f = find(sim, s);
    out.push({ role, s, hz: f ? f.hz : null, amb: f && f.amb ? f.amb : null });
  };
  const text = (role, t) => {
    if (!t) return;
    const segs = [];
    t.replace(/«([^«»]+)»/g, (all, seg) => { segs.push(seg); return all; });
    const tail = /^Lees: «[^»]*» (.+)$/.exec(t);
    if (tail) segs.push(tail[1]);
    segs.forEach((seg) => one(role + ':seg', seg));
  };
  if (it.k === 'w' || it.k === 'm') one('line', it.py);
  else if (it.k === 'r') { one('line', it.a); one('tile', it.b); (it.w || []).forEach((x) => one('tile', x)); }
  else if (it.k === 'f') { one('line', it.s); text('text', it.t); one('tile', it.a); (it.bank || []).forEach((x) => one('tile', x)); }
  else { text('text', it.t); one('tile', it.a); (it.w || []).forEach((x) => one('tile', x)); }
  return out;
}

// every item of a level with its strings: [{ key, world, round, it, strings }]
function levelItems(level) {
  const out = [];
  for (const world of level.worlds) for (const round of world.rounds) for (const it of round.items || []) {
    out.push({ key: itemKey(world, round, it), world: world.id, round: round.id, it, strings: itemStrings(level, world, round, it) });
  }
  return out;
}

module.exports = { itemKey, itemText, levelItems, units, simOf, find, isHan };

if (require.main === module) {
  const Packs = require(path.join(__dirname, '..', '..', '..', 'core', 'packs.js'));
  const argv = process.argv.slice(2);
  const all = new Set();
  const stats = {};
  for (const level of Packs.LEVELS) {
    const st = stats[level.id] = { items: 0, withHz: 0, strings: 0, hz: 0, amb: 0, simNoHz: 0, words: 0, wordsHz: 0 };
    for (const x of levelItems(level)) {
      st.items++;
      if (x.strings.some((s) => s.hz)) st.withHz++;
      x.strings.forEach((s) => {
        st.strings++;
        if (s.hz) { st.hz++; all.add(s.hz); }
        if (s.amb) { st.amb++; console.log('two hanzi for one spelling in', x.key, '«' + s.s + '»:', s.amb.join(' / ')); }
        if (!s.hz && x.world === 'simulacro') { st.simNoHz++; if (argv.includes('--missing')) console.log('no hanzi', level.id, x.key, s.role, '«' + s.s + '»'); }
      });
    }
    for (const world of level.worlds) for (const round of world.rounds) for (const w of round.words || []) { st.words++; if (w.hz) { st.wordsHz++; all.add(w.hz); } }
  }
  console.log(JSON.stringify(stats));
  const li = argv.indexOf('--list');
  if (li >= 0) { fs.writeFileSync(argv[li + 1], JSON.stringify([...all].sort(), null, 0)); console.log('hanzi strings:', all.size, '→', argv[li + 1]); }
}
