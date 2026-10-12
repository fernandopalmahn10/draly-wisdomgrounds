// Batalla de Nieve en Ski Dubái (gameType 'snow') — the rules, no sockets (server.js glues them to the room).
// Every kid walks their saga avatar around a top-down Dubai (public/js/snow-map.js). Right answers at the 4-colour
// stations give snowflakes («copos»); a snowball costs 1 copo. After a 10 s head start the Hechizo de Hielo turns 2 kids
// into the ice team. An ice snowball takes 1 «calor» (☀️) from a survivor; at 0 they freeze and join the ice team
// (respawn at Ski Dubái after 3 s). A survivor snowball stuns an ice kid for 3 s. The round ends when the timer runs
// out (survivors win) or nobody is left (the ice team wins).
// Player fields live on the room's player objects with an `sn` prefix; the round state is `round` (server: g.snow).
'use strict';
const SnowMap = require('../public/js/snow-map');

const T = SnowMap.TILE;
const R = {
  START_COPOS: 3,
  COPOS_RIGHT: 3,
  STREAK_EVERY: 3,          // every 3rd right answer in a row …
  STREAK_BONUS: 2,          // … pays 2 more («¡Racha!»)
  COPOS_JOB: 1,             // pearls / dates: small, so answering always pays more
  COPOS_CHEST: 5,
  COPOS_MAX: 20,
  CALOR_MAX: 3,             // survivors take 3 ice hits to freeze (balancing: 1 hit ended a 20-kid bot round in ~1 min)
  HEAD_START_MS: 10000,
  RESPAWN_MS: 3000,
  STUN_MS: 3000,
  STUN_IMMUNE_MS: 3000,     // after a stun (and after a respawn) an ice kid can't be stunned again for 3 s: no stun-lock
  ICE_START_COPOS: 1,       // a freshly frozen kid keeps their copos, at least 1 to start hunting
  SHIELD_MS: 10000,         // late joiners
  THROW_CD_MS: 650,         // survivors
  ICE_THROW_CD_MS: 1000,    // the ice team throws a little slower …
  ICE_SPEED: 138,           // … and walks a little slower: a survivor who runs can get away
  WARM_MS: 15000,           // a survivor not hit for 15 s gets 1 ☀️ back («¡Te calentaste!»)
  REFUGE_SHIELD_MS: 5000,   // «¡Último refugio!»: the last 3 survivors get full ☀️ and a 5 s shield, once
  ARMOR_RATIO: 0.2,         // while the ice team is at most 20 % of the class it wears an «escudo de hielo»: no stuns
  JOB_CD_MS: 10000,
  BALL_SPEED: 380,          // px/s
  BALL_RANGE: 7 * T,
  HIT_R: 20,
  SPEED: 150,               // walking speed px/s (phones)
  STATION_REACH: 3.2 * T,   // server is lenient; the phone shows the button at ~1.7 tiles
  JOB_REACH: 3 * T,
  CHEST_REACH: 2.6 * T,
  CHEST_GAP_MS: [24000, 34000],
  CHEST_LIFE_MS: 25000,
  SCORE_FREEZE: 50,
  SCORE_RIGHT: 20,
  SCORE_STUN: 10,
};

const isOn = (p) => p && !p.disconnected;

// How many kids the spell freezes at the start: 1 with 2 kids, 2 up to 24, then one more per 12.
function firstIceCount(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return n < 25 ? 2 : 2 + Math.floor((n - 13) / 12);
}

function newRound(seed, now) {
  return {
    id: seed + ':' + now, seed, map: SnowMap.buildMap(seed), startedAt: now, spellAt: now + R.HEAD_START_MS, spellCast: false,
    pos: {},            // pid → { x, y, f, at }
    balls: [], nextBall: 1,
    chest: null, nextChest: 1, lastChestZone: null, nextChestAt: now + R.HEAD_START_MS + 8000,
    milestones: {}, paused: false, pausedAt: 0, idx: 0,
  };
}

