// La Gran Fuga de Dubái (gameType 'escape') — the rules, no sockets (server.js glues them to the room).
// Co-op: the whole class against Robotín, the museum's goofy guard robot with a glitch. Three Dubai zones in a row
// (public/js/escape-map.js LEVELS). Each zone has two parts:
//   RUN   answering is the engine: every right answer is a turbo for the crew (3 in a row = súper turbo). Robotín rolls
//         behind at a steady speed that grows each zone; if he reaches the crew: «¡Zap!» (tickle lightning), everybody is
//         dizzy 3 s and the crew slides back a little. Never a full restart.
//   ZONE  «zona segura»: 3 waves in a top-down room; green zones light up, every kid walks into one before the zap.
//         Zones with a limit protect only the first N kids in (the class must split). Kids caught outside cost the crew
//         hearts (5 for the round). Hearts at 0 = Robotín catches the crew at the gate: the zone is replayed once, faster.
// After the third zone: the escape in Hamdan's jet. Team rank by zones cleared + hearts left; personal achievements.
// Player fields live on the room's player objects with an `es` prefix; the round state is `round` (server: g.escape).
'use strict';
const EscapeMap = require('../public/js/escape-map');

const T = EscapeMap.TILE;
const R = {
  LEVELS: 3,
  L: 100,                     // metres of chase per zone
  HEARTS: 5,
  GAP0: 22,                   // Robotín starts 22 m behind the crew …
  WAKE_MS: 3000,              // … and waits 3 s at the start of every run («¡Robotín despertó!»)
  BASE_FRAC: 0.42,            // the crew jogs at 42 % of the expected pace on its own; turbos bring the rest
  TURBO_FRAC: 0.58,
  ROBOT_FRAC: [0.74, 0.84, 0.93],   // Robotín's speed as a share of the expected crew pace, zone 1..3
  REPLAY_MULT: 1.12,          // a replayed zone: Robotín 12 % faster
  TURBO_RATE: 0.09,           // expected right answers per kid per second (bots ~0.08, a real class ~0.1)
  TURBO_MIN: 0.4, TURBO_MAX: 12,    // metres per turbo (one kid alone never jumps a whole zone)
  SUPER_MULT: 2.5, STREAK_EVERY: 3,
  // Robotín keeps the chase tight: behind more than the zone's target gap he speeds up (0.12 m/s per metre), so a class
  // that keeps answering stays ~10-20 m ahead and a class that stops answering gets caught (bot runs 2026-10-13: with a
  // fixed speed he never caught a 20-kid class, 0 zaps in 5 min)
  // (30-bot runs: 0 zaps with gaps 14/11/9 and a flat sprint, so the tickle-zap moment never happened; tightened)
  TARGET_GAP: [12, 8, 5], RUBBER_K: 0.12,
  // … and every 14-22 s his glitch makes him sprint for 2.5 s («¡Robotín acelera!»), harder each zone: zone 1 is calm,
  // zone 2 has close calls, zone 3 zaps an average class now and then (a strong class stays ahead)
  SPRINT_GAP_MS: [14000, 22000], SPRINT_MS: 2500, SPRINT_FRAC: [0.9, 1.3, 1.7],
  CATCH_BACK: 6,              // a zap: the crew slides back 6 m …
  CATCH_KNOCK: 16,            // … and Robotín bounces back to 16 m behind, dazed for 2.5 s
  DIZZY_MS: 3000, ROBOT_DAZE_MS: 2500, ZAP_CD_MS: 4000,
  // «¡Robotín se acerca!» under 7 / 5 / 3 m per zone, off again 4 m later (under the zone's target gap, so the alarm
  // means «he's about to catch us», not «zone 3»; design review 2026-10-13: with one 8 m line it stayed on all zone 3)
  CLOSE_M: [7, 5, 3], CLOSE_OFF: 4,
  PUSH_AFTER_S: 55, PUSH_K: 0.02,   // a run that drags on: Dralingo pushes, the jog gets 2 %/s faster
  RUN_TARGET_S: [25, 80], ZONE_BUDGET_S: 150,
  ZONE_INTRO_MS: 3500, WAVES: 3, WAVE_MS: [[12000, 11000, 10000], [11000, 10500, 9500], [10500, 10000, 9000]],
  WAVE_REST_MS: 3000, ZONE_DIZZY_MS: 2000, MAX_LOST_PER_WAVE: 2, REPLAY_HEARTS: 3, FREE_PER: 10, CLEAR_BONUS: 1,
  AWAY_MS: 8000,              // a phone silent for 8 s in the room is «away»: it can't cost the crew hearts
  CLEARED_MS: 4200, CAUGHT_MS: 4200, ESCAPE_MS: 7000,
  SPEED: 140,                 // walking speed in the room (px/s)
};

