// Rules check for Dragones Pintores v2 «El Cielo de las Maravillas» (core/paint.js + public/js/paint-worlds.js).
// Run: node scripts/test-paint.js        (the live socket checks are in scripts/test-paint-live.js)
// The worlds and their fair skies, tap-to-fly (an intent the server clamps; the dragon never moves faster than its
// speed: no teleport), fire, painting along the path, the flip cooldown, the islands (capture, loss, steal, the cap of 3
// per kingdom), «Viento a favor» capped at the gap, the rewards, too-fast answers, the ending's stars, and simulated
// classes (scripts/sim-paint.js): a stronger kingdom still usually wins.
'use strict';
const assert = require('assert');
const P = require('../core/paint');
const PW = require('../public/js/paint-worlds');
const Sim = require('./sim-paint');

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), `${msg} (${a} vs ${b})`);
const R = P.R;

// ---------- the worlds ----------
ok(PW.WORLDS.length === 4, 'four worlds');
ok(PW.WORLDS[0].id === 'dubai', 'Dubái first (the main stage)');
ok(PW.WORLDS.slice(1).every((w) => ['muralla', 'rio', 'shanghai'].includes(w.id)), 'then China\'s wonders');
PW.WORLDS.forEach((w) => {
  ok(w.lms.length === 3, `${w.id}: three prize islands`);
  ok(w.lms.every((l) => l.id && l.name && l.h > 100), `${w.id}: every island has a name and a size`);
  ok(/^[A-ZÁÉÍÓÚ]/.test(w.name) && !/[一-鿿]/.test(JSON.stringify(w)), `${w.id}: a Spanish name, no hanzi`);
  ok(Array.isArray(w.props), `${w.id}: sky props`);
});
ok(PW.world(5).id === PW.WORLDS[1].id && PW.world(-1).id === PW.WORLDS[3].id, 'world(i) wraps around');

// ---------- the sky: the same for every screen, fair for both kingdoms ----------
const seeds = [1, 7, 12345, 987654, 424242];
for (let k = 0; k < 200; k++) seeds.push(1 + Math.floor(Math.random() * 1e6));
seeds.forEach((seed, si) => {
  const world = si % 4;
  const a = P.buildSky(world, seed);
  const b = PW.build(world, seed);
  ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: server and screens build the same sky`);
  ok(a.w === PW.W && a.h === PW.H && a.world === world && a.id === PW.WORLDS[world].id, `seed ${seed}: size + world`);
  ok(a.clouds.length >= 44 && a.clouds.length % 2 === 0, `seed ${seed}: enough clouds to paint (${a.clouds.length})`);
  ok(JSON.stringify(a).length < 3000, `seed ${seed}: the sky stays small`);
  for (let i = 0; i < a.clouds.length; i += 2) {
    const [x1, y1, r1, s1] = a.clouds[i], [x2, y2, r2, s2] = a.clouds[i + 1];
    ok(x1 + x2 === a.w && y1 === y2 && r1 === r2 && s1 === s2, `seed ${seed}: cloud ${i} is mirrored for the other kingdom`);
    ok(x1 + r1 < a.w / 2, `seed ${seed}: cloud ${i} sits on the Fuego half`);
  }
  a.clouds.forEach(([x, y, r], i) => {
    ok(x - r >= 0 && x + r <= a.w && y - r >= 40 && y + r <= a.h - 100, `seed ${seed}: cloud ${i} inside the sky`);
    a.lms.forEach((l) => ok(Math.hypot(x - l.x, y - l.y) > r + l.r, `seed ${seed}: cloud ${i} off island ${l.id}`));
    ['red', 'gold'].forEach((t) => ok(Math.hypot(x - a.homes[t][0], y - a.homes[t][1]) > r + 100, `seed ${seed}: cloud ${i} off the ${t} home`));
    a.clouds.forEach(([x2, y2, r2], j) => { if (j > i) ok(Math.hypot(x - x2, y - y2) > r + r2, `seed ${seed}: clouds ${i}/${j} don't overlap`); });
  });
  // islands: one on the centre line, two mirrored, each at the same distance from the two homes
  ok(a.lms[0].x === a.w / 2, `seed ${seed}: the first island is on the centre line`);
  ok(a.lms[1].x + a.lms[2].x === a.w && a.lms[1].y === a.lms[2].y, `seed ${seed}: the side islands are mirrored`);
  near(Math.hypot(a.lms[0].x - a.homes.red[0], a.lms[0].y - a.homes.red[1]), Math.hypot(a.lms[0].x - a.homes.gold[0], a.lms[0].y - a.homes.gold[1]), 1e-6, `seed ${seed}: the centre island is as far from both homes`);
});

