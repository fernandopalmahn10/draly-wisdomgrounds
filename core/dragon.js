// Vuelo del Dragón v2 (gameType 'dragon-eye') — the rules, no sockets (server.js «VUELO DEL DRAGÓN v2» block glues them
// to the room). «La Carrera del Cielo de Dubái»: a Mario Party sky race. The class flies in RACES OF 4 (3 when it doesn't
// divide, one race up to 5: the deal of core/halcon.js), every kid on their own dragoncito, every race over the same
// Dubai course at once. A right answer opens a short FLIGHT window: the phone sends a COUNT of wing beats every 250 ms
// (a swipe up or a tap each) and the server credits at most R.RATE beats per second of the window (+ a small burst),
// R.BEAT_M metres each. A golden ring sometimes waits at one beat of a flight (+metres). Every 40 s every race sprints
// for Dralingo's star at the next landmark: for 12 s whoever of the race flies the most metres wins it (+R.STAR_M; the
// sprint starts everybody at 0). The last dragon of a race, far behind, gets a tailwind; its extra (and a ring's) never
// takes it past the leader by luck alone (capped at the gap). The last 30 s every metre counts ×2. The end gives three
// Mario Party bonus stars per race (each +R.BONUS_M: they can change who wins), then each race's winner and the class
// podium. ONE score: metres flown. Spec: docs/specs/dragon-v2.md. Every kid's numbers live in m.kids[k] (k = the
// server's stable id), so a kid who left still counts at the end.
'use strict';

const COURSE = require('../public/js/dragon-course');
const Halcon = require('./halcon');      // races of 4: boardSizes, splitBoards, mulberry32

const R = {
  INTRO_MS: 2800,            // «¡Responde y aletea!» → «¿Listos?» → «¡YA!» after the 3.5 s run-in countdown
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  DURATIONS: [180, 240, 300],
  DURATION: 240,
  Q_MS: 20000,               // the phone's clock for a question
  Q_GRACE_MS: 3000,          // …the server calls «time up» this much later (a frozen tab can't hold a kid)
  FAST_MS: 600,              // an answer reaching the server sooner than this after its question was sent = too fast = wrong
  WRONG_MS: 2200,            // the «¡Casi!» wait
  WRONG2_MS: 3400,           // …after two wrong in a row («¡Respira!»)
  LEAD_MS: 800,              // «¡Correcto!» on the phone before the flight opens
  FLAP_MS: 4000,             // the flight window
  STREAK_AT: 3,              // a streak of 3+ right answers («¡Fuego azul!»)…
  STREAK_MS: 1000,           // …adds a second to the flight
  FIRE1: 1.5,                // …and every beat counts ×1.5 («¡Fuego azul!»)
  FIRE2_AT: 6, FIRE2: 2,     // a streak of 6+: ×2 («¡Fuego azul ×2!»): thinking pays more than guessing
  RATE: 5,                   // credited wing beats per second of flight (a swipe takes ~200 ms: the cap a swiper can reach)
  BURST: 3,                  // head-room on top of RATE × elapsed (network jitter)
  MAX_BATCH: 8,              // one batch (250 ms) claims at most this many beats
  GRACE_MS: 900,             // the last batch may arrive this late after the flight closed (school Wi-Fi round trips)
  NEXT_MS: 300,              // after the grace: the next question
  BEAT_M: 6,                 // metres per wing beat
  RING_CHANCE: 0.3,          // a flight holds one golden ring…
  RING_CHANCE_LAST: 0.65,    // …more often for the last dragon of its race (the comeback rule)
  RING_MIN: 4, RING_MAX: 13, // which beat of the flight reaches the ring
  RING_M: 30,                // the ring's metres (capped at the gap while behind the leader)
  FRENZY_MS: 30000,          // the last 30 s: every metre counts ×2
  FRENZY_MAX_FRAC: 1 / 3,    // (a very short game: the last third)
  LEAD_M: 20,                // a new leader needs this many metres more than the old one
  LEAD_GAP_MS: 6000,         // lead alarms of one race at least this far apart
  BEHIND_M: 60,              // the last dragon of a race, ≥ this behind its leader: tailwind
  TAIL: 0.5,                 // …every beat +50 %, the extra capped at the gap
  SPRINT_FIRST_MS: 20000,    // the first star sprint this far into the round…
  SPRINT_EVERY_MS: 40000,    // …then one every 40 s (start to start)
  SPRINT_MS: 12000,          // a sprint lasts 12 s
  SPRINT_TAIL_MS: 4000,      // a sprint starts only if it ends this long before the round does
  STAR_M: 150,               // the sprint's star: +150 m (a dash ahead)
  BONUS_M: 200,              // each bonus star at the end: +200 m (in a class of thinkers ~1 race in 12 changes winner)
  FAST_MIN_MS: 600,          // (the too-fast line again: no human reads and taps faster)
  BOARD_MAX: 5,              // a race holds at most 5 (late joiners)
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 30, 600);
const frenzyMs = (durationS) => Math.round(Math.min(R.FRENZY_MS, Math.max(10, durationS) * 1000 * R.FRENZY_MAX_FRAC));
const round1 = (x) => Math.round(x * 10) / 10;

