// Draly Siesta · ¡No despiertes a Dralingo! (gameType 'dormilon') — the rules, no sockets (server.js «NO DESPIERTES A
// DRALINGO» block glues them to the room). #3 of his Mario Party series: Super Mario Party «Don't Wake Wiggler» (his
// video y9BKCVx_mNk, 6:14-7:29) with our cast: Dralingo sleeps in a Chinese palace bedroom; the class plays in BOARDS OF
// 4 (the deal of core/halcon.js). v1 «a quiz with a sleeping dragon on top»; v2 turns + a finger rub; v3 a wake-up dice
// that grows with every tickle + the ANGRY wake-up on every screen.
// v4 (2026-10-24, after he played v3: "how do you get all the kids involved… very little window time to answer…
// every time you use the feather nothing happens… you build, construct, and at the end you see who wins… the dragon
// needs to awaken more often"): the «Windows» rhythm (core/teamcrab.js's machinery), class-wide rounds:
//   QUESTION WINDOW (~16 s, everyone at once): a right answer = a golden feather (at most 4; unused ones stay for the
//   next round); a wrong, late or blind answer = a feather flies off and he shifts in his sleep (the board's danger +1).
//   «¡A hacerle cosquillas!» → PLAY WINDOW (10 s): EVERY kid of the board rubs his head on their own phone AT THE SAME
//   TIME. One stroke spends a feather and puts +1 coin on MY tower of this round (+2 in the final round ×2), and raises
//   the board's danger (+1, a scribble +2): each unit is a dice roll whose chance grows with the danger since he fell
//   asleep, so he wakes in most play windows and never predictably. «¡Me retiro!» (or my last feather spent) puts my
//   tower in the safe. He wakes → the WAKER's tower of this round falls (comic, named on the board; everyone else's
//   stands: the risk is the one I choose with each stroke), the ANGRY wake-up on every phone of the board; then he falls asleep again (a new night, danger 0) and the window goes on.
//   The window ends → every standing tower goes to the safe → the tally.
// The clock ends the game: «¡FINAL!», the reveal of whose towers rose highest, the ceremony (bonus stars as honours).
// «🤖 Probar con robots» (teacher only): robots fill a board of 1-2 phones and play like an average kid; they never count.
// Every kid's numbers live in m.kids[k] (k = the server's stable id p.dmK), so a kid who left still counts at the end.
// Spec: docs/specs/no-despiertes-a-dralingo.md. The server emits the events every function returns ({ t, b, … }).
'use strict';
const Party = require('./party');      // clockShift (the teacher's «−30 s»), stars
const Halcon = require('./halcon');    // boards of 4 (splitBoards), mulberry32, shuffle, pickOrder

const R = {
  DURATIONS: [120, 180, 240], DURATION: 120,   // (his pick 2026-10-22: "3 minutes is a lot")
  INTRO_MS: 2600,            // «¡Shhh! Dralingo duerme…» → «¡YA!» after the 3.5 s run-in countdown
  // a round = question window + «¡A hacerle cosquillas!» + play window + the tally (≈ 4 rounds in 2 minutes)
  ROUND_MS: 30000, QW_MIN: 12000, QW_MAX: 20000, PW_IN_MS: 1600, PW_MS: 10000, PW_OUT_MS: 1800, PW_MIN: 6000,
  Q_TIME_MS: 12000,          // a question's time (time to read and answer; it never outlives its window: withdrawn free)
  FAST_MS: 500,              // an answer sooner than this = a blind guess = wrong
  NEXT_Q_MS: 300, WRONG_WAIT_MS: 1300,
  FEATHERS_MAX: 4,           // a full quiver (his brief: max 4); unused feathers stay for the next round
  MIN_STROKE_MS: 250,        // strokes closer than this are noise (never counted)
  GENTLE_MS: 550,            // a stroke sooner than this after my last one = a scribble: +3 danger (three rolls)
  PAT_DANGER: 1, FAST_DANGER: 3, WRONG_DANGER: 1,   // a scribble = 3 rolls (rubbing fast is the risky way: the sim's careful kid beats the greedy one)
  HAZ_BASE: 0.03, HAZ: 0.016, HAZ_MAX: 0.4,   // the chance a danger unit wakes him = HAZ_BASE + HAZ × the danger since he fell asleep (sim-tuned)
  CUES: [[0.07, 0.085], [0.11, 0.13], [0.17, 0.19]],   // the chance where his cues 1 · 2 · 3 start (jittered per night; sim-tuned)
  SAFE_FIRST: 1,             // the game's first play window: this many tickles per kid of the board never wake him (they learn the rub; sim: he still wakes in ~15 % of first windows)
  KEEP: 1,                   // the share of the danger that survives the question window (1 = he stays restless: sim-tuned)
  WAKE_MS: 3800,             // «¡Se despertó!»: he bolts up ANGRY on every phone of the board, the waker's tower falls
  PW_EXTRA_MAX: 7600,        // the play window waits for a wake-up (its time stands still while he rages): at most two wake-ups' worth per board
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  BOARD: 4, BOARD_MAX: 5,    // the size of a Mario Party match; a late joiner can make a board of 5, never 6
  ROBOT_BOARD: 4, ROBOT_HUMANS_MAX: 2,   // «🤖 Probar con robots» fills only a board of 1-2 phones up to 4 (a real class gets none)
  ROBOT: { ACC: 0.7, ANS_MIN: 1500, ANS_MAX: 3600, RUB_MIN: 520, RUB_MAX: 1100, START_MIN: 300, START_MAX: 1600 },
  REACTS: ['shh', 'wow', 'lol', 'clap'], REACT_GAP_MS: 1200,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 60, 600);
