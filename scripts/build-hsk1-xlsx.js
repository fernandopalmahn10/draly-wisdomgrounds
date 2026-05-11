// One-shot script: writes an .xlsx file for the HSK 1 Market Vocabulary set
// with tone marks (ǎ, ē, ī, ǒ, ù, etc.) intact in both questions and answers.
// Spanish translations, Pinyin always shown with diacritics.

const XLSX = require('xlsx');
const path = require('path');

const header = ['question', 'correct', 'wrong1', 'wrong2', 'wrong3'];

// All 22 HSK 1 market vocabulary words.
// Format: "¿Qué significa 汉字 (pīnyīn)?" → Spanish translation
const rows = [
  // === Definition questions (Hanzi + pinyin → meaning) ===
  ['¿Qué significa 买 (mǎi)?',           'comprar',          'vender',           'dar',              'tomar'],
  ['¿Qué significa 东西 (dōngxi)?',      'cosa/objeto',      'este',             'dirección',        'mercancía'],
  ['¿Qué significa 商店 (shāngdiàn)?',   'tienda',           'escuela',          'restaurante',      'banco'],
  ['¿Qué significa 饭店 (fàndiàn)?',     'restaurante',      'hotel',            'tienda',           'cocina'],
  ['¿Qué significa 钱 (qián)?',          'dinero',           'moneda',           'cartera',          'precio'],
  ['¿Qué significa 块 (kuài)?',          'yuan (moneda)',    'bloque',           'pieza',            'rápido'],
  ['¿Qué significa 多少 (duōshǎo)?',     'cuánto/cuántos',   'muchos',           'pocos',            'precio'],
  ['¿Qué significa 菜 (cài)?',           'comida/plato',     'verdura',          'carne',            'plato'],
  ['¿Qué significa 米饭 (mǐfàn)?',       'arroz',            'fideos',           'pan',              'sopa'],
  ['¿Qué significa 茶 (chá)?',           'té',               'agua',             'café',             'leche'],
  ['¿Qué significa 水 (shuǐ)?',          'agua',             'té',               'sopa',             'jugo'],
  ['¿Qué significa 水果 (shuǐguǒ)?',     'fruta',            'verdura',          'dulce',            'merienda'],
  ['¿Qué significa 苹果 (píngguǒ)?',     'manzana',          'naranja',          'plátano',          'uva'],
  ['¿Qué significa 杯子 (bēizi)?',       'vaso/taza',        'plato',            'tazón',            'botella'],
  ['¿Qué significa 吃 (chī)?',           'comer',            'beber',            'cocinar',          'saborear'],
  ['¿Qué significa 喝 (hē)?',            'beber',            'comer',            'verter',           'tragar'],
  ['¿Qué significa 喜欢 (xǐhuan)?',      'gustar',           'amar',             'querer',           'necesitar'],
  ['¿Qué significa 想 (xiǎng)?',         'querer/pensar',    'saber',            'sentir',           'recordar'],
  ['¿Qué significa 请 (qǐng)?',          'por favor',        'lo siento',        'perdón',           'gracias'],
  ['¿Qué significa 谢谢 (xièxie)?',      'gracias',          'de nada',          'por favor',        'adiós'],
  ['¿Qué significa 不客气 (búkèqi)?',    'de nada',          'no hay problema',  'no te preocupes',  'lo siento'],
  ['¿Qué significa 好 (hǎo)?',           'bueno',            'malo',             'vale',             'bien'],

  // === Reverse: Spanish → Chinese (with pinyin including tones) ===
  ['¿Cómo se dice "comprar" en chino?',    '买 (mǎi)',        '卖 (mài)',         '给 (gěi)',         '要 (yào)'],
  ['¿Cómo se dice "dinero" en chino?',     '钱 (qián)',       '块 (kuài)',        '元 (yuán)',        '币 (bì)'],
  ['¿Cómo se dice "agua" en chino?',       '水 (shuǐ)',       '茶 (chá)',         '汤 (tāng)',        '果汁 (guǒzhī)'],
  ['¿Cómo se dice "manzana" en chino?',    '苹果 (píngguǒ)',  '香蕉 (xiāngjiāo)', '橙子 (chéngzi)',  '葡萄 (pútáo)'],
  ['¿Cómo se dice "comer" en chino?',      '吃 (chī)',        '喝 (hē)',          '做 (zuò)',         '煮 (zhǔ)'],
  ['¿Cómo se dice "gracias" en chino?',    '谢谢 (xièxie)',   '你好 (nǐhǎo)',     '再见 (zàijiàn)',   '对不起 (duìbuqǐ)'],
  ['¿Cómo se dice "tienda" en chino?',     '商店 (shāngdiàn)', '饭店 (fàndiàn)',   '学校 (xuéxiào)',   '家 (jiā)'],
  ['¿Cómo se dice "arroz" en chino?',      '米饭 (mǐfàn)',    '面条 (miàntiáo)',  '包子 (bāozi)',     '饺子 (jiǎozi)'],
  ['¿Cómo se dice "té" en chino?',         '茶 (chá)',        '咖啡 (kāfēi)',     '牛奶 (niúnǎi)',    '果汁 (guǒzhī)'],
  ['¿Cómo se dice "fruta" en chino?',      '水果 (shuǐguǒ)',  '蔬菜 (shūcài)',    '零食 (língshí)',   '甜点 (tiándiǎn)'],
  ['¿Cómo se dice "vaso" en chino?',       '杯子 (bēizi)',    '盘子 (pánzi)',     '碗 (wǎn)',         '瓶子 (píngzi)'],
  ['¿Cómo se dice "comida/plato" en chino?', '菜 (cài)',      '饭 (fàn)',         '肉 (ròu)',         '汤 (tāng)'],
  ['¿Cómo se dice "restaurante" en chino?', '饭店 (fàndiàn)', '商店 (shāngdiàn)', '酒店 (jiǔdiàn)',   '咖啡店 (kāfēidiàn)'],
  ['¿Cómo se dice "por favor" en chino?',   '请 (qǐng)',      '好 (hǎo)',         '不 (bù)',          '要 (yào)'],
  ['¿Cómo se dice "bueno" en chino?',       '好 (hǎo)',       '坏 (huài)',        '大 (dà)',          '小 (xiǎo)'],

  // === Contextual / market situation questions ===
  ['En el mercado, ¿qué dices para preguntar el precio?',         '多少钱? (duōshǎo qián?)', '你好 (nǐhǎo)',        '谢谢 (xièxie)',     '再见 (zàijiàn)'],
  ['Cuando alguien te dice 谢谢 (gracias), ¿cuál es la respuesta correcta?', '不客气 (búkèqi)', '你好 (nǐhǎo)',        '谢谢 (xièxie)',     '好 (hǎo)'],
  ['¿Cuál es la frase correcta para decir "quiero comprar"?',     '我想买 (wǒ xiǎng mǎi)',   '我喜欢 (wǒ xǐhuan)', '我有 (wǒ yǒu)',     '我吃 (wǒ chī)'],
  ['¿Cuál es una fruta?',                                          '苹果 (píngguǒ)',          '茶 (chá)',           '米饭 (mǐfàn)',       '杯子 (bēizi)'],
  ['¿Cuál es algo que se bebe?',                                   '水 (shuǐ)',               '菜 (cài)',           '钱 (qián)',         '东西 (dōngxi)'],
  ['En un restaurante, ¿qué pides para beber?',                    '茶 (chá)',                '钱 (qián)',          '好 (hǎo)',          '菜 (cài)'],
  ['¿Cuál es la palabra para "yuan" (la moneda china)?',           '块 (kuài)',               '钱 (qián)',          '多 (duō)',          '好 (hǎo)'],
  ['¿Qué dices al pedir algo amablemente?',                        '请 (qǐng)',               '好 (hǎo)',           '不 (bù)',           '要 (yào)'],
  ['¿Qué dices al despedirte?',                                    '再见 (zàijiàn)',          '你好 (nǐhǎo)',       '谢谢 (xièxie)',     '好 (hǎo)'],
  ['¿Cómo dices "yo tengo dinero" en chino?',                      '我有钱 (wǒ yǒu qián)',    '我想买 (wǒ xiǎng mǎi)', '我喜欢 (wǒ xǐhuan)', '我好 (wǒ hǎo)'],
  ['Si tienes sed, ¿qué dices que quieres hacer?',                 '喝 (hē)',                 '吃 (chī)',           '买 (mǎi)',          '想 (xiǎng)']
];

const sheetData = [header, ...rows];
const ws = XLSX.utils.aoa_to_sheet(sheetData);

// Set column widths so the spreadsheet is readable when you open it in Excel
ws['!cols'] = [
  { wch: 60 }, // question
  { wch: 22 }, // correct
  { wch: 22 }, // wrong1
  { wch: 22 }, // wrong2
  { wch: 22 }  // wrong3
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'HSK1 Market');

const outPath = path.join(__dirname, '..', 'data', 'sets', 'hsk1-market-pinyin-spanish.xlsx');
XLSX.writeFile(wb, outPath);

console.log('Wrote', rows.length, 'questions →', outPath);
