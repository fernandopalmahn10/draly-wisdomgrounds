// Rules check for «¡No despiertes a Dralingo!» (core/dormilon.js). Run: node scripts/test-dormilon.js [--sim]
// Turns, strokes, the hidden wake limit, the waker → 0, nights, guesses, the last 30 s ×2, «¡FINAL!», the ceremony
// payload, the clock, late seats, dropped phones. Then a class simulation (kids answering at a human pace, greedy /
// careful / mixed) that checks the timing gives 2-5 strokes a turn and a few wake-ups a game (--sim prints the numbers).
'use strict';
const D = require('../core/dormilon');
const { R } = D;

let checks = 0;
function ok(cond, what, extra) {
  checks++;
  if (!cond) { console.error('FAIL:', what, extra !== undefined ? JSON.stringify(extra) : ''); process.exit(1); }
}
const QS = Array.from({ length: 30 }, (_, i) => ({ text: `¿Qué significa «w${i}»?`, correct: `ok${i}`, answers: [`ok${i}`, `a${i}`, `b${i}`, `c${i}`] }));
const opts = (online) => ({ questions: QS, imageFor: () => null, online: online || (() => true) });
const evOf = (ev, t) => ev.filter((e) => e.t === t);
function game(n, seed) {
  const now = 1000000;
  const m = D.newGame(seed || 7, 240, now);
  D.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'Kid' + (i + 1), 'dralingo']));
  return { m, now };
}
// run the tick until an event of type t shows up (or ms pass)
function until(m, t0, t, ms, o) {
  let now = t0;
  for (let i = 0; i < (ms || 30000) / 100; i++) {
    now += 100;
    const ev = D.tick(m, now, o || opts());
    const hit = ev.find((e) => e.t === t);
    if (hit) return { now, ev, hit };
  }
  return { now, ev: [], hit: null };
}

// ---------- boards ----------
{
  [[1, [1]], [4, [4]], [5, [5]], [6, [3, 3]], [8, [4, 4]], [9, [3, 3, 3]], [10, [4, 3, 3]], [30, null]].forEach(([n, want]) => {
    const { m } = game(n);
    const sizes = m.boards.map((b) => b.seats.length).sort((a, b) => b - a);
    if (want) ok(JSON.stringify(sizes) === JSON.stringify(want), `deal ${n} kids → ${want}`, sizes);
    ok(sizes.reduce((a, b) => a + b, 0) === n && sizes.every((s) => s >= 1 && s <= 5), `deal ${n}: every kid seated once`, sizes);
    m.boards.forEach((b) => {
      const k = Math.max(2, b.seats.length);
      ok(b.limit >= R.LIMIT_LO * k && b.limit <= R.LIMIT_HI * k, `the wake limit is fair for a board of ${b.seats.length}`, b.limit);
    });
  });
  const { m } = game(8);
  const b = D.seatLate(m, 99, 'Late', 'fer');
  ok(b && b.seats.includes(99) && b.seats[b.seats.length - 1] === 99, 'a late joiner sits last in a board');
  ok(D.seatLate(m, 99, 'Late', 'fer') === null, 'a seated kid keeps the seat');
  const { m: m5 } = game(5);
  const b6 = D.seatLate(m5, 50, 'Six', 'fer');
  ok(b6 && b6 !== m5.boards[0] && b6.seats.length === 1, 'a board of 5 is full: the 6th kid opens a new board');
  // a board that fills with latecomers gets a limit for its real size (code review 2026-10-22)
  const { m: m1 } = game(1, 41);
  for (let i = 0; i < 4; i++) D.seatLate(m1, 70 + i, 'L' + i, 'fer');
  const b1 = m1.boards[0];
  ok(b1.seats.length === 5 && b1.limit >= R.LIMIT_LO * 5 - 1 && b1.limit <= R.LIMIT_HI * 5 + 1, 'late seats grow the hidden limit with the board (5 kids: 4-7 × 5)', b1.limit);
  // a kid back after the room forgot their phone takes their own row back by the student code
  const { m: mc } = game(0, 43);
  D.deal(mc, [[1, 'Ana', 'aileen', 'AB12CD'], [2, 'Beto', 'hamdan', 'XY34ZW']]);
  mc.kids[1].score = 6;
  ok(D.byCode(mc, 'AB12CD', (k) => k !== 1).k === 1 && D.byCode(mc, 'AB12CD', (k) => k !== 1).score === 6, 'a returning kid finds their own row (points kept)');
  ok(D.byCode(mc, 'AB12CD', () => true) === null, 'never a row that is playing on another phone right now');
  ok(D.byCode(mc, '', () => false) === null && D.byCode(mc, 'NOPE99', () => false) === null, 'no code, or an unknown code: no row');
  ok(!('code' in D.boardView(mc, mc.boards[0], null, 0).seats[0]) && !D.finish(mc).rows.some((r) => 'code' in r), 'the student code never leaves the server');
}

