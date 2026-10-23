// ¡Atrapa a Fénec! (gameType 'teamcrab') — the rules, no sockets (server.js «ATRAPA A FÉNEC» block glues them to the
// room). #4 of his Mario Party series: Super Mario Party «Team Crab» (his video y9BKCVx_mNk, 7:30-8:16), turned around
// (his design 2026-10-23): the KIDS are the crew of a giant red robot crab in the sea of a Dubai beach, one wooden
// hammer each; FÉNEC, el ladrón de palabras (a fennec-fox cartoon burglar), hops between 5 spots on the dock and dodges.
// The class plays in BOARDS of 3-4 (the deal of core/halcon.js); each board = one crab, one Fénec, one Péndulo.
//   · A right quiz answer LOADS my hammer (its shadow shows on the dock). I drag it over a spot and SLAM (tap, swipe down
//     or «¡GOLPE!») within LOAD_MS (else it slams by itself where it hangs). It falls for FALL_MS; at the impact the
//     server asks where Fénec is: under it = a BONK (the board's big moment, words fly out of his sack back to the crew).
//   · Fénec is computer-played and fair: he reacts to a falling hammer on his spot (REACT_MIN-MAX ms, then a HOP_MS hop
//     to a neighbour spot that no hammer threatens, a loaded hammer's shadow if nothing better), gets spooked by a
//     shadow that lingers on his spot and wanders now and then. Alone a kid catches him ~1 slam in 3; a crew that covers
//     his escape spots with their shadows boxes him in (an «assist» for each crewmate whose loaded hammer did it).
//   · A wrong, late (Q_TIME_MS) or blind (< FAST_MS) answer costs (his standing rule): my hammer jams with smoke JAM_MS,
//     Fénec snatches a word back into his sack («¡Mías!», never naming who), a grumpy spark feeds El Péndulo (anger +1).
//     El Péndulo at ANGER_MAX = the BIG SWING: every hammer of the board knocked away KNOCK_MS. Right answers in a row
//     calm him (−CALM each): «anger feeds him, calm and laughter stop him».
//   · The clock: 2 / 3 / 4 min (default 2), the last 30 s every bonk ×2. At the end a board that got its target of words
//     back has CAUGHT him («¡Atrapado!», he runs off: «¡La próxima vez, Dralingo!»); else he escapes and kicks the crab to
//     pieces. Then each board's Mario Party ceremony (bonus stars) and the crews' leaderboard on the projector.
// Every kid's numbers live in m.kids[k] (k = the server's stable id p.tcK), so a kid who left still counts at the end.
// Spec: docs/specs/atrapa-a-fenec.md. The server emits the events every function returns ({ t, b, … }).
'use strict';
const Party = require('./party');      // clockShift (the teacher's «−30 s»), stars
const Halcon = require('./halcon');    // boards of 4 (splitBoards), mulberry32, shuffle, pickOrder

const R = {
  DURATIONS: [120, 180, 240], DURATION: 120,
  INTRO_MS: 2600,            // «¡Atrapa a Fénec!» → «¡YA!» after the 3.5 s run-in countdown
  SPOTS: 5,                  // the dock's spots, left to right (Fénec stands on one)
  Q_TIME_MS: 15000,          // a quiz question's time: left to run out = late = it costs like a wrong answer
  FAST_MS: 500,              // an answer sooner than this after its question went out = a blind guess = wrong
  NEXT_Q_MS: 200,            // the next question this soon after my hammer is back up
  LOAD_MS: 6000,             // a loaded hammer must slam within this (then it slams by itself where it hangs)
  FIRST_LOAD_MS: 9000,       // my very first loaded hammer (guided: the hand shows the drag and the slam)
  FALL_MS: 420,              // the slam: the hammer's fall to the dock
  BACK_MS: 650,              // after the impact the hammer rises back to the crab
  JAM_MS: 3000,              // a wrong / late / blind answer: my hammer jams with smoke this long
  BONK_MS: 2000,             // the bonk: Fénec flat, the words fly out (the board's slams wait; the quiz goes on)
  SWING_MS: 1800,            // El Péndulo's big swing across the dock (the moment)
  KNOCK_MS: 3000,            // …the board's hammers knocked away this long
  HOP_MS: 300,               // Fénec's hop to the next spot (he is on the new spot from half of it)
  REACT_MIN: 120, REACT_MAX: 400,   // he notices a hammer falling on his spot after this long
  SPOOK_MIN: 650, SPOOK_MAX: 1300,  // a loaded shadow on his spot this long and he hops away
  WANDER_MIN: 1300, WANDER_MAX: 2800,
  TAUNT_GAP_MS: 4000,        // his lines at most this often per board (a «¡Mías!» always)
  WORDS_BONK: 2, ASSIST: 1, SNATCH: 1,   // a bonk returns 2 words to the bonker (×2 in the last 30 s), +1 per assist
  ANGER_MAX: 5, CALM: 0.25, ANGER_REST: 1,
  TARGET_PER_KID_MIN: 2.2,   // words a board must get back per kid and minute (+ half a minute for the ×2 end; sim-tuned)
  TARGET_MIN: 6,
  FRENZY_MS: 30000,          // the last 30 s: «¡Atardecer dorado!» every bonk ×2
  FINAL_MS: 2400,
  BOARD: 4, BOARD_MAX: 5,
  REACTS: ['wow', 'lol', 'clap', 'fire'], REACT_GAP_MS: 1200,
  AIM_GAP_MS: 40,            // aim updates closer than this are dropped (relayed live, volatile)
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 60, 600);
const spotOfX = (x) => clamp(Math.round(clamp(Number(x) || 0, 0, 1) * (R.SPOTS - 1)), 0, R.SPOTS - 1);
const xOfSpot = (s) => s / (R.SPOTS - 1);

