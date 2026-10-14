#!/usr/bin/env node
// Rules test for Mochi Mash v2 (core/mochi.js): team split + late joiners, the tap cap and the batching math, golden
// mochis and the comeback rule (more golds for the trailing team, extra capped at the gap), size weighting, the
// frenzy ×2, lead hysteresis + alarm gap, the landmark race, pause shifts, «¡FINAL!» cut + grace, bonus stars (ties,
// kids with 0, skipped categories) and the end payload. Plus 300 simulated classes where every mochi adds up.
//   node scripts/test-mochi.js
'use strict';
const assert = require('assert');
const M = require('../core/mochi');
const { R } = M;

let checks = 0;
const ok = (c, msg) => { checks++; assert.ok(c, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };

const kid = (team, extra) => Object.assign({ team, disconnected: false, mmId: 0, name: 'k' }, extra || {});
let nextK = 1;
function room(nRed, nGold) {
  const players = {};
  for (let i = 0; i < nRed; i++) players['r' + i] = kid('red', { mmId: nextK++, name: 'R' + i });
  for (let i = 0; i < nGold; i++) players['g' + i] = kid('gold', { mmId: nextK++, name: 'G' + i });
  return players;
}
function game(players, dur, now) {
  const m = M.newGame(12345, dur || 180, now || 0, M.teamSizes(players));
  Object.values(players).forEach((p) => M.resetKid(p, m));
  return m;
}

// ---------- teams ----------
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
  // late joiners keep the teams even
  const p2 = {};
  for (let i = 0; i < 31; i++) { const t = M.pickTeam(p2, null); p2['x' + i] = kid(t); }
  const s = M.teamSizes(p2);
  ok(Math.abs(s.red - s.gold) <= 1, `31 joiners split evenly (${s.red}/${s.gold})`);
  // weights
  const w = M.weights({ red: 8, gold: 7 });
  ok(Math.abs(w.red - 7.5 / 8) < 1e-9 && Math.abs(w.gold - 7.5 / 7) < 1e-9, '8 vs 7: ×0.9375 vs ×1.071');
  eq(M.weights({ red: 4, gold: 4 }), { red: 1, gold: 1 }, 'equal teams: ×1');
  const w0 = M.weights({ red: 3, gold: 0 });
  ok(Number.isFinite(w0.gold) && w0.gold > 0, 'an empty team never divides by 0');
}

