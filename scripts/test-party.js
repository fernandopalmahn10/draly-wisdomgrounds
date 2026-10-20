// The Mario Party ending shared by Reinos de Colores, Dragones Pintores, Batalla de Nieve and La Gran Fuga (2026-10-16):
//   node scripts/test-party.js
// core/party.js (bonus stars with ties, ranks, shares) and the Spanish lines of every phone's card (public/js/party.js
// card(): a kid with nothing to show reads an encouraging line, never a «0»; singular / plural; no NaN), the star values,
// and the cast lines of the ending (every character has reino / pintado / nieve / animo lines, Aileen in voseo).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Party = require('../core/party');
const UI = require('../public/js/party.js');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };

// ---------- stars ----------
const rows = [
  { k: 1, a: 5, b: 2, c: 0 }, { k: 2, a: 5, b: 1, c: 3 }, { k: 3, a: 2, b: 0, c: 3 }, { k: 4, a: 0, b: 0, c: 0 },
];
const defs = [
  { id: 'a', name: 'A', val: (r) => r.a, ok: (r) => r.a >= 1 },
  { id: 'b', name: 'B', val: (r) => r.b, ok: (r) => r.b >= 2 },
  { id: 'z', name: 'Z', val: (r) => r.a, ok: () => false },                 // nobody qualifies: skipped
  { id: 'c', name: 'C', val: (r) => r.c, ok: (r) => r.c >= 1, best: 'min' },
  { id: 'd', name: 'D', val: (r) => r.b, ok: (r) => r.b >= 0 },
  { id: 'e', name: 'E', val: (r) => r.b, ok: (r) => r.b >= 0 },
];
const st = Party.stars(rows, defs);
eq(st.map((s) => s.id), ['a', 'b', 'c', 'd'], 'categories nobody qualifies for are skipped; at most four stars');
eq(st[0].winners, [1, 2], 'a tie shares the star');
eq(st[1].winners, [1], 'eligibility is checked (b ≥ 2)');
eq(st[2].winners, [2, 3], '«best: min» stars go to the lowest value (ties share)');
eq(Party.stars([], defs), [], 'no kids: no stars');
eq(Party.stars(rows, [{ id: 'm', name: 'M', val: () => 1, ok: () => true, maxShare: 3 }]), [], 'a star more than maxShare kids would share is skipped (no honour)');
eq(Party.stars(rows, [{ id: 'm', name: 'M', val: (r) => r.a, ok: () => true, maxShare: 3 }])[0].winners, [1, 2], '… a shared top within maxShare stays');
const rk = Party.ranks([{ v: 9 }, { v: 9 }, { v: 4 }, { v: 1 }], 'v');
eq(rk.map((r) => r.rank), [1, 1, 3, 4], 'equal values share the rank');
eq(Party.share(3, 12), 25, 'share in whole per cent');
eq(Party.share(3, 0), 0, 'share of an empty team is 0 (never NaN)');
const byK = { 1: { k: 1, name: 'Ana', skin: 'aileen', team: 'red', stars: ['a'] }, 2: { k: 2, name: 'Omar', skin: 'hamdan', team: 'gold' } };
const pub = Party.publicStars([{ id: 'a', name: 'A', unit: '', value: 5, winners: [1, 2, 3, 4, 5, 6] }], Object.assign({ 3: byK[1], 4: byK[1], 5: byK[1], 6: byK[1] }, byK), () => 5);
eq(pub[0].n, 6, 'the star says how many share it');
eq(pub[0].who.length, Party.WHO_MAX, 'at most four winners are drawn');
ok(UI.starValue('kingdoms', Object.assign({}, pub[0], { id: 'tiles' })).startsWith('y 2 más · '), 'six winners: «y 2 más · …»');

