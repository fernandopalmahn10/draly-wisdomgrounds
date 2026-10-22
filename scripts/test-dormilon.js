// Rules check for «¡No despiertes a Dralingo!» v2 (core/dormilon.js). Run: node scripts/test-dormilon.js [--sim]
// v2 (his pick 2026-10-22): the quiz earns feathers (every kid not playing; start 3, at most 6); the turn is the task:
// finger strokes on his head, each +1 (+2 in the last 30 s) and one feather; a scribble +2 danger; out of feathers ends
// the turn. Also: boards, the hidden limit, the waker → 0, nights, guesses, the guided first turn, «¡FINAL!», the
// ceremony payload, the clock, late seats, dropped phones. Then a class simulation (kids answering at a human pace,
// stroking gently / greedily) that checks the pace: a few strokes a turn, a few wake-ups a game, feathers to spend.
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
function until(m, t0, t, ms, o, match) {
  let now = t0;
  for (let i = 0; i < (ms || 30000) / 100; i++) {
    now += 100;
    const ev = D.tick(m, now, o || opts());
    const hit = ev.find((e) => e.t === t && (!match || match(e)));
    if (hit) return { now, ev, hit };
  }
  return { now, ev: [], hit: null };
}
// strokes a kid at a gentle pace until out of feathers / the turn ends / he wakes; returns the events
function strokes(m, k, t0, n, gap) {
  let now = t0;
  const all = [];
  for (let i = 0; i < n; i++) { now += gap || 700; const r = D.stroke(m, k, now); all.push(...r.ev); if (!r.ok) break; }
  return { now, ev: all };
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
  ok(b && b.seats[b.seats.length - 1] === 99 && D.seatLate(m, 99, 'Late', 'fer') === null, 'a late joiner sits last; a seated kid keeps the seat');
  const { m: m1 } = game(1, 41);
  for (let i = 0; i < 4; i++) D.seatLate(m1, 70 + i, 'L' + i, 'fer');
  ok(m1.boards[0].limit >= R.LIMIT_LO * 5 - 1 && m1.boards[0].limit <= R.LIMIT_HI * 5 + 1, 'late seats grow the hidden limit with the board', m1.boards[0].limit);
  const { m: mc } = game(0, 43);
  D.deal(mc, [[1, 'Ana', 'aileen', 'AB12CD'], [2, 'Beto', 'hamdan', 'XY34ZW']]);
  mc.kids[1].score = 6;
  ok(D.byCode(mc, 'AB12CD', (k) => k !== 1).score === 6 && D.byCode(mc, 'AB12CD', () => true) === null, 'a returning kid finds their own row (never one playing elsewhere)');
  ok(!('code' in D.boardView(mc, mc.boards[0], null, 0).seats[0]) && !D.finish(mc).rows.some((r) => 'code' in r), 'the student code never leaves the server');
}

