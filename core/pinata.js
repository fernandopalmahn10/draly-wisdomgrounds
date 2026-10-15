// Piñata Tigre v2 (gameType 'pinata') — the rules, no sockets (server.js «PIÑATA TIGRE» block glues them to the room).
// «La Fiesta de las Piñatas»: two teams (Fuego = 'red', Mar = 'gold') each break a LADDER of tiger piñatas hanging under
// Dubai landmarks. EVERY right answer is a hit for that kid: the phone shows a timing meter (an arrow sweeping back and
// forth over flojo · bien · fuerte · crítico) and one tap swings the stick. The meter is the server's: a triangle wave
// with a random start per swing; the phone sends WHEN it tapped on its own arrow clock, and the server accepts that
// time only inside ± TOL of where the tap must have happened by its own clock and the phone's measured round trip.
// A hit knocks out candies (= its power) and damages the team's current tiger; a broken tiger spills its jackpot and
// the next, bigger one drops in; the first team to break a landmark's tiger wins that landmark. More candies wins.
// Team totals are weighted by team size, the trailing team gets a wider golden zone (its lucky extra capped at the
// gap), the last 30 s count double, and the end is a Mario Party ceremony with bonus stars (finish / stars).
// Spec: docs/specs/pinata-tigre-v2.md. Player fields carry a `pn` prefix; the game object is `m` (server: g.pn).
'use strict';

const Mochi = require('./mochi');      // shared team helpers: teamSizes, weights, pickTeam, mulberry32

const R = {
  INTRO_MS: 2800,            // «¡Para la flecha en el dorado!» → «¿Listos?» → «¡YA!» after the 3.5 s run-in countdown
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  LEAD_MS: 800,              // «¡Correcto!» on the phone before the arrow starts
  WINDOW_MS: 2700,           // the arrow runs this long (three sweeps); no tap → an automatic «Flojito» hit
  HALF_MS: 900,              // one sweep, edge to edge
  RESULT_MS: 1000,           // the swing's result on the phone before the next question
  BURST_MS: 1600,            // …and this much more when that hit broke the tiger (the big moment)
  WRONG_MS: 2200,            // a wrong answer / time up shows the right answer this long, then the next question
  GRACE_MS: 600,             // a tap may arrive this late after its window (network)
  TOL_MS: 150,               // the phone's tap time is accepted within ± this of the server's estimate
  RTT_DEFAULT: 250,          // no ping answer yet: assume this round trip
  RTT_MAX: 1500,
  ZONE: { crit: 0.075, critWide: 0.13, strong: 0.20, good: 0.34 },   // distance from the centre (0 … 0.5)
  POWER: { crit: 6, strong: 3, good: 2, weak: 1, auto: 1 },
  FAST_MS: 4000,             // a right answer under this (from the question reaching the server) → «¡Rápido! +1»
  FAST_MIN_MS: 400,          // nobody reads and taps faster: under this is a glitch (no bonus, no star)
  STREAK1: 3, STREAK2: 6,    // racha: +1 power from 3 right in a row, +2 from 6
  FRENZY_MS: 30000,          // the last 30 s: every hit counts ×2 (candies and damage)
  FRENZY_MAX_FRAC: 1 / 3,    // (a very short game: the last third)
  LEAD_MIN: 4, LEAD_FRAC: 0.03, LEAD_GAP_MS: 7000,   // a lead counts at ≥ 4 candies and ≥ 3 % of the total; alarms ≥ 7 s apart
  BEHIND_MIN: 10, BEHIND_FRAC: 0.15,                 // trailing (for the wide golden zone): ≥ 10 and ≥ 15 % of the leader
  PER_KID_S: 0.36,           // expected damage per kid per second of play (a real class: a question every ~7.7 s at 75 %
                             // right, ~3.1 power a hit with bonuses, the ×2 at the end); calibrates the tigers' life
  TIERS: [                   // the ladder: tiger i breaks when the team's damage reaches E × at
    { id: 'museum', name: 'Museo del Futuro', at: 0.12 },
    { id: 'frame', name: 'Marco de Dubái', at: 0.30 },
    { id: 'arab', name: 'Burj Al Arab', at: 0.55 },
    { id: 'burj', name: 'Burj Khalifa', at: 0.85 },
  ],
  EXTRA_STEP: 0.30,          // after the Burj Khalifa: another golden tiger every +30 % of E (no landmark)
  JACKPOT_FRAC: 0.2,         // a broken tiger spills 20 % of its life in candies
  LANDMARK_BONUS: 0.03,      // × E: the first team to break a landmark's tiger
  RESCALE_MS: 20000,         // late joiners in the intro or the first 20 s grow the ladder
  DURATIONS: [120, 180, 240],
  DURATION: 180,
};
const TEAMS = ['red', 'gold'];
const other = (t) => (t === 'red' ? 'gold' : 'red');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const { teamSizes, weights } = Mochi;
// A late joiner goes to the team with fewer connected kids; equal → the team that is behind (then Fuego).
const pickTeam = (players, m) => Mochi.pickTeam(players, m ? { totals: m.candy } : null);
const expected = (durationS, avgSize) => Math.max(20, Math.round(R.PER_KID_S * Math.max(10, durationS) * Math.max(1, avgSize)));
const frenzyMs = (durationS) => Math.round(Math.min(R.FRENZY_MS, Math.max(10, durationS) * 1000 * R.FRENZY_MAX_FRAC));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 30, 600);

