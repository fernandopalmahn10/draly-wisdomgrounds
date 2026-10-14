// Rules check for Ojo de Halcón (core/look.js). Run: node scripts/test-look.js
'use strict';
const assert = require('assert');
const L = require('../core/look');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };

const Q = (i) => ({ text: `Pregunta ${i}`, correct: 'mama', answers: ['mama', 'baba', 'gege', 'jiejie'], image: null });
const kids = (n, k) => {
  const players = {};
  for (let i = 1; i <= n; i++) { players['s' + i] = { name: 'Kid' + i, avatar: '', score: 0, disconnected: false }; L.preparePlayer(k, players['s' + i]); }
  return players;
};

// ---------- the schedule ----------
for (let seed = 1; seed <= 400; seed++) {
  const k = L.newGame(seed, 10, 1000);
  const q = L.startRound(k, Q(1), '/assets/x.webp', 1000);
  eq(q.opts.slice().sort(), ['baba', 'gege', 'jiejie', 'mama'], `seed ${seed}: four answers on four lamps`);
  eq(q.opts[q.correctPos], 'mama', `seed ${seed}: the right word is on correctPos`);
  eq(q.order.slice().sort(), [0, 1, 2, 3], `seed ${seed}: every lamp lights once`);
  ok(q.open === 1000 + L.R.SHOW_MS, `seed ${seed}: the question is alone for SHOW_MS`);
  const first = q.at[q.order[0]];
  ok(first >= q.open + L.R.FIRST_MS[0] && first <= q.open + L.R.FIRST_MS[1], `seed ${seed}: first lamp in its window`);
  let pairs = 0;
  for (let j = 1; j < 4; j++) {
    const gap = q.at[q.order[j]] - q.at[q.order[j - 1]];
    ok(gap >= 0, `seed ${seed}: lamps light in order`);
    if (gap === 0) pairs++;
    else ok(gap >= L.R.GAP_MS[0] && gap <= L.R.GAP_MS[1], `seed ${seed}: gap ${gap} in its window`);
  }
  ok(pairs <= 1, `seed ${seed}: at most one pair of lamps together`);
  eq(q.last, Math.max(...q.at), `seed ${seed}: last = the last lamp`);
  eq(q.closeAt, q.last + L.R.AFTER_LAST_MS, `seed ${seed}: closes AFTER_LAST_MS after the last lamp`);
  eq(q.image, '/assets/x.webp', 'picture carried');
  // same seed, same schedule
  const k2 = L.newGame(seed, 10, 1000);
  const q2 = L.startRound(k2, Q(1), null, 1000);
  eq(q2.at, q.at, `seed ${seed}: deterministic`);
}
{ // the right answer's lamp is sometimes first, sometimes last
  const where = [0, 0, 0, 0];
  for (let seed = 1; seed <= 600; seed++) { const k = L.newGame(seed, 10, 0); const q = L.startRound(k, Q(1), null, 0); where[q.order.indexOf(q.correctPos)]++; }
  where.forEach((c, i) => ok(c > 80, `the right lamp lights ${i + 1}th often enough (${c}/600)`));
}

// ---------- points ----------
eq([1, 2, 3, 4].map((r) => L.pointsFor(r, 4)), [5, 3, 2, 1], 'four kids: the original 5 / 3 / 2 / 1');
eq([1, 2, 3].map((r) => L.pointsFor(r, 1)), [5, 3, 2], 'one kid alone still gets +5');
eq([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20].map((r) => L.pointsFor(r, 20)), [5, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1], '20 kids: 1 × +5, 4 × +3, 7 × +2, the rest +1');
eq(L.pointsFor(0, 20), 0, 'no rank, no points');
eq(L.pointsFor(30, 30), 1, 'the last right look still gets +1');
eq(L.clampRounds(3), 5, 'rounds floor'); eq(L.clampRounds(99), 30, 'rounds cap'); eq(L.clampRounds('abc'), 10, 'rounds default');
eq(L.timeCapS(10), 200, 'time cap 10 rounds');