const isOn = (p) => p && !p.disconnected;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Expected crew pace (m/s) for a round of `durationS` seconds: three runs + three zona segura phases fit the round.
function paceFor(durationS) {
  const run = clamp(((durationS || 300) - R.ZONE_BUDGET_S) / R.LEVELS, R.RUN_TARGET_S[0], R.RUN_TARGET_S[1]);
  return R.L / run;
}

function newRound(seed, now, durationS) {
  const round = {
    id: seed + ':' + now, seed, startedAt: now, pace: paceFor(durationS),
    level: 1, phase: 'run', phaseAt: now, phaseUntil: 0, hearts: R.HEARTS, replayed: {}, replay: false, replayCount: 0,
    crew: 0, robot: -R.GAP0, pending: 0, wakeAt: now + R.WAKE_MS, dazeUntil: 0, dizzyUntil: 0, lastZapAt: 0,
    zaps: 0, turbos: 0, levelsCleared: 0, escaped: false,
    room: null, zones: [], wave: 0, waveAt: 0, waveUntil: 0, waveResolved: false, pos: {}, idx: 0,
    paused: false, pausedAt: 0, milestones: {}, log: [],
  };
  return round;
}

// A kid enters the round (start, late join). A rejoin (same round id) keeps everything.
function preparePlayer(round, p) {
  if (p.esRound === round.id) return p;
  p.esRound = round.id;
  p.esIdx = ++round.idx;
  p.esStreak = 0; p.esBest = 0; p.esTurbos = 0; p.esSupers = 0; p.esRight = 0; p.esWrong = 0;
  p.esSafe = 0; p.esWaves = 0; p.esReachMs = 0; p.esReachN = 0; p.esZapped = 0;
  p.esDizzyUntil = 0; p.esEnter = null; p.esReach = null;
  return p;
}

function kidsOn(players, round) {
  return Object.values(players).filter((p) => isOn(p) && p.esRound === round.id);
}

// Robotín's speed in the current zone (m/s)
function robotSpeed(round) {
  return round.pace * R.ROBOT_FRAC[round.level - 1] * (round.replay ? R.REPLAY_MULT : 1);
}
// how many metres one turbo is worth with `n` kids in the class
function turboGain(round, n, sup) {
  const g = clamp((R.TURBO_FRAC * round.pace) / (R.TURBO_RATE * Math.max(1, n)), R.TURBO_MIN, R.TURBO_MAX);
  return g * (sup ? R.SUPER_MULT : 1);
}

// A kid answered. Right = a turbo for the crew (during a run); 3 in a row = súper turbo. Wrong = nothing lost.
function answer(round, p, correct, n) {
  if (!correct) { p.esStreak = 0; p.esWrong = (p.esWrong || 0) + 1; return { turbo: false }; }
  p.esStreak = (p.esStreak || 0) + 1;
  p.esBest = Math.max(p.esBest || 0, p.esStreak);
  p.esRight = (p.esRight || 0) + 1;
  if (round.phase !== 'run' || round.paused) return { turbo: false, streak: p.esStreak };
  const sup = p.esStreak % R.STREAK_EVERY === 0;
  const gain = turboGain(round, n, sup);
  round.pending += gain;
  round.turbos++;
  p.esTurbos = (p.esTurbos || 0) + 1;
  if (sup) p.esSupers = (p.esSupers || 0) + 1;
  return { turbo: true, super: sup, gain: Math.round(gain * 10) / 10, streak: p.esStreak };
}