function newGame(seed, durationS, now, words) {
  return {
    id: seed, seed, rng: Halcon.mulberry32(seed), duration: clampDuration(durationS),
    phase: 'countdown', phaseAt: now, phaseUntil: now, endsAt: 0, frenzyAt: 0, frenzy: false,
    paused: false, pausedAt: 0, boards: [], kids: {}, nextBoard: 1, qn: 0, words: (words || []).slice(0, 60),
  };
}
const kid = (m, k) => (m && k != null ? m.kids[k] || null : null);
const inGame = (m, k) => !!kid(m, k);
const boardOf = (m, id) => (m ? m.boards.find((b) => b.id === id) || null : null);
const rnd = (m, a, b) => a + m.rng() * (b - a);

function newKid(k, name, skin, b, code) {
  return {
    k, name: String(name || ''), skin: skin || 'dralingo', b, code: code ? String(code) : '',   // (code: server only)
    words: 0, bonks: 0, assists: 0, slams: 0, misses: 0, right: 0, wrong: 0, late: 0, fast: 0, answered: 0,
    streak: 0, best: 0, first: true, awaySince: 0, lastReact: 0, q: null, qNextAt: 0, order: [], qi: 0, lastAim: 0,
    h: { st: 'idle', x: 0.5, spot: 2, until: 0, slamAt: 0, impactAt: 0, react: 0, guided: false, was: null },
  };
}
// a board's target: words to get back to catch him (per kid and minute, at least TARGET_MIN)
function targetFor(n, minutes) { return Math.max(R.TARGET_MIN, Math.round(R.TARGET_PER_KID_MIN * Math.max(1, n) * (minutes + 0.5))); }
function addBoard(m) {
  const b = {
    id: m.nextBoard++, seats: [], phase: 'wait', phaseUntil: 0, words: 0, target: 0, full: false, bonks: 0, snatched: 0,
    anger: 0, lastOk: null, swings: 0, lastTaunt: 0, said: null,
    fx: { at: 2, from: 2, hopAt: 0, nextWander: 0, spookSpot: -1, spookAt: 0, spookMs: 0 },
  };
  m.boards.push(b);
  return b;
}
function seatIn(m, b, k, name, skin, code) {
  m.kids[k] = newKid(k, name, skin, b.id, code);
  b.seats.push(k);
  return m.kids[k];
}
// The start: boards of 4 (3 when it doesn't divide; ≤ 5 kids = one board). entries: [[k, name, skin, code]]
function deal(m, entries) {
  const byK = {};
  entries.forEach(([k, name, skin, code]) => { byK[k] = [name, skin, code]; });
  Halcon.splitBoards(entries.map((e) => e[0]), m.rng).forEach((ks) => {
    const b = addBoard(m);
    ks.forEach((k) => seatIn(m, b, k, byK[k][0], byK[k][1], byK[k][2]));
    b.target = targetFor(b.seats.length, m.duration / 60);
  });
  return m.boards;
}
// A late joiner sits at the smallest board with room (max 5); its target grows by the kid's share of the time left.
function seatLate(m, k, name, skin, code, now) {
  if (inGame(m, k)) return null;
  const open = m.boards.filter((b) => b.seats.length < R.BOARD_MAX).sort((a, b) => a.seats.length - b.seats.length || a.id - b.id);
  const b = open[0] || addBoard(m);
  seatIn(m, b, k, name, skin, code);
  const left = m.phase === 'play' && m.endsAt ? Math.max(0, m.endsAt - (now || Date.now())) / 60000 : m.duration / 60;
  b.target = b.seats.length === 1 ? targetFor(1, left) : b.target + Math.round(R.TARGET_PER_KID_MIN * left);
  if (m.phase === 'play' && b.phase === 'wait') { b.phase = 'play'; b.fx.nextWander = (now || Date.now()) + 1500; }
  return b;
}
// a kid back after the room forgot their phone: their own row, by the student code the server proved
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
  m.boards.forEach((b) => { b.phase = 'play'; b.fx.at = b.fx.from = Math.floor(R.SPOTS / 2); b.fx.hopAt = 0; b.fx.nextWander = now + rnd(m, R.WANDER_MIN, R.WANDER_MAX); });
  return [];
}
function addTime(m, ms, now) {
  if (m.phase !== 'play') return 0;
  const d = Party.clockShift(m.endsAt, ms, now);
  if (!d) return 0;
  m.endsAt += d;
  m.phaseUntil = m.endsAt;
  m.frenzyAt = m.endsAt - frenzyLen(m);
  if (d > 0) m.duration += d / 1000;
  // the crews that haven't emptied the sack get a target for the new length (the play time from the start to the end)
  const plan = (m.endsAt - m.phaseAt) / 60000, was = plan - d / 60000;
  if (was > 0) m.boards.forEach((b) => { if (!b.full && b.target) b.target = Math.max(R.TARGET_MIN, Math.round(b.target * (plan + 0.5) / (was + 0.5))); });
  return d;
}
// the teacher paused for `ms`: every pending moment moves by that much
function shiftTimes(m, ms) {
  m.phaseAt += ms; m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.lastTick = 0;
  m.boards.forEach((b) => {
    if (b.phaseUntil) b.phaseUntil += ms;
    const f = b.fx;
    if (f.hopAt) f.hopAt += ms;
    if (f.nextWander) f.nextWander += ms;
    if (f.spookAt) f.spookAt += ms;
  });
  Object.values(m.kids).forEach((r) => {
    if (r.awaySince) r.awaySince += ms;
    if (r.qNextAt) r.qNextAt += ms;
    if (r.q && r.q.until) r.q.until += ms;
    const h = r.h;
    if (h.until) h.until += ms;
    if (h.slamAt) h.slamAt += ms;
    if (h.impactAt) h.impactAt += ms;
  });
}

