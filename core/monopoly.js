// Dàfùwēng · Monopolio v2 (gameType 'monopoly') — the rules, no sockets (server.js «MONOPOLIO v2» block glues them to
// the room). «El Gran Tablero de Dubái»: a Mario Party board night. The class plays in BOARDS OF 4 (3 when it doesn't
// divide, one board up to 5: the deal of core/halcon.js), every kid for themself, all boards on the same map at once.
// A right answer opens a dice window; the phone's tap only says "now" (the server picks the number; no tap in time →
// the same dice roll by themselves). The piece walks, passes Salida (+coins) and the star (buy it with 10 coins), and
// lands: blue +3, red −3, a landmark (buy it / pay its toll to the owner / level it up), «¡Suerte!» (chest, swap, duel,
// advance 3), «¡Tormenta de arena!» (the whole board drops coins, the star flies away). Every turn is resolved at once
// here and played back on the phones as a script whose length the server knows (the next question waits for it).
// More stars wins (then coins); the last 30 s every coin counts ×2; the last kid of a board who trails the leader gets
// lucky coins capped at the gap; the end gives three Mario Party bonus stars per board, then each board's winner and the
// class podium. Spec: docs/specs/monopoly-v2.md. Every kid's numbers live in m.kids[k] (k = the server's stable id), so
// a kid who left still counts at the end and keeps the landmarks they own.
'use strict';

const MAP = require('../public/js/monopoly-map');
const Halcon = require('./halcon');      // boards of 4: boardSizes, splitBoards, mulberry32

const R = {
  INTRO_MS: 2800,            // «¡Responde y tira el dado!» → «¿Listos?» → «¡YA!» after the 3.5 s run-in countdown
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  DURATIONS: [180, 240, 300],
  DURATION: 240,
  Q_MS: 20000,               // the phone's clock for a question
  Q_GRACE_MS: 3000,          // …the server calls «time up» this much later (a frozen tab can't hold a kid)
  FAST_MS: 600,              // an answer reaching the server sooner than this after its question was sent = too fast = wrong
  WRONG_MS: 2200,            // the «¡Casi!» wait
  WRONG2_MS: 3400,           // …after two wrong in a row («¡Respira!»)
  LEAD_MS: 800,              // «¡Correcto!» on the phone before the dice block shows
  DICE_MS: 3000,             // the dice block waits this long for the tap…
  DICE_GRACE_MS: 1200,       // …and the server this much more (network) before rolling by itself
  T: MAP.T,                  // how long each moment of a turn plays on the phones (public/js/monopoly-map.js)
  START_COINS: 5,
  BLUE: 3, RED: 3, PASS: 4, STAR_PRICE: 10,
  CHEST: 5, CHEST_GOLD: 10, DUEL: 4, STORM: 2, AHEAD: 3,
  LUCKY: [['chest', 45], ['gold', 10], ['swap', 15], ['duel', 15], ['ahead', 15]],   // the «¡Suerte!» roulette
  LEVEL_MAX: 3,
  DOUBLE_EVERY: 3,           // every 3rd right answer in a row: two dice
  FRENZY_MS: 30000,          // the last 30 s: every coin won or lost ×2
  FRENZY_MAX_FRAC: 1 / 3,
  LEAD_COINS: 3,             // a new leader needs a star more, or the same stars and this many coins more
  LEAD_GAP_MS: 6000,         // lead alarms of one board at least this far apart
  BEHIND: 8,                 // the last kid of a board, ≥ this behind the leader (a star = STAR_PRICE coins): lucky coins
  BOARD: 4, BOARD_MAX: 5, ONE_BOARD_MAX: 5,
};
const N = MAP.N;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 30, 600);
const frenzyMs = (durationS) => Math.round(Math.min(R.FRENZY_MS, Math.max(10, durationS) * 1000 * R.FRENZY_MAX_FRAC));
const value = (r) => (r.stars || 0) * R.STAR_PRICE + (r.coins || 0);
const BLUES = MAP.SPACES.map((s, i) => (s.t === 'blue' ? i : -1)).filter((i) => i >= 0);

