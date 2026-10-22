// ¡No despiertes a Dralingo! (gameType 'dormilon') — the rules, no sockets (server.js «NO DESPIERTES A DRALINGO» block
// glues them to the room). #3 of his Mario Party series: Super Mario Party «Don't Wake Wiggler» (his video y9BKCVx_mNk,
// 6:14-7:29) with our cast: Dralingo sleeps in a Chinese palace bedroom; the class plays in BOARDS OF 4 (the deal of
// core/halcon.js); on a board the kids take TURNS. v2 (his pick 2026-10-22, «Earn feathers, then pet with your finger»,
// after v1 «felt like a quiz with a sleeping dragon on top»): while the others of the board take their turns, every kid
// answers quick questions from the pack, each right answer = one golden feather (start 3, at most 6). «Turno de X»
// (the others guess «¿Se despierta?») → THE TURN (6 s like the video's 5 s, a kid's first one 9 s and guided): his
// sleeping face fills the phone and the kid RUBS his head with a finger; every completed stroke = +1 point (+2 in the
// last 30 s) and spends a feather; a gentle stroke is +1 danger, a scribble (strokes closer than GENTLE_MS) +2; out of
// feathers or out of time ends the turn, «¡Me retiro!» any time. v3 (his picks 2026-10-22 15:44, "it's okay if the round
// ends randomly… someone awakens the dragon in the first round… suspense, the dragon wakes up and you never know when"):
// every tickle is a dice roll; the chance grows with the danger since he fell asleep (each tickle +1, a scribble +2 =
// two rolls, a wrong or late quiz answer of anyone on the board +1 = he shifts, no roll), so he can wake in the first
// round of turns and a 2-minute game sees about two wake-ups per board, never predictable. Only each board's very first
// turn of the game is safe (it shows how to play). The kid stroking when he wakes LOSES ALL their points; then a new night.
// A wrong answer or a question left to run out (Q_TIME_MS) also costs a feather («fsss»): answering nothing is never safe.
// The clock ends the game: «¡FINAL!», then each board's ceremony (bonus stars as honours, the board's winner, the podium).
// Every kid's numbers live in m.kids[k] (k = the server's stable id p.dmK), so a kid who left still counts at the end.
// Spec: docs/specs/no-despiertes-a-dralingo.md. The server emits the events every function returns ({ t, b, … }).
'use strict';
const Party = require('./party');      // clockShift (the teacher's «−30 s»), stars, the ceremony's rows
const Halcon = require('./halcon');    // boards of 4 (boardSizes, splitBoards), mulberry32, shuffle, pickOrder

