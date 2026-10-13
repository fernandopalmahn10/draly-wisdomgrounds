// Rules check for La Gran Fuga de Dubái (core/escape.js + public/js/escape-map.js). Run: node scripts/test-escape.js
'use strict';
const assert = require('assert');
const E = require('../core/escape');
const M = require('../public/js/escape-map');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };
const near = (a, b, tol, msg) => { checks++; assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b} ±${tol})`); };
const T = M.TILE;

// ---------- the rooms ----------
function reach(room, sx, sy) {
  const seen = new Uint8Array(room.cols * room.rows);
  const s = sy * room.cols + sx;
  const q = [s]; seen[s] = 1;
  while (q.length) {
    const i = q.pop(); const x = i % room.cols, y = (i / room.cols) | 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, j = ny * room.cols + nx;
      if (nx >= 0 && ny >= 0 && nx < room.cols && ny < room.rows && !seen[j] && room.grid[j] === M.FLOOR) { seen[j] = 1; q.push(j); }
    });
  }
  return seen;
}
for (let seed = 1; seed <= 300; seed++) {
  for (const level of [1, 2, 3]) {
    const r = M.buildRoom(seed * 7919, level);
    eq(Array.from(r.grid), Array.from(M.buildRoom(seed * 7919, level).grid), `seed ${seed} L${level}: same seed, same room`);
    eq(r.cols * r.rows, 240, `seed ${seed} L${level}: 20×12 room`);
    ok(r.props.some((p) => p.kind === 'dock'), `seed ${seed} L${level}: Robotín's dock`);
    ok(r.props.length >= 4, `seed ${seed} L${level}: the room has its props (${r.props.length})`);
    const seen = reach(r, 10, 6);
    let floor = 0, got = 0;
    for (let i = 0; i < r.grid.length; i++) if (r.grid[i] === M.FLOOR) { floor++; if (seen[i]) got++; }
    eq(got, floor, `seed ${seed} L${level}: no walled-in pockets`);
    ok(r.spawn.length >= 20, `seed ${seed} L${level}: enough spawn spots (${r.spawn.length})`);
    r.spawn.forEach(([x, y]) => ok(!M.boxBlocked(r, (x + 0.5) * T, (y + 0.5) * T + 6), `seed ${seed} L${level}: a kid fits at spawn ${x},${y}`));
    // safe zones for every class size and wave
    for (const n of [1, 2, 5, 12, 20, 30, 40]) {
      for (const wave of [1, 2, 3]) {
        const zs = M.waveZones(r, seed, level, wave, n);
        eq(JSON.stringify(zs), JSON.stringify(M.waveZones(r, seed, level, wave, n)), `seed ${seed} L${level} w${wave} n${n}: deterministic zones`);
        eq(zs.length, wave === 3 ? 4 : 3, `seed ${seed} L${level} w${wave} n${n}: zone count`);
        zs.forEach((z, i) => {
          ok(M.blockFree(r, z.x, z.y, z.w, z.h), `seed ${seed} L${level} w${wave}: zone ${i} on open floor`);
          ok(seen[(z.y + 1) * r.cols + z.x + 1], `seed ${seed} L${level} w${wave}: zone ${i} reachable`);
          zs.forEach((o, j) => { if (j > i) ok(o.x >= z.x + z.w || z.x >= o.x + o.w || o.y >= z.y + z.h || z.y >= o.y + o.h, `seed ${seed} L${level} w${wave}: zones ${i},${j} don't overlap`); });
        });
        if (wave === 1) ok(zs.every((z) => !z.cap), `wave 1 has no limits`);
        else {
          ok(zs.every((z) => z.cap >= 2), `wave ${wave}: every zone has a limit`);
          ok(zs.reduce((s, z) => s + z.cap, 0) >= n, `seed ${seed} L${level} w${wave} n${n}: room for the whole class if they split`);
        }
      }
    }
  }
}
// zoneAt: feet inside the rectangle
{
  const zs = [{ id: 0, x: 2, y: 2, w: 3, h: 3, cap: 0 }];
  eq(M.zoneAt(zs, 3 * T, 3 * T), 0, 'inside');
  eq(M.zoneAt(zs, 6 * T, 3 * T), -1, 'outside');
}