// A kid enters the round (start, late join). `late` = joined after the start: a 10 s shield.
function preparePlayer(round, p, now, late) {
  if (p.snRound === round.id) return p;        // already in this round (a rejoin keeps everything)
  p.snRound = round.id;
  p.snIdx = ++round.idx;
  p.snSide = 'sun';
  p.snSunSince = now;
  p.snSunMs = 0;
  p.snCopos = R.START_COPOS;
  p.snCalor = R.CALOR_MAX;
  p.snStreak = 0; p.snRight = 0; p.snWrong = 0; p.snFreezes = 0; p.snStuns = 0; p.snChests = 0; p.snJobs = 0; p.snThrows = 0;
  p.snStunUntil = 0; p.snRespawnUntil = 0; p.snLastThrow = 0; p.snJobAt = 0;
  p.snShieldUntil = late ? now + R.SHIELD_MS : 0;
  p.snFrozenBy = null;
  return p;
}

function counts(players) {
  const c = { sun: 0, ice: 0, total: 0 };
  Object.values(players).forEach((p) => { if (!isOn(p) || !p.snSide) return; c[p.snSide]++; c.total++; });
  return c;
}

// survivor → ice team (the spell or a second hit)
function turnIce(round, p, now, by) {
  if (p.snSide !== 'sun') return false;
  p.snSunMs += Math.max(0, now - (p.snSunSince || now));
  p.snSunSince = 0;
  p.snSide = 'ice';
  p.snCalor = 0;
  p.snCopos = Math.max(p.snCopos || 0, R.ICE_START_COPOS);
  p.snStunUntil = 0;
  p.snRespawnUntil = now + R.RESPAWN_MS;
  p.snShieldUntil = p.snRespawnUntil + R.STUN_IMMUNE_MS;
  p.snFrozenBy = by || null;
  return true;
}

// The Hechizo de Hielo: pick `n` random connected survivors (a seeded/random picker can be passed in for tests).
function castSpell(round, players, now, rand) {
  const rnd = rand || Math.random;
  round.spellCast = true;
  const pool = Object.keys(players).filter((id) => isOn(players[id]) && players[id].snSide === 'sun');
  const n = Math.min(pool.length - 1, firstIceCount(pool.length));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  out.forEach((id) => turnIce(round, players[id], now, 'spell'));
  return out;
}

// A kid answered a question. Right: +3 copos (+2 on every 3rd in a row), a survivor gets 1 calor back.
function answer(p, correct) {
  if (!correct) { p.snStreak = 0; p.snWrong = (p.snWrong || 0) + 1; return { gained: 0, racha: false, calor: false }; }
  p.snStreak = (p.snStreak || 0) + 1;
  p.snRight = (p.snRight || 0) + 1;
  const racha = p.snStreak % R.STREAK_EVERY === 0;
  const gained = R.COPOS_RIGHT + (racha ? R.STREAK_BONUS : 0);
  p.snCopos = Math.min(R.COPOS_MAX, (p.snCopos || 0) + gained);
  let calor = false;
  if (p.snSide === 'sun' && p.snCalor < R.CALOR_MAX) { p.snCalor++; calor = true; }
  return { gained, racha, calor };
}

// Why a kid can't throw right now (null = they can).
function cantThrow(round, p, now) {
  if (round.paused) return 'paused';
  if (!round.spellCast) return 'early';
  if (now < (p.snRespawnUntil || 0)) return 'respawn';
  if (now < (p.snStunUntil || 0)) return 'stun';
  if (!(p.snCopos > 0)) return 'copos';
  if (now - (p.snLastThrow || 0) < (p.snSide === 'ice' ? R.ICE_THROW_CD_MS : R.THROW_CD_MS)) return 'cooldown';
  return null;
}

function throwBall(round, p, pid, dx, dy, now) {
  const why = cantThrow(round, p, now);
  if (why) return { error: why };
  const pos = round.pos[pid];
  if (!pos) return { error: 'nopos' };
  const len = Math.hypot(dx, dy);
  if (!(len > 0.01) || !Number.isFinite(len)) return { error: 'dir' };
  p.snCopos -= 1;
  p.snLastThrow = now;
  p.snThrows = (p.snThrows || 0) + 1;
  const ball = { id: round.nextBall++, by: pid, side: p.snSide, x: pos.x, y: pos.y, dx: dx / len, dy: dy / len, left: R.BALL_RANGE };
  round.balls.push(ball);
  return { ball };
}

// distance² from (px, py) to the segment a→b, and where along it (0..1)
function segDist(ax, ay, bx, by, px, py) {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + vx * t - px, qy = ay + vy * t - py;
  return { d2: qx * qx + qy * qy, t };
}

