// Dragones Pintores v2 «El Cielo de las Maravillas» (gameType 'paint') — the rules, no sockets (spec
// docs/specs/dragones-pintores-v2.md). The sky comes from public/js/paint-worlds.js (the same file the screens draw).
// The server moves every dragon itself: a kid's tap is only an intent (a target), clamped to the sky; each tick the
// dragon flies toward it at a fixed speed, burning fire, and paints every cloud its brush touches on the way. The three
// landmark islands are captured by staying inside their ring (a meter per island). Score: clouds + 10 per island held.
'use strict';

const PW = require('../public/js/paint-worlds');

const R = {
  TICK_MS: 100,            // the server's flight step (10 Hz); positions go out every other tick (5 Hz)
  SPEED: 300,              // world units a second (the sky is 1600 wide: ~5 s across)
  BLAZE_SPEED: 360,        // in a «¡Llamarada!»
  BRUSH: 22,               // how far past a cloud's edge a dragon paints it
  BLAZE_BRUSH: 60,         // the wide brush of a Llamarada
  FLIP_MS: 1500,           // a cloud can't change colour again for 1.5 s (no farming by flying back and forth)
  START_FIRE: 15,          // seconds of flight at the start (and for a late joiner)
  ENERGY_PER_RIGHT: 10,    // a right answer (twice in the last 30 s)
  ENERGY_MAX: 30,
  BLAZE_MS: 6000,
  LM_RATE: 0.15,           // an island's meter per second per dragon inside (1 = captured: ~6.7 s alone, ~2.2 s for three)
  LM_COUNT: 3,             // at most 3 dragons of a kingdom count on one island (no mob of 15)
  LM_VALUE: 10,            // points an island is worth to the kingdom holding it
  COMEBACK_GAP: 12,        // «Viento a favor» while a kingdom trails by this much or more
  COMEBACK_MAX: 3,         // clouds a gust blows over (never more than ⌊(gap − 1) / 2⌋)
  WIND_EVERY_MS: 20000,    // at most one gust per kingdom every 20 s (a moment, not a constant push)
  GO_RATE: 12,             // tap intents a second a phone may send (the rest are dropped)
  TOO_FAST_MS: 450,        // an answer faster than this after the question = a guess = wrong
  WRONG_WAIT_MS: 2600,     // «¡Casi!»: the next question waits this long (the phone shows the right answer)
  WRONG_WAIT2_MS: 4200,    // …and longer after two wrong in a row
  Q_SERVER_MS: 23000,      // a question nobody answers is closed as «time up» by the server (the phone says 20 s)
  MARGIN: 34,              // a target stays this far inside the sky
};
const ENERGY_PER_RIGHT = R.ENERGY_PER_RIGHT, ENERGY_MAX = R.ENERGY_MAX;
const WORLDS = PW.WORLDS;
const buildSky = (world, seed) => PW.build(world, seed);
const other = (t) => (t === 'red' ? 'gold' : 'red');

