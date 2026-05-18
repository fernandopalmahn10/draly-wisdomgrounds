// Build HSK1 EXP4..EXP8 question banks as .xlsx, matching the style of
// data/sets/hsk1-market-pinyin-spanish.xlsx. Each file gets ~30 questions:
// - Forward recognition: "¿Qué significa X (pinyin)?" → Spanish meaning
// - Reverse recall: "¿Cómo se dice [Spanish] en chino?" → Hanzi (pinyin)
// - A few applied/usage questions to keep variety
//
// Columns: question | correct | wrong1 | wrong2 | wrong3

'use strict';
const path = require('path');
const xlsx = require('xlsx');

const OUT_DIR = path.join(__dirname, '..', 'data', 'sets');

// ─── EXP4 — Tiempo, días y clima ────────────────────────────────────────────
const EXP4 = {
  filename: 'hsk1-exp4-tiempo-clima.xlsx',
  sheet:    'HSK1 Tiempo y Clima',
  rows: [
    ['question','correct','wrong1','wrong2','wrong3'],

    // Forward — meaning
    ['¿Qué significa 点 (diǎn)?','en punto (hora)','minuto','segundo','día'],
    ['¿Qué significa 分钟 (fēnzhōng)?','minuto','hora','segundo','semana'],
    ['¿Qué significa 现在 (xiànzài)?','ahora','después','antes','ayer'],
    ['¿Qué significa 时候 (shíhou)?','momento/tiempo','reloj','día','año'],
    ['¿Qué significa 今天 (jīntiān)?','hoy','mañana','ayer','después'],
    ['¿Qué significa 明天 (míngtiān)?','mañana','hoy','ayer','tarde'],
    ['¿Qué significa 昨天 (zuótiān)?','ayer','mañana','hoy','semana'],
    ['¿Qué significa 上午 (shàngwǔ)?','mañana (AM)','tarde','noche','mediodía'],
    ['¿Qué significa 中午 (zhōngwǔ)?','mediodía','medianoche','mañana','tarde'],
    ['¿Qué significa 下午 (xiàwǔ)?','tarde (PM)','mañana','noche','mediodía'],
    ['¿Qué significa 星期 (xīngqī)?','semana','mes','día','año'],
    ['¿Qué significa 月 (yuè)?','mes','semana','año','día'],
    ['¿Qué significa 年 (nián)?','año','mes','día','semana'],
    ['¿Qué significa 号 (hào)?','día del mes','número','hora','año'],
    ['¿Qué significa 天气 (tiānqì)?','clima/tiempo','cielo','día','sol'],
    ['¿Qué significa 热 (rè)?','calor','frío','fresco','tibio'],
    ['¿Qué significa 冷 (lěng)?','frío','calor','fresco','tibio'],
    ['¿Qué significa 下雨 (xiàyǔ)?','llover','nevar','soplar','tronar'],
    ['¿Qué significa 太 (tài)?','demasiado','muy','un poco','bastante'],
    ['¿Qué significa 很 (hěn)?','muy','poco','demasiado','nada'],

    // Reverse — recall
    ['¿Cómo se dice "hoy" en chino?','今天 (jīntiān)','明天 (míngtiān)','昨天 (zuótiān)','现在 (xiànzài)'],
    ['¿Cómo se dice "mañana" en chino?','明天 (míngtiān)','今天 (jīntiān)','昨天 (zuótiān)','上午 (shàngwǔ)'],
    ['¿Cómo se dice "ayer" en chino?','昨天 (zuótiān)','今天 (jīntiān)','明天 (míngtiān)','现在 (xiànzài)'],
    ['¿Cómo se dice "clima" en chino?','天气 (tiānqì)','天 (tiān)','时候 (shíhou)','现在 (xiànzài)'],
    ['¿Cómo se dice "llover" en chino?','下雨 (xiàyǔ)','下午 (xiàwǔ)','下 (xià)','热 (rè)'],
    ['¿Cómo se dice "frío" en chino?','冷 (lěng)','热 (rè)','下雨 (xiàyǔ)','太 (tài)'],
    ['¿Cómo se dice "muy" en chino?','很 (hěn)','太 (tài)','一点儿 (yīdiǎnr)','多 (duō)'],

    // Applied / contextual
    ['Hoy hace mucho calor. ¿Qué palabra usas?','热 (rè)','冷 (lěng)','下雨 (xiàyǔ)','天气 (tiānqì)'],
    ['"Son las 3 en punto" → 三 ___ ?','点 (diǎn)','分钟 (fēnzhōng)','号 (hào)','月 (yuè)'],
    ['Frase: "Hoy hace frío" en chino','今天很冷 (jīntiān hěn lěng)','今天很热 (jīntiān hěn rè)','明天很冷 (míngtiān hěn lěng)','昨天很冷 (zuótiān hěn lěng)'],
    ['¿Qué palabra significa "demasiado" (exceso)?','太 (tài)','很 (hěn)','多 (duō)','大 (dà)'],
    ['¿Qué viene primero en el día?','上午 (shàngwǔ)','中午 (zhōngwǔ)','下午 (xiàwǔ)','晚上'],
  ],
};

