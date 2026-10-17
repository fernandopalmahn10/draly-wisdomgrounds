// Rules check for Dragones Pintores' level generator (core/paint.js). Run: node scripts/test-paint.js
const assert = require('assert');
const P = require('../core/paint');

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// 5 fixed seeds + 300 random ones (the server picks 1..1e6 at random each round)
const seeds = [1, 7, 12345, 987654, 424242];
for (let k = 0; k < 300; k++) seeds.push(1 + Math.floor(Math.random() * 1e6));
for (const seed of seeds) {
  const a = P.buildLevel(seed);
  const b = P.buildLevel(seed);
  ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: same seed must give the same map (server, projector and phones agree)`);
  ok(a.cols === P.COLS && a.rows === P.ROWS && a.solid.length === a.rows, `seed ${seed}: size`);
  const solid = (x, y) => a.solid[y] && a.solid[y][x] === '#';
  // every surface is a solid tile with open sky above it
  a.surfaces.forEach((id) => {
    const x = id % a.cols, y = Math.floor(id / a.cols);
    ok(solid(x, y) && !solid(x, y - 1), `seed ${seed}: surface ${id} must be solid with air above`);
  });
  // both kingdoms stand on ground with a clear column above the spawn
  ['red', 'gold'].forEach((t) => {
    const [sx, sy] = a.spawns[t];
    ok(solid(sx, sy + 1), `seed ${seed}: ${t} spawn has ground under it`);
    for (let y = 0; y <= sy; y++) ok(!solid(sx, y), `seed ${seed}: ${t} spawn column is clear (row ${y})`);
  });
  ok(a.surfaces.length > 150, `seed ${seed}: enough sky to paint (${a.surfaces.length})`);
  ok(JSON.stringify(a).length < 8000, `seed ${seed}: level payload stays small for phones`);
  a.gems.forEach(([x, y]) => ok(y > 2 && !solid(x, y) && !solid(x, y + 1), `seed ${seed}: gem ${x},${y} floats in open air`));
  ok(a.gems.length >= 10, `seed ${seed}: enough gems (${a.gems.length})`);
}
const c = P.counts({ 1: 'red', 2: 'gold', 3: 'red', 4: 'nobody' });
ok(c.red === 2 && c.gold === 1, 'counts() tallies each kingdom');
// ---------- 2026-10-16 ending pass: «¡Fuego doble!» in the last 30 s, the ending's stars and finish() ----------
ok(JSON.stringify(P.reward(1, false)) === JSON.stringify({ energy: 10, blaze: false }), 'a right answer: +10 s of fire');
ok(P.reward(3, false).blaze && P.reward(3, false).energy === 10, '3 in a row: a llamarada');
ok(P.reward(1, true).blaze && P.reward(1, true).energy === 20, 'the last 30 s: twice the fire and always a llamarada');
ok(P.reward(4, true).energy === 20 && P.reward(4, true).energy <= P.ENERGY_MAX, 'never more than twice');
{
  const rows = [
    { k: 1, name: 'Ana', skin: 'aileen', team: 'red', owned: 14, painted: 40, best: 4, blazes: 1, right: 5, answered: 7 },
    { k: 2, name: 'Omar', skin: 'hamdan', team: 'gold', owned: 14, painted: 61, best: 2, blazes: 0, right: 3, answered: 6 },
    { k: 3, name: 'Lía', skin: 'latifa', team: 'gold', owned: 2, painted: 9, best: 3, blazes: 2, right: 4, answered: 4 },
    { k: 4, name: 'Teo', skin: 'adric', team: 'red', owned: 0, painted: 0, best: 0, blazes: 0, right: 0, answered: 1 },
  ];
  const fin = P.finish(rows, { red: 20, gold: 31 });
  ok(fin.winner === 'gold', 'more clouds win');
  ok(P.finish(rows.map((r) => Object.assign({}, r)), { red: 5, gold: 5 }).winner === 'tie', 'equal clouds: a tie');
  ok(JSON.stringify(fin.rows.map((r) => r.k)) === '[2,1,3,4]' && JSON.stringify(fin.rows.map((r) => r.rank)) === '[1,1,3,4]', 'podium by clouds owned (ties share), then strokes');
  ok(fin.mvp.red === 1 && fin.mvp.gold === 2, 'the most sky of each kingdom');
  ok(JSON.stringify(fin.stars.map((s) => s.id)) === '["painted","sky","streak","blaze"]', 'the four stars of Pintores');
  ok(JSON.stringify(fin.stars.find((s) => s.id === 'sky').winners) === '[1,2]', 'Más cielo al final: a tie shares the star');
  ok(JSON.stringify(fin.stars.find((s) => s.id === 'painted').winners) === '[2]', 'Más nubes pintadas');
  ok(JSON.stringify(fin.stars.find((s) => s.id === 'blaze').winners) === '[3]', 'Más llamaradas');
  ok(rows[0].share === 70 && rows[3].share === 0, 'a kid\'s share of the kingdom\'s clouds');
  ok(JSON.stringify(rows[3].stars) === '[]', 'no star for a kid who did nothing');
}
console.log(`paint level: all ${checks} checks passed`);