// ---------- a turn: pre → go → questions → stroke / stir → stop ----------
{
  const { m, now: t0 } = game(4);
  const ev0 = D.startPlay(m, t0);
  const pre = evOf(ev0, 'pre')[0];
  ok(pre && pre.guided && pre.ms === R.PRE_MS, 'the play starts with «Turno de…» (guided first turn)', pre);
  const b = m.boards[0];
  const k1 = pre.k;
  ok(b.seats[0] === k1, 'the first seat plays first');
  ok(D.answer(m, k1, 'x', 0, t0).ok === false, 'no answer before the turn');
  // a watcher guesses during «Turno de…»
  const watcher = b.seats[1];
  ok(D.guess(m, watcher, 'sleep', t0 + 5) === null, 'no guess on a guided first turn (he never wakes then)');
  m.kids[k1].first = false;                                      // (from here: an ordinary turn)
  ok(D.guess(m, k1, 'wake', t0 + 10) === null, 'the turn kid does not guess');
  const gs = D.guess(m, watcher, 'sleep', t0 + 10);
  ok(gs && gs.tally.sleep === 1, 'a watcher guesses «sigue dormido»');
  ok(D.guess(m, watcher, 'wake', t0 + 20) === null, 'one guess per turn');
  let r = until(m, t0, 'go');
  ok(r.hit && r.hit.k === k1 && r.hit.ms === R.TURN_MS && !r.hit.guided, 'an ordinary turn lasts TURN_MS', r.hit);
  ok(D.guess(m, b.seats[2], 'wake', r.now + R.GUESS_IN_MS + 50) === null, 'the guess closes 2 s into the turn');
  const q = evOf(r.ev, 'q')[0] || until(m, r.now, 'q').hit;
  ok(q && q.k === k1 && q.q.answers.length === 4 && q.q.correctIdx >= 0, 'the turn kid gets a question at once');
  ok(!('correctIdx' in D.qPublic(q.q)), 'what a phone sees has no right answer');
  let now = r.now + 100;
  ok(D.answer(m, k1, q.q.qid, q.q.correctIdx, q.q.sentAt + 50).ok === false, 'a double tap (< 300 ms) is ignored');
  const a1 = D.answer(m, k1, q.q.qid, q.q.correctIdx, now + 1000);
  const pat = evOf(a1.ev, 'pat')[0];
  ok(pat && pat.pts === 1 && pat.score === 1 && m.kids[k1].score === 1 && b.danger === 1, 'a right answer = a stroke: +1 point, danger +1', pat);
  ok(D.answer(m, k1, q.q.qid, q.q.correctIdx, now + 1100).ok === false, 'the same question cannot score twice');
  r = until(m, now + 1000, 'q');
  ok(r.hit && r.now - (now + 1000) >= R.NEXT_Q_MS - 100, 'the next question follows NEXT_Q_MS later');
  const wrongIdx = (r.hit.q.correctIdx + 1) % 4;
  const a2 = D.answer(m, k1, r.hit.q.qid, wrongIdx, r.now + 900);
  const miss = evOf(a2.ev, 'miss')[0];
  ok(miss && miss.correctIdx === r.hit.q.correctIdx && b.danger === 3 && m.kids[k1].score === 1, 'a wrong answer: he stirs (danger +2), no point, the right answer shown', miss);
  const st = D.stop(m, k1, r.now + 1000);
  const end = evOf(st, 'end')[0];
  ok(end && end.why === 'stop' && end.pats === 1 && b.phase === 'post', '«¡Me retiro!» ends the turn safely', end);
  ok(end.guess.includes(watcher), 'the «sigue dormido» guess was right', end.guess);
  ok(m.kids[watcher].guessOk === 1 && m.kids[k1].safe === 1, 'guess + safe turn counted');
  r = until(m, r.now + 1000, 'pre');
  ok(r.hit && r.hit.k === b.seats[1], 'then the next seat plays');
  r = until(m, r.now, 'go');
  r = until(m, r.now, 'end', R.FIRST_TURN_MS + 1000);
  ok(r.hit && r.hit.why === 'time' && r.hit.pats === 0, 'time up ends the turn safely', r.hit);
}