const R = {
  DURATIONS: [120, 180, 240], DURATION: 120,   // (his pick 2026-10-22: "3 minutes is a lot")
  INTRO_MS: 2600,            // «¡Shhh! Dralingo duerme…» → «¡YA!» after the 3.5 s run-in countdown
  PRE_MS: 2200,              // «Turno de X»: the camera closes in on his face, the others guess
  TURN_MS: 6000,             // the turn: rub his head (the video's 5 s + a breath; the clock goes red at 3)
  FIRST_TURN_MS: 9000,       // a kid's very first turn (guided: the hand shows the rub; only the board's very first turn is safe)
  NEXT_Q_MS: 600,            // the quiz: after a right answer the next question comes this soon (the feather flies in)
  WRONG_WAIT_MS: 1400,       // …after a wrong one («¡Casi!» + the right answer)
  Q_TIME_MS: 15000,          // a quiz question's time: left to run out = late = it costs a feather, like a wrong answer
  WRONG_DANGER: 1,           // a wrong / late answer: he shifts in his sleep (the board's danger +1, no roll)
  FEATHERS_START: 3, FEATHERS_MAX: 6,   // every kid starts with 3 feathers; a full quiver = 6 (one 6-s turn of strokes)
  GUIDED_MAX: 3,             // the board's safe first turn (he never wakes) takes at most 3 tickles
  MIN_STROKE_MS: 250,        // strokes closer than this are noise (never counted)
  GENTLE_MS: 550,            // a stroke sooner than this after the last one = a scribble: +2 danger
  POST_MS: 1500,             // «¡A salvo! +3» after a turn that ended safely
  WAKE_MS: 4400,             // «¡Se despertó!»: he bolts up ANGRY (the video's red Wiggler ~5 s), the kid's points → 0
  NIGHT_MS: 2400,            // «Dralingo se vuelve a dormir… Noche N»
  DROP_MS: 3000,             // the turn kid's phone is gone: «Turno de X» waits this long, a turn ends this long after
  AWAY_SKIP_MS: 15000,       // a kid gone longer than this is skipped at once (no wait every round)
  FAST_MS: 500,              // a quiz answer sooner than this after its question went out = a blind guess: it counts as wrong
  GUESS_IN_MS: 2000,         // the «¿Se despierta?» guess stays open this long into the turn
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  FRENZY_MS: 30000,          // the last 30 s: «¡Luna llena!» every stroke +2
  PAT_DANGER: 1, FAST_DANGER: 2,
  HAZ_BASE: 0.01, HAZ: 0.0025, HAZ_MAX: 0.3,   // the chance a danger unit wakes him = HAZ_BASE + HAZ × the danger since he fell asleep (≤ HAZ_MAX; sim-tuned)
  CUES: [[0.025, 0.03], [0.045, 0.055], [0.07, 0.08]],   // the chance where the cues 1 · 2 · 3 start (jittered per night; sim-tuned)
  BOARD: 4, BOARD_MAX: 5,    // the size of a Mario Party match; a late joiner can make a board of 5, never 6
  REACTS: ['shh', 'wow', 'lol', 'clap'], REACT_GAP_MS: 1200,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => {
  s = Math.round(Number(s) || R.DURATION);
  return clamp(s, 60, 600);
};

function newGame(seed, durationS, now) {
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration: clampDuration(durationS),
    phase: 'countdown', phaseAt: now, phaseUntil: now, endsAt: 0, frenzyAt: 0, frenzy: false,
    paused: false, pausedAt: 0, boards: [], kids: {}, nextBoard: 1, qn: 0,
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const inGame = (m, k) => !!kid(m, k);
const boardOf = (m, id) => (m ? m.boards.find((b) => b.id === id) || null : null);

function newKid(k, name, skin, b, code) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b, code: code ? String(code) : '',   // (code: server only, never in a view)
    score: 0, pats: 0, right: 0, wrong: 0, answered: 0, streak: 0, best: 0, wakes: 0, lost: 0,
    turns: 0, safe: 0, big: 0, guesses: 0, guessOk: 0, first: true, awaySince: 0, lastReact: 0,
    feathers: R.FEATHERS_START, earned: 0, fast: 0, q: null, qNextAt: 0, order: [], qi: 0,
  };
}
// A night: the danger back to 0, new cue cuts (jittered: a cue says «riskier», never how many tickles are left).
function newNight(m, b) {
  b.cuts = R.CUES.map(([a, z]) => a + m.rng() * (z - a));
  b.danger = 0;
  b.cue = 0;
}
function addBoard(m) {
  const b = {
    id: m.nextBoard++, seats: [], ti: -1, phase: 'wait', phaseAt: 0, phaseUntil: 0, night: 1,
    danger: 0, cuts: [], cue: 0, cur: null, guesses: {}, waker: null, safeDone: false,
  };
  newNight(m, b);
  m.boards.push(b);
  return b;
}
function seatIn(m, b, k, name, skin, code) {
  m.kids[k] = newKid(k, name, skin, b.id, code);
  b.seats.push(k);
  return m.kids[k];
}
// The start: every kid gets a seat; boards of 4 (3 when it doesn't divide; ≤ 5 kids = one board). entries: [[k, name, skin, code]]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin, code]) => { byK[k] = [name, skin, code]; });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addBoard(m);
    ks.forEach((k) => seatIn(m, b, k, byK[k][0], byK[k][1], byK[k][2]));
  });
  return m.boards;
}
// A late joiner sits at the smallest board that still has room (max 5), last in its turn order; every board full → a
// new board. A kid already seated keeps the seat (null).
function seatLate(m, k, name, skin, code) {
  if (inGame(m, k)) return null;
  const open = m.boards.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(m);
  seatIn(m, b, k, name, skin, code);
  return b;
}
// A kid back after the room forgot their phone (5 min away): their own row, by the student code the server proved
// (null when there is none, or that row is playing on another phone right now)
function byCode(m, code, online) {
  if (!code) return null;
  const r = Object.values(m.kids).find((x) => x.code && x.code === String(code));
  return r && !(online && online(r.k)) ? r : null;
}