// ---------- pace + turbos ----------
near(E.R.L / E.paceFor(300), 50, 0.01, '5 min round: 50 s per run');
near(E.R.L / E.paceFor(240), 30, 0.01, '4 min round: 30 s per run');
near(E.R.L / E.paceFor(360), 70, 0.01, '6 min round: 70 s per run');
near(E.R.L / E.paceFor(60), 25, 0.01, 'a tiny test round never goes under 25 s per run');
near(E.R.L / E.paceFor(9999), 80, 0.01, 'never over 80 s per run');
const now0 = 1e9;
function room(n, dur) {
  const round = E.newRound(4242, now0, dur || 300);
  const players = {};
  for (let i = 0; i < n; i++) players['p' + i] = E.preparePlayer(round, { name: 'K' + i });
  return { round, players };
}
{
  const { round } = room(1);
  ok(E.turboGain(round, 1, false) <= E.R.TURBO_MAX, 'one kid alone never jumps more than 12 m');
  ok(E.turboGain(round, 200, false) >= E.R.TURBO_MIN, 'a turbo is always worth something');
  ok(E.turboGain(round, 20, false) < E.turboGain(round, 5, false), 'bigger class, smaller turbo each');
  near(E.turboGain(round, 20, true), E.turboGain(round, 20, false) * 2.5, 1e-9, 'súper turbo = 2.5×');
}
{
  const { round, players } = room(10);
  const p = players.p0;
  let r = E.answer(round, p, true, 10);
  ok(r.turbo && !r.super, 'right answer: turbo');
  ok(round.pending > 0, 'the turbo is queued for the crew');
  E.answer(round, p, true, 10);
  r = E.answer(round, p, true, 10);
  ok(r.super, '3 in a row: súper turbo');
  eq(p.esBest, 3, 'best streak');
  r = E.answer(round, p, false, 10);
  ok(!r.turbo && p.esStreak === 0, 'wrong: no turbo, streak back to 0, nothing lost');
  eq(p.esTurbos, 3, 'turbo count');
  round.paused = true;
  ok(!E.answer(round, p, true, 10).turbo, 'paused: no turbo');
  round.paused = false;
  round.phase = 'zone';
  ok(!E.answer(round, p, true, 10).turbo, 'outside a run: no turbo');
}

// ---------- the chase ----------
{
  // nobody answers: Robotín catches the crew (zap), the crew slides back, everybody dizzy, never a restart
  const { round, players } = room(12);
  let now = now0, zap = null;
  for (let i = 0; i < 1200 && !zap; i++) { now += 100; zap = E.stepRun(round, players, 0.1, now).find((e) => e.type === 'zap'); }
  ok(zap, 'a class that never answers gets caught');
  ok(now - now0 < 60000, `caught within a minute (${(now - now0) / 1000} s)`);
  ok(round.crew >= 0 && round.crew - round.robot >= E.R.CATCH_KNOCK - 0.01, 'after the zap Robotín is knocked back 16 m');
  ok(Object.values(players).every((p) => p.esDizzyUntil === now + E.R.DIZZY_MS), 'every kid dizzy 3 s');
  ok(round.phase === 'run', 'the run goes on (no restart)');
  const again = E.stepRun(round, players, 0.1, now + 100);
  ok(!again.some((e) => e.type === 'zap'), 'no second zap right away');
}
{
  // a class answering at the expected rate reaches the zone in about the target time, Robotín behind
  for (const n of [5, 12, 20, 30]) {
    const { round, players } = room(n, 300);
    let now = now0, done = false, zaps = 0, acc = 0;
    const rate = E.R.TURBO_RATE * n;          // right answers per second for the whole class
    const ids = Object.keys(players);
    for (let i = 0; i < 2000 && !done; i++) {
      now += 100;
      acc += rate * 0.1;
      while (acc >= 1) { acc -= 1; E.answer(round, players[ids[Math.floor(Math.random() * n)]], true, n); }
      const ev = E.stepRun(round, players, 0.1, now);
      if (ev.some((e) => e.type === 'zap')) zaps++;
      done = ev.some((e) => e.type === 'done');
    }
    ok(done, `n=${n}: the crew reaches the zone`);
    const s = (now - now0) / 1000;
    ok(s > 30 && s < 75, `n=${n}: run time near the 50 s target (${s.toFixed(1)} s)`);
    ok(zaps <= 2, `n=${n}: an answering class is rarely caught (${zaps})`);
  }
}
{
  // zone 3: an average class gets a tickle-zap or a few, a stronger class stays ahead; both reach the jet
  // a class: each kid answers `rate` questions a second, right with probability `p` (an average class: 0.13/s at 70 %
  // = the expected 0.09 right answers per kid per second; streaks make some of them súper turbos)
  const run3 = (n, rate, p, seed) => {
    const { round, players } = room(n, 300);
    round.level = 3;
    let now = now0, done = false, zaps = 0, s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const ids = Object.keys(players);
    for (let i = 0; i < 3000 && !done; i++) {
      now += 100;
      ids.forEach((pid) => { if (rnd() < rate * 0.1) E.answer(round, players[pid], rnd() < p, n); });
      const ev = E.stepRun(round, players, 0.1, now);
      if (ev.some((e) => e.type === 'zap')) zaps++;
      done = ev.some((e) => e.type === 'done');
    }
    return { done, zaps, s: (now - now0) / 1000 };
  };
  let avg = 0, strong = 0;
  for (let k = 1; k <= 6; k++) {
    const a = run3(20, 0.13, 0.7, k * 77), b = run3(20, 0.16, 0.9, k * 77);
    ok(a.done && b.done, 'zone 3: the crew reaches the jet');
    ok(a.s < 90, `zone 3: an average class still gets there in time (${a.s.toFixed(1)} s)`);
    avg += a.zaps; strong += b.zaps;
  }
  ok(avg >= 2, `zone 3: an average class meets Robotín's zap (${avg} zaps in 6 runs)`);
  ok(avg <= 6 * 4, `zone 3: but not all the time (${avg} in 6 runs)`);
  ok(strong < avg, `a stronger class gets zapped less (${strong} vs ${avg})`);
  console.log(`zone 3 tickle-zaps in 6 runs of 20 kids: average class ${avg}, strong class ${strong}`);
}
{
  // Robotín's speed grows each zone, and more on a replay
  const { round } = room(5);
  const v1 = E.robotSpeed(round); round.level = 2; const v2 = E.robotSpeed(round); round.level = 3; const v3 = E.robotSpeed(round);
  ok(v1 < v2 && v2 < v3, 'faster each zone');
  round.replay = true;
  ok(E.robotSpeed(round) > v3, 'faster on a replay');
}