// ---------- the game ----------
function newGame(seed, durationS, now) {
  const duration = clampDuration(durationS);
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration,
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    playAt: 0, endsAt: 0, frenzyAt: 0, frenzy: false, endedAt: 0,
    paused: false, pausedAt: 0,
    boards: [], nextBoard: 1, kids: {}, nextTid: 1,
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const boardOf = (m, id) => m.boards.find((b) => b.id === id) || null;
const seatsOf = (m, b) => (b ? b.seats.map((k) => m.kids[k]).filter(Boolean) : []);
function newRecord(k, name, skin) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b: null, c: 0, pos: 0, coins: R.START_COINS, stars: 0,
    right: 0, wrong: 0, answered: 0, streak: 0, best: 0, fast: null, wrongRow: 0, tooFast: 0, timeUps: 0,
    steps: 0, tolls: 0, paid: 0, luck: 0, bought: 0, duels: 0, laps: 0,
    turn: null, nextQAt: 0, last: null,
  };
}
// a board: its seats (kid ids), the star's space, who owns which landmark and its level, the lead (hysteresis + alarm gap)
function addBoard(m) {
  const b = { id: m.nextBoard++, seats: [], star: MAP.STAR_START, owners: {}, lead: null, announced: null, lastAlarm: -1e12, seq: 0 };
  m.boards.push(b);
  return b;
}
function seatIn(m, b, r) {
  const used = new Set(seatsOf(m, b).map((x) => x.c));
  let c = 0;
  while (used.has(c)) c++;
  r.b = b.id;
  r.c = c;
  b.seats.push(r.k);
  return r;
}
// The start: every kid of the room gets a seat; boards of 4 (3 when it doesn't divide; one board up to 5).
// entries: [[k, name, skin], …]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin]) => { byK[k] = m.kids[k] || newRecord(k, name, skin); });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addBoard(m);
    ks.forEach((k) => { m.kids[k] = byK[k]; seatIn(m, b, byK[k]); });
  });
  return m.boards;
}
// A late joiner sits at the smallest board that still has room (max 5); every board full → a new board.
// A kid already seated keeps the seat (a reload, a new socket) and gets null.
function seatLate(m, k, name, skin) {
  if (m.kids[k] && m.kids[k].b != null) return null;
  const r = m.kids[k] || (m.kids[k] = newRecord(k, name, skin));
  const open = m.boards.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(m);
  seatIn(m, b, r);
  return b;
}
const inGame = (m, k) => !!(m && m.kids[k] && m.kids[k].b != null);

function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.playAt = now;
  m.endsAt = now + m.duration * 1000;
  m.frenzyAt = m.endsAt - frenzyMs(m.duration);
  m.phaseUntil = m.endsAt;
}
// the teacher's «+30 s»: the end moves; the frenzy keeps its start when it is already on (more double time)
function addTime(m, ms) {
  if (m.phase !== 'play') return false;
  m.endsAt += ms;
  m.phaseUntil = m.endsAt;
  if (!m.frenzy) m.frenzyAt = m.endsAt - frenzyMs(m.duration);
  m.duration += ms / 1000;
  return true;
}
// the teacher paused for `ms`: every pending moment moves by that much (the kids' waits and dice windows too)
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.boards.forEach((b) => { b.lastAlarm += ms; });
  Object.values(m.kids).forEach((r) => {
    if (r.turn) r.turn.sentAt += ms;
    if (r.nextQAt) r.nextQAt += ms;
  });
}
// «¡FINAL!»: no new questions; a dice window still open rolls by itself (the right answer is never lost)
function final(m, now) {
  m.phase = 'final';
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  m.endedAt = now;
}

