// Playtest handler for Dragones Pintores: each bot walks back and forth along the ground, sends its position at 8 Hz,
// paints the surface tiles it passes, and taps «Recargar» (player:pc-ask) when its fire runs low.
module.exports = (bot, ctx) => {
  require('./party-check')(bot, ctx, 'paint');      // the Mario Party ending: «¡FINAL!», the show, my card (2026-10-16)
  let lv = null, x = 0, dir = 1, energy = 0, timer = null, asking = false;
  ctx.state.onDemand = true;                       // questions come only when the kid taps «Recargar»
  bot.on('pc:init', (d) => {
    asking = false;                                // a new round (or resync) never leaves the bot waiting
    lv = d.level;
    energy = d.energy;
    const sp = lv.spawns[Math.random() < 0.5 ? 'red' : 'gold'];
    x = sp[0] * lv.tile;
    clearInterval(timer);
    timer = setInterval(() => {
      if (!lv) return;
      const row = lv.rows - 2;                     // ground surface row
      if (energy > 0) {
        x += dir * 230 * 0.125;
        if (x < lv.tile * 2 || x > (lv.cols - 2) * lv.tile) dir = -dir;
        energy -= 0.125;
      }
      bot.emit('player:pc-pos', { pin: ctx.pin, x, y: row * lv.tile, f: dir > 0 ? 1 : 0, moving: energy > 0 });
      const id = row * lv.cols + Math.floor(x / lv.tile);
      if (energy > 0 && lv.surfaces.includes(id)) bot.emit('player:pc-paint', { pin: ctx.pin, tiles: [id] });
      if (energy < 2 && !asking) { asking = true; ctx.state.askedAt = Date.now(); bot.emit('player:pc-ask', { pin: ctx.pin }); }
    }, 125);
  });
  bot.on('pc:energy', (d) => { energy = d.energy; });
  bot.on('answer-result', (r) => {
    if (r && r.paint) energy = r.paint.energy;
    asking = false;
    ctx.state.waiting = false;                     // on-demand questions: don't count the gap as frozen
  });
  bot.on('game-end', () => clearInterval(timer));
};
