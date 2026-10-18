// Las Trampillas (gameType 'trapdoor'): the rules engine (core/trapdoor.js) and the shared platform
// (public/js/trapdoor-arena.js), no server. The platform's geometry (slices, the hub, the rim, what can drop), the runner's
// step (never through the hub, never into an open hole, never faster than its speed), the clock of a match (START, the
// rounds, the roulette, «0», the doors, the tally, the Final Round ×2), wings (save once), the pit (the fallen answer to
// come back), the teacher (pause, +2 rondas, skip), the ending (stars, ranks), and 360 simulated classes: a kingdom that
// answers better usually wins, an even class is a coin toss, chance still matters.
//   node scripts/test-trapdoor.js
'use strict';
const assert = require('assert');
const T = require('../core/trapdoor');
const A = require('../public/js/trapdoor-arena');
const Party = require('../core/party');
const UI = require('../public/js/party.js');

const R = T.R;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; }; }

// ---------- the platform ----------
for (let i = 0; i < A.SLICES; i++) {
  const [x, y] = A.pointAt(A.sliceMid(i), 60);
  ok(A.sliceOf(x, y) === i, `the middle of slice ${i} is on slice ${i}`);
}
ok(A.sliceOf(1, -60) === 0 && A.sliceOf(-1, -60) === 7, 'slice 0 starts at 12 o\'clock, clockwise (7 is just left of it)');
ok(A.sliceOf(60, -0.5) === 1 && A.sliceOf(60, 0.5) === 2, 'the seam at 3 o\'clock: slices 1 | 2');
ok(A.sliceOf(0, 60) === 4, '6 o\'clock is slice 4');
// what can drop
for (let s = 0; s < 8; s++) {
  const q = A.setOf('quarter', s), th = A.setOf('three', s);
  ok(q.length === 2 && q[0] === s && q[1] === (s + 1) % 8, `quarter ${s}: two neighbours`);
  ok(th.length === 3 && new Set(th).size === 3, `three ${s}: three different slices`);
}
for (let s = 0; s < 4; s++) {
  const b = A.setOf('bowtie', s);
  ok(b.length === 4 && b.includes(s) && b.includes((s + 1) % 8) && b.includes((s + 4) % 8) && b.includes((s + 5) % 8), `bowtie ${s}: two opposite quarters`);
}
ok(A.optionsOf('bowtie') === 4 && A.optionsOf('quarter') === 8 && A.optionsOf('three') === 8, 'the options of each kind');
ok(A.kindOf(1, 7) === 'quarter' && A.kindOf(3, 7) === 'quarter' && A.kindOf(4, 7) === 'three' && A.kindOf(6, 7) === 'three' && A.kindOf(7, 7) === 'bowtie', '7 rounds: quarters, then threes, the Final Round a bowtie');
ok(A.kindOf(1, 3) === 'quarter' && A.kindOf(2, 3) === 'three' && A.kindOf(3, 3) === 'bowtie', '3 rounds');
ok(A.kindOf(10, 10) === 'bowtie' && A.kindOf(5, 10) === 'quarter' && A.kindOf(6, 10) === 'three', '10 rounds');
// a tap → a point on the walkable ring
ok(A.clampTarget('a', 3) === null && A.clampTarget(NaN, 1) === null && A.clampTarget(1, Infinity) === null && A.clampTarget(undefined, 2) === null, 'taps that are not numbers are refused');
[[0, 0], [1000, -5000], [3, 4], [50, 50], [-90, 10]].forEach(([x, y]) => {
  const t = A.clampTarget(x, y);
  const r = Math.hypot(t[0], t[1]);
  ok(r >= A.R_MIN - 1e-6 && r <= A.R_MAX + 1e-6, `a tap at ${x},${y} lands on the walkable ring (${r.toFixed(1)})`);
});
// the runner: never through the hub, never past the rim, never faster than its step, gets around the hub
{
  const rand = rng(7);
  let worst = 0, inHub = 0, outRim = 0, stuck = 0;
  for (let n = 0; n < 1500; n++) {
    let [x, y] = A.clampTarget((rand() - 0.5) * 200, (rand() - 0.5) * 200);
    const [tx, ty] = A.clampTarget((rand() - 0.5) * 200, (rand() - 0.5) * 200);
    let steps = 0;
    while (Math.hypot(tx - x, ty - y) > 0.05 && steps < 400) {
      const [nx, ny] = A.move(x, y, tx, ty, R.SPEED * 0.1, null);
      worst = Math.max(worst, Math.hypot(nx - x, ny - y));
      const r = Math.hypot(nx, ny);
      if (r < A.R_MIN - 0.02) inHub++;
      if (r > A.R_MAX + 0.02) outRim++;
      x = nx; y = ny; steps++;
    }
    if (steps >= 400) stuck++;
  }
  ok(inHub === 0, 'a runner never steps into the hub');
  ok(outRim === 0, 'a runner never steps past the rim');
  ok(worst <= R.SPEED * 0.1 + 1e-6, `a runner never moves more than its step (${worst.toFixed(2)})`);
  ok(stuck === 0, 'every runner reaches its target (around the hub when it is in the way)');
  // straight across the hub: it goes around and still arrives in about the length of the way round
  let x = 0, y = -60, steps = 0;
  while (Math.hypot(0 - x, 60 - y) > 0.05 && steps < 400) { [x, y] = A.move(x, y, 0, 60, R.SPEED * 0.1, null); steps++; }
  ok(steps < 30, `straight across the platform takes ${steps} steps (≈ ${(steps / 10).toFixed(1)} s): around the hub, not stuck`);
  // never into an open hole
  const open = { 2: true, 3: true };
  let [ax, ay] = A.pointAt(A.sliceMid(1), 60);
  const tgt = A.pointAt(A.sliceMid(3), 60);
  for (let i = 0; i < 40; i++) [ax, ay] = A.move(ax, ay, tgt[0], tgt[1], R.SPEED * 0.1, open);
  ok(A.sliceOf(ax, ay) === 1, 'a runner stops at the edge of an open hole');
  // already over a hole (hovering on wings): it may fly out of it
  let [hx, hy] = A.pointAt(A.sliceMid(2), 60);
  const out = A.pointAt(A.sliceMid(5), 60);
  for (let i = 0; i < 40; i++) [hx, hy] = A.move(hx, hy, out[0], out[1], R.SPEED * 0.1, null);
  ok(A.sliceOf(hx, hy) === 5, 'a kid on wings flies out over the hole');
}
// spawns: on the ring, spread
{
  const pts = [];
  for (let k = 1; k <= 40; k++) { const p = A.spawnAt(k, 0); pts.push(p); const r = Math.hypot(p[0], p[1]); ok(r >= A.R_MIN && r <= A.R_MAX, `kid ${k} starts on the walkable ring`); }
  const slices = new Set(pts.map((p) => A.sliceOf(p[0], p[1])));
  ok(slices.size === 8, 'forty kids start spread over all eight slices');
}