// ─── EXP5 — Viajes y direcciones ────────────────────────────────────────────
const EXP5 = {
  filename: 'hsk1-exp5-viajes-direcciones.xlsx',
  sheet:    'HSK1 Viajes y Direcciones',
  rows: [
    ['question','correct','wrong1','wrong2','wrong3'],

    ['¿Qué significa 北京 (běijīng)?','Pekín / Beijing','Shanghái','Cantón','China'],
    ['¿Qué significa 中国 (zhōngguó)?','China','Japón','Corea','Taiwán'],
    ['¿Qué significa 去 (qù)?','ir','venir','volver','quedarse'],
    ['¿Qué significa 来 (lái)?','venir','ir','salir','llegar'],
    ['¿Qué significa 回 (huí)?','volver/regresar','ir','venir','quedarse'],
    ['¿Qué significa 飞机 (fēijī)?','avión','tren','carro','barco'],
    ['¿Qué significa 出租车 (chūzūchē)?','taxi','autobús','tren','metro'],
    ['¿Qué significa 坐 (zuò)?','sentarse / tomar (vehículo)','parar','correr','caminar'],
    ['¿Qué significa 住 (zhù)?','vivir / residir','tener','comer','dormir'],
    ['¿Qué significa 在 (zài)?','en / estar en','con','para','de'],
    ['¿Qué significa 哪 (nǎ)?','cuál','qué','quién','cuándo'],
    ['¿Qué significa 哪儿 (nǎr)?','dónde','aquí','allí','cuándo'],
    ['¿Qué significa 那 (nà)?','aquello/eso','esto','aquí','allí'],
    ['¿Qué significa 这 (zhè)?','esto/este','aquello','aquí','dónde'],
    ['¿Qué significa 前面 (qiánmiàn)?','delante / al frente','detrás','arriba','abajo'],
    ['¿Qué significa 后面 (hòumiàn)?','detrás','delante','arriba','abajo'],
    ['¿Qué significa 上 (shàng)?','arriba/encima','abajo','delante','detrás'],
    ['¿Qué significa 下 (xià)?','abajo/debajo','arriba','delante','detrás'],

    // Reverse
    ['¿Cómo se dice "China" en chino?','中国 (zhōngguó)','北京 (běijīng)','日本 (rìběn)','美国 (měiguó)'],
    ['¿Cómo se dice "ir" en chino?','去 (qù)','来 (lái)','回 (huí)','在 (zài)'],
    ['¿Cómo se dice "venir" en chino?','来 (lái)','去 (qù)','回 (huí)','坐 (zuò)'],
    ['¿Cómo se dice "avión" en chino?','飞机 (fēijī)','出租车 (chūzūchē)','汽车','火车'],
    ['¿Cómo se dice "taxi" en chino?','出租车 (chūzūchē)','飞机 (fēijī)','公共汽车','地铁'],
    ['¿Cómo se dice "dónde" en chino?','哪儿 (nǎr)','哪 (nǎ)','这 (zhè)','那 (nà)'],

    // Applied
    ['Frase: "Yo voy a Beijing" en chino','我去北京 (wǒ qù běijīng)','我来北京 (wǒ lái běijīng)','我在北京 (wǒ zài běijīng)','我住北京 (wǒ zhù běijīng)'],
    ['Frase: "Él vive en China" en chino','他住在中国 (tā zhù zài zhōngguó)','他去中国 (tā qù zhōngguó)','他来中国 (tā lái zhōngguó)','他是中国 (tā shì zhōngguó)'],
    ['¿En cuál subes para volar?','飞机 (fēijī)','出租车 (chūzūchē)','椅子 (yǐzi)','桌子 (zhuōzi)'],
    ['Para preguntar dónde está algo, usas:','哪儿 (nǎr)','什么 (shénme)','谁 (shéi)','几 (jǐ)'],
    ['"El libro está sobre la mesa" — usa ___','上 (shàng)','下 (xià)','里 (lǐ)','在 (zài)'],
    ['¿Qué significa 坐飞机?','tomar el avión','vender el avión','comprar el avión','arreglar el avión'],
  ],
};

