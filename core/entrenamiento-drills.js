// =========================================================================
// entrenamiento-drills.js — El Entrenamiento's exam drills (2026-10-18, his ask: "make sure that the training is
// actually really covering all the simulations")
// =========================================================================
// The official exams are mostly picture and listening questions («listen: is it this picture? ✓ / ✕», «listen and
// choose the picture», «read a sentence, match the picture», «hear a question, choose the answer»); the packs' rounds
// are written questions with written answers. These drills add the exam's own kinds to every practice world, built on
// the server from what the platform already has (no new pictures or recordings):
//   · La Base (protected/base/<level>-base/base.json): every word's picture, its word clip, its example sentence and
//     the sentence's clip. A word is drawn only when its picture really shows it (PIC below: people, body, animals,
//     food, places, things, transport, weather, faces, numbers; never a pronoun, a time word or an adjective drawn as an
//     animal), and a sentence only when its Spanish names that word (so the picture fits the sentence).
//   · the packs' dialogues (r items) of the world: heard only, «choose the reply» and, when one word of it has a
//     picture, «choose the picture».
//   · the simulations (content/golden/<book>.json, the same export as the golden books): every listening question of
//     every sim, heard only, in «Simulacro del examen». Their voice says the exam's own Chinese: core/yct/<sim>.json for
//     YCT / New HSK, content/train/hsk1sim-heard.json for old HSK (exported once from study/hsk1sim/transcripts.py).
//     Words above the level that the exam itself uses come only from there (`exam: true`).
// A drill is a question like the packs' (text, answers, correct, key) plus: ex / stim (the exam kind it practises),
// listen (its line is heard, never shown), tap (a reading drill: its audio only on a tap, so the kid reads), tf (✓ / ✕),
// pics / imageFile (pictures by file, served through the round), labels (an option's Spanish, for screen readers),
// say (what the voice says: a La Base clip, the exam's Chinese, or pinyin for the platform voice), show (the line and
// its Spanish, sent only once answered). Picture and ✓ / ✕ options are opaque tokens, fixed per drill (the phone never
// learns a picture's name or file from them); written options are the pinyin itself. Every drill is the same in every
// build (its options too): only a round's order changes.
// No hanzi ever reaches the phone; pinyin without tone marks, as the packs write it.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Levels = require('./levels');
const Packs = require('./packs');

