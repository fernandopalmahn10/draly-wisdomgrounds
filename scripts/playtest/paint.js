// Playtest handler for Dragones Pintores v2 (tap to fly): each bot taps the sky every ~0.6-1.5 s (a cloud that isn't its
// kingdom's, or a third of the time a prize island), sometimes drags a finger (a burst of taps the server rate-limits),
// sometimes sends nonsense the server must ignore, and taps «Recargar» (player:pc-ask) when its fire runs low; the
// server also deals a question by itself at 0 fire. Questions are answered by playtest-bots.js itself.
'use strict';
const path = require('path');
const PW = require(path.join(__dirname, '..', '..', 'public', 'js', 'paint-worlds.js'));

module.exports = (bot, ctx) => {
  require('./party-check')(bot, ctx, 'paint');      // the Mario Party ending: «¡FINAL!», the show, my card (2026-10-16)
  let sky = null, me = null, fire = 0, timer = null, asking = false, team = 'red', own = [], qOpen = false;
  const R = ctx.report;
  const P = R.paintBots || (R.paintBots = { taps: 0, drags: 0, junk: 0, asks: 0, captures: 0, flips: 0, inits: 0 });
  ctx.state.onDemand = true;                       // questions come when the kid taps «Recargar» or runs out of fire
  bot.on('pc:init', (d) => {
    P.inits++;
    asking = false;                                // a new round (or resync) never leaves the bot waiting
    qOpen = false;
    sky = PW.build(d.world, d.seed);
    me = d.me;
    fire = d.energy;
    own = (d.own || []).slice();
    const r = d.roster && d.roster[me];
    if (r) team = r[1];
    clearInterval(timer);
    timer = setInterval(tick, 600 + Math.random() * 900);
  });
  function tick() {
    if (!sky) return;
    const code = team === 'red' ? 1 : 2;
    if (fire > 0.5) {
      let x, y;
      if (Math.random() < 0.33) {
        const l = sky.lms[Math.floor(Math.random() * sky.lms.length)];
        x = l.x + (Math.random() - 0.5) * 80; y = l.y + (Math.random() - 0.5) * 80;
      } else {
        const cand = sky.clouds.map((c, i) => i).filter((i) => own[i] !== code);
        const i = cand.length ? cand[Math.floor(Math.random() * cand.length)] : Math.floor(Math.random() * sky.clouds.length);
        [x, y] = sky.clouds[i];
      }
      if (Math.random() < 0.12) {                  // a finger dragged across the sky: 20 taps at once (≤ 12 a second count)
        P.drags++;
        for (let k = 0; k < 20; k++) bot.emit('player:pc-go', { pin: ctx.pin, x: x + k * 6, y });
      } else {
        P.taps++;
        bot.emit('player:pc-go', { pin: ctx.pin, x, y });
      }
      if (Math.random() < 0.03) {                  // nonsense the server must ignore without an error
        P.junk++;
        bot.emit('player:pc-go', { pin: ctx.pin, x: 'abc', y: null });
        bot.emit('player:pc-go', { pin: ctx.pin, x: 1e12, y: -1e12 });
        bot.emit('player:pc-go', { pin: ctx.pin });
      }
    }
    if (fire < 1.5 && !asking && !qOpen) {          // (a question already open is not asked for again: a phone shows it once)
      asking = true;
      P.asks++;
      ctx.state.askedAt = Date.now();
      bot.emit('player:pc-ask', { pin: ctx.pin });
    }
  }
  bot.on('pc:energy', (d) => { fire = d.energy; if (fire > 1.5) asking = false; });
  bot.on('pc:paint', (m) => {
    (m.f || []).forEach(([i, c]) => { own[i] = c; });
    P.flips += (m.f || []).length;
    (m.ev || []).forEach((e) => { if (e.type === 'capture') P.captures++; });
  });
  bot.on('pc:roster', (r) => { if (r && me != null && r[me]) team = r[me][1]; });
  bot.on('answer-result', (r) => {
    qOpen = false;
    if (r && r.paint) fire = r.paint.energy;
    if (fire > 1.5) asking = false;
    ctx.state.waiting = !!(r && !r.correct && fire <= 0);   // still out of fire: the next question must come
    if (ctx.state.waiting) ctx.state.lastAnsAt = Date.now();
  });
  bot.on('question', () => { asking = false; qOpen = true; });
  bot.on('game-end', () => clearInterval(timer));
};