const nextSprint = (rand) => R.SPRINT_GAP_MS[0] + (rand || Math.random)() * (R.SPRINT_GAP_MS[1] - R.SPRINT_GAP_MS[0]);
// One physics step of the run (dt seconds). Returns the events: zap, close (Robotín near), sprint, done (crew reached
// the zone).
function stepRun(round, players, dt, now) {
  const ev = [];
  if (round.phase !== 'run' || round.paused) return ev;
  const runS = Math.max(0, (now - round.phaseAt) / 1000);
  const push = runS > R.PUSH_AFTER_S ? 1 + (runS - R.PUSH_AFTER_S) * R.PUSH_K : 1;
  const base = round.pace * R.BASE_FRAC * push;
  const dizzy = now < round.dizzyUntil;
  let move = dizzy ? base * 0.25 * dt : base * dt;
  if (round.pending > 0) { const b = round.pending * Math.min(1, dt * 2.5); move += b; round.pending -= b; if (round.pending < 0.01) round.pending = 0; }
  round.crew = Math.min(R.L, round.crew + move);
  if (now >= round.wakeAt && now >= round.dazeUntil) {
    const gap = round.crew - round.robot;
    if (!round.sprintAt) round.sprintAt = now + nextSprint();
    let sprint = false;
    if (now >= round.sprintAt) {
      if (now < round.sprintAt + R.SPRINT_MS) sprint = true;
      else round.sprintAt = now + nextSprint();
    }
    if (sprint && !round.sprintSaid) { round.sprintSaid = true; ev.push({ type: 'sprint' }); }
    if (!sprint) round.sprintSaid = false;
    const v = robotSpeed(round) + Math.max(0, gap - R.TARGET_GAP[round.level - 1]) * R.RUBBER_K + (sprint ? round.pace * R.SPRINT_FRAC[round.level - 1] : 0);
    round.robot += v * dt;
  }
  if (round.crew >= R.L) { ev.push({ type: 'done' }); return ev; }
  const gap = round.crew - round.robot;
  if (gap <= 0 && now - round.lastZapAt >= R.ZAP_CD_MS) {
    round.lastZapAt = now;
    round.zaps++;
    round.crew = Math.max(0, round.crew - R.CATCH_BACK);
    round.robot = round.crew - R.CATCH_KNOCK;
    round.pending = 0;
    round.dazeUntil = now + R.ROBOT_DAZE_MS;
    round.dizzyUntil = now + R.DIZZY_MS;
    round.sprintAt = now + R.ROBOT_DAZE_MS + nextSprint();       // no sprint right after a zap
    kidsOn(players, round).forEach((p) => { p.esDizzyUntil = now + R.DIZZY_MS; p.esZapped = (p.esZapped || 0) + 1; });
    ev.push({ type: 'zap', crew: round.crew, robot: round.robot });
  } else if (gap < R.CLOSE_M[round.level - 1] && !round.closeSaid) { round.closeSaid = true; ev.push({ type: 'close' }); }
  else if (gap > R.CLOSE_M[round.level - 1] + R.CLOSE_OFF) round.closeSaid = false;
  return ev;
}

