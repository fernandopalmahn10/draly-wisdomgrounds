// YCT 1 question packs (2026-10-11 rebuild). Source: the official YCT 1 word list (83 words) and the mother file
// «YCT1 · Simulaciones 1–5 (175 preguntas)» (Downloads\IMPORTANT DOCUMENTS\CURRICULUM STRUCTURE\YCT\YCT 1).
// Worlds follow «YCT 1 — Plan de Mundos Roblox». Game rule: pinyin WITHOUT tone marks, no hanzi, Spanish UI,
// every question says exactly what it asks (never a bare picture with "¿Quién es?").
//
// Round kinds (built by core/packs.js):
//   words: [{ py, es, img?, gram? }]  → «¿Cómo se dice «es» en Chino Mandarín?» (+ its picture) and «¿Qué significa «py»?»
//                                       gram: grammar word, only asked inside sentences (fill-in items)
//   items: exam-style questions, in order:
//     { k:'w', py }            the word's meaning (looked up in this level's word list)
//     { k:'m', py, es }        what a phrase / sentence means (wrong options = other sentences of the round)
//     { k:'r', a, b }          someone says «a» → best reply «b» (wrong options = other replies of the round)
//     { k:'f', s, a, bank }    fill the blank ___ in «s» with «a» (wrong options from the exam's word bank)
//     { k:'q', t, a, w, img? } fully written question
// img: file name in public/assets/packs/yct1/<world>/<img>.webp (shown only once the picture exists). Time words
// (hoy, mañana, mes, semana, ahora, la hora) have none on purpose: a clock or calendar needs digits/text.
// Picture brief for Higgsfield: content/packs/yct1-pictures.json.
'use strict';

// hanzi of every word (2026-10-12), keyed «py|es» (ta, he, shi, hao, na, nar have two words). NEVER shown in a game
// question (core/packs.js only asks py / es): it feeds the parents' word list in /homework and its 🔊 (the voice reads
// hanzi; toneless pinyin comes out letter by letter).
const HZ = {
  'baba|papá': '爸爸', 'mama|mamá': '妈妈', 'gege|hermano mayor': '哥哥', 'jiejie|hermana mayor': '姐姐',
  'women|nosotros': '我们', 'jia|casa / familia': '家', 'you|tener': '有', 'ai|amar': '爱', 'he|y': '和', 'wo|yo': '我',
  'ni|tú': '你', 'ta|él': '他', 'ta|ella': '她', 'jiao|llamarse': '叫', 'renshi|conocer (a alguien)': '认识',
  'shei|¿quién?': '谁', 'de|de (mi, tu, su…)': '的',
  'bizi|nariz': '鼻子', 'erduo|orejas': '耳朵', 'kou|boca': '口', 'shou|mano': '手', 'toufa|cabello': '头发',
  'yanjing|ojos': '眼睛', 'chang|largo': '长', 'gao|alto': '高', 'gezi|estatura': '个子', 'da|grande': '大',
  'xiao|pequeño': '小', 'hen|muy': '很',
  'gou|perro': '狗', 'mao|gato': '猫', 'niao|pájaro': '鸟', 'yu|pez': '鱼', 'xihuan|gustar': '喜欢', 'kan|mirar / ver': '看',
  'zhe|este / esto': '这', 'na|ese / eso': '那',
  'chi|comer': '吃', 'he|beber': '喝', 'mifan|arroz': '米饭', 'miantiao|fideos': '面条', 'niunai|leche': '牛奶',
  'pingguo|manzana': '苹果', 'shui|agua': '水', 'shangdian|tienda': '商店',
  'yi|uno': '一', 'er|dos': '二', 'san|tres': '三', 'si|cuatro': '四', 'wu|cinco': '五', 'liu|seis': '六', 'qi|siete': '七',
  'ba|ocho': '八', 'jiu|nueve': '九', 'shi|diez': '十', 'dian|en punto (la hora)': '点', 'hao|día del mes': '号',
  'yue|mes': '月', 'xingqi|semana': '星期', 'jintian|hoy': '今天', 'mingtian|mañana': '明天', 'xianzai|ahora': '现在',
  'sui|años (de edad)': '岁', 'ji|¿cuántos?': '几', 'ge|medida para cosas y personas': '个',
  'hao|bueno / bien': '好', 'xiexie|gracias': '谢谢', 'zaijian|adiós': '再见', 'gaoxing|feliz': '高兴',
  'laoshi|maestro / maestra': '老师', 'xuexiao|escuela': '学校', 'Zhongguoren|persona china': '中国人', 'bu|no': '不',
  'shi|ser / es': '是', 'shenme|¿qué?': '什么', 'na|¿cuál?': '哪', 'nar|¿dónde?': '哪儿', 'zher|aquí': '这儿',
  'nar|allá': '那儿', 'qu|ir': '去', 'zai|estar en': '在', 'duo|mucho / muchos': '多', 'ma|¿…? (pregunta de sí o no)': '吗',
};
const W = (py, es, img, extra) => Object.assign({ py, es, img, hz: HZ[py + '|' + es] }, extra || {});
const G = (py, es) => ({ py, es, gram: true, hz: HZ[py + '|' + es] });