// ---------- the mash window and the tap cap ----------
{
  const pl = room(2, 2);
  const m = game(pl);
  M.startPlay(m, 0);
  const p = pl.r0;
  const r = M.answer(m, p, true, 1500, 1000);
  ok(r.right && r.mash && r.mash.ms === R.MASH_MS && r.mash.lead === R.LEAD_MS, 'a right answer opens a 5 s window after the lead-in');
  eq(p.mmRight, 1, 'right counted');
  eq(p.mmFast, 1500, 'fastest answer kept');
  const x = p.mmMash;
  eq(x.start, 1000 + R.LEAD_MS, 'window start');
  x.gold = 0;                                            // no golden mochi for the cap maths
  // a human tapping 8/s in 250 ms batches: every tap credited
  let t = x.start, got = 0;
  for (let i = 0; i < 20; i++) { t += 250; got += M.taps(m, p, x.mid, 2, t).credited; }
  eq(got, 40, '8 taps/s for 5 s are all credited');
  // an auto-clicker claiming 12 per batch (48/s) on a fresh window: capped near 12/s
  const q = pl.r1;
  M.answer(m, q, true, 900, 2000);
  q.mmMash.gold = 0;
  let t2 = q.mmMash.start, bot = 0;
  for (let i = 0; i < 20; i++) { t2 += 250; bot += M.taps(m, q, q.mmMash.mid, 99, t2).credited; }
  ok(bot <= R.RATE * 5 + R.BURST && bot >= R.RATE * 5 - 3, `an auto-clicker gets ~12/s (${bot} in 5 s)`);
  // jitter: two batches arriving together still credit what was earned
  const z = pl.g0;
  M.answer(m, z, true, 900, 3000);
  z.mmMash.gold = 0;
  const s0 = z.mmMash.start;
  const a1 = M.taps(m, z, z.mmMash.mid, 4, s0 + 1000).credited;
  const a2 = M.taps(m, z, z.mmMash.mid, 4, s0 + 1001).credited;
  eq(a1 + a2, 8, 'a late pair of batches is not punished by the cap');
  // wrong mid, after the grace, paused, bad n
  eq(M.taps(m, z, 999, 3, s0 + 1500).credited, 0, 'a batch for another window is ignored');
  eq(M.taps(m, z, z.mmMash.mid, -3, s0 + 1500).credited, 0, 'negative n ignored');
  eq(M.taps(m, z, z.mmMash.mid, 'x', s0 + 1500).credited, 0, 'garbage n ignored');
  m.paused = true;
  eq(M.taps(m, z, z.mmMash.mid, 3, s0 + 1600).credited, 0, 'no taps while paused');
  m.paused = false;
  ok(M.taps(m, z, z.mmMash.mid, 3, z.mmMash.until + R.GRACE_MS - 10).credited > 0, 'the last batch inside the grace counts');
  eq(M.taps(m, z, z.mmMash.mid, 3, z.mmMash.until + R.GRACE_MS + 10).credited, 0, 'after the grace: nothing');
  ok(M.taps(m, z, z.mmMash.mid, 12, s0 + 200).credited <= R.BURST, 'MAX_BATCH + burst bound a single early batch');
  // close
  const sum = M.closeMash(m, z, z.mmMash.until + R.GRACE_MS);
  ok(sum && sum.taps > 0 && sum.mochis === sum.taps, 'the window summary');
  eq(z.mmMash, null, 'closed');
  eq(M.closeMash(m, z, 0), null, 'closing twice is a no-op');
  eq(z.mmNextQAt, z.mmNextQAt, 'next question time set');
  // a wrong answer: no window, streak reset
  const w = M.answer(m, p, false, 1200, 9000);
  ok(!w.right && w.wait === R.WRONG_MS && p.mmStreak === 0 && p.mmWrong === 1 && p.mmAnswered === 2, 'wrong answer');
  // a glitch-fast answer never becomes the fastest answer
  const fastBefore = p.mmFast;
  M.answer(m, p, true, 120, 9500);
  eq(p.mmFast, fastBefore, 'an answer under 400 ms is not a «Respuesta más rápida»');
  M.closeMash(m, p, 9600);
  p.mmStreak = 0;
  // streak bonus
  M.answer(m, p, true, 1, 10000); M.answer(m, p, true, 1, 11000);
  const s3 = M.answer(m, p, true, 1, 12000);
  ok(s3.mash.streakBonus && s3.mash.ms === R.MASH_MS + R.STREAK_MS, 'a streak of 3 adds a second');
  eq(p.mmBest, 3, 'best streak');
}

// ---------- golden mochis + the comeback rule ----------
{
  const pl = room(3, 3);
  const m = game(pl);
  M.startPlay(m, 0);
  // the chance: over many windows, the trailing team gets more golds
  let base = 0, behind = 0;
  for (let i = 0; i < 4000; i++) {
    m.behind = null;
    if (M.openMash(m, pl.r0, i * 10).gold) base++;
    m.behind = 'red';
    if (M.openMash(m, pl.r0, i * 10).gold) behind++;
  }
  ok(Math.abs(base / 4000 - R.GOLD_CHANCE) < 0.03, `golden chance ~25 % (${(base / 40).toFixed(1)} %)`);
  ok(Math.abs(behind / 4000 - R.GOLD_CHANCE_BEHIND) < 0.03, `trailing team ~60 % (${(behind / 40).toFixed(1)} %)`);
  m.behind = null;
  // a golden tap counts 5 when the team leads
  const p = pl.r1;
  m.totals = { red: 100, gold: 10 };
  M.answer(m, p, true, 1, 0);
  p.mmMash.gold = 3;
  const g1 = M.taps(m, p, p.mmMash.mid, 3, p.mmMash.start + 400);
  ok(g1.gold && g1.mochis === 3 - 1 + R.GOLD_VALUE, 'a golden tap counts 5 for the leader');
  eq(p.mmGold, 1, 'gold counted');
  // trailing by 3: the extra is capped at the gap
  const q = pl.g1;
  m.totals = { red: 13, gold: 10 };
  M.answer(m, q, true, 1, 0);
  q.mmMash.gold = 1;
  const g2 = M.taps(m, q, q.mmMash.mid, 1, q.mmMash.start + 300);
  ok(g2.gold && g2.mochis === 1 + 2, `the trailing team's golden extra is capped at the gap (got ${g2.mochis})`);
  ok(m.totals.gold <= m.totals.red + 1e-9, 'luck never jumps the gap by itself');
  // Gran remontada: mochis while behind
  ok(q.mmBehind >= 1, 'fed while behind is tracked');
  // the trailing flag from tick
  m.totals = { red: 200, gold: 100 };
  M.tick(m, 100);
  eq(m.behind, 'gold', 'trailing by 50 % → gold gets more golds');
  m.totals = { red: 105, gold: 100 };
  M.tick(m, 200);
  eq(m.behind, null, 'a small gap is not "behind"');
}

