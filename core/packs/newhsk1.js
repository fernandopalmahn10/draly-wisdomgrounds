// New HSK 1 question packs (2026-10-12). Source: the official New HSK 1 word list (300 words, Downloads\IMPORTANT
// DOCUMENTS\CURRICULUM STRUCTURE\NEW HSK\NEW HSK 1) and the mother file «New HSK 1 · Simulaciones 1–2» (built from
// core/yct/newhsk1-sim*.json; Spanish in newhsk1-es.json, shared with scripts/packs/make_mother_file.js).
// Worlds = his 8 New HSK 1 experiences (the former HSK 2 base, absorbed into New HSK 1 on 2026-10-11).
// Only words of the New HSK 1 list (game rule: level words only); hz is kept for reference and never shown.
// Same round kinds and rules as core/packs/yct1.js (pinyin without tone marks, no hanzi on screen).
// img: file name in public/assets/packs/newhsk1/<world>/<img>.webp (shown only once the picture exists).
'use strict';

const fs = require('fs');
const path = require('path');
const ES = require('./newhsk1-es.json');

const W = (hz, py, es, img) => ({ hz, py, es, img: img || null });
const G = (hz, py, es) => ({ hz, py, es, gram: true });
const f = (s, a, bank, t) => ({ k: 'f', s, a, bank, t });