// ─── EXP6 — Casa, objetos y actividades ─────────────────────────────────────
const EXP6 = {
  filename: 'hsk1-exp6-casa-actividades.xlsx',
  sheet:    'HSK1 Casa y Actividades',
  rows: [
    ['question','correct','wrong1','wrong2','wrong3'],

    ['¿Qué significa 里 (lǐ)?','dentro','fuera','encima','debajo'],
    ['¿Qué significa 桌子 (zhuōzi)?','mesa','silla','cama','sofá'],
    ['¿Qué significa 椅子 (yǐzi)?','silla','mesa','cama','escritorio'],
    ['¿Qué significa 电脑 (diànnǎo)?','computadora','televisión','teléfono','radio'],
    ['¿Qué significa 电视 (diànshì)?','televisión','computadora','radio','cine'],
    ['¿Qué significa 电影 (diànyǐng)?','película','televisión','computadora','foto'],
    ['¿Qué significa 衣服 (yīfu)?','ropa','zapato','sombrero','bolsa'],
    ['¿Qué significa 开 (kāi)?','abrir / encender','cerrar / apagar','romper','tirar'],
    ['¿Qué significa 睡觉 (shuìjiào)?','dormir','despertar','comer','jugar'],
    ['¿Qué significa 做 (zuò)?','hacer','tomar','dar','ver'],
    ['¿Qué significa 工作 (gōngzuò)?','trabajar / trabajo','estudiar','jugar','descansar'],
    ['¿Qué significa 打电话 (dǎ diànhuà)?','hacer una llamada','escribir un mensaje','enviar un correo','mirar TV'],
    ['¿Qué significa 喂 (wèi)?','¿aló? (al teléfono)','adiós','gracias','perdón'],
    ['¿Qué significa 漂亮 (piàoliang)?','bonito/a','feo/a','grande','pequeño'],
    ['¿Qué significa 大 (dà)?','grande','pequeño','alto','bajo'],
    ['¿Qué significa 小 (xiǎo)?','pequeño','grande','viejo','joven'],
    ['¿Qué significa 有 (yǒu)?','tener / haber','no tener','querer','poder'],
    ['¿Qué significa 没有 (méiyǒu)?','no tener / no haber','tener','quizás','sí'],

    // Reverse
    ['¿Cómo se dice "computadora" en chino?','电脑 (diànnǎo)','电视 (diànshì)','电话','电影 (diànyǐng)'],
    ['¿Cómo se dice "televisión" en chino?','电视 (diànshì)','电脑 (diànnǎo)','电影 (diànyǐng)','电灯'],
    ['¿Cómo se dice "película" en chino?','电影 (diànyǐng)','电视 (diànshì)','音乐','故事'],
    ['¿Cómo se dice "ropa" en chino?','衣服 (yīfu)','衣 (yī)','服 (fú)','鞋'],
    ['¿Cómo se dice "trabajar" en chino?','工作 (gōngzuò)','学习 (xuéxí)','睡觉 (shuìjiào)','吃饭'],
    ['¿Cómo se dice "dormir" en chino?','睡觉 (shuìjiào)','工作 (gōngzuò)','起床','吃'],
    ['¿Cómo se dice "bonito" en chino?','漂亮 (piàoliang)','大 (dà)','好 (hǎo)','小 (xiǎo)'],

    // Applied
    ['Frase: "Tengo una computadora" en chino','我有电脑 (wǒ yǒu diànnǎo)','我没有电脑 (wǒ méiyǒu diànnǎo)','我是电脑 (wǒ shì diànnǎo)','我看电脑 (wǒ kàn diànnǎo)'],
    ['"Estoy viendo una película" → 我 ___ 电影','看 (kàn)','听 (tīng)','吃 (chī)','买 (mǎi)'],
    ['Frase: "Esta casa es bonita" en chino','这个家很漂亮 (zhège jiā hěn piàoliang)','这个家很大 (zhège jiā hěn dà)','这个家很小 (zhège jiā hěn xiǎo)','这个家不漂亮 (zhège jiā bù piàoliang)'],
    ['¿Qué dices al contestar el teléfono en chino?','喂 (wèi)','你好 (nǐ hǎo)','谢谢 (xièxie)','再见 (zàijiàn)'],
    ['¿Cuál es el opuesto de 大?','小 (xiǎo)','多 (duō)','高 (gāo)','热 (rè)'],
  ],
};

