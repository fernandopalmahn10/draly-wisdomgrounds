// Simulated classes for Vuelo del Dragón v2 on the server's own rules (core/dragon.js), no sockets.
//   node scripts/sim-dragon.js [games] [kids] [seconds]
// Used by scripts/test-dragon.js (require) and by hand to tune the race. Kinds of kids:
//   thinker  answers in 1.8-5 s, 85 % right, swipes 4.5-6 beats a second in a flight
//   slow     answers in 4-9 s, 75 % right, swipes 3.5-5 a second
//   guesser  answers in 0.7-1.4 s, 25 % right (4 answers), taps 6-9 a second (fast fingers)
//   masher   answers 0.2-0.5 s after the question (too fast: always wrong), taps 9 a second
//   idle     never answers (time up every time)
//   lazy     a thinker who flies with 1-2 beats a second (effort counts)
'use strict';
const Dragon = require('../core/dragon');
const Halcon = require('../core/halcon');

const KINDS = {
  thinker: { t: [1800, 5000], p: 0.85, rate: [4.5, 6] },
  slow: { t: [4000, 9000], p: 0.75, rate: [3.5, 5] },
  guesser: { t: [700, 1400], p: 0.25, rate: [6, 9] },
  masher: { t: [200, 500], p: 0.25, rate: [9, 9] },
  idle: { t: null, p: 0, rate: [0, 0] },
  lazy: { t: [1800, 5000], p: 0.85, rate: [1, 2] },
};
const rnd = (rng, a, b) => a + rng() * (b - a);

// one game: kinds = ['thinker', …] (one per kid). Returns { m, fin, kids: [{ k, kind }], stats }
function game(seed, kinds, seconds, opts) {
  opts = opts || {};
  const rng = Halcon.mulberry32(seed * 7 + 3);
  let now = 1000000;
  const m = Dragon.newGame(seed, seconds, now);
  Dragon.deal(m, kinds.map((kind, i) => [i + 1, 'Kid' + (i + 1), 'dralingo']));
  now = m.phaseUntil;
  Dragon.startPlay(m, now);
  const kids = kinds.map((kind, i) => ({ k: i + 1, kind, K: KINDS[kind], q: null, ans: 0, rate: 0, acc: 0, nextBatch: 0 }));
  const dealQ = (x) => { x.q = { at: now }; x.ans = x.K.t ? now + rnd(rng, x.K.t[0], x.K.t[1]) : Infinity; };
  kids.forEach(dealQ);
  const STEP = 50;
  const stats = { flights: 0, beats: 0, rings: 0, leads: 0, frenzy: 0, sprints: 0, stars: 0, sprintLastWins: 0, sprintRaces: 0, tail: 0, lostBeats: 0 };
  const lastAt = {};                       // race id → k of its last dragon when the sprint started
  while (now < m.endsAt) {
    now += STEP;
    const ev = Dragon.tick(m, now);
    stats.leads += ev.leads.length;
    if (ev.frenzy) stats.frenzy++;
    if (ev.sprintGo) {
      stats.sprints++;
      m.races.forEach((b) => { const s = Dragon.seatsOf(m, b); if (s.length > 1) lastAt[b.id] = s.slice().sort((a, c) => a.m - c.m)[0].k; });
    }
    if (ev.sprintEnd) ev.sprintEnd.races.forEach((r) => {
      stats.stars += r.w.length;
      if (lastAt[r.b] != null) { stats.sprintRaces++; if (r.w.includes(lastAt[r.b])) stats.sprintLastWins++; }
    });
    kids.forEach((x) => {
      const r = m.kids[x.k];
      if (x.q) {
        if (now >= x.ans || now - x.q.at >= Dragon.R.Q_MS + Dragon.R.Q_GRACE_MS) {
          const timeUp = now < x.ans;
          const right = !timeUp && rng() < x.K.p;
          const res = Dragon.answer(m, x.k, right, now - x.q.at, now, timeUp);
          x.q = null;
          if (res.right) {
            stats.flights++;
            x.rate = rnd(rng, x.K.rate[0], x.K.rate[1]);
            x.acc = 0;
            x.nextBatch = r.flap.start + 250;
          }
        }
        return;
      }
      if (r.flap) {
        const fl = r.flap;
        // the phone sends what it beat every 250 ms (its clock = the server's + a 60-140 ms trip)
        if (now >= x.nextBatch && now <= fl.until + 250) {
          x.acc += x.rate * 0.25;
          const n = Math.floor(x.acc);
          x.acc -= n;
          if (n > 0) {
            const got = Dragon.beats(m, x.k, fl.mid, n, now + rnd(rng, 60, 140));
            stats.beats += got.credited;
            stats.lostBeats += n - got.credited;
            if (got.ring) stats.rings++;
          }
          x.nextBatch += 250;
        }
        if (now >= Dragon.closeAt(fl)) Dragon.closeFlap(m, x.k, now);
        return;
      }
      if (now >= (r.nextQAt || 0)) dealQ(x);
    });
  }
  Dragon.final(m, now);
  Object.values(m.kids).forEach((r) => { if (r.flap) Dragon.closeFlap(m, r.k, now); });
  stats.tail = Object.values(m.kids).reduce((a, r) => a + r.tailM, 0);
  // before the bonus stars: who led each race (the ceremony can flip it)
  const before = {};
  m.races.forEach((b) => { const s = Dragon.rank(Dragon.seatsOf(m, b)); before[b.id] = s[0] && s[0].k; });
  const fin = Dragon.finish(m);
  stats.flips = fin.races.filter((rc) => rc.rows.length > 1 && rc.winners.length === 1 && rc.winners[0] !== before[rc.id]).length;
  stats.racesN = fin.races.filter((rc) => rc.rows.length > 1).length;
  return { m, fin, kids, stats };
}

