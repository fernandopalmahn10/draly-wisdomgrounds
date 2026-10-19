// La Gran Fuga de Dubái (gameType 'escape') — the rules, no sockets (server.js glues them to the room).
// Co-op: the whole class against Robotín, the museum's goofy guard robot with a glitch. v2 (2026-10-17, spec
// docs/specs/gran-fuga-v2.md): each round is a ROUTE of three zones (public/js/escape-map.js ROUTES: Dubái, then China),
// each run's pace set from the time left on the clock. Each zone has two parts:
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
  // v2 (classroom playtest: an average class never saw a zap nor «¡Robotín se acerca!», the runs felt safe): in a sprint he
  // also lunges at a crew that is far ahead, closing in fast until he is just under the alarm line, never past it on his
  // own (a close call for every class that keeps answering; a slow crew still gets the tickle-zap)
  LUNGE_K: 2.5, LUNGE_FAR: 3,
  CATCH_BACK: 6,              // a zap: the crew slides back 6 m …
  CATCH_KNOCK: 16,            // … and Robotín bounces back to 16 m behind, dazed for 2.5 s
  DIZZY_MS: 3000, ROBOT_DAZE_MS: 2500, ZAP_CD_MS: 4000,
  // «¡Robotín se acerca!» under 7 / 5 / 3 m per zone, off again 4 m later (under the zone's target gap, so the alarm
  // means «he's about to catch us», not «zone 3»; design review 2026-10-13: with one 8 m line it stayed on all zone 3)
  CLOSE_M: [7, 5, 3], CLOSE_OFF: 4,
  // a run that drags on: Dralingo pushes, the jog gets 2 %/s faster (after 1.2× the run's planned time; 55 s before v2)
  PUSH_AFTER_S: 55, PUSH_AFTER_K: 1.2, PUSH_K: 0.02,
  RUN_TARGET_S: [22, 80], ZONE_BUDGET_S: 132, SPARE_S: 6,
  // v2: the zona segura a little shorter (the playtest's 4-minute rounds ended one wave short of the jet)
  ZONE_INTRO_MS: 3000, WAVES: 3, WAVE_MS: [[10000, 9500, 9000], [9500, 9000, 8500], [9000, 8500, 8000]],
  // v2 (classroom playtest: 3-6 kids of 25 outside a 9 s wave is normal at 7-10, and cost the class the jet): one kid in
  // five may miss a wave for free (at least one), then 1 ❤️, 2 ❤️ only when over 40 % of the class is out
  WAVE_REST_MS: 2500, ZONE_DIZZY_MS: 2000, MAX_LOST_PER_WAVE: 2, REPLAY_HEARTS: 3, FREE_PER: 5, MANY_OUT: 0.4, CLEAR_BONUS: 1,
  AWAY_MS: 8000,              // a phone silent for 8 s in the room is «away»: it can't cost the crew hearts
  CLEARED_MS: 4200, CAUGHT_MS: 4200, ESCAPE_MS: 7500,
  SPEED: 140,                 // walking speed in the room (px/s)
  // ---- chase pass (2026-10-19, his words: "the robot is not chasing you at any time … it doesn't feel like a
  // persecution"): Robotín chases EACH kid. My own distance to him (p.esGap, metres) closes second by second while MY
  // question is open; a right answer = I dash away, a wrong one = I stumble (he gains); when he reaches me = a personal
  // zap (stunned, tiles locked, the question's clock held), then a shield. His speed follows my own answering pace
  // (CH_K metres per answer at my usual pace: a quick kid meets a quick Robotín, a slow kid a slow one), so every kid
  // feels him coming, and what keeps him away is answering RIGHT. Fair to the youngest: at most one zap per kid every
  // 45 s (inside that he trips instead), the gap resets after a zap, a stun never shortens the question, a zap never
  // takes a kid out of play and costs the crew nothing (co-op: nobody is blamed).
  CH_G0: 14,                  // metres behind me at the start of every run and after a zap
  CH_GMAX: 16,                // never farther: he is always in sight
  CH_K: [2.6, 2.9, 3.2],      // metres he closes during one of my questions at my usual pace, zone 1..3
  CH_PACE0: 7, CH_PACE: [3, 16], CH_EMA: 0.35,   // my answering pace (s): a first guess, its clamps, how fast it adapts
  // … and with my recent accuracy (a kid who keeps missing meets a gentler Robotín, a kid who never misses a keener
  // one: the youngest still feel him, the strongest still get close calls)
  CH_ACC0: 0.75, CH_ACC_EMA: 0.25, CH_ACC_K: [0.55, 1.12],
  CH_V: [0.15, 1.6],          // his closing speed (m/s), whatever my pace
  CH_DASH: 7.5, CH_DASH_SUPER: 9.5,              // a right answer / a súper turbo: I dash this far away
  CH_STUMBLE: 2.5, CH_FLOOR: 1.5,                // a wrong answer: he gains 2.5 m (a stumble alone never zaps)
  // his lunges (a siren on my phone): for 1.8 s he speeds up (1.5×) and swoops in on a kid who is far ahead, down to
  // 5-7.5 m (a close call even for the quickest kids); he lunges only at a kid more than 9 m ahead
  CH_LUNGE_EVERY: [18000, 32000], CH_LUNGE_MS: 1800, CH_LUNGE_X: 1.5, CH_LUNGE_TO: [5, 7.5], CH_LUNGE_K: 1.3, CH_LUNGE_FAR: 9,
  CH_WINDED_MS: 3000,                            // … and for 3 s after a lunge he can only trip, never zap (a scare, not a trap)
  CH_STUN_MS: 1800, CH_SHIELD_MS: 3500,          // a zap: stunned 1.8 s, then a shield (he waits)
  CH_ZAP_MIN_MS: 45000, CH_TRIP_TO: 6,           // at most one zap per kid per 45 s; inside it he trips back to 6 m
  CH_NEAR: 4, CH_NEAR_OFF: 7, CH_WARN: 7,        // «¡Está detrás de ti!» under 4 m (again once past 7 m); red under 7
};

