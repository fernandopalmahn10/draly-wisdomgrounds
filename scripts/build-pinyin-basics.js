// Build the absolute-beginner pinyin survival-phrases set.
// ZERO Chinese characters, ZERO tone marks. Just plain ASCII pinyin
// (the teacher's preferred format on this platform) paired with the
// Spanish meaning so HSK absolute-beginners can play any standard game.
//
// Words covered:
//   - Hola: ni hao
//   - Pronombres: wo, ni, ta
//   - Adiós: zai jian
//   - Gracias: xie xie
//   - De nada: bu ke qi
//   - Sí/Bien: hao
//   - No: bu
//
// Run: node scripts/build-pinyin-basics.js

'use strict';
const path = require('path');
const xlsx = require('xlsx');

const OUT_PATH = path.join(__dirname, '..', 'data', 'sets', 'pinyin-basicos.xlsx');

const ROWS = [
  ['question', 'correct', 'wrong1', 'wrong2', 'wrong3'],

  // ─── Forward recognition: pinyin → Spanish ─────────────────────────────
  ['¿Qué significa "ni hao"?',     'hola',          'adiós',       'gracias',     'de nada'],
  ['¿Qué significa "zai jian"?',   'adiós',         'hola',        'gracias',     'sí'],
  ['¿Qué significa "xie xie"?',    'gracias',       'de nada',     'hola',        'adiós'],
  ['¿Qué significa "bu ke qi"?',   'de nada',       'gracias',     'por favor',   'no'],
  ['¿Qué significa "wo"?',         'yo',            'tú',          'él / ella',   'nosotros'],
  ['¿Qué significa "ni"?',         'tú',            'yo',          'él / ella',   'ustedes'],
  ['¿Qué significa "ta"?',         'él / ella',     'yo',          'tú',          'ellos'],
  ['¿Qué significa "hao"?',        'bien / bueno',  'malo',        'no',          'gracias'],
  ['¿Qué significa "bu"?',         'no',            'sí',          'tal vez',     'bien'],

  // ─── Reverse recall: Spanish → pinyin ──────────────────────────────────
  ['¿Cómo se dice "hola" en chino?',   'ni hao',     'zai jian',   'xie xie',     'bu ke qi'],
  ['¿Cómo se dice "adiós" en chino?',  'zai jian',   'ni hao',     'xie xie',     'hao'],
  ['¿Cómo se dice "gracias" en chino?','xie xie',    'bu ke qi',   'ni hao',      'zai jian'],
  ['¿Cómo se dice "de nada" en chino?','bu ke qi',   'xie xie',    'ni hao',      'bu hao'],
  ['¿Cómo se dice "yo" en chino?',     'wo',         'ni',         'ta',          'hao'],
  ['¿Cómo se dice "tú" en chino?',     'ni',         'wo',         'ta',          'hao'],
  ['¿Cómo se dice "él" en chino?',     'ta',         'wo',         'ni',          'bu'],
  ['¿Cómo se dice "ella" en chino?',   'ta',         'wo',         'ni',          'bu'],
  ['¿Cómo se dice "bien" en chino?',   'hao',        'bu',         'wo',          'ni hao'],
  ['¿Cómo se dice "no" en chino?',     'bu',         'hao',        'wo',          'ni'],

  // ─── Aplicado / mini-frases ────────────────────────────────────────────
  ['¿Qué responder a "xie xie"?',                  'bu ke qi',  'zai jian',  'ni hao',     'hao'],
  ['Te encuentras a un amigo. ¿Qué dices?',        'ni hao',    'zai jian',  'xie xie',    'bu'],
  ['Te vas de la escuela. ¿Qué dices?',            'zai jian',  'ni hao',    'xie xie',    'wo'],
  ['"Yo estoy bien" en chino:',                    'wo hao',    'ni hao',    'ta hao',     'bu hao'],
  ['"¿Tú estás bien?" en chino:',                  'ni hao ma?','wo hao',    'ta hao',     'zai jian'],
  ['"No, gracias" en chino:',                      'bu, xie xie','hao, xie xie','ni hao',  'zai jian'],
];

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(ROWS);
ws['!cols'] = [
  { wch: 46 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
];
xlsx.utils.book_append_sheet(wb, ws, 'Pinyin Básicos');
xlsx.writeFile(wb, OUT_PATH);
console.log(`✓ Wrote ${OUT_PATH}  (${ROWS.length - 1} questions)`);
