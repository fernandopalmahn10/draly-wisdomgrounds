#!/usr/bin/env node
// Rules test for 6-7 Swing v2 «La Balanza de Oro» (core/sixseven.js): the sum generator (every answer is 6 or 7, only
// the numbers 1-10 and + / −, the pinyin words (with tone marks since 2026-10-24), the three styles, 6 and 7 equally likely, never the
// same sum twice in a row), what a phone gets (never the answer), the judge (right / wrong / time up / too fast, the
// streak multiplier, the waits, «¡Respira!» after two wrong in a row), team split + late joiners + size weighting,
// golden sums and the comeback cap, the frenzy ×2, lead hysteresis + alarm gap, the landmark race, rescale, pause
// shifts and «+30 s», bonus stars (ties, zeros, skipped categories) and the end payload. Then the anti-spam claim with
// simulated kids (a masher and a guesser against kids who think), and 300 simulated classes where all the gold adds up.
//   node scripts/test-sixseven.js
'use strict';
const assert = require('assert');
const M = require('../core/sixseven');
const { R } = M;
const mulberry32 = require('../core/mochi').mulberry32;

let checks = 0;
const ok = (c, msg) => { checks++; assert.ok(c, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };

const kid = (team, extra) => Object.assign({ team, disconnected: false, ssId: 0, name: 'k' }, extra || {});
let nextK = 1;
function room(nRed, nGold) {
  const players = {};
  for (let i = 0; i < nRed; i++) players['r' + i] = kid('red', { ssId: nextK++, name: 'R' + i });
  for (let i = 0; i < nGold; i++) players['g' + i] = kid('gold', { ssId: nextK++, name: 'G' + i });
  return players;
}
function game(players, dur, now, style, seed) {
  const m = M.newGame(seed || 12345, dur || 120, now || 0, M.teamSizes(players), style || 'mix');
  Object.values(players).forEach((p) => M.resetKid(p, m));
  return m;
}
const valueOf = (e) => (e.op === '+' ? e.a + e.b : e.a - e.b);

// ---------- the sums ----------
{
  // (2026-10-24, his rule: pinyin WITH tone marks in the pin games) the number words 0-10, each with its own tone
  const bare = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  eq(M.PINYIN.map(bare), ['ling', 'yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu', 'shi'], 'the number words 0-10 in pinyin');
  ok(M.PINYIN.every((w) => /[\u0300-\u036f]/.test(w.normalize('NFD'))), 'pinyin WITH tone marks (the pin games\' rule since 2026-10-24)');
  eq(M.POOL.length, 18, 'every sum with answer 6 or 7 and numbers 1-10: 11 additions + 7 subtractions');
  M.POOL.forEach((e) => {
    ok(e.ans === 6 || e.ans === 7, 'answer 6 or 7');
    ok(valueOf(e) === e.ans, `${e.a}${e.op}${e.b} = ${e.ans}`);
    ok(e.a >= 1 && e.a <= 10 && e.b >= 1 && e.b <= 10, 'operands 1-10');
    ok(e.op === '+' || e.op === '-', 'only + and −');
  });
  ok(!M.POOL.some((e) => e.a === 0 || e.b === 0), 'no zero (YCT 1 counts 1-10)');
  for (const style of ['num', 'zh', 'mix']) {
    const rng = mulberry32(7);
    let prev = null, six = 0, sub = 0, zh = 0;
    const N = 20000;
    for (let n = 0; n < N; n++) {
      const q = M.makeQuestion(rng, style, n, prev);
      ok(q.ans === 6 || q.ans === 7, 'answer 6 or 7');
      ok(valueOf(q) === q.ans, 'the sum adds up');
      ok(q.a >= 1 && q.a <= 10 && q.b >= 1 && q.b <= 10, 'operands 1-10');
      ok(q.key !== prev, 'never the same sum twice in a row');
      prev = q.key;
      if (q.ans === 6) six++;
      if (q.op === '-') sub++;
      if (q.zh) {
        zh++;
        ok(q.text === `${M.PINYIN[q.a]} ${q.op === '+' ? '+' : M.MINUS} ${M.PINYIN[q.b]}`, 'En Chino: pinyin words');
        ok(/^\p{L}+ [+−] \p{L}+$/u.test(q.text), 'no digits in an En Chino sum (words with their tones)');
      } else {
        ok(/^\d+ [+−] \d+$/.test(q.text), 'Números: digits');
      }
      if (style === 'num') ok(!q.zh, 'Números never writes pinyin');
      if (style === 'zh') ok(q.zh, 'En Chino always writes pinyin');
      if (style === 'mix') ok(q.zh === (n % 2 === 1), 'Mezcla alternates digits and pinyin');
    }
    ok(Math.abs(six / N - 0.5) < 0.02, `6 and 7 equally likely (${style}: ${(100 * six / N).toFixed(1)} % sixes): a guess is right half the time`);
    ok(Math.abs(sub / N - 0.4) < 0.02, `subtraction 40 % (${(100 * sub / N).toFixed(1)} %)`);
    if (style === 'mix') ok(zh === N / 2, 'Mezcla: half pinyin');
  }
  eq(M.cleanStyle('zh'), 'zh', 'a known style');
  eq(M.cleanStyle('<script>'), 'mix', 'an unknown style → Mezcla');
  eq(M.cleanStyle(undefined), 'mix', 'no style → Mezcla');
}

// ---------- what a phone gets, and the judge ----------
{
  const pl = room(2, 2);
  const m = game(pl, 120, 0, 'mix');
  M.startPlay(m, 0);
  const p = pl.r0;
  const q = M.deal(m, p, 1000);
  eq(q.answers, ['6', '7'], 'two buttons, always 6 then 7');
  eq(q.gameMode, 'sixseven', 'the phone knows it is a 6-7 sum');
  ok(!('ans' in q) && !('ans' in q.ss) && !JSON.stringify(q).includes('"ans"'), 'the answer never travels to the phone');
  ok(q.text.endsWith(' = ?'), 'the text ends in «= ?»');
  ok(q.ss.ms === R.Q_MS, 'the phone\'s clock');
  ok(p.ssQ && (p.ssQ.ans === 6 || p.ssQ.ans === 7), 'the answer stays on the server');
  eq(M.answer(m, pl.g0, 6, 1000), null, 'no open sum → null');
  // a tap faster than anybody reads = wrong, even on the right button
  const tf = M.answer(m, p, p.ssQ.ans, 1000 + R.MIN_THINK_MS - 1);
  ok(!tf.right && tf.tooFast && tf.coins === 0, 'a too-fast tap is wrong even when it hits the right number');
  eq(tf.wait, R.WRONG_MS, 'a wrong answer waits WRONG_MS');
  ok(p.ssNextQAt === 1000 + R.MIN_THINK_MS - 1 + R.WRONG_MS, 'the next sum after the wait');
  eq(p.ssStreak, 0, 'the streak is lost');
  // a second wrong in a row waits longer («¡Respira!»)
  M.deal(m, p, 5000);
  const w2 = M.answer(m, p, p.ssQ.ans === 6 ? 7 : 6, 6500);
  ok(!w2.right && w2.calm && w2.wait === R.WRONG2_MS, 'two wrong in a row: the longer wait');
  // time up
  M.deal(m, p, 10000);
  const tu = M.answer(m, p, null, 10000 + R.Q_MS);
  ok(!tu.right && tu.timeUp && tu.calm, 'time up is a wrong answer (the third in a row)');
  // right answers: the streak multiplier ×1 ×1 ×2 ×2 ×2 ×3 … ×3 ×4
  const want = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4];
  let t = 20000, total = 0;
  m.rng = () => 0.99;                                   // no golden sums here
  want.forEach((mult, i) => {
    M.deal(m, p, t);
    const r = M.answer(m, p, p.ssQ.ans, t + 1500);
    ok(r.right && r.streak === i + 1, 'right, streak ' + (i + 1));
    eq(r.mult, mult, `streak ${i + 1} → ×${mult}`);
    eq(r.coins, mult, 'coins = the multiplier');
    eq(r.wait, R.RIGHT_MS, 'a right answer: the short beat');
    total += r.coins;
    eq(r.total, total, 'running total');
    t += 3000;
  });
  eq(p.ssBest, 12, 'best streak');
  eq(p.ssMisses, 0, 'a right answer clears the «¡Respira!» count');
  // the frenzy doubles
  m.frenzy = true;
  M.deal(m, p, t);
  const fr = M.answer(m, p, p.ssQ.ans, t + 900);
  eq(fr.coins, 8, 'streak 13 in the frenzy: ×4 ×2 = 8');
  m.frenzy = false;
  // fastest answer: only human times count
  ok(p.ssFast >= R.FAST_MIN_MS, 'the fastest time is a human one');
  // an En Chino right answer counts for «Experto en Chino»
  const zh0 = p.ssZh;
  let tries = 0;
  while (tries++ < 10) { M.deal(m, p, t += 3000); const zh = p.ssQ.zh; M.answer(m, p, p.ssQ.ans, t + 1000); if (zh) break; }
  ok(p.ssZh === zh0 + 1, 'right on a pinyin sum: +1 en chino');
}