// ---------- answers ----------
// A kid answered (ms = since the question reached the server). Right → a dice window (two dice every 3rd in a row).
// Wrong / time up / too fast → the streak resets and a wait (longer after two in a row).
function answer(m, k, correct, ms, now, timeUp) {
  const r = kid(m, k);
  if (!r) return null;
  r.answered++;
  const tooFast = !timeUp && Number.isFinite(ms) && ms < R.FAST_MS;
  if (!correct || tooFast) {
    r.wrong++;
    if (tooFast) r.tooFast++;
    if (timeUp) r.timeUps++;
    r.streak = 0;
    r.wrongRow++;
    const wait = r.wrongRow >= 2 ? R.WRONG2_MS : R.WRONG_MS;
    r.nextQAt = now + wait;
    return { right: false, streak: 0, wait, calm: r.wrongRow >= 2, tooFast, timeUp: !!timeUp };
  }
  r.right++;
  r.streak++;
  r.wrongRow = 0;
  r.best = Math.max(r.best, r.streak);
  if (Number.isFinite(ms)) r.fast = r.fast == null ? ms : Math.min(r.fast, ms);
  const dice = r.streak % R.DOUBLE_EVERY === 0 ? 2 : 1;
  r.turn = { tid: m.nextTid++, sentAt: now, dice };
  r.nextQAt = 0;
  return { right: true, streak: r.streak, turn: { tid: r.turn.tid, dice, lead: R.LEAD_MS, ms: R.DICE_MS } };
}
// the moment the server rolls a dice window by itself
const rollAt = (r) => r.turn.sentAt + R.LEAD_MS + R.DICE_MS + R.DICE_GRACE_MS;

// ---------- one turn ----------
const die = (m) => 1 + Math.floor(m.rng() * 6);
// the board's leader value and whether r is its (trailing) last: lucky coins for r, capped at the gap
function luckOf(m, b, r) {
  const seats = seatsOf(m, b);
  if (seats.length < 2) return 0;
  const vals = seats.map(value);
  const mine = value(r);
  const top = Math.max(...vals), low = Math.min(...vals);
  if (mine > low || top - mine < R.BEHIND) return 0;
  return top - mine;
}
// a gain of `base` coins (blue, Salida, chests): ×2 in the frenzy; the trailing last kid gets it doubled again, the extra
// capped so luck alone never takes them past the leader
function gain(m, b, r, base) {
  const g = base * (m.frenzy ? 2 : 1);
  const gap = luckOf(m, b, r);
  const extra = gap > 0 ? Math.max(0, Math.min(g, gap - g)) : 0;
  r.coins += g + extra;
  r.luck += extra;
  return { coins: g + extra, lucky: extra > 0 };
}
function lose(m, r, base) {
  const n = Math.min(r.coins, base * (m.frenzy ? 2 : 1));
  r.coins -= n;
  return n;
}
// the star flies to another blue space, at least 5 steps from where it was (and never where a piece of this board stands
// if there is a choice)
function moveStar(m, b) {
  const from = b.star;
  const taken = new Set(seatsOf(m, b).map((r) => r.pos));
  let pool = BLUES.filter((i) => Math.min(MAP.ahead(from, i), MAP.ahead(i, from)) >= 5);
  const free = pool.filter((i) => !taken.has(i));
  if (free.length) pool = free;
  // a quiet comeback: the kid who saved the most coins but has no star yet finds the next one 2-8 spaces ahead
  // (without it ~1 in 5 slow kids ended a 3-minute game with 20+ coins and no star: «I never reached it»)
  const saver = seatsOf(m, b).filter((r) => r.stars === 0 && r.coins >= R.STAR_PRICE).sort((x, y) => y.coins - x.coins)[0];
  if (saver) {
    const near = pool.filter((i) => { const d = MAP.ahead(saver.pos, i); return d >= 2 && d <= 8; });
    if (near.length) pool = near;
  }
  b.star = pool[Math.floor(m.rng() * pool.length)];
  return b.star;
}
function pickLucky(m, rivals) {
  const opts = R.LUCKY.filter(([id]) => rivals || (id !== 'swap' && id !== 'duel'));
  const tot = opts.reduce((a, o) => a + o[1], 0);
  let x = m.rng() * tot;
  for (const [id, w] of opts) { if ((x -= w) < 0) return id; }
  return opts[0][0];
}
const snap = (r) => [r.pos, r.coins, r.stars];