// ---------- Fénec ----------
// where he is at time t (on a hop he counts on the new spot from half of it)
const fxSpotAt = (f, t) => (f.hopAt && t < f.hopAt + R.HOP_MS / 2 ? f.from : f.at);
const hopping = (f, now) => !!f.hopAt && now < f.hopAt + R.HOP_MS;
function boardHammers(m, b) { return b.seats.map((k) => kid(m, k)).filter(Boolean).map((r) => r.h); }
// how a spot looks to him: 2 = a hammer falling on it, 1 = a loaded hammer's shadow, 0 = free
function threat(m, b, s) {
  let v = 0;
  boardHammers(m, b).forEach((h) => {
    if (h.st === 'fall' && h.spot === s) v = Math.max(v, 2);
    else if (h.st === 'loaded' && h.spot === s) v = Math.max(v, 1);
  });
  return v;
}
function hop(m, b, to, now, ev, why) {
  const f = b.fx;
  f.from = f.at; f.at = to; f.hopAt = now;
  f.spookSpot = -1;
  ev.push({ t: 'hop', b: b.id, from: f.from, to, ms: R.HOP_MS, why });
}
// a neighbour spot to flee to (the least threatened; equal ones at random); null = boxed in (both sides fall / the edge)
function escapeSpot(m, b, okLoaded) {
  const at = b.fx.at;
  const opts = [at - 1, at + 1].filter((s) => s >= 0 && s < R.SPOTS).map((s) => ({ s, v: threat(m, b, s) }))
    .filter((o) => o.v < 2 && (okLoaded || o.v === 0));
  if (!opts.length) return null;
  const best = Math.min(...opts.map((o) => o.v));
  const pick = opts.filter((o) => o.v === best);
  return pick[Math.floor(m.rng() * pick.length)].s;
}
function taunt(b, now, ev, line, force) {
  if (!force && now - b.lastTaunt < R.TAUNT_GAP_MS) return;
  b.lastTaunt = now;
  ev.push({ t: 'taunt', b: b.id, line });
}
// his move this tick: flee a falling hammer he noticed, flee a lingering shadow, or wander
function fennec(m, b, now, ev) {
  const f = b.fx;
  if (hopping(f, now)) return;
  const hs = boardHammers(m, b);
  const falling = hs.find((h) => h.st === 'fall' && h.spot === f.at && now >= h.slamAt + h.react && now < h.impactAt);
  if (falling) {
    const to = escapeSpot(m, b, true);
    if (to != null) hop(m, b, to, now, ev, 'dodge');
    return;
  }
  const shadowed = hs.some((h) => h.st === 'loaded' && h.spot === f.at);
  if (shadowed) {
    if (f.spookSpot !== f.at) { f.spookSpot = f.at; f.spookAt = now; f.spookMs = rnd(m, R.SPOOK_MIN, R.SPOOK_MAX); }
    else if (now - f.spookAt >= f.spookMs) {
      const to = escapeSpot(m, b, false);
      if (to != null) hop(m, b, to, now, ev, 'spook');
      else { f.spookAt = now; f.spookMs = rnd(m, R.SPOOK_MIN, R.SPOOK_MAX); taunt(b, now, ev, 'nervous'); }
    }
    return;
  }
  f.spookSpot = -1;
  if (now >= f.nextWander) {
    f.nextWander = now + rnd(m, R.WANDER_MIN, R.WANDER_MAX);
    const to = escapeSpot(m, b, false);
    if (to != null) hop(m, b, to, now, ev, 'wander');
    if (m.rng() < 0.35) taunt(b, now, ev, 'idle');
  }
}