// ---------- teams, late joiners, weighting ----------
{
  const pl = room(3, 2);
  eq(M.teamSizes(pl), { red: 3, gold: 2 }, 'sizes count teams');
  pl.r0.disconnected = true;
  eq(M.teamSizes(pl), { red: 2, gold: 2 }, 'a dropped phone is not counted');
  eq(M.pickTeam(pl, null), 'red', 'equal sizes, no game → Fuego');
  const m = game(pl);
  m.totals = { red: 50, gold: 20 };
  eq(M.pickTeam(pl, m), 'gold', 'equal sizes → the team that is behind');
  pl.g0.disconnected = true;
  eq(M.pickTeam(pl, m), 'gold', 'fewer connected kids wins over being ahead');
  const p2 = {};
  for (let i = 0; i < 31; i++) { const tm = M.pickTeam(p2, null); p2['x' + i] = kid(tm); }
  const s = M.teamSizes(p2);
  ok(Math.abs(s.red - s.gold) <= 1, `31 joiners split evenly (${s.red}/${s.gold})`);
  // a smaller team's gold counts more in the team total; kids' own coins stay real
  const pl3 = room(3, 1);
  const m3 = game(pl3);
  M.startPlay(m3, 0);
  m3.w = M.weights(M.teamSizes(pl3));
  m3.rng = () => 0.99;
  M.deal(m3, pl3.g0, 0);
  M.answer(m3, pl3.g0, pl3.g0.ssQ.ans, 1000);
  M.deal(m3, pl3.r0, 0);
  M.answer(m3, pl3.r0, pl3.r0.ssQ.ans, 1000);
  eq(pl3.g0.ssCoins, 1, 'the kid of the small team: 1 real coin');
  ok(Math.abs(m3.totals.gold - 2) < 1e-9 && Math.abs(m3.totals.red - 2 / 3) < 1e-9, '3 vs 1: one right answer weighs ×2/3 vs ×2 in the team totals');
  eq(m3.raw, { red: 1, gold: 1 }, 'raw coins stay real');
}