// The dice: resolves the whole turn now. Returns { script } for the kid's own phone and { move } for the board's other
// phones and the projector (both carry absolute numbers after each moment, so screens that miss one catch up).
function roll(m, k, now, auto) {
  const r = kid(m, k);
  if (!r || !r.turn) return null;
  const b = boardOf(m, r.b);
  if (!b) { r.turn = null; return null; }
  const t = r.turn;
  r.turn = null;
  const T = R.T;
  const dice = [die(m)];
  if (t.dice === 2) dice.push(die(m));
  const from = r.pos;
  const path = [];
  const ev = [];
  let ms = T.show;
  const touched = new Set([k]);
  const push = (e) => { e.at = path.length; e.s = {}; ev.push(e); ms += MAP.evMs(e); return e; };
  const stamp = (e, list) => { list.forEach((x) => { e.s[x.k] = snap(x); }); };
  // walk n spaces; Salida and the star happen while passing
  const walk = (n) => {
    for (let i = 0; i < n; i++) {
      r.pos = (r.pos + 1) % N;
      r.steps++;
      path.push(r.pos);
      ms += T.step;
      if (r.pos === 0) {
        r.laps++;
        const g = gain(m, b, r, R.PASS);
        stamp(push({ type: 'pass', coins: g.coins, lucky: g.lucky }), [r]);
      }
      if (r.pos === b.star) {
        if (r.coins >= R.STAR_PRICE) {
          r.coins -= R.STAR_PRICE;
          r.stars++;
          r.bought++;
          const at = b.star;
          const to = moveStar(m, b);
          stamp(push({ type: 'star', from: at, to }), [r]);
        } else stamp(push({ type: 'nostar', need: R.STAR_PRICE - r.coins }), [r]);
      }
    }
  };
  walk(dice.reduce((a, d) => a + d, 0));
  // landing (a star bought on the last step was the landing; «te faltan N» on it still gives its space)
  const land = (depth) => {
    const last = ev[ev.length - 1];
    if (last && last.at === path.length && last.type === 'star') return;
    const sp = MAP.SPACES[r.pos];
    if (sp.t === 'blue') { const g = gain(m, b, r, R.BLUE); stamp(push({ type: 'blue', coins: g.coins, lucky: g.lucky }), [r]); return; }
    if (sp.t === 'red') { const n = lose(m, r, R.RED); stamp(push({ type: 'red', coins: -n }), [r]); return; }
    if (sp.t === 'start') return;      // its +coins already came with the step onto it
    if (sp.t === 'land') {
      const lm = MAP.LANDMARKS[sp.lm];
      const own = b.owners[sp.lm];
      if (!own) {
        if (r.coins >= lm.price) {
          r.coins -= lm.price;
          b.owners[sp.lm] = { k, lvl: 1 };
          stamp(push({ type: 'buy', lm: sp.lm, price: lm.price, own: { k, lvl: 1 } }), [r]);
        } else stamp(push({ type: 'broke', lm: sp.lm, need: lm.price - r.coins }), [r]);
        return;
      }
      if (own.k === k) {
        const max = own.lvl >= R.LEVEL_MAX;
        if (!max) own.lvl++;
        stamp(push({ type: 'level', lm: sp.lm, lvl: own.lvl, max, own: { k, lvl: own.lvl } }), [r]);
        return;
      }
      const o = kid(m, own.k);
      const n = Math.min(r.coins, lm.toll * own.lvl * (m.frenzy ? 2 : 1));
      r.coins -= n;
      r.paid += n;
      if (o) { o.coins += n; o.tolls += n; touched.add(o.k); }
      stamp(push({ type: 'toll', lm: sp.lm, to: own.k, coins: n, lvl: own.lvl }), o ? [r, o] : [r]);
      return;
    }
    if (sp.t === 'lucky') {
      const rivals = seatsOf(m, b).filter((x) => x.k !== k);
      const out = depth > 0 ? 'chest' : pickLucky(m, rivals.length > 0);
      if (out === 'chest' || out === 'gold') {
        const g = gain(m, b, r, out === 'gold' ? R.CHEST_GOLD : R.CHEST);
        stamp(push({ type: 'lucky', out, coins: g.coins, lucky: g.lucky }), [r]);
        return;
      }
      if (out === 'swap') {
        const o = rivals[Math.floor(m.rng() * rivals.length)];
        const mine = r.pos;
        r.pos = o.pos;
        o.pos = mine;
        touched.add(o.k);
        stamp(push({ type: 'lucky', out, with: o.k, from: mine, to: r.pos }), [r, o]);
        return;
      }
      if (out === 'duel') {
        const o = rivals[Math.floor(m.rng() * rivals.length)];
        const a = die(m), d = die(m);
        let n = 0;
        if (a > d) { n = Math.min(o.coins, R.DUEL * (m.frenzy ? 2 : 1)); o.coins -= n; r.coins += n; r.duels++; }
        else if (d > a) { n = -Math.min(r.coins, R.DUEL * (m.frenzy ? 2 : 1)); r.coins += n; o.coins -= n; o.duels++; }
        touched.add(o.k);
        stamp(push({ type: 'lucky', out, with: o.k, a, b: d, coins: n }), [r, o]);
        return;
      }
      // «¡Avanza 3!»: three more spaces (Salida / the star while passing), then that space's moment
      stamp(push({ type: 'lucky', out: 'ahead', n: R.AHEAD }), [r]);
      walk(R.AHEAD);
      land(depth + 1);
      return;
    }
    if (sp.t === 'storm') {
      const lost = {};
      seatsOf(m, b).forEach((x) => { lost[x.k] = lose(m, x, R.STORM); touched.add(x.k); });
      const at = b.star;
      const to = moveStar(m, b);
      stamp(push({ type: 'storm', lost, from: at, to }), seatsOf(m, b));
    }
  };
  land(0);
  ms += T.end;
  r.nextQAt = now + ms;
  b.seq++;                             // screens apply a board's numbers in this order (an older move never overwrites a newer one)
  const seats = seatsOf(m, b).filter((x) => touched.has(x.k)).map((x) => ({ k: x.k, pos: x.pos, coins: x.coins, stars: x.stars }));
  const script = { tid: t.tid, k, b: b.id, seq: b.seq, dice, from, path, ev, ms, auto: !!auto, pos: r.pos, coins: r.coins, stars: r.stars, star: b.star, seats };
  r.last = script;
  return { script, move: script };
}

