// Unit test of «Draly Cangrejo · ¡Atrapa a Fénec!» v2 rules (core/teamcrab.js), no server.
//   node scripts/test-teamcrab.js          → the checks
//   node scripts/test-teamcrab.js --sim    → + the skill simulation (his rule «Skill decides, never luck»): crews of 4
//                                            for 2 minutes, skilful (a Capitán who drives under Fénec, claws that lead
//                                            the target and take turns) vs random tappers vs never-answer vs robots
'use strict';
const assert = require('assert');
const T = require('../core/teamcrab');
const R = T.R;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const Q = (n) => Array.from({ length: n || 12 }, (_, i) => ({ text: 'Pregunta ' + i, correct: 'w' + i, answers: ['w' + i, 'x' + i, 'y' + i, 'z' + i] }));
const QS = Q(12);
const opts = { questions: QS, imageFor: () => null, online: () => true };
const mk = (n, dur, seed, robots) => {
  const m = T.newGame(seed || 7, dur || 120, 0, ['baba', 'mama', 'gege']);
  T.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo', '', !!(robots && i >= n - robots)]));
  return m;
};
const run = (m, from, to, step) => { let ev = []; for (let t = from; t <= to; t += (step || 80)) ev = ev.concat(T.tick(m, t, opts)); return ev; };
const right = (m, k, t) => { const r = m.kids[k]; return T.answer(m, k, r.q.qid, r.q.correctIdx, t); };
const wrong = (m, k, t) => { const r = m.kids[k]; return T.answer(m, k, r.q.qid, (r.q.correctIdx + 1) % 4, t); };
// run until the round reaches a phase
const until = (m, from, phase, max) => { let t = from; const ev = []; while (t < (max || from + 60000) && !(m.round && m.round.phase === phase)) { t += 80; ev.push(...T.tick(m, t, opts)); } return { t, ev }; };

// ---------- the deal ----------
{
  const m = mk(4);
  ok(m.boards.length === 1 && m.boards[0].seats.length === 4, '4 kids = one crew');
  ok(m.boards[0].target === T.targetFor(4, 2), 'target per crew from its kids and the minutes');
  const m2 = mk(9);
  ok(m2.boards.length === 3 && m2.boards.every((b) => b.seats.length === 3), '9 kids = 3 crews of 3');
  const m3 = mk(8);
  const late = T.seatLate(m3, 99, 'Late', 'dralingo', '', 0);
  ok(late && late.seats.includes(99), 'a late joiner sits in a crew');
  ok(T.seatLate(m3, 99, 'Late', 'dralingo', '', 0) === null, 'a seated kid keeps the seat');
  const m4 = mk(4, 120, 7, 3);
  ok(Object.values(m4.kids).filter((r) => r.robot).length === 3 && m4.boards.length === 1, '1 kid + 3 robots = one crew');
}

// ---------- the question window: right = +1 charge, a miss = El Péndulo eats one ----------
{
  const m = mk(3);
  let ev = T.startPlay(m, 1000);
  ok(ev.some((e) => e.t === 'round' && e.phase === 'qw' && e.n === 1), 'the game opens on a question window');
  ev = T.tick(m, 1300, opts);
  const q1 = ev.filter((e) => e.t === 'q');
  ok(q1.length === 3, 'every kid gets a question');
  ok(q1.every((e) => !('correctIdx' in T.qPublic(e.q)) && !('correct' in T.qPublic(e.q))), 'a question never carries its answer to the phone');
  const r1 = m.kids[1];
  let res = right(m, 1, 1400);
  ok(res.ok && !res.right, 'an answer in 0.1 s is a blind guess = wrong');
  ok(res.ev.some((e) => e.t === 'eat' && !('k' in e)) && res.ev.some((e) => e.t === 'mine' && e.k === 1 && !e.ate), 'a miss with no charge: El Péndulo still grows, never naming who on the crew');
  ok(m.boards[0].anger === 1, 'anger +1');
  run(m, 1480, 1000 + 300 + R.WRONG_WAIT_MS + 400);
  ok(r1.q, 'the next question after the wrong wait');
  for (let i = 0; i < 5; i++) { const t = 4000 + i * 1000; if (!r1.q) run(m, t - 900, t); right(m, 1, t); }
  ok(r1.charges === R.CHARGES_MAX, 'right answers fill the hammer up to 4 charges, never more');
  ok(m.boards[0].anger < 1, 'right answers in a row calm El Péndulo');
  run(m, 9000, 9400);
  res = wrong(m, 1, 9500);
  ok(res.ev.some((e) => e.t === 'eat' && e.ate) && r1.charges === R.CHARGES_MAX - 1, 'a wrong answer: El Péndulo EATS one of my charges');
  ok(res.ev.some((e) => e.t === 'qr' && e.k === 1 && !e.ok && e.correctText), 'the phone learns the right answer only after answering');
}
// late: a SHOWN question that runs out inside the window is eaten; an unseen one is free; the window's end is free
{
  const m = T.newGame(5, 240, 0, []);
  T.deal(m, [[1, 'A', 'dralingo', ''], [2, 'B', 'dralingo', '']]);
  T.startPlay(m, 0);
  T.tick(m, 300, opts);
  m.kids[1].charges = 2; m.kids[2].charges = 2;
  T.seen(m, 1, m.kids[1].q.qid);
  const ev = run(m, 380, 300 + R.Q_TIME_MS + 500);
  ok(m.round.phase === 'qw' && m.round.until > 300 + R.Q_TIME_MS + 500, '(a window longer than a question)');
  ok(ev.some((e) => e.t === 'qr' && e.k === 1 && e.late) && m.kids[1].charges === 1, 'a shown question that runs out = El Péndulo eats a charge');
  ok(!ev.some((e) => e.t === 'qr' && e.k === 2) && m.kids[2].charges === 2, 'a question never shown (pocketed phone) runs out for free');
  const m2 = mk(2, 120, 6);
  T.startPlay(m2, 0);
  T.tick(m2, 300, opts);
  m2.kids[1].charges = 2;
  T.seen(m2, 1, m2.kids[1].q.qid);
  const e2 = T.skip(m2, 2000, opts);
  ok(e2.some((e) => e.t === 'qx' && e.k === 1), 'the window closes: open questions are withdrawn');
  ok(!e2.some((e) => e.t === 'qr') && m2.kids[1].charges === 2, 'a question cut by the window end costs nothing');
  ok(Object.values(m2.kids).every((r) => !r.q || r.q.until <= m2.round.at), 'no question outlives its window');
}