// ---------- the wake-up: the waker loses everything, a new night, the next kid ----------
{
  const { m, now: t0 } = game(3, 11);
  D.startPlay(m, t0);
  const b = m.boards[0];
  b.seats.forEach((k) => { m.kids[k].first = false; });         // past the guided turns
  b.ti = -1; b.phase = 'post'; b.phaseUntil = t0;
  let r = until(m, t0, 'go');
  const k = r.hit.k;
  m.kids[k].score = 9;
  b.limit = b.danger + 2;
  r = until(m, r.now, 'q');
  let a = D.answer(m, k, r.hit.q.qid, r.hit.q.correctIdx, r.now + 500);
  ok(evOf(a.ev, 'pat').length && !evOf(a.ev, 'wake').length && m.kids[k].score === 10, 'one stroke below the limit: safe');
  r = until(m, r.now + 500, 'q');
  a = D.answer(m, k, r.hit.q.qid, r.hit.q.correctIdx, r.now + 500);
  const w = evOf(a.ev, 'wake')[0];
  ok(w && w.k === k && w.lost === 11 && m.kids[k].score === 0 && m.kids[k].lost === 11 && m.kids[k].wakes === 1, 'the stroke that reaches the limit wakes him: ALL points lost', w);
  ok(b.phase === 'wake' && D.boardView(m, b, null, r.now).cue === 4, 'the board shows him awake');
  ok(D.stop(m, k, r.now + 600).length === 0 && D.answer(m, k, 'x', 0, r.now + 600).ok === false, 'nothing more for the waker this turn');
  r = until(m, r.now + 500, 'night');
  ok(r.hit && r.hit.night === 2 && b.danger === 0 && b.cue === 0, 'he falls asleep again: night 2, danger back to 0', r.hit);
  r = until(m, r.now, 'pre');
  const idx = b.seats.indexOf(k);
  ok(r.hit && r.hit.k === b.seats[(idx + 1) % b.seats.length], 'the kid after the waker plays next');
  // a wrong answer can wake him too
  r = until(m, r.now, 'go');
  const k2 = r.hit.k;
  m.kids[k2].score = 4;
  b.limit = b.danger + 1;
  r = until(m, r.now, 'q');
  a = D.answer(m, k2, r.hit.q.qid, (r.hit.q.correctIdx + 1) % 4, r.now + 500);
  ok(evOf(a.ev, 'wake')[0] && evOf(a.ev, 'wake')[0].by === 'miss' && m.kids[k2].score === 0, 'a wrong answer over the limit wakes him (by: miss)');
}

// ---------- a guided first turn never wakes him ----------
{
  const { m, now: t0 } = game(4, 3);
  D.startPlay(m, t0);
  const b = m.boards[0];
  let r = until(m, t0, 'go');
  ok(r.hit.guided, 'the first turn is guided');
  const lim = b.limit, cap = Math.floor(b.limit * b.cuts[0]);
  b.danger = cap - 1;
  r = until(m, r.now, 'q');
  let a = D.answer(m, r.hit.k, r.hit.q.qid, r.hit.q.correctIdx, r.now + 500);
  ok(!evOf(a.ev, 'wake').length && m.kids[r.hit.k].score === 1 && b.danger === cap, 'a guided turn: a stroke counts, the danger rises up to the first cue', [b.danger, cap]);
  r = until(m, r.now + 500, 'q');
  a = D.answer(m, r.hit.k, r.hit.q.qid, (r.hit.q.correctIdx + 1) % 4, r.now + 500);
  ok(!evOf(a.ev, 'wake').length && b.danger === cap && b.limit === lim && D.cueOf(b) <= 1, 'a guided turn never passes the first cue, the limit never moves (no «time bomb» for the next kid)', [b.danger, cap, b.limit, lim]);
}

// ---------- cues rise with the danger, never the number ----------
{
  const { m } = game(4, 5);
  const b = m.boards[0];
  const seen = [];
  for (let d = 0; d < b.limit; d++) { b.danger = d; seen.push(D.cueOf(b)); }
  ok(seen[0] === 0 && seen[seen.length - 1] === 3, 'cues 0 → 3 as the danger rises', seen);
  ok(seen.every((c, i) => i === 0 || c >= seen[i - 1]), 'cues never go down within a night');
  const v = D.boardView(m, b, null, 0);
  ok(!('limit' in v) && !('danger' in v) && !('cuts' in v), 'the board view hides the limit');
}