// ---------- the hammers ----------
function setHam(r, st, until) { r.h.st = st; r.h.until = until || 0; }
function hamEv(b, r, extra) { return Object.assign({ t: 'ham', b: b.id, k: r.k, st: r.h.st, spot: r.h.spot, x: r.h.x, ms: 0 }, extra || {}); }
// my hammer starts its fall at its aimed spot (the kid's slam, or the time ran out)
function startSlam(m, b, r, now, ev, auto) {
  const h = r.h;
  h.st = 'fall';
  h.slamAt = now;
  h.impactAt = now + R.FALL_MS;
  h.react = rnd(m, R.REACT_MIN, R.REACT_MAX);
  h.guided = false;
  h.auto = !!auto;
  r.slams++;
  ev.push({ t: 'slam', b: b.id, k: r.k, spot: h.spot, x: h.x, ms: R.FALL_MS, auto: !!auto });
}
// the impact: Fénec under it = a bonk; else a puff of dust and his taunt
function impact(m, b, r, now, ev) {
  const h = r.h;
  const t = h.impactAt;
  const fx = fxSpotAt(b.fx, t);
  setHam(r, 'back', now + R.BACK_MS);
  const hit = b.phase === 'play' && fx === h.spot;
  if (!hit) {
    r.misses++;
    ev.push({ t: 'impact', b: b.id, k: r.k, spot: h.spot, hit: false, fx });
    if (b.phase === 'play') taunt(b, now, ev, m.rng() < 0.5 ? 'miss' : 'miss2');
    return;
  }
  // a BONK: the words fly out of his sack; crewmates whose loaded hammer covered an escape spot assist
  const pts = (h.auto ? 1 : R.WORDS_BONK) * (m.frenzy ? 2 : 1);   // (a hammer that slammed by itself: +1, never what an aimed slam earns)
  const assists = [];
  b.seats.forEach((k) => {
    const o = kid(m, k);
    if (!o || o === r) return;
    if ((o.h.st === 'loaded' || o.h.st === 'fall') && Math.abs(o.h.spot - h.spot) === 1) {
      o.assists++; o.words += R.ASSIST; assists.push(o.k);
    }
  });
  r.bonks++; r.words += pts;
  b.bonks++;
  const before = b.words;
  b.words += pts + assists.length * R.ASSIST;
  const flying = pickWords(m, pts + assists.length);
  b.phase = 'bonk';
  b.phaseUntil = now + R.BONK_MS;
  // (every other hammer waits: the tick keeps a loaded one's time while the bonk plays; a falling one lands on nothing)
  ev.push({ t: 'bonk', b: b.id, k: r.k, spot: h.spot, pts, assists, words: b.words, target: b.target, flying, ms: R.BONK_MS, x2: m.frenzy, n: b.bonks });
  if (!b.full && before < b.target && b.words >= b.target) { b.full = true; ev.push({ t: 'full', b: b.id, words: b.words, target: b.target }); }
}
// the pinyin words that fly back (the class's own words, from the pack: never hanzi)
function pickWords(m, n) {
  const list = m.words || [];
  if (!list.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(n, 6); i++) out.push(list[Math.floor(m.rng() * list.length)]);
  return out;
}