// ---------- zona segura ----------
function startZone(round, now) {
  // a zone never starts with 0 hearts (a replayed zone may have ended at 0): «caught» only when this zone takes the last one
  if (round.hearts <= 0) round.hearts = 1;
  round.skipped = false;
  round.phase = 'zone';
  round.phaseAt = now;
  round.room = EscapeMap.buildRoom(round.seed, round.level);
  round.wave = 0;
  round.zones = [];
  round.waveAt = 0; round.waveUntil = 0; round.waveResolved = true;
  round.phaseUntil = now + R.ZONE_INTRO_MS;    // the first wave starts after the intro
  round.pos = {};
}
function spawnPos(round, i) {
  const sp = round.room.spawn;
  const [tx, ty] = sp[(i * 7 + 3) % sp.length];
  return { x: (tx + 0.5) * T, y: (ty + 0.5) * T + 6 };
}
// A new wave: its zones (for the kids in the room right now) and when the zap lands.
function startWave(round, players, now) {
  round.wave++;
  const n = kidsOn(players, round).length;
  round.zones = EscapeMap.waveZones(round.room, round.seed + round.replayCount * 17, round.level, round.wave, n);
  round.waveAt = now;
  round.waveUntil = now + R.WAVE_MS[round.level - 1][round.wave - 1];
  round.waveResolved = false;
  Object.entries(players).forEach(([pid, p]) => {
    p.esEnter = null; p.esReach = null;
    // a kid who is already standing where a zone lights up is safe, but that's luck, not speed: no «fastest» time
    const pos = round.pos[pid];
    p.esReachSkip = !!pos && EscapeMap.zoneAt(round.zones, pos.x, pos.y) >= 0;
  });
  return round.zones;
}
// Who is in which zone right now, the first ones in first (they are the protected ones in a zone with a limit).
function occupancy(round, players, now) {
  const occ = round.zones.map((z) => ({ id: z.id, cap: z.cap, kids: [] }));
  Object.entries(round.pos).forEach(([pid, pos]) => {
    const p = players[pid];
    if (!isOn(p) || p.esRound !== round.id) return;
    if (now - (pos.at || 0) > R.AWAY_MS) return;      // a locked phone doesn't take a protected spot
    const zid = EscapeMap.zoneAt(round.zones, pos.x, pos.y);
    if (zid < 0) { p.esEnter = null; return; }
    if (!p.esEnter || p.esEnter.zone !== zid) p.esEnter = { zone: zid, at: now };
    if (!p.esReach) p.esReach = now;
    occ[zid].kids.push({ pid, idx: p.esIdx, at: p.esEnter.at });
  });
  occ.forEach((o) => {
    o.kids.sort((a, b) => a.at - b.at || a.idx - b.idx);
    o.safe = o.cap ? o.kids.slice(0, o.cap) : o.kids;
    o.full = !!o.cap && o.kids.length >= o.cap;
  });
  return occ;
}
// The zap lands: who is safe, who is caught outside, how many hearts the crew loses.
function resolveWave(round, players, now) {
  round.waveResolved = true;
  const occ = occupancy(round, players, now);
  const safe = new Set();
  occ.forEach((o) => o.safe.forEach((k) => safe.add(k.pid)));
  const out = [];
  // away phones (locked screen, no position for 8 s) never cost the crew hearts
  const present = Object.entries(players).filter(([pid, p]) => isOn(p) && p.esRound === round.id && round.pos[pid] && now - (round.pos[pid].at || 0) <= R.AWAY_MS);
  present.forEach(([pid, p]) => {
    p.esWaves = (p.esWaves || 0) + 1;
    if (safe.has(pid)) {
      p.esSafe = (p.esSafe || 0) + 1;
      if (p.esReach && !p.esReachSkip) { p.esReachMs = (p.esReachMs || 0) + (p.esReach - round.waveAt); p.esReachN = (p.esReachN || 0) + 1; }
    } else {
      out.push(pid);
      p.esDizzyUntil = now + R.ZONE_DIZZY_MS;
      p.esZapped = (p.esZapped || 0) + 1;
    }
  });
  // fair to a class (classroom playtest 2026-10-13: two distracted kids out of 17 cost the whole class zone 1, no class
  // ever escaped): one kid in ten may miss a wave for free, 1 ❤️ for a few more, 2 ❤️ only when over a third is out
  const n = present.length;
  const counted = Math.max(0, out.length - Math.floor(n / R.FREE_PER));
  const lost = counted ? Math.min(out.length > n / 3 ? R.MAX_LOST_PER_WAVE : 1, round.hearts) : 0;
  round.hearts = Math.max(0, round.hearts - lost);
  return { safe: Array.from(safe), out, lost, hearts: round.hearts, n };
}

// After the last wave (or when the hearts run out): next step of the episode.
//   'caught'  hearts at 0 the first time in this zone: replay it, faster, with 3 hearts
//   'cleared' zone 1 or 2 done: on to the next zone        'escape' zone 3 done: the jet takes off
function afterZone(round) {
  if (round.hearts <= 0 && !round.replayed[round.level] && !round.skipped) return 'caught';
  return round.level >= R.LEVELS ? 'escape' : 'cleared';
}
function startRun(round, now, replay) {
  round.phase = 'run';
  round.phaseAt = now;
  round.phaseUntil = 0;
  round.crew = 0;
  round.robot = -R.GAP0;
  round.pending = 0;
  round.wakeAt = now + R.WAKE_MS;
  round.dazeUntil = 0; round.dizzyUntil = 0; round.lastZapAt = 0; round.closeSaid = false; round.sprintAt = 0; round.sprintSaid = false;
  round.replay = !!replay;
  round.zones = []; round.wave = 0; round.room = null; round.pos = {};
}
function clearLevel(round) {
  round.levelsCleared = Math.max(round.levelsCleared, round.level);
  round.hearts = Math.min(R.HEARTS, round.hearts + R.CLEAR_BONUS);     // a zone cleared gives a heart back
  if (round.level < R.LEVELS) round.level++;
  round.replay = false;
}
// Teacher «Saltar zona» (the escape hatch): the zona segura ends now, no hearts lost, the episode goes on.
function skipZone(round, now) {
  if (round.phase !== 'zone') return false;
  round.wave = R.WAVES;
  round.waveResolved = true;
  round.phaseUntil = now;
  round.skipped = true;          // the teacher moved on: never «caught» for it
  return true;
}
function caught(round) {
  round.replayed[round.level] = true;
  round.replayCount = (round.replayCount || 0) + 1;
  round.hearts = R.REPLAY_HEARTS;
}