// ---------- zona segura ----------
function zoneRoom(n) {
  const { round, players } = room(n);
  E.startZone(round, now0);
  Object.entries(players).forEach(([pid, p]) => { const s = E.spawnPos(round, p.esIdx); round.pos[pid] = { x: s.x, y: s.y, f: 2, at: now0 }; });
  return { round, players };
}
const centre = (z) => ({ x: (z.x + z.w / 2) * T, y: (z.y + z.h / 2) * T + 6 });
{
  const { round, players } = zoneRoom(10);
  eq(round.phase, 'zone', 'zone phase');
  ok(round.room && round.room.level === 1, 'the room of zone 1');
  E.startWave(round, players, now0 + 4000);
  eq(round.wave, 1, 'wave 1');
  // everybody walks into zone 0 (no limit in wave 1): all safe, no hearts lost
  const z0 = centre(round.zones[0]);
  Object.keys(players).forEach((pid) => { round.pos[pid] = { x: z0.x, y: z0.y, f: 2, at: now0 + 9000 }; });
  E.occupancy(round, players, now0 + 9000);
  const r = E.resolveWave(round, players, now0 + 10000);
  eq(r.out.length, 0, 'wave 1: everybody safe');
  eq(r.lost, 0, 'no hearts lost');
  eq(round.hearts, 5, 'five hearts');
  ok(Object.values(players).every((p) => p.esSafe === 1 && p.esWaves === 1), 'safe counted');
}
{
  // a zone with a limit protects only the first N in; the rest are caught (one heart per ~n/8 kids out, at most 2)
  const { round, players } = zoneRoom(16);
  E.startWave(round, players, now0 + 4000);
  E.startWave(round, players, now0 + 20000);      // wave 2: limits
  const z = round.zones[0];
  ok(z.cap >= 2, 'wave 2 zone has a limit');
  const c = centre(z);
  const ids = Object.keys(players);
  ids.forEach((pid, i) => { round.pos[pid] = { x: c.x, y: c.y, f: 2, at: now0 + 22000 }; E.occupancy(round, players, now0 + 21000 + i * 10); });
  const occ = E.occupancy(round, players, now0 + 23000)[0];
  eq(occ.safe.length, z.cap, 'only the first N are protected');
  eq(occ.safe.map((k) => k.pid), ids.slice(0, z.cap), 'protected = first in');
  const r = E.resolveWave(round, players, now0 + 24000);
  eq(r.out.length, ids.length - z.cap, 'the rest are caught outside the limit');
  eq(r.lost, r.out.length > 16 / 3 ? 2 : 1, 'hearts lost per the class-size rule (2 only when over a third is out)');
  ok(players[r.out[0]].esDizzyUntil === now0 + 24000 + E.R.ZONE_DIZZY_MS, 'caught kids dizzy 2 s');
}
{
  // away phones (silent 8 s) never cost hearts; a kid already inside a zone at the wave start gets no «fastest» time
  const { round, players } = zoneRoom(4);
  E.startWave(round, players, now0 + 4000);
  const ids = Object.keys(players);
  const z = round.zones[0], c = centre(z);
  round.pos[ids[0]] = { x: c.x, y: c.y, f: 2, at: now0 + 4000 };            // was standing there when it lit up
  E.startWave(round, players, now0 + 5000);                                 // (re-pick zones with ids[0] inside one)
  round.zones = [z]; players[ids[0]].esReachSkip = true;
  round.pos[ids[1]] = { x: c.x, y: c.y, f: 2, at: now0 + 9000 };            // walked in
  players[ids[1]].esReachSkip = false;
  round.pos[ids[2]].at = now0 - 20000;                                      // locked phone, away
  const outside = round.room.spawn.map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T + 6 })).find((q) => M.zoneAt([z], q.x, q.y) < 0);
  round.pos[ids[3]] = { x: outside.x, y: outside.y, f: 2, at: now0 + 15000 };   // phone on, standing outside
  E.occupancy(round, players, now0 + 8000);
  const r = E.resolveWave(round, players, now0 + 16000);
  ok(!r.out.includes(ids[2]), 'an away phone is not counted');
  ok(r.out.includes(ids[3]), 'a kid who stayed outside is caught');
  eq(players[ids[0]].esReachN, 0, 'already inside: no reach time');
  eq(players[ids[1]].esReachN, 1, 'walked in: reach time counted');
}
{
  // hearts at 0: caught at the gate once (replay with 3 hearts), never twice; zone 3 done = escape
  const { round } = room(3);
  round.hearts = 0;
  eq(E.afterZone(round), 'caught', 'hearts 0 the first time: caught');
  E.caught(round);
  eq(round.hearts, E.R.REPLAY_HEARTS, 'replay with 3 hearts');
  E.startRun(round, now0, true);
  ok(round.replay && round.crew === 0 && round.robot === -E.R.GAP0, 'the zone runs again from the start');
  round.hearts = 0;
  eq(E.afterZone(round), 'cleared', 'hearts 0 again in the same zone: carry on (never stuck)');
  round.hearts = 2; round.level = 3;
  eq(E.afterZone(round), 'escape', 'zone 3 done: the escape');
  round.level = 1; E.clearLevel(round);
  eq(round.level, 2, 'next zone');
  eq(round.levelsCleared, 1, 'one zone cleared');
}
{
  // review 2026-10-13: a replayed zone that ends at 0 hearts must not make the NEXT zone «caught» after a perfect wave
  const { round, players } = room(4);
  round.hearts = 0; E.caught(round); E.startRun(round, now0, true);   // zone 1 replayed …
  round.hearts = 0;
  eq(E.afterZone(round), 'cleared', '… and ends at 0 hearts: carry on');
  E.clearLevel(round);
  E.startZone(round, now0);
  ok(round.hearts >= 1, 'the next zone starts with at least 1 heart');
  Object.entries(players).forEach(([pid, p]) => { const s = E.spawnPos(round, p.esIdx); round.pos[pid] = { x: s.x, y: s.y, f: 2, at: now0 }; });
  E.startWave(round, players, now0 + 3000);
  const c = centre(round.zones[0]);
  Object.keys(players).forEach((pid) => { round.pos[pid] = { x: c.x, y: c.y, f: 2, at: now0 + 8000 }; });
  const r = E.resolveWave(round, players, now0 + 9000);
  eq(r.lost, 0, 'a perfect wave');
  round.wave = E.R.WAVES;
  ok(E.afterZone(round) !== 'caught', 'a perfect last wave is never «caught»');
  // the teacher skips a zona segura at 0 hearts: the class moves on
  round.hearts = 0;
  ok(E.skipZone(round, now0 + 10000), 'skip works in a zona segura');
  ok(E.afterZone(round) !== 'caught', 'a skipped zone is never «caught»');
  round.phase = 'run';
  ok(!E.skipZone(round, now0), 'no skipping a run');
}
{
  // one distracted kid in ten is free; a zone cleared gives a heart back
  const { round, players } = zoneRoom(20);
  E.startWave(round, players, now0 + 4000);
  const ids = Object.keys(players), c = centre(round.zones[0]);
  ids.forEach((pid, i) => { round.pos[pid] = i < 2 ? { x: round.pos[pid].x, y: round.pos[pid].y, f: 2, at: now0 + 9000 } : { x: c.x, y: c.y, f: 2, at: now0 + 9000 }; });
  const outside = ids.slice(0, 2).filter((pid) => M.zoneAt(round.zones, round.pos[pid].x, round.pos[pid].y) < 0).length;
  const r = E.resolveWave(round, players, now0 + 10000);
  eq(r.lost, outside > 2 ? 1 : 0, '2 of 20 outside: free');
  round.hearts = 3; E.clearLevel(round);
  eq(round.hearts, 4, 'zone cleared: +1 heart');
  round.hearts = 5; E.clearLevel(round);
  eq(round.hearts, 5, 'never over 5');
}
{
  // a locked phone (silent 8 s) doesn't take a protected spot in a zone with a limit
  const { round, players } = zoneRoom(3);
  E.startWave(round, players, now0 + 4000);
  E.startWave(round, players, now0 + 20000);
  const z = round.zones[0]; z.cap = 1;
  const c = centre(z);
  const [a, b] = Object.keys(players);
  round.pos[a] = { x: c.x, y: c.y, f: 2, at: now0 + 1000 };          // locked since long before
  round.pos[b] = { x: c.x, y: c.y, f: 2, at: now0 + 21500 };         // walked in, phone on
  const occ = E.occupancy(round, players, now0 + 22000)[0];
  eq(occ.safe.map((k) => k.pid), [b], 'the active kid gets the spot');
}
{
  // position checks in the room: walking speed, walls, dizzy
  const { round, players } = zoneRoom(1);
  const p = players.p0, pos = round.pos.p0;
  ok(E.checkPos(round, p, 'p0', pos.x + 10, pos.y, now0 + 200).ok, 'a normal step is fine');
  ok(!E.checkPos(round, p, 'p0', pos.x + 400, pos.y, now0 + 200).ok, 'a teleport is refused');
  ok(!E.checkPos(round, p, 'p0', 5, 5, now0 + 5000).ok, 'inside the wall is refused');
  p.esDizzyUntil = now0 + 5000;
  ok(!E.checkPos(round, p, 'p0', pos.x + 30, pos.y, now0 + 400).ok, 'dizzy kids stay put');
}