const rnd = (m, a, b) => a + m.rng() * (b - a);

function newGame(seed, durationS, now) {
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration: clampDuration(durationS),
    phase: 'countdown', phaseAt: now, phaseUntil: now, endsAt: 0, frenzy: false,
    paused: false, pausedAt: 0, boards: [], kids: {}, nextBoard: 1, qn: 0, round: null,
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const inGame = (m, k) => !!kid(m, k);
const boardOf = (m, id) => (m ? m.boards.find((b) => b.id === id) || null : null);

function newKid(k, name, skin, b, code, robot) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b, code: code ? String(code) : '', robot: !!robot,  // (code: server only, never in a view)
    score: 0,                  // the coins in the safe (the game's points)
    pile: 0, safe: false,      // my tower of this round (not in the safe yet) · it is in the safe this round
    feathers: 0, pats: 0, right: 0, wrong: 0, late: 0, fast: 0, answered: 0, streak: 0, best: 0,
    wakes: 0, falls: 0, lost: 0, saved: 0, big: 0, scribbles: 0, earned: 0, featherLost: 0, rounds: 0,
    first: true, awaySince: 0, lastReact: 0, lastStroke: 0, q: null, qNextAt: 0, order: [], qi: 0, got: 0,
    bot: { ansAt: 0, ansFor: null, nextAt: 0, want: 0 },
  };
}
// A night: the danger back to 0, new cue cuts (jittered: a cue says «riskier», never how many tickles are left).
function newNight(m, b) {
  b.cuts = R.CUES.map(([a, z]) => a + m.rng() * (z - a));
  b.danger = 0;
  b.cue = 0;
}
function addBoard(m) {
  const b = { id: m.nextBoard++, seats: [], night: 1, danger: 0, safeLeft: 0, cuts: [], cue: 0, awake: false, wakeUntil: 0, waker: null, wakesRound: 0, wakes: 0 };
  newNight(m, b);
  m.boards.push(b);
  return b;
}
function seatIn(m, b, k, name, skin, code, robot) {
  m.kids[k] = newKid(k, name, skin, b.id, code, robot);
  b.seats.push(k);
  return m.kids[k];
}
// The start: every kid gets a seat; boards of 4 (3 when it doesn't divide; ≤ 5 kids = one board). entries: [[k, name, skin, code]]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin, code]) => { byK[k] = [name, skin, code]; });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addBoard(m);
    ks.forEach((k) => seatIn(m, b, k, byK[k][0], byK[k][1], byK[k][2], false));
  });
  return m.boards;
}
// A late joiner sits at the smallest board that still has room (max 5); every board full → a new board. A kid already
// seated keeps the seat (null).
function seatLate(m, k, name, skin, code) {
  if (inGame(m, k)) return null;
  const open = m.boards.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(m);
  const r = seatIn(m, b, k, name, skin, code, false);
  if (m.round && (m.round.phase === 'pw' || m.round.phase === 'pwin')) r.safe = true;   // (seated mid play window: no feathers yet, nothing to risk)
  return b;
}
const people = (m, b) => b.seats.filter((x) => !(kid(m, x) || {}).robot).length;
// «🤖 Probar con robots»: a robot sits in the smallest board of 1-2 phones (the teacher's own, when he plays alone), up
// to 4 seats; a board of 3+ kids (a real class, even with the robots left on) gets none. A robot never opens a board.
function seatRobot(m, k, name, skin) {
  if (inGame(m, k)) return null;
  const open = m.boards.filter((b) => b.seats.length < R.ROBOT_BOARD && people(m, b) >= 1 && people(m, b) <= R.ROBOT_HUMANS_MAX)
    .sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0];
  if (!b) return null;
  seatIn(m, b, k, name, skin, '', true);
  return b;
}
// A kid back after the room forgot their phone (5 min away): their own row, by the student code the server proved
// (null when there is none, or that row is playing on another phone right now)
function byCode(m, code, online) {
  if (!code) return null;
  const r = Object.values(m.kids).find((x) => x.code && x.code === String(code));
  return r && !(online && online(r.k)) ? r : null;
}