// ---------- the last 30 s: strokes ×2; the clock ----------
{
  const { m, now: t0 } = game(2, 9);
  D.startPlay(m, t0);
  let ev = D.tick(m, m.frenzyAt + 10, opts());
  ok(evOf(ev, 'frenzy').length === 1 && m.frenzy, 'the last 30 s start «¡Luna llena!»');
  const b = m.boards[0];
  b.seats.forEach((k) => { m.kids[k].first = false; });
  b.phase = 'post'; b.phaseUntil = m.frenzyAt + 10;
  let r = until(m, m.frenzyAt + 10, 'go');
  r = until(m, r.now, 'q');
  const a = D.answer(m, r.hit.k, r.hit.q.qid, r.hit.q.correctIdx, r.now + 400);
  ok(evOf(a.ev, 'pat')[0].pts === 2 && evOf(a.ev, 'pat')[0].x2, 'a stroke in the last 30 s = +2');
  // «+30 s» moves the end away: the frenzy goes off
  const d = D.addTime(m, 30000, r.now + 500);
  ok(d === 30000, '«+30 s» adds 30 s');
  ev = D.tick(m, r.now + 600, opts());
  ok(evOf(ev, 'frenzy').some((e) => e.off) && !m.frenzy, '«+30 s» out of the last 30 s turns the ×2 off');
  // «−30 s» never ends the game by itself
  const cut = D.addTime(m, -120000, r.now + 700);
  ok(cut < 0 && m.endsAt - (r.now + 700) >= 9000, '«−30 s» stops ~10 s before the end', m.endsAt - (r.now + 700));
  ok(D.addTime(m, -30000, r.now + 700) === 0, 'nothing left to take: no change');
}
{
  // pause: every deadline moves by the paused time
  const { m, now: t0 } = game(4);
  D.startPlay(m, t0);
  const b = m.boards[0];
  const before = [m.endsAt, b.phaseUntil];
  D.shiftTimes(m, 5000);
  ok(m.endsAt === before[0] + 5000 && b.phaseUntil === before[1] + 5000, 'a pause moves every deadline');
}

// ---------- dropped phones ----------
{
  const { m, now: t0 } = game(3, 21);
  D.startPlay(m, t0);
  const b = m.boards[0];
  const gone = new Set([b.seats[0]]);
  const on = (k) => !gone.has(k);
  b.ti = -1; b.phase = 'post'; b.phaseUntil = t0;
  let r = until(m, t0, 'pre', 5000, opts(on));
  ok(r.hit.k === b.seats[0] && r.hit.ms === R.DROP_MS && !r.hit.here, 'a kid whose phone is gone: «Turno de…» waits 3 s');
  r = until(m, r.now, 'skip', 5000, opts(on));
  ok(r.hit && r.hit.k === b.seats[0] && evOf(r.ev, 'pre')[0].k === b.seats[1], 'then the turn is skipped');
  // mid-turn drop: the turn ends 3 s later
  r = until(m, r.now, 'go', 5000, opts(on));
  gone.add(r.hit.k);
  const t1 = r.now;
  r = until(m, r.now, 'end', 8000, opts(on));
  ok(r.hit && r.hit.why === 'drop' && r.now - t1 >= R.DROP_MS, 'a phone lost mid-turn ends the turn after 3 s', r.hit);
  // a kid gone for long is passed over at once
  m.kids[b.seats[0]].awaySince = r.now - R.AWAY_SKIP_MS - 10;
  m.kids[r.hit.k].awaySince = r.now - R.AWAY_SKIP_MS - 10;
  r = until(m, r.now, 'pre', 5000, opts(on));
  ok(r.hit && r.hit.k === b.seats[2], 'kids away for long are skipped at once');
  // nobody left: idle, then back
  b.seats.forEach((k) => gone.add(k));
  r = until(m, r.now, 'go', 4000, opts(on));
  r = until(m, r.now, 'end', 6000, opts(on));
  b.seats.forEach((k) => { m.kids[k].awaySince = r.now - R.AWAY_SKIP_MS - 10; });   // (all gone for long)
  D.tick(m, r.now + R.POST_MS + 200, opts(on));
  ok(b.phase === 'idle', 'nobody connected: the board idles', b.phase);
  gone.clear();
  const ev = D.tick(m, r.now + R.POST_MS + 400, opts(on));
  ok(evOf(ev, 'pre').length === 1, 'someone comes back: the board plays again');
}