// ---------- golden sums and the comeback cap ----------
{
  const pl = room(2, 2);
  const m = game(pl);
  M.startPlay(m, 0);
  m.w = { red: 1, gold: 1 };
  // golden sums come more often to the team that trails
  let gTrail = 0, gLead = 0;
  m.behind = 'red';
  for (let i = 0; i < 4000; i++) { if (M.deal(m, pl.r0, 0).ss.gold) gTrail++; if (M.deal(m, pl.g0, 0).ss.gold) gLead++; }
  ok(Math.abs(gTrail / 4000 - R.GOLD_CHANCE_BEHIND) < 0.03, `trailing team: ~${R.GOLD_CHANCE_BEHIND * 100} % golden (${(gTrail / 40).toFixed(1)} %)`);
  ok(Math.abs(gLead / 4000 - R.GOLD_CHANCE) < 0.02, `the other team: ~${R.GOLD_CHANCE * 100} % golden (${(gLead / 40).toFixed(1)} %)`);
  // a golden sum while not trailing: +5 in full
  m.totals = { red: 10, gold: 10 };
  M.deal(m, pl.g0, 0); pl.g0.ssQ.gold = true;
  const a = M.answer(m, pl.g0, pl.g0.ssQ.ans, 1000);
  eq([a.coins, a.goldExtra], [1 + R.GOLD_BONUS, R.GOLD_BONUS], 'golden sum, not trailing: +5 extra');
  // trailing by 3: the golden extra only closes the gap
  m.totals = { red: 20, gold: 23 };
  M.deal(m, pl.r0, 0); pl.r0.ssQ.gold = true; pl.r0.ssStreak = 0;
  const b = M.answer(m, pl.r0, pl.r0.ssQ.ans, 1000);
  eq(b.goldExtra, 2, 'trailing by 3: 1 coin + an extra capped at the remaining gap (2)');
  eq(m.totals.red, 23, 'the trailing team catches up exactly, never jumps the gap by luck');
  // trailing by 100: the full extra
  m.totals = { red: 0, gold: 100 };
  M.deal(m, pl.r1, 0); pl.r1.ssQ.gold = true;
  const c = M.answer(m, pl.r1, pl.r1.ssQ.ans, 1000);
  eq(c.goldExtra, R.GOLD_BONUS, 'far behind: the whole extra');
  // in the frenzy the extra doubles (and the cap still holds)
  m.frenzy = true;
  m.totals = { red: 50, gold: 52 };
  M.deal(m, pl.r1, 0); pl.r1.ssQ.gold = true; pl.r1.ssStreak = 0;
  const d = M.answer(m, pl.r1, pl.r1.ssQ.ans, 1000);
  eq([d.coins, d.goldExtra], [2, 0], 'frenzy, trailing by 2: the 2 base coins close the gap, no golden extra on top');
  ok(pl.r1.ssGolds === 2, 'golden sums answered are counted');
}

