// Rules check for «Draly Siesta · ¡No despiertes a Dralingo!» v4 (core/dormilon.js). Run: node scripts/test-dormilon.js [--sim]
// v4 (2026-10-24, his «every kid in, every moment; build, then the reveal; the dragon needs to awaken more often»): the
// Windows rhythm. A question window (everyone answers; right = a golden feather, max 4, kept between rounds; wrong / late
// / blind = a feather flies off + he shifts), then a play window where EVERY kid of the board rubs at once: a stroke =
// a feather from my hand → +1 feather in my collection «Tus plumas» (+2 in the final round), the board's danger +1 (a
// scribble +3), each unit a dice roll; «🪶 ¡Guardar mis plumas!» (or my last feather) keeps this round's feathers; he
// wakes → the feathers the WAKER collected this round fly away (the others' stay), the angry wake-up, a new night, the
// window goes on; the window's end keeps everyone's feathers of the round. (v4.1: one unit, the feather.)
// Checks: boards, robots (never count), the windows and their clock (±30 s, pause, the final round ×2), the quiz and its
// costs, strokes / banks / wake-ups, the end. Then a class simulation (kids at a human pace): he wakes in MOST play
// windows of a board of 4, never predictably; a careful kid (answers well, banks when his face says «careful») beats a
// greedy one and a random tapper; a kid who never answers builds nothing; every kid gets several questions a window.
'use strict';
const D = require('../core/dormilon');
const { R } = D;
if (process.env.DM_R) Object.assign(R, JSON.parse(process.env.DM_R));   // (the tuner: DM_R='{"HAZ":0.01}' node scripts/test-dormilon.js --sim)

let checks = 0;
function ok(cond, what, extra) {
  checks++;
  if (!cond) { console.error('FAIL:', what, extra !== undefined ? JSON.stringify(extra) : ''); process.exit(1); }
}
const QS = Array.from({ length: 30 }, (_, i) => ({ text: `¿Qué significa «w${i}»?`, correct: `ok${i}`, answers: [`ok${i}`, `a${i}`, `b${i}`, `c${i}`] }));
const opts = (online) => ({ questions: QS, imageFor: () => null, online: online || (() => true) });
const evOf = (ev, t) => ev.filter((e) => e.t === t);
function game(n, seed, dur) {
  const now = 1000000;
  const m = D.newGame(seed || 7, dur || 240, now);
  D.deal(m, Array.from({ length: n }, (_, i) => [i + 1, 'Kid' + (i + 1), 'dralingo']));
  return { m, now };
}
// ticks every 100 ms until an event t (matching) or ms pass
function until(m, t0, t, ms, o, match) {
  let now = t0;
  const seen = [];
  for (let i = 0; i < (ms || 30000) / 100; i++) {
    now += 100;
    const ev = D.tick(m, now, o || opts());
    seen.push(...ev);
    const hit = ev.find((e) => e.t === t && (!match || match(e)));
    if (hit) return { now, ev, hit, seen };
  }
  return { now, ev: [], hit: null, seen };
}
const toPhase = (m, now, ph, o) => until(m, now, 'round', 60000, o, (e) => e.phase === ph);
// answers kid k's open question right (or wrong)
function ans(m, k, now, right) {
  const r = D.kid(m, k);
  if (!r.q) return null;
  const idx = right ? r.q.correctIdx : (r.q.correctIdx + 1) % r.q.answers.length;
  return D.answer(m, k, r.q.qid, idx, now);
}