// ─── EXP7 — Personas, preguntas y cantidades ────────────────────────────────
const EXP7 = {
  filename: 'hsk1-exp7-personas-preguntas.xlsx',
  sheet:    'HSK1 Personas y Preguntas',
  rows: [
    ['question','correct','wrong1','wrong2','wrong3'],

    ['¿Qué significa 人 (rén)?','persona','niño','familia','amigo'],
    ['¿Qué significa 医生 (yīshēng)?','médico/doctor','enfermero','paciente','profesor'],
    ['¿Qué significa 医院 (yīyuàn)?','hospital','escuela','farmacia','clínica'],
    ['¿Qué significa 小姐 (xiǎojiě)?','señorita','señora','niña','muchacho'],
    ['¿Qué significa 些 (xiē)?','algunos/unos','muchos','pocos','ninguno'],
    ['¿Qué significa 多 (duō)?','muchos','pocos','algunos','todos'],
    ['¿Qué significa 少 (shǎo)?','pocos','muchos','algunos','ninguno'],
    ['¿Qué significa 个 (gè)?','clasificador general','libro','persona','animal'],
    ['¿Qué significa 谁 (shéi)?','quién','qué','dónde','cuándo'],
    ['¿Qué significa 什么 (shénme)?','qué/cuál','quién','dónde','cómo'],
    ['¿Qué significa 怎么 (zěnme)?','cómo','qué','por qué','dónde'],
    ['¿Qué significa 怎么样 (zěnmeyàng)?','¿qué tal? / ¿cómo está?','¿quién es?','¿dónde está?','¿qué es?'],
    ['¿Qué significa 几 (jǐ)?','¿cuántos? (pocos)','¿cuánto? (mucho)','algunos','muchos'],
    ['¿Qué significa 都 (dōu)?','todos / ambos','algunos','ninguno','muchos'],
    ['¿Qué significa 高兴 (gāoxìng)?','contento/feliz','triste','enojado','cansado'],
    ['¿Qué significa 对不起 (duìbuqǐ)?','lo siento / perdón','gracias','de nada','hola'],

    // Reverse
    ['¿Cómo se dice "doctor" en chino?','医生 (yīshēng)','老师 (lǎoshī)','学生 (xuésheng)','先生 (xiānsheng)'],
    ['¿Cómo se dice "hospital" en chino?','医院 (yīyuàn)','学校 (xuéxiào)','商店 (shāngdiàn)','饭店 (fàndiàn)'],
    ['¿Cómo se dice "persona" en chino?','人 (rén)','家 (jiā)','朋友 (péngyou)','名字 (míngzi)'],
    ['¿Cómo se dice "quién" en chino?','谁 (shéi)','什么 (shénme)','哪儿 (nǎr)','几 (jǐ)'],
    ['¿Cómo se dice "qué" en chino?','什么 (shénme)','谁 (shéi)','怎么 (zěnme)','哪 (nǎ)'],
    ['¿Cómo se dice "cómo" en chino?','怎么 (zěnme)','什么 (shénme)','谁 (shéi)','哪儿 (nǎr)'],
    ['¿Cómo se dice "lo siento" en chino?','对不起 (duìbuqǐ)','没关系 (méiguānxi)','谢谢 (xièxie)','再见 (zàijiàn)'],

    // Applied
    ['¿Qué responder a 对不起?','没关系 (méiguānxi)','不客气 (búkèqi)','再见 (zàijiàn)','你好 (nǐ hǎo)'],
    ['Frase: "¿Cómo estás?" en chino','你怎么样? (nǐ zěnmeyàng?)','你是谁? (nǐ shì shéi?)','你叫什么? (nǐ jiào shénme?)','你在哪? (nǐ zài nǎ?)'],
    ['Frase: "Estoy contento" en chino','我很高兴 (wǒ hěn gāoxìng)','我很热 (wǒ hěn rè)','我很冷 (wǒ hěn lěng)','我很累'],
    ['¿Cuántos años tienes? → ___ 岁?','几 (jǐ)','多少 (duōshǎo)','什么 (shénme)','怎么 (zěnme)'],
    ['Para una cantidad GRANDE (de dinero, etc.) usas:','多少 (duōshǎo)','几 (jǐ)','些 (xiē)','多 (duō)'],
    ['"Todos somos estudiantes" → 我们 ___ 是学生','都 (dōu)','也','只','很'],
    ['¿Cuál es el clasificador más usado?','个 (gè)','本 (běn)','块 (kuài)','点 (diǎn)'],
  ],
};