// ---------- the game ----------
function newGame(seed, durationS, now) {
  const duration = clampDuration(durationS);
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration,
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    playAt: 0, endsAt: 0, frenzyAt: 0, frenzy: false, endedAt: 0,
    paused: false, pausedAt: 0,
    races: [], nextRace: 1, kids: {}, nextMid: 1,
    sprint: null, sprintN: 0, nextSprintAt: 0,
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const raceOf = (m, id) => m.races.find((b) => b.id === id) || null;
const seatsOf = (m, b) => (b ? b.seats.map((k) => m.kids[k]).filter(Boolean) : []);
function newRecord(k, name, skin) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b: null, c: 0, m: 0, stars: 0, away: false,
    right: 0, wrong: 0, answered: 0, streak: 0, best: 0, fast: null, wrongRow: 0, tooFast: 0, timeUps: 0,
    beats: 0, flights: 0, rings: 0, tailM: 0, lastM: 0, sprints: 0,
    flap: null, nextQAt: 0,
  };
}
function addRace(m) {
  const b = { id: m.nextRace++, seats: [], lead: null, announced: null, lastAlarm: -1e12, seq: 0, dirty: true };
  m.races.push(b);
  return b;
}
function seatIn(m, b, r) {
  const used = new Set(seatsOf(m, b).map((x) => x.c));
  let c = 0;
  while (used.has(c)) c++;
  r.b = b.id;
  r.c = c;
  b.seats.push(r.k);
  b.dirty = true;
  return r;
}
// The start: every kid of the room gets a seat; races of 4 (3 when it doesn't divide; one race up to 5).
// entries: [[k, name, skin], …]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin]) => { byK[k] = m.kids[k] || newRecord(k, name, skin); });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addRace(m);
    ks.forEach((k) => { m.kids[k] = byK[k]; seatIn(m, b, byK[k]); });
  });
  return m.races;
}
// A late joiner flies in the smallest race that still has room (max 5), level with its last dragon (in the race, not
// two kilometres behind); every race full → a new race. A kid already seated keeps the seat and gets null.
function seatLate(m, k, name, skin) {
  if (m.kids[k] && m.kids[k].b != null) return null;
  const r = m.kids[k] || (m.kids[k] = newRecord(k, name, skin));
  const open = m.races.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addRace(m);
  const others = seatsOf(m, b);
  const flying = others.filter((x) => !x.away);
  const ref = flying.length ? flying : others;
  r.m = ref.length ? Math.min(...ref.map((x) => x.m)) : 0;   // (a kid who left at 0 m doesn't drag the newcomer back)
  seatIn(m, b, r);
  return b;
}
const inGame = (m, k) => !!(m && m.kids[k] && m.kids[k].b != null);
// a kid whose phone left (or came back): the comeback rules look at the dragons still flying
function setAway(m, k, away) {
  const r = kid(m, k);
  if (!r || r.away === !!away) return false;
  r.away = !!away;
  const b = raceOf(m, r.b);
  if (b) b.dirty = true;
  return true;
}

function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.playAt = now;
  m.endsAt = now + m.duration * 1000;
  m.frenzyAt = m.endsAt - frenzyMs(m.duration);
  m.phaseUntil = m.endsAt;
  m.nextSprintAt = now + R.SPRINT_FIRST_MS;
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
// the teacher paused for `ms`: every pending moment moves by that much (flights, waits, the sprint)
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  if (m.nextSprintAt) m.nextSprintAt += ms;
  if (m.sprint) { m.sprint.at += ms; m.sprint.until += ms; }
  m.races.forEach((b) => { b.lastAlarm += ms; });
  Object.values(m.kids).forEach((r) => {
    if (r.flap) { r.flap.start += ms; r.flap.until += ms; }
    if (r.nextQAt) r.nextQAt += ms;
  });
}
// «¡FINAL!»: no new questions or flights; beats already on their way (≤ GRACE) still count. An open sprint is decided
// now (returned, like tick's sprintEnd).
function final(m, now) {
  m.phase = 'final';
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  m.endedAt = now;
  return m.sprint ? endSprint(m, now) : null;
}