// ---------- the room: server check of a phone's position ----------
function checkPos(round, p, pid, x, y, now) {
  const prev = round.pos[pid];
  const room = round.room;
  if (!room) return { ok: false };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return prev ? { ok: false, x: prev.x, y: prev.y } : { ok: false, unknown: true };
  if (!prev) return EscapeMap.boxBlocked(room, x, y) ? { ok: false, unknown: true } : { ok: true };
  const frozen = now < (p.esDizzyUntil || 0) || round.paused;
  const budget = frozen ? 6 : R.SPEED * 1.25 * Math.min(1.5, Math.max(0, now - prev.at) / 1000) + 40;
  if (Math.hypot(x - prev.x, y - prev.y) > budget) return { ok: false, x: prev.x, y: prev.y };
  if (EscapeMap.boxBlocked(room, x, y, 1)) return { ok: false, x: prev.x, y: prev.y };
  return { ok: true };
}

// ---------- the end ----------
// Team rank: «Pilotos del Cielo» (escaped with 3+ hearts) · «Viajeros del Burj» (escaped with fewer, or 2 zones with
// 3+ hearts) · «Exploradores del Zoco». Stars 1..3 from the hearts left.
function rankOf(levelsCleared, hearts) {
  const escaped = levelsCleared >= R.LEVELS;
  let id = 'zoco';
  if (escaped && hearts >= 3) id = 'cielo';
  else if (escaped || (levelsCleared >= 2 && hearts >= 3)) id = 'burj';
  // stars from the hearts left, never more than the zones cleared + 1 (ending in zone 1 with every heart isn't 3 stars)
  const stars = Math.min(hearts >= 5 ? 3 : hearts >= 3 ? 2 : 1, levelsCleared + 1);
  const name = { cielo: 'Pilotos del Cielo', burj: 'Viajeros del Burj', zoco: 'Exploradores del Zoco' }[id];
  return { id, name, stars };
}
function finish(round, players) {
  const rows = Object.entries(players).filter(([, p]) => p.esRound === round.id).map(([id, p]) => ({
    id, name: p.name, avatar: p.avatar || '', turbos: p.esTurbos || 0, supers: p.esSupers || 0, best: p.esBest || 0,
    right: p.esRight || 0, safe: p.esSafe || 0, waves: p.esWaves || 0, zapped: p.esZapped || 0,
    reach: p.esReachN ? Math.round(p.esReachMs / p.esReachN) : null, reachN: p.esReachN || 0, gone: !!p.disconnected,
  }));
  // a kid's points: turbos (súper = 3) + 2 per safe wave
  rows.forEach((r) => { r.score = r.turbos + r.supers * 2 + r.safe * 2; });
  rows.sort((a, b) => b.score - a.score || b.turbos - a.turbos);
  const live = rows.filter((r) => !r.gone);
  const pool = live.length ? live : rows;
  // three awards, to three different kids when the class allows it (design review 2026-10-13: one kid took 2 of 3)
  const taken = new Set();
  const pick = (list) => { const r = list.find((x) => !taken.has(x.id)) || list[0] || null; if (r) taken.add(r.id); return r; };
  const turbos = pick(pool.filter((r) => r.turbos >= 1).sort((a, b) => b.turbos - a.turbos || b.score - a.score));
  const fastest = pick(pool.filter((r) => r.reach !== null && r.reachN >= 2).sort((a, b) => a.reach - b.reach));
  const streak = pick(pool.filter((r) => r.best >= 2).sort((a, b) => b.best - a.best || b.score - a.score));
  const awards = { turbos, fastest, streak };
  return { rank: rankOf(round.levelsCleared, round.hearts), levelsCleared: round.levelsCleared, hearts: round.hearts, escaped: round.escaped, zaps: round.zaps, turbos: round.turbos, rows, awards };
}

// Teacher pause: every timer moves forward by the paused time.
function shiftTimers(round, players, ms) {
  ['phaseAt', 'phaseUntil', 'wakeAt', 'dazeUntil', 'dizzyUntil', 'lastZapAt', 'waveAt', 'waveUntil', 'sprintAt'].forEach((k) => { if (round[k]) round[k] += ms; });
  Object.values(round.pos).forEach((pos) => { pos.at += ms; });
  Object.values(players).forEach((p) => {
    if (p.esDizzyUntil) p.esDizzyUntil += ms;
    if (p.esEnter) p.esEnter.at += ms;
    if (p.esReach) p.esReach += ms;
  });
}

module.exports = {
  R, paceFor, newRound, preparePlayer, kidsOn, robotSpeed, turboGain, answer, stepRun,
  startZone, spawnPos, startWave, occupancy, resolveWave, afterZone, startRun, clearLevel, caught, skipZone, checkPos,
  rankOf, finish, shiftTimers,
};
