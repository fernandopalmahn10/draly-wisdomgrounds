// Mochi Mash v2 (gameType 'mochi-mash') — the rules, no sockets (server.js «MOCHI MASH» block glues them to the room).
// «La Terraza del Mochi»: two teams (Fuego = 'red', Mar = 'gold') each feed their own Dragoncito on a terrace on Dubai
// Creek. A right answer opens a short MASH window on the kid's phone; the phone sends a COUNT of taps every 250 ms and
// the server credits at most R.RATE taps per second of the window (+ a small burst). The team total is weighted by team
// size (a smaller team is not punished), the trailing team gets more golden mochis (capped at the gap), the last 30 s
// count double, four Dubai landmarks on a height ruler go to the first team that grows that tall, and the end is a
// Mario Party ceremony with bonus stars (finish / stars).
// Spec: docs/specs/mochi-mash-v2.md. Player fields carry an `mm` prefix; the game object is `m` (server: g.mm).
'use strict';
const Party = require('./party');   // clockShift: the teacher's «−30 s»

const R = {
  INTRO_MS: 2800,            // «¡Toca rápido!» → «¿Listos?» → «¡YA!» after the 3.5 s run-in countdown
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  LEAD_MS: 900,              // «¡Correcto!» on the phone before the mash zone opens
  MASH_MS: 5000,             // the mash window
  STREAK_AT: 3,              // a streak of 3+ right answers…
  STREAK_MS: 1000,           // …adds a second to the window
  RATE: 12,                  // credited taps per second of window (the fastest kids tap 8-10; an auto-clicker gets 12)
  BURST: 6,                  // head-room on top of RATE × elapsed (network jitter)
  MAX_BATCH: 12,             // one batch (250 ms) claims at most this many taps
  GRACE_MS: 600,             // the last batch may arrive this late after the window closed
  NEXT_MS: 300,              // after the grace: the next question
  WRONG_MS: 2200,            // a wrong answer / time up shows the right answer this long, then the next question
  GOLD_CHANCE: 0.25,         // a window holds one golden mochi…
  GOLD_CHANCE_BEHIND: 0.6,   // …more often for the trailing team (the comeback rule)
  GOLD_MIN: 5, GOLD_MAX: 18, // which tap of the window turns gold
  GOLD_VALUE: 5,             // a golden mochi counts 5 (its extra 4 is capped at the gap while the team trails)
  FRENZY_MS: 30000,          // the last 30 s: every mochi counts ×2
  FRENZY_MAX_FRAC: 1 / 3,    // (a very short game: the last third)
  LEAD_MIN: 4, LEAD_FRAC: 0.03, LEAD_GAP_MS: 7000,   // a lead counts at ≥ 4 mochis and ≥ 3 % of the total; alarms ≥ 7 s apart
  BEHIND_MIN: 10, BEHIND_FRAC: 0.15,                 // trailing (for golden mochis): ≥ 10 and ≥ 15 % of the leader
  PER_KID_S: 2.8,            // expected mochis per kid per second of play (calibrates the landmarks and the growth; bots + a
                             // real tap rate: ~35 taps per window, a window every ~11 s at 80 % right)
  LANDMARKS: [
    { id: 'museum', name: 'Museo del Futuro', at: 0.12 },
    { id: 'frame', name: 'Marco de Dubái', at: 0.32 },
    { id: 'arab', name: 'Burj Al Arab', at: 0.58 },
    { id: 'burj', name: 'Burj Khalifa', at: 0.88 },
  ],
  LANDMARK_BONUS: 0.04,      // × the expected team total
  RESCALE_MS: 20000,         // late joiners in the intro or the first 20 s of play grow the race (rescale)
  FAST_MIN_MS: 400,          // the fastest-answer star ignores times under this (no human reads and taps that fast)
  DURATIONS: [120, 180, 240],
  DURATION: 180,
};
const TEAMS = ['red', 'gold'];
const other = (t) => (t === 'red' ? 'gold' : 'red');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

// ---------- teams ----------
// connected kids per team (the room's players: { pid: { team, disconnected } })
function teamSizes(players) {
  const n = { red: 0, gold: 0 };
  Object.values(players || {}).forEach((p) => { if (p && !p.disconnected && n[p.team] != null) n[p.team]++; });
  return n;
}
// A late joiner goes to the team with fewer connected kids; equal → the team that is behind (then Fuego).
function pickTeam(players, m) {
  const n = teamSizes(players);
  if (n.red !== n.gold) return n.red < n.gold ? 'red' : 'gold';
  if (m && m.totals && m.totals.red !== m.totals.gold) return m.totals.red < m.totals.gold ? 'red' : 'gold';
  return 'red';
}
// Each credited mochi counts ×(average team size ÷ this team's size) in the team total.
function weights(sizes) {
  const r = Math.max(1, sizes.red || 0), g = Math.max(1, sizes.gold || 0);
  const avg = (r + g) / 2;
  return { red: avg / r, gold: avg / g };
}
const expected = (durationS, avgSize) => Math.max(20, Math.round(R.PER_KID_S * Math.max(10, durationS) * Math.max(1, avgSize)));
const frenzyMs = (durationS) => Math.round(Math.min(R.FRENZY_MS, Math.max(10, durationS) * 1000 * R.FRENZY_MAX_FRAC));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 30, 600);