// ---------- roles: the Capitán = the window's best answerer; martilleros = kids with charges; the rest watch ----------
{
  const m = mk(4, 120, 3);
  T.startPlay(m, 0);
  T.tick(m, 300, opts);
  right(m, 1, 2300); right(m, 2, 1800); right(m, 3, 2600);   // 1 right each; kid 2 fastest
  run(m, 2400, 3200);
  right(m, 2, 3900);
  run(m, 4000, 4700);
  right(m, 1, 5200);
  const { ev } = until(m, 5300, 'pwin');
  const roles = ev.find((e) => e.t === 'roles');
  ok(roles && roles.captain === 2, 'tie on right answers → the faster one is Capitán');
  ok(roles.mart.map((x) => x.k).sort().join() === '1,2,3', 'kids with charges are martilleros; 0 charges = watch');
  ok(m.kids[4].claw.st === 'idle', 'a watcher has no claw');
  ok(roles.mart.every((x) => Math.abs(x.off) <= R.REACH), 'claws spread within the crab\'s reach');
  const m2 = mk(3, 120, 4);
  T.startPlay(m2, 0);
  const r2 = until(m2, 0, 'pwin').ev.find((e) => e.t === 'roles');
  ok(r2 && r2.captain === null, 'no right answers = no Capitán');
}

