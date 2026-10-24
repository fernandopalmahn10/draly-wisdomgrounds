// Does a toned pinyin string read its hanzi? (2026-10-24, per item: 买菜 is mǎi cài, 卖菜 mài cài, whatever the pack's
// plain «mai cai» means elsewhere.) The syllables are lined up with the Han characters by their letters (each
// character's readings in hanzi-readings.json; 儿 may be the «r» of nǎr), then each syllable is checked twice:
//   · hard: its tone is one this character has with these letters (买 only mǎi), or no mark (a neutral tone the books
//     print: dōngxi, xǐhuan); 一 yī / yí / yì and 不 bù / bú as the books change them
//   · context: a character with several readings reads here the way pypinyin reads it inside this phrase (爱好 hào,
//     你好 hǎo); a neutral tone and 一 / 不 pass, and so do the readings a person checked in reviewed.json (pypinyin reads
//     长头发 zhǎng and 两只 zhǐ; the books' cháng and zhī are right)
// readsAs(toned, hz) → { ok, hard, ctx, problems: [..], reviewed: [..], missing }   (missing: not in the readings file)
'use strict';
const path = require('path');
const R = require('./hanzi-readings.json');
const REV = require('./reviewed.json');   // readings a person checked where pypinyin's context reading is wrong

const isHan = (c) => /\p{Script=Han}/u.test(c);
const TONE = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
const plainLetters = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const toneOf = (s) => { const m = /[̀́̄̌]/.exec(String(s || '').normalize('NFD')); return m ? TONE[m[0]] : 0; };

// the letters of a toned string, each with the tone mark it carries (0 = none)
function syl(toned) {
  const out = [];
  const d = String(toned || '').normalize('NFD');
  for (const c of d) {
    if (/[a-z]/i.test(c)) out.push({ b: c.toLowerCase(), t: 0 });
    else if (TONE[c] && out.length) out[out.length - 1].t = TONE[c];
  }
  return out;
}

function readsAs(toned, hz) {
  const P = syl(toned);
  const H = [...String(hz || '')].filter((c) => isHan(c));
  const res = { ok: false, hard: false, ctx: false, problems: [], missing: [], reviewed: [] };
  const opts = H.map((c) => {
    const r = R.chars[c];
    if (!r) { res.missing.push(c); return []; }
    const L = [...new Set(r.map(plainLetters))];
    if (c === '儿') L.push('r');
    return L.sort((a, b) => b.length - a.length);
  });
  const ctx = R.ctx[hz];
  if (!ctx) res.missing.push('«' + hz + '»');
  if (res.missing.length) { res.problems.push('not in hanzi-readings.json: ' + res.missing.join(' ') + ' (run readings.py)'); return res; }
  // line the letters up with the characters (first fit, longest reading first)
  const memo = new Map();
  function fit(i, j) {
    const k = i + ',' + j;
    if (memo.has(k)) return memo.get(k);
    let r = null;
    if (j === H.length) r = i === P.length ? [] : null;
    else for (const L of opts[j]) {
      if (P.slice(i, i + L.length).map((x) => x.b).join('') !== L) continue;
      const rest = fit(i + L.length, j + 1);
      if (rest) { r = [{ c: H[j], L, t: Math.max(0, ...P.slice(i, i + L.length).map((x) => x.t)) }].concat(rest); break; }
    }
    memo.set(k, r);
    return r;
  }
  const spans = fit(0, 0);
  if (!spans) {
    if (REV.mismatch[hz]) { res.ok = res.hard = res.ctx = true; res.reviewed.push('mismatch: ' + REV.mismatch[hz]); return res; }
    res.problems.push('the letters do not line up with ' + hz);
    return res;
  }
  let hard = true, cx = true;
  spans.forEach((s, j) => {
    const readings = R.chars[s.c];
    const allowed = new Set([0].concat(readings.filter((r) => plainLetters(r) === s.L).map(toneOf)));
    if (s.c === '一') [1, 2, 4].forEach((t) => allowed.add(t));
    if (s.c === '不') [2, 4].forEach((t) => allowed.add(t));
    if (!allowed.has(s.t)) { hard = false; res.problems.push(s.c + ' ' + s.L + s.t + ' is not a reading of ' + s.c + ' (' + readings.join(' ') + ')'); }
    if (s.c === '儿' || s.c === '一' || s.c === '不' || s.t === 0) return;
    const want = ctx[j];
    if (plainLetters(want) !== s.L || toneOf(want) !== s.t) {
      const k = s.c + ' ' + s.L + s.t;
      const why = REV.chars[k] || (REV.phrases[hz] && REV.phrases[hz][k]);
      if (why) res.reviewed.push(k + ': ' + why);
      else { cx = false; res.problems.push(s.c + ' reads ' + want + ' in ' + hz + ', shown ' + s.L + s.t); }
    }
  });
  res.hard = hard; res.ctx = cx; res.ok = hard && cx; res.spans = spans;
  return res;
}

// the reading pypinyin gives this phrase, on the pack's own letters (null when the letters do not line up)
function fromHanzi(plain, hz) {
  const H = [...String(hz || '')].filter((c) => isHan(c));
  const ctx = R.ctx[hz];
  if (!ctx) return null;
  const r = readsAs(plain, hz);
  if (!r.spans) return null;
  return r.spans.map((s, j) => (s.c === '儿' && s.L === 'r' ? 'r' : plainLetters(ctx[j]) === s.L ? ctx[j] : null));
}

module.exports = { readsAs, fromHanzi, isHan, plainLetters, toneOf };