// ---------- the ladder ----------
const frac = (i) => (i < R.TIERS.length ? R.TIERS[i].at : R.TIERS[R.TIERS.length - 1].at + R.EXTRA_STEP * (i - R.TIERS.length + 1));
// cumulative damage at which tiger i breaks (a tiger somebody already broke keeps its number for the other team)
function threshold(m, i) {
  if (i < 0) return 0;
  if (m.fixed[i] != null) return m.fixed[i];
  return Math.max(threshold(m, i - 1) + 3, Math.round(m.E * frac(i)));
}
const life = (m, i) => threshold(m, i) - threshold(m, i - 1);
const jackpot = (m, i) => Math.max(3, Math.round(R.JACKPOT_FRAC * life(m, i)));
const landmarkBonus = (m) => Math.max(2, Math.round(m.E * R.LANDMARK_BONUS));
const tierInfo = (i) => (i < R.TIERS.length ? { id: R.TIERS[i].id, name: R.TIERS[i].name, gold: i === R.TIERS.length - 1 } : { id: 'gold', name: 'Tigre de oro', gold: true });

// ---------- the meter ----------
// where the arrow is (0 … 1) c ms after it started, from the swing's random start (0 … 2: a triangle wave)
function needle(phase, c, half) {
  const u = (((phase || 0) + Math.max(0, c) / (half || R.HALF_MS)) % 2 + 2) % 2;
  return u <= 1 ? u : 2 - u;
}
// the grade of a position; `luck` = a critical only thanks to the comeback's wide golden zone
function gradeAt(pos, wide) {
  const d = Math.abs(pos - 0.5);
  if (d <= R.ZONE.crit) return { grade: 'crit', luck: false };
  if (wide && d <= R.ZONE.critWide) return { grade: 'crit', luck: true };
  if (d <= R.ZONE.strong) return { grade: 'strong', luck: false };
  if (d <= R.ZONE.good) return { grade: 'good', luck: false };
  return { grade: 'weak', luck: false };
}

// ---------- the game ----------
function newGame(seed, durationS, now, sizes) {
  const duration = clampDuration(durationS);
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  return {
    id: seed, seed, rng: Mochi.mulberry32(seed), duration,
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    playAt: 0, endsAt: 0, frenzyAt: 0, frenzy: false, endedAt: 0,
    paused: false, pausedAt: 0,
    candy: { red: 0, gold: 0 }, dmg: { red: 0, gold: 0 }, tier: { red: 0, gold: 0 }, w: weights(sizes || {}),
    E: expected(duration, avg), fixed: [],
    landmarks: R.TIERS.map((t, i) => ({ id: t.id, name: t.name, tier: i, team: null })),
    lead: null, announced: null, lastAlarm: -1e12, behind: null,
    nextHid: 1, nextBurst: 1, dirty: true, fx: {},
  };
}
// Kids who arrive in the intro or the first RESCALE_MS of play make the ladder longer (never shorter: a kid leaving
// doesn't break a tiger). Tigers somebody already broke keep their numbers (threshold → m.fixed).
function rescale(m, sizes, now) {
  if (!(m.phase === 'intro' || (m.phase === 'play' && now - m.playAt < R.RESCALE_MS))) return false;
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  const E = expected(m.duration, avg);
  if (E <= m.E) return false;
  m.E = E;
  m.dirty = true;
  return true;
}
const inGame = (m, p) => !!(m && p && p.pnGame === m.id);
function resetKid(p, m) {
  p.pnGame = m.id;
  p.pnCandy = 0; p.pnHits = 0; p.pnCrits = 0; p.pnRight = 0; p.pnWrong = 0; p.pnAnswered = 0; p.pnStreak = 0; p.pnBest = 0;
  p.pnFast = null; p.pnBehind = 0; p.pnBursts = 0; p.pnSwing = null; p.pnNextQAt = 0;
}
function join(m, p) { if (!inGame(m, p)) resetKid(p, m); }
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