// ---------- ranks + the end ----------
eq(E.rankOf(3, 5), { id: 'cielo', name: 'Pilotos del Cielo', stars: 3 }, 'escaped with every heart');
eq(E.rankOf(3, 3).id, 'cielo', 'escaped with 3 hearts');
eq(E.rankOf(3, 1).id, 'burj', 'escaped with 1 heart');
eq(E.rankOf(2, 4).id, 'burj', '2 zones, 4 hearts');
eq(E.rankOf(2, 1).id, 'zoco', '2 zones, 1 heart');
eq(E.rankOf(0, 5).id, 'zoco', 'still in zone 1');
eq(E.rankOf(1, 1).stars, 1, 'stars from hearts');
eq(E.rankOf(0, 5).stars, 1, 'still in zone 1: one star whatever the hearts');
eq(E.rankOf(1, 5).stars, 2, 'one zone cleared: at most two stars');
{
  const { round, players } = room(3);
  const [a, b, c] = Object.values(players);
  a.esTurbos = 9; a.esBest = 2; b.esTurbos = 4; b.esBest = 6; b.esReachMs = 6000; b.esReachN = 2; c.esReachMs = 800; c.esReachN = 1;
  b.esSafe = 2; c.esSafe = 1;
  const fin = E.finish(round, players);
  eq(fin.awards.turbos.name, a.name, 'most turbos');
  eq(fin.awards.streak.name, b.name, 'best streak');
  eq(fin.awards.fastest.name, b.name, 'fastest needs at least 2 timed waves');
  eq(fin.rank.id, 'zoco', 'rank of a round that never left zone 1');
}
{
  // pause: every timer moves forward
  const { round, players } = zoneRoom(2);
  E.startWave(round, players, now0 + 4000);
  const before = round.waveUntil;
  players.p0.esDizzyUntil = now0 + 6000;
  E.shiftTimers(round, players, 7000);
  eq(round.waveUntil, before + 7000, 'the wave clock waits');
  eq(players.p0.esDizzyUntil, now0 + 13000, 'dizzy waits too');
}

console.log(`escape: all ${checks} checks passed`);