// ---------- boards ----------
{
  [[1, [1]], [4, [4]], [5, [5]], [6, [3, 3]], [8, [4, 4]], [9, [3, 3, 3]], [10, [4, 3, 3]], [30, null]].forEach(([n, want]) => {
    const { m } = game(n);
    const sizes = m.boards.map((b) => b.seats.length).sort((a, b) => b - a);
    if (want) ok(JSON.stringify(sizes) === JSON.stringify(want), `deal ${n} kids → ${want}`, sizes);
    ok(sizes.reduce((a, b) => a + b, 0) === n && sizes.every((s) => s >= 1 && s <= 5), `deal ${n}: every kid seated once`, sizes);
    m.boards.forEach((b) => ok(b.danger === 0 && b.cuts.length === 3 && b.cuts.every((c, i) => c >= R.CUES[i][0] && c <= R.CUES[i][1]), 'a night starts calm, its cues jittered', b.cuts));
  });
  const { m } = game(8);
  const b = D.seatLate(m, 99, 'Late', 'fer');
  ok(b && b.seats[b.seats.length - 1] === 99 && D.seatLate(m, 99, 'Late', 'fer') === null, 'a late joiner sits last; a seated kid keeps the seat');
  ok(D.kid(m, 99).feathers === 0 && D.kid(m, 99).score === 0, 'a late joiner starts with an empty hand and no feathers collected');
}
// ---------- robots: only a board of 1-2 phones, never counted ----------
{
  const { m } = game(1);
  [101, 102, 103, 104].forEach((k, i) => D.seatRobot(m, k, '🤖 R' + i, 'hamdan'));
  ok(m.boards.length === 1 && m.boards[0].seats.length === 4, 'robots fill the teacher\'s board up to 4, never a board of their own', m.boards[0].seats);
  const big = game(6).m;
  ok(D.seatRobot(big, 200, '🤖', 'hamdan') === null, 'a board of 3 kids (a real class) gets no robot');
  let now = 1000000;
  D.startPlay(m, now);
  for (let i = 0; i < 1300; i++) { now += 100; D.tick(m, now, opts((k) => k === 1)); }   // (130 s: the robots play the whole game)
  const bots = [101, 102, 103].map((k) => D.kid(m, k));
  ok(bots.every((r) => r.answered >= 4), 'robots answer questions', bots.map((r) => r.answered));
  ok(bots.some((r) => r.pats >= 2) && bots.some((r) => r.score > 0), 'robots rub and collect feathers', bots.map((r) => [r.pats, r.score]));
  const fin = D.finish(m);
  ok(fin.count === 1 && fin.order.length === 1 && fin.order[0] === 1, 'robots are never in the class ranking', fin.order);
  ok(fin.boards[0].rows.length === 1 && fin.boards[0].robots.length === 3 && fin.boards[0].stars.every((s) => s.winners.every((k) => k === 1)), 'robots never win a place or a star', fin.boards[0]);
}
// ---------- the windows ----------
{
  const { m, now: t0 } = game(4, 3, 120);
  const ev0 = D.startPlay(m, t0);
  const r0 = evOf(ev0, 'round')[0];
  ok(r0 && r0.phase === 'qw' && r0.ms >= R.QW_MIN && r0.ms <= R.QW_MAX && r0.total >= 3 && r0.total <= 5, 'a 2-minute game: ~4 rounds, a question window of 12-20 s', r0);
  let now = t0;
  const s1 = until(m, now, 'q', 2000);
  ok(s1.hit && s1.hit.ms >= 9000 && s1.hit.ms <= R.Q_TIME_MS, 'a question gives time to read (up to 12 s)', s1.hit && s1.hit.ms);
  now = s1.now;
  // nobody can rub in the question window
  ok(!D.stroke(m, 1, now).ok, 'no strokes in the question window');
  // right → +1 feather (max 4)
  for (let i = 0; i < 6; i++) { now += 700; const r = ans(m, 1, now, true); if (!r) { const u = until(m, now, 'q', 3000, null, (e) => e.k === 1); now = u.now; i--; continue; } ok(r.right, 'a right answer'); }
  ok(D.kid(m, 1).feathers === R.FEATHERS_MAX, 'right answers fill the quiver (max 4)', D.kid(m, 1).feathers);
  // wrong → a feather flies off + he shifts
  let u = until(m, now, 'q', 3000, null, (e) => e.k === 1); now = u.now + 800;
  const d0 = m.boards[0].danger;
  const w = ans(m, 1, now, false);
  ok(w && !w.right && D.kid(m, 1).feathers === R.FEATHERS_MAX - 1 && m.boards[0].danger === d0 + R.WRONG_DANGER && evOf(w.ev, 'shift').length === 1, 'a wrong answer: a feather flies off and he shifts', [D.kid(m, 1).feathers, m.boards[0].danger]);
  // a blind tap (too fast) counts as wrong
  u = until(m, now, 'q', 3000, null, (e) => e.k === 1); now = u.now;
  const q = D.kid(m, 1).q;
  const bl = D.answer(m, 1, q.qid, q.correctIdx, now + 100);
  ok(bl.ok && !bl.right && D.kid(m, 1).fast === 1, 'a blind tap counts as wrong');
  // a late question costs too (only one the phone showed)
  u = until(m, now, 'q', 3000, null, (e) => e.k === 2); now = u.now;
  D.seen(m, 2, D.kid(m, 2).q.qid);
  const f2 = D.kid(m, 2).feathers;
  const lt = until(m, now, 'qr', 14000, null, (e) => e.k === 2 && e.late);
  ok(lt.hit ? D.kid(m, 2).late === 1 && D.kid(m, 2).feathers === Math.max(0, f2 - 1) : m.round.phase !== 'qw', 'a question left to run out costs like a wrong one (or the window ended first: withdrawn free)');
  // the window ends → «¡A hacerle cosquillas!» → the play window
  const pin = toPhase(m, lt.now || now, 'pwin');
  ok(pin.hit && evOf(pin.seen, 'qx').length >= 0 && Object.values(m.kids).every((r) => !r.q), 'the question window ends: open questions are withdrawn (free)');
  ok(evOf(pin.seen, 'ready').length === 1, 'every board hears «¡A hacerle cosquillas!» with its feathers');
  const pw = toPhase(m, pin.now, 'pw');
  ok(pw.hit && pw.hit.ms === R.PW_MS, 'the play window: 10 s', pw.hit);
  now = pw.now;
  // everyone rubs at once
  const k1 = D.kid(m, 1);
  const f = k1.feathers;
  const s = D.stroke(m, 1, now + 100);
  ok(s.ok && k1.pile === 1 && k1.feathers === f - 1 && evOf(s.ev, 'pat')[0].pile === 1, 'a stroke: a feather from my hand → +1 in my collection', [k1.pile, k1.feathers]);
  ok(!D.stroke(m, 1, now + 200).ok, 'strokes closer than 250 ms are noise');
  // the board's danger is shared
  const dd = m.boards[0].danger;
  if (!m.boards[0].awake && D.kid(m, 3).feathers > 0) { D.stroke(m, 3, now + 300); ok(m.boards[0].danger >= dd + 1 || m.boards[0].awake, 'another kid\'s stroke raises the same danger'); }
  // «🪶 ¡Guardar mis plumas!» keeps my feathers of the round
  if (!m.boards[0].awake) {
    const sc = k1.score, pile = k1.pile;
    const bk = D.bank(m, 1);
    ok(bk.length === 1 && k1.safe && k1.score === sc + pile && k1.pile === 0, '«¡Guardar mis plumas!»: this round\'s feathers are kept', bk);
    ok(!D.stroke(m, 1, now + 2000).ok, 'a banked kid rubs no more this window');
    ok(k1.feathers === f - 1, 'the feathers I did not spend stay for the next round');
  }
}
// ---------- a wake-up: the waker's feathers of the round fly away; he sleeps again and the window goes on ----------
{
  const { m, now: t0 } = game(4, 11, 240);
  D.startPlay(m, t0);
  Object.values(m.kids).forEach((r) => { r.feathers = 4; });
  let { now } = toPhase(m, t0, 'pw');
  const b = m.boards[0];
  // kid 1 banks after one stroke; kids 2-4 rub until he wakes
  D.stroke(m, 1, now + 50); D.bank(m, 1);
  const safe1 = D.kid(m, 1).score;
  ok(b.safeLeft === R.SAFE_FIRST * 4 - 1, 'the game\'s first play window: each kid\'s first tickle is safe (they learn the rub)', b.safeLeft);
  { const d0 = b.danger; b.danger = 60; const w0 = D.stroke(m, 2, now + 120); ok(w0.ok && !w0.ev.some((e) => e.t === 'wake') && b.danger === 61, 'a safe tickle never wakes him, even late in a night (the danger still grows)'); b.danger = d0; }
  b.safeLeft = 0;
  b.danger = 30; b.cue = 3;                                  // (late in a restless night: the next strokes are risky)
  let woke = null;
  for (let i = 0; i < 40 && !woke; i++) {
    now += 300;
    const k = 2 + (i % 3);
    if (D.kid(m, k).feathers <= 0) { D.kid(m, k).feathers = 4; D.kid(m, k).safe = false; }
    const r = D.stroke(m, k, now);
    woke = r.ev.find((e) => e.t === 'wake') || null;
  }
  ok(!!woke, 'a restless night: he wakes on a stroke');
  ok(b.owed === R.WAKE_MS && m.round.until >= m.round.base + R.WAKE_MS, 'the play window\'s clock stands still while he rages (the board gets the rage\'s time back)', [b.owed, m.round.until - m.round.base]);
  ok(woke && woke.fell.length >= 1 && woke.fell.every((x) => x.k !== 1 && x.lost >= 1) && woke.fell.some((x) => x.k === woke.k), 'only the waker\'s feathers of the round fly away; kept ones stay', woke);
  ok(D.kid(m, 1).score === safe1, 'kept feathers never fly away');
  ok(b.awake && b.danger === 0 && b.night === 2, 'he is awake; the next night starts calm', [b.awake, b.danger, b.night]);
  ok(!D.stroke(m, 3, now + 400).ok, 'nobody rubs while he is angry');
  const sl = until(m, now, 'sleep', R.WAKE_MS + 400);
  ok(sl.hit && !b.awake, 'he falls asleep again after the angry wake-up', sl.hit);
  if (m.round.phase === 'pw') { D.kid(m, 3).feathers = 2; const again = D.stroke(m, 3, sl.now + 50); ok(again.ok && D.kid(m, 3).pile >= 1, 'the window goes on: new feathers collected from 0'); }
  // the window ends: everyone's feathers of the round are kept
  const out = toPhase(m, sl.now, 'pwout');
  const tally = out.hit.tally[0];
  ok(tally && tally.rows.length === 4 && Object.values(m.kids).every((r) => r.pile === 0 && r.safe), 'the tally: everyone\'s feathers of the round were kept', tally);
}
// ---------- my last feather keeps my feathers; a window where everyone is done ends early ----------
{
  const { m, now: t0 } = game(2, 5, 240);
  D.startPlay(m, t0);
  D.kid(m, 1).feathers = 1; D.kid(m, 2).feathers = 0;
  let { now } = toPhase(m, t0, 'pw');
  m.boards[0].danger = 0;
  const r = D.stroke(m, 1, now + 50);
  const wokeNow = r.ev.some((e) => e.t === 'wake');
  ok(wokeNow || (evOf(r.ev, 'bank').length === 1 && D.kid(m, 1).safe && D.kid(m, 1).score >= 1), 'my last feather: my feathers of the round are kept');
  const e = until(m, now + 50, 'round', 3000, null, (x) => x.phase === 'pwout');
  ok(e.hit && e.now - now <= 2000 + (wokeNow ? R.WAKE_MS + 600 : 0), 'everyone done: the window ends at once (no waiting on nothing)', e.now - now);
}
// ---------- the final round ×2, the clock, «¡FINAL!» ----------
{
  const { m, now: t0 } = game(4, 9, 120);
  D.startPlay(m, t0);
  let now = t0, fin = null, n = 0;
  for (let i = 0; i < 2000 && !fin; i++) {
    now += 100;
    const ev = D.tick(m, now, opts());
    if (ev.some((x) => x.t === 'frenzy' && !x.off)) n = m.round.n;
    fin = ev.find((x) => x.t === 'final') || null;
  }
  ok(fin && n >= 3 && n === m.round.n, 'the last round is the final round ×2', [n, m.round.n]);
  ok(now - t0 >= 120000 - 14000 && now - t0 <= 120000 + 6000, '«¡FINAL!» lands near the clock\'s end (a final window everyone finished ends early)', now - t0);
  // ×2: a stroke in the final round collects 2 feathers
  const g2 = game(4, 21, 60).m;
  D.startPlay(g2, t0);
  ok(g2.round.total === 2 && !g2.round.final, 'a 1-minute game: two rounds, the second one final', g2.round);
  const p = until(g2, t0, 'round', 80000, null, (e) => e.phase === 'pw' && e.final);
  ok(p.hit && g2.frenzy, 'the final round ×2 is on');
  g2.kids[1].feathers = 2; g2.kids[1].safe = false;
  g2.boards[0].danger = 0; g2.boards[0].awake = false;
  const st = D.stroke(g2, 1, p.now + 20);
  ok(st.ok && evOf(st.ev, 'pat')[0].pts === 2, 'in the final round every stroke is +2');
  // ±30 s
  const g3 = game(4, 23, 120).m;
  D.startPlay(g3, t0);
  const was = g3.round.total;
  const ev = [];
  ok(D.addTime(g3, 30000, t0 + 1000, ev) === 30000 && evOf(ev, 'round').length === 1, '«+30 s» re-plans the open window');
  ok(g3.round.total >= was, 'more time = as many rounds or more');
  const ev2 = [];
  const cut = D.addTime(g3, -30000, t0 + 2000, ev2);
  ok(cut === -30000, '«−30 s» takes 30 s off');
  // pause: everything waits
  const g4 = game(4, 25, 120).m;
  D.startPlay(g4, t0);
  const until0 = g4.round.until;
  D.shiftTimes(g4, 5000);
  ok(g4.round.until === until0 + 5000, 'a pause moves the window');
  // «Saltar» ends the window
  const g5 = game(4, 27, 120).m;
  D.startPlay(g5, t0);
  const sk = D.skip(g5, t0 + 500, opts());
  ok(evOf(sk, 'round').some((x) => x.phase === 'pwin'), '«Saltar» closes the question window');
  // «¡FINAL!» keeps everyone's feathers of the round
  const g6 = game(4, 29, 240).m;
  D.startPlay(g6, t0);
  g6.kids[1].feathers = 3;
  const p6 = toPhase(g6, t0, 'pw');
  g6.boards[0].danger = 0;
  D.stroke(g6, 1, p6.now + 20);
  const had = g6.kids[1].pile, sc = g6.kids[1].score;
  const f6 = D.final(g6, p6.now + 100);
  ok(evOf(f6, 'final').length === 1 && (g6.kids[1].score === sc + had), '«¡FINAL!»: everyone\'s feathers of the round are kept', [had, g6.kids[1].score]);
}
// ---------- views and the end ----------
{
  const { m, now: t0 } = game(4, 31, 120);
  D.startPlay(m, t0);
  const v = D.boardView(m, m.boards[0], () => true, t0);
  ok(v.seats.length === 4 && v.seats.every((s) => 'pile' in s && 'safe' in s && 'feathers' in s && 'score' in s) && !('code' in v.seats[0]), 'a board view: feathers collected, this round\'s, kept, in hand; never a code');
  const u = until(m, t0, 'q', 2000);
  const oq = D.openQ(m, u.hit.k, u.now);
  ok(oq && !('correctIdx' in oq) && oq.ms > 0, 'a reconnect gets its open question again, never its answer');
  for (let i = 0; i < 1400; i++) D.tick(m, t0 + 100 * i, opts());
  const fin = D.finish(m);
  ok(fin.count === 4 && fin.boards[0].rows.length === 4, 'the end: every kid ranked');
}