// ---------- the room clock ----------
// Every tick while playing: the frenzy, each board's lead (hysteresis + alarm gap). Returns { frenzy, leads: [{ b, k, first }] }.
function rank(seats) {
  return seats.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins || a.k - b.k);
}
function tick(m, now) {
  const ev = { frenzy: false, leads: [] };
  if (m.paused || m.phase !== 'play') return ev;
  if (!m.frenzy && now >= m.frenzyAt) { m.frenzy = true; ev.frenzy = true; }
  m.boards.forEach((b) => {
    const seats = seatsOf(m, b);
    if (seats.length < 2) return;
    const top = rank(seats)[0];
    const cur = b.lead != null ? kid(m, b.lead) : null;
    if (!cur || b.seats.indexOf(cur.k) < 0) {
      // the first leader: clearly ahead of everybody else
      const second = rank(seats)[1];
      if (top.stars > second.stars || top.coins - second.coins >= R.LEAD_COINS) b.lead = top.k;
    } else if (top.k !== cur.k && (top.stars > cur.stars || (top.stars === cur.stars && top.coins - cur.coins >= R.LEAD_COINS))) {
      b.lead = top.k;
    }
    if (b.lead != null && b.lead !== b.announced && now - b.lastAlarm >= R.LEAD_GAP_MS) {
      ev.leads.push({ b: b.id, k: b.lead, first: b.announced == null });
      b.announced = b.lead;
      b.lastAlarm = now;
    }
  });
  return ev;
}
// a board as the screens draw it
function boardView(m, b, online) {
  return {
    id: b.id, star: b.star, lead: b.lead, seq: b.seq,
    owners: Object.fromEntries(Object.entries(b.owners).map(([lm, o]) => [lm, { k: o.k, lvl: o.lvl }])),
    seats: seatsOf(m, b).map((r) => ({ k: r.k, name: r.name, skin: r.skin, c: r.c, pos: r.pos, coins: r.coins, stars: r.stars, on: online ? !!online(r.k) : true })),
  };
}

