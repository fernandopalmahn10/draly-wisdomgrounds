// =========================================================================
// WARM-UP VOCABULARY LIBRARY · HSK1 sentence-builder
// ~150 HSK1 words, organized BY EXPERIENCE (EXP1-EXP8) for filtering,
// but each word ALSO carries a grammatical category for sentence-structure
// color coding. So:
//   - Teacher filters the library by EXP (e.g. "Show me EXP4 - Tiempo")
//   - The stage colors each word by its grammatical role (verb=red, noun=
//     green, etc.) so kids see Spanish word-order mapping at a glance
//
// Each word: { id, exp, cat, pinyin, hanzi, es, icon }
// =========================================================================
(function () {
  // === Grammatical categories (drive sentence-stage colors) ===
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
    noun:     { id: 'noun',     label: 'Sustantivos',  color: '#7bdf7b' },
    greet:    { id: 'greet',    label: 'Saludos',      color: '#f59cb4' },
  };

  // === HSK1 Experiences (filter sections in the library) ===
  const WU_EXPERIENCES = {
    exp1: { id: 'exp1', label: 'EXP1 · Saludos',       short: '👋 EXP1' },
    exp2: { id: 'exp2', label: 'EXP2 · Familia',       short: '👨‍👩‍👧 EXP2' },
    exp3: { id: 'exp3', label: 'EXP3 · Comer / Beber', short: '🍜 EXP3' },
    exp4: { id: 'exp4', label: 'EXP4 · Tiempo / Clima', short: '⏰ EXP4' },
    exp5: { id: 'exp5', label: 'EXP5 · Viajes',        short: '🚗 EXP5' },
    exp6: { id: 'exp6', label: 'EXP6 · Casa',          short: '🏠 EXP6' },
    exp7: { id: 'exp7', label: 'EXP7 · Personas / ¿?', short: '🙋 EXP7' },
    exp8: { id: 'exp8', label: 'EXP8 · Números',       short: '🔢 EXP8' },
  };

  let _nextId = 0;
  function w(exp, cat, pinyin, hanzi, es, icon) {
    return { id: 'w' + (++_nextId), exp, cat, pinyin, hanzi, es, icon: icon || '' };
  }

  const WU_WORDS = [
    // ============================================
    // EXP1 · SALUDOS Y PRESENTACIÓN (18 words)
    // ============================================
    w('exp1', 'greet',    'nǐ hǎo',     '你好',   'hola',         '👋'),
    w('exp1', 'greet',    'zàijiàn',    '再见',   'adiós',        '👋'),
    w('exp1', 'greet',    'xièxie',     '谢谢',   'gracias',      '🙏'),
    w('exp1', 'greet',    'bù kèqi',    '不客气', 'de nada',      '😊'),
    w('exp1', 'greet',    'duìbuqǐ',    '对不起', 'lo siento',    '🙇'),
    w('exp1', 'greet',    'méi guānxi', '没关系', 'no hay de qué','👌'),
    w('exp1', 'pronoun',  'wǒ',         '我',     'yo',           '👤'),
    w('exp1', 'pronoun',  'nǐ',         '你',     'tú',           '👉'),
    w('exp1', 'pronoun',  'tā',         '他',     'él',           '👨'),
    w('exp1', 'pronoun',  'tā',         '她',     'ella',         '👩'),
    w('exp1', 'pronoun',  'wǒmen',      '我们',   'nosotros',     '👥'),
    w('exp1', 'pronoun',  'nǐmen',      '你们',   'ustedes',      '👥'),
    w('exp1', 'pronoun',  'tāmen',      '他们',   'ellos',        '👥'),
    w('exp1', 'verb',     'shì',        '是',     'ser',          '✅'),
    w('exp1', 'verb',     'bù',         '不',     'no',           '❌'),
    w('exp1', 'verb',     'jiào',       '叫',     'llamarse',     '🏷'),
    w('exp1', 'noun',     'míngzi',     '名字',   'nombre',       '🏷'),
    w('exp1', 'particle', 'ma',         '吗',     '¿?',           '❓'),

    // ============================================
    // EXP2 · FAMILIA Y AMIGOS (17 words)
    // ============================================
    w('exp2', 'family',   'bàba',       '爸爸',   'papá',         '👨'),
    w('exp2', 'family',   'māma',       '妈妈',   'mamá',         '👩'),
    w('exp2', 'family',   'gēge',       '哥哥',   'h. mayor',     '🧒'),
    w('exp2', 'family',   'jiějie',     '姐姐',   'h. mayor (f)', '👧'),
    w('exp2', 'family',   'dìdi',       '弟弟',   'h. menor',     '👦'),
    w('exp2', 'family',   'mèimei',     '妹妹',   'h. menor (f)', '👧'),
    w('exp2', 'family',   'érzi',       '儿子',   'hijo',         '👦'),
    w('exp2', 'family',   'nǚ’ér',      '女儿',   'hija',         '👧'),
    w('exp2', 'family',   'yéye',       '爷爷',   'abuelo',       '👴'),
    w('exp2', 'family',   'nǎinai',     '奶奶',   'abuela',       '👵'),
    w('exp2', 'family',   'péngyou',    '朋友',   'amigo/a',      '🤝'),
    w('exp2', 'family',   'lǎoshī',     '老师',   'maestro/a',    '🧑‍🏫'),
    w('exp2', 'family',   'xuésheng',   '学生',   'estudiante',   '🎓'),
    w('exp2', 'verb',     'yǒu',        '有',     'tener',        '🤲'),
    w('exp2', 'verb',     'ài',         '爱',     'amar',         '💕'),
    w('exp2', 'particle', 'de',         '的',     'de (poss.)',   '🔗'),
    w('exp2', 'number',   'gè',         '个',     '(unidad)',     '🔢'),

    // ============================================
    // EXP3 · COMER Y BEBER (17 words)
    // ============================================
    w('exp3', 'verb',     'chī',        '吃',     'comer',        '🍴'),
    w('exp3', 'verb',     'hē',         '喝',     'beber',        '🥤'),
    w('exp3', 'food',     'mǐfàn',      '米饭',   'arroz',        '🍚'),
    w('exp3', 'food',     'miàntiáo',   '面条',   'fideos',       '🍜'),
    w('exp3', 'food',     'shuǐ',       '水',     'agua',         '💧'),
    w('exp3', 'food',     'chá',        '茶',     'té',           '🍵'),
    w('exp3', 'food',     'kāfēi',      '咖啡',   'café',         '☕'),
    w('exp3', 'food',     'niúnǎi',     '牛奶',   'leche',        '🥛'),
    w('exp3', 'food',     'cài',        '菜',     'comida',       '🥬'),
    w('exp3', 'food',     'jīròu',      '鸡肉',   'pollo',        '🍗'),
    w('exp3', 'food',     'yú',         '鱼',     'pescado',      '🐟'),
    w('exp3', 'food',     'jīdàn',      '鸡蛋',   'huevo',        '🥚'),
    w('exp3', 'food',     'miànbāo',    '面包',   'pan',          '🍞'),
    w('exp3', 'food',     'píngguǒ',    '苹果',   'manzana',      '🍎'),
    w('exp3', 'verb',     'xǐhuan',     '喜欢',   'gustar',       '❤️'),
    w('exp3', 'adj',      'hǎochī',     '好吃',   'rico',         '😋'),
    w('exp3', 'adj',      'hǎohē',      '好喝',   'sabroso',      '😋'),

    // ============================================
    // EXP4 · TIEMPO Y CLIMA (18 words)
    // ============================================
    w('exp4', 'time',     'jīntiān',    '今天',   'hoy',          '📅'),
    w('exp4', 'time',     'míngtiān',   '明天',   'mañana',       '🌅'),
    w('exp4', 'time',     'zuótiān',    '昨天',   'ayer',         '⏪'),
    w('exp4', 'time',     'xiànzài',    '现在',   'ahora',        '⏰'),
    w('exp4', 'time',     'zǎoshang',   '早上',   'mañana (am)',  '🌄'),
    w('exp4', 'time',     'shàngwǔ',    '上午',   'antemediodía', '🕘'),
    w('exp4', 'time',     'zhōngwǔ',    '中午',   'mediodía',     '☀️'),
    w('exp4', 'time',     'xiàwǔ',      '下午',   'tarde',        '🌇'),
    w('exp4', 'time',     'wǎnshang',   '晚上',   'noche',        '🌙'),
    w('exp4', 'time',     'diǎn',       '点',     'hora',         '🕐'),
    w('exp4', 'noun',     'yǔ',         '雨',     'lluvia',       '🌧'),
    w('exp4', 'noun',     'xuě',        '雪',     'nieve',        '❄️'),
    w('exp4', 'noun',     'fēng',       '风',     'viento',       '💨'),
    w('exp4', 'noun',     'tàiyáng',    '太阳',   'sol',          '☀️'),
    w('exp4', 'noun',     'yún',        '云',     'nube',         '☁️'),
    w('exp4', 'adj',      'lěng',       '冷',     'frío',         '🥶'),
    w('exp4', 'adj',      'rè',         '热',     'caliente',     '🥵'),
    w('exp4', 'verb',     'xià',        '下',     'caer (lluvia)', '⬇️'),

    // ============================================
    // EXP5 · VIAJES Y DIRECCIONES (18 words)
    // ============================================
    w('exp5', 'verb',     'qù',         '去',     'ir',           '➡️'),
    w('exp5', 'verb',     'lái',        '来',     'venir',        '⬅️'),
    w('exp5', 'verb',     'huí',        '回',     'regresar',     '🔁'),
    w('exp5', 'verb',     'zǒu',        '走',     'caminar',      '🚶'),
    w('exp5', 'verb',     'zài',        '在',     'estar (en)',   '📍'),
    w('exp5', 'adj',      'shàngmiàn',  '上面',   'arriba',       '⬆️'),
    w('exp5', 'adj',      'xiàmiàn',    '下面',   'abajo',        '⬇️'),
    w('exp5', 'adj',      'qiánmiàn',   '前面',   'al frente',    '⏩'),
    w('exp5', 'adj',      'hòumiàn',    '后面',   'atrás',        '⏪'),
    w('exp5', 'adj',      'zuǒbiān',    '左边',   'izquierda',    '◀️'),
    w('exp5', 'adj',      'yòubiān',    '右边',   'derecha',      '▶️'),
    w('exp5', 'noun',     'chē',        '车',     'coche',        '🚗'),
    w('exp5', 'noun',     'huǒchē',     '火车',   'tren',         '🚂'),
    w('exp5', 'noun',     'fēijī',      '飞机',   'avión',        '✈️'),
    w('exp5', 'place',    'yīyuàn',     '医院',   'hospital',     '🏥'),
    w('exp5', 'place',    'xuéxiào',    '学校',   'escuela',      '🏫'),
    w('exp5', 'place',    'shāngdiàn',  '商店',   'tienda',       '🏪'),
    w('exp5', 'place',    'fànguǎn',    '饭馆',   'restaurante',  '🍱'),

    // ============================================
    // EXP6 · CASA Y ACTIVIDADES (18 words)
    // ============================================
    w('exp6', 'place',    'jiā',        '家',     'casa',         '🏠'),
    w('exp6', 'place',    'fángjiān',   '房间',   'habitación',   '🚪'),
    w('exp6', 'noun',     'chuáng',     '床',     'cama',         '🛏'),
    w('exp6', 'noun',     'zhuōzi',     '桌子',   'mesa',         '🪑'),
    w('exp6', 'noun',     'yǐzi',       '椅子',   'silla',        '🪑'),
    w('exp6', 'noun',     'shū',        '书',     'libro',        '📚'),
    w('exp6', 'noun',     'diànshì',    '电视',   'TV',           '📺'),
    w('exp6', 'noun',     'diànnǎo',    '电脑',   'computadora',  '💻'),
    w('exp6', 'noun',     'diànhuà',    '电话',   'teléfono',     '☎️'),
    w('exp6', 'verb',     'kàn',        '看',     'mirar',        '👀'),
    w('exp6', 'verb',     'tīng',       '听',     'escuchar',     '👂'),
    w('exp6', 'verb',     'shuō',       '说',     'decir',        '💬'),
    w('exp6', 'verb',     'xiě',        '写',     'escribir',     '✍️'),
    w('exp6', 'verb',     'dú',         '读',     'leer',         '📖'),
    w('exp6', 'verb',     'xuéxí',      '学习',   'estudiar',     '📚'),
    w('exp6', 'verb',     'gōngzuò',    '工作',   'trabajar',     '💼'),
    w('exp6', 'verb',     'shuìjiào',   '睡觉',   'dormir',       '😴'),
    w('exp6', 'verb',     'mǎi',        '买',     'comprar',      '🛒'),

    // ============================================
    // EXP7 · PERSONAS Y PREGUNTAS (16 words)
    // ============================================
    w('exp7', 'question', 'shéi',       '谁',     '¿quién?',      '🙋'),
    w('exp7', 'question', 'shénme',     '什么',   '¿qué?',        '❓'),
    w('exp7', 'question', 'nǎ’er',      '哪儿',   '¿dónde?',      '📍'),
    w('exp7', 'question', 'nǎli',       '哪里',   '¿dónde?',      '📍'),
    w('exp7', 'question', 'jǐ',         '几',     '¿cuánto(s)?',  '🔢'),
    w('exp7', 'question', 'duōshǎo',    '多少',   '¿cuánto?',     '📊'),
    w('exp7', 'question', 'zěnme',      '怎么',   '¿cómo?',       '🤔'),
    w('exp7', 'question', 'wèishéme',   '为什么', '¿por qué?',    '❔'),
    w('exp7', 'family',   'yīshēng',    '医生',   'doctor',       '🩺'),
    w('exp7', 'noun',     'nán',        '男',     'hombre',       '👨'),
    w('exp7', 'noun',     'nǚ',         '女',     'mujer',        '👩'),
    w('exp7', 'family',   'xiānsheng',  '先生',   'señor',        '👔'),
    w('exp7', 'family',   'xiǎojiě',    '小姐',   'señorita',     '👗'),
    w('exp7', 'family',   'háizi',      '孩子',   'niño',         '👶'),
    w('exp7', 'particle', 'ne',         '呢',     '¿y...?',       '↩️'),
    w('exp7', 'particle', 'ba',         '吧',     'sugerencia',   '💡'),

    // ============================================
    // EXP8 · NÚMEROS Y PARTÍCULAS (20 words)
    // ============================================
    w('exp8', 'number',   'líng',       '零',     '0',            '0️⃣'),
    w('exp8', 'number',   'yī',         '一',     '1',            '1️⃣'),
    w('exp8', 'number',   'èr',         '二',     '2',            '2️⃣'),
    w('exp8', 'number',   'sān',        '三',     '3',            '3️⃣'),
    w('exp8', 'number',   'sì',         '四',     '4',            '4️⃣'),
    w('exp8', 'number',   'wǔ',         '五',     '5',            '5️⃣'),
    w('exp8', 'number',   'liù',        '六',     '6',            '6️⃣'),
    w('exp8', 'number',   'qī',         '七',     '7',            '7️⃣'),
    w('exp8', 'number',   'bā',         '八',     '8',            '8️⃣'),
    w('exp8', 'number',   'jiǔ',        '九',     '9',            '9️⃣'),
    w('exp8', 'number',   'shí',        '十',     '10',           '🔟'),
    w('exp8', 'number',   'bǎi',        '百',     '100',          '💯'),
    w('exp8', 'number',   'qiān',       '千',     '1000',         '🔢'),
    w('exp8', 'particle', 'le',         '了',     '(completado)', '✓'),
    w('exp8', 'particle', 'guo',        '过',     '(ya hecho)',   '⏱'),
    w('exp8', 'particle', 'zhe',        '着',     '(estado)',     '🔄'),
    w('exp8', 'adj',      'hěn',        '很',     'muy',          '🔥'),
    w('exp8', 'adj',      'dà',         '大',     'grande',       '⬆️'),
    w('exp8', 'adj',      'xiǎo',       '小',     'pequeño',      '⬇️'),
    w('exp8', 'adj',      'hǎo',        '好',     'bueno',        '👍'),
  ];

  // Expose globally for host + player code to consume
  window.WU_CATEGORIES = WU_CATEGORIES;
  window.WU_EXPERIENCES = WU_EXPERIENCES;
  window.WU_WORDS = WU_WORDS;
  window.WU_WORD_BY_ID = WU_WORDS.reduce((m, w) => { m[w.id] = w; return m; }, {});
  console.log('[warmup-vocab] loaded', WU_WORDS.length, 'words across',
    Object.keys(WU_EXPERIENCES).length, 'experiences');
})();
