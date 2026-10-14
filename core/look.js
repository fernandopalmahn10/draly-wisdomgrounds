// Ojo de Halcón (gameType 'look') — the rules, no sockets (server.js glues them to the room).
// Super Mario Party «Looking for Love» as a Dralingo game show (spec docs/specs/ojo-de-halcon.md): every round one
// question from the pack lights up the board, its four answers light up one by one around it (random order, random
// moments, sometimes two together), every kid "looks" at the right word as fast as they can. The first lit lamp a kid
// taps locks them for the round: the right word gives a rank by arrival, a wrong word gives 0. Points by rank among the
// kids who looked right (5 / 3 / 2 / 1 with four kids, tiers for a class). Ten rounds, the sharpest eye wins.
// Player fields live on the room's player objects with an `lk` prefix; the game state is `k` (server: g.look).
// Looks are keyed by panel index (p.lkIdx), so a kid who reloads keeps their panel and can't look twice.
'use strict';

const POS = ['top', 'right', 'bottom', 'left'];
const R = {
  ROUNDS: 10, ROUNDS_MIN: 5, ROUNDS_MAX: 30, MORE: 5,
  INTRO_MS: 1800,            // «¡Mira la palabra correcta!» before round 1
  SHOW_MS: 2400,             // the question alone on the board (read it)
  FIRST_MS: [550, 1000],     // the first lamp, after the question
  GAP_MS: [420, 1050],       // between lamps
  PAIR_P: 0.28,              // one pair of lamps lights together (at most once per round)
  AFTER_LAST_MS: 3400,       // the round stays open this long after the last lamp
  ALL_LOOKED_MS: 700,        // everyone looked: close the round soon
  RESULT_MS: 2800,           // +N on the panels
  FINAL_MS: 1900,            // «¡FINAL!» before the winner show (under the bot harness's 2 s wait after lk:final, so game-end is counted)
  POINTS: [5, 3, 2, 1],
  TIERS: [0.25, 0.6],        // +3 up to the first quarter of the class, +2 up to 60 %, +1 for the rest who looked right
  CAP_PER_ROUND_S: 14, CAP_EXTRA_S: 60,   // the room's time cap (safety net; rounds end the game themselves)
  AWARD_MIN_RIGHT: 2,        // ⚡ Rayo needs at least 2 right looks
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampRounds = (n) => clamp(Math.round(Number(n) || R.ROUNDS), R.ROUNDS_MIN, R.ROUNDS_MAX);
const timeCapS = (rounds) => clampRounds(rounds) * R.CAP_PER_ROUND_S + R.CAP_EXTRA_S;

// deterministic rng (tests replay a seed)
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rng) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const between = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));

function newGame(seed, rounds, now) {
  return {
    id: seed, seed, rng: mulberry32(seed), rounds: clampRounds(rounds), round: 0,
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    q: null, looks: {}, right: 0, paused: false, pausedAt: 0, nextIdx: 1,
  };
}
const inRound = (k, p) => !!(p && k && p.lkRound === k.id);

// A kid joins this game (start, late join, rejoin): a panel index that stays for the whole game.
function preparePlayer(k, p) {
  if (inRound(k, p)) return false;
  p.lkRound = k.id;
  p.lkIdx = k.nextIdx++;
  p.score = 0;
  p.lkStreak = 0; p.lkBest = 0; p.lkFirsts = 0; p.lkRight = 0; p.lkWrong = 0; p.lkMiss = 0; p.lkMs = 0; p.lkRounds = 0;
  return true;
}