// ---------- looking ----------
{
  const k = L.newGame(7, 10, 0);
  const P = kids(4, k);
  eq(Object.values(P).map((p) => p.lkIdx), [1, 2, 3, 4], 'panel indices by join order');
  ok(!L.preparePlayer(k, P.s1) && P.s1.lkIdx === 1, 'preparing twice keeps the panel');
  const q = L.startRound(k, Q(1), null, 0);
  eq(L.look(k, P.s1, q.correctPos, q.at[q.correctPos] + 10).status, 'closed', 'no looking while the question is alone');
  L.beginReveal(k, q.open);
  eq(L.look(k, P.s1, q.correctPos, q.at[q.correctPos] - 1).status, 'blank', 'a dark lamp: nothing happens');
  ok(!k.looks[1], 'a blank tap does not lock');
  eq(L.look(k, P.s1, 9, q.at[q.correctPos]).status, 'closed', 'bad position ignored');
  const r1 = L.look(k, P.s1, q.correctPos, q.at[q.correctPos] + 300);
  eq([r1.status, r1.look.rank, r1.look.ms], ['ok', 1, 300], 'first right look: rank 1');
  eq(L.look(k, P.s1, q.correctPos, q.at[q.correctPos] + 400).status, 'locked', 'can\'t look twice');
  const wrongPos = [0, 1, 2, 3].find((p) => p !== q.correctPos);
  const r2 = L.look(k, P.s2, wrongPos, Math.max(q.at[wrongPos], q.at[q.correctPos]) + 100);
  eq([r2.status, r2.look.ok, r2.look.rank], ['wrong', false, 0], 'wrong lamp: locked with 0');
  eq(L.look(k, P.s2, q.correctPos, q.last + 100).status, 'locked', 'wrong look locks the round');
  const r3 = L.look(k, P.s3, q.correctPos, q.at[q.correctPos] + 900);
  eq(r3.look.rank, 2, 'second right look: rank 2');
  ok(!L.everyoneLooked(k, P), 'one kid still to look');
  L.look(k, P.s4, q.correctPos, q.last + 1000);
  ok(L.everyoneLooked(k, P), 'everyone looked');
  const res = L.closeRound(k, P, q.last + 1200);
  eq(res.rows.map((r) => r.pts), [5, 0, 3, 2], 'points by rank, 0 for the wrong look');
  eq(res.rows.map((r) => r.score), [5, 0, 3, 2], 'scores');
  eq(res.first.idx, 1, 'the first eye');
  eq(res.correctText, 'mama', 'the right word for the screens');
  eq([P.s1.lkStreak, P.s2.lkStreak, P.s1.lkFirsts, P.s2.lkWrong, P.s1.lkRight], [1, 0, 1, 1, 1], 'stats');
  eq(L.look(k, P.s1, q.correctPos, q.last + 1300).status, 'closed', 'closed after the result');
  // a kid who never looks: 0 and a miss
  const q2 = L.startRound(k, Q(2), null, 20000);
  L.beginReveal(k, q2.open);
  L.look(k, P.s2, q2.correctPos, q2.at[q2.correctPos] + 50);
  const res2 = L.closeRound(k, P, q2.closeAt);
  eq(res2.rows.map((r) => r.pts), [0, 5, 0, 0], 'only the kid who looked scores');
  eq([P.s1.lkMiss, P.s1.lkStreak, P.s2.lkStreak], [1, 0, 1], 'miss counted, streak reset');
  eq(res2.round, 2, 'round counter');
  ok(!res2.last, 'not the last round');
}
// paused: no looks; after the pause the lamps keep their relative moments
{
  const k = L.newGame(11, 10, 0);
  const P = kids(2, k);
  const q = L.startRound(k, Q(1), null, 0);
  L.beginReveal(k, q.open);
  const before = q.at.slice();
  k.paused = true;
  eq(L.look(k, P.s1, q.correctPos, q.last + 1).status, 'closed', 'paused: taps ignored');
  L.shiftTimes(k, 5000);
  k.paused = false;
  eq(k.q.at, before.map((t) => t + 5000), 'lamps shifted by the pause');
  eq(k.q.closeAt, before.reduce((a, b) => Math.max(a, b)) + 5000 + L.R.AFTER_LAST_MS, 'close shifted');
  eq(L.offsets(k, before[0] + 5000), k.q.at.map((t) => t - before[0] - 5000), 'offsets from now');
  eq(L.look(k, P.s1, q.correctPos, k.q.at[q.correctPos] + 5).status, 'ok', 'looking again after the pause');
}
// late joiner mid-round, disconnected kid at close
{
  const k = L.newGame(21, 10, 0);
  const P = kids(3, k);
  const q = L.startRound(k, Q(1), null, 0);
  L.beginReveal(k, q.open);
  P.late = { name: 'Late', avatar: '', score: 0, disconnected: false };
  L.preparePlayer(k, P.late);
  eq(P.late.lkIdx, 4, 'late joiner gets the next panel');
  L.look(k, P.late, q.correctPos, q.at[q.correctPos] + 10);
  P.s2.disconnected = true;
  const res = L.closeRound(k, P, q.closeAt);
  eq(res.n, 3, 'n counts connected kids (and a gone kid who looked)');
  eq(res.rows.find((r) => r.idx === 4).pts, 5, 'late joiner can win the round');
  eq(res.rows.find((r) => r.idx === 2).off, true, 'gone kid flagged');
  eq(P.s2.lkMiss, 0, 'a gone kid is not a miss');
}

