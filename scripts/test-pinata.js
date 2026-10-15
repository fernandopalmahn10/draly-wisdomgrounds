#!/usr/bin/env node
// Rules test for Piñata Tigre v2 (core/pinata.js): team split + late joiners, every right answer opens a hit, the
// server-judged meter (the triangle wave, the grade zones, the ± TOL band around the server's estimate, clamping a
// tampered clock, automatic and late hits, one hit per swing, paused / over), the power (fast, racha, ×2), the comeback
// (wide golden zone, its extra capped at the gap), team-size weighting, the tiger ladder (jackpots, a landmark only for
// the first team, several bursts in one hit), lead hysteresis + alarm gap, rescale, pause shifts, «¡FINAL!» cut, bonus
// stars (ties, kids with 0, skipped categories) and the end payload. Plus 300 simulated classes where everything adds up.
//   node scripts/test-pinata.js
'use strict';
const assert = require('assert');
const P = require('../core/pinata');
const { R } = P;

let checks = 0;
const ok = (c, msg) => { checks++; assert.ok(c, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };
const near = (a, b, e, msg) => { checks++; assert.ok(Math.abs(a - b) <= (e || 1e-9), `${msg} (${a} vs ${b})`); };

let nextK = 1;
const kid = (team, extra) => Object.assign({ team, disconnected: false, pnId: nextK++, name: 'k' + nextK }, extra || {});
function room(nRed, nGold) {
  const players = {};
  for (let i = 0; i < nRed; i++) players['r' + i] = kid('red', { name: 'R' + i });
  for (let i = 0; i < nGold; i++) players['g' + i] = kid('gold', { name: 'G' + i });
  return players;
}
function game(players, dur, now) {
  const m = P.newGame(4242, dur || 180, now || 0, P.teamSizes(players));
  Object.values(players).forEach((p) => P.resetKid(p, m));
  return m;
}
// open a swing on purpose: a right answer at `now`, then fix its random start for exact maths
function swing(m, p, now, phase, rtt) {
  const r = P.answer(m, p, true, 5000, now);
  p.pnSwing.phase = phase == null ? 0 : phase;
  if (rtt != null) p.pnSwing.rtt = rtt;
  return r;
}
// the c (ms after the arrow started) at which the needle is at `pos` on its first rising sweep from phase 0
const cAt = (pos) => pos * R.HALF_MS;
// the server receipt time for a tap at arrow time c (sent at t0, round trip rtt)
const recvAt = (t0, c, rtt) => t0 + R.LEAD_MS + rtt + c;

// ---------- teams ----------
{
  const pl = room(3, 2);
  eq(P.teamSizes(pl), { red: 3, gold: 2 }, 'sizes count teams');
  pl.r0.disconnected = true;
  eq(P.teamSizes(pl), { red: 2, gold: 2 }, 'a dropped phone is not counted');
  eq(P.pickTeam(pl, null), 'red', 'equal sizes, no game → Fuego');
  const m = game(pl);
  m.candy = { red: 50, gold: 20 };
  eq(P.pickTeam(pl, m), 'gold', 'equal sizes → the team that is behind');
  pl.g0.disconnected = true;
  eq(P.pickTeam(pl, m), 'gold', 'fewer connected kids wins over being ahead');
  const p2 = {};
  for (let i = 0; i < 37; i++) { const t = P.pickTeam(p2, null); p2['x' + i] = kid(t); }
  const s = P.teamSizes(p2);
  ok(Math.abs(s.red - s.gold) <= 1, `37 joiners split evenly (${s.red}/${s.gold})`);
  const one = {};
  one.a = kid(P.pickTeam(one, null));
  one.b = kid(P.pickTeam(one, null));
  ok(one.a.team !== one.b.team, '2 kids: one per team');
}

// ---------- the meter ----------
{
  near(P.needle(0, 0, 900), 0, 1e-9, 'phase 0 starts at the left edge');
  near(P.needle(0, 450, 900), 0.5, 1e-9, 'half a sweep: the centre');
  near(P.needle(0, 900, 900), 1, 1e-9, 'one sweep: the right edge');
  near(P.needle(0, 1350, 900), 0.5, 1e-9, 'coming back: the centre again');
  near(P.needle(0, 1800, 900), 0, 1e-9, 'two sweeps: back at the left');
  near(P.needle(1.5, 0, 900), 0.5, 1e-9, 'phase 1.5 = coming back through the centre');
  near(P.needle(0.4, 900 * 2.6, 900), P.needle(0.4, 900 * 0.6, 900), 1e-9, 'the wave repeats every 2 sweeps');
  ok([0, 123, 777, 1999, 2700].every((c) => { const v = P.needle(1.234, c, 900); return v >= 0 && v <= 1; }), 'the needle stays on the bar');
  eq(P.gradeAt(0.5, false).grade, 'crit', 'the centre is critical');
  eq(P.gradeAt(0.5 + R.ZONE.crit, false).grade, 'crit', 'the golden zone edge is critical');
  eq(P.gradeAt(0.5 + R.ZONE.crit + 0.01, false).grade, 'strong', 'just outside the gold: fuerte');
  eq(P.gradeAt(0.5 - R.ZONE.strong, false).grade, 'strong', 'fuerte edge');
  eq(P.gradeAt(0.5 - R.ZONE.good, false).grade, 'good', 'bien edge');
  eq(P.gradeAt(0.02, false).grade, 'weak', 'the far edge: flojo');
  eq(P.gradeAt(0.5 + 0.11, true), { grade: 'crit', luck: true }, 'the wide golden zone: a lucky critical');
  eq(P.gradeAt(0.5 + 0.05, true), { grade: 'crit', luck: false }, 'inside the normal gold it is a real critical even when wide');
  eq(P.gradeAt(0.5 + 0.11, false).grade, 'strong', 'the same spot without the comeback: fuerte');
}

// ---------- a right answer opens a hit; the server judges the tap ----------
{
  const pl = room(2, 2);
  const m = game(pl);
  P.startPlay(m, 0);
  const p = pl.r0;
  const r = P.answer(m, p, true, 1500, 1000);
  ok(r.right && r.swing && r.swing.hid > 0 && r.swing.lead === R.LEAD_MS && r.swing.window === R.WINDOW_MS, 'a right answer opens a swing');
  ok(r.swing.phase >= 0 && r.swing.phase <= 2, 'a random start for the arrow');
  eq(r.swing.fast, true, 'answered in 1.5 s: ¡Rápido!');
  eq(r.swing.bonus, 1, 'fast = +1 power');
  eq(p.pnFast, 1500, 'fastest answer kept');
  // the phone's ping answer measures its round trip
  ok(P.ack(m, p, r.swing.hid, 1000 + 120), 'ack measures the round trip');
  eq(p.pnSwing.rtt, 120, 'rtt 120');
  ok(!P.ack(m, p, r.swing.hid, 1000 + 400), 'a second ack is ignored');
  {
    // the round trip is the median of the phone's last 5 (one slow sample doesn't move the judge); none while paused
    const q = { team: 'red', pnId: 999, name: 'Q' };
    P.resetKid(q, m);
    [80, 90, 900, 85, 95].forEach((rt, i) => { P.answer(m, q, true, 8000, 100000 + i * 10000); P.ack(m, q, q.pnSwing.hid, 100000 + i * 10000 + rt); if (i < 4) q.pnSwing = null; });
    eq(q.pnSwing.rtt, 90, 'median of 80, 90, 900, 85, 95 = 90');
    q.pnSwing = null;
    P.answer(m, q, true, 8000, 200000);
    m.paused = true;
    ok(!P.ack(m, q, q.pnSwing.hid, 200050), 'an ack during the pause is not a round trip');
    m.paused = false;
    q.pnSwing = null;
  }
  // an honest tap right in the centre: critical, 6 + fast 1
  p.pnSwing.phase = 0;
  const h = P.hit(m, p, r.swing.hid, cAt(0.5), false, recvAt(1000, cAt(0.5), 120));
  eq(h.grade, 'crit', 'an honest centre tap is critical');
  eq(h.power, R.POWER.crit + 1, 'critical 6 + rápido 1');
  eq(p.pnCandy, 7, 'the kid has 7 candies');
  eq(p.pnHits, 1, 'one hit');
  eq(p.pnCrits, 1, 'one critical');
  ok(h.pos !== null && Math.abs(h.pos - 0.5) < 1e-9, 'judged at the needle the kid saw');
  eq(P.hit(m, p, r.swing.hid, cAt(0.5), false, 5000), null, 'a second tap on the same swing is ignored');
  eq(p.pnSwing, null, 'the swing is closed');
  ok(p.pnNextQAt === recvAt(1000, cAt(0.5), 120) + R.RESULT_MS, 'the next question after the result');

  // a wrong answer: no swing, streak reset, the wait
  const q = pl.r1;
  const w = P.answer(m, q, false, 3000, 2000);
  ok(!w.right && w.wait === R.WRONG_MS && !q.pnSwing, 'a wrong answer is a wait, no hit');
  eq(q.pnStreak, 0, 'streak reset');

  // a tampered clock: the phone claims the centre, but by the server's clock the tap was at the edge
  const g0 = pl.g0;
  swing(m, g0, 3000, 0, 100);
  const realC = cAt(0.05);                                       // the needle was near the left edge
  const t = P.hit(m, g0, g0.pnSwing.hid, cAt(0.5), false, recvAt(3000, realC, 100));
  ok(t.grade !== 'crit', `a claimed centre far from the server's estimate is clamped (${t.grade}, c ${t.c})`);
  ok(Math.abs(t.c - realC) <= R.TOL_MS, 'the accepted time stays within ± TOL of the estimate');
  // jitter inside the band is the kid's own tap
  const g1 = pl.g1;
  swing(m, g1, 4000, 0, 200);
  const j = P.hit(m, g1, g1.pnSwing.hid, cAt(0.5), false, recvAt(4000, cAt(0.5) + 120, 200));
  eq(j.grade, 'crit', 'network jitter of 120 ms keeps the kid\'s critical');
  // a claim just outside the band is graded where the server's clock puts the tap, not at the band's edge
  swing(m, g1, 4500, 0, 100);
  const edgeC = cAt(0.2);                                           // the arrow really was at 0.2 (fuerte's far edge)
  const far = P.hit(m, g1, g1.pnSwing.hid, edgeC + R.TOL_MS + 60, false, recvAt(4500, edgeC, 100));
  ok(far.c === Math.round(edgeC), `a claim outside ± TOL is replaced by the server's estimate (${far.c} vs ${Math.round(edgeC)})`);
  // no ping answer: the default round trip
  const r1 = pl.r1;
  swing(m, r1, 5000, 0, null);
  const d = P.hit(m, r1, r1.pnSwing.hid, cAt(0.5), false, recvAt(5000, cAt(0.5), R.RTT_DEFAULT));
  eq(d.grade, 'crit', 'without an ack the default round trip is used');
  // a missing / bad c → the server's own estimate
  swing(m, r1, 6000, 0, 100);
  const e = P.hit(m, r1, r1.pnSwing.hid, 'x', false, recvAt(6000, cAt(0.5), 100));
  eq(e.grade, 'crit', 'a missing tap time uses the server estimate');
  // a wrong id is refused
  swing(m, r1, 7000, 0, 100);
  eq(P.hit(m, r1, 9999, cAt(0.5), false, 8000), null, 'a wrong swing id is refused');
  // the automatic hit (the phone's window ran out): power 1, no bonuses
  const a = P.hit(m, r1, r1.pnSwing.hid, null, true, 10000);
  eq(a.grade, 'auto', 'automatic hit');
  eq(a.power, R.POWER.auto, 'an automatic hit is 1 and never gets the bonuses');
  // a tap arriving after the window (+ grace + its round trip) is an automatic hit, not the claimed critical
  swing(m, r1, 20000, 0, 100);
  const lateAt = P.closeAt(r1.pnSwing) + 50;
  const l = P.hit(m, r1, r1.pnSwing.hid, cAt(0.5), false, lateAt);
  eq(l.grade, 'auto', 'a tap after the window is an automatic hit');
  // a weak tap is never worth less than the automatic one
  ok(R.POWER.weak >= R.POWER.auto, 'a tap never earns less than waiting');
}

// ---------- power: racha, ×2 ----------
{
  const pl = room(1, 1);
  const m = game(pl);
  P.startPlay(m, 0);
  const p = pl.r0;
  const pows = [];
  for (let i = 0; i < 7; i++) {
    const now = 1000 + i * 10000;
    P.answer(m, p, true, 8000, now);                              // slow answers: no ¡Rápido!
    p.pnSwing.phase = 0;
    p.pnSwing.rtt = 100;
    pows.push(P.hit(m, p, p.pnSwing.hid, cAt(0.32), false, recvAt(now, cAt(0.32), 100)).power);   // fuerte (d 0.18)
  }
  eq(pows, [3, 3, 4, 4, 4, 5, 5], 'racha: +1 from 3 right in a row, +2 from 6');
  P.answer(m, p, false, 3000, 90000);
  P.answer(m, p, true, 8000, 91000);
  eq(p.pnSwing.bonus, 0, 'a wrong answer resets the racha bonus');
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  m.frenzy = true;
  const f = P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, recvAt(91000, cAt(0.5), 100));
  eq(f.power, R.POWER.crit * 2, 'the last 30 s: ×2');
}

