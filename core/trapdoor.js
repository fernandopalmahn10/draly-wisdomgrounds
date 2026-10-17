// Las Trampillas (gameType 'trapdoor') — the rules, no sockets (spec docs/specs/las-trampillas.md). Mario Party's round
// platform whose pie slices drop like trapdoors (his video 4:43-5:41), with his picks: a right answer during the
// countdown = golden wings that hold you over a falling slice once; the fallen answer in the pit to come back; Fuego vs
// Mar, every kid still standing after a drop = 1 point for their kingdom (the Final Round counts double).
// The platform (geometry, slices, what can drop, the runner's step) is public/js/trapdoor-arena.js, shared with the
// screens. The server moves every kid itself: a tap is only an intent. The phases run on the clock (advance()).
'use strict';

const A = require('../public/js/trapdoor-arena');

const R = {
  TICK_MS: 100,            // the server's step (10 Hz); positions go out every other tick (5 Hz)
  SPEED: 92,               // world units a second (the floor is 200 across: ~2 s)
  GO_RATE: 12,             // tap intents a second a phone may send (the rest are dropped)
  // the clock of a round: public/js/trapdoor-arena.js TIMING (the screens run the same one)
  INTRO_MS: A.TIMING.INTRO, TITLE_MS: A.TIMING.TITLE, FINAL_TITLE_MS: A.TIMING.FINAL_TITLE, ROULETTE_MS: A.TIMING.ROULETTE,
  COUNT_MS: A.TIMING.COUNT, LOCK_MS: A.TIMING.LOCK, OPEN_MS: A.TIMING.OPEN, CLOSE_MS: A.TIMING.CLOSE, TALLY_MS: A.TIMING.TALLY,
  ROUNDS: 7,               // the lobby offers 5 / 7 / 10
  ROUNDS_MIN: 3,
  ROUNDS_MAX: 15,
  MORE: 2,                 // the teacher's «+30 s» = 2 rondas más
  ROUND_PTS: 10,           // a round is worth up to 10 points to a kingdom: its share of kids still standing
  FINAL_MULT: 2,           // the Final Round counts double
  TOO_FAST_MS: 450,        // an answer faster than this after the question = a guess = wrong
  WRONG_WAIT_MS: 2000,     // «¡Casi!»: the next question waits this long (the phone shows the right answer)
  WRONG_WAIT2_MS: 3400,    // …and longer after two wrong in a row
  Q_SERVER_MS: 21000,      // a question nobody answers is closed as «time up» by the server (the phone says 20 s)
  Q_MIN_LEFT_MS: 3000,     // no new wings question with less than this before «0»
  RETURN_MIN_MS: 1800,     // a comeback rises at once only with at least this before «0» (else at the next round)
  JUMP_FIRST_MS: 760,      // the roulette: a new place every ~0.76 s at first…
  JUMP_LAST_MS: 470,       // …down to ~0.47 s at the end of the count (×0.85 in the second half of the game)
};
const ROUND_MS = (final) => (final ? R.FINAL_TITLE_MS : R.TITLE_MS) + R.ROULETTE_MS + R.COUNT_MS + R.LOCK_MS + R.OPEN_MS + R.CLOSE_MS + R.TALLY_MS;
const other = (t) => (t === 'red' ? 'gold' : 'red');
const clampRounds = (n) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.max(R.ROUNDS_MIN, Math.min(R.ROUNDS_MAX, v)) : R.ROUNDS; };
// the room's time cap: the intro + every round (the Final Round's longer title)
const timeCapMs = (n) => R.INTRO_MS + (clampRounds(n) - 1) * ROUND_MS(false) + ROUND_MS(true);