// ---------- the game ----------
function newGame(seed, durationS, now, sizes) {
  const duration = clampDuration(durationS);
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  const E = expected(duration, avg);
  return {
    id: seed, seed, rng: mulberry32(seed), duration,
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    playAt: 0, endsAt: 0, frenzyAt: 0, frenzy: false, endedAt: 0,
    paused: false, pausedAt: 0,
    totals: { red: 0, gold: 0 }, raw: { red: 0, gold: 0 }, w: weights(sizes || {}),
    E, landmarks: R.LANDMARKS.map((l) => ({ id: l.id, name: l.name, at: Math.max(4, Math.round(E * l.at)), bonus: Math.max(2, Math.round(E * R.LANDMARK_BONUS)), team: null })),
    lead: null, announced: null, lastAlarm: -1e12, behind: null,
    nextMid: 1, dirty: true, fx: {},
  };
}
// Kids who arrive in the intro or the first RESCALE_MS of play make the race longer: the expected total grows and the
// landmarks nobody has won yet move up with it (never down: a kid leaving doesn't hand out a landmark).
function rescale(m, sizes, now) {
  if (!(m.phase === 'intro' || (m.phase === 'play' && now - m.playAt < R.RESCALE_MS))) return false;
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  const E = expected(m.duration, avg);
  if (E <= m.E) return false;
  m.E = E;
  m.landmarks.forEach((l) => {
    if (l.team) return;
    const d = R.LANDMARKS.find((x) => x.id === l.id);
    l.at = Math.max(4, Math.round(E * d.at));
    l.bonus = Math.max(2, Math.round(E * R.LANDMARK_BONUS));
  });
  return true;
}
const inGame = (m, p) => !!(m && p && p.mmGame === m.id);
function resetKid(p, m) {
  p.mmGame = m.id;
  p.mmMochis = 0; p.mmRight = 0; p.mmWrong = 0; p.mmAnswered = 0; p.mmStreak = 0; p.mmBest = 0;
  p.mmFast = null; p.mmBehind = 0; p.mmGold = 0; p.mmMash = null; p.mmNextQAt = 0;
}
function join(m, p) { if (!inGame(m, p)) resetKid(p, m); }
// The intro is over: play for `duration` seconds from now.
function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.playAt = now;
  m.endsAt = now + m.duration * 1000;
  m.frenzyAt = m.endsAt - frenzyMs(m.duration);
  m.phaseUntil = m.endsAt;
}
// The teacher's «+30 s»: the end moves; the frenzy keeps its start when it is already on (more double-mochi time).
// «−30 s» (ms < 0, his ask 2026-10-20): `now` = this game's clock (its pause moment while paused); the cut stops 10 s
// before the end (Party.clockShift) and leaves the round's length alone, and an end inside the last 30 s starts the
// frenzy on the next tick, as if the clock got there. Returns the change that applied (ms), false when nothing changed.
function addTime(m, ms, now) {
  if (m.phase !== 'play') return false;
  ms = Party.clockShift(m.endsAt, ms, now == null ? Date.now() : now);
  if (!ms) return false;
  m.endsAt += ms;
  m.phaseUntil = m.endsAt;
  if (!m.frenzy) m.frenzyAt = m.endsAt - frenzyMs(m.duration);
  if (ms > 0) m.duration += ms / 1000;
  return ms;
}

