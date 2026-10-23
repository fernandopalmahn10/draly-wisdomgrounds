// «Draly Cangrejo · ¡Atrapa a Fénec!» (gameType 'teamcrab') — the rules, no sockets (server.js «ATRAPA A FÉNEC» block
// glues them to the room). #4 of his Mario Party series: Super Mario Party «Team Crab» (his video y9BKCVx_mNk,
// 7:30-8:16), turned around: the KIDS are the crew of a giant red robot crab on a Dubai beach, one claw with a wooden
// hammer each; FÉNEC, el ladrón de palabras (a fennec-fox cartoon burglar), runs along the dock. Crews of 3-4 (the deal
// of core/halcon.js); each crew = one crab, one Fénec, one Péndulo.
// v2 (his feedback 2026-10-23 after playing v1: "I tried to hit the little fox and it said that it escaped… it should
// feel like kids are controlling the crab… merit-based… make the crab so that it moves as well"; his rules «Skill
// decides, never luck» and «Two rhythms: pick the one that fits each game»): the game runs in ROUNDS of two windows.
//   · QUESTION WINDOW (~11 s): everyone answers quick-fire questions; each right answer = +1 hammer charge (max 4); a
//     wrong, late or blind answer = El Péndulo EATS one of my charges («¡Ñam!», he grows; right answers in a row shrink
//     him). Only a question really shown on a visible screen can run out and cost. The window's open questions are
//     withdrawn at its end, free.
//   · PLAY WINDOW (10 s, «¡A martillar!»): the answers decide the roles. The crew's best answerer of the window (most
//     right answers, then the fastest) is the CAPITÁN and STEERS the crab (it walks along the shore at a visible speed);
//     every kid with charges is a MARTILLERO: their claw rides on the crab within its reach, they aim it and slam (one
//     charge a slam, 0.35 s fall); kids with no charges watch and cheer. Fénec moves in a readable pattern (stands
//     still, crouches 0.3 s leaning the way he'll go, then runs 2 spots at a visible speed, away from the crab), NEVER
//     an instant dodge: a hammer that lands where he is at the impact is a BONK. Words fly back: +2 to the slammer, +1
//     «trampa» to every other armed claw that blocked him, +1 to the Capitán who drove them there.
//   · The last round is ×2 («¡Ronda final!»). The clock ends after a play window; a crew that got its target of words
//     back has CAUGHT him (latched), else he escapes and kicks the crab to pieces. Then each crew's ceremony.
//   · «🤖 Probar con robots» (teacher-only): robots sit in the crew and play like an average kid (70 % right, fair aim);
//     they are never in stars, the podium, the class ranking or any record.
// Every kid's numbers live in m.kids[k] (k = the server's stable id p.tcK), so a kid who left still counts at the end.
// Spec: docs/specs/atrapa-a-fenec.md. The server emits the events every function returns ({ t, b, … }).
'use strict';
const Party = require('./party');      // clockShift (the teacher's «−30 s»), stars
const Halcon = require('./halcon');    // boards of 4 (splitBoards), mulberry32, shuffle, pickOrder

const R = {
  DURATIONS: [120, 180, 240], DURATION: 120,
  INTRO_MS: 2600,            // «¡Atrapa a Fénec!» → «¡YA!» after the 3.5 s run-in countdown
  SPOTS: 5,                  // the dock: positions 0-4 (continuous)
  // the rounds: a question window, then «¡A martillar!» (roles), the play window, «¡Tiempo!» (the round's tally)
  ROUND_MS: 24500, QW_MIN: 8000, QW_MAX: 18000, PW_IN_MS: 1600, PW_MS: 10000, PW_OUT_MS: 1500,
  PW_EMPTY_MS: 1500,         // a play window where every claw is spent ends this soon after the last hammer lands
  Q_TIME_MS: 8000,           // a quick-fire question's time (it can't outlive its window: withdrawn free at the window's end)
  FAST_MS: 500,              // an answer sooner than this = a blind guess = wrong
  NEXT_Q_MS: 300, WRONG_WAIT_MS: 1300,
  CHARGES_MAX: 4,
  FALL_MS: 350, BACK_MS: 420,   // a slam's fall (shadow → slam) and the claw back up
  LAG_MAX: 250,              // a slam is judged where Fénec was on the slammer's screen: rewound by its round trip (ms, at most this)
  PW_MIN: 4000,              // the final round's play window may shrink to fit the clock, never under this
  HIT_R: 0.45,               // a hammer that lands within this many spots of Fénec's centre bonks him
  REACH: 1.0,                // a claw rides within this many spots of the crab's centre (the Capitán must drive him into reach)
  CRAB_SPEED: 4.2,           // spots per second (the Capitán steers; the crab walks at this speed at most)
  FEN_IDLE_MIN: 650, FEN_IDLE_MAX: 1350, FEN_CROUCH_MS: 300, FEN_RUN_SPEED: 3.2, FEN_RUN_N: 2, FEN_FLAT_MS: 1100, FEN_UP_MS: 400,
  WORDS_BONK: 2, ASSIST: 1, CAPTAIN: 1, TRAP_R: 0.75,   // (a «trampa» = another armed claw right beside him: it blocked his way)
  ROBOT_CREW: 4, ROBOT_HUMANS_MAX: 2,   // «🤖 Probar con robots» fills only a crew of 1-2 phones up to 4 (a real class gets none)
  ANGER_MAX: 5, CALM: 0.5,
  TARGET_PER_KID_MIN: 5.5,   // words a crew must get back per kid and minute (sim-tuned, test-teamcrab.js --sim: skilful crews catch him, random tappers don't)
  TARGET_MIN: 6,
  FINAL_MS: 2400,
  BOARD: 4, BOARD_MAX: 5,
  REACTS: ['wow', 'lol', 'clap', 'fire'], REACT_GAP_MS: 1200,
  AIM_GAP_MS: 40, STEER_GAP_MS: 40,
  TAUNT_GAP_MS: 3500,
  ROBOT: { ACC: 0.7, ANS_MIN: 1500, ANS_MAX: 3600, SLAM_MIN: 1100, SLAM_MAX: 2200, NOISE: 0.32 },
  // «1 contra 3» (his idea 2026-10-23): a kid is Fénec for a round; his own phone is the truth for where he is
  VS: {
    FALL_MS: 750,            // a hammer's shadow shows this long before it lands: a runner who reacts can always get away
    RUN_SPEED: 1.5,          // spots per second: out of one hammer in time, never out of two side by side without a dash
    DASH_X: 1.2, DASH_MS: 220, DASHES_MAX: 3,   // a dash = a quick burst out of a trap; 1 per right answer of the window, max 3
    STUN_MS: 1000,           // a hit stuns him briefly, it never ends the round
    SURVIVE: 1, UNTOUCHED: 3, HIT: 3,   // points: a second survived, a round untouched; a hit for its slammer
    LAND_WAIT: 450,          // after the impact the server waits this long (+ his round trip) for his phone's own verdict
    DOUBT: 0.15,             // without his phone's verdict the hit zone shrinks by this much: in doubt, the runner wins
    SPEED_SLACK: 1.5,        // his streamed moves may be this much faster than RUN_SPEED (frames, jitter) before they are clamped
    ROBOT_REACT_MIN: 250, ROBOT_REACT_MAX: 480,
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 60, 600);
const MAXX = R.SPOTS - 1;
const round2 = (v) => Math.round(v * 100) / 100;

function newGame(seed, durationS, now, words, mode) {
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration: clampDuration(durationS), mode: mode === 'vs' ? 'vs' : 'crew', slamSeq: 0,
    phase: 'countdown', phaseAt: now, phaseUntil: now, endsAt: 0, frenzy: false,
    paused: false, pausedAt: 0, boards: [], kids: {}, nextBoard: 1, qn: 0, words: (words || []).slice(0, 60),
    round: null,
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const inGame = (m, k) => !!kid(m, k);
const boardOf = (m, id) => (m ? m.boards.find((b) => b.id === id) || null : null);
const rnd = (m, a, b) => a + m.rng() * (b - a);

function newKid(k, name, skin, b, code, robot) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b, code: code ? String(code) : '', robot: !!robot,
    charges: 0, rightQW: 0, timeQW: 0, firstQW: 0, words: 0, bonks: 0, assists: 0, capBonks: 0, captained: 0,
    slams: 0, misses: 0, right: 0, wrong: 0, late: 0, fast: 0, answered: 0, eaten: 0, streak: 0, best: 0,
    awaySince: 0, lastReact: 0, q: null, qNextAt: 0, order: [], qi: 0, lastAim: 0, lastSteer: 0,
    claw: { st: 'idle', off: 0, x: 2, fallX: 2, impactAt: 0, readyAt: 0 }, bot: { ansAt: 0, nextAt: 0, steerAt: 0 },
    ran: false, runs: 0, survived: 0, runPts: 0, hitsTaken: 0, dashes: 0, rtt: 0,
  };
}
function targetFor(n, minutes) { return Math.max(R.TARGET_MIN, Math.round(R.TARGET_PER_KID_MIN * Math.max(1, n) * minutes)); }
function addBoard(m) {
  const b = {
    id: m.nextBoard++, seats: [], words: 0, target: 0, full: false, bonks: 0, roundBonks: 0, anger: 0, lastOk: null,
    captain: null, crab: { x: MAXX / 2, tx: MAXX / 2, sentX: MAXX / 2, sentAt: 0 }, lastTaunt: 0,
    fx: { x: MAXX / 2, mode: 'idle', t0: 0, t1: 0, x0: MAXX / 2, x1: MAXX / 2, dir: 1 }, fhist: [],
    runner: null, rx: MAXX / 2, rxAt: 0, rxSent: MAXX / 2, rxSentAt: 0, stunUntil: 0, stunMs: 0, hitsRound: 0, dashUntil: 0, runFrom: 0,
  };
  m.boards.push(b);
  return b;
}
function seatIn(m, b, k, name, skin, code, robot) {
  m.kids[k] = newKid(k, name, skin, b.id, code, robot);
  b.seats.push(k);
  return m.kids[k];
}
const humans = (m, b) => b.seats.filter((k) => !(kid(m, k) || {}).robot).length;
// The start: crews of 4 (3 when it doesn't divide; ≤ 5 kids = one crew). entries: [[k, name, skin, code, robot]]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin, code, robot]) => { byK[k] = [name, skin, code, robot]; });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addBoard(m);
    ks.forEach((k) => seatIn(m, b, k, byK[k][0], byK[k][1], byK[k][2], byK[k][3]));
    b.target = targetFor(b.seats.length, m.duration / 60);
  });
  return m.boards;
}
function seatLate(m, k, name, skin, code, now) {
  if (inGame(m, k)) return null;
  const open = m.boards.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(m);
  seatIn(m, b, k, name, skin, code, false);
  const left = m.phase === 'play' && m.endsAt ? Math.max(0, m.endsAt - (now || Date.now())) / 60000 : m.duration / 60;
  b.target = b.seats.length === 1 ? targetFor(1, left) : b.target + Math.round(R.TARGET_PER_KID_MIN * left);
  return b;
}
// «🤖 Probar con robots»: a robot crewmate sits in the smallest crew (the teacher's own, when he plays with one phone);
// it counts for the crew's target like a kid (it brings words back too). Only for a teacher trying alone: it fills a crew of
// 1-2 phones up to 4 seats; a crew of 3+ kids (a real class, even with the robots left on) gets none
function seatRobot(m, k, name, skin) {
  if (inGame(m, k)) return null;
  const people = (b) => b.seats.filter((x) => !(kid(m, x) || {}).robot).length;
  const open = m.boards.filter((b) => b.seats.length < R.ROBOT_CREW && people(b) >= 1 && people(b) <= R.ROBOT_HUMANS_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0];
  if (!b) return null;                                   // (no room: a robot never opens a crew of its own)
  seatIn(m, b, k, name, skin, '', true);
  b.target = targetFor(b.seats.length, m.duration / 60);
  return b;
}
function byCode(m, code, online) {
  if (!code) return null;
  const r = Object.values(m.kids).find((x) => x.code && x.code === String(code));
  return r && !(online && online(r.k)) ? r : null;
}