// ---------- the board: who owns each cloud and island ----------
const CELL = 100;
function buildGrid(sky) {
  const cols = Math.ceil(sky.w / CELL), rows = Math.ceil(sky.h / CELL);
  const cells = Array.from({ length: cols * rows }, () => []);
  sky.clouds.forEach(([x, y, r], i) => {
    const pad = r + R.BLAZE_BRUSH + 2;
    for (let cy = Math.max(0, Math.floor((y - pad) / CELL)); cy <= Math.min(rows - 1, Math.floor((y + pad) / CELL)); cy++) {
      for (let cx = Math.max(0, Math.floor((x - pad) / CELL)); cx <= Math.min(cols - 1, Math.floor((x + pad) / CELL)); cx++) cells[cy * cols + cx].push(i);
    }
  });
  return { cols, rows, cells };
}
function newBoard(sky) {
  const n = sky.clouds.length;
  return {
    sky, grid: buildGrid(sky),
    own: new Array(n).fill(null),        // 'red' | 'gold' | null
    by: new Array(n).fill(null),         // the key (lower-case name) of the kid who painted it last
    flipAt: new Array(n).fill(0),
    lm: sky.lms.map(() => ({ v: 0, owner: null, n: [0, 0] })),   // v: -1 (Mar) … 0 … +1 (Fuego)
    flips: [],                           // [[cloud, team]] since the last broadcast
    events: [],                          // captures / losses since the last broadcast
    windAt: { red: -1e15, gold: -1e15 }, // each kingdom's last «Viento a favor» gust
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// a tap → a target inside the sky (non-numbers → null: the intent is refused)
function clampTarget(sky, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [clamp(x, R.MARGIN, sky.w - R.MARGIN), clamp(y, R.MARGIN + 20, sky.h - R.MARGIN - 40)];
}
// where a kid starts: its kingdom's home cloud, spread a little by its number
function spawn(sky, team, n) {
  const h = sky.homes[team] || sky.homes.red;
  const i = Math.abs(Number(n) || 0) % 9;
  return [h[0] + ((i % 3) - 1) * 26 * (team === 'red' ? 1 : -1), h[1] + (Math.floor(i / 3) - 1) * 46];
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const L = dx * dx + dy * dy;
  const t = L > 0 ? clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}
// paint every cloud the brush touches between (x0, y0) and (x1, y1)
function paintPath(b, d, x0, y0, x1, y1, brush, now) {
  const g = b.grid;
  const seen = new Set();
  const len = Math.hypot(x1 - x0, y1 - y0);
  const parts = Math.max(1, Math.ceil(len / 40));
  for (let k = 0; k <= parts; k++) {
    const px = x0 + ((x1 - x0) * k) / parts, py = y0 + ((y1 - y0) * k) / parts;
    const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) continue;
    g.cells[cy * g.cols + cx].forEach((i) => seen.add(i));
  }
  let n = 0;
  seen.forEach((i) => {
    if (b.own[i] === d.team) return;
    const [cx, cy, r] = b.sky.clouds[i];
    if (segDist(cx, cy, x0, y0, x1, y1) > r + brush) return;
    if (now - b.flipAt[i] < R.FLIP_MS) return;       // just changed colour: not yet
    b.own[i] = d.team;
    b.by[i] = d.key;
    b.flipAt[i] = now;
    b.flips.push([i, d.team]);
    d.strokes = (d.strokes || 0) + 1;
    n++;
  });
  return n;
}

// One dragon's step: fly toward the target at the fixed speed while there is fire, burning it, painting on the way.
// d: { key, team, x, y, tx, ty, fire, blazeUntil, strokes } (the server keeps these on the player)
function stepDragon(b, d, dt, now) {
  d.burnt = 0;
  d.moving = false;
  if (d.away || !(d.fire > 0)) return 0;
  const dx = d.tx - d.x, dy = d.ty - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return 0;
  const blaze = (d.blazeUntil || 0) > now;
  const sp = blaze ? R.BLAZE_SPEED : R.SPEED;
  const step = Math.min(dist, sp * Math.min(dt, d.fire));
  const x0 = d.x, y0 = d.y;
  if (step >= dist - 1e-6) { d.x = d.tx; d.y = d.ty; } else { d.x += (dx / dist) * step; d.y += (dy / dist) * step; }
  const t = step / sp;
  d.fire = Math.max(0, d.fire - t);
  d.burnt = t;
  d.moving = step > 0;
  if (d.fire <= 0) { d.tx = d.x; d.ty = d.y; }        // out of fire: it stops here (no forgotten target after the recharge)
  if (dx < -0.5) d.face = -1; else if (dx > 0.5) d.face = 1;
  paintPath(b, d, x0, y0, d.x, d.y, blaze ? R.BLAZE_BRUSH : R.BRUSH, now);
  return step;
}

// The islands: dragons with fire inside a ring push its meter toward their kingdom (at most LM_COUNT each side count);
// whoever is inside an island that isn't fully theirs (or is contested) burns fire like flying. Full = captured.
function stepIslands(b, dragons, dt) {
  b.sky.lms.forEach((l, i) => {
    const s = b.lm[i];
    const inside = { red: [], gold: [] };
    dragons.forEach((d) => { if (!d.away && d.fire > 0 && (d.team === 'red' || d.team === 'gold') && Math.hypot(d.x - l.x, d.y - l.y) <= l.r) inside[d.team].push(d); });
    s.n = [inside.red.length, inside.gold.length];
    const contested = inside.red.length > 0 && inside.gold.length > 0;
    ['red', 'gold'].forEach((t) => {
      const full = t === 'red' ? s.v >= 1 : s.v <= -1;
      if (full && !contested) return;
      inside[t].forEach((d) => {
        const extra = Math.max(0, dt - (d.burnt || 0));
        d.fire = Math.max(0, d.fire - extra);
        d.burnt = (d.burnt || 0) + extra;
      });
    });
    const push = Math.min(R.LM_COUNT, inside.red.length) - Math.min(R.LM_COUNT, inside.gold.length);
    if (!push) return;
    const before = s.v;
    s.v = clamp(s.v + push * R.LM_RATE * dt, -1, 1);
    if (s.v >= 1 && s.owner !== 'red') {
      const from = s.owner;
      s.owner = 'red';
      inside.red.forEach((d) => { d.lms = (d.lms || 0) + 1; });
      b.events.push({ type: 'capture', lm: i, team: 'red', from, keys: inside.red.map((d) => d.key) });
    } else if (s.v <= -1 && s.owner !== 'gold') {
      const from = s.owner;
      s.owner = 'gold';
      inside.gold.forEach((d) => { d.lms = (d.lms || 0) + 1; });
      b.events.push({ type: 'capture', lm: i, team: 'gold', from, keys: inside.gold.map((d) => d.key) });
    } else if (s.owner === 'red' && before > 0 && s.v <= 0) {
      s.owner = null;
      b.events.push({ type: 'lost', lm: i, team: 'red', by: 'gold' });
    } else if (s.owner === 'gold' && before < 0 && s.v >= 0) {
      s.owner = null;
      b.events.push({ type: 'lost', lm: i, team: 'gold', by: 'red' });
    }
  });
}

// The whole sky for one tick: every dragon (in a shuffled order, so no kingdom always paints a contested cloud first),
// then the islands.
function step(b, dragons, dt, now, rand) {
  const r = rand || Math.random;
  const order = dragons.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  order.forEach((d) => stepDragon(b, d, dt, now));
  stepIslands(b, dragons, dt);
}

// a kingdom's points: its clouds + LM_VALUE per island it holds now
function totals(b) {
  const c = { red: 0, gold: 0 };
  b.own.forEach((t) => { if (t === 'red' || t === 'gold') c[t]++; });
  const out = { red: c.red, gold: c.gold, clouds: { red: c.red, gold: c.gold }, lms: { red: 0, gold: 0 } };
  b.lm.forEach((s) => { if (s.owner) { out[s.owner] += R.LM_VALUE; out.lms[s.owner]++; } });
  return out;
}
// clouds that are each kid's now (the last painter of each cloud), by key
function cloudsBy(b) {
  const c = {};
  b.by.forEach((k, i) => { if (k && b.own[i]) c[k] = (c[k] || 0) + 1; });
  return c;
}
// «Viento a favor»: a right answer of a kid whose kingdom trails by COMEBACK_GAP or more blows its fire onto the rival
// clouds nearest its dragon: up to COMEBACK_MAX, never more than ⌊(gap − 1) / 2⌋ (each flip is a 2-point swing), so it
// can never put the trailing kingdom level or ahead by itself. Returns the cloud ids (the caller applies them).
function comeback(b, team, x, y, now) {
  if (now - ((b.windAt && b.windAt[team]) || -1e15) < R.WIND_EVERY_MS) return [];
  const t = totals(b);
  const gap = (t[other(team)] || 0) - (t[team] || 0);
  if (gap < R.COMEBACK_GAP) return [];
  const n = Math.min(R.COMEBACK_MAX, Math.floor((gap - 1) / 2));
  if (n <= 0) return [];
  const cand = [];
  b.sky.clouds.forEach(([cx, cy], i) => { if (b.own[i] === other(team) && now - b.flipAt[i] >= R.FLIP_MS) cand.push([Math.hypot(cx - x, cy - y), i]); });
  cand.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  return cand.slice(0, n).map((c) => c[1]);
}
function applyFlips(b, ids, team, key, now) {
  if (ids.length && b.windAt) b.windAt[team] = now;
  ids.forEach((i) => { b.own[i] = team; b.by[i] = key; b.flipAt[i] = now; b.flips.push([i, team]); });
}

// A right answer: «¡Fuego doble!» in the last 30 s gives twice the fire and always a Llamarada (the wide brush); 3 in a
// row gives a Llamarada any time.
function reward(streak, frenzy) {
  return { energy: ENERGY_PER_RIGHT * (frenzy ? 2 : 1), blaze: !!frenzy || (streak > 0 && streak % 3 === 0) };
}
const tooFast = (sentAt, now) => !!sentAt && now - sentAt < R.TOO_FAST_MS;

// ---------- the ending (core/party.js: «¡FINAL!», the reveal, the winners, the bonus stars, each kid's card) ----------
// rows: [{ k, name, skin, team, owned, painted, lms, best, blazes, right, answered }]
//   owned    clouds that are this kid's at the end (the last painter of each one): the kid's points, the crown
//   painted  every cloud they turned their colour during the round (strokes)
//   lms      islands their kingdom captured while they were inside the ring
// Four stars at most (core/party.js MAX_STARS). v2 swaps v1's «Más cielo al final» (the same number as the podium) for
// «Conquista maravillas» (the islands).
const STARS = [
  { id: 'painted', name: 'Más nubes pintadas', unit: 'nubes', val: (r) => r.painted, ok: (r) => r.painted >= 1 },
  { id: 'lm', name: 'Conquista maravillas', unit: 'maravillas', val: (r) => r.lms || 0, ok: (r) => (r.lms || 0) >= 1 },
  { id: 'streak', name: 'Racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3 },
  { id: 'blaze', name: 'Más llamaradas', unit: 'llamaradas', val: (r) => r.blazes, ok: (r) => r.blazes >= 1, maxShare: 3 },
];
function finish(rows, totalsIn) {
  const Party = require('./party');
  const t = { red: (totalsIn && totalsIn.red) || 0, gold: (totalsIn && totalsIn.gold) || 0 };
  const winner = t.red > t.gold ? 'red' : t.gold > t.red ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.owned - a.owned || (b.lms || 0) - (a.lms || 0) || b.painted - a.painted || a.k - b.k);
  Party.ranks(sorted, 'owned');
  const mvp = {};
  ['red', 'gold'].forEach((team) => { const top = sorted.find((r) => r.team === team && r.owned > 0); mvp[team] = top ? top.k : null; });
  const st = Party.stars(rows, STARS);
  rows.forEach((r) => {
    r.share = Party.share(r.owned, t[r.team]);
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return { totals: t, winner, mvp, stars: st, rows: sorted };
}

module.exports = {
  R, WORLDS, buildSky, newBoard, clampTarget, spawn, segDist, paintPath, stepDragon, stepIslands, step, totals, cloudsBy,
  comeback, applyFlips, reward, tooFast, STARS, finish, ENERGY_PER_RIGHT, ENERGY_MAX, other,
};