// ---------- weighting, frenzy, lead alarms, landmarks ----------
{
  const pl = room(4, 2);
  const m = game(pl, 120, 0);
  M.startPlay(m, 0);
  m.w = M.weights(M.teamSizes(pl));
  const a = pl.r0, b = pl.g0;
  M.answer(m, a, true, 1, 0); a.mmMash.gold = 0;
  M.answer(m, b, true, 1, 0); b.mmMash.gold = 0;
  M.taps(m, a, a.mmMash.mid, 4, a.mmMash.start + 1000);
  M.taps(m, b, b.mmMash.mid, 4, b.mmMash.start + 1000);
  eq(a.mmMochis, 4, 'kids keep their real count');
  ok(Math.abs(m.totals.red - 4 * 0.75) < 1e-9 && Math.abs(m.totals.gold - 4 * 1.5) < 1e-9, 'team totals are weighted by size (4 vs 2)');
  // frenzy
  eq(M.frenzyMs(180), 30000, 'frenzy is the last 30 s');
  eq(M.frenzyMs(60), 20000, 'a 1-minute game: the last third');
  ok(!M.tick(m, m.frenzyAt - 1).frenzy, 'no frenzy before its time');
  ok(M.tick(m, m.frenzyAt).frenzy && m.frenzy, 'frenzy on');
  ok(!M.tick(m, m.frenzyAt + 300).frenzy, 'announced once');
  M.answer(m, a, true, 1, m.frenzyAt); a.mmMash.gold = 0;
  const f = M.taps(m, a, a.mmMash.mid, 2, a.mmMash.start + 500);
  eq(f.mochis, 4, 'every mochi ×2 in the frenzy');
  // lead hysteresis + gap
  const n = game(room(2, 2), 180, 0);
  M.startPlay(n, 0);
  n.totals = { red: 3, gold: 0 };
  eq(M.tick(n, 1000).lead, null, 'a 3-mochi lead does not count');
  n.totals = { red: 10, gold: 0 };
  const l1 = M.tick(n, 2000).lead;
  ok(l1 && l1.team === 'red' && l1.first, 'first lead announced');
  n.totals = { red: 10, gold: 20 };
  eq(M.tick(n, 3000).lead, null, 'a flip inside 7 s waits');
  const l2 = M.tick(n, 2000 + R.LEAD_GAP_MS).lead;
  ok(l2 && l2.team === 'gold' && !l2.first, 'the flip is announced once the gap passed');
  n.landmarks.forEach((l) => { l.team = 'red'; });          // (the landmark race is tested below)
  n.totals = { red: 300, gold: 295 };
  M.tick(n, 30000);
  eq(n.lead, 'gold', 'a lead below 3 % keeps the previous leader (no flicker)');
  // landmarks: first team to reach each height wins it once, with its bonus
  const L = game(room(3, 3), 180, 0);
  M.startPlay(L, 0);
  const lm = L.landmarks;
  ok(lm.length === 4 && lm[0].at < lm[1].at && lm[1].at < lm[2].at && lm[2].at < lm[3].at, 'four landmarks in rising order');
  L.totals = { red: lm[0].at, gold: lm[0].at - 1 };
  const e1 = M.tick(L, 100).landmarks;
  ok(e1.length === 1 && e1[0].team === 'red' && lm[0].team === 'red', 'Fuego reaches the Museo first');
  eq(L.totals.red, lm[0].at + lm[0].bonus, 'with its bonus');
  L.totals.gold = lm[0].at + 50;
  eq(M.tick(L, 200).landmarks.filter((x) => x.id === lm[0].id).length, 0, 'a landmark is won only once');
  L.totals = { red: lm[3].at + 1, gold: lm[3].at + 5 };
  const e2 = M.tick(L, 300).landmarks;
  ok(e2.length >= 2 && e2.every((x) => x.team === 'gold'), 'several at once: the taller team takes them');
}

