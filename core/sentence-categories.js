// ════════════════════════════════════════════════════════════════════
// 📂 SENTENCE CATEGORIES
//
// The 8 categories MUST mirror WU_EXPERIENCES in public/js/warmup-vocab.js.
// Fernando 2026-06-06: "those categories don't match with the ones we
// have in the maestro mode... I have eight experiences. I don't know why
// you're not redesigning it like that... You have the eight categories,
// and then you have the option to actually make a new category."
//
// So the canonical set IS the 8 HSK1 experiences (exp1..exp8). Custom
// categories the teacher creates at runtime live separately under
// "userCategories" in the lesson-pack localStorage and are validated
// loosely (any non-empty slug).
//
// Each category is { id, label, short, emoji, color }. The id is the
// stable slug stored on the sentence record. Don't rename existing ids.
// ════════════════════════════════════════════════════════════════════
const SENTENCE_CATEGORIES = [
  { id: 'exp1', label: 'EXP1 · Yo / Familia',        short: '👋 EXP1', emoji: '👋', color: '#ffd166' },
  { id: 'exp2', label: 'EXP2 · Escuela / Idioma',    short: '🎓 EXP2', emoji: '🎓', color: '#5be8d1' },
  { id: 'exp3', label: 'EXP3 · Comprar / Comer',     short: '🍴 EXP3', emoji: '🍴', color: '#ff9a6b' },
  { id: 'exp4', label: 'EXP4 · Tiempo / Clima',      short: '⏰ EXP4', emoji: '⏰', color: '#a78bff' },
  { id: 'exp5', label: 'EXP5 · Viajes / Lugares',    short: '✈️ EXP5', emoji: '✈️', color: '#7bc8ff' },
  { id: 'exp6', label: 'EXP6 · Casa / Actividades',  short: '🏠 EXP6', emoji: '🏠', color: '#ff6b9a' },
  { id: 'exp7', label: 'EXP7 · Personas / ¿?',       short: '🙋 EXP7', emoji: '🙋', color: '#ffb46b' },
  { id: 'exp8', label: 'EXP8 · Números / Partículas', short: '🔢 EXP8', emoji: '🔢', color: '#c08bff' },
];

const SENTENCE_CATEGORY_BY_ID = SENTENCE_CATEGORIES.reduce((m, c) => {
  m[c.id] = c; return m;
}, {});

// Built-in ids are tightly validated. Teacher-created custom categories
// flow through a separate slug check (handled in the UI layer) so server
// won't reject them just because they're not in the canonical 8.
function isValidCategoryId(id) {
  if (typeof id !== 'string' || !id) return false;
  if (Object.prototype.hasOwnProperty.call(SENTENCE_CATEGORY_BY_ID, id)) return true;
  // Custom teacher category — slug-style: "u_<lowercase>", max 40 chars.
  return /^u_[a-z0-9_-]{1,38}$/.test(id);
}

module.exports = { SENTENCE_CATEGORIES, SENTENCE_CATEGORY_BY_ID, isValidCategoryId };
