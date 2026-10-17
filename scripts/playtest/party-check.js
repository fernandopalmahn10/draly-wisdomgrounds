// The Mario Party ending of Reinos de Colores, Dragones Pintores, Batalla de Nieve and La Gran Fuga, checked on every bot
// (2026-10-16 ending pass): «¡FINAL!» (fin:final) ends the watch and game-end comes Party.FINAL_MS later, so the run waits
// for it; every phone's game-end must carry the show (`fin`) and its own card (`me`), whose lines (js/party.js card())
// never read «0». Counts land in report.party: { final, frenzy, cards, stars }.
'use strict';
const path = require('path');
const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'party.js'));

module.exports = (bot, ctx, game) => {
  const R = ctx.report;
  R.endedGrace = Math.max(R.endedGrace || 0, 5000);
  const P = R.party || (R.party = { final: 0, frenzy: 0, cards: 0, stars: 0, zeroCards: 0, bad: 0 });
  const bad = (why, d) => { P.bad++; R.errors.push({ who: ctx.name, ev: 'party-ending', d: why + (d ? ' ' + JSON.stringify(d).slice(0, 200) : '') }); };
  bot.on('fin:final', (d) => {
    P.final++;
    if (!d || d.game !== game || !(d.ms > 0)) bad('fin:final without its game / time', d);
  });
  bot.on('fin:frenzy', (d) => { if (d && !d.off) P.frenzy++; });
  bot.on('game-end', (d) => {
    if (!d || !d.fin || d.fin.game !== game) return bad('game-end without the show (fin)', d && { keys: Object.keys(d) });
    if (!d.me || !d.me.k || !d.me.team) return bad('game-end without my card (me)', d.me);
    const lines = UI.card(game, d.me, d.fin);
    if (!lines.title || !lines.big) bad('card without a headline', lines);
    if (lines.facts.some(([v]) => v === '0' || /^0\//.test(v))) bad('a card fact reads 0', lines.facts);
    if (/NaN|undefined/.test(JSON.stringify(lines))) bad('NaN / undefined on a card', lines);
    if ((d.fin.stars || []).length > 4) bad('more than 4 bonus stars', d.fin.stars.map((s) => s.id));
    P.cards++;
    if (lines.zero) P.zeroCards++;
    if ((d.me.stars || []).length) P.stars++;
  });
};