// ---------- the end ----------
// Three Mario Party bonus stars per board (they count: the winner can change). Ties share; nobody eligible → skipped.
const BONUS = [
  { id: 'sabia', name: 'Estrella Sabia', what: 'más respuestas correctas', val: (r) => r.right, ok: (r) => r.right >= 1 },
  { id: 'magnate', name: 'Estrella Magnate', what: 'más monumentos', val: (r) => r.lands, ok: (r) => r.lands >= 1 },
  { id: 'racha', name: 'Estrella de Racha', what: 'la racha más larga', val: (r) => r.best, ok: (r) => r.best >= 3 },
];
function bonusFor(rows) {
  const out = [];
  BONUS.forEach((s) => {
    const ok = rows.filter(s.ok);
    if (!ok.length) return;
    const top = Math.max(...ok.map(s.val));
    out.push({ id: s.id, name: s.name, what: s.what, value: top, winners: ok.filter((r) => s.val(r) === top).map((r) => r.k) });
  });
  return out;
}
const order = (a, b) => b.total - a.total || b.coins - a.coins || b.right - a.right || a.k - b.k;
const tie = (a, b) => a.total === b.total && a.coins === b.coins && a.right === b.right;
function finish(m) {
  const rows = [];
  const boards = m.boards.map((b) => {
    const seats = seatsOf(m, b);
    const list = seats.map((r) => ({
      k: r.k, name: r.name, skin: r.skin, b: b.id, c: r.c, stars: r.stars, coins: r.coins, right: r.right, answered: r.answered,
      best: r.best, lands: Object.values(b.owners).filter((o) => o.k === r.k).length, tolls: r.tolls, steps: r.steps,
      bought: r.bought, laps: r.laps, bonus: [], total: r.stars, fast: r.fast,
    }));
    const bonus = bonusFor(list);
    bonus.forEach((s) => s.winners.forEach((k) => { const x = list.find((y) => y.k === k); x.bonus.push(s.id); x.total++; }));
    const sorted = list.slice().sort(order);
    sorted.forEach((x, i) => { x.rank = i > 0 && tie(sorted[i - 1], x) ? sorted[i - 1].rank : i + 1; x.of = sorted.length; });
    rows.push(...sorted);
    return {
      id: b.id, star: b.star, owners: boardView(m, b).owners, bonus, rows: sorted,
      winners: sorted.filter((x) => x.rank === 1 && (x.total > 0 || x.coins > 0)).map((x) => x.k),
    };
  });
  const podium = rows.slice().sort(order);
  podium.forEach((x, i) => { x.classRank = i > 0 && tie(podium[i - 1], x) ? podium[i - 1].classRank : i + 1; });
  return { boards, rows, podium: podium.filter((x) => x.classRank <= 3 && (x.total > 0 || x.coins > 0)).slice(0, 5) };
}

module.exports = {
  R, MAP, N, BONUS, clampDuration, frenzyMs, value, newGame, newRecord, addBoard, deal, seatLate, inGame, kid, boardOf, seatsOf,
  startPlay, addTime, shiftTimes, final, answer, rollAt, roll, luckOf, gain, moveStar, tick, rank, boardView, bonusFor, finish,
};
