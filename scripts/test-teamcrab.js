// Unit test of «¡Atrapa a Fénec!» rules (core/teamcrab.js), no server.
//   node scripts/test-teamcrab.js          → the checks
//   node scripts/test-teamcrab.js --sim    → + a class simulation (crews of 3-4 for 2 minutes): how often a careful crew
//                                            catches Fénec, a lone slam's hit rate, a boxed-in slam's, silent < careful
'use strict';
const assert = require('assert');
const T = require('../core/teamcrab');
const R = T.R;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const Q = (n) => Array.from({ length: n || 12 }, (_, i) => ({ text: 'Pregunta ' + i, correct: 'w' + i, answers: ['w' + i, 'x' + i, 'y' + i, 'z' + i] }));
const QS = Q(12);
const opts = { questions: QS, imageFor: () => null, online: () => true };
const rightIdx = (q) => q.answers.indexOf('w' + q.text.split(' ')[1]);
const mk = (n, dur, seed) => {
  const m = T.newGame(seed || 7, dur || 120, 0, ['baba', 'mama', 'gege']);
  T.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo', '']));
  return m;
};
const run = (m, from, to, step) => { let ev = []; for (let t = from; t <= to; t += (step || 80)) ev = ev.concat(T.tick(m, t, opts)); return ev; };

// ---------- the deal ----------
{
  const m = mk(4);
  ok(m.boards.length === 1 && m.boards[0].seats.length === 4, '4 kids = one board');
  ok(m.boards[0].target === T.targetFor(4, 2), 'target per board from its kids and the minutes');
  const m2 = mk(9);
  ok(m2.boards.length === 3 && m2.boards.every((b) => b.seats.length === 3), '9 kids = 3 boards of 3');
  const m3 = mk(8);
  ok(m3.boards.length === 2 && m3.boards.every((b) => b.seats.length === 4), '8 kids = 2 boards of 4');
  const late = T.seatLate(m3, 99, 'Late', 'dralingo', '', 0);
  ok(late && late.seats.includes(99), 'a late joiner sits at a board');
  ok(T.seatLate(m3, 99, 'Late', 'dralingo', '', 0) === null, 'a seated kid keeps the seat');
}

// ---------- the quiz loads the hammer; a miss costs ----------
{
  const m = mk(3);
  T.startPlay(m, 1000);
  let ev = T.tick(m, 1000, opts);
  const q1 = ev.filter((e) => e.t === 'q');
  ok(q1.length === 3, 'every kid gets a question at once');
  ok(q1.every((e) => !('correct' in T.qPublic(e.q)) && !('correctIdx' in T.qPublic(e.q))), 'a question never carries its answer');
  const r1 = m.kids[1];
  const q = r1.q;
  let res = T.answer(m, 1, q.qid, rightIdx(q), 1200);
  ok(res.ok && !res.right, 'an answer in 0.2 s is a blind guess = wrong');
  const b = m.boards[0];
  ok(r1.h.st === 'jam', 'a miss jams my hammer');
  ok(res.ev.some((e) => e.t === 'snatch' && !('k' in e)), 'Fénec snatches a word, never naming who');
  ok(res.ev.some((e) => e.t === 'feed' && e.anger === 1), 'the spark feeds El Péndulo');
  ok(b.anger === 1, 'anger +1');
  run(m, 1280, 4400);
  ok(r1.h.st === 'idle', 'the jam ends after JAM_MS');
  const r2 = m.kids[2];
  res = T.answer(m, 2, r2.q.qid, rightIdx(r2.q), 1700);
  ok(res.right && r2.h.st === 'loaded', 'a right answer loads my hammer');
  ok(res.ev.some((e) => e.t === 'ham' && e.k === 2 && e.st === 'loaded' && e.guided), 'my first load is guided');
  ok(r2.h.until - 1700 === R.FIRST_LOAD_MS, 'my first load lasts FIRST_LOAD_MS');
  ok(!r2.q, 'no question while my hammer is loaded');
  // late: a question the phone showed runs out
  const r3 = m.kids[3];
  T.seen(m, 3, r3.q.qid);
  const evL = run(m, 1760, 1000 + R.Q_TIME_MS + 600);
  ok(evL.some((e) => e.t === 'qr' && e.k === 3 && e.late), 'a shown question that runs out is late');
  ok(r3.late === 1 && (r3.h.st === 'jam' || r3.h.st === 'idle'), 'late costs like a miss');
}
// a question never shown (pocketed phone) runs out for free
{
  const m = mk(2);
  T.startPlay(m, 0);
  T.tick(m, 0, opts);
  const ev = run(m, 80, R.Q_TIME_MS + 800);
  ok(!ev.some((e) => e.t === 'snatch'), 'an unseen question that runs out costs nothing');
}