// ---------- late joiners early in the game grow the race ----------
{
  const pl = room(2, 2);
  const m = game(pl, 180, 0);
  const E0 = m.E, at0 = m.landmarks.map((l) => l.at);
  ok(M.rescale(m, { red: 6, gold: 6 }, 100), 'the intro: more kids grow the race');
  ok(m.E > E0 && m.landmarks.every((l, i) => l.at > at0[i]), 'E and every landmark height grew');
  ok(!M.rescale(m, { red: 1, gold: 1 }, 200), 'fewer kids never shrink it');
  M.startPlay(m, 1000);
  m.landmarks[0].team = 'red';
  const won = m.landmarks[0].at;
  ok(M.rescale(m, { red: 9, gold: 9 }, 1000 + R.RESCALE_MS - 1), 'still early in the play: grows');
  eq(m.landmarks[0].at, won, 'a landmark already won keeps its height');
  ok(!M.rescale(m, { red: 15, gold: 15 }, 1000 + R.RESCALE_MS + 1), 'after the first 20 s: fixed');
}

// ---------- pause shift, «+30 s», «¡FINAL!» ----------
{
  const pl = room(2, 2);
  const m = game(pl, 180, 0);
  M.startPlay(m, 1000);
  const end0 = m.endsAt, fz0 = m.frenzyAt;
  const p = pl.r0;
  M.answer(m, p, true, 1, 5000);
  const u0 = p.mmMash.until;
  M.shiftTimes(m, 7000);
  M.shiftMash(p, 7000);
  ok(m.endsAt === end0 + 7000 && m.frenzyAt === fz0 + 7000 && p.mmMash.until === u0 + 7000, 'a pause moves every clock');
  ok(M.addTime(m, 30000) && m.endsAt === end0 + 37000 && m.frenzyAt === m.endsAt - 30000, '+30 s moves the end and the frenzy');
  m.frenzy = true;
  const fz = m.frenzyAt;
  M.addTime(m, 30000);
  eq(m.frenzyAt, fz, 'frenzy already on: it stays on');
  // «¡FINAL!» cuts an open window; the grace still counts a batch in flight
  const q = pl.g0;
  M.answer(m, q, true, 1, 20000);
  q.mmMash.gold = 0;
  const st = q.mmMash.start;
  M.final(m, st + 1000);
  ok(M.taps(m, q, q.mmMash.mid, 3, st + 1300).credited > 0, 'a batch 0.3 s after «¡FINAL!» still counts');
  eq(M.taps(m, q, q.mmMash.mid, 3, st + 1000 + R.GRACE_MS + 50).credited, 0, 'later: nothing');
  ok(q.mmMash.taps <= Math.floor(R.RATE * 1) + R.BURST, 'the cap uses the moment the game ended');
  eq(M.tick(m, st + 2000).lead, null, 'no tick events after «¡FINAL!»');
}

