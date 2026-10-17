// Simulated classes of Dragones Pintores v2 on the real rules (core/paint.js): kids fly to the nearest cloud that isn't
// their kingdom's (or, a third of the time, to an island not yet theirs), answer questions when their fire runs low
// (a thinker: ~85 % right in 3-6 s; a guesser: 25 % in ~1 s), the last 30 s doubles the fire, «Viento a favor» blows for
// the trailing kingdom. Used by scripts/test-paint.js; run alone for the numbers: node scripts/sim-paint.js
'use strict';
const P = require('../core/paint');
const PW = require('../public/js/paint-worlds');
const R = P.R;

function playRound(opt, seed) {
  const rnd = PW.rng(seed);
  const sky = P.buildSky(seed % PW.WORLDS.length, seed);
  const b = P.newBoard(sky);
  const kids = [];
  ['red', 'gold'].forEach((team) => {
    for (let i = 0; i < opt.kids / 2; i++) {
      const kind = typeof opt.kind === 'function' ? opt.kind(team, i) : 'thinker';
      const acc = kind === 'guesser' ? 0.25 : opt.acc[team];
      const [x, y] = P.spawn(sky, team, i + 1);
      kids.push({
        kind, acc, team,
        d: { key: team + i, team, x, y, tx: x, ty: y, fire: R.START_FIRE, blazeUntil: 0, strokes: 0, lms: 0 },
        q: 0,          // seconds left answering (0 = flying)
        wait: 0,       // seconds of «¡Casi!» wait left
        streak: 0, wrongRow: 0, wind: 0, isl: -1, ci: null,
      });
    }
  });
  const ansTime = (k) => (k.kind === 'guesser' ? 0.8 + rnd() * 0.6 : 3 + rnd() * 3);
  const dt = R.TICK_MS / 1000;
  const T = opt.seconds;
  let trailingAt2_3 = null, captures = 0;
  for (let t = 0, n = 0; t < T; t += dt, n++) {
    const now = 1e6 + n * R.TICK_MS;
    const frenzy = T - t <= 30;
    kids.forEach((k) => {
      const d = k.d;
      if (k.wait > 0) { k.wait -= dt; return; }
      if (k.q > 0) {
        k.q -= dt;
        if (k.q <= 0) {
          const right = rnd() < k.acc;
          if (right) {
            k.streak++; k.wrongRow = 0;
            const rw = P.reward(k.streak, frenzy);
            d.fire = Math.min(R.ENERGY_MAX, d.fire + rw.energy);
            if (rw.blaze) d.blazeUntil = now + R.BLAZE_MS;
            if (opt.wind !== false && process.env.NOWIND !== '1') {
              const ids = P.comeback(b, d.team, d.x, d.y, now);
              P.applyFlips(b, ids, d.team, d.key, now);
              d.strokes += ids.length; k.wind += ids.length;
            }
            k.wait = 1.1;
          } else {
            k.streak = 0; k.wrongRow++;
            k.wait = (k.wrongRow >= 2 ? R.WRONG_WAIT2_MS : R.WRONG_WAIT_MS) / 1000;
            if (d.fire > 2) k.q = 0; else k.q = ansTime(k);       // still out of fire: the next question
          }
        }
        return;
      }
      if (d.fire < 1.5) { k.q = ansTime(k); return; }
      // flying: a new target when it arrived (or 10 % of the time anyway)
      if ((Math.abs(d.x - d.tx) < 1 && Math.abs(d.y - d.ty) < 1) || rnd() < 0.02) {
        const isl = b.lm.map((s, i) => ({ s, i })).filter(({ s }) => (d.team === 'red' ? s.v < 1 : s.v > -1));
        const atIsland = sky.lms.some((l, i) => Math.hypot(d.x - l.x, d.y - l.y) <= l.r && (d.team === 'red' ? b.lm[i].v < 1 : b.lm[i].v > -1));
        if (atIsland) return;                                   // stay until it is ours
        // an island not yet ours, unless 3 of my kingdom are already on their way to it (kids spread out)
        const crowd = (i) => kids.filter((o) => o !== k && o.team === k.team && o.isl === i).length;
        const free = isl.filter(({ i }) => crowd(i) < 3);
        k.isl = -1;
        if (free.length && rnd() < 0.33) {
          const pick = free[Math.floor(rnd() * free.length)];
          const l = sky.lms[pick.i];
          k.isl = pick.i;
          d.tx = l.x + (rnd() - 0.5) * 60; d.ty = l.y + (rnd() - 0.5) * 60;
        } else {
          // a cloud that isn't my kingdom's and no teammate is already flying to, the nearer the likelier
          const taken = new Set(kids.filter((o) => o !== k && o.team === k.team).map((o) => o.ci));
          let best = null, bd = 1e9;
          sky.clouds.forEach(([cx, cy], i) => {
            if (b.own[i] === d.team || taken.has(i)) return;
            const dd = Math.hypot(cx - d.x, cy - d.y) * (0.5 + rnd());
            if (dd < bd) { bd = dd; best = i; }
          });
          k.ci = best;
          if (best != null) { const t2 = P.clampTarget(sky, sky.clouds[best][0], sky.clouds[best][1]); d.tx = t2[0]; d.ty = t2[1]; }
        }
      }
    });
    P.step(b, kids.map((k) => k.d), dt, now, rnd);
    captures += b.events.filter((e) => e.type === 'capture').length;
    b.flips = []; b.events = [];
    if (trailingAt2_3 === null && t >= (T * 2) / 3) {
      const tt = P.totals(b);
      trailingAt2_3 = tt.red < tt.gold ? 'red' : tt.gold < tt.red ? 'gold' : 'none';
    }
  }
  const tot = P.totals(b);
  return { tot, kids, b, winner: tot.red > tot.gold ? 'red' : tot.gold > tot.red ? 'gold' : 'tie', trailingAt2_3, captures };
}