// ---------- the quiz earns feathers (every kid who is not playing) ----------
{
  const { m, now: t0 } = game(4, 5);
  const ev0 = D.startPlay(m, t0);
  const b = m.boards[0];
  const turnK = evOf(ev0, 'pre')[0].k;
  const w = b.seats.find((k) => k !== turnK);
  ok(m.kids[w].feathers === R.FEATHERS_START, 'every kid starts with 3 feathers');
  const ev1 = D.tick(m, t0 + 100, opts());
  const qs = evOf(ev1, 'q');
  ok(qs.length === 3 && !qs.some((e) => e.k === turnK), 'the 3 friends get a question; the kid of «Turno de…» does not', qs.map((e) => e.k));
  const q = qs.find((e) => e.k === w).q;
  ok(!('correctIdx' in D.qPublic(q)) && D.openQ(m, w).qid === q.qid, 'a phone never sees the right answer; a reconnect gets the same question');
  ok(D.answer(m, w, q.qid, q.correctIdx, q.sentAt + 50).ok === false, 'a double tap (< 300 ms) is ignored');
  let a = D.answer(m, w, q.qid, q.correctIdx, t0 + 1500);
  ok(a.ok && a.right && evOf(a.ev, 'qr')[0].gained === 1 && m.kids[w].feathers === 4, 'a right answer = one more feather', a.ev);
  ok(D.answer(m, w, q.qid, q.correctIdx, t0 + 1600).ok === false, 'the same question never pays twice');
  let r = until(m, t0 + 1500, 'q', 3000, null, (e) => e.k === w);
  ok(r.hit && r.now - (t0 + 1500) >= R.NEXT_Q_MS - 100, 'the next question follows');
  a = D.answer(m, w, r.hit.q.qid, (r.hit.q.correctIdx + 1) % 4, r.now + 900);
  ok(a.ok && !a.right && m.kids[w].feathers === 4 && evOf(a.ev, 'qr')[0].correctText, 'a wrong answer: no feather, the right one shown');
  const r2 = until(m, r.now + 900, 'q', 3000, null, (e) => e.k === w);
  ok(r2.hit && r2.now - (r.now + 900) >= R.WRONG_WAIT_MS - 100, '…and a short wait before the next');
  // a full quiver rests
  m.kids[w].feathers = R.FEATHERS_MAX - 1;
  a = D.answer(m, w, r2.hit.q.qid, r2.hit.q.correctIdx, r2.now + 800);
  ok(evOf(a.ev, 'qr')[0].full && m.kids[w].feathers === R.FEATHERS_MAX, 'six feathers = a full quiver');
  const r3 = until(m, r2.now + 800, 'q', 3000, null, (e) => e.k === w);
  ok(!r3.hit, 'a full quiver gets no question (it watches the turn)');
  ok(m.kids[w].feathers <= R.FEATHERS_MAX, 'never more than 6');
}

// ---------- the turn: strokes ----------
{
  const { m, now: t0 } = game(3, 11);
  D.startPlay(m, t0);
  const b = m.boards[0];
  b.seats.forEach((k) => { m.kids[k].first = false; });          // (ordinary turns)
  b.ti = -1; b.phase = 'post'; b.phaseUntil = t0;
  let r = until(m, t0, 'go');
  const k = r.hit.k;
  ok(r.hit.ms === R.TURN_MS && r.hit.feathers === R.FEATHERS_START, 'a turn: 6 s with the kid\'s feathers', r.hit);
  ok(D.answer(m, k, 'x', 0, r.now).ok === false && D.openQ(m, k) === null, 'no quiz during my own turn');
  const d0 = b.danger;
  let s = D.stroke(m, k, r.now + 400);
  const p = evOf(s.ev, 'pat')[0];
  ok(p && p.pts === 1 && p.score === 1 && p.feathers === 2 && !p.fast && b.danger === d0 + 1, 'a stroke: +1 point, one feather spent, +1 danger', p);
  ok(D.stroke(m, k, r.now + 500).why === 'noise', 'strokes closer than 250 ms are noise');
  s = D.stroke(m, k, r.now + 400 + 300);
  ok(evOf(s.ev, 'pat')[0].fast && b.danger === d0 + 3, 'a scribble (< 550 ms after the last): +2 danger', b.danger - d0);
  s = D.stroke(m, k, r.now + 400 + 300 + 800);
  const e = evOf(s.ev, 'end')[0];
  ok(e && e.why === 'empty' && e.pts === 3 && m.kids[k].feathers === 0 && b.phase === 'post', 'the last feather ends the turn safely («¡Sin plumas!»)', e);
  ok(m.kids[k].big === 3 && m.kids[k].safe === 1, 'strokes in one turn and a safe turn counted');
  // a kid with no feathers: the turn ends at once
  r = until(m, r.now + 2000, 'go');
  const k2 = r.hit.k;
  if (r.hit.feathers > 0) m.kids[k2].feathers = 0;
  m.kids[k2].feathers = 0;
  b.phase = 'post'; b.phaseUntil = r.now; b.ti = b.seats.indexOf(k2) - 1;
  r = until(m, r.now, 'go');
  ok(r.hit && r.hit.k === k2 && evOf(r.ev, 'end').some((x) => x.why === 'empty'), 'no feathers at my turn: it ends at once (answer to earn more)');
  // «¡Me retiro!» and time up
  r = until(m, r.now, 'go');
  const k3 = r.hit.k;
  m.kids[k3].feathers = 6;
  D.stroke(m, k3, r.now + 300);
  const st = evOf(D.stop(m, k3, r.now + 900), 'end')[0];
  ok(st && st.why === 'stop' && st.pats === 1 && m.kids[k3].feathers === 5, '«¡Me retiro!» keeps the strokes and the feathers left');
  b.seats.forEach((x) => { m.kids[x].feathers = 6; });
  r = until(m, r.now + 900, 'go');
  const tr = until(m, r.now, 'end', R.TURN_MS + 500);
  ok(tr.hit && tr.hit.why === 'time' && tr.now - r.now >= R.TURN_MS - 100, 'time up (6 s) ends the turn safely');
}

