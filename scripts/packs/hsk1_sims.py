# Turn the Old HSK 1 mother file (text dump) into simulacro items for core/packs/hsk1.js (reading parts 1-4, items 21-40;
# the listening items 1-20 have no transcript). Pinyin loses its tone marks (game rule). Prints JSON.
import json
import re
import sys
import unicodedata

def untone(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('ü', 'u').replace('Ü', 'U')

text = open(sys.argv[1], encoding='utf-8').read()
text = re.sub(r'HSK1 · Simulaciones 1–10 \(400 preguntas\)\n|Page \d+ of \d+\n|===== PAGE \d+ =====\n', '', text)
sims = re.split(r'\nSimulación (\d+)\n', text)
out = []
for i in range(1, len(sims), 2):
    n, body = int(sims[i]), sims[i + 1]
    item = {'n': n, 'p1': [], 'p2': [], 'p3': [], 'p4': []}
    # Part 1: "21. shuǐguǒ → Falso"
    m = re.search(r'Lectura · Parte 1.*?\n(.*?)Lectura · Parte 2', body, re.S)
    for line in m.group(1).splitlines():
        mm = re.match(r'(\d+)\. (.+?) → (Verdadero|Falso)', line)
        if mm and 21 <= int(mm.group(1)) <= 25:
            item['p1'].append(untone(mm.group(2)).strip())
    # Part 2: "26. 下面… · Xiàmiàn … → F" (may wrap)
    m = re.search(r'Lectura · Parte 2.*?\n(.*?)Lectura · Parte 3', body, re.S)
    blob = re.sub(r'\n(?!\d+\. |EJ)', ' ', m.group(1))
    for line in blob.splitlines():
        mm = re.match(r'(\d+)\. (.+?) · (.+?) → [A-F]', line)
        if mm:
            item['p2'].append({'hz': mm.group(2).strip(), 'py': untone(mm.group(3)).strip()})
    # Part 3: bank + "31. 问 · Wèn? → E (太小了 tài xiǎo le)"
    m = re.search(r'Lectura · Parte 3.*?\n(.*?)Lectura · Parte 4', body, re.S)
    p3 = re.sub(r'\n(?!\d+\. |EJ|ES:|EN:|Banco)', ' ', m.group(1))
    for line in p3.splitlines():
        mm = re.match(r'(\d+)\. (.+?) · (.+?) → [A-F] \((.+?)\)\s*$', line)
        if mm:
            ans = mm.group(4).strip()
            ans_py = untone(re.split(r'[㐀-鿿，！？。、]', ans)[-1]).strip()   # pinyin = text after the last hanzi
            item['p3'].append({'q': untone(mm.group(3)).strip(), 'a': ans_py})
        es = re.match(r'ES: (.+?) → \((.+?)\)', line)
        if es and item['p3']:
            item['p3'][-1]['es'] = es.group(1).strip()
    # Part 4: bank + "36. 那个人是我的（ ） · Nàge rén shì wǒ de ( ) → B (学生 xuéshēng)"
    m = re.search(r'Lectura · Parte 4.*?\n(.*?)$', body, re.S)
    p4 = re.sub(r'\n(?!\d+\. |EJ|ES:|EN:|Banco)', ' ', m.group(1))
    bank = []
    for line in p4.splitlines():
        if line.startswith('Banco:'):
            bank = [untone(b).strip() for b in re.findall(r'[A-F]\) [㐀-鿿]+ ([^·]+)', line)]
        mm = re.match(r'(\d+)\. (.+?) · (.+?) → [A-F] \((.+?)\)\s*$', line)
        if mm:
            ans = untone(re.split(r'[㐀-鿿，！？。、]', mm.group(4))[-1]).strip()   # pinyin = text after the last hanzi
            item['p4'].append({'s': untone(mm.group(3)).replace('( )', '___').strip(), 'a': ans})
        es = re.match(r'ES: (.+)', line)
        if es and item['p4'] and 'es' not in item['p4'][-1] and line.startswith('ES:'):
            item['p4'][-1]['es'] = es.group(1).strip()
    item['bank4'] = bank
    out.append(item)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for s in out:
    print('SIM', s['n'], 'p1', len(s['p1']), 'p2', len(s['p2']), 'p3', len(s['p3']), 'p4', len(s['p4']), 'bank4', s['bank4'])
