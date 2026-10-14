// Rules check for Ojos de Halcón (core/halcon.js). Run: node scripts/test-halcon.js
// Boards for every class size (1–40) and late joiners, speed-rank points per board size (5/3/2/1, 5/3/2, 5/3/2/1/1),
// wrong / no look = 0, one look per round, rounds that close when everyone looked or when the 6 s window ends, the
// pause shift, the question order, ties in the standings, the end payload, and 400 simulated classes.
'use strict';
const assert = require('assert');
const H = require('../core/halcon');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };
const R = H.R;

// a fake room: pid → player, like server.js g.players
function room(n, prefix) {
  const players = {};
  for (let i = 0; i < n; i++) players[(prefix || 's') + i] = { name: (prefix || 'Kid') + i, avatar: '', disconnected: false };
  return players;
}
const entries = (players) => Object.entries(players).map(([pid, p]) => [pid, p, 'dralingo']);
function game(n, seed, rounds) {
  const h = H.newGame(seed || 7, rounds || 10, 0);
  const players = room(n);
  H.deal(h, entries(players));
  return { h, players };
}
const Q = (i) => ({ text: `¿Qué significa «w${i}»?`, correct: `ok${i}`, answers: [`ok${i}`, `a${i}`, `b${i}`, `c${i}`], kind: 'zh2es' });
const seatOf = (h, p) => h.seats[p.hcSeat];
const posOf = (h, ok) => (ok ? h.q.correctPos : (h.q.correctPos + 1) % 4);