// ---------- slams, Fénec, bonks ----------
{
  const m = mk(3, 120, 11);
  T.startPlay(m, 0);
  const b = m.boards[0];
  b.fx.nextWander = 1e12;                     // (he stands still for this check)
  b.fx.at = b.fx.from = 0;                    // at the left edge
  const r = m.kids[1], o = m.kids[2];
  r.h.st = 'loaded'; r.h.until = 99999; r.h.x = 0; r.h.spot = 0;
  o.h.st = 'loaded'; o.h.until = 99999; o.h.x = 0.25; o.h.spot = 1;      // the only escape spot is covered… by a shadow
  let res = T.slam(m, 1, 0, 100);
  ok(res.ok && r.h.st === 'fall', 'a slam starts the fall');
  // boxed in: his only free neighbour holds a loaded shadow → he may still flee there (it's not falling)
  o.h.st = 'fall'; o.h.slamAt = 100; o.h.impactAt = 100 + R.FALL_MS + 300; o.h.react = 1000;   // (now it falls too)
  const ev = run(m, 180, 100 + R.FALL_MS + 160);
  const bonk = ev.find((e) => e.t === 'bonk');
  ok(bonk && bonk.k === 1, 'boxed in at the edge with the neighbour falling = a bonk');
  ok(bonk.pts === R.WORDS_BONK && bonk.flying.length >= 1 && bonk.flying.every((w) => /^[a-z ]+$/.test(w)), 'the bonk returns words (pinyin)');
  ok(bonk.assists.includes(2) && m.kids[2].assists === 1, 'the crewmate covering the escape spot gets an assist');
  ok(b.words === R.WORDS_BONK + R.ASSIST && r.words === R.WORDS_BONK, 'board words = bonk + assists');
  ok(b.phase === 'bonk', 'the board plays its bonk moment');
  ok(T.slam(m, 3, 0.5, 700).ok === false, 'no slam during the bonk');
  const evUp = run(m, 800, 100 + R.FALL_MS + 160 + R.BONK_MS + 200);
  ok(evUp.some((e) => e.t === 'up') && b.phase === 'play', 'after the bonk Fénec gets up and runs off');
}
// a lone slam on him with free neighbours: he reacts and dodges sometimes
{
  let hits = 0, n = 400;
  for (let i = 0; i < n; i++) {
    const m = mk(3, 120, 100 + i);
    T.startPlay(m, 0);
    const b = m.boards[0];
    b.fx.nextWander = 1e12;
    const r = m.kids[1];
    r.h.st = 'loaded'; r.h.until = 99999;
    T.slam(m, 1, T.xOfSpot(b.fx.at), 50);
    const ev = run(m, 50, 50 + R.FALL_MS + 160, 40);
    if (ev.some((e) => e.t === 'bonk')) hits++;
  }
  const rate = hits / n;
  console.log('  lone surprise slam on his spot, free neighbours: hit', Math.round(rate * 100) + '%');
  ok(rate > 0.25 && rate < 0.7, 'a lone surprise slam lands sometimes, not always (' + rate + ')');
}
// a shadow lingering on him spooks him away
{
  const m = mk(2, 120, 5);
  T.startPlay(m, 0);
  const b = m.boards[0];
  b.fx.nextWander = 1e12;
  const r = m.kids[1];
  r.h.st = 'loaded'; r.h.until = 99999; r.h.spot = b.fx.at; r.h.x = T.xOfSpot(b.fx.at);
  const ev = run(m, 0, R.SPOOK_MAX + 200);
  ok(ev.some((e) => e.t === 'hop' && e.why === 'spook'), 'a shadow on his spot spooks him away');
}
// an unslammed hammer slams by itself (never stuck)
{
  const m = mk(2);
  T.startPlay(m, 0);
  const r = m.kids[1];
  r.h.st = 'loaded'; r.h.until = 500;
  const ev = run(m, 0, 700);
  ok(ev.some((e) => e.t === 'slam' && e.k === 1 && e.auto), 'a loaded hammer slams by itself at its time');
  const b = m.boards[0];
  b.fx.nextWander = 1e12; b.fx.at = b.fx.from = 0; b.fx.hopAt = 0;
  const o = m.kids[2];
  o.h.st = 'fall'; o.h.spot = 1; o.h.slamAt = 700; o.h.impactAt = 99999; o.h.react = 1e9;
  r.h.st = 'loaded'; r.h.until = 800; r.h.spot = 0; r.h.x = 0;
  const evA = run(m, 760, 800 + R.FALL_MS + 200);
  const bk = evA.find((e) => e.t === 'bonk' && e.k === 1);
  ok(bk && bk.pts === 1, 'a hammer that slammed by itself bonks for +1 only (an aimed slam +2)');
}