// ---------- questions ----------
function nextQ(m, h, questions, imageFor, now) {
  if (!h.order.length || h.qi >= h.order.length) { h.order = Halcon.pickOrder(questions, m.rng); h.qi = 0; }
  if (!h.order.length) return null;
  const src = questions[h.order[h.qi++]];
  if (!src) return null;
  const answers = Halcon.shuffle([src.correct].concat(src.answers.filter((a) => a !== src.correct)).slice(0, 4).map(String), m.rng);
  m.qn++;
  return {
    qid: `tc${m.id % 100000}-${h.k}-${m.qn}`, text: String(src.text), answers, correctIdx: answers.indexOf(String(src.correct)),
    image: imageFor ? imageFor(src) || null : null, sentAt: now, until: now + R.Q_TIME_MS,
  };
}
const qPublic = (q) => (q ? { qid: q.qid, text: q.text, answers: q.answers, image: q.image } : null);

// a miss of mine (wrong / late / blind): my hammer jams, Fénec snatches a word back, El Péndulo eats the spark
function cost(m, b, r, now, ev, why) {
  setHam(r, 'jam', now + R.JAM_MS);
  r.qNextAt = now + R.JAM_MS;
  b.lastOk = false;
  if (!b || b.phase === 'done') return;
  const had = b.words;
  b.words = Math.max(0, b.words - R.SNATCH);
  b.snatched += had - b.words;
  ev.push({ t: 'snatch', b: b.id, n: had - b.words, words: b.words, target: b.target, why });   // (never who)
  if (b.phase === 'play' || b.phase === 'bonk') taunt(b, now, ev, 'mias', true);
  b.anger = Math.min(R.ANGER_MAX, b.anger + 1);
  ev.push({ t: 'feed', b: b.id, anger: b.anger });
  if (b.anger >= R.ANGER_MAX && b.phase === 'play') bigSwing(m, b, now, ev);
}
// El Péndulo full of anger: he swings across the dock, every hammer of the board knocked away KNOCK_MS
function bigSwing(m, b, now, ev) {
  b.phase = 'swing';
  b.phaseUntil = now + R.SWING_MS;
  b.swings++;
  b.seats.forEach((k) => {
    const o = kid(m, k);
    if (!o) return;
    const h = o.h;
    if (h.st === 'jam') { h.until = Math.max(h.until, now + R.KNOCK_MS); h.pubKnock = now + R.KNOCK_MS; return; }
    h.was = h.st === 'loaded' ? 'loaded' : null;
    h.st = 'knock';
    h.until = now + R.KNOCK_MS;
    o.qNextAt = Math.max(o.qNextAt || 0, now + R.KNOCK_MS);
  });
  ev.push({ t: 'swing', b: b.id, ms: R.SWING_MS, knockMs: R.KNOCK_MS, anger: b.anger });
  b.anger = R.ANGER_REST;
  taunt(b, now, ev, 'swing', true);
}