// ---------- a class simulation (the pace, the wake-ups, skill over luck) ----------
// styles: avg = an average kid (70 %, rubs gently, banks at a height it picked or when his face says «careful»);
// careful = 90 %, gentle, keeps its feathers when his face says «careful»; greedy = 70 %, scribbles, never banks; random = taps the first
// answer at once and scribbles; silent = never answers
const STY = {
  avg: { acc: 0.7, ans: [1500, 3600], gap: [520, 1100], bank: (r, b, want) => r.pile >= want || (b.cue >= 2 && Math.random() < 0.6) },
  careful: { acc: 0.9, ans: [1800, 3600], gap: [650, 1000], bank: (r, b) => b.cue >= (Number(process.env.DM_CARE) || 2) },
  greedy: { acc: 0.7, ans: [1500, 3600], gap: [300, 500], bank: () => false },
  random: { acc: 0.25, ans: [600, 900], gap: [260, 420], bank: () => false },
  silent: { acc: 0, ans: null },
};
function simulate(nKids, seed, mix, durS) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  Math.random = rand;
  const t0 = 5000000;
  const m = D.newGame(seed, durS || 120, t0);
  D.deal(m, Array.from({ length: nKids }, (_, i) => [i + 1, 'K' + (i + 1), 'dralingo']));
  const style = (k) => mix[(k - 1) % mix.length];
  const st = { pws: 0, pwWoke: 0, pws1: 0, pwWoke1: 0, wakes: 0, qPerWindow: [], strokes: 0 };
  const bot = {};
  Object.keys(m.kids).forEach((k) => { bot[k] = { ansAt: 0, ansFor: null, next: 0, want: 0, qs: 0 }; });
  D.startPlay(m, t0);
  let now = t0, phase = 'qw', boardWoke = {};
  for (let i = 0; i < (durS || 120) * 10 + 200 && m.phase === 'play'; i++) {
    now += 100;
    const ev = D.tick(m, now, opts());
    ev.forEach((e) => {
      if (e.t === 'q') bot[e.k].qs++;
      if (e.t === 'wake') { st.wakes++; boardWoke[e.b] = true; }
      if (e.t === 'round') {
        if (e.phase === 'pw') { boardWoke = {}; }
        if (e.phase === 'pwout') { m.boards.forEach((b) => { if (b.seats.length === 4) { if (e.n === 1) { st.pws1++; if (boardWoke[b.id]) st.pwWoke1++; } else { st.pws++; if (boardWoke[b.id]) st.pwWoke++; } } }); }
        if (e.phase === 'pwin') Object.values(bot).forEach((x) => { st.qPerWindow.push(x.qs); x.qs = 0; });
        phase = e.phase;
      }
    });
    Object.values(m.kids).forEach((r) => {
      const S = STY[style(r.k)], x = bot[r.k], b = D.boardOf(m, r.b);
      if (!S.ans) return;
      if (m.round.phase === 'qw' && r.q) {
        if (x.ansFor !== r.q.qid) { x.ansFor = r.q.qid; x.ansAt = now + S.ans[0] + rand() * (S.ans[1] - S.ans[0]); D.seen(m, r.k, r.q.qid); }
        else if (now >= x.ansAt) { const right = rand() < S.acc; D.answer(m, r.k, r.q.qid, right ? r.q.correctIdx : (r.q.correctIdx + 1) % 4, now); }
      }
      if (m.round.phase === 'pw' && !b.awake && !r.safe && r.feathers > 0) {
        if (!x.next) { x.next = now + 300 + rand() * 1300; x.want = 1 + Math.floor(rand() * 4); return; }
        if (now < x.next) return;
        if (r.pile > 0 && S.bank(r, b, x.want * (m.frenzy ? 2 : 1))) { D.bank(m, r.k); return; }
        x.next = now + S.gap[0] + rand() * (S.gap[1] - S.gap[0]);
        const res = D.stroke(m, r.k, now);
        if (res.ok) st.strokes++;
        res.ev.forEach((e) => { if (e.t === 'wake') { st.wakes++; boardWoke[e.b] = true; } });
      }
      if (m.round.phase !== 'pw') x.next = 0;
    });
  }
  const scoreBy = {};
  Object.values(m.kids).forEach((r) => { const k = style(r.k); (scoreBy[k] = scoreBy[k] || []).push(r.score); });
  return { pws: st.pws, pwWoke: st.pwWoke, pws1: st.pws1, pwWoke1: st.pwWoke1, wakes: st.wakes, boards: m.boards.length, rounds: m.round.n, qPerWindow: st.qPerWindow, scoreBy, strokes: st.strokes };
}
const SIM = process.argv.includes('--sim');
const realRandom = Math.random;
const runs = [];
const MIXES = { avg: ['avg'], skill: ['careful', 'avg', 'greedy', 'random'], silent: ['avg', 'avg', 'avg', 'silent'] };
Object.entries(MIXES).forEach(([name, mix]) => [12, 28].forEach((n) => [1, 2, 3, 4, 5, 6, 7, 8].forEach((seed) => {
  const r = simulate(n, seed * 31 + n, mix, 120); r.mix = name; r.n = n; runs.push(r);
})));
Math.random = realRandom;
const by = (name) => runs.filter((r) => r.mix === name);
const sum = (rs, f) => rs.reduce((a, r) => a + f(r), 0);
const wokeShare = (rs) => sum(rs, (r) => r.pwWoke) / Math.max(1, sum(rs, (r) => r.pws));
const scores = (rs, st) => rs.reduce((a, r) => a.concat(r.scoreBy[st] || []), []);
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const avgRuns = by('avg');
const share = wokeShare(avgRuns);
const perGame = sum(avgRuns, (r) => r.wakes) / sum(avgRuns, (r) => r.boards);
const qpw = avgRuns.reduce((a, r) => a.concat(r.qPerWindow), []);
const sk = by('skill');
const sCare = meanOf(scores(sk, 'careful')), sAvg = meanOf(scores(sk, 'avg')), sGreedy = meanOf(scores(sk, 'greedy')), sRand = meanOf(scores(sk, 'random'));
const sSilent = meanOf(scores(by('silent'), 'silent')), sAvg2 = meanOf(scores(by('silent'), 'avg'));
if (SIM) {
  console.log('avg kids: play windows', sum(avgRuns, (r) => r.pws), 'woke in', (share * 100).toFixed(0) + '% after the first (the first, a lesson:', (100 * sum(avgRuns, (r) => r.pwWoke1) / Math.max(1, sum(avgRuns, (r) => r.pws1))).toFixed(0) + '%)', '| wakes per board per 2-min game', perGame.toFixed(2), '| rounds', meanOf(avgRuns.map((r) => r.rounds)).toFixed(1));
  console.log('questions per kid per window: mean', meanOf(qpw).toFixed(1), 'min', Math.min(...qpw));
  console.log('skill mix scores: careful', sCare.toFixed(1), 'avg', sAvg.toFixed(1), 'greedy', sGreedy.toFixed(1), 'random', sRand.toFixed(1), '| woke', (wokeShare(sk) * 100).toFixed(0) + '%');
  console.log('silent', sSilent.toFixed(1), 'vs avg', sAvg2.toFixed(1));
}
ok(share >= 0.5 && share <= 0.85, 'he wakes in MOST play windows of a board of 4 after the first one (50-85 %)', share);
ok(share < 1, 'never every time (never predictable)');
ok(meanOf(avgRuns.map((r) => r.rounds)) >= 3.5, 'a 2-minute game: about 4 rounds', meanOf(avgRuns.map((r) => r.rounds)));
ok(meanOf(qpw) >= 3, 'a question window gives every kid several questions (3+)', meanOf(qpw));
ok(sCare > sGreedy && sCare > sRand, 'skill decides: a careful kid beats a greedy one and a random tapper', [sCare, sGreedy, sRand]);
ok(sAvg > sRand, 'an average kid beats a random tapper', [sAvg, sRand]);
ok(sSilent === 0 && sAvg2 > 0, 'a kid who never answers builds nothing', [sSilent, sAvg2]);

console.log(`test-dormilon: ${checks} checks OK`);