// ---------- the comeback: wide golden zone, lucky extra capped at the gap ----------
{
  const pl = room(1, 1);
  const m = game(pl);
  P.startPlay(m, 0);
  const p = pl.r0;
  m.candy = { red: 10, gold: 40 };
  m.behind = 'red';
  P.answer(m, p, true, 8000, 1000);
  ok(p.pnSwing.wide, 'the trailing team gets the wide golden zone');
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  const lucky = P.hit(m, p, p.pnSwing.hid, cAt(0.61), false, recvAt(1000, cAt(0.61), 100));   // d 0.11: only the wide zone
  ok(lucky.luck && lucky.crit, 'a lucky critical');
  eq(lucky.power, 6, 'gap 30 ≥ the extra: the full critical');
  // a small gap: the extra stops at the gap
  const q = pl.g0;
  m.candy = { red: 41, gold: 40 };
  m.behind = 'gold';
  P.answer(m, q, true, 8000, 20000);
  q.pnSwing.phase = 0; q.pnSwing.rtt = 100;
  const capped = P.hit(m, q, q.pnSwing.hid, cAt(0.61), false, recvAt(20000, cAt(0.61), 100));
  // base fuerte 3 → gap after it = 41 − 40 − 3 < 0 → no extra at all
  eq(capped.power, 3, 'the lucky extra never jumps the gap (it stops at fuerte)');
  ok(m.candy.gold <= m.candy.red + 3, 'luck alone did not pass the leader by more than a fuerte');
  // the leader never gets the wide zone
  m.behind = 'gold';
  P.answer(m, p, true, 8000, 40000);
  ok(!p.pnSwing.wide, 'the leading team keeps the normal golden zone');
  p.pnSwing = null;
  // a real (narrow) critical is never capped
  m.candy = { red: 0, gold: 100 };
  p.pnStreak = 0;
  m.behind = 'red';
  P.answer(m, p, true, 8000, 60000);
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  const real = P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, recvAt(60000, cAt(0.5), 100));
  ok(real.crit && !real.luck && real.power === R.POWER.crit, 'a real critical keeps its full value');
}