// ---------- El Péndulo ----------
{
  const m = mk(4, 120, 3);
  T.startPlay(m, 0);
  T.tick(m, 0, opts);
  const b = m.boards[0];
  let t = 1000;
  for (let i = 0; i < R.ANGER_MAX; i++) {
    const r = m.kids[1 + (i % 4)];
    if (!r.q) { r.h.st = 'idle'; r.qNextAt = 0; T.tick(m, t, opts); }
    const wrong = (rightIdx(r.q) + 1) % 4;
    const res = T.answer(m, r.k, r.q.qid, wrong, t);
    if (i === R.ANGER_MAX - 1) ok(res.ev.some((e) => e.t === 'swing'), 'the 5th miss = the big swing');
    t += 600;
  }
  ok(b.phase === 'swing' && Object.values(m.kids).filter((r) => r.h.st === 'knock' || r.h.st === 'jam').length === 4, 'every hammer of the board knocked away');
  ok(b.anger === R.ANGER_REST, 'after the swing he rests');
  ok(T.slam(m, 2, 0.5, t).ok === false, 'no slam while knocked');
  run(m, t, t + R.KNOCK_MS + 400);
  ok(b.phase === 'play' && Object.values(m.kids).every((r) => r.h.st !== 'knock'), 'the hammers come back');
  // calm: right answers in a row shrink him
  b.anger = 3;
  b.lastOk = true;
  const r = Object.values(m.kids).find((x) => x.q);
  const before = b.anger;
  T.answer(m, r.k, r.q.qid, rightIdx(r.q), t + 5000);
  ok(b.anger < before, 'a right answer in a row calms him');
}