// ---------- Fénec: a readable pattern (stands, crouches leaning the way he'll go, runs 2 spots), never a dodge ----------
function fxAt(f, t) {
  if (f.mode !== 'run') return f.x;
  const p = f.t1 > f.t0 ? clamp((t - f.t0) / (f.t1 - f.t0), 0, 1) : 1;
  return f.x0 + (f.x1 - f.x0) * p;
}
// the last steps of his plan: a slam is judged at the moment the slammer saw (impact − its round trip)
function fenSnap(b) { const f = b.fx; b.fhist.push({ mode: f.mode, x: f.x, x0: f.x0, x1: f.x1, t0: f.t0, t1: f.t1 }); if (b.fhist.length > 10) b.fhist.shift(); }
function fenAt(b, t) {
  let seg = null;
  for (let i = b.fhist.length - 1; i >= 0; i--) if (b.fhist[i].t0 <= t) { seg = b.fhist[i]; break; }
  seg = seg || b.fhist[0] || b.fx;
  return { mode: seg.mode, x: fxAt(seg, t) };
}
const fenView = (f, now) => ({ mode: f.mode, x: round2(fxAt(f, now)), x0: round2(f.x0), x1: round2(f.x1), dir: f.dir, ms: Math.max(0, f.t1 - now), dur: Math.max(0, f.t1 - f.t0) });
function fenEv(b, now) { return Object.assign({ t: 'fen', b: b.id }, fenView(b.fx, now)); }
// where he goes next: away from the crab (2 spots; at the edge he has to come back past it)
function fenPlan(m, b, now) {
  const f = b.fx;
  let dir = f.x >= b.crab.x ? 1 : -1;
  if (Math.abs(f.x - b.crab.x) < 0.25) dir = m.rng() < 0.5 ? -1 : 1;
  if ((dir > 0 && f.x >= MAXX - 0.05) || (dir < 0 && f.x <= 0.05)) dir = -dir;
  const x1 = clamp(Math.round(f.x) + dir * R.FEN_RUN_N, 0, MAXX);
  f.dir = x1 >= f.x ? 1 : -1;
  f.x0 = f.x; f.x1 = x1;
  f.mode = 'crouch'; f.t0 = now; f.t1 = now + R.FEN_CROUCH_MS;
  fenSnap(b);
}
function fenTick(m, b, now, ev) {
  const f = b.fx;
  if (now < f.t1) return;
  if (f.mode === 'idle') { fenPlan(m, b, now); ev.push(fenEv(b, now)); return; }
  if (f.mode === 'crouch') {
    f.mode = 'run'; f.t0 = now; f.t1 = now + Math.max(120, (Math.abs(f.x1 - f.x0) / R.FEN_RUN_SPEED) * 1000);
    fenSnap(b);
    ev.push(fenEv(b, now));
    return;
  }
  if (f.mode === 'run') { f.x = f.x1; f.mode = 'idle'; f.t0 = now; f.t1 = now + rnd(m, R.FEN_IDLE_MIN, R.FEN_IDLE_MAX); fenSnap(b); ev.push(fenEv(b, now)); if (m.rng() < 0.3) taunt(b, now, ev, 'idle'); return; }
  if (f.mode === 'flat') { f.mode = 'up'; f.t0 = now; f.t1 = now + R.FEN_UP_MS; fenSnap(b); ev.push(fenEv(b, now)); taunt(b, now, ev, 'up', true); return; }
  if (f.mode === 'up') { f.mode = 'idle'; f.t0 = now; f.t1 = now + rnd(m, R.FEN_IDLE_MIN, R.FEN_IDLE_MAX) * 0.7; fenSnap(b); ev.push(fenEv(b, now)); }
}
function taunt(b, now, ev, line, force) {
  if (!force && now - b.lastTaunt < R.TAUNT_GAP_MS) return;
  b.lastTaunt = now;
  ev.push({ t: 'taunt', b: b.id, line });
}

