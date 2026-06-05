// Mirror of core/sentence-categories.js for the browser. Keep these
// two arrays in sync — when you add/edit a category, edit BOTH files.
// (No bundler in this project, so we don't share the module directly.)
(function () {
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
  window.SENTENCE_CATEGORIES = SENTENCE_CATEGORIES;
  window.SENTENCE_CATEGORY_BY_ID = SENTENCE_CATEGORY_BY_ID;
})();
