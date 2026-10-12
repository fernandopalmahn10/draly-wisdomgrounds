// Student levels (2026-10-12): the one list every place reads when it checks, picks or shows a level.
// A kid's level comes from the access code they type at /homework (core/teachers.js `codeLevels`).
// 'hsk2' is the STORED id of New HSK 1 (HSK 2 was absorbed into New HSK 1 on 2026-10-11): old student records and
// tarea ids keep 'hsk2', everything people see says "New HSK 1". Order = how pickers list them.
'use strict';

const LEVELS = [
  // pack: the curriculum game level in core/packs.js · packTareas: its rounds are this level's /homework tareas ·
  // packWords: the parents' word list comes from the pack (hsk1 keeps its own 150-word list, warmup-vocab.js) ·
  // next: the level after it, for the parents' «próximamente» line · daily: false hides Desafíos (HSK 1 words)
  { id: 'yct1', name: 'YCT 1', teacherName: 'YCT 1', family: 'yct', emoji: '🧒', pack: 'yct1', packTareas: true,
    words: 83, packWords: true, exam: 'YCT', next: 'YCT 2', daily: false },
  // New HSK 1 homework = only what prepares the exam (his ask 2026-10-12): the Simulacro rounds built from the two
  // platform simulations (the mother file), nothing else — packWorlds limits the pack, onlyPackTareas hides the old
  // «Bolsa de palabras» tareas
  { id: 'hsk2', name: 'New HSK 1', teacherName: 'New HSK 1', family: 'newhsk', emoji: '🆕', pack: 'newhsk1', words: 300,
    packTareas: true, packWorlds: ['simulacro'], onlyPackTareas: true, packWords: true, exam: 'New HSK',
    next: 'New HSK 2' },
  { id: 'hsk1', name: 'HSK 1', teacherName: 'Old HSK 1', family: 'hsk', emoji: '📘', pack: 'hsk1', words: 150,
    exam: 'HSK', next: 'New HSK 1' },
];
const DEFAULT = 'hsk1';                      // codes without a level (every code made before 2026-09-15)
const ALIASES = { newhsk1: 'hsk2' };         // the curriculum name of the stored id

// 'YCT1' / 'newhsk1' / 'hsk2' → a stored id, or null when it is not a level
function normalize(level) {
  const s = String(level || '').trim().toLowerCase();
  const id = ALIASES[s] || s;
  return LEVELS.some((l) => l.id === id) ? id : null;
}
function info(level) {
  const id = normalize(level) || DEFAULT;
  return LEVELS.find((l) => l.id === id);
}
// what a picker shows: [{ id, name, teacherName, emoji }]
function list() {
  return LEVELS.map(({ id, name, teacherName, emoji }) => ({ id, name, teacherName, emoji }));
}

module.exports = { LEVELS, DEFAULT, normalize, info, list };
