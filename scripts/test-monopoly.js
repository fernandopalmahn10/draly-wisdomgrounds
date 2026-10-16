#!/usr/bin/env node
// Dàfùwēng · Monopolio v2 — the rules (core/monopoly.js + the board data public/js/monopoly-map.js), no server:
//   node scripts/test-monopoly.js
// The board · the deal (boards of 4, late joiners, colours) · answers (dice windows, double dice, waits, too fast, time
// up) · every space (Salida, the star, blue, red, landmarks: buy / broke / toll / level, «¡Suerte!»: chest / gold / swap /
// duel / advance 3, the storm) · each turn's length = the shared clock · the frenzy ×2 · the comeback capped at the gap ·
// leads (hysteresis, alarm gap) · pause / +30 s · the end (bonus stars, ties, ranks, winners, podium) · 300 simulated
// classes (invariants) and kinds of kids (a thinker beats a fast guesser; a masher gets nothing).
'use strict';
const assert = require('assert');
const Mono = require('../core/monopoly');
const MAP = require('../public/js/monopoly-map');
const Halcon = require('../core/halcon');
const Sim = require('./sim-monopoly');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };
const R = Mono.R;
const T0 = 1000000;

// ---------- the board ----------
eq(MAP.N, 24, '24 spaces');
eq(MAP.SPACES[0].t, 'start', 'Salida first');
eq(MAP.SPACES.filter((s) => s.t === 'land').map((s) => s.lm).sort(), [0, 1, 2, 3, 4], 'each landmark once');
eq(MAP.SPACES.filter((s) => s.t === 'lucky').length, 3, 'three «¡Suerte!»');
eq(MAP.SPACES.filter((s) => s.t === 'storm').length, 1, 'one storm');
eq(MAP.SPACES[MAP.STAR_START].t, 'blue', 'the first star sits on a blue space');
MAP.SPACES.forEach((s, i) => { if (s.t === 'lucky') eq(MAP.SPACES[(i + 3) % 24].t, 'blue', '«¡Avanza 3!» lands on blue from ' + i); });
MAP.POS.forEach((p, i) => {
  const q = MAP.POS[(i + 1) % 24];
  const d = Math.hypot(q.x - p.x, q.y - p.y);
  ok(d > 95 && d < 135, 'even spacing ' + i + ': ' + d);
  ok(p.x > 100 && p.x < MAP.W - 100 && p.y > 100 && p.y < MAP.H - 100, 'inside the board ' + i);
});
MAP.LANDMARKS.forEach((l) => ok(l.price >= 6 && l.price <= 10 && l.toll >= 2 && l.toll <= 4, 'prices ' + l.id));
eq(MAP.ahead(22, 1), 3, 'ahead wraps');

// ---------- the deal ----------
for (let n = 1; n <= 40; n++) {
  const m = Mono.newGame(n, 240, T0);
  Mono.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo']));
  const sizes = m.boards.map((b) => b.seats.length);
  eq(sizes.reduce((a, b) => a + b, 0), n, 'everybody seated ' + n);
  if (n <= 5) eq(m.boards.length, 1, 'one board up to 5: ' + n);
  else sizes.forEach((s) => ok(s >= 3 && s <= 4, `boards of 3-4 for ${n}: ${sizes}`));
  m.boards.forEach((b) => {
    const cs = Mono.seatsOf(m, b).map((r) => r.c);
    eq(new Set(cs).size, cs.length, 'one colour per seat');
    cs.forEach((c) => ok(c >= 0 && c < 5, 'colour 0-4'));
    Mono.seatsOf(m, b).forEach((r) => { eq(r.pos, 0, 'start at Salida'); eq(r.coins, R.START_COINS, 'start coins'); eq(r.stars, 0, 'no stars'); });
  });
}
{
  const m = Mono.newGame(7, 240, T0);
  Mono.deal(m, Array.from({ length: 8 }, (_, i) => [i + 1, 'K' + i, 'dralingo']));
  eq(m.boards.map((b) => b.seats.length), [4, 4], '8 = two boards of 4');
  const b = Mono.seatLate(m, 9, 'Late', 'camel');
  ok(b && b.seats.length === 5, 'a late joiner sits at the smallest board (max 5)');
  eq(Mono.kid(m, 9).c, 4, 'the 5th seat is purple');
  eq(Mono.seatLate(m, 9, 'Late', 'camel'), null, 'a seated kid keeps the seat');
  Mono.seatLate(m, 10, 'L2', 'oryx');
  eq(m.boards.map((x) => x.seats.length).sort(), [5, 5], 'the other board fills');
  const nb = Mono.seatLate(m, 11, 'L3', 'plane');
  eq(m.boards.length, 3, 'all full: a new board');
  eq(nb.seats.length, 1, '(alone until somebody else comes)');
}