// ---------- the race's order ----------
// the dragons still flying (a kid who left stays in the race, greyed, but doesn't hold the comeback rules)
const present = (m, b) => seatsOf(m, b).filter((r) => !r.away);
function standing(m, r) {
  const b = raceOf(m, r.b);
  const ps = b ? present(m, b) : [];
  if (ps.length < 2 || r.away) return { last: false, gap: 0, top: r.m };
  const others = ps.filter((x) => x.k !== r.k);
  const top = Math.max(...others.map((x) => x.m));
  const low = Math.min(...others.map((x) => x.m));
  return { last: r.m <= low && r.m < top, gap: Math.max(0, top - r.m), top };
}
const tailOn = (m, r) => { const s = standing(m, r); return s.last && s.gap >= R.BEHIND_M; };

// ---------- answers and the flight ----------
// A kid answered (ms = since the question reached the server). Right → a flight opens LEAD_MS from now.
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
  if (Number.isFinite(ms) && ms >= R.FAST_MIN_MS) r.fast = r.fast == null ? ms : Math.min(r.fast, ms);
  r.nextQAt = 0;
  return { right: true, streak: r.streak, flight: openFlap(m, r, now) };
}
function openFlap(m, r, now) {
  const fire = r.streak >= R.STREAK_AT;
  const power = r.streak >= R.FIRE2_AT ? R.FIRE2 : fire ? R.FIRE1 : 1;
  const ms = R.FLAP_MS + (fire ? R.STREAK_MS : 0);
  const last = standing(m, r).last;
  const ring = m.rng() < (last ? R.RING_CHANCE_LAST : R.RING_CHANCE) ? R.RING_MIN + Math.floor(m.rng() * (R.RING_MAX - R.RING_MIN + 1)) : 0;
  const start = now + R.LEAD_MS;
  r.flap = { mid: m.nextMid++, start, until: start + ms, beats: 0, metres: 0, ring, ringHit: false, closed: false, fire, power };
  r.flights++;
  const b = raceOf(m, r.b);
  if (b) b.dirty = true;
  return { mid: r.flap.mid, lead: R.LEAD_MS, ms, ring, fire, power, frenzy: m.frenzy, tail: tailOn(m, r), beatM: R.BEAT_M, rate: R.RATE, burst: R.BURST };
}
// metres for the kid, the race's bookkeeping (who was last, the sprint)
function creditM(m, r, value) {
  if (!(value > 0)) return;
  if (standing(m, r).last) r.lastM += value;                    // flown while last of the race (Estrella Remontada)
  r.m += value;
  if (m.sprint && r.b != null) {
    const s = m.sprint.s;
    s[r.k] = (s[r.k] || 0) + value;
  }
  const b = raceOf(m, r.b);
  if (b) b.dirty = true;
}
// A batch of n wing beats from a phone. Returns what was credited.
function beats(m, k, mid, n, now) {
  const r = kid(m, k);
  const none = { credited: 0, metres: 0, ring: false };
  const x = r && r.flap;
  if (!x || x.closed || x.mid !== mid || (m.phase !== 'play' && m.phase !== 'final')) return none;
  let cut = m.phase === 'final' ? Math.min(x.until, m.endedAt) : x.until;
  // «Pausa»: the beats already on their way (≤ GRACE) still count, up to the moment of the pause
  if (m.paused) { if (now > m.pausedAt + R.GRACE_MS) return none; cut = Math.min(cut, m.pausedAt); }
  if (cut <= x.start) return none;                              // a flight that would open after «¡FINAL!» / the pause
  if (now < x.start || now > cut + R.GRACE_MS) return none;   // (the phone opens its flight after the server's start)
  n = Math.floor(Number(n));
  if (!(n > 0)) return none;
  n = Math.min(n, R.MAX_BATCH);
  const elapsed = clamp(Math.min(now, cut) - x.start, 0, cut - x.start);
  const allowed = Math.floor((R.RATE * elapsed) / 1000) + R.BURST;
  const credit = Math.max(0, Math.min(n, allowed - x.beats));
  if (!credit) return none;
  const mult = m.frenzy ? 2 : 1;
  let metres = 0, ring = false;
  for (let i = 0; i < credit; i++) {
    x.beats++;
    r.beats++;
    let v = R.BEAT_M * mult * x.power;
    const st = standing(m, r);
    // the tailwind: the last dragon, far behind, +50 % a beat, never past the leader by the extra alone
    if (st.last && st.gap >= R.BEHIND_M) {
      const extra = Math.max(0, Math.min(v * R.TAIL, st.gap - v));
      if (extra > 0) { v += extra; r.tailM += extra; }
    }
    if (x.ring && !x.ringHit && x.beats >= x.ring) {
      x.ringHit = true;
      ring = true;
      r.rings++;
      let rv = R.RING_M * mult;
      const st2 = standing(m, r);
      // behind the leader: the ring can close the gap, never jump it
      if (st2.gap > 0) rv = Math.max(0, Math.min(rv, st2.gap - v));
      v += rv;
    }
    v = round1(v);
    creditM(m, r, v);
    x.metres = round1(x.metres + v);
    metres = round1(metres + v);
  }
  return { credited: credit, metres, ring };
}
// The flight is over (or the game ends, or the kid reloads): the summary for the phone.
function closeFlap(m, k, now) {
  const r = kid(m, k);
  const x = r && r.flap;
  if (!x || x.closed) return null;
  x.closed = true;
  r.flap = null;
  r.nextQAt = now + R.NEXT_MS;
  const b = raceOf(m, r.b);
  if (b) b.dirty = true;
  return { mid: x.mid, beats: x.beats, metres: x.metres, ring: x.ringHit, m: Math.round(r.m) };
}
// the moment the server closes this flight (the last batch may still arrive in the grace)
const closeAt = (x) => x.until + R.GRACE_MS;