module.exports = {
  id: 'yct1',
  name: 'YCT 1',
  dir: 'yct1',
  worlds: [
    {
      id: 'familia', name: 'Mi Familia', emoji: '👨‍👩‍👧',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'papá, mamá, hermanos, casa',
          words: [
            W('baba', 'papá', 'baba'), W('mama', 'mamá', 'mama'), W('gege', 'hermano mayor', 'gege'),
            W('jiejie', 'hermana mayor', 'jiejie'), W('women', 'nosotros', 'women'), W('jia', 'casa / familia', 'jia'),
            W('you', 'tener', 'you'), W('ai', 'amar', 'ai'), W('he', 'y', null, { gram: true }),
          ],
          items: [
            { k: 'm', py: 'Baba he mama', es: 'papá y mamá' },
            { k: 'm', py: 'Wo jia you liu kou ren.', es: 'En mi familia somos seis.' },
            { k: 'm', py: 'Kan, zhe shi women yi jia ren.', es: 'Mira, esta es nuestra familia.' },
            { k: 'f', s: 'Wo ___ jiejie.', a: 'he', bank: ['de', 'ma', 'shi', 'hen'], t: 'Completa: «Yo y mi hermana mayor» = «Wo ___ jiejie.»' },
          ],
        },
        {
          id: 'r2', name: 'Ronda 2', blurb: 'yo, tú, él, ella, ¿quién?, llamarse',
          words: [
            W('wo', 'yo', 'wo'), W('ni', 'tú', 'ni'), W('ta', 'él', 'ta-el'), W('ta', 'ella', 'ta-ella'),
            W('jiao', 'llamarse', null), W('renshi', 'conocer (a alguien)', null), W('shei', '¿quién?', null),
            G('de', 'de (mi, tu, su…)'),
          ],
          items: [
            { k: 'q', t: 'Aileen habla de sí misma: «___ jiao Aileen.» ¿Qué palabra falta?', a: 'Wo', w: ['Ni', 'Ta', 'Women'] },
            { k: 'q', t: 'Dralingo saluda a Hamdan: «___ hao, Hamdan!» ¿Qué palabra falta?', a: 'Ni', w: ['Wo', 'Ta', 'Shei'] },
            { k: 'q', t: 'Latifa señala a Hamdan y le dice a Aileen: «___ shi Hamdan.» ¿Qué palabra falta?', a: 'Ta', w: ['Wo', 'Ni', 'Shei'] },
            { k: 'q', t: '¿Cómo preguntas «¿Cómo te llamas?» en Chino Mandarín?', a: 'Ni jiao shenme?', w: ['Ni hao ma?', 'Ta shi shei?', 'Ni qu nar?'] },
            { k: 'm', py: 'Hen gaoxing renshi ni.', es: 'Mucho gusto en conocerte.' },
            { k: 'm', py: 'Nage ren shi shei?', es: '¿Quién es esa persona?' },
            { k: 'f', s: 'Zhe shi wo ___ mama.', a: 'de', bank: ['he', 'ma', 'hen', 'zai'], t: 'Completa: «Esta es mi mamá» = «Zhe shi wo ___ mama.»' },
          ],
        },
      ],
    },
    {
      id: 'espejo', name: 'El Espejo Mágico', emoji: '🪞',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'nariz, orejas, boca, mano, cabello, ojos',
          words: [
            W('bizi', 'nariz', 'bizi'), W('erduo', 'orejas', 'erduo'), W('kou', 'boca', 'kou'),
            W('shou', 'mano', 'shou'), W('toufa', 'cabello', 'toufa'), W('yanjing', 'ojos', 'yanjing'),
          ],
          items: [
            { k: 'm', py: 'Wo de yanjing da.', es: 'Mis ojos son grandes.' },
            { k: 'm', py: 'Yanjing he bizi', es: 'los ojos y la nariz' },
            { k: 'm', py: 'Ni kan wo de shou.', es: 'Mira mi mano.' },
            { k: 'm', py: 'Zhe shi xiao gou de erduo.', es: 'Estas son las orejas del perrito.' },
          ],
        },
        {
          id: 'r2', name: 'Ronda 2', blurb: 'largo, alto, estatura, grande, pequeño',
          words: [
            W('chang', 'largo', 'chang'), W('gao', 'alto', 'gao'), W('gezi', 'estatura', 'gezi'),
            W('da', 'grande', 'da'), W('xiao', 'pequeño', 'xiao'), W('hen', 'muy', null, { gram: true }),
          ],
          items: [
            { k: 'm', py: 'Ta de toufa hen chang.', es: 'Su cabello es muy largo.' },
            { k: 'm', py: 'Wo de shou da, ni de shou xiao.', es: 'Mi mano es grande, tu mano es pequeña.' },
            { k: 'm', py: 'Wo de bizi chang.', es: 'Mi nariz es larga.' },
            { k: 'm', py: 'Gao gezi', es: 'de estatura alta' },
            { k: 'r', a: 'Wo he ta, shei de gezi gao?', b: 'Ni de gezi gao.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Xiexie.'] },
            { k: 'r', a: 'Nage shi ni jiejie?', b: 'Chang toufa de nage.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Xiexie.'] },
            { k: 'f', s: 'Mama de toufa ___ chang.', a: 'hen', bank: ['de', 'ma', 'shi', 'he'] },
          ],
        },
      ],
    },
    {
      id: 'mascotas', name: 'Mis Mascotas', emoji: '🐶',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'perro, gato, pájaro, pez, gustar, mirar',
          words: [
            W('gou', 'perro', 'gou'), W('mao', 'gato', 'mao'), W('niao', 'pájaro', 'niao'), W('yu', 'pez', 'yu'),
            W('xihuan', 'gustar', 'xihuan'), W('kan', 'mirar / ver', 'kan'), W('zhe', 'este / esto', 'zhe'),
            W('na', 'ese / eso', 'na'),
          ],
          items: [
            { k: 'm', py: 'Zhe shi shenme niao?', es: '¿Qué pájaro es este?' },
            { k: 'm', py: 'Zhe shi ni de gou?', es: '¿Este es tu perro?' },
            { k: 'm', py: 'Mao he yu', es: 'el gato y el pez' },
            { k: 'r', a: 'Zhe shi ni de mao?', b: 'Shi de.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Hen duo.'] },
            { k: 'r', a: 'Ni xihuan nage?', b: 'Wo xihuan zhege.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Mingtian jian.'] },
            { k: 'f', s: 'Xiao mao ai chi ___? — Yu.', a: 'shenme', bank: ['shei', 'nar', 'ji', 'ma'] },
          ],
        },
      ],
    },
    {
      id: 'comida', name: 'La Comida', emoji: '🍜',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'comer, beber, arroz, fideos, leche, manzana, agua, tienda',
          words: [
            W('chi', 'comer', 'chi'), W('he', 'beber', 'he'), W('mifan', 'arroz', 'mifan'),
            W('miantiao', 'fideos', 'miantiao'), W('niunai', 'leche', 'niunai'), W('pingguo', 'manzana', 'pingguo'),
            W('shui', 'agua', 'shui'), W('shangdian', 'tienda', 'shangdian'),
          ],
          items: [
            { k: 'm', py: 'Wo ai chi miantiao.', es: 'Me encanta comer fideos.' },
            { k: 'm', py: 'Baba zai chi fan.', es: 'Papá está comiendo.' },
            { k: 'm', py: 'Ta xianzai zai shangdian.', es: 'Ahora él está en la tienda.' },
            { k: 'r', a: 'Zher you shui he niunai, ni he shenme?', b: 'Wo he shui.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Ta shi wo de laoshi.'] },
            { k: 'r', a: 'Ni chi pingguo ma?', b: 'Hao de, xiexie ni.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Mingtian jian.'] },
            { k: 'r', a: 'Chi yi kou, hao ma?', b: 'Bu, wo bu xihuan chi.', w: ['Wo 5 sui.', 'Wo zai zher.', 'Ta shi wo de laoshi.'] },
            { k: 'f', s: 'Women jintian ___ shenme? — Mifan.', a: 'chi', bank: ['he', 'qu', 'kan', 'shi'] },
          ],
        },
      ],
    },
    {
      id: 'numeros', name: 'Números y Tiempo', emoji: '⏰',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'los números del 1 al 10',
          words: [
            W('yi', 'uno', 'yi'), W('er', 'dos', 'er'), W('san', 'tres', 'san'), W('si', 'cuatro', 'si'),
            W('wu', 'cinco', 'wu'), W('liu', 'seis', 'liu'), W('qi', 'siete', 'qi'), W('ba', 'ocho', 'ba'),
            W('jiu', 'nueve', 'jiu'), W('shi', 'diez', 'shi'),
          ],
          items: [
            { k: 'm', py: 'Si ge', es: 'cuatro (cosas)' },
            { k: 'm', py: 'Shiwu sui', es: 'quince años' },
            { k: 'm', py: 'Yi ge pingguo', es: 'una manzana' },
          ],
        },
        {
          id: 'r2', name: 'Ronda 2', blurb: 'hora, día, mes, semana, hoy, mañana, ahora',
          words: [
            W('dian', 'en punto (la hora)', null), W('hao', 'día del mes', null), W('yue', 'mes', null),
            W('xingqi', 'semana', null), W('jintian', 'hoy', null), W('mingtian', 'mañana', null),
            W('xianzai', 'ahora', null), W('sui', 'años (de edad)', 'sui'), W('ji', '¿cuántos?', null),
            G('ge', 'medida para cosas y personas'),
          ],
          items: [
            { k: 'm', py: 'Xianzai si dian.', es: 'Ahora son las cuatro.' },
            { k: 'm', py: 'Mingtian shi 9 hao.', es: 'Mañana es día 9.' },
            { k: 'm', py: 'Jintian xingqiliu.', es: 'Hoy es sábado.' },
            { k: 'r', a: 'Mingtian shi qi yue ji hao?', b: 'Mingtian shi qi yue er hao.', w: ['Wo 5 sui.', 'Zai shangdian.', 'Xianzai si dian.'] },
            { k: 'r', a: 'Ni duo da?', b: 'Wo 5 sui.', w: ['Xianzai si dian.', 'Zai shangdian.', 'Mingtian shi 9 hao.'] },
            { k: 'f', s: 'Zher you ___ ge ren? — San ge.', a: 'ji', bank: ['shei', 'nar', 'ma', 'de'] },
            { k: 'f', s: 'Yi ___ xingqi you qi tian.', a: 'ge', bank: ['de', 'hao', 'sui', 'dian'] },
          ],
        },
      ],
    },
    {
      id: 'escuela', name: 'La Escuela y los Saludos', emoji: '🏫',
      rounds: [
        {
          id: 'r1', name: 'Ronda 1', blurb: 'hola, gracias, adiós, maestra, escuela',
          words: [
            W('hao', 'bueno / bien', 'hao-bien'), W('xiexie', 'gracias', 'xiexie'), W('zaijian', 'adiós', 'zaijian'),
            W('gaoxing', 'feliz', 'gaoxing'), W('laoshi', 'maestro / maestra', 'laoshi'), W('xuexiao', 'escuela', 'xuexiao'),
            W('Zhongguoren', 'persona china', 'zhongguoren'), W('bu', 'no', 'bu'), W('shi', 'ser / es', null),
          ],
          items: [
            { k: 'm', py: 'Ni hao!', es: '¡Hola!' },
            { k: 'm', py: 'Mingtian jian.', es: 'Nos vemos mañana.' },
            { k: 'm', py: 'Wo de laoshi', es: 'mi maestra' },
            { k: 'r', a: 'Laoshi, zaijian.', b: 'Zaijian, xingqiyi jian.', w: ['Xiexie.', 'Hen duo.', 'Wo zai zher.'] },
            { k: 'r', a: 'Zhe shi Li laoshi.', b: 'Ni hao, hen gaoxing renshi ni.', w: ['Hen duo.', 'Wo zai zher.', 'Wo 5 sui.'] },
            { k: 'r', a: 'He kou shui.', b: 'Xiexie.', w: ['Hen duo.', 'Wo zai zher.', 'Wo 5 sui.'] },
          ],
        },
        {
          id: 'r2', name: 'Ronda 2', blurb: '¿qué?, ¿dónde?, aquí, allá, ir, estar en',
          words: [
            W('shenme', '¿qué?', null), W('na', '¿cuál?', null), W('nar', '¿dónde?', null), W('zher', 'aquí', 'zher'),
            W('nar', 'allá', 'nar-alla'), W('qu', 'ir', 'qu'), W('zai', 'estar en', null), W('duo', 'mucho / muchos', 'duo'),
            G('ma', '¿…? (pregunta de sí o no)'),
          ],
          items: [
            { k: 'r', a: 'Ni zai nar?', b: 'Wo zai zher.', w: ['Hen duo.', 'Xiexie.', 'Zaijian, xingqiyi jian.'] },
            { k: 'r', a: 'Ni qu nar?', b: 'Wo qu xuexiao, zaijian.', w: ['Hen duo.', 'Xiexie.', 'Ni hao, hen gaoxing renshi ni.'] },
            { k: 'r', a: 'Nar ren duo bu duo?', b: 'Hen duo.', w: ['Wo zai zher.', 'Xiexie.', 'Wo qu xuexiao, zaijian.'] },
            { k: 'm', py: 'Ta zai nar.', es: 'Él está allá.' },
            { k: 'm', py: 'Zher ren hen duo.', es: 'Aquí hay mucha gente.' },
            { k: 'f', s: 'Ni ai chi yu ___? — Bu ai chi.', a: 'ma', bank: ['de', 'shi', 'hen', 'nar'] },
            { k: 'f', s: 'Bizi ___ nar? — Zher.', a: 'zai', bank: ['shi', 'qu', 'you', 'he'] },
          ],
        },
      ],
    },
    // ── The five official simulations, as game rounds (test-day practice) ─────────────────────────────────
    {
      id: 'simulacro', name: 'Simulacro del examen', emoji: '📝',
      rounds: [
        sim(1, 'Escucha', [
          w('women'), w('shou'), w('miantiao'), w('shui'), w('bizi'),
          m('Si ge', 'cuatro (cosas)'), m('Mingtian jian', 'nos vemos mañana'), m('Bu gaoxing', 'no está contento'),
          m('Chang erduo', 'orejas largas'), m('He niunai', 'tomar leche'),
          m('Ni hen hao.', 'Estás muy bien.'), m('Baba zai chi fan.', 'Papá está comiendo.'),
          m('Wo xianzai yi ge ren zai jia.', 'Ahora estoy solo en casa.'), m('Zher you hen duo yu.', 'Aquí hay muchos peces.'),
          r('Wo he ta, shei de gezi gao?', 'Ni de gezi gao.'), r('Ni kan, zhe shi shenme?', 'Wo bu kan.'),
          r('Zhe shi ni de niao?', 'Shi de.'), r('Ni xihuan ma?', 'Wo hen xihuan, xiexie.', ['Ni de gezi gao.', 'Wo bu kan.', 'Zai shangdian.']), r('Tamen zai nar?', 'Zai shangdian.'),
        ]),
        sim(1, 'Lectura', [
          w('qi'), w('niu', 'vaca'), w('zaijian'), w('mao'), w('nar', 'allá'),
          m('Zhege da, nage xiao.', 'Este es grande, ese es pequeño.'), m('Mama, ni chi pingguo ma?', 'Mamá, ¿comes manzana?'),
          m('Hen gaoxing renshi ni, ni jiao shenme?', 'Mucho gusto, ¿cómo te llamas?'),
          m('Laoshi, Zhongguo zai zher.', 'Maestra, China está aquí.'), m('Bu, wo bu he.', 'No, yo no bebo.'),
          f('Nimen shei ___? — Wo. Ta 8 sui, wo 9 sui.', 'da', ['shi', 'dian', 'san', 'xuexiao', 'ma']),
          f('Jintian ji ___ qu nar? — 7:15.', 'dian', ['da', 'shi', 'san', 'xuexiao', 'ma']),
          f('Ni ai chi yu ___? — Bu ai chi.', 'ma', ['da', 'shi', 'dian', 'san', 'xuexiao']),
          f('Nage ___ ni jiejie? — Chang toufa de nage.', 'shi', ['da', 'dian', 'san', 'xuexiao', 'ma']),
          f('Xingqiliu nimen qu nar? — ___.', 'Xuexiao', ['Da', 'Shi', 'Dian', 'San', 'Ma']),
        ]),
        sim(2, 'Escucha', [
          w('mama'), w('chang'), w('bu'), w('toufa'), w('kan'),
          m('Xiexie ni', 'gracias'), m('Shiwu sui', 'quince años'), m('Yanjing he bizi', 'los ojos y la nariz'),
          m('Yi ge pingguo', 'una manzana'), m('Wo de laoshi', 'mi maestra'),
          m('Zhe shi shenme niao?', '¿Qué pájaro es este?'), m('Wo ai chi miantiao.', 'Me encanta comer fideos.'),
          m('Zher ren hen duo.', 'Aquí hay mucha gente.'), m('Ni kan, wo gezi gao ma?', 'Mira, ¿soy alto?'),
          m('Jintian xingqiliu, ta zai jia.', 'Hoy es sábado, él está en casa.'),
          r('Zher you shui he niunai, ni he shenme?', 'Wo he shui.'), r('Zaijian!', 'Zaijian, women ba yue jian.'),
          r('Qu jiao gege chi fan.', 'Hao de, baba.'), r('Yi ge da, yi ge xiao, ni xihuan nage?', 'Xiao de.'),
          r('Ni zai nar?', 'Wo zai zher.'),
        ]),
        sim(2, 'Lectura', [
          w('shou'), w('jiu'), w('women'), w('he', 'beber'), w('hao', 'bueno / bien'),
          m('Ta xianzai zai shangdian.', 'Ahora él está en la tienda.'), m('Chi yi kou, hao ma?', '¿Pruebas un bocado?'),
          m('Tamen zai kan shenme?', '¿Qué están mirando ellos?'), m('Wo 5 dian qu nar.', 'Voy allá a las 5.'),
          f('Jie, ni qu ___? — Xuexiao.', 'nar', ['shenme', 'jia', 'de', 'san', 'renshi']),
          f('Xiao mao ai chi ___? — Yu.', 'shenme', ['jia', 'de', 'san', 'renshi', 'nar']),
          f('Ni ji hao qu laoshi ___? — Mingtian.', 'jia', ['shenme', 'de', 'san', 'renshi']),   // 'nar' (那儿) would fit too
          f('Nage Zhongguoren shi shei? — Wo bu ___.', 'renshi', ['shenme', 'jia', 'de', 'san', 'nar']),
          f('Nage shi ni ___ gou? — Chang erduo zhege.', 'de', ['shenme', 'jia', 'san', 'renshi', 'nar']),
        ]),
        sim(3, 'Escucha', [
          w('niunai'), w('gaoxing'), w('nar', 'allá'), w('laoshi'), w('zaijian'),
          m('Mao he yu', 'el gato y el pez'), m('Shiyi dian wushiqi', 'las once y cincuenta y siete'),
          m('Hen duo ren', 'mucha gente'), m('Chi miantiao', 'comer fideos'), m('Zai shangdian', 'en la tienda'),
          m('Ta de toufa hen chang.', 'Su cabello es muy largo.'), m('Ta zai he shenme?', '¿Qué está bebiendo?'),
          m('Zhe shi ni de gou?', '¿Este es tu perro?'), m('Hao, wo bu kan.', 'Está bien, no miro.'),
          m('Wo de shou da, ni de shou xiao.', 'Mi mano es grande, tu mano es pequeña.'),
          r('Women qu nar?', 'Zhongguo.'), r('Ni baba zai jia ma?', 'Zai.'), r('Chi yi kou, hao ma?', 'Bu, wo bu xihuan chi.'),
          r('Zhe shi Li laoshi.', 'Ni hao, hen gaoxing renshi ni.'), r('Nage shi ni gege?', 'Yi hao.'),
        ]),
        sim(3, 'Lectura', [
          w('tamen', 'ellos'), w('yanjing'), w('jiu'), w('xiexie'), w('gao'),
          m('Zher you shui.', 'Aquí hay agua.'), m('Wo chi ge pingguo.', 'Me como una manzana.'),
          m('Wo 6 sui, jiejie 8 sui.', 'Yo tengo 6 años y mi hermana 8.'), m('Xiao niao, ni jiao shenme?', 'Pajarito, ¿cómo te llamas?'),
          f('___ shi shenme? — Nainiu.', 'Na', ['Ai', 'Gezi', 'San', 'Xingqi', 'Hen']),
          f('Ni xihuan xianzai de xuexiao? — Shi de, ___ xihuan.', 'hen', ['na', 'ai', 'gezi', 'san', 'xingqi']),
          f('Ta na tian qu laoshi jia? — Mingtian, ___ er.', 'xingqi', ['na', 'ai', 'gezi', 'san', 'hen']),
          f('Ni he jiejie shei ___ gao? — Wo gao.', 'gezi', ['na', 'ai', 'san', 'xingqi']),   // 'hen' would fit too
          f('Jintian chi mifan? — Hao, wo ___ chi mifan.', 'ai', ['na', 'gezi', 'san', 'xingqi', 'hen']),
        ]),
        sim(4, 'Escucha', [
          w('bu'), w('niunai'), w('xiao'), w('xiexie'), w('mama'),
          m('Zai shangdian', 'en la tienda'), m('Chang erduo', 'orejas largas'), m('Wo he jiejie', 'mi hermana mayor y yo'),
          m('Xingqiliu', 'sábado'), m('Hen xihuan', 'gustar mucho'),
          m('Ta zai chi fan.', 'Él está comiendo.'), m('Baba jintian hen gaoxing.', 'Hoy papá está muy contento.'),
          m('Ta jiu sui, wo ba sui.', 'Él tiene nueve años, yo ocho.'), m('Wo de toufa hen chang.', 'Mi cabello es muy largo.'),
          m('Ni kan wo de shou.', 'Mira mi mano.'),
          r('Zhe shi shei jia de gou?', 'Gege jia de.'), r('Ni qu nar?', 'Wo qu xuexiao, zaijian.'),
          r('Nar ren duo bu duo?', 'Hen duo.'), r('Ni renshi nage Zhongguoren ma?', 'Ta shi wo de laoshi.'),
          r('He kou shui.', 'Xiexie.'),
        ]),
        sim(4, 'Lectura', [
          w('shi', 'diez'), w('xuexiao'), w('he', 'beber'), w('ai'), w('women'),
          m('Women shei de gezi gao?', '¿Quién de nosotros es más alto?'), m('Ni chi nage pingguo?', '¿Qué manzana te comes?'),
          m('Ni hao, ni jiao shenme mingzi?', 'Hola, ¿cómo te llamas?'), m('Ta zai nar.', 'Él está allá.'),
          f('Bizi ___ nar? — Zher.', 'zai', ['yanjing', 'da', 'xingqi', 'san', 'mianbao']),
          f('Ta de ___ xiao ma? — Bu xiao.', 'yanjing', ['da', 'xingqi', 'san', 'zai']),   // 'mianbao' would fit too
          f('Ni chi shenme? — ___.', 'Mianbao', ['Yanjing', 'Da', 'Xingqi', 'San', 'Zai']),
          f('Yi ge ___ you ji tian? — 7 tian.', 'xingqi', ['yanjing', 'da', 'san', 'zai', 'mianbao']),
          f('Ni de mao 5 ge yue ___? — Shi de.', 'da', ['yanjing', 'xingqi', 'san', 'zai', 'mianbao']),
        ]),
        sim(5, 'Escucha', [
          w('ren', 'persona'), w('gaoxing'), w('ba'), w('kan'), w('pingguo'),
          m('San yue', 'marzo'), m('Chi yi kou', 'probar un bocado'), m('Zai xuexiao', 'en la escuela'),
          m('Wo he gege', 'mi hermano mayor y yo'), m('Gao gezi', 'de estatura alta'),
          m('Zher you mianbao.', 'Aquí hay pan.'), m('Zhe shi xiao gou de erduo.', 'Estas son las orejas del perrito.'),
          m('Mama de toufa hen chang.', 'El cabello de mamá es muy largo.'), m('Wo ai he zhege.', 'Me encanta beber esto.'),
          m('Wo jia you liu kou ren.', 'En mi familia somos seis.'),
          r('Ni chi pingguo ma?', 'Hao de, xiexie ni.', ['Zaijian, xingqiyi jian.', 'Zhe shi wo de da bizi.', 'Wo 5 sui.']), r('Zhe shi ni de mao?', 'Shi de.'),
          r('Ni xihuan nage?', 'Wo xihuan zhege.'), r('Laoshi, zaijian.', 'Zaijian, xingqiyi jian.'),
          r('Zhe shi shenme?', 'Zhe shi wo de da bizi.'),
        ]),
        sim(5, 'Lectura', [
          w('niunai'), w('ta', 'ella'), w('duo'), w('xihuan'), w('shou'),
          m('Mingtian shi 9 hao.', 'Mañana es día 9.'), m('Xiao gou ni hao, ni jiao shenme mingzi?', 'Hola perrito, ¿cómo te llamas?'),
          m('Wo zher you shui, ni he ma?', 'Aquí tengo agua, ¿quieres?'), m('Ni kan, shi bu shi hen gao?', 'Mira, ¿verdad que es muy alto?'),
          m('Mama, Zhongguo zai nar?', 'Mamá, ¿dónde está China?'),
          f('Baba, ___ ji dian? — 7:30.', 'xianzai', ['sui', 'chi', 'san', 'shei', 'shangdian']),
          f('Women jintian ___ shenme? — Mifan.', 'chi', ['sui', 'xianzai', 'san', 'shei', 'shangdian']),
          f('Mama, ni qu nar? — Wo qu ___.', 'shangdian', ['sui', 'xianzai', 'chi', 'san', 'shei']),
          f('Ni duo da? — Wo 5 ___.', 'sui', ['xianzai', 'chi', 'san', 'shei', 'shangdian']),
          f('Jiejie, nage ren shi ___? — Wo bu renshi ta.', 'shei', ['sui', 'xianzai', 'chi', 'san', 'shangdian']),
        ]),
      ],
    },
  ],
};

// Simulacro helpers (kept below the data so the worlds read first; hoisted function declarations)
function sim(n, part, items) {
  return { id: 's' + n + (part === 'Escucha' ? 'e' : 'l'), name: 'Simulacro ' + n + ' · ' + part,
    blurb: part === 'Escucha' ? 'preguntas 1–20 del examen' : 'preguntas 21–35 del examen', items, keepOrder: true };
}
function w(py, es) { return { k: 'w', py, es }; }
function m(py, es) { return { k: 'm', py, es }; }
function r(a, b, wrong) { return wrong ? { k: 'r', a, b, w: wrong } : { k: 'r', a, b }; }
function f(s, a, bank) { return { k: 'f', s, a, bank }; }