// ---------- answers and the swing ----------
// A kid answered. ms = time since the question reached the server. Right → a swing opens (the arrow starts LEAD_MS
// after the phone gets it).
function answer(m, p, correct, ms, now) {
  if (!inGame(m, p)) join(m, p);
  p.pnAnswered++;
  if (!correct) {
    p.pnWrong++;
    p.pnStreak = 0;
    return { right: false, streak: 0, wait: R.WRONG_MS };
  }
  p.pnRight++;
  p.pnStreak++;
  p.pnBest = Math.max(p.pnBest, p.pnStreak);
  const human = Number.isFinite(ms) && ms >= R.FAST_MIN_MS;
  if (human) p.pnFast = p.pnFast == null ? ms : Math.min(p.pnFast, ms);
  const fast = human && ms <= R.FAST_MS;
  return { right: true, streak: p.pnStreak, swing: openSwing(m, p, now, fast) };
}
const streakBonus = (s) => (s >= R.STREAK2 ? 2 : s >= R.STREAK1 ? 1 : 0);
function openSwing(m, p, now, fast) {
  const wide = m.behind === p.team;
  const sw = {
    hid: m.nextHid++, sentAt: now, phase: Math.round(m.rng() * 2000) / 1000, wide, fast: !!fast,
    streak: p.pnStreak, bonus: (fast ? 1 : 0) + streakBonus(p.pnStreak), rtt: null, done: false,
  };
  p.pnSwing = sw;
  return {
    hid: sw.hid, lead: R.LEAD_MS, window: R.WINDOW_MS, half: R.HALF_MS, phase: sw.phase,
    crit: wide ? R.ZONE.critWide : R.ZONE.crit, strong: R.ZONE.strong, good: R.ZONE.good,
    wide, fast: sw.fast, streak: sw.streak, bonus: sw.bonus, frenzy: m.frenzy,
  };
}
// the phone acknowledged the swing's ping: that round trip is its latency for judging the tap
// The round trip used is the median of this phone's last 5 (one jittery sample doesn't move the judge). An ack that
// arrives while the teacher has paused is not a round trip (the swing's clock is held): ignored.
function ack(m, p, hid, now) {
  const sw = p.pnSwing;
  if (!sw || sw.done || sw.hid !== hid || sw.rtt != null || m.paused) return false;
  p.pnRtts = (p.pnRtts || []).concat(clamp(now - sw.sentAt, 0, R.RTT_MAX)).slice(-5);
  const sorted = p.pnRtts.slice().sort((a, b) => a - b);
  sw.rtt = sorted[Math.floor(sorted.length / 2)];
  return true;
}
const rttOf = (sw) => (sw.rtt != null ? sw.rtt : R.RTT_DEFAULT);
// after this the server closes the swing with an automatic hit (the phone vanished, or never tapped)
const closeAt = (sw) => sw.sentAt + R.LEAD_MS + R.WINDOW_MS + R.GRACE_MS + rttOf(sw);
// «¡FINAL!» cuts every open swing: a tap already on its way (≤ GRACE + its round trip) still counts
const cutAt = (m, sw) => (m.phase === 'final' ? Math.min(closeAt(sw), m.endedAt + R.GRACE_MS + rttOf(sw)) : closeAt(sw));