// ---------- a match on the clock ----------
function game(n, opts) {
  const now = 1e6;
  const m = T.newGame(Object.assign({ arena: 0, rounds: n || 7, now }, opts || {}));
  return { m, now };
}
function runTo(m, from, to, rand, step) {
  const ev = [];
  for (let t = from; t <= to; t += step || 100) { T.advance(m, t, rand).forEach((e) => ev.push(Object.assign({ at: t }, e))); T.stepKids(m, 0.1); }
  return ev;
}
{
  const { m, now } = game(7);
  const rand = rng(11);
  for (let k = 1; k <= 10; k++) T.addKid(m, k, k % 2 ? 'red' : 'gold', now);
  ok(Object.values(m.kids).every((d) => d.st === 'up'), 'kids who join before round 1 stand on the floor');
  ok(m.phase === 'intro' && T.advance(m, now + R.INTRO_MS - 1, rand).length === 0, '«¡YA!» lasts its 2.6 s');
  const ev = runTo(m, now, now + T.timeCapMs(7) + 500, rand);
  const rounds = ev.filter((e) => e.type === 'round');
  ok(rounds.length === 7 && rounds.map((e) => e.r).join() === '1,2,3,4,5,6,7', 'seven rounds in order');
  ok(ev.filter((e) => e.type === 'lock').length === 7 && ev.filter((e) => e.type === 'open').length === 7 && ev.filter((e) => e.type === 'tally').length === 7, 'each round: «0», the doors, the tally');
  ok(ev[ev.length - 1].type === 'end' && m.phase === 'final', 'the match ends after the 7th tally');
  const order = ev.slice(0, 6).map((e) => e.type).join();
  ok(order === 'round,lock,open,close,tally,round', `a round's order: ${order}`);
  // the timing of round 1 (from the end of the intro)
  const r1 = rounds[0].at, l1 = ev.find((e) => e.type === 'lock').at, o1 = ev.find((e) => e.type === 'open').at, t1 = ev.find((e) => e.type === 'tally').at;
  ok(near(r1, now + R.INTRO_MS, 100), 'round 1 starts when «¡YA!» ends');
  ok(near(l1 - r1, R.TITLE_MS + R.ROULETTE_MS + R.COUNT_MS, 100), `«0» comes 8.5 s into the round (${l1 - r1} ms)`);
  ok(near(o1 - l1, R.LOCK_MS, 100) && near(t1 - o1, R.OPEN_MS + R.CLOSE_MS, 100), 'the doors 1.1 s after «0», the tally after they close');
  ok(near(rounds[1].at - r1, T.ROUND_MS(false), 100), `a round lasts ${T.ROUND_MS(false)} ms (the video's ~13 s)`);
  ok(near(ev[ev.length - 1].at - now, T.timeCapMs(7), 150), `the whole match lasts its time cap (${Math.round(T.timeCapMs(7) / 1000)} s)`);
  // the drops by round
  const locks = ev.filter((e) => e.type === 'lock');
  ok(locks.slice(0, 3).every((e) => e.set.length === 2) && locks.slice(3, 6).every((e) => e.set.length === 3) && locks[6].set.length === 4, 'quarters, then threes, the Final Round half the floor');
  const tallies = ev.filter((e) => e.type === 'tally');
  ok(tallies.slice(0, 6).every((e) => e.mult === 1 && !e.final) && tallies[6].mult === 2 && tallies[6].final, 'the Final Round counts double');
  ok(m.score.red + m.score.gold === tallies.reduce((s, e) => s + e.add.red + e.add.gold, 0), 'the score is the sum of the tallies');
}
// the roulette: inside its window, never the same place twice in a row, faster toward the end, a valid option
{
  const rand = rng(3);
  for (let n = 0; n < 200; n++) {
    const { m, now } = game(7);
    const r = 1 + (n % 7);
    T.startRound(m, r, now, rand, []);
    const b = T.bounds(m);
    const j = m.jumps;
    ok(j.length >= 8, `round ${r}: the pink jumps ${j.length} times`);
    ok(j[0][0] === b.roulette && j[j.length - 1][0] < b.lock, 'the roulette runs from its start until «0»');
    ok(j.every((x, i) => i === 0 || x[1] !== j[i - 1][1]), 'never the same place twice in a row');
    ok(j.every((x) => x[1] >= 0 && x[1] < A.optionsOf(m.kind)), 'every jump is an option of the round');
    const gaps = j.slice(1).map((x, i) => x[0] - j[i][0]);
    const firstHalf = gaps.slice(0, Math.floor(gaps.length / 2)), secondHalf = gaps.slice(Math.floor(gaps.length / 2));
    const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
    ok(avg(secondHalf) < avg(firstHalf), 'the roulette speeds up toward «0»');
  }
}
// the drawn set at «0» is uniform (never from where kids stand)
{
  const rand = rng(99);
  const cnt = {};
  for (let n = 0; n < 8000; n++) {
    const { m, now } = game(7);
    T.startRound(m, 1, now, rand, []);
    const ev = [];
    T.lock(m, rand, ev);
    cnt[m.drop.s] = (cnt[m.drop.s] || 0) + 1;
  }
  ok(Object.keys(cnt).length === 8 && Object.values(cnt).every((c) => c > 850 && c < 1150), `the quarter at «0» is uniform: ${JSON.stringify(cnt)}`);
}