const isOn = (p) => p && !p.disconnected;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Expected crew pace (m/s) for a round of `durationS` seconds: three runs + three zona segura phases fit the round.
// (v2: only the round's first guess and the tests' simulated classes; the server sets every run's pace with retimeRun.)
function paceFor(durationS) {
  const run = clamp(((durationS || 300) - R.ZONE_BUDGET_S) / R.LEVELS, R.RUN_TARGET_S[0], R.RUN_TARGET_S[1]);
  return R.L / run;
}
// How long the zona segura of `level` lasts (s): the intro, its three waves and the rests after them.
function zoneSeconds(level) {
  const w = R.WAVE_MS[Math.max(1, Math.min(R.LEVELS, level)) - 1];
  return (R.ZONE_INTRO_MS + w.reduce((a, b) => a + b, 0) + R.WAVES * R.WAVE_REST_MS) / 1000;
}
// v2 pacing: at the start of every run the crew's pace comes from the time left on the clock. What the zonas seguras and
// the cards still to come need is set aside; the runs left share the rest. A class that answers at the expected rate
// reaches the jet before the bell at 4, 5 or 6 minutes (the playtest's 4-minute rounds ended one wave short of it).
// A replayed zone or a slow run eats into the next runs' share: they get quicker, never longer than 80 s.
function retimeRun(round, timeLeftS) {
  if (!(timeLeftS > 0)) return round.pace;
  let fixed = R.SPARE_S;
  for (let l = round.level; l <= R.LEVELS; l++) fixed += zoneSeconds(l) + (l < R.LEVELS ? R.CLEARED_MS : R.ESCAPE_MS) / 1000;
  const runsLeft = R.LEVELS - round.level + 1;
  const runS = clamp((timeLeftS - fixed) / runsLeft, R.RUN_TARGET_S[0], R.RUN_TARGET_S[1]);
  round.pace = R.L / runS;
  round.runTarget = runS;
  return round.pace;
}