// ---------- the review's rules (2026-10-23) ----------
{
  // a question waiting under a knocked hammer never runs out (the phone hides it while knocked)
  const m = mk(4, 120, 21);
  T.startPlay(m, 0);
  T.tick(m, 0, opts);
  const b = m.boards[0];
  const r = m.kids[2];
  T.seen(m, 2, r.q.qid);
  r.q.until = 14000;                                  // (it would run out at 14.3 s)
  m.lastTick = 13800;
  b.anger = R.ANGER_MAX - 1;
  b.fx.nextWander = 1e12;
  const w = m.kids[1];
  const ev = T.answer(m, 1, w.q.qid, (rightIdx(w.q) + 1) % 4, 13800).ev;
  ok(ev.some((e) => e.t === 'swing'), 'a swing');
  ok(r.h.st === 'knock', 'a kid with an open question is knocked');
  const evK = run(m, 13880, 13800 + R.KNOCK_MS - 100);
  ok(!evK.some((e) => e.t === 'qr' && e.k === 2), 'a knocked kid\'s question never runs out while knocked');
  // the jammed kid (whose miss fed him) shows knocked like the others: never who failed
  const view = T.boardView(m, b, null, 13900);
  ok(view.hammers.find((h) => h.k === 1).st === 'knock' && view.hammers.every((h) => h.st === 'knock'), 'during the knock every hammer looks knocked (the one who failed too)');
  ok(view.hammers.find((h) => h.k === 1).ms === 0, 'a jam\'s time never shows');
  const evB = run(m, 13800 + R.KNOCK_MS - 80, 13800 + R.KNOCK_MS + 300);
  ok(evB.some((e) => e.t === 'ham' && e.k === 1 && e.st === 'idle' && e.notMe), 'the crew sees the jammed hammer back up (not its own phone)');
}
{
  // caught is latched once the sack is empty; misses after it never undo it
  const m = mk(3, 120, 31);
  T.startPlay(m, 0);
  const b = m.boards[0];
  b.words = b.target - 1; b.full = false;
  b.fx.nextWander = 1e12; b.fx.at = b.fx.from = 0;
  const r = m.kids[1], o = m.kids[2];
  r.h.st = 'loaded'; r.h.until = 99999; r.h.spot = 0; r.h.x = 0;
  o.h.st = 'fall'; o.h.spot = 1; o.h.slamAt = 50; o.h.impactAt = 50 + R.FALL_MS + 400; o.h.react = 1000;
  T.slam(m, 1, 0, 50);
  const ev = run(m, 50, 50 + R.FALL_MS + 100);
  ok(ev.some((e) => e.t === 'full') && b.full, 'the sack empties: full');
  b.words = 0;                                        // (misses take every word back)
  run(m, 3000, 6000, 400);
  T.final(m, m.endsAt);
  ok(T.finish(m).boards[0].caught, 'caught stays caught');
}
{
  // crews ranked by their share of the target (a crew of 5 never wins by size); «+30 s» rescales the targets
  const m = mk(9, 120, 41);
  T.startPlay(m, 0);
  m.boards[0].words = 10; m.boards[0].target = 20;
  m.boards[1].words = 9; m.boards[1].target = 10;
  m.boards[2].words = 0;
  T.final(m, m.endsAt);
  const f = T.finish(m);
  ok(f.crews[0].id === m.boards[1].id, 'crews ranked by their share of the target');
  const m2 = mk(4, 120, 42);
  T.startPlay(m2, 0);
  const t0 = m2.boards[0].target;
  T.addTime(m2, 30000, 1000);
  ok(m2.boards[0].target > t0, '«+30 s» raises the target (' + t0 + ' → ' + m2.boards[0].target + ')');
}

// ---------- pause, clock, final ----------
{
  const m = mk(4);
  T.startPlay(m, 0);
  m.paused = true; m.pausedAt = 1000;
  T.shiftTimes(m, 5000);
  m.paused = false;
  ok(m.endsAt === 125000, 'a pause moves the end');
  ok(T.addTime(m, -30000, 6000) === -30000 && m.endsAt === 95000, '«−30 s»');
  ok(T.addTime(m, -300000, 6000) < 0 && m.endsAt > 6000, '«−30 s» never ends the game by itself');
  const ev = run(m, 6000, m.endsAt + 100, 400);
  ok(ev.some((e) => e.t === 'frenzy'), 'the last 30 s');
  const fin = ev.find((e) => e.t === 'final');
  ok(fin && fin.boards.length === 1 && 'caught' in fin.boards[0], '«¡FINAL!» says caught or escaped per board');
  const f = T.finish(m);
  ok(f.boards.length === 1 && f.crews.length === 1 && f.order.length === 4, 'the end: boards, crews, the class');
}