// ---------- finish ----------
{
  const k = L.newGame(5, 10, 0);
  const P = kids(5, k);
  // 3 rounds: s1 fastest twice, s2 right every time slower, s3 wrong, s4 right once, s5 never looks
  for (let r = 0; r < 3; r++) {
    const q = L.startRound(k, Q(r), null, r * 10000);
    L.beginReveal(k, q.open);
    const c = q.correctPos, t = q.at[c];
    if (r < 2) L.look(k, P.s1, c, t + 100);
    L.look(k, P.s2, c, t + 600);
    L.look(k, P.s3, [0, 1, 2, 3].find((p) => p !== c), q.last + 10);
    if (r === 0) L.look(k, P.s4, c, t + 900);
    L.closeRound(k, P, q.closeAt);
  }
  const fin = L.finish(k, P);
  eq(fin.rows.map((r) => r.name), ['Kid2', 'Kid1', 'Kid4', 'Kid3', 'Kid5'], 'standings: score, then +5s, then reaction');
  eq([fin.winner.name, fin.tie], ['Kid2', false], 'winner: right every round (3 + 3 + 5) beats two firsts (5 + 5)');
  eq(fin.rows[0].score, 3 + 3 + 5, 'winner: two +3 and the +5 of round 3');
  eq(fin.rows[1].score, 10, 'second: two firsts = 10');
  eq(fin.awards.eye.name, 'Kid1', '🦅 most +5');
  eq(fin.awards.fastest.name, 'Kid2', '⚡ fastest among the rest (awards go to different kids)');
  eq(fin.awards.streak.name, 'Kid2', '🔥 best streak: Kid2 (3) — Kid1 already has the eye award, Kid2 has the best streak anyway');
  eq(fin.rounds, 3, 'rounds played');
  eq(fin.rows[4].avg, null, 'no rights: no average');
  // tie
  const k2 = L.newGame(6, 10, 0);
  const P2 = kids(2, k2);
  const q = L.startRound(k2, Q(1), null, 0);
  L.beginReveal(k2, q.open);
  L.look(k2, P2.s1, q.correctPos, q.at[q.correctPos] + 5);
  L.closeRound(k2, P2, q.closeAt);
  P2.s2.score = 5;
  const f2 = L.finish(k2, P2);
  eq([f2.tie, f2.winners.length], [true, 2], 'a tie lists both');
}

// ---------- simulated classes: never a throw, scores add up ----------
for (let seed = 100; seed < 160; seed++) {
  const rng = L.mulberry32(seed);
  const n = 4 + Math.floor(rng() * 27);
  const k = L.newGame(seed, 10, 0);
  const P = kids(n, k);
  let now = 0;
  const given = {};
  for (let r = 0; r < 10; r++) {
    const q = L.startRound(k, Q(r), null, now);
    L.beginReveal(k, q.open);
    const events = [];
    Object.values(P).forEach((p) => {
      const roll = rng();
      if (roll < 0.1) return;                                     // distracted
      const pos = roll < 0.3 ? Math.floor(rng() * 4) : q.correctPos;
      events.push({ p, pos, t: q.at[pos] + Math.floor(rng() * 2500) });
    });
    events.sort((a, b) => a.t - b.t).forEach((e) => { const r2 = L.look(k, e.p, e.pos, e.t); ok(['ok', 'wrong', 'locked', 'blank'].includes(r2.status), 'a look status'); });
    const res = L.closeRound(k, P, q.closeAt);
    res.rows.forEach((row) => { given[row.idx] = (given[row.idx] || 0) + row.pts; });
    const ranks = res.rows.filter((x) => x.ok).map((x) => x.rank).sort((a, b) => a - b);
    eq(ranks, ranks.map((_, i) => i + 1), `seed ${seed} round ${r}: ranks 1..m`);
    ok(res.rows.filter((x) => x.pts === 5).length <= 1, 'one +5 per round');
    now = q.closeAt + L.R.RESULT_MS;
  }
  const fin = L.finish(k, P);
  fin.rows.forEach((row) => eq(row.score, given[row.idx] || 0, `seed ${seed}: scores add up for panel ${row.idx}`));
  ok(fin.rows.length === n, 'everyone in the standings');
}

console.log(`look rules: ${checks} checks OK`);