// ---------- tap to fly: an intent the server clamps; never faster than the speed ----------
const sky = P.buildSky(0, 4242);
ok(P.clampTarget(sky, NaN, 3) === null && P.clampTarget(sky, 3, Infinity) === null, 'a non-number tap is refused');
const c1 = P.clampTarget(sky, -5000, 99999);
ok(c1[0] === R.MARGIN && c1[1] === sky.h - R.MARGIN - 40, 'a tap outside the sky is clamped to its edge');
const c2 = P.clampTarget(sky, 700, 400);
ok(c2[0] === 700 && c2[1] === 400, 'a tap inside the sky is kept');
function dragon(team, x, y, extra) { return Object.assign({ key: team + 'kid', team, x, y, tx: x, ty: y, fire: 30, blazeUntil: 0, strokes: 0, lms: 0 }, extra || {}); }
{
  const b = P.newBoard(sky);
  const d = dragon('red', 200, 200);
  [d.tx, d.ty] = P.clampTarget(sky, 1400, 900);
  let t = 0, maxStep = 0, prev = [d.x, d.y];
  for (let n = 0; n < 200; n++) {
    t += 100;
    P.step(b, [d], 0.1, 1e6 + t);
    const s = Math.hypot(d.x - prev[0], d.y - prev[1]);
    maxStep = Math.max(maxStep, s);
    prev = [d.x, d.y];
  }
  ok(maxStep <= R.SPEED * 0.1 + 1e-6, `no teleport: never more than speed × dt per step (${maxStep.toFixed(2)})`);
  ok(d.x === d.tx && d.y === d.ty, 'the dragon arrives where the kid tapped');
  const dist = Math.hypot(d.tx - 200, d.ty - 200);
  near(30 - d.fire, dist / R.SPEED, 1e-6, 'flying burns 1 s of fire per second of flight');
  const f0 = d.fire;
  P.step(b, [d], 1, 2e6);
  ok(d.fire === f0, 'hovering at the target is free');
  ok(d.strokes > 0 && b.own.some((o) => o === 'red'), 'the flight painted clouds on the way');
  // a big dt (a slow tick) still moves at most speed × dt and still paints everything on the path
  const d2 = dragon('gold', 1500, 200);
  d2.tx = 100; d2.ty = 220;
  P.step(b, [d2], 0.25, 3e6);
  near(Math.hypot(d2.x - 1500, d2.y - 200), R.SPEED * 0.25, 1e-6, 'a 250 ms tick: exactly speed × dt');
}
// fire: the flight stops when the fire runs out (mid-step too), and a dragon with no fire never moves or paints
{
  const b = P.newBoard(sky);
  const d = dragon('red', 100, 500, { fire: 0.05 });
  d.tx = 1500; d.ty = 500;
  P.step(b, [d], 0.1, 1e6);
  near(d.x - 100, R.SPEED * 0.05, 1e-6, 'fire for 0.05 s = 0.05 s of flight');
  ok(d.fire === 0, 'out of fire');
  const x = d.x;
  P.step(b, [d], 0.1, 1e6 + 100);
  ok(d.x === x, 'no fire: the dragon waits');
  const away = dragon('red', 100, 500, { away: true });
  away.tx = 900;
  P.step(b, [away], 0.1, 1e6);
  ok(away.x === 100, 'a kid whose phone left: the dragon waits');
  const bl = dragon('red', 100, 500, { blazeUntil: 2e6 });
  bl.tx = 1500;
  P.step(b, [bl], 0.1, 1e6);
  near(bl.x - 100, R.BLAZE_SPEED * 0.1, 1e-6, 'a Llamarada flies faster');
}
// painting: exactly the clouds the brush touches; the flip cooldown; repainting the rival's
{
  const sk = P.buildSky(1, 777);
  const b = P.newBoard(sk);
  const [cx, cy, r] = sk.clouds[0];
  const d = dragon('red', cx - r - 200, cy, {});
  d.tx = cx - r - R.BRUSH - 2; d.ty = cy;
  for (let n = 0; n < 30; n++) P.step(b, [d], 0.1, 1e6 + n * 100);
  ok(b.own[0] === null, 'a brush that stops short leaves the cloud white');
  d.tx = cx - r - R.BRUSH + 2;
  P.step(b, [d], 0.1, 1e6 + 4000);
  ok(b.own[0] === 'red' && b.by[0] === 'redkid', 'a brush that touches the edge paints it (and who painted it)');
  const g = dragon('gold', cx + r + 100, cy, {});
  g.tx = cx; g.ty = cy;
  P.step(b, [g], 0.5, 1e6 + 4500);
  ok(b.own[0] === 'red', 'a cloud painted < 1.5 s ago keeps its colour');
  g.x = cx + r + 100; g.y = cy;
  P.step(b, [g], 0.5, 1e6 + 4000 + R.FLIP_MS + 10);
  ok(b.own[0] === 'gold' && b.by[0] === 'goldkid', 'after the cooldown the rival repaints it');
  const before = g.strokes;
  g.x = cx + r + 100;
  P.step(b, [g], 0.5, 1e6 + 9000);
  ok(g.strokes === before, 'flying over my own cloud again paints nothing (no farming)');
  // the wide brush
  const b2 = P.newBoard(sk);
  const w = dragon('red', cx - r - 300, cy - r - R.BLAZE_BRUSH + 6, { blazeUntil: 9e9 });
  w.tx = cx + r + 300; w.ty = w.y;
  for (let n = 0; n < 40; n++) P.step(b2, [w], 0.1, 1e6 + n * 100);
  ok(b2.own[0] === 'red', 'a Llamarada paints a cloud its wide brush only brushes past');
}