// ---------- the class simulation ----------
function simulate(o) {
  const res = { games: 0, caught: 0, words: [], silent: [], careful: [], bonks: 0, slams: 0, swings: 0, boards: 0, jams: 0 };
  for (let gi = 0; gi < o.games; gi++) {
    const n = o.kids;
    const m = T.newGame(1000 + gi, o.dur, 0, ['baba']);
    T.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo', '']));
    const style = {};
    Object.keys(m.kids).forEach((k, i) => { style[k] = o.silent && i % 6 === 3 ? 'silent' : 'careful'; });
    const plan = {};    // k → { answerAt, idx, slamAt, aimLagSpot, block }
    T.startPlay(m, 0);
    const end = m.endsAt + 200;
    for (let t = 0; t <= end && m.phase === 'play'; t += 80) {
      const ev = T.tick(m, t, opts);
      ev.forEach((e) => {
        if (e.t === 'q' && style[e.k] !== 'silent') {
          T.seen(m, e.k, e.q.qid);
          const right = Math.random() < o.acc;
          plan[e.k] = { answerAt: t + 1600 + Math.random() * 2200, qid: e.q.qid, idx: right ? e.q.correctIdx : (e.q.correctIdx + 1) % 4 };
        } else if (e.t === 'q') T.seen(m, e.k, e.q.qid);
        if (e.t === 'bonk') res.bonks++;
        if (e.t === 'swing') res.swings++;
      });
      // answers
      Object.keys(plan).forEach((k) => {
        const p = plan[k];
        if (p.answerAt && t >= p.answerAt) {
          const r = T.answer(m, +k, p.qid, p.idx, t);
          p.answerAt = 0;
          if (r.right) {
            p.slamAt = t + 500 + Math.random() * 1100;     // drag + tap
            p.block = null;
          } else res.jams++;
        }
      });
      // loaded hammers: aim (with a lag) at Fénec, or block his free side when a crewmate already aims at him
      m.boards.forEach((b) => {
        const seen = T.fxSpotAt(b.fx, t - 250);
        b.seats.forEach((k) => {
          const r = m.kids[k];
          const p = plan[k];
          if (!p || r.h.st !== 'loaded') return;
          const onHim = b.seats.some((j) => j !== k && m.kids[j].h.st === 'loaded' && m.kids[j].h.spot === seen);
          if (o.coord && onHim && Math.random() < o.coord && p.block == null) p.block = seen + (seen === 0 ? 1 : seen === 4 ? -1 : Math.random() < 0.5 ? -1 : 1);
          const want = p.block != null ? p.block : seen;
          T.aim(m, +k, T.xOfSpot(want), t);
          // a blocker slams when he hops onto its spot, or near its time
          const fire = p.block != null ? (T.fxSpotAt(b.fx, t - 200) === p.block || t >= r.h.until - 700) : t >= p.slamAt;
          if (fire && b.phase === 'play') { const s = T.slam(m, +k, null, t); if (s.ok) { res.slams++; p.block = null; } }
        });
      });
    }
    T.final(m, end);
    const f = T.finish(m);
    f.boards.forEach((b) => { res.boards++; if (b.caught) res.caught++; res.words.push(b.words / b.target); });
    f.rows.forEach((r) => { (style[r.k] === 'silent' ? res.silent : res.careful).push(r.words); });
    res.games++;
  }
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : 0);
  return { boards: res.boards, caughtPct: Math.round((100 * res.caught) / res.boards), wordsShare: avg(res.words), bonksPerBoard: Math.round((10 * res.bonks) / res.boards) / 10, slamsPerBoard: Math.round(res.slams / res.boards), hitRate: Math.round((100 * res.bonks) / Math.max(1, res.slams)), swingsPerBoard: Math.round((10 * res.swings) / res.boards) / 10, careful: avg(res.careful), silent: avg(res.silent) };
}

console.log('test-teamcrab.js:', checks, 'checks passed');
if (process.argv.includes('--sim')) {
  const games = +(process.argv[process.argv.indexOf('--sim') + 1]) || 40;
  [
    ['careful crew of 4, 85 %, some teamwork', { kids: 4, dur: 120, acc: 0.85, coord: 0.4 }],
    ['careful crew of 3, 85 %, some teamwork', { kids: 3, dur: 120, acc: 0.85, coord: 0.4 }],
    ['crew of 4, 85 %, no teamwork', { kids: 4, dur: 120, acc: 0.85, coord: 0 }],
    ['crew of 4, 65 %, no teamwork', { kids: 4, dur: 120, acc: 0.65, coord: 0 }],
    ['class of 30 (silent every 6th), 80 %', { kids: 30, dur: 120, acc: 0.8, coord: 0.3, silent: true }],
    ['crew of 4, 3 minutes, 85 %', { kids: 4, dur: 180, acc: 0.85, coord: 0.4 }],
  ].forEach(([name, o]) => console.log('  sim ·', name, JSON.stringify(simulate(Object.assign({ games }, o)))));
}