function newRound(seed, now, durationS, route) {
  const round = {
    id: seed + ':' + now, seed, startedAt: now, pace: paceFor(durationS), route: EscapeMap.routeIdx(route), runTarget: 0,
    level: 1, phase: 'run', phaseAt: now, phaseUntil: 0, hearts: R.HEARTS, replayed: {}, replay: false, replayCount: 0,
    crew: 0, robot: -R.GAP0, pending: 0, wakeAt: now + R.WAKE_MS, dazeUntil: 0, dizzyUntil: 0, lastZapAt: 0,
    zaps: 0, turbos: 0, levelsCleared: 0, escaped: false, runN: 1, pzaps: 0,
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
  // the chase pass: my own Robotín (chaseReset fills the rest on my first step of each run)
  p.esRunN = 0; p.esPace = R.CH_PACE0; p.esAcc = R.CH_ACC0; p.esZapAt = -1e15; p.esPZaps = 0; p.esTrips = 0; p.esNears = 0; p.esEscapes = 0;
  p.esGap = R.CH_G0; p.esStunUntil = 0; p.esShieldUntil = 0; p.esLungeAt = 0; p.esLungeUntil = 0; p.esOpenMs = 0;
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
// `frenzy` = the round's last 30 s («¡Súper turbos!»): every right answer is a súper turbo (one last push to the jet).
function answer(round, p, correct, n, frenzy) {
  if (!correct) { p.esStreak = 0; p.esWrong = (p.esWrong || 0) + 1; return { turbo: false }; }
  p.esStreak = (p.esStreak || 0) + 1;
  p.esBest = Math.max(p.esBest || 0, p.esStreak);
  p.esRight = (p.esRight || 0) + 1;
  if (round.phase !== 'run' || round.paused) return { turbo: false, streak: p.esStreak };
  const sup = !!frenzy || p.esStreak % R.STREAK_EVERY === 0;
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
  const pushAfter = round.runTarget ? round.runTarget * R.PUSH_AFTER_K : R.PUSH_AFTER_S;
  const push = runS > pushAfter ? 1 + (runS - pushAfter) * R.PUSH_K : 1;
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
    const close = R.CLOSE_M[round.level - 1];
    if (sprint && !round.sprintSaid) { round.sprintSaid = true; round.lungeFar = gap > close + R.LUNGE_FAR; ev.push({ type: 'sprint' }); }
    if (!sprint) round.sprintSaid = false;
    // a crew far ahead: he lunges (closing in fast) and trips once he is just under the alarm line; a crew already
    // near: the classic sprint
    const lunge = sprint && round.lungeFar ? Math.max(0, gap - (close - 1)) * R.LUNGE_K : 0;
    const v = robotSpeed(round) + Math.max(0, gap - R.TARGET_GAP[round.level - 1]) * R.RUBBER_K + (sprint ? (round.lungeFar ? lunge : round.pace * R.SPRINT_FRAC[round.level - 1]) : 0);
    if (sprint && round.lungeFar && gap <= close - 0.5) { round.sprintAt = now + nextSprint(); round.sprintSaid = false; round.lungeFar = false; }
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
    // the chase pass: the whole crew caught slows the crew (dizzy 3 s, 6 m back) but locks nobody's tiles any more: the
    // zaps that stun a kid are the personal ones (stepChase). (Locking every phone 3 s per crew zap cost a 5-kid class
    // the jet in 6-minute rounds, the simulation of 2026-10-19.)
    kidsOn(players, round).forEach((p) => { p.esZapped = (p.esZapped || 0) + 1; });
    ev.push({ type: 'zap', crew: round.crew, robot: round.robot });
  } else if (gap < R.CLOSE_M[round.level - 1] && !round.closeSaid) { round.closeSaid = true; ev.push({ type: 'close' }); }
  else if (gap > R.CLOSE_M[round.level - 1] + R.CLOSE_OFF) round.closeSaid = false;
  return ev;
}

// ---------- the chase pass: Robotín chases ME (2026-10-19) ----------
const nextLunge = (rand) => R.CH_LUNGE_EVERY[0] + (rand || Math.random)() * (R.CH_LUNGE_EVERY[1] - R.CH_LUNGE_EVERY[0]);
// his closing speed on me (m/s): CH_K metres per question at my usual pace, faster in later zones and on a replay
function chaseSpeed(round, p) {
  const pace = clamp(p.esPace || R.CH_PACE0, R.CH_PACE[0], R.CH_PACE[1]);
  const acc = clamp(0.55 + 0.45 * (p.esAcc == null ? R.CH_ACC0 : p.esAcc) / R.CH_ACC0, R.CH_ACC_K[0], R.CH_ACC_K[1]);
  const k = R.CH_K[Math.max(1, Math.min(R.LEVELS, round.level)) - 1] * acc * (round.replay ? R.REPLAY_MULT : 1);
  return clamp(k / pace, R.CH_V[0], R.CH_V[1]);
}
// how fast he closes on me right now (m/s): his speed, and in a lunge 1.5× plus the swoop towards his lunge target
function chaseV(round, p, now) {
  const v = chaseSpeed(round, p);
  if (!(now < (p.esLungeUntil || 0))) return v;
  return v * R.CH_LUNGE_X + Math.max(0, (p.esGap || 0) - (p.esLungeTo || R.CH_LUNGE_TO[1])) * R.CH_LUNGE_K;
}
// a fresh chase for me: every run starts with him 14 m behind (the 45 s of his broom carry over)
function chaseReset(round, p, now) {
  p.esRunN = round.runN;
  p.esGap = R.CH_G0;
  p.esStunUntil = 0; p.esShieldUntil = 0; p.esLungeUntil = 0; p.esOpenMs = 0; p.esNearSaid = false;
  p.esLungeAt = Math.max(now, round.wakeAt || 0) + nextLunge(round.rand);
}
// One step of MY chase (dt seconds). `open` = I have a question to answer right now. He closes in only while it is
// open (never on the result screen, in the wake, a pause, my stun or my shield). Returns one event or null:
//   { type: 'lunge', ms }   he lunges (a siren on my phone)
//   { type: 'pzap' }        he reached me: stunned CH_STUN_MS, then the shield; the gap back to 14 m
//   { type: 'trip' }        he reached me inside his 45 s: he trips back to 6 m («¡Uf!»)
//   { type: 'near' }        under 4 m («¡Está detrás de ti!»), once until I am past 7 m again
function stepChase(round, p, open, dt, now) {
  if (round.phase !== 'run' || round.paused) return null;
  if (p.esRunN !== round.runN) chaseReset(round, p, now);
  const stunned = now < (p.esStunUntil || 0);
  if (open && !stunned) p.esOpenMs = (p.esOpenMs || 0) + dt * 1000;      // my answer time (the stun is not mine)
  if (!open || stunned || now < round.wakeAt || now < (p.esShieldUntil || 0)) return null;
  let ev = null;
  // (he lunges only at a kid far ahead: on a kid already close a lunge would just be a zap; it waits)
  if (now >= (p.esLungeAt || 0) && now >= (p.esLungeUntil || 0) && p.esGap > R.CH_LUNGE_FAR) {
    p.esLungeUntil = now + R.CH_LUNGE_MS;
    p.esLungeAt = p.esLungeUntil + nextLunge(round.rand);
    p.esLungeTo = R.CH_LUNGE_TO[0] + (round.rand || Math.random)() * (R.CH_LUNGE_TO[1] - R.CH_LUNGE_TO[0]);
    ev = { type: 'lunge', ms: R.CH_LUNGE_MS };
  }
  p.esGap -= chaseV(round, p, now) * dt;
  if (p.esGap <= 0) {
    // a lunge never zaps by itself: reached during one (or just after it) he trips, out of breath
    const winded = now < (p.esLungeUntil || 0) + R.CH_WINDED_MS;
    p.esLungeUntil = 0;
    if (!winded && now - (p.esZapAt == null ? -1e15 : p.esZapAt) >= R.CH_ZAP_MIN_MS) {
      p.esZapAt = now;
      p.esPZaps = (p.esPZaps || 0) + 1;
      p.esStunUntil = now + R.CH_STUN_MS;
      p.esShieldUntil = p.esStunUntil + R.CH_SHIELD_MS;
      p.esGap = R.CH_G0;
      p.esNearSaid = false;
      p.esLungeAt = Math.max(p.esLungeAt, p.esShieldUntil + nextLunge(round.rand));
      round.pzaps = (round.pzaps || 0) + 1;
      return { type: 'pzap', stunMs: R.CH_STUN_MS, shieldMs: R.CH_SHIELD_MS };
    }
    p.esGap = R.CH_TRIP_TO;
    p.esTrips = (p.esTrips || 0) + 1;
    p.esNearSaid = false;
    return { type: 'trip' };
  }
  if (p.esGap < R.CH_NEAR && !p.esNearSaid) { p.esNearSaid = true; p.esNears = (p.esNears || 0) + 1; if (!ev) ev = { type: 'near' }; }
  else if (p.esGap > R.CH_NEAR_OFF) p.esNearSaid = false;
  return ev;
}
// I answered (during a run): my pace learns from it; right = I dash away (súper turbo farther), wrong = he gains
// (a stumble alone never zaps: he needs the next second of my next question). Returns { gap, from } or null.
function chaseAnswer(round, p, correct, sup, now) {
  if (round.phase !== 'run' || round.paused) { p.esOpenMs = 0; return null; }
  if (p.esRunN !== round.runN) chaseReset(round, p, now);
  const t = (p.esOpenMs || 0) / 1000;
  p.esOpenMs = 0;
  if (t > 0.3) p.esPace = (p.esPace || R.CH_PACE0) * (1 - R.CH_EMA) + clamp(t, 1, 20) * R.CH_EMA;
  p.esAcc = (p.esAcc == null ? R.CH_ACC0 : p.esAcc) * (1 - R.CH_ACC_EMA) + (correct ? 1 : 0) * R.CH_ACC_EMA;
  const from = p.esGap;
  if (correct) {
    p.esGap = Math.min(R.CH_GMAX, p.esGap + (sup ? R.CH_DASH_SUPER : R.CH_DASH));
    if (from < R.CH_NEAR) p.esEscapes = (p.esEscapes || 0) + 1;       // «¡Por un pelo!»
  } else if (p.esGap > R.CH_FLOOR) p.esGap = Math.max(R.CH_FLOOR, p.esGap - R.CH_STUMBLE);
  return { gap: Math.round(p.esGap * 10) / 10, from: Math.round(from * 10) / 10 };
}
// what my phone needs to draw my chase (sent a few times a second; the phone glides between)
function chaseView(round, p, now, open) {
  if (p.esRunN !== round.runN) return { g: R.CH_G0, v: 0, st: 0, sh: 0, lu: 0, lt: 0 };      // (a new run: he starts 14 m back)
  if (round.paused && round.pausedAt) now = round.pausedAt;     // (a pause holds every timer: the time left as it was)
  const stun = Math.max(0, (p.esStunUntil || 0) - now), shield = Math.max(0, (p.esShieldUntil || 0) - now);
  const lunge = Math.max(0, (p.esLungeUntil || 0) - now);
  const moving = open && !stun && !shield && now >= round.wakeAt && round.phase === 'run' && !round.paused;
  return {
    g: Math.round((p.esGap == null ? R.CH_G0 : p.esGap) * 10) / 10,
    // his base speed (the phone glides with it); in a lunge it adds the swoop itself towards `lt` (the same formula)
    v: moving ? Math.round(chaseSpeed(round, p) * 100) / 100 : 0,
    st: stun, sh: shield, lu: lunge, lt: lunge ? Math.round((p.esLungeTo || R.CH_LUNGE_TO[1]) * 10) / 10 : 0,
  };
}

// ---------- zona segura ----------
function startZone(round, now) {
  // a zone never starts with 0 hearts (a replayed zone may have ended at 0): «caught» only when this zone takes the last one
  if (round.hearts <= 0) round.hearts = 1;
  round.skipped = false;
  round.phase = 'zone';
  round.phaseAt = now;
  round.room = EscapeMap.buildRoom(round.seed, round.level, round.route);
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
    // «Más rápido» times the reaction, not the luck of where a kid stood (playtest 2026-10-16: won in 0.3 s by a kid
    // one step from a zone; code review 2026-10-17): the walk to the nearest zone in a straight line is taken off the
    // time, and a kid already standing inside one when it lights up gets no time at all
    const pos = round.pos[pid];
    const dist = pos ? EscapeMap.zoneDist(round.zones, pos.x, pos.y) : 0;
    p.esReachSkip = !!pos && dist <= 0;
    p.esStartDist = dist;
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
      if (p.esReach && !p.esReachSkip) {
        const walk = 1000 * (p.esStartDist || 0) / R.SPEED;          // the straight walk there: not part of the reaction
        p.esReachMs = (p.esReachMs || 0) + Math.max(0, p.esReach - round.waveAt - walk);
        p.esReachN = (p.esReachN || 0) + 1;
      }
    } else {
      out.push(pid);
      p.esDizzyUntil = now + R.ZONE_DIZZY_MS;
      p.esZapped = (p.esZapped || 0) + 1;
    }
  });
  // fair to a class (classroom playtest 2026-10-13: two distracted kids out of 17 cost the whole class zone 1, no class
  // ever escaped): one kid in ten may miss a wave for free, 1 ❤️ for a few more, 2 ❤️ only when over a third is out
  const n = present.length;
  const counted = Math.max(0, out.length - Math.max(1, Math.floor(n / R.FREE_PER)));
  const lost = counted ? Math.min(out.length > n * R.MANY_OUT ? R.MAX_LOST_PER_WAVE : 1, round.hearts) : 0;
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
  round.runN = (round.runN || 1) + 1;          // the chase pass: every kid's own Robotín starts again 14 m behind
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
// Team rank and stars follow how far the crew got (v2, classroom playtest: a class caught at a gate refills to 3 ❤️, so
// stars from the hearts alone gave a caught class more stars than one that escaped):
//   «Pilotos del Cielo» ★★★  escaped in the jet with 3+ hearts
//   «Viajeros del Burj» ★★   escaped with fewer hearts · ★ reached the last place without escaping
//   «Exploradores del Zoco» ★ otherwise
// Escaping always earns more stars than not escaping. The ids stay; the names (and the badge's picture) are the
// route's (China: «Viajeros de la Muralla», «Exploradores del Mercado»).
function rankOf(levelsCleared, hearts, route) {
  const escaped = levelsCleared >= R.LEVELS;
  let id = 'zoco';
  if (escaped && hearts >= 3) id = 'cielo';
  else if (escaped || levelsCleared >= 2) id = 'burj';
  const stars = escaped ? (hearts >= 3 ? 3 : 2) : 1;
  const rt = EscapeMap.route(route);
  return { id, name: rt.ranks[id], stars, art: rt.rankArt[id] };
}
// Bonus stars of the Mario Party ending (core/party.js). Co-op: every kid at the top shares the star (a whole crew that
// was safe in every wave all get «Más olas a salvo»); the crew itself is never ranked in front of the class.
const STARS = [
  { id: 'turbos', name: 'Más turbos', unit: 'turbos', val: (r) => r.turbos, ok: (r) => r.turbos >= 1 },
  { id: 'fast', name: 'Más rápido a la zona segura', unit: 's', val: (r) => r.reach, ok: (r) => r.reach !== null && r.reachN >= 2, best: 'min', round: (v) => Math.round(v / 100) / 10 },
  { id: 'streak', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 2 },
  { id: 'safe', name: 'Más olas a salvo', unit: 'olas', val: (r) => r.safe, ok: (r) => r.safe >= 1 },
];
function finish(round, players) {
  const Party = require('./party');
  const rows = Object.entries(players).filter(([, p]) => p.esRound === round.id).map(([id, p]) => ({
    id, k: p.esIdx || 0, skin: p.esSkin, team: 'crew',
    name: p.name, avatar: p.avatar || '', turbos: p.esTurbos || 0, supers: p.esSupers || 0, best: p.esBest || 0,
    right: p.esRight || 0, safe: p.esSafe || 0, waves: p.esWaves || 0, zapped: p.esZapped || 0,
    reach: p.esReachN ? Math.round(p.esReachMs / p.esReachN) : null, reachN: p.esReachN || 0, gone: !!p.disconnected,
    escapes: p.esEscapes || 0, pzaps: p.esPZaps || 0,     // the chase pass: «¡por un pelo!» escapes, zaps on me
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
  const stars = Party.stars(pool, STARS);
  rows.forEach((r) => { r.stars = stars.filter((s) => s.winners.includes(r.k)).map((s) => s.id); });
  return { rank: rankOf(round.levelsCleared, round.hearts, round.route), route: round.route, levelsCleared: round.levelsCleared, hearts: round.hearts, escaped: round.escaped, zaps: round.zaps, turbos: round.turbos, rows, awards, stars };
}

// Teacher pause: every timer moves forward by the paused time.
function shiftTimers(round, players, ms) {
  ['phaseAt', 'phaseUntil', 'wakeAt', 'dazeUntil', 'dizzyUntil', 'lastZapAt', 'waveAt', 'waveUntil', 'sprintAt'].forEach((k) => { if (round[k]) round[k] += ms; });
  Object.values(round.pos).forEach((pos) => { pos.at += ms; });
  Object.values(players).forEach((p) => {
    if (p.esDizzyUntil) p.esDizzyUntil += ms;
    if (p.esEnter) p.esEnter.at += ms;
    if (p.esReach) p.esReach += ms;
    // the chase pass: my stun, shield, lunge and the 45 s of his broom wait too
    ['esStunUntil', 'esShieldUntil', 'esLungeAt', 'esLungeUntil'].forEach((k) => { if (p[k]) p[k] += ms; });
    if (p.esZapAt > 0) p.esZapAt += ms;
  });
}

module.exports = {
  R, paceFor, zoneSeconds, retimeRun, newRound, preparePlayer, kidsOn, robotSpeed, turboGain, answer, stepRun,
  chaseSpeed, chaseV, chaseReset, stepChase, chaseAnswer, chaseView,
  startZone, spawnPos, startWave, occupancy, resolveWave, afterZone, startRun, clearLevel, caught, skipZone, checkPos,
  rankOf, finish, shiftTimers, STARS,
};