const worlds = [
  {
    id: 'familia', name: 'EXP1 · La Familia Grande', emoji: '👨‍👩‍👧',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'papá, mamá, hermanos, hijos', words: [
        W('爸爸', 'baba', 'papá', 'baba'), W('妈妈', 'mama', 'mamá', 'mama'), W('哥哥', 'gege', 'hermano mayor', 'gege'),
        W('姐姐', 'jiejie', 'hermana mayor', 'jiejie'), W('弟弟', 'didi', 'hermano menor', 'didi'), W('妹妹', 'meimei', 'hermana menor', 'meimei'),
        W('儿子', 'erzi', 'hijo', 'erzi'), W('女儿', "nü'er", 'hija', 'nuer'), W('孩子', 'haizi', 'niño / hijo', 'haizi'),
        W('家人', 'jiaren', 'familiares', 'jiaren')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'yo, tú, usted, él, ella, nosotros', words: [
        W('我', 'wo', 'yo'), W('你', 'ni', 'tú'), W('您', 'nin', 'usted'), W('他', 'ta', 'él'), W('她', 'ta', 'ella'),
        W('它', 'ta', 'eso (animal o cosa)'), W('我们', 'women', 'nosotros'), W('你们', 'nimen', 'ustedes'),
        W('他们', 'tamen', 'ellos'), W('她们', 'tamen', 'ellas'), W('它们', 'tamen', 'ellos (animales o cosas)'), W('大家', 'dajia', 'todos'), G('们', 'men', 'plural de personas')],
      items: [
        { k: 'q', t: 'Aileen habla de sí misma: «___ jiao Aileen.» ¿Qué palabra falta?', a: 'Wo', w: ['Ni', 'Ta', 'Nin'] },
        { k: 'q', t: 'Dralingo saluda con respeto a Profe Fer: «___ hao, laoshi!» ¿Qué palabra falta?', a: 'Nin', w: ['Wo', 'Ta', 'Women'] },
        { k: 'q', t: 'Hamdan habla de Latifa y Aileen: «___ shi wo de pengyou.» ¿Qué palabra falta?', a: 'Tamen', w: ['Women', 'Wo', 'Nin'] },
      ] },
      { id: 'r3', name: 'Ronda 3', blurb: 'amigos, personas, señor, señora', words: [
        W('朋友', 'pengyou', 'amigo / amiga', 'pengyou'), W('男朋友', 'nan pengyou', 'novio'), W('女朋友', 'nü pengyou', 'novia'),
        W('男', 'nan', 'hombre (masculino)'), W('女', 'nü', 'mujer (femenino)'), W('人', 'ren', 'persona', 'ren'),
        W('先生', 'xiansheng', 'señor', 'xiansheng'), W('女士', 'nüshi', 'señora'), W('小朋友', 'xiao pengyou', 'niño (pequeño)')] },
      { id: 'r4', name: 'Ronda 4', blurb: 'casa, tener, amar, llamarse, conocer', words: [
        W('家', 'jia', 'casa / familia', 'jia'), W('有', 'you', 'tener / haber', 'you'), W('爱', 'ai', 'amar', 'ai'),
        W('叫', 'jiao', 'llamarse'), W('名字', 'mingzi', 'nombre'), W('认识', 'renshi', 'conocer (a alguien)'),
        W('是', 'shi', 'ser / es'), W('和', 'he', 'y'), W('岁', 'sui', 'años (de edad)'), G('口', 'kou', 'medida para personas de la familia')],
      items: [
        f('Wo jia you si ___ ren.', 'kou', ['ben', 'zhi', 'jian'], 'Completa «En mi familia somos cuatro»: «Wo jia you si ___ ren.»'),
        { k: 'r', a: 'Ni jiao shenme mingzi?', b: 'Wo jiao Hamdan.', w: ['Wo hen hao.', 'Bu keqi.', 'Mei guanxi.'] },
        { k: 'r', a: 'Ni duo da?', b: 'Wo qi sui.', w: ['Wo hen hao.', 'Bu keqi.', 'Wo jiao Hamdan.'] },
      ] },
      { id: 'r5', name: 'Ronda 5', blurb: 'perro, gato, gustar, mirar, ver', words: [
        W('狗', 'gou', 'perro', 'gou'), W('猫', 'mao', 'gato', 'mao'), W('喜欢', 'xihuan', 'gustar', 'xihuan'),
        W('看', 'kan', 'mirar / ver', 'kan'), W('看见', 'kanjian', 'ver (alcanzar a ver)')],
      items: [
        { k: 'm', py: 'Zai zher keyi kanjian liang zhi xiao mao.', es: 'Aquí se ven dos gatitos.' },
        { k: 'm', py: 'Jiejie ai chi shenme?', es: '¿Qué le gusta comer a la hermana mayor?' },
      ] },
    ],
  },
  {
    id: 'escuela', name: 'EXP2 · Un Día en la Escuela', emoji: '🎓',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'escuela, estudiante, maestra, libro', words: [
        W('学校', 'xuexiao', 'escuela', 'xuexiao'), W('学生', 'xuesheng', 'estudiante', 'xuesheng'), W('同学', 'tongxue', 'compañero de clase', 'tongxue'),
        W('老师', 'laoshi', 'maestro / maestra', 'laoshi'), W('课', 'ke', 'clase (lección)'), W('书', 'shu', 'libro', 'shu'),
        W('字', 'zi', 'carácter (letra china)'), W('汉字', 'Hanzi', 'carácter (letra china)'), G('本', 'ben', 'medida para libros')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'primaria, secundaria, universidad, ir a clase', words: [
        W('小学', 'xiaoxue', 'escuela primaria'), W('中学', 'zhongxue', 'escuela secundaria'), W('大学', 'daxue', 'universidad', 'daxue'),
        W('小学生', 'xiaoxuesheng', 'alumno de primaria'), W('中学生', 'zhongxuesheng', 'alumno de secundaria'),
        W('大学生', 'daxuesheng', 'universitario'), W('上学', 'shangxue', 'ir a la escuela'), W('上课', 'shangke', 'empezar la clase'),
        W('下课', 'xiake', 'terminar la clase')] },
      { id: 'r3', name: 'Ronda 3', blurb: 'estudiar, leer, escribir, hablar, escuchar', words: [
        W('学', 'xue', 'estudiar / aprender'), W('学习', 'xuexi', 'estudiar / aprender', 'xuexi'), W('读', 'du', 'leer (en voz alta)', 'du'),
        W('读书', 'dushu', 'leer libros / estudiar'), W('写', 'xie', 'escribir', 'xie'), W('汉语', 'Hanyu', 'chino mandarín'),
        W('中文', 'Zhongwen', 'chino mandarín (escrito)'), W('说', 'shuo', 'hablar / decir', 'shuo'), W('说话', 'shuohua', 'hablar'),
        W('听', 'ting', 'escuchar', 'ting')] },
      { id: 'r4', name: 'Ronda 4', blurb: 'saber, poder, preguntar, pensar, ver', words: [
        W('会', 'hui', 'saber (hacer algo)'), W('能', 'neng', 'poder'), W('可以', 'keyi', 'poder (tener permiso)'), W('知道', 'zhidao', 'saber (algo)'),
        W('觉得', 'juede', 'pensar / sentir'), W('想', 'xiang', 'querer / pensar'), W('问', 'wen', 'preguntar'), W('问题', 'wenti', 'pregunta / problema'),
        W('听见', 'tingjian', 'oír'), W('对', 'dui', 'correcto'), G('第', 'di', 'número ordinal (primero, segundo…)')],
      items: [
        f('Wo ___ shuo Hanyu.', 'hui', ['kan', 'du', 'ting'], 'Completa «Sé hablar chino mandarín»: «Wo ___ shuo Hanyu.»'),
        f('Wo mai le yi ___ shu.', 'ben', ['zhi', 'jian', 'kou'], 'Completa «Compré un libro»: «Wo mai le yi ___ shu.»'),
        // dì (the order: dì yī, dì èr…), in the simulations' own options (2026-10-18)
        f('Jintian shi wo ___ yi tian shang xue.', 'di', ['de', 'ge', 'le'], 'Completa «Hoy es mi primer día de escuela»: «Jintian shi wo ___ yi tian shang xue.»'),
        { k: 'q', t: '¿Cómo se dice «la segunda clase» en Chino Mandarín?', a: 'di er ge ke', w: ['er ge ke', 'liang ge ke', 'er ke'] },
      ] },
    ],
  },
  {
    id: 'restaurante', name: 'EXP3 · El Restaurante Chino', emoji: '🥢',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'arroz, fideos, jiaozi, baozi, pan, huevo, fruta', words: [
        W('饭', 'fan', 'comida'), W('米饭', 'mifan', 'arroz', 'mifan'), W('面条儿', 'miantiaor', 'fideos', 'miantiaor'),
        W('饺子', 'jiaozi', 'jiaozi (empanaditas chinas)', 'jiaozi'), W('包子', 'baozi', 'baozi (bollo al vapor)', 'baozi'),
        W('面包', 'mianbao', 'pan', 'mianbao'), W('鸡蛋', 'jidan', 'huevo', 'jidan'), W('菜', 'cai', 'plato (comida) / verdura', 'cai'),
        W('水果', 'shuiguo', 'fruta', 'shuiguo'), W('苹果', 'pingguo', 'manzana', 'pingguo')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'agua, té, leche, desayuno, almuerzo, cena', words: [
        W('水', 'shui', 'agua', 'shui'), W('茶', 'cha', 'té', 'cha'), W('牛奶', 'niunai', 'leche', 'niunai'), W('杯子', 'beizi', 'vaso / taza', 'beizi'),
        W('早饭', 'zaofan', 'desayuno', 'zaofan'), W('午饭', 'wufan', 'almuerzo', 'wufan'), W('晚饭', 'wanfan', 'cena', 'wanfan'),
        W('好吃', 'haochi', 'rico (sabroso)', 'haochi'), W('饭店', 'fandian', 'restaurante', 'fandian'), W('做饭', 'zuofan', 'cocinar', 'zuofan')] },
      { id: 'r3', name: 'Ronda 3', blurb: 'comer, beber, pedir, dar, por favor', words: [
        W('吃', 'chi', 'comer', 'chi'), W('喝', 'he', 'beber', 'he'), W('要', 'yao', 'querer / pedir'), W('给', 'gei', 'dar'),
        W('做', 'zuo', 'hacer'), W('请', 'qing', 'por favor / invitar'), W('好', 'hao', 'bueno / bien'), W('再', 'zai', 'otra vez'),
        W('一些', 'yixie', 'un poco / algunos'), W('有点儿', 'youdianr', 'un poquito (algo)'), W('点儿', 'dianr', 'un poco')],
      items: [
        { k: 'm', py: 'Ni de mifan tai shao le, zai gei ni yixie ba.', es: ES['Ni de mifan tai shao le, zai gei ni yixie ba.'] },
        { k: 'm', py: 'Wanfan, wo xiang chi miantiao.', es: 'Para la cena quiero comer fideos.' },
        { k: 'r', a: 'Ni he dian shenme?', b: 'Niunai.', w: ['Shudian.', 'Xia yu le.', 'Wo bu hui.'] },
      ] },
    ],
  },
  {
    id: 'tienda', name: 'EXP4 · La Tienda de Ropa', emoji: '👗',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'tienda, supermercado, comprar, vender, dinero', words: [
        W('商店', 'shangdian', 'tienda', 'shangdian'), W('超市', 'chaoshi', 'supermercado', 'chaoshi'), W('店', 'dian', 'tienda'),
        W('书店', 'shudian', 'librería', 'shudian'), W('买', 'mai', 'comprar', 'mai'), W('卖', 'mai', 'vender'),
        W('东西', 'dongxi', 'cosa'), W('钱', 'qian', 'dinero', 'qian'), W('块', 'kuai', 'yuan (al hablar)'), W('元', 'yuan', 'yuan (la moneda)')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'ropa, caro, barato, bonito, nuevo', words: [
        W('衣服', 'yifu', 'ropa', 'yifu'), W('穿', 'chuan', 'ponerse (ropa)', 'chuan'), W('贵', 'gui', 'caro'),
        W('便宜', 'pianyi', 'barato'), W('漂亮', 'piaoliang', 'bonito / bonita', 'piaoliang'), W('好看', 'haokan', 'bonito (lindo)'),
        W('新', 'xin', 'nuevo', 'xin'), W('大', 'da', 'grande', 'da'), W('小', 'xiao', 'pequeño', 'xiao'), W('多少', 'duoshao', '¿cuánto?'),
        G('件', 'jian', 'medida para ropa')],
      items: [
        { k: 'q', t: 'En la tienda, ¿cómo preguntas el precio?', a: 'Duoshao qian?', w: ['Ni hao ma?', 'Ji dian?', 'Zai nar?'] },
        f('Zhe ___ yifu hen piaoliang.', 'jian', ['ben', 'zhi', 'kou'], 'Completa «Esta prenda es muy bonita»: «Zhe ___ yifu hen piaoliang.»'),
      ] },
      { id: 'r3', name: 'Ronda 3', blurb: 'los números del 1 al 9', words: [
        W('一', 'yi', 'uno', 'yi'), W('二', 'er', 'dos', 'er'), W('两', 'liang', 'dos (cantidad)'), W('三', 'san', 'tres', 'san'),
        W('四', 'si', 'cuatro', 'si'), W('五', 'wu', 'cinco', 'wu'), W('六', 'liu', 'seis', 'liu'), W('七', 'qi', 'siete', 'qi'),
        W('八', 'ba', 'ocho', 'ba'), W('九', 'jiu', 'nueve', 'jiu')] },
      { id: 'r4', name: 'Ronda 4', blurb: 'diez, cien, mil, cero, medio, ¿cuántos?', words: [
        W('十', 'shi', 'diez', 'shi'), W('百', 'bai', 'cien'), W('千', 'qian', 'mil'), W('零', 'ling', 'cero'),
        W('半', 'ban', 'medio / mitad'), W('一半', 'yiban', 'la mitad'), W('几', 'ji', '¿cuántos? (pocos)'), W('多', 'duo', 'mucho / muchos'),
        W('少', 'shao', 'poco / pocos'), G('个', 'ge', 'medida general'), G('只', 'zhi', 'medida para animales')],
      items: [
        f('Wo you liang ___ gou.', 'zhi', ['ben', 'jian', 'kou'], 'Completa «Tengo dos perros»: «Wo you liang ___ gou.»'),
        { k: 'q', t: '¿Cuánto es «wu» + «san»?', a: 'ba', w: ['qi', 'liu', 'jiu'] },
        // gè and the prices, as the simulations ask them (2026-10-18)
        f('Wo mai le san ___ pingguo.', 'ge', ['ben', 'jian', 'zhi'], 'Completa «Compré tres manzanas»: «Wo mai le san ___ pingguo.»'),
        { k: 'm', py: 'Zhe jian yifu ershi kuai.', es: 'Esta ropa cuesta veinte yuanes.' },
        { k: 'r', a: 'Zhege beizi duoshao qian?', b: 'Shiwu kuai.', w: ['Liang ge.', 'Xingqitian.', 'Zai zhuozi shang.'] },
      ] },
    ],
  },
  {
    id: 'rutina', name: 'EXP5 · Mi Rutina y el Clima', emoji: '⏰',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'hoy, mañana, ayer, semana, domingo, mes', words: [
        W('今天', 'jintian', 'hoy'), W('明天', 'mingtian', 'mañana (el día de mañana)'), W('昨天', 'zuotian', 'ayer'),
        W('天', 'tian', 'día'), W('日', 'ri', 'día (en la fecha)'), W('号', 'hao', 'día del mes'), W('星期', 'xingqi', 'semana'),
        W('星期天', 'xingqitian', 'domingo'), W('星期日', 'xingqiri', 'domingo'), W('月', 'yue', 'mes')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'año, la hora, minuto, ahora', words: [
        W('年', 'nian', 'año'), W('今年', 'jinnian', 'este año'), W('明年', 'mingnian', 'el próximo año'), W('去年', 'qunian', 'el año pasado'),
        W('点', 'dian', 'en punto (la hora)'), W('分', 'fen', 'minuto'), W('分钟', 'fenzhong', 'minuto (duración)'), W('小时', 'xiaoshi', 'hora (60 minutos)'),
        W('时间', 'shijian', 'tiempo'), W('时候', 'shihou', 'momento / cuando'), W('现在', 'xianzai', 'ahora')] },
      { id: 'r3', name: 'Ronda 3', blurb: 'la mañana, el mediodía, la tarde, la noche', words: [
        W('早上', 'zaoshang', 'muy temprano en la mañana'), W('上午', 'shangwu', 'antes del mediodía'), W('中午', 'zhongwu', 'mediodía'),
        W('下午', 'xiawu', 'después del mediodía'), W('晚上', 'wanshang', 'la noche'), W('白天', 'baitian', 'de día'),
        W('早', 'zao', 'temprano'), W('晚', 'wan', 'ya es tarde (tardío)')] },
      { id: 'r4', name: 'Ronda 4', blurb: 'levantarse, dormir, descansar, trabajar', words: [
        W('起床', 'qichuang', 'levantarse', 'qichuang'), W('睡觉', 'shuijiao', 'dormir'), W('睡', 'shui', 'dormir'), W('休息', 'xiuxi', 'descansar', 'xiuxi'),
        W('上班', 'shangban', 'ir a trabajar', 'shangban'), W('下班', 'xiaban', 'salir del trabajo'), W('忙', 'mang', 'ocupado', 'mang'),
        W('正在', 'zhengzai', 'estar (haciendo algo)')] },
      { id: 'r5', name: 'Ronda 5', blurb: 'clima, calor, frío, lluvia, nieve', words: [
        W('天气', 'tianqi', 'clima', 'tianqi'), W('热', 're', 'calor / caluroso', 're'), W('冷', 'leng', 'frío', 'leng'),
        W('下雨', 'xia yu', 'llover', 'xiayu'), W('雨', 'yu', 'lluvia', 'xiayu'), W('雪', 'xue', 'nieve', 'xue')],
      items: [
        { k: 'm', py: 'Xia yu le, hen leng.', es: 'Está lloviendo, hace mucho frío.' },
        { k: 'm', py: 'Jintian tianqi zenmeyang?', es: ES['Jintian tianqi zenmeyang?'] },
      ] },
    ],
  },
  {
    id: 'salud', name: 'EXP6 · Deportes y Salud', emoji: '⚽',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'enfermo, médico, hospital, jugar, contento', words: [
        W('病', 'bing', 'enfermedad'), W('生病', 'shengbing', 'enfermarse', 'shengbing'), W('看病', 'kanbing', 'ir al médico'),
        W('医生', 'yisheng', 'médico', 'yisheng'), W('医院', 'yiyuan', 'hospital', 'yiyuan'), W('没事', 'meishi', 'estoy bien / no pasa nada'),
        W('高兴', 'gaoxing', 'contento', 'gaoxing'), W('玩', 'wan', 'jugar', 'wan')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'cantar, canción, película, televisión, teléfono', words: [
        W('唱', 'chang', 'cantar', 'changge'), W('歌', 'ge', 'canción'), W('好听', 'haoting', 'suena bonito'), W('好玩儿', 'haowanr', 'divertido'),
        W('电影', 'dianying', 'película', 'dianying'), W('电影院', 'dianyingyuan', 'cine'), W('电视', 'dianshi', 'televisión', 'dianshi'),
        W('电脑', 'diannao', 'computadora', 'diannao'), W('手机', 'shouji', 'celular', 'shouji'), W('电话', 'dianhua', 'teléfono'),
        W('打电话', 'da dianhua', 'llamar por teléfono', 'dadianhua'), W('喂', 'wei', '¡aló! (al teléfono)')] },
    ],
  },
  {
    id: 'china', name: 'EXP7 · Aventura por China', emoji: '🚄',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: 'China, país, tren, avión, taxi, ir, venir', words: [
        W('中国', 'Zhongguo', 'China', 'zhongguo'), W('国', 'guo', 'país'), W('火车', 'huoche', 'tren', 'huoche'), W('飞机', 'feiji', 'avión', 'feiji'),
        W('出租车', 'chuzuche', 'taxi', 'chuzuche'), W('车', 'che', 'carro / auto'), W('开车', 'kaiche', 'manejar (un carro)'),
        W('去', 'qu', 'ir'), W('来', 'lai', 'venir'), W('回', 'hui', 'volver')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'llegar, vivir, sentarse, buscar, oficina, cuarto', words: [
        W('到', 'dao', 'llegar'), W('住', 'zhu', 'vivir / quedarse'), W('坐', 'zuo', 'sentarse / ir en (tren, avión…)'), W('找', 'zhao', 'buscar'),
        W('见', 'jian', 'encontrarse / ver'), W('公司', 'gongsi', 'empresa / oficina'), W('工作', 'gongzuo', 'trabajo / trabajar', 'gongzuo'),
        W('房间', 'fangjian', 'cuarto (habitación)'), W('桌子', 'zhuozi', 'mesa', 'zhuozi'), W('椅子', 'yizi', 'silla', 'yizi'),
        W('开', 'kai', 'abrir / encender', 'kai')] },
      { id: 'r3', name: 'Ronda 3', blurb: 'dentro, afuera, arriba, abajo, adelante, atrás', words: [
        W('里', 'li', 'dentro'), W('外', 'wai', 'afuera'), W('外边', 'waibian', 'afuera (el lado de afuera)'), W('上', 'shang', 'arriba / sobre', 'shang'),
        W('下', 'xia', 'abajo / debajo', 'xia'), W('前', 'qian', 'adelante', 'qianmian'), W('后', 'hou', 'atrás / después', 'houmian'), W('边', 'bian', 'lado')],
      items: [
        f('Xiao mao zai yizi ___ mian.', 'shang', ['xia', 'li', 'wai'], 'Completa «El gatito está SOBRE la silla»: «Xiao mao zai yizi ___ mian.»'),
      ] },
    ],
  },
  {
    id: 'magicas', name: 'EXP8 · Palabras Mágicas II', emoji: '🪄',
    rounds: [
      { id: 'r1', name: 'Ronda 1', blurb: '¿qué?, ¿quién?, ¿cuál?, ¿dónde?, ¿cómo?', words: [
        W('什么', 'shenme', '¿qué?'), W('谁', 'shei', '¿quién?'), W('哪', 'na', '¿cuál?'), W('哪个', 'nage', '¿cuál?'), W('哪些', 'naxie', '¿cuáles?'),
        W('哪儿', 'nar', '¿dónde?'), W('哪里', 'nali', '¿dónde?'), W('怎么', 'zenme', '¿cómo?'), W('怎么样', 'zenmeyang', '¿qué tal?')] },
      { id: 'r2', name: 'Ronda 2', blurb: 'este, ese, aquí, allá, estos, esos', words: [
        W('这', 'zhe', 'este / esto'), W('那', 'na', 'ese / eso'), W('这儿', 'zher', 'aquí'), W('这里', 'zheli', 'aquí'), W('这边', 'zhebian', 'aquí (este lado)'),
        W('那儿', 'nar', 'allá'), W('那里', 'nali', 'allá'), W('那边', 'nabian', 'allá (ese lado)'), W('这个', 'zhege', 'este (uno)'),
        W('那个', 'nage', 'ese (uno)'), W('这些', 'zhexie', 'estos'), W('那些', 'naxie', 'esos')] },
      { id: 'r3', name: 'Ronda 3', blurb: 'hola, gracias, de nada, perdón, adiós', words: [
        W('你好', 'ni hao', 'hola'), W('谢谢', 'xiexie', 'gracias', 'xiexie'), W('不客气', 'bu keqi', 'de nada'), W('对不起', 'duibuqi', 'perdón'),
        W('没关系', 'mei guanxi', 'no pasa nada / no importa'), W('再见', 'zaijian', 'adiós', 'zaijian'), W('请问', 'qingwen', 'disculpe (para preguntar)')],
      items: [
        { k: 'r', a: 'Xiexie!', b: 'Bu keqi.', w: ['Ni hao!', 'Duoshao qian?', 'Wo qu Zhongguo.'] },
        { k: 'r', a: 'Duibuqi!', b: 'Mei guanxi.', w: ['Ni hao!', 'Duoshao qian?', 'Hen duo.'] },
      ] },
      { id: 'r4', name: 'Ronda 4', blurb: 'no, también, todos, muy, demasiado', words: [
        W('不', 'bu', 'no'), W('没', 'mei', 'no (no hay / no hizo)'), W('不要', 'bu yao', 'no quiero / no hagas'), W('也', 'ye', 'también'),
        W('都', 'dou', 'todos / ambos'), W('很', 'hen', 'muy'), W('太', 'tai', 'demasiado / muy'), W('非常', 'feichang', 'muchísimo'),
        W('真', 'zhen', 'de verdad / muy'), W('还', 'hai', 'todavía'), W('有的', 'youde', 'algunos'), W('有些', 'youxie', 'algunos'),
        W('些', 'xie', 'unos (algunos)'), W('事', 'shi', 'asunto (cosa que pasa)'), W('在', 'zai', 'estar en')] },
      { id: 'r5', name: 'Ronda 5', blurb: 'las partículas ma, ne, ba, le, de', words: [
        W('一下', 'yixia', 'un momento (un poquito)'), G('吗', 'ma', '¿…? (pregunta de sí o no)'), G('呢', 'ne', '¿y…?'), G('吧', 'ba', 'sugerencia (¿vamos…?)'),
        G('了', 'le', 'ya (acción terminada)'), G('的', 'de', 'de (mi, tu, su…)')],
      items: [
        f('Ni he shui ___?', 'ma', ['ne', 'ba', 'le'], 'Completa «¿Tomas agua?»: «Ni he shui ___?»'),
        f('Wo hen hao, ni ___?', 'ne', ['ma', 'ba', 'le'], 'Completa «Yo bien, ¿y tú?»: «Wo hen hao, ni ___?»'),
        f('Women qu chaoshi ___.', 'ba', ['ma', 'ne', 'de'], 'Completa «¡Vamos al súper!»: «Women qu chaoshi ___.»'),
        f('Wo chi ___ fan.', 'le', ['ma', 'ne', 'ba'], 'Completa «Ya comí»: «Wo chi ___ fan.»'),
        f('Zhe shi wo ___ shu.', 'de', ['ma', 'ne', 'ba'], 'Completa «Este es mi libro»: «Zhe shi wo ___ shu.»'),
        f('Ni kan ___.', 'yixia', ['ma', 'ne', 'le'], 'Completa «Mira un momento»: «Ni kan ___.»'),
      ] },
    ],
  },
];