// a small game helper: n kids, one board, in play
function game(n, seed) {
  const m = Mono.newGame(seed || 1, 240, T0);
  Mono.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + (i + 1), 'dralingo']));
  Mono.startPlay(m, T0 + R.INTRO_MS);
  return m;
}
// a scripted rng: the next values come from the list (then the real one)
function script(m, vals) { const real = m.rng; const q = vals.slice(); m.rng = () => (q.length ? q.shift() : real()); }
const dieVal = (n) => (n - 1) / 6 + 0.01;          // rng value that rolls n
const right = (m, k, now) => Mono.answer(m, k, true, 3000, now || T0 + 5000);

// ---------- answers ----------
{
  const m = game(4);
  const r1 = right(m, 1);
  ok(r1.right && r1.turn.tid > 0 && r1.turn.dice === 1, 'a right answer opens one die');
  eq(r1.turn.lead, R.LEAD_MS, 'lead');
  eq(r1.turn.ms, R.DICE_MS, 'dice window');
  ok(Mono.kid(m, 1).turn, 'the window is open');
  Mono.roll(m, 1, T0 + 6000);
  right(m, 1); Mono.roll(m, 1, T0 + 7000);
  const r3 = right(m, 1);
  eq(r3.turn.dice, 2, 'every 3rd right in a row: two dice');
  eq(r3.streak, 3, 'streak 3');
  const t = Mono.roll(m, 1, T0 + 8000).script;
  eq(t.dice.length, 2, 'two dice rolled');
  const w1 = Mono.answer(m, 1, false, 3000, T0 + 9000);
  ok(!w1.right && w1.wait === R.WRONG_MS && !w1.calm, 'wrong: the short wait');
  eq(Mono.kid(m, 1).streak, 0, 'the streak resets');
  eq(Mono.kid(m, 1).nextQAt, T0 + 9000 + R.WRONG_MS, 'the next question after the wait');
  const w2 = Mono.answer(m, 1, false, 3000, T0 + 12000);
  ok(w2.calm && w2.wait === R.WRONG2_MS, 'two wrong in a row: «¡Respira!»');
  const f = Mono.answer(m, 2, true, R.FAST_MS - 1, T0 + 5000);
  ok(!f.right && f.tooFast, 'right but too fast = wrong');
  eq(Mono.kid(m, 2).turn, null, 'no dice for a too-fast tap');
  const tu = Mono.answer(m, 3, false, 23000, T0 + 30000, true);
  ok(!tu.right && tu.timeUp && !tu.tooFast, 'time up');
  const ok600 = Mono.answer(m, 4, true, R.FAST_MS, T0 + 5000);
  ok(ok600.right, 'exactly the line is fine');
  eq(Mono.kid(m, 4).fast, R.FAST_MS, 'fastest right answer recorded');
  eq(Mono.rollAt(Mono.kid(m, 4)), T0 + 5000 + R.LEAD_MS + R.DICE_MS + R.DICE_GRACE_MS, 'the server rolls by itself after the window');
  eq(Mono.roll(m, 3, T0), null, 'no window, no roll');
}

