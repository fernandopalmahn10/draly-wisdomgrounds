// Rules check for Batalla de Nieve en Ski Dubái (core/snow.js + public/js/snow-map.js). Run: node scripts/test-snow.js
'use strict';
const assert = require('assert');
const S = require('../core/snow');
const M = require('../public/js/snow-map');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };
const T = M.TILE;

// ---------- the map ----------
for (let seed = 1; seed <= 300; seed++) {
  const m = M.buildMap(seed * 7919);
  const a = M.buildMap(seed * 7919);
  eq(Array.from(m.grid), Array.from(a.grid), `seed ${seed}: same seed, same map`);
  // every walkable tile is reachable from the ice team's home
  const seen = new Uint8Array(m.cols * m.rows);
  const start = Math.floor(M.CY) * m.cols + Math.floor(M.CX);
  ok(m.grid[start] === M.FLOOR, `seed ${seed}: the centre of Ski Dubái is open`);
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const i = q.pop(); const x = i % m.cols, y = (i / m.cols) | 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const j = (y + dy) * m.cols + x + dx;
      if (x + dx >= 0 && x + dx < m.cols && y + dy >= 0 && y + dy < m.rows && !seen[j] && m.grid[j] === M.FLOOR) { seen[j] = 1; q.push(j); }
    });
  }
  let floor = 0, reach = 0;
  for (let i = 0; i < m.grid.length; i++) if (m.grid[i] === M.FLOOR) { floor++; if (seen[i]) reach++; }
  eq(reach, floor, `seed ${seed}: no walled-in pockets (${floor - reach} unreachable)`);
  // 5 stations, each with a reachable tile next to it; jobs and spawns on/next to reachable floor
  eq(m.stations.length, 5, `seed ${seed}: five stations`);
  m.stations.forEach((s) => {
    let open = false;
    for (let y = s.y - 1; y <= s.y + 2; y++) for (let x = s.x - 1; x <= s.x + 2; x++) if (seen[y * m.cols + x]) open = true;
    ok(open, `seed ${seed}: station ${s.id} can be reached`);
    ok(M.pathTo(m, M.CX * T, M.CY * T, s.x, s.y, 2, 2), `seed ${seed}: a walk exists to station ${s.id}`);
  });
  ok(m.jobs.filter((j) => j.kind === 'pearl').length === 4, `seed ${seed}: four pearl spots`);
  ok(m.jobs.filter((j) => j.kind === 'date').length >= 3, `seed ${seed}: date palms to harvest`);
  m.jobs.forEach((j) => {
    let open = false;
    const jx = Math.floor(j.x), jy = Math.floor(j.y);
    for (let y = jy - 1; y <= jy + 1; y++) for (let x = jx - 1; x <= jx + 1; x++) if (seen[y * m.cols + x]) open = true;
    ok(open, `seed ${seed}: job ${j.id} (${j.kind}) has a tile to stand on`);
  });
  ok(m.spawns.sun.length > 40 && m.spawns.ice.length >= 8, `seed ${seed}: enough spawn spots`);
  m.spawns.sun.concat(m.spawns.ice).forEach(([x, y]) => ok(seen[y * m.cols + x], `seed ${seed}: spawn ${x},${y} reachable`));
  ['zoco', 'creek', 'museo', 'ski', 'desierto', 'bulevar', 'plaza'].forEach((z) => ok((m.chestSpots[z] || []).length > 5, `seed ${seed}: chest spots in ${z}`));
  ok(!M.boxBlocked(m, (m.spawns.ice[0][0] + 0.5) * T, (m.spawns.ice[0][1] + 0.5) * T + 6), `seed ${seed}: a kid fits at the ice spawn`);
}
// walking: a body never ends inside a wall, even pushing into one for a long time
{
  const m = M.buildMap(42);
  const b = { x: (M.CX) * T, y: (M.CY) * T + 6 };
  for (let i = 0; i < 2000; i++) { M.moveBody(m, b, 2.5, -1.2); ok(!M.boxBlocked(m, b.x, b.y), 'body stays out of walls'); }
}
eq(M.dirOf(1, 0), 0, 'right = 0'); eq(M.dirOf(0, 1), 2, 'down = 2'); eq(M.dirOf(-1, -1), 5, 'up-left = 5'); eq(M.dirOf(0, 0), -1, 'still');
eq(M.skinFor('🐉', 'x'), 'dralingo', 'saga emoji → its avatar');
eq(M.skinFor('🌎', 'x'), 'aileen', 'Aileen');
ok(M.SKINS.includes(M.skinFor('🐱', 'Lucía')), 'an old animal emoji still gets a saga avatar');
eq(M.skinFor('🐱', 'Lucía'), M.skinFor('🦊', 'lucía'), 'the same name always walks as the same character');