// ---------- «¡FINAL!» and the ceremony payload ----------
{
  const { m, now: t0 } = game(4, 33);
  D.startPlay(m, t0);
  const b = m.boards[0];
  let r = until(m, t0, 'q');
  D.answer(m, r.hit.k, r.hit.q.qid, r.hit.q.correctIdx, r.now + 400);
  m.endsAt = r.now + 500;                           // (the clock runs out in the middle of the turn)
  const ev = D.tick(m, m.endsAt + 1, opts());
  const end = evOf(ev, 'end')[0];
  ok(end && end.why === 'final' && m.kids[r.hit.k].score === 1, '«¡FINAL!» ends a turn safely (its strokes stand)');
  ok(evOf(ev, 'final').length === 1 && m.phase === 'final', '«¡FINAL!» once');
  ok(D.tick(m, m.endsAt + 500, opts()).length === 0, 'nothing moves during «¡FINAL!»');
  ok(D.answer(m, r.hit.k, 'x', 0, m.endsAt + 600).ok === false && D.stop(m, r.hit.k, m.endsAt + 600).length === 0, 'no answers after «¡FINAL!»');
  // a board with scores, a waker, guesses
  const [a, bb, c, d] = b.seats.map((k) => m.kids[k]);
  Object.assign(a, { score: 7, pats: 9, big: 4, safe: 2, best: 5, wakes: 0, guessOk: 1 });
  Object.assign(bb, { score: 7, pats: 7, big: 2, safe: 1, best: 2, wakes: 1, guessOk: 3 });
  Object.assign(c, { score: 0, pats: 6, big: 6, safe: 0, best: 3, wakes: 1, guessOk: 0 });
  Object.assign(d, { score: 0, pats: 0, big: 0, safe: 0, best: 0, wakes: 0, guessOk: 0, answered: 0 });
  const fin = D.finish(m);
  const bd = fin.boards[0];
  ok(bd.rows[0] === a.k && bd.winners.length === 1 && bd.winners[0] === a.k, 'equal points: more strokes wins', bd);
  ok(fin.byK[a.k].rank === 1 && fin.byK[bb.k].rank === 2, 'ranks');
  const sid = (id) => bd.stars.find((s) => s.id === id);
  ok(sid('valiente') && sid('valiente').winners[0] === c.k && sid('valiente').value === 6, '«Más valiente» = most strokes in one turn', sid('valiente'));
  ok(sid('prudente') && sid('prudente').winners[0] === a.k, '«Más prudente» = safe turns, never woke him');
  ok(sid('racha') && sid('racha').winners[0] === a.k, '«Mejor racha»');
  ok(sid('adivino') && sid('adivino').winners[0] === bb.k, '«Mejor adivino»');
  ok(fin.byK[c.k].stars.includes('valiente') && fin.byK[d.k].stars.length === 0, 'each row carries its stars');
  ok(fin.byK[a.k].classRank === 1, 'the class rank');
  // nobody scored: no winner
  const { m: m0, now: z } = game(3);
  D.startPlay(m0, z);
  D.final(m0, z + 100);
  ok(D.finish(m0).boards[0].winners.length === 0 && D.finish(m0).winners.length === 0, 'nobody scored: nobody wins');
  ok(D.final(m0, z + 200).length === 0, 'a second «Terminar» does nothing');
}

// ---------- reactions ----------
{
  const { m, now: t0 } = game(4);
  D.startPlay(m, t0);
  const k = m.boards[0].seats[1];
  ok(D.react(m, k, 'shh', t0 + 10) && !D.react(m, k, 'wow', t0 + 500) && D.react(m, k, 'wow', t0 + 1300), 'reactions: one per 1.2 s');
  ok(!D.react(m, k, 'evil', t0 + 5000), 'only the 4 reactions');
}