// ---------- bonus stars and the end ----------
{
  const row = (k, team, o) => Object.assign({ k, name: 'K' + k, skin: 'dralingo', team, mochis: 0, right: 0, answered: 0, best: 0, fast: null, behind: 0, gold: 0 }, o);
  const rows = [
    row(1, 'red', { mochis: 120, right: 5, answered: 6, best: 4, fast: 1800, behind: 30 }),
    row(2, 'red', { mochis: 120, right: 3, answered: 3, best: 3, fast: 2600, behind: 0 }),
    row(3, 'gold', { mochis: 90, right: 4, answered: 4, best: 4, fast: 1800, behind: 60 }),
    row(4, 'gold', { mochis: 0, right: 0, answered: 2, best: 0, fast: null, behind: 0 }),
    row(5, 'gold', {}),
  ];
  const st = M.stars(rows);
  const by = Object.fromEntries(st.map((s) => [s.id, s]));
  eq(by.fed.winners, [1, 2], 'Más mochis: a tie shares the star');
  eq(by.fed.value, 120, 'its value');
  eq(by.fast.winners, [1, 3], 'Respuesta más rápida: a tie shares');
  eq(by.fast.value, 1.8, 'shown in seconds');
  eq(by.streak.winners, [1, 3], 'Racha más larga: tie');
  eq(by.aim.winners, [2, 3], 'Mejor puntería: 100 % (≥ 3 answers)');
  eq(by.comeback.winners, [3], 'Gran remontada');
  ok(st.every((s) => !s.winners.includes(4) && !s.winners.includes(5)), 'kids with 0 never get a star');
  eq(M.stars([row(9, 'red', {}), row(10, 'gold', { answered: 2 })]), [], 'nobody qualifies: no stars at all');
  eq(M.stars([row(9, 'red', { mochis: 0, right: 1, answered: 1, fast: 3000, best: 1 })]).map((s) => s.id), ['fast'], 'only the categories somebody qualifies for');
  // finish
  const pl = room(2, 3);
  const m = game(pl, 180, 0);
  m.totals = { red: 240.4, gold: 239.6 };
  const fin = M.finish(m, rows.map((r) => Object.assign({}, r)));
  eq(fin.totals, { r: 240, g: 240 }, 'rounded totals');
  eq(fin.winner, 'tie', 'equal rounded totals = a tie');
  m.totals = { red: 241, gold: 10 };
  const f2 = M.finish(m, rows.map((r) => Object.assign({}, r)));
  eq(f2.winner, 'red', 'Fuego wins');
  eq(f2.rows[0].rank, 1, 'rank 1');
  eq(f2.rows[1].rank, 1, 'equal mochis share the rank');
  eq(f2.mvp, { red: 1, gold: 3 }, 'MVP per team (the earlier kid on a tie)');
  const r1 = f2.rows.find((r) => r.k === 1);
  eq(r1.share, 50, 'share of the team');
  ok(r1.stars.includes('fed') && r1.stars.includes('fast'), 'each row lists its stars');
  const r4 = f2.rows.find((r) => r.k === 4);
  eq([r4.share, r4.stars], [0, []], 'a kid with 0: 0 % and no stars');
  eq(M.finish(m, []).rows, [], 'an empty game ends cleanly');
  eq(M.finish(game(room(0, 0)), []).winner, 'tie', 'nobody played: a tie at 0');
}

// ---------- 300 simulated classes: every mochi adds up ----------
{
  let classes = 0;
  for (let c = 0; c < 300; c++) {
    const rng = M.mulberry32(777 + c);
    const nR = 1 + Math.floor(rng() * 15), nG = 1 + Math.floor(rng() * 15);
    const pl = room(nR, nG);
    const m = game(pl, [120, 180, 240][c % 3], 0);
    M.startPlay(m, 0);
    const kids = Object.values(pl);
    let now = 0, bonus = 0;
    while (now < m.endsAt) {
      now += 250;
      m.w = M.weights(M.teamSizes(pl));
      kids.forEach((p) => {
        if (p.mmMash && now >= M.closeAt(p.mmMash)) M.closeMash(m, p, now);
        if (!p.mmMash && rng() < 0.03) M.answer(m, p, rng() < 0.75, 1000 + rng() * 9000, now);
        if (p.mmMash && now >= p.mmMash.start) M.taps(m, p, p.mmMash.mid, Math.floor(rng() * 5), now);
      });
      M.tick(m, now).landmarks.forEach((l) => { bonus += l.bonus; });
      if (rng() < 0.002) { pl[Object.keys(pl)[0]].disconnected = !pl[Object.keys(pl)[0]].disconnected; }
    }
    // every kid's own count = the raw team totals; totals = weighted credits + landmark bonuses
    const rawR = kids.filter((p) => p.team === 'red').reduce((a, p) => a + p.mmMochis, 0);
    const rawG = kids.filter((p) => p.team === 'gold').reduce((a, p) => a + p.mmMochis, 0);
    eq([m.raw.red, m.raw.gold], [rawR, rawG], 'raw totals = the sum of the kids');
    ok(kids.every((p) => p.mmMochis >= 0 && p.mmBehind <= p.mmMochis && p.mmRight + p.mmWrong === p.mmAnswered), 'kid stats consistent');
    ok(m.landmarks.filter((l) => l.team).reduce((a, l) => a + l.bonus, 0) === bonus, 'landmark bonuses counted once');
    const fin = M.finish(m, kids.map((p) => ({ k: p.mmId, name: p.name, skin: 'dralingo', team: p.team, mochis: p.mmMochis, right: p.mmRight, answered: p.mmAnswered, best: p.mmBest, fast: p.mmFast, behind: p.mmBehind, gold: p.mmGold })));
    ok(fin.rows.length === kids.length && fin.stars.every((s) => s.winners.length >= 1), 'end payload complete');
    ok(['red', 'gold', 'tie'].includes(fin.winner), 'a winner or a tie');
    classes++;
  }
  ok(classes === 300, '300 classes');
}

console.log(`test-mochi: ${checks} checks OK`);