// ---------- the islands ----------
{
  const b = P.newBoard(sky);
  const l = sky.lms[0];
  const reds = [0, 1, 2, 3, 4].map((i) => dragon('red', l.x + i, l.y, { key: 'r' + i }));
  P.stepIslands(b, reds.slice(0, 1), 1);
  near(b.lm[0].v, R.LM_RATE, 1e-9, 'one dragon inside pushes the meter LM_RATE a second');
  ok(reds[0].fire < 30, 'painting an island burns fire');
  for (let n = 0; n < 120 && b.lm[0].owner !== 'red'; n++) P.stepIslands(b, reds.slice(0, 1), 0.1);
  ok(b.lm[0].owner === 'red' && b.lm[0].v === 1, 'a full meter = captured');
  ok(b.events.some((e) => e.type === 'capture' && e.team === 'red' && e.lm === 0 && e.keys[0] === 'r0'), 'the capture is news, with who was inside');
  ok(reds[0].lms === 1, 'the kid inside gets the island on their card');
  near(P.totals(b).red - P.totals(b).clouds.red, R.LM_VALUE, 0, 'an island held is worth LM_VALUE');
  const f = reds[0].fire;
  P.stepIslands(b, reds.slice(0, 1), 1);
  ok(reds[0].fire === f, 'resting on my own captured island costs no fire');
  // the cap: 5 reds count as 3
  const b2 = P.newBoard(sky);
  P.stepIslands(b2, reds, 1);
  near(b2.lm[0].v, R.LM_RATE * R.LM_COUNT, 1e-9, 'at most 3 dragons of a kingdom count');
  // contested: 2 golds vs 2 reds = nothing moves, and everyone burns fire
  const b3 = P.newBoard(sky);
  const golds = [0, 1].map((i) => dragon('gold', l.x - i, l.y, { key: 'g' + i }));
  const rr = [0, 1].map((i) => dragon('red', l.x + i, l.y, { key: 'x' + i }));
  P.stepIslands(b3, rr.concat(golds), 1);
  ok(b3.lm[0].v === 0 && rr[0].fire < 30 && golds[0].fire < 30, 'two against two: the meter waits, both sides burn fire');
  // stealing: red owns it; gold pushes past the middle = lost (neutral), then full the other way = gold's
  b.events = [];
  const g1 = dragon('gold', l.x, l.y + 5, { key: 'gold1' });
  for (let n = 0; n < 120 && b.lm[0].owner === 'red'; n++) P.stepIslands(b, [g1], 0.1);
  ok(b.lm[0].owner === null && b.events.some((e) => e.type === 'lost' && e.team === 'red'), 'pushed past the middle: the Fuego loses it');
  for (let n = 0; n < 160 && b.lm[0].owner !== 'gold'; n++) P.stepIslands(b, [g1], 0.1);
  ok(b.lm[0].owner === 'gold' && g1.lms === 1, 'full the other way: the Mar captures it');
  // dragons with no fire or away don't count; outside the ring doesn't count
  const b4 = P.newBoard(sky);
  P.stepIslands(b4, [dragon('red', l.x, l.y, { fire: 0 }), dragon('red', l.x, l.y, { away: true }), dragon('red', l.x + l.r + 1, l.y)], 1);
  ok(b4.lm[0].v === 0, 'no fire, away or outside the ring: no push');
}