// ---------- the spaces ----------
function turnWith(m, k, dice, extra) { Mono.kid(m, k).streak = 0; right(m, k, T0 + 5000);   // (streak 0: one die)
  script(m, dice.map(dieVal).concat(extra || [])); return Mono.roll(m, k, T0 + 6000).script; }
{ // blue, red, the path, the clock
  const m = game(2);
  const s = turnWith(m, 1, [1]);
  eq(s.path, [1], 'one step');
  eq(s.ev.map((e) => e.type), ['blue'], 'blue');
  eq(Mono.kid(m, 1).coins, R.START_COINS + R.BLUE, '+3');
  eq(s.ms, MAP.scriptMs(s), 'the turn lasts what the shared clock says');
  eq(Mono.kid(m, 1).nextQAt, T0 + 6000 + s.ms, 'the next question when the turn has played');
  Mono.kid(m, 1).pos = 5;
  const s2 = turnWith(m, 1, [1]);
  eq(s2.ev[0].type, 'red', 'red');
  eq(Mono.kid(m, 1).coins, R.START_COINS + R.BLUE - R.RED, '−3');
  Mono.kid(m, 1).coins = 1; Mono.kid(m, 1).pos = 5;
  const s3 = turnWith(m, 1, [1]);
  eq(s3.ev[0].coins, -1, 'never below 0');
  eq(Mono.kid(m, 1).coins, 0, '0');
  ok(s3.ev[0].s[1][1] === 0, 'the moment carries my numbers');
}
{ // Salida, passing and landing
  const m = game(2);
  Mono.kid(m, 1).pos = 22;
  const s = turnWith(m, 1, [3]);
  eq(s.path, [23, 0, 1], 'wraps');
  eq(s.ev.map((e) => e.type), ['pass', 'blue'], 'Salida while passing, then the landing');
  eq(s.ev[0].at, 2, 'Salida at its step');
  eq(Mono.kid(m, 1).coins, R.START_COINS + R.PASS + R.BLUE, '+4 +3');
  eq(Mono.kid(m, 1).laps, 1, 'a lap');
  Mono.kid(m, 2).pos = 23;
  const s2 = turnWith(m, 2, [1]);
  eq(s2.ev.map((e) => e.type), ['pass'], 'landing on Salida = its +4 only');
}
{ // the star: buy it passing, can't afford, landing
  const m = game(2);
  const b = m.boards[0];
  eq(b.star, MAP.STAR_START, 'the first star');
  Mono.kid(m, 1).pos = 7; Mono.kid(m, 1).coins = 12;
  const s = turnWith(m, 1, [4], [0.4]);          // 8, 9 (the star), 10 (the storm, only passing), 11 (blue)
  eq(s.ev[0].type, 'star', 'passing the star with 10 coins buys it');
  eq(Mono.kid(m, 1).stars, 1, 'a star');
  ok(b.star !== MAP.STAR_START && MAP.SPACES[b.star].t === 'blue', 'the star moved to a blue space');
  ok(Math.min(MAP.ahead(9, b.star), MAP.ahead(b.star, 9)) >= 5, 'at least 5 spaces away');
  eq(s.ev[0].to, b.star, 'the moment says where it went');
  eq(Mono.kid(m, 1).coins, 12 - R.STAR_PRICE + R.BLUE, '−10, then the landing +3');
  const at = b.star;
  Mono.kid(m, 2).pos = (at - 2 + 24) % 24; Mono.kid(m, 2).coins = 4;
  const s2 = turnWith(m, 2, [2]);
  eq(s2.ev.map((e) => e.type), ['nostar', 'blue'], 'landing on the star without the coins: «te faltan» and its blue +3');
  eq(s2.ev[0].need, R.STAR_PRICE - 4, 'how many are missing');
  eq(b.star, at, 'the star stays');
  Mono.kid(m, 2).pos = (at - 1 + 24) % 24; Mono.kid(m, 2).coins = 10;
  const s3 = turnWith(m, 2, [1], [0.7]);
  eq(s3.ev.map((e) => e.type), ['star'], 'landing on the star with the coins: the star is the landing');
  eq(Mono.kid(m, 2).coins, 0, 'paid, no blue');
}
{ // landmarks: buy, broke, toll, level, max
  const m = game(3);
  const b = m.boards[0];
  Mono.kid(m, 1).pos = 2; Mono.kid(m, 1).coins = 6;
  const s = turnWith(m, 1, [1]);
  eq(s.ev[0].type, 'buy', 'buy the Museo del Futuro');
  eq(b.owners[0], { k: 1, lvl: 1 }, 'mine at level 1');
  eq(Mono.kid(m, 1).coins, 0, 'paid its price');
  Mono.kid(m, 2).pos = 7; Mono.kid(m, 2).coins = 3;
  const s2 = turnWith(m, 2, [1]);
  eq(s2.ev[0].type, 'broke', 'not enough for the Marco de Dubái');
  eq(s2.ev[0].need, 4, 'missing 4');
  ok(!b.owners[1], 'still free');
  Mono.kid(m, 2).pos = 2; Mono.kid(m, 2).coins = 20;
  const s3 = turnWith(m, 2, [1]);
  eq(s3.ev[0].type, 'toll', 'a rival pays the toll');
  eq(s3.ev[0].to, 1, 'to the owner');
  eq(s3.ev[0].coins, MAP.LANDMARKS[0].toll, 'its toll');
  eq(Mono.kid(m, 2).coins, 20 - MAP.LANDMARKS[0].toll, 'the payer');
  eq(Mono.kid(m, 1).coins, MAP.LANDMARKS[0].toll, 'the owner gets it');
  eq(Mono.kid(m, 1).tolls, MAP.LANDMARKS[0].toll, 'counted for the owner');
  ok(s3.ev[0].s[1] && s3.ev[0].s[2], 'the moment carries both numbers');
  eq(s3.seats.map((x) => x.k).sort(), [1, 2], 'both seats in the move');
  Mono.kid(m, 1).pos = 2;
  const s4 = turnWith(m, 1, [1]);
  eq(s4.ev[0].type, 'level', 'my own: level up');
  eq(b.owners[0].lvl, 2, 'level 2');
  Mono.kid(m, 1).pos = 2; turnWith(m, 1, [1]);
  Mono.kid(m, 1).pos = 2;
  const s5 = turnWith(m, 1, [1]);
  ok(s5.ev[0].max && b.owners[0].lvl === R.LEVEL_MAX, 'max level 3');
  Mono.kid(m, 3).pos = 2; Mono.kid(m, 3).coins = 4;
  const s6 = turnWith(m, 3, [1]);
  eq(s6.ev[0].coins, 4, 'the toll never takes more than you have (level 3: 6)');
  eq(Mono.kid(m, 3).coins, 0, '0');
}
{ // «¡Suerte!»: every outcome
  const pick = (id) => { let x = 0; for (const [o, w] of R.LUCKY) { if (o === id) return (x + w / 2) / R.LUCKY.reduce((a, b) => a + b[1], 0); x += w; } return 0; };
  const m = game(3);
  Mono.kid(m, 1).pos = 3; Mono.kid(m, 1).coins = 0;
  let s = turnWith(m, 1, [1], [pick('chest')]);
  eq([s.ev[0].type, s.ev[0].out, s.ev[0].coins], ['lucky', 'chest', R.CHEST], 'a chest');
  Mono.kid(m, 1).pos = 3;
  s = turnWith(m, 1, [1], [pick('gold')]);
  eq([s.ev[0].out, s.ev[0].coins], ['gold', R.CHEST_GOLD], 'a golden chest');
  const F = Mono.seatsOf(m, m.boards[0]).filter((x) => x.k !== 1)[0].k;   // the rival the scripted 0.01 picks (seats are shuffled)
  Mono.kid(m, 1).pos = 3; Mono.kid(m, F).pos = 17;
  s = turnWith(m, 1, [1], [pick('swap'), 0.01]);
  eq(s.ev[0].out, 'swap', 'swap');
  eq([Mono.kid(m, 1).pos, Mono.kid(m, F).pos], [17, 4], 'places swapped with a rival');
  eq([s.ev[0].from, s.ev[0].to, s.ev[0].with], [4, 17, F], 'the moment says who and where');
  eq(s.pos, 17, 'my final place');
  Mono.kid(m, 1).pos = 3; Mono.kid(m, 1).coins = 5; Mono.kid(m, F).coins = 9;
  s = turnWith(m, 1, [1], [pick('duel'), 0.01, dieVal(6), dieVal(2)]);
  eq([s.ev[0].out, s.ev[0].a, s.ev[0].b, s.ev[0].coins], ['duel', 6, 2, R.DUEL], 'a duel won');
  eq([Mono.kid(m, 1).coins, Mono.kid(m, F).coins], [5 + R.DUEL, 9 - R.DUEL], 'coins moved');
  Mono.kid(m, 1).pos = 3;
  s = turnWith(m, 1, [1], [pick('duel'), 0.01, dieVal(1), dieVal(5)]);
  eq(s.ev[0].coins, -R.DUEL, 'a duel lost');
  Mono.kid(m, 1).pos = 3;
  s = turnWith(m, 1, [1], [pick('duel'), 0.01, dieVal(3), dieVal(3)]);
  eq(s.ev[0].coins, 0, 'a tie: nothing');
  Mono.kid(m, 1).pos = 3; Mono.kid(m, 1).coins = 0;
  s = turnWith(m, 1, [1], [pick('ahead')]);
  eq(s.ev.map((e) => e.type + (e.out ? ':' + e.out : '')), ['lucky:ahead', 'blue'], 'advance 3, then that blue');
  eq(s.path, [4, 5, 6, 7], 'the three extra steps are on the path');
  eq(s.ms, MAP.scriptMs(s), 'clock with «¡Avanza 3!»');
  const solo = game(1);
  Mono.kid(solo, 1).pos = 3;
  for (let i = 0; i < 40; i++) {
    Mono.kid(solo, 1).pos = 3;
    const x = turnWith(solo, 1, [1]);
    ok(['chest', 'gold', 'ahead'].includes(x.ev[0].out), 'alone on a board: no swap, no duel');
  }
}
{ // the storm
  const m = game(3);
  const b = m.boards[0];
  Mono.kid(m, 1).pos = 9; Mono.kid(m, 2).coins = 1; Mono.kid(m, 3).coins = 9;
  const star0 = b.star;
  const s = turnWith(m, 1, [1], [0.3]);
  eq(s.ev[0].type, 'storm', 'the storm');
  eq(s.ev[0].lost, { 1: R.STORM, 2: 1, 3: R.STORM }, 'everybody drops up to 2');
  ok(b.star !== star0 && s.ev[0].from === star0 && s.ev[0].to === b.star, 'the star flies');
  eq(Object.keys(s.ev[0].s).length, 3, 'every seat in the moment');
}

