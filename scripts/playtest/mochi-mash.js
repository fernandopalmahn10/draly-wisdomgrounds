// Playtest handler for Mochi Mash v2: the harness answers every question with a random choice; this handler MASHES
// after every right answer like a kid (6–11 taps a second, a count sent every 250 ms, a last one at the end; Bot03 is an
// "auto-clicker" claiming 40 taps a second) and checks the rules on what comes back:
//   · every window's summary (mm:mashed): credited taps ≤ 12 per second of the window + the burst, mochis = taps
//     (×2 in the frenzy, +4/+8 for a golden one), the auto-clicker gets the cap and no more
//   · the end payload: totals = teamScores, a winner or a tie, my card (mochis = the sum of my windows), stars only for
//     kids with something > 0, every star winner in the top list's data
// A right answer opens a ~6-8 s window before the next question: the harness's freeze clock waits for it (graceUntil).
// Stats in report.mochi (per-kid event counts too: the meter must stay a trickle, not a storm).
'use strict';

const RATE = 12, BURST = 6;

module.exports = (bot, ctx) => {
  const st = ctx.state;
  const R = ctx.report;
  R.endedGrace = 5000;                         // «¡FINAL!» (mm:final) ends the watch; game-end comes 2.4 s later
  const E = R.mochi || (R.mochi = {
    windows: 0, taps: 0, credited: 0, mochis: 0, golds: 0, capChecks: 0, cheaterWindows: 0, cheaterMaxRate: 0,
    meterPerKid: {}, eventsPerKid: {}, leads: 0, landmarks: 0, frenzy: 0, finals: 0, ends: 0, endChecks: 0,
    winner: null, totals: null, stars: null,
  });
  const cheater = ctx.name === 'Bot03';
  const lead = ctx.name === 'Bot01';
  const rate = cheater ? 40 : 6 + Math.random() * 5;
  let frenzy = false, mySum = 0, timers = [], finalSeen = false;
  E.meterPerKid[ctx.name] = 0;
  E.eventsPerKid[ctx.name] = 0;
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  bot.onAny(() => { E.eventsPerKid[ctx.name]++; });
  bot.on('mm:meter', () => { E.meterPerKid[ctx.name]++; });
  bot.on('mm:lead', () => { if (lead) E.leads++; });
  bot.on('mm:landmark', () => { if (lead) E.landmarks++; });
  bot.on('mm:frenzy', () => { frenzy = true; if (lead) E.frenzy++; });
  bot.on('mm:final', () => { finalSeen = true; if (lead) E.finals++; timers.forEach(clearTimeout); });
  bot.on('mm:init', () => { frenzy = false; });

  bot.on('answer-result', (r) => {
    if (!r || !r.mochi) { fail('answer-result without mochi info', r); return; }
    if (!r.correct) { if (!(r.mochi.wait > 0)) fail('wrong answer without a wait', r); return; }
    const m = r.mochi;
    if (!(m.mid > 0 && m.ms >= 5000 && m.lead > 0)) { fail('a right answer must open a window', m); return; }
    // the harness's freeze clock: this kid is legitimately busy until the window (and its grace) is over
    st.graceUntil = Date.now() + m.lead + m.ms + 1600;
    E.windows++;
    let sent = 0, carry = 0;
    const start = Date.now() + m.lead;
    const tick = () => {
      const now = Date.now();
      const end = start + m.ms;
      carry += (rate * 250) / 1000;
      const n = Math.floor(carry);
      carry -= n;
      if (n > 0) { bot.emit('player:mm-taps', { pin: ctx.pin, mid: m.mid, n }); sent += n; }
      if (now + 250 < end) timers.push(setTimeout(tick, 250));
      else { E.taps += sent; }
    };
    timers.push(setTimeout(tick, m.lead + 250));
    bot.once('mm:mashed', (d) => {
      if (!d || d.mid !== m.mid) return;
      E.capChecks++;
      E.credited += d.taps;
      E.mochis += d.mochis;
      if (d.gold) E.golds++;
      mySum = d.total;
      const cap = Math.floor((RATE * m.ms) / 1000) + BURST;
      if (d.taps > cap) fail('more taps credited than the cap', { taps: d.taps, cap });
      if (d.taps > sent + 1) fail('more taps credited than sent', { taps: d.taps, sent });
      const mult = m.frenzy || frenzy ? 2 : 1;
      const base = d.taps;
      // mochis: taps × 1 or 2, plus a golden extra of at most 4 × mult (capped at the gap when behind)
      if (d.mochis < base || d.mochis > base * 2 + 8) fail('mochis do not add up', { d, base, mult });
      if (cheater && !finalSeen) {               // (a window cut by «¡FINAL!» ends early on purpose)
        E.cheaterWindows++;
        E.cheaterMaxRate = Math.max(E.cheaterMaxRate, Math.round((10 * d.taps) / (m.ms / 1000)) / 10);
        if (d.taps < cap - 8) fail('the auto-clicker should still get the cap', { taps: d.taps, cap });
      }
    });
  });

  bot.on('game-end', (d) => {
    timers.forEach(clearTimeout);
    E.endChecks++;
    const mo = d && d.mochi;
    if (!mo || !d.me || !mo.totals) { fail('end payload', d); return; }
    if (d.teamScores.red !== mo.totals.r || d.teamScores.gold !== mo.totals.g) fail('teamScores = totals', d.teamScores);
    const w = mo.totals.r > mo.totals.g ? 'red' : mo.totals.g > mo.totals.r ? 'gold' : 'tie';
    if (mo.winner !== w || d.winner !== w) fail('winner', { w, got: mo.winner });
    if (d.me.mochis !== mySum && mySum) fail('my card = the sum of my windows', { card: d.me.mochis, mine: mySum });
    if (d.me.won !== (w === d.me.team)) fail('won flag', d.me);
    (mo.stars || []).forEach((s) => {
      if (!s.who || !s.who.length) fail('a star without a winner', s);
      if (s.id === 'fed' && !(s.value > 0)) fail('Más mochis with 0', s);
    });
    if ((d.me.stars || []).some((id) => !(mo.stars || []).some((s) => s.id === id))) fail('my star is not in the list', d.me);
    if (d.me.mochis === 0 && (d.me.stars || []).includes('fed')) fail('a kid with 0 got Más mochis', d.me);
    if (lead) { E.ends++; E.winner = mo.winner; E.totals = mo.totals; E.stars = (mo.stars || []).map((s) => `${s.id}:${s.n}`); }
  });
};