// ---------- the clock and the rounds ----------
const FIXED = () => R.PW_IN_MS + R.PW_MS + R.PW_OUT_MS;
const MIN_ROUND = () => 4000 + R.PW_IN_MS + R.PW_MIN + R.PW_OUT_MS;
function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.endsAt = now + m.duration * 1000;
  m.phaseUntil = m.endsAt;
  m.frenzy = false;
  m.round = { n: 0, phase: 'none', at: now, until: now, total: 0, final: false, pwMs: R.PW_MS };
  const ev = [];
  nextRound(m, now, ev);
  return ev;
}
// the schedule of a question window opening now: its length, whether it is the final round, its play window
function plan(m, now) {
  const left = m.endsAt - now;
  const roundsLeft = Math.max(1, Math.round(left / R.ROUND_MS));
  if (roundsLeft > 1) return { qw: clamp(left / roundsLeft - FIXED(), R.QW_MIN, R.QW_MAX), final: false, roundsLeft, pw: R.PW_MS };
  const qw = clamp(left - FIXED(), 4000, R.QW_MAX + 4000);
  return { qw, final: true, roundsLeft: 1, pw: clamp(left - qw - R.PW_IN_MS - R.PW_OUT_MS, R.PW_MIN, R.PW_MS) };
}
// the final round ×2 («¡Luna llena!»: every stroke +2)
function setFinal(m, r, fin, now, ev) {
  r.final = fin;
  if (fin && !m.frenzy) { m.frenzy = true; ev.push({ t: 'frenzy', endsMs: Math.max(0, m.endsAt - now) }); }
  else if (!fin && m.frenzy) { m.frenzy = false; ev.push({ t: 'frenzy', off: true, endsMs: Math.max(0, m.endsAt - now) }); }
}
function nextRound(m, now, ev) {
  const left = m.endsAt - now;
  if (left < MIN_ROUND() && (m.frenzy || left < 6000)) { ev.push.apply(ev, final(m, now)); return; }
  const p = left < MIN_ROUND() ? { qw: 2500, final: true, roundsLeft: 1, pw: R.PW_MIN } : plan(m, now);   // (a «−30 s» left no room: a short final round on the feathers kept)
  const r = m.round;
  r.n++; r.phase = 'qw'; r.at = now; r.until = now + p.qw; r.total = r.n + p.roundsLeft - 1; r.pwMs = p.pw;
  setFinal(m, r, p.final, now, ev);
  Object.values(m.kids).forEach((k) => { k.pile = 0; k.safe = false; k.got = 0; k.qNextAt = now + 250; k.bot.nextAt = 0; });
  ev.push({ t: 'round', phase: 'qw', n: r.n, total: r.total, final: r.final, ms: p.qw });
}
// the question window closes: open questions are withdrawn (free), «¡A hacerle cosquillas!»
function toPlayIn(m, now, ev) {
  const r = m.round;
  r.phase = 'pwin'; r.at = now; r.until = now + R.PW_IN_MS;
  Object.values(m.kids).forEach((k) => { if (k.q) { k.q = null; ev.push({ t: 'qx', b: k.b, k: k.k }); } });
  m.boards.forEach((b) => {
    b.wakesRound = 0;
    if (b.awake) { b.awake = false; b.wakeUntil = 0; ev.push({ t: 'sleep', b: b.id, night: b.night, cue: 0 }); }
    b.danger = Math.floor(b.danger * R.KEEP);         // (during the questions he sank into a deeper sleep: part of the danger fades)
    b.cue = cueOf(b);
    ev.push({ t: 'ready', b: b.id, feathers: b.seats.map((k) => { const x = kid(m, k); return { k, feathers: x ? x.feathers : 0 }; }), cue: b.cue, night: b.night });
  });
  ev.push({ t: 'round', phase: 'pwin', n: r.n, total: r.total, final: r.final, ms: R.PW_IN_MS });
}
function toPlay(m, now, ev) {
  const r = m.round;
  r.phase = 'pw'; r.at = now; r.until = now + (r.pwMs || R.PW_MS); r.base = r.until;
  m.boards.forEach((b) => { b.owed = 0; b.done = false; });
  if (r.n === 1) m.boards.forEach((b) => { b.safeLeft = R.SAFE_FIRST * b.seats.length; });   // (each kid's first tickle of the game is safe: the guided window)
  Object.values(m.kids).forEach((x) => {
    x.lastStroke = 0;
    x.rounds++;
    if (x.feathers <= 0) x.safe = true;                  // (no feathers: nothing to risk this window)
  });
  ev.push({ t: 'round', phase: 'pw', n: r.n, total: r.total, final: r.final, ms: r.until - now });
}
// the play window ends: every tower still standing goes to the safe; the tally (it waits for a board still raging)
function toPlayOut(m, now, ev) {
  const r = m.round;
  let until = now + R.PW_OUT_MS;
  const tally = m.boards.map((b) => {
    if (b.awake) until = Math.max(until, b.wakeUntil + 400);
    const rows = b.seats.map((k) => {
      const x = kid(m, k);
      if (!x) return null;
      if (!x.safe) bankIt(m, x);
      if (x.first && x.rounds > 0) x.first = false;
      return { k, got: x.got, score: x.score, feathers: x.feathers };
    }).filter(Boolean);
    return { b: b.id, rows, wakes: b.wakesRound };
  });
  r.phase = 'pwout'; r.at = now; r.until = until;
  ev.push({ t: 'round', phase: 'pwout', n: r.n, total: r.total, final: r.final, ms: until - now, tally });
}
// the teacher's «+30 s» / «−30 s»: the change that really applies (Party.clockShift: a cut stops 10 s before the end)
function addTime(m, ms, now, ev) {
  if (m.phase !== 'play') return 0;
  const d = Party.clockShift(m.endsAt, ms, now);
  if (!d) return 0;
  m.endsAt += d;
  m.phaseUntil = m.endsAt;
  if (d > 0) m.duration += d / 1000;
  replan(m, now, ev || []);
  return d;
}
// the clock moved (±30 s): the open question window takes its new length (and becomes the final round, or stops being
// it); an open play window never runs past the clock
function replan(m, now, ev) {
  const r = m.round;
  if (!r) return;
  if (r.phase === 'qw') {
    const left = m.endsAt - r.at;
    const p = left < MIN_ROUND() ? { qw: 2500, final: true, roundsLeft: 1, pw: R.PW_MIN } : plan(m, r.at);
    r.until = Math.max(now + 1500, r.at + p.qw);
    Object.values(m.kids).forEach((x) => { if (x.q && x.q.sentAt) x.q.until = Math.min(x.q.sentAt + R.Q_TIME_MS, r.until - 150); });
    r.total = r.n + p.roundsLeft - 1;
    r.pwMs = p.final ? clamp(m.endsAt - r.until - R.PW_IN_MS - R.PW_OUT_MS, R.PW_MIN, R.PW_MS) : p.pw;
    setFinal(m, r, p.final, now, ev);
    ev.push({ t: 'round', phase: 'qw', n: r.n, total: r.total, final: r.final, ms: r.until - now });
  } else if (r.phase === 'pwin' || r.phase === 'pw' || r.phase === 'pwout') {
    let changed = false;
    if (r.phase === 'pwin') { const pw = clamp(m.endsAt - r.until - R.PW_OUT_MS, R.PW_MIN, R.PW_MS); if (pw < (r.pwMs || R.PW_MS)) { r.pwMs = pw; changed = true; } }
    if (r.phase === 'pw') { const cap = Math.max(now + 1500, m.endsAt - R.PW_OUT_MS); if (r.until > cap) { r.until = cap; changed = true; } if (r.base > r.until) r.base = r.until; }
    const roundEnd = r.phase === 'pwin' ? r.until + (r.pwMs || R.PW_MS) + R.PW_OUT_MS : r.phase === 'pw' ? r.until + R.PW_OUT_MS : r.until;
    const fin = m.endsAt - roundEnd < MIN_ROUND();
    if (r.phase !== 'pwout' && fin !== !!r.final && (fin || r.phase === 'pwin')) {
      setFinal(m, r, fin, now, ev);
      r.total = fin ? r.n : r.n + Math.max(1, Math.round((m.endsAt - roundEnd) / R.ROUND_MS));
      changed = true;
    }
    if (changed) ev.push({ t: 'round', phase: r.phase, n: r.n, total: r.total, final: r.final, ms: Math.max(0, r.until - now) });
  }
}
// the teacher paused for `ms`: every pending moment moves by that much
function shiftTimes(m, ms) {
  m.phaseAt += ms; m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.round) { m.round.at += ms; m.round.until += ms; if (m.round.base) m.round.base += ms; }
  m.lastTick = 0;
  m.boards.forEach((b) => { if (b.wakeUntil) b.wakeUntil += ms; });
  Object.values(m.kids).forEach((r) => {
    if (r.awaySince) r.awaySince += ms;
    if (r.qNextAt) r.qNextAt += ms;
    if (r.q && r.q.until) r.q.until += ms;
    if (r.q && r.q.sentAt) r.q.sentAt += ms;
    if (r.lastStroke) r.lastStroke += ms;
    if (r.bot.ansAt) r.bot.ansAt += ms;
    if (r.bot.nextAt) r.bot.nextAt += ms;
  });
}