// ---------- team size weighting ----------
{
  const w = P.weights({ red: 8, gold: 7 });
  ok(Math.abs(w.red - 7.5 / 8) < 1e-9 && Math.abs(w.gold - 7.5 / 7) < 1e-9, '8 vs 7: ×0.9375 vs ×1.071');
  const pl = room(2, 1);
  const m = game(pl);
  P.startPlay(m, 0);
  m.w = P.weights(P.teamSizes(pl));
  const p = pl.g0;
  P.answer(m, p, true, 8000, 1000);
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, recvAt(1000, cAt(0.5), 100));
  near(m.candy.gold, 6 * 1.5, 1e-9, 'the lone Mar kid counts ×1.5 for the team');
  eq(p.pnCandy, 6, 'but their own count stays real');
}

// ---------- the ladder: bursts, jackpots, landmarks ----------
{
  const pl = room(3, 3);
  const m = game(pl, 180);
  P.startPlay(m, 0);
  m.w = { red: 1, gold: 1 };
  ok(m.E === P.expected(180, 3), 'E from the time and the class size');
  const t0 = P.threshold(m, 0), t1 = P.threshold(m, 1), t3 = P.threshold(m, 3), t4 = P.threshold(m, 4);
  ok(t0 > 0 && t1 > t0 && t3 > P.threshold(m, 2) && t4 > t3, 'the ladder climbs');
  near(t0, Math.round(m.E * 0.12), 0, 'the first tiger breaks at 12 % of E');
  ok(P.life(m, 1) > P.life(m, 0) && P.life(m, 3) > P.life(m, 2), 'every tiger is bigger than the last');
  eq(P.tierInfo(3).gold, true, 'the Burj Khalifa tiger is golden');
  eq(P.tierInfo(5).name, 'Tigre de oro', 'after the landmarks: golden tigers');
  // Fuego breaks the first tiger: jackpot + the landmark
  m.dmg.red = t0 - 2;
  m.candy.red = t0 - 2;
  const p = pl.r0;
  P.answer(m, p, true, 8000, 1000);
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  const h = P.hit(m, p, p.pnSwing.hid, cAt(0.32), false, recvAt(1000, cAt(0.32), 100));   // fuerte 3 ≥ 2 left
  eq(h.bursts.length, 1, 'the hit broke the tiger');
  const b = h.bursts[0];
  ok(b.tier === 0 && b.team === 'red' && b.landmark && b.bonus === P.landmarkBonus(m) && b.jackpot === P.jackpot(m, 0), 'jackpot + the landmark for the first team');
  eq(m.tier.red, 1, 'Fuego is on the second tiger');
  near(m.candy.red, t0 - 2 + 3 + b.jackpot + b.bonus, 1e-9, 'candies = hits + jackpot + landmark');
  eq(m.landmarks[0].team, 'red', 'the Museo del Futuro is Fuego\'s');
  eq(p.pnBursts, 1, 'the kid broke one piñata');
  ok(p.pnNextQAt >= recvAt(1000, cAt(0.32), 100) + R.RESULT_MS + R.BURST_MS, 'the breaker gets time for the big moment');
  // Mar breaks the same tiger later: its jackpot, no landmark
  m.dmg.gold = t0 - 1;
  const q = pl.g0;
  P.answer(m, q, true, 8000, 9000);
  q.pnSwing.phase = 0; q.pnSwing.rtt = 100;
  const h2 = P.hit(m, q, q.pnSwing.hid, cAt(0.32), false, recvAt(9000, cAt(0.32), 100));
  ok(h2.bursts.length === 1 && !h2.bursts[0].landmark && h2.bursts[0].bonus === 0 && h2.bursts[0].jackpot === b.jackpot, 'the second team gets the jackpot, not the landmark');
  eq(m.landmarks[0].team, 'red', 'a landmark is won once');
  // one huge hit breaks two tigers
  m.dmg.red = P.threshold(m, 2) - 1;
  m.frenzy = true;
  P.answer(m, p, true, 1000, 20000);
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  const t2 = P.threshold(m, 2);
  m.dmg.red = t2 - 1;
  m.tier.red = 1;
  const big = P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, recvAt(20000, cAt(0.5), 100));
  ok(big.bursts.length >= 1 && m.tier.red >= 2, `a big hit can break the tiger(s) in its way (${big.bursts.length})`);
  ok(m.dmg.red < P.threshold(m, m.tier.red), 'the team is on a tiger it has not broken');
  // display
  const d = P.display(m);
  ok(d.tr === m.tier.red && d.hr > 0 && d.hr <= d.lr && d.lg > 0, 'display: tier, life left ≤ life');
}