// A new round from a pack question { text, answers[4], correct, image }: the answers go to random lamps, the lamps light
// up in a random order at random moments after the question has been on screen alone.
function startRound(k, question, image, now) {
  const rng = k.rng;
  // the right answer always rides along (a set with more than four answers never loses it); the lamps are shuffled anyway
  const answers = [question.correct].concat(question.answers.filter((a) => a !== question.correct)).slice(0, 4);
  const place = shuffle([0, 1, 2, 3], rng);          // answers[i] goes to lamp place[i]
  const order = shuffle(place.slice(0, answers.length), rng);   // the lamps with an answer light up in this order
  const opts = [null, null, null, null];             // a set with 2–3 answers leaves the other lamps dark
  answers.forEach((a, i) => { opts[place[i]] = a; });
  const correctPos = place[Math.max(0, answers.indexOf(question.correct))];
  const at = [Infinity, Infinity, Infinity, Infinity];
  const pairAt = order.length > 1 && rng() < R.PAIR_P ? 1 + Math.floor(rng() * (order.length - 1)) : -1;   // lights with the one before
  let t = now + R.SHOW_MS + between(rng, R.FIRST_MS);
  order.forEach((pos, j) => {
    if (j > 0 && j !== pairAt) t += between(rng, R.GAP_MS);
    at[pos] = t;
  });
  k.round++;
  k.q = {
    text: question.text, image: image || null, opts, correctPos, at, order,
    open: now + R.SHOW_MS, first: at[order[0]], last: t, closeAt: t + R.AFTER_LAST_MS,
  };
  k.phase = 'show';
  k.phaseAt = now;
  k.phaseUntil = k.q.open;
  k.looks = {};
  k.right = 0;
  return k.q;
}
function beginReveal(k, now) {
  if (!k.q || k.phase !== 'show') return false;
  k.phase = 'reveal';
  k.phaseAt = now;
  k.phaseUntil = k.q.closeAt;
  return true;
}

// A kid tapped lamp `pos`. The first LIT lamp locks them for the round.
function look(k, p, pos, now) {
  if (!k.q || k.phase !== 'reveal' || !inRound(k, p) || k.paused) return { status: 'closed' };
  const prev = k.looks[p.lkIdx];
  if (prev) return { status: 'locked', look: prev };
  if (!(pos >= 0 && pos < 4) || !Number.isInteger(pos)) return { status: 'closed' };
  if (now < k.q.at[pos]) return { status: 'blank', pos };
  const ok = pos === k.q.correctPos;
  if (ok) k.right++;
  const lk = { pos, ok, rank: ok ? k.right : 0, at: now, ms: Math.max(0, now - k.q.at[pos]) };
  k.looks[p.lkIdx] = lk;
  return { status: ok ? 'ok' : 'wrong', look: lk };
}
// every connected kid of the game has looked this round (so the round can close early)
function everyoneLooked(k, players) {
  const kids = Object.values(players).filter((p) => inRound(k, p) && !p.disconnected);
  return kids.length > 0 && kids.every((p) => !!k.looks[p.lkIdx]);
}

// Points by rank among the kids who looked right, for a class of n kids this round.
function pointsFor(rank, n) {
  if (!(rank >= 1)) return 0;
  const size = Math.max(1, n | 0);
  if (rank === 1) return R.POINTS[0];
  if (rank <= Math.max(2, Math.ceil(size * R.TIERS[0]))) return R.POINTS[1];
  if (rank <= Math.max(3, Math.ceil(size * R.TIERS[1]))) return R.POINTS[2];
  return R.POINTS[3];
}

