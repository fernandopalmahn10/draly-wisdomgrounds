// Where each single-word answer tile is used (its item and sentence).  node scripts/packs/tones/contexts.js word1,word2,…
'use strict';
const path = require('path');
const Packs = require(path.join(__dirname, '..', '..', '..', 'core', 'packs.js'));
const want = new Set(process.argv[2].split(','));
for (const level of Packs.LEVELS) {
  for (const world of level.worlds) for (const round of world.rounds) for (const it of round.items || []) {
    const hits = [];
    const look = (s, role) => { if (want.has(s)) hits.push(role + '=' + s); };
    if (it.k === 'f') { look(it.a, 'a'); (it.bank || []).forEach((x) => look(x, 'bank')); }
    if (it.k === 'q') { look(it.a, 'a'); (it.w || []).forEach((x) => look(x, 'w')); }
    if (it.k === 'r') { look(it.b, 'b'); (it.w || []).forEach((x) => look(x, 'w')); }
    if (it.k === 'w' || it.k === 'm') look(it.py, it.k);
    if (hits.length) console.log(level.id + ' ' + world.id + '/' + round.id + ' [' + it.k + '] ' + hits.join(' ') + ' :: ' + (it.t || it.s || it.a || it.py) + (it.k === 'f' || it.k === 'q' ? '  a=' + it.a + ' opts=' + [].concat(it.bank || it.w || []).join('/') : ''));
  }
}