// ---------- a game ----------
// opts: { arena, rounds, now }
function newGame(opts) {
  const o = opts || {};
  const now = o.now || Date.now();
  return {
    arena: ((Number(o.arena) || 0) % A.ARENAS.length + A.ARENAS.length) % A.ARENAS.length,
    rounds: clampRounds(o.rounds == null ? R.ROUNDS : o.rounds),
    r: 0, phase: 'intro', introAt: now, t0: now, kind: null, mult: 1, final: false,
    jumps: [], drop: null, open: {}, paused: false, pausedAt: 0,
    kids: {}, score: { red: 0, gold: 0 }, lastAdd: null, history: [],
  };
}
const kidOf = (m, k) => m.kids[k] || null;
// a kid joins: before round 1 they stand on the floor at once; later they rise at the next round ('wait')
function addKid(m, k, team, now) {
  let d = m.kids[k];
  if (d) { d.team = team === 'gold' ? 'gold' : 'red'; return d; }
  const early = m.phase === 'intro';
  const [x, y] = A.spawnAt(k, 0);
  d = m.kids[k] = {
    k, team: team === 'gold' ? 'gold' : 'red', x, y, tx: x, ty: y, st: early ? 'up' : 'wait', entered: early,
    wings: false, wingsNext: false, hover: false, away: false,
    stood: 0, pts: 0, run: 0, best: 0, saved: 0, falls: 0, backs: 0, right: 0, answered: 0, streak: 0, bestStreak: 0,
    wrongRow: 0, nextQAt: 0, joinedAt: now || Date.now(),
  };
  return d;
}

// ---------- the clock of a round ----------
const bounds = (m) => A.bounds(!!m.final);
const BEFORE_LOCK = { title: 1, roulette: 1, count: 1 };
// ms until «0» this round (−1 once it has passed or between rounds)
function msToLock(m, now) {
  if (!BEFORE_LOCK[m.phase]) return -1;
  const at = m.paused ? m.pausedAt : now;
  return Math.max(0, m.t0 + bounds(m).lock - at);
}
// the number on the hub: 5 … 1 during the count, 0 from the lock to the close, null otherwise
function hubNumber(m, now) {
  const b = bounds(m), t = (m.paused ? m.pausedAt : now) - m.t0;
  if (m.phase === 'count') return Math.max(1, 5 - Math.floor((t - b.count) / 1000));
  if (m.phase === 'lock' || m.phase === 'open') return 0;
  return null;
}

// the roulette of a round: [[ms after the round started, option s]] from the roulette until «0», never the same place
// twice in a row, faster toward the end (and in the second half of the game). The final set is NOT in it: it is drawn
// at «0» (lock()), uniformly, so the roulette is a bluff like the video's.
function planJumps(m, rand) {
  const r = rand || Math.random;
  const b = bounds(m);
  const nOpt = A.optionsOf(m.kind);
  const fast = m.r > m.rounds / 2 ? 0.85 : 1;
  const out = [];
  let t = b.roulette, prev = -1;
  while (t < b.lock - 120) {
    let s = Math.floor(r() * nOpt);
    if (s === prev) s = (s + 1 + Math.floor(r() * (nOpt - 1))) % nOpt;
    out.push([Math.round(t), s]);
    prev = s;
    const k = Math.max(0, Math.min(1, (t - b.roulette) / (b.lock - b.roulette)));
    t += (R.JUMP_FIRST_MS + (R.JUMP_LAST_MS - R.JUMP_FIRST_MS) * k) * fast * (0.85 + r() * 0.3);
  }
  return out;
}

function startRound(m, r, now, rand, ev) {
  m.r = r;
  m.t0 = now;
  m.phase = 'title';
  m.final = r >= m.rounds;
  m.kind = A.kindOf(r, m.rounds);
  m.mult = m.final ? R.FINAL_MULT : 1;
  m.drop = null;
  m.open = {};
  m.jumps = planJumps(m, rand);
  const enter = [];
  Object.values(m.kids).forEach((d) => {
    d.hover = false;
    if (d.st === 'wait') {
      d.st = 'up';
      d.entered = true;
      d.wings = !!d.wingsNext;
      d.wingsNext = false;
      const [x, y] = freeSpot(m, d.k, rand);
      d.x = x; d.y = y; d.tx = x; d.ty = y;
      enter.push(d.k);
    } else {
      d.wings = false;
      d.wingsNext = false;
    }
  });
  ev.push({ type: 'round', r, enter });
}
// a spot to rise onto: of a few spread candidates, the one farthest from everybody already standing
function freeSpot(m, k, rand) {
  const r = rand || Math.random;
  const up = Object.values(m.kids).filter((d) => d.st === 'up' && d.k !== k);
  let best = null, bestD = -1;
  const salt = Math.floor(r() * 1000);
  for (let i = 0; i < 10; i++) {
    const p = A.spawnAt(k, salt + i);
    if (m.open[A.sliceOf(p[0], p[1])]) continue;
    const dd = up.reduce((mn, d) => Math.min(mn, Math.hypot(d.x - p[0], d.y - p[1])), 1e9);
    if (dd > bestD) { bestD = dd; best = p; }
  }
  return best || A.spawnAt(k, salt);
}