// many games: average metres per kind, stars, flips, sprints won from last place
function run(games, n, seconds) {
  const kinds = ['thinker', 'thinker', 'slow', 'guesser', 'masher', 'thinker', 'idle', 'thinker', 'lazy', 'slow', 'thinker', 'thinker', 'guesser'];
  const sum = {}, cnt = {}, stars = {};
  const tot = { flips: 0, races: 0, sprintLastWins: 0, sprintRaces: 0, beats: 0, lost: 0, rings: 0, flights: 0, leads: 0, tail: 0 };
  let spread = 0, spreadN = 0;
  for (let s = 1; s <= games; s++) {
    const ks = Array.from({ length: n }, (_, i) => kinds[(i + s) % kinds.length]);
    const g = game(s, ks, seconds);
    g.kids.forEach((x) => {
      const row = g.fin.rows.find((r) => r.k === x.k);
      sum[x.kind] = (sum[x.kind] || 0) + row.total;
      stars[x.kind] = (stars[x.kind] || 0) + row.stars;
      cnt[x.kind] = (cnt[x.kind] || 0) + 1;
    });
    g.fin.races.forEach((rc) => { if (rc.rows.length > 1) { spread += rc.rows[0].total - rc.rows[rc.rows.length - 1].total; spreadN++; } });
    tot.flips += g.stats.flips; tot.races += g.stats.racesN;
    tot.sprintLastWins += g.stats.sprintLastWins; tot.sprintRaces += g.stats.sprintRaces;
    tot.beats += g.stats.beats; tot.lost += g.stats.lostBeats; tot.rings += g.stats.rings; tot.flights += g.stats.flights;
    tot.leads += g.stats.leads; tot.tail += g.stats.tail;
  }
  const avg = {};
  Object.keys(sum).forEach((k) => { avg[k] = { m: Math.round(sum[k] / cnt[k]), stars: +(stars[k] / cnt[k]).toFixed(2) }; });
  return { avg, tot, spread: Math.round(spread / Math.max(1, spreadN)) };
}

module.exports = { KINDS, game, run };

if (require.main === module) {
  if (process.env.R_OVERRIDE) Object.assign(Dragon.R, JSON.parse(process.env.R_OVERRIDE));
  const games = +(process.argv[2] || 100), n = +(process.argv[3] || 20), seconds = +(process.argv[4] || 240);
  const r = run(games, n, seconds);
  console.log(JSON.stringify(r, null, 2));
}