// The round closes: points to every panel, streaks and stats on the players.
function closeRound(k, players, now) {
  if (!k.q) return null;
  k.phase = 'result';
  k.phaseAt = now;
  k.phaseUntil = now + R.RESULT_MS;
  const kids = Object.values(players).filter((p) => inRound(k, p));
  const n = Math.max(1, kids.filter((p) => !p.disconnected || k.looks[p.lkIdx]).length);
  const rows = [];
  kids.forEach((p) => {
    const lk = k.looks[p.lkIdx];
    const ok = !!(lk && lk.ok);
    const pts = ok ? pointsFor(lk.rank, n) : 0;
    if (!p.disconnected || lk) p.lkRounds++;
    p.score = (p.score || 0) + pts;
    if (ok) {
      p.lkStreak++; p.lkRight++; p.lkMs += lk.ms;
      if (lk.rank === 1) p.lkFirsts++;
    } else {
      p.lkStreak = 0;
      if (lk) p.lkWrong++;
      else if (!p.disconnected) p.lkMiss++;
    }
    p.lkBest = Math.max(p.lkBest, p.lkStreak);
    rows.push({
      idx: p.lkIdx, name: p.name, skin: p.lkSkin || null, pts, rank: ok ? lk.rank : 0, pos: lk ? lk.pos : -1, ok,
      looked: !!lk, ms: lk ? lk.ms : 0, score: p.score, streak: p.lkStreak, off: !!p.disconnected,
    });
  });
  rows.sort((a, b) => a.idx - b.idx);
  const first = rows.find((r) => r.rank === 1) || null;
  return {
    round: k.round, rounds: k.rounds, correctPos: k.q.correctPos, correctText: k.q.opts[k.q.correctPos],
    rows, first, n, last: k.round >= k.rounds,
  };
}

// Final standings: score, then most +5, then the faster average reaction.
function finish(k, players) {
  const rows = Object.entries(players).filter(([, p]) => inRound(k, p)).map(([id, p]) => ({
    id, idx: p.lkIdx, name: p.name, skin: p.lkSkin || null, avatar: p.avatar || '', score: p.score || 0,
    firsts: p.lkFirsts || 0, right: p.lkRight || 0, wrong: p.lkWrong || 0, miss: p.lkMiss || 0, best: p.lkBest || 0,
    avg: p.lkRight ? Math.round(p.lkMs / p.lkRight) : null, rounds: p.lkRounds || 0, off: !!p.disconnected,
  }));
  rows.sort((a, b) => b.score - a.score || b.firsts - a.firsts || ((a.avg == null) - (b.avg == null)) || (a.avg || 0) - (b.avg || 0) || a.idx - b.idx);
  const winner = rows[0] || null;
  const winners = winner ? rows.filter((r) => r.score === winner.score) : [];
  const taken = new Set();
  const pickAward = (list) => {
    const free = list.find((r) => !taken.has(r.id)) || list[0] || null;
    if (free) taken.add(free.id);
    return free;
  };
  const eye = pickAward(rows.filter((r) => r.firsts > 0).sort((a, b) => b.firsts - a.firsts || b.score - a.score || a.idx - b.idx));
  const fastest = pickAward(rows.filter((r) => r.avg != null && r.right >= R.AWARD_MIN_RIGHT).sort((a, b) => a.avg - b.avg || b.score - a.score || a.idx - b.idx));
  const streak = pickAward(rows.filter((r) => r.best >= 2).sort((a, b) => b.best - a.best || b.score - a.score || a.idx - b.idx));
  return { rows, winner, winners, tie: winners.length > 1, awards: { eye, fastest, streak }, rounds: k.round, totalRounds: k.rounds };
}

// The teacher paused for `ms`: every pending moment moves by that much.
function shiftTimes(k, ms) {
  k.phaseAt += ms;
  k.phaseUntil += ms;
  if (k.q) {
    k.q.open += ms; k.q.first += ms; k.q.last += ms; k.q.closeAt += ms;
    k.q.at = k.q.at.map((t) => (t === Infinity ? t : t + ms));
  }
}
// what the screens need to light the lamps in sync: ms from now to each lamp (negative = already lit, null = never)
const offsets = (k, now) => (k.q ? k.q.at.map((t) => (t === Infinity ? null : t - now)) : []);

module.exports = {
  R, POS, mulberry32, clampRounds, timeCapS, newGame, inRound, preparePlayer, startRound, beginReveal, look, everyoneLooked,
  pointsFor, closeRound, finish, shiftTimes, offsets,
};