// ---------- the room clock: landmarks, the lead, who trails, the frenzy ----------
{
  const pl = room(2, 2);
  const m = game(pl, 120, 0);
  M.startPlay(m, 0);
  ok(m.landmarks.every((l, i) => i === 0 || l.at > m.landmarks[i - 1].at), 'the landmarks climb');
  m.totals = { red: m.landmarks[0].at, gold: 0 };
  const ev = M.tick(m, 1000);
  eq(ev.landmarks.map((l) => [l.id, l.team]), [['museum', 'red']], 'Fuego reaches the Museo del Futuro first');
  eq(m.totals.red, m.landmarks[0].at + m.landmarks[0].bonus, 'the landmark bonus');
  m.totals.gold = m.landmarks[0].at + 50;
  ok(!M.tick(m, 1200).landmarks.some((l) => l.id === 'museum'), 'a landmark is won once');
  // lead hysteresis + alarm gap
  const m2 = game(room(2, 2), 120, 0);
  M.startPlay(m2, 0);
  m2.totals = { red: 3, gold: 0 };
  ok(!M.tick(m2, 100).lead, 'a lead under LEAD_MIN is no lead');
  m2.totals = { red: 10, gold: 2 };
  eq(M.tick(m2, 200).lead, { team: 'red', first: true }, 'Fuego takes the lead');
  m2.totals = { red: 10, gold: 20 };
  ok(!M.tick(m2, 3000).lead, 'a lead change inside the alarm gap waits');
  eq(M.tick(m2, 200 + R.LEAD_GAP_MS).lead, { team: 'gold', first: false }, 'Mar passes, announced after the gap');
  eq(m2.behind, 'red', 'trailing by 10 of 20 (≥ 10 and ≥ 15 % of the leader): behind');
  m2.totals = { red: 40, gold: 100 };
  M.tick(m2, 20000);
  eq(m2.behind, 'red', 'Fuego trails by ≥ 15 % and ≥ 10: the comeback is on');
  m2.totals = { red: 95, gold: 100 };
  M.tick(m2, 20100);
  eq(m2.behind, null, 'a close race: no comeback help');
  // the frenzy
  const m3 = game(room(1, 1), 120, 0);
  M.startPlay(m3, 0);
  ok(!M.tick(m3, m3.frenzyAt - 1).frenzy, 'no frenzy before the last 30 s');
  ok(M.tick(m3, m3.frenzyAt).frenzy && m3.frenzy, 'the last 30 s: ×2');
  eq(M.frenzyMs(60), 20000, 'a 1-minute game: the last third');
  // pause and «+30 s»
  const m4 = game(room(1, 1), 120, 0);
  M.startPlay(m4, 1000);
  const end0 = m4.endsAt, fz0 = m4.frenzyAt;
  M.shiftTimes(m4, 5000);
  ok(m4.endsAt === end0 + 5000 && m4.frenzyAt === fz0 + 5000, 'a pause moves the end and the frenzy');
  const pk = kid('red', { ssId: 99 });
  M.resetKid(pk, m4);
  pk.ssNextQAt = 9000; pk.ssQ = { at: 8000 };
  M.shiftKid(pk, 5000);
  ok(pk.ssNextQAt === 14000 && pk.ssQ.at === 13000, 'a pause moves a kid\'s wait and the open sum\'s start (no thinking time lost)');
  ok(M.addTime(m4, 30000) && m4.endsAt === end0 + 35000 && m4.frenzyAt === fz0 + 35000, '«+30 s» moves the end and a frenzy not yet on');
  m4.frenzy = true;
  const fz1 = m4.frenzyAt;
  M.addTime(m4, 30000);
  eq(m4.frenzyAt, fz1, '«+30 s» in the frenzy: more double time');
  // «¡FINAL!»
  M.final(m4, 99000);
  ok(m4.phase === 'final' && m4.endedAt === 99000 && m4.phaseUntil === 99000 + R.FINAL_MS, '«¡FINAL!»');
  ok(!M.addTime(m4, 30000), 'no «+30 s» after «¡FINAL!»');
}