// «0»: the drop is drawn now, uniformly among the round's options (never from where kids stand)
function lock(m, rand, ev) {
  const r = rand || Math.random;
  const s = Math.floor(r() * A.optionsOf(m.kind));
  m.drop = { s, set: A.setOf(m.kind, s) };
  m.phase = 'lock';
  ev.push({ type: 'lock', s, set: m.drop.set });
}
// the doors open: everyone whose feet are on a dropping slice falls, unless they have wings (used up: they hover)
function openDoors(m, ev) {
  const set = (m.drop && m.drop.set) || [];
  const open = {};
  set.forEach((i) => { open[i] = true; });
  m.open = open;
  m.phase = 'open';
  const falls = [], saves = [];
  Object.values(m.kids).forEach((d) => {
    if (d.st !== 'up' || !open[A.sliceOf(d.x, d.y)]) return;
    if (d.wings) { d.wings = false; d.hover = true; d.saved++; saves.push(d.k); return; }
    d.st = 'down';
    d.falls++;
    d.run = 0;
    d.tx = d.x; d.ty = d.y;
    d.nextQAt = 0;
    falls.push(d.k);
  });
  ev.push({ type: 'open', set, falls, saves });
}
function closeDoors(m, ev) { m.phase = 'close'; ev.push({ type: 'close' }); }
// The tally: each kingdom scores the share of its kids still standing, out of ROUND_PTS (10; the Final Round ×2): a
// kingdom all on its feet gets 10, 9 of 12 → 8. A share, not a head count, so a kingdom with one kid more (a class of
// 21) never wins by size (the first sim showed 70/20 for the bigger side with head counts). Counted: connected kids
// who have been on the floor this match (a late joiner who hasn't risen yet doesn't count against anyone). Every kid
// standing earns m.mult personal points (the podium) and a round in their run.
function tally(m, ev) {
  m.open = {};
  m.phase = 'tally';
  const add = { red: 0, gold: 0 }, stand = { red: 0, gold: 0 }, out = { red: 0, gold: 0 }, present = { red: 0, gold: 0 };
  Object.values(m.kids).forEach((d) => {
    d.hover = false;
    if (d.st === 'up' && !d.away) {
      stand[d.team]++;
      present[d.team]++;
      d.pts += m.mult;
      d.stood++;
      d.run++;
      d.best = Math.max(d.best, d.run);
    } else {
      d.run = 0;
      if (!d.away && d.entered) { out[d.team]++; present[d.team]++; }
    }
  });
  ['red', 'gold'].forEach((t) => { add[t] = present[t] ? Math.round((R.ROUND_PTS * stand[t]) / present[t]) * m.mult : 0; });
  const before = { red: m.score.red, gold: m.score.gold };
  m.score.red += add.red;
  m.score.gold += add.gold;
  const leadBefore = before.red > before.gold ? 'red' : before.gold > before.red ? 'gold' : null;
  const lead = m.score.red > m.score.gold ? 'red' : m.score.gold > m.score.red ? 'gold' : null;
  m.lastAdd = add;
  m.history.push({ r: m.r, add, stand });
  ev.push({ type: 'tally', add, stand, out, present, score: { red: m.score.red, gold: m.score.gold }, lead, leadChanged: !!lead && lead !== leadBefore, mult: m.mult, final: m.final });
}