// ---------- the actions ----------
// A quiz answer. Right = my hammer loads (its shadow on the dock); wrong / blind = it costs. → { ok, right, ev }
function answer(m, k, qid, idx, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused || !r.q) return { ok: false, why: 'closed', ev: [] };
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
    const ms = r.first ? R.FIRST_LOAD_MS : R.LOAD_MS;
    r.h.guided = r.first;
    r.first = false;
    const knocked = r.h.st === 'knock' || (b && b.phase === 'swing');
    if (knocked) { r.h.was = 'loaded'; if (r.h.st !== 'knock') { r.h.st = 'knock'; r.h.until = Math.max(now, b.phaseUntil) + 600; } }
    else setHam(r, 'loaded', now + ms);
    ev.push({ t: 'qr', b: r.b, k, qid: q.qid, idx, ok: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: r.streak, loadMs: ms, guided: r.h.guided });
    if (b) {
      if (!knocked) ev.push(hamEv(b, r, { ms: r.h.until - now, guided: r.h.guided }));
      if (b.lastOk && b.anger > 0) { b.anger = Math.max(0, b.anger - R.CALM); ev.push({ t: 'calm', b: b.id, anger: Math.round(b.anger * 100) / 100 }); }
      b.lastOk = true;
    }
  } else {
    r.wrong++; r.streak = 0;
    if (tooFast) r.fast++;
    ev.push({ t: 'qr', b: r.b, k, qid: q.qid, idx, ok: false, tooFast, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: 0, jamMs: R.JAM_MS });
    if (b) cost(m, b, r, now, ev, tooFast ? 'fast' : 'wrong');
  }
  return { ok: true, right: ok, ev };
}
// the phone painted its question on a visible screen (a pocketed phone never pays for a late one)
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
  const ev = [{ t: 'qr', b: r.b, k: r.k, qid: q.qid, idx: -1, ok: false, late: true, correctIdx: q.correctIdx, correctText: q.answers[q.correctIdx], streak: 0, jamMs: R.JAM_MS }];
  const b = boardOf(m, r.b);
  if (b) cost(m, b, r, now, ev, 'late');
  return ev;
}
// my loaded hammer's aim (x 0-1 across the dock): live for the board, and Fénec reads its shadow
function aim(m, k, x, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused) return null;
  const h = r.h;
  if (h.st !== 'loaded' && h.st !== 'knock') return null;
  if (now - r.lastAim < R.AIM_GAP_MS) return null;
  r.lastAim = now;
  h.x = clamp(Number(x) || 0, 0, 1);
  h.spot = spotOfX(h.x);
  return { b: r.b, k, x: Math.round(h.x * 1000) / 1000, spot: h.spot };
}
// SLAM (tap, swipe down, «¡GOLPE!»): at x when given (the finger's last place), else where it hangs
function slam(m, k, x, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || m.paused) return { ok: false, why: 'closed', ev: [] };
  const b = boardOf(m, r.b);
  if (!b) return { ok: false, why: 'closed', ev: [] };
  if (r.h.st !== 'loaded') return { ok: false, why: r.h.st === 'knock' ? 'knock' : 'empty', ev: [] };
  if (b.phase === 'swing') return { ok: false, why: 'knock', ev: [] };
  if (b.phase === 'bonk') return { ok: false, why: 'wait', ev: [] };          // (he is flat: the board watches the words fly)
  if (x != null && Number.isFinite(Number(x))) { r.h.x = clamp(Number(x), 0, 1); r.h.spot = spotOfX(r.h.x); }
  const ev = [];
  startSlam(m, b, r, now, ev, false);
  return { ok: true, ev };
}
function react(m, k, e, now) {
  const r = kid(m, k);
  if (!r || m.phase !== 'play' || !R.REACTS.includes(e) || now - r.lastReact < R.REACT_GAP_MS) return null;
  r.lastReact = now;
  return { b: r.b, k, e };
}

// every hammer of a board this tick: a loaded one waits through a big moment and slams by itself at its time, a falling
// one lands, a raised / jammed / knocked one comes back
function hammers(m, b, now, dt, ev) {
  b.seats.forEach((k) => {
    const r = kid(m, k);
    if (!r) return;
    const h = r.h;
    if (h.pubKnock && now >= h.pubKnock) { h.pubKnock = 0; ev.push(Object.assign(hamEv(b, r), { st: 'idle', notMe: true })); }   // (the crew sees it back up like the others)
    if (h.st === 'loaded' && b.phase !== 'play') h.until += dt;          // (a big moment plays: a loaded hammer waits)
    if (h.st === 'loaded' && now >= h.until && b.phase === 'play') startSlam(m, b, r, now, ev, true);   // (it slams by itself)
    else if (h.st === 'fall' && now >= h.impactAt) impact(m, b, r, now, ev);
    else if (h.st === 'back' && now >= h.until) { setHam(r, 'idle'); r.qNextAt = Math.max(r.qNextAt || 0, now + R.NEXT_Q_MS); ev.push(hamEv(b, r)); }
    else if (h.st === 'jam' && now >= h.until) { setHam(r, 'idle'); ev.push(Object.assign(hamEv(b, r), { only: true })); }
    else if (h.st === 'knock' && now >= h.until) {
      if (h.was === 'loaded') setHam(r, 'loaded', now + R.LOAD_MS); else setHam(r, 'idle');
      h.was = null;
      ev.push(hamEv(b, r, { ms: h.st === 'loaded' ? R.LOAD_MS : 0 }));
    }
  });
}

