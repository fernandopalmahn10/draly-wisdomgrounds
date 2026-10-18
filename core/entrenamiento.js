// =========================================================================
// entrenamiento.js — El Entrenamiento, step 2 of La Ruta Dorada (phase 4 · his picks 2026-10-16)
// =========================================================================
// Exam-style practice world by world, from the level's curriculum pack (core/packs.js): quick rounds of ~10 questions,
// one at a time, with audio, instant right/wrong that shows the right answer, streaks and stars. The best % per world
// goes on the kid's record (core/ruta-progress.js recordPractice) and opens El Simulacro Dorado once every world has
// doradoPct % or more (the rule in /maestro → Teachers).
//
// The worlds: the pack's worlds by order = La Base's worlds (world N ↔ La Base world N, checked by word overlap in
// scripts/test-ruta-training.js; HSK 1's pack names differ from its book, the book's names are shown), plus the pack's
// extra worlds: «Pinyin básico» (HSK 1) open from the start, «Simulacro del examen» open once every regular world is
// ready (the bridge to the Dorado). Only the regular worlds count for the Dorado.
//
// Doors (server.js, in this order): LevelKeys.access (the level's key: the one door) → the world open for this kid
// (RutaProgress: their La Base seals, a teacher's «Desbloquear», a teacher device) → a round. A round lives on the
// server (memory, 3 h): its questions go to the phone WITHOUT the right answers; each answer is checked here and the
// right one comes back only once the kid answered that question (the first answer counts, never a second try); the %
// is counted here from those answers, never taken from the phone. The audio of a question streams from here too
// (/api/ruta/train/voice/…): never a text in a URL, and the audio that would say the answer («after») only once answered.
//
// A key-only phone (nobody logged in) may practise: its score comes back with a signed proof (bound to that phone)
// that the phone keeps; at the kid's first login the phone hands the proofs in (POST /api/ruta/train/scores) and they
// join the account by best % (like La Base's seals: `who` names the account the phone's mirror holds, 409 for a
// sibling's). Only scores on an account open the Dorado.
// No hanzi ever reaches the phone (the voice is made from hanzi on the server only); pinyin without tone marks.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Levels = require('./levels');
const Packs = require('./packs');
const RP = require('./ruta-progress');
const SimLock = require('./sim-lock');
const Drills = require('./entrenamiento-drills');   // the exam's own kinds of question (2026-10-18)

const BASE_DIR = path.join(__dirname, '..', 'protected', 'base');
const ROUND_SIZE = 10;
const ROUND_TTL = 3 * 3600e3;          // a round left open in a tab still answers for 3 hours
const MAX_ROUNDS = 3000;               // every round on the server at once (~2 KB each)
const PER_OWNER = 3;                   // rounds open per kid / phone (a new one drops the oldest)
const PROOF_TTL = 180 * 86400e3;       // a key-only phone's score waits up to 180 days for the first login
const VOICE_MAX = 600;                 // voice requests per round (a phone asks a clip in parts; replays included)
const EXTRA = ['pinyin', 'simulacro'];
const plain = Packs.plain;
const fail = (status, error, more) => Object.assign({ ok: false, status, error }, more || {});

// ── the worlds of a level ───────────────────────────────────────────────────────────────────────────────────────
// [{ key, kind: 'world' | 'pinyin' | 'simulacro', n (La Base world, regular worlds only), name, short, emoji, pack }]
// in the order a kid meets them: Pinyin básico first (open from the start), the worlds, the Simulacro last.
const _worlds = {};
function worldsOf(level) {
  const lvl = Levels.normalize(level);
  if (!lvl) return null;
  if (_worlds[lvl] !== undefined) return _worlds[lvl];
  const info = Levels.info(lvl);
  const pack = Packs.LEVELS.find((p) => p.id === info.pack);
  const base = RP.baseOf(lvl);
  let out = null;
  if (pack && base) {
    out = [];
    const regular = pack.worlds.filter((w) => !EXTRA.includes(w.id));
    if (regular.length !== base.worlds.length) console.warn('[train] ' + info.name + ': ' + regular.length + ' pack worlds for ' + base.worlds.length + ' La Base worlds (matched by order)');
    const pin = pack.worlds.find((w) => w.id === 'pinyin');
    if (pin) out.push({ key: 'pinyin', kind: 'pinyin', n: null, name: 'Pinyin básico', short: 'Pinyin', emoji: pin.emoji, pack: pin });
    regular.forEach((w, i) => {
      const bw = base.worlds[i];
      if (!bw) return;
      out.push({ key: w.id, kind: 'world', n: bw.n, name: bw.name || w.name.replace(/^EXP\d+\s*·\s*/, ''), short: bw.short || bw.name, emoji: w.emoji, pack: w });
    });
    const sim = pack.worlds.find((w) => w.id === 'simulacro');
    if (sim) out.push({ key: 'simulacro', kind: 'simulacro', n: null, name: 'Simulacro del examen', short: 'Simulacro', emoji: sim.emoji, pack: sim });
  }
  _worlds[lvl] = out;
  return out;
}
const packLevelOf = (lvl) => Packs.LEVELS.find((p) => p.id === Levels.info(lvl).pack);
// the key a world's practice is stored under on the record: its La Base world number, or 'pinyin' / 'simulacro'
const recKey = (w) => (w.kind === 'world' ? w.n : w.key);

