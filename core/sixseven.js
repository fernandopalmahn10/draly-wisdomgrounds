// 6-7 Swing v2 (gameType 'sixseven') — the rules, no sockets (server.js «6-7 SWING» block glues them to the room).
// «La Balanza de Oro»: rapid-fire sums whose answer is ALWAYS 6 or 7 (the kids' «six-seven» meme), two giant buttons on
// the phone, «6 · liu» and «7 · qi». Two teams (Fuego = 'red', Mar = 'gold') fill the pans of a giant golden balance on
// Dubai Creek: every right answer drops gold coins on the kid's team pan, and the balance tips toward the leader.
// The questions come from a generator (no question pack): only the numbers 1-10 and + / −, written with digits
// («Números»), with pinyin number words without tone marks («En Chino»: san + si), or both in turns («Mezcla»).
// Anti-spam (two buttons invite random tapping, so random tapping must lose to thinking): the server judges every
// answer; a tap faster than MIN_THINK_MS after the question reached the server counts as wrong; a wrong answer costs a
// wait (longer after two in a row) and the streak; the coins of a right answer are the streak multiplier (×1 … ×4), so
// a guesser at 50 % rarely climbs past ×1 while a kid who thinks does. Team totals are weighted by team size, the
// trailing team gets golden questions more often (their extra capped at the gap), four Dubai landmarks go to the first
// team that reaches them, the last 30 s count double, and the end is a Mario Party ceremony (finish / stars).
// Spec: docs/specs/six-seven-v2.md. Player fields carry an `ss` prefix; the game object is `m` (server: g.ss).
'use strict';

const Mochi = require('./mochi');      // shared team helpers: teamSizes, weights, pickTeam, mulberry32

const R = {
  INTRO_MS: 2800,            // «¡Toca el resultado!» → «¿Listos?» → «¡YA!» after the 3.5 s run-in countdown
  FINAL_MS: 2400,            // «¡FINAL!» before the ceremony (game-end)
  Q_MS: 12000,               // the phone's clock for one question (time up = a wrong answer)
  RIGHT_MS: 650,             // a right answer: the in-between beat (the coin lands in the team's pan, the phone does the
                             // 6-7 swing, the next sum swings in). Was 500 until 2026-10-16: "there's nothing in between"
  WRONG_MS: 1600,            // a wrong answer / time up: the wobble + «Era 7 · qi», then the next question
  WRONG2_MS: 2600,           // …a second wrong in a row waits longer («¡Respira! Piensa y toca»)
  MIN_THINK_MS: 400,         // nobody reads a sum and taps faster (server clock, round trip included): a tap under this is wrong
  GOLD_CHANCE: 0.08,         // a question is golden (+GOLD_BONUS when right)…
  GOLD_CHANCE_BEHIND: 0.25,  // …more often for the team that trails (the comeback rule)
  GOLD_BONUS: 5,             // ×2 in the last 30 s; while the team trails, capped at the gap
  STREAK: [3, 6, 10],        // racha: ×2 coins from 3 right in a row, ×3 from 6, ×4 from 10
  FRENZY_MS: 30000,          // the last 30 s: every coin counts ×2
  FRENZY_MAX_FRAC: 1 / 3,    // (a very short game: the last third)
  LEAD_MIN: 4, LEAD_FRAC: 0.03, LEAD_GAP_MS: 7000,   // a lead counts at ≥ 4 coins and ≥ 3 % of the total; alarms ≥ 7 s apart
  BEHIND_MIN: 10, BEHIND_FRAC: 0.15,                 // trailing (for golden questions): ≥ 10 and ≥ 15 % of the leader
  PER_KID_S: 0.90,           // E per kid per second of play (calibrates the landmarks). A simulated class (2-5 s a sum,
                             // 70-95 % right) makes ~0.65 coins per kid per second (0.90 since the 650 ms beat: was 0.95 at
                             // 500 ms); E sits above that so the Burj Khalifa
                             // takes a team that plays well (~30 % of 300 simulated classes, scripts/test-sixseven.js)
  LANDMARKS: [
    { id: 'museum', name: 'Museo del Futuro', at: 0.12 },
    { id: 'frame', name: 'Marco de Dubái', at: 0.32 },
    { id: 'arab', name: 'Burj Al Arab', at: 0.58 },
    { id: 'burj', name: 'Burj Khalifa', at: 0.88 },
  ],
  LANDMARK_BONUS: 0.04,      // × the expected team total
  RESCALE_MS: 20000,         // late joiners in the intro or the first 20 s of play grow the race (rescale)
  FAST_MIN_MS: 400,          // the fastest-answer star ignores times under this
  // «¡SIX SEVEN!» moments (the kids' meme, felt DURING play, his ask 2026-10-16). Cosmetic: they never change the gold.
  SIX_STREAK: 7,             // a kid's racha reaches 7 (the 6th right was ×3, the 7th is «six seven»)
  SIX_COINS: 67,             // a kid's 67th coin
  WAVE_FIRST: 67,            // a team's «¡SIX SEVEN!» wave: the first when its gold reaches 67…
  WAVES_PER_E: 3,            // …then every ~E ÷ 3 more, rounded to a multiple of 67: ~2-3 waves a team, any class or length
  WAVE_GAP_MS: 12000,        // a team's waves at least 12 s apart (a landmark bonus right after a wave waits its turn)
  DURATIONS: [120, 180, 240],
  DURATION: 120,
  STYLES: ['num', 'zh', 'mix'],
  STYLE: 'mix',
};
const TEAMS = ['red', 'gold'];
const other = (t) => (t === 'red' ? 'gold' : 'red');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const { teamSizes, weights, mulberry32 } = Mochi;
const pickTeam = (players, m) => Mochi.pickTeam(players, m ? { totals: m.totals } : null);
const expected = (durationS, avgSize) => Math.max(20, Math.round(R.PER_KID_S * Math.max(10, durationS) * Math.max(1, avgSize)));
const frenzyMs = (durationS) => Math.round(Math.min(R.FRENZY_MS, Math.max(10, durationS) * 1000 * R.FRENZY_MAX_FRAC));
const clampDuration = (s) => clamp(Math.round(Number(s) || R.DURATION), 30, 600);
// the gold between two «¡SIX SEVEN!» waves of a team, from the expected team total E: ~E ÷ 3 rounded to a multiple of
// 67 (67 for a tiny class, 536 for teams of 15 in 2 minutes): the waves stay a moment, not a drone, and every wave
// lands on a multiple of 67.
const waveStep = (E) => R.WAVE_FIRST * Math.max(1, Math.round(Math.max(1, E) / (R.WAVE_FIRST * R.WAVES_PER_E)));
const waveAt = (m, n) => (n <= 0 ? R.WAVE_FIRST : R.WAVE_FIRST + n * m.waveStep);
const cleanStyle = (s) => (R.STYLES.includes(s) ? s : R.STYLE);