// ─── EXP8 — Números y partículas ────────────────────────────────────────────
const EXP8 = {
  filename: 'hsk1-exp8-numeros-particulas.xlsx',
  sheet:    'HSK1 Números y Partículas',
  rows: [
    ['question','correct','wrong1','wrong2','wrong3'],

    ['¿Qué número es 一 (yī)?','1','2','3','4'],
    ['¿Qué número es 二 (èr)?','2','1','3','5'],
    ['¿Qué número es 三 (sān)?','3','2','4','1'],
    ['¿Qué número es 四 (sì)?','4','3','5','6'],
    ['¿Qué número es 五 (wǔ)?','5','4','6','3'],
    ['¿Qué número es 六 (liù)?','6','5','7','8'],
    ['¿Qué número es 七 (qī)?','7','6','8','9'],
    ['¿Qué número es 八 (bā)?','8','7','9','6'],
    ['¿Qué número es 九 (jiǔ)?','9','8','10','7'],
    ['¿Qué número es 十 (shí)?','10','9','8','11'],
    ['¿Qué significa 一点儿 (yīdiǎnr)?','un poquito','mucho','nada','demasiado'],
    ['¿Qué significa 不 (bù)?','no / negación','sí','quizás','también'],
    ['¿Qué significa 吗 (ma)?','partícula de pregunta','¿qué?','¿quién?','negación'],
    ['¿Qué significa 呢 (ne)?','¿y tú? / partícula','sí','no','también'],
    ['¿Qué significa 了 (le)?','partícula de acción completada','pregunta','negación','y'],
    ['¿Qué significa 和 (hé)?','y','o','con','también'],
    ['¿Qué significa 再见 (zàijiàn)?','adiós','hola','gracias','por favor'],
    ['¿Qué significa 没关系 (méiguānxi)?','no importa / no pasa nada','de nada','lo siento','gracias'],

    // Reverse
    ['¿Cómo se dice "7" en chino?','七 (qī)','六 (liù)','八 (bā)','三 (sān)'],
    ['¿Cómo se dice "3" en chino?','三 (sān)','四 (sì)','二 (èr)','五 (wǔ)'],
    ['¿Cómo se dice "10" en chino?','十 (shí)','九 (jiǔ)','八 (bā)','一 (yī)'],
    ['¿Cómo se dice "no" en chino?','不 (bù)','没 (méi)','没有 (méiyǒu)','是 (shì)'],
    ['¿Cómo se dice "adiós" en chino?','再见 (zàijiàn)','你好 (nǐ hǎo)','谢谢 (xièxie)','对不起 (duìbuqǐ)'],
    ['¿Cómo se dice "y" (conjunción) en chino?','和 (hé)','也','都 (dōu)','或'],

    // Applied
    ['"¿Eres estudiante?" → 你是学生 ___ ?','吗 (ma)','呢 (ne)','了 (le)','和 (hé)'],
    ['"Yo bien, ¿y tú?" → 我很好，你 ___ ?','呢 (ne)','吗 (ma)','了 (le)','和 (hé)'],
    ['"Yo comí" → 我吃 ___','了 (le)','吗 (ma)','呢 (ne)','和 (hé)'],
    ['"Yo y tú" → 我 ___ 你','和 (hé)','也','都 (dōu)','是 (shì)'],
    ['Frase: "No quiero" en chino','我不想 (wǒ bù xiǎng)','我想 (wǒ xiǎng)','我要 (wǒ yào)','我没 (wǒ méi)'],
    ['¿Qué respuesta es válida para 对不起?','没关系 (méiguānxi)','谢谢 (xièxie)','再见 (zàijiàn)','你好 (nǐ hǎo)'],
    ['¿Cuántos son 五 + 三?','八 (bā)','七 (qī)','九 (jiǔ)','六 (liù)'],
    ['¿Cuántos son 十 - 四?','六 (liù)','五 (wǔ)','七 (qī)','八 (bā)'],
  ],
};

// ─── Write all files ────────────────────────────────────────────────────────
[EXP4, EXP5, EXP6, EXP7, EXP8].forEach((pack) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(pack.rows);
  // Give the columns sensible widths so the file is readable when opened
  ws['!cols'] = [
    { wch: 56 }, { wch: 36 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
  ];
  xlsx.utils.book_append_sheet(wb, ws, pack.sheet);
  const outPath = path.join(OUT_DIR, pack.filename);
  xlsx.writeFile(wb, outPath);
  console.log(`✓ Wrote ${pack.filename}  (${pack.rows.length - 1} questions)`);
});
