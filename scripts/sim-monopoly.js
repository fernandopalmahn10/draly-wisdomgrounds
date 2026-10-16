// Simulated classes for Dàfùwēng · Monopolio v2 on the server's own rules (core/monopoly.js), no sockets.
//   node scripts/sim-monopoly.js [games] [kids] [seconds]
// Used by scripts/test-monopoly.js (require) and by hand to tune the economy. Kinds of kids:
//   thinker  answers in 1.8-5 s, 85 % right, taps the dice after 0.4-1.2 s
//   slow     answers in 4-9 s, 75 % right
//   guesser  answers in 0.7-1.4 s, 25 % right (4 answers)
//   masher   answers 0.2-0.5 s after the question (too fast: always wrong)
//   idle     never answers (time up every time) and never taps
//   notap    a thinker who never taps the dice: every roll is the server's automatic one
'use strict';
const Mono = require('../core/monopoly');

const KINDS = {
  thinker: { t: [1800, 5000], p: 0.85, tap: [400, 1200] },
  slow: { t: [4000, 9000], p: 0.75, tap: [700, 2000] },
  guesser: { t: [700, 1400], p: 0.25, tap: [300, 800] },
  masher: { t: [200, 500], p: 0.25, tap: [200, 400] },
  idle: { t: null, p: 0, tap: null },
  notap: { t: [1800, 5000], p: 0.85, tap: null },     // thinks, but never taps the dice (they roll by themselves)
};
function rnd(rng, a, b) { return a + rng() * (b - a); }

// one game: kinds = ['thinker', …] (one per kid). Returns { m, fin, kids: [{ k, kind, rec }] }
function game(seed, kinds, seconds, opts) {
  opts = opts || {};
  const rng = Mono.MAP && require('../core/halcon').mulberry32(seed * 7 + 3);
  let now = 1000000;
  const m = Mono.newGame(seed, seconds, now);
  const entries = kinds.map((kind, i) => [i + 1, 'Kid' + (i + 1), 'dralingo']);
  Mono.deal(m, entries);
  now = m.phaseUntil;
  Mono.startPlay(m, now);
  const kids = kinds.map((kind, i) => ({ k: i + 1, kind, K: KINDS[kind], q: null, ans: 0, tapAt: 0 }));
  const dealQ = (x) => { x.q = { at: now }; x.ans = x.K.t ? now + rnd(rng, x.K.t[0], x.K.t[1]) : Infinity; };
  kids.forEach(dealQ);
  const STEP = 50;
  const stats = { turns: 0, autos: 0, leads: 0, frenzy: 0, maxMs: 0 };
  while (now < m.endsAt) {
    now += STEP;
    const ev = Mono.tick(m, now);
    stats.leads += ev.leads.length;
    if (ev.frenzy) stats.frenzy++;
    kids.forEach((x) => {
      const r = m.kids[x.k];
      if (x.q) {
        if (now >= x.ans || now - x.q.at >= Mono.R.Q_MS + Mono.R.Q_GRACE_MS) {
          const timeUp = now < x.ans ? true : false;
          const right = !timeUp && rng() < x.K.p;
          const res = Mono.answer(m, x.k, right, now - x.q.at, now, timeUp);
          x.q = null;
          if (res.right) x.tapAt = x.K.tap ? now + Mono.R.LEAD_MS + rnd(rng, x.K.tap[0], x.K.tap[1]) : Infinity;
        }
        return;
      }
      if (r.turn) {
        const auto = now >= Mono.rollAt(r);
        if (now >= x.tapAt || auto) {
          const t = Mono.roll(m, x.k, now, auto);
          stats.turns++;
          if (auto) stats.autos++;
          stats.maxMs = Math.max(stats.maxMs, t.script.ms);
          if (t.script.ms !== Mono.MAP.scriptMs(t.script)) throw new Error('script ms mismatch');
        }
        return;
      }
      if (now >= r.nextQAt) dealQ(x);
    });
  }
  Mono.final(m, now);
  kids.forEach((x) => { const r = m.kids[x.k]; if (r.turn) Mono.roll(m, x.k, now, true); });
  const fin = Mono.finish(m);
  return { m, fin, kids: kids.map((x) => ({ k: x.k, kind: x.kind, rec: m.kids[x.k] })), stats };
}

module.exports = { KINDS, game };

if (require.main === module) {
  const G = +(process.argv[2] || 200), K = +(process.argv[3] || 24), S = +(process.argv[4] || 240);
  const by = {};
  const all = { stars: [], coins: [], lands: 0, turns: 0, maxMs: 0, leads: 0, zeroStar: 0, kids: 0, starsBought: 0, boardsWithStar: 0, boards: 0 };
  for (let s = 1; s <= G; s++) {
    // a class: mostly thinkers, a few slow, one guesser, one masher
    const kinds = Array.from({ length: K }, (_, i) => (i % 8 === 3 ? 'slow' : i % 8 === 5 ? 'slow' : 'thinker'));
    kinds[1] = 'guesser'; kinds[2] = 'masher';
    const r = game(s, kinds, S);
    all.turns += r.stats.turns; all.maxMs = Math.max(all.maxMs, r.stats.maxMs); all.leads += r.stats.leads;
    r.kids.forEach((x) => {
      const row = r.fin.rows.find((y) => y.k === x.k);
      (by[x.kind] = by[x.kind] || { n: 0, stars: 0, total: 0, coins: 0, right: 0, wins: 0, steps: 0 });
      const b = by[x.kind];
      b.n++; b.stars += x.rec.stars; b.total += row.total; b.coins += x.rec.coins; b.right += x.rec.right; b.steps += x.rec.steps;
      if (row.rank === 1) b.wins++;
      all.kids++; if (x.rec.stars === 0) all.zeroStar++; all.starsBought += x.rec.bought;
    });
    r.fin.boards.forEach((bd) => { all.boards++; if (bd.rows.some((x) => x.stars > 0)) all.boardsWithStar++; all.lands += Object.keys(bd.owners).length; });
  }
  Object.entries(by).forEach(([k, b]) => console.log(k.padEnd(8), 'kids', b.n, '· stars', (b.stars / b.n).toFixed(2), '· +bonus', (b.total / b.n).toFixed(2),
    '· coins', (b.coins / b.n).toFixed(1), '· right', (b.right / b.n).toFixed(1), '· steps', (b.steps / b.n).toFixed(0), '· board wins', (100 * b.wins / b.n).toFixed(0) + '%'));
  console.log('turns per kid', (all.turns / all.kids).toFixed(1), '· longest turn', all.maxMs, 'ms · leads per board', (all.leads / all.boards).toFixed(1),
    '· kids with 0 stars', (100 * all.zeroStar / all.kids).toFixed(0) + '%', '· stars bought per board', (all.starsBought / all.boards).toFixed(2),
    '· landmarks owned per board', (all.lands / all.boards).toFixed(2), '· boards with a star', (100 * all.boardsWithStar / all.boards).toFixed(0) + '%');
}
