// The «Draly Party» names of the live pin games (his naming 2026-10-23, «Approve all»: CLAUDE.md «Draly Party»).
// gameType ids never change; these are what a kid, a parent or a teacher reads. `full` where there is room (the games
// list, /maestro's launcher, a lobby title, a ceremony header), `short` in tight spots (a chip, a small label, a
// projector tab with its PIN). The pages write the names themselves (games.html, maestro.js, sets.html, packs.html,
// host-*.html, the phones); scripts/test-game-names.js reads THIS list and checks them all, so a rename is this file +
// the pages the test names.
// OLD = the names each game was shown with before (the launcher's labels since 2026-10-10, the remakes' titles). Kids'
// records keep copies of them: /maestro's «call the kids in» wrote the game's name into each kid's inbox
// («🚀 La maestra está abriendo Mochi Mash ahora. Estás entrando.» + a «📚 Mochi Mash» button, js/live-game.js and
// js/auto-host.js). `inboxMessage` shows those with today's name where the inbox leaves the server
// (/api/homework/inbox); the saved records are never rewritten.
'use strict';

const NAMES = {
  dormilon:     { full: 'Draly Siesta · ¡No despiertes a Dralingo!', short: 'Draly Siesta' },
  teamcrab:     { full: 'Draly Cangrejo · ¡Atrapa a Fénec!', short: 'Draly Cangrejo' },
  trapdoor:     { full: 'Draly Trampillas', short: 'Draly Trampillas' },
  halcon:       { full: 'Draly Halcón', short: 'Draly Halcón' },
  escape:       { full: 'Draly Fuga · Las rutas de la fuga', short: 'Draly Fuga' },
  snow:         { full: 'Draly Nieve · Batalla en Ski Dubái', short: 'Draly Nieve' },
  paint:        { full: 'Draly Pintores · El Cielo de las Maravillas', short: 'Draly Pintores' },
  kingdoms:     { full: 'Draly Reinos', short: 'Draly Reinos' },
  'mochi-mash': { full: 'Draly Mochi · La Terraza del Mochi', short: 'Draly Mochi' },
  monopoly:     { full: 'Draly Tablero · El Gran Tablero de Dubái', short: 'Draly Tablero' },
  'dragon-eye': { full: 'Draly Vuelo · La Carrera del Cielo', short: 'Draly Vuelo' },
  pinata:       { full: 'Draly Piñata · La Fiesta de las Piñatas', short: 'Draly Piñata' },
  sixseven:     { full: 'Draly 67 · La Balanza de Oro', short: 'Draly 67' },
};

// every name a kid may still find in a saved copy, by game (whole names only: «La Balanza de Oro» alone is matched as a
// whole label, never inside «Draly 67 · La Balanza de Oro»)
const OLD = {
  dormilon: ['¡No despiertes a Dralingo!'],
  teamcrab: ['¡Atrapa a Fénec!'],
  trapdoor: ['Las Trampillas'],
  halcon: ['Ojos de Halcón'],
  escape: ['La Gran Fuga de Dubái', 'La Gran Fuga', 'Las rutas de la fuga'],
  snow: ['Batalla de Nieve en Ski Dubái', 'Batalla de Nieve'],
  paint: ['Dragones Pintores', 'El Cielo de las Maravillas'],
  kingdoms: ['Reinos de Colores'],
  'mochi-mash': ['Mochi Mash', 'La Terraza del Mochi'],
  monopoly: ['Dàfùwēng · Monopolio Chino', 'Dàfùwēng · Monopolio', 'Monopolio Chino', 'Monopolio', 'HSK Monopoly', 'Dàfùwēng'],
  'dragon-eye': ['Vuelo del Dragón', 'Dragon Eye', 'La Carrera del Cielo'],
  pinata: ['Piñata Tigre', 'Piñata', 'La Fiesta de las Piñatas'],
  sixseven: ['6-7 Swing · La Balanza de Oro', '6-7 Swing', 'La Balanza de Oro'],
};

const _byOld = new Map();
Object.keys(OLD).forEach((type) => OLD[type].forEach((n) => _byOld.set(n, type)));

// the name of a game: which = 'full' (default) or 'short'; null for a type that is not a pin game
function nameOf(type, which) {
  const n = NAMES[type];
  return n ? n[which === 'short' ? 'short' : 'full'] : null;
}

// a label as a page saved it → today's full name (a label that is not an old game name comes back as it is)
function current(label) {
  const type = typeof label === 'string' ? _byOld.get(label.trim()) : null;
  return type ? NAMES[type].full : label;
}

// the launcher's invites (js/live-game.js, js/auto-host.js): «🚀 La maestra está abriendo <name> ahora. Estás entrando.»
// (or «… ahora. Prepárate.») and the button «📚 <name>»
const INVITE = /^(🚀 La maestra está abriendo )(.+)( ahora\. (?:Estás entrando|Prepárate)\.)$/;
const BUTTON = /^(📚 )(.+)$/;

// an inbox message with today's game name (the same object when nothing changes; a copy otherwise, the record untouched)
function inboxMessage(m) {
  if (!m || typeof m !== 'object') return m;
  let text = m.text, label = m.actionLabel;
  const t = typeof text === 'string' ? INVITE.exec(text) : null;
  if (t && _byOld.has(t[2])) text = t[1] + current(t[2]) + t[3];
  const b = typeof label === 'string' ? BUTTON.exec(label) : null;
  if (b && _byOld.has(b[2])) label = b[1] + current(b[2]);
  return text === m.text && label === m.actionLabel ? m : Object.assign({}, m, { text, actionLabel: label });
}

module.exports = { NAMES, OLD, nameOf, current, inboxMessage };
