# One-time writer of the first six homework audio scripts (2026-10-11), transcribed from the PDFs in
# C:\Users\ferpa\ClaudeCode\TAREAS. New homeworks get their own JSON written directly (skill `tarea-audio`);
# this file only documents how the first batch was made. (HSK 2 was absorbed into New HSK 1 on 2026-10-11: newhsk1 ids.) Run: python _make_sources.py
#
# Each item: py = pinyin WITH tone marks exactly as in the PDF (what the kid sees), es = Spanish as in the PDF,
# zh = what the voice reads (never shown to kids). zh as a list = a pause between the parts (the kid's name slot).
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def W(*rows):
    return [{'py': p, 'es': e, 'zh': z} for p, e, z in rows]


def D(*rows):
    return [{'who': w, 'py': p, 'es': e, 'zh': z} for w, p, e, z in rows]


def write(id_, level, exp, rnd, title, tagline, pdf, codes, words, dialogue, video):
    data = {
        'id': id_, 'level': level, 'exp': exp, 'round': rnd, 'title': title, 'tagline': tagline, 'pdf': pdf,
        'tracks': [
            {'code': codes[0], 'kind': 'words', 'items': words},
            {'code': codes[1], 'kind': 'dialogue', 'items': dialogue},
            {'code': codes[2], 'kind': 'video', 'items': W(*video)},
        ],
    }
    with open(os.path.join(HERE, id_ + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('wrote', id_)


NAME = ['你好！我叫', '']   # "nǐ hǎo! wǒ jiào ___." — the gap is the kid's name

write('hsk1-e01-r1', 'hsk1', 1, 1, 'Mi Familia',
      'Tu primera clase de Chino Mandarín. La profe te pregunta tu nombre y si te gustan los gatos. ¿Qué le dices?',
      'DRALINGO_HSK1_E01_R1_MiFamilia_v1.3-propuesta.pdf', ['EXP1.1', 'EXP1.2', 'EXP1.3'],
      W(('nǐ hǎo', 'hola', '你好'), ('wǒ jiào', 'me llamo', '我叫'), ('hěn gāoxìng', 'muy contento', '很高兴'),
        ('rènshi nǐ', 'conocerte', '认识你'), ('xǐhuan', 'gustar', '喜欢'), ('bù', 'no', '不'), ('māo', 'gato', '猫'),
        ('gǒu', 'perro', '狗'), ('zàijiàn', 'adiós', '再见'), ('bàba', 'papá', '爸爸'), ('māma', 'mamá', '妈妈'),
        ('jiā', 'casa / familia', '家'), ('wǒ', 'yo', '我'), ('nǐ', 'tú', '你'), ('xièxie', 'gracias', '谢谢')),
      D(('profe', 'nǐ hǎo! nǐ jiào shénme míngzi?', '¡Hola! ¿Cómo te llamas?', '你好！你叫什么名字？'),
        ('tu', 'nǐ hǎo! wǒ jiào Dani. hěn gāoxìng rènshi nǐ!', '¡Hola! Me llamo Dani. ¡Mucho gusto!', '你好！我叫达妮。很高兴认识你！'),
        ('profe', 'wǒ yě hěn gāoxìng rènshi nǐ. nǐ xǐhuan māo ma?', 'Yo también. ¿Te gustan los gatos?', '我也很高兴认识你。你喜欢猫吗？'),
        ('tu', 'wǒ xǐhuan māo. wǒ bù xǐhuan gǒu!', 'Me gustan los gatos. ¡No me gustan los perros!', '我喜欢猫。我不喜欢狗！'),
        ('tu', 'zhè shì wǒ bàba, zhè shì wǒ māma.', 'Este es mi papá, esta es mi mamá.', '这是我爸爸，这是我妈妈。'),
        ('profe', 'hǎo! xièxie, Dani. zàijiàn!', '¡Muy bien! Gracias, Dani. ¡Adiós!', '好！谢谢，达妮。再见！'),
        ('tu', 'xièxie! zàijiàn!', '¡Gracias! ¡Adiós!', '谢谢！再见！')),
      [('nǐ hǎo! wǒ jiào ___.', '¡Hola! Me llamo ___.', NAME),
       ('hěn gāoxìng rènshi nǐ!', '¡Mucho gusto en conocerte!', '很高兴认识你！'),
       ('wǒ xǐhuan māo.', 'Me gustan los gatos.', '我喜欢猫。'),
       ('wǒ bù xǐhuan gǒu!', '¡No me gustan los perros!', '我不喜欢狗！'),
       ('zhè shì wǒ bàba, zhè shì wǒ māma.', 'Este es mi papá, esta es mi mamá.', '这是我爸爸，这是我妈妈。'),
       ('xièxie! zàijiàn!', '¡Gracias! ¡Adiós!', '谢谢！再见！')])

write('hsk1-e02-r2', 'hsk1', 2, 2, 'La Escuela',
      'Entra el señor director. Quiere saber qué miras, qué escuchas y quién es tu compañera.',
      'DRALINGO_HSK1_E02_R2_LaEscuela.pdf', ['EXP2.4', 'EXP2.5', 'EXP2.6'],
      W(('kàn', 'mirar', '看'), ('tīng', 'escuchar', '听'), ('kànjiàn', 'ver', '看见'), ('shū', 'libro', '书'),
        ('běn', '(un) libro', '本'), ('tóngxué', 'compañero', '同学'), ('xuéxí', 'estudiar', '学习'), ('néng', 'poder', '能'),
        ('xiānsheng', 'señor', '先生'), ('lǎoshī', 'profe', '老师'), ('xuésheng', 'estudiante', '学生'), ('huì', 'saber', '会'),
        ('shuō', 'hablar', '说'), ('dú', 'leer', '读'), ('xiě', 'escribir', '写')),
      D(('profe', 'nǐ hǎo! wǒ shì Wáng xiānsheng.', '¡Hola! Soy el señor Wáng.', '你好！我是王先生。'),
        ('tu', 'Wáng xiānsheng, nǐ hǎo! zhè shì wǒ tóngxué.', '¡Hola, señor Wáng! Esta es mi compañera.', '王先生，你好！这是我同学。'),
        ('profe', 'nǐmen zài xuéxiào xuéxí shénme?', '¿Qué estudian en la escuela?', '你们在学校学习什么？'),
        ('tu', 'wǒmen xuéxí hànyǔ. wǒ tīng lǎoshī, wǒ kàn shū.', 'Estudiamos chino. Escucho a la profe, miro el libro.', '我们学习汉语。我听老师，我看书。'),
        ('profe', 'nǐ kànjiàn shénme? nǐ néng shuō hànyǔ ma?', '¿Qué ves? ¿Puedes hablar chino?', '你看见什么？你能说汉语吗？'),
        ('tu', 'wǒ kànjiàn sān běn shū! wǒ néng shuō yìdiǎnr.', '¡Veo tres libros! Puedo hablar un poquito.', '我看见三本书！我能说一点儿。'),
        ('profe', 'hěn hǎo! míngtiān jiàn!', '¡Muy bien! ¡Hasta mañana!', '很好！明天见！')),
      [('nǐ hǎo! wǒ jiào ___. zhè shì wǒ tóngxué.', '¡Hola! Me llamo ___. Este es mi compañero.', ['你好！我叫', '这是我同学。']),
       ('wǒmen zài xuéxiào xuéxí hànyǔ.', 'Estudiamos chino en la escuela.', '我们在学校学习汉语。'),
       ('wǒ tīng lǎoshī, wǒ kàn shū.', 'Escucho a la profe, miro el libro.', '我听老师，我看书。'),
       ('wǒ kànjiàn sān běn shū!', '¡Veo tres libros!', '我看见三本书！'),
       ('Wáng xiānsheng, nǐ hǎo! wǒ néng shuō yìdiǎnr hànyǔ.', '¡Hola, señor Wáng! Puedo hablar un poquito de chino.', '王先生，你好！我能说一点儿汉语。'),
       ('xièxie! zàijiàn!', '¡Gracias! ¡Adiós!', '谢谢！再见！')])

write('hsk1-e03-r1', 'hsk1', 3, 1, 'El Mercadito',
      'Quieres comprar manzanas. El vendedor te mira y espera. ¿Cómo preguntas cuánto cuesta?',
      'DRALINGO_HSK1_E03_R1_ElMercadito.pdf', ['EXP3.1', 'EXP3.2', 'EXP3.3'],
      W(('mǎi', 'comprar', '买'), ('dōngxi', 'cosas', '东西'), ('duōshǎo qián', '¿cuánto cuesta?', '多少钱'),
        ('kuài', 'yuan (dinero)', '块'), ('píngguǒ', 'manzana', '苹果'), ('shuǐguǒ', 'fruta', '水果'), ('chī', 'comer', '吃'),
        ('hē', 'beber', '喝'), ('xǐhuan', 'gustar', '喜欢'), ('xiǎng', 'querer', '想'), ('shuǐ', 'agua', '水'),
        ('chá', 'té', '茶'), ('mǐfàn', 'arroz', '米饭'), ('xièxie', 'gracias', '谢谢'), ('bú kèqì', 'de nada', '不客气')),
      D(('profe', 'nǐ hǎo! nǐ xiǎng mǎi shénme?', '¡Hola! ¿Qué quieres comprar?', '你好！你想买什么？'),
        ('tu', 'wǒ xiǎng mǎi píngguǒ. zhèxiē dōngxi duōshǎo qián?', 'Quiero comprar manzanas. ¿Cuánto cuestan estas cosas?', '我想买苹果。这些东西多少钱？'),
        ('profe', 'èrshí kuài.', 'Veinte yuanes.', '二十块。'),
        ('tu', 'hǎo! wǒ hěn xǐhuan chī shuǐguǒ!', '¡Bien! ¡Me encanta comer fruta!', '好！我很喜欢吃水果！'),
        ('profe', 'nǐ hē shuǐ ma?', '¿Bebes agua?', '你喝水吗？'),
        ('tu', 'wǒ xiǎng hē chá. xièxie!', 'Quiero beber té. ¡Gracias!', '我想喝茶。谢谢！'),
        ('profe', 'bú kèqì! zàijiàn!', '¡De nada! ¡Adiós!', '不客气！再见！')),
      [('nǐ hǎo! wǒ jiào ___.', '¡Hola! Me llamo ___.', NAME),
       ('wǒ xiǎng mǎi píngguǒ.', 'Quiero comprar manzanas.', '我想买苹果。'),
       ('zhèxiē dōngxi duōshǎo qián?', '¿Cuánto cuestan estas cosas?', '这些东西多少钱？'),
       ('èrshí kuài? hǎo!', '¿Veinte yuanes? ¡Bien!', '二十块？好！'),
       ('wǒ xǐhuan chī shuǐguǒ, wǒ xǐhuan hē chá.', 'Me gusta comer fruta, me gusta beber té.', '我喜欢吃水果，我喜欢喝茶。'),
       ('xièxie! zàijiàn!', '¡Gracias! ¡Adiós!', '谢谢！再见！')])

write('hsk1-e04-r1', 'hsk1', 4, 1, '¿Qué tal el clima?',
      'La profe pregunta cómo está el clima. Hace calor… ¿o frío? ¿Hoy, ayer o mañana?',
      'DRALINGO_HSK1_E04_R1_ElClima.pdf', ['EXP4.1', 'EXP4.2', 'EXP4.3'],
      W(('tiānqì', 'clima', '天气'), ('zěnmeyàng', '¿qué tal?', '怎么样'), ('rè', 'calor', '热'), ('lěng', 'frío', '冷'),
        ('hěn', 'muy', '很'), ('tài … le', 'demasiado', '太……了'), ('jīntiān', 'hoy', '今天'), ('míngtiān', 'mañana', '明天'),
        ('zuótiān', 'ayer', '昨天'), ('xiàyǔ', 'llover', '下雨'), ('bù', 'no', '不'), ('ma', '¿…?', '吗')),
      D(('profe', 'nǐ hǎo! jīntiān tiānqì zěnmeyàng?', '¡Hola! ¿Qué tal el clima hoy?', '你好！今天天气怎么样？'),
        ('tu', 'jīntiān tiānqì hěn rè!', '¡Hoy hace mucho calor!', '今天天气很热！'),
        ('profe', 'hěn rè ma?', '¿Mucho calor?', '很热吗？'),
        ('tu', 'tài rè le! zuótiān tiānqì hěn lěng.', '¡Demasiado! Ayer hizo mucho frío.', '太热了！昨天天气很冷。'),
        ('profe', 'míngtiān ne?', '¿Y mañana?', '明天呢？'),
        ('tu', 'míngtiān xiàyǔ. wǒ bù xǐhuan xiàyǔ!', 'Mañana llueve. ¡No me gusta la lluvia!', '明天下雨。我不喜欢下雨！'),
        ('profe', 'hǎo! xièxie!', '¡Muy bien! ¡Gracias!', '好！谢谢！')),
      [('dàjiā hǎo! wǒ jiào ___.', '¡Hola a todos! Me llamo ___.', ['大家好！我叫', '']),
       ('jīntiān tiānqì zěnmeyàng?', '¿Qué tal el clima hoy?', '今天天气怎么样？'),
       ('jīntiān tiānqì hěn rè!', '¡Hoy hace mucho calor!', '今天天气很热！'),
       ('zuótiān tiānqì tài lěng le!', '¡Ayer hizo demasiado frío!', '昨天天气太冷了！'),
       ('míngtiān xiàyǔ.', 'Mañana llueve.', '明天下雨。'),
       ('wǒ xǐhuan rè, wǒ bù xǐhuan lěng. zàijiàn!', 'Me gusta el calor, no el frío. ¡Adiós!', '我喜欢热，我不喜欢冷。再见！')])

write('newhsk1-e01-r1', 'newhsk1', 1, 1, 'La Familia Grande',
      'Hoy es tu cumpleaños. Llega toda la familia y la profe pregunta quiénes son. ¿Sabes presentarlos?',
      'DRALINGO_HSK2_E01_R1_LaFamiliaGrande.pdf', ['EXP1.1', 'EXP1.2', 'EXP1.3'],
      W(('dàjiā', 'todos', '大家'), ('shēngrì', 'cumpleaños', '生日'), ('kuàilè', 'feliz', '快乐'), ('jièshào', 'presentar', '介绍'),
        ('gēge', 'hermano mayor', '哥哥'), ('jiějie', 'hermana mayor', '姐姐'), ('dìdi', 'hermano menor', '弟弟'),
        ('mèimei', 'hermana menor', '妹妹'), ('nín', 'usted', '您'), ('bàba', 'papá', '爸爸'), ('māma', 'mamá', '妈妈'),
        ('jiā', 'casa / familia', '家'), ('jīntiān', 'hoy', '今天'), ('zhè shì', 'este es', '这是'), ('lǎoshī', 'maestra', '老师')),
      D(('profe', 'dàjiā hǎo! jīntiān shì shéi de shēngrì?', '¡Hola a todos! ¿De quién es el cumpleaños hoy?', '大家好！今天是谁的生日？'),
        ('tu', 'shì wǒ de shēngrì! wǒ jiào Dani.', '¡Es mi cumpleaños! Me llamo Dani.', '是我的生日！我叫达妮。'),
        ('profe', 'shēngrì kuàilè, Dani! tāmen shì shéi?', '¡Feliz cumpleaños, Dani! ¿Quiénes son?', '生日快乐，达妮！他们是谁？'),
        ('tu', 'wǒ jièshào wǒ de jiā. zhè shì wǒ gēge, zhè shì wǒ jiějie.', 'Les presento a mi familia. Mi hermano mayor y mi hermana mayor.', '我介绍我的家。这是我哥哥，这是我姐姐。'),
        ('tu', 'zhè shì wǒ dìdi, zhè shì wǒ mèimei.', 'Mi hermano menor y mi hermana menor.', '这是我弟弟，这是我妹妹。'),
        ('profe', 'hǎo! shēngrì kuàilè!', '¡Muy bien! ¡Feliz cumpleaños!', '好！生日快乐！'),
        ('tu', 'xièxie nín! wǒ hěn kuàilè!', '¡Gracias (usted)! ¡Estoy muy feliz!', '谢谢您！我很快乐！')),
      [('dàjiā hǎo! wǒ jiào ___.', '¡Hola a todos! Me llamo ___.', ['大家好！我叫', '']),
       ('jīntiān shì wǒ de shēngrì!', '¡Hoy es mi cumpleaños!', '今天是我的生日！'),
       ('wǒ jièshào wǒ de jiā.', 'Les presento a mi familia.', '我介绍我的家。'),
       ('zhè shì wǒ gēge, zhè shì wǒ jiějie.', 'Mi hermano mayor, mi hermana mayor.', '这是我哥哥，这是我姐姐。'),
       ('zhè shì wǒ dìdi, zhè shì wǒ mèimei.', 'Mi hermano menor, mi hermana menor.', '这是我弟弟，这是我妹妹。'),
       ('nín hǎo, lǎoshī! xièxie dàjiā!', '¡Buenas, profe! ¡Gracias a todos!', '您好，老师！谢谢大家！')])

write('newhsk1-e03-r1', 'newhsk1', 3, 1, 'El Restaurante Chino',
      'Tienes hambre. El menú está en chino. El mesero te mira con la libreta en la mano. ¿Qué le dices?',
      'DRALINGO_HSK2_E03_R1_ElRestauranteChino.pdf', ['EXP3.1', 'EXP3.2', 'EXP3.3'],
      W(('fúwùyuán', 'mesero', '服务员'), ('yào', 'querer / pedir', '要'), ('miàntiáo', 'fideos', '面条'), ('jīdàn', 'huevo', '鸡蛋'),
        ('niúnǎi', 'leche', '牛奶'), ('kāfēi', 'café', '咖啡'), ('hǎochī', 'delicioso', '好吃'), ('gěi', 'dar', '给'),
        ('děng', 'esperar', '等'), ('chī', 'comer', '吃'), ('hē', 'beber', '喝'), ('mǐfàn', 'arroz', '米饭'), ('chá', 'té', '茶'),
        ('duōshǎo qián', '¿cuánto es?', '多少钱'), ('xièxie', 'gracias', '谢谢')),
      D(('profe', 'nǐ hǎo! nǐ yào chī shénme?', '¡Hola! ¿Qué quieres comer?', '你好！你要吃什么？'),
        ('tu', 'fúwùyuán, wǒ yào miàntiáo hé jīdàn.', 'Mesero, quiero fideos y huevo.', '服务员，我要面条和鸡蛋。'),
        ('profe', 'hǎo. nǐ yào hē shénme? kāfēi ma?', 'Bien. ¿Qué quieres beber? ¿Café?', '好。你要喝什么？咖啡吗？'),
        ('tu', 'bú yào kāfēi. qǐng gěi wǒ niúnǎi.', 'Café no. Por favor, deme leche.', '不要咖啡。请给我牛奶。'),
        ('profe', 'hǎo de, qǐng děng yíxià.', 'Muy bien, espere un momento, por favor.', '好的，请等一下。'),
        ('tu', 'hǎo, wǒ děng. … hěn hǎochī!', 'Bien, espero. … ¡Está delicioso!', ['好，我等。', '很好吃！']),
        ('profe', 'xièxie! èrshí kuài.', '¡Gracias! Son veinte yuanes.', '谢谢！二十块。')),
      [('fúwùyuán!', '¡Mesero!', '服务员！'),
       ('wǒ yào miàntiáo hé jīdàn.', 'Quiero fideos y huevo.', '我要面条和鸡蛋。'),
       ('qǐng gěi wǒ niúnǎi, bú yào kāfēi.', 'Por favor, deme leche, café no.', '请给我牛奶，不要咖啡。'),
       ('hǎo de, wǒ děng.', 'Está bien, yo espero.', '好的，我等。'),
       ('hěn hǎochī!', '¡Está delicioso!', '很好吃！'),
       ('duōshǎo qián? xièxie!', '¿Cuánto es? ¡Gracias!', '多少钱？谢谢！')])