// The small ice team is protected by the spell: survivors can't stun it until it is over 20 % of the class.
function iceArmor(players) {
  const c = counts(players);
  return c.total > 0 && c.ice <= c.total * R.ARMOR_RATIO;
}

// A snowball reached a kid. Returns the event.
function applyHit(round, players, ball, tid, now) {
  const t = players[tid];
  const by = players[ball.by];
  const base = { ball: ball.id, by: ball.by, target: tid, side: ball.side };
  if (now < (t.snShieldUntil || 0)) return Object.assign(base, { type: 'shield' });
  if (ball.side === 'ice' && t.snSide === 'sun') {
    t.snCalor = Math.max(0, (t.snCalor || 0) - 1);
    t.snHitAt = now;
    if (t.snCalor > 0) return Object.assign(base, { type: 'brrr', calor: t.snCalor });
    turnIce(round, t, now, ball.by);
    if (by) by.snFreezes = (by.snFreezes || 0) + 1;
    return Object.assign(base, { type: 'freeze' });
  }
  if (ball.side === 'sun' && t.snSide === 'ice') {
    if (iceArmor(players)) return Object.assign(base, { type: 'armor' });
    if (now < (t.snStunUntil || 0)) return Object.assign(base, { type: 'bonk' });
    t.snStunUntil = now + R.STUN_MS;
    t.snShieldUntil = t.snStunUntil + R.STUN_IMMUNE_MS;
    if (by) by.snStuns = (by.snStuns || 0) + 1;
    return Object.assign(base, { type: 'stun' });
  }
  return null;
}

// Move every snowball `dt` seconds: it hits the first kid of the other side along its path, stops on stalls/walls,
// or drops at the end of its range. Returns the events (hits, splashes) in order.
function stepBalls(round, players, dt, now) {
  const map = round.map;
  const events = [];
  const keep = [];
  round.balls.forEach((b) => {
    const step = Math.min(b.left, R.BALL_SPEED * dt);
    const nx = b.x + b.dx * step, ny = b.y + b.dy * step;
    // first kid hit along the segment
    let best = null;
    Object.entries(round.pos).forEach(([pid, pos]) => {
      const p = players[pid];
      if (!isOn(p) || pid === b.by || !p.snSide || p.snSide === b.side) return;
      if (now < (p.snRespawnUntil || 0)) return;
      const { d2, t } = segDist(b.x, b.y, nx, ny, pos.x, pos.y);
      if (d2 <= R.HIT_R * R.HIT_R && (!best || t < best.t)) best = { pid, t };
    });
    // a stall / wall before that kid?
    let wallT = null;
    const n = Math.max(1, Math.ceil(step / 8));
    for (let i = 1; i <= n; i++) {
      const c = SnowMap.codeAtPx(map, b.x + b.dx * step * i / n, b.y - 10 + b.dy * step * i / n);
      if (c === SnowMap.WALL || c === SnowMap.PROP) { wallT = (i - 1) / n; break; }
    }
    if (best && (wallT === null || best.t <= wallT + 1e-9)) {
      const ev = applyHit(round, players, b, best.pid, now);
      const pos = round.pos[best.pid];
      if (ev) events.push(Object.assign(ev, { x: Math.round(pos.x), y: Math.round(pos.y) }));
      else events.push({ type: 'splash', ball: b.id, x: Math.round(pos.x), y: Math.round(pos.y) });
      return;
    }
    if (wallT !== null) {
      events.push({ type: 'splash', ball: b.id, x: Math.round(b.x + b.dx * step * wallT), y: Math.round(b.y + b.dy * step * wallT) });
      return;
    }
    b.x = nx; b.y = ny; b.left -= step;
    if (b.left <= 0.5) { events.push({ type: 'splash', ball: b.id, x: Math.round(b.x), y: Math.round(b.y) }); return; }
    keep.push(b);
  });
  round.balls = keep;
  return events;
}

