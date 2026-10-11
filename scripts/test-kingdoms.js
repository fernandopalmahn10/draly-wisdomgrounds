// Rules check for Reinos de Colores (core/kingdoms.js). Run: node scripts/test-kingdoms.js
const assert = require('assert');
const K = require('../core/kingdoms');

const b = K.buildBoard(5);
const idx = {};
b.tiles.forEach((t) => { idx[t.q + ',' + t.r] = t.id; });

assert.strictEqual(b.tiles.length, 91, 'radius 5 board has 91 tiles');
assert.strictEqual(K.buildBoard(4).tiles.length, 61, 'radius 4 board has 61 tiles');
assert.deepStrictEqual(K.tileCounts(K.initialOwnership(b)), { red: 7, gold: 7 }, 'each castle starts with its ring');

// A ring of red around the centre encloses it.
const ring = {};
b.tiles[idx['0,0']].n.forEach((id) => { ring[id] = 'red'; });
assert.deepStrictEqual(K.enclosedPockets(b, ring, 'red'), [idx['0,0']], 'enclosed tile flips');

// Nothing flips on an open board; regions touching the edge never flip.
assert.strictEqual(K.enclosedPockets(b, {}, 'red').length, 0, 'empty board: no pockets');

// A pocket that holds the enemy castle never flips.
const own = K.initialOwnership(b);
const gc = b.castles.gold;
b.tiles[gc].n.forEach((id) => { own[id] = 'red'; });
assert.ok(!K.enclosedPockets(b, own, 'red').includes(gc), 'castle is never captured');
assert.strictEqual(K.castlePressure(b, own).gold, 6, 'pressure counts enemy-owned ring tiles');

// Targets: adjacent to own land, never a castle, never own tiles.
const start = K.initialOwnership(b);
const valid = K.validTargets(b, start, 'red');
assert.ok(valid.length > 0 && !valid.includes(b.castles.gold) && valid.every((id) => start[id] !== 'red'), 'valid targets');

// Long random game keeps both castles with their owners.
const g = K.initialOwnership(b);
for (let i = 0; i < 400; i++) {
  const team = i % 2 ? 'red' : 'gold';
  const id = K.bestTarget(b, g, team);
  if (id === null) break;
  assert.ok(!b.tiles[id].castle, 'auto plant never targets a castle');
  K.plant(b, g, team, id);
}
assert.strictEqual(g[b.castles.red], 'red');
assert.strictEqual(g[b.castles.gold], 'gold');
console.log('kingdoms rules: all checks passed');