// ---------- the danger ----------
// the chance that one more danger unit wakes him now (it grows with every tickle since he fell asleep)
const chanceAt = (d) => (d > 0 ? Math.min(R.HAZ_MAX, R.HAZ_BASE + R.HAZ * d) : 0);
function cueOf(b) {
  if (!b.danger) return 0;
  const p = chanceAt(b.danger);
  return b.cuts.filter((c) => p >= c).length;
}
// danger rises by `amount` units, each one a dice roll; true = he wakes up now
function rise(m, b, amount) {
  let woke = false;
  for (let i = 0; i < amount; i++) {
    b.danger++;
    if (b.safeLeft > 0) { b.safeLeft--; continue; }      // (the game's first play window: everyone's first tickles teach, never wake)
    if (!woke && m.rng() < chanceAt(b.danger)) woke = true;
  }
  b.cue = cueOf(b);
  return woke;
}
// a wrong or late answer: he shifts in his sleep (the board's danger +WRONG_DANGER, never a roll: only a stroke wakes
// him). → the event for the board, or null while he is awake
function shift(m, b, k, why) {
  if (!b || b.awake) return null;
  b.danger += R.WRONG_DANGER;
  b.cue = cueOf(b);
  return { t: 'shift', b: b.id, k, why, cue: b.cue };
}