// ---------- the questions ----------
// pinyin of 0-10, WITHOUT tone marks (games' rule: CLAUDE.md «Pinyin without tone marks in games»)
const PINYIN = ['ling', 'yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu', 'shi'];
const MINUS = '−';          // U+2212, the real minus sign (a hyphen looks like a dash on a phone)
// every sum whose answer is 6 or 7 with numbers 1-10 only: a + b (a, b ≥ 1) and a − b (a ≤ 10, b ≥ 1)
const POOL = (() => {
  const out = [];
  [6, 7].forEach((ans) => {
    for (let a = 1; a < ans; a++) out.push({ a, b: ans - a, op: '+', ans });
    for (let a = ans + 1; a <= 10; a++) out.push({ a, b: a - ans, op: '-', ans });
  });
  return out;
})();
const key = (e) => e.a + e.op + e.b;
// how one sum is written: «3 + 4» (num) or «san + si» (zh)
function write(e, zh) {
  const w = (n) => (zh ? PINYIN[n] : String(n));
  return w(e.a) + ' ' + (e.op === '+' ? '+' : MINUS) + ' ' + w(e.b);
}
// The next sum for a kid: 6 or 7 with the same chance (a guess is right half the time, never more), addition a little
// more often than subtraction, never the same sum twice in a row. `n` = how many this kid has had (Mezcla alternates).
function makeQuestion(rng, style, n, prevKey) {
  const zh = style === 'zh' || (style === 'mix' && n % 2 === 1);
  const ans = rng() < 0.5 ? 6 : 7;
  const sub = rng() < 0.4;
  const list = POOL.filter((e) => e.ans === ans && (e.op === '-') === sub && key(e) !== prevKey);
  const e = list[Math.floor(rng() * list.length)];
  return { a: e.a, b: e.b, op: e.op, ans: e.ans, zh, text: write(e, zh), key: key(e) };
}