// ---------- the clock and the rounds ----------
const FIXED = () => R.PW_IN_MS + R.PW_MS + R.PW_OUT_MS;
function startPlay(m, now) {
  m.phase = 'play';
  m.phaseAt = now;
  m.endsAt = now + m.duration * 1000;
  m.phaseUntil = m.endsAt;
  m.frenzy = false;
  m.round = { n: 0, phase: 'none', at: now, until: now, total: 0, final: false };
  m.boards.forEach((b) => { b.fx.x = b.fx.x0 = b.fx.x1 = MAXX / 2; b.fx.mode = 'idle'; b.fx.t0 = now; b.fx.t1 = now + 900; b.fhist = []; fenSnap(b); });
  const ev = [];
  nextRound(m, now, ev);
  return ev;
}
// a new question window, as long as the time left allows (the clock ends after a play window)
// (the schedule of a question window opening now: its length, whether it is the final round, its play window)
function plan(m, now) {
  const left = m.endsAt - now;
  const roundsLeft = Math.max(1, Math.round(left / R.ROUND_MS));
  if (roundsLeft > 1) return { qw: clamp(left / roundsLeft - FIXED(), R.QW_MIN, R.QW_MAX), final: false, roundsLeft, pw: R.PW_MS };
  const qw = clamp(left - FIXED(), 3000, R.QW_MAX + 6000);
  return { qw, final: true, roundsLeft: 1, pw: clamp(left - qw - R.PW_IN_MS - R.PW_OUT_MS, R.PW_MIN, R.PW_MS) };
}
function setFinal(m, r, fin, now, ev) {
  r.final = fin;
  if (fin && !m.frenzy) { m.frenzy = true; ev.push({ t: 'frenzy', endsMs: Math.max(0, m.endsAt - now) }); }
  else if (!fin && m.frenzy) { m.frenzy = false; ev.push({ t: 'frenzy', off: true, endsMs: Math.max(0, m.endsAt - now) }); }
}
function nextRound(m, now, ev) {
  const left = m.endsAt - now;
  const MIN_ROUND = 3000 + R.PW_IN_MS + R.PW_MIN + R.PW_OUT_MS;
  if (left < MIN_ROUND && (m.frenzy || left < 6000)) { ev.push.apply(ev, final(m, now)); return; }
  const p = left < MIN_ROUND ? { qw: 1200, final: true, roundsLeft: 1, pw: R.PW_MIN } : plan(m, now);   // (a «−30 s» left no room: a short final round on the charges kept, a few s past 0:00)
  const qw = p.qw;
  const r = m.round;
  r.n++; r.phase = 'qw'; r.at = now; r.until = now + qw; r.total = r.n + p.roundsLeft - 1; r.pwMs = p.pw;
  setFinal(m, r, p.final, now, ev);
  Object.values(m.kids).forEach((k) => { k.rightQW = 0; k.timeQW = 0; k.firstQW = 0; k.role = null; k.qNextAt = now + 250; if (k.claw.st !== 'idle') { k.claw.st = 'idle'; } });
  m.boards.forEach((b) => { b.captain = null; b.roundBonks = 0; b.crab.tx = b.crab.x; });
  ev.push({ t: 'round', phase: 'qw', n: r.n, total: r.total, final: r.final, ms: qw });
}
// the crew's best answerer of this window (most right, then the faster total time, the earlier first right, the seat)
function leader(m, b, except) {
  const cands = b.seats.map((k) => kid(m, k)).filter((x) => x && x.rightQW > 0 && x.k !== except);
  cands.sort((a, c) => c.rightQW - a.rightQW || a.timeQW - c.timeQW || a.firstQW - c.firstQW || a.k - c.k);
  return cands.length ? cands[0].k : null;
}
// the question window closes: open questions are withdrawn (free), the roles are decided, «¡A martillar!»
function toPlayIn(m, now, ev, o) {
  const r = m.round;
  r.phase = 'pwin'; r.at = now; r.until = now + R.PW_IN_MS;
  Object.values(m.kids).forEach((k) => { if (k.q) { k.q = null; ev.push({ t: 'qx', b: k.b, k: k.k }); } });
  m.boards.forEach((b) => {
    const run = vsRunner(m, b, now, o && o.online);
    b.captain = leader(m, b, run ? run.k : null);
    b.seats.forEach((k) => { const x = kid(m, k); if (x) x.role = run && k === run.k ? 'runner' : k === b.captain ? 'cap' : x.charges > 0 ? 'mart' : 'watch'; });
    if (b.captain != null) kid(m, b.captain).captained++;
    // the martilleros' claws spread across the crab's reach (the Capitán's in the middle)
    const mart = b.seats.map((k) => kid(m, k)).filter((x) => x && x.charges > 0 && (!run || x.k !== run.k));
    const offs = [-0.9, 0.9, -0.35, 0.35, 0].map((v) => v * R.REACH);
    let i = 0;
    mart.forEach((x) => {
      x.claw.st = 'armed';
      x.claw.off = x.k === b.captain ? 0 : offs[i++ % offs.length];
      x.claw.x = clamp(b.crab.x + x.claw.off, 0, MAXX);
      x.claw.readyAt = now + R.PW_IN_MS;
    });
    ev.push(Object.assign({ t: 'roles', b: b.id, captain: b.captain, mart: mart.map((x) => ({ k: x.k, charges: x.charges, off: x.claw.off })), crab: round2(b.crab.x) },
      run ? { runner: run.k, dashes: run.dashes, rx: round2(b.rx), n: run.runs } : {}));
  });
  ev.push({ t: 'round', phase: 'pwin', n: r.n, total: r.total, final: r.final, ms: R.PW_IN_MS });
}
function toPlay(m, now, ev) {
  const r = m.round;
  r.phase = 'pw'; r.at = now; r.until = now + (r.pwMs || R.PW_MS); r.pwEnd = r.until;
  m.boards.forEach((b) => { if (b.runner != null) b.rxAt = now; });   // (his speed is measured from «¡YA!»)
  // («Saltar» in «¡A martillar!»: the claws are ready at once)
  Object.values(m.kids).forEach((x) => { if (x.claw.st === 'armed' && x.claw.readyAt > now) x.claw.readyAt = now; });
  ev.push({ t: 'round', phase: 'pw', n: r.n, total: r.total, final: r.final, ms: r.until - now });
}
function toPlayOut(m, now, ev) {
  const r = m.round;
  // (a hammer still in the air lands at its own time: the tick lands it, then it goes up)
  Object.values(m.kids).forEach((x) => { if (x.claw.st === 'armed' || x.claw.st === 'back') x.claw.st = 'idle'; });
  // (a window that ends early because every hammer is spent: the runner is credited the rest of it)
  m.boards.forEach((b) => runEnd(m, b, now, ev, Math.max(now, r.pwEnd || now)));
  r.phase = 'pwout'; r.at = now; r.until = now + R.PW_OUT_MS;
  ev.push({ t: 'round', phase: 'pwout', n: r.n, total: r.total, final: r.final, ms: R.PW_OUT_MS, tally: m.boards.map((b) => ({ b: b.id, bonks: b.roundBonks, words: b.words })) });
}
function addTime(m, ms, now, ev) {
  if (m.phase !== 'play') return 0;
  const d = Party.clockShift(m.endsAt, ms, now);
  if (!d) return 0;
  m.endsAt += d;
  m.phaseUntil = m.endsAt;
  if (d > 0) m.duration += d / 1000;
  // the crews that haven't emptied the sack get a target for the new length
  const plan = (m.endsAt - m.phaseAt) / 60000, was = plan - d / 60000;
  if (was > 0) m.boards.forEach((b) => { if (!b.full && b.target) b.target = Math.max(R.TARGET_MIN, Math.round(b.target * plan / was)); });
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
    const p = left < 3000 + R.PW_IN_MS + R.PW_MIN + R.PW_OUT_MS ? { qw: 1500, final: true, roundsLeft: 1, pw: R.PW_MIN } : plan(m, r.at);
    r.until = Math.max(now + 1500, r.at + p.qw);
    r.total = r.n + p.roundsLeft - 1;
    r.pwMs = p.final ? clamp(m.endsAt - r.until - R.PW_IN_MS - R.PW_OUT_MS, R.PW_MIN, R.PW_MS) : p.pw;
    setFinal(m, r, p.final, now, ev);
    ev.push({ t: 'round', phase: 'qw', n: r.n, total: r.total, final: r.final, ms: r.until - now });
  } else if (r.phase === 'pwin' || r.phase === 'pw' || r.phase === 'pwout') {
    let changed = false;
    if (r.phase === 'pwin') { const pw = clamp(m.endsAt - r.until - R.PW_OUT_MS, R.PW_MIN, R.PW_MS); if (pw < (r.pwMs || R.PW_MS)) { r.pwMs = pw; changed = true; } }
    if (r.phase === 'pw') { const cap = Math.max(now + 1500, m.endsAt - R.PW_OUT_MS); if (r.until > cap) { r.until = cap; changed = true; } }
    // no room for another full round after this one: this one is the final round ×2 (from now)
    const roundEnd = r.phase === 'pwin' ? r.until + (r.pwMs || R.PW_MS) + R.PW_OUT_MS : r.phase === 'pw' ? r.until + R.PW_OUT_MS : r.until;
    const fin = m.endsAt - roundEnd < 3000 + R.PW_IN_MS + R.PW_MIN + R.PW_OUT_MS;
    if (r.phase !== 'pwout' && fin !== !!r.final) { setFinal(m, r, fin, now, ev); r.total = r.n; changed = true; }
    if (changed) ev.push({ t: 'round', phase: r.phase, n: r.n, total: r.total, final: r.final, ms: Math.max(0, r.until - now) });
  }
}
// the teacher paused for `ms`: every pending moment moves by that much
function shiftTimes(m, ms) {
  m.phaseAt += ms; m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.round) { m.round.at += ms; m.round.until += ms; }
  m.lastTick = 0;
  m.boards.forEach((b) => { const f = b.fx; f.t0 += ms; f.t1 += ms; b.fhist.forEach((h) => { h.t0 += ms; h.t1 += ms; }); if (b.crab.sentAt) b.crab.sentAt += ms; });
  Object.values(m.kids).forEach((r) => {
    if (r.awaySince) r.awaySince += ms;
    if (r.qNextAt) r.qNextAt += ms;
    if (r.q && r.q.until) r.q.until += ms;
    if (r.q && r.q.sentAt) r.q.sentAt += ms;
    if (r.firstQW) r.firstQW += ms;
    if (r.claw.impactAt) r.claw.impactAt += ms;
    if (r.claw.readyAt) r.claw.readyAt += ms;
    if (r.bot.ansAt) r.bot.ansAt += ms;
    if (r.bot.nextAt) r.bot.nextAt += ms;
    if (r.bot.steerAt) r.bot.steerAt += ms;
  });
}