// ---------- rescale ----------
{
  const pl = room(2, 2);
  const m = game(pl, 180);
  const E0 = m.E;
  const big = room(10, 10);
  ok(P.rescale(m, P.teamSizes(big), 0), 'late joiners in the intro grow the ladder');
  ok(m.E > E0, 'E grows');
  ok(!P.rescale(m, P.teamSizes(pl), 0), 'never down');
  P.startPlay(m, 1000);
  m.fixed[0] = P.threshold(m, 0);
  const keep = P.threshold(m, 0);
  ok(P.rescale(m, P.teamSizes(room(20, 20)), 5000), 'still early: grows');
  eq(P.threshold(m, 0), keep, 'a tiger somebody broke keeps its number');
  ok(!P.rescale(m, P.teamSizes(room(30, 30)), 1000 + R.RESCALE_MS + 1), 'after 20 s of play: no rescale');
}

// ---------- the room clock: lead, behind, frenzy ----------
{
  const pl = room(2, 2);
  const m = game(pl, 120);
  P.startPlay(m, 0);
  m.candy = { red: 3, gold: 0 };
  eq(P.tick(m, 1000).lead, null, 'a lead under 4 does not count');
  m.candy = { red: 6, gold: 0 };
  eq(P.tick(m, 2000).lead, { team: 'red', first: true }, 'the first lead is announced');
  m.candy = { red: 6, gold: 12 };
  eq(P.tick(m, 4000).lead, null, 'alarms are at least 7 s apart');
  eq(P.tick(m, 9100).lead, { team: 'gold', first: false }, 'then the lead change');
  eq(m.behind, null, 'a gap of 6 is under 10: nobody gets the wide golden zone');
  m.candy = { red: 10, gold: 40 };
  P.tick(m, 9300);
  eq(m.behind, 'red', 'a 30 gap: Fuego gets the wide golden zone');
  m.candy = { red: 38, gold: 40 };
  P.tick(m, 9500);
  eq(m.behind, null, 'close: nobody gets it');
  ok(!m.frenzy, 'no frenzy yet');
  const ev = P.tick(m, m.frenzyAt);
  ok(ev.frenzy && m.frenzy, 'the last 30 s');
  eq(m.endsAt - m.frenzyAt, 30000, 'the frenzy is the last 30 s of 2 min');
  ok(P.frenzyMs(60) === 20000, 'a 1-minute game: the last third');
  // +30 s
  const end0 = m.endsAt;
  ok(P.addTime(m, 30000) && m.endsAt === end0 + 30000, '+30 s moves the end');
}