// ---------- «¡SIX SEVEN!» during play (2026-10-16): racha 7, the 67th coin, the 6 → 7 pair, the team waves ----------
{
  const pl = room(2, 2);
  const m = game(pl, 120, 0);
  M.startPlay(m, 0);
  m.rng = mulberry32(3);
  const p = pl.r0;
  const dealPlain = (t) => { const q = M.deal(m, p, t); p.ssQ.gold = false; return q; };   // no golden sums here
  const q0 = dealPlain(0);
  eq(q0.ss.min, R.MIN_THINK_MS, 'the phone knows the too-fast line (to show a certain verdict at the tap)');
  ok(!JSON.stringify(q0).includes('"ans"'), 'still no answer in what the phone gets');
  // play right answers with chosen values: 6 then 7 = a pair; 7 then 6 is not
  const playAns = (want, right) => {
    let r;
    for (let i = 0; i < 50; i++) {
      dealPlain(1000);
      if (p.ssQ.ans === want) { r = M.answer(m, p, right === false ? (want === 6 ? 7 : 6) : want, 2000); break; }
      p.ssQ = null;
    }
    return r;
  };
  p.ssStreak = 0; p.ssLastRight = 0;
  let r = playAns(6);
  ok(r.right && !r.pair, 'a right 6 alone is no pair');
  r = playAns(7);
  ok(r.right && r.pair, 'right 6 then right 7: «six seven» pair');
  r = playAns(6);
  ok(r.right && !r.pair, '7 then 6 is not the pair');
  r = playAns(6, false);
  ok(!r.right && !r.pair && r.six === 0, 'a wrong answer breaks the pair');
  r = playAns(7);
  ok(r.right && !r.pair, 'a wrong 6 then a right 7: no pair');
  // racha 7 = six flag 1, once per racha
  M.resetKid(p, m);
  const sixes = [];
  for (let i = 0; i < 9; i++) { dealPlain(1000); sixes.push(M.answer(m, p, p.ssQ.ans, 2000).six); }
  eq(sixes.map((x) => x & 1), [0, 0, 0, 0, 0, 0, 1, 0, 0], 'racha 7 flags «six seven» once');
  // the 67th coin = six flag 2, once
  M.resetKid(p, m);
  p.ssCoins = 65;
  dealPlain(1000);
  const c1 = M.answer(m, p, p.ssQ.ans, 2000);
  eq(c1.six & 2, 0, '66 coins: not yet');
  dealPlain(1000);
  const c2 = M.answer(m, p, p.ssQ.ans, 2000);
  eq(c2.six & 2, 2, 'the 67th coin flags «six seven»');
  dealPlain(1000);
  eq(M.answer(m, p, p.ssQ.ans, 2000).six & 2, 0, 'only once');
  // the projector's feed carries the flag
  m.fx = {};
  M.resetKid(p, m);
  for (let i = 0; i < 7; i++) { dealPlain(1000); M.answer(m, p, p.ssQ.ans, 2000); }
  eq(m.fx[p.ssId][3] & 1, 1, 'the feed marks the kid who just did «six seven»');
  ok(m.fx[p.ssId].length === 5, 'feed entries: [coins, golden, wrong, six, dig]');
  // which number was right since the last tick (2026-10-20: Liu cheers a 6, Qi a 7 on the projector)
  m.fx = {};
  dealPlain(1000);
  { const want = p.ssQ.ans; M.answer(m, p, want, 2000); eq(m.fx[p.ssId][4], want === 6 ? 1 : 2, 'the feed says which number was right (1 = 6, 2 = 7)'); }
  { let tries = 0; const first = m.fx[p.ssId][4]; while (tries++ < 40) { dealPlain(1000); const a = p.ssQ.ans; M.answer(m, p, a, 2000); if ((a === 6 ? 1 : 2) !== first) break; }
    eq(m.fx[p.ssId][4], 3, 'a 6 and a 7 in the same beat: both friends (1 | 2)'); }
  m.fx = {};
  dealPlain(1000);
  M.answer(m, p, p.ssQ.ans === 6 ? 7 : 6, 2000);
  eq(m.fx[p.ssId][4], 0, 'a wrong answer marks no number');
  // a «six seven» is cosmetic: same coins as without it
  eq(M.streakMult(7), 3, 'racha 7 pays ×3 like any racha 6-9');

  // the team waves: the first at 67, then every waveStep (~E ÷ 3, a multiple of 67)
  eq(M.waveStep(M.expected(120, 2)), 67, 'teams of 2, 2 minutes: a wave every 67');
  eq(M.waveStep(M.expected(120, 4)), 134, 'teams of 4: every 134');
  eq(M.waveStep(M.expected(120, 15)), 536, 'teams of 15: every 536');
  eq(M.waveStep(M.expected(240, 15)), 1072, 'teams of 15, 4 minutes: every 1072');
  ok([20, 100, 216, 500, 999, 1620, 3240].every((E) => M.waveStep(E) % 67 === 0 && M.waveStep(E) >= 67), 'every wave lands on a multiple of 67');
  const m2 = game(room(2, 2), 120, 0);
  eq(m2.waveStep, 67, 'a game of 2 + 2: every 67');
  M.startPlay(m2, 0);
  m2.landmarks.forEach((l) => { l.team = 'gold'; });     // (landmarks out of the way: only the waves here)
  m2.totals = { red: 66, gold: 0 };
  eq(M.tick(m2, 100).waves, [], '66: no wave yet');
  m2.totals = { red: 67, gold: 10 };
  eq(M.tick(m2, 200).waves, [{ team: 'red', n: 1, gold: 67 }], 'Fuego reaches 67: «¡SIX SEVEN!»');
  eq(M.tick(m2, 300).waves, [], 'a wave is shouted once');
  m2.totals = { red: 300, gold: 140 };
  eq(M.tick(m2, 400).waves, [{ team: 'gold', n: 2, gold: 134 }], 'a big jump: one wave naming the highest mark passed; Fuego waits for its gap');
  eq(M.tick(m2, 200 + R.WAVE_GAP_MS - 1).waves, [], 'a team\'s waves stay WAVE_GAP_MS apart');
  eq(M.tick(m2, 200 + R.WAVE_GAP_MS).waves, [{ team: 'red', n: 4, gold: 268 }], '…then the waiting wave comes (never lost)');
  m2.paused = true;
  m2.totals = { red: 600, gold: 600 };
  eq(M.tick(m2, 99000).waves, [], 'no wave while paused');
  M.shiftTimes(m2, 5000);
  eq(m2.waveLast.red, 200 + R.WAVE_GAP_MS + 5000, 'a pause moves the waves\' gap too');
  m2.paused = false;
  const m3 = game(room(1, 1), 120, 0);
  M.startPlay(m3, 0);
  m3.landmarks.forEach((l) => { l.team = 'gold'; });
  m3.totals = { red: 66.6, gold: 0 };
  eq(M.tick(m3, 100).waves.map((w) => w.gold), [67], 'the wave follows the gold the screens show (66.6 shows 67)');
  // rescale grows the step for the next waves only
  const m4 = game(room(1, 1), 120, 0);
  const s0 = m4.waveStep;
  M.rescale(m4, { red: 12, gold: 12 }, 100);
  ok(m4.waveStep > s0 && m4.waveStep % 67 === 0, 'late joiners: the waves space out (still multiples of 67)');
}