const ROOT = path.join(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'protected', 'base');
const plain = Packs.plain;
// pinyin without its tone marks (ü kept), as El Entrenamiento writes it: «Bàba zài chī fàn.» → «Baba zai chi fan.»
const untone = (s) => String(s || '').normalize('NFD').replace(/[̀́̄̌]/g, '').normalize('NFC').replace(/[’`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
// the golden books' Spanish keeps pinyin between braces («Señora {Wáng}»): on a kid's screen, plain toneless pinyin
const esClean = (s) => String(s || '').replace(/\{([^{}]+)\}/g, (m, x) => untone(x)).trim();

// ── the words whose La Base picture really shows them ────────────────────────────────────────────────────────────
// [key (pinyin without tones), group, meaning (to pick the right one of words spelled alike)]
// groups: a question never shows two people (they look alike), numbers only beside numbers
const PIC = [
  ['baba', 'person'], ['mama', 'person'], ['gege', 'person'], ['jiejie', 'person'], ['didi', 'person'], ['meimei', 'person'],
  ['erzi', 'person'], ['laoshi', 'person'], ['yisheng', 'person'], ['xuesheng', 'person'],
  ['jia', 'place', /casa/], ['xuexiao', 'place'], ['shangdian', 'place'], ['yiyuan', 'place'], ['daxue', 'place'], ['dianyingyuan', 'place'],
  ['bizi', 'body'], ['erduo', 'body'], ['kou', 'body', /boca/], ['shou', 'body', /mano/], ['yanjing', 'body'],
  ['gou', 'animal'], ['mao', 'animal', /gato/], ['niao', 'animal'], ['yu', 'animal', /pez/],
  ['mifan', 'food'], ['miantiao', 'food'], ['miantiaor', 'food'], ['pingguo', 'food'], ['jiaozi', 'food'], ['baozi', 'food'],
  ['mianbao', 'food'], ['jidan', 'food'], ['shuiguo', 'food'], ['zaofan', 'food'], ['wufan', 'food'], ['wanfan', 'food'],
  ['niunai', 'drink'], ['shui', 'drink', /agua/], ['cha', 'drink', /té/],
  ['shu', 'thing', /libro/], ['yifu', 'thing'], ['diannao', 'thing'], ['dianshi', 'thing'], ['shouji', 'thing'], ['dianhua', 'thing', /^teléfono/],
  ['yizi', 'thing'], ['qian', 'thing', /dinero/], ['dianying', 'thing'], ['sui', 'thing', /años/],
  ['che', 'vehicle', /carro|auto/], ['feiji', 'vehicle'], ['huoche', 'vehicle'], ['chuzuche', 'vehicle'],
  ['xue', 'weather', /nieve/], ['xiayu', 'weather'],
  ['gaoxing', 'face'], ['re', 'face'], ['leng', 'face'], ['shuijiao', 'face'],
  ['yi', 'number', /uno/], ['er', 'number', /^dos/], ['san', 'number', /tres/], ['si', 'number', /cuatro/], ['wu', 'number', /cinco/],
  ['liu', 'number', /seis/], ['qi', 'number', /siete/], ['ba', 'number', /ocho/], ['jiu', 'number', /nueve/], ['shi', 'number', /diez/],
];
// words spelled alike across meanings, or used in another sense inside a line (kou = boca / a measure: «chi yi kou»):
// never guessed from a toneless dialogue
const RISKY_IN_LINES = new Set(['kou', 'qian', 'xue', 'shu', 'yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu', 'shi', 're', 'leng', 'sui']);
// pictures too close to tell apart in one question (two phones, school / university, film / cinema)
const CONFLICTS = [['dianhua', 'shouji'], ['xuexiao', 'daxue'], ['dianying', 'dianyingyuan', 'dianshi'], ['shangdian', 'yiyuan', '¿Adónde vas? Voy al hospital a ver al médico.'], ['cha', 'niunai'],
  ['mifan', 'zaofan', 'wufan', 'wanfan']];
const clash = (a, b) => CONFLICTS.some((set) => set.includes(a) && set.includes(b));

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────
// a fixed random stream per drill (its options are the same in every build)
function seeded(seed) {
  let h = crypto.createHash('sha1').update(String(seed)).digest();
  let i = 0;
  return () => {
    if (i + 4 > h.length) { h = crypto.createHash('sha1').update(h).digest(); i = 0; }
    const v = h.readUInt32BE(i);
    i += 4;
    return v / 4294967296;
  };
}
function pickN(list, n, rnd) {
  const a = list.slice();
  const out = [];
  while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);
  return out;
}
// an option's opaque token (picture and ✓ / ✕ options): the same for a drill in every build, meaningless on its own
const token = (uid, label) => 'o' + crypto.createHash('sha1').update(uid + '|' + label).digest('hex').slice(0, 12);
const STEM = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ]/g, '').slice(0, 4);
const esWords = (es) => String(es || '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-záéíóúüñ]+/).filter((w) => w.length >= 3);
// does a sentence's Spanish name the word's meaning? («Estas son las orejas del perrito» names «orejas»; «perro» ~ «perrito»)
function namesMeaning(sentEs, wordEs) {
  const s = new Set(esWords(sentEs).map(STEM));
  return esWords(wordEs).some((w) => s.has(STEM(w)));
}

// ── La Base of a level ───────────────────────────────────────────────────────────────────────────────────────────
const _base = {};
function baseOf(lvl) {
  if (_base[lvl] !== undefined) return _base[lvl];
  const info = Levels.info(lvl);
  let out = null;
  if (info && info.base) {
    const dir = path.join(BASE_DIR, info.base);
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, 'base.json'), 'utf8'));
      const file = (u) => {
        const m = /\/base-media\/[^/]+\/((?:pics\/)?[A-Za-z0-9_.-]+)(?:\?|$)/.exec(String(u || ''));
        const abs = m ? path.join(dir, m[1]) : null;
        return abs && abs.indexOf(dir + path.sep) === 0 && fs.existsSync(abs) ? abs : null;
      };
      const words = (data.words || []).map((w) => {
        const k = plain(w.py);
        const p = PIC.find(([key, , re]) => key === k && (!re || re.test(String(w.es || ''))));
        return {
          n: w.n, world: w.world, py: untone(w.py), es: String(w.es || ''), k, group: p ? p[1] : null,
          pic: p ? file(w.pic) : null, au: file(w.au),
          sent: Array.isArray(w.ex) ? untone(w.ex.join('')) : '', sentEs: String(w.exes || ''), sentAu: file(w.exau),
        };
      });
      out = { id: info.base, dir, words, keys: new Map() };
      words.forEach((w) => { if (!out.keys.has(w.k)) out.keys.set(w.k, []); out.keys.get(w.k).push(w); });
    } catch (e) { console.warn('[train] drills: La Base of ' + lvl + ' unreadable:', e.message); out = null; }
  }
  _base[lvl] = out;
  return out;
}
const picturable = (b) => b.words.filter((w) => w.pic && w.group);
// the keys of every level word in a line (toneless tokens, a word written as two tokens too: «da dianhua»)
function lineKeys(line) {
  const toks = String(line || '').toLowerCase().split(/[^a-züv0-9']+/).map((t) => plain(t)).filter(Boolean);
  const set = new Set(toks);
  for (let i = 0; i + 1 < toks.length; i++) set.add(toks[i] + toks[i + 1]);
  return set;
}
// up to n distractor pictures for word w: never one spelled alike or sharing a meaning, never a second person, numbers
// only beside numbers, never a word the line mentions (`avoid`: the line's text); this world's words first
function distractors(b, w, n, rnd, avoid) {
  const flat = plain(avoid || '');
  const ok = (x) => x !== w && x.k !== w.k && x.pic !== w.pic && (w.group === 'number') === (x.group === 'number') &&
    !(w.group === 'person' && x.group === 'person') && !(avoid && flat.indexOf(x.k) >= 0) &&
    !esWords(x.es).some((m) => esWords(w.es).includes(m));
  const pool = picturable(b).filter(ok);
  const near = pool.filter((x) => x.world === w.world);
  const far = pool.filter((x) => x.world !== w.world);
  const out = [];
  pickN(near, near.length, rnd).concat(pickN(far, far.length, rnd)).forEach((x) => {
    if (out.length >= n) return;
    if (x.group === 'person' && out.some((y) => y.group === 'person')) return;     // one person at most among them
    if (clash(x.k, w.k) || out.some((y) => clash(x.k, y.k) || y.pic === x.pic)) return;
    out.push(x);
  });
  return out;
}

// ── the drills of one La Base word ───────────────────────────────────────────────────────────────────────────────
const T = {
  ltfW: 'Escucha la palabra. ¿Es esta la foto?',
  ltfS: 'Escucha la frase. ¿Va con esta foto?',
  lpicW: 'Escucha la palabra y toca su foto.',
  lpicS: 'Escucha la frase y toca la foto que va con ella.',
  ldlg: 'Escucha la conversación y toca la foto que va con ella.',
  lrep: 'Escucha la pregunta y toca la mejor respuesta.',
  ltext: 'Escucha y toca la respuesta correcta.',
  lmean: 'Escucha y toca lo que significa.',
};
// a ✓ / ✕ drill: the picture of the word (true) or of another one (false), half and half by the drill's own stream
function tfDrill(uid, b, w, o) {
  const rnd = seeded(uid);
  const truth = rnd() < 0.5;
  const other = truth ? null : distractors(b, w, 1, rnd, o.avoid)[0];
  if (!truth && !other) return null;
  const yes = token(uid, 'si'), no = token(uid, 'no');
  return Object.assign({
    uid, drill: true, kind: o.kind, ex: o.ex, stim: o.stim, listen: !!o.listen, tap: !o.listen, tf: true, fixed: true,
    text: o.text, answers: [yes, no], correct: truth ? yes : no, labels: { [yes]: 'Sí', [no]: 'No' },
    imageFile: truth ? w.pic : other.pic, key: w.k, word: w.n, say: o.say, show: o.show,
  }, o.more || {});
}
// a «choose the picture» drill: the word's picture and two others (the exam shows three: A, B, C)
function picDrill(uid, b, w, o) {
  const rnd = seeded(uid);
  const others = distractors(b, w, 2, rnd, o.avoid);
  if (others.length < 2) return null;
  const opts = [w].concat(others);
  const answers = opts.map((x) => token(uid, x.n));
  const pics = {}, labels = {};
  opts.forEach((x, i) => { pics[answers[i]] = x.pic; labels[answers[i]] = x.es; });
  return Object.assign({
    uid, drill: true, kind: o.kind, ex: o.ex, stim: o.stim, listen: !!o.listen, tap: !o.listen,
    text: o.text, answers, correct: answers[0], pics, labels, key: w.k, word: w.n, say: o.say, show: o.show,
  }, o.more || {});
}
function wordDrills(lvl, b, w) {
  const out = [];
  if (!w.pic || !w.au) return out;
  const say = { py: w.py, es: w.es, file: w.au };
  const show = { py: w.py, es: w.es };
  const base = lvl + ':' + w.n;
  out.push(tfDrill(base + ':ltf', b, w, { kind: 'ltf', ex: 'L-tf', stim: 'word', listen: true, text: T.ltfW, say, show }));
  out.push(picDrill(base + ':lpic', b, w, { kind: 'lpic', ex: 'L-pic', stim: 'word', listen: true, text: T.lpicW, say, show }));
  out.push(tfDrill(base + ':rtf', b, w, { kind: 'rtf', ex: 'R-tf', stim: 'word', listen: false, text: 'Lee: «' + w.py + '». ¿Es esta la foto?', say, show }));
  // its example sentence, when the sentence's Spanish names the word (so the picture fits it)
  if (w.sent && w.sentAu && namesMeaning(w.sentEs, w.es) && plain(w.sent).indexOf(w.k) >= 0) {
    const sSay = { py: w.sent, es: w.sentEs, file: w.sentAu };
    const sShow = { py: w.sent, es: w.sentEs };
    out.push(picDrill(base + ':lpics', b, w, { kind: 'lpic', ex: 'L-pic', stim: 'sentence', listen: true, text: T.lpicS, say: sSay, show: sShow, avoid: w.sent }));
    out.push(tfDrill(base + ':ltfs', b, w, { kind: 'ltf', ex: 'L-tf', stim: 'sentence', listen: true, text: T.ltfS, say: sSay, show: sShow, avoid: w.sent }));
    out.push(picDrill(base + ':rpic', b, w, { kind: 'rpic', ex: 'R-pic', stim: 'sentence', listen: false,
      text: 'Lee la frase y toca su foto: «' + w.sent + '»', say: sSay, show: sShow, avoid: w.sent }));
  }
  return out.filter(Boolean);
}

// ── a dialogue (a pack's r item, or authored below) → heard only: the reply, and the picture when it has one ─────────
// replies: the other replies to choose from (the pack's own wrong ones, else the world's other replies)
function dialogueDrills(lvl, b, a, reply, replies, uidBase, pic, es) {
  const out = [];
  const line = a + ' ' + reply;
  const rnd = seeded(uidBase + ':lrep');
  const wrong = pickN(replies.filter((x) => plain(x) !== plain(reply)), 2, rnd);
  if (wrong.length === 2) {
    out.push({ uid: uidBase + ':lrep', drill: true, kind: 'lrep', ex: 'L-text', stim: 'sentence', listen: true, text: T.lrep,
      answers: [reply].concat(wrong), correct: reply, key: plain(reply), say: { py: a }, show: { py: a } });
  }
  // the picture: the word named by the pack (authored), else the one level word of the dialogue with a picture whose
  // spelling means only that word in this level
  let w = null;
  if (pic) w = picturable(b).find((x) => x.k === pic) || null;
  else {
    const keys = lineKeys(line);
    const hits = picturable(b).filter((x) => keys.has(x.k) && !RISKY_IN_LINES.has(x.k) && b.keys.get(x.k).length === 1);
    const inReply = hits.filter((x) => lineKeys(reply).has(x.k));
    if (hits.length === 1) w = hits[0];
    else if (inReply.length === 1) w = inReply[0];
  }
  if (w) {
    const d = picDrill(uidBase + ':ldlg', b, w, { kind: 'ldlg', ex: 'L-pic', stim: 'dialogue', listen: true, text: T.ldlg,
      say: { py: line }, show: es ? { py: line, es } : { py: line }, avoid: line });
    if (d) out.push(d);
  }
  return out;
}

// dialogues written for El Entrenamiento (level words only), each with the word whose picture answers it and its
// Spanish (shown once answered): the exam's
// «listen to the conversation, choose the picture», where a level's packs have few dialogues with a picture
const DIALOGUES = {
  yct1: [
    [2, 'Ni kan, zhe shi shei de bizi?', 'Zhe shi wo de bizi.', 'bizi', '¿De quién es esta nariz? Es mi nariz.'],
    [2, 'Ni de erduo da ma?', 'Bu da, wo de erduo xiao.', 'erduo', '¿Tus orejas son grandes? No, mis orejas son pequeñas.'],
    [3, 'Ni jia you gou ma?', 'You, wo jia you yi ge xiao gou.', 'gou', '¿En tu casa hay perro? Sí, en mi casa hay un perrito.'],
    [3, 'Zhe shi shenme?', 'Zhe shi niao.', 'niao', '¿Qué es esto? Es un pájaro.'],
    [4, 'Ni he shenme?', 'Wo he niunai.', 'niunai', '¿Qué tomas? Tomo leche.'],
    [4, 'Ni xihuan chi shenme?', 'Wo xihuan chi miantiao.', 'miantiao', '¿Qué te gusta comer? Me gusta comer fideos.'],
    [6, 'Ni qu nar?', 'Wo qu shangdian.', 'shangdian', '¿Adónde vas? Voy a la tienda.'],
    [6, 'Ta shi shei?', 'Ta shi wo de laoshi.', 'laoshi', '¿Quién es él? Es mi maestro.'],
  ],
  hsk2: [
    [1, 'Ni jia you mao ma?', 'You, wo jia you liang zhi mao.', 'mao', '¿En tu casa hay gato? Sí, en mi casa hay dos gatos.'],
    [3, 'Ni zaofan chi shenme?', 'Wo chi jidan.', 'jidan', '¿Qué desayunas? Como huevo.'],
    [3, 'Ni yao he cha ma?', 'Bu yao, wo yao he niunai.', 'niunai', '¿Quieres tomar té? No, quiero tomar leche.'],
    [4, 'Ni mai shenme?', 'Wo mai yi jian yifu.', 'yifu', '¿Qué compras? Compro una prenda de ropa.'],
    [5, 'Jintian tianqi zenmeyang?', 'Xia xue le, hen leng.', 'xue', '¿Qué tal el clima hoy? Nieva, hace mucho frío.'],
    [6, 'Ni zai zuo shenme?', 'Wo zai kan dianshi.', 'dianshi', '¿Qué estás haciendo? Estoy viendo la televisión.'],
    [7, 'Ni zenme qu Zhongguo?', 'Wo zuo feiji qu.', 'feiji', '¿Cómo vas a China? Voy en avión.'],
    [7, 'Ni zuo shenme che qu?', 'Wo zuo huoche qu.', 'huoche', '¿En qué vas? Voy en tren.'],
  ],
  hsk1: [
    [1, 'Zhe shi shei de gou?', 'Shi wo erzi de.', 'gou', '¿De quién es este perro? Es de mi hijo.'],
    [2, 'Ni xiang mai shenme?', 'Wo xiang mai yi ben shu.', 'shu', '¿Qué quieres comprar? Quiero comprar un libro.'],
    [3, 'Ni xiang he shenme?', 'Wo xiang he cha.', 'cha', '¿Qué quieres tomar? Quiero tomar té.'],
    [3, 'Ni xihuan chi shenme shuiguo?', 'Wo xihuan chi pingguo.', 'pingguo', '¿Qué fruta te gusta? Me gustan las manzanas.'],
    [4, 'Jintian tianqi zenmeyang?', 'Xia yu le.', 'xiayu', '¿Qué tal el clima hoy? Está lloviendo.'],
    [5, 'Ni zenme qu Beijing?', 'Wo zuo feiji qu.', 'feiji', '¿Cómo vas a Pekín? Voy en avión.'],
    [6, 'Ni zai zuo shenme?', 'Wo zai kan dianshi.', 'dianshi', '¿Qué estás haciendo? Estoy viendo la televisión.'],
    [7, 'Ni qu nar?', 'Wo qu yiyuan kan yisheng.', 'yiyuan', '¿Adónde vas? Voy al hospital a ver al médico.'],
  ],
};

// ── the simulations' listening questions (Simulacro del examen), heard only ─────────────────────────────────────
const _hz = {};
// the exam's Chinese of a listening question: { line: [hanzi] } by «<sim n>:<part>:<num>»
function examChinese(lvl) {
  if (_hz[lvl]) return _hz[lvl];
  const map = new Map();
  const info = Levels.info(lvl);
  try {
    if (info.golden === 'hsk1sim') {
      const heard = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'train', 'hsk1sim-heard.json'), 'utf8')).lines || {};
      Object.keys(heard).forEach((k) => { const [s, p, q] = k.split('.'); map.set(s + ':' + p + ':' + q, heard[k]); });
    } else {
      const dir = path.join(ROOT, 'core', 'yct');
      const pre = info.golden.replace(/sim$/, '') + '-sim';
      fs.readdirSync(dir).filter((f) => f.indexOf(pre) === 0 && /\d+\.json$/.test(f)).forEach((f) => {
        const n = parseInt(f.slice(pre.length), 10);
        const sim = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        ((sim.listening && sim.listening.parts) || []).forEach((p) => p.items.forEach((it) => {
          if (it.example || !it.transcript) return;
          const t = it.transcript;
          map.set(n + ':' + p.part + ':' + it.num, t.lines && t.lines.length ? t.lines.map((l) => l.hanzi) : [t.hanzi]);
        }));
      });
    }
  } catch (e) { console.warn('[train] drills: the exam lines of ' + lvl + ' unreadable:', e.message); }
  _hz[lvl] = map;
  return map;
}
const stripWen = (s) => String(s || '').replace(/^\s*(Wèn|Wen|问)\s*[:：]\s*/i, '');
function simDrills(lvl, b) {
  const info = Levels.info(lvl);
  let g;
  try { g = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'golden', info.golden + '.json'), 'utf8')); } catch (e) { return []; }
  const HZ = examChinese(lvl);
  const out = [];
  // every single line heard in the sims, with its Spanish (the wrong meanings of «what does it mean?»), and every
  // second line of a dialogue (the wrong replies of «choose the reply»)
  const singles = [], seconds = [];
  g.sims.forEach((s) => s.parts.forEach((p) => {
    if (p.sec !== 'L') return;
    (p.items || []).forEach((it) => {
      if (it.ex) return;
      if (it.py && it.es) singles.push({ py: untone(it.py), es: esClean(it.es), kind: p.kind });
      if (it.lines && it.lines.length >= 2) seconds.push(untone(it.lines[1].py));
    });
  }));
  g.sims.forEach((s) => s.parts.forEach((p) => {
    if (p.sec !== 'L') return;
    (p.items || []).forEach((it) => {
      if (it.ex) return;
      const uid = lvl + ':sim' + s.n + ':' + p.part + ':' + it.num;
      const hz = HZ.get(s.n + ':' + p.part + ':' + it.num) || null;
      const rnd = seeded(uid);
      if (it.lines && it.lines.length >= 2) {                         // a dialogue: hear a line, choose the reply (each turn)
        for (let t = 0; t + 1 < it.lines.length; t++) {
          const a = untone(it.lines[t].py), reply = untone(it.lines[t + 1].py);
          const u = uid + (t ? ':' + t : '');
          const wrong = pickN(seconds.filter((x) => plain(x) !== plain(reply)), 2, seeded(u));
          if (wrong.length === 2) {
            out.push({ uid: u, drill: true, exam: true, kind: 'lrep', ex: 'L-text', stim: 'sentence', listen: true, text: T.lrep,
              answers: [reply].concat(wrong), correct: reply, key: plain(reply),
              say: { py: a, hz: hz && hz[t] ? hz[t] : null }, show: { py: a, es: esClean(it.lines[t].es) } });
          }
        }
      } else if (it.said && it.opts) {                                // what is said + a question: the exam's own options
        const said = it.said.map((x) => untone(stripWen(x.py)));
        const opts = it.opts.map((o) => untone(o.py));
        const right = untone((it.opts.find((o) => o.l === it.ans) || {}).py || '');
        if (right && new Set(opts.map(plain)).size === opts.length) {
          out.push({ uid, drill: true, exam: true, kind: 'ltext', ex: 'L-text', stim: said.length > 1 ? 'statement+question' : 'sentence', listen: true,
            text: T.ltext, answers: opts, correct: right, key: plain(right),
            say: { py: said.join(' '), hz: hz ? hz.join('') : null }, show: { py: said.join(' '), es: esClean(it.said.map((x) => x.es).join(' ')) } });
        }
      } else if (it.py) {
        const line = untone(it.py);
        const w = picturable(b).find((x) => plain(line) === x.k && x.au);
        if (w) {                                                      // a word with its picture: the exam's own kind
          const o = { kind: p.kind === 'tf' ? 'ltf' : 'lpic', ex: p.kind === 'tf' ? 'L-tf' : 'L-pic', stim: 'word', listen: true,
            text: p.kind === 'tf' ? T.ltfW : T.lpicW, say: { py: w.py, es: w.es, file: w.au }, show: { py: w.py, es: w.es }, more: { exam: true } };
          const d = p.kind === 'tf' ? tfDrill(uid, b, w, o) : picDrill(uid, b, w, o);
          if (d) { out.push(d); return; }
        }
        // else: hear it, choose what it means (two other lines of the sims as the wrong meanings, as long as it: a
        // short phrase beside short phrases, a sentence beside sentences, so the length tells nothing)
        const es = esClean(it.es);
        const longish = (py) => py.split(/\s+/).length > 2 || /[.?!]$/.test(py);
        const like = singles.filter((x) => plain(x.py) !== plain(line) && x.es && x.es.toLowerCase() !== es.toLowerCase());
        const same = like.filter((x) => longish(x.py) === longish(line));
        const wrong = pickN(same.length >= 2 ? same : like, 2, rnd).map((x) => x.es);
        if (es && wrong.length === 2 && new Set([es].concat(wrong).map((x) => x.toLowerCase())).size === 3) {
          out.push({ uid, drill: true, exam: true, kind: 'lmean', ex: 'L-mean', stim: 'sentence', listen: true, text: T.lmean,
            answers: [es].concat(wrong), correct: es, key: plain(line),
            say: { py: line, es, hz: hz && hz[0] ? hz[0] : null }, show: { py: line, es } });
        }
      }
    });
  }));
  // the reading lines of the sims (a sentence to match with a picture, a word ✓ / ✕) that the level's own «Simulacro»
  // rounds leave out: read it, choose what it means (its audio only on a tap)
  const packed = new Set();
  const pl = Packs.LEVELS.find((x) => x.id === info.pack);
  ((pl && pl.worlds.find((x) => x.id === 'simulacro')) || { rounds: [] }).rounds.forEach((r) => (r.items || []).forEach((it) => {
    [it.py, it.a, it.b, it.s, it.t].forEach((t) => { if (t) packed.add(plain(String(t).replace(/_{2,}/g, ''))); });
  }));
  const reads = [];
  g.sims.forEach((s) => s.parts.forEach((p) => {
    if (p.sec !== 'R') return;
    (p.items || []).forEach((it) => { if (!it.ex && it.py && it.es) reads.push({ s, p, it, py: untone(it.py), es: esClean(it.es) }); });
  }));
  reads.forEach(({ s, p, it, py, es }) => {
    if ([...packed].some((x) => x.indexOf(plain(py)) >= 0)) return;
    const uid = lvl + ':sim' + s.n + ':R' + p.part + ':' + it.num;
    const longish = (x) => x.split(/\s+/).length > 2 || /[.?!]$/.test(x);
    const like = reads.filter((x) => x.it !== it && plain(x.py) !== plain(py) && x.es.toLowerCase() !== es.toLowerCase());
    const same = like.filter((x) => longish(x.py) === longish(py));
    const wrong = pickN(same.length >= 2 ? same : like, 2, seeded(uid)).map((x) => x.es);
    if (wrong.length === 2 && new Set([es].concat(wrong).map((x) => x.toLowerCase())).size === 3) {
      out.push({ uid, drill: true, exam: true, kind: 'rmean', ex: 'R-mean', stim: 'sentence', listen: false, tap: true,
        text: 'Lee y toca lo que significa: «' + py + '»', answers: [es].concat(wrong), correct: es, key: plain(py),
        say: { py, es }, show: { py, es } });
    }
  });
  return out;
}

// ── a world's drills ─────────────────────────────────────────────────────────────────────────────────────────────
// w: a world of core/entrenamiento.js worldsOf ({ key, kind, n, pack }) → [drill]
const _cache = {};
function forWorld(level, w) {
  const lvl = Levels.normalize(level);
  if (!lvl || !w) return [];
  const ck = lvl + '|' + w.key;
  if (_cache[ck]) return _cache[ck];
  const b = baseOf(lvl);
  let out = [];
  if (b) {
    if (w.kind === 'world') b.words.filter((x) => x.world === w.n).forEach((x) => { out = out.concat(wordDrills(lvl, b, x)); });
    if (w.kind === 'simulacro') out = out.concat(simDrills(lvl, b));
    else {
      // the world's dialogues (its pack's r items) heard only; authored ones of this La Base world
      const items = ((w.pack && w.pack.rounds) || []).flatMap((r) => r.items || []).filter((it) => it.k === 'r');
      const replies = items.map((it) => it.b);
      items.forEach((it, i) => {
        const pool = it.w && it.w.length >= 2 ? it.w : replies;
        out = out.concat(dialogueDrills(lvl, b, it.a, it.b, pool, lvl + ':' + w.key + ':r' + i));
      });
      if (w.kind === 'world') {
        (DIALOGUES[lvl] || []).forEach((d, i) => {
          if (d[0] !== w.n) return;
          out = out.concat(dialogueDrills(lvl, b, d[1], d[2], replies.concat((DIALOGUES[lvl] || []).map((x) => x[2])), lvl + ':dlg' + i, d[3], d[4])
            .filter((x) => x.kind === 'ldlg'));
        });
      }
    }
  }
  // one drill per thing the phone sees (its text and options): two drills that would look the same are one
  const seen = new Map();
  out = out.filter((q) => {
    const id = q.text + '|' + q.answers.slice().sort().join('|') + '|' + (q.imageFile || '') + '|' + (q.say.file || q.say.hz || q.say.py);
    if (seen.has(id)) return false;
    seen.set(id, q);
    return true;
  });
  // two heard-only drills with the same written options but different answers (their lines differ, the screen does
  // not): the later one takes a fourth option from its kind's other options, so what a phone sees always has one
  // answer (a teacher's report, a retry and the tests can tell them apart); still alike → left out
  const look = new Map();
  const lookOf = (q) => q.text + '|' + q.answers.slice().sort().join('|');
  out = out.filter((q) => {
    let id = lookOf(q);
    if (look.has(id) && look.get(id) !== q.correct && !q.labels) {
      const extra = out.filter((x) => x.kind === q.kind && x !== q).flatMap((x) => x.answers).find((a) => !q.answers.some((b) => plain(b) === plain(a)));
      if (extra) { q.answers = q.answers.concat(extra); id = lookOf(q); }
    }
    if (look.has(id) && look.get(id) !== q.correct) return false;
    look.set(id, q.correct);
    return true;
  });
  _cache[ck] = out;
  return out;
}

module.exports = { forWorld, baseOf, PIC, BASE_DIR, _untone: untone, _namesMeaning: namesMeaning, DIALOGUES };