// ---------- questions ----------
function nextQ(m, h, questions, imageFor, now, cap) {
  if (!h.order.length || h.qi >= h.order.length) { h.order = Halcon.pickOrder(questions, m.rng); h.qi = 0; }
  if (!h.order.length) return null;
  const src = questions[h.order[h.qi++]];
  if (!src) return null;
  const answers = Halcon.shuffle([src.correct].concat(src.answers.filter((a) => a !== src.correct)).slice(0, 4).map(String), m.rng);
  m.qn++;
  return {
    qid: `tc${m.id % 100000}-${h.k}-${m.qn}`, text: String(src.text), answers, correctIdx: answers.indexOf(String(src.correct)),
    image: imageFor ? imageFor(src) || null : null, sentAt: now, until: Math.min(now + R.Q_TIME_MS, cap || Infinity),
  };
}
const qPublic = (q) => (q ? { qid: q.qid, text: q.text, answers: q.answers, image: q.image } : null);

// a miss of mine (wrong / late / blind): El Péndulo eats one of my charges (he grows); nobody is named on the crew
function eat(m, b, r, now, ev, why) {
  r.qNextAt = now + R.WRONG_WAIT_MS;
  r.eaten++;
  const had = r.charges;
  if (r.charges > 0) r.charges--;
  b.lastOk = false;
  b.anger = Math.min(R.ANGER_MAX, b.anger + 1);
  ev.push({ t: 'eat', b: b.id, anger: b.anger, why, ate: had > r.charges });            // (to the crew: never who)
  ev.push({ t: 'mine', b: b.id, k: r.k, charges: r.charges, ate: had > r.charges, rightQW: r.rightQW });   // (to me)
}
// A quiz answer. Right = +1 charge (max 4); wrong / blind = El Péndulo eats a charge. → { ok, right, ev }
function answer(m, k, qid, idx, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || !r.q || !m.round || m.round.phase !== 'qw') return { ok: false, why: 'closed', ev: [] };
  if (r.q.qid !== qid) return { ok: false, why: 'stale', ev: [] };
  if (!Number.isInteger(idx) || idx < 0 || idx >= r.q.answers.length) return { ok: false, why: 'bad', ev: [] };
  const q = r.q;
  r.q = null;
  r.answered++;
  const tooFast = now - q.sentAt < R.FAST_MS;
  const ok = idx === q.correctIdx && !tooFast;
  const b = boardOf(m, r.b);
  const ev = [];
  if (ok) {
    r.right++; r.streak++; r.best = Math.max(r.best, r.streak);
    r.rightQW++; r.timeQW += now - q.sentAt; if (!r.firstQW) r.firstQW = now;
    const had = r.charges;
    r.charges = Math.min(R.CHARGES_MAX, r.charges + 1);
    r.qNextAt = now + R.NEXT_Q_MS;
    ev.push({ t: 'qr', b: r.b, k, qid: q.qid, idx, ok: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: r.streak, charges: r.charges, gained: r.charges - had });
    if (b) {
      ev.push({ t: 'race', b: b.id, k, rightQW: r.rightQW, lead: leader(m, b) });                    // (the Capitán race: rights only, never charges: a drop would tell who missed)
      if (b.lastOk && b.anger > 0) { b.anger = Math.max(0, b.anger - R.CALM); ev.push({ t: 'calm', b: b.id, anger: b.anger }); }
      b.lastOk = true;
    }
  } else {
    r.wrong++; r.streak = 0;
    if (tooFast) r.fast++;
    ev.push({ t: 'qr', b: r.b, k, qid: q.qid, idx, ok: false, tooFast, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: 0, charges: Math.max(0, r.charges - 1), waitMs: R.WRONG_WAIT_MS });
    if (b) eat(m, b, r, now, ev, tooFast ? 'fast' : 'wrong');
  }
  return { ok: true, right: ok, ev };
}
function seen(m, k, qid) {
  const r = kid(m, k);
  if (!r || !r.q || r.q.qid !== qid) return false;
  r.q.seen = true;
  return true;
}
function late(m, r, now) {
  const q = r.q;
  r.q = null;
  r.answered++; r.wrong++; r.late++; r.streak = 0;
  const ev = [{ t: 'qr', b: r.b, k: r.k, qid: q.qid, idx: -1, ok: false, late: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: 0, charges: Math.max(0, r.charges - 1), waitMs: R.WRONG_WAIT_MS }];
  const b = boardOf(m, r.b);
  if (b) eat(m, b, r, now, ev, 'late');
  return ev;
}