// ---------- boards for every class size ----------
for (let n = 1; n <= 40; n++) {
  const sizes = H.boardSizes(n);
  eq(sizes.reduce((a, b) => a + b, 0), n, `n=${n}: every kid has a place`);
  if (n <= 5) eq(sizes, [n], `n=${n}: one board`);
  else {
    eq(sizes.length, Math.ceil(n / 4), `n=${n}: ceil(n/4) boards`);
    ok(sizes.every((s) => s === 3 || s === 4), `n=${n}: boards of 3 or 4 (${sizes})`);
    ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${n}: sizes as even as possible`);
  }
  for (let seed = 1; seed <= 5; seed++) {
    const ids = Array.from({ length: n }, (_, i) => 'k' + i);
    const split = H.splitBoards(ids, H.mulberry32(seed));
    eq(split.map((b) => b.length), sizes, `n=${n} seed ${seed}: the split follows the sizes`);
    eq(split.flat().sort(), ids.slice().sort(), `n=${n} seed ${seed}: every kid exactly once`);
  }
  const { h, players } = game(n, n * 31);
  eq(h.boards.length, sizes.length, `n=${n}: dealt into ${sizes.length} boards`);
  const seats = Object.values(players).map((p) => p.hcSeat);
  eq(new Set(seats).size, n, `n=${n}: one seat per kid`);
  Object.values(players).forEach((p) => {
    ok(H.inGame(h, p), `n=${n}: ${p.name} is in the game`);
    ok(H.boardOf(h, p.hcBoard).seats.includes(p.hcSeat), `n=${n}: ${p.name} sits in the board the player says`);
  });
  // late joiners: the smallest board with room (max 5); every board at 5 → a new board
  for (let late = 1; late <= 12; late++) {
    const before = h.boards.map((b) => b.seats.length);
    const p = { name: `Late${n}-${late}`, disconnected: false };
    const open = h.boards.filter((b) => b.seats.length < R.BOARD_MAX);
    const min = open.length ? Math.min(...open.map((b) => b.seats.length)) : null;
    const b = H.lateSeat(h, p, 'fer');
    ok(b, `n=${n} late ${late}: seated`);
    if (min == null) ok(b.seats.length === 1 && h.boards.length === before.length + 1, `n=${n} late ${late}: all boards full → a new board`);
    else eq(b.seats.length, min + 1, `n=${n} late ${late}: went to the smallest board`);
    ok(h.boards.every((x) => x.seats.length <= R.BOARD_MAX), `n=${n} late ${late}: no board over 5`);
    eq(H.lateSeat(h, p, 'fer'), null, `n=${n} late ${late}: a rejoin keeps the seat (no second seat)`);
    eq(p.score, 0, `n=${n} late ${late}: starts at 0`);
  }
}

// ---------- points by speed rank per board size ----------
eq([1, 2, 3, 4].map((r) => H.pointsFor(r, 4)), [5, 3, 2, 1], 'board of 4: 5/3/2/1 (the video)');
eq([1, 2, 3].map((r) => H.pointsFor(r, 3)), [5, 3, 2], 'board of 3: 5/3/2');
eq([1, 2, 3, 4, 5].map((r) => H.pointsFor(r, 5)), [5, 3, 2, 1, 1], 'board of 5: 5/3/2/1/1');
eq([1, 2].map((r) => H.pointsFor(r, 2)), [5, 3], 'board of 2: 5/3');
eq(H.pointsFor(1, 1), 5, 'alone: +5');
eq(H.pointsFor(0, 4), 0, 'no rank = 0');

// ---------- one round, board of 4, in detail ----------
{
  const { h, players } = game(4, 99);
  const [a, b, c, d] = Object.values(players);
  ok(H.boardOf(h, a.hcBoard).seats.length === 4, 'four kids = one board of 4');
  H.startQuestion(h, Q(1), '/img.webp', null, 1000);
  eq(h.phase, 'question', 'the question phase first');
  eq(h.q.opts.filter(Boolean).length, 4, 'four answers in four windows');
  eq(h.q.opts[h.q.correctPos], 'ok1', 'correctPos points at the right answer');
  eq(H.answer(h, a, h.q.correctPos, 1100).status, 'closed', 'no look before the windows open');
  ok(H.openAnswers(h, 2500), 'the windows open');
  eq(h.q.closeAt, 2500 + R.ANSWER_MS, 'the window lasts ANSWER_MS');
  eq(H.answer(h, a, posOf(h, true), 2900).status, 'ok', 'A looks right first');
  eq(H.answer(h, b, posOf(h, false), 3000).status, 'ok', 'B looks wrong');
  eq(H.answer(h, b, posOf(h, true), 3050).status, 'locked', 'B is locked: one look per round');
  eq(h.looks[b.hcSeat].ok, false, 'the locked look stays wrong');
  eq(H.answer(h, c, 7, 3060).status, 'closed', 'a window that does not exist is ignored');
  eq(H.answer(h, c, posOf(h, true), 3100).status, 'ok', 'C looks right second');
  eq(H.closeEarly(h, players, 3100), 0, 'not everyone looked: the round keeps its window');
  eq(H.answer(h, d, posOf(h, true), 3300).status, 'ok', 'D looks right third');
  eq(H.closeEarly(h, players, 3300), R.ALL_DONE_MS, 'everyone looked: the round closes ALL_DONE_MS later');
  eq(h.q.closeAt, 3300 + R.ALL_DONE_MS, 'closeAt moved');
  const res = H.resolve(h, players, 3800);
  eq(h.phase, 'resolve', 'resolve phase');
  const row = (p) => res.boards[0].rows.find((r) => r.id === p.hcSeat);
  eq([row(a).pts, row(c).pts, row(d).pts, row(b).pts], [5, 3, 2, 0], 'speed rank: +5 / +3 / +2, wrong = 0');
  eq([a.score, b.score, c.score, d.score], [5, 0, 3, 2], 'scores on the players');
  eq(row(b).looked, true, 'B looked (wrong)');
  eq(res.correctText, 'ok1', 'the right answer travels with the result');
  eq(H.answer(h, a, 0, 3900).status, 'closed', 'no look after the round resolved');
  eq(a.hcFirsts, 1, 'A has one +5');
  eq(a.hcStreak, 1, 'A streak 1');
  eq(b.hcWrong, 1, 'B one wrong');
}

// ---------- timeout: nobody (or not everybody) looked ----------
{
  const { h, players } = game(4, 5);
  H.startQuestion(h, Q(2), null, null, 0);
  H.openAnswers(h, R.QUESTION_MS);
  const [a] = Object.values(players);
  H.answer(h, a, posOf(h, true), R.QUESTION_MS + 400);
  eq(H.closeEarly(h, players, R.QUESTION_MS + 400), 0, 'one of four looked: wait');
  eq(h.phaseUntil, R.QUESTION_MS + R.ANSWER_MS, 'the round ends when the 6 s window ends');
  const res = H.resolve(h, players, R.QUESTION_MS + R.ANSWER_MS);
  eq(res.boards[0].rows.map((r) => r.pts).sort(), [0, 0, 0, 5], 'the only right look gets +5, no look = 0');
  eq(Object.values(players).filter((p) => p.hcMiss === 1).length, 3, 'three misses counted');
  // a disconnected kid doesn't hold the round
  const g2 = game(3, 8);
  const kids = Object.values(g2.players);
  kids[2].disconnected = true;
  H.startQuestion(g2.h, Q(3), null, null, 0);
  H.openAnswers(g2.h, 0);
  H.answer(g2.h, kids[0], posOf(g2.h, false), 100);
  H.answer(g2.h, kids[1], posOf(g2.h, true), 200);
  ok(H.allAnswered(g2.h, g2.players), 'the disconnected kid does not hold the round');
  eq(H.closeEarly(g2.h, g2.players, 200), R.ALL_DONE_MS, 'closes early without them');
  const r2 = H.resolve(g2.h, g2.players, 800);
  eq(r2.boards[0].rows.find((r) => r.id === kids[2].hcSeat).off, true, 'their stall is marked off');
  eq(kids[2].hcMiss, 0, 'an absent kid is not counted as a miss');
  // the window closing near its end is not moved later
  const g3 = game(2, 9);
  H.startQuestion(g3.h, Q(4), null, null, 0);
  H.openAnswers(g3.h, 0);
  Object.values(g3.players).forEach((p) => H.answer(g3.h, p, 0, R.ANSWER_MS - 100));
  eq(H.closeEarly(g3.h, g3.players, R.ANSWER_MS - 100), 0, 'never later than the window');
}

// ---------- ranks count inside each board ----------
{
  const { h, players } = game(8, 3);
  eq(h.boards.map((b) => b.seats.length), [4, 4], '8 kids = two boards of 4');
  H.startQuestion(h, Q(5), null, null, 0);
  H.openAnswers(h, 0);
  const order = Object.values(players).sort((x, y) => x.hcSeat - y.hcSeat);
  order.forEach((p, i) => H.answer(h, p, posOf(h, true), 10 + i * 10));
  const res = H.resolve(h, players, 1000);
  res.boards.forEach((b) => eq(b.rows.map((r) => r.pts).sort((x, y) => y - x), [5, 3, 2, 1], `board ${b.id}: its own 5/3/2/1`));
  eq(Object.values(players).filter((p) => p.score === 5).length, 2, 'one +5 per board');
}
{ // board of 3 and board of 5
  const g3 = game(3, 4);
  H.startQuestion(g3.h, Q(6), null, null, 0); H.openAnswers(g3.h, 0);
  Object.values(g3.players).forEach((p, i) => H.answer(g3.h, p, posOf(g3.h, true), 10 + i));
  eq(H.resolve(g3.h, g3.players, 100).boards[0].rows.map((r) => r.pts).sort((x, y) => y - x), [5, 3, 2], 'board of 3: 5/3/2');
  const g5 = game(5, 4);
  eq(g5.h.boards.length, 1, '5 kids = one board of 5');
  H.startQuestion(g5.h, Q(7), null, null, 0); H.openAnswers(g5.h, 0);
  Object.values(g5.players).forEach((p, i) => H.answer(g5.h, p, posOf(g5.h, true), 10 + i));
  eq(H.resolve(g5.h, g5.players, 100).boards[0].rows.map((r) => r.pts).sort((x, y) => y - x), [5, 3, 2, 1, 1], 'board of 5: 5/3/2/1/1');
}

// ---------- pause shift, paused looks ----------
{
  const { h, players } = game(4, 12);
  H.startQuestion(h, Q(8), null, null, 0);
  H.openAnswers(h, 1500);
  h.paused = true;
  eq(H.answer(h, Object.values(players)[0], 0, 2000).status, 'closed', 'no looks while paused');
  h.paused = false;
  H.shiftTimes(h, 5000);
  eq([h.q.openAt, h.q.closeAt, h.phaseUntil], [6500, 6500 + R.ANSWER_MS, 6500 + R.ANSWER_MS], 'a pause moves every pending moment');
}

// ---------- question order: short answers first, no repeats until the pack is used up ----------
{
  const qs = [];
  for (let i = 0; i < 12; i++) qs.push(i % 3 === 0 ? Object.assign(Q(i), { answers: [`ok${i}`, 'una respuesta muy larga para una ventana', 'b', 'c'] }) : Q(i));
  qs.push({ text: 'broken', correct: 'x', answers: ['y'] });
  const order = H.pickOrder(qs, H.mulberry32(3));
  eq(order.length, 12, 'broken questions are skipped');
  const firstLong = order.findIndex((i) => i % 3 === 0);
  ok(order.slice(firstLong).every((i) => i % 3 === 0), 'questions with long answers come after the short ones');
  const h = H.newGame(5, 10, 0);
  const seen = [];
  for (let i = 0; i < 12; i++) seen.push(qs.indexOf(H.nextQuestion(h, qs)));
  eq(new Set(seen).size, 12, 'no repeat until the pack is used up');
  ok(H.nextQuestion(h, qs), 'then it starts again');
  eq(H.nextQuestion(H.newGame(1, 10, 0), []), null, 'an empty pack gives no question');
}

// ---------- per-answer pictures only when every answer has one ----------
{
  const h = H.newGame(2, 10, 0);
  const q = Q(9);
  H.startQuestion(h, q, null, { ok9: '/p/1.webp', a9: '/p/2.webp', b9: '/p/3.webp', c9: '/p/4.webp' }, 0);
  ok(h.q.pics && h.q.pics[h.q.correctPos] === '/p/1.webp', 'pictures follow their answers into the windows');
  H.startQuestion(h, q, null, { ok9: '/p/1.webp', a9: '/p/2.webp' }, 0);
  eq(h.q.pics, null, 'missing pictures → text windows (never a mix)');
}

// ---------- ties and the end payload ----------
{
  const { h, players } = game(4, 21);
  const [a, b, c, d] = Object.values(players);
  // round 1: a first, b second; round 2: b first, a second → a and b level on 8 points with one +5 each
  for (const order of [[a, b], [b, a]]) {
    H.startQuestion(h, Q(10), null, null, 0); H.openAnswers(h, 0);
    order.forEach((p, i) => H.answer(h, p, posOf(h, true), 100 + i * 100));
    H.answer(h, c, posOf(h, false), 500);
    H.resolve(h, players, 1000);
  }
  eq([a.score, b.score, c.score, d.score], [8, 8, 0, 0], 'a and b tied on points');
  let fin = H.finish(h, players);
  eq(fin.boards[0].winners.length, 2, 'same points, same +5s, same speed: both win');
  eq(fin.boards[0].rows.slice(0, 2).map((r) => r.rank), [1, 1], 'tied kids share the rank');
  eq(fin.boards[0].why, null, 'no tiebreak text for a real tie');
  // a third round where a is faster: a ahead on points
  H.startQuestion(h, Q(11), null, null, 0); H.openAnswers(h, 0);
  H.answer(h, a, posOf(h, true), 100); H.answer(h, b, posOf(h, true), 200);
  H.resolve(h, players, 1000);
  fin = H.finish(h, players);
  eq(fin.boards[0].winners.map((w) => w.name), [a.name], 'more points wins');
  eq(fin.all[0].name, a.name, 'the class ranking agrees');
  eq(fin.all.length, 4, 'every kid in the class ranking');
  ok(fin.all.every((r, i, arr) => i === 0 || arr[i - 1].score >= r.score), 'class ranking sorted by points');
  // equal points, more +5 wins (tiebreak «firsts»)
  const g2 = game(2, 31);
  const [x, y] = Object.values(g2.players);
  x.score = 6; x.hcFirsts = 1; y.score = 6; y.hcFirsts = 0; x.hcRight = 2; y.hcRight = 2; x.hcMs = 5000; y.hcMs = 1000;
  fin = H.finish(g2.h, g2.players);
  eq([fin.boards[0].winners.length, fin.boards[0].winners[0].name, fin.boards[0].why], [1, x.name, 'firsts'], 'level points: more +5 wins');
  y.hcFirsts = 1;
  fin = H.finish(g2.h, g2.players);
  eq([fin.boards[0].winners[0].name, fin.boards[0].why], [y.name, 'speed'], 'level points and +5s: the faster average wins');
  ok(['boards', 'all', 'winners', 'why', 'rounds', 'totalRounds'].every((k) => k in fin), 'the end payload has its fields');
  // nobody scored (e.g. «Terminar» during the intro): no winner anywhere
  const g0 = game(4, 41);
  const fin0 = H.finish(g0.h, g0.players);
  eq([fin0.winners.length, fin0.boards[0].winners.length, fin0.why], [0, 0, null], 'all at 0 points: nobody wins');
  ok(fin.boards[0].rows.every((r) => ['id', 'board', 'name', 'skin', 'score', 'rank', 'firsts', 'right', 'avg', 'best'].every((k) => k in r)), 'each row has what the finale shows');
}

// ---------- 400 simulated classes: points always add up, nobody is ever over the table ----------
for (let sim = 0; sim < 400; sim++) {
  const rng = H.mulberry32(1000 + sim);
  const n = 1 + Math.floor(rng() * 40);
  const rounds = rng() < 0.5 ? 10 : 15;
  const { h, players } = game(n, 5000 + sim, rounds);
  const kids = Object.values(players);
  let given = 0;
  for (let r = 0; r < rounds; r++) {
    if (rng() < 0.15) {                         // a late joiner
      const p = { name: `L${sim}-${r}`, disconnected: false };
      players['late' + sim + '-' + r] = p;
      H.lateSeat(h, p, 'oryx');
      kids.push(p);
    }
    kids.forEach((p) => { p.disconnected = rng() < 0.05; });
    const t0 = r * 10000;
    H.startQuestion(h, Q(r), null, null, t0);
    H.openAnswers(h, t0 + R.QUESTION_MS);
    const order = kids.slice().sort(() => rng() - 0.5);
    order.forEach((p, i) => { if (!p.disconnected && rng() < 0.85) H.answer(h, p, Math.floor(rng() * 4), t0 + R.QUESTION_MS + 50 + i * 37); });
    const res = H.resolve(h, players, t0 + R.QUESTION_MS + R.ANSWER_MS);
    res.boards.forEach((b) => {
      const size = H.boardOf(h, b.id).seats.length;
      const pts = b.rows.filter((x) => x.ok).map((x) => x.pts).sort((x, y) => y - x);
      eq(pts, R.POINTS.slice(0, size).slice(0, pts.length), `sim ${sim} round ${r} board ${b.id}: right looks get the table in speed order`);
      ok(b.rows.every((x) => (x.ok ? x.pts >= 1 : x.pts === 0)), `sim ${sim}: right ≥ +1, wrong / none = 0`);
      given += b.rows.reduce((a, x) => a + x.pts, 0);
    });
    ok(h.boards.every((b) => b.seats.length <= R.BOARD_MAX), `sim ${sim}: no board over 5`);
  }
  const fin = H.finish(h, players);
  eq(fin.all.reduce((a, x) => a + x.score, 0), given, `sim ${sim}: the class ranking sums every point given`);
  eq(fin.boards.length, h.boards.length, `sim ${sim}: every board has a result`);
  fin.boards.forEach((b) => ok(b.rows[0].score === 0 ? b.winners.length === 0 : b.winners.length >= 1 && b.winners.every((w) => w.score === b.rows[0].score),
    `sim ${sim}: each board with points has a winner with the top score (none at 0)`));
}

console.log(`test-halcon: ${checks} checks OK`);