// The tap (or `auto`: the phone's window ran out, or the server closes it). c = ms since the phone's arrow started.
// Returns what happened, or null when the tap is not valid (no swing, wrong id, already hit, paused, game over).
function hit(m, p, hid, c, auto, now) {
  const sw = p.pnSwing;
  if (!sw || sw.done || (hid != null && sw.hid !== hid)) return null;
  if (m.paused || (m.phase !== 'play' && m.phase !== 'final')) return null;
  const late = now > cutAt(m, sw);
  let grade, luck = false, pos = null, used = null;
  if (auto || late) grade = 'auto';
  else {
    const est = now - sw.sentAt - R.LEAD_MS - rttOf(sw);
    let cc = Number(c);
    // the phone's own time only inside ± TOL of the server's estimate; anything else is graded where the server's clock
    // puts the tap (never at the band's edge: a far-off claim gains nothing)
    if (!Number.isFinite(cc) || Math.abs(cc - est) > R.TOL_MS) cc = est;
    cc = clamp(cc, 0, R.WINDOW_MS);
    used = Math.round(cc);
    pos = needle(sw.phase, cc, R.HALF_MS);
    const g = gradeAt(pos, sw.wide);
    grade = g.grade;
    luck = g.luck;
  }
  sw.done = true;
  p.pnSwing = null;
  const t = p.team, o = other(t);
  const mult = m.frenzy ? 2 : 1;
  const base = R.POWER[grade] + (grade === 'auto' ? 0 : sw.bonus);
  let value = base * mult;
  if (luck) {
    // the comeback cap: a critical that only came from the wider golden zone gets its extra over «fuerte» only up to the gap
    const extra = (R.POWER.crit - R.POWER.strong) * mult;
    const w = m.w[t] || 1;
    const gap = m.candy[o] - m.candy[t] - (value - extra) * w;
    const allowed = Math.max(0, Math.min(extra, Math.floor(Math.max(0, gap) / w)));
    value = value - extra + allowed;
  }
  const behind = m.candy[t] < m.candy[o];
  p.pnHits++;
  if (grade === 'crit') p.pnCrits++;
  p.pnCandy += value;
  if (behind) p.pnBehind += value;
  const w = m.w[t] || 1;
  m.candy[t] += value * w;
  m.dmg[t] += value * w;
  m.dirty = true;
  // broken tigers (a big hit can break more than one)
  const bursts = [];
  while (m.dmg[t] >= threshold(m, m.tier[t])) {
    const i = m.tier[t];
    if (m.fixed[i] == null) m.fixed[i] = threshold(m, i);
    const jp = jackpot(m, i);
    m.candy[t] += jp;
    const lm = m.landmarks[i];
    let bonus = 0;
    if (lm && !lm.team) { lm.team = t; lm.atMs = now; bonus = landmarkBonus(m); m.candy[t] += bonus; }
    m.tier[t] = i + 1;
    p.pnBursts++;
    bursts.push(Object.assign({ bid: m.nextBurst++, team: t, tier: i, jackpot: jp, landmark: bonus > 0, bonus, by: p.pnId || null }, tierInfo(i)));
  }
  m.fx[p.pnId] = m.fx[p.pnId] || [0, 0];
  m.fx[p.pnId][0] += value;
  if (grade === 'crit') m.fx[p.pnId][1] = 1;
  p.pnNextQAt = now + R.RESULT_MS + (bursts.length ? R.BURST_MS : 0);
  return { hid: sw.hid, grade, luck, pos, c: used, power: value, total: p.pnCandy, streak: p.pnStreak, crit: grade === 'crit', bursts };
}