// ---------- the play window: steer, aim, slam; Fénec's readable pattern; the hit is judged at the impact ----------
function toPW(seed, charges) {
  const m = mk(3, 120, seed || 11);
  T.startPlay(m, 0);
  T.tick(m, 300, opts);
  right(m, 1, 2000);
  let t = until(m, 2000, 'pw').t;
  Object.values(m.kids).forEach((r) => { if (charges != null) { r.charges = charges; r.claw.st = charges ? 'armed' : 'idle'; r.claw.readyAt = 0; } });
  return { m, t, b: m.boards[0] };
}
{
  const { m, t, b } = toPW(11, 3);
  ok(b.captain === 1, '(kid 1 is Capitán)');
  ok(T.steer(m, 2, 0, t) === null, 'only the Capitán steers');
  const x0 = b.crab.x;
  T.steer(m, 1, 4, t);
  run(m, t + 80, t + 320);
  const moved = b.crab.x - x0;
  ok(moved > 0.5 && moved <= (R.CRAB_SPEED * 0.33) + 0.01, 'the crab WALKS toward the Capitán\'s finger at a visible speed (not a jump)');
  const r2 = m.kids[2];
  ok(Math.abs(r2.claw.x - (b.crab.x + r2.claw.off)) < 0.01, 'my claw rides on the crab');
  const a = T.aim(m, 2, 0, t + 400);
  ok(a && Math.abs(a.off) <= R.REACH + 1e-9, 'aiming is kept within the crab\'s reach');
  ok(T.slam(m, 3, null, t + 400).ok && m.kids[3].charges === 2, 'a slam spends one charge');
  ok(!T.slam(m, 3, null, t + 420).ok, 'one hammer at a time: it must come back up first');
}
// Fénec: idle → crouch 0.3 s leaning → runs exactly FEN_RUN_N spots at FEN_RUN_SPEED → idle again; never an instant dodge
{
  const m = mk(3, 120, 21);
  T.startPlay(m, 0);
  const b = m.boards[0];
  const seen = [];
  for (let t = 0; t < 20000; t += 40) T.tick(m, t, opts).forEach((e) => { if (e.t === 'fen') seen.push(Object.assign({ at: t }, e)); });
  const runs = seen.filter((e) => e.mode === 'run');
  ok(runs.length > 5, 'he keeps moving');
  ok(seen.every((e, i) => e.mode !== 'run' || (i > 0 && seen[i - 1].mode === 'crouch' && e.at - seen[i - 1].at >= R.FEN_CROUCH_MS - 1)), 'every run comes after a 0.3 s crouch');
  ok(runs.every((e) => Math.abs(Math.abs(e.x1 - e.x0) - Math.min(R.FEN_RUN_N, Math.abs(e.x1 - e.x0))) < 1e-9 && Math.abs(e.x1 - e.x0) <= R.FEN_RUN_N + 1e-9), 'a run is at most 2 spots');
  ok(runs.every((e) => Math.abs(e.dur - (Math.abs(e.x1 - e.x0) / R.FEN_RUN_SPEED) * 1000) < 2), 'he runs at a fixed visible speed');
  ok(seen.filter((e) => e.mode === 'crouch').every((e) => e.dir === (e.x1 >= e.x0 ? 1 : -1)), 'the crouch leans the way he will run (a kid can read it)');
  ok(b.fx.x >= 0 && b.fx.x <= T.MAXX, 'he stays on the dock');
}
// the slam is judged where he IS at the impact: an idle Fénec with time left is ALWAYS hit; a slam on his old spot as he runs misses
{
  let hits = 0, tries = 0, misses = 0, runTries = 0;
  for (let s = 1; s <= 60; s++) {
    const { m, t, b } = toPW(100 + s, 3);
    let tt = t;
    // wait until he stands still with enough time left, put the crab under him, slam on him
    for (let i = 0; i < 300 && !(b.fx.mode === 'idle' && b.fx.t1 - tt > R.FALL_MS + 200); i++) { tt += 40; T.tick(m, tt, opts); }
    if (!(b.fx.mode === 'idle')) continue;
    b.crab.x = b.crab.tx = Math.max(0, Math.min(T.MAXX, b.fx.x));
    m.kids[2].claw.off = 0; m.kids[2].claw.x = b.crab.x;
    const fx = b.fx.x;
    const sres = T.slam(m, 2, fx, tt);
    tries++;
    const ev = run(m, tt + 40, tt + R.FALL_MS + 80, 40);
    if (sres.ok && ev.some((e) => e.t === 'bonk' && e.k === 2)) hits++;
    // a slam at the spot he is leaving as he starts to run
    const { m: m2, t: t2, b: b2 } = toPW(300 + s, 3);
    let u = t2;
    for (let i = 0; i < 300 && b2.fx.mode !== 'run'; i++) { u += 20; T.tick(m2, u, opts); }
    if (b2.fx.mode !== 'run') continue;
    b2.crab.x = b2.crab.tx = b2.fx.x0; m2.kids[2].claw.off = 0; m2.kids[2].claw.x = b2.crab.x;
    T.slam(m2, 2, b2.fx.x0, u);
    runTries++;
    const ev2 = run(m2, u + 20, u + R.FALL_MS + 80, 20);
    if (ev2.some((e) => e.t === 'impact' && e.k === 2 && !e.hit)) misses++;
  }
  ok(tries > 40 && hits === tries, `a slam on a standing Fénec always bonks him (never a random dodge): ${hits}/${tries}`);
  ok(runTries > 40 && misses === runTries, `a slam on the spot he is running from always misses: ${misses}/${runTries}`);
}
// the bonk: words fly back; the slammer +2, the blocking claws +1, the Capitán +1; he lies flat; a slam on him flat misses
{
  const { m, t, b } = toPW(51, 3);
  let tt = t;
  for (let i = 0; i < 300 && !(b.fx.mode === 'idle' && b.fx.t1 - tt > R.FALL_MS + 200); i++) { tt += 40; T.tick(m, tt, opts); }
  b.crab.x = b.crab.tx = Math.max(0, Math.min(T.MAXX, b.fx.x));
  b.seats.forEach((k) => { const r = m.kids[k]; r.claw.off = k === 3 ? 0.5 : 0; r.claw.x = b.crab.x + r.claw.off; });
  b.captain = 1;
  const w0 = b.words;
  T.slam(m, 2, b.fx.x, tt);
  const ev = run(m, tt + 40, tt + R.FALL_MS + 80, 40);
  const bonk = ev.find((e) => e.t === 'bonk');
  ok(bonk && bonk.k === 2 && bonk.pts === R.WORDS_BONK, 'BONK: the slammer gets +2');
  ok(bonk.assists.includes(3), 'a claw right beside him that blocked his way gets +1 «trampa»');
  ok(!bonk.assists.includes(1) && bonk.cap === 1, 'the Capitán who drove there gets his own +1 (never a «trampa»)');
  ok(bonk.flying.length > 0 && b.words > w0, 'the crew\'s words fly back');
  ok(b.fx.mode === 'flat', 'he lies flat');
  m.kids[3].claw.readyAt = 0;
  T.slam(m, 3, b.fx.x, tt + R.FALL_MS + 100);
  const ev2 = run(m, tt + R.FALL_MS + 140, tt + 2 * R.FALL_MS + 200, 40);
  ok(ev2.some((e) => e.t === 'impact' && e.k === 3 && !e.hit), 'a slam on him lying flat does not count twice');
}
// only kids with charges slam; never-answer kids never slam
{
  const { m, t } = toPW(61, 0);
  ok(!T.slam(m, 2, 2, t).ok && T.slam(m, 2, 2, t).why === 'empty', 'no charges = no slam (answer right next round)');
}