// ---------- a class simulation (the timing: 2-5 strokes a turn, a few wake-ups) ----------
function simulate(nKids, seed, style) {
  const t0 = 5000000;
  const m = D.newGame(seed, 240, t0);
  D.deal(m, Array.from({ length: nKids }, (_, i) => [i + 1, 'K' + i, 'dralingo']));
  let now = t0;
  D.startPlay(m, now);
  let rng = seed * 9301 + 49297;
  const rand = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  const pending = {};            // k → { at, qid, idx }
  const stats = { turns: 0, pats: [], wakes: 0, nights: 0, stops: 0 };
  const kidStyle = (k) => (style === 'mixed' ? ['greedy', 'careful', 'normal'][k % 3] : style);
  const cueNow = (b) => b.cue;
  for (let step = 0; step < 300000 / 100 && m.phase === 'play'; step++) {
    now += 100;
    const ev = D.tick(m, now, opts());
    ev.forEach((e) => {
      if (e.t === 'q') {
        // a kid reads + answers in 1.6-3.8 s, right 80 %
        const at = now + 1600 + rand() * 2200;
        const right = rand() < 0.8;
        pending[e.k] = { at, qid: e.q.qid, idx: right ? e.q.correctIdx : (e.q.correctIdx + 1) % 4 };
      }
      if (e.t === 'end') { stats.turns++; stats.pats.push(e.pats); if (e.why === 'stop') stats.stops++; }
      if (e.t === 'wake') { stats.turns++; stats.pats.push(e.pats); stats.wakes++; }
      if (e.t === 'night') stats.nights++;
    });
    Object.entries(pending).forEach(([k, p]) => {
      if (now < p.at) return;
      delete pending[k];
      const r = m.kids[k];
      const b = D.boardOf(m, r.b);
      const s = kidStyle(Number(k));
      const c = b.cur;
      if (!c || c.k !== Number(k)) return;
      // careful kids stop after 1-2 strokes or when he stirs; normal kids at cue 2 or after 3; greedy never
      const stopNow = () => D.stop(m, Number(k), now).forEach((e) => { if (e.t === 'end') { stats.turns++; stats.pats.push(e.pats); stats.stops++; } });
      if (s === 'careful' && (c.pats >= 1 + (Number(k) % 2) || cueNow(b) >= 2)) { stopNow(); return; }
      if (s === 'normal' && (c.pats >= 3 || cueNow(b) >= 3)) { stopNow(); return; }
      const a = D.answer(m, Number(k), p.qid, p.idx, now);
      a.ev.forEach((e) => { if (e.t === 'wake') { stats.turns++; stats.pats.push(e.pats); stats.wakes++; } });
    });
  }
  const avg = stats.pats.reduce((a, b) => a + b, 0) / Math.max(1, stats.pats.length);
  return { kids: nKids, boards: m.boards.length, style, turns: stats.turns, avgPats: Math.round(avg * 10) / 10, wakes: stats.wakes, stops: stats.stops, perBoardTurns: Math.round(stats.turns / m.boards.length) };
}
const SIM = process.argv.includes('--sim');
const runs = [];
['greedy', 'normal', 'careful', 'mixed'].forEach((style) => [4, 12, 30].forEach((n) => [1, 2, 3].forEach((seed) => runs.push(simulate(n, seed * 17 + n, style)))));
const by = (style) => runs.filter((r) => r.style === style);
const mean = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
const greedy = by('greedy'), mixed = by('mixed'), careful = by('careful');
if (SIM) runs.forEach((r) => console.log(JSON.stringify(r)));
ok(mean(greedy, (r) => r.avgPats) >= 2 && mean(greedy, (r) => r.avgPats) <= 5, 'a kid who never stops gets 2-5 strokes a turn', mean(greedy, (r) => r.avgPats));
ok(mean(mixed, (r) => r.avgPats) >= 1.2 && mean(mixed, (r) => r.avgPats) <= 4.5, 'a mixed class (a third stop after 1-2): 1.2-4.5 strokes a turn', mean(mixed, (r) => r.avgPats));
ok(mean(greedy, (r) => r.wakes / r.boards) >= 1.5, 'greedy boards wake him up more than once a game', mean(greedy, (r) => r.wakes / r.boards));
ok(mean(careful, (r) => r.wakes / r.boards) < mean(greedy, (r) => r.wakes / r.boards), 'careful boards wake him less');
ok(mean(mixed, (r) => r.perBoardTurns) >= 10, 'a 4-minute game: ~10+ turns per board', mean(mixed, (r) => r.perBoardTurns));
if (SIM) console.log('greedy pats', mean(greedy, (r) => r.avgPats).toFixed(2), 'wakes/board', mean(greedy, (r) => r.wakes / r.boards).toFixed(2),
  '| mixed pats', mean(mixed, (r) => r.avgPats).toFixed(2), 'wakes/board', mean(mixed, (r) => r.wakes / r.boards).toFixed(2), 'turns/board', mean(mixed, (r) => r.perBoardTurns).toFixed(1),
  '| careful wakes/board', mean(careful, (r) => r.wakes / r.boards).toFixed(2));

console.log(`test-dormilon: ${checks} checks OK`);