// ---------- the star sprints ----------
function startSprint(m, now) {
  const n = ++m.sprintN;
  m.sprint = { n, lm: COURSE.sprintLm(n), at: now, until: now + R.SPRINT_MS, s: {} };
  m.nextSprintAt = now + R.SPRINT_EVERY_MS;
  m.races.forEach((b) => { b.dirty = true; });
  return { n, lm: m.sprint.lm, ms: R.SPRINT_MS };
}
// Who of each race flew the most metres in the sprint: the star (+STAR_M each, ties share; nobody flew: no star).
function endSprint(m, now) {
  const sp = m.sprint;
  if (!sp) return null;
  m.sprint = null;
  const races = m.races.map((b) => {
    const seats = seatsOf(m, b);
    const s = {};
    seats.forEach((r) => { s[r.k] = Math.round(sp.s[r.k] || 0); });
    const top = Math.max(0, ...seats.map((r) => sp.s[r.k] || 0));
    const w = top > 0 ? seats.filter((r) => (sp.s[r.k] || 0) === top).map((r) => r.k) : [];
    w.forEach((k) => {
      const r = m.kids[k];
      r.stars++;
      r.sprints++;
      r.m += R.STAR_M;                 // the star's dash (not a flown metre: no sprint, no Remontada)
    });
    b.dirty = true;
    return { b: b.id, w, s, m: Object.fromEntries(w.map((k) => [k, Math.round(m.kids[k].m)])) };
  });
  return { n: sp.n, lm: sp.lm, star: R.STAR_M, races, at: now };
}

// ---------- the room clock ----------
// Every tick while playing: the frenzy, the sprints, each race's lead (hysteresis + alarm gap).
// Returns { frenzy, sprintGo, sprintEnd, leads: [{ b, k, first }] }.
function rank(seats) {
  return seats.slice().sort((a, b) => b.m - a.m || b.stars - a.stars || a.k - b.k);
}
function tick(m, now) {
  const ev = { frenzy: false, sprintGo: null, sprintEnd: null, leads: [] };
  if (m.paused || m.phase !== 'play') return ev;
  if (!m.frenzy && now >= m.frenzyAt) { m.frenzy = true; ev.frenzy = true; }
  if (m.sprint && now >= m.sprint.until) ev.sprintEnd = endSprint(m, now);
  if (!m.sprint && now >= m.nextSprintAt) {
    if (m.endsAt - now >= R.SPRINT_MS + R.SPRINT_TAIL_MS) ev.sprintGo = startSprint(m, now);
    else m.nextSprintAt = Infinity;   // too late in the round for another one (a «+30 s» opens it again)
  }
  m.races.forEach((b) => {
    const seats = seatsOf(m, b);
    if (seats.length < 2) return;
    const ord = rank(seats);
    const top = ord[0];
    const cur = b.lead != null ? kid(m, b.lead) : null;
    if (!cur || b.seats.indexOf(cur.k) < 0) {
      // the first leader: clearly ahead of everybody else
      if (top.m - ord[1].m >= R.LEAD_M) b.lead = top.k;
    } else if (top.k !== cur.k && top.m - cur.m >= R.LEAD_M) b.lead = top.k;
    if (b.lead != null && b.lead !== b.announced && now - b.lastAlarm >= R.LEAD_GAP_MS) {
      ev.leads.push({ b: b.id, k: b.lead, first: b.announced == null });
      b.announced = b.lead;
      b.lastAlarm = now;
    }
  });
  return ev;
}
// «+30 s» after the sprints ran out: they may come back (the next one 40 s after the last start, or now)
function reopenSprints(m, now) {
  if (m.nextSprintAt === Infinity && !m.sprint) m.nextSprintAt = now;
}
// a race as the screens draw it
function raceView(m, b, online) {
  return {
    id: b.id, lead: b.lead, seq: b.seq,
    seats: seatsOf(m, b).map((r) => ({ k: r.k, name: r.name, skin: r.skin, c: r.c, m: Math.round(r.m), st: r.stars, on: online ? !!online(r.k) : !r.away })),
  };
}
// the compact live line of a race: [[k, metres, flags, sprint metres]] — flags: 1 flying, 2 tailwind, 4 blue fire
function racePos(m, b, now) {
  return seatsOf(m, b).map((r) => {
    const x = r.flap;
    const fl = (x && !x.closed && now >= x.start && now <= closeAt(x) ? 1 : 0) | (tailOn(m, r) ? 2 : 0) | (x && x.fire ? 4 : 0);
    const row = [r.k, Math.round(r.m), fl];
    if (m.sprint) row.push(Math.round(m.sprint.s[r.k] || 0));
    return row;
  });
}