// ---------- the tick (every 80 ms while the game plays) ----------
// opts: { questions, imageFor(q), online(k) → bool }. Returns the events to send.
function tick(m, now, opts) {
  const ev = [];
  if (m.paused || m.phase !== 'play') return ev;
  const o = opts || {};
  const online = o.online || (() => true);
  const dt = m.lastTick ? Math.max(0, Math.min(1000, now - m.lastTick)) : 0;
  m.lastTick = now;
  Object.values(m.kids).forEach((r) => {
    if (online(r.k)) r.awaySince = 0;
    else if (!r.awaySince) r.awaySince = now;
  });
  if (!m.frenzy && frenzyLen(m) && now >= m.frenzyAt && now < m.endsAt - 1200) {
    m.frenzy = true;
    ev.push({ t: 'frenzy', endsMs: Math.max(0, m.endsAt - now) });
  } else if (m.frenzy && now < m.frenzyAt - 1000) {
    m.frenzy = false;
    ev.push({ t: 'frenzy', off: true });
  }
  m.boards.forEach((b) => {
    if (b.phase === 'wait') { if (b.seats.length) { b.phase = 'play'; b.fx.nextWander = now + 1500; } return; }
    // the hammers
    hammers(m, b, now, dt, ev);
    // the moments end
    if (b.phase === 'bonk' && now >= b.phaseUntil) {
      b.phase = 'play';
      const f = b.fx;
      const to = Math.floor(m.rng() * R.SPOTS);
      f.from = f.at; f.at = to; f.hopAt = now; f.spookSpot = -1; f.nextWander = now + rnd(m, R.WANDER_MIN, R.WANDER_MAX);
      ev.push({ t: 'up', b: b.id, from: f.from, to, ms: R.HOP_MS * 2 });
      taunt(b, now, ev, 'up', true);
    } else if (b.phase === 'swing' && now >= b.phaseUntil) {
      b.phase = 'play';
      ev.push({ t: 'calmdown', b: b.id, anger: b.anger });
    }
    if (b.phase === 'play') fennec(m, b, now, ev);
  });
  // the quiz: every kid whose hammer is up (idle) answers to load it
  Object.values(m.kids).forEach((r) => {
    const b = boardOf(m, r.b);
    if (!b) return;
    if (b.phase === 'swing' || r.h.st === 'knock') {                    // my hammer is knocked away: my question waits (the phone hides it)
      if (r.q && r.q.until) r.q.until += dt;
      return;
    }
    if (r.q && now >= (r.q.until || r.q.sentAt + R.Q_TIME_MS) + 300) {
      if (online(r.k) && r.q.seen) ev.push.apply(ev, late(m, r, now)); else r.q = null;
    }
    if (!r.q && r.h.st === 'idle' && now >= r.qNextAt && online(r.k)) {
      r.q = nextQ(m, r, o.questions || [], o.imageFor, now);
      if (r.q) ev.push({ t: 'q', b: r.b, k: r.k, q: r.q, ms: R.Q_TIME_MS });
      else r.qNextAt = now + 2000;
    }
  });
  if (now >= m.endsAt) ev.push.apply(ev, final(m, now));
  return ev;
}
// «¡FINAL!»: a falling hammer still lands (judged now), everything stops; the ceremony FINAL_MS later
function final(m, now) {
  const ev = [];
  if (m.phase === 'final' || m.phase === 'done') return ev;
  if (m.phase !== 'play') startPlay(m, now);
  m.boards.forEach((b) => {
    if (b.phase === 'swing') b.phase = 'play';
    b.seats.forEach((k) => { const r = kid(m, k); if (r && r.h.st === 'fall') impact(m, b, r, Math.max(now, r.h.impactAt), ev); });
  });
  m.boards.forEach((b) => {
    b.phase = 'done';
    b.caught = !!b.full || b.words >= b.target;
    b.seats.forEach((k) => { const r = kid(m, k); if (r) { r.q = null; setHam(r, 'idle'); } });
  });
  m.phase = 'final';
  m.frenzy = false;
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  ev.push({ t: 'final', ms: R.FINAL_MS, boards: m.boards.map((b) => ({ id: b.id, caught: !!b.caught, words: b.words, target: b.target })) });
  return ev;
}
// Teacher «⏭ Saltar»: every board's big moment (bonk, swing) and every jam / knock ends now
function skip(m, now, opts) {
  if (m.phase !== 'play' || m.paused) return [];
  m.boards.forEach((b) => { if (b.phase === 'bonk' || b.phase === 'swing') b.phaseUntil = now; });
  Object.values(m.kids).forEach((r) => { if (r.h.st === 'jam' || r.h.st === 'knock') { r.h.until = now; r.qNextAt = Math.min(r.qNextAt || 0, now); } });
  return tick(m, now, opts);
}

