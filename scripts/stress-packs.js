#!/usr/bin/env node
// Stress check for answers that are ALSO correct (code review 2026-10-11): builds each round many times and looks for
// known traps (synonyms, replies that fit two questions, a real place offered as a wrong "where?" answer).
// usage: node scripts/stress-packs.js [builds=1000]
'use strict';
const Packs = require('../core/packs');
const N = +(process.argv[2] || 1000);
const TRAPS = [
  // [round, question text contains, wrong option that must never appear]
  ['hsk1-escuela-r2', '«kan»', 'ver (alcanzar a ver)'],
  ['hsk1-escuela-r2', '«kanjian»', 'mirar / ver'],
  ['hsk1-escuela-r2', '«mirar / ver»', 'kanjian'],
  ['hsk1-escuela-r2', '«ver (alcanzar a ver)»', 'kan'],
  ['yct1-comida-r1', '«Ni chi pingguo ma?»', 'Bu, wo bu xihuan chi.'],
  ['yct1-comida-r1', '«Chi yi kou, hao ma?»', 'Hao de, xiexie ni.'],
  ['yct1-simulacro-s5e', '«Ni chi pingguo ma?»', 'Shi de.'],
  ['yct1-simulacro-s1e', '«Ni xihuan ma?»', 'Shi de.'],
  ['hsk1-viajes-r2', '«Ni qu nar?»', 'Xuexiao'],
];
let bad = 0;
for (const [round, inText, never] of TRAPS) {
  let seen = 0;
  let hits = 0;
  for (let i = 0; i < N; i++) {
    for (const q of Packs.loadPack(round).questions) {
      if (!q.text.includes(inText)) continue;
      seen++;
      if (q.answers.includes(never)) hits++;
    }
  }
  if (!seen) { console.log('MISSING', round, inText); bad++; continue; }
  if (hits) { console.log('TRAP', round, inText, 'offers', JSON.stringify(never), hits + '/' + seen); bad++; }
}
// "leer / estudiar" (dushu) must never come with "leer" or "estudiar" as a wrong option, wherever it is asked
for (const level of Packs.LEVELS) for (const w of level.worlds) for (const r of w.rounds) {
  const id = `${level.id}-${w.id}-${r.id}`;
  for (let i = 0; i < 200; i++) for (const q of Packs.loadPack(id).questions) {
    if (q.correct === 'leer / estudiar' && q.answers.some((a) => a === 'leer' || a === 'estudiar')) { console.log('TRAP', id, 'dushu'); bad++; }
  }
}
console.log(bad ? `stress: ${bad} problem(s)` : `stress: ${TRAPS.length} traps clear over ${N} builds`);
process.exit(bad ? 1 : 0);
