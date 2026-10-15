// Playtest handler for Piñata Tigre v2: the harness answers every question with a random choice; this handler HITS after
// every right answer like a kid: it answers the swing's ping (the server measures the round trip), watches the arrow (the
// same triangle wave as core/pinata.js) and taps when it is near the centre (aim ± 0.12, a human reaction ~0.3 s), sending
// the ms on its own arrow clock. Bot03 is a "clock cheater": it taps at once but CLAIMS the moment the arrow was dead centre
// (the server must clamp it to ± 200 ms of its own estimate, so it can't pick criticals). Bot04 never taps (the server's
// automatic hit after the window: power 1, never more than a tap). Checks on what comes back:
//   · every right answer opens a swing; every swing ends in exactly one pn:hit (tapped or automatic), with power ≥ 1, an
//     automatic one = 1 (×2 in the last 30 s); my running total = the sum of my hits
//   · the end payload: teamScores = totals, the winner, my card = my total, stars only for kids with something > 0
// Stats in report.pinata (per-kid event counts too: the meter must stay a trickle, not a storm).
'use strict';

const HALF = 900;
const needle = (phase, c, half) => { const u = (((phase || 0) + Math.max(0, c) / (half || HALF)) % 2 + 2) % 2; return u <= 1 ? u : 2 - u; };
// the first moment after `from` ms when the arrow is within `tol` of `pos`
function when(phase, half, pos, from, until) {
  for (let c = from; c <= until; c += 5) if (Math.abs(needle(phase, c, half) - pos) < 0.012) return c;
  return null;
}

module.exports = (bot, ctx) => {
  const st = ctx.state;
  const R = ctx.report;
  R.endedGrace = 5000;                         // «¡FINAL!» (pn:final) ends the watch; game-end comes 2.4 s later
  const E = R.pinata || (R.pinata = {
    swings: 0, hits: 0, autos: 0, crits: 0, candies: 0, bursts: 0, landmarks: 0, leads: 0, frenzy: 0, finals: 0, ends: 0,
    cheaterTaps: 0, cheaterCrits: 0, honestTaps: 0, honestCrits: 0, idleAutos: 0, meterPerKid: {}, eventsPerKid: {}, pings: 0,
    winner: null, totals: null, stars: null, grades: {},
  });
  const cheater = ctx.name === 'Bot03';
  const idle = ctx.name === 'Bot04';
  const lead = ctx.name === 'Bot01';
  let frenzy = false, mySum = 0, timers = [], open = {}, finalSeen = false;
  E.meterPerKid[ctx.name] = 0;
  E.eventsPerKid[ctx.name] = 0;
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  bot.onAny(() => { E.eventsPerKid[ctx.name]++; });
  bot.on('pn:meter', () => { E.meterPerKid[ctx.name]++; });
  bot.on('pn:ping', (d, ack) => { E.pings++; if (typeof ack === 'function') ack({ ok: 1 }); });
  bot.on('pn:lead', () => { if (lead) E.leads++; });
  bot.on('pn:burst', (b) => { if (lead) { E.bursts++; if (b.landmark) E.landmarks++; } });
  bot.on('pn:frenzy', () => { frenzy = true; if (lead) E.frenzy++; });
  bot.on('pn:final', () => { finalSeen = true; if (lead) E.finals++; timers.forEach(clearTimeout); });
  bot.on('pn:init', () => { frenzy = false; });

  bot.on('answer-result', (r) => {
    if (!r || !r.pinata) { fail('answer-result without pinata info', r); return; }
    if (!r.correct) { if (!(r.pinata.wait > 0)) fail('wrong answer without a wait', r); return; }
    const s = r.pinata;
    if (!(s.hid > 0 && s.window >= 2000 && s.lead > 0 && s.half > 0 && s.phase >= 0 && s.crit > 0)) { fail('a right answer must open a swing', s); return; }
    E.swings++;
    const t0 = Date.now();
    open[s.hid] = { t0, sent: false, auto: idle };
    // the harness's freeze clock: busy until the hit and its result (+ a burst) are over
    st.graceUntil = t0 + s.lead + s.window + 1000 + 1600 + 1500;
    if (idle) return;                                         // the server's automatic hit
    const aim = 0.5 + (Math.random() - 0.5) * 0.24;
    const c = when(s.phase, s.half, aim, 250 + Math.random() * 200, s.window - 50) || 600;
    let claim = c, fire = c;
    if (cheater) { fire = 200; claim = when(s.phase, s.half, 0.5, 0, s.window) || c; }
    timers.push(setTimeout(() => {
      open[s.hid].sent = true;
      open[s.hid].cheat = cheater && Math.abs(claim - fire) > 260;
      bot.emit('player:pn-hit', { pin: ctx.pin, hid: s.hid, c: claim });
    }, s.lead + fire));
  });
  bot.on('pn:nohit', (d) => { if (!finalSeen) fail('a tap was refused', d); });
  bot.on('pn:hit', (h) => {
    if (!h || !open[h.hid]) { fail('a hit for a swing I never had', h); return; }
    const o = open[h.hid];
    delete open[h.hid];
    E.hits++;
    E.grades[h.grade] = (E.grades[h.grade] || 0) + 1;
    if (!(h.power >= 1)) fail('a hit with no power', h);
    if (h.grade === 'auto') {
      E.autos++;
      if (idle) E.idleAutos++;
      if (h.power > 2) fail('an automatic hit earned more than the minimum', h);
    }
    if (h.crit) E.crits++;
    if (o.cheat) { E.cheaterTaps++; if (h.crit) E.cheaterCrits++; }
    else if (o.sent) { E.honestTaps++; if (h.crit) E.honestCrits++; }
    E.candies += h.power;
    if (h.total !== mySum + h.power) fail('my running total does not add up', { total: h.total, mySum, power: h.power });
    mySum = h.total;
  });

  bot.on('game-end', (d) => {
    timers.forEach(clearTimeout);
    const left = Object.keys(open).length;
    if (left > 1) fail('swings that never got a hit', { left });
    const mo = d && d.pinata;
    if (!mo || !d.me || !mo.totals) { fail('end payload', d); return; }
    if (d.teamScores.red !== mo.totals.r || d.teamScores.gold !== mo.totals.g) fail('teamScores = totals', d.teamScores);
    const w = mo.totals.r > mo.totals.g ? 'red' : mo.totals.g > mo.totals.r ? 'gold' : 'tie';
    if (mo.winner !== w || d.winner !== w) fail('winner', { w, got: mo.winner });
    if (d.me.candy !== mySum) fail('my card = the sum of my hits', { card: d.me.candy, mine: mySum });
    if (d.me.won !== (w === d.me.team)) fail('won flag', d.me);
    (mo.stars || []).forEach((s) => { if (!s.who || !s.who.length) fail('a star without a winner', s); });
    if ((d.me.stars || []).some((id) => !(mo.stars || []).some((s) => s.id === id))) fail('my star is not in the list', d.me);
    if (d.me.candy === 0 && (d.me.stars || []).length) fail('a kid with 0 got a star', d.me);
    if (lead) { E.ends++; E.winner = mo.winner; E.totals = mo.totals; E.stars = (mo.stars || []).map((s) => `${s.id}:${s.n}`); }
  });
};