// ---------- the end ----------
// Three Mario Party bonus stars per race, each +BONUS_M (they count: the winner can change). Ties share; nobody
// eligible → skipped.
const BONUS = [
  { id: 'sabia', name: 'Estrella Sabia', what: 'más respuestas correctas', unit: 'aciertos', val: (r) => r.right, ok: (r) => r.right >= 1 },
  { id: 'racha', name: 'Estrella de Racha', what: 'la racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3 },
  { id: 'remontada', name: 'Estrella Remontada', what: 'más metros volando desde el último lugar', unit: 'm', val: (r) => Math.round(r.lastM), ok: (r) => Math.round(r.lastM) >= 1 },
];
function bonusFor(rows) {
  const out = [];
  BONUS.forEach((s) => {
    const ok = rows.filter(s.ok);
    if (!ok.length) return;
    const top = Math.max(...ok.map(s.val));
    out.push({ id: s.id, name: s.name, what: s.what, unit: s.unit, value: top, winners: ok.filter((r) => s.val(r) === top).map((r) => r.k) });
  });
  return out;
}
const order = (a, b) => b.total - a.total || b.stars - a.stars || b.right - a.right || a.k - b.k;
const tie = (a, b) => a.total === b.total && a.stars === b.stars && a.right === b.right;
function finish(m) {
  const rows = [];
  const races = m.races.map((b) => {
    const seats = seatsOf(m, b);
    const list = seats.map((r) => ({
      k: r.k, name: r.name, skin: r.skin, b: b.id, c: r.c, flown: Math.round(r.m), stars: r.stars, right: r.right, answered: r.answered,
      best: r.best, beats: r.beats, flights: r.flights, rings: r.rings, lastM: Math.round(r.lastM), sprints: r.sprints, fast: r.fast,
      laps: COURSE.lap(r.m) - 1, bonus: [], total: Math.round(r.m),
    }));
    const bonus = bonusFor(list);
    bonus.forEach((s) => s.winners.forEach((k) => { const x = list.find((y) => y.k === k); x.bonus.push(s.id); x.total += R.BONUS_M; }));
    const sorted = list.slice().sort(order);
    sorted.forEach((x, i) => { x.rank = i > 0 && tie(sorted[i - 1], x) ? sorted[i - 1].rank : i + 1; x.of = sorted.length; });
    rows.push(...sorted);
    return { id: b.id, bonus, rows: sorted, winners: sorted.filter((x) => x.rank === 1 && x.total > 0).map((x) => x.k) };
  });
  const podium = rows.slice().sort(order);
  podium.forEach((x, i) => { x.classRank = i > 0 && tie(podium[i - 1], x) ? podium[i - 1].classRank : i + 1; });
  return { races, rows, podium: podium.filter((x) => x.classRank <= 3 && x.total > 0).slice(0, 5) };
}

module.exports = {
  R, COURSE, BONUS, clampDuration, frenzyMs, newGame, newRecord, addRace, deal, seatLate, inGame, setAway, kid, raceOf, seatsOf,
  startPlay, addTime, shiftTimes, final, standing, tailOn, answer, openFlap, beats, closeFlap, closeAt, startSprint, endSprint,
  reopenSprints, rank, tick, raceView, racePos, bonusFor, finish,
};
