// Ojos de Halcón (gameType 'halcon') — the rules, no sockets (server.js glues them to the room).
// Super Mario Party «Looking for Love» (youtube y9BKCVx_mNk, 1:07–1:51) recreated with our cast: the class plays in
// BOARDS OF 4 like real Mario Party matches. Every round a curriculum question flashes across the board, its four
// answers pop into the four round windows (top · right · bottom · left) and every kid "looks" at (taps) the window with
// the right answer. One look per round, locked. When the round resolves, the right looks of each board score by speed
// INSIDE that board: +5 / +3 / +2 / +1 (board of 3: 5/3/2, board of 5: 5/3/2/1/1); a wrong look or no look = 0.
// Until the reveal, screens only learn WHO has looked (lookView), never which window: at the resolve everybody snaps
// to their window at once, like the video.
// Ten rounds (or 15), no elimination; the class ranking sums the points (every board hands out the same maximum).
// Spec: docs/specs/ojos-de-halcon.md. Player fields live on the room's player objects with an `hc` prefix; the game is
// `h` (server: g.halcon). Kids sit in SEATS (stable ids) so a reload or a new socket keeps the seat, the board and the look.
'use strict';

const POS = ['top', 'right', 'bottom', 'left'];
const R = {
  ROUNDS: 10, ROUNDS_MIN: 5, ROUNDS_MAX: 20, MORE: 5,
  INTRO_MS: 1700,            // «¡Mira la respuesta correcta!» → «¡YA!» before round 1 (the run-in plays in the countdown)
  QUESTION_MS: 1500,         // the question across the board (windows still closed)
  ANSWER_MS: 6000,           // the four answers in the windows: look!
  ALL_DONE_MS: 500,          // every connected kid looked: the round resolves this soon (they see their own look first)
  RESOLVE_MS: 2300,          // glow + «+5» / slump, chips count up (a little longer than the video: kids read the verdict)
  FINAL_MS: 2600,            // «¡FINAL!» and the final chips, then the studio finale (game-end)
  BOARD: 4,                  // the size of a Mario Party match
  BOARD_MAX: 5,              // a late joiner can make a board of 5, never 6
  ONE_BOARD_MAX: 5,          // up to 5 kids play as one board
  POINTS: [5, 3, 2, 1, 1],   // by speed rank among the right looks of a board (sliced to the board's size)
  SHORT_OPT: 22,             // a "look fast" game prefers questions whose answers fit a window (≤ 22 characters)
  CAP_PER_ROUND_S: 12, CAP_EXTRA_S: 45,   // the room's time cap (safety net only: the rounds end the game themselves)
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
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- boards ----------
// ≤ 5 kids = one board; otherwise ceil(n / 4) boards with sizes as even as possible (always 3 or 4 when n ≥ 6).
function boardSizes(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (!n) return [];
  if (n <= R.ONE_BOARD_MAX) return [n];
  const k = Math.ceil(n / R.BOARD);
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}
// ids → boards of ids (shuffled, so friends who joined together don't always share a board)
function splitBoards(ids, rng) {
  const mixed = shuffle(ids, rng || Math.random);
  const out = [];
  let i = 0;
  boardSizes(mixed.length).forEach((size) => { out.push(mixed.slice(i, i + size)); i += size; });
  return out;
}

function newGame(seed, rounds, now) {
  return {
    id: seed, seed, rng: mulberry32(seed), rounds: clampRounds(rounds), round: 0,
    phase: 'countdown', phaseAt: now, phaseUntil: now,
    boards: [], seats: {}, nextSeat: 1, nextBoard: 1,
    q: null, looks: {}, boardRight: {}, paused: false, pausedAt: 0,
    order: [], qi: 0,
  };
}
const inGame = (h, p) => !!(h && p && p.hcGame === h.id && h.seats[p.hcSeat]);

function resetStats(p) {
  p.score = 0;
  p.hcStreak = 0; p.hcBest = 0; p.hcFirsts = 0; p.hcRight = 0; p.hcWrong = 0; p.hcMiss = 0; p.hcMs = 0;
}
function seatIn(h, board, p, skin) {
  const id = h.nextSeat++;
  h.seats[id] = { id, board: board.id, name: p.name, skin: skin || 'dralingo', score: 0 };
  board.seats.push(id);
  p.hcGame = h.id;
  p.hcSeat = id;
  p.hcBoard = board.id;
  p.hcSkin = h.seats[id].skin;
  resetStats(p);
  return h.seats[id];
}
function addBoard(h) {
  const b = { id: h.nextBoard++, seats: [] };
  h.boards.push(b);
  return b;
}
// The start: every kid in the room gets a seat; boards of 4 (3 when it doesn't divide; one board up to 5).
// entries: [[pid, player, skin], …]
function deal(h, entries) {
  const byPid = {};
  entries.forEach(([pid, p, skin]) => { byPid[pid] = [p, skin]; });
  splitBoards(entries.map((e) => e[0]), h.rng).forEach((ids) => {
    const b = addBoard(h);
    ids.forEach((pid) => seatIn(h, b, byPid[pid][0], byPid[pid][1]));
  });
  return h.boards;
}
// A late joiner sits at the smallest board that still has room (max 5); every board full → a new board.
// A kid already seated in this game keeps the seat (reload, new socket) and gets null.
function lateSeat(h, p, skin) {
  if (inGame(h, p)) return null;
  const open = h.boards.filter((b) => b.seats.length < R.BOARD_MAX)
    .sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(h);
  seatIn(h, b, p, skin);
  return b;
}
const boardOf = (h, id) => h.boards.find((b) => b.id === id) || null;

// ---------- questions ----------
const usable = (q) => !!(q && q.text && q.correct && Array.isArray(q.answers) && q.answers.length >= 2 && q.answers.includes(q.correct));
const shortQ = (q) => q.answers.every((a) => String(a).length <= R.SHORT_OPT);
// The order the pack is played in: questions whose answers fit a window first (shuffled), then the rest.
function pickOrder(questions, rng) {
  const idx = (questions || []).map((q, i) => (usable(q) ? i : -1)).filter((i) => i >= 0);
  const short = idx.filter((i) => shortQ(questions[i]));
  const long = idx.filter((i) => !shortQ(questions[i]));
  return shuffle(short, rng).concat(shuffle(long, rng));
}
function nextQuestion(h, questions) {
  if (!h.order.length) h.order = pickOrder(questions, h.rng);
  if (!h.order.length) return null;
  if (h.qi >= h.order.length) { h.order = pickOrder(questions, h.rng); h.qi = 0; }
  return questions[h.order[h.qi++]] || null;
}

// A new round: the answers go to random windows. picFor (optional): answer → picture url; the windows show pictures
// only when every answer has one (otherwise text, never a mix).
function startQuestion(h, question, image, picFor, now) {
  const answers = [question.correct].concat(question.answers.filter((a) => a !== question.correct)).slice(0, 4);
  const place = shuffle([0, 1, 2, 3], h.rng);       // answers[i] goes to window place[i]
  const opts = [null, null, null, null];
  answers.forEach((a, i) => { opts[place[i]] = String(a); });
  let pics = null;
  if (picFor) {
    const p = answers.map((a) => picFor[a] || null);
    if (p.every(Boolean) && new Set(p).size === p.length) { pics = [null, null, null, null]; answers.forEach((a, i) => { pics[place[i]] = p[i]; }); }
  }
  h.round++;
  h.q = {
    text: String(question.text), image: image || null, opts, pics, correctPos: place[0],
    openAt: now + R.QUESTION_MS, closeAt: now + R.QUESTION_MS + R.ANSWER_MS,
  };
  h.phase = 'question';
  h.phaseAt = now;
  h.phaseUntil = h.q.openAt;
  h.looks = {};
  h.boardRight = {};
  return h.q;
}
function openAnswers(h, now) {
  if (!h.q || h.phase !== 'question') return false;
  h.phase = 'answer';
  h.phaseAt = now;
  h.q.openAt = now;
  h.q.closeAt = now + R.ANSWER_MS;
  h.phaseUntil = h.q.closeAt;
  return true;
}

// A kid looked at window `pos`. The first look locks the round; right / wrong stays secret until the round resolves
// (like the video: everybody learns it at the same moment). The speed rank counts inside the kid's board.
function answer(h, p, pos, now) {
  if (!h.q || h.phase !== 'answer' || h.paused || !inGame(h, p)) return { status: 'closed' };
  const prev = h.looks[p.hcSeat];
  if (prev) return { status: 'locked', look: prev };
  if (!Number.isInteger(pos) || pos < 0 || pos > 3 || h.q.opts[pos] == null) return { status: 'closed' };
  const ok = pos === h.q.correctPos;
  let rank = 0;
  if (ok) { rank = (h.boardRight[p.hcBoard] || 0) + 1; h.boardRight[p.hcBoard] = rank; }
  const look = { pos, ok, rank, ms: Math.max(0, now - h.q.openAt), at: now, board: p.hcBoard };
  h.looks[p.hcSeat] = look;
  return { status: 'ok', look };
}
// every connected kid of the game has looked this round (so the round can resolve early)
function allAnswered(h, players) {
  const kids = Object.values(players).filter((p) => inGame(h, p) && !p.disconnected);
  return kids.length > 0 && kids.every((p) => !!h.looks[p.hcSeat]);
}
// After a look: when every connected kid has looked, the round closes ALL_DONE_MS from now (never later than its own
// end). Returns the ms left until the close when it moved, else 0 (the round keeps its 6 s window).
function closeEarly(h, players, now) {
  if (!h.q || h.phase !== 'answer' || !allAnswered(h, players)) return 0;
  if (h.q.closeAt - now <= R.ALL_DONE_MS) return 0;
  h.q.closeAt = now + R.ALL_DONE_MS;
  h.phaseUntil = h.q.closeAt;
  return R.ALL_DONE_MS;
}
// What a screen may know about this round's looks BEFORE the reveal (his decision 2026-10-14, like the video: everybody
// snaps to their window together at the resolve): who is ready (has looked) on the given boards and, for a phone, its
// own window. Other players' windows are never in it.
function lookView(h, boardIds, you) {
  const ids = new Set(boardIds);
  const ready = [];
  let mine = null;
  Object.entries(h.looks).forEach(([sid, l]) => {
    if (!ids.has(l.board)) return;
    ready.push(Number(sid));
    if (you != null && Number(sid) === you) mine = l.pos;
  });
  return { ready, mine };
}
// how many of a board looked already (the projector's «3/4»)
const lookedIn = (h, boardId) => Object.values(h.looks).filter((l) => l.board === boardId).length;

// Points by speed rank among the right looks of a board of `size` seats: 4 → 5/3/2/1, 3 → 5/3/2, 5 → 5/3/2/1/1.
function pointsFor(rank, size) {
  if (!(rank >= 1)) return 0;
  const table = R.POINTS.slice(0, clamp(Math.floor(size) || 1, 1, R.POINTS.length));
  return table[Math.min(rank, table.length) - 1];
}

const bySeat = (h, players) => {
  const out = {};
  Object.entries(players).forEach(([pid, p]) => { if (inGame(h, p)) out[p.hcSeat] = [pid, p]; });
  return out;
};

// The round resolves: points per board, streaks and stats on the players. Returns what every screen shows.
function resolve(h, players, now) {
  if (!h.q) return null;
  h.phase = 'resolve';
  h.phaseAt = now;
  h.phaseUntil = now + R.RESOLVE_MS;
  const seats = bySeat(h, players);
  const boards = h.boards.map((b) => {
    const size = b.seats.length;
    const rows = b.seats.map((sid) => {
      const hit = seats[sid];
      const p = hit ? hit[1] : null;
      const lk = h.looks[sid];
      const ok = !!(lk && lk.ok);
      const pts = ok ? pointsFor(lk.rank, size) : 0;
      if (p) {
        p.score = (p.score || 0) + pts;
        if (ok) {
          p.hcStreak++; p.hcRight++; p.hcMs += lk.ms;
          if (pts === R.POINTS[0]) p.hcFirsts++;
        } else {
          p.hcStreak = 0;
          if (lk) p.hcWrong++;
          else if (!p.disconnected) p.hcMiss++;
        }
        p.hcBest = Math.max(p.hcBest, p.hcStreak);
        h.seats[sid].score = p.score;
      }
      return {
        id: sid, pos: lk ? lk.pos : -1, ok, looked: !!lk, rank: ok ? lk.rank : 0, pts,
        score: h.seats[sid].score, streak: p ? p.hcStreak : 0, off: !p || !!p.disconnected,
      };
    });
    return { id: b.id, rows };
  });
  return {
    round: h.round, rounds: h.rounds, correctPos: h.q.correctPos, correctText: h.q.opts[h.q.correctPos],
    boards, last: h.round >= h.rounds,
  };
}

// ---------- standings ----------
const avgOf = (r) => (r.right ? Math.round(r.ms / r.right) : null);
// score, then most +5, then the faster average look, then the earlier seat
function cmp(a, b) {
  return b.score - a.score || b.firsts - a.firsts
    || ((a.avg == null) - (b.avg == null)) || (a.avg || 0) - (b.avg || 0) || a.id - b.id;
}
const same = (a, b) => !!a && !!b && a.score === b.score && a.firsts === b.firsts && a.avg === b.avg;
function rankRows(rows) {
  rows.sort(cmp);
  rows.forEach((r, i) => { r.rank = i > 0 && same(r, rows[i - 1]) ? rows[i - 1].rank : i + 1; });
  return rows;
}
// why the winner won when the points were level («más +5» / «más rápido»), null when the points decided
function tiebreak(rows) {
  const [a, b] = rows;
  if (!a || !b || a.score !== b.score || same(a, b)) return null;
  return a.firsts !== b.firsts ? 'firsts' : 'speed';
}
function finish(h, players) {
  const seats = bySeat(h, players);
  const row = (sid) => {
    const s = h.seats[sid];
    const hit = seats[sid];
    const p = hit ? hit[1] : null;
    const r = {
      id: sid, pid: hit ? hit[0] : null, board: s.board, name: s.name, skin: s.skin, score: p ? p.score || 0 : s.score || 0,
      firsts: p ? p.hcFirsts : 0, right: p ? p.hcRight : 0, wrong: p ? p.hcWrong : 0, miss: p ? p.hcMiss : 0,
      best: p ? p.hcBest : 0, ms: p ? p.hcMs : 0, off: !p || !!p.disconnected,
    };
    r.avg = avgOf(r);
    return r;
  };
  // nobody wins with 0 points (e.g. «Terminar» during the intro): no winner, nobody is told «¡Ganaste!»
  const top = (rows) => rows.filter((r) => r.rank === 1 && r.score > 0);
  const boards = h.boards.filter((b) => b.seats.length).map((b) => {
    const rows = rankRows(b.seats.map(row));
    const winners = top(rows);
    return { id: b.id, rows, winners, why: winners.length ? tiebreak(rows) : null };
  });
  const all = rankRows(Object.keys(h.seats).map((sid) => row(Number(sid))));
  const winners = top(all);
  return {
    boards, all, winners, why: winners.length ? tiebreak(all) : null,
    rounds: h.round, totalRounds: h.rounds,
  };
}

// The teacher paused for `ms`: every pending moment moves by that much.
function shiftTimes(h, ms) {
  h.phaseAt += ms;
  h.phaseUntil += ms;
  if (h.q) { h.q.openAt += ms; h.q.closeAt += ms; }
}

module.exports = {
  R, POS, mulberry32, shuffle, clampRounds, timeCapS, boardSizes, splitBoards, newGame, inGame, deal, lateSeat, boardOf,
  pickOrder, nextQuestion, startQuestion, openAnswers, answer, allAnswered, closeEarly, lookView, lookedIn, pointsFor, resolve, finish,
  shiftTimes,
};
