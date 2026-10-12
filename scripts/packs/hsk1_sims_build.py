# Build mochi-mash/core/packs/hsk1-sims.json (Old HSK 1 simulacro rounds) from hsk1_sims.json + Spanish written here.
import json
import sys

ES = {
    (1, 26): 'El de abajo es grande y el de arriba es pequeño.', (1, 27): 'Ahora no quiero escucharte.',
    (1, 28): 'Perdón, quiero ir a dormir.', (1, 29): 'Él está en casa viendo la televisión.',
    (1, 30): 'Papá, ¿qué comida estás preparando?',
    (2, 26): '¿Qué le gusta comer a tu perro?', (2, 27): '¿Cuántos yuanes hay aquí dentro?',
    (2, 28): '¿Por qué ya no habla? ¿Está triste?', (2, 29): 'Hoy hace un poco de calor.',
    (2, 30): 'No pasa nada, no tengo muchas cosas.',
    (3, 26): '¿Por qué hay tanta gente adelante?', (3, 27): 'Ese no es mi gato, es de mi amigo.',
    (3, 28): 'Ya son las 7; en 40 minutos volvemos a casa.', (3, 29): 'No sé escribir este carácter.',
    (3, 30): 'Despídete de papá.',
    (4, 26): '¿Lo viste? Está allá, adelante.', (4, 27): 'Gatito, ¿no te gusta comer esto?',
    (4, 28): 'De nada, señorita Li. Siéntese, por favor.', (4, 29): '¿Cuánto cuesta este plato? 30 yuanes.',
    (4, 30): 'Gracias por venir al hospital a verme.',
    (5, 26): 'Aquí hay sillas, sentémonos aquí.', (5, 27): 'Ya son las diez, ahora voy a la escuela.',
    (5, 28): '¿Dónde está el gatito? ¿Lo viste?', (5, 29): '¿Cuál quieres comer?',
    (5, 30): 'Es médico y trabaja en el hospital.',
    (6, 26): '¡Me voy a casa, adiós!', (6, 27): 'Mamá es mi buena amiga.', (6, 28): '¿Cuánto cuestan estas cosas?',
    (6, 29): 'Hoy hace mucho frío en mi casa.', (6, 30): 'Sobre la mesa hay una manzana.',
    (7, 26): 'Ellos tienen un hijo y una hija.', (7, 27): 'Lo vi durmiendo en la silla.',
    (7, 28): 'Sobre la mesa hay mucha comida.', (7, 29): 'Fue al cine a ver una película.',
    (7, 30): 'La maestra dice que ahora estudiamos caracteres chinos.',
    (8, 26): 'Ayer fue 31 de diciembre.', (8, 27): 'Este plato lo hizo él.', (8, 28): 'Vamos a Pekín en avión.',
    (8, 29): 'Lo internaron en el hospital.', (8, 30): 'Ellos dos son buenos amigos.',
    (9, 26): '¿Todos estos platos los hizo la señorita Wang?', (9, 27): 'Por favor, come un poco más de fruta.',
    (9, 28): 'Mi papá es piloto de avión.', (9, 29): 'Perdón, en la tarde voy a la tienda a comprar un vaso.',
    (9, 30): 'Ya son las 9, quiero ir a ver la televisión.',
    (10, 26): 'Tiene demasiado trabajo.', (10, 27): 'Por favor, escribe tu nombre aquí.',
    (10, 28): 'La computadora está sobre la mesa.', (10, 29): 'Ya no puedo ver.',
    (10, 30): 'Mamá hizo tres platos, ¿cuál te gusta?',
}
# exam words of reading part 1 that are not in the EXP word lists (or need their exam meaning)
WORD_ES = {'dianyingyuan': 'cine', 'dushu': 'leer / estudiar', 'kaiche': 'manejar (un carro)', "na'er": '¿dónde?',
           "nu'er": 'hija', "shi'er dian": 'las doce', 'xie': 'escribir', 'he': 'y'}  # xie = xiě (S4), he = hé (S7)

# reviewed fixes (2026-10-11): an answer the PDF text garbled, and bank words that would also fill a blank
REPLY_FIX = {(2, 'Dianying shi ji dian de?'): 'Shangwu 8:40'}           # source: 上午8:40 (core/hsk-sim.js)
BANK_DROP = {(6, 'xuesheng'): ['mingzi', 'yue']}                        # «Laoshimen dou hen xihuan zhege ___»

sims = json.load(open(sys.argv[1], encoding='utf-8'))
cap = lambda s: s[:1].upper() + s[1:] if s else s
out = []
for s in sims:
    n = s['n']
    items = []
    for py in s['p1']:
        it = {'k': 'w', 'py': py}
        if py in WORD_ES:
            it['es'] = WORD_ES[py]
        items.append(it)
    for i, x in enumerate(s['p2']):
        items.append({'k': 'm', 'py': cap(x['py']) + ('' if x['py'][-1:] in '.?!' else '.'), 'es': ES[(n, 26 + i)]})
    for x in s['p3']:
        items.append({'k': 'r', 'a': cap(x['q']), 'b': REPLY_FIX.get((n, cap(x['q'])), cap(x['a']))})
    for x in s['p4']:
        drop = BANK_DROP.get((n, x['a']), [])
        items.append({'k': 'f', 's': cap(x['s']), 'a': x['a'], 'bank': [b for b in s['bank4'] if b != x['a'] and b not in drop]})
    out.append({'n': n, 'items': items})
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', len(out), 'simulacros,', sum(len(x['items']) for x in out), 'items')
