#!/usr/bin/env node
// Vuelo del Dragón v2 — the rules (core/dragon.js + the course public/js/dragon-course.js), no server:
//   node scripts/test-dragon.js
// The course · the deal (races of 4, late joiners level with their race, colours) · answers (flights, «¡Fuego azul!»
// tiers, waits, too fast, time up) · wing beats (the cap per second, batches, the window's clock, a wrong flight id,
// pause, «¡FINAL!») · the frenzy ×2 · golden rings and the tailwind, both capped at the gap · the star sprints (when,
// who wins, ties, nobody, pause, «+30 s», «¡FINAL!») · leads (hysteresis, alarm gap) · the live line's flags · the end
// (bonus stars, ties, ranks, winners, podium) · 300 simulated classes (invariants) and kinds of kids (a thinker beats a
// fast guesser; a masher and an idle kid fly nothing; effort in the flight counts).
'use strict';
const assert = require('assert');
const Dragon = require('../core/dragon');
const C = require('../public/js/dragon-course');
const Sim = require('./sim-dragon');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };
const near = (a, b, m) => { checks++; assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} vs ${b}`); };
const R = Dragon.R;
const T0 = 1000000;

// ---------- the course ----------
eq(C.LAP, 1500, 'a lap is 1,500 m');
eq(C.LANDMARKS.map((l) => l.id), ['frame', 'museum', 'burj', 'arab', 'atlantis'], 'five landmarks in course order');
C.LANDMARKS.forEach((l, i) => eq(l.at, 250 * (i + 1), 'a landmark every 250 m: ' + l.id));
eq(new Set(C.SPRINTS).size, 5, 'every landmark hosts a sprint');
C.SPRINTS.forEach((id) => ok(C.lm(id), 'a sprint landmark exists: ' + id));
eq(C.sprintLm(1), 'burj', 'the first sprint is the Burj Khalifa');
eq(C.sprintLm(6), C.sprintLm(1), 'the sprints go round');
eq(C.next(0), { id: 'frame', name: 'Marco de Dubái', in: 250 }, 'next landmark from the start');
eq(C.next(1300).id, 'creek', 'after Atlantis comes the Creek (a new lap)');
eq(C.next(1500 + 600).id, 'burj', 'next landmark on lap 2');
eq(C.lap(0), 1, 'lap 1'); eq(C.lap(1500), 2, 'lap 2 at 1,500 m');
near(C.relX(0, 170), 0, 'a rival level with me sits on me');
ok(Math.abs(C.relX(5, 170) - 5 * C.PX) < 0.5, 'true distance up close');
ok(C.relX(300, 170) < 170 && C.relX(300, 170) > 160, 'far ahead: at the edge, still in view');
ok(C.relX(-300, 170) > -170, 'far behind: at the other edge');
for (let d = -500; d < 500; d += 10) ok(C.relX(d + 10, 170) > C.relX(d, 170), 'relX grows with the distance ' + d);
eq(C.COLORS.length, 5, 'five seat colours');

// ---------- the deal ----------
for (let n = 1; n <= 40; n++) {
  const m = Dragon.newGame(n, 240, T0);
  Dragon.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + i, 'dralingo']));
  const sizes = m.races.map((b) => b.seats.length);
  eq(sizes.reduce((a, b) => a + b, 0), n, 'everybody flies ' + n);
  if (n <= 5) eq(m.races.length, 1, 'one race up to 5: ' + n);
  else sizes.forEach((s) => ok(s >= 3 && s <= 4, `races of 3-4 for ${n}: ${sizes}`));
  m.races.forEach((b) => {
    const cs = Dragon.seatsOf(m, b).map((r) => r.c);
    eq(new Set(cs).size, cs.length, 'one colour per seat');
    cs.forEach((c) => ok(c >= 0 && c < 5, 'colour 0-4'));
    Dragon.seatsOf(m, b).forEach((r) => { eq(r.m, 0, 'start at 0 m'); eq(r.stars, 0, 'no stars'); });
  });
}
function game(n, seed, secs) {
  const m = Dragon.newGame(seed || 1, secs || 240, T0);
  Dragon.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'K' + (i + 1), 'dralingo']));
  Dragon.startPlay(m, T0);
  return m;
}
{
  const m = game(8, 7);
  eq(m.races.map((b) => b.seats.length), [4, 4], '8 = two races of 4');
  m.kids[1].m = 900; m.kids[2].m = 400;
  const b0 = m.races.find((b) => b.seats.length === 4);
  Dragon.seatsOf(m, b0).forEach((r, i) => { r.m = 300 + 100 * i; });
  const b = Dragon.seatLate(m, 9, 'Late', 'camel');
  ok(b && b.seats.length === 5, 'a late joiner flies in the smallest race (max 5)');
  eq(Dragon.kid(m, 9).c, 4, 'the 5th seat is purple');
  eq(Dragon.kid(m, 9).m, Math.min(...Dragon.seatsOf(m, b).filter((r) => r.k !== 9).map((r) => r.m)), 'the late joiner starts level with the last dragon of its race');
  eq(Dragon.seatLate(m, 9, 'Late', 'camel'), null, 'a kid already flying keeps its seat');
  const b2 = Dragon.seatLate(m, 10, 'Late2', 'oryx');
  ok(b2 && b2 !== b && b2.seats.length === 5, 'the next late joiner: the other race');
  const b3 = Dragon.seatLate(m, 11, 'Late3', 'plane');
  ok(b3 && b3.seats.length === 1 && m.races.length === 3, 'every race full: a new race');
  eq(Dragon.kid(m, 11).m, 0, 'alone in a new race: from 0');
  const m2 = game(3, 9);
  m2.kids[1].m = 0; m2.kids[2].m = 650; m2.kids[3].m = 800;
  Dragon.setAway(m2, 1, true);
  Dragon.seatLate(m2, 4, 'Late', 'oryx');
  eq(Dragon.kid(m2, 4).m, 650, 'a kid who left at 0 m does not drag the late joiner back');
}

// ---------- answers ----------
{
  const m = game(4);
  const r = Dragon.kid(m, 1);
  let res = Dragon.answer(m, 1, true, 2000, T0 + 2000);
  ok(res.right && res.flight && res.flight.mid > 0, 'right → a flight');
  eq(res.flight.ms, R.FLAP_MS, 'a flight of 4 s');
  eq(res.flight.lead, R.LEAD_MS, '«¡Correcto!» first');
  eq(res.flight.power, 1, 'no fire on the first');
  eq(r.flap.start, T0 + 2000 + R.LEAD_MS, 'the flight opens after the lead');
  Dragon.closeFlap(m, 1, T0 + 8000);
  Dragon.answer(m, 1, true, 2000, T0 + 9000); Dragon.closeFlap(m, 1, T0 + 15000);
  res = Dragon.answer(m, 1, true, 2000, T0 + 16000);
  eq(res.streak, 3, 'streak 3');
  eq(res.flight.ms, R.FLAP_MS + R.STREAK_MS, '«¡Fuego azul!»: a longer flight');
  eq(res.flight.power, R.FIRE1, '…and ×1.5 a beat');
  ok(res.flight.fire, 'the fire flag');
  Dragon.closeFlap(m, 1, T0 + 22000);
  for (let i = 0; i < 3; i++) { Dragon.answer(m, 1, true, 2000, T0 + 23000 + i * 7000); Dragon.closeFlap(m, 1, T0 + 29000 + i * 7000); }
  eq(r.streak, 6, 'streak 6');
  eq(r.flights, 6, 'six flights');
  const res6 = Dragon.answer(m, 1, true, 2000, T0 + 60000);
  eq(res6.flight.power, R.FIRE2, '«¡Fuego azul ×2!» from 6 in a row');
  Dragon.closeFlap(m, 1, T0 + 66000);
  res = Dragon.answer(m, 1, false, 2000, T0 + 70000);
  ok(!res.right && res.wait === R.WRONG_MS && !res.calm, 'wrong → the wait');
  eq(r.streak, 0, 'the streak resets');
  eq(r.flap, null, 'no flight after a wrong answer');
  eq(r.nextQAt, T0 + 70000 + R.WRONG_MS, 'the next question after the wait');
  res = Dragon.answer(m, 1, false, 2000, T0 + 73000);
  ok(res.wait === R.WRONG2_MS && res.calm, 'two wrong in a row: «¡Respira!» (longer)');
  res = Dragon.answer(m, 1, true, 300, T0 + 80000);
  ok(!res.right && res.tooFast, 'right but under 600 ms: too fast = wrong');
  eq(r.tooFast, 1, 'too fast counted');
  res = Dragon.answer(m, 1, false, 23000, T0 + 110000, true);
  ok(res.timeUp && !res.right, 'time up = wrong');
  eq(r.timeUps, 1, 'time up counted');
  eq(r.best, 7, 'best streak kept');
  eq(r.fast, 2000, 'the fastest human answer');
  eq(Dragon.answer(m, 99, true, 2000, T0), null, 'an unknown kid');
}

// ---------- wing beats ----------
function flight(m, k, at, opts) {
  const r = Dragon.kid(m, k);
  r.streak = (opts && opts.streak) || 0;
  const res = Dragon.answer(m, k, true, 2000, at);
  if (opts && opts.ring != null) r.flap.ring = opts.ring;
  return { r, f: res.flight, x: r.flap };
}
{
  const m = game(4);
  const { r, f, x } = flight(m, 1, T0 + 1000, { ring: 0 });
  const s = x.start;
  eq(Dragon.beats(m, 1, f.mid, 3, s - 1), { credited: 0, metres: 0, ring: false }, 'nothing before the flight opens');
  let got = Dragon.beats(m, 1, f.mid, 8, s + 100);
  eq(got.credited, R.BURST, 'at the start only the burst');
  eq(got.metres, R.BURST * R.BEAT_M, 'six metres a beat');
  got = Dragon.beats(m, 1, f.mid, 8, s + 1000);
  eq(got.credited, R.RATE + R.BURST - R.BURST, 'one second in: RATE more');
  got = Dragon.beats(m, 1, f.mid, 50, s + 3000);
  eq(got.credited, R.MAX_BATCH, 'a batch claims at most MAX_BATCH');
  got = Dragon.beats(m, 1, f.mid, 50, s + 3990);
  eq(x.beats, Math.floor(R.RATE * 3.99) + R.BURST, 'never more than RATE a second + the burst');
  eq(Dragon.beats(m, 1, f.mid + 1, 3, s + 3995).credited, 0, 'another flight id: nothing');
  eq(Dragon.beats(m, 1, f.mid, 3, x.until + R.GRACE_MS + 1).credited, 0, 'after the grace: nothing');
  eq(Dragon.beats(m, 1, f.mid, -5, s + 3999).credited, 0, 'a negative count: nothing');
  eq(Dragon.beats(m, 1, f.mid, 'x', s + 3999).credited, 0, 'garbage: nothing');
  near(r.m, x.beats * R.BEAT_M, 'my metres = beats × 6');
  const sum = Dragon.closeFlap(m, 1, x.until + R.GRACE_MS);
  eq(sum.beats, x.beats, 'the summary counts the beats');
  eq(sum.m, Math.round(r.m), 'the summary carries my metres');
  eq(r.nextQAt, x.until + R.GRACE_MS + R.NEXT_MS, 'the next question right after');
  eq(Dragon.closeFlap(m, 1, x.until + 2000), null, 'closed once');
  eq(Dragon.beats(m, 1, f.mid, 3, x.until).credited, 0, 'a closed flight takes nothing');
  eq(Dragon.closeAt({ until: 5000 }), 5000 + R.GRACE_MS, 'closeAt = until + grace');
}
{
  // fire tiers, the frenzy, pause, «¡FINAL!»
  const m = game(4);
  const a = flight(m, 1, T0 + 1000, { streak: 5, ring: 0 });     // streak 6 → ×2
  eq(a.x.power, 2, 'power 2');
  Dragon.beats(m, 1, a.f.mid, 2, a.x.start + 10);
  near(a.r.m, 2 * R.BEAT_M * 2, '×2 a beat with fire ×2');
  const b = flight(m, 2, T0 + 1000, { streak: 2, ring: 0 });     // streak 3 → ×1.5
  Dragon.beats(m, 2, b.f.mid, 2, b.x.start + 10);
  near(b.r.m, 2 * R.BEAT_M * 1.5, '×1.5 a beat with fire');
  m.frenzy = true;
  const c = flight(m, 3, T0 + 1000, { ring: 0 });
  Dragon.beats(m, 3, c.f.mid, 2, c.x.start + 10);
  near(c.r.m, 2 * R.BEAT_M * 2, 'the frenzy: every metre ×2');
  m.frenzy = false;
  const d = flight(m, 4, T0 + 1000, { ring: 0 });
  m.paused = true;
  eq(Dragon.beats(m, 4, d.f.mid, 2, d.x.start + 10).credited, 0, 'paused: no beats');
  m.paused = false;
  // «Pausa»: the beats already on their way still count (≤ GRACE after the pause), up to the moment of the pause
  {
    const mp = game(2);
    const fp = flight(mp, 1, T0 + 1000, { ring: 0 });
    mp.paused = true; mp.pausedAt = fp.x.start + 1000;
    const inTransit = Dragon.beats(mp, 1, fp.f.mid, 8, mp.pausedAt + 300);
    eq(inTransit.credited, Math.floor(R.RATE * 1) + R.BURST, 'a batch in transit at the pause counts, capped at the pause');
    eq(Dragon.beats(mp, 1, fp.f.mid, 2, mp.pausedAt + R.GRACE_MS + 1).credited, 0, 'after the grace of the pause: nothing');
    const fq = flight(mp, 2, mp.pausedAt + 100, { ring: 0 });
    eq(Dragon.beats(mp, 2, fq.f.mid, 2, mp.pausedAt + 200).credited, 0, 'a flight that would open after the pause: nothing');
  }
  Dragon.shiftTimes(m, 5000);
  eq(d.x.start, T0 + 1000 + R.LEAD_MS + 5000, 'a pause moves the flight');
  Dragon.final(m, d.x.start + 1000);
  const got = Dragon.beats(m, 4, d.f.mid, 50, d.x.start + 1300);
  {
    const mf = game(2);
    const ff = flight(mf, 1, T0 + 1000, { ring: 0 });
    Dragon.final(mf, ff.x.start - 300);          // «¡FINAL!» during the lead
    eq(Dragon.beats(mf, 1, ff.f.mid, 3, ff.x.start + 10).credited, 0, 'a flight whose lead ran into «¡FINAL!» never opens');
  }
  ok(got.credited <= Math.floor(R.RATE * 1) + R.BURST, '«¡FINAL!» cuts the flight at the final moment');
  eq(Dragon.beats(m, 4, d.f.mid, 3, d.x.start + 1000 + R.GRACE_MS + 1).credited, 0, 'after «¡FINAL!» + grace: nothing');
}

// ---------- golden rings and the tailwind (capped at the gap) ----------
{
  const m = game(4);
  // a ring at beat 4 for a leader: the whole ring
  const a = flight(m, 1, T0 + 1000, { ring: 4 });
  const got = Dragon.beats(m, 1, a.f.mid, 3, a.x.start + 10);
  ok(!got.ring, 'not yet');
  const got2 = Dragon.beats(m, 1, a.f.mid, 1, a.x.start + 400);
  ok(got2.ring, 'the 4th beat goes through the ring');
  near(a.r.m, 4 * R.BEAT_M + R.RING_M, 'the ring: +30 m');
  eq(a.r.rings, 1, 'ring counted');
  // behind the leader: the ring never jumps the gap
  const m2 = game(4);
  m2.kids[1].m = 500; m2.kids[2].m = 10; m2.kids[3].m = 12; m2.kids[4].m = 30;
  const b = flight(m2, 4, T0 + 1000, { ring: 1 });
  // gap 470: the ring is whole
  Dragon.beats(m2, 4, b.f.mid, 1, b.x.start + 10);
  near(m2.kids[4].m, 30 + R.BEAT_M + R.RING_M, 'far behind: the whole ring');
  const m3 = game(4);
  m3.kids[1].m = 100; m3.kids[2].m = 0; m3.kids[3].m = 0; m3.kids[4].m = 90;
  const c = flight(m3, 4, T0 + 1000, { ring: 1 });
  Dragon.beats(m3, 4, c.f.mid, 1, c.x.start + 10);
  near(m3.kids[4].m, 100, 'just behind: the ring closes the gap, never jumps it');
  ok(m3.kids[4].m <= m3.kids[1].m, 'still not past the leader by the ring');
  // the tailwind
  const m4 = game(4);
  m4.kids[1].m = 400; m4.kids[2].m = 300; m4.kids[3].m = 200; m4.kids[4].m = 100;
  ok(Dragon.tailOn(m4, m4.kids[4]), 'the last, 300 m behind: tailwind');
  ok(!Dragon.tailOn(m4, m4.kids[3]), 'third place: no tailwind');
  ok(!Dragon.tailOn(m4, m4.kids[1]), 'the leader: no tailwind');
  const t = flight(m4, 4, T0 + 1000, { ring: 0 });
  ok(t.f.tail, 'the flight says tailwind');
  Dragon.beats(m4, 4, t.f.mid, 2, t.x.start + 10);
  near(m4.kids[4].m, 100 + 2 * R.BEAT_M * (1 + R.TAIL), '+50 % a beat');
  ok(m4.kids[4].tailM > 0, 'tailwind metres counted');
  const m5 = game(2);
  m5.kids[1].m = 70; m5.kids[2].m = 0;
  const u = flight(m5, 2, T0 + 1000, { ring: 0 });
  for (let i = 0; i < 9; i++) Dragon.beats(m5, 2, u.f.mid, 1, u.x.start + 10 + i * 300);
  ok(m5.kids[2].m <= 70 + R.BEAT_M + 1e-6, 'the tailwind extra never passes the leader by itself');
  ok(m5.kids[2].tailM < 9 * R.BEAT_M * R.TAIL, 'the extra stopped at the gap');
  // a kid who left doesn't hold the comeback rules
  const m6 = game(3);
  m6.kids[1].m = 500; m6.kids[2].m = 300; m6.kids[3].m = 0;
  ok(!Dragon.tailOn(m6, m6.kids[2]), 'second of three: no tailwind');
  Dragon.setAway(m6, 3, true);
  ok(Dragon.tailOn(m6, m6.kids[2]), 'the last one left: now it is the last flying');
  ok(!Dragon.tailOn(m6, m6.kids[3]), 'a kid who left gets nothing');
  Dragon.setAway(m6, 3, false);
  // alone in a race: no comeback, no Remontada
  const m7 = game(1);
  ok(!Dragon.tailOn(m7, m7.kids[1]), 'alone: no tailwind');
  const v = flight(m7, 1, T0 + 1000, { ring: 0 });
  Dragon.beats(m7, 1, v.f.mid, 3, v.x.start + 10);
  eq(m7.kids[1].lastM, 0, 'alone: no Remontada metres');
  // Remontada: only while last with someone ahead
  const m8 = game(3);
  const w = flight(m8, 1, T0 + 1000, { ring: 0 });
  Dragon.beats(m8, 1, w.f.mid, 1, w.x.start + 10);
  eq(m8.kids[1].lastM, 0, 'all level at 0: nobody is last yet');
  const w2 = flight(m8, 2, T0 + 1000, { ring: 0 });
  Dragon.beats(m8, 2, w2.f.mid, 1, w2.x.start + 10);
  eq(m8.kids[2].lastM, R.BEAT_M, 'tied for last place with somebody ahead: it counts');
  m8.kids[3].m = 50;
  const w3 = flight(m8, 1, T0 + 1000, { ring: 0 });
  Dragon.beats(m8, 1, w3.f.mid, 1, w3.x.start + 10);
  ok(m8.kids[1].lastM > 0 || m8.kids[2].lastM > 0, 'flying from last place counts for the Remontada');
}

// ---------- the star sprints ----------
{
  const m = game(8, 3);
  let ev = Dragon.tick(m, T0 + R.SPRINT_FIRST_MS - 1);
  eq(ev.sprintGo, null, 'no sprint before 20 s');
  ev = Dragon.tick(m, T0 + R.SPRINT_FIRST_MS);
  ok(ev.sprintGo && ev.sprintGo.n === 1 && ev.sprintGo.lm === 'burj', 'the first sprint at 20 s: the Burj Khalifa');
  eq(ev.sprintGo.ms, R.SPRINT_MS, 'a 12 s sprint');
  const [A, B2] = m.races;
  const a = Dragon.seatsOf(m, A), b = Dragon.seatsOf(m, B2);
  a[0].m = 900;                                            // the leader before the sprint…
  const fa = flight(m, a[1].k, T0 + 20000, { ring: 0 });
  Dragon.beats(m, a[1].k, fa.f.mid, 3, fa.x.start + 10);    // …the one who flies in the sprint wins it
  const fb1 = flight(m, b[0].k, T0 + 20000, { ring: 0 });
  const fb2 = flight(m, b[1].k, T0 + 20000, { ring: 0 });
  Dragon.beats(m, b[0].k, fb1.f.mid, 2, fb1.x.start + 10);
  Dragon.beats(m, b[1].k, fb2.f.mid, 2, fb2.x.start + 10);  // a tie
  const before = a[1].m;
  ev = Dragon.tick(m, T0 + R.SPRINT_FIRST_MS + R.SPRINT_MS);
  ok(ev.sprintEnd, 'the sprint ends after 12 s');
  const ra = ev.sprintEnd.races.find((x) => x.b === A.id), rb = ev.sprintEnd.races.find((x) => x.b === B2.id);
  eq(ra.w, [a[1].k], 'the most metres in the sprint wins (not the leader)');
  near(a[1].m, before + R.STAR_M, 'the star: +150 m');
  eq(a[1].stars, 1, 'a star');
  eq(a[0].stars, 0, 'the leader got none');
  eq(rb.w.sort(), [b[0].k, b[1].k].sort(), 'a tie shares the star');
  eq(rb.s[b[0].k], 12, 'sprint metres per kid');
  eq(m.sprint, null, 'the sprint is over');
  ev = Dragon.tick(m, T0 + R.SPRINT_FIRST_MS + R.SPRINT_EVERY_MS);
  ok(ev.sprintGo && ev.sprintGo.n === 2 && ev.sprintGo.lm === C.sprintLm(2), 'the next sprint 40 s after the first');
  // nobody flew: no star
  ev = Dragon.tick(m, T0 + R.SPRINT_FIRST_MS + R.SPRINT_EVERY_MS + R.SPRINT_MS);
  ev.sprintEnd.races.forEach((x) => { if (x.b !== A.id && x.b !== B2.id) return; ok(Array.isArray(x.w), 'winners list'); });
  ok(ev.sprintEnd.races.every((x) => x.w.length === 0), 'nobody flew: no star');
  // pause moves the sprint; the last minutes: no sprint that would not end in time
  const m2 = game(4, 5, 60);
  Dragon.tick(m2, T0 + R.SPRINT_FIRST_MS);
  ok(m2.sprint, 'a sprint in a 1-min game');
  const until = m2.sprint.until;
  Dragon.shiftTimes(m2, 3000);
  eq(m2.sprint.until, until + 3000, 'a pause moves the sprint');
  Dragon.tick(m2, until + 3000);
  ok(!m2.sprint, 'over');
  const ev2 = Dragon.tick(m2, T0 + 3000 + R.SPRINT_FIRST_MS + R.SPRINT_EVERY_MS);
  eq(ev2.sprintGo, null, 'too late in the round for another sprint');
  eq(m2.nextSprintAt, Infinity, '…none until «+30 s»');
  Dragon.addTime(m2, 30000);
  Dragon.reopenSprints(m2, T0 + 64000);
  const ev3 = Dragon.tick(m2, T0 + 64000);
  ok(ev3.sprintGo, '«+30 s» opens one more sprint');
  // «¡FINAL!» decides an open sprint
  const k1 = Dragon.seatsOf(m2, m2.races[0])[0];
  const ff = flight(m2, k1.k, T0 + 64000, { ring: 0 });
  Dragon.beats(m2, k1.k, ff.f.mid, 1, ff.x.start + 10);
  const fin = Dragon.final(m2, ff.x.start + 500);
  ok(fin && fin.races[0].w.includes(k1.k), '«¡FINAL!» decides the open sprint');
  eq(m2.sprint, null, 'no sprint after «¡FINAL!»');
}

// ---------- leads ----------
{
  const m = game(4);
  let ev = Dragon.tick(m, T0 + 100);
  eq(ev.leads.length, 0, 'nobody leads at 0');
  m.kids[2].m = R.LEAD_M - 1;
  ev = Dragon.tick(m, T0 + 200);
  eq(ev.leads.length, 0, 'a lead needs 20 m');
  m.kids[2].m = R.LEAD_M;
  ev = Dragon.tick(m, T0 + 300);
  eq(ev.leads, [{ b: m.races[0].id, k: 2, first: true }], 'the first leader');
  m.kids[3].m = R.LEAD_M + 10;
  ev = Dragon.tick(m, T0 + 400);
  eq(ev.leads.length, 0, 'hysteresis: 10 m more is not a new leader');
  m.kids[3].m = 2 * R.LEAD_M;
  ev = Dragon.tick(m, T0 + 500);
  eq(m.races[0].lead, 3, 'a new leader 20 m ahead');
  eq(ev.leads.length, 0, 'alarms ≥ 6 s apart');
  ev = Dragon.tick(m, T0 + 300 + R.LEAD_GAP_MS);
  eq(ev.leads, [{ b: m.races[0].id, k: 3, first: false }], 'the alarm after the gap');
}

// ---------- the frenzy, «+30 s», the live line ----------
{
  const m = game(4);
  eq(m.frenzyAt, m.endsAt - 30000, 'the frenzy is the last 30 s');
  let ev = Dragon.tick(m, m.frenzyAt);
  ok(ev.frenzy && m.frenzy, 'the frenzy starts');
  const end = m.endsAt;
  ok(Dragon.addTime(m, 30000), '+30 s');
  eq(m.endsAt, end + 30000, 'the end moves');
  ok(m.frenzy, 'an open frenzy stays on');
  const m2 = game(4);
  Dragon.addTime(m2, 30000);
  eq(m2.frenzyAt, m2.endsAt - 30000, 'before the frenzy: it moves with the end');
  eq(Dragon.addTime(Dragon.newGame(1, 240, T0), 30000), false, 'no +30 s in the intro');
  eq(Dragon.frenzyMs(30), 10000, 'a very short game: the last third');
  // flags: flying 1 · tailwind 2 · fire 4 · the sprint column
  const m3 = game(3);
  m3.kids[1].m = 300; m3.kids[2].m = 200; m3.kids[3].m = 0;
  const f = flight(m3, 3, T0 + 1000, { streak: 2, ring: 0 });
  let row = Dragon.racePos(m3, m3.races[0], f.x.start + 10).find((x) => x[0] === 3);
  eq(row[2], 1 | 2 | 4, 'flying + tailwind + fire');
  row = Dragon.racePos(m3, m3.races[0], T0 + 1000).find((x) => x[0] === 3);
  eq(row[2] & 1, 0, 'not flying yet in the lead');
  eq(row.length, 3, 'no sprint column outside a sprint');
  Dragon.startSprint(m3, T0 + 2000);
  row = Dragon.racePos(m3, m3.races[0], T0 + 2000).find((x) => x[0] === 1);
  eq(row.length, 4, 'a sprint column during a sprint');
  const v = Dragon.raceView(m3, m3.races[0]);
  eq(v.seats.map((s) => s.k).sort(), [1, 2, 3], 'the race view lists its seats');
  ok(v.seats.every((s) => 'm' in s && 'st' in s && 'c' in s && 'skin' in s), 'the view carries metres, stars, colour, character');
}

// ---------- the end ----------
{
  const m = game(4);
  Object.assign(m.kids[1], { m: 1000, right: 9, best: 5, lastM: 0, stars: 1 });
  Object.assign(m.kids[2], { m: 950, right: 7, best: 2, lastM: 120, stars: 0 });
  Object.assign(m.kids[3], { m: 700, right: 9, best: 3, lastM: 0, stars: 0 });
  Object.assign(m.kids[4], { m: 0, right: 0, best: 0, lastM: 0, stars: 0 });
  const fin = Dragon.finish(m);
  const rc = fin.races[0];
  eq(rc.bonus.map((s) => s.id), ['sabia', 'racha', 'remontada'], 'three bonus stars');
  eq(rc.bonus[0].winners.sort(), [1, 3], 'Sabia shared by a tie');
  eq(rc.bonus[1].winners, [1], 'Racha: the longest streak ≥ 3');
  eq(rc.bonus[2].winners, [2], 'Remontada: the most metres from last place');
  const x = (k) => rc.rows.find((y) => y.k === k);
  eq(x(1).total, 1000 + 2 * R.BONUS_M, 'two bonus stars: +400 m');
  eq(x(2).total, 950 + R.BONUS_M, 'one bonus star');
  eq(x(3).total, 700 + R.BONUS_M, 'one bonus star');
  eq(x(4).total, 0, 'no flight, no bonus');
  eq(rc.rows.map((y) => y.k), [1, 2, 3, 4], 'ranked by total');
  eq(rc.winners, [1], 'the winner');
  eq(x(1).rank, 1, 'rank 1'); eq(x(4).of, 4, 'of 4');
  eq(fin.podium.map((y) => y.k), [1, 2, 3], 'the class podium (nobody with 0)');
  // the bonus flips a close race
  const m2 = game(2);
  Object.assign(m2.kids[1], { m: 1000, right: 3, best: 2, lastM: 0 });
  Object.assign(m2.kids[2], { m: 900, right: 5, best: 4, lastM: 300 });
  const f2 = Dragon.finish(m2);
  eq(f2.races[0].winners, [2], 'the bonus stars change who wins a close race');
  // ties
  const m3 = game(2);
  Object.assign(m3.kids[1], { m: 500, right: 2, stars: 1 });
  Object.assign(m3.kids[2], { m: 500, right: 2, stars: 1 });
  const f3 = Dragon.finish(m3);
  eq(f3.races[0].winners.sort(), [1, 2], 'a full tie: two winners');
  eq(f3.races[0].rows.map((y) => y.rank), [1, 1], 'the same rank');
  const m4 = game(2);
  Object.assign(m4.kids[1], { m: 500, right: 2, stars: 0 });
  Object.assign(m4.kids[2], { m: 500, right: 2, stars: 1 });
  eq(Dragon.finish(m4).races[0].winners, [2], 'equal metres: more stars wins');
  const m5 = game(3);
  eq(Dragon.finish(m5).races[0].winners, [], 'nobody flew: no winner');
  eq(Dragon.finish(m5).podium, [], 'nobody on the podium');
}

// ---------- 300 simulated classes ----------
{
  const kinds = ['thinker', 'thinker', 'slow', 'guesser', 'masher', 'thinker', 'idle', 'thinker', 'lazy', 'slow', 'thinker', 'thinker', 'guesser'];
  const sum = {}, cnt = {};
  let games = 0, flights = 0, stars = 0, beats = 0, overCap = 0, flips = 0, races = 0, maxPerFlight = 0;
  for (let s = 1; s <= 300; s++) {
    const n = 4 + (s % 27);
    const ks = Array.from({ length: n }, (_, i) => kinds[(i + s) % kinds.length]);
    const secs = [180, 240, 300][s % 3];
    const g = Sim.game(s, ks, secs);
    games++;
    flights += g.stats.flights;
    stars += g.stats.stars;
    beats += g.stats.beats;
    flips += g.stats.flips;
    races += g.stats.racesN;
    Object.values(g.m.kids).forEach((r) => {
      ok(r.m >= 0 && Number.isFinite(r.m), 'metres are a number ≥ 0');
      ok(r.stars === r.sprints, 'stars = sprints won');
      ok(r.rings <= r.flights, 'at most a ring a flight');
      ok(r.flap === null, 'every flight closed at the end');
      const capPerFlight = Math.floor(R.RATE * (R.FLAP_MS + R.STREAK_MS) / 1000) + R.BURST;
      maxPerFlight = Math.max(maxPerFlight, r.flights ? r.beats / r.flights : 0);
      if (r.beats > r.flights * capPerFlight) overCap++;
    });
    g.fin.races.forEach((rc) => {
      ok(rc.rows.every((x) => x.total === x.flown + x.bonus.length * R.BONUS_M), 'total = metres + bonus');
      rc.bonus.forEach((st) => st.winners.forEach((k) => ok(rc.rows.some((x) => x.k === k), 'a bonus star stays in its race')));
    });
    g.kids.forEach((x) => {
      const row = g.fin.rows.find((r) => r.k === x.k);
      sum[x.kind] = (sum[x.kind] || 0) + row.flown;
      cnt[x.kind] = (cnt[x.kind] || 0) + 1;
    });
  }
  eq(overCap, 0, 'no flight ever beats more than the cap');
  const avg = (k) => sum[k] / cnt[k];
  ok(avg('thinker') > 2 * avg('guesser'), `a thinker flies more than twice a fast guesser (${avg('thinker').toFixed(0)} vs ${avg('guesser').toFixed(0)} m)`);
  ok(avg('slow') > avg('guesser'), `a slow thinker beats a fast guesser (${avg('slow').toFixed(0)} vs ${avg('guesser').toFixed(0)} m)`);
  eq(avg('masher'), 0, 'a masher (too fast every time) flies nothing');
  eq(avg('idle'), 0, 'a kid who never answers flies nothing');
  ok(avg('lazy') < avg('thinker') / 2, `effort in the flight counts (lazy ${avg('lazy').toFixed(0)} vs thinker ${avg('thinker').toFixed(0)} m)`);
  ok(flips > 0 && flips < races * 0.2, `the bonus stars sometimes change a winner (${flips} of ${races} races)`);
  console.log(`  simulated ${games} classes · ${flights} flights · ${beats} beats · ${stars} sprint stars · ${flips}/${races} races flipped by the bonus`);
  console.log(`  metres per kid: ${Object.keys(sum).map((k) => `${k} ${avg(k).toFixed(0)}`).join(' · ')}`);
}

console.log(`test-dragon: ${checks.toLocaleString('en')} checks pass`);