// ---------- the frenzy and the comeback ----------
{
  const m = game(2);
  const ev = Mono.tick(m, m.frenzyAt - 1);
  ok(!ev.frenzy && !m.frenzy, 'not yet');
  ok(Mono.tick(m, m.frenzyAt).frenzy && m.frenzy, 'the last 30 s');
  eq(m.endsAt - m.frenzyAt, R.FRENZY_MS, '30 s');
  Mono.kid(m, 1).pos = 0; Mono.kid(m, 1).coins = 20; Mono.kid(m, 2).coins = 20;
  let s = turnWith(m, 1, [1]);
  eq(s.ev[0].coins, R.BLUE * 2, 'blue ×2');
  Mono.kid(m, 1).pos = 5;
  s = turnWith(m, 1, [1]);
  eq(s.ev[0].coins, -R.RED * 2, 'red ×2');
  eq(Mono.frenzyMs(30), 10000, 'a very short game: the last third');
}
{
  const m = game(3);
  const [a, b, c] = [1, 2, 3].map((k) => Mono.kid(m, k));
  a.stars = 2; a.coins = 5;                       // value 25
  b.coins = 20;                                   // value 20
  c.coins = 2;                                    // value 2: last, 23 behind
  c.pos = 0;
  let s = turnWith(m, 3, [1]);
  eq(s.ev[0].coins, R.BLUE * 2, 'the last kid: lucky blue (+3 +3)');
  ok(s.ev[0].lucky, 'marked lucky');
  eq(c.luck, R.BLUE, 'the lucky extra counted');
  c.coins = 22; c.pos = 0;                        // value 22: 3 behind the leader, < BEHIND → no luck
  s = turnWith(m, 3, [1]);
  ok(!s.ev[0].lucky && s.ev[0].coins === R.BLUE, 'close to the leader: no luck');
  c.coins = 15; b.coins = 30; c.pos = 0;          // c last (15), leader a = 25 (gap 10 ≥ 8)
  s = turnWith(m, 3, [1]);
  eq(s.ev[0].coins, R.BLUE * 2, 'gap 10: the full extra fits');
  for (let i = 0; i < 400; i++) {                 // never past the leader by luck
    const g = game(3, 100 + i);
    const ks = [1, 2, 3].map((k) => Mono.kid(g, k));
    ks.forEach((r) => { r.coins = Math.floor(Math.random() * 30); r.stars = Math.floor(Math.random() * 3); });
    const low = ks.slice().sort((x, y) => Mono.value(x) - Mono.value(y))[0];
    const top = Math.max(...ks.map(Mono.value));
    const before = Mono.value(low);
    const res = Mono.gain(g, g.boards[0], low, 3 + Math.floor(Math.random() * 8));
    if (res.lucky) ok(Mono.value(low) <= top, 'the lucky extra is capped at the gap');
    ok(Mono.value(low) - before >= 3, 'the base gain always comes');
  }
}