// ---------- rescale (late joiners early in the game) ----------
{
  const pl = room(1, 1);
  const m = game(pl, 120, 0);
  const E0 = m.E;
  ok(M.rescale(m, { red: 5, gold: 5 }, 100), 'kids who join in the intro grow the race');
  ok(m.E > E0, 'E grows');
  m.landmarks[0].team = 'red';
  const won = m.landmarks[0].at;
  M.startPlay(m, 1000);
  ok(M.rescale(m, { red: 8, gold: 8 }, 1000 + R.RESCALE_MS - 1), 'still early: grows');
  eq(m.landmarks[0].at, won, 'a won landmark keeps its height');
  ok(!M.rescale(m, { red: 20, gold: 20 }, 1000 + R.RESCALE_MS + 1), 'later: no change');
  ok(!M.rescale(m, { red: 1, gold: 1 }, 1100), 'never shrinks');
}

// ---------- stars and the end ----------
{
  const row = (k, team, o) => Object.assign({ k, name: 'K' + k, skin: 'dralingo', team, coins: 0, right: 0, answered: 0, best: 0, fast: null, behind: 0, zh: 0, golds: 0 }, o);
  const rows = [
    row(1, 'red', { coins: 40, right: 12, answered: 13, best: 9, fast: 900, behind: 10, zh: 6 }),
    row(2, 'red', { coins: 40, right: 12, answered: 20, best: 4, fast: 800, behind: 0, zh: 6 }),
    row(3, 'gold', { coins: 10, right: 5, answered: 5, best: 5, fast: 450, behind: 0, zh: 0 }),
    row(4, 'gold', { coins: 2, right: 2, answered: 30, best: 1, fast: 410, behind: 2 }),     // a guesser: fast but no star for it
    row(5, 'gold', { coins: 0, right: 0, answered: 0 }),
  ];
  const st = M.stars(rows);
  const by = Object.fromEntries(st.map((s) => [s.id, s]));
  eq(by.right.winners, [1, 2], 'Más aciertos: a tie shares the star');
  eq(by.streak.winners, [1], 'Racha más larga');
  eq(by.aim.winners, [3], 'Mejor puntería: 5 of 5');
  eq(by.fast.winners, [3], 'Respuesta más rápida: the fastest kid who thinks (the 410 ms guesser at 7 % is not eligible)');
  eq(by.fast.value, 0.5, 'in seconds, one decimal');
  eq(by.zh.winners, [1, 2], 'Experto en Chino');
  eq(by.comeback.winners, [1], 'Gran remontada');
  ok(!st.some((s) => s.winners.includes(5)), 'a kid with nothing gets no star');
  const st2 = M.stars([row(1, 'red', { coins: 3, right: 1, answered: 2, best: 1 })]);
  ok(!st2.some((s) => s.id === 'streak' || s.id === 'aim' || s.id === 'zh' || s.id === 'fast'), 'categories nobody qualifies for are skipped');
  eq(M.stars([]), [], 'no kids, no stars');
  // finish
  const pl = room(2, 3);
  const m = game(pl, 120, 0, 'zh');
  m.totals = { red: 80, gold: 12 };
  const fin = M.finish(m, rows.map((r) => Object.assign({}, r)));
  eq(fin.winner, 'red', 'more gold wins');
  eq(fin.style, 'zh', 'the style travels to the end');
  eq(fin.rows.map((r) => [r.k, r.rank]), [[1, 1], [2, 1], [3, 3], [4, 4], [5, 5]], 'ranks (ties share)');
  eq(fin.mvp, { red: 1, gold: 3 }, 'MVP per team (most coins, then most right)');
  eq(fin.rows.find((r) => r.k === 1).share, 50, 'share of the team\'s gold');
  eq(fin.rows.find((r) => r.k === 4).aim, 7, 'accuracy in %');
  m.totals = { red: 50, gold: 50 };
  eq(M.finish(m, []).winner, 'tie', 'equal gold: a tie');
}