// ── what a kid sees: every world, open or not, their best % ─────────────────────────────────────────────────────
// a = LevelKeys.access(req, level) (already ok) · rec = the logged-in kid's record or null · claimed = the seals this
// phone holds (a Set of word numbers: a free tap carries no secret, so a phone may count its own, logged in or not)
// → null | { level, worlds: [{ key, kind, n, name, short, emoji, open, via, sealed, count, best, counts }], ready, of,
//            dorado: { open, rule, via, pct, practiced, of, login } }
function view(level, rec, a, claimed) {
  const lvl = Levels.normalize(level);
  const W = worldsOf(lvl);
  if (!W || !a || !a.ok) return null;
  const st = RP.state(rec, lvl);
  const mine = claimed instanceof Set && claimed.size ? RP.state(null, lvl, { seals: claimed }) : null;
  const teacher = a.via === 'teacher';
  const e = rec ? (RP.entryOf(rec, lvl) || {}) : {};
  const p = e.p && typeof e.p === 'object' && !Array.isArray(e.p) ? e.p : {};
  const settings = RP.getSettings();
  const worlds = W.map((w) => {
    const bestRaw = Number(p[recKey(w)]);
    const best = rec && p[recKey(w)] != null && Number.isFinite(bestRaw) ? bestRaw : null;
    const o = { key: w.key, kind: w.kind, n: w.n, name: w.name, short: w.short, emoji: w.emoji, open: false, via: null, sealed: null, count: null, best,
      counts: w.kind === 'world' };
    if (w.kind === 'world') {
      const sw = st.worlds.find((x) => x.n === w.n) || { sealed: 0, count: 0 };
      const cw = mine && mine.worlds.find((x) => x.n === w.n);
      const bySeals = sw.via === 'seals' || !!(cw && cw.train);
      o.sealed = Math.max(sw.sealed || 0, (cw && cw.sealed) || 0);
      o.count = sw.count;
      o.open = teacher || bySeals || !!sw.teacher;
      o.via = teacher ? 'teacher' : bySeals ? 'seals' : (sw.teacher ? 'teacher' : null);
    } else if (w.kind === 'pinyin') { o.open = true; o.via = 'start'; }
    return o;
  });
  const regular = worlds.filter((w) => w.kind === 'world');
  const ready = regular.filter((w) => w.open).length;
  worlds.filter((w) => w.kind === 'simulacro').forEach((w) => {
    w.open = teacher || (regular.length > 0 && ready === regular.length);
    w.via = w.open ? (teacher ? 'teacher' : 'ready') : null;
  });
  const d = st.dorado;
  const dOpen = RP.doradoOpen(a, rec, lvl);
  const dorado = { open: dOpen, rule: d.rule, via: teacher ? 'teacher' : (dOpen ? (d.via || 'key') : null), pct: settings.doradoPct,
    practiced: rec ? d.practiced : 0, of: regular.length, login: !rec && !teacher && d.rule === 'practice' };
  return { level: lvl, worlds, ready, of: regular.length, dorado };
}
// one world of a view, by its key → the world or null
const worldIn = (v, key) => (v && v.worlds.find((w) => w.key === String(key || ''))) || null;

