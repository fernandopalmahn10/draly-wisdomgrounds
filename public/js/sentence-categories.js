// Mirror of core/sentence-categories.js for the browser. Keep these
// two arrays in sync — when you add/edit a category, edit BOTH files.
// The 8 categories ARE the HSK1 experiences (warmup-vocab.js's
// WU_EXPERIENCES). Custom user categories sit alongside in localStorage.
(function () {
  const SENTENCE_CATEGORIES = [
    { id: 'exp1', label: 'EXP1 · Yo / Familia',         short: '👋 EXP1', emoji: '👋', color: '#ffd166' },
    { id: 'exp2', label: 'EXP2 · Escuela / Idioma',     short: '🎓 EXP2', emoji: '🎓', color: '#5be8d1' },
    { id: 'exp3', label: 'EXP3 · Comprar / Comer',      short: '🍴 EXP3', emoji: '🍴', color: '#ff9a6b' },
    { id: 'exp4', label: 'EXP4 · Tiempo / Clima',       short: '⏰ EXP4', emoji: '⏰', color: '#a78bff' },
    { id: 'exp5', label: 'EXP5 · Viajes / Lugares',     short: '✈️ EXP5', emoji: '✈️', color: '#7bc8ff' },
    { id: 'exp6', label: 'EXP6 · Casa / Actividades',   short: '🏠 EXP6', emoji: '🏠', color: '#ff6b9a' },
    { id: 'exp7', label: 'EXP7 · Personas / ¿?',        short: '🙋 EXP7', emoji: '🙋', color: '#ffb46b' },
    { id: 'exp8', label: 'EXP8 · Números / Partículas', short: '🔢 EXP8', emoji: '🔢', color: '#c08bff' },
  ];
  const SENTENCE_CATEGORY_BY_ID = SENTENCE_CATEGORIES.reduce((m, c) => {
    m[c.id] = c; return m;
  }, {});
  // Custom (teacher-created) categories live in localStorage under this
  // key. Each entry: { id: 'u_xxx', label: 'Mi tema', emoji: '⭐', color }.
  const CUSTOM_CAT_KEY = 'draly_custom_categories_v1';
  function loadCustomCategories() {
    try {
      const raw = localStorage.getItem(CUSTOM_CAT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((c) => c && c.id && c.label) : [];
    } catch (_) { return []; }
  }
  function saveCustomCategories(arr) {
    try { localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(arr || [])); } catch (_) {}
  }
  function addCustomCategory(label, emoji) {
    const trimmed = String(label || '').trim();
    if (!trimmed) return null;
    const slug = 'u_' + trimmed.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 38);
    if (!slug || slug === 'u_') return null;
    const cur = loadCustomCategories();
    if (cur.find((c) => c.id === slug)) return cur.find((c) => c.id === slug);
    const cat = { id: slug, label: trimmed, emoji: emoji || '⭐', color: '#ffe082' };
    cur.push(cat);
    saveCustomCategories(cur);
    return cat;
  }
  function allCategories() {
    return SENTENCE_CATEGORIES.concat(loadCustomCategories());
  }
  function categoryById(id) {
    if (!id) return null;
    return SENTENCE_CATEGORY_BY_ID[id] || loadCustomCategories().find((c) => c.id === id) || null;
  }
  window.SENTENCE_CATEGORIES = SENTENCE_CATEGORIES;
  window.SENTENCE_CATEGORY_BY_ID = SENTENCE_CATEGORY_BY_ID;
  window.SentenceCategories = {
    builtIn: SENTENCE_CATEGORIES,
    loadCustom: loadCustomCategories,
    saveCustom: saveCustomCategories,
    add: addCustomCategory,
    all: allCategories,
    byId: categoryById,
  };
})();