// ---------- the play window: steer, aim, slam ----------
const playing = (m) => m.phase === 'play' && !m.paused && m.round && m.round.phase === 'pw';
// the Capitán drags the crab toward x (it walks there at CRAB_SPEED)
function steer(m, k, x, now) {
  const r = kid(m, k);
  if (!r || !playing(m)) return null;
  const b = boardOf(m, r.b);
  if (!b || b.captain !== k || !Number.isFinite(Number(x))) return null;
  if (now - r.lastSteer < R.STEER_GAP_MS) return null;
  r.lastSteer = now;
  b.crab.tx = clamp(Number(x) || 0, 0, MAXX);
  return { b: b.id, k, tx: round2(b.crab.tx) };
}
// a martillero moves their claw (x on the dock, kept within the crab's reach)
function aim(m, k, x, now) {
  const r = kid(m, k);
  if (!r || !m.round || (m.round.phase !== 'pw' && m.round.phase !== 'pwin') || m.paused) return null;
  const b = boardOf(m, r.b);
  if (!b || (r.claw.st !== 'armed' && r.claw.st !== 'back') || !Number.isFinite(Number(x))) return null;
  if (now - r.lastAim < R.AIM_GAP_MS) return null;
  r.lastAim = now;
  r.claw.off = clamp((Number(x) || 0) - b.crab.x, -R.REACH, R.REACH);
  r.claw.x = clamp(b.crab.x + r.claw.off, 0, MAXX);
  return { b: b.id, k, off: round2(r.claw.off), x: round2(r.claw.x) };
}
// SLAM: the hammer falls where my claw is now (at x when given: aimed there first), one charge
function slam(m, k, x, now, lag) {
  const r = kid(m, k);
  if (!r || !playing(m)) return { ok: false, why: 'closed', ev: [] };
  const b = boardOf(m, r.b);
  if (!b) return { ok: false, why: 'closed', ev: [] };
  if (r.charges <= 0 || r.claw.st === 'idle') return { ok: false, why: 'empty', ev: [] };
  if (r.claw.st !== 'armed' || now < r.claw.readyAt) return { ok: false, why: 'wait', ev: [] };
  if (x != null && Number.isFinite(Number(x))) { r.claw.off = clamp(Number(x) - b.crab.x, -R.REACH, R.REACH); }
  r.claw.x = clamp(b.crab.x + r.claw.off, 0, MAXX);
  r.charges--;
  r.slams++;
  r.claw.st = 'fall';
  r.claw.fallX = round2(r.claw.x);   // (the spot every screen gets: the runner's phone judges this same number)
  const fall = b.runner != null ? R.VS.FALL_MS : R.FALL_MS;
  r.claw.impactAt = now + fall;
  r.claw.lag = clamp(Number(lag) || 0, 0, R.LAG_MAX);
  r.claw.sid = ++m.slamSeq;
  r.claw.landX = null; r.claw.far = 0;
  return { ok: true, ev: [{ t: 'slam', b: b.id, k, x: round2(r.claw.fallX), ms: fall, charges: r.charges, sid: r.claw.sid }] };
}
// the impact: Fénec within HIT_R of the hammer (and not lying flat already) = a BONK
function impact(m, b, r, now, ev) {
  const c = r.claw;
  const t = c.impactAt - (c.lag || 0);              // (the moment the slammer saw: its screen draws his plan one trip late)
  const f = b.fx;
  const seen = fenAt(b, t);
  const fx = seen.x;
  c.st = 'back';
  c.readyAt = now + R.BACK_MS;
  const hit = seen.mode !== 'flat' && seen.mode !== 'up' && f.mode !== 'flat' && Math.abs(fx - c.fallX) <= R.HIT_R;
  if (!hit) {
    r.misses++;
    ev.push({ t: 'impact', b: b.id, k: r.k, x: round2(c.fallX), hit: false, fx: round2(fx) });
    taunt(b, now, ev, m.rng() < 0.5 ? 'miss' : 'miss2');
    return;
  }
  const mult = m.round && m.round.final ? 2 : 1;
  const pts = R.WORDS_BONK * mult;
  const assists = [];
  b.seats.forEach((k) => {
    const o = kid(m, k);
    if (!o || o === r || o.k === b.captain) return;
    if ((o.claw.st === 'armed' || o.claw.st === 'fall') && Math.abs((o.claw.st === 'fall' ? o.claw.fallX : o.claw.x) - fx) <= R.TRAP_R) { o.assists++; o.words += R.ASSIST; assists.push(o.k); }
  });
  let cap = null;
  if (b.captain != null && b.captain !== r.k) { const o = kid(m, b.captain); if (o) { o.words += R.CAPTAIN; o.capBonks++; cap = o.k; } }
  else if (b.captain === r.k) r.capBonks++;
  r.bonks++; r.words += pts;
  b.bonks++; b.roundBonks++;
  const before = b.words;
  b.words += pts + assists.length * R.ASSIST + (cap != null ? R.CAPTAIN : 0);
  f.x = fx; f.x0 = fx; f.x1 = fx; f.mode = 'flat'; f.t0 = now; f.t1 = now + R.FEN_FLAT_MS;
  fenSnap(b);
  ev.push({ t: 'bonk', b: b.id, k: r.k, x: round2(fx), pts, assists, cap, words: b.words, target: b.target, flying: pickWords(m, pts + assists.length + (cap != null ? 1 : 0)), ms: R.FEN_FLAT_MS, x2: mult > 1, n: b.bonks });
  if (!b.full && before < b.target && b.words >= b.target) { b.full = true; ev.push({ t: 'full', b: b.id, words: b.words, target: b.target }); }
}
function pickWords(m, n) {
  const list = m.words || [];
  if (!list.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(n, 6); i++) out.push(list[Math.floor(m.rng() * list.length)]);
  return out;
}
function react(m, k, e, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || !R.REACTS.includes(e) || (r.lastReact && now - r.lastReact < R.REACT_GAP_MS)) return null;
  r.lastReact = now;
  return { b: r.b, k, e };
}

// ---------- the robots (teacher-only «🤖 Probar con robots»): an average kid, fair aim ----------
function robotTick(m, b, r, now, ev) {
  const B = R.ROBOT, bt = r.bot, rd = m.round;
  if (!rd) return;
  if (rd.phase === 'qw' && r.q) {
    if (!bt.ansAt || bt.ansFor !== r.q.qid) { bt.ansFor = r.q.qid; bt.ansAt = now + rnd(m, B.ANS_MIN, B.ANS_MAX); }
    else if (now >= bt.ansAt) {
      const q = r.q;
      const idx = m.rng() < B.ACC ? q.correctIdx : (q.correctIdx + 1 + Math.floor(m.rng() * (q.answers.length - 1))) % q.answers.length;
      ev.push.apply(ev, answer(m, r.k, q.qid, idx, now).ev);
    }
    return;
  }
  if (rd.phase !== 'pw') return;
  if (b.runner === r.k) return;                      // (a robot runner moves in robotRun)
  const f = b.fx;
  const goal = b.runner != null ? b.rx : fxAt(f, now);      // (an average kid taps where Fénec IS, not where he will land: fair, not perfect)
  if (b.captain === r.k && now >= bt.steerAt) { bt.steerAt = now + 350; b.crab.tx = clamp(goal + (m.rng() - 0.5) * 0.6, 0, MAXX); }
  if (r.claw.st === 'armed' && now >= r.claw.readyAt) {
    if (!bt.nextAt) bt.nextAt = now + rnd(m, B.SLAM_MIN, B.SLAM_MAX);
    if (now >= bt.nextAt) {
      bt.nextAt = 0;
      const want = goal + (m.rng() - 0.5) * 2 * B.NOISE;
      const res = slam(m, r.k, want, now);
      if (res.ok) ev.push.apply(ev, res.ev);
    }
  }
}

