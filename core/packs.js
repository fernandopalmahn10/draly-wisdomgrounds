// Question packs organised like the curriculum: test family → level → experience (world) → round.
// GET /api/packs returns the tree for the picker (public/packs.html); a round points either to a built-in pack
// ('pack:<id>', questions generated here with Higgsfield pictures) or to an older uploaded set file (setId).
// Pinyin in games is written without tone marks (same as the existing sets).
'use strict';

const IMG = '/assets/packs';

// ---------- built-in packs ----------
// A round = a short word list. Each word: pinyin, Spanish, picture. Questions are generated in three kinds:
//   pic   — picture → which pinyin?           (always shows the picture)
//   zh2es — pinyin → which Spanish meaning?   (no picture: it would give the answer away)
//   es2zh — Spanish → which pinyin?           (shows the picture as a hint)
const WORDS = {
  'yct1-familia-r1': {
    title: 'YCT 1 · Mi Familia · Ronda 1',
    words: [
      { py: 'baba', es: 'papá', img: `${IMG}/yct1/familia/baba.webp` },
      { py: 'mama', es: 'mamá', img: `${IMG}/yct1/familia/mama.webp` },
      { py: 'gege', es: 'hermano mayor', img: `${IMG}/yct1/familia/gege.webp` },
      { py: 'jiejie', es: 'hermana mayor', img: `${IMG}/yct1/familia/jiejie.webp` },
      { py: 'wo', es: 'yo', img: `${IMG}/yct1/familia/wo.webp` },
      { py: 'ni', es: 'tú', img: `${IMG}/yct1/familia/ni.webp` },
      { py: 'ta', es: 'él', img: `${IMG}/yct1/familia/ta-el.webp`, sameSound: 'ta' },
      { py: 'ta', es: 'ella', img: `${IMG}/yct1/familia/ta-ella.webp`, sameSound: 'ta' },
    ],
  },
};

function pick(list, n, exclude) {
  const pool = list.filter((x) => !exclude.includes(x));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function buildQuestions(def) {
  const words = def.words;
  const pinyins = [...new Set(words.map((w) => w.py))];
  const spanish = [...new Set(words.map((w) => (w.sameSound ? 'él / ella' : w.es)))];
  const qs = [];
  words.forEach((w) => {
    qs.push({ kind: 'pic', text: '¿Quién es? ¿Cómo se dice en chino?', correct: w.py,
      answers: [w.py, ...pick(pinyins, 3, [w.py])], image: w.img });
    qs.push({ kind: 'es2zh', text: `¿Cómo se dice «${w.es}» en chino?`, correct: w.py,
      answers: [w.py, ...pick(pinyins, 3, [w.py])], image: w.img });
  });
  // pinyin → Spanish, once per sound (ta covers él / ella)
  const seen = new Set();
  words.forEach((w) => {
    if (seen.has(w.py)) return;
    seen.add(w.py);
    const meaning = w.sameSound ? 'él / ella' : w.es;
    qs.push({ kind: 'zh2es', text: `¿Qué significa «${w.py}»?`, correct: meaning,
      answers: [meaning, ...pick(spanish, 3, [meaning])], image: 'none' });
  });
  // interleave kinds so the same word never comes twice in a row
  const order = ['pic', 'zh2es', 'es2zh'];
  const byKind = order.map((k) => qs.filter((q) => q.kind === k).sort(() => Math.random() - 0.5));
  // es2zh follows the picture order shifted by half a round, so a word's two picture questions sit far apart
  const picOrder = byKind[0].map((q) => q.correct + '|' + q.image);
  const half = Math.ceil(picOrder.length / 2);
  const rotated = picOrder.slice(half).concat(picOrder.slice(0, half));
  byKind[2].sort((a, b) => rotated.indexOf(a.correct + '|' + a.image) - rotated.indexOf(b.correct + '|' + b.image));
  const out = [];
  while (byKind.some((l) => l.length)) order.forEach((_, i) => { if (byKind[i].length) out.push(byKind[i].shift()); });
  return out;
}

function loadPack(id) {
  const def = WORDS[id];
  if (!def) return null;
  return { id: 'pack:' + id, title: def.title, filename: null, questions: buildQuestions(def) };
}

// ---------- catalog (what the picker shows) ----------
const soon = (name, emoji) => ({ name, emoji, rounds: [] });
const CATALOG = [
  {
    id: 'yct', name: 'YCT', emoji: '🧒', blurb: 'Exámenes para niños',
    levels: [
      {
        id: 'yct1', name: 'YCT 1', worlds: [
          { name: 'Mi Familia', emoji: '👨‍👩‍👧', rounds: [
            { name: 'Ronda 1', blurb: 'papá, mamá, hermanos, yo, tú, él, ella', setId: 'pack:yct1-familia-r1' },
          ] },
          soon('El Espejo Mágico', '🪞'),
          soon('Mis Mascotas', '🐶'),
          soon('La Comida', '🍜'),
          soon('Números y Tiempo', '⏰'),
          soon('La Escuela y los Saludos', '🏫'),
        ],
      },
      { id: 'yct2', name: 'YCT 2', worlds: [] },
    ],
  },
  { id: 'newhsk', name: 'New HSK', emoji: '🆕', blurb: 'El HSK nuevo', levels: [{ id: 'nhsk1', name: 'New HSK 1', worlds: [] }] },
  {
    id: 'hsk', name: 'HSK', emoji: '📘', blurb: 'Las series que ya teníamos',
    levels: [
      {
        id: 'hsk1', name: 'HSK 1', worlds: [
          { name: 'EXP1 · Mi Familia', emoji: '👨‍👩‍👧', rounds: [{ name: 'Ronda 1', setId: 'my-family-hsk-1.csv' }] },
          { name: 'EXP2 · La Escuela', emoji: '🏫', rounds: [{ name: 'Ronda 1', setId: 'hsk1-school-vocabulary.csv' }] },
          { name: 'EXP3 · El Mercado', emoji: '🛒', rounds: [{ name: 'Ronda 1', setId: 'hsk1-market-pinyin-spanish.xlsx' }] },
          { name: 'EXP4 · Tiempo y Clima', emoji: '⛅', rounds: [{ name: 'Ronda 1', setId: 'hsk1-exp4-tiempo-clima.xlsx' }] },
          { name: 'EXP5 · Viajes', emoji: '🧭', rounds: [{ name: 'Ronda 1', setId: 'hsk1-exp5-viajes-direcciones.xlsx' }] },
          { name: 'EXP6 · La Casa', emoji: '🏠', rounds: [{ name: 'Ronda 1', setId: 'hsk1-exp6-casa-actividades.xlsx' }] },
          { name: 'EXP7 · Personas', emoji: '🧑', rounds: [{ name: 'Ronda 1', setId: 'hsk1-exp7-personas-preguntas.xlsx' }] },
          { name: 'EXP8 · Números', emoji: '🔢', rounds: [{ name: 'Ronda 1', setId: 'hsk1-exp8-numeros-particulas.xlsx' }] },
          { name: 'Pinyin básico', emoji: '🔤', rounds: [{ name: 'Ronda 1', setId: 'pinyin-basicos.xlsx' }] },
        ],
      },
    ],
  },
];

function catalog() { return CATALOG; }

module.exports = { loadPack, catalog };