// ---------- the wake-up ----------
{
  const { m, now: t0 } = game(3, 13);
  D.startPlay(m, t0);
  const b = m.boards[0];
  b.seats.forEach((k) => { m.kids[k].first = false; m.kids[k].feathers = 6; });
  b.ti = -1; b.phase = 'post'; b.phaseUntil = t0;
  let r = until(m, t0, 'go');
  const k = r.hit.k;
  m.kids[k].score = 9;
  b.limit = b.danger + 2;
  let s = D.stroke(m, k, r.now + 300);
  ok(!evOf(s.ev, 'wake').length && m.kids[k].score === 10, 'one stroke below the limit: safe');
  s = D.stroke(m, k, r.now + 1100);
  const w = evOf(s.ev, 'wake')[0];
  ok(w && w.k === k && w.lost === 11 && m.kids[k].score === 0 && m.kids[k].wakes === 1, 'the stroke that reaches the limit wakes him: ALL points lost', w);
  ok(b.phase === 'wake' && D.boardView(m, b, null, r.now).cue === 4, 'the board shows him awake');
  r = until(m, r.now + 1100, 'night');
  ok(r.hit && r.hit.night === 2 && b.danger === 0, 'a new night: danger back to 0');
  r = until(m, r.now, 'pre');
  ok(r.hit.k === b.seats[(b.seats.indexOf(k) + 1) % b.seats.length], 'the kid after the waker plays next');
  // a scribble can wake him too
  r = until(m, r.now, 'go');
  const k2 = r.hit.k;
  b.limit = b.danger + 3;
  D.stroke(m, k2, r.now + 300);
  s = D.stroke(m, k2, r.now + 600);
  ok(evOf(s.ev, 'wake')[0] && evOf(s.ev, 'wake')[0].by === 'fast', 'a scribble over the limit wakes him (by: fast)');
}

// ---------- the guided first turn ----------
{
  const { m, now: t0 } = game(4, 3);
  D.startPlay(m, t0);
  const b = m.boards[0];
  const k0 = b.seats[0];
  m.kids[k0].feathers = 0;
  ok(D.guess(m, b.seats[1], 'sleep', t0 + 5) === null, 'no guess on a guided first turn');
  let r = until(m, t0, 'go');
  ok(r.hit.guided && r.hit.ms === R.FIRST_TURN_MS && r.hit.feathers >= R.FEATHERS_START, 'the first turn is guided, 9 s, with its 3 feathers', r.hit);
  const cap = Math.floor(b.limit * b.cuts[0]);
  b.danger = cap - 1;
  let s = D.stroke(m, r.hit.k, r.now + 400);
  s = D.stroke(m, r.hit.k, r.now + 700);           // a scribble
  ok(!evOf(s.ev, 'wake').length && b.danger === cap && D.cueOf(b) <= 1, 'a guided turn never wakes him and never passes the first cue', [b.danger, cap]);
  // a later seat comes with a full quiver: its risk-free guided turn still takes only 3 tickles (no edge for sitting last)
  m.kids[r.hit.k].feathers = 6;
  s = D.stroke(m, r.hit.k, r.now + 1700);
  const ge = evOf(s.ev, 'end')[0];
  ok(ge && ge.why === 'guided' && ge.pats === R.GUIDED_MAX && m.kids[r.hit.k].feathers === 5, 'a guided turn ends after 3 tickles («¡Así se juega!»), the other feathers kept', ge);
  ok(m.kids[r.hit.k].qNextAt >= r.now + 1700 + R.POST_MS, 'the turn kid\'s quiz comes back after «¡A salvo!» was seen', m.kids[r.hit.k].qNextAt - r.now - 1700);
}