// ---------- «1 contra 3»: a kid is Fénec for a round (his own phone is the truth for where he is) ----------
// the runner of this round: the board's best answerer of the window who hasn't run yet (when everyone has, a new turn);
// a board of one kid keeps the computer Fénec
function vsRunner(m, b, now, online) {
  b.runner = null;
  if (m.mode !== 'vs' || b.seats.length < 2) return null;
  const on = (x) => x.robot || !online || online(x.k);
  let pool = b.seats.map((k) => kid(m, k)).filter((x) => x && !x.ran && on(x));
  if (!pool.length) { b.seats.forEach((k) => { const x = kid(m, k); if (x) x.ran = false; }); pool = b.seats.map((k) => kid(m, k)).filter((x) => x && on(x)); }
  if (!pool.length) return null;
  pool.sort((a, c) => c.rightQW - a.rightQW || a.timeQW - c.timeQW || (a.firstQW || Infinity) - (c.firstQW || Infinity) || a.k - c.k);
  const r = pool[0];
  r.ran = true; r.runs++;
  r.dashes = Math.min(R.VS.DASHES_MAX, r.charges);   // (his right answers of the window became dashes)
  r.charges -= r.dashes;
  r.claw.st = 'idle';
  b.runner = r.k;
  b.rx = b.rxSent = b.crab.x <= MAXX / 2 ? MAXX - 0.7 : 0.7; b.rxAt = now;   // (he starts across the dock from the crab)
  b.stunUntil = 0; b.stunMs = 0; b.hitsRound = 0; b.dashUntil = 0; b.runFrom = now + R.PW_IN_MS;
  const f = b.fx;
  f.x = f.x0 = f.x1 = b.rx; f.mode = 'idle'; f.t0 = now; f.t1 = now + 60000;
  fenSnap(b);
  return r;
}
// «¡Tiempo!» (or «¡FINAL!»): the runner banks a point a second he was on his feet, +3 for a round untouched (×2 in the final round)
function runEnd(m, b, now, ev, end) {
  if (b.runner == null) return;
  const r = kid(m, b.runner);
  b.runner = null;
  if (!r) return;
  const mult = m.round && m.round.final ? 2 : 1;
  const ms = Math.max(0, (end || now) - b.runFrom - b.stunMs);
  const secs = Math.floor(ms / 1000);
  const untouched = b.hitsRound === 0;
  const pts = (secs * R.VS.SURVIVE + (untouched ? R.VS.UNTOUCHED : 0)) * mult;
  r.survived += ms; r.runPts += pts; r.words += pts;
  r.charges = Math.min(R.CHARGES_MAX, r.charges + r.dashes); r.dashes = 0;   // (dashes he didn't use are charges again)
  ev.push({ t: 'runend', b: b.id, k: r.k, secs, untouched, pts, words: r.words, x2: mult > 1, charges: r.charges, hits: b.hitsRound });
  const f = b.fx;
  f.x = f.x0 = f.x1 = b.rx; f.mode = 'idle'; f.t0 = now; f.t1 = now + 900;
  fenSnap(b);
}
// his phone streams where he is (~14 a second); moves faster than he can run are clamped (a dash allows its burst)
function runnerPos(m, k, x, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || !m.round || (m.round.phase !== 'pw' && m.round.phase !== 'pwin')) return null;
  const b = boardOf(m, r.b);
  if (!b || b.runner !== k || !Number.isFinite(Number(x))) return null;
  if (now < b.stunUntil || m.round.phase === 'pwin') { b.rxAt = now; return null; }   // (stunned, or not yet: he waits for «¡YA!»)
  const dt = clamp(now - (b.rxAt || now), 16, 300);
  const max = (R.VS.RUN_SPEED * R.VS.SPEED_SLACK * dt) / 1000 + (now < b.dashUntil ? R.VS.DASH_X : 0) + 0.08;
  const want = clamp(Number(x), 0, MAXX);
  b.rx = clamp(b.rx + clamp(want - b.rx, -max, max), 0, MAXX);
  b.rxAt = now;
  b.fx.x = b.fx.x0 = b.fx.x1 = b.rx;
  vsFar(m, b, now);
  if (Math.abs(b.rx - b.rxSent) < 0.02 && now - b.rxSentAt < 400) return null;
  b.rxSent = b.rx; b.rxSentAt = now;
  return { b: b.id, k, x: round2(b.rx) };
}
// a dash: one of his dashes, a quick burst (his phone moves him; the server allows the burst and tells the crew)
function runnerDash(m, k, dir, now) {
  const r = kid(m, k);
  if (!r || !playing(m)) return null;
  const b = boardOf(m, r.b);
  if (!b || b.runner !== k || r.dashes <= 0 || now < b.stunUntil) return null;
  r.dashes--;
  b.dashUntil = now + R.VS.DASH_MS + 400;
  return { b: b.id, k, dir: Number(dir) < 0 ? -1 : 1, dashes: r.dashes };
}
// his phone's own verdict: where he was when THAT hammer landed on HIS screen
function runnerLand(m, k, sid, x, now, ev) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play') return false;
  const b = boardOf(m, r.b);
  if (!b || b.runner !== k || !Number.isFinite(Number(x))) return false;
  const c = b.seats.map((j) => kid(m, j)).find((o) => o && (o.claw.st === 'fall' || o.claw.st === 'wait') && o.claw.sid === Number(sid));
  if (!c) return false;
  // (his report must agree with his stream: never farther from it than he could have run since)
  const since = Math.max(0, now - c.claw.impactAt) + 300;
  const slack = (R.VS.RUN_SPEED * R.VS.SPEED_SLACK * since) / 1000 + (now < b.dashUntil + 300 ? R.VS.DASH_X : 0) + 0.25;
  c.claw.landX = clamp(Number(x), b.rx - slack, b.rx + slack);
  if (c.claw.st === 'wait' || now >= c.claw.impactAt) vsJudge(m, b, c, now, ev);
  return true;
}
// the hammer has landed on the server's clock: a robot runner (or one whose phone is gone) is judged now, a kid's own
// phone gets its round trip + LAND_WAIT to say where he was
function vsLand(m, b, r, now, ev, o) {
  const run = kid(m, b.runner);
  const c = r.claw;
  const away = !run || run.robot || (o && o.online && !o.online(run.k));
  if (away || c.landX != null) { c.auto = !!away; vsJudge(m, b, r, now, ev); return; }
  c.st = 'wait';
  c.waitUntil = c.impactAt + Math.min(400, run.rtt || 150) + R.VS.LAND_WAIT;
}
// (while a hammer lands, the farthest his streamed position was from it: without his own verdict, that counts)
function vsFar(m, b, now) {
  b.seats.forEach((k) => {
    const c = (kid(m, k) || {}).claw;
    if (c && ((c.st === 'fall' && now >= c.impactAt - 150) || c.st === 'wait')) c.far = Math.max(c.far || 0, Math.abs(b.rx - c.fallX));
  });
}
function vsJudge(m, b, r, now, ev) {
  const c = r.claw;
  const run = kid(m, b.runner);
  c.st = 'back';
  c.readyAt = now + R.BACK_MS;
  const sure = c.landX != null || !!(run && run.robot) || !!c.auto;
  c.auto = false;
  vsFar(m, b, now);
  const x = c.landX != null ? c.landX : b.rx;
  const fin = c.final; c.final = false;
  const d = c.landX != null || sure ? Math.abs(x - c.fallX) : Math.max(c.far || 0, Math.abs(x - c.fallX));
  const stunned = now < b.stunUntil;
  const hit = !!run && !stunned && !(fin && c.landX == null && !sure) && d < R.HIT_R - (sure ? 0 : R.VS.DOUBT) - 1e-6;
  c.landX = null; c.far = 0;
  if (!hit) {
    r.misses++;
    ev.push({ t: 'impact', b: b.id, k: r.k, x: round2(c.fallX), hit: false, fx: round2(x), sid: c.sid, runner: b.runner });
    return;
  }
  const mult = m.round && m.round.final ? 2 : 1;
  const pts = R.VS.HIT * mult;
  const assists = [];
  b.seats.forEach((k) => {
    const o = kid(m, k);
    if (!o || o === r || o.k === b.captain || o.k === b.runner) return;
    if ((o.claw.st === 'armed' || o.claw.st === 'fall') && Math.abs((o.claw.st === 'fall' ? o.claw.fallX : o.claw.x) - x) <= R.TRAP_R) { o.assists++; o.words += R.ASSIST; assists.push(o.k); }
  });
  let cap = null;
  if (b.captain != null && b.captain !== r.k) { const o = kid(m, b.captain); if (o) { o.words += R.CAPTAIN; o.capBonks++; cap = o.k; } }
  else if (b.captain === r.k) r.capBonks++;
  r.bonks++; r.words += pts;
  b.bonks++; b.roundBonks++; b.hitsRound++;
  run.hitsTaken++;
  b.words += pts + assists.length * R.ASSIST + (cap != null ? R.CAPTAIN : 0);
  b.stunUntil = now + R.VS.STUN_MS;
  b.stunMs += R.VS.STUN_MS;
  ev.push({ t: 'bonk', b: b.id, k: r.k, x: round2(x), pts, assists, cap, words: b.words, target: b.target, flying: pickWords(m, pts + assists.length + (cap != null ? 1 : 0)), ms: R.VS.STUN_MS, x2: mult > 1, n: b.bonks, sid: c.sid, runner: b.runner });
}
// a robot runner: it notices a falling hammer (or two) after a kid's reaction time and runs out of the way, a dash
// when both sides are covered; between hammers it strolls
function robotRun(m, b, now, dt, ev, auto) {
  const r = kid(m, b.runner);
  if (!r || (!r.robot && !auto) || m.round.phase !== 'pw' || now < b.stunUntil) return;
  const bt = r.bot;
  const threats = b.seats.map((k) => kid(m, k)).filter((o) => o && o.claw.st === 'fall' && now - (o.claw.impactAt - R.VS.FALL_MS) >= (o.claw.react || (o.claw.react = rnd(m, R.VS.ROBOT_REACT_MIN, R.VS.ROBOT_REACT_MAX))) && Math.abs(o.claw.fallX - b.rx) < R.HIT_R + 0.35);
  let target = bt.runTo != null ? bt.runTo : b.rx;
  if (threats.length) {
    const lo = Math.min(...threats.map((o) => o.claw.fallX)) - R.HIT_R - 0.35, hi = Math.max(...threats.map((o) => o.claw.fallX)) + R.HIT_R + 0.35;
    const goLeft = (b.rx - lo) < (hi - b.rx) ? lo >= 0 : hi > MAXX;
    target = clamp(goLeft ? lo : hi, 0, MAXX);
    const need = Math.abs(target - b.rx), left = Math.min(...threats.map((o) => o.claw.impactAt)) - now;
    if (r.dashes > 0 && need > (R.VS.RUN_SPEED * left) / 1000 && !bt.dashed) { const d = runnerDash(m, r.k, target < b.rx ? -1 : 1, now); if (d) { ev.push(Object.assign({ t: 'dash' }, d)); b.rx = clamp(b.rx + d.dir * R.VS.DASH_X, 0, MAXX); bt.dashed = true; } }
  } else {
    bt.dashed = false;
    if (bt.runTo == null || Math.abs(bt.runTo - b.rx) < 0.05 || now >= (bt.runAt || 0)) { bt.runTo = rnd(m, 0.3, MAXX - 0.3); bt.runAt = now + rnd(m, 900, 2200); }
    target = bt.runTo;
  }
  const step = ((threats.length ? R.VS.RUN_SPEED : R.VS.RUN_SPEED * 0.55) * dt) / 1000;
  b.rx = Math.abs(target - b.rx) <= step ? target : b.rx + Math.sign(target - b.rx) * step;
  b.fx.x = b.fx.x0 = b.fx.x1 = b.rx;
  if (Math.abs(b.rx - b.rxSent) > 0.04 && now - b.rxSentAt >= 70) { b.rxSent = b.rx; b.rxSentAt = now; ev.push({ t: 'runner', b: b.id, k: r.k, x: round2(b.rx), vol: true }); }
}
// (the server measures each phone's round trip: a hammer waits that long for the runner's own verdict)
function setRtt(m, k, rtt) { const r = kid(m, k); if (r && Number.isFinite(rtt)) r.rtt = clamp(rtt, 0, 2000); }