// ---------- the clock ----------
function frenzyLen(m) { return m.duration >= 60 ? R.FRENZY_MS : 0; }
function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.endsAt = now + m.duration * 1000;
  m.phaseUntil = m.endsAt;
  m.frenzyAt = m.endsAt - frenzyLen(m);
  m.frenzy = false;
  const ev = [];
  m.boards.forEach((b) => { b.ti = -1; nextTurn(m, b, now, ev, null); });
  return ev;
}
// The teacher's «+30 s» / «−30 s»: the change that really applies (Party.clockShift: a cut stops 10 s before the end)
function addTime(m, ms, now) {
  if (m.phase !== 'play') return 0;
  const d = Party.clockShift(m.endsAt, ms, now);
  if (!d) return 0;
  m.endsAt += d;
  m.phaseUntil = m.endsAt;
  m.frenzyAt = m.endsAt - frenzyLen(m);
  if (d > 0) m.duration += d / 1000;
  return d;
}
// the teacher paused for `ms`: every pending moment moves by that much
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.boards.forEach((b) => {
    b.phaseAt += ms;
    b.phaseUntil += ms;
    const c = b.cur;
    if (c) {
      c.startAt += ms; c.until += ms;
      if (c.lastStroke) c.lastStroke += ms;
      if (c.droppedAt) c.droppedAt += ms;
    }
  });
  Object.values(m.kids).forEach((r) => {
    if (r.awaySince) r.awaySince += ms;
    if (r.qNextAt) r.qNextAt += ms;            // (r.q.sentAt stays: it only tells a double tap)
    m.lastTick = 0;
    if (r.q && r.q.until) r.q.until += ms;     // the question's time stood still during the pause
  });
}