// ---------- cues rise; the limit never shows ----------
{
  const { m } = game(4, 5);
  const b = m.boards[0];
  const seen = [];
  for (let d = 0; d < b.limit; d++) { b.danger = d; seen.push(D.cueOf(b)); }
  ok(seen[0] === 0 && seen[seen.length - 1] === 3 && seen.every((c, i) => i === 0 || c >= seen[i - 1]), 'cues 0 → 3 as the danger rises', seen);
  const v = D.boardView(m, b, null, 0);
  ok(!('limit' in v) && !('danger' in v) && !('cuts' in v) && v.seats.every((x) => typeof x.feathers === 'number'), 'the board shows feathers, never the limit');
}

// ---------- the last 30 s, the clock, the pause ----------
{
  const { m, now: t0 } = game(2, 9);
  D.startPlay(m, t0);
  const ev = D.tick(m, m.frenzyAt + 10, opts());
  ok(evOf(ev, 'frenzy').length === 1 && m.frenzy, 'the last 30 s start «¡Luna llena!»');
  const b = m.boards[0];
  b.seats.forEach((k) => { m.kids[k].first = false; m.kids[k].feathers = 6; });
  b.phase = 'post'; b.phaseUntil = m.frenzyAt + 10;
  const r = until(m, m.frenzyAt + 10, 'go');
  const s = D.stroke(m, r.hit.k, r.now + 300);
  ok(evOf(s.ev, 'pat')[0].pts === 2 && evOf(s.ev, 'pat')[0].x2, 'a stroke in the last 30 s = +2');
  ok(D.addTime(m, 30000, r.now + 500) === 30000, '«+30 s» adds 30 s');
  ok(evOf(D.tick(m, r.now + 600, opts()), 'frenzy').some((e) => e.off), '«+30 s» out of the last 30 s turns the ×2 off');
  const cut = D.addTime(m, -120000, r.now + 700);
  ok(cut < 0 && m.endsAt - (r.now + 700) >= 9000 && D.addTime(m, -30000, r.now + 700) === 0, '«−30 s» never ends the game by itself');
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
  ok(r.hit && evOf(r.ev, 'pre')[0].k === b.seats[1], 'then the turn is skipped');
  r = until(m, r.now, 'go', 5000, opts(on));
  gone.add(r.hit.k);
  const t1 = r.now;
  r = until(m, r.now, 'end', 8000, opts(on));
  ok(r.hit && r.hit.why === 'drop' && r.now - t1 >= R.DROP_MS, 'a phone lost mid-turn ends the turn after 3 s');
  ok(!D.tick(m, r.now + 100, opts(on)).some((e) => e.t === 'q' && gone.has(e.k)), 'a phone that is gone gets no quiz question');
}