// ── Simulacros: built straight from the platform's sims (core/yct/newhsk1-sim*.json) ─────────────────────────────
const SIM_DIR = path.join(__dirname, '..', 'yct');
const SIMS = fs.readdirSync(SIM_DIR).filter((n) => /^newhsk1-sim\d+\.json$/.test(n))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
  .map((n) => JSON.parse(fs.readFileSync(path.join(SIM_DIR, n), 'utf8')));
const optText = (o) => (o.pinyin || o.hanzi || '').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// 3 exam options + 1 wrong option borrowed from another item of the same part (never one of this item's own options)
function examOptions(item, others) {
  const own = item.options.map(optText);
  const right = optText(item.options.find((o) => o.label === item.answer));
  const at = others.indexOf(item);
  const rotated = others.slice(at + 1).concat(others.slice(0, at));      // start with the next item: a different extra each time
  const extra = rotated.flatMap((o) => o.options.filter((x) => x.label !== o.answer).map(optText))
    .find((t) => t && !own.includes(t));
  return { a: right, w: own.filter((t) => t !== right).concat(extra ? [extra] : []) };
}

function simRounds(sim, n) {
  const L = Object.fromEntries(sim.listening.parts.map((p) => [p.part, p]));
  const R = Object.fromEntries(sim.reading.parts.map((p) => [p.part, p]));
  const real = (p) => p.items.filter((it) => !it.example);
  const esc = [];
  real(L[1]).forEach((it) => esc.push({ k: 'm', py: it.transcript.pinyin, es: ES[it.transcript.pinyin] }));
  real(L[2]).forEach((it, _i, all) => { const o = examOptions(it, all); esc.push({ k: 'r', a: it.transcript.pinyin, b: cap(o.a), w: o.w.map(cap) }); });
  real(L[3]).forEach((it) => { const ln = it.transcript.lines; esc.push({ k: 'r', a: ln[0].pinyin, b: ln[1].pinyin }); });
  real(L[4]).forEach((it, _i, all) => {
    const [said, asked] = it.transcript.pinyin.split(/\s*Wen:\s*/);
    const o = examOptions(it, all);
    esc.push({ k: 'q', t: `Escuchas: «${said}» Pregunta: «${asked}»`, a: o.a, w: o.w });
  });
  const lec = [];
  real(R[1]).forEach((it) => lec.push({ k: 'm', py: it.pinyin, es: ES[it.pinyin] }));
  const bank2 = R[2].bank.map((b) => b.pinyin);
  real(R[2]).forEach((it) => {
    const b = R[2].bank.find((x) => x.label === it.answer).pinyin;
    lec.push({ k: 'r', a: it.pinyin, b, w: bank2.filter((x) => x !== b) });
  });
  const bank3 = R[3].bank.map((b) => b.pinyin);
  real(R[3]).forEach((it) => {
    const a = R[3].bank.find((x) => x.label === it.answer).pinyin;
    const s = it.dialogue ? it.dialogue.map((l) => l.pinyin).join(' — ') : it.pinyin;
    lec.push({ k: 'f', s, a, bank: bank3.filter((x) => x !== a) });
  });
  real(R[4]).forEach((it, _i, all) => {
    const o = examOptions(it, all);
    lec.push({ k: 'q', t: `Lees: «${it.passage.pinyin}» ${it.question.pinyin}`, a: o.a, w: o.w });
  });
  return [
    { id: 's' + n + 'e', name: 'Simulacro ' + n + ' · Escucha', blurb: 'preguntas 1–20 del examen', items: esc, keepOrder: true },
    { id: 's' + n + 'l', name: 'Simulacro ' + n + ' · Lectura', blurb: 'preguntas 21–40 del examen', items: lec, keepOrder: true },
  ];
}

worlds.push({ id: 'simulacro', name: 'Simulacro del examen', emoji: '📝', rounds: SIMS.flatMap((s, i) => simRounds(s, i + 1)) });

module.exports = { id: 'newhsk1', name: 'New HSK 1', dir: 'newhsk1', worlds };