// ---------- falls, wings, the pit ----------
function at(m, k, slice, r) { const d = m.kids[k]; const [x, y] = A.pointAt(A.sliceMid(slice), r || 60); d.x = x; d.y = y; d.tx = x; d.ty = y; }
{
  const { m, now } = game(7);
  const rand = rng(5);
  for (let k = 1; k <= 6; k++) T.addKid(m, k, k <= 3 ? 'red' : 'gold', now);
  T.startRound(m, 1, now, rand, []);
  m.drop = { s: 2, set: [2, 3] };
  at(m, 1, 2); at(m, 2, 3); at(m, 3, 5); at(m, 4, 2); at(m, 5, 6); at(m, 6, 3);
  m.kids[4].wings = true;
  m.kids[6].away = true;
  const ev = [];
  T.openDoors(m, ev);
  const op = ev[0];
  ok(op.falls.sort().join() === '1,2,6' && op.saves.join() === '4', `on a falling slice: fall (1, 2, and the away kid 6), wings save 4 (${op.falls} / ${op.saves})`);
  ok(m.kids[1].st === 'down' && m.kids[4].st === 'up' && m.kids[4].hover && !m.kids[4].wings && m.kids[4].saved === 1, 'the wings are used up: kid 4 hovers, saved once');
  ok(m.kids[3].st === 'up' && m.kids[5].st === 'up', 'kids off the drop stay');
  T.closeDoors(m, ev);
  const tv = [];
  T.tally(m, tv);
  const t = tv[0];
  ok(t.stand.red === 1 && t.stand.gold === 2 && t.present.red === 3 && t.present.gold === 2, `who stands: Fuego 1 of 3, Mar 2 of 2 (the away kid not counted) (${JSON.stringify(t.stand)})`);
  ok(t.add.red === 3 && t.add.gold === 10, `the tally is the share standing out of 10: Fuego +3, Mar +10 (${JSON.stringify(t.add)})`);
  ok(m.kids[6].st === 'down' && m.kids[6].pts === 0, 'an away kid scores nothing');
  ok(!m.kids[4].hover && m.kids[4].pts === 1, 'the saved kid lands and scores');
  // wings again: only one save per pair
  const ev2 = [];
  m.phase = 'lock'; m.drop = { s: 2, set: [2, 3] };
  at(m, 4, 2);
  T.openDoors(m, ev2);
  ok(m.kids[4].st === 'down', 'used wings save nobody twice');
}
// the lag grace: a kid already dashing off the dropping slice (their phone shows them past the seam) is judged a step on
{
  const { m, now } = game(7);
  const rand = rng(6);
  for (let k = 1; k <= 4; k++) T.addKid(m, k, 'red', now);
  T.startRound(m, 1, now, rand, []);
  m.drop = { s: 2, set: [2, 3] };
  const seam = 4 * A.SLICE;                                  // between slice 3 (dropping) and slice 4 (safe)
  const put = (k, ang, tang) => { const d = m.kids[k]; [d.x, d.y] = A.pointAt(ang, 60); [d.tx, d.ty] = A.pointAt(tang, 60); };
  put(1, seam - 0.12, seam + 0.6);                           // ~7 units from the seam, running off it
  put(2, seam - 0.12, seam - 0.12);                          // the same spot, standing still
  put(3, seam - 0.6, seam + 0.6);                            // ~35 units from the seam, running: too far
  put(4, seam - 0.12, seam - 1.2);                           // running deeper into the hole
  const ev = [];
  T.openDoors(m, ev);
  const f = ev[0].falls.slice().sort().join();
  ok(f === '2,3,4', `dashing a few units from the seam: safe; still, too far or the wrong way: falls (${f})`);
  ok(A.sliceOf(m.kids[1].x, m.kids[1].y) === 4 && m.kids[1].st === 'up', 'the graced kid stands on the safe slice');
  ok(Math.hypot(m.kids[1].x - A.pointAt(seam - 0.12, 60)[0], m.kids[1].y - A.pointAt(seam - 0.12, 60)[1]) <= R.GRACE_MAX + 1e-6, `the grace is never more than ${R.GRACE_MAX} units`);
}
// questions: who gets what, when
{
  const { m, now } = game(7);
  const rand = rng(8);
  T.addKid(m, 1, 'red', now); T.addKid(m, 2, 'gold', now);
  ok(T.wantQ(m, 1, now) === null, 'no question during «¡YA!»');
  T.startRound(m, 1, now, rand, []);
  ok(T.wantQ(m, 1, now) === 'wings', 'on the floor before «0»: the wings question');
  const b = T.bounds(m);
  m.phase = 'count';
  ok(T.wantQ(m, 1, now + b.lock - R.Q_MIN_LEFT_MS + 50) === null, 'no new wings question with less than 3 s before «0»');
  ok(T.wantQ(m, 1, now + b.lock - R.Q_MIN_LEFT_MS - 50) === 'wings', '…but with 3 s or more');
  // a guess is too fast
  ok(T.tooFast(now, now + 300) && !T.tooFast(now, now + 600), 'an answer under 450 ms is a guess');
  // wrong: wait 2 s, 3.4 s after two in a row; right: wings
  m.phase = 'roulette';
  let a = T.answer(m, 1, 'wings', false, now + 1000, rand);
  ok(!a.wings && a.wait === R.WRONG_WAIT_MS && m.kids[1].nextQAt === now + 1000 + R.WRONG_WAIT_MS, '«¡Casi!»: the next question waits 2 s');
  a = T.answer(m, 1, 'wings', false, now + 3500, rand);
  ok(a.wait === R.WRONG_WAIT2_MS, '…3.4 s after two misses in a row');
  a = T.answer(m, 1, 'wings', true, now + 7000, rand);
  ok(a.wings && m.kids[1].wings && m.kids[1].wrongRow === 0 && m.kids[1].right === 1 && m.kids[1].answered === 3, 'a right answer: wings');
  ok(T.wantQ(m, 1, now + 7100) === null, 'with wings: no more questions this round');
  // an answer after «0» gives nothing (the server closes the question at «0»)
  m.kids[2].wings = false; m.phase = 'lock';
  a = T.answer(m, 2, 'wings', true, now + 9000, rand);
  ok(!a.wings && !m.kids[2].wings, 'a wings answer after «0» gives no wings');
  // the pit: a right answer with time before «0» = up at once; else the next round
  m.phase = 'count'; m.t0 = now;
  m.kids[2].st = 'down';
  ok(T.wantQ(m, 2, now + 4000) === 'back', 'in the pit: the comeback question');
  a = T.answer(m, 2, 'back', true, now + b.lock - R.RETURN_MIN_MS - 100, rand);
  ok(a.back === 'now' && m.kids[2].st === 'up' && a.rose && m.kids[2].backs === 1, 'a right answer with time left: up at once');
  const r2 = Math.hypot(a.rose[0], a.rose[1]);
  ok(r2 >= A.R_MIN && r2 <= A.R_MAX, 'they rise onto the walkable ring');
  m.kids[2].st = 'down';
  a = T.answer(m, 2, 'back', true, now + b.lock - R.RETURN_MIN_MS + 100, rand);
  ok(a.back === 'next' && m.kids[2].st === 'wait', 'too close to «0»: up at the next round');
  ok(T.wantQ(m, 2, now + b.lock) === 'pre', 'waiting to rise: a question that gives wings for the rise');
  a = T.answer(m, 2, 'pre', true, now + b.lock + 2000, rand);
  ok(a.wings && m.kids[2].wingsNext && T.wantQ(m, 2, now + b.lock + 2100) === null, 'a right one: they will rise with wings');
  const ev = [];
  T.startRound(m, 2, now + 20000, rand, ev);
  ok(ev[0].enter.includes(2) && m.kids[2].st === 'up' && m.kids[2].wings && !m.kids[2].wingsNext, 'the next round: they rise, with wings');
  ok(!m.kids[1].wings, 'everybody else\'s wings reset each round');
  // a late joiner waits for the next round
  T.addKid(m, 3, 'red', now + 21000);
  ok(m.kids[3].st === 'wait', 'a late joiner rises at the next round');
  // away: no questions
  m.kids[1].away = true;
  ok(T.wantQ(m, 1, now + 20100) === null, 'a phone that dropped gets no question');
}
// a right answer's verdict stays readable; a wings answer in the last instant before «0» is too late; no «pre» in the final
{
  const { m, now } = game(7);
  const rand = rng(9);
  T.addKid(m, 1, 'red', now); T.addKid(m, 2, 'gold', now);
  T.startRound(m, 1, now, rand, []);
  m.phase = 'count';
  const b = T.bounds(m);
  m.kids[1].st = 'down';
  const a = T.answer(m, 1, 'back', true, now + 2000, rand);
  ok(a.back === 'now' && m.kids[1].nextQAt === now + 2000 + R.RIGHT_PAUSE_MS, 'a right answer: the next question waits 1 s (the verdict stays up)');
  ok(T.wantQ(m, 1, now + 2100) === 'wings', '…the kid still wants the wings question (dealt after the pause by the room)');
  const late = T.answer(m, 2, 'wings', true, now + b.lock + 5, rand);   // the phase still says «count» (the tick has not run)
  ok(!late.wings && !m.kids[2].wings, 'a wings answer after the «0» instant gives no wings, even before the next tick');
  m.final = true;
  m.kids[2].st = 'wait'; m.kids[2].wingsNext = false;
  ok(T.wantQ(m, 2, now + 3000) === null, 'the Final Round: no «rise with wings» question (there is no next round)');
}
// movement on the server: a tap is an intent, runners never teleport
{
  const { m, now } = game(7);
  T.addKid(m, 1, 'red', now);
  ok(T.go(m, 1, 'x', 4) === null && T.go(m, 99, 0, 0) === null, 'nonsense or an unknown kid: refused');
  const t = T.go(m, 1, 900, 900);
  ok(t && near(Math.hypot(t[0], t[1]), A.R_MAX, 1e-6), 'a tap past the rim is clamped onto the floor');
  let worst = 0, x = m.kids[1].x, y = m.kids[1].y;
  for (let i = 0; i < 40; i++) { T.stepKids(m, 0.1); worst = Math.max(worst, Math.hypot(m.kids[1].x - x, m.kids[1].y - y)); x = m.kids[1].x; y = m.kids[1].y; }
  ok(worst <= R.SPEED * 0.1 + 1e-6, 'one tick moves a runner at most its speed × 0.1 s');
  m.kids[1].st = 'down';
  ok(T.go(m, 1, 0, 60) === null, 'a kid in the pit cannot run');
  m.kids[1].st = 'up'; m.paused = true;
  const before = [m.kids[1].x, m.kids[1].y];
  T.go(m, 1, 0, 60);
  T.stepKids(m, 0.1);
  ok(m.kids[1].x === before[0] && m.kids[1].y === before[1], 'paused: nobody moves');
}