// ---------- «¡FINAL!» and the ceremony payload ----------
{
  const { m, now: t0 } = game(4, 33);
  D.startPlay(m, t0);
  const b = m.boards[0];
  let r = until(m, t0, 'go');
  D.stroke(m, r.hit.k, r.now + 400);
  m.endsAt = r.now + 500;
  const ev = D.tick(m, m.endsAt + 1, opts());
  ok(evOf(ev, 'end')[0] && evOf(ev, 'end')[0].why === 'final' && m.kids[r.hit.k].score === 1, '«¡FINAL!» ends a turn safely (its strokes stand)');
  ok(evOf(ev, 'final').length === 1 && D.tick(m, m.endsAt + 500, opts()).length === 0, '«¡FINAL!» once; nothing moves after');
  ok(Object.values(m.kids).every((x) => !x.q) && D.stroke(m, r.hit.k, m.endsAt + 600).ok === false, 'no quiz and no strokes after «¡FINAL!»');
  const [a, bb, c, d] = b.seats.map((k) => m.kids[k]);
  Object.assign(a, { score: 7, pats: 9, big: 4, safe: 2, best: 5, wakes: 0, guessOk: 1 });
  Object.assign(bb, { score: 7, pats: 7, big: 2, safe: 1, best: 2, wakes: 1, guessOk: 3 });
  Object.assign(c, { score: 0, pats: 6, big: 6, safe: 0, best: 3, wakes: 1, guessOk: 0 });
  Object.assign(d, { score: 0, pats: 0, big: 0, safe: 0, best: 0, wakes: 0, guessOk: 0 });
  const fin = D.finish(m);
  const bd = fin.boards[0];
  ok(bd.rows[0] === a.k && bd.winners.length === 1 && bd.winners[0] === a.k, 'equal points: more strokes wins');
  const sid = (id) => bd.stars.find((x) => x.id === id);
  ok(sid('valiente').winners[0] === c.k && sid('prudente').winners[0] === a.k && sid('racha').winners[0] === a.k && sid('adivino').winners[0] === bb.k, 'the four bonus stars');
  ok(fin.byK[c.k].stars.includes('valiente') && fin.byK[d.k].stars.length === 0 && 'earned' in fin.byK[a.k], 'each row carries its stars and feathers earned');
  const { m: m0, now: z } = game(3);
  D.startPlay(m0, z);
  D.final(m0, z + 100);
  ok(D.finish(m0).winners.length === 0 && D.final(m0, z + 200).length === 0, 'nobody scored: nobody wins; a second «Terminar» does nothing');
}

// ---------- reactions ----------
{
  const { m, now: t0 } = game(4);
  D.startPlay(m, t0);
  const k = m.boards[0].seats[1];
  ok(D.react(m, k, 'shh', t0 + 10) && !D.react(m, k, 'wow', t0 + 500) && D.react(m, k, 'wow', t0 + 1300) && !D.react(m, k, 'evil', t0 + 5000), 'reactions: one per 1.2 s, only the 4');
}