// ---------- pause and «¡FINAL!» ----------
{
  const pl = room(1, 1);
  const m = game(pl);
  P.startPlay(m, 0);
  const p = pl.r0;
  P.answer(m, p, true, 8000, 1000);
  p.pnSwing.phase = 0; p.pnSwing.rtt = 100;
  m.paused = true;
  eq(P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, 2000), null, 'no hit while paused');
  m.paused = false;
  P.shiftTimes(m, 10000);
  P.shiftSwing(p, 10000);
  const h = P.hit(m, p, p.pnSwing.hid, cAt(0.5), false, recvAt(11000, cAt(0.5), 100));
  eq(h.grade, 'crit', 'after a 10 s pause the swing goes on where it was');
  // «¡FINAL!»: a tap in flight still counts, a later one is automatic
  const q = pl.g0;
  P.answer(m, q, true, 8000, 50000);
  q.pnSwing.phase = 0; q.pnSwing.rtt = 100;
  P.final(m, 50000 + R.LEAD_MS + 300);
  const inFlight = P.hit(m, q, q.pnSwing.hid, cAt(0.5), false, recvAt(50000, cAt(0.5), 100));
  ok(inFlight && inFlight.grade === 'crit', 'a tap already on its way at «¡FINAL!» counts');
  P.answer(m, q, true, 8000, 60000);
  q.pnSwing.phase = 0; q.pnSwing.rtt = 100;
  m.endedAt = 60000;
  const after = P.hit(m, q, q.pnSwing.hid, cAt(0.5), false, 60000 + R.GRACE_MS + 100 + 400);
  eq(after.grade, 'auto', 'after «¡FINAL!» + grace: an automatic hit');
  m.phase = 'done';
  P.answer(m, q, true, 8000, 70000);
  eq(P.hit(m, q, q.pnSwing.hid, cAt(0.5), false, 70500), null, 'no hits once the game is over');
}