// ---------- leads ----------
{
  const m = game(3);
  const [a, b] = [Mono.kid(m, 1), Mono.kid(m, 2)];
  a.coins = 6; b.coins = 5; Mono.kid(m, 3).coins = 5;
  eq(Mono.tick(m, T0 + 10000).leads, [], 'one coin ahead is no lead');
  a.coins = 9;
  eq(Mono.tick(m, T0 + 11000).leads, [{ b: 1, k: 1, first: true }], 'the first leader');
  b.coins = 10;
  eq(Mono.tick(m, T0 + 20000).leads, [], 'one coin more is not enough to take the lead');
  b.coins = 12;
  eq(Mono.tick(m, T0 + 21000).leads, [{ b: 1, k: 2, first: false }], '3 coins more: a new leader');
  a.stars = 1;
  eq(Mono.tick(m, T0 + 22000).leads, [], 'alarms at least 6 s apart');
  eq(Mono.tick(m, T0 + 27000).leads, [{ b: 1, k: 1, first: false }], 'a star more takes the lead back');
  Mono.final(m, T0 + 30000);
  eq(Mono.tick(m, T0 + 31000).leads, [], 'no alarms after «¡FINAL!»');
}

// ---------- pause, +30 s, final ----------
{
  const m = game(2);
  right(m, 1, T0 + 5000);
  Mono.kid(m, 2).nextQAt = T0 + 7000;
  const ends = m.endsAt, fz = m.frenzyAt, sent = Mono.kid(m, 1).turn.sentAt;
  Mono.shiftTimes(m, 4000);
  eq([m.endsAt, m.frenzyAt, Mono.kid(m, 1).turn.sentAt, Mono.kid(m, 2).nextQAt], [ends + 4000, fz + 4000, sent + 4000, T0 + 11000], 'a pause moves every clock');
  ok(Mono.addTime(m, 30000) && m.endsAt === ends + 34000, '+30 s');
  eq(m.endsAt - m.frenzyAt, R.FRENZY_MS, 'the frenzy moves with the end');
  m.frenzy = true;
  const fz2 = m.frenzyAt;
  Mono.addTime(m, 30000);
  eq(m.frenzyAt, fz2, 'already in the frenzy: it keeps its start (more double time)');
  Mono.final(m, T0 + 50000);
  eq(m.phase, 'final', '«¡FINAL!»');
  ok(!Mono.addTime(m, 30000), 'no +30 s after the end');
  ok(Mono.roll(m, 1, T0 + 50100), 'a window still open rolls in «¡FINAL!»');
}