// ---------- turns ----------
function setPhase(b, phase, now, ms) {
  b.phase = phase;
  b.phaseAt = now;
  b.phaseUntil = now + ms;
}
// the next kid whose turn it is after seat index `from` (−1 = from the start): kids gone longer than AWAY_SKIP_MS are
// passed over at once; null when nobody of the board is here
function pickNext(m, b, online, now, after) {
  const n = b.seats.length;
  if (!n) return -1;
  for (let i = 1; i <= n; i++) {
    const idx = (after + i + n) % n;
    const r = kid(m, b.seats[idx]);
    if (!r) continue;
    const here = !online || online(r.k);
    if (here || !r.awaySince || now - r.awaySince < R.AWAY_SKIP_MS) return idx;
  }
  return -1;
}
// «Turno de X» (pre): the kid tiptoes in, the others guess. A kid whose phone is gone gets the short wait (DROP_MS).
function nextTurn(m, b, now, ev, online) {
  const idx = pickNext(m, b, online, now, b.ti);
  b.cur = null;
  b.guesses = {};
  if (idx < 0) { setPhase(b, 'idle', now, 0); return; }
  b.ti = idx;
  const r = kid(m, b.seats[idx]);
  const here = !online || online(r.k);
  setPhase(b, 'pre', now, here ? R.PRE_MS : R.DROP_MS);
  const nidx = b.seats.length > 1 ? pickNext(m, b, online, now, idx) : -1;
  if (r.q) { r.q = null; ev.push({ t: 'qx', b: b.id, k: r.k }); }
  if (r.first && r.feathers < R.FEATHERS_START) r.feathers = R.FEATHERS_START;    // the first turn always has its feathers
  ev.push({ t: 'pre', b: b.id, k: r.k, ms: b.phaseUntil - now, guided: !!r.first, safe: !b.safeDone, night: b.night, next: nidx >= 0 && nidx !== idx ? b.seats[nidx] : null, here, feathers: r.feathers });
}
function goTurn(m, b, now, ev) {
  const r = kid(m, b.seats[b.ti]);
  if (!r) return;
  const ms = r.first ? R.FIRST_TURN_MS : R.TURN_MS;
  if (r.first && r.feathers < R.FEATHERS_START) r.feathers = R.FEATHERS_START;     // the first turn always has its feathers
  setPhase(b, 'turn', now, ms);
  const safe = !b.safeDone;                  // the board's very first turn of the game shows how to play: he never wakes
  b.safeDone = true;
  b.cur = { k: r.k, guided: !!r.first, safe, startAt: now, until: now + ms, pats: 0, pts: 0, fast: 0, lastStroke: 0, droppedAt: 0 };
  r.first = false;
  r.turns++;
  if (r.q) { r.q = null; ev.push({ t: 'qx', b: b.id, k: r.k }); }
  ev.push({ t: 'go', b: b.id, k: r.k, ms, guided: b.cur.guided, safe, feathers: r.feathers });
  if (r.feathers <= 0) endTurn(m, b, now, 'empty', ev);      // «¡Sin plumas! Responde para ganar más»
}
function guessResult(b, woke) {
  const want = woke ? 'wake' : 'sleep';
  return Object.keys(b.guesses).filter((k) => b.guesses[k] === want).map(Number);
}
function payGuesses(m, b, woke) {
  const right = guessResult(b, woke);
  Object.keys(b.guesses).forEach((k) => { const r = kid(m, Number(k)); if (r) r.guesses++; });
  right.forEach((k) => { const r = kid(m, k); if (r) r.guessOk++; });
  return right;
}
// The turn ends safely: «¡Me retiro!», the time, a dropped phone, «¡FINAL!»
function endTurn(m, b, now, why, ev) {
  const c = b.cur;
  if (!c || b.phase !== 'turn') return false;
  const r = kid(m, c.k);
  if (r) {
    if (c.pats > 0) r.safe++;
    r.big = Math.max(r.big, c.pats);
  }
  const right = payGuesses(m, b, false);
  if (r) r.qNextAt = now + R.POST_MS + 300;      // back to the quiz once «¡A salvo! +N» has been seen
  ev.push({ t: 'end', b: b.id, k: c.k, why, pats: c.pats, pts: c.pts, score: r ? r.score : 0, guess: right, feathers: r ? r.feathers : 0 });
  b.cur = null;
  setPhase(b, 'post', now, R.POST_MS);
  return true;
}
function wake(m, b, now, by, ev) {
  const c = b.cur;
  const r = kid(m, c.k);
  const lost = r ? r.score : 0;
  if (r) {
    r.lost += lost;
    r.score = 0;
    r.wakes++;
    r.big = Math.max(r.big, c.pats);
    r.qNextAt = now + R.WAKE_MS;                 // back to the quiz after the wake-up
  }
  const right = payGuesses(m, b, true);
  b.waker = c.k;
  ev.push({ t: 'wake', b: b.id, k: c.k, lost, by, night: b.night, guess: right, pats: c.pats });
  b.cur = null;
  b.cue = 4;
  setPhase(b, 'wake', now, R.WAKE_MS);
}
// the chance that one more danger unit wakes him now (it grows with every tickle since he fell asleep)
const chanceAt = (d) => (d > 0 ? Math.min(R.HAZ_MAX, R.HAZ_BASE + R.HAZ * d) : 0);
function cueOf(b) {
  if (!b.danger) return 0;
  const p = chanceAt(b.danger);
  return b.cuts.filter((c) => p >= c).length;
}
// danger rises by amount units, each one a dice roll; true = he wakes up now. The board's safe first turn adds its
// danger without rolling (it is the demonstration; at most GUIDED_MAX tickles, so it never leaves a «time bomb»).
function rise(m, b, amount) {
  let woke = false;
  for (let i = 0; i < amount; i++) {
    b.danger++;
    if (!(b.cur && b.cur.safe) && !woke && m.rng() < chanceAt(b.danger)) woke = true;
  }
  b.cue = cueOf(b);
  return woke;
}
// a wrong or late quiz answer: he shifts in his sleep (danger +WRONG_DANGER for the board, never a roll: only the kid
// stroking can wake him). → the event for the board, or null while he is awake / between nights.
function shift(m, b, k, why) {
  if (!b || b.phase === 'wake' || b.phase === 'night') return null;
  b.danger += R.WRONG_DANGER;
  b.cue = cueOf(b);
  return { t: 'shift', b: b.id, k, why, cue: b.cue };
}