// ---------- the anti-spam claim: random tapping loses to thinking ----------
// Simulated phones on the server's own rules and clock: each kid answers, waits for the next sum, answers again.
function play(kind, seed, seconds) {
  const pl = { a: kid('red', { ssId: 1 }), b: kid('gold', { ssId: 2 }) };
  const m = M.newGame(seed, seconds, 0, { red: 1, gold: 1 }, 'mix');
  Object.values(pl).forEach((p) => M.resetKid(p, m));
  M.startPlay(m, 0);
  const rng = mulberry32(seed * 7 + 1);
  const p = pl.a;
  let t = 0, net = 80;                                     // ~80 ms network each way
  while (t < m.endsAt) {
    if (t >= m.frenzyAt) m.frenzy = true;
    M.deal(m, p, t);
    let think, right;
    if (kind === 'masher') { think = 120 + rng() * 180; right = rng() < 0.5; }
    else if (kind === 'guesser') { think = 400 + rng() * 300; right = rng() < 0.5; }
    else if (kind === 'slow') { think = 2600 + rng() * 2400; right = rng() < 0.82; }
    else { think = 1200 + rng() * 1800; right = rng() < 0.88; }
    const at = t + net + think + net;
    if (at >= m.endsAt) break;
    const ans = p.ssQ.ans;
    const r = M.answer(m, p, right ? ans : (ans === 6 ? 7 : 6), at - net);   // the server sees it one trip later
    t = p.ssNextQAt + net;
  }
  return p.ssCoins;
}
{
  const N = 60;
  const avg = (kind) => { let s = 0; for (let i = 1; i <= N; i++) s += play(kind, i, 120); return s / N; };
  const thinker = avg('thinker'), slow = avg('slow'), guesser = avg('guesser'), masher = avg('masher');
  console.log(`  2-minute game, coins per kid: thinker ${thinker.toFixed(0)} · slow thinker ${slow.toFixed(0)} · guesser ${guesser.toFixed(0)} · masher ${masher.toFixed(0)}`);
  ok(masher < guesser, 'a masher (taps before anybody can read: most taps «too fast») earns less than a guesser');
  ok(thinker > 4 * masher, 'a kid who thinks earns more than 4× a masher');
  ok(thinker > 2 * guesser, 'a kid who thinks earns more than twice a fast guesser');
  ok(slow > guesser, 'even a slow kid who thinks beats a fast guesser');
}