// ---------- answers and the mash window ----------
// A kid answered. ms = time since the question reached the server. Right → a mash window opens LEAD_MS from now.
function answer(m, p, correct, ms, now) {
  if (!inGame(m, p)) join(m, p);
  p.mmAnswered++;
  if (!correct) {
    p.mmWrong++;
    p.mmStreak = 0;
    return { right: false, streak: 0, wait: R.WRONG_MS };
  }
  p.mmRight++;
  p.mmStreak++;
  p.mmBest = Math.max(p.mmBest, p.mmStreak);
  // «Respuesta más rápida» only counts human times (nobody reads and taps in under FAST_MIN_MS: that is a glitch)
  if (Number.isFinite(ms) && ms >= R.FAST_MIN_MS) p.mmFast = p.mmFast == null ? ms : Math.min(p.mmFast, ms);
  return { right: true, streak: p.mmStreak, mash: openMash(m, p, now) };
}
function openMash(m, p, now) {
  const bonus = p.mmStreak >= R.STREAK_AT;
  const ms = R.MASH_MS + (bonus ? R.STREAK_MS : 0);
  const chance = m.behind === p.team ? R.GOLD_CHANCE_BEHIND : R.GOLD_CHANCE;
  const gold = m.rng() < chance ? R.GOLD_MIN + Math.floor(m.rng() * (R.GOLD_MAX - R.GOLD_MIN + 1)) : 0;
  const start = now + R.LEAD_MS;
  p.mmMash = { mid: m.nextMid++, start, until: start + ms, taps: 0, mochis: 0, gold, goldHit: false, closed: false };
  return { mid: p.mmMash.mid, lead: R.LEAD_MS, ms, gold, frenzy: m.frenzy, streakBonus: bonus, behind: m.behind === p.team };
}
// A batch of n taps from a phone. Returns what was credited.
function taps(m, p, mid, n, now) {
  const x = p.mmMash;
  const none = { credited: 0, mochis: 0, gold: false };
  if (!x || x.closed || x.mid !== mid || m.paused || (m.phase !== 'play' && m.phase !== 'final')) return none;
  const cut = m.phase === 'final' ? Math.min(x.until, m.endedAt) : x.until;
  if (now > cut + R.GRACE_MS) return none;
  n = Math.floor(Number(n));
  if (!(n > 0)) return none;
  n = Math.min(n, R.MAX_BATCH);
  const elapsed = clamp(Math.min(now, cut) - x.start, 0, cut - x.start);
  const allowed = Math.floor((R.RATE * elapsed) / 1000) + R.BURST;
  const credit = Math.max(0, Math.min(n, allowed - x.taps));
  if (!credit) return none;
  const before = x.taps;
  x.taps += credit;
  const mult = m.frenzy ? 2 : 1;
  let value = credit * mult;
  let gold = false;
  if (x.gold && !x.goldHit && before < x.gold && x.taps >= x.gold) {
    x.goldHit = true;
    gold = true;
    let extra = (R.GOLD_VALUE - 1) * mult;
    // the comeback cap: while a team trails, its golden extra can close the gap, never jump it
    const t = p.team, o = other(t);
    if (m.totals[t] < m.totals[o]) {
      const gap = m.totals[o] - m.totals[t] - value * (m.w[t] || 1);
      extra = Math.max(0, Math.min(extra, Math.floor(Math.max(0, gap) / (m.w[t] || 1))));
    }
    value += extra;
    p.mmGold++;
  }
  credit_(m, p, value);
  x.mochis += value;
  m.fx[p.mmId] = m.fx[p.mmId] || [0, 0];
  m.fx[p.mmId][0] += value;
  if (gold) m.fx[p.mmId][1] = 1;
  return { credited: credit, mochis: value, gold };
}
function credit_(m, p, value) {
  const t = p.team;
  if (m.totals[t] == null) return;
  if (m.totals[t] < m.totals[other(t)]) p.mmBehind += value;     // fed while the team was behind (Gran remontada)
  p.mmMochis += value;
  m.raw[t] += value;
  m.totals[t] += value * (m.w[t] || 1);
  m.dirty = true;
}
// The window is over (or the game ends, or the kid reloads): the summary for the phone.
function closeMash(m, p, now) {
  const x = p.mmMash;
  if (!x || x.closed) return null;
  x.closed = true;
  p.mmMash = null;
  p.mmNextQAt = now + R.NEXT_MS;
  return { mid: x.mid, taps: x.taps, mochis: x.mochis, gold: x.goldHit, total: p.mmMochis };
}
// the moment the server closes this window (the last batch may still arrive in the grace)
const closeAt = (x) => x.until + R.GRACE_MS;