// ---------- the tick (every 80 ms while the game plays) ----------
// opts: { questions, imageFor(q), online(k) → bool }. Returns the events to send.
function tick(m, now, opts) {
  const ev = [];
  if (m.paused || m.phase !== 'play' || !m.round) return ev;
  const o = opts || {};
  const online = (k) => { const r = kid(m, k); return !!(r && r.robot) || (o.online ? o.online(k) : true); };
  const dt = m.lastTick ? Math.max(0, Math.min(1000, now - m.lastTick)) : 0;
  m.lastTick = now;
  Object.values(m.kids).forEach((r) => { if (online(r.k)) r.awaySince = 0; else if (!r.awaySince) r.awaySince = now; });
  const rd = m.round;
  m.boards.forEach((b) => {
    // the crab walks toward the Capitán's finger (or back to the middle without a Capitán outside the play window)
    const tx = rd.phase === 'pw' || rd.phase === 'pwin' ? b.crab.tx : b.crab.x;
    const step = (R.CRAB_SPEED * dt) / 1000;
    if (Math.abs(tx - b.crab.x) > 0.001) {
      const was = b.crab.x;
      b.crab.x = Math.abs(tx - was) <= step ? tx : was + Math.sign(tx - was) * step;
      b.seats.forEach((k) => { const x = kid(m, k); if (x && (x.claw.st === 'armed' || x.claw.st === 'back')) x.claw.x = clamp(b.crab.x + x.claw.off, 0, MAXX); });
      if (Math.abs(b.crab.x - b.crab.sentX) > 0.04 && now - b.crab.sentAt >= 90) { b.crab.sentX = b.crab.x; b.crab.sentAt = now; ev.push({ t: 'crab', b: b.id, x: round2(b.crab.x), tx: round2(tx), vol: true }); }
    } else if (b.crab.sentX !== b.crab.x) { b.crab.sentX = b.crab.x; b.crab.sentAt = now; ev.push({ t: 'crab', b: b.id, x: round2(b.crab.x), tx: round2(tx) }); }
    // the hammers
    b.seats.forEach((k) => {
      const r = kid(m, k);
      if (!r) return;
      if (r.claw.st === 'fall' && now >= r.claw.impactAt) { if (b.runner != null) vsLand(m, b, r, now, ev, o); else impact(m, b, r, now, ev); }
      else if (r.claw.st === 'wait' && (r.claw.landX != null || now >= r.claw.waitUntil)) vsJudge(m, b, r, now, ev);
      else if (r.claw.st === 'back' && now >= r.claw.readyAt) { r.claw.st = r.charges > 0 && rd.phase === 'pw' ? 'armed' : 'idle'; ev.push({ t: 'claw', b: b.id, k: r.k, st: r.claw.st, charges: r.charges }); }
      if (r.robot) robotTick(m, b, r, now, ev);
    });
    if (b.runner != null && (rd.phase === 'pwin' || rd.phase === 'pw')) { robotRun(m, b, now, dt, ev, !online(b.runner)); vsFar(m, b, now); }
    else fenTick(m, b, now, ev);
  });
  // the windows
  if (rd.phase === 'qw') {
    Object.values(m.kids).forEach((r) => {
      if (r.q && now >= (r.q.until || r.q.sentAt + R.Q_TIME_MS) + 300) {
        if (online(r.k) && (r.q.seen || r.robot) && now < rd.until) ev.push.apply(ev, late(m, r, now)); else r.q = null;
      }
      const room = rd.until - now;
      if (!r.q && now >= r.qNextAt && online(r.k) && room > 2500) {
        r.q = nextQ(m, r, o.questions || [], o.imageFor, now, rd.until - 150);
        if (r.q) { if (r.robot) r.q.seen = true; ev.push({ t: 'q', b: r.b, k: r.k, q: r.q, ms: r.q.until - now, charges: r.charges }); }
        else r.qNextAt = now + 2000;
      }
    });
    if (now >= rd.until) toPlayIn(m, now, ev, o);
  } else if (rd.phase === 'pwin') { if (now >= rd.until) toPlay(m, now, ev); }
  else if (rd.phase === 'pw') {
    // every claw spent and landed: the window ends a little after (no waiting on nothing)
    const live = Object.values(m.kids).some((r) => r.claw.st === 'fall' || r.claw.st === 'wait' || r.claw.st === 'back' || (r.claw.st === 'armed' && r.charges > 0));
    if (!live && rd.until - now > R.PW_EMPTY_MS) rd.until = now + R.PW_EMPTY_MS;
    if (now >= rd.until && !Object.values(m.kids).some((r) => r.claw.st === 'fall' || r.claw.st === 'wait')) toPlayOut(m, now, ev);
  } else if (rd.phase === 'pwout') { if (now >= rd.until) nextRound(m, now, ev); }
  return ev;
}
// «¡FINAL!»: the game ends (a hammer in the air lands now); the ceremony FINAL_MS later
function final(m, now) {
  const ev = [];
  if (m.phase === 'final' || m.phase === 'done') return ev;
  if (m.phase !== 'play') startPlay(m, now);
  if (m.phase === 'final') return ev;
  m.boards.forEach((b) => b.seats.forEach((k) => {
    const r = kid(m, k);
    if (!r) return;
    if (b.runner != null && (r.claw.st === 'fall' || r.claw.st === 'wait')) { r.claw.final = true; vsJudge(m, b, r, now, ev); }   // (no verdict from his screen yet: it doesn't count)
    else if (r.claw.st === 'fall') impact(m, b, r, Math.max(now, r.claw.impactAt), ev);
  }));
  m.boards.forEach((b) => runEnd(m, b, now, ev));
  m.boards.forEach((b) => { b.caught = !!b.full || b.words >= b.target; b.seats.forEach((k) => { const r = kid(m, k); if (r) { r.q = null; r.claw.st = 'idle'; } }); });
  m.phase = 'final';
  m.frenzy = false;
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  if (m.round) m.round.phase = 'done';
  ev.push({ t: 'final', ms: R.FINAL_MS, mode: m.mode, boards: m.boards.map((b) => ({ id: b.id, caught: m.mode === 'vs' ? null : !!b.caught, words: b.words, target: b.target })) });
  return ev;
}
// Teacher «⏭ Saltar»: the current window ends now
function skip(m, now, opts) {
  if (m.phase !== 'play' || m.paused || !m.round) return [];
  m.round.until = Math.min(m.round.until, now);
  return tick(m, now, opts);
}

