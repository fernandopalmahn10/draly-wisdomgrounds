// =========================================================================
// WARM-UP VOCABULARY LIBRARY · HSK1 sentence-builder
// USER-PROVIDED CANONICAL 150 WORDS, organized by HSK1 experience (EXP1-
// EXP8). The user gave the verbatim list — this file is the source of
// truth. Tile sub-grouping is intentionally dropped per user feedback
// ("disregard the tile, just look at the words and how they were
// classified by experience").
//
// Each word: { id, exp, cat, pinyin, hanzi, es, icon }
//   - exp: 'exp1' through 'exp8' for library filtering
//   - cat: grammatical category for sentence-stage color coding
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
    family:   { id: 'family',   label: 'Personas',     color: '#ef5b95' },
    food:     { id: 'food',     label: 'Comida',       color: '#a07050' },
    adj:      { id: 'adj',      label: 'Adjetivos',    color: '#5bcfef' },
    noun:     { id: 'noun',     label: 'Sustantivos',  color: '#7bdf7b' },
    greet:    { id: 'greet',    label: 'Saludos',      color: '#f59cb4' },
  };

  const WU_EXPERIENCES = {
    exp1: { id: 'exp1', label: 'EXP1 · Yo / Familia',       short: '👋 EXP1' },
    exp2: { id: 'exp2', label: 'EXP2 · Escuela / Idioma',   short: '🎓 EXP2' },
    exp3: { id: 'exp3', label: 'EXP3 · Comprar / Comer',    short: '🍴 EXP3' },
    exp4: { id: 'exp4', label: 'EXP4 · Tiempo / Clima',     short: '⏰ EXP4' },
    exp5: { id: 'exp5', label: 'EXP5 · Viajes / Lugares',   short: '✈️ EXP5' },
    exp6: { id: 'exp6', label: 'EXP6 · Casa / Actividades', short: '🏠 EXP6' },
    exp7: { id: 'exp7', label: 'EXP7 · Personas / ¿?',      short: '🙋 EXP7' },
    exp8: { id: 'exp8', label: 'EXP8 · Números / Partículas', short: '🔢 EXP8' },
  };

  let _n = 0;
  function w(exp, cat, pinyin, hanzi, es, icon) {
    return { id: 'w' + (++_n), exp, cat, pinyin, hanzi, es, icon: icon || '' };
  }

  const WU_WORDS = [
    // ============================================
    // EXP1 · YO / FAMILIA (20 words)
    // ============================================
    w('exp1', 'pronoun',  'wǒ',       '我',    'yo',                  '👤'),
    w('exp1', 'pronoun',  'nǐ',       '你',    'tú',                  '👉'),
    w('exp1', 'pronoun',  'tā',       '他',    'él',                  '👨'),
    w('exp1', 'pronoun',  'tā',       '她',    'ella',                '👩'),
    w('exp1', 'pronoun',  'wǒmen',    '我们',  'nosotros',            '👥'),
    w('exp1', 'family',   'bàba',     '爸爸',  'papá',                '👨‍🦱'),
    w('exp1', 'family',   'māma',     '妈妈',  'mamá',                '👩‍🦱'),
    w('exp1', 'family',   'érzi',     '儿子',  'hijo',                '👦'),
    w('exp1', 'family',   'nǚ’ér',    '女儿',  'hija',                '👧'),
    w('exp1', 'family',   'péngyou',  '朋友',  'amigo/a',             '🤝'),
    w('exp1', 'place',    'jiā',      '家',    'casa / familia',      '🏠'),
    w('exp1', 'verb',     'ài',       '爱',    'amar',                '💕'),
    w('exp1', 'noun',     'gǒu',      '狗',    'perro',               '🐕'),
    w('exp1', 'noun',     'māo',      '猫',    'gato',                '🐱'),
    w('exp1', 'verb',     'jiào',     '叫',    'llamarse',            '🏷'),
    w('exp1', 'noun',     'míngzi',   '名字',  'nombre',              '📛'),
    w('exp1', 'verb',     'shì',      '是',    'ser',                 '✅'),
    w('exp1', 'particle', 'de',       '的',    'de (posesivo)',       '🔗'),
    w('exp1', 'verb',     'rènshi',   '认识',  'conocer',             '🤝'),
    w('exp1', 'noun',     'suì',      '岁',    'años (edad)',         '🎂'),

    // ============================================
    // EXP2 · ESCUELA / IDIOMA (18 words)
    // ============================================
    w('exp2', 'place',    'xuéxiào',  '学校',  'escuela',             '🏫'),
    w('exp2', 'family',   'xuésheng', '学生',  'estudiante',          '🎓'),
    w('exp2', 'family',   'lǎoshī',   '老师',  'maestro/a',           '🧑‍🏫'),
    w('exp2', 'family',   'tóngxué',  '同学',  'compañero',           '👬'),
    w('exp2', 'verb',     'xuéxí',    '学习',  'estudiar',            '📚'),
    w('exp2', 'verb',     'dú',       '读',    'leer',                '📖'),
    w('exp2', 'verb',     'xiě',      '写',    'escribir',            '✍️'),
    w('exp2', 'noun',     'shū',      '书',    'libro',               '📕'),
    w('exp2', 'number',   'běn',      '本',    'mw (libros)',         '📒'),
    w('exp2', 'noun',     'zì',       '字',    'carácter',            '🔤'),
    w('exp2', 'noun',     'hànyǔ',    '汉语',  'chino mandarín',      '🇨🇳'),
    w('exp2', 'verb',     'shuō',     '说',    'hablar',              '💬'),
    w('exp2', 'verb',     'tīng',     '听',    'escuchar',            '👂'),
    w('exp2', 'verb',     'kàn',      '看',    'mirar',               '👀'),
    w('exp2', 'verb',     'kànjiàn',  '看见',  'ver',                 '👁'),
    w('exp2', 'verb',     'huì',      '会',    'poder / saber',       '💪'),
    w('exp2', 'verb',     'néng',     '能',    'poder (capacidad)',   '💪'),
    w('exp2', 'family',   'xiānsheng','先生',  'señor',               '👔'),

    // ============================================
    // EXP3 · COMPRAR / COMER (22 words)
    // ============================================
    w('exp3', 'verb',     'mǎi',      '买',    'comprar',             '🛒'),
    w('exp3', 'noun',     'dōngxi',   '东西',  'cosa / objeto',       '📦'),
    w('exp3', 'place',    'shāngdiàn','商店',  'tienda',              '🏪'),
    w('exp3', 'place',    'fàndiàn',  '饭店',  'restaurante',         '🍱'),
    w('exp3', 'noun',     'qián',     '钱',    'dinero',              '💰'),
    w('exp3', 'number',   'kuài',     '块',    'yuan',                '💵'),
    w('exp3', 'question', 'duōshǎo',  '多少',  '¿cuánto?',            '📊'),
    w('exp3', 'food',     'cài',      '菜',    'comida',              '🥬'),
    w('exp3', 'food',     'mǐfàn',    '米饭',  'arroz',               '🍚'),
    w('exp3', 'food',     'chá',      '茶',    'té',                  '🍵'),
    w('exp3', 'food',     'shuǐ',     '水',    'agua',                '💧'),
    w('exp3', 'food',     'shuǐguǒ',  '水果',  'fruta',               '🍓'),
    w('exp3', 'food',     'píngguǒ',  '苹果',  'manzana',             '🍎'),
    w('exp3', 'noun',     'bēizi',    '杯子',  'taza',                '🥤'),
    w('exp3', 'verb',     'chī',      '吃',    'comer',               '🍴'),
    w('exp3', 'verb',     'hē',       '喝',    'beber',               '🥤'),
    w('exp3', 'verb',     'xǐhuan',   '喜欢',  'gustar',              '❤️'),
    w('exp3', 'verb',     'xiǎng',    '想',    'querer / pensar',     '💭'),
    w('exp3', 'greet',    'qǐng',     '请',    'por favor',           '🙏'),
    w('exp3', 'greet',    'xièxie',   '谢谢',  'gracias',             '🙇'),
    w('exp3', 'greet',    'búkèqi',   '不客气','de nada',             '😊'),
    w('exp3', 'adj',      'hǎo',      '好',    'bueno',               '👍'),

    // ============================================
    // EXP4 · TIEMPO / CLIMA (20 words)
    // ============================================
    w('exp4', 'time',     'diǎn',     '点',    'hora (en punto)',     '🕐'),
    w('exp4', 'time',     'fēnzhōng', '分钟',  'minuto',              '⏱'),
    w('exp4', 'time',     'xiànzài',  '现在',  'ahora',               '⏰'),
    w('exp4', 'time',     'shíhou',   '时候',  'momento',             '🕰'),
    w('exp4', 'time',     'jīntiān',  '今天',  'hoy',                 '📅'),
    w('exp4', 'time',     'míngtiān', '明天',  'mañana',              '🌅'),
    w('exp4', 'time',     'zuótiān',  '昨天',  'ayer',                '⏪'),
    w('exp4', 'time',     'shàngwǔ',  '上午',  'antemediodía',        '🌄'),
    w('exp4', 'time',     'zhōngwǔ',  '中午',  'mediodía',            '☀️'),
    w('exp4', 'time',     'xiàwǔ',    '下午',  'tarde',               '🌇'),
    w('exp4', 'time',     'xīngqī',   '星期',  'semana',              '📆'),
    w('exp4', 'time',     'yuè',      '月',    'mes',                 '🌙'),
    w('exp4', 'time',     'nián',     '年',    'año',                 '🎊'),
    w('exp4', 'time',     'hào',      '号',    'día del mes',         '🔢'),
    w('exp4', 'noun',     'tiānqì',   '天气',  'clima',               '🌤'),
    w('exp4', 'adj',      'rè',       '热',    'caliente',            '🥵'),
    w('exp4', 'adj',      'lěng',     '冷',    'frío',                '🥶'),
    w('exp4', 'verb',     'xiàyǔ',    '下雨',  'llover',              '🌧'),
    w('exp4', 'adj',      'tài',      '太',    'demasiado',           '🔝'),
    w('exp4', 'adj',      'hěn',      '很',    'muy',                 '🔥'),

    // ============================================
    // EXP5 · VIAJES / LUGARES (18 words)
    // ============================================
    w('exp5', 'place',    'běijīng',  '北京',  'Beijing',             '🏯'),
    w('exp5', 'place',    'zhōngguó', '中国',  'China',               '🇨🇳'),
    w('exp5', 'verb',     'qù',       '去',    'ir',                  '➡️'),
    w('exp5', 'verb',     'lái',      '来',    'venir',               '⬅️'),
    w('exp5', 'verb',     'huí',      '回',    'regresar',            '🔁'),
    w('exp5', 'noun',     'fēijī',    '飞机',  'avión',               '✈️'),
    w('exp5', 'noun',     'chūzūchē', '出租车','taxi',                '🚕'),
    w('exp5', 'verb',     'zuò',      '坐',    'sentarse / tomar',    '🪑'),
    w('exp5', 'verb',     'zhù',      '住',    'vivir',               '🏠'),
    w('exp5', 'verb',     'zài',      '在',    'en / estar',          '📍'),
    w('exp5', 'question', 'nǎ',       '哪',    '¿cuál?',              '❓'),
    w('exp5', 'question', 'nǎr',      '哪儿',  '¿dónde?',             '📍'),
    w('exp5', 'pronoun',  'nà',       '那',    'eso / ese',           '👉'),
    w('exp5', 'pronoun',  'zhè',      '这',    'esto / este',         '👇'),
    w('exp5', 'adj',      'qiánmiàn', '前面',  'al frente',           '⏩'),
    w('exp5', 'adj',      'hòumiàn',  '后面',  'atrás',               '⏪'),
    w('exp5', 'adj',      'shàng',    '上',    'arriba / encima',     '⬆️'),
    w('exp5', 'adj',      'xià',      '下',    'abajo',               '⬇️'),

    // ============================================
    // EXP6 · CASA / ACTIVIDADES (18 words)
    // ============================================
    w('exp6', 'adj',      'lǐ',       '里',    'dentro',              '📥'),
    w('exp6', 'noun',     'zhuōzi',   '桌子',  'mesa',                '🪑'),
    w('exp6', 'noun',     'yǐzi',     '椅子',  'silla',               '💺'),
    w('exp6', 'noun',     'diànnǎo',  '电脑',  'computadora',         '💻'),
    w('exp6', 'noun',     'diànshì',  '电视',  'televisión',          '📺'),
    w('exp6', 'noun',     'diànyǐng', '电影',  'película',            '🎬'),
    w('exp6', 'noun',     'yīfu',     '衣服',  'ropa',                '👔'),
    w('exp6', 'verb',     'kāi',      '开',    'abrir / encender',    '🔓'),
    w('exp6', 'verb',     'shuìjiào', '睡觉',  'dormir',              '😴'),
    w('exp6', 'verb',     'zuò',      '做',    'hacer',               '🛠'),
    w('exp6', 'verb',     'gōngzuò',  '工作',  'trabajar',            '💼'),
    w('exp6', 'verb',     'dǎdiànhuà','打电话','llamar (teléfono)',   '📞'),
    w('exp6', 'greet',    'wèi',      '喂',    'aló',                 '☎️'),
    w('exp6', 'adj',      'piàoliang','漂亮',  'bonito/a',            '🌸'),
    w('exp6', 'adj',      'dà',       '大',    'grande',              '🔼'),
    w('exp6', 'adj',      'xiǎo',     '小',    'pequeño',             '🔽'),
    w('exp6', 'verb',     'yǒu',      '有',    'tener',               '🤲'),
    w('exp6', 'verb',     'méiyǒu',   '没有',  'no tener',            '🚫'),

    // ============================================
    // EXP7 · PERSONAS / PREGUNTAS (16 words)
    // ============================================
    w('exp7', 'noun',     'rén',      '人',    'persona',             '🧍'),
    w('exp7', 'family',   'yīshēng',  '医生',  'doctor',              '🩺'),
    w('exp7', 'place',    'yīyuàn',   '医院',  'hospital',            '🏥'),
    w('exp7', 'family',   'xiǎojiě',  '小姐',  'señorita',            '👗'),
    w('exp7', 'number',   'xiē',      '些',    'algunos',             '➕'),
    w('exp7', 'adj',      'duō',      '多',    'muchos',              '➕'),
    w('exp7', 'adj',      'shǎo',     '少',    'pocos',               '➖'),
    w('exp7', 'number',   'gè',       '个',    'mw (general)',        '🔢'),
    w('exp7', 'question', 'shéi',     '谁',    '¿quién?',             '🙋'),
    w('exp7', 'question', 'shénme',   '什么',  '¿qué?',               '❓'),
    w('exp7', 'question', 'zěnme',    '怎么',  '¿cómo?',              '🤔'),
    w('exp7', 'question', 'zěnmeyàng','怎么样','¿qué tal?',           '❔'),
    w('exp7', 'question', 'jǐ',       '几',    '¿cuántos?',           '🔢'),
    w('exp7', 'adj',      'dōu',      '都',    'todos',               '🌐'),
    w('exp7', 'adj',      'gāoxìng',  '高兴',  'feliz / contento',    '😄'),
    w('exp7', 'greet',    'duìbuqǐ',  '对不起','lo siento',           '🙇'),

    // ============================================
    // EXP8 · NÚMEROS / PARTÍCULAS (18 words)
    // ============================================
    w('exp8', 'number',   'yī',       '一',    '1',                   '1️⃣'),
    w('exp8', 'number',   'èr',       '二',    '2',                   '2️⃣'),
    w('exp8', 'number',   'sān',      '三',    '3',                   '3️⃣'),
    w('exp8', 'number',   'sì',       '四',    '4',                   '4️⃣'),
    w('exp8', 'number',   'wǔ',       '五',    '5',                   '5️⃣'),
    w('exp8', 'number',   'liù',      '六',    '6',                   '6️⃣'),
    w('exp8', 'number',   'qī',       '七',    '7',                   '7️⃣'),
    w('exp8', 'number',   'bā',       '八',    '8',                   '8️⃣'),
    w('exp8', 'number',   'jiǔ',      '九',    '9',                   '9️⃣'),
    w('exp8', 'number',   'shí',      '十',    '10',                  '🔟'),
    w('exp8', 'adj',      'yīdiǎnr',  '一点儿','un poquito',          '🤏'),
    w('exp8', 'particle', 'bù',       '不',    'no',                  '❌'),
    w('exp8', 'particle', 'ma',       '吗',    '¿? (sí/no)',          '❓'),
    w('exp8', 'particle', 'ne',       '呢',    '¿y tú?',              '↩️'),
    w('exp8', 'particle', 'le',       '了',    '(completado)',        '✓'),
    w('exp8', 'particle', 'hé',       '和',    'y',                   '➕'),
    w('exp8', 'greet',    'zàijiàn',  '再见',  'adiós',               '👋'),
    w('exp8', 'greet',    'méiguānxi','没关系','no importa',          '👌'),

    // ============================================
    // 🆕 2026-06-07 (Fernando): missing HSK1 building blocks. These
    // single-character / 2-char words appear ALL OVER kid sentences
    // (jīnnián this year, dàxuéshēng college student, tīngjiàn to hear,
    // nǎge which one, māmamen mothers, zhème gāoxìng so happy, zhèr/nàr
    // here/there). They were missing from the curated 150 because they
    // mostly live inside compound words. Appended at the END so existing
    // word IDs w1..w150 don't shift — that would break every saved kid
    // sentence and every preset/pack pointing at those ids.
    // ============================================
    // EXP4 · Tiempo — 今 ("current/now", the missing half of 今年/今天)
    w('exp4', 'time',     'jīn',      '今',    'este / actual',       '📅'),
    // EXP2 · Escuela — bare 学 (study), 见 (perceive/see, resultative
    // complement that turns 听 → 听见, 看 → 看见)
    w('exp2', 'verb',     'xué',      '学',    'estudiar / aprender', '📚'),
    w('exp2', 'verb',     'jiàn',     '见',    'ver / percibir',      '👀'),
    // EXP7 · Personas — 生 (born/life/student-suffix), 哪 (which), 哪个 (which one)
    w('exp7', 'noun',     'shēng',    '生',    'vida / nacer',        '🌱'),
    w('exp7', 'question', 'nǎ',       '哪',    'cuál / qué',          '❓'),
    w('exp7', 'question', 'nǎge',     '哪个',  'cuál (uno)',          '❓'),
    // EXP5 · Lugares — 这儿 (here), 那儿 (there)
    w('exp5', 'place',    'zhèr',     '这儿',  'aquí',                '📍'),
    w('exp5', 'place',    'nàr',      '那儿',  'allí',                '📌'),
    // EXP8 · Partículas — 们 (plural marker: tā→tāmen, māma→māmamen),
    // 这么 (so/such, degree adverb: 这么高兴 so happy),
    // 那么 (the distal pair: in that way / so)
    w('exp8', 'particle', 'men',      '们',    '(plural)',            '👥'),
    w('exp8', 'particle', 'zhème',    '这么',  'tan / así de',        '〽️'),
    w('exp8', 'particle', 'nàme',     '那么',  'tan / así',           '〽️'),
    // 🆕 2026-06-08 (Fernando): 没 méi — the negation for 有 (have).
    // "I don't have" = 我没有 (wǒ méi yǒu). Distinct from 不 (bù) which
    // negates verbs/adjectives. Appended at end so id stays new (w162).
    w('exp8', 'particle', 'méi',      '没',    'no (no tener)',       '🚫'),
  ];

  window.WU_CATEGORIES = WU_CATEGORIES;
  window.WU_EXPERIENCES = WU_EXPERIENCES;
  window.WU_WORDS = WU_WORDS;
  window.WU_WORD_BY_ID = WU_WORDS.reduce((m, w) => { m[w.id] = w; return m; }, {});
  // Reading-mode Modo Curioso uses this map to look up a word by the
  // pinyin string itself (since reading-story uses raw pinyin tokens
  // with no id). We normalize by lowercasing the first char so
  // "Jīntiān" (sentence-start) matches "jīntiān" in the dictionary.
  // ALSO build an apostrophe-aware variant — "shi'er" should match
  // "shíèr" if the dictionary has it under "shí'èr" or "shièr".
  window.WU_WORD_BY_PINYIN = WU_WORDS.reduce((m, w) => {
    const key = String(w.pinyin || '').toLowerCase();
    if (key) m[key] = w;
    return m;
  }, {});
  // Helper: normalize a tapped pinyin token (lowercase, strip leading
  // capital + trailing punctuation) and look it up.
  window.lookupWuPinyin = function (raw) {
    if (!raw) return null;
    const cleaned = String(raw)
      .toLowerCase()
      .replace(/^["'¡¿]+/, '')          // strip opening punctuation
      .replace(/[.,!?:;"')\]}]+$/, '')   // strip trailing punctuation
      .trim();
    if (!cleaned) return null;
    return window.WU_WORD_BY_PINYIN[cleaned] || null;
  };
  // ── Picture-mode source resolver. Maps a word to its illustration URL.
  // EXP1 uses the LA FAMILIA E-1 folder where files are named by tone-stripped
  // pinyin (e.g. nǚ'ér → "nu er.png"). Other EXPs fall back to the legacy
  // /assets/warmup/{id}.png convention.
  function _stripPinyin(s) {
    return String(s || '').toLowerCase()
      .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
      .replace(/[ōóǒò]/g, 'o').replace(/[ūúǔùǖǘǚǜü]/g, 'u').replace(/[ńň]/g, 'n')
      .replace(/['ʼ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const EXP_PIC_DIR = {
    exp1: '/assets/png-library/LA FAMILIA E-1',
    // Add other EXP folders here as the user drops them in.
  };
  window.wuPicSrc = function (w) {
    if (!w) return '';
    const dir = EXP_PIC_DIR[w.exp];
    if (dir) return dir + '/' + encodeURIComponent(_stripPinyin(w.pinyin)) + '.png';
    return '/assets/warmup/' + w.id + '.png';
  };
  console.log('[warmup-vocab] loaded', WU_WORDS.length, 'HSK1 words across',
    Object.keys(WU_EXPERIENCES).length, 'experiences');
})();