// ---------- questions ----------
// A kid's next quiz question: their own shuffled order of the pack (answers that fit a tile first), the answers
// shuffled, the right one kept here. imageFor(q) → a picture url or null.
function nextQ(m, h, questions, imageFor, now) {
  if (!h.order.length || h.qi >= h.order.length) { h.order = Halcon.pickOrder(questions, m.rng); h.qi = 0; }
  if (!h.order.length) return null;
  const src = questions[h.order[h.qi++]];
  if (!src) return null;
  const answers = Halcon.shuffle([src.correct].concat(src.answers.filter((a) => a !== src.correct)).slice(0, 4).map(String), m.rng);
  m.qn++;
  return {
    qid: `dm${m.id % 100000}-${h.k}-${m.qn}`, text: String(src.text), answers, correctIdx: answers.indexOf(String(src.correct)),
    image: imageFor ? imageFor(src) || null : null, sentAt: now, until: now + R.Q_TIME_MS,
  };
}
// what a phone may see of a question (never the right answer before it is answered)
const qPublic = (q) => (q ? { qid: q.qid, text: q.text, answers: q.answers, image: q.image } : null);

// ---------- the actions ----------
// A quiz answer (any kid who is not playing a turn). Right = one more feather (at most FEATHERS_MAX); wrong = «¡Casi!»,
// one feather flies out of the quiver (if any) and he shifts in his sleep (the board's danger +1), then a short wait.
// → { ok, right, ev } (ev: qr for the kid, the server tells the board the new feather count; shift for the board).
function answer(m, k, qid, idx, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || !r.q) return { ok: false, why: 'closed', ev: [] };
  if (r.q.qid !== qid) return { ok: false, why: 'stale', ev: [] };
  if (!Number.isInteger(idx) || idx < 0 || idx >= r.q.answers.length) return { ok: false, why: 'bad', ev: [] };
  const q = r.q;
  r.q = null;
  r.answered++;
  const tooFast = now - q.sentAt < R.FAST_MS;               // (nobody reads a question that fast: a guess = wrong)
  const ok = idx === q.correctIdx && !tooFast;
  const before = r.feathers;
  if (ok) {
    r.right++; r.streak++; r.best = Math.max(r.best, r.streak);
    r.feathers = Math.min(R.FEATHERS_MAX, r.feathers + 1);
    r.earned += r.feathers - before;
    r.qNextAt = now + R.NEXT_Q_MS;
  } else {
    r.wrong++; r.streak = 0;
    if (r.feathers > 0) { r.feathers--; r.featherLost = (r.featherLost || 0) + 1; }
    r.qNextAt = now + R.WRONG_WAIT_MS;
  }
  const ev = [{ t: 'qr', b: r.b, k, qid: q.qid, idx, ok, tooFast, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], feathers: r.feathers, gained: r.feathers - before, streak: r.streak, full: r.feathers >= R.FEATHERS_MAX }];
  if (!ok) { const sh = shift(m, boardOf(m, r.b), k, 'wrong'); if (sh) ev.push(sh); }
  return { ok: true, right: ok, ev };
}
// The phone painted its question on a visible screen (a pocketed or locked phone never pays for a late one).
function seen(m, k, qid) {
  const r = kid(m, k);
  if (!r || !r.q || r.q.qid !== qid) return false;
  r.q.seen = true;
  return true;
}
// A question the phone showed, left to run out (online kids only: a phone that dropped just gets a fresh one later): late = wrong.
function late(m, r, now) {
  const q = r.q;
  r.q = null;
  r.answered++; r.wrong++; r.late = (r.late || 0) + 1; r.streak = 0;
  const before = r.feathers;
  if (r.feathers > 0) { r.feathers--; r.featherLost = (r.featherLost || 0) + 1; }
  r.qNextAt = now + R.WRONG_WAIT_MS;
  const ev = [{ t: 'qr', b: r.b, k: r.k, qid: q.qid, idx: -1, ok: false, late: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], feathers: r.feathers, gained: r.feathers - before, streak: 0, full: false }];
  const sh = shift(m, boardOf(m, r.b), r.k, 'late');
  if (sh) ev.push(sh);
  return ev;
}
// A stroke of the golden feather on his head (the turn kid's finger: one back-and-forth rub). +1 point (+2 in the last
// 30 s), one feather spent; gentle (GENTLE_MS since the last one, or the first) = +1 danger, a scribble = +2. Out of
// feathers ends the turn. → { ok, why, ev } (ev: pat, then maybe wake / end).
function stroke(m, k, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused) return { ok: false, why: 'closed', ev: [] };
  const b = boardOf(m, r.b);
  const c = b && b.cur;
  if (!c || b.phase !== 'turn' || c.k !== k) return { ok: false, why: 'closed', ev: [] };
  if (r.feathers <= 0) return { ok: false, why: 'empty', ev: [] };
  if (c.lastStroke && now - c.lastStroke < R.MIN_STROKE_MS) return { ok: false, why: 'noise', ev: [] };
  const fast = !!c.lastStroke && now - c.lastStroke < R.GENTLE_MS;
  c.lastStroke = now;
  r.feathers--;
  const pts = m.frenzy ? 2 : 1;
  r.pats++; r.score += pts;
  c.pats++; c.pts += pts;
  if (fast) { c.fast++; r.fast++; }
  const woke = rise(m, b, fast ? R.FAST_DANGER : R.PAT_DANGER);
  const ev = [{ t: 'pat', b: b.id, k, pts, score: r.score, cue: woke ? 4 : b.cue, pats: c.pats, x2: m.frenzy, fast, feathers: r.feathers }];
  if (woke) wake(m, b, now, fast ? 'fast' : 'pat', ev);
  else if (r.feathers <= 0) endTurn(m, b, now, 'empty', ev);
  else if (c.safe && c.pats >= R.GUIDED_MAX) endTurn(m, b, now, 'guided', ev);   // the safe first turn: «¡Así se juega!»
  return { ok: true, ev };
}
// «¡Me retiro!»
function stop(m, k, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused) return [];
  const b = boardOf(m, r.b);
  if (!b || b.phase !== 'turn' || !b.cur || b.cur.k !== k) return [];
  const ev = [];
  endTurn(m, b, now, 'stop', ev);
  return ev;
}
// «¿Se despierta?» (a kid of the board who is not playing this turn), open in «Turno de…» and GUESS_IN_MS into the turn
function guess(m, k, g, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || (g !== 'wake' && g !== 'sleep')) return null;
  const b = boardOf(m, r.b);
  if (!b || b.ti < 0 || b.seats[b.ti] === k) return null;
  const kt = kid(m, b.seats[b.ti]);
  if ((b.cur && b.cur.safe) || (b.phase === 'pre' && !b.safeDone)) return null;   // the safe first turn never wakes him: no guess
  const open = b.phase === 'pre' || (b.phase === 'turn' && b.cur && now - b.cur.startAt <= R.GUESS_IN_MS);
  if (!open || b.guesses[k]) return null;
  b.guesses[k] = g;
  return { b: b.id, k, g, tally: tally(b) };
}
function tally(b) {
  const t = { wake: 0, sleep: 0 };
  Object.values(b.guesses).forEach((g) => { t[g]++; });
  return t;
}
// a reaction (🤫 😱 😂 👏) from a kid of the board, at most one per REACT_GAP_MS
function react(m, k, e, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || !R.REACTS.includes(e) || now - r.lastReact < R.REACT_GAP_MS) return null;
  r.lastReact = now;
  return { b: r.b, k, e };
}