function run(o) {
  const opt = Object.assign({ classes: 100, kids: 20, seconds: 180 }, o || {});
  let strong = 0, strongN = 0, eqRed = 0, eqN = 0, wind = 0, strokes = 0, caps = 0, flips = 0, flipN = 0;
  let thinker = 0, thinkerN = 0, guesser = 0, guesserN = 0;
  for (let c = 0; c < opt.classes; c++) {
    // a stronger kingdom (85 % vs 55 %), sides alternate
    const strongSide = c % 2 ? 'red' : 'gold';
    const r1 = playRound({ kids: opt.kids, seconds: opt.seconds, acc: strongSide === 'red' ? { red: 0.85, gold: 0.55 } : { red: 0.55, gold: 0.85 } }, 7000 + c * 31);
    if (r1.winner === strongSide) strong++;
    strongN++;
    r1.kids.forEach((k) => { wind += k.wind; strokes += k.d.strokes; });
    caps += r1.captures;
    if (r1.trailingAt2_3 && r1.trailingAt2_3 !== 'none') { flipN++; if (r1.winner === r1.trailingAt2_3) flips++; }
    // two equal kingdoms
    const r2 = playRound({ kids: opt.kids, seconds: opt.seconds, acc: { red: 0.7, gold: 0.7 } }, 90000 + c * 17);
    if (r2.winner === 'red') eqRed++;
    if (r2.winner !== 'tie') eqN++;
    // a mixed class: every third kid a fast guesser
    const r3 = playRound({ kids: opt.kids, seconds: opt.seconds, acc: { red: 0.8, gold: 0.8 }, kind: (team, i) => (i % 3 === 0 ? 'guesser' : 'thinker') }, 50000 + c * 13);
    r3.kids.forEach((k) => { if (k.kind === 'guesser') { guesser += k.d.strokes; guesserN++; } else { thinker += k.d.strokes; thinkerN++; } });
  }
  return {
    strongWins: strong / strongN,
    equalBalance: eqN ? eqRed / eqN : 0.5,
    windShare: strokes ? wind / strokes : 0,
    thinkerVsGuesser: (thinker / Math.max(1, thinkerN)) / Math.max(1e-9, guesser / Math.max(1, guesserN)),
    islandsCaptured: caps / strongN,
    flipRate: flipN ? flips / flipN : 0,
  };
}

module.exports = { run, playRound };
if (require.main === module) {
  const t0 = Date.now();
  const r = run({ classes: Number(process.argv[2]) || 100, kids: Number(process.argv[3]) || 20, seconds: Number(process.argv[4]) || 180 });
  console.log(JSON.stringify(r, null, 2), `\n${Date.now() - t0} ms`);
}
