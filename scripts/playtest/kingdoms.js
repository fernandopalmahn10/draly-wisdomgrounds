// Playtest handler for Reinos de Colores: after a right answer the bot plants its flag on a random glowing tile.
// About 1 in 5 bots never tap, so the server's 8 s auto-plant is exercised too.
module.exports = (bot, ctx) => {
  require('./party-check')(bot, ctx, 'kingdoms');      // the Mario Party ending: «¡FINAL!», the show, my card (2026-10-16)
  const lazy = Math.random() < 0.2;
  const plant = (payload) => {
    if (!payload || !payload.needsPlant) return;
    ctx.state.graceUntil = Date.now() + 9500;      // plant window (8 s) + server grace (1.5 s): not a freeze
    if (lazy) return;
    const valid = payload.valid || [];
    const tile = valid.length ? valid[Math.floor(Math.random() * valid.length)] : null;
    setTimeout(() => bot.emit('player:kd-plant', { pin: ctx.pin, tile }), 400 + Math.random() * 2600);
  };
  bot.on('answer-result', (r) => { if (r && r.kingdoms) plant(r.kingdoms); });
  bot.on('kd:prompt', plant);
};