// ---------- what screens see ----------
function clawView(r) { return { k: r.k, st: r.claw.st, off: round2(r.claw.off), x: round2(r.claw.x), charges: r.charges }; }
function boardView(m, b, online, now) {
  const t = now == null ? Date.now() : now;
  const clock = m.paused ? m.pausedAt : t;
  return {
    id: b.id, words: b.words, target: b.target, full: !!b.full, anger: round2(b.anger), bonks: b.bonks, captain: b.captain,
    crab: round2(b.crab.x), fen: fenView(b.fx, clock), mode: m.mode,
    runner: b.runner, rx: round2(b.rx), stunMs: Math.max(0, b.stunUntil - clock),
    seats: b.seats.map((k) => { const r = kid(m, k); return { k, name: r.name, skin: r.skin, words: r.words, robot: r.robot, rightQW: r.rightQW, on: r.robot || !online || online(k) }; }),
    claws: b.seats.map((k) => clawView(kid(m, k))),
  };
}
function roundView(m, now) {
  const r = m.round;
  if (!r) return null;
  const clock = m.paused ? m.pausedAt : now;
  return { n: r.n, total: r.total, phase: r.phase, final: r.final, ms: Math.max(0, r.until - clock), mode: m.mode };
}
function openQ(m, k, now) {
  const r = kid(m, k);
  if (!r || !r.q) return null;
  return Object.assign(qPublic(r.q), now != null && r.q.until ? { ms: Math.max(0, r.q.until - now) } : {});
}

// ---------- the end ----------
function cmp(a, b) { return b.words - a.words || b.bonks - a.bonks || b.best - a.best || a.k - b.k; }
const same = (a, b) => !!a && !!b && a.words === b.words && a.bonks === b.bonks && a.best === b.best;
function rankRows(rows) {
  rows.sort(cmp);
  rows.forEach((r, i) => { r.rank = i > 0 && same(r, rows[i - 1]) ? rows[i - 1].rank : i + 1; });
  return rows;
}
function starDefs(n, mode) {
  const maxShare = Math.max(1, Math.floor(n / 2));
  if (mode === 'vs') {
    return [
      { id: 'corredor', name: 'Mejor corredor', unit: 'puntos corriendo', val: (r) => r.runPts, ok: (r) => r.runPts >= 1, best: 'max', maxShare },
      { id: 'martillo', name: 'Mejor martillazo', unit: 'martillazos', val: (r) => r.bonks, ok: (r) => r.bonks >= 1, best: 'max', maxShare },
      { id: 'capitan', name: 'Mejor capitán', unit: 'atrapadas al volante', val: (r) => r.capBonks, ok: (r) => r.capBonks >= 1, best: 'max', maxShare },
      { id: 'racha', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max', maxShare },
    ];
  }
  return [
    { id: 'martillo', name: 'Mejor martillazo', unit: 'martillazos', val: (r) => r.bonks, ok: (r) => r.bonks >= 1, best: 'max', maxShare },
    { id: 'capitan', name: 'Mejor capitán', unit: 'atrapadas al volante', val: (r) => r.capBonks, ok: (r) => r.capBonks >= 1, best: 'max', maxShare },
    { id: 'trampa', name: 'Mejor trampa', unit: 'trampas', val: (r) => r.assists, ok: (r) => r.assists >= 1, best: 'max', maxShare },
    { id: 'racha', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max', maxShare },
  ];
}
// (robots sit in the crew and help, but never win a star, a place, the podium or the class ranking)
function finish(m) {
  const row = (r) => ({
    k: r.k, name: r.name, skin: r.skin, b: r.b, robot: r.robot, words: r.words, bonks: r.bonks, assists: r.assists, capBonks: r.capBonks,
    captained: r.captained, slams: r.slams, right: r.right, wrong: r.wrong, answered: r.answered, eaten: r.eaten, best: r.best, stars: [],
    runs: r.runs, survived: Math.round(r.survived / 1000), runPts: r.runPts, hitsTaken: r.hitsTaken,
  });
  const all = Object.values(m.kids).map(row);
  const byK = {};
  all.forEach((r) => { byK[r.k] = r; });
  const boards = m.boards.filter((b) => b.seats.length).map((b) => {
    const people = rankRows(b.seats.map((k) => byK[k]).filter((r) => r && !r.robot));
    const bots = b.seats.map((k) => byK[k]).filter((r) => r && r.robot);
    const st = Party.stars(people, starDefs(people.length, m.mode));
    st.forEach((s) => s.winners.forEach((k) => { if (byK[k]) byK[k].stars.push(s.id); }));
    people.forEach((r) => { r.of = people.length; });
    bots.forEach((r) => { r.rank = null; r.of = people.length; });
    const winners = people.filter((r) => r.rank === 1 && r.words > 0).map((r) => r.k);
    return { id: b.id, mode: m.mode, rows: people.map((r) => r.k), robots: bots.map((r) => ({ k: r.k, name: r.name, skin: r.skin, words: r.words, bonks: r.bonks })), winners, stars: st, words: b.words, target: b.target, caught: m.mode === 'vs' ? null : !!b.full || b.words >= b.target, bonks: b.bonks };
  });
  const crews = boards.slice().sort((a, b) => (b.words / b.target) - (a.words / a.target) || b.words - a.words || a.id - b.id).map((b, i) => ({ id: b.id, words: b.words, target: b.target, caught: b.caught, robots: b.robots.length, rank: i + 1 }));
  const cls = rankRows(all.filter((r) => !r.robot).map((r) => Object.assign({}, r)));
  cls.forEach((r) => { byK[r.k].classRank = r.rank; });
  return { boards, crews, rows: all, byK, order: cls.map((r) => r.k), count: cls.length };
}

module.exports = {
  runnerPos, runnerDash, runnerLand, setRtt, fenAt, R, clampDuration, targetFor, newGame, kid, inGame, boardOf, deal, seatLate, seatRobot, byCode, startPlay, addTime, shiftTimes, tick,
  final, skip, answer, seen, steer, aim, slam, react, boardView, roundView, openQ, qPublic, finish, starDefs, fxAt, nextQ, MAXX,
};
