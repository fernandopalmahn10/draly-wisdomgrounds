// =========================================================================
// WARM-UP VOCABULARY LIBRARY · HSK1 sentence-builder
// 90+ HSK1 words across 9 color-coded categories. Loaded on BOTH the
// host page (teacher picks words from here) AND the player page (renders
// each word with the same category color). Server uses the IDs to keep
// host + players in sync.
//
// Each word: { id, pinyin, hanzi, es, icon, cat }
// Each category: { id, label, color }
//
// To add words later: drop them into the right category's `words` array.
// =========================================================================
(function () {
  const WU_CATEGORIES = {
    pronoun:  { id: 'pronoun',  label: 'Pronombres',   color: '#5b8def' },
    verb:     { id: 'verb',     label: 'Verbos',       color: '#ef5b5b' },
    place:    { id: 'place',    label: 'Lugares',      color: '#5bef8a' },
    time:     { id: 'time',     label: 'Tiempo',       color: '#b75bef' },
    number:   { id: 'number',   label: 'Números',      color: '#ef9c5b' },
    question: { id: 'question', label: '¿Pregunta?',   color: '#efdf5b' },
    particle: { id: 'particle', label: 'Partículas',   color: '#aaaaaa' },
    family:   { id: 'family',   label: 'Familia',      color: '#ef5b95' },
    food:     { id: 'food',     label: 'Comida',       color: '#a07050' },
    adj:      { id: 'adj',      label: 'Adjetivos',    color: '#5bcfef' },
  };

  // Helper that fills (id, cat) onto every entry so we don't have to repeat
  let _nextId = 0;
  function w(cat, pinyin, hanzi, es, icon) {
    return { id: 'w' + (++_nextId), cat, pinyin, hanzi, es, icon: icon || '' };
  }

  const WU_WORDS = [
    // ---- PRONOUNS (8) ----
    w('pronoun', 'wǒ',     '我',   'yo',          '👤'),
    w('pronoun', 'nǐ',     '你',   'tú',          '👉'),
    w('pronoun', 'tā',     '他',   'él',          '👨'),
    w('pronoun', 'tā',     '她',   'ella',        '👩'),
    w('pronoun', 'wǒmen',  '我们', 'nosotros',    '👥'),
    w('pronoun', 'nǐmen',  '你们', 'ustedes',     '👥'),
    w('pronoun', 'tāmen',  '他们', 'ellos',       '👥'),
    w('pronoun', 'dōu',    '都',   'todos',       '🌐'),

    // ---- VERBS (18) ----
    w('verb', 'shì',     '是',   'ser',           '✅'),
    w('verb', 'yǒu',     '有',   'tener',         '🤲'),
    w('verb', 'zài',     '在',   'estar',         '📍'),
    w('verb', 'qù',      '去',   'ir',            '➡️'),
    w('verb', 'lái',     '来',   'venir',         '⬅️'),
    w('verb', 'huí',     '回',   'regresar',      '🔁'),
    w('verb', 'xǐhuan',  '喜欢', 'gustar',        '❤️'),
    w('verb', 'ài',      '爱',   'amar',          '💕'),
    w('verb', 'xiǎng',   '想',   'querer/pensar', '💭'),
    w('verb', 'yào',     '要',   'querer',        '🙋'),
    w('verb', 'chī',     '吃',   'comer',         '🍴'),
    w('verb', 'hē',      '喝',   'beber',         '🥤'),
    w('verb', 'kàn',     '看',   'ver/mirar',     '👀'),
    w('verb', 'tīng',    '听',   'escuchar',      '👂'),
    w('verb', 'shuō',    '说',   'decir',         '💬'),
    w('verb', 'mǎi',     '买',   'comprar',       '🛒'),
    w('verb', 'xuéxí',   '学习', 'estudiar',      '📚'),
    w('verb', 'gōngzuò', '工作', 'trabajar',      '🧑‍⚕️'),

    // ---- PLACES (10) ----
    w('place', 'jiā',       '家',   'casa',         '🏠'),
    w('place', 'xuéxiào',   '学校', 'escuela',      '🏫'),
    w('place', 'yīyuàn',    '医院', 'hospital',     '🏥'),
    w('place', 'shāngdiàn', '商店', 'tienda',       '🏪'),
    w('place', 'cāntīng',   '餐厅', 'restaurante',  '🍜'),
    w('place', 'gōngyuán',  '公园', 'parque',       '🌳'),
    w('place', 'fànguǎn',   '饭馆', 'restaurante',  '🍱'),
    w('place', 'fángjiān',  '房间', 'habitación',   '🚪'),
    w('place', 'Zhōngguó',  '中国', 'China',        '🇨🇳'),
    w('place', 'Měiguó',    '美国', 'EEUU',         '🇺🇸'),

    // ---- TIME (10) ----
    w('time', 'jīntiān',  '今天', 'hoy',         '📅'),
    w('time', 'míngtiān', '明天', 'mañana',      '🌅'),
    w('time', 'zuótiān',  '昨天', 'ayer',        '⏪'),
    w('time', 'xiànzài',  '现在', 'ahora',       '⏰'),
    w('time', 'zǎoshang', '早上', 'mañana',      '🌄'),
    w('time', 'zhōngwǔ',  '中午', 'mediodía',    '☀️'),
    w('time', 'xiàwǔ',    '下午', 'tarde',       '🌇'),
    w('time', 'wǎnshang', '晚上', 'noche',       '🌙'),
    w('time', 'fēnzhōng', '分钟', 'minuto',      '⏱'),
    w('time', 'xiǎoshí',  '小时', 'hora',        '🕐'),

    // ---- NUMBERS (12) ----
    w('number', 'yī',     '一',  '1',   '1️⃣'),
    w('number', 'èr',     '二',  '2',   '2️⃣'),
    w('number', 'sān',    '三',  '3',   '3️⃣'),
    w('number', 'sì',     '四',  '4',   '4️⃣'),
    w('number', 'wǔ',     '五',  '5',   '5️⃣'),
    w('number', 'liù',    '六',  '6',   '6️⃣'),
    w('number', 'qī',     '七',  '7',   '7️⃣'),
    w('number', 'bā',     '八',  '8',   '8️⃣'),
    w('number', 'jiǔ',    '九',  '9',   '9️⃣'),
    w('number', 'shí',    '十',  '10',  '🔟'),
    w('number', 'bǎi',    '百',  '100', '💯'),
    w('number', 'qiān',   '千',  '1000', '🔢'),

    // ---- QUESTION WORDS (8) ----
    w('question', 'shéi',     '谁',     '¿quién?',     '🙋'),
    w('question', 'shénme',   '什么',   '¿qué?',       '❓'),
    w('question', 'nǎ’er',    '哪儿',   '¿dónde?',     '📍'),
    w('question', 'nǎli',     '哪里',   '¿dónde?',     '📍'),
    w('question', 'jǐ',       '几',     '¿cuánto(s)?', '🔢'),
    w('question', 'duōshǎo',  '多少',   '¿cuánto?',    '📊'),
    w('question', 'zěnme',    '怎么',   '¿cómo?',      '🤔'),
    w('question', 'wèishéme', '为什么', '¿por qué?',   '❔'),

    // ---- PARTICLES (6) ----
    w('particle', 'de',  '的', 'de (poss.)', '🔗'),
    w('particle', 'le',  '了', '(completado)', '✓'),
    w('particle', 'ma',  '吗', '¿?', '❓'),
    w('particle', 'ba',  '吧', 'sugerencia', '💡'),
    w('particle', 'ne',  '呢', '¿y...?', '↩️'),
    w('particle', 'guo', '过', '(ya hecho)', '⏱'),

    // ---- FAMILY (10) ----
    w('family', 'bàba',    '爸爸',  'papá',     '👨'),
    w('family', 'māma',    '妈妈',  'mamá',     '👩'),
    w('family', 'gēge',    '哥哥',  'h. mayor', '🧒'),
    w('family', 'jiějie',  '姐姐',  'h. mayor', '👧'),
    w('family', 'dìdi',    '弟弟',  'h. menor', '👦'),
    w('family', 'mèimei',  '妹妹',  'h. menor', '👧'),
    w('family', 'érzi',    '儿子',  'hijo',     '👦'),
    w('family', 'nǚ’ér',   '女儿',  'hija',     '👧'),
    w('family', 'péngyou', '朋友',  'amigo/a',  '🤝'),
    w('family', 'lǎoshī',  '老师',  'maestro',  '🧑‍🏫'),

    // ---- FOOD / DRINK (10) ----
    w('food', 'mǐfàn',    '米饭',   'arroz',      '🍚'),
    w('food', 'miàntiáo', '面条',   'fideos',     '🍜'),
    w('food', 'shuǐ',     '水',     'agua',       '💧'),
    w('food', 'chá',      '茶',     'té',         '🍵'),
    w('food', 'kāfēi',    '咖啡',   'café',       '☕'),
    w('food', 'niúnǎi',   '牛奶',   'leche',      '🥛'),
    w('food', 'píngguǒ',  '苹果',   'manzana',    '🍎'),
    w('food', 'cài',      '菜',     'comida',     '🥬'),
    w('food', 'jīròu',    '鸡肉',   'pollo',      '🍗'),
    w('food', 'miànbāo',  '面包',   'pan',        '🍞'),

    // ---- ADJECTIVES / DESCRIPTORS (10) ----
    w('adj', 'dà',     '大',   'grande',     '⬆️'),
    w('adj', 'xiǎo',   '小',   'pequeño',    '⬇️'),
    w('adj', 'hǎo',    '好',   'bueno',      '👍'),
    w('adj', 'hěn',    '很',   'muy',        '🔥'),
    w('adj', 'duō',    '多',   'mucho',      '➕'),
    w('adj', 'shǎo',   '少',   'poco',       '➖'),
    w('adj', 'gāo',    '高',   'alto',       '📏'),
    w('adj', 'lěng',   '冷',   'frío',       '🥶'),
    w('adj', 'rè',     '热',   'caliente',   '🥵'),
    w('adj', 'hǎochī', '好吃', 'rico',       '😋'),
  ];

  // Expose globally for host + player code to consume
  window.WU_CATEGORIES = WU_CATEGORIES;
  window.WU_WORDS = WU_WORDS;
  // Build an id→word lookup for fast resolution from server-sent IDs
  window.WU_WORD_BY_ID = WU_WORDS.reduce((m, w) => { m[w.id] = w; return m; }, {});
})();