// Server check of a phone's position: never faster than walking (with slack for lag), never inside a wall.
// Returns { ok } or { ok: false, x, y } = where the phone must snap back to.
function checkPos(round, p, pid, x, y, now) {
  const prev = round.pos[pid];
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, x: prev ? prev.x : 0, y: prev ? prev.y : 0 };
  if (!prev) return SnowMap.boxBlocked(round.map, x, y) ? { ok: false, x: 0, y: 0, unknown: true } : { ok: true };
  const frozen = now < (p.snStunUntil || 0) || now < (p.snRespawnUntil || 0) || round.paused;
  const speed = p.snSide === 'ice' ? R.ICE_SPEED : R.SPEED;
  // at most 1.5 s of walking since the last accepted position (a phone that went quiet can't jump across the map)
  const budget = frozen ? 6 : speed * 1.25 * Math.min(1.5, Math.max(0, now - prev.at) / 1000) + 40;
  if (Math.hypot(x - prev.x, y - prev.y) > budget) return { ok: false, x: prev.x, y: prev.y };
  if (SnowMap.boxBlocked(round.map, x, y, 1)) return { ok: false, x: prev.x, y: prev.y };
  return { ok: true };
}

const near = (pos, x, y, r) => !!pos && Math.hypot(pos.x - x, pos.y - y) <= r;
function nearStation(round, pid, stationId) {
  const s = round.map.stations.find((st) => st.id === stationId);
  const pos = round.pos[pid];
  if (!s || !pos) return false;
  // distance from the feet to the station's rectangle
  const cx = Math.max(s.x * T, Math.min(pos.x, (s.x + s.w) * T));
  const cy = Math.max(s.y * T, Math.min(pos.y, (s.y + s.h) * T));
  return Math.hypot(pos.x - cx, pos.y - cy) <= R.STATION_REACH;
}

// Pearls / dates: +1 copo, once every 10 s per kid, only standing next to the spot.
function doJob(round, p, pid, jobId, now) {
  const j = round.map.jobs.find((jj) => jj.id === jobId);
  if (!j || round.paused) return { error: 'job' };
  if (now < (p.snRespawnUntil || 0) || now < (p.snStunUntil || 0)) return { error: 'busy' };
  if (!near(round.pos[pid], j.x * T, j.y * T, R.JOB_REACH)) return { error: 'far' };
  if (now - (p.snJobAt || 0) < R.JOB_CD_MS) return { error: 'cooldown', waitMs: R.JOB_CD_MS - (now - p.snJobAt) };
  p.snJobAt = now;
  p.snJobs = (p.snJobs || 0) + 1;
  p.snCopos = Math.min(R.COPOS_MAX, (p.snCopos || 0) + R.COPOS_JOB);
  return { ok: true, kind: j.kind, gained: R.COPOS_JOB };
}

// The ❄️ chest: appears in a random zone (never the same zone twice in a row), first kid to reach it gets +5.
function spawnChest(round, now, rand) {
  const rnd = rand || Math.random;
  const zones = Object.keys(round.map.chestSpots).filter((z) => z !== round.lastChestZone && round.map.chestSpots[z].length);
  const zone = zones[Math.floor(rnd() * zones.length)];
  const spots = round.map.chestSpots[zone];
  const [tx, ty] = spots[Math.floor(rnd() * spots.length)];
  round.lastChestZone = zone;
  round.chest = { id: round.nextChest++, zone, x: (tx + 0.5) * T, y: (ty + 0.5) * T + 6, until: now + R.CHEST_LIFE_MS };
  return round.chest;
}
function nextChestGap(rand) { const r = (rand || Math.random)(); return R.CHEST_GAP_MS[0] + r * (R.CHEST_GAP_MS[1] - R.CHEST_GAP_MS[0]); }
function grabChest(round, p, pid, chestId, now) {
  const c = round.chest;
  if (!c || c.id !== chestId || round.paused) return { error: 'gone' };
  if (now < (p.snRespawnUntil || 0)) return { error: 'busy' };
  if (!near(round.pos[pid], c.x, c.y, R.CHEST_REACH)) return { error: 'far' };
  round.chest = null;
  p.snChests = (p.snChests || 0) + 1;
  p.snCopos = Math.min(R.COPOS_MAX, (p.snCopos || 0) + R.COPOS_CHEST);
  return { ok: true, chest: c, gained: R.COPOS_CHEST };
}