// ---------- the rounds: 2 minutes = 4-5 rounds with a 10-s play window each; the last one ×2 ----------
{
  const m = mk(4, 120, 9);
  const all = T.startPlay(m, 0);
  for (let t = 80; m.phase === 'play' && t < 200000; t += 80) {
    all.push(...T.tick(m, t, opts));
    Object.values(m.kids).forEach((r) => { if (r.q && t - r.q.sentAt > 2500) right(m, r.k, t); if (r.claw.st === 'armed' && t > r.claw.readyAt + 1200) T.slam(m, r.k, 2, t); });
  }
  const qws = all.filter((e) => e.t === 'round' && e.phase === 'qw');
  const pws = all.filter((e) => e.t === 'round' && e.phase === 'pw');
  ok(qws.length >= 4 && qws.length <= 6, `2 minutes = ${qws.length} rounds`);
  ok(pws.length === qws.length && pws.every((e) => e.ms === R.PW_MS), 'each round has its 10-s play window');
  ok(qws[qws.length - 1].final && !qws[0].final, 'the last round is the final round (×2)');
  ok(all.some((e) => e.t === 'frenzy'), 'the final round is announced');
  ok(all.some((e) => e.t === 'final'), '«¡FINAL!» at the clock');
  const fin = all.find((e) => e.t === 'final');
  ok(fin && 'caught' in fin.boards[0], '«¡FINAL!» says caught or escaped per crew');
  ok(qws.every((e) => e.ms >= R.QW_MIN - 1 || e.final), 'every question window has time for several questions');
}
// the play window ends soon once every claw is spent
{
  const { m, t } = toPW(71, 1);
  m.kids[1].charges = 0; m.kids[1].claw.st = 'idle'; m.kids[3].charges = 0; m.kids[3].claw.st = 'idle';
  T.slam(m, 2, 2, t);
  const r = until(m, t, 'pwout', t + R.PW_MS);
  ok(r.t < t + R.FALL_MS + R.BACK_MS + R.PW_EMPTY_MS + 400, 'a play window with every hammer spent does not make the class wait');
}
// teacher: pause shifts every time, skip ends the window, ±30 s
{
  const m = mk(3, 120, 13);
  T.startPlay(m, 0);
  T.tick(m, 300, opts);
  const until0 = m.round.until, ends0 = m.endsAt, f1 = m.boards[0].fx.t1;
  T.shiftTimes(m, 5000);
  ok(m.round.until === until0 + 5000 && m.endsAt === ends0 + 5000 && m.boards[0].fx.t1 === f1 + 5000, 'a pause moves the window, the clock and Fénec');
  const ev = T.skip(m, 1000, opts);
  ok(m.round.phase === 'pwin' && ev.some((e) => e.t === 'roles'), '«Saltar» ends the question window');
  const d = T.addTime(m, 30000, 1100);
  ok(d === 30000 && m.endsAt === ends0 + 35000, '+30 s');
  ok(T.addTime(m, -30000, 1200) === -30000, '−30 s');
}