// ---------- questions ----------
// A kid's next question: their own shuffled order of the pack (answers that fit a tile first), the answers shuffled,
// the right one kept here; never past `cap` (its window's end). imageFor(q) → a picture url or null.
function nextQ(m, h, questions, imageFor, now, cap) {
  if (!h.order.length || h.qi >= h.order.length) { h.order = Halcon.pickOrder(questions, m.rng); h.qi = 0; }
  if (!h.order.length) return null;
  const src = questions[h.order[h.qi++]];
  if (!src) return null;
  const answers = Halcon.shuffle([src.correct].concat(src.answers.filter((a) => a !== src.correct)).slice(0, 4).map(String), m.rng);
  m.qn++;
  return {
    qid: `dm${m.id % 100000}-${h.k}-${m.qn}`, text: String(src.text), answers, correctIdx: answers.indexOf(String(src.correct)),
    image: imageFor ? imageFor(src) || null : null, sentAt: now, until: Math.min(now + R.Q_TIME_MS, cap || Infinity),
  };
}
// what a phone may see of a question (never the right answer before it is answered)
const qPublic = (q) => (q ? { qid: q.qid, text: q.text, answers: q.answers, image: q.image } : null);

// a miss of mine (wrong / late / blind): a feather flies off (if any) and he shifts in his sleep
function miss(m, r, now, ev) {
  r.wrong++; r.streak = 0;
  if (r.feathers > 0) { r.feathers--; r.featherLost++; }
  r.qNextAt = now + R.WRONG_WAIT_MS;
  const sh = shift(m, boardOf(m, r.b), r.k, 'wrong');
  if (sh) ev.push(sh);
}
// A quiz answer (question window only). Right = one more feather (at most FEATHERS_MAX); wrong / blind = «¡Casi!», one
// feather flies off and he shifts. → { ok, right, ev } (qr for the kid; the server tells the board the new count)
function answer(m, k, qid, idx, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || !r.q || !m.round || m.round.phase !== 'qw') return { ok: false, why: 'closed', ev: [] };
  if (r.q.qid !== qid) return { ok: false, why: 'stale', ev: [] };
  if (!Number.isInteger(idx) || idx < 0 || idx >= r.q.answers.length) return { ok: false, why: 'bad', ev: [] };
  const q = r.q;
  r.q = null;
  r.answered++;
  const tooFast = now - q.sentAt < R.FAST_MS;               // (nobody reads a question that fast: a guess = wrong)
  const ok = idx === q.correctIdx && !tooFast;
  const before = r.feathers;
  const ev = [];
  if (ok) {
    r.right++; r.streak++; r.best = Math.max(r.best, r.streak);
    r.feathers = Math.min(R.FEATHERS_MAX, r.feathers + 1);
    r.earned += r.feathers - before;
    r.qNextAt = now + R.NEXT_Q_MS;
  } else {
    if (tooFast) r.fast++;
    miss(m, r, now, []);
  }
  ev.push({ t: 'qr', b: r.b, k, qid: q.qid, idx, ok, tooFast, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], feathers: r.feathers, gained: r.feathers - before, streak: r.streak, full: r.feathers >= R.FEATHERS_MAX, waitMs: ok ? R.NEXT_Q_MS : R.WRONG_WAIT_MS });
  if (!ok) { const b = boardOf(m, r.b); if (b && !b.awake) ev.push({ t: 'shift', b: b.id, k, why: tooFast ? 'fast' : 'wrong', cue: b.cue }); }
  return { ok: true, right: ok, ev };
}
// The phone painted its question on a visible screen (a pocketed or locked phone never pays for a late one).
function seen(m, k, qid) {
  const r = kid(m, k);
  if (!r || !r.q || r.q.qid !== qid) return false;
  r.q.seen = true;
  return true;
}
// A question the phone showed, left to run out (online kids only): late = wrong.
function late(m, r, now) {
  const q = r.q;
  r.q = null;
  r.answered++; r.late++;
  const before = r.feathers;
  miss(m, r, now, []);
  const ev = [{ t: 'qr', b: r.b, k: r.k, qid: q.qid, idx: -1, ok: false, late: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], feathers: r.feathers, gained: r.feathers - before, streak: 0, full: false, waitMs: R.WRONG_WAIT_MS }];
  const b = boardOf(m, r.b);
  if (b && !b.awake) ev.push({ t: 'shift', b: b.id, k: r.k, why: 'late', cue: b.cue });
  return ev;
}