// ---------- the rules ----------
eq([0, 1, 2, 3, 10, 24, 25, 36, 37].map(S.firstIceCount), [0, 0, 1, 2, 2, 2, 3, 3, 4], 'how many the spell freezes');

function room(n, now) {
  const round = S.newRound(4242, now);
  const players = {};
  for (let i = 0; i < n; i++) {
    const id = 'p' + i;
    players[id] = S.preparePlayer(round, { name: 'Kid' + i }, now, false);
    round.pos[id] = { x: (M.CX + (i % 5)) * T, y: (M.CY) * T + 6, f: 0, at: now };
  }
  return { round, players };
}
let now = 1e6;
{
  const { round, players } = room(10, now);
  const p = players.p0;
  eq([p.snSide, p.snCopos, p.snCalor], ['sun', 3, 3], 'everyone starts as a survivor with 3 copos and 3 calor');
  eq(S.preparePlayer(round, p, now + 5, false), p, 'preparing again (rejoin) keeps the kid');
  eq(p.snIdx, 1, 'kept its index');
  // throwing before the spell is not allowed
  eq(S.throwBall(round, p, 'p0', 1, 0, now).error, 'early', 'no snowballs during the head start');
  // the spell
  const frozen = S.castSpell(round, players, round.spellAt, () => 0);
  eq(frozen.length, 2, 'the spell freezes two of ten');
  eq(S.counts(players), { sun: 8, ice: 2, total: 10 }, 'counts after the spell');
  frozen.forEach((id) => ok(players[id].snRespawnUntil === round.spellAt + S.R.RESPAWN_MS, 'frozen kids respawn after 3 s'));
  // answers
  const q = players.p5;
  eq(S.answer(q, true), { gained: 3, racha: false, calor: false }, 'right answer: +3 copos');
  eq(q.snCopos, 6, 'copos added');
  S.answer(q, true);
  eq(S.answer(q, true).racha, true, 'third right answer in a row: racha');
  eq(q.snCopos, 3 + 3 + 3 + 5, '¡Racha! pays 2 more');
  S.answer(q, false);
  eq(q.snStreak, 0, 'a wrong answer breaks the streak');
  eq(q.snCopos, 14, 'a wrong answer gives nothing');
  for (let i = 0; i < 10; i++) S.answer(q, true);
  eq(q.snCopos, S.R.COPOS_MAX, 'copos are capped');
}
{
  // ice hits: brrr, then frozen; survivor hits: stun; same side: nothing; shield blocks
  now += 100000;
  const { round, players } = room(4, now);
  round.spellCast = true;
  S.turnIce(round, players.p0, now - 10000, 'spell');
  players.p0.snRespawnUntil = 0;
  const ice = players.p0, sun = players.p1;
  round.pos.p0 = { x: 10 * T, y: 13 * T, at: now };
  round.pos.p1 = { x: 10 * T + 100, y: 13 * T, at: now };
  round.pos.p2 = { x: 30 * T, y: 13 * T, at: now };
  round.pos.p3 = { x: 30 * T, y: 20 * T, at: now };
  round.map = M.buildMap(1);   // a known open stretch in the desert row 13? find one
  // put the two kids on an open row of the map so walls never interfere
  const m = round.map;
  let row = -1, col = -1;
  for (let y = 11; y < 24 && row < 0; y++) for (let x = 1; x < 9; x++) {
    let clear = true;
    for (let k = 0; k < 6; k++) if (m.grid[y * m.cols + x + k] !== M.FLOOR || m.grid[(y - 1) * m.cols + x + k] !== M.FLOOR) clear = false;
    if (clear) { row = y; col = x; break; }
  }
  ok(row > 0, 'found an open row');
  round.pos.p0 = { x: (col + 0.5) * T, y: (row + 0.7) * T, at: now };
  round.pos.p1 = { x: (col + 4.5) * T, y: (row + 0.7) * T, at: now };
  const t1 = S.throwBall(round, ice, 'p0', 1, 0, now);
  ok(t1.ball && ice.snCopos === 2, 'a throw costs one copo');
  eq(S.throwBall(round, ice, 'p0', 1, 0, now + 100).error, 'cooldown', 'throws have a short cooldown');
  let evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, now + 100 * i);
  eq(evs[0].type, 'brrr', 'first ice hit: brrr');
  eq(sun.snCalor, 2, 'two calor left');
  S.throwBall(round, ice, 'p0', 1, 0, now + 1000);
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, now + 1000 + 100 * i);
  eq([evs[0].type, sun.snCalor], ['brrr', 1], 'second ice hit: brrr, one calor left');
  ice.snCopos += 1;
  S.throwBall(round, ice, 'p0', 1, 0, now + 2000);
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, now + 2000 + 100 * i);
  eq(evs[0].type, 'freeze', 'third ice hit: frozen');
  eq([sun.snSide, ice.snFreezes], ['ice', 1], 'the survivor joined the ice team and the thrower scored');
  ok(sun.snRespawnUntil > now + 2000, 'frozen kid is respawning');
  // a respawning kid can't be hit
  S.turnIce(round, players.p2, now, 'x');
  eq(S.cantThrow(round, players.p2, now + 100), 'respawn', 'no throws while respawning');
  // survivor hits ice → stun 3 s (the ice team is 3 of 4 here: no armor)
  eq(S.iceArmor(players), false, 'a big ice team has no armor');
  const sun2 = players.p3;
  round.pos.p3 = { x: (col + 0.5) * T, y: (row + 0.7) * T, at: now };
  round.pos.p0 = { x: (col + 4.5) * T, y: (row + 0.7) * T, at: now };
  delete round.pos.p1; delete round.pos.p2;
  const t5 = now + 5000;
  S.throwBall(round, sun2, 'p3', 1, 0, t5);
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, t5 + 100 * i);
  eq(evs[0].type, 'stun', 'survivor hit on ice: stun');
  ok(ice.snStunUntil > t5 && ice.snStunUntil <= t5 + 1000 + S.R.STUN_MS, 'stun lasts 3 s');
  eq(S.cantThrow(round, ice, t5 + 1500), 'stun', 'a stunned kid cannot throw');
  eq(sun2.snStuns, 1, 'stuns are counted');
  // no stun-lock: right after a stun the ice kid can't be stunned again for a while
  const stunEnd = ice.snStunUntil;
  sun2.snCopos = 5;
  S.throwBall(round, sun2, 'p3', 1, 0, stunEnd + 200);
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, stunEnd + 200 + 100 * i);
  eq(evs[0].type, 'shield', 'just after a stun: immune (no stun-lock)');
  eq(S.cantThrow(round, ice, stunEnd + 300), null, 'and free to throw again');
  ok(sun.snCopos >= S.R.ICE_START_COPOS, 'a freshly frozen kid has copos to hunt with');
  ok(sun.snShieldUntil > sun.snRespawnUntil, 'a respawned ice kid is immune for a moment');
  // same side: the ball flies through
  round.pos.p1 = { x: (col + 2.5) * T, y: (row + 0.7) * T, at: now };   // p1 is ice now, between p3 (sun) and p0 (ice)
  players.p1.snRespawnUntil = 0;
  S.throwBall(round, ice, 'p0', -1, 0, t5 + 4000);   // ice throws left toward p1 (ice) and p3 (sun)
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, t5 + 4000 + 100 * i);
  eq([evs[0].type, evs[0].target], ['brrr', 'p3'], 'a teammate in the way is not hit');
  // shield
  sun2.snShieldUntil = t5 + 20000;
  eq(ice.snCopos, 0, 'three throws used the three starting copos');
  ice.snCopos = 3;
  S.throwBall(round, ice, 'p0', -1, 0, t5 + 6000);
  evs = [];
  for (let i = 0; i < 10 && !evs.length; i++) evs = S.stepBalls(round, players, 0.1, t5 + 6000 + 100 * i);
  eq(evs[0].type, 'shield', 'late joiners are shielded');
  eq(sun2.snCalor, 2, 'the shield took the hit');
  // no copos, no snowballs
  ice.snCopos = 0;
  eq(S.throwBall(round, ice, 'p0', 1, 0, t5 + 9000).error, 'copos', 'no copos, no snowballs');
  // balls stop at walls
  round.balls = [{ id: 99, by: 'p3', side: 'sun', x: 2 * T, y: 13 * T, dx: -1, dy: 0, left: S.R.BALL_RANGE }];
  evs = S.stepBalls(round, players, 0.5, t5 + 9000);
  eq(evs[0].type, 'splash', 'a ball hitting the wall splashes');
  eq(round.balls.length, 0, 'and is gone');
}
{
  // end conditions + scores
  now += 100000;
  const { round, players } = room(3, now);
  eq(S.winnerNow(round, players), null, 'no winner before the spell');
  S.castSpell(round, players, now, () => 0);
  eq(S.counts(players).sun, 1, '3 kids: 2 frozen by the spell, 1 survivor');
  eq(S.winnerNow(round, players), null, 'a survivor left: keep playing');
  const last = Object.values(players).find((p) => p.snSide === 'sun');
  last.snRight = 2;
  S.turnIce(round, last, now + 30000, 'p0');
  eq(S.winnerNow(round, players), 'ice', 'nobody left: the ice team wins');
  eq(S.scoreOf(last, now + 99999), 30 + 2 * 20, 'score = seconds survived + 20 per right answer');
  const fin = S.finish(round, players, now + 40000);
  eq(fin.winner, 'ice', 'finish: ice wins');
  ok(fin.rows.length === 3 && fin.mvpIce, 'finish: rows and the ice MVP');
  // a disconnected survivor doesn't keep the round alive
  const r2 = room(4, now);
  S.castSpell(r2.round, r2.players, now, () => 0);
  Object.values(r2.players).filter((p) => p.snSide === 'sun').forEach((p) => { p.disconnected = true; });
  eq(S.winnerNow(r2.round, r2.players), 'ice', 'survivors who left the game do not count');
  // survivors win at the end of the timer
  const r3 = room(5, now);
  S.castSpell(r3.round, r3.players, now, () => 0);
  eq(S.finish(r3.round, r3.players, now + 60000).winner, 'sun', 'survivors left at the end: they win');
  ok(S.finish(r3.round, r3.players, now + 60000).mvpSun.seconds === 60, 'survivor MVP survived 60 s');
}
{
  // chest + jobs + position checks + pause
  now += 100000;
  const { round, players } = room(2, now);
  const p = players.p0;
  const c = S.spawnChest(round, now, () => 0.5);
  ok(c && round.chest === c, 'a chest appears');
  eq(S.grabChest(round, p, 'p0', c.id, now).error, 'far', 'too far to grab it');
  round.pos.p0 = { x: c.x + 10, y: c.y, at: now };
  round.pos.p1 = { x: c.x - 10, y: c.y, at: now };
  const g = S.grabChest(round, p, 'p0', c.id, now);
  ok(g.ok && p.snCopos === 8, 'first kid there: +5 copos');
  eq(S.grabChest(round, players.p1, 'p1', c.id, now).error, 'gone', 'the second kid is too late');
  const c2 = S.spawnChest(round, now, () => 0.5);
  ok(c2.zone !== c.zone, 'the next chest is in another zone');
  const job = round.map.jobs[0];
  round.pos.p0 = { x: job.x * T, y: (job.y + 1) * T, at: now };
  ok(S.doJob(round, p, 'p0', job.id, now).ok, 'a job pays when standing next to it');
  eq(p.snCopos, 9, '+1 copo');
  eq(S.doJob(round, p, 'p0', job.id, now + 3000).error, 'cooldown', 'jobs have a 10 s cooldown');
  ok(S.doJob(round, p, 'p0', job.id, now + 10001).ok, 'and pay again after it');
  // positions
  const pos0 = round.pos.p0;
  ok(S.checkPos(round, p, 'p0', pos0.x, pos0.y + 20, now + 500).ok, 'walking is accepted');
  ok(!S.checkPos(round, p, 'p0', pos0.x + 900, pos0.y, now + 500).ok, 'teleporting is refused');
  ok(!S.checkPos(round, p, 'p0', 0, 0, now + 3000).ok, 'standing in the wall is refused');
  p.snStunUntil = now + 4000;
  ok(!S.checkPos(round, p, 'p0', pos0.x, pos0.y + 40, now + 1000).ok, 'a stunned kid cannot walk');
  // stations: reach
  const st = round.map.stations[0];
  round.pos.p1 = { x: (st.x - 0.5) * T, y: (st.y + 1) * T, at: now };
  ok(S.nearStation(round, 'p1', st.id), 'next to a station');
  round.pos.p1 = { x: (st.x + 12) * T, y: (st.y + 9) * T, at: now };
  ok(!S.nearStation(round, 'p1', st.id), 'far from a station');
  // pause shifts every timer
  const before = { spell: round.spellAt, stun: p.snStunUntil, since: p.snSunSince };
  S.shiftTimers(round, players, 5000);
  eq([round.spellAt - before.spell, p.snStunUntil - before.stun, p.snSunSince - before.since], [5000, 5000, 5000], 'pause moves the timers');
  round.paused = true;
  eq(S.cantThrow(round, p, now), 'paused', 'no throws while paused');
}
{
  // warmth, the last refuge, the ice team's slower throws
  now += 100000;
  const { round, players } = room(4, now);
  S.castSpell(round, players, now, () => 0);
  const sun = Object.values(players).find((p) => p.snSide === 'sun');
  const ice = Object.values(players).find((p) => p.snSide === 'ice');
  sun.snCalor = 1; sun.snHitAt = now;
  eq(S.warmUp(players, now + 14000).length, 0, 'no warmth before 15 s');
  eq(S.warmUp(players, now + 15000).length, 1, 'warm again after 15 s without a hit');
  eq(sun.snCalor, 2, '+1 calor');
  eq(S.warmUp(players, now + 16000).length, 0, 'one at a time');
  S.warmUp(players, now + 30000);
  eq(sun.snCalor, 3, 'and up to the max');
  eq(S.warmUp(players, now + 60000).length, 0, 'never above the max');
  eq(S.warmUp(players, now + 60000).includes(ice), false, 'the ice team does not warm up');
  sun.snCalor = 1;
  S.refuge(players, now);
  eq([sun.snCalor, sun.snShieldUntil], [S.R.CALOR_MAX, now + S.R.REFUGE_SHIELD_MS], 'last refuge: full calor + shield');
  ice.snRespawnUntil = 0; ice.snLastThrow = now; ice.snCopos = 3; round.paused = false;
  eq(S.cantThrow(round, ice, now + 800), 'cooldown', 'the ice team throws a little slower');
  eq(S.cantThrow(round, ice, now + 1000), null, '…but throws');
  sun.snLastThrow = now; sun.snCopos = 3;
  eq(S.cantThrow(round, sun, now + 700), null, 'survivors throw faster');
}
{
  // the small ice team wears the spell's armor: survivors can't stun it
  now += 100000;
  const { round, players } = room(10, now);
  S.castSpell(round, players, now, () => 0);
  ok(S.iceArmor(players), '2 of 10 frozen: armor on');
  const ice = Object.entries(players).find(([, p]) => p.snSide === 'ice');
  const sun = Object.entries(players).find(([, p]) => p.snSide === 'sun');
  ice[1].snShieldUntil = 0;
  const ev = S.applyHit(round, players, { id: 1, by: sun[0], side: 'sun' }, ice[0], now + 9000);
  eq(ev.type, 'armor', 'a survivor ball bounces off the armor');
  eq(ice[1].snStunUntil, 0, 'no stun');
  Object.values(players).slice(0, 3).forEach((p) => S.turnIce(round, p, now, 'x'));
  ok(!S.iceArmor(players), '3 of 10 frozen: armor off');
  eq(S.R.ARMOR_RATIO, 0.2, 'armor until a fifth of the class is ice');
}
{
  // review fixes 2026-10-12: a kid hugging a wall on the right/bottom is never refused for a rounding hair
  now += 100000;
  const { round, players } = room(2, now);
  const m = round.map;
  let refused = 0, tries = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const R0 = M.rng(seed);
    const b = { x: (M.CX + 0.5) * T, y: M.CY * T + 6 };
    const dirs = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirs[seed % dirs.length];
    round.pos.p0 = { x: b.x, y: b.y, at: now };
    for (let f = 0; f < 240; f++) {           // 4 s of pushing at uneven frame times
      const dt = 1 / (40 + R0() * 40);
      for (let rem = dt; rem > 1e-6; rem -= 1 / 60) M.moveBody(m, b, dx * 150 * Math.min(rem, 1 / 60), dy * 150 * Math.min(rem, 1 / 60));
      const x = Math.round(b.x * 10) / 10, y = Math.round(b.y * 10) / 10;   // even an old rounding phone
      tries++;
      if (!S.checkPos(round, players.p0, 'p0', x, y, now + 50).ok) refused++;
      round.pos.p0 = { x, y, at: now };
    }
  }
  eq(refused, 0, `wall-hugging positions are accepted (${tries} tried)`);
  // the teleport window is 1.5 s at most
  round.pos.p0 = { x: (M.CX + 0.5) * T, y: M.CY * T + 6, at: now };
  ok(!S.checkPos(round, players.p0, 'p0', (M.CX + 0.5) * T + 420, M.CY * T + 6, now + 10000).ok, 'a phone silent for 10 s still cannot jump 420 px (1.5 s of walking at most)');
}
{
  // the last survivor's wifi blip doesn't end the round at once
  now += 100000;
  const { round, players } = room(3, now);
  S.castSpell(round, players, now, () => 0);
  const last = Object.values(players).find((p) => p.snSide === 'sun');
  last.disconnected = true; last.disconnectedAt = now;
  eq(S.winnerNow(round, players, now + 3000), null, 'the last survivor dropped 3 s ago: keep playing');
  eq(S.winnerNow(round, players, now + 11000), 'ice', 'gone for 11 s: the ice team wins');
  last.disconnected = false;
  eq(S.winnerNow(round, players, now + 12000), null, 'back again: keep playing');
}
// segment distance helper
eq(Math.round(S.segDist(0, 0, 10, 0, 5, 3).d2), 9, 'segment distance');

console.log(`snow: all ${checks} checks passed`);