// Moves the phases on by the clock. → the events of this call, in order:
//   round {r, enter} · lock {s, set} · open {set, falls, saves} · close · tally {...} · end
function advance(m, now, rand) {
  const ev = [];
  if (m.paused || m.phase === 'final' || m.phase === 'done') return ev;
  for (let guard = 0; guard < 12; guard++) {
    if (m.phase === 'intro') {
      if (now - m.introAt < R.INTRO_MS) break;
      startRound(m, 1, m.introAt + R.INTRO_MS, rand, ev);
      continue;
    }
    const b = bounds(m), t = now - m.t0;
    if (m.phase === 'title' && t >= b.roulette) { m.phase = 'roulette'; continue; }
    if (m.phase === 'roulette' && t >= b.count) { m.phase = 'count'; continue; }
    if (m.phase === 'count' && t >= b.lock) { lock(m, rand, ev); continue; }
    if (m.phase === 'lock' && t >= b.open) { openDoors(m, ev); continue; }
    if (m.phase === 'open' && t >= b.close) { closeDoors(m, ev); continue; }
    if (m.phase === 'close' && t >= b.tally) { tally(m, ev); continue; }
    if (m.phase === 'tally' && t >= b.end) {
      if (m.r >= m.rounds) { m.phase = 'final'; ev.push({ type: 'end' }); break; }
      startRound(m, m.r + 1, m.t0 + b.end, rand, ev);
      continue;
    }
    break;
  }
  return ev;
}

// every runner one step (a kid in the pit, waiting or away stands still); a kid hovering on wings flies over the hole
function stepKids(m, dt) {
  if (m.paused || m.phase === 'final' || m.phase === 'done') return;
  const dist = R.SPEED * dt;
  Object.values(m.kids).forEach((d) => {
    if (d.st !== 'up' || d.away) return;
    if (Math.hypot(d.tx - d.x, d.ty - d.y) < 0.05) return;
    const [x, y] = A.move(d.x, d.y, d.tx, d.ty, dist, d.hover ? null : m.open);
    d.x = x; d.y = y;
  });
}
// a tap: where the kid wants to run (null when refused: not a number, not on the floor now)
function go(m, k, x, y) {
  const d = m.kids[k];
  if (!d || d.st !== 'up' || m.paused || m.phase === 'final' || m.phase === 'done') return null;
  const t = A.clampTarget(x, y);
  if (!t) return null;
  d.tx = t[0]; d.ty = t[1];
  return t;
}

// ---------- questions ----------
// what a question would give this kid right now: 'wings' (on the floor before «0» without wings), 'back' (in the pit),
// 'pre' (waiting to rise: a right answer = they rise with wings), or null
function wantQ(m, k, now) {
  const d = m.kids[k];
  if (!d || d.away || m.paused || m.phase === 'final' || m.phase === 'done') return null;
  if (d.st === 'down') return m.phase === 'intro' ? null : 'back';
  if (d.st === 'wait') return d.wingsNext ? null : 'pre';
  if (d.st === 'up' && !d.wings && BEFORE_LOCK[m.phase] && msToLock(m, now) >= R.Q_MIN_LEFT_MS) return 'wings';
  return null;
}
const tooFast = (sentAt, now) => !!sentAt && now - sentAt < R.TOO_FAST_MS;
// An answer (already judged: right / wrong) to a question of `kind`. → { kind, correct, wings, back: 'now' | 'next' |
// null, wait (ms before the next question after a miss), streak, rose: [x, y] when the kid rose at once }
function answer(m, k, kind, correct, now, rand) {
  const d = m.kids[k];
  const out = { kind, correct: !!correct, wings: false, back: null, wait: 0, streak: 0 };
  if (!d) return out;
  d.answered++;
  if (!correct) {
    d.streak = 0;
    d.wrongRow++;
    out.wait = d.wrongRow >= 2 ? R.WRONG_WAIT2_MS : R.WRONG_WAIT_MS;
    d.nextQAt = now + out.wait;
    return out;
  }
  d.right++;
  d.streak++;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  d.wrongRow = 0;
  d.nextQAt = 0;
  out.streak = d.streak;
  if (kind === 'wings' && d.st === 'up' && BEFORE_LOCK[m.phase] && !m.paused) {
    d.wings = true;
    out.wings = true;
  } else if (kind === 'back' && d.st === 'down') {
    d.backs++;
    if (BEFORE_LOCK[m.phase] && msToLock(m, now) >= R.RETURN_MIN_MS && !m.paused) {
      d.st = 'up';
      d.wings = false;
      const [x, y] = freeSpot(m, d.k, rand);
      d.x = x; d.y = y; d.tx = x; d.ty = y;
      out.back = 'now';
      out.rose = [x, y];
    } else {
      d.st = 'wait';
      d.wingsNext = false;
      out.back = 'next';
    }
  } else if (kind === 'pre' && d.st === 'wait') {
    d.wingsNext = true;
    out.wings = true;
  }
  return out;
}