// ── a round's questions ─────────────────────────────────────────────────────────────────────────────────────────
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// every question of the world's pack rounds (built fresh: options and their order change each time), one per text,
// and the world's exam drills (core/entrenamiento-drills.js: the exam's picture and listening kinds; many share their
// text, so one per drill)
function poolOf(lvl, w) {
  const pl = packLevelOf(lvl);
  const seen = new Set();
  const out = [];
  w.pack.rounds.forEach((r) => Packs.buildRound(pl, w.pack, r).forEach((q) => {
    if (seen.has(q.text)) return;
    seen.add(q.text);
    out.push(q);
  }));
  Drills.forWorld(lvl, w).forEach((q) => { if (!seen.has(q.uid)) { seen.add(q.uid); out.push(q); } });
  return out;
}
// ~10 questions with a mix of kinds (word → pinyin, pinyin → meaning, sentences, dialogues…), never two neighbours
// about the same word
function pickQuestions(pool, n) {
  const byKind = {};
  shuffle(pool).forEach((q) => { (byKind[q.kind] = byKind[q.kind] || []).push(q); });
  const kinds = shuffle(Object.keys(byKind));
  const out = [];
  while (out.length < n && kinds.some((k) => byKind[k].length)) {
    kinds.forEach((k) => { if (out.length < n && byKind[k].length) out.push(byKind[k].shift()); });
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length; i++) {
      if (!out[i].key || out[i].key !== out[i - 1].key) continue;
      const j = out.findIndex((q, k) => k !== i && k !== i - 1 && q.key !== out[i - 1].key &&
        (k === 0 || out[k - 1].key !== out[i].key) && (k + 1 >= out.length || out[k + 1].key !== out[i].key));
      if (j >= 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

// ── the audio of a question (server side only: the phone never sees these texts or any hanzi) ──────────────────
// «…» groups of a question's text, and whether a text is pinyin (toneless, as the packs write it)
const groups = (t) => (String(t || '').match(/«([^«»]+)»/g) || []).map((g) => g.slice(1, -1).trim());
// the syllables of Mandarin (toneless; v = ü), initial by initial, so a Spanish word («mano», «uno») is not taken for pinyin
const SYL_TABLE = {
  '': 'a o e ai ei ao ou an en ang eng er',
  b: 'a o ai ei ao an en ang eng i ie iao ian in ing u', p: 'a o ai ei ao ou an en ang eng i ie iao ian in ing u',
  m: 'a o e ai ei ao ou an en ang eng i ie iao iu ian in ing u', f: 'a o ei ou an en ang eng u',
  d: 'a e ai ei ao ou an en ang eng ong i ie iao iu ian ing u uo ui uan un', t: 'a e ai ao ou an ang eng ong i ie iao ian ing u uo ui uan un',
  n: 'a e ai ei ao ou an en ang eng ong i ie iao iu ian in iang ing u uo uan v ve', l: 'a o e ai ei ao ou an ang eng ong i ia ie iao iu ian in iang ing u uo uan un v ve',
  g: 'a e ai ei ao ou an en ang eng ong u ua uo uai ui uan un uang', k: 'a e ai ei ao ou an en ang eng ong u ua uo uai ui uan un uang',
  h: 'a e ai ei ao ou an en ang eng ong u ua uo uai ui uan un uang',
  j: 'i ia ie iao iu ian in iang ing iong u ue uan un', q: 'i ia ie iao iu ian in iang ing iong u ue uan un', x: 'i ia ie iao iu ian in iang ing iong u ue uan un',
  zh: 'a e ai ei ao ou an en ang eng ong i u ua uo uai ui uan un uang', ch: 'a e ai ao ou an en ang eng ong i u ua uo uai ui uan un uang',
  sh: 'a e ai ei ao ou an en ang eng i u ua uo uai ui uan un uang', r: 'e ao ou an en ang eng ong i u ua uo ui uan un',
  z: 'a e ai ei ao ou an en ang eng ong i u uo ui uan un', c: 'a e ai ao ou an en ang eng ong i u uo ui uan un', s: 'a e ai ao ou an en ang eng ong i u uo ui uan un',
  y: 'a e ao ou an in ang ing ong i u ue uan un o', w: 'a o ai ei an en ang eng u',
};
const SYLLABLES = new Set();
Object.keys(SYL_TABLE).forEach((i) => SYL_TABLE[i].split(' ').forEach((f) => { SYLLABLES.add(i + f); SYLLABLES.add(i + f + 'r'); }));
SYLLABLES.add('r');   // the erhua written apart («yidian r»)
const NAMES = new Set(['aileen', 'hamdan', 'latifa', 'adric', 'adrian', 'dralingo', 'fer', 'xiao']);
// (a syllable that starts with a, o or e only opens a word or follows an apostrophe: «xi'an», never «mano» = man + o)
function syllabic(tok) {
  return tok.split("'").every((s) => {
    if (!s) return false;
    const ok = [true];
    for (let i = 1; i <= s.length; i++) {
      ok[i] = false;
      for (let k = Math.max(0, i - 7); k < i && !ok[i]; k++) {
        const piece = s.slice(k, i);
        if (ok[k] && SYLLABLES.has(piece) && (k === 0 || !/^[aoe]/.test(piece))) ok[i] = true;
      }
    }
    return ok[s.length];
  });
}
function isPinyin(text) {
  const t = String(text || '');
  if (!t.trim() || /[áéíóúñ¿¡]/i.test(t) || /_{2,}/.test(t)) return false;
  const toks = t.toLowerCase().replace(/ü/g, 'v').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?;:"()…–—-]/g, ' ').split(/\s+/).filter(Boolean);
  const words = toks.filter((x) => /[a-z]/.test(x));
  return words.length > 0 && words.every((x) => /^[a-z']+$/.test(x) && (NAMES.has(x) || syllabic(x)));
}
// what the question says aloud: ask = before answering (only what the screen already shows in pinyin: the word or
// sentence asked about, the line someone says, the exam passage), opts = the four options one by one (they are pinyin),
// after = once answered (the right answer, the sentence with its blank filled, the reply). es = the Spanish asked.
function voicePlan(q) {
  // a drill says its own line (a La Base clip, the exam's Chinese, or its pinyin), before and again after the answer
  if (q.drill) return { ask: q.say.py, opts: false, after: q.say.py, es: q.say.es || null };
  const gs = groups(q.text);
  const allPinyin = q.answers.every(isPinyin);
  const plan = { ask: null, opts: false, after: null, es: null };
  if (q.kind === 'es2zh') {
    plan.es = gs[0] || null;
    plan.opts = allPinyin;
    plan.after = isPinyin(q.correct) ? q.correct : null;
  } else if (q.kind === 'zh2es' || q.kind === 'w' || q.kind === 'm') {
    plan.ask = gs.find(isPinyin) || null;
    plan.after = plan.ask;
    plan.es = q.correct;
  } else if (q.kind === 'r') {
    plan.ask = gs.find(isPinyin) || null;
    plan.after = isPinyin(q.correct) ? q.correct : null;
  } else {                                                                // 'f' and 'q': authored items
    const blank = gs.find((g) => /_{2,}/.test(g));
    if (blank) {
      plan.opts = allPinyin;
      const filled = blank.replace(/_{2,}/, q.correct);
      plan.after = isPinyin(filled) ? filled : (isPinyin(q.correct) ? q.correct : null);
    } else {
      const zh = gs.filter(isPinyin);
      if (zh.length) plan.ask = zh.map((g) => (/[.?!,;:]$/.test(g) ? g : g + ',')).join(' ').replace(/,$/, '');
      else plan.opts = allPinyin;
      plan.after = isPinyin(q.correct) ? q.correct : null;
    }
  }
  return plan;
}
// La Base's own clips (the book's words and sentences, read and checked: core/levels.js `base`): plain pinyin →
// [{ file, es }] for words, plain sentence → file. Read once per level.
const _baseIdx = {};
function baseIndex(lvl) {
  if (_baseIdx[lvl]) return _baseIdx[lvl];
  const idx = { words: new Map(), sents: new Map() };
  const b = RP.baseOf(lvl);
  try {
    const data = JSON.parse(fs.readFileSync(path.join(BASE_DIR, b.id, 'base.json'), 'utf8'));
    const fileOf = (u) => { const m = /\/base-media\/[^/]+\/([A-Za-z0-9_-]+\.mp3)/.exec(String(u || '')); return m ? path.join(BASE_DIR, b.id, m[1]) : null; };
    (data.words || []).forEach((w) => {
      const f = fileOf(w.au);
      if (f) { const k = plain(w.py); if (!idx.words.has(k)) idx.words.set(k, []); idx.words.get(k).push({ file: f, es: String(w.es || '') }); }
      const s = fileOf(w.exau);
      if (s && Array.isArray(w.ex)) { const k = plain(w.ex.join('')); if (k && !idx.sents.has(k)) idx.sents.set(k, s); }
    });
  } catch (e) { console.warn('[train] La Base clips of ' + lvl + ' unreadable:', e.message); }
  _baseIdx[lvl] = idx;
  return idx;
}
// plain pinyin → hanzi from the curriculum words (this level first, then the others), for the voice only
const _hz = {};
function hanziMap(lvl) {
  if (_hz[lvl]) return _hz[lvl];
  const m = new Map();
  const own = packLevelOf(lvl);
  [own].concat(Packs.LEVELS.filter((p) => p !== own)).forEach((pl) => pl && pl.worlds.forEach((w) => w.rounds.forEach((r) => (r.words || []).forEach((x) => {
    const k = plain(x.py);
    if (x.hz && k && !m.has(k)) m.set(k, x.hz);
  }))));
  _hz[lvl] = m;
  return m;
}
const meaningParts = (es) => String(es || '').toLowerCase().split('/').map((x) => x.replace(/\(.*?\)/g, '').replace(/[¿?¡!.,]/g, '').trim()).filter(Boolean);
const sharesMeaning = (a, b) => { const pa = meaningParts(a); return meaningParts(b).some((x) => pa.includes(x)); };
let tokenHanzi = () => null;      // server.js plugs in the platform's pinyin → hanzi list (warmup-vocab.js) as a fallback
function configure(o) { if (o && typeof o.tokenHanzi === 'function') tokenHanzi = o.tokenHanzi; }
const ZH_PUNCT = { ',': '，', '.': '。', '?': '？', '!': '！', ':': '：', ';': '；' };
// toneless pinyin is ambiguous (hao 好/号, shi 是/十, zai 在/再, ba 八/吧, ma 吗/妈): the few that matter in the packs'
// sentences are read from their neighbours; everything else from the curriculum words
const DIGIT = { yi: '一', er: '二', san: '三', si: '四', wu: '五', liu: '六', qi: '七', ba: '八', jiu: '九', shi: '十', liang: '两', ling: '零', bai: '百' };
const isNumWord = (x) => !!x && (/^\d+$/.test(x) || /^(yi|er|san|si|wu|liu|qi|ba|jiu|shi|liang|ling|bai|ji)+$/.test(x));
const COUNTED = new Set(['yue', 'hao', 'sui', 'ge', 'dian', 'fen', 'kuai', 'tian', 'nian', 'ben', 'bei', 'kou', 'ci', 'zhi', 'xingqi', 'jian', 'zhang']);
const VEHICLES = new Set(['chuzuche', 'feiji', 'che', 'huoche', 'gonggongqiche', 'gongjiaoche', 'ditie', 'chuan', 'qiche']);
const DRINKS = new Set(['shui', 'cha', 'niunai', 'kafei', 'shenme', 'jiu', 'guozhi', 'tang', 'kele', 'yi', 'bei', 'nainai', 'dian', 'dianr', 'ma', 'le', 'guo']);
const DRINK_NOUNS = new Set(['shui', 'cha', 'niunai', 'kafei', 'guozhi', 'kele', 'nainiu']);
const VERBS_BEFORE = new Set(['ai', 'xiang', 'yao', 'xihuan', 'bu', 'mei', 'zai', 'hui', 'neng', 'qu', 'lai', 'keyi']);
const QWORDS = /\b(shenme|shei|ji|ma|nar|naer|nali|zenme|zenmeyang|duoshao|ne|weishenme)\b/;
const HANZI_NUM = /^[一二三四五六七八九十两几零百\d]+$/;
// words the packs don't list on their own (the voice only): sentence words of the exam passages
const MORE = { meiyou: '没有', guanxi: '关系', yidianr: '一点儿', yidian: '一点', haizimen: '孩子们', gongsi: '公司', gongzuo: '工作',
  qianbian: '前边', houbian: '后边', qianmian: '前面', houmian: '后面', shangmian: '上面', xiamian: '下面', limian: '里面', waimian: '外面',
  mian: '面', lai: '来', dian: '点', bei: '杯', le: '了', de: '的', ne: '呢', ye: '也', dou: '都', hen: '很', bu: '不', mei: '没',
  niu: '牛', nainiu: '奶牛', mingzao: '明早', chuzu: '出租', wang: '王', keqi: '客气', bukeqi: '不客气', bushi: '不是', zhuyuan: '住院',
  huiqu: '回去', huilai: '回来', huijia: '回家' };
// one word: its neighbours decide the few that the packs' sentences need. k / next = plain keys; prevHz = what the word
// before became (a number in hanzi or digits = a counted thing follows); cap = written with a capital (a surname)
function contextHanzi(k, prevHz, prev, next, next2, end, question, sentence, cap) {
  const afterNum = HANZI_NUM.test(prevHz || '');
  if (k === 'hao') return afterNum ? '号' : '好';
  // (a number written apart after «shi» is «是» + the number: the packs write 17 as one word, «shiqi»)
  if (k === 'shi') return afterNum || (COUNTED.has(next) && next !== 'hao' && next !== 'ge') ? '十' : '是';
  if (k === 'yu' && prev === 'xia') return '雨';
  if (k === 'xue' && prev === 'xia') return '雪';                        // xia xue le = 下雪了 (never 下学)
  if (k === 'da' && ['dianhua', 'qiu', 'lanqiu', 'zuqiu'].includes(next)) return '打';
  if (k === 'zai') return next === 'lai' || next === 'gei' ? '再' : '在';
  if (k === 'ba') return end && !afterNum ? '吧' : '八';
  if (k === 'ma') return end ? '吗' : null;
  // (a drink before it lists drinks: «shui he niunai» = 水和牛奶; «he kou shui» = 喝口水)
  if (k === 'he') return DRINK_NOUNS.has(prev) ? '和' : DRINKS.has(next) || next === 'kou' || VERBS_BEFORE.has(prev) ? '喝' : '和';
  if (k === 'hui') return ['jia', 'lai', 'qu', 'gongsi', 'xuexiao', 'beijing', 'zhongguo'].includes(next) ? '回' : null;
  if (k === 'zuo') return VEHICLES.has(next) || (next === 'shenme' && VEHICLES.has(next2)) || ['chuzu', 'zher', 'zheer', 'zheli', 'nar', 'naer', 'xia', 'zai'].includes(next) || prev === 'qing' ? '坐' : null;
  if (k === 'jian') return afterNum || prev === 'zhe' || prev === 'na' ? '件' : '见';
  if (k === 'ge') return /\bchang\b/.test(sentence) || ['zhongwen', 'hanyu', 'yingwen'].includes(prev) ? '歌' : null;
  if (k === 'li' && cap) return '李';
  if (k === 'xie' && cap) return '谢';
  if (k === 'dian') return next === 'li' ? '店' : '点';
  if (k === 'na' || k === 'nage' || k === 'naxie') {
    const ask = question && !QWORDS.test(sentence);
    return (ask ? '哪' : '那') + (k === 'nage' ? '个' : k === 'naxie' ? '些' : '');
  }
  return null;
}
// a word written as one token that the lists have only in parts (xingqiliu, shijiu, ershiwu sui…): the fewest known
// parts that make it up, else null
function partsHanzi(k, map) {
  if (!k || k.length > 18) return null;
  if (/^(yi|er|san|si|wu|liu|qi|ba|jiu|shi|liang|ling|bai)+$/.test(k)) {
    const out = [];
    let s = k;
    while (s) { const m = /^(liang|ling|bai|san|liu|jiu|shi|yi|er|si|wu|qi|ba)/.exec(s); if (!m) return null; out.push(DIGIT[m[1]]); s = s.slice(m[1].length); }
    return out.join('');
  }
  const best = [[]];
  for (let i = 1; i <= k.length; i++) {
    best[i] = null;
    for (let j = Math.max(0, i - 12); j < i; j++) {
      const piece = k.slice(j, i);
      const hz = map.get(piece) || MORE[piece] || (DIGIT[piece] && piece.length > 1 ? DIGIT[piece] : null);
      if (best[j] && hz && (!best[i] || best[j].length + 1 < best[i].length)) best[i] = best[j].concat(hz);
    }
  }
  return best[k.length] && best[k.length].length <= 4 ? best[k.length].join('') : null;
}
// a pinyin text → the text the Mandarin voice reads (hanzi where known, the rest as written)
function speechText(lvl, text) {
  const map = hanziMap(lvl);
  const whole = map.get(plain(text));
  if (whole) return whole;
  let out = '';
  const toks = String(text).split(/\s+/).filter(Boolean);
  // (flat: no tones, no apostrophe — «shi'er» is 12, not the erhua «shir» that plain() makes of «na'er»)
  const flat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const keys = toks.map(flat);
  // only numbers («¿Cuánto es «shi» − «si»?»): read as numbers
  if (keys.length && keys.every((x) => /^(yi|er|san|si|wu|liu|qi|ba|jiu|shi|liang|ling|bai)+$/.test(x))) return keys.map((x) => partsHanzi(x, map)).join('，');
  // the clause a word is in (up to its . ? ! —): is it a question, and its words (the question words it already has)
  const clauseOf = (i) => {
    let a = i, b = i;
    while (a > 0 && !/[.?!—]$/.test(toks[a - 1])) a--;
    while (b < toks.length - 1 && !/[.?!—]$/.test(toks[b])) b++;
    return { q: /\?/.test(toks[b]), words: keys.slice(a, b + 1).join(' ') };
  };
  let prevHz = '';
  toks.forEach((raw, i) => {
    const m = /^(["'(«]*)(.*?)([.,!?:;"')»]*)$/.exec(raw);
    const core = m ? m[2] : raw;
    const tail = m ? m[3] : '';
    const end = !!tail || i === toks.length - 1;
    const k = keys[i];
    const cl = clauseOf(i);
    const hz = core && (contextHanzi(k, prevHz, keys[i - 1], keys[i + 1], keys[i + 2], end, cl.q, cl.words, /^[A-Z]/.test(core)) ||
      map.get(plain(core)) || MORE[k] || tokenHanzi(core) || partsHanzi(k, map));
    prevHz = hz || core;
    const piece = hz || core;
    if (out && !(hz && /[一-鿿，。？！：；]$/.test(out))) out += hz ? '' : ' ';
    out += piece + tail.split('').map((c) => ZH_PUNCT[c] || '').join('');
  });
  return out.trim() || String(text);
}
// → { file } (a La Base clip) | { text } (for the platform's Mandarin voice) | null
function speechFor(lvl, text, esHint) {
  if (!text) return null;
  const idx = baseIndex(lvl);
  const k = plain(text);
  const ws = idx.words.get(k);
  if (ws && ws.length) {
    const hit = (esHint && ws.find((x) => sharesMeaning(x.es, esHint))) || ws[0];
    if (hit && fs.existsSync(hit.file)) return { file: hit.file };
  }
  const s = idx.sents.get(k);
  if (s && fs.existsSync(s)) return { file: s };
  return { text: speechText(lvl, text) };
}

// ── rounds on the server ────────────────────────────────────────────────────────────────────────────────────────
const rounds = new Map();      // id → round
const PER_ADDRESS = 400;       // rounds open from one internet address (a school's Wi-Fi: 2 classes × 30 kids × a few)
function sweep(now) {
  for (const [id, r] of rounds) if (now - r.at > ROUND_TTL) rounds.delete(id);
  while (rounds.size > MAX_ROUNDS) rounds.delete(rounds.keys().next().value);
}
// who: { code (the logged-in kid, or null), dev (this phone's id), tid (a teacher's id, or null) }
const ownerOf = (who) => (who.tid ? 't:' + who.tid : who.code ? 's:' + who.code : 'd:' + (who.dev || ''));
function owns(r, who) {
  if (!who) return false;
  if (r.owner === ownerOf(who)) return true;
  return r.owner.indexOf('d:') === 0 && !!who.dev && r.owner === 'd:' + who.dev;   // a phone that logged in mid-round
}
function getRound(id, who) {
  const r = typeof id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(id) ? rounds.get(id) : null;
  if (!r || Date.now() - r.at > ROUND_TTL) return { error: fail(410, 'Esta ronda ya terminó. ¡Empieza otra!', { gone: true }) };
  if (!owns(r, who)) return { error: fail(403, 'Esta ronda es de otro teléfono.') };
  return { r };
}
// the phone's view of a round: the questions without the right answers
// (py: which «…» groups of the text are pinyin, and whether the options are: the page sets them in the pinyin type;
// it carries nothing the screen doesn't show)
// (image: an opaque link of the round, never the picture's own file name: the pack names a word's picture after its
// pinyin, «baba.webp» under «¿Cómo se dice «papá»?», which would be the answer. A «¿Cómo se dice?» asks Spanish in
// its «…»: never set in the pinyin type even when a Spanish word happens to spell like pinyin, «casa / familia».)
// (a drill (core/entrenamiento-drills.js) adds what the phone needs to draw it: pics = one link per option (picture
// options, by the round: tokens and links say nothing of the picture), alts = each option's Spanish for a screen
// reader (✓ / ✕: «Sí» / «No»), tf = a ✓ / ✕ question, listen = its line is heard, never shown (alt = that line, shown
// only when the sound fails: never stuck), voice.tap = a reading drill, its audio only when the kid taps it)
const publicRound = (r) => ({
  round: r.id, level: r.level, world: r.world, total: r.qs.length,
  questions: r.qs.map((q, i) => {
    const o = { i, text: q.text, image: q.image || q.imageFile ? '/api/ruta/train/pic/' + r.id + '/' + i : null, answers: q.answers,
      py: groups(q.text).map((g) => q.kind !== 'es2zh' && isPinyin(g.replace(/_{2,}/g, ' '))),
      pyAnswers: !q.labels && q.answers.every(isPinyin),
      voice: { ask: !!q.plan.ask, opts: !!q.plan.opts } };
    if (q.pics) o.pics = q.answers.map((a, k) => '/api/ruta/train/pic/' + r.id + '/' + i + '/' + k);
    if (q.labels) o.alts = q.answers.map((a) => q.labels[a] || '');
    if (q.tf) o.tf = true;
    if (q.listen) { o.listen = true; o.alt = q.say.py; }
    if (q.tap) o.voice.tap = true;
    return o;
  }),
});
// A new round of world `key` (the caller checked LevelKeys.access; this checks the world is open for this kid).
// ip: the request's address (one address never holds more than PER_ADDRESS open rounds: nobody can push every other
// kid's round out of the store). A new round of a world ends the same owner's open round of that world (another tab
// can't be used to see an answer and give it in the round that counts).
function startRound(level, key, who, a, rec, claimed, ip) {
  const lvl = Levels.normalize(level);
  const v = view(lvl, rec, a, claimed);
  if (!v) return fail(404, 'Ese nivel no tiene El Entrenamiento.');
  const w = worldIn(v, key);
  if (!w) return fail(404, 'Ese mundo no existe.');
  if (!w.open) {
    return fail(403, w.kind === 'simulacro' ? 'El Simulacro del examen se abre cuando todos tus mundos estén listos.'
      : 'Este mundo se abre cuando pongas «¡Me la sé!» en todas sus palabras de La Base.', { closed: true });
  }
  const W = worldsOf(lvl).find((x) => x.key === w.key);
  const picked = pickQuestions(poolOf(lvl, W), ROUND_SIZE);
  if (!picked.length) return fail(500, 'Este mundo todavía no tiene preguntas.');
  const now = Date.now();
  sweep(now);
  const owner = ownerOf(who);
  const addr = String(ip || '');
  const all = [...rounds.values()];
  all.filter((x) => x.owner === owner && x.level === lvl && x.world === W.key).forEach((x) => rounds.delete(x.id));
  const mineNow = all.filter((x) => x.owner === owner && rounds.has(x.id)).sort((x, y) => x.at - y.at);
  mineNow.slice(0, Math.max(0, mineNow.length - PER_OWNER + 1)).forEach((x) => rounds.delete(x.id));
  if (addr) {
    const here = all.filter((x) => x.ip === addr && rounds.has(x.id)).sort((x, y) => x.at - y.at);
    here.slice(0, Math.max(0, here.length - PER_ADDRESS + 1)).forEach((x) => rounds.delete(x.id));
  }
  const r = {
    id: crypto.randomBytes(15).toString('base64url'), level: lvl, world: W.key, rk: recKey(W), kind: W.kind, owner, ip: addr, teacher: !!who.tid, at: now,
    qs: picked.map((q) => Object.assign({ text: q.text, image: q.image && q.image !== 'none' ? q.image : null, answers: q.fixed ? q.answers.slice() : shuffle(q.answers),
      correct: q.correct, kind: q.kind, plan: voicePlan(q) },
    // a drill's own parts (✓ / ✕ keeps «Sí» before «No»)
    q.drill ? { drill: true, imageFile: q.imageFile || null, pics: q.pics || null, labels: q.labels || null, say: q.say, show: q.show || null,
      listen: !!q.listen, tap: !!q.tap, tf: !!q.tf } : {})),
    ans: [], done: null, voice: 0,
  };
  rounds.set(r.id, r);
  return Object.assign({ ok: true }, publicRound(r));
}
// One answer: the first answer to a question counts; the right one comes back only now. → { ok, correct, expected, after }
function answer(id, i, chosen, who) {
  const { r, error } = getRound(id, who);
  if (error) return error;
  if (r.done) return fail(409, 'Esta ronda ya terminó.');
  const n = Number(i);
  if (!Number.isInteger(n) || n < 0 || n >= r.qs.length) return fail(400, 'Esa pregunta no está en la ronda.');
  const q = r.qs[n];
  // (asked again, e.g. a lost reply and another tile tapped: the first answer stands, and which one it was comes back)
  // (a drill also says, now, what its line was: «Decía «mao»: gato»)
  const show = q.show ? { show: q.show } : {};
  if (r.ans[n]) return Object.assign({ ok: true, correct: r.ans[n].ok, expected: q.correct, after: !!q.plan.after, again: true, chosen: r.ans[n].c }, show);
  if (typeof chosen !== 'string' || !q.answers.includes(chosen)) return fail(400, 'Esa respuesta no está en la pregunta.');
  const right = chosen === q.correct;
  r.ans[n] = { c: chosen, ok: right };
  return Object.assign({ ok: true, correct: right, expected: q.correct, after: !!q.plan.after }, show);
}
const starsOf = (pct, need) => (pct >= Math.max(90, need) ? 3 : pct >= need ? 2 : pct >= 40 ? 1 : 0);
// The end of a round: the % from the answers given here. A logged-in kid's best goes on their record (and may open
// the Dorado); a teacher's try is never saved; a key-only phone gets its score back with a proof for its first login.
// save(code, level, recKey, pct) → { ok, best } is RutaProgress.recordPractice (server.js passes it; tests too).
function finish(id, who, a, rec) {
  const { r, error } = getRound(id, who);
  if (error) return error;
  if (r.done) return r.done;
  const total = r.qs.length;
  const right = r.ans.filter((x) => x && x.ok).length;
  const pct = Math.round((right * 100) / total);
  const need = RP.getSettings().doradoPct;
  const out = { ok: true, right, total, pct, stars: starsOf(pct, need), need, world: r.world, saved: false, best: null, record: false, doradoNow: false };
  if (r.teacher || (a && a.via === 'teacher')) out.teacher = true;
  else if (rec && rec.code) {
    const v0 = view(r.level, rec, a);
    const before = worldIn(v0, r.world);
    const dBefore = RP.doradoOpen(a, rec, r.level);
    const s = RP.recordPractice(rec.code, r.level, r.rk, pct);
    if (s.ok) {
      out.saved = true;
      out.best = s.best;
      out.record = !!(before && before.best != null && pct > before.best);   // beating an earlier round (a first try is just a first try)
      out.doradoNow = !dBefore && RP.doradoOpen(a, rec, r.level);
    }
  } else {
    // a key-only phone: the score stays on it, with a proof that only this phone can hand in at the first login
    out.phone = true;
    out.proof = SimLock.sign('tp', [r.level, r.world, pct, who.dev || '', r.id], PROOF_TTL);
  }
  r.done = out;
  return out;
}
// The audio of question i: part 'ask' | 'o0'…'o3' (the options, in the order the phone shows them) | 'after' (only once
// the question is answered). → { ok, file } | { ok, text } | { ok: false, status }
function voice(id, i, part, who) {
  const { r, error } = getRound(id, who);
  if (error) return error;
  const n = Number(i);
  if (!Number.isInteger(n) || n < 0 || n >= r.qs.length) return fail(404, 'no such question');
  // (counted per clip: a phone asks a clip in parts and a kid replays it; 12 asks of one clip, VOICE_MAX in the round)
  r.vp = r.vp || {};
  const vk = n + ':' + part;
  r.vp[vk] = (r.vp[vk] || 0) + 1;
  if (r.vp[vk] > 12 || ++r.voice > VOICE_MAX) return fail(429, 'Espera un momento.');
  const q = r.qs[n];
  // a drill's line: La Base's own clip, else the exam's own Chinese, else its pinyin read by the platform voice
  if (q.say && (part === 'ask' || part === 'after')) {
    if (part === 'after' && !r.ans[n]) return fail(403, 'answer first');
    if (q.say.file && fs.existsSync(q.say.file)) return { ok: true, file: q.say.file };
    if (q.say.hz) return { ok: true, text: q.say.hz };
    const sp = speechFor(r.level, q.say.py, q.say.es);
    return sp ? Object.assign({ ok: true }, sp) : fail(404, 'nothing to say');
  }
  let text = null, es = null;
  if (part === 'ask') text = q.plan.ask;
  else if (part === 'after') {
    if (!r.ans[n]) return fail(403, 'answer first');
    text = q.plan.after;
    es = q.plan.es;
  } else {
    const m = /^o([0-3])$/.exec(String(part || ''));
    if (!m || !q.plan.opts) return fail(404, 'no such part');
    text = q.answers[Number(m[1])];
    // (the right option's clip by its meaning: «shi» for «diez» is the La Base word of that meaning; the others as
    // spelled. Whatever the kid hears, all four options sound alike before the answer: nothing tells them apart.)
    if (text === q.correct) es = q.plan.es;
  }
  const sp = speechFor(r.level, text, es);
  return sp ? Object.assign({ ok: true }, sp) : fail(404, 'nothing to say');
}
// A proof joins ONE account: the round it came from is written down with the account that took it (a family or school
// tablet played without a login can't hand the same round to every kid who logs in on it). <data>/train-proofs.json
// { <round id>: [<account's opaque id>, <ms>] }, entries older than the proofs themselves dropped.
const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');
const USED_FILE = path.join(DATA_DIR, 'train-proofs.json');
let used = null;
let usedTimer = 0;
function usedMap() {
  if (used) return used;
  used = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(USED_FILE, 'utf8')) || {};
    const now = Date.now();
    Object.keys(raw).forEach((k) => { const e = raw[k]; if (Array.isArray(e) && now - Number(e[1]) < PROOF_TTL) used.set(k, [String(e[0]), Number(e[1])]); });
  } catch (_) { /* none yet */ }
  return used;
}
function saveUsed() {
  clearTimeout(usedTimer);
  usedTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = USED_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(usedMap())), 'utf8');
      fs.renameSync(tmp, USED_FILE);
    } catch (e) { console.warn('[train] could not save the used proofs:', e.message); }
  }, 1000);
  if (usedTimer.unref) usedTimer.unref();
}
const acctId = (code) => SimLock.hmacHex('train-acct:' + code, 12);
// A key-only phone's proofs join the logged-in kid's account (best % per world). who.dev must be the phone that
// earned them, and each proof's round goes to one account only. → { ok, merged }
function mergeProofs(code, level, proofs, who) {
  const lvl = Levels.normalize(level);
  const W = worldsOf(lvl);
  if (!W) return fail(404, 'Ese nivel no tiene El Entrenamiento.');
  if (!Array.isArray(proofs) || proofs.length > 60) return fail(400, 'Puntos no válidos.');
  const U = usedMap();
  const me = acctId(code);
  let merged = 0, changed = false;
  proofs.forEach((t) => {
    const v = SimLock.verify(t, 'tp');
    if (!v || v.length < 5 || Levels.normalize(v[0]) !== lvl || !who.dev || v[3] !== who.dev || !v[4]) return;
    const w = W.find((x) => x.key === v[1]);
    const pct = Number(v[2]);
    if (!w || !Number.isInteger(pct) || pct < 0 || pct > 100) return;
    const prev = U.get(v[4]);
    if (prev && prev[0] !== me) return;                       // already joined another account
    if (RP.recordPractice(code, lvl, recKey(w), pct).ok) {
      merged++;
      if (!prev) { U.set(v[4], [me, Date.now()]); changed = true; }
    }
  });
  if (changed) {
    const now = Date.now();
    for (const [k, e] of U) if (now - e[1] > PROOF_TTL) U.delete(k);
    saveUsed();
  }
  return { ok: true, merged };
}
// A question's picture, through the round's own door (its file name would say a «¿Cómo se dice?»'s answer).
// → { ok, file } | { ok: false, status }
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PACK_PICS = path.join(PUBLIC_DIR, 'assets', 'packs') + path.sep;
// k: one of a drill's picture options, by its place in the round (the drills' pictures are La Base's: under
// protected/base/<level>-base/pics, behind the same key as this round)
const BASE_PICS = path.join(Drills.BASE_DIR) + path.sep;
function picture(id, i, who, k) {
  const { r, error } = getRound(id, who);
  if (error) return error;
  const q = r.qs[Number(i)];
  if (!q) return fail(404, 'no picture');
  let abs = null;
  if (k !== undefined && k !== null) {
    if (!/^[0-3]$/.test(String(k)) || !q.pics) return fail(404, 'no picture');
    abs = q.pics[q.answers[Number(k)]] || null;
  } else if (q.imageFile) abs = q.imageFile;
  else if (q.image) abs = path.join(PUBLIC_DIR, q.image);
  const inside = abs && (abs.indexOf(PACK_PICS) === 0 || (abs.indexOf(BASE_PICS) === 0 && path.basename(path.dirname(abs)) === 'pics'));
  if (!inside || !fs.existsSync(abs)) return fail(404, 'no picture');
  return { ok: true, file: abs };
}
// the level a round is of (server.js asks LevelKeys.access for it before anything else), or null
function roundLevel(id) {
  const r = typeof id === 'string' ? rounds.get(id) : null;
  return r ? r.level : null;
}
// the account's best % per world key (the phone's mirror and /maestro read it)
function bestOf(rec, level) {
  const lvl = Levels.normalize(level);
  const W = worldsOf(lvl);
  const e = rec ? RP.entryOf(rec, lvl) : null;
  const p = e && e.p && typeof e.p === 'object' ? e.p : {};
  const out = {};
  (W || []).forEach((w) => { const v = Number(p[recKey(w)]); if (p[recKey(w)] != null && Number.isFinite(v)) out[w.key] = v; });
  return out;
}

module.exports = {
  ROUND_SIZE, EXTRA,
  configure, worldsOf, view, worldIn, recKey,
  startRound, answer, finish, voice, picture, mergeProofs, bestOf, starsOf, roundLevel,
  // tests
  _voicePlan: voicePlan, _isPinyin: isPinyin, _speechText: speechText, _speechFor: speechFor, _rounds: rounds, _poolOf: poolOf, _drills: Drills,
};