// ---------- 300 simulated classes: every coin adds up ----------
{
  let landmarks = 0, burj = 0, ties = 0, games = 0, maxGap = 0, rate = 0, waves = 0, maxWaves = 0, noWave = 0, waveGap = 1e9;
  for (let gi = 0; gi < 300; gi++) {
    const rng = mulberry32(1000 + gi);
    const n = 4 + Math.floor(rng() * 27);
    const players = {};
    for (let i = 0; i < n; i++) players['p' + i] = kid(i % 2 ? 'gold' : 'red', { ssId: i + 1 });
    const dur = [120, 180, 240][gi % 3];
    const m = M.newGame(gi + 1, dur, 0, M.teamSizes(players), ['num', 'zh', 'mix'][gi % 3]);
    Object.values(players).forEach((p) => M.resetKid(p, m));
    M.startPlay(m, 0);
    m.w = M.weights(M.teamSizes(players));
    // each kid: a speed and an accuracy like a real class (2-5 s a sum, 70-95 % right)
    const tw = { red: 0, gold: 0 }, lastWave = {};
    const kids = Object.values(players).map((p) => ({ p, speed: 2000 + rng() * 3000, acc: 0.7 + rng() * 0.25, next: 0, open: false }));
    for (let t = 0; t < m.endsAt; t += 100) {
      const ev = M.tick(m, t);
      ev.waves.forEach((w) => { waves++; tw[w.team]++; if (lastWave[w.team] != null) waveGap = Math.min(waveGap, t - lastWave[w.team]); lastWave[w.team] = t; });
      kids.forEach((k) => {
        if (!k.open && t >= (k.p.ssNextQAt || 0)) { M.deal(m, k.p, t); k.open = true; k.at = t + k.speed * (0.6 + rng() * 0.8); }
        else if (k.open && t >= k.at) {
          const right = rng() < k.acc;
          M.answer(m, k.p, right ? k.p.ssQ.ans : (k.p.ssQ.ans === 6 ? 7 : 6), t);
          k.open = false;
        }
      });
    }
    maxWaves = Math.max(maxWaves, tw.red, tw.gold);
    if (!tw.red && !tw.gold) noWave++;
    const raw = { red: 0, gold: 0 };
    Object.values(players).forEach((p) => { raw[p.team] += p.ssCoins; });
    eq(raw, m.raw, 'raw coins = the sum of the kids\' coins');
    const bonus = { red: 0, gold: 0 };
    m.landmarks.forEach((l) => { if (l.team) bonus[l.team] += l.bonus; });
    ok(Math.abs(m.totals.red - (raw.red * m.w.red + bonus.red)) < 1e-6 && Math.abs(m.totals.gold - (raw.gold * m.w.gold + bonus.gold)) < 1e-6, 'team total = weighted coins + landmark bonuses');
    rate += (raw.red + raw.gold) / n / dur;
    landmarks += m.landmarks.filter((l) => l.team).length;
    if (m.landmarks[3].team) burj++;
    const d = M.display(m);
    if (d.r === d.g) ties++;
    maxGap = Math.max(maxGap, Math.abs(d.r - d.g) / Math.max(1, d.r + d.g));
    games++;
  }
  console.log(`  300 simulated classes: ${(rate / games).toFixed(2)} coins per kid per second, ${landmarks} landmarks won (${(landmarks / games).toFixed(2)} a game), the Burj Khalifa reached in ${burj}, ${ties} ties`);
  ok(landmarks / games >= 2, 'most games give out at least two landmarks');
  ok(burj < games, 'the Burj Khalifa is not a given');
  console.log(`  «¡SIX SEVEN!» team waves: ${(waves / games / 2).toFixed(1)} a team per game, at most ${maxWaves}, ${noWave} games with none, the closest two of a team ${(waveGap / 1000).toFixed(1)} s apart`);
  ok(waves / games / 2 >= 1.5 && waves / games / 2 <= 6, 'a team gets a few «six seven» waves a game: a moment, not a drone');
  ok(maxWaves <= 8, 'never a wave storm');
  ok(waveGap >= R.WAVE_GAP_MS, 'a team\'s waves at least WAVE_GAP_MS apart');
  ok(noWave === 0, 'every game has at least one wave (the meme is felt in every round)');
}

console.log(`test-sixseven: ${checks} checks passed`);