// ---------- the tick (the server calls it every 200 ms while the game plays) ----------
// opts: { questions, imageFor(q), online(k) → bool }. Returns the events to send.
function tick(m, now, opts) {
  const ev = [];
  if (m.paused || m.phase !== 'play') return ev;
  const o = opts || {};
  const online = o.online || (() => true);
  const dt = m.lastTick ? Math.max(0, Math.min(1000, now - m.lastTick)) : 0;   // (time since the last tick: a raging board's quiz waits)
  m.lastTick = now;
  Object.values(m.kids).forEach((r) => {
    const here = online(r.k);
    if (here) r.awaySince = 0;
    else if (!r.awaySince) r.awaySince = now;
  });
  if (!m.frenzy && frenzyLen(m) && now >= m.frenzyAt && now < m.endsAt - 1200) {
    m.frenzy = true;
    ev.push({ t: 'frenzy', endsMs: Math.max(0, m.endsAt - now) });
  } else if (m.frenzy && now < m.frenzyAt - 1000) {
    m.frenzy = false;                // «+30 s» moved the end away again
    ev.push({ t: 'frenzy', off: true });
  }
  m.boards.forEach((b) => {
    if (b.phase === 'idle' || b.phase === 'wait') {
      if (b.seats.some((k) => online(k))) nextTurn(m, b, now, ev, online);
      return;
    }
    if (b.phase === 'pre') {
      if (now < b.phaseUntil) return;
      const k = b.seats[b.ti];
      if (!online(k)) { ev.push({ t: 'skip', b: b.id, k }); nextTurn(m, b, now, ev, online); return; }
      goTurn(m, b, now, ev);
      return;
    }
    if (b.phase === 'turn') {
      const c = b.cur;
      if (!c) { setPhase(b, 'post', now, 0); return; }
      if (!online(c.k)) { if (!c.droppedAt) c.droppedAt = now; } else c.droppedAt = 0;
      if (now >= c.until) { endTurn(m, b, now, 'time', ev); return; }
      if (c.droppedAt && now - c.droppedAt >= R.DROP_MS) { endTurn(m, b, now, 'drop', ev); return; }
      return;
    }
    if (b.phase === 'post') { if (now >= b.phaseUntil) nextTurn(m, b, now, ev, online); return; }
    if (b.phase === 'wake') {
      if (now < b.phaseUntil) return;
      b.night++;
      newNight(m, b);
      ev.push({ t: 'night', b: b.id, night: b.night });
      setPhase(b, 'night', now, R.NIGHT_MS);
      return;
    }
    if (b.phase === 'night') { if (now >= b.phaseUntil) nextTurn(m, b, now, ev, online); }
  });
  // the quiz: every kid who is not playing (nor about to: «Turno de…») answers to earn feathers; a full quiver rests
  Object.values(m.kids).forEach((r) => {
    const b = boardOf(m, r.b);
    if (!b) return;
    const mine = b.ti >= 0 && b.seats[b.ti] === r.k && (b.phase === 'pre' || b.phase === 'turn');
    if (mine) return;
    if (b.phase === 'wake') {                                          // he is raging: everyone on the board watches
      if (r.q && r.q.until) r.q.until += dt;
      r.qNextAt = Math.max(r.qNextAt || 0, b.phaseUntil);
      return;
    }
    if (r.q && now >= (r.q.until || r.q.sentAt + R.Q_TIME_MS) + 300) {   // the question ran out: late = it costs
      if (online(r.k) && r.q.seen) ev.push.apply(ev, late(m, r, now)); else r.q = null;   // (only one the phone showed)
    }
    if (!r.q && r.feathers < R.FEATHERS_MAX && now >= r.qNextAt && online(r.k)) {
      r.q = nextQ(m, r, o.questions || [], o.imageFor, now);
      if (r.q) ev.push({ t: 'q', b: r.b, k: r.k, q: r.q, feathers: r.feathers, ms: R.Q_TIME_MS });
      else r.qNextAt = now + 2000;        // (no usable question: try again in a moment)
    }
  });
  if (now >= m.endsAt) ev.push.apply(ev, final(m, now));
  return ev;
}
// «¡FINAL!»: a turn still running ends safely (its strokes stand); the boards stand still; the ceremony FINAL_MS later
function final(m, now) {
  const ev = [];
  if (m.phase === 'final' || m.phase === 'done') return ev;
  if (m.phase !== 'play') startPlay(m, now);          // «Terminar» in the countdown / intro: nothing played yet
  m.boards.forEach((b) => { if (b.phase === 'turn') endTurn(m, b, now, 'final', ev); });
  m.boards.forEach((b) => { b.cur = null; if (b.phase !== 'wake') setPhase(b, 'done', now, 0); });
  Object.values(m.kids).forEach((r) => { r.q = null; });
  m.phase = 'final';
  m.frenzy = false;
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  ev.push({ t: 'final', ms: R.FINAL_MS });
  return ev;
}
// Teacher «⏭ Saltar»: every board's moment ends now (a guess window, a turn (its strokes stand), a wake-up, a night)
function skip(m, now, opts) {
  const ev = [];
  if (m.phase !== 'play' || m.paused) return ev;
  m.boards.forEach((b) => {
    if (b.phase === 'turn') endTurn(m, b, now, 'time', ev);
    else if (b.phase === 'pre' || b.phase === 'post' || b.phase === 'wake' || b.phase === 'night') b.phaseUntil = now;
  });
  return ev.concat(tick(m, now, opts));
}