// ---------- the room clock ----------
// Every tick (server: 250 ms) while playing: the lead (with hysteresis + alarm gap), the landmark race, the trailing
// team, the frenzy. Returns the moments to announce: { lead, landmarks: [...], frenzy }.
function tick(m, now) {
  const ev = { lead: null, landmarks: [], frenzy: false };
  if (m.paused || m.phase !== 'play') return ev;
  const T = m.totals;
  // the landmark race: the first team whose total reaches a landmark's height wins it (once)
  m.landmarks.forEach((l) => {
    if (l.team) return;
    const reach = TEAMS.filter((t) => T[t] >= l.at);
    if (!reach.length) return;
    const t = reach.length === 1 ? reach[0] : (T.red === T.gold ? (m.rng() < 0.5 ? 'red' : 'gold') : (T.red > T.gold ? 'red' : 'gold'));
    l.team = t;
    l.atMs = now;
    T[t] += l.bonus;
    m.dirty = true;
    ev.landmarks.push({ id: l.id, name: l.name, team: t, bonus: l.bonus });
  });
  // the leader (hysteresis: a lead counts only past LEAD_MIN and LEAD_FRAC of the total)
  const d = T.red - T.gold;
  const need = Math.max(R.LEAD_MIN, (T.red + T.gold) * R.LEAD_FRAC);
  if (Math.abs(d) >= need) m.lead = d > 0 ? 'red' : 'gold';
  if (m.lead && m.lead !== m.announced && now - m.lastAlarm >= R.LEAD_GAP_MS) {
    ev.lead = { team: m.lead, first: m.announced == null };
    m.announced = m.lead;
    m.lastAlarm = now;
  }
  // the comeback rule: who trails by enough to get more golden mochis
  const hi = Math.max(T.red, T.gold), lo = Math.min(T.red, T.gold);
  m.behind = hi - lo >= Math.max(R.BEHIND_MIN, hi * R.BEHIND_FRAC) ? (T.red < T.gold ? 'red' : 'gold') : null;
  if (!m.frenzy && now >= m.frenzyAt) { m.frenzy = true; ev.frenzy = true; }
  return ev;
}
const display = (m) => ({ r: Math.round(m.totals.red), g: Math.round(m.totals.gold) });
// the teacher paused for `ms`: every pending moment moves by that much (open windows are moved by the server per kid)
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.lastAlarm += ms;
}
function shiftMash(p, ms) {
  if (p.mmMash) { p.mmMash.start += ms; p.mmMash.until += ms; }
  if (p.mmNextQAt) p.mmNextQAt += ms;
}
// «¡FINAL!»: no new windows; taps already in flight (≤ GRACE) still count.
function final(m, now) {
  m.phase = 'final';
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  m.endedAt = now;
}

// ---------- the end ----------
const STARS = [
  { id: 'fed', name: 'Más mochis', unit: 'mochis', val: (r) => r.mochis, ok: (r) => r.mochis >= 1, best: 'max' },
  { id: 'fast', name: 'Respuesta más rápida', unit: 's', val: (r) => r.fast, ok: (r) => r.fast != null && r.right >= 1, best: 'min' },
  { id: 'streak', name: 'Racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 2, best: 'max' },
  { id: 'aim', name: 'Mejor puntería', unit: '%', val: (r) => (r.answered ? Math.round((100 * r.right) / r.answered) : 0), ok: (r) => r.answered >= 3 && r.right >= 1, best: 'max' },
  { id: 'comeback', name: 'Gran remontada', unit: 'mochis', val: (r) => r.behind, ok: (r) => r.behind >= 1, best: 'max' },
];
// Bonus stars: every kid at the top value of a category shares its star; a category nobody qualifies for is skipped.
function stars(rows) {
  const out = [];
  STARS.forEach((s) => {
    const ok = rows.filter(s.ok);
    if (!ok.length) return;
    const vals = ok.map(s.val);
    const top = s.best === 'min' ? Math.min(...vals) : Math.max(...vals);
    const winners = ok.filter((r) => s.val(r) === top).map((r) => r.k);
    out.push({ id: s.id, name: s.name, unit: s.unit, value: s.id === 'fast' ? Math.round(top / 100) / 10 : top, winners });
  });
  return out;
}
// rows: [{ k, name, skin, team, …stats }] of every kid who played this game
function finish(m, rows) {
  const d = display(m);
  const winner = d.r > d.g ? 'red' : d.g > d.r ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.mochis - a.mochis || b.right - a.right || a.k - b.k);
  sorted.forEach((r, i) => { r.rank = i > 0 && sorted[i - 1].mochis === r.mochis ? sorted[i - 1].rank : i + 1; });
  const raw = { red: 0, gold: 0 };
  rows.forEach((r) => { if (raw[r.team] != null) raw[r.team] += r.mochis; });
  const mvp = {};
  TEAMS.forEach((t) => { const top = sorted.find((r) => r.team === t && r.mochis > 0); mvp[t] = top ? top.k : null; });
  const st = stars(rows);
  rows.forEach((r) => {
    r.share = raw[r.team] ? Math.round((100 * r.mochis) / raw[r.team]) : 0;
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return {
    totals: d, winner, raw, mvp, stars: st, rows: sorted,
    landmarks: m.landmarks.map((l) => ({ id: l.id, name: l.name, team: l.team })),
  };
}

module.exports = {
  R, TEAMS, other, mulberry32, teamSizes, pickTeam, weights, expected, frenzyMs, clampDuration,
  newGame, rescale, inGame, resetKid, join, startPlay, addTime, answer, openMash, taps, closeMash, closeAt,
  tick, display, shiftTimes, shiftMash, final, stars, finish, STARS,
};
