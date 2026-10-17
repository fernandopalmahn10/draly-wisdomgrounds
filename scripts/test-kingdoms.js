// Rules check for Reinos de Colores (core/kingdoms.js). Run: node scripts/test-kingdoms.js
const assertRaw = require('assert');
// Every assert call is counted for the closing line.
let checks = 0;
const assert = new Proxy(assertRaw, { get: (t, k) => (typeof t[k] === 'function' ? (...a) => { checks++; return t[k](...a); } : t[k]) });
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
// ---------- 2026-10-16 ending pass: «¡Banderas dobles!» in the last 30 s, the ending's stars and finish() ----------
assert.strictEqual(K.flagsFor(1, false), 1, 'a right answer: one flag');
assert.strictEqual(K.flagsFor(3, false), 2, '3 in a row: a double flag');
assert.strictEqual(K.flagsFor(6, false), 2, '6 in a row: a double flag again');
assert.strictEqual(K.flagsFor(1, true), 2, 'the last 30 s: twice the flags');
assert.strictEqual(K.flagsFor(3, true), 3, 'the last 30 s + 3 in a row: three flags, never more (no kid stuck planting)');
{
  const rows = [
    { k: 1, name: 'Ana', skin: 'aileen', team: 'red', points: 12, tiles: 9, big: 4, best: 5, lms: 1, right: 6, answered: 8 },
    { k: 2, name: 'Omar', skin: 'hamdan', team: 'gold', points: 12, tiles: 7, big: 2, best: 2, lms: 0, right: 4, answered: 9 },
    { k: 3, name: 'Lía', skin: 'latifa', team: 'gold', points: 3, tiles: 3, big: 1, best: 1, lms: 0, right: 2, answered: 4 },
    { k: 4, name: 'Teo', skin: 'adric', team: 'red', points: 0, tiles: 0, big: 0, best: 0, lms: 0, right: 0, answered: 2 },
  ];
  const fin = K.finish(rows, { red: 30, gold: 22 });
  assert.strictEqual(fin.winner, 'red', 'more kingdom points win');
  assert.strictEqual(K.finish(rows, { red: 22, gold: 22 }).winner, 'tie', 'equal points: a tie');
  assert.deepStrictEqual(fin.rows.map((r) => r.k), [1, 2, 3, 4], 'podium order: points, then tiles');
  assert.deepStrictEqual(fin.rows.map((r) => r.rank), [1, 1, 3, 4], 'equal points share the place');
  assert.deepStrictEqual(fin.mvp, { red: 1, gold: 2 }, 'the most points of each kingdom');
  assert.strictEqual(K.finish([rows[3]], { red: 0, gold: 0 }).mvp.red, null, 'no MVP with 0 points');
  assert.deepStrictEqual(fin.stars.map((s) => s.id), ['tiles', 'big', 'streak', 'lms'], 'the four stars of Reinos');
  assert.deepStrictEqual(fin.stars.find((s) => s.id === 'tiles').winners, [1], 'Más territorio');
  assert.deepStrictEqual(fin.stars.find((s) => s.id === 'big').winners, [1], 'Mayor conquista needs a capture of 3+');
  assert.deepStrictEqual(rows.find((r) => r.k === 1).stars, ['tiles', 'big', 'streak', 'lms'], 'each kid knows the stars they won');
  assert.strictEqual(rows.find((r) => r.k === 2).share, 70, 'a kid\'s share of the kingdom\'s tiles (7 of 10)');
  assert.strictEqual(rows.find((r) => r.k === 4).share, 0, 'a kid with nothing: 0 % (the card shows the encouraging line instead)');
  assert.strictEqual(K.finish([rows[1], rows[2]], {}).stars.some((s) => s.id === 'big' || s.id === 'streak' || s.id === 'lms'), false, 'stars nobody earned are skipped');
}
// The last 30 s on a board (a simulated class: 10 kids a kingdom answer every 3.5-6.5 s and tap a random glowing
// tile; 3 min): «¡Banderas dobles!» makes the end more open (more late swings in an even class) without letting
// luck beat answering (the kingdom that answers better still wins about as often).
function simKd(pRed, pGold, frenzy, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const board = K.buildBoard(5);
  const own = K.initialOwnership(board);
  const kids = [];
  for (let i = 0; i < 20; i++) kids.push({ team: i % 2 ? 'gold' : 'red', p: i % 2 ? pGold : pRed, next: 2 + rnd() * 4, streak: 0 });
  const score = () => { const c = K.tileCounts(own); const lm = K.landmarkScore(board, own); return { red: c.red + lm.red, gold: c.gold + lm.gold }; };
  let at150 = null;
  for (let t = 0; t < 180; t += 0.5) {
    if (t === 150) at150 = score();
    kids.forEach((k) => {
      if (t < k.next) return;
      k.next = t + 3.5 + rnd() * 3;
      if (rnd() > k.p) { k.streak = 0; return; }
      k.streak++;
      const n = K.flagsFor(k.streak, frenzy && t >= 150);
      for (let f = 0; f < n; f++) {
        const v = K.validTargets(board, own, k.team);
        if (!v.length) break;
        K.plant(board, own, k.team, v[Math.floor(rnd() * v.length)]);
      }
    });
  }
  const end = score();
  const lead150 = at150.red > at150.gold ? 'red' : at150.gold > at150.red ? 'gold' : null;
  const win = end.red > end.gold ? 'red' : end.gold > end.red ? 'gold' : null;
  return { swing: !!(lead150 && win && lead150 !== win), win };
}
const N = 300;
const tally = (pr, pg, fz) => { let swing = 0, red = 0; for (let i = 0; i < N; i++) { const r = simKd(pr, pg, fz, 1000 + i * 7919); if (r.swing) swing++; if (r.win === 'red') red++; } return { swing, red }; };
const even0 = tally(0.6, 0.6, false), even1 = tally(0.6, 0.6, true);
const strong0 = tally(0.65, 0.55, false), strong1 = tally(0.65, 0.55, true);
assert.ok(even1.swing >= even0.swing, `even classes: at least as many late swings with «¡Banderas dobles!» (${even0.swing} → ${even1.swing} of ${N})`);
assert.ok(even1.red > N * 0.3 && even1.red < N * 0.7, `even classes stay even (${even1.red} of ${N} won by Fuego)`);
assert.ok(strong1.red >= strong0.red - N * 0.05 && strong1.red >= N * 0.6, `the kingdom that answers better still wins (${strong0.red} → ${strong1.red} of ${N})`);
console.log(`kingdoms «¡Banderas dobles!» in ${N} simulated classes: late swings in even classes ${even0.swing} → ${even1.swing}; the better kingdom wins ${strong0.red} → ${strong1.red}`);
console.log('kingdoms rules: all ' + checks + ' checks passed');
