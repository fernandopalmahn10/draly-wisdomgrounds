// Old HSK 1 question packs (2026-10-11 rebuild of the 9 old uploaded sets, which showed hanzi + tone marks and no
// pictures of their own). Words per experience come from those sets; the simulacros come from the mother file
// «HSK1 · Simulaciones 1–10 (400 preguntas)» (reading items 21–40 of each sim; items 1–20 are audio-only),
// built into hsk1-sims.json. Same round kinds and rules as core/packs/yct1.js (pinyin without tone marks, no hanzi).
// img: file name in public/assets/packs/hsk1/<world>/<img>.webp (shown only once the picture exists).
'use strict';

const SIMS = require('./hsk1-sims.json');
const W = (py, es, img, extra) => Object.assign({ py, es, img: img === undefined ? null : img }, extra || {});
const G = (py, es) => ({ py, es, gram: true });

module.exports = {
  id: 'hsk1',
  name: 'HSK 1',
  dir: 'hsk1',
  worlds: [
    {
      id: 'familia', name: 'EXP1 · Mi Familia', emoji: '👨‍👩‍👧',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'papá, mamá, hijo, hija, casa',
          words: [W('baba', 'papá', 'baba'), W('mama', 'mamá', 'mama'), W('erzi', 'hijo', 'erzi'), W('nu\'er', 'hija', 'nuer'),
            W('jia', 'casa / familia', 'jia'), W('ai', 'amar', 'ai'), W('gou', 'perro', 'gou'), W('mao', 'gato', 'mao')],
          items: [
            { k: 'm', py: 'Ta shi wo de erzi.', es: 'Él es mi hijo.' },
            { k: 'm', py: 'Wo ai mama.', es: 'Quiero mucho a mamá.' },
            { k: 'm', py: 'Wo jia you yi ge gou.', es: 'En mi casa hay un perro.' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'yo, tú, él, ella, nombre, conocer',
          words: [W('wo', 'yo'), W('ni', 'tú'), W('ta', 'él'), W('ta', 'ella'), W('mingzi', 'nombre'), W('shi', 'ser / es'),
            W('renshi', 'conocer (a alguien)'), G('de', 'de (mi, tu, su…)')],
          items: [
            { k: 'q', t: 'Aileen habla de sí misma: «___ jiao Aileen.» ¿Qué palabra falta?', a: 'Wo', w: ['Ni', 'Ta', 'Shei'] },
            { k: 'q', t: 'Dralingo saluda a Latifa: «___ hao, Latifa!» ¿Qué palabra falta?', a: 'Ni', w: ['Wo', 'Ta', 'Shei'] },
            { k: 'q', t: 'Hamdan señala a Latifa y le dice a Aileen: «___ shi Latifa.» ¿Qué palabra falta?', a: 'Ta', w: ['Wo', 'Ni', 'Shei'] },
            { k: 'r', a: 'Ni jiao shenme mingzi?', b: 'Wo jiao Aileen.', w: ['Wo hen hao.', 'Bu keqi.', 'Mei guanxi.'] },
            { k: 'm', py: 'Hen gaoxing renshi ni.', es: 'Mucho gusto en conocerte.' },
            { k: 'f', s: 'Zhe shi wo ___ baba.', a: 'de', bank: ['ma', 'ne', 'le', 'he'], t: 'Completa: «Este es mi papá» = «Zhe shi wo ___ baba.»' },
          ] },
      ],
    },
    {
      id: 'escuela', name: 'EXP2 · La Escuela', emoji: '🏫',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'escuela, estudiante, maestra, libro',
          words: [W('xuexiao', 'escuela', 'xuexiao'), W('xuesheng', 'estudiante', 'xuesheng'), W('laoshi', 'maestro / maestra', 'laoshi'),
            W('tongxue', 'compañero de clase', 'tongxue'), W('xuexi', 'estudiar', 'xuexi'), W('shu', 'libro', 'shu'),
            W('zi', 'carácter (letra china)', null), W('Hanyu', 'chino mandarín', null), W('xiansheng', 'señor', 'xiansheng')],
          items: [
            { k: 'm', py: 'Wo shi xuesheng.', es: 'Yo soy estudiante.' },
            { k: 'm', py: 'Ta shi wo de tongxue.', es: 'Él es mi compañero de clase.' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'leer, escribir, hablar, escuchar, mirar, saber',
          words: [W('du', 'leer', 'du'), W('xie', 'escribir', 'xie'), W('shuo', 'hablar / decir', 'shuo'), W('ting', 'escuchar', 'ting'),
            W('kan', 'mirar / ver', 'kan'), W('kanjian', 'ver (alcanzar a ver)', null), W('hui', 'saber (hacer algo)', null),
            W('neng', 'poder', null), G('ben', 'medida para libros')],
          items: [
            { k: 'm', py: 'Wo hui shuo Hanyu.', es: 'Sé hablar chino mandarín.' },
            { k: 'f', s: 'Wo ___ shuo Hanyu.', a: 'hui', bank: ['kan', 'du', 'ting'], t: 'Completa «Sé hablar chino mandarín»: «Wo ___ shuo Hanyu.»' },
            { k: 'f', s: 'Wo you san ___ shu.', a: 'ben', bank: ['ge', 'kuai', 'bei'], t: 'Completa «Tengo tres libros»: «Wo you san ___ shu.»' },
          ] },
      ],
    },
    {
      id: 'mercado', name: 'EXP3 · El Mercado', emoji: '🛒',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'comprar, tienda, restaurante, dinero',
          words: [W('mai', 'comprar', 'mai'), W('dongxi', 'cosa', null), W('shangdian', 'tienda', 'shangdian'),
            W('fandian', 'restaurante', 'fandian'), W('qian', 'dinero', 'qian'), W('kuai', 'yuan (la moneda)', null),
            W('duoshao', '¿cuánto?', null), W('xiang', 'querer', null), W('qing', 'por favor', null)],
          items: [
            { k: 'q', t: 'En el mercado, ¿cómo preguntas el precio?', a: 'Duoshao qian?', w: ['Ni hao ma?', 'Ji dian?', 'Zai nar?'] },
            { k: 'm', py: 'Wo xiang mai pingguo.', es: 'Quiero comprar manzanas.' },
            { k: 'm', py: 'Wo you qian.', es: 'Tengo dinero.' },
            { k: 'r', a: 'Xiexie!', b: 'Bu keqi.', w: ['Ni hao!', 'Duoshao qian?', 'Wo qu Beijing.'] },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'comida, arroz, té, agua, fruta, comer, beber',
          words: [W('cai', 'plato de comida', 'cai'), W('mifan', 'arroz', 'mifan'), W('cha', 'té', 'cha'), W('shui', 'agua', 'shui'),
            W('shuiguo', 'fruta', 'shuiguo'), W('pingguo', 'manzana', 'pingguo'), W('beizi', 'vaso / taza', 'beizi'),
            W('chi', 'comer', 'chi'), W('he', 'beber', 'he'), W('xihuan', 'gustar', 'xihuan')],
          items: [
            { k: 'q', t: 'Tienes sed. ¿Qué quieres hacer?', a: 'he shui', w: ['chi fan', 'mai shu', 'kan dianshi'] },
            { k: 'm', py: 'Wo xihuan he cha.', es: 'Me gusta tomar té.' },
            { k: 'm', py: 'Qing he shui.', es: 'Toma agua, por favor.' },
          ] },
      ],
    },
    {
      id: 'tiempo', name: 'EXP4 · Tiempo y Clima', emoji: '⛅',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'hoy, mañana, ayer, la hora, semana, mes, año',
          words: [W('jintian', 'hoy'), W('mingtian', 'mañana (el día de)'), W('zuotian', 'ayer'), W('xianzai', 'ahora'),
            W('dian', 'en punto (la hora)'), W('fenzhong', 'minuto'), W('xingqi', 'semana'), W('yue', 'mes'), W('nian', 'año'),
            W('hao', 'día del mes')],
          items: [
            { k: 'f', s: 'Xianzai san ___.', a: 'dian', bank: ['fenzhong', 'yue', 'nian'], t: 'Completa «Son las tres en punto»: «Xianzai san ___.»' },
            { k: 'm', py: 'Jintian xingqi ji?', es: '¿Qué día de la semana es hoy?' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'mañana, mediodía, tarde, clima, calor, frío, llover',
          words: [W('shangwu', 'por la mañana'), W('zhongwu', 'mediodía'), W('xiawu', 'por la tarde'), W('shihou', 'momento'),
            W('tianqi', 'clima', 'tianqi'), W('re', 'calor', 're'), W('leng', 'frío', 'leng'), W('xiayu', 'llover', 'xiayu'),
            W('tai', 'demasiado'), W('hen', 'muy')],
          items: [
            { k: 'm', py: 'Jintian hen leng.', es: 'Hoy hace mucho frío.' },
            { k: 'm', py: 'Jintian tai re le.', es: 'Hoy hace demasiado calor.' },
            { k: 'q', t: '¿Qué viene primero en el día?', a: 'shangwu', w: ['zhongwu', 'xiawu', 'mingtian'] },
          ] },
      ],
    },
    {
      id: 'viajes', name: 'EXP5 · Viajes', emoji: '🧭',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'China, Pekín, ir, venir, avión, taxi',
          words: [W('Zhongguo', 'China', 'zhongguo'), W('Beijing', 'Pekín', 'beijing'), W('qu', 'ir'), W('lai', 'venir'),
            W('hui', 'volver'), W('feiji', 'avión', 'feiji'), W('chuzuche', 'taxi', 'chuzuche'), W('zuo', 'ir en (avión, taxi…)'),
            W('zhu', 'vivir (en un lugar)')],
          items: [
            { k: 'm', py: 'Wo qu Beijing.', es: 'Voy a Pekín.' },
            { k: 'm', py: 'Ta zhu zai Zhongguo.', es: 'Él vive en China.' },
            { k: 'm', py: 'Zuo feiji', es: 'ir en avión' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: '¿dónde?, aquí, adelante, atrás, arriba, abajo',
          words: [W('zai', 'estar en'), W('na', '¿cuál?'), W('na', 'ese / eso'), W('nar', '¿dónde?'), W('zhe', 'este / esto'), W('qianmian', 'adelante', 'qianmian'),
            W('houmian', 'atrás', 'houmian'), W('shang', 'arriba / sobre', 'shang'), W('xia', 'abajo / debajo', 'xia')],
          items: [
            { k: 'f', s: 'Shu zai zhuozi ___.', a: 'shang', bank: ['xia', 'qianmian', 'houmian'], t: 'Completa «El libro está SOBRE la mesa»: «Shu zai zhuozi ___.»' },
            { k: 'r', a: 'Ni qu nar?', b: 'Wo qu Beijing.', w: ['Wo hen hao.', 'Wo jiao Aileen.', 'Bu keqi.'] },
          ] },
      ],
    },
    {
      id: 'casa', name: 'EXP6 · La Casa', emoji: '🏠',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'mesa, silla, computadora, televisión, película, ropa',
          words: [W('zhuozi', 'mesa', 'zhuozi'), W('yizi', 'silla', 'yizi'), W('diannao', 'computadora', 'diannao'),
            W('dianshi', 'televisión', 'dianshi'), W('dianying', 'película', 'dianying'), W('yifu', 'ropa', 'yifu'),
            W('li', 'dentro'), W('piaoliang', 'bonito / bonita', 'piaoliang')],
          items: [
            { k: 'm', py: 'Wo you diannao.', es: 'Tengo una computadora.' },
            { k: 'm', py: 'Zhege jia hen piaoliang.', es: 'Esta casa es muy bonita.' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'abrir, dormir, hacer, trabajar, llamar, tener',
          words: [W('kai', 'abrir / encender', 'kai'), W('shuijiao', 'dormir', 'shuijiao'), W('zuo', 'hacer'), W('gongzuo', 'trabajar', 'gongzuo'),
            W('da dianhua', 'llamar por teléfono', 'dadianhua'), W('wei', '¡aló! (al teléfono)'), W('da', 'grande'), W('xiao', 'pequeño'),
            W('you', 'tener / haber'), W('meiyou', 'no tener / no hay')],
          items: [
            { k: 'f', s: 'Wo ___ dianying.', a: 'kan', bank: ['zuo', 'kai', 'shuijiao'], t: 'Completa «Estoy viendo una película»: «Wo ___ dianying.»' },
            { k: 'q', t: '¿Qué es lo contrario de «da»?', a: 'xiao', w: ['hao', 'duo', 'leng'] },
          ] },
      ],
    },
    {
      id: 'personas', name: 'EXP7 · Personas', emoji: '🧑',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'persona, médico, hospital, señorita',
          words: [W('ren', 'persona', 'ren'), W('yisheng', 'médico', 'yisheng'), W('yiyuan', 'hospital', 'yiyuan'),
            W('xiaojie', 'señorita'), W('gaoxing', 'contento', 'gaoxing'), W('duibuqi', 'perdón'), W('duo', 'mucho / muchos'),
            W('shao', 'poco / pocos'), W('xie', 'algunos'), G('ge', 'medida para cosas y personas')],
          items: [
            { k: 'r', a: 'Duibuqi!', b: 'Mei guanxi.', w: ['Ni hao!', 'Duoshao qian?', 'Hen duo.'] },
            { k: 'm', py: 'Wo hen gaoxing.', es: 'Estoy muy contento.' },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: '¿quién?, ¿qué?, ¿cómo?, ¿cuántos?, todos',
          words: [W('shei', '¿quién?'), W('shenme', '¿qué?'), W('zenme', '¿cómo?'), W('zenmeyang', '¿qué tal?'),
            W('ji', '¿cuántos?'), W('dou', 'todos')],
          items: [
            { k: 'm', py: 'Ni zenmeyang?', es: '¿Qué tal estás?' },
            { k: 'f', s: 'Ni ___ sui?', a: 'ji', bank: ['shei', 'shenme', 'dou'], t: 'Completa «¿Cuántos años tienes?»: «Ni ___ sui?»' },
            { k: 'f', s: 'Women ___ shi xuesheng.', a: 'dou', bank: ['ji', 'shei', 'zenme'], t: 'Completa «Todos somos estudiantes»: «Women ___ shi xuesheng.»' },
          ] },
      ],
    },
    {
      id: 'numeros', name: 'EXP8 · Números', emoji: '🔢',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'los números del 1 al 10',
          words: [W('yi', 'uno', 'yi'), W('er', 'dos', 'er'), W('san', 'tres', 'san'), W('si', 'cuatro', 'si'), W('wu', 'cinco', 'wu'),
            W('liu', 'seis', 'liu'), W('qi', 'siete', 'qi'), W('ba', 'ocho', 'ba'), W('jiu', 'nueve', 'jiu'), W('shi', 'diez', 'shi')],
          items: [
            { k: 'q', t: '¿Cuánto es «wu» + «san»?', a: 'ba', w: ['qi', 'liu', 'jiu'] },
            { k: 'q', t: '¿Cuánto es «shi» − «si»?', a: 'liu', w: ['wu', 'qi', 'san'] },
          ] },
        { id: 'r2', name: 'Ronda 2', blurb: 'no, y, un poquito, las partículas ma, ne, le',
          words: [W('bu', 'no'), W('he', 'y'), W('yidianr', 'un poquito'), W('zaijian', 'adiós'), W('mei guanxi', 'no pasa nada'),
            G('ma', '¿…? (pregunta de sí o no)'), G('ne', '¿y tú…?'), G('le', 'ya (acción terminada)')],
          items: [
            { k: 'f', s: 'Ni shi xuesheng ___?', a: 'ma', bank: ['ne', 'le', 'de'], t: 'Completa «¿Eres estudiante?»: «Ni shi xuesheng ___?»' },
            { k: 'f', s: 'Wo hen hao, ni ___?', a: 'ne', bank: ['ma', 'le', 'de'], t: 'Completa «Yo bien, ¿y tú?»: «Wo hen hao, ni ___?»' },
            { k: 'f', s: 'Wo chi ___ fan.', a: 'le', bank: ['ma', 'ne', 'de'], t: 'Completa «Ya comí»: «Wo chi ___ fan.»' },
            { k: 'q', t: 'Completa «Yo y tú»: «Wo ___ ni.»', a: 'he', w: ['ma', 'ne', 'le'] },
          ] },
      ],
    },
    {
      id: 'pinyin', name: 'Pinyin básico', emoji: '🔤',
      rounds: [
        { id: 'r1', name: 'Ronda 1', blurb: 'hola, adiós, gracias, de nada',
          words: [W('ni hao', 'hola'), W('zaijian', 'adiós'), W('xiexie', 'gracias'), W('bu keqi', 'de nada'),
            W('wo', 'yo'), W('ni', 'tú'), W('ta', 'él / ella'), W('hao', 'bien / bueno'), W('bu', 'no')],
          items: [
            { k: 'q', t: 'Te encuentras a un amigo. ¿Qué dices?', a: 'Ni hao!', w: ['Zaijian!', 'Bu keqi.', 'Duibuqi.'] },
            { k: 'q', t: 'Te vas de la escuela. ¿Qué dices?', a: 'Zaijian!', w: ['Ni hao!', 'Xiexie.', 'Bu keqi.'] },
            { k: 'r', a: 'Xiexie.', b: 'Bu keqi.', w: ['Ni hao!', 'Wo hen hao.', 'Wo qu Beijing.'] },
            { k: 'm', py: 'Ni hao ma?', es: '¿Estás bien?' },
            { k: 'm', py: 'Wo hen hao.', es: 'Estoy muy bien.' },
            { k: 'm', py: 'Bu, xiexie.', es: 'No, gracias.' },
          ] },
      ],
    },
    {
      id: 'simulacro', name: 'Simulacro del examen', emoji: '📝',
      rounds: SIMS.map((s) => ({ id: 's' + s.n, name: 'Simulacro ' + s.n, blurb: 'lectura, preguntas 21–40 del examen',
        items: s.items, keepOrder: true })),
    },
  ],
};