// ---------- stars and the end ----------
{
  const row = (k, team, o) => Object.assign({ k, name: 'K' + k, skin: 'dralingo', team, candy: 0, hits: 0, crits: 0, right: 0, answered: 0, best: 0, fast: null, behind: 0, bursts: 0 }, o);
  const rows = [
    row(1, 'red', { candy: 30, hits: 6, crits: 2, right: 6, answered: 7, best: 4, fast: 2100, behind: 5 }),
    row(2, 'red', { candy: 30, hits: 5, crits: 2, right: 5, answered: 5, best: 4, fast: 900, behind: 0 }),
    row(3, 'gold', { candy: 12, hits: 6, crits: 0, right: 6, answered: 9, best: 2, fast: 900, behind: 12 }),
    row(4, 'gold'),                                              // a kid with 0
  ];
  const st = P.stars(rows);
  const by = (id) => st.find((s) => s.id === id);
  eq(by('hits').winners, [1, 3], 'Más golpes: a tie shares the star');
  eq(by('crits').winners, [1, 2], 'Más críticos: tie');
  eq(by('fast').winners, [2, 3], 'Respuesta más rápida: tie');
  eq(by('fast').value, 0.9, 'fast in seconds');
  eq(by('streak').winners, [1, 2], 'Racha más larga');
  eq(by('comeback').winners, [3], 'Gran remontada');
  ok(st.every((s) => !s.winners.includes(4)), 'a kid with 0 gets no star');
  const none = P.stars([row(9, 'red')]);
  eq(none.length, 0, 'nobody qualifies → no stars');
  const m = P.newGame(7, 120, 0, { red: 2, gold: 2 });
  m.candy = { red: 80.4, gold: 60 };
  const fin = P.finish(m, rows);
  eq(fin.winner, 'red', 'the winner by candies');
  eq(fin.totals.r, 80, 'totals rounded');
  eq(fin.rows.map((r) => r.k), [1, 2, 3, 4], 'sorted by candies, then hits');
  eq(fin.rows.map((r) => r.rank), [1, 1, 3, 4], 'ties share a rank');
  eq(fin.mvp, { red: 1, gold: 3 }, 'MVP per team (most candies, then hits)');
  eq(rows[0].share, 50, 'share of the team\'s candies');
  eq(rows[3].stars, [], 'a kid with 0: no stars, no shame');
  m.candy = { red: 50, gold: 50.2 };
  eq(P.finish(m, rows).winner, 'tie', 'a tie when the shown totals are equal');
}