// ---------- what screens see ----------
function boardView(m, b, online, now) {
  const c = b.cur;
  const t = now == null ? Date.now() : now;
  const clock = m.paused ? m.pausedAt : t;
  return {
    id: b.id, phase: b.phase, phaseMs: Math.max(0, b.phaseUntil - clock), night: b.night, cue: b.phase === 'wake' ? 4 : b.cue,
    turn: b.ti >= 0 && ['pre', 'turn', 'post', 'wake'].includes(b.phase) ? b.seats[b.ti] : null,
    guided: !!(c && c.guided), safe: c ? !!c.safe : (b.phase === 'pre' && !b.safeDone), pats: c ? c.pats : 0, tally: tally(b), waker: b.phase === 'wake' || b.phase === 'night' ? b.waker : null,
    seats: b.seats.map((k) => { const r = kid(m, k); return { k, name: r.name, skin: r.skin, score: r.score, feathers: r.feathers, on: !online || online(k) }; }),
  };
}
// the open quiz question of a kid (a reconnect gets it again, the same qid)
function openQ(m, k, now) {
  const r = kid(m, k);
  if (!r || !r.q) return null;
  return Object.assign(qPublic(r.q), now != null && r.q.until ? { ms: Math.max(0, r.q.until - now) } : {});
}