// ---------- the teacher ----------
{
  const { m, now } = game(5);
  const rand = rng(21);
  T.addKid(m, 1, 'red', now);
  ok(T.pause(m, now + 1000) && !T.pause(m, now + 1100), '«⏸ Pausa» once');
  ok(T.advance(m, now + 60000, rand).length === 0, 'paused: the clock stands still');
  const shift = T.resume(m, now + 61000);
  ok(shift === 60000 && m.introAt === now + 60000, '«Seguir»: the clock moves on by the paused time');
  ok(T.advance(m, now + 61000 + R.INTRO_MS - 1000 - 50, rand).length === 0, 'the intro still has its last second');
  const ev = T.advance(m, now + 61000 + R.INTRO_MS, rand);
  ok(ev[0] && ev[0].type === 'round', '…then round 1');
  ok(T.addRounds(m) && m.rounds === 7, '«+30 s» = 2 rondas más');
  m.rounds = 14;
  ok(T.addRounds(m) && m.rounds === R.ROUNDS_MAX, 'never past 15 rounds');
  m.final = true;
  ok(!T.addRounds(m), 'not during the Final Round');
  // skip
  const g2 = game(5);
  T.addKid(g2.m, 1, 'red', g2.now);
  const sk = T.skip(g2.m, g2.now + 300, rand);
  ok(sk[0] && sk[0].type === 'round' && g2.m.r === 1 && g2.m.t0 === g2.now + 300, '«⏭ Saltar» skips «¡YA!»');
  ok(T.skip(g2.m, g2.now + 400, rand).length === 0, '…but never a round that is playing');
  g2.m.phase = 'tally'; g2.m.t0 = g2.now;
  const sk2 = T.skip(g2.m, g2.now + 12500, rand);
  ok(sk2[0] && sk2[0].type === 'round' && g2.m.r === 2, '…and a tally');
  // endsAt: the time cap from the start
  const g3 = game(7);
  ok(near(T.endsAt(g3.m, g3.now), g3.now + T.timeCapMs(7), 1), 'the clock at the start reads the whole match');
  ok(T.clampRounds('x') === R.ROUNDS && T.clampRounds(2) === 3 && T.clampRounds(99) === 15 && T.clampRounds(10) === 10, 'rounds 3-15');
}