// ---------- 300 simulated classes ----------
{
  let classes = 0, bursts = 0, landmarks = 0, crits = 0, autos = 0, ties = 0;
  for (let s = 1; s <= 300; s++) {
    const rng = (() => { let a = s * 9301 + 49297; return () => { a = (a * 233280 + 49297) % 2147483647; return a / 2147483647; }; })();
    const nKids = 2 + Math.floor(rng() * 39);
    const players = {};
    for (let i = 0; i < nKids; i++) { const t = P.pickTeam(players, null); players['p' + i] = kid(t); }
    const dur = [120, 180, 240][s % 3];
    const m = P.newGame(s, dur, 0, P.teamSizes(players));
    Object.values(players).forEach((p) => P.resetKid(p, m));
    P.startPlay(m, 0);
    let jack = { red: 0, gold: 0 };
    let weighted = { red: 0, gold: 0 };
    const busyUntil = {};
    for (let now = 0; now < m.endsAt; now += 250) {
      m.w = P.weights(P.teamSizes(players));
      Object.entries(players).forEach(([id, p]) => {
        if ((busyUntil[id] || 0) > now) return;
        if (p.pnSwing) {
          const auto = rng() < 0.08;
          const before = m.candy[p.team];
          const w = m.w[p.team];
          const h = P.hit(m, p, p.pnSwing.hid, rng() * R.WINDOW_MS, auto, now);
          if (!h) return;
          weighted[p.team] += h.power * w;
          h.bursts.forEach((b) => { jack[b.team] += b.jackpot + b.bonus; bursts++; if (b.landmark) landmarks++; });
          if (h.crit) crits++;
          if (h.grade === 'auto') autos++;
          ok(m.candy[p.team] >= before + h.power * w - 1e-9, 'a hit never lowers the team');
          busyUntil[id] = now + R.RESULT_MS;
          return;
        }
        if (rng() < 0.18) {
          const r = P.answer(m, p, rng() < 0.7, 1000 + rng() * 9000, now);
          if (r.right) { P.ack(m, p, r.swing.hid, now + 80 + rng() * 200); busyUntil[id] = now + R.LEAD_MS; }
          else busyUntil[id] = now + R.WRONG_MS;
        }
      });
      P.tick(m, now);
    }
    ['red', 'gold'].forEach((t) => {
      near(m.candy[t], weighted[t] + jack[t], 1e-6, `class ${s}: ${t} candies = weighted hits + jackpots + landmarks`);
      ok(m.dmg[t] < P.threshold(m, m.tier[t]) && m.dmg[t] >= P.threshold(m, m.tier[t] - 1) - 1e-9, `class ${s}: ${t} is on the right tiger`);
    });
    ok(m.landmarks.every((l) => l.team === null || l.team === 'red' || l.team === 'gold'), 'landmarks have one owner');
    const rows = Object.values(players).map((p) => ({ k: p.pnId, name: p.name, team: p.team, candy: p.pnCandy, hits: p.pnHits, crits: p.pnCrits, right: p.pnRight, answered: p.pnAnswered, best: p.pnBest, fast: p.pnFast, behind: p.pnBehind, bursts: p.pnBursts }));
    const fin = P.finish(m, rows);
    ok(['red', 'gold', 'tie'].includes(fin.winner) && Number.isFinite(fin.totals.r) && Number.isFinite(fin.totals.g), `class ${s}: a result`);
    ok(rows.every((r) => r.hits === r.right || r.hits === r.right - 1), `class ${s}: every right answer is a hit (one may be open at the end)`);
    if (fin.winner === 'tie') ties++;
    classes++;
  }
  ok(bursts > 300 && landmarks > 0 && crits > 0 && autos > 0, `the simulated classes break tigers (${bursts} bursts, ${landmarks} landmarks, ${crits} criticals, ${autos} automatic)`);
  console.log(`  simulated ${classes} classes: ${bursts} piñatas broken, ${landmarks} landmarks, ${crits} criticals, ${autos} automatic hits, ${ties} ties`);
}

console.log(`test-pinata: ${checks} checks OK`);
