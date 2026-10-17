// Playtest handler for Las Trampillas (tap to run on the round platform): each bot taps the floor every ~0.8-1.6 s,
// sometimes drags a finger (a burst the server rate-limits), sometimes sends nonsense the server must ignore, and at «0»
// most bots dash off the burning slices (some freeze, like real kids). Questions are dealt by the room (wings on the
// floor, the comeback in the pit) and answered by playtest-bots.js itself. A kid with wings, or one whose next question
// only comes with the next round, is not frozen: the handler tells the watch until when (graceUntil).
'use strict';
const path = require('path');
const A = require(path.join(__dirname, '..', '..', 'public', 'js', 'trapdoor-arena.js'));

module.exports = (bot, ctx) => {
  require('./party-check')(bot, ctx, 'trapdoor');   // the shared Mario Party ending: «¡FINAL!», the show, my card
  const R = ctx.report;
  const T = R.tdBots || (R.tdBots = { inits: 0, taps: 0, drags: 0, junk: 0, dashes: 0, rounds: 0, falls: 0, saves: 0, backs: 0, rises: 0, wings: 0, qclose: 0 });
  let me = null, x = 0, y = 0, st = 'up', timer = null, roundAt = 0, final = false, matchId = null;
  const roundEnd = () => roundAt + A.bounds(final).end;
  // the latest a new question must come for this kid (the next round's title at the latest; two when it rises with wings)
  const grace = (extraRounds) => { ctx.state.graceUntil = Math.max(ctx.state.graceUntil || 0, roundEnd() + (extraRounds || 0) * A.bounds(false).end + 900); };
  bot.on('td:init', (d) => {
    T.inits++;
    me = d.me;
    matchId = d.id;
    st = d.st || 'up';
    roundAt = Date.now() - (d.r > 0 ? d.ago : -(A.TIMING.INTRO - d.ago));
    final = !!d.final;
    const row = (d.pos || []).find((r) => r[0] === me);
    if (row) { x = row[1]; y = row[2]; }
    grace(d.r > 0 ? 0 : 1);                         // the first question comes with round 1 (after «¡YA!»)
    clearInterval(timer);
    timer = setInterval(tick, 800 + Math.random() * 800);
  });
  bot.on('td:round', (m) => {
    if (m.id !== matchId) return;
    T.rounds++;
    roundAt = Date.now() - (m.ago || 0);
    final = !!m.final;
    if (st !== 'down') grace(0);
  });
  bot.on('td:pos', (m) => { const r = (m.d || []).find((row) => row[0] === me); if (r) { x = r[1]; y = r[2]; } });
  bot.on('td:me', (d) => { if (d && d.st) st = d.st; });
  bot.on('td:lock', (m) => {
    if (st !== 'up' || Math.random() < 0.3) return;   // some freeze, like real kids
    setTimeout(() => {
      if (!m.set.includes(A.sliceOf(x, y))) return;
      const safe = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !m.set.includes(i));
      const cur = A.angleOf(x, y);
      let best = safe[0], bd = 9;
      safe.forEach((i) => { let da = Math.abs(A.sliceMid(i) - cur); da = Math.min(da, 2 * Math.PI - da); if (da < bd) { bd = da; best = i; } });
      const p = A.pointAt(A.sliceMid(best), 40 + Math.random() * 30);
      T.dashes++;
      bot.emit('player:td-go', { pin: ctx.pin, x: p[0], y: p[1] });
    }, 350 + Math.random() * 600);
  });
  bot.on('td:open', (m) => { if ((m.falls || []).includes(me)) T.falls++; if ((m.saves || []).includes(me)) T.saves++; });
  bot.on('td:rise', (m) => { if (m.k === me) T.rises++; });
  bot.on('td:qclose', () => {
    T.qclose++;
    ctx.state.waiting = false;                        // «0» closed my wings question: the next one comes with the next round
    grace(0);
  });
  bot.on('answer-result', (r) => {
    const td = r && r.td;
    if (!td) return;
    if (td.wings) T.wings++;
    if (td.back) T.backs++;
    // the next question: after the «¡Casi!» wait, or with the next round (wings now / too late this round / rising
    // with wings = two rounds)
    grace(td.kind === 'pre' && td.wings ? 1 : 0);
  });
  // a question asked twice (a resync crossing a deal): the second answer comes back stale; a phone shows one per id
  bot.on('answer-stale', () => { ctx.state.waiting = false; });
  function tick() {
    if (st !== 'up') return;
    const p = A.pointAt(Math.random() * Math.PI * 2, A.R_MIN + Math.random() * (A.R_MAX - A.R_MIN));
    if (Math.random() < 0.1) {                       // a finger dragged: 20 taps at once (≤ 12 a second count)
      T.drags++;
      for (let k = 0; k < 20; k++) bot.emit('player:td-go', { pin: ctx.pin, x: p[0] + k, y: p[1] });
    } else {
      T.taps++;
      bot.emit('player:td-go', { pin: ctx.pin, x: p[0], y: p[1] });
    }
    if (Math.random() < 0.03) {                      // nonsense the server must ignore without an error
      T.junk++;
      bot.emit('player:td-go', { pin: ctx.pin, x: 'abc', y: null });
      bot.emit('player:td-go', { pin: ctx.pin, x: 1e12, y: -1e12 });
      bot.emit('player:td-go', { pin: ctx.pin });
      bot.emit('player:td-go', null);
    }
  }
  bot.on('game-end', () => clearInterval(timer));
};