// ---------- the ending ----------
{
  const rows = [
    { k: 1, name: 'Sofi', skin: 'aileen', team: 'red', pts: 8, stood: 7, best: 7, saved: 2, backs: 0, right: 7, answered: 8 },
    { k: 2, name: 'Mateo', skin: 'adric', team: 'red', pts: 3, stood: 3, best: 2, saved: 0, backs: 2, right: 5, answered: 9 },
    { k: 3, name: 'Valen', skin: 'latifa', team: 'gold', pts: 8, stood: 7, best: 5, saved: 1, backs: 1, right: 6, answered: 6 },
    { k: 4, name: 'Lucas', skin: 'fer', team: 'gold', pts: 0, stood: 0, best: 0, saved: 0, backs: 0, right: 0, answered: 1 },
  ];
  const fin = T.finish(rows, { red: 11, gold: 8 });
  ok(fin.winner === 'red', 'the kingdom with more points wins');
  ok(fin.rows[0].rank === 1 && fin.rows[1].rank === 1 && fin.rows[0].k === 1, 'a tie on points shares the rank (the longer run first)');
  ok(fin.stars.length <= Party.MAX_STARS && fin.stars.find((s) => s.id === 'stand').winners.join() === '1', 'Siempre en pie: the longest run');
  ok(fin.stars.find((s) => s.id === 'saved').winners.join() === '1', 'Alas salvadoras');
  ok(fin.stars.find((s) => s.id === 'back').winners.join() === '2', 'Vuelta épica');
  ok(fin.mvp.red === 1 && fin.mvp.gold === 3, 'each kingdom\'s top kid');
  ok(T.finish(rows, { red: 5, gold: 5 }).winner === 'tie', 'equal points: a tie');
  // a calm game: 8 kids stood every round → «Siempre en pie» is no honour, skipped
  const calm = Array.from({ length: 10 }, (_, i) => ({ k: i + 1, name: 'K' + i, skin: 'fer', team: i % 2 ? 'gold' : 'red', pts: 7, stood: 7, best: i < 8 ? 7 : 3, saved: 0, backs: 0, right: 3 + i, answered: 12 }));
  ok(!T.finish(calm, { red: 30, gold: 30 }).stars.some((s) => s.id === 'stand'), '«Siempre en pie» shared by 8 kids: no star');
  // the phone's card never reads 0
  rows.forEach((r) => {
    const me = Object.assign({ k: r.k, team: r.team, won: r.team === 'red', tie: false }, r);
    const lines = UI.card('trapdoor', me, fin);
    ok(lines.title && lines.big && !/NaN|undefined/.test(JSON.stringify(lines)), `${r.name}: a card with a headline`);
    ok(!lines.facts.some(([v]) => v === '0' || /^0\//.test(v)), `${r.name}: no fact reads 0`);
  });
  ok(UI.card('trapdoor', { k: 4, team: 'gold', pts: 0, stood: 0, right: 0, answered: 1 }, fin).zero, 'a kid with nothing: «¡La próxima es tuya!»');
  ok(UI.GAMES.trapdoor && UI.starValue('trapdoor', { id: 'stand', value: 5, n: 1 }) === '5 rondas seguidas en pie', 'the star lines');
}

// ---------- simulated classes ----------
// Each kid: runs to a random spot now and then; answers each question after 2-6 s, right with its kingdom's accuracy;
// at «0» it notices the burning slices after 0.5-1.5 s (+ the Wi-Fi; one kid in five never does) and runs to the nearest
// safe slice. The server's own rules decide everything else.
function simulate(o) {
  const rand = rng(o.seed);
  const now0 = 5e6;
  const m = T.newGame({ arena: 0, rounds: o.rounds || 7, now: now0 });
  const kids = [];
  for (let i = 0; i < o.n; i++) {
    const team = i % 2 ? 'gold' : 'red';
    T.addKid(m, i + 1, team, now0);
    kids.push({ k: i + 1, team, acc: o.acc[team], q: null, ansAt: 0, wanderAt: now0 + rand() * 2000, react: 0 });
  }
  let falls = 0, saves = 0, backs = 0, qs = 0;
  for (let t = now0; m.phase !== 'final' && t < now0 + T.timeCapMs(m.rounds) + 5000; t += 100) {
    const ev = T.advance(m, t, rand);
    ev.forEach((e) => {
      if (e.type === 'lock') kids.forEach((s) => { s.react = rand() < 0.2 ? 0 : t + 500 + rand() * 1000 + 80; });
      if (e.type === 'open') { falls += e.falls.length; saves += e.saves.length; kids.forEach((s) => { if (s.q && s.q.kind === 'wings') s.q = null; }); }
      if (e.type === 'lock') kids.forEach((s) => { if (s.q && s.q.kind === 'wings') s.q = null; });   // the server closes it at «0»
    });
    kids.forEach((s) => {
      const d = m.kids[s.k];
      // questions: deal / answer
      if (!s.q) {
        const kind = T.wantQ(m, s.k, t);
        if (kind && t >= (d.nextQAt || 0)) { s.q = { kind, at: t, ans: t + 2000 + rand() * 4000 }; qs++; }
      } else if (t >= s.q.ans) {
        const a = T.answer(m, s.k, s.q.kind, rand() < s.acc, t, rand);
        if (a.back) backs++;
        s.q = null;
      }
      // running
      if (d.st !== 'up') return;
      if (m.phase === 'lock' && s.react && t >= s.react && m.drop) {
        s.react = 0;
        const set = m.drop.set;
        if (set.includes(A.sliceOf(d.x, d.y))) {
          // the nearest safe slice (by angle), same radius
          const cur = A.angleOf(d.x, d.y), r = Math.hypot(d.x, d.y);
          let best = null, bd = 9;
          for (let i = 0; i < 8; i++) {
            if (set.includes(i)) continue;
            const mid = A.sliceMid(i);
            let da = Math.abs(mid - cur); da = Math.min(da, 2 * Math.PI - da);
            if (da < bd) { bd = da; best = mid; }
          }
          // aim just past the nearest seam of that slice
          const tgt = A.pointAt(best, Math.max(A.R_MIN + 2, r * 0.8));
          T.go(m, s.k, tgt[0], tgt[1]);
        }
      } else if (t >= s.wanderAt && m.phase !== 'lock' && m.phase !== 'open') {
        s.wanderAt = t + 1500 + rand() * 3000;
        const p = A.pointAt(rand() * Math.PI * 2, A.R_MIN + rand() * (A.R_MAX - A.R_MIN));
        T.go(m, s.k, p[0], p[1]);
      }
    });
    T.stepKids(m, 0.1);
  }
  return { winner: m.score.red > m.score.gold ? 'red' : m.score.gold > m.score.red ? 'gold' : 'tie', score: m.score, falls, saves, backs, qs, rounds: m.rounds, m };
}
{
  let strongWins = 0, evenRed = 0, evenGold = 0, ties = 0, tot = { falls: 0, saves: 0, backs: 0, qs: 0, rounds: 0 }, strongLoses = 0;
  const N = 120;
  for (let i = 0; i < N; i++) {
    const s = simulate({ seed: 1000 + i, n: 20 + (i % 11), acc: { red: 0.85, gold: 0.55 } });
    if (s.winner === 'red') strongWins++; else if (s.winner === 'gold') strongLoses++;
    ['falls', 'saves', 'backs', 'qs'].forEach((k) => { tot[k] += s[k]; });
    tot.rounds += s.rounds;
    ok(s.m.phase === 'final', `class ${i}: the match ended`);
  }
  for (let i = 0; i < N; i++) {
    const s = simulate({ seed: 5000 + i, n: 20 + (i % 11), acc: { red: 0.7, gold: 0.7 } });
    if (s.winner === 'red') evenRed++; else if (s.winner === 'gold') evenGold++; else ties++;
  }
  let closeWins = 0;
  for (let i = 0; i < N; i++) {
    const s = simulate({ seed: 9000 + i, n: 20 + (i % 11), acc: { red: 0.75, gold: 0.62 } });
    if (s.winner === 'red') closeWins++;
  }
  const pct = (x) => Math.round((100 * x) / N);
  console.log(`  sim: a small gap (75 % vs 62 %): the better kingdom wins ${pct(closeWins)} %`);
  ok(closeWins / N > 0.55 && closeWins / N < 0.97, `a small gap: the better side wins more often, but not always (${pct(closeWins)} %)`);
  console.log(`  sim: a kingdom answering 85 % vs 55 % wins ${pct(strongWins)} % (loses ${pct(strongLoses)} %); equal kingdoms ${pct(evenRed)}/${pct(evenGold)} (ties ${pct(ties)} %)`);
  console.log(`  sim: per round ${(tot.falls / tot.rounds).toFixed(1)} falls, ${(tot.saves / tot.rounds).toFixed(1)} saved by wings, ${(tot.backs / tot.rounds).toFixed(1)} comebacks; ${(tot.qs / (N * 25)).toFixed(1)} questions per kid`);
  ok(strongWins / N >= 0.75, `the stronger kingdom usually wins (${pct(strongWins)} %)`);
  // (a 30-point accuracy gap is huge: the weaker side still steals one now and then; the small gap above is the real test)
  ok(strongLoses >= 1 || strongWins / N < 0.99, 'chance still matters (even a much weaker side wins now and then)');
  ok(Math.abs(evenRed - evenGold) / N <= 0.2, `an even class is a coin toss (${pct(evenRed)} / ${pct(evenGold)})`);
  ok(tot.falls / tot.rounds >= 1, 'kids fall every round (the drama is real)');
  ok(tot.saves > 0 && tot.backs > 0, 'wings save kids and the fallen come back');
}

console.log(`test-trapdoor: ${checks} checks pass`);
