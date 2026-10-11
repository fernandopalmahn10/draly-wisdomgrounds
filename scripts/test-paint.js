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
console.log(`paint level: all ${checks} checks passed`);