// ---------- the room clock ----------
// Every tick (server: 250 ms) while playing: the lead (hysteresis + alarm gap), who trails (the wide golden zone),
// the frenzy. Returns { lead, frenzy }.
function tick(m, now) {
  const ev = { lead: null, frenzy: false };
  if (m.paused || m.phase !== 'play') return ev;
  const T = m.candy;
  const d = T.red - T.gold;
  const need = Math.max(R.LEAD_MIN, (T.red + T.gold) * R.LEAD_FRAC);
  if (Math.abs(d) >= need) m.lead = d > 0 ? 'red' : 'gold';
  if (m.lead && m.lead !== m.announced && now - m.lastAlarm >= R.LEAD_GAP_MS) {
    ev.lead = { team: m.lead, first: m.announced == null };
    m.announced = m.lead;
    m.lastAlarm = now;
  }
  const hi = Math.max(T.red, T.gold), lo = Math.min(T.red, T.gold);
  m.behind = hi - lo >= Math.max(R.BEHIND_MIN, hi * R.BEHIND_FRAC) ? (T.red < T.gold ? 'red' : 'gold') : null;
  if (!m.frenzy && now >= m.frenzyAt) { m.frenzy = true; ev.frenzy = true; }
  return ev;
}
// what the screens draw: candies, each team's tiger (index) and its life left / total
function display(m) {
  const out = { r: Math.round(m.candy.red), g: Math.round(m.candy.gold) };
  TEAMS.forEach((t) => {
    const i = m.tier[t];
    const top = threshold(m, i), lo = threshold(m, i - 1);
    out['t' + t[0]] = i;
    out['h' + t[0]] = Math.max(0, Math.round(top - m.dmg[t]));
    out['l' + t[0]] = Math.round(top - lo);
  });
  return out;   // { r, g, tr, tg, hr, hg, lr, lg }
}
const ladder = (m) => R.TIERS.map((t, i) => ({ id: t.id, name: t.name, team: m.landmarks[i].team, life: life(m, i), jackpot: jackpot(m, i), bonus: landmarkBonus(m) }));
// the teacher paused for `ms`: every pending moment moves by that much (open swings are moved by the server per kid)
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.lastAlarm += ms;
}
function shiftSwing(p, ms) {
  if (p.pnSwing) p.pnSwing.sentAt += ms;
  if (p.pnNextQAt) p.pnNextQAt += ms;
}
// «¡FINAL!»: no new swings; taps already in flight still count (cutAt)
function final(m, now) {
  m.phase = 'final';
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  m.endedAt = now;
}

// ---------- the end ----------
const STARS = [
  { id: 'hits', name: 'Más golpes', unit: 'golpes', val: (r) => r.hits, ok: (r) => r.hits >= 1, best: 'max' },
  { id: 'crits', name: 'Más críticos', unit: 'críticos', val: (r) => r.crits, ok: (r) => r.crits >= 1, best: 'max' },
  { id: 'fast', name: 'Respuesta más rápida', unit: 's', val: (r) => r.fast, ok: (r) => r.fast != null && r.right >= 1, best: 'min' },
  { id: 'streak', name: 'Racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 2, best: 'max' },
  { id: 'comeback', name: 'Gran remontada', unit: 'caramelos', val: (r) => r.behind, ok: (r) => r.behind >= 1, best: 'max' },
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
// rows: [{ k, name, skin, team, candy, hits, crits, right, answered, best, fast, behind, bursts }] of every kid who played
function finish(m, rows) {
  const d = display(m);
  const winner = d.r > d.g ? 'red' : d.g > d.r ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.candy - a.candy || b.hits - a.hits || a.k - b.k);
  sorted.forEach((r, i) => { r.rank = i > 0 && sorted[i - 1].candy === r.candy ? sorted[i - 1].rank : i + 1; });
  const raw = { red: 0, gold: 0 };
  rows.forEach((r) => { if (raw[r.team] != null) raw[r.team] += r.candy; });
  const mvp = {};
  TEAMS.forEach((t) => { const top = sorted.find((r) => r.team === t && r.candy > 0); mvp[t] = top ? top.k : null; });
  const st = stars(rows);
  rows.forEach((r) => {
    r.share = raw[r.team] ? Math.round((100 * r.candy) / raw[r.team]) : 0;
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return {
    totals: d, winner, raw, mvp, stars: st, rows: sorted,
    tiers: { red: m.tier.red, gold: m.tier.gold },
    landmarks: m.landmarks.map((l) => ({ id: l.id, name: l.name, team: l.team })),
  };
}

module.exports = {
  R, TEAMS, other, teamSizes, weights, pickTeam, expected, frenzyMs, clampDuration,
  threshold, life, jackpot, landmarkBonus, tierInfo, needle, gradeAt, streakBonus,
  newGame, rescale, inGame, resetKid, join, startPlay, addTime, answer, openSwing, ack, hit, closeAt, cutAt,
  tick, display, ladder, shiftTimes, shiftSwing, final, stars, finish, STARS,
};
