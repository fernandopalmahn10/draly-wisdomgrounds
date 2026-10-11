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

// Dubai landmarks: 5 on a radius-5 board, 3 on radius 4; the Burj Khalifa in the centre; every landmark exactly as far
// from both castles (fair), never a castle or a starting tile; side order follows the shuffle the server passes.
const dist = (a, c) => Math.max(Math.abs(a.q - c.q), Math.abs(a.r - c.r), Math.abs((a.q + a.r) - (c.q + c.r)));
[[5, 5], [4, 3]].forEach(([R, n]) => {
  const bb = K.buildBoard(R, ['frame', 'atlantis', 'arab', 'museum']);
  const ids = Object.keys(bb.landmarks).map(Number);
  assert.strictEqual(ids.length, n, `radius ${R}: ${n} landmarks`);
  const start = K.initialOwnership(bb);
  const rc = bb.tiles[bb.castles.red];
  const gc2 = bb.tiles[bb.castles.gold];
  ids.forEach((id) => {
    const t = bb.tiles[id];
    assert.ok(!t.castle && !start[id] && !t.edge, 'landmark on a free inner tile');
    assert.strictEqual(dist(t, rc), dist(t, gc2), 'landmark equally far from both castles');
  });
  const centre = bb.tiles.find((t) => t.q === 0 && t.r === 0);
  assert.strictEqual(bb.landmarks[centre.id], 'burj', 'Burj Khalifa in the centre');
  assert.strictEqual(bb.tiles.find((t) => t.q === 1 && t.r === -2).lm, 'frame', 'side landmarks follow the given order');
  assert.ok(K.publicBoard(bb).landmarks[centre.id] === 'burj', 'phones get the landmarks');
});

// Landmark score follows ownership; landmarksTaken reports what a plant captured (directly or by surround).
const lb = K.buildBoard(5);
const lo = {};
const burj = Number(Object.keys(lb.landmarks).find((id) => lb.landmarks[id] === 'burj'));
assert.deepStrictEqual(K.landmarkScore(lb, lo), { red: 0, gold: 0 });
lb.tiles[burj].n.forEach((id) => { lo[id] = 'red'; });
const res = K.plant(lb, lo, 'red', lb.tiles[burj].n[0]);   // re-plant on the ring: the centre gets surrounded
assert.ok(res.flipped.some((f) => f.id === burj), 'surround captures the Burj Khalifa');
assert.deepStrictEqual(K.landmarksTaken(lb, res), [{ tile: burj, lm: 'burj', from: null }], 'landmarksTaken sees the flip');
assert.strictEqual(K.landmarkScore(lb, lo).red, 5, 'Burj Khalifa is worth 5');
lo[burj] = 'gold';
assert.deepStrictEqual(K.landmarkScore(lb, lo), { red: 0, gold: 5 }, 'stolen back: the bonus moves');

// Auto-plant goes for a landmark when one is in reach.
const ab = K.buildBoard(5);
const ao = K.initialOwnership(ab);
const near = Number(Object.keys(ab.landmarks).find((id) => ab.landmarks[id] === 'burj'));
ao[ab.tiles[near].n.find((id) => !ab.tiles[id].castle)] = 'gold';   // gold now touches the centre
let picks = 0;
for (let i = 0; i < 20; i++) if (K.bestTarget(ab, ao, 'gold') === near) picks++;
assert.strictEqual(picks, 20, 'auto plant takes the Burj Khalifa when it can');
console.log('kingdoms rules: all checks passed');
