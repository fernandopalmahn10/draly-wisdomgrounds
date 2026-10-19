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
// v2: every route's three rooms (16×16, the walls of its picture + 3 seeded props)
ok(M.ROUTES.length >= 2, 'at least two routes (Dubái, China)');
eq(M.ROUTES[0].id, 'dubai', 'Dubái first: the main stage');
M.ROUTES.forEach((rt) => {
  eq(rt.zones.length, 3, `${rt.id}: three zones`);
  rt.zones.forEach((zid, i) => {
    const z = M.ZONES[zid];
    ok(z && z.name && z.room && z.exit && z.at && z.icon && z.layout, `${rt.id}: zone ${zid} is complete (names, gate, icon, walls)`);
    eq(z.exit === 'jet', i === 2, `${rt.id}: Hamdan's jet waits at the end of zone 3 only`);
    ok(z.props.every((k) => M.PROP_ART[k]), `${zid}: every prop has its picture`);
  });
  ok(rt.ranks.cielo && rt.ranks.burj && rt.ranks.zoco && rt.rankArt.cielo, `${rt.id}: rank names and pictures`);
});
eq(M.zoneOf(1, 3).id, 'muralla', 'China route, zone 3 = la Gran Muralla');
eq(M.zoneOf(M.ROUTES.length, 1).id, M.zoneOf(0, 1).id, 'routes wrap around');
for (let seed = 1; seed <= 300; seed++) {
  for (const route of M.ROUTES.map((_, i) => i)) for (const level of [1, 2, 3]) {
    const r = M.buildRoom(seed * 7919, level, route);
    eq(Array.from(r.grid), Array.from(M.buildRoom(seed * 7919, level, route).grid), `seed ${seed} R${route} L${level}: same seed, same room`);
    eq(r.cols * r.rows, 256, `seed ${seed} L${level}: 16×16 room`);
    eq(r.zone, M.zoneOf(route, level).id, `seed ${seed} R${route} L${level}: the route's zone`);
    ok(r.props.some((p) => p.kind === 'dock'), `seed ${seed} L${level}: Robotín's dock`);
    ok(r.props.length >= 1 + (r.layout.props == null ? 2 : Math.min(1, r.layout.props)), `seed ${seed} R${route} L${level}: the room has its props (${r.props.length})`);
    const seen = reach(r, 8, 8);
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
near(E.R.L / E.paceFor(300), 56, 0.01, '5 min round: 56 s per run');
near(E.R.L / E.paceFor(240), 36, 0.01, '4 min round: 36 s per run');
near(E.R.L / E.paceFor(360), 76, 0.01, '6 min round: 76 s per run');
near(E.R.L / E.paceFor(60), 22, 0.01, 'a tiny test round never goes under 22 s per run');
near(E.R.L / E.paceFor(9999), 80, 0.01, 'never over 80 s per run');
// v2: the zona segura budget matches the rules (intro + 3 waves + rests), and each run's pace comes from the clock
near(E.zoneSeconds(1), (E.R.ZONE_INTRO_MS + E.R.WAVE_MS[0].reduce((a, b) => a + b) + 3 * E.R.WAVE_REST_MS) / 1000, 1e-9, 'zona segura seconds');
ok(E.zoneSeconds(1) <= 40 && E.zoneSeconds(3) <= 38, `the zona segura is short (${E.zoneSeconds(1)} s, ${E.zoneSeconds(3)} s)`);
{
  const r = E.newRound(1, 0, 240, 0);
  E.retimeRun(r, 240);
  ok(r.runTarget > 30 && r.runTarget < 36, `4 min: the first run gets ${r.runTarget.toFixed(1)} s`);
  r.level = 3; E.retimeRun(r, 70);
  ok(r.runTarget >= E.R.RUN_TARGET_S[0] && r.runTarget < 25, `little time left: the last run is quick (${r.runTarget.toFixed(1)} s)`);
  r.level = 2; E.retimeRun(r, 900);
  eq(r.runTarget, E.R.RUN_TARGET_S[1], 'lots of time: never longer than 80 s');
  const before = r.pace; E.retimeRun(r, 0);
  eq(r.pace, before, 'no clock: the pace stays');
}
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
  ok(round.dizzyUntil === now + E.R.DIZZY_MS && Object.values(players).every((p) => p.esZapped === 1 && !p.esDizzyUntil), 'the crew dizzy 3 s (slower), no phone locked by it (the chase pass: only personal zaps stun)');
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
  const RUNS = 24;          // (Robotín's sprint gaps are random: enough runs for a steady count)
  for (let k = 1; k <= RUNS; k++) {
    const a = run3(20, 0.13, 0.7, k * 77), b = run3(20, 0.16, 0.9, k * 77);
    ok(a.done && b.done, 'zone 3: the crew reaches the jet');
    ok(a.s < 90, `zone 3: an average class still gets there in time (${a.s.toFixed(1)} s)`);
    avg += a.zaps; strong += b.zaps;
  }
  ok(avg >= RUNS / 12, `zone 3: an average class meets Robotín's zap (${avg} zaps in ${RUNS} runs)`);
  ok(avg <= RUNS * 4, `zone 3: but not all the time (${avg} in ${RUNS} runs)`);
  ok(strong < avg, `a stronger class gets zapped less (${strong} vs ${avg})`);
  console.log(`zone 3 tickle-zaps in ${RUNS} runs of 20 kids: average class ${avg}, strong class ${strong}`);
}
{
  // v2 pacing, the whole episode on the clock (the playtest's 4-minute rounds ended one wave short of the jet): a class
  // answering at the expected rate reaches the jet before the bell at 4, 5 and 6 minutes, whatever its size; a class
  // that answers much less doesn't always (the jet is earned). The zonas seguras take their real time (every kid safe).
  const episode = (n, durS, rate, p, seed) => {
    const round = E.newRound(seed, now0, durS, 0);
    const players = {};
    for (let i = 0; i < n; i++) players['p' + i] = E.preparePlayer(round, { name: 'K' + i });
    const ids = Object.keys(players);
    const endsAt = now0 + durS * 1000;
    let now = now0, s = seed, until = 0, stuns = 0;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    E.retimeRun(round, durS);
    round.rand = rnd;
    while (now < endsAt) {
      now += 100;
      if (round.phase === 'run') {
        // the chase pass: each kid's own Robotín runs too, and a stunned kid can't answer (the crew still gets there)
        ids.forEach((pid) => {
          const kid = players[pid];
          const ev = E.stepChase(round, kid, true, 0.1, now);
          if (ev && ev.type === 'pzap') stuns++;
          if (now < (kid.esStunUntil || 0)) return;
          if (rnd() < rate * 0.1) { const right = rnd() < p; const r = E.answer(round, kid, right, n, endsAt - now <= 30000); E.chaseAnswer(round, kid, right, !!r.super, now); }
        });
        if (E.stepRun(round, players, 0.1, now).some((e) => e.type === 'done')) { E.startZone(round, now); until = now + E.zoneSeconds(round.level) * 1000; }
      } else if (round.phase === 'zone' && now >= until) {
        if (round.level >= E.R.LEVELS) return { escaped: true, left: (endsAt - now) / 1000, stuns };
        E.clearLevel(round); round.phase = 'cleared'; until = now + E.R.CLEARED_MS;
      } else if (round.phase === 'cleared' && now >= until) { E.startRun(round, now, false); E.retimeRun(round, (endsAt - now) / 1000); }
    }
    return { escaped: false, level: round.level, crew: round.crew, stuns };
  };
  for (const dur of [240, 300, 360]) {
    const spare = [];
    for (const n of [5, 12, 20, 30]) {
      let got = 0, left = 0, stuns = 0;
      for (let k = 1; k <= 6; k++) { const r = episode(n, dur, 0.13, 0.7, k * 131 + n); stuns += r.stuns; if (r.escaped) { got++; left += r.left; } }
      ok(got >= 5, `${dur / 60} min, ${n} kids: an average class reaches the jet (${got}/6, ${got ? (left / got).toFixed(0) : '-'} s to spare)`);
      spare.push(`${n} kids ${got}/6 ~${got ? (left / got).toFixed(0) : "-"} s, ${(stuns / 6 / n).toFixed(1)} zaps a kid`);
    }
    console.log(`${dur / 60} min, an average class: ${spare.join(' · ')} (the jet's 7.5 s take-off after that)`);
    let weak = 0;
    for (let k = 1; k <= 6; k++) if (episode(20, dur, 0.05, 0.5, k * 17).escaped) weak++;
    if (dur === 240) console.log(`4 min, 20 kids answering far less: ${weak}/6 escape`);
  }
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
  // v2 (playtest 2026-10-16: «Más rápido» won in 0.3 s by a kid one step from a zone; code review 2026-10-17): the time
  // is the reaction — the straight walk to the nearest zone comes off it — and a kid already inside one gets none
  const { round, players } = zoneRoom(3);
  E.startWave(round, players, now0 + 4000);
  const z = round.zones[0];
  const [a, b, c] = Object.keys(players);
  round.pos[a] = { x: z.x * T - 20, y: (z.y + 1.5) * T, f: 2, at: now0 + 4500 };       // 20 px from its edge
  round.pos[b] = { x: z.x * T - 140, y: (z.y + 1.5) * T, f: 2, at: now0 + 4500 };      // 140 px away (if no other zone is nearer)
  round.pos[c] = { x: (z.x + 1.5) * T, y: (z.y + 1.5) * T, f: 2, at: now0 + 4500 };    // inside it
  round.wave = 0;                                   // the same wave again: the same zones light up (deterministic)
  E.startWave(round, players, now0 + 5000);
  eq(JSON.stringify(round.zones[0]), JSON.stringify(z), 'the same zones');
  ok(players[c].esReachSkip && !players[a].esReachSkip && !players[b].esReachSkip, 'inside when it lit up: no time; outside: timed');
  const da = players[a].esStartDist, db = players[b].esStartDist;
  ok(da > 0 && da <= 21 && db > da, `the walk to the nearest zone is remembered (${da.toFixed(0)} px, ${db.toFixed(0)} px)`);
  // both step in 0.6 s after their walk: the same reaction time, whoever stood nearer
  const inAt = (d) => now0 + 5000 + 600 + Math.round(1000 * d / E.R.SPEED);
  players[a].esReach = inAt(da); players[b].esReach = inAt(db); players[c].esReach = now0 + 5000;
  [a, b, c].forEach((pid) => { round.pos[pid] = { x: (z.x + 1.5) * T, y: (z.y + 1.5) * T, f: 2, at: now0 + 9000 }; });
  E.resolveWave(round, players, now0 + 10000);
  near(players[a].esReachMs, 600, 2, 'a kid next to the zone: 0.6 s of reaction');
  near(players[b].esReachMs, 600, 2, 'a kid farther away: the same 0.6 s (the walk is not counted)');
  eq(players[c].esReachN || 0, 0, 'already inside: no time');
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

{
  // v2 (classroom playtest: 20 kids right 70 % of the time at one answer per 2-5 s never saw a zap or «¡Robotín se
  // acerca!»): his glitch sprint now lunges at a crew far ahead — a close call in every run — and trips just behind
  // them; such a class still is hardly ever zapped
  const runAt = (level, seed) => {
    const { round, players } = room(20, 300);
    round.level = level;
    let now = now0, done = false, closes = 0, zaps = 0, s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const ids = Object.keys(players);
    for (let i = 0; i < 3000 && !done; i++) {
      now += 100;
      ids.forEach((pid) => { if (rnd() < 0.2 * 0.1) E.answer(round, players[pid], rnd() < 0.7, 20); });
      const ev = E.stepRun(round, players, 0.1, now);
      if (ev.some((e) => e.type === 'close')) closes++;
      if (ev.some((e) => e.type === 'zap')) zaps++;
      done = ev.some((e) => e.type === 'done');
    }
    return { closes, zaps, done };
  };
  let closes = 0, zaps = 0, runs = 0, withClose = 0;
  for (const level of [1, 2, 3]) for (let k = 1; k <= 6; k++) {
    const r = runAt(level, k * 59 + level);
    ok(r.done, `level ${level}: a lively class reaches the zone`);
    runs++; closes += r.closes; zaps += r.zaps; if (r.closes) withClose++;
  }
  ok(withClose >= runs * 0.6, `close calls in most runs of a lively class (${withClose}/${runs} runs, ${closes} alarms)`);
  ok(zaps <= runs * 0.5, `… but hardly any zap (${zaps} in ${runs} runs)`);
  console.log(`a lively class (20 kids, 70 % at 0.2 answers/s): «¡Robotín se acerca!» in ${withClose}/${runs} runs, ${zaps} zaps`);
}
{
  // v2 (classroom playtest: 3-6 kids of 25 outside a 9 s wave is normal at 7-10): one kid in five is free, 2 ❤️ only
  // when over 40 % of the class is out
  const lostWith = (n, outN) => {
    const { round, players } = zoneRoom(n);
    E.startWave(round, players, now0 + 4000);
    const c = centre(round.zones[0]);
    const ids = Object.keys(players);
    ids.forEach((pid, i) => { round.pos[pid] = i < outN ? round.pos[pid] : { x: c.x, y: c.y, f: 2, at: now0 + 9000 }; round.pos[pid].at = now0 + 9000; });
    const outside = ids.slice(0, outN).filter((pid) => M.zoneAt(round.zones, round.pos[pid].x, round.pos[pid].y) < 0).length;
    return { lost: E.resolveWave(round, players, now0 + 10000).lost, outside };
  };
  let r = lostWith(25, 5);
  ok(r.outside < 5 || r.lost === 0, `25 kids, 5 outside: free (${r.lost})`);
  r = lostWith(25, 9);
  ok(r.outside < 9 || r.lost === 1, `25 kids, 9 outside: 1 heart (${r.lost})`);
  r = lostWith(25, 12);
  ok(r.outside < 12 || r.lost === 2, `25 kids, 12 outside (over 40 %): 2 hearts (${r.lost})`);
  r = lostWith(3, 1);
  ok(r.outside < 1 || r.lost === 0, 'a class of 3: one kid may miss a wave for free');
}

// ---------- the chase pass (2026-10-19): Robotín chases EACH kid ----------
{
  const CH = E.R;
  // he closes in only while MY question is open, after the wake, never in my shield, my stun or a pause
  const { round, players } = room(4);
  const p = players.p0;
  let now = now0;
  E.stepChase(round, p, true, 0.1, now);
  eq(p.esGap, CH.CH_G0, 'a new run: he starts 14 m behind me');
  now = round.wakeAt - 100; E.stepChase(round, p, true, 1, now);
  eq(p.esGap, CH.CH_G0, 'asleep (the wake): he waits');
  now = round.wakeAt + 100; E.stepChase(round, p, false, 1, now);
  eq(p.esGap, CH.CH_G0, 'no question open (the result screen): he waits');
  E.stepChase(round, p, true, 1, now);
  near(p.esGap, CH.CH_G0 - E.chaseSpeed(round, p), 1e-9, 'a question open: he closes at his speed');
  const v0 = E.chaseSpeed(round, p);
  near(v0 * CH.CH_PACE0, CH.CH_K[0], 1e-9, 'his speed: CH_K metres per question at my usual pace');
  round.paused = true; const g1 = p.esGap; E.stepChase(round, p, true, 1, now);
  eq(p.esGap, g1, 'Pausa: he stands still');
  round.paused = false;
  // a right answer = I dash away (never past 16 m); a súper turbo farther; a wrong one = he gains, never to 0
  p.esGap = 5; let a = E.chaseAnswer(round, p, true, false, now);
  eq(a.gap, 5 + CH.CH_DASH, 'a right answer: +7.5 m');
  p.esGap = 5; a = E.chaseAnswer(round, p, true, true, now);
  eq(a.gap, 5 + CH.CH_DASH_SUPER, 'a súper turbo: +9.5 m');
  p.esGap = 15; a = E.chaseAnswer(round, p, true, true, now);
  eq(a.gap, CH.CH_GMAX, 'never farther than 16 m (he stays in sight)');
  p.esGap = 6; a = E.chaseAnswer(round, p, false, false, now);
  eq(a.gap, 6 - CH.CH_STUMBLE, 'a wrong answer: he gains 2.5 m');
  p.esGap = 2; a = E.chaseAnswer(round, p, false, false, now);
  eq(a.gap, CH.CH_FLOOR, 'a stumble alone never zaps (he stops 1.5 m behind)');
  p.esGap = 1; a = E.chaseAnswer(round, p, false, false, now);
  eq(a.gap, 1, '… and never pushes him back either');
  p.esGap = 3; p.esEscapes = 0; E.chaseAnswer(round, p, true, false, now);
  eq(p.esEscapes, 1, 'dashing away from under 4 m = an escape «por un pelo»');
  // he reaches me: a zap (stunned 1.8 s, then a 3.5 s shield, back to 14 m); inside his 45 s he trips instead
  p.esGap = 0.01; p.esShieldUntil = 0; p.esLungeAt = now + 99999;
  const ev = E.stepChase(round, p, true, 0.5, now);
  eq(ev && ev.type, 'pzap', 'he reaches me: a zap on me');
  eq(p.esStunUntil, now + CH.CH_STUN_MS, 'stunned 1.8 s');
  eq(p.esShieldUntil, now + CH.CH_STUN_MS + CH.CH_SHIELD_MS, 'then the shield');
  eq(p.esGap, CH.CH_G0, 'the gap resets after a zap');
  eq(round.pzaps, 1, 'the round counts it');
  ok(!players.p1.esStunUntil || players.p1.esStunUntil <= now, 'a zap is mine alone (my crewmates go on)');
  eq(round.crew, 0, '… and the crew loses nothing');
  const g2 = p.esGap; E.stepChase(round, p, true, 1, now + 500);
  eq(p.esGap, g2, 'stunned: he waits');
  E.stepChase(round, p, true, 1, now + CH.CH_STUN_MS + 1000);
  eq(p.esGap, g2, 'my shield: he waits');
  const open0 = p.esOpenMs;
  E.stepChase(round, p, true, 1, now + 300);
  eq(p.esOpenMs, open0, 'the stun is not my answer time (my question is not shortened)');
  p.esGap = 0.01; p.esShieldUntil = 0; p.esStunUntil = 0;
  const ev2 = E.stepChase(round, p, true, 0.5, now + 20000);
  eq(ev2 && ev2.type, 'trip', 'reached again inside 45 s: he trips (no second zap)');
  eq(p.esGap, CH.CH_TRIP_TO, '… back to 6 m');
  p.esGap = 0.01;
  const ev3 = E.stepChase(round, p, true, 0.5, now + CH.CH_ZAP_MIN_MS + 1);
  eq(ev3 && ev3.type, 'pzap', 'after 45 s he may zap me again');
  // «¡Está detrás de ti!» once under 4 m, again only after I got past 7 m
  const q = players.p2;
  let t = round.wakeAt + 1000;
  q.esLungeAt = t + 1e9; E.stepChase(round, q, true, 0.01, t);
  q.esGap = 4.2; let nears = 0;
  for (let i = 0; i < 40; i++) { t += 100; const e = E.stepChase(round, q, true, 0.1, t); if (e && e.type === 'near') nears++; }
  eq(nears, 1, 'under 4 m: «¡Está detrás de ti!» once');
  q.esGap = 8; E.stepChase(round, q, true, 0.01, t += 100); q.esGap = 3.9; const again = E.stepChase(round, q, true, 0.01, t += 100);
  eq(again && again.type, 'near', '… and again after he fell back past 7 m');
  // his lunges: a siren, for 1.8 s he swoops in
  const L = players.p3;
  t = round.wakeAt + 1000;
  E.stepChase(round, L, true, 0.01, t);
  L.esLungeAt = t + 100; L.esGap = 15;
  const lu = E.stepChase(round, L, true, 0.1, t + 200);
  eq(lu && lu.type, 'lunge', 'a lunge (the siren on my phone)');
  const gl = L.esGap; E.stepChase(round, L, true, 1, t + 400);
  near(gl - L.esGap, E.chaseSpeed(round, L) * CH.CH_LUNGE_X + (gl - L.esLungeTo) * CH.CH_LUNGE_K, 1e-9, 'lunging: 1.5× his speed + the swoop towards his target');
  ok(L.esLungeTo >= CH.CH_LUNGE_TO[0] && L.esLungeTo <= CH.CH_LUNGE_TO[1], 'his swoop aims 5-7.5 m behind me');
  ok(E.chaseView(round, L, t + 400, true).lu > 0, 'my phone hears the lunge');
  // a new run: everyone starts 14 m back again (the 45 s carry over)
  E.startRun(round, t + 5000, false);
  E.stepChase(round, p, true, 0.01, t + 5000);
  eq(p.esGap, CH.CH_G0, 'a new run: 14 m again');
  ok(p.esZapAt > 0, '… his 45 s on me carry over');
  eq(E.chaseView(round, players.p1, t + 5000, true).g, CH.CH_G0, 'a kid who has not stepped yet sees him 14 m back');
  // a pause DURING my stun (review 2026-10-19): my phone keeps hearing the time that was left, not the wall clock; on
  // «Seguir» every timer moves by the pause; an answer while paused moves nothing and forgets its open time
  {
    const PS = players.p1;
    const t1 = round.wakeAt + 30000;
    E.stepChase(round, PS, true, 0.01, t1);
    PS.esStunUntil = t1 + 1500; PS.esShieldUntil = t1 + 5000;
    round.paused = true; round.pausedAt = t1;
    const v1 = E.chaseView(round, PS, t1 + 4000, true);
    eq([v1.st, v1.sh, v1.v], [1500, 5000, 0], 'paused mid-stun: the stun and the shield left stay as they were, he stands still');
    PS.esOpenMs = 4000;
    eq(E.chaseAnswer(round, PS, true, false, t1 + 4000), null, 'an answer while paused moves nothing');
    eq(PS.esOpenMs, 0, '… and forgets its open time');
    E.shiftTimers(round, { p1: PS }, 7000);
    round.paused = false;
    const v2 = E.chaseView(round, PS, t1 + 7000, true);
    eq(v2.st, 1500, '«Seguir»: the stun goes on with the time that was left');
  }
  // a pause moves my stun, shield, lunge and his 45 s too
  const sh = { esStunUntil: 100, esShieldUntil: 200, esLungeAt: 300, esLungeUntil: 400, esZapAt: 500 };
  E.shiftTimers({ pos: {} }, { a: sh }, 1000);
  eq([sh.esStunUntil, sh.esShieldUntil, sh.esLungeAt, sh.esLungeUntil, sh.esZapAt], [1100, 1200, 1300, 1400, 1500], 'Pausa: every chase timer waits');
}
{
  // the whole crew caught (the v2 crew zap, rare): the crew slides back and is dizzy (slower), but no tiles lock
  const { round, players } = room(6);
  round.robot = round.crew; round.wakeAt = 0;
  const ev = E.stepRun(round, players, 0.1, now0 + 10000).find((e) => e.type === 'zap');
  ok(ev, 'the crew is caught');
  ok(Object.values(players).every((p) => !(p.esStunUntil > now0) && p.esZapped === 1), 'nobody stunned by it: the crew slows down, every kid keeps answering');
}
{
  // zaps per kid per minute of running (zone 1..3), a kid of each kind, many runs: everyone hears him coming every
  // question; a strong kid is hardly ever zapped, a slow or young kid more but never every question and never past the cap
  const minute = 60000;
  const gauss = (r) => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const kid = (prof, level, minutes, seed) => {
    let s = seed;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const { round, players } = room(1);
    round.level = level; round.rand = r;
    const p = players.p0;
    let now = now0, open = true, need = 0, have = 0, restUntil = 0, streak = 0, came = false, closedQ = 0;
    const st = { zaps: 0, trips: 0, qs: 0, red: 0, behind: 0, lunges: 0 };
    let red = false, behind = false;
    const draw = () => (prof.afk ? 1e9 : Math.max(1.2, prof.median * Math.exp(0.45 * gauss(r))));
    need = draw();
    E.stepChase(round, p, true, 0, now);

    const end = now0 + minutes * minute;
    let runStart = now0;
    while (now < end) {
      now += 100;
      // a run is ~45 s: a new run every 45 s (wake included), like a real round
      if (now - runStart >= 45000) { E.startRun(round, now, false); runStart = now; }
      if (!open && now >= restUntil) { open = true; need = draw(); have = 0; red = false; behind = false; came = false; }
      if (open && now >= (p.esStunUntil || 0)) {
        have += 0.1;
        const timeUp = have >= 20;
        if (have >= need || timeUp) {
          const right = !timeUp && r() < prof.p;
          streak = right ? streak + 1 : 0;
          if (came) closedQ++;
          E.chaseAnswer(round, p, right, right && streak % 3 === 0, now);
          st.qs++; if (red) st.red++; if (behind) st.behind++;
          open = false; restUntil = now + (right ? 1300 : 1600);
        }
      }
      const g0 = p.esGap;
      const e = E.stepChase(round, p, open, 0.1, now);
      if (open && (p.esGap < g0 || (e && (e.type === 'pzap' || e.type === 'trip')))) came = true;
      if (open && p.esGap < E.R.CH_WARN) red = true;
      if (open && p.esGap < E.R.CH_NEAR) behind = true;
      if (e) st[{ pzap: 'zaps', trip: 'trips', lunge: 'lunges' }[e.type] || 'other'] = (st[{ pzap: 'zaps', trip: 'trips', lunge: 'lunges' }[e.type] || 'other'] || 0) + 1;
    }
    st.closedQ = closedQ;
    return st;
  };
  const KINDS = {
    strong: { median: 3.5, p: 0.92 },     // quick and right 92 %
    average: { median: 6, p: 0.72 },
    slow: { median: 11, p: 0.5 },
    young: { median: 14, p: 0.45 },       // the youngest: slow, often wrong, time-ups
    away: { afk: true, p: 0 },            // never answers (time-ups only)
  };
  const per = {};
  const MIN = 3, RUNS = 30;
  Object.entries(KINDS).forEach(([name, prof]) => {
    const tot = { zaps: 0, trips: 0, qs: 0, red: 0, behind: 0, lunges: 0, closedQ: 0 };
    for (const level of [1, 2, 3]) for (let k = 1; k <= RUNS; k++) { const s = kid(prof, level, MIN, k * 97 + level * 7 + name.length); Object.keys(tot).forEach((x) => { tot[x] += s[x] || 0; }); }
    const mins = MIN * RUNS * 3;
    per[name] = { zpm: tot.zaps / mins, red: tot.red / tot.qs, behind: tot.behind / tot.qs, lpm: tot.lunges / mins, qpm: tot.qs / mins, closed: tot.closedQ / tot.qs, tpm: tot.trips / mins };
  });
  const cap = minute / E.R.CH_ZAP_MIN_MS;
  Object.entries(per).forEach(([name, x]) => {
    ok(x.zpm <= cap + 1e-9, `${name}: never more than one zap per 45 s (${x.zpm.toFixed(2)}/min, cap ${cap.toFixed(2)})`);
    ok(x.zpm < x.qpm / 3, `${name}: never zapped every question (${x.zpm.toFixed(2)} zaps vs ${x.qpm.toFixed(1)} questions a minute)`);
    if (name !== 'away') ok(x.closed > 0.9, `${name}: he comes closer in (almost) every question (${(100 * x.closed).toFixed(0)} %)`);
  });
  ok(per.strong.zpm <= 0.2, `a strong kid is hardly ever zapped (${per.strong.zpm.toFixed(2)}/min)`);
  ok(per.strong.red >= 0.08, `… but still has close calls (red in ${(100 * per.strong.red).toFixed(0)} % of questions)`);
  ok(per.average.zpm >= 0.1 && per.average.zpm <= 0.6, `an average kid meets a zap now and then (${per.average.zpm.toFixed(2)}/min)`);
  ok(per.slow.zpm <= 0.9 && per.young.zpm <= 0.9, `a slow or young kid: more, but well under the cap (${per.slow.zpm.toFixed(2)}, ${per.young.zpm.toFixed(2)}/min)`);
  ok(per.strong.zpm < per.average.zpm && per.average.zpm < per.slow.zpm, 'answering right keeps him away (strong < average < slow)');
  ok(per.young.red <= 0.75, `the youngest are not in the red all the time (${(100 * per.young.red).toFixed(0)} % of questions)`);
  Object.entries(per).forEach(([name, x]) => console.log(`chase · ${name.padEnd(7)} ${x.zpm.toFixed(2)} zaps/min · ${x.tpm.toFixed(2)} trips/min · ${x.lpm.toFixed(1)} lunges/min · red in ${(100 * x.red).toFixed(0)} % of questions · «¡Está detrás de ti!» in ${(100 * x.behind).toFixed(0)} % · ${x.qpm.toFixed(1)} questions/min`));
}

// ---------- ranks + the end ----------
eq(E.rankOf(3, 5), { id: 'cielo', name: 'Pilotos del Cielo', stars: 3, art: M.JET }, 'escaped with every heart');
eq(E.rankOf(3, 1, 1).name, 'Viajeros de la Muralla', 'the China route names its ranks');
eq(E.rankOf(0, 5, 1).name, 'Exploradores del Mercado', '… all of them');
eq(E.rankOf(1, 1, 0).name, 'Exploradores del Zoco', 'the Dubái route keeps v1 names');
eq(E.rankOf(3, 3).id, 'cielo', 'escaped with 3 hearts');
eq(E.rankOf(3, 1).id, 'burj', 'escaped with 1 heart');
eq(E.rankOf(2, 4).id, 'burj', '2 zones, 4 hearts');
eq(E.rankOf(2, 1).id, 'burj', '2 zones (reached the last place), even with 1 heart');
eq(E.rankOf(0, 5).id, 'zoco', 'still in zone 1');
// v2 (classroom playtest: a class caught at a gate refills to 3 ❤️ and got more stars than one that escaped): the stars
// follow the progress — escaping always earns more than not escaping
eq(E.rankOf(3, 2).stars, 2, 'escaped with 2 hearts: two stars');
eq(E.rankOf(3, 4).stars, 3, 'escaped with 4 hearts: three stars');
eq(E.rankOf(2, 5).stars, 1, 'not escaped, every heart: one star');
eq(E.rankOf(0, 5).stars, 1, 'still in zone 1: one star whatever the hearts');
for (let h = 0; h <= 5; h++) for (let h2 = 0; h2 <= 5; h2++) for (const lc of [0, 1, 2]) ok(E.rankOf(3, h).stars > E.rankOf(lc, h2).stars, `escaping (${h} ❤️) beats ${lc} zones (${h2} ❤️)`);
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

// ---------- 2026-10-16 ending pass: «¡Súper turbos!» in the last 30 s, the stars ----------
{
  const { round, players } = room(10);
  const [a, b] = Object.values(players);
  const before = round.pending;
  const r1 = E.answer(round, a, true, 10, true);
  ok(r1.turbo && r1.super, 'the last 30 s: a right answer is a súper turbo');
  near(round.pending - before, E.turboGain(round, 10, true), 1e-9, '… worth 2.5× a turbo');
  const r2 = E.answer(round, b, true, 10, false);
  ok(r2.turbo && !r2.super, 'before the last 30 s: a plain turbo (1 in a row)');
  eq(E.answer(round, b, false, 10, true).turbo, false, 'a wrong answer is never a turbo, even in the last 30 s');
}
{
  const { round, players } = room(4);
  const [a, b, c, d] = Object.values(players);
  a.esTurbos = 9; a.esBest = 2; a.esSafe = 3; b.esTurbos = 4; b.esBest = 6; b.esReachMs = 6000; b.esReachN = 2; b.esSafe = 3;
  c.esReachMs = 800; c.esReachN = 1; c.esSafe = 1;
  const fin = E.finish(round, players);
  const ids = fin.stars.map((s) => s.id);
  eq(ids, ['turbos', 'fast', 'streak', 'safe'], 'the four stars of La Gran Fuga');
  eq(fin.stars.find((s) => s.id === 'turbos').winners, [a.esIdx], 'Más turbos');
  eq(fin.stars.find((s) => s.id === 'fast').winners, [b.esIdx], 'Más rápido: 2 timed waves needed');
  eq(fin.stars.find((s) => s.id === 'fast').value, 3, 'Más rápido in seconds (3,0 s average)');
  eq(fin.stars.find((s) => s.id === 'safe').winners, [a.esIdx, b.esIdx], 'Más olas a salvo: the whole top shares it (co-op)');
  ok(fin.rows.every((r) => Array.isArray(r.stars) && r.team === 'crew'), 'every kid knows their stars');
  eq(d.esTurbos || 0, 0, 'a kid with nothing gets no star');
  ok(!fin.rows.find((r) => r.k === d.esIdx).stars.length, '… and no star');
}
console.log(`escape: all ${checks} checks passed`);