// ---------- the end ----------
{
  const m = game(4);
  const [a, b, c, d] = [1, 2, 3, 4].map((k) => Mono.kid(m, k));
  a.stars = 2; a.coins = 3; a.right = 9; a.best = 5;
  b.stars = 2; b.coins = 8; b.right = 9; b.best = 2;
  c.stars = 1; c.coins = 30; c.right = 4; c.best = 3;
  d.stars = 0; d.coins = 0; d.right = 0;
  m.boards[0].owners = { 0: { k: 3, lvl: 1 }, 1: { k: 3, lvl: 2 }, 2: { k: 2, lvl: 1 } };
  const fin = Mono.finish(m);
  const bd = fin.boards[0];
  eq(bd.bonus.map((s) => s.id), ['sabia', 'magnate', 'racha'], 'three bonus stars');
  eq(bd.bonus[0].winners.sort(), [1, 2], 'Sabia: a tie shares it');
  eq(bd.bonus[1].winners, [3], 'Magnate: the most landmarks');
  eq(bd.bonus[2].winners, [1], 'Racha: the longest (≥ 3)');
  const row = (k) => bd.rows.find((x) => x.k === k);
  eq([row(1).total, row(2).total, row(3).total, row(4).total], [4, 3, 2, 0], 'totals = stars + bonus stars');
  eq(bd.rows.map((x) => x.k), [1, 2, 3, 4], 'ranked by total, then coins');
  eq([row(1).rank, row(4).rank, row(4).of], [1, 4, 4], 'ranks');
  eq(bd.winners, [1], 'the winner (the bonus stars changed it: B had more coins)');
  eq(row(3).lands, 2, 'landmarks counted');
  ok(fin.podium[0].k === 1 && fin.podium.length >= 3, 'the class podium');
  const m2 = game(2);
  Mono.kid(m2, 1).coins = 5; Mono.kid(m2, 2).coins = 5;
  const f2 = Mono.finish(m2);
  eq(f2.boards[0].winners.sort(), [1, 2], 'a full tie: both win');
  eq(f2.boards[0].bonus.length, 0, 'nobody eligible: no bonus stars');
  const m3 = game(2);
  Mono.kid(m3, 1).coins = 0; Mono.kid(m3, 2).coins = 0;
  eq(Mono.finish(m3).boards[0].winners, [], 'all at zero: no winner');
  eq(Mono.finish(m3).podium, [], 'and no podium');
}