// ---------- robots: an average kid, never in stars, the podium or the class ranking ----------
{
  let rights = 0, answers = 0, slams = 0;
  let last = null;
  for (let s = 1; s <= 12; s++) {
    const m = mk(4, 120, 500 + s, 3);
    const ev = T.startPlay(m, 0);
    for (let t = 80; m.phase === 'play'; t += 80) ev.push(...T.tick(m, t, opts));
    ev.forEach((e) => { if (e.t === 'qr' && m.kids[e.k].robot) { answers++; if (e.ok) rights++; } if (e.t === 'slam' && m.kids[e.k].robot) slams++; });
    last = m;
  }
  const pct = rights / answers;
  ok(pct > 0.6 && pct < 0.8, `robots answer like an average kid: ${Math.round(pct * 100)} % right`);
  ok(slams > 12 * 3 * 2, 'robots slam in the play windows');
  Object.values(last.kids).filter((r) => r.robot).forEach((r) => { r.words += 50; r.bonks += 9; r.best = 9; r.assists = 9; r.capBonks = 9; });
  const f = T.finish(last);
  ok(f.boards[0].stars.every((s) => s.winners.every((k) => !last.kids[k].robot)), 'robots never win a star');
  ok(f.boards[0].winners.every((k) => !last.kids[k].robot) && f.order.every((k) => !last.kids[k].robot) && f.count === 1, 'robots never on the podium or in the class ranking');
  ok(f.rows.filter((r) => r.robot).every((r) => r.rank == null && r.classRank == null), 'robots have no place');
}
// the end: caught is latched; crews ranked by share
{
  const m = mk(8, 120, 17);
  T.startPlay(m, 0);
  const b = m.boards[0];
  b.words = b.target; b.full = true;
  const ev = T.final(m, 1000);
  ok(ev.find((e) => e.t === 'final').boards.find((x) => x.id === b.id).caught, 'a crew that got its target back has caught him');
  const f = T.finish(m);
  ok(f.crews[0].id === b.id && f.crews.length === 2, 'crews ranked by share of their target');
}
// ---------- the code review's cases (2026-10-23) ----------
// what the slammer SAW is what counts: on a 100-ms link his phone draws Fénec's run 100 ms late and the slam arrives 100 ms
// late; the server rewinds by the round trip, so a hammer drawn on him on that phone bonks him (and without the rewind it
// would have missed)
{
  for (const rewind of [true, false]) {
    const { m, t, b } = toPW(81, 3);
    let u = t;
    // (wait for a crouch before a 2-spot run, then the very tick the run starts)
    for (let i = 0; i < 600 && !(b.fx.mode === 'crouch' && Math.abs(b.fx.x1 - b.fx.x0) >= 2); i++) { u += 20; T.tick(m, u, opts); }
    for (let i = 0; i < 40 && b.fx.mode !== 'run'; i++) { u += 20; T.tick(m, u, opts); }
    const L = 100, f = Object.assign({}, b.fx);
    // the phone taps at u + L (it saw the run start L late) and its hammer lands at u + L + FALL on its screen, where the
    // phone shows him at server time u + FALL (one trip late)
    const seenX = f.x0 + (f.x1 - f.x0) * Math.min(1, (R.FALL_MS) / (f.t1 - f.t0));
    b.crab.x = b.crab.tx = Math.max(0, Math.min(T.MAXX, seenX)); m.kids[2].claw.off = 0; m.kids[2].claw.x = b.crab.x;
    for (let tt = u + 20; tt < u + 2 * L; tt += 20) T.tick(m, tt, opts);
    T.slam(m, 2, seenX, u + 2 * L, rewind ? 2 * L : 0);           // (it reaches the server one more trip later)
    const ev = run(m, u + 2 * L + 20, u + 2 * L + R.FALL_MS + 80, 20);
    const bonk = ev.some((e) => e.t === 'bonk' && e.k === 2);
    if (rewind) ok(bonk, 'a slow link: the hammer drawn on Fénec on the slammer\'s phone bonks him (the server judges what that phone showed)');
    else ok(!bonk, '(without the rewind the same slam would have missed: what the kid saw would not count)');
  }
}
// robots never open a crew of their own (a full crew gets none)
{
  const m5 = mk(5);
  ok(T.seatRobot(m5, 100, '🤖 Robi', 'hamdan') === null && m5.boards.length === 1, 'a robot never opens a crew of its own');
  const m4 = mk(4);
  ok(T.seatRobot(m4, 100, '🤖 Robi', 'hamdan') === null && m4.boards[0].seats.length === 4, 'a crew of 3+ kids (a real class, robots left on) gets no robot');
  const m2 = mk(2);
  ok(T.seatRobot(m2, 100, '🤖 Robi', 'hamdan') && T.seatRobot(m2, 101, '🤖 Roba', 'latifa') && T.seatRobot(m2, 102, '🤖 Robo', 'aileen') === null && m2.boards[0].seats.length === 4, 'two phones + robots = a crew of 4');
  const m1 = mk(1);
  ['Robi', 'Roba', 'Robo'].forEach((n, i) => T.seatRobot(m1, 100 + i, '🤖 ' + n, 'hamdan'));
  ok(m1.boards.length === 1 && m1.boards[0].seats.length === 4, 'one phone + 3 robots = one crew of 4');
}
// «Saltar» in «¡A martillar!»: the claws are ready at once; finite x only; the race names the server's leader
{
  const m = mk(3, 120, 91);
  T.startPlay(m, 0);
  T.tick(m, 300, opts);
  right(m, 1, 2000);
  let t = until(m, 2000, 'pwin').t;
  T.skip(m, t + 100, opts);
  ok(m.round.phase === 'pw' && T.slam(m, 1, 2, t + 120).ok, '«Saltar» in «¡A martillar!»: the first slam is taken at once');
  const b = m.boards[0];
  const cx = b.crab.x;
  ok(T.steer(m, 1, NaN, t + 300) === null && T.steer(m, 1, 'x', t + 400) === null && b.crab.tx === cx, 'a steer that is not a number is ignored');
  ok(T.aim(m, 1, undefined, t + 500) === null, 'an aim that is not a number is ignored');
  const m2 = mk(3, 120, 92);
  T.startPlay(m2, 0);
  T.tick(m2, 300, opts);
  const r2 = right(m2, 2, 2200);
  ok(r2.ev.find((e) => e.t === 'race').lead === 2, 'the race names the crew\'s leader as the server will choose him');
  const r1 = right(m2, 1, 2600);
  ok(r1.ev.find((e) => e.t === 'race').lead === 2, 'a tie on right answers: the faster one leads (the same rule as the roles)');
}
// ±30 s re-plans the open window: «−30 s» with ~50 s left still gives a final round ×2 and the game ends on the clock;
// a pause shifts the answer times (the Capitán tie-break never counts the pause)
{
  const m = mk(4, 120, 93);
  const all = T.startPlay(m, 0);
  let cut = false;
  for (let t = 80; m.phase === 'play' && t < 200000; t += 80) {
    all.push(...T.tick(m, t, opts));
    Object.values(m.kids).forEach((r) => { if (r.q && t - r.q.sentAt > 2500) right(m, r.k, t); if (r.claw.st === 'armed' && t > r.claw.readyAt + 1200) T.slam(m, r.k, 2, t); });
    if (!cut && t >= 68000 && m.round.phase === 'qw') { cut = true; const ev = []; T.addTime(m, -30000, t, ev); all.push(...ev); }
  }
  const fin = all.find((e) => e.t === 'final');
  ok(cut && all.some((e) => e.t === 'frenzy' && !e.off), '«−30 s» with ~50 s left: there is still a final round ×2');
  ok(fin && m.phaseAt <= m.endsAt + 1500 && m.phaseAt >= m.endsAt - 7000, 'the game ends on the clock (not 16 s after 0:00, not with time left) ' + JSON.stringify({ end: m.phaseAt, clock: m.endsAt }));
  // «−30 s» pressed at any moment (any window), with a crew that answers or a silent one: the final ×2 round always
  // happens and the game ends close to the clock
  let noFinal = 0, worstOver = 0, tries = 0;
  for (const answers of [true, false]) {
    for (let cutLeft = 62000; cutLeft >= 31000; cutLeft -= 1500) {
      const g = mk(4, 120, 300 + cutLeft / 1500);
      const evs = T.startPlay(g, 0);
      let done = false;
      for (let t = 80; g.phase === 'play' && t < 200000; t += 80) {
        evs.push(...T.tick(g, t, opts));
        if (answers) Object.values(g.kids).forEach((r) => { if (r.q && t - r.q.sentAt > 2500) right(g, r.k, t); });
        if (!done && g.endsAt - t <= cutLeft) { done = true; const ev = []; T.addTime(g, -30000, t, ev); evs.push(...ev); }
      }
      tries++;
      if (!evs.some((e) => e.t === 'frenzy' && !e.off)) noFinal++;
      worstOver = Math.max(worstOver, g.phaseAt - g.endsAt);
    }
  }
  ok(noFinal === 0, `«−30 s» in any window still gives the final ×2 round (${tries} presses, ${noFinal} without)`);
  ok(worstOver <= 5000, `and the game ends at most a few s after the clock (worst ${Math.round(worstOver)} ms)`);
  const mp = mk(2, 120, 94);
  T.startPlay(mp, 0);
  T.tick(mp, 300, opts);
  mp.paused = true; mp.pausedAt = 400;
  T.shiftTimes(mp, 20000); mp.paused = false;
  right(mp, 1, 22000);
  ok(mp.kids[1].timeQW < 3000, 'a pause never counts in my answer time');
}
// cheers
{
  const m = mk(3);
  T.startPlay(m, 0);
  ok(T.react(m, 1, 'wow', 100) && !T.react(m, 1, 'wow', 300) && !T.react(m, 1, 'boo', 2000), 'cheers: one at a time, only the four emoji');
}