// ---------- «Viento a favor»: capped at the gap ----------
{
  for (let trial = 0; trial < 300; trial++) {
    const sk = P.buildSky(trial % 4, 1000 + trial);
    const b = P.newBoard(sk);
    const n = sk.clouds.length;
    const goldN = Math.floor(Math.random() * n);
    const redN = Math.floor(Math.random() * (n - goldN));
    for (let i = 0; i < goldN; i++) { b.own[i] = 'gold'; b.by[i] = 'g'; }
    for (let i = goldN; i < goldN + redN; i++) { b.own[i] = 'red'; b.by[i] = 'r'; }
    if (Math.random() < 0.4) b.lm[0].owner = 'gold';
    const t0 = P.totals(b);
    const ids = P.comeback(b, 'red', 400, 500, 1e9);
    const gap = t0.gold - t0.red;
    if (gap < R.COMEBACK_GAP) ok(ids.length === 0, `trial ${trial}: no wind under a gap of ${R.COMEBACK_GAP}`);
    else ok(ids.length >= 1 && ids.length <= R.COMEBACK_MAX && ids.length <= Math.floor((gap - 1) / 2), `trial ${trial}: wind within the cap (${ids.length} for a gap of ${gap})`);
    ok(ids.every((i) => b.own[i] === 'gold'), `trial ${trial}: the wind blows only rival clouds`);
    P.applyFlips(b, ids, 'red', 'r', 1e9);
    const t1 = P.totals(b);
    if (gap >= R.COMEBACK_GAP) ok(t1.red < t1.gold, `trial ${trial}: the wind alone never puts the trailing kingdom level or ahead (${t1.red} < ${t1.gold})`);
    ok(P.comeback(b, 'gold', 400, 500, 1e9).length === 0 || t1.red - t1.gold >= R.COMEBACK_GAP, `trial ${trial}: the leader gets no wind`);
  }
  // the nearest rival clouds first
  const b = P.newBoard(sky);
  sky.clouds.forEach((c, i) => { b.own[i] = 'gold'; });
  const ids = P.comeback(b, 'red', sky.clouds[10][0], sky.clouds[10][1], 1e9);
  ok(ids[0] === 10, 'the wind starts with the rival cloud nearest my dragon');
  // just repainted clouds are skipped (the cooldown)
  const b2 = P.newBoard(sky);
  sky.clouds.forEach((c, i) => { b2.own[i] = 'gold'; b2.flipAt[i] = 1e9 - 100; });
  ok(P.comeback(b2, 'red', 500, 500, 1e9).length === 0, 'the wind respects the flip cooldown');
}

// ---------- rewards, guesses, timeouts ----------
ok(JSON.stringify(P.reward(1, false)) === JSON.stringify({ energy: 10, blaze: false }), 'a right answer: +10 s of fire');
ok(P.reward(3, false).blaze && P.reward(3, false).energy === 10, '3 in a row: a Llamarada');
ok(P.reward(1, true).blaze && P.reward(1, true).energy === 20, 'the last 30 s: twice the fire and always a Llamarada');
ok(P.reward(4, true).energy <= P.ENERGY_MAX, 'never more than the max');
ok(P.tooFast(1000, 1000 + R.TOO_FAST_MS - 1) && !P.tooFast(1000, 1000 + R.TOO_FAST_MS) && !P.tooFast(0, 5), 'too fast = under 450 ms after the question');
ok(R.Q_SERVER_MS > 20000 && R.Q_SERVER_MS <= 25000, 'the server closes an unanswered question a little after the phone\'s 20 s');
ok(R.GO_RATE >= 8 && R.GO_RATE <= 20, 'a finger dragged on the sky fits in the tap rate');