// ---------- the play window: rub, build, bank ----------
const playing = (m) => m.phase === 'play' && !m.paused && m.round && m.round.phase === 'pw';
function bankIt(m, r) {
  r.safe = true;
  if (r.pile > 0) { r.score += r.pile; r.got += r.pile; r.saved++; r.big = Math.max(r.big, r.got); }
  r.pile = 0;
}
// He wakes up: the waker's tower of this round falls (the others stand), the ANGRY wake-up on the board; he sleeps
// again WAKE_MS later (a new night) and the window goes on.
function wake(m, b, now, k, ev) {
  const fell = [];
  b.seats.forEach((x) => {
    const r = kid(m, x);
    if (!r || r.k !== k || r.pile <= 0) return;
    fell.push({ k: r.k, coins: r.pile });
    r.lost += r.pile; r.falls++;
    r.pile = 0;
  });
  const w = kid(m, k);
  if (w) w.wakes++;
  b.awake = true;
  b.wakeUntil = now + R.WAKE_MS;
  b.waker = k;
  b.wakes++; b.wakesRound++;
  b.night++;
  newNight(m, b);
  ev.push({ t: 'wake', b: b.id, k, fell, ms: R.WAKE_MS, night: b.night });
  // the window's clock stands still while he rages (playtest 2026-10-24: two wake-ups left 2 s to rub, «no me dejó jugar»):
  // the board is owed the rage's time (at most PW_EXTRA_MAX a window); the class window lasts until the latest board's
  // make-up time (boards that didn't wake just get longer to play); the final round never 5 s past the clock
  const rd = m.round;
  if (rd && rd.phase === 'pw') {
    b.owed = Math.min(R.PW_EXTRA_MAX, (b.owed || 0) + R.WAKE_MS);
    let end = (rd.base || rd.until) + b.owed;
    if (rd.final && m.endsAt) end = Math.min(end, Math.max(rd.base || rd.until, m.endsAt + 5000));
    if (end > rd.until) { const add = end - rd.until; rd.until = end; ev.push({ t: 'pwmore', ms: rd.until - now, add }); }
  }
}
// One stroke of a golden feather on his head (my finger: one back-and-forth rub), play window only: a feather → +1
// coin on my tower (+2 in the final round); gentle = +1 danger, a scribble (sooner than GENTLE_MS after my last) = +2.
// My last feather puts my tower in the safe. → { ok, why, ev } (ev: pat, then maybe wake / bank)
function stroke(m, k, now) {
  const r = kid(m, k);
  if (!r || !playing(m)) return { ok: false, why: 'closed', ev: [] };
  const b = boardOf(m, r.b);
  if (!b) return { ok: false, why: 'closed', ev: [] };
  if (b.awake) return { ok: false, why: 'awake', ev: [] };
  if (b.done) return { ok: false, why: 'closed', ev: [] };
  if (r.safe) return { ok: false, why: 'safe', ev: [] };
  if (r.feathers <= 0) return { ok: false, why: 'empty', ev: [] };
  if (r.lastStroke && now - r.lastStroke < R.MIN_STROKE_MS) return { ok: false, why: 'noise', ev: [] };
  const fast = !!r.lastStroke && now - r.lastStroke < R.GENTLE_MS;
  r.lastStroke = now;
  r.feathers--;
  const pts = m.frenzy ? 2 : 1;
  r.pats++; r.pile += pts;
  if (fast) r.scribbles++;
  const woke = rise(m, b, fast ? R.FAST_DANGER : R.PAT_DANGER);
  const ev = [{ t: 'pat', b: b.id, k, pts, pile: r.pile, score: r.score, cue: woke ? 4 : b.cue, x2: m.frenzy, fast, feathers: r.feathers }];
  if (woke) wake(m, b, now, k, ev);
  else if (r.feathers <= 0) { const pile = r.pile; bankIt(m, r); ev.push({ t: 'bank', b: b.id, k, pile, score: r.score, why: 'empty' }); }
  return { ok: true, ev };
}
// «¡Me retiro!»: my tower of this round goes to the safe (feathers kept for the next round)
function bank(m, k) {
  const r = kid(m, k);
  if (!r || !playing(m) || r.safe) return [];
  const b = boardOf(m, r.b);
  if (!b || b.awake) return [];
  const pile = r.pile;
  bankIt(m, r);
  return [{ t: 'bank', b: b.id, k, pile, score: r.score, why: 'stop', feathers: r.feathers }];
}
// a reaction (🤫 😱 😂 👏) from a kid of the board, at most one per REACT_GAP_MS
function react(m, k, e, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || !R.REACTS.includes(e) || (r.lastReact && now - r.lastReact < R.REACT_GAP_MS)) return null;
  r.lastReact = now;
  return { b: r.b, k, e };
}

// ---------- the robots (teacher-only «🤖 Probar con robots»): an average kid ----------
// answers at 70 % in 1.5-3.6 s; rubs gently (a scribble now and then), and puts the tower in the safe at a height it
// picked or when his face says «careful» (cue 2+), like a kid who watches him
function robotTick(m, b, r, now, ev) {
  const B = R.ROBOT, bt = r.bot, rd = m.round;
  if (!rd) return;
  if (rd.phase === 'qw' && r.q) {
    if (bt.ansFor !== r.q.qid) { bt.ansFor = r.q.qid; bt.ansAt = now + rnd(m, B.ANS_MIN, B.ANS_MAX); }
    else if (now >= bt.ansAt) {
      const q = r.q;
      const idx = m.rng() < B.ACC ? q.correctIdx : (q.correctIdx + 1 + Math.floor(m.rng() * (q.answers.length - 1))) % q.answers.length;
      ev.push.apply(ev, answer(m, r.k, q.qid, idx, now).ev);
    }
    return;
  }
  if (rd.phase !== 'pw' || r.safe || r.feathers <= 0) return;
  if (b.awake) { bt.nextAt = b.wakeUntil + rnd(m, B.START_MIN, B.START_MAX); return; }   // (a kid waits a moment after he falls asleep again: never all at once)
  if (!bt.nextAt) { bt.nextAt = now + rnd(m, B.START_MIN, B.START_MAX); bt.want = 1 + Math.floor(m.rng() * 4); return; }
  if (now < bt.nextAt) return;
  if (r.pile > 0 && (r.pile >= bt.want * (m.frenzy ? 2 : 1) || (b.cue >= 2 && m.rng() < 0.6))) { ev.push.apply(ev, bank(m, r.k)); return; }
  bt.nextAt = now + rnd(m, B.RUB_MIN, B.RUB_MAX);
  const res = stroke(m, r.k, now);
  if (res.ok) ev.push.apply(ev, res.ev);
}

