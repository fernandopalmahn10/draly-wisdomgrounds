// ════════════════════════════════════════════════════════════════════
// 📂 SENTENCE CATEGORIES
//
// Categories the teacher can tag a pushed sentence with, so the kid can
// browse their "De la maestra" tab filtered by topic (Casa, Escuela,
// Tienda, etc). Fernando 2026-06-04: "the ones sent by me can be
// assigned by groups, like house, market, school — categories give us
// really good control of what's being taught."
//
// Each category is { id, label, emoji, color }. The id is the stable
// slug stored on the sentence record; label is what the teacher and
// kid see. Color drives the chip border / tint in the UI.
//
// Add new categories at the END of the list so existing records keep
// pointing at their original id. Don't rename ids of existing entries.
// ════════════════════════════════════════════════════════════════════
const SENTENCE_CATEGORIES = [
  { id: 'home',       label: 'En casa',         emoji: '🏠', color: '#ffd166' },
  { id: 'school',     label: 'En la escuela',   emoji: '🏫', color: '#5be8d1' },
  { id: 'store',      label: 'En la tienda',    emoji: '🏪', color: '#ff9a6b' },
  { id: 'restaurant', label: 'En el restaurante', emoji: '🍜', color: '#ff6b9a' },
  { id: 'family',     label: 'Familia',         emoji: '👨‍👩‍👧', color: '#ffb46b' },
  { id: 'health',     label: 'Salud · médico',  emoji: '🏥', color: '#ff8a8a' },
  { id: 'time',       label: 'Hora · tiempo',   emoji: '⏰', color: '#a78bff' },
  { id: 'weather',    label: 'Clima',           emoji: '🌤️', color: '#7bc8ff' },
  { id: 'transport',  label: 'Transporte',      emoji: '🚗', color: '#5be88a' },
  { id: 'chat',       label: 'Saludos · charla',emoji: '💬', color: '#ffe082' },
  { id: 'study',      label: 'Estudios',        emoji: '📚', color: '#c08bff' },
  { id: 'other',      label: 'Otra',            emoji: '🎯', color: '#bfbfbf' },
];

const SENTENCE_CATEGORY_BY_ID = SENTENCE_CATEGORIES.reduce((m, c) => {
  m[c.id] = c; return m;
}, {});

function isValidCategoryId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SENTENCE_CATEGORY_BY_ID, id);
}

module.exports = { SENTENCE_CATEGORIES, SENTENCE_CATEGORY_BY_ID, isValidCategoryId };