// ---------- 300 simulated classes ----------
{
  const kinds = ['thinker', 'thinker', 'slow', 'guesser', 'masher', 'thinker', 'idle', 'thinker', 'notap', 'slow', 'thinker', 'thinker', 'guesser'];
  const by = {};
  let turns = 0, autos = 0, stars = 0, games = 0, maxMs = 0;
  for (let s = 1; s <= 300; s++) {
    const n = 4 + (s % 27);
    const ks = Array.from({ length: n }, (_, i) => kinds[(i + s) % kinds.length]);
    const r = Sim.game(s, ks, [180, 240, 300][s % 3]);
    games++;
    turns += r.stats.turns; autos += r.stats.autos; maxMs = Math.max(maxMs, r.stats.maxMs);
    r.m.boards.forEach((b) => ok(b.seats.length >= 1 && b.seats.length <= 5, 'board size'));
    r.kids.forEach((x) => {
      ok(x.rec.coins >= 0, 'coins never below 0');
      ok(x.rec.pos >= 0 && x.rec.pos < 24, 'on the board');
      stars += x.rec.stars;
      const row = r.fin.rows.find((y) => y.k === x.k);
      eq(row.total, x.rec.stars + row.bonus.length, 'total = stars + bonus');
      (by[x.kind] = by[x.kind] || { n: 0, total: 0, right: 0 });
      by[x.kind].n++; by[x.kind].total += row.total; by[x.kind].right += x.rec.right;
      if (x.kind === 'masher') { eq(x.rec.right, 0, 'a masher (too fast) never gets a right answer'); eq(x.rec.stars, 0, 'nor a star bought'); }
      if (x.kind === 'idle') { eq(x.rec.right, 0, 'idle'); ok(x.rec.timeUps > 0, 'idle: time-ups'); }
    });
    r.fin.boards.forEach((b) => b.winners.forEach((k) => ok(b.rows.find((x) => x.k === k).rank === 1, 'winners are first')));
  }
  const avg = (k) => by[k].total / by[k].n;
  ok(avg('thinker') > 2 * avg('guesser'), `a thinker gets more than twice a fast guesser (${avg('thinker').toFixed(2)} vs ${avg('guesser').toFixed(2)})`);
  ok(avg('slow') > avg('guesser'), `a slow thinker beats a fast guesser (${avg('slow').toFixed(2)} vs ${avg('guesser').toFixed(2)})`);
  eq(avg('masher'), 0, 'a masher ends with nothing');
  ok(maxMs < 16000, 'the longest turn stays under 16 s: ' + maxMs);
  ok(autos > 0, 'dice windows that rolled by themselves happened');
  ok(avg('notap') <= avg('thinker') * 1.1, `rolling by itself never earns more than tapping (${avg('notap').toFixed(2)} vs ${avg('thinker').toFixed(2)})`);
  console.log(`  simulated ${games} classes · ${turns} turns (${autos} rolled by themselves) · ${stars} stars bought · longest turn ${maxMs} ms`);
  console.log('  stars per kid (with bonus): ' + Object.entries(by).map(([k, v]) => `${k} ${(v.total / v.n).toFixed(2)}`).join(' · '));
}

console.log(`test-monopoly: ${checks} checks passed`);