// ---------- the tick (the server calls it every 100 ms while the game plays) ----------
// opts: { questions, imageFor(q), online(k) → bool }. Returns the events to send.
function tick(m, now, opts) {
  const ev = [];
  if (m.paused || m.phase !== 'play' || !m.round) return ev;
  const o = opts || {};
  const online = (k) => { const r = kid(m, k); return !!(r && r.robot) || (o.online ? o.online(k) : true); };
  m.lastTick = now;
  Object.values(m.kids).forEach((r) => { if (online(r.k)) r.awaySince = 0; else if (!r.awaySince) r.awaySince = now; });
  const rd = m.round;
  m.boards.forEach((b) => {
    if (b.awake && now >= b.wakeUntil) {                  // he falls asleep again: a new night (the danger back to 0)
      b.awake = false;
      ev.push({ t: 'sleep', b: b.id, night: b.night, cue: b.cue });
    }
    b.seats.forEach((k) => { const r = kid(m, k); if (r && r.robot) robotTick(m, b, r, now, ev); });
  });
  if (rd.phase === 'qw') {
    Object.values(m.kids).forEach((r) => {
      if (r.q && now >= (r.q.until || r.q.sentAt + R.Q_TIME_MS) + 300) {   // the question ran out: late = it costs
        if (online(r.k) && (r.q.seen || r.robot) && now < rd.until) ev.push.apply(ev, late(m, r, now)); else r.q = null;   // (only one the phone showed)
      }
      if (!r.q && now >= r.qNextAt && online(r.k) && rd.until - now > 2500) {
        r.q = nextQ(m, r, o.questions || [], o.imageFor, now, rd.until - 150);
        if (r.q) { if (r.robot) r.q.seen = true; ev.push({ t: 'q', b: r.b, k: r.k, q: r.q, feathers: r.feathers, ms: r.q.until - now }); }
        else r.qNextAt = now + 2000;        // (no usable question: try again in a moment)
      }
    });
    if (now >= rd.until) toPlayIn(m, now, ev);
  } else if (rd.phase === 'pwin') { if (now >= rd.until) toPlay(m, now, ev); }
  else if (rd.phase === 'pw') {
    // a board where everyone is done (in the safe, out of feathers or gone) and he sleeps: its tally comes at once (the
    // 4-fps film showed a phone standing still for 5 s while other boards played; now the reveal of the round comes)
    m.boards.forEach((b) => {
      if (b.done || b.awake) return;
      const all = b.seats.map((k) => kid(m, k)).filter(Boolean);
      if (!all.length || !all.every((r) => r.safe || r.feathers <= 0 || !online(r.k))) return;
      b.done = true;
      all.forEach((r) => { if (!r.safe) bankIt(m, r); });
      ev.push({ t: 'bdone', b: b.id, rows: all.map((r) => ({ k: r.k, got: r.got, score: r.score, feathers: r.feathers })) });
    });
    // every kid of the class done (in the safe or out of feathers) and nobody raging: the window ends now
    const live = Object.values(m.kids).some((r) => !r.safe && r.feathers > 0 && online(r.k));
    if (!live && rd.until - now > 1200) {
      const raging = m.boards.filter((b) => b.awake).map((b) => b.wakeUntil + 400);
      const end = Math.max(now + 1200, ...raging);
      if (end < rd.until) { rd.until = end; ev.push({ t: 'pwmore', ms: end - now, add: 0 }); }
    }
    if (now >= rd.until) toPlayOut(m, now, ev);
  } else if (rd.phase === 'pwout') { if (now >= rd.until) nextRound(m, now, ev); }
  return ev;
}
// «¡FINAL!»: every tower still standing goes to the safe; the ceremony FINAL_MS later
function final(m, now) {
  const ev = [];
  if (m.phase === 'final' || m.phase === 'done') return ev;
  if (m.phase !== 'play') startPlay(m, now);           // «Terminar» in the countdown / intro: nothing played yet
  if (m.phase === 'final') return ev;
  Object.values(m.kids).forEach((r) => { if (!r.safe) bankIt(m, r); r.q = null; });
  m.boards.forEach((b) => { b.awake = false; });
  m.phase = 'final';
  m.frenzy = false;
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  if (m.round) m.round.phase = 'done';
  ev.push({ t: 'final', ms: R.FINAL_MS });
  return ev;
}
// Teacher «⏭ Saltar»: the current window ends now
function skip(m, now, opts) {
  if (m.phase !== 'play' || m.paused || !m.round) return [];
  m.round.until = Math.min(m.round.until, now);
  return tick(m, now, opts);
}