// Survivors warm up in the sun: 1 ☀️ back after WARM_MS without an ice hit. Returns the kids who got warmer.
function warmUp(players, now) {
  const out = [];
  Object.entries(players).forEach(([pid, p]) => {
    if (!isOn(p) || p.snSide !== 'sun' || p.snCalor >= R.CALOR_MAX) return;
    const since = Math.max(p.snHitAt || 0, p.snWarmAt || 0, p.snSunSince || 0);
    if (now - since >= R.WARM_MS) { p.snCalor++; p.snWarmAt = now; out.push(pid); }
  });
  return out;
}
// «¡Último refugio!» — the last survivors get full ☀️ and a short shield (once per round, the server decides when).
function refuge(players, now) {
  const out = [];
  Object.entries(players).forEach(([pid, p]) => {
    if (!isOn(p) || p.snSide !== 'sun') return;
    p.snCalor = R.CALOR_MAX;
    p.snShieldUntil = Math.max(p.snShieldUntil || 0, now + R.REFUGE_SHIELD_MS);
    out.push(pid);
  });
  return out;
}

// The ice team wins when nobody is left to freeze (only after the spell, and only with 2+ kids in the round).
function winnerNow(round, players, now) {
  if (!round.spellCast) return null;
  const c = counts(players);
  if (!(c.total >= 2 && c.sun === 0 && c.ice > 0)) return null;
  // a survivor whose phone dropped a moment ago (wifi blip, screen lock) may come back: give them 10 s
  const t = now || Date.now();
  const back = Object.values(players).some((p) => p.disconnected && p.snSide === 'sun' && t - (p.disconnectedAt || 0) < 10000);
  return back ? null : 'ice';
}

function sunMs(p, now) { return (p.snSunMs || 0) + (p.snSide === 'sun' && p.snSunSince ? Math.max(0, now - p.snSunSince) : 0); }
// seconds survived + 50 per kid frozen + 20 per right answer + 10 per stun
function scoreOf(p, now) {
  return Math.floor(sunMs(p, now) / 1000) + (p.snFreezes || 0) * R.SCORE_FREEZE + (p.snRight || 0) * R.SCORE_RIGHT + (p.snStuns || 0) * R.SCORE_STUN;
}

// End of the round: who won, every kid's numbers, the MVP of each side.
function finish(round, players, now) {
  const c = counts(players);
  const winner = c.sun > 0 ? 'sun' : 'ice';
  const rows = Object.entries(players).filter(([, p]) => p.snSide).map(([id, p]) => ({
    id, name: p.name, avatar: p.avatar || '', side: p.snSide, score: scoreOf(p, now), seconds: Math.floor(sunMs(p, now) / 1000),
    freezes: p.snFreezes || 0, right: p.snRight || 0, stuns: p.snStuns || 0, gone: !!p.disconnected,
  }));
  rows.sort((a, b) => b.score - a.score || b.seconds - a.seconds);
  const sunRows = rows.filter((r) => r.side === 'sun' && !r.gone);
  const mvpSun = (sunRows.length ? sunRows : rows).slice().sort((a, b) => b.seconds - a.seconds || b.score - a.score)[0] || null;
  const mvpIce = rows.filter((r) => r.side === 'ice').sort((a, b) => b.freezes - a.freezes || b.score - a.score)[0] || null;
  return { winner, counts: c, rows, mvpSun, mvpIce };
}

// Teacher pause: every timer of the round (and of each kid) moves forward by the paused time.
function shiftTimers(round, players, ms) {
  round.spellAt += ms;
  round.nextChestAt += ms;
  if (round.chest) round.chest.until += ms;
  Object.values(round.pos).forEach((pos) => { pos.at += ms; });
  Object.values(players).forEach((p) => {
    ['snStunUntil', 'snRespawnUntil', 'snShieldUntil', 'snLastThrow', 'snJobAt', 'snHitAt', 'snWarmAt'].forEach((k) => { if (p[k]) p[k] += ms; });
    if (p.snSide === 'sun' && p.snSunSince) p.snSunSince += ms;
  });
}

module.exports = {
  R, firstIceCount, newRound, preparePlayer, counts, turnIce, castSpell, answer, cantThrow, throwBall, stepBalls,
  applyHit, iceArmor, checkPos, nearStation, doJob, spawnChest, nextChestGap, grabChest, winnerNow, sunMs, scoreOf, finish, warmUp, refuge,
  shiftTimers, segDist,
};