// ---------- the ending ----------
{
  const rows = [
    { k: 1, name: 'Ana', skin: 'aileen', team: 'red', owned: 14, painted: 40, lms: 2, best: 4, blazes: 1, right: 5, answered: 7 },
    { k: 2, name: 'Omar', skin: 'hamdan', team: 'gold', owned: 14, painted: 61, lms: 0, best: 2, blazes: 0, right: 3, answered: 6 },
    { k: 3, name: 'Lía', skin: 'latifa', team: 'gold', owned: 2, painted: 9, lms: 1, best: 3, blazes: 2, right: 4, answered: 4 },
    { k: 4, name: 'Teo', skin: 'adric', team: 'red', owned: 0, painted: 0, lms: 0, best: 0, blazes: 0, right: 0, answered: 1 },
  ];
  const fin = P.finish(rows, { red: 20, gold: 31 });
  ok(fin.winner === 'gold', 'more points win');
  ok(P.finish(rows.map((r) => Object.assign({}, r)), { red: 5, gold: 5 }).winner === 'tie', 'equal points: a tie');
  ok(JSON.stringify(fin.rows.map((r) => r.k)) === '[1,2,3,4]' && JSON.stringify(fin.rows.map((r) => r.rank)) === '[1,1,3,4]', 'podium by clouds owned (ties share), then islands, then strokes');
  ok(fin.mvp.red === 1 && fin.mvp.gold === 2, 'the most sky of each kingdom');
  ok(JSON.stringify(fin.stars.map((s) => s.id)) === '["painted","lm","streak","blaze"]', 'Pintores\' four stars, with the new «Conquista maravillas»');
  ok(P.STARS.length <= 4, 'four stars at most (core/party.js MAX_STARS)');
  ok(JSON.stringify(fin.stars.find((s) => s.id === 'lm').winners) === '[1]', 'Conquista maravillas: the most islands');
  ok(JSON.stringify(fin.stars.find((s) => s.id === 'painted').winners) === '[2]', 'Más nubes pintadas');
  ok(rows[0].share === 70 && rows[3].share === 0, 'a kid\'s share of the kingdom\'s points');
  ok(JSON.stringify(rows[3].stars) === '[]', 'no star for a kid who did nothing');
}

// ---------- simulated classes: a stronger kingdom still usually wins; thinking beats guessing ----------
{
  const r = Sim.run({ classes: 240, kids: 20, seconds: 180 });
  ok(r.strongWins >= 0.8, `a kingdom answering 85 % vs 55 % wins most rounds (${Math.round(r.strongWins * 100)} %)`);
  ok(r.equalBalance > 0.3 && r.equalBalance < 0.7, `equal kingdoms win about half each (${Math.round(r.equalBalance * 100)} % Fuego)`);
  ok(r.windShare < 0.2, `«Viento a favor» is a small part of the sky (${Math.round(r.windShare * 100)} % of all strokes)`);
  ok(r.thinkerVsGuesser > 1.2, `a thinker paints more than a fast guesser (${r.thinkerVsGuesser.toFixed(2)}×)`);
  ok(r.islandsCaptured > 0, `islands get captured in a simulated round (${r.islandsCaptured.toFixed(1)} per round)`);
  console.log(`  sim: strong wins ${Math.round(r.strongWins * 100)} % · equal → Fuego ${Math.round(r.equalBalance * 100)} % · wind ${Math.round(r.windShare * 100)} % of strokes · thinker/guesser ${r.thinkerVsGuesser.toFixed(2)}× · ${r.islandsCaptured.toFixed(1)} captures a round · comeback flipped ${Math.round(r.flipRate * 100)} % of rounds`);
}
console.log(`paint v2: all ${checks} checks passed`);