// ---------- what screens see ----------
function seatView(m, k, online) {
  const r = kid(m, k);
  return { k, name: r.name, skin: r.skin, robot: r.robot, score: r.score, pile: r.pile, got: r.got, safe: r.safe, feathers: r.feathers, on: r.robot || !online || online(k) };
}
function boardView(m, b, online, now) {
  const t = now == null ? Date.now() : now;
  const clock = m.paused ? m.pausedAt : t;
  return {
    id: b.id, night: b.night, cue: b.awake ? 4 : b.cue, awake: b.awake, wakeMs: b.awake ? Math.max(0, b.wakeUntil - clock) : 0,
    waker: b.awake ? b.waker : null, seats: b.seats.map((k) => seatView(m, k, online)),
  };
}
function roundView(m, now) {
  const r = m.round;
  if (!r) return null;
  const clock = m.paused ? m.pausedAt : now;
  return { n: r.n, total: r.total, phase: r.phase, final: r.final, ms: Math.max(0, r.until - clock) };
}
// the open quiz question of a kid (a reconnect gets it again, the same qid)
function openQ(m, k, now) {
  const r = kid(m, k);
  if (!r || !r.q) return null;
  return Object.assign(qPublic(r.q), now != null && r.q.until ? { ms: Math.max(0, r.q.until - now) } : {});
}

// ---------- the end ----------
function cmp(a, b) { return b.score - a.score || b.big - a.big || a.falls - b.falls || a.k - b.k; }
const same = (a, b) => !!a && !!b && a.score === b.score && a.big === b.big && a.falls === b.falls;
function rankRows(rows) {
  rows.sort(cmp);
  rows.forEach((r, i) => { r.rank = i > 0 && same(r, rows[i - 1]) ? rows[i - 1].rank : i + 1; });
  return rows;
}
// the bonus stars (honours: they never change a winner)
function starDefs(n) {
  const maxShare = Math.max(1, Math.floor(n / 2));
  return [
    { id: 'torre', name: 'Torre más alta', unit: 'monedas en una ronda', val: (r) => r.big, ok: (r) => r.big >= 3, best: 'max', maxShare },
    { id: 'prudente', name: 'Más prudente', unit: 'torres a salvo', val: (r) => r.saved, ok: (r) => r.saved >= 2 && r.falls === 0, best: 'max', maxShare },
    { id: 'valiente', name: 'Más valiente', unit: 'cosquillas', val: (r) => r.pats, ok: (r) => r.pats >= 4, best: 'max', maxShare },
    { id: 'racha', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max', maxShare },
  ];
}
// (robots sit at the board and play, but never win a star, a place, the podium or the class ranking)
function finish(m) {
  const row = (r) => ({
    k: r.k, name: r.name, skin: r.skin, b: r.b, robot: r.robot, score: r.score, pats: r.pats, right: r.right, wrong: r.wrong,
    answered: r.answered, best: r.best, wakes: r.wakes, falls: r.falls, lost: r.lost, saved: r.saved, big: r.big, earned: r.earned, stars: [],
  });
  const all = Object.values(m.kids).map(row);
  const byK = {};
  all.forEach((r) => { byK[r.k] = r; });
  const boards = m.boards.filter((b) => b.seats.length).map((b) => {
    const ppl = rankRows(b.seats.map((k) => byK[k]).filter((r) => r && !r.robot));
    const bots = b.seats.map((k) => byK[k]).filter((r) => r && r.robot);
    const st = Party.stars(ppl, starDefs(ppl.length));
    st.forEach((s) => s.winners.forEach((k) => { if (byK[k]) byK[k].stars.push(s.id); }));
    ppl.forEach((r) => { r.of = ppl.length; r.boardRank = r.rank; });
    bots.forEach((r) => { r.rank = null; r.of = ppl.length; });
    const winners = ppl.filter((r) => r.rank === 1 && r.score > 0).map((r) => r.k);
    return { id: b.id, rows: ppl.map((r) => r.k), robots: bots.map((r) => ({ k: r.k, name: r.name, skin: r.skin, score: r.score })), winners, stars: st, nights: b.night, wakes: b.wakes };
  });
  // the class: the same order across every board (people only)
  const cls = rankRows(all.filter((r) => !r.robot).map((r) => Object.assign({}, r)));
  cls.forEach((r) => { byK[r.k].classRank = r.rank; });
  const winners = cls.filter((r) => r.rank === 1 && r.score > 0).map((r) => r.k);
  return { boards, rows: all, byK, order: cls.map((r) => r.k), winners, count: cls.length };
}

module.exports = {
  R, clampDuration, newGame, kid, inGame, boardOf, deal, seatLate, seatRobot, byCode, startPlay, addTime, shiftTimes, tick, final, skip,
  answer, seen, stroke, bank, stop: bank, react, boardView, roundView, openQ, qPublic, finish, cueOf, chanceAt, rise, nextQ, starDefs, plan,
};