// ---------- the cards: never a «0», always a headline ----------
const R = (n) => Math.floor(Math.random() * n);
const zeroFact = (lines) => lines.facts.some(([v]) => v === '0' || /^0\//.test(v) || /^0 /.test(v));
const games = {
  kingdoms: () => ({ team: R(2) ? 'red' : 'gold', tiles: R(3) ? R(30) : 0, share: R(60), right: R(8), answered: R(12), best: R(6), lms: R(3), points: R(40), won: !R(2), tie: !R(6) }),
  paint: () => ({ team: R(2) ? 'red' : 'gold', painted: R(3) ? R(80) : 0, owned: R(20), share: R(60), right: R(8), answered: R(12), best: R(6), blazes: R(3), won: !R(2), tie: !R(6) }),
  snow: () => { const side = R(2) ? 'sun' : 'ice'; return { team: side, side, seconds: R(3) ? R(240) : R(4), freezes: R(3) ? R(5) : 0, right: R(8), answered: R(12), hits: R(6), score: R(400), won: !R(2), spell: side === 'ice' && !R(3) }; },
  escape: () => ({ team: 'crew', turbos: R(3) ? R(20) : 0, safe: R(3) ? R(9) : 0, supers: R(4), best: R(6), right: R(8), answered: R(12), won: !R(2) }),
};
const fins = {
  kingdoms: { winner: 'red', totals: { red: 30, gold: 20 } },
  paint: { winner: 'tie', totals: { red: 40, gold: 40 } },
  snow: { winner: 'sun', totals: { sun: 3, ice: 12, total: 15 } },
  escape: { winner: 'crew', extra: { rank: { id: 'burj', name: 'Viajeros del Burj', stars: 2 }, escaped: false, level: 2, hearts: 3 } },
};
Object.keys(games).forEach((g) => {
  for (let i = 0; i < 4000; i++) {
    const me = games[g]();
    if (me.right > me.answered) me.answered = me.right;
    const c = UI.card(g, me, fins[g]);
    ok(c.title && c.big && c.sub, `${g}: a title, a big line and a sub line`);
    ok(!zeroFact(c), `${g}: no fact reads 0 (${JSON.stringify(c.facts)})`);
    ok(c.facts.length <= 4, `${g}: at most four facts`);
    ok(!/NaN|undefined|null/.test(JSON.stringify(c)), `${g}: no NaN / undefined in the card`);
    if (c.zero) eq(c.big, { text: '¡La próxima es tuya!' }, `${g}: nothing to show = the encouraging line`);
    else ok(c.big.n > 0 || (g === 'snow' && me.spell && /Hechizo/.test(c.big.text)), `${g}: the big number is never 0 (a Nieve spell pick: its line)`);
  }
});
// a kid who did exactly nothing
const none = { team: 'red', side: 'sun', tiles: 0, painted: 0, owned: 0, right: 0, answered: 0, best: 0, lms: 0, points: 0, blazes: 0, turbos: 0, safe: 0, supers: 0, freezes: 0, seconds: 0, hits: 0, score: 0 };
['kingdoms', 'paint', 'escape'].forEach((g) => {
  const c = UI.card(g, Object.assign({}, none, g === 'escape' ? { team: 'crew' } : {}), fins[g]);
  ok(c.zero && c.facts.length === 0, `${g}: a kid who did nothing sees «¡La próxima es tuya!» and no numbers`);
});
const tried = UI.card('kingdoms', Object.assign({}, none, { answered: 3 }), fins.kingdoms);
eq(tried.facts, [['3', 'preguntas jugadas']], 'answered but never right: «3 preguntas jugadas», never «0 aciertos»');
eq(UI.card('kingdoms', Object.assign({}, none, { answered: 1 }), fins.kingdoms).facts, [['1', 'pregunta jugada']], 'singular');
const k1 = UI.card('kingdoms', Object.assign({}, none, { tiles: 1, share: 4, right: 1, answered: 2, lms: 1, points: 1 }), fins.kingdoms);
eq(k1.big, { pre: 'Ganaste ', n: 1, post: ' punto para tu reino' }, 'the card leads with the points (the podium\'s unit), singular');
ok(k1.facts.some(([v, l]) => v === '1/2' && l === 'acierto') && k1.facts.some(([, l]) => l === 'monumento') && k1.facts.some(([v, l]) => v === '1' && l === 'casilla'), 'singular facts');
eq(UI.card('kingdoms', Object.assign({}, none, { tiles: 3 }), fins.kingdoms).big, { pre: 'Conquistaste ', n: 3, post: ' casillas' }, 'tiles without points (auto-planted flags): the tiles');
const guest = UI.card('kingdoms', { k: 0, guest: true }, fins.kingdoms);
ok(guest.zero && guest.title === '¡Qué ronda!' && !/Fuego|Mar/.test(guest.title), 'a phone with no card of its own: a friendly guest card, nobody\'s team');
eq(UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', freezes: 2, seconds: 20 }), fins.snow).title, '¡Buen intento, Equipo Hielo!', 'Nieve: the side that lost reads «¡Buen intento…!» like the other games');
eq(UI.card('kingdoms', Object.assign({}, none, { tiles: 5, share: 0 }), fins.kingdoms).sub, '¡Cada casilla cuenta para tu reino!', 'a share under 1 % is never «el 0 %»');
eq(UI.card('kingdoms', Object.assign({}, none, { won: true, tiles: 4 }), fins.kingdoms).title, '¡Tu reino conquistó Dubái!', 'the winners\' title');
eq(UI.card('kingdoms', Object.assign({}, none, { team: 'gold', tiles: 4 }), fins.kingdoms).title, '¡Buen intento, Reino del Mar!', 'the other kingdom: kind, never «perdiste»');
eq(UI.card('snow', Object.assign({}, none, { side: 'sun', team: 'sun', seconds: 240 }), fins.snow).big, { pre: 'Aguantaste toda la ronda: ', n: 240, post: ' s' }, 'a survivor');
eq(UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', freezes: 1, seconds: 12 }), fins.snow).big, { pre: 'Congelaste a ', n: 1, post: ' amigo' }, 'the ice team: who they froze (singular)');
ok(UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', seconds: 2 }), fins.snow).zero, 'frozen at once and nothing else: the encouraging line');
// a kid the Hechizo picked was never frozen: no «Y antes aguantaste 9 s sin congelarte» (classroom playtest 2026-10-16)
const spell1 = UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', freezes: 1, seconds: 9, spell: true }), fins.snow);
ok(spell1.big.n === 1 && !/aguantaste/i.test(spell1.sub) && /Hechizo/.test(spell1.sub), 'Nieve: a spell pick who froze a friend: no «antes aguantaste»');
const spell0 = UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', seconds: 9, spell: true }), fins.snow);
ok(!spell0.zero && /Hechizo/.test(spell0.big.text) && !/aguantaste/i.test(JSON.stringify(spell0)), 'Nieve: a spell pick who froze nobody: «¡El Hechizo te eligió…!», never «aguantaste 9 s»');
const frozen1 = UI.card('snow', Object.assign({}, none, { side: 'ice', team: 'ice', freezes: 1, seconds: 40 }), fins.snow);
ok(/aguantaste 40 s/i.test(frozen1.sub), 'Nieve: a kid frozen later keeps «Y antes aguantaste 40 s»');
eq(UI.card('escape', Object.assign({}, none, { team: 'crew', turbos: 1 }), fins.escape).big, { pre: 'Diste ', n: 1, post: ' turbo a la tripulación' }, 'one turbo');
eq(UI.card('escape', Object.assign({}, none, { team: 'crew', turbos: 3 }), fins.escape).title, '¡Viajeros del Burj!', 'the crew\'s rank is the headline');
ok(/La Fuente del Burj Khalifa/.test(UI.card('escape', Object.assign({}, none, { team: 'crew', turbos: 3 }), fins.escape).sub), 'the zone the crew reached');
// La Gran Fuga v2: the route's own places (js/escape-map.js on the page; here loaded by hand)
global.EscapeMap = require('../public/js/escape-map');
const chinaFin = { winner: 'crew', extra: { rank: { id: 'burj', name: 'Viajeros de la Muralla', stars: 2 }, route: 1, escaped: false, level: 2, hearts: 3 } };
const chinaCard = UI.card('escape', Object.assign({}, none, { team: 'crew', turbos: 3 }), chinaFin);
ok(/El Jardín Chino/.test(chinaCard.sub) && chinaCard.title === '¡Viajeros de la Muralla!', 'the China route: its own place and rank');
ok(/La Fuente del Burj Khalifa/.test(UI.card('escape', Object.assign({}, none, { team: 'crew', turbos: 3 }), fins.escape).sub), 'the Dubái route is route 0');
delete global.EscapeMap;

// ---------- the star values ----------
eq(UI.starValue('kingdoms', { id: 'big', value: 7, n: 1 }), '7 casillas de una vez', 'Mayor conquista');
eq(UI.starValue('paint', { id: 'sky', value: 1, n: 1 }), '1 nube con su color al final', 'Más cielo al final (singular)');
eq(UI.starValue('paint', { id: 'painted', value: 80, n: 1 }), '80 nubes pintadas', 'Más nubes pintadas says «pintadas» (never mixed up with the podium clouds at the end)');
eq(UI.starValue('snow', { id: 'survive', value: 95, n: 1 }), '95 s sin congelarse', 'Más tiempo sin congelarse');
eq(UI.starValue('escape', { id: 'fast', value: 2.4, n: 1 }), '2,4 s en promedio', 'decimals with a comma');
eq(UI.starValue('escape', { id: 'safe', value: 9, n: 12 }), 'y 8 más · 9 olas a salvo', 'a shared co-op star');
['kingdoms', 'paint', 'snow', 'escape'].forEach((g) => {
  const G = UI.GAMES[g];
  Object.keys(G.ico).forEach((id) => ok(G.value(id, 2).length > 2, `${g}: every star has its value text (${id})`));
});
// the stars of each game's core file have a value text and an icon on the screens
[['kingdoms', require('../core/kingdoms').STARS], ['paint', require('../core/paint').STARS], ['snow', require('../core/snow').STARS], ['escape', require('../core/escape').STARS]].forEach(([g, S]) => {
  ok(S.length >= 3 && S.length <= Party.MAX_STARS, `${g}: 3-4 bonus stars`);
  S.forEach((s) => ok(UI.GAMES[g].ico[s.id] && /^[A-ZÁÉÍÓÚ]/.test(s.name), `${g}: «${s.name}» has its icon on the screens`));
  S.forEach((s) => ok(!/(el|la) mejor|rey|reina|conquistador|dueñ/i.test(s.name), `${g}: «${s.name}» is neutral (a category, never «el mejor» / «la reina»)`));
});

// ---------- the cast lines of the ending ----------
const cast = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'cast.js'), 'utf8');
['fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'dralingo'].forEach((id) => {
  const start = cast.indexOf('\n    ' + id + ': {');
  const end = cast.indexOf('\n    },', start);
  const block = cast.slice(start, end);
  ['reino', 'pintado', 'nieve', 'animo'].forEach((m) => ok(new RegExp('\\n\\s+' + m + ': \\[\'').test(block), `${id} has «${m}» lines`));
  if (id === 'aileen') {
    const lines = ['reino', 'pintado', 'nieve', 'animo'].map((m) => (block.match(new RegExp(m + ': \\[([^\\]]+)\\]')) || [])[1] || '').join(' ');
    ok(/vos |podés|che|[Dd]ale/.test(lines), 'Aileen speaks with voseo in the ending');
  }
});
ok(/reino: 'cheer', pintado: 'cheer', nieve: 'cheer', animo: 'hello'/.test(cast), 'the ending moods have their sticker poses');
ok(!/[\u4e00-\u9fff]/.test(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'party.js'), 'utf8')), 'no hanzi in the ending');
// the teacher's \u00ab+30 s\u00bb / \u00ab\u221230 s\u00bb (every pin game, 2026-10-20): a cut stops 10 s before the end, never ends a round
eq(Party.clockShift(100000, 30000, 0), 30000, '\u00ab+30 s\u00bb adds 30 s');
eq(Party.clockShift(100000, -30000, 0), -30000, '\u00ab\u221230 s\u00bb with 100 s left takes 30 s');
eq(Party.clockShift(100000, -30000, 75000), -15000, '\u00ab\u221230 s\u00bb with 25 s left stops 10 s before the end');
eq(Party.clockShift(100000, -30000, 91000), 0, '\u00ab\u221230 s\u00bb with 9 s left: nothing to take');
eq(Party.clockShift(100000, -30000, 95000), 0, 'never a positive change from a cut');
console.log(`party: all ${checks} checks passed`);