// ---------- the teacher ----------
function pause(m, now) {
  if (m.paused || m.phase === 'final' || m.phase === 'done') return false;
  m.paused = true;
  m.pausedAt = now;
  return true;
}
function resume(m, now) {
  if (!m.paused) return 0;
  const shift = now - m.pausedAt;
  m.paused = false;
  m.t0 += shift;
  m.introAt += shift;
  Object.values(m.kids).forEach((d) => { if (d.nextQAt) d.nextQAt += shift; });
  return shift;
}
// «+30 s» = 2 rondas más (up to ROUNDS_MAX, never once the Final Round is on: it was announced as the last)
function addRounds(m, n) {
  if (m.final || m.phase === 'final' || m.phase === 'done') return false;
  const before = m.rounds;
  m.rounds = Math.min(R.ROUNDS_MAX, m.rounds + (n || R.MORE));
  return m.rounds > before;
}
// «⏭ Saltar»: the intro → round 1 now; a tally → the next round now
function skip(m, now, rand) {
  if (m.paused) return [];
  if (m.phase === 'intro') { m.introAt = now - R.INTRO_MS; return advance(m, now, rand); }
  if (m.phase === 'tally') { m.t0 = now - bounds(m).end; return advance(m, now, rand); }
  return [];
}
// when the match will end (for the clock on the screens), from the current round on
function endsAt(m, now) {
  const at = m.paused ? m.pausedAt : now;
  if (m.phase === 'final' || m.phase === 'done') return at;
  if (m.phase === 'intro') return m.introAt + timeCapMs(m.rounds) + (m.paused ? now - m.pausedAt : 0);
  const left = Math.max(0, m.t0 + bounds(m).end - at);
  let rest = 0;
  for (let r = m.r + 1; r <= m.rounds; r++) rest += ROUND_MS(r >= m.rounds);
  return now + left + rest;
}

// ---------- the ending (core/party.js: «¡FINAL!», the reveal, the winners, the bonus stars, each kid's card) ----------
// rows: [{ k, name, skin, team, pts, stood, best, saved, backs, right, answered, falls }]
//   pts    points for the kingdom (rounds standing; the Final Round ×2): the podium
const STARS = [
  { id: 'stand', name: 'Siempre en pie', unit: 'rondas seguidas', val: (r) => r.best, ok: (r) => r.best >= 3 },
  { id: 'saved', name: 'Alas salvadoras', unit: 'veces', val: (r) => r.saved, ok: (r) => r.saved >= 1, maxShare: 6 },
  { id: 'right', name: 'Más aciertos', unit: 'aciertos', val: (r) => r.right, ok: (r) => r.right >= 2 },
  { id: 'back', name: 'Vuelta épica', unit: 'vueltas', val: (r) => r.backs, ok: (r) => r.backs >= 1, maxShare: 4 },
];
function finish(rows, totalsIn) {
  const Party = require('./party');
  const t = { red: (totalsIn && totalsIn.red) || 0, gold: (totalsIn && totalsIn.gold) || 0 };
  const winner = t.red > t.gold ? 'red' : t.gold > t.red ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.pts - a.pts || b.best - a.best || b.right - a.right || a.k - b.k);
  Party.ranks(sorted, 'pts');
  const mvp = {};
  ['red', 'gold'].forEach((team) => { const top = sorted.find((r) => r.team === team && r.pts > 0); mvp[team] = top ? top.k : null; });
  const st = Party.stars(rows, STARS);
  rows.forEach((r) => {
    r.share = Party.share(r.pts, t[r.team]);
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return { totals: t, winner, mvp, stars: st, rows: sorted };
}

module.exports = {
  R, A, ROUND_MS, other, clampRounds, timeCapMs, newGame, kidOf, addKid, bounds, msToLock, hubNumber, planJumps,
  startRound, freeSpot, lock, openDoors, closeDoors, tally, advance, stepKids, go, wantQ, tooFast, answer, pause, resume, addRounds,
  skip, endsAt, STARS, finish,
};