// ---------- the skill simulation ----------
// what a kid SEES and can read: where Fénec will be at time t (he stands, crouches 0.3 s leaning, runs 2 spots)
function predict(f, t) {
  if (f.mode === 'flat' || f.mode === 'up') return null;
  if (f.mode === 'idle') return t <= f.t1 + R.FEN_CROUCH_MS ? f.x : null;
  if (f.mode === 'crouch') {
    const dur = (Math.abs(f.x1 - f.x0) / R.FEN_RUN_SPEED) * 1000;
    if (t <= f.t1) return f.x0;
    return f.x0 + (f.x1 - f.x0) * Math.min(1, (t - f.t1) / Math.max(1, dur));
  }
  return T.fxAt(f, t);
}
// the plan a phone shows at time t when its events arrive L ms late (the last step the server had at t − L)
function planAt(b, t) { for (let i = b.fhist.length - 1; i >= 0; i--) if (b.fhist[i].t0 <= t) return b.fhist[i]; return b.fhist[0] || b.fx; }
function simulate(o) {
  const out = { crews: 0, caught: 0, share: [], bonks: 0, slams: 0, rounds: 0, words: { skill: [], random: [], silent: [], robot: [] }, silentSlams: 0 };
  for (let gi = 0; gi < o.games; gi++) {
    const n = o.kids;
    const m = T.newGame(2000 + gi, o.dur || 120, 0, ['baba']);
    const rng = (() => { let s = 77 + gi; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
    T.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo', '', o.style === 'robot']));
    const style = {};
    Object.keys(m.kids).forEach((k, i) => { style[k] = o.silentEvery && i % o.silentEvery === o.silentEvery - 1 ? 'silent' : o.style; });
    const plan = {};
    const ev0 = T.startPlay(m, 0);
    out.rounds += 0;
    const step = 40;
    for (let t = 0; m.phase === 'play' && t < 400000; t += step) {
      const ev = t ? T.tick(m, t, opts) : ev0;
      ev.forEach((e) => {
        if (e.t === 'round' && e.phase === 'qw' && e.b == null) out.rounds += 1 / 1;
        if (e.t === 'q' && !m.kids[e.k].robot) {
          T.seen(m, e.k, e.q.qid);
          if (style[e.k] !== 'silent') plan[e.k] = Object.assign(plan[e.k] || {}, { ansAt: t + 1800 + rng() * 2000, qid: e.q.qid, ok: rng() < (o.acc || 0.85) });
        }
        if (e.t === 'bonk') out.bonks++;
        if (e.t === 'slam') { out.slams++; if (style[e.k] === 'silent') out.silentSlams++; }
      });
      Object.keys(plan).forEach((k) => {
        const p = plan[k], r = m.kids[k];
        if (p.ansAt && t >= p.ansAt) { if (r.q && r.q.qid === p.qid) T.answer(m, +k, p.qid, p.ok ? r.q.correctIdx : (r.q.correctIdx + 1) % 4, t); p.ansAt = 0; }
      });
      if (!m.round || m.round.phase !== 'pw') { Object.values(plan).forEach((p) => { p.slamAt = 0; p.steerAt = 0; }); continue; }
      const L = o.lag || 0;                                     // (one-way latency: the phone sees his plan L late, its slam arrives L late)
      m.boards.forEach((b) => {
        const f = L ? planAt(b, t - L) : b.fx;
        const busy = () => b.seats.some((k) => m.kids[k].claw.st === 'fall' || (plan[k] && plan[k].slamAt) || f.mode === 'flat' || f.mode === 'up');
        b.seats.forEach((k) => {
          const r = m.kids[k], p = plan[k] || (plan[k] = {});
          const st = style[k];
          if (st === 'robot' || st === 'silent') return;
          // the Capitán
          if (b.captain === r.k && t >= (p.steerAt || 0)) {
            if (st === 'skill') { const goal = f.mode === 'crouch' || f.mode === 'run' ? f.x1 : f.x; T.steer(m, r.k, goal, t); p.steerAt = t + 250; }
            else { T.steer(m, r.k, rng() * T.MAXX, t); p.steerAt = t + 900 + rng() * 600; }
          }
          if (r.claw.st !== 'armed' || r.charges <= 0 || t < r.claw.readyAt) return;
          if (p.slamAt && t >= p.slamAt) { if (T.slam(m, r.k, p.slamX, t, o.noRewind ? 0 : 2 * L).ok) out.slams++; p.slamAt = 0; return; }
          if (p.slamAt) return;
          if (st === 'skill') {
            if (busy()) return;                                 // take turns: one hammer in the air at a time
            const react = 260 + rng() * 260;
            const px = predict(f, t + react + R.FALL_MS - L);
            if (px == null || f.mode === 'crouch') return;     // (a careful kid waits out the crouch: he is about to run)
            if (Math.abs(px - b.crab.x) > R.REACH + 0.25) return;
            p.slamAt = t + react + L; p.slamX = px + (rng() - 0.5) * 1.1;   // (a kid's finger is not perfect; the slam reaches the server L later)
          } else if (st === 'random') {
            p.slamAt = t + 300 + rng() * 1200; p.slamX = rng() * T.MAXX;
          }
        });
      });
    }
    T.final(m, m.endsAt + 1);
    const fin = T.finish(m);
    fin.boards.forEach((b) => { out.crews++; if (b.caught) out.caught++; out.share.push(b.words / b.target); });
    fin.rows.forEach((r) => { (out.words[style[r.k]] || []).push(r.words); });
  }
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
  return {
    crews: out.crews, caughtPct: Math.round((100 * out.caught) / out.crews), share: avg(out.share), roundsPerGame: Math.round((out.rounds / o.games) * 10) / 10,
    bonksPerCrew: Math.round((10 * out.bonks) / out.crews) / 10, slamsPerCrew: Math.round(out.slams / out.crews), hitPct: Math.round((100 * out.bonks) / Math.max(1, out.slams)),
    wordsPerKid: Object.fromEntries(Object.entries(out.words).filter(([, v]) => v.length).map(([k, v]) => [k, avg(v)])), silentSlams: out.silentSlams,
  };
}
const SIMS = [
  ['skilful crew of 4 (Capitán drives under him, claws lead him and take turns)', { kids: 4, style: 'skill' }],
  ['skilful crew of 3', { kids: 3, style: 'skill' }],
  ['random tappers, crew of 4 (same answers, tap anywhere, steer anywhere)', { kids: 4, style: 'random' }],
  ['robots crew of 4 (70 % right, fair aim: the «Probar con robots» crewmates)', { kids: 4, style: 'robot' }],
  ['skilful crew of 4 that answers 50 % right', { kids: 4, style: 'skill', acc: 0.5 }],
  ['never-answer crew of 4', { kids: 4, style: 'silent' }],
  ['class of 30, every 6th never answers', { kids: 30, style: 'skill', silentEvery: 6, acc: 0.8 }],
  ['skilful crew of 4 on a slow school Wi-Fi (100 ms each way; the server judges where he was on the screen of the slammer)', { kids: 4, style: 'skill', lag: 100 }],
  ['random tappers of 4 on the same Wi-Fi', { kids: 4, style: 'random', lag: 100 }],
  ['(for comparison) skilful crew at 100 ms WITHOUT the rewind', { kids: 4, style: 'skill', lag: 100, noRewind: true }],
];
if (process.argv.includes('--sim')) {
  const games = +(process.argv[process.argv.indexOf('--sim') + 1]) || 40;
  const res = SIMS.map(([name, o]) => [name, simulate(Object.assign({ games }, o))]);
  res.forEach(([name, r]) => console.log('  sim ·', name, JSON.stringify(r)));
  const by = Object.fromEntries(res.map(([n, r], i) => [i, r]));
  ok(by[0].caughtPct >= 75, 'a skilful crew of 4 catches Fénec most games');
  ok(by[0].hitPct >= by[2].hitPct * 2, 'skilful slams hit at least twice as often as random taps');
  ok(by[0].caughtPct >= by[2].caughtPct + 40, 'a skilful crew clearly beats random tappers');
  ok(by[5].slamsPerCrew === 0 && by[5].caughtPct === 0, 'a never-answer crew never slams and never catches him');
  ok(by[6].silentSlams === 0 && by[6].wordsPerKid.silent === 0, 'in a class, a never-answer kid never slams and gets no words');
  ok(by[4].wordsPerKid.skill < by[0].wordsPerKid.skill * 0.75 && by[4].slamsPerCrew < by[0].slamsPerCrew, 'answering right matters: 50 % right = fewer hammers, fewer words');
  ok(by[3].caughtPct >= 35 && by[3].caughtPct <= 85, 'an average crew (the robots) catches him some games, not all');
  ok(by[7].hitPct >= by[8].hitPct * 2 && by[7].caughtPct >= by[8].caughtPct + 40, 'on a slow Wi-Fi a skilful crew still clearly beats random tappers');
}
console.log('test-teamcrab.js:', checks, 'checks passed');
module.exports = { simulate, SIMS };