// ---------- the end ----------
function cmp(a, b) { return b.score - a.score || b.pats - a.pats || a.wakes - b.wakes || a.k - b.k; }
const same = (a, b) => !!a && !!b && a.score === b.score && a.pats === b.pats && a.wakes === b.wakes;
function rankRows(rows) {
  rows.sort(cmp);
  rows.forEach((r, i) => { r.rank = i > 0 && same(r, rows[i - 1]) ? rows[i - 1].rank : i + 1; });
  return rows;
}
// the bonus stars (honours: they never change a winner)
function starDefs(n) {
  const maxShare = Math.max(1, Math.floor(n / 2));
  return [
    { id: 'valiente', name: 'Más valiente', unit: 'cosquillas en un turno', val: (r) => r.big, ok: (r) => r.big >= 2, best: 'max', maxShare },
    { id: 'prudente', name: 'Más prudente', unit: 'turnos a salvo', val: (r) => r.safe, ok: (r) => r.safe >= 1 && r.wakes === 0, best: 'max', maxShare },
    { id: 'racha', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max', maxShare },
    { id: 'adivino', name: 'Mejor adivino', unit: 'adivinadas', val: (r) => r.guessOk, ok: (r) => r.guessOk >= 2, best: 'max', maxShare },
  ];
}
function finish(m) {
  const row = (r) => ({
    k: r.k, name: r.name, skin: r.skin, b: r.b, score: r.score, pats: r.pats, right: r.right, wrong: r.wrong, answered: r.answered,
    best: r.best, wakes: r.wakes, lost: r.lost, turns: r.turns, safe: r.safe, big: r.big, guessOk: r.guessOk, earned: r.earned, stars: [],
  });
  const all = Object.values(m.kids).map(row);
  const byK = {};
  all.forEach((r) => { byK[r.k] = r; });
  const boards = m.boards.filter((b) => b.seats.length).map((b) => {
    const rows = rankRows(b.seats.map((k) => byK[k]).filter(Boolean));
    const st = Party.stars(rows, starDefs(rows.length));
    st.forEach((s) => s.winners.forEach((k) => { if (byK[k]) byK[k].stars.push(s.id); }));
    rows.forEach((r) => { r.of = rows.length; r.boardRank = r.rank; });
    const winners = rows.filter((r) => r.rank === 1 && r.score > 0).map((r) => r.k);
    return { id: b.id, rows: rows.map((r) => r.k), winners, stars: st, nights: b.night };
  });
  // the class: the same order across every board
  const cls = rankRows(all.map((r) => Object.assign({}, r)));
  cls.forEach((r) => { byK[r.k].classRank = r.rank; });
  const winners = cls.filter((r) => r.rank === 1 && r.score > 0).map((r) => r.k);
  return { boards, rows: all, byK, order: cls.map((r) => r.k), winners, count: all.length };
}

module.exports = {
  R, clampDuration, newGame, kid, inGame, boardOf, deal, seatLate, byCode, startPlay, addTime, shiftTimes, tick, final, skip,
  answer, seen, stroke, stop, guess, react, tally, boardView, openQ, qPublic, finish, cueOf, chanceAt, rise, nextQ, starDefs,
};