// ---------- the game ----------
function newGame(seed, durationS, now, sizes, style) {
  const duration = clampDuration(durationS);
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  const E = expected(duration, avg);
  return {
    id: seed, seed, rng: mulberry32(seed), duration, style: cleanStyle(style),
    phase: 'intro', phaseAt: now, phaseUntil: now + R.INTRO_MS,
    playAt: 0, endsAt: 0, frenzyAt: 0, frenzy: false, endedAt: 0,
    paused: false, pausedAt: 0,
    totals: { red: 0, gold: 0 }, raw: { red: 0, gold: 0 }, w: weights(sizes || {}),
    E, landmarks: R.LANDMARKS.map((l) => ({ id: l.id, name: l.name, at: Math.max(4, Math.round(E * l.at)), bonus: Math.max(2, Math.round(E * R.LANDMARK_BONUS)), team: null })),
    lead: null, announced: null, lastAlarm: -1e12, behind: null,
    waves: { red: 0, gold: 0 }, waveStep: waveStep(E), waveLast: { red: -1e12, gold: -1e12 },
    nextQid: 1, dirty: true, fx: {},
  };
}
// Kids who arrive in the intro or the first RESCALE_MS of play make the race longer (never shorter).
function rescale(m, sizes, now) {
  if (!(m.phase === 'intro' || (m.phase === 'play' && now - m.playAt < R.RESCALE_MS))) return false;
  const avg = Math.max(1, ((sizes && sizes.red) || 0) + ((sizes && sizes.gold) || 0)) / 2;
  const E = expected(m.duration, avg);
  if (E <= m.E) return false;
  m.E = E;
  m.waveStep = Math.max(m.waveStep || 0, waveStep(E));       // the next waves only (a wave already shouted stays)
  m.landmarks.forEach((l) => {
    if (l.team) return;
    const d = R.LANDMARKS.find((x) => x.id === l.id);
    l.at = Math.max(4, Math.round(E * d.at));
    l.bonus = Math.max(2, Math.round(E * R.LANDMARK_BONUS));
  });
  m.dirty = true;
  return true;
}
const inGame = (m, p) => !!(m && p && p.ssGame === m.id);
function resetKid(p, m) {
  p.ssGame = m.id;
  p.ssCoins = 0; p.ssRight = 0; p.ssWrong = 0; p.ssAnswered = 0; p.ssStreak = 0; p.ssBest = 0; p.ssMisses = 0;
  p.ssFast = null; p.ssBehind = 0; p.ssGolds = 0; p.ssZh = 0; p.ssN = 0; p.ssPrev = null; p.ssNextQAt = 0; p.ssQ = null;
  p.ssLastRight = 0;          // the answer (6 or 7) of the kid's last sum when it was right, else 0 (the 6 → 7 pair)
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

// A kid's next sum. The golden chance is higher while the kid's team trails. Returns the question as the phone gets it
// (the answer is NOT in it) and keeps the answer on the kid (p.ssQ).
function deal(m, p, now) {
  if (!inGame(m, p)) join(m, p);
  const q = makeQuestion(m.rng, m.style, p.ssN, p.ssPrev);
  const gold = m.rng() < (m.behind === p.team ? R.GOLD_CHANCE_BEHIND : R.GOLD_CHANCE);
  p.ssN++;
  p.ssPrev = q.key;
  p.ssNextQAt = 0;
  p.ssQ = { qid: 'q-67-' + m.id + '-' + (m.nextQid++), ans: q.ans, zh: q.zh, gold, at: now, text: q.text, a: q.a, b: q.b, op: q.op };
  return {
    qid: p.ssQ.qid, text: q.text + ' = ?', answers: ['6', '7'], gameMode: 'sixseven',
    // min: the too-fast line, so the phone can show a verdict the moment the kid taps (a wrong button, or the right one
    // after `min` ms, is certain; the server's verdict still decides the coins and corrects the phone if it ever differs)
    ss: { a: q.a, b: q.b, op: q.op, zh: q.zh, gold, ms: R.Q_MS, min: R.MIN_THINK_MS, n: p.ssN, words: q.zh ? [PINYIN[q.a], PINYIN[q.b]] : null },
  };
}
const streakMult = (s) => (s >= R.STREAK[2] ? 4 : s >= R.STREAK[1] ? 3 : s >= R.STREAK[0] ? 2 : 1);

// A kid answered the open sum. choice = 6 / 7 (anything else = time up). Returns what the phone shows and how long
// until the next sum, or null when no sum is open.
function answer(m, p, choice, now) {
  if (!inGame(m, p)) join(m, p);
  const q = p.ssQ;
  if (!q) return null;
  p.ssQ = null;
  const ms = now - q.at;
  const timeUp = choice !== 6 && choice !== 7;
  const tooFast = !timeUp && ms < R.MIN_THINK_MS;
  const right = !timeUp && !tooFast && choice === q.ans;
  p.ssAnswered++;
  const base = { qid: q.qid, ans: q.ans, word: PINYIN[q.ans], text: q.text, zh: q.zh, gold: q.gold, choice: timeUp ? null : choice, ms };
  if (!right) {
    p.ssWrong++;
    p.ssStreak = 0;
    p.ssLastRight = 0;
    p.ssMisses = (p.ssMisses || 0) + 1;
    const wait = p.ssMisses >= 2 ? R.WRONG2_MS : R.WRONG_MS;
    p.ssNextQAt = now + wait;
    if (p.ssId != null) { m.fx[p.ssId] = m.fx[p.ssId] || [0, 0, 0, 0]; m.fx[p.ssId][2] = 1; }   // the projector: a wobble
    return Object.assign(base, { right: false, timeUp, tooFast, calm: p.ssMisses >= 2, wait, streak: 0, coins: 0, total: p.ssCoins, six: 0, pair: false });
  }
  p.ssMisses = 0;
  p.ssRight++;
  p.ssStreak++;
  // «six seven» in a row: this right answer is 7 and the one just before it (also right) was 6
  const pair = p.ssLastRight === 6 && q.ans === 7;
  p.ssLastRight = q.ans;
  const coinsBefore = p.ssCoins;
  p.ssBest = Math.max(p.ssBest, p.ssStreak);
  if (q.zh) p.ssZh++;
  if (ms >= R.FAST_MIN_MS) p.ssFast = p.ssFast == null ? ms : Math.min(p.ssFast, ms);
  const mult = streakMult(p.ssStreak);
  const fx = m.frenzy ? 2 : 1;
  let value = mult * fx;
  let goldExtra = 0;
  const t = p.team, o = other(t);
  if (q.gold) {
    goldExtra = R.GOLD_BONUS * fx;
    // the comeback cap: while the team trails, the golden extra can close the gap, never jump it
    if (m.totals[t] < m.totals[o]) {
      const w = m.w[t] || 1;
      const gap = m.totals[o] - m.totals[t] - value * w;
      goldExtra = Math.max(0, Math.min(goldExtra, Math.floor(Math.max(0, gap) / w)));
    }
    p.ssGolds++;
  }
  value += goldExtra;
  credit(m, p, value);
  // the kid's own «¡SIX SEVEN!»: 1 = racha 7, 2 = the 67th coin (both on one answer = 3)
  const six = (p.ssStreak === R.SIX_STREAK ? 1 : 0) | (coinsBefore < R.SIX_COINS && p.ssCoins >= R.SIX_COINS ? 2 : 0);
  if (p.ssId != null) {                // the screens' feed: who scored since the last tick (and who just did a «six seven»)
    m.fx[p.ssId] = m.fx[p.ssId] || [0, 0, 0, 0];
    m.fx[p.ssId][0] += value;
    if (q.gold && goldExtra > 0) m.fx[p.ssId][1] = 1;   // (a golden coin on the screens only when the extra was paid)
    m.fx[p.ssId][3] |= six;
  }
  p.ssNextQAt = now + R.RIGHT_MS;
  return Object.assign(base, { right: true, streak: p.ssStreak, mult, frenzy: m.frenzy, goldExtra, coins: value, total: p.ssCoins, wait: R.RIGHT_MS, six, pair });
}
function credit(m, p, value) {
  const t = p.team;
  if (m.totals[t] == null) return;
  if (m.totals[t] < m.totals[other(t)]) p.ssBehind += value;     // coins while the team was behind (Gran remontada)
  p.ssCoins += value;
  m.raw[t] += value;
  m.totals[t] += value * (m.w[t] || 1);
  m.dirty = true;
}

// ---------- the room clock ----------
// Every tick while playing: the landmark race, the lead (hysteresis + alarm gap), who trails, the frenzy.
function tick(m, now) {
  const ev = { lead: null, landmarks: [], frenzy: false, waves: [] };
  if (m.paused || m.phase !== 'play') return ev;
  const T = m.totals;
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
  // a team's «¡SIX SEVEN!» wave: its gold (as the screens show it) passed the next mark (67, then every waveStep).
  // One wave per team per tick, naming the highest mark passed (a landmark bonus can jump two marks at once), and a
  // team's waves at least WAVE_GAP_MS apart (marks passed during the gap come together in one wave naming the highest).
  if (!m.waves) m.waves = { red: 0, gold: 0 };
  if (!m.waveLast) m.waveLast = { red: -1e12, gold: -1e12 };
  if (!m.waveStep) m.waveStep = waveStep(m.E);
  TEAMS.forEach((t) => {
    if (now - m.waveLast[t] < R.WAVE_GAP_MS) return;
    const v = Math.round(T[t]);
    let n = m.waves[t] || 0, mark = 0;
    while (v >= waveAt(m, n)) { mark = waveAt(m, n); n++; }
    if (!mark) return;
    m.waves[t] = n;
    m.waveLast[t] = now;
    ev.waves.push({ team: t, n, gold: mark });
  });
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
const display = (m) => ({ r: Math.round(m.totals.red), g: Math.round(m.totals.gold) });
// the balance: how far the beam tips (−1 … 1, + = toward Mar), from the share of the gold (a dead heat = level)
function tilt(r, g) {
  const sum = (r || 0) + (g || 0);
  if (!sum) return 0;
  return clamp(((g || 0) - (r || 0)) / Math.max(sum, 12) * 3.2, -1, 1);
}
const race = (m) => m.landmarks.map((l) => ({ id: l.id, name: l.name, at: l.at, bonus: l.bonus, team: l.team }));
// the teacher paused for `ms`: every pending moment moves by that much (each kid's waits are moved by shiftKid)
function shiftTimes(m, ms) {
  m.phaseAt += ms;
  m.phaseUntil += ms;
  if (m.endsAt) m.endsAt += ms;
  if (m.frenzyAt) m.frenzyAt += ms;
  m.lastAlarm += ms;
  if (m.waveLast) { m.waveLast.red += ms; m.waveLast.gold += ms; }
}
function shiftKid(p, ms) {
  if (p.ssNextQAt) p.ssNextQAt += ms;
  if (p.ssQ) p.ssQ.at += ms;        // a pause is no thinking time lost (nor a «too fast» trap)
}
// «¡FINAL!»: no new sums; an answer already on its way still counts (server: FINAL grace)
function final(m, now) {
  m.phase = 'final';
  m.phaseAt = now;
  m.phaseUntil = now + R.FINAL_MS;
  m.endedAt = now;
}

// ---------- the end ----------
const STARS = [
  { id: 'right', name: 'Más aciertos', unit: 'aciertos', val: (r) => r.right, ok: (r) => r.right >= 1, best: 'max' },
  { id: 'streak', name: 'Racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3, best: 'max' },
  { id: 'aim', name: 'Mejor puntería', unit: '%', val: (r) => (r.answered ? Math.round((100 * r.right) / r.answered) : 0), ok: (r) => r.answered >= 5 && r.right >= 1, best: 'max' },
  // the fastest answer of a kid who thinks (a guesser who got lucky once doesn't win it)
  { id: 'fast', name: 'Respuesta más rápida', unit: 's', val: (r) => r.fast, ok: (r) => r.fast != null && r.right >= 3 && r.right >= 0.6 * r.answered, best: 'min' },
  { id: 'zh', name: 'Experto en Chino Mandarín', unit: 'en Chino Mandarín', val: (r) => r.zh, ok: (r) => r.zh >= 1, best: 'max' },
  { id: 'comeback', name: 'Gran remontada', unit: 'monedas', val: (r) => r.behind, ok: (r) => r.behind >= 1, best: 'max' },
];
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
// rows: [{ k, name, skin, team, coins, right, answered, best, fast, behind, zh, golds }] of every kid who played
function finish(m, rows) {
  const d = display(m);
  const winner = d.r > d.g ? 'red' : d.g > d.r ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.coins - a.coins || b.right - a.right || a.k - b.k);
  sorted.forEach((r, i) => { r.rank = i > 0 && sorted[i - 1].coins === r.coins ? sorted[i - 1].rank : i + 1; });
  const raw = { red: 0, gold: 0 };
  rows.forEach((r) => { if (raw[r.team] != null) raw[r.team] += r.coins; });
  const mvp = {};
  TEAMS.forEach((t) => { const top = sorted.find((r) => r.team === t && r.coins > 0); mvp[t] = top ? top.k : null; });
  const st = stars(rows);
  rows.forEach((r) => {
    r.share = raw[r.team] ? Math.round((100 * r.coins) / raw[r.team]) : 0;
    r.aim = r.answered ? Math.round((100 * r.right) / r.answered) : 0;
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return {
    totals: d, winner, raw, mvp, stars: st, rows: sorted, style: m.style,
    landmarks: m.landmarks.map((l) => ({ id: l.id, name: l.name, team: l.team })),
  };
}

module.exports = {
  R, TEAMS, other, teamSizes, weights, pickTeam, expected, frenzyMs, clampDuration, cleanStyle, waveStep, waveAt,
  PINYIN, MINUS, POOL, write, makeQuestion, streakMult,
  newGame, rescale, inGame, resetKid, join, startPlay, addTime, deal, answer, tick, display, tilt, race,
  shiftTimes, shiftKid, final, stars, finish, STARS,
};