// ---------- a class simulation (the pace) ----------
function simulate(nKids, seed, style) {
  const t0 = 5000000;
  const m = D.newGame(seed, 240, t0);
  D.deal(m, Array.from({ length: nKids }, (_, i) => [i + 1, 'K' + i, 'dralingo']));
  let now = t0;
  D.startPlay(m, now);
  let rng = seed * 9301 + 49297;
  const rand = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  const pending = {};            // quiz answers due
  const stroking = {};           // k → next stroke time
  const st = { turns: 0, strokes: [], wakes: 0, empties: 0, emptyStarts: 0, stops: 0, featherAtGo: [] };
  const kidStyle = (k) => (style === 'mixed' ? ['greedy', 'careful', 'normal'][k % 3] : style);
  const endTurn = (e) => { st.turns++; st.strokes.push(e.pats || 0); if (e.why === 'empty') st.empties++; if (e.why === 'stop') st.stops++; delete stroking[e.k]; };
  const take = (ev) => ev.forEach((e) => {
    if (e.t === 'q') pending[e.k] = { at: now + 1600 + rand() * 2200, qid: e.q.qid, idx: rand() < 0.8 ? e.q.correctIdx : (e.q.correctIdx + 1) % 4 };
    if (e.t === 'go') { st.featherAtGo.push(e.feathers); if (!e.feathers) st.emptyStarts++; stroking[e.k] = now + 500 + rand() * 500; }
    if (e.t === 'end') endTurn(e);
    if (e.t === 'wake') { st.turns++; st.strokes.push(e.pats || 0); st.wakes++; delete stroking[e.k]; }
  });
  for (let step = 0; step < 300000 / 100 && m.phase === 'play'; step++) {
    now += 100;
    take(D.tick(m, now, opts()));
    Object.entries(pending).forEach(([k, p]) => { if (now >= p.at) { delete pending[k]; take(D.answer(m, Number(k), p.qid, p.idx, now).ev); } });
    Object.entries(stroking).forEach(([k, at]) => {
      if (now < at) return;
      const s = kidStyle(Number(k));
      const b = D.boardOf(m, m.kids[k].b);
      const c = b.cur;
      if (!c || c.k !== Number(k)) { delete stroking[k]; return; }
      if (s === 'careful' && (c.pats >= 2 || b.cue >= 2)) { take(D.stop(m, Number(k), now)); return; }
      if (s === 'normal' && (c.pats >= 4 || b.cue >= 3)) { take(D.stop(m, Number(k), now)); return; }
      take(D.stroke(m, Number(k), now).ev);
      if (stroking[k] != null) stroking[k] = now + (s === 'greedy' ? 380 + rand() * 300 : 650 + rand() * 400);
    });
  }
  const avg = st.strokes.reduce((a, b) => a + b, 0) / Math.max(1, st.strokes.length);
  const fAvg = st.featherAtGo.reduce((a, b) => a + b, 0) / Math.max(1, st.featherAtGo.length);
  return { kids: nKids, boards: m.boards.length, style, turns: st.turns, avgStrokes: Math.round(avg * 10) / 10, wakes: st.wakes, empties: st.empties, emptyStarts: st.emptyStarts, featherAtGo: Math.round(fAvg * 10) / 10, perBoardTurns: Math.round(st.turns / m.boards.length) };
}
const SIM = process.argv.includes('--sim');
const runs = [];
['greedy', 'normal', 'careful', 'mixed'].forEach((style) => [4, 12, 30].forEach((n) => [1, 2, 3].forEach((seed) => runs.push(simulate(n, seed * 17 + n, style)))));
const by = (style) => runs.filter((r) => r.style === style);
const mean = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
const greedy = by('greedy'), mixed = by('mixed'), careful = by('careful');
if (SIM) runs.forEach((r) => console.log(JSON.stringify(r)));
ok(mean(greedy, (r) => r.avgStrokes) >= 3 && mean(greedy, (r) => r.avgStrokes) <= 6, 'a kid who keeps stroking: 3-6 strokes a turn', mean(greedy, (r) => r.avgStrokes));
ok(mean(mixed, (r) => r.featherAtGo) >= 3, 'the quiz fills the quiver between turns (3+ feathers at a turn)', mean(mixed, (r) => r.featherAtGo));
ok(mean(mixed, (r) => r.emptyStarts / Math.max(1, r.turns)) < 0.15, 'a turn rarely starts with no feathers', mean(mixed, (r) => r.emptyStarts / Math.max(1, r.turns)));
ok(mean(greedy, (r) => r.wakes / r.boards) >= 1.5, 'greedy boards wake him up more than once a game', mean(greedy, (r) => r.wakes / r.boards));
ok(mean(careful, (r) => r.wakes / r.boards) < mean(greedy, (r) => r.wakes / r.boards), 'careful boards wake him less');
ok(mean(mixed, (r) => r.perBoardTurns) >= 14, 'a 4-minute game: ~14+ turns per board (each kid plays 3-5 times)', mean(mixed, (r) => r.perBoardTurns));
if (SIM) console.log('greedy strokes', mean(greedy, (r) => r.avgStrokes).toFixed(2), 'wakes/board', mean(greedy, (r) => r.wakes / r.boards).toFixed(2),
  '| mixed strokes', mean(mixed, (r) => r.avgStrokes).toFixed(2), 'wakes/board', mean(mixed, (r) => r.wakes / r.boards).toFixed(2), 'turns/board', mean(mixed, (r) => r.perBoardTurns).toFixed(1), 'feathers at go', mean(mixed, (r) => r.featherAtGo).toFixed(1),
  '| careful wakes/board', mean(careful, (r) => r.wakes / r.boards).toFixed(2));

console.log(`test-dormilon: ${checks} checks OK`);