// ---------- what screens see ----------
function hamView(r, now) {
  const h = r.h;
  const jam = h.st === 'jam';                                       // (a jam shows only on its own phone: never who failed)
  const st = jam ? (h.pubKnock > now ? 'knock' : 'idle') : h.st;
  return { k: r.k, st, x: h.x, spot: h.spot, ms: !jam && h.until ? Math.max(0, h.until - now) : 0, fallMs: h.st === 'fall' ? Math.max(0, h.impactAt - now) : 0 };
}
function boardView(m, b, online, now) {
  const t = now == null ? Date.now() : now;
  const clock = m.paused ? m.pausedAt : t;
  return {
    id: b.id, phase: b.phase, phaseMs: Math.max(0, (b.phaseUntil || 0) - clock), words: b.words, target: b.target, full: !!b.full,
    anger: Math.round(b.anger * 100) / 100, fx: fxSpotAt(b.fx, clock), bonks: b.bonks,
    seats: b.seats.map((k) => { const r = kid(m, k); return { k, name: r.name, skin: r.skin, words: r.words, on: !online || online(k) }; }),
    hammers: b.seats.map((k) => hamView(kid(m, k), clock)),
  };
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
function starDefs(n) {
  const maxShare = Math.max(1, Math.floor(n / 2));
  return [
    { id: 'martillo', name: 'Mejor martillazo', unit: 'martillazos', val: (r) => r.bonks, ok: (r) => r.bonks >= 1, best: 'max', maxShare },
    { id: 'trampa', name: 'Mejor trampa', unit: 'trampas', val: (r) => r.assists, ok: (r) => r.assists >= 1, best: 'max', maxShare },
    { id: 'racha', name: 'Mejor racha', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max', maxShare },
  ];
}
function finish(m) {
  const row = (r) => ({
    k: r.k, name: r.name, skin: r.skin, b: r.b, words: r.words, bonks: r.bonks, assists: r.assists, slams: r.slams,
    right: r.right, wrong: r.wrong, answered: r.answered, best: r.best, stars: [],
  });
  const all = Object.values(m.kids).map(row);
  const byK = {};
  all.forEach((r) => { byK[r.k] = r; });
  const boards = m.boards.filter((b) => b.seats.length).map((b) => {
    const rows = rankRows(b.seats.map((k) => byK[k]).filter(Boolean));
    const st = Party.stars(rows, starDefs(rows.length));
    st.forEach((s) => s.winners.forEach((k) => { if (byK[k]) byK[k].stars.push(s.id); }));
    rows.forEach((r) => { r.of = rows.length; });
    const winners = rows.filter((r) => r.rank === 1 && r.words > 0).map((r) => r.k);
    return { id: b.id, rows: rows.map((r) => r.k), winners, stars: st, words: b.words, target: b.target, caught: !!b.full || b.words >= b.target, bonks: b.bonks, swings: b.swings };
  });
  // the crews: the most words back first (then the share of the target)
  const crews = boards.slice().sort((a, b) => (b.words / b.target) - (a.words / a.target) || b.words - a.words || a.id - b.id).map((b, i) => ({ id: b.id, words: b.words, target: b.target, caught: b.caught, rank: i + 1 }));
  const cls = rankRows(all.map((r) => Object.assign({}, r)));
  cls.forEach((r) => { byK[r.k].classRank = r.rank; });
  return { boards, crews, rows: all, byK, order: cls.map((r) => r.k), count: all.length };
}

module.exports = {
  R, clampDuration, spotOfX, xOfSpot, targetFor, newGame, kid, inGame, boardOf, deal, seatLate, byCode, startPlay, addTime,
  shiftTimes, tick, final, skip, answer, seen, aim, slam, react, boardView, openQ, qPublic, finish, starDefs, fxSpotAt,
  escapeSpot, threat, nextQ,
};
