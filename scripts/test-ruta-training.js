#!/usr/bin/env node
// test-ruta-training.js — La Ruta Dorada, phase 4 (2026-10-16): El Entrenamiento + the Dorado rule switched on.
// Two parts, both on MADE-UP accounts in temporary folders (never data/, never the live site):
//   1. in this process (core/entrenamiento.js, core/ruta-progress.js on a temp folder): the worlds of every level
//      (world N ↔ La Base world N, checked by their words; Pinyin básico; Simulacro del examen), the audio plan of
//      every question of every pack (nothing that says the answer before the kid answers), the one-shot launch of the
//      switch (an old phase-3 file turned ON once, a later OFF sticks), the extra worlds never counting for the Dorado,
//      the grandfathered sim-takers, rounds graded in memory (no key sent, the first answer counts, the % counted here)
//   2. its OWN server (port 4430, never 3000) with throw-away teacher codes and level keys that are never printed:
//      boot 1 = phase 3 (DRALY_TRAINING_BUILT=0) where a kid takes a simulation; boot 2 = phase 4 (the launch):
//      every kind of visitor (anonymous · new kid without the key · key-only phone · grandfathered kid · teacher) on
//      the pages and the API, world by world (seals, a phone's own seals, «Desbloquear», Pinyin básico, Simulacro del
//      examen), grading without leaks, the best % on the record, a key-only phone's scores joining the account at
//      login (who / 409, proofs bound to the phone), the Dorado rule (route, players, _simGrant for solo kids only, a
//      teacher's PIN room unaffected), /maestro, the switch OFF sticking across a restart
//   node scripts/test-ruta-training.js            (--port 4430 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4430));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HANZI = /[㐀-鿿]/;
const TONED = /[āǎàēěèīǐìōǒòūǔùǖǘǚǜ]/;   // (á é í ó ú are Spanish too: only the marks Spanish never uses)

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. in this process
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const UNIT = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-train-unit-'));
process.env.DRALY_DATA_DIR = UNIT;
process.env.STUDENT_DATA_DIR = UNIT;
const DAY = 86400e3, NOW = Date.now();
// a phase-3 settings file (where the switch could only be OFF): the launch turns it ON once
fs.writeFileSync(path.join(UNIT, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 75, updatedAt: NOW - DAY }));
fs.writeFileSync(path.join(UNIT, 'student-records.json'), JSON.stringify({
  AAAA: { code: 'AAAA', displayName: 'Kid A', firstSeen: NOW - 60 * DAY, lastSeen: NOW, level: 'yct1', sentencesBuilt: [] },
  GGGG: { code: 'GGGG', displayName: 'Kid G', firstSeen: NOW - 90 * DAY, lastSeen: NOW, level: 'yct1', sentencesBuilt: [],
    hskResults: [{ simId: 'yct1-sim2', score: 120, total: 200, percent: 60, ts: NOW - 5 * DAY }] },
  HHHH: { code: 'HHHH', displayName: 'Kid H', firstSeen: NOW - 90 * DAY, lastSeen: NOW, level: 'yct1', sentencesBuilt: [],
    hskResults: [{ simId: 'newhsk1-sim1', score: 120, total: 200, percent: 60, ts: NOW - 5 * DAY }] },
  PPPP: { code: 'PPPP', displayName: 'Kid P', firstSeen: NOW - 9 * DAY, lastSeen: NOW, level: 'hsk1', sentencesBuilt: [] },
}));
const Levels = require('../core/levels');
const Packs = require('../core/packs');
const S = require('../core/student-records');
const RP = require('../core/ruta-progress');
const E = require('../core/entrenamiento');
const SimLock = require('../core/sim-lock');

// the right answer of every question of a world — the test's own key, built here (the server never sends one): a
// pack question by its text (the same in every build: core/assignments.js relies on it too), an exam drill
// (core/entrenamiento-drills.js: many share a text) by its text + its options, which are the same in every build
// (picture and ✓ / ✕ options are tokens of that one drill). key.get(q) takes the question as the phone got it.
const lookOf = (q) => q.text + '|' + q.answers.slice().sort().join('|');
function keyOf(level, worldKey) {
  const lvl = Levels.normalize(level);
  const pl = Packs.LEVELS.find((p) => p.id === Levels.info(lvl).pack);
  const w = pl.worlds.find((x) => x.id === worldKey);
  const byText = new Map(), byLook = new Map();
  for (let i = 0; i < 3; i++) w.rounds.forEach((r) => Packs.buildRound(pl, w, r).forEach((q) => { if (!byText.has(q.text)) byText.set(q.text, q.correct); }));
  const W = E.worldsOf(lvl).find((x) => x.key === worldKey);
  E._drills.forWorld(lvl, W).forEach((q) => byLook.set(lookOf(q), q.correct));
  return { get: (q) => (typeof q === 'string' ? byText.get(q) : byLook.has(lookOf(q)) ? byLook.get(lookOf(q)) : byText.get(q.text)), drills: byLook.size };
}

function unit() {
  section('the launch: an old phase-3 file is switched ON once, a later OFF sticks');
  let st = RP.getSettings();
  const launch = st.trainingLaunchAt;
  ok(st.trainingBuilt === true && st.trainingLive === true && launch >= NOW && st.doradoPct === 75, 'phase 3\'s OFF → ON at the first phase-4 boot, the % he set (75) kept, the launch stamped');
  let file = JSON.parse(fs.readFileSync(RP.SETTINGS_FILE, 'utf8'));
  ok(file.trainingLive === true && file.trainingLaunchAt === launch && file.doradoPct === 75, '… written to the file at once');
  ok(RP.setSettings({ trainingLive: false }).ok, 'he switches it OFF');
  RP.loadSettings();
  st = RP.getSettings();
  ok(st.trainingLive === false && st.trainingLaunchAt === launch, '… and a restart leaves it OFF (the launch happens once, its moment never moves)');
  // a half-written file after the launch: the launch never runs again, his OFF and his % are read out of it
  fs.writeFileSync(RP.SETTINGS_FILE, '{"trainingLive": false, "doradoPct": 80, "trainingLaunchAt": ' + launch + ', "upd');
  RP.loadSettings();
  st = RP.getSettings();
  ok(st.trainingLive === false && st.doradoPct === 80 && st.trainingLaunchAt === launch, 'a damaged file: still OFF, 80 %, the same launch moment (never launched again)');
  ok(JSON.parse(fs.readFileSync(RP.SETTINGS_FILE, 'utf8')).trainingLaunchAt === launch && fs.readdirSync(UNIT).some((f) => /^ruta-settings\.unreadable-/.test(f)),
    '… written back clean, the damaged one kept aside');
  ok(RP.setSettings({ trainingLive: true, doradoPct: 70 }).ok && RP.getSettings().trainingLive, 'back ON, 70 %');
  // a disk with no settings file at all (a fresh server): ON from the start, stamped
  const FRESH = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-train-fresh-'));
  const probe = 'const R = require(' + JSON.stringify(path.join(ROOT, 'core', 'ruta-progress.js')) + '); const s = R.getSettings();' +
    'console.log(JSON.stringify({ live: s.trainingLive, at: s.trainingLaunchAt > 0, built: s.trainingBuilt }));';
  const run = (env) => { try { return JSON.parse(require('child_process').execFileSync(process.execPath, ['-e', probe], { env, encoding: 'utf8' }).trim().split('\n').pop()); } catch (e) { return { crash: String(e) }; } };
  const envF = Object.assign({}, process.env, { DRALY_DATA_DIR: FRESH, STUDENT_DATA_DIR: FRESH });
  const pf = run(envF);
  ok(pf.live === true && pf.at === true && pf.built === true && fs.existsSync(path.join(FRESH, 'ruta-settings.json')), 'a fresh disk: El Entrenamiento ON from the first boot (' + JSON.stringify(pf) + ')');
  const p0 = run(Object.assign({}, envF, { DRALY_TRAINING_BUILT: '0' }));
  ok(p0.live === false && p0.built === false, 'DRALY_TRAINING_BUILT=0 (the guard): the switch is not in force');
  try { fs.rmSync(FRESH, { recursive: true, force: true }); } catch (_) {}

  section('the worlds of every level: the pack\'s worlds by order = La Base\'s worlds');
  Levels.LEVELS.filter((l) => l.base).forEach((l) => {
    const W = E.worldsOf(l.id);
    const b = RP.baseOf(l.id);
    const regular = W.filter((w) => w.kind === 'world');
    ok(regular.length === b.worlds.length && regular.every((w, i) => w.n === b.worlds[i].n), `${l.name}: ${regular.length} practice worlds, one per La Base world, in order`);
    // world N ↔ La Base world N: of all La Base worlds, world N shares the most words with pack world N
    const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'protected', 'base', b.id, 'base.json'), 'utf8'));
    const bad = regular.filter((w) => {
      const pw = new Set(w.pack.rounds.flatMap((r) => r.words || []).map((x) => Packs.plain(x.py)));
      const hits = b.worlds.map((bw) => base.words.filter((x) => x.world === bw.n && pw.has(Packs.plain(x.py))).length);
      return hits.indexOf(Math.max(...hits)) !== w.n - 1 || hits[w.n - 1] < 5;
    });
    ok(!bad.length, `${l.name}: every practice world shares its words with the same La Base world (${bad.map((w) => w.key).join(', ') || 'all match'})`);
    ok(regular.every((w) => w.name && !/^EXP/.test(w.name) && w.short), `${l.name}: the worlds take La Base's names (no «EXP» codes on a kid's screen)`);
    ok(W[W.length - 1].kind === 'simulacro' && W[W.length - 1].name === 'Simulacro del examen', `${l.name}: «Simulacro del examen» last`);
  });
  ok(E.worldsOf('hsk1')[0].kind === 'pinyin' && E.worldsOf('hsk1')[0].name === 'Pinyin básico' && !E.worldsOf('yct1').some((w) => w.kind === 'pinyin'),
    'HSK 1 starts with «Pinyin básico»; YCT 1 has none');
  ok(E.worldsOf('newhsk1') === E.worldsOf('hsk2') && E.worldsOf('zz9') === null, 'newhsk1 = hsk2 (its stored id); an unknown level has none');

  section('the audio of every question of every pack: never the answer before the kid answers');
  let qs = 0, asks = 0, opts = 0, clips = 0, voices = 0;
  const leaks = [], spanishAsk = [], empty = [], shown = [];
  let heard = 0;
  Levels.LEVELS.filter((l) => l.base).forEach((l) => E.worldsOf(l.id).forEach((w) => E._poolOf(l.id, w).forEach((q) => {
    qs++;
    const p = E._voicePlan(q);
    if (p.ask && q.listen) {
      // an exam drill heard only (2026-10-18): its line is the question, never on the screen (the exam's listening)
      heard++;
      if (q.text.includes(p.ask) || (q.answers.includes(p.ask))) shown.push(q.text + ' → ' + p.ask);
      if (/[áéíóúñ¿¡]/i.test(p.ask)) spanishAsk.push(q.text);
    } else if (p.ask) {
      asks++;
      // what it says before the answer is already on the screen, in pinyin (the asked word, the line said to you…)
      if (!p.ask.split(/\s+/).every((t) => q.text.includes(t.replace(/,$/, '')))) leaks.push(q.text + ' → ' + p.ask);
      if (/[áéíóúñ¿¡]/i.test(p.ask)) spanishAsk.push(q.text);
    }
    if (q.kind === 'es2zh' && p.ask) leaks.push('(reads a «¿Cómo se dice?») ' + q.text);
    if (p.opts) opts++;
    if (!p.ask && !p.opts) empty.push(q.kind + ': ' + q.text);
    [p.ask, p.after].concat(p.opts ? q.answers : []).filter(Boolean).forEach((t) => {
      const sp = E._speechFor(l.id, t, p.es);
      if (sp.file) clips++; else if (sp.text) voices++;
    });
  })));
  ok(qs > 1500, qs + ' questions in every world of the three levels');
  ok(!leaks.length, 'what a question says before the answer is pinyin the screen already shows (' + (leaks.slice(0, 3).join(' | ') || 'none') + ')');
  ok(heard > 600 && !shown.length, heard + ' exam drills heard only: their line is never on the screen nor an option (' + (shown.slice(0, 2).join(' | ') || 'none') + ')');
  ok(!spanishAsk.length, 'never Spanish read by the Mandarin voice (' + spanishAsk.slice(0, 2).join(' | ') + ')');
  ok(!empty.length, 'every question has audio: the word or line it asks about, or its four options read one by one (' + empty.slice(0, 3).join(' | ') + ')');
  ok(clips > voices, `La Base's own checked clips where they exist: ${clips} clips, ${voices} made by the platform voice`);
  ok(E._isPinyin('Wo jiao Aileen.') && E._isPinyin('nü pengyou de') && E._isPinyin("na'er") && !E._isPinyin('mamá') && !E._isPinyin('¿Cómo te llamas?') &&
    !E._isPinyin('6:20') && !E._isPinyin('Yo y mi hermana mayor') && !E._isPinyin('mano'), 'pinyin or not: pinyin lines and names yes; Spanish, times and blanks no');
  ok(E._speechText('yct1', 'Ni hao ma?') === '你好吗？' && E._speechText('yct1', 'Mingtian shi qi yue er hao.') === '明天是七月二号。' &&
    E._speechText('hsk1', 'Wo he shui.') === '我喝水。' && E._speechText('yct1', 'Baba he mama') === '爸爸和妈妈', 'the voice reads hanzi made on the server (好吗, 是七月二号, 喝水, 和)');

  section('the extra worlds never count for the Dorado; the best % per world');
  ok(RP.recordPractice('PPPP', 'hsk1', 'pinyin', 95).ok && RP.state(S.get('PPPP'), 'hsk1').extra.pinyin === 95, 'Pinyin básico\'s best is kept by its name');
  ok(!RP.recordPractice('PPPP', 'hsk1', 'oops', 95).ok && !RP.recordPractice('PPPP', 'hsk1', 'pinyin', 101).ok, 'an unknown world or a % over 100: refused');
  RP.recordPractice('PPPP', 'hsk1', 'simulacro', 100);
  st = RP.state(S.get('PPPP'), 'hsk1');
  ok(st.dorado.practiced === 0 && !st.dorado.open && st.extra.simulacro === 100, '100 % in Pinyin básico and the Simulacro del examen: the Dorado stays closed (0 worlds)');

  section('grandfathered: a simulation taken before the launch keeps the Dorado open');
  const kA = { ok: true, via: 'student' };
  ok(RP.state(S.get('GGGG'), 'yct1').dorado.open && RP.state(S.get('GGGG'), 'yct1').dorado.via === 'taken' && RP.doradoOpen(kA, S.get('GGGG'), 'yct1'),
    'Kid G took YCT 1 Sim 2 five days before the launch: open (taken)');
  ok(!RP.doradoOpen(kA, S.get('HHHH'), 'yct1') && RP.state(S.get('HHHH'), 'hsk2').dorado.via === 'taken', 'Kid H took a New HSK 1 sim: open for New HSK 1 only, not YCT 1');
  ok(!RP.doradoOpen(kA, S.get('AAAA'), 'yct1'), 'Kid A (never took one): closed');
  S.get('AAAA').hskResults = [{ simId: 'yct1-sim1', score: 150, total: 200, percent: 75, ts: Date.now() + 1000 }];
  ok(!RP.doradoOpen(kA, S.get('AAAA'), 'yct1'), 'a simulation taken AFTER the launch (in a teacher\'s room) does not open it on their own');
  S.get('AAAA').hskResults = [{ simId: 'yct1-sim1', score: 0, total: 0, percent: 0, ts: NOW - DAY }];
  ok(!RP.doradoOpen(kA, S.get('AAAA'), 'yct1'), 'a try without a grade (total 0) does not count');
  delete S.get('AAAA').hskResults;

  section('rounds in memory: the questions without their answers, the first answer counts, the % counted here');
  const who = { code: 'AAAA', dev: 'd1', tid: null };
  RP.applySeals('AAAA', 'yct1', range(1, 17), []);
  const rec = S.get('AAAA');
  const closed = E.startRound('yct1', 'espejo', who, kA, rec, null);
  ok(!closed.ok && closed.status === 403 && closed.closed, 'world 2 (no seals there): closed');
  ok(!E.startRound('yct1', 'simulacro', who, kA, rec, null).ok, 'the Simulacro del examen: closed until every world is ready');
  const r = E.startRound('yct1', 'familia', who, kA, rec, null);
  const txt = JSON.stringify(r);
  ok(r.ok && r.questions.length === E.ROUND_SIZE && r.total === E.ROUND_SIZE, 'world 1 (all its seals): a round of ' + E.ROUND_SIZE + ' questions');
  const nOpts = (q) => (q.tf ? 2 : q.pics || q.listen || q.voice.tap ? [3, 4] : 4);
  ok(!/"correct"|"expected"|"key"|"plan"|"kind"|"show"|"say"/.test(txt) && r.questions.every((q) => [].concat(nOpts(q)).includes(q.answers.length) && new Set(q.answers).size === q.answers.length),
    'no right answer in it (no correct / expected / key field, nothing an exam drill says), four options each (✓ / ✕: two; the exam\'s photos and heard questions: A B C)');
  ok(!HANZI.test(txt), 'no hanzi');
  ok(r.questions.every((q) => !q.image || q.image.indexOf('/api/ruta/train/pic/') === 0), 'pictures travel as the round\'s own links (a «¿Cómo se dice?» picture is named after its pinyin in the pack)');
  ok(new Set(r.questions.map(lookOf)).size === r.questions.length, 'ten different questions');
  const K = keyOf('yct1', 'familia');
  const first = r.questions[0];
  const wrong = first.answers.find((x) => x !== K.get(first));
  const a1 = E.answer(r.round, 0, wrong, who);
  ok(a1.ok && a1.correct === false && a1.expected === K.get(first), 'a wrong answer: «no», and the right one comes back now');
  const a2 = E.answer(r.round, 0, K.get(first), who);
  ok(a2.ok && a2.correct === false && a2.again, 'answering the same question again with the right one: still wrong (the first answer counts)');
  ok(E.answer(r.round, 1, 'not an option', who).status === 400 && E.answer(r.round, 99, wrong, who).status === 400, 'an answer that is not an option, or a question not in the round: refused');
  ok(E.answer(r.round, 1, r.questions[1].answers[0], { code: 'BBBB', dev: 'd2' }).status === 403, 'someone else\'s round: refused');
  ok(E.voice(r.round, 2, 'after', who).status === 403, 'the «after» audio (it says the answer) is refused before the question is answered');
  r.questions.slice(1).forEach((q) => E.answer(r.round, q.i, K.get(q), who));
  const fin = E.finish(r.round, who, kA, S.get('AAAA'));
  ok(fin.ok && fin.right === 9 && fin.total === 10 && fin.pct === 90 && fin.stars === 3 && fin.saved && fin.best === 90, '9 of 10 → 90 %, three stars, saved: best 90 %');
  ok(E.finish(r.round, who, kA, S.get('AAAA')).pct === 90 && E.answer(r.round, 1, r.questions[1].answers[0], who).status === 409, 'finishing again gives the same result; no answer after the end');
  ok(S.get('AAAA').ruta.yct1.p[1] === 90, 'on the record: world 1 → 90');
  const r2 = E.startRound('yct1', 'familia', who, kA, S.get('AAAA'), null);
  const f2 = E.finish(r2.round, who, kA, S.get('AAAA'));
  ok(f2.pct === 0 && f2.stars === 0 && f2.best === 90 && !f2.record && S.get('AAAA').ruta.yct1.p[1] === 90, 'a round with no answer: 0 %, the best stays 90');
  const t = E.startRound('yct1', 'espejo', { tid: 'T1', dev: 'd9' }, { ok: true, via: 'teacher' }, null, null);
  ok(t.ok && E.finish(t.round, { tid: 'T1', dev: 'd9' }, { ok: true, via: 'teacher' }, null).teacher === true, 'a teacher plays any world; never saved');
  const kp = E.startRound('yct1', 'espejo', { dev: 'phone1' }, { ok: true, via: 'key' }, null, new Set(range(18, 29)));
  ok(kp.ok, 'a key-only phone with its own seals of world 2 plays world 2');
  const kf = E.finish(kp.round, { dev: 'phone1' }, { ok: true, via: 'key' }, null);
  const pv = SimLock.verify(kf.proof, 'tp');
  ok(kf.phone && !kf.saved && pv && pv[0] === 'yct1' && pv[1] === 'espejo' && pv[3] === 'phone1', '… its score comes with a proof bound to that phone (nothing saved)');
  ok(E.mergeProofs('AAAA', 'yct1', [kf.proof], { dev: 'phone2' }).merged === 0 && E.mergeProofs('AAAA', 'yct1', [kf.proof.slice(0, -2) + 'xx'], { dev: 'phone1' }).merged === 0,
    'a proof from another phone, or altered: not merged');
  ok(E.mergeProofs('AAAA', 'yct1', [kf.proof], { dev: 'phone1' }).merged === 1 && S.get('AAAA').ruta.yct1.p[2] === kf.pct, '… from the phone that earned it: it joins the account');
  ok(E.mergeProofs('AAAA', 'yct1', [kf.proof], { dev: 'phone1' }).merged === 1, '… the same account handing it in again changes nothing (best of)');
  ok(E.mergeProofs('PPPP', 'hsk1', [kf.proof], { dev: 'phone1' }).merged === 0 && E.mergeProofs('GGGG', 'yct1', [kf.proof], { dev: 'phone1' }).merged === 0,
    '… and never joins a second account (a shared tablet can\'t hand one round to every kid)');

  section('pictures through the round, one open round per world');
  const pr1 = E.startRound('yct1', 'familia', who, kA, S.get('AAAA'), null, '203.0.113.5');
  ok(pr1.questions.every((q) => q.image === null || /^\/api\/ruta\/train\/pic\/[A-Za-z0-9_-]+\/\d+$/.test(q.image)), 'a picture travels as the round\'s own link, never its file name');
  ok(pr1.questions.every((q) => !q.image || !/assets|webp/.test(q.image)), '… so no picture link holds a file name');
  const withPic = pr1.questions.find((q) => q.image);
  if (withPic) {
    const pf = E.picture(pr1.round, withPic.i, who);
    ok(pf.ok && fs.existsSync(pf.file) && /assets[\\/]packs[\\/]|protected[\\/]base[\\/][a-z0-9]+-base[\\/]pics[\\/]/.test(pf.file),
      'the round serves the picture from public/assets/packs (a pack question) or La Base\'s pictures (an exam drill)');
    ok(E.picture(pr1.round, withPic.i, { code: 'BBBB', dev: 'zz' }).status === 403, '… only to the round\'s owner');
  }
  drills();
  const pr2 = E.startRound('yct1', 'familia', who, kA, S.get('AAAA'), null, '203.0.113.5');
  ok(pr2.ok && E.answer(pr1.round, 0, pr1.questions[0].answers[0], who).status === 410, 'a new round of the same world ends the open one (no second tab to peek at answers)');
  ok(S.flushNow() === true, 'saved');
}

// the exam drills (core/entrenamiento-drills.js, 2026-10-18): the exam's own kinds in the rounds, through the round
function drills() {
  section('the exam drills: photos A B C, ✓ / ✕, heard only, a reading drill, all through the round');
  const who = { code: 'AAAA', dev: 'd1', tid: null };
  const kA = { ok: true, via: 'student' };
  const K = keyOf('yct1', 'familia');
  ok(K.drills >= 20, 'world 1 of YCT 1 has its exam drills (' + K.drills + ')');
  const done = {};
  // (rounds are random: a few rounds until each kind turned up; each is checked in its own round, still open)
  for (let n = 0; n < 60 && Object.keys(done).length < 4; n++) {
    const r = E.startRound('yct1', 'familia', who, kA, S.get('AAAA'), null);
    const raw = JSON.stringify(r);
    r.questions.forEach((q) => {
      ok(K.get(q) !== undefined, 'the test knows every question\'s answer (' + q.text.slice(0, 40) + ')');
      if (q.pics && !done.pics) {
        done.pics = true;
        ok(q.pics.length === q.answers.length && q.pics.every((u, k) => u === '/api/ruta/train/pic/' + r.round + '/' + q.i + '/' + k), 'photos A B C: one link per option, by the round');
        ok(q.answers.every((a) => /^o[0-9a-f]{12}$/.test(a)) && !/webp|pics|roblox|fluent/.test(raw), '… their options are tokens: no picture name or file anywhere in the round');
        const pf = E.picture(r.round, q.i, who, '1');
        ok(pf.ok && /protected[\\/]base[\\/]yct1-base[\\/]pics[\\/]/.test(pf.file) && fs.existsSync(pf.file), '… served from La Base\'s pictures');
        ok(E.picture(r.round, q.i, who, '7').status === 404 && E.picture(r.round, q.i, { code: 'BBBB', dev: 'zz' }, '0').status === 403, '… a photo that is not there: 404; someone else\'s round: 403');
        ok(Array.isArray(q.alts) && q.alts.every(Boolean), '… with each photo\'s name for a screen reader');
      }
      if (q.tf && !done.tf) {
        done.tf = true;
        ok(q.answers.length === 2 && q.alts[0] === 'Sí' && q.alts[1] === 'No' && q.image, '✓ / ✕: «Sí» before «No», and its picture');
        const right = K.get(q);
        const a = E.answer(r.round, q.i, right, who);
        ok(a.ok && a.correct === true && a.expected === right && a.show && a.show.py, '… the right one counts, and the line comes back only now (' + (a.show && a.show.py) + ')');
      }
      if (q.listen && !done.listen) {
        done.listen = true;
        ok(q.alt && !q.text.includes(q.alt) && q.voice.ask && !q.voice.tap, 'heard only: its line is not on the screen (only `alt`, shown when the sound fails)');
        const v = E.voice(r.round, q.i, 'ask', who);
        ok(v.ok && (v.file ? fs.existsSync(v.file) : HANZI.test(v.text || '')), '… its audio: La Base\'s own clip, or Chinese for the voice');
        ok(E.voice(r.round, q.i, 'after', who).status === 403, '… said again only once answered');
        E.answer(r.round, q.i, q.answers[0], who);
        ok(E.voice(r.round, q.i, 'after', who).ok, '… and after');
      }
      if (q.voice.tap && !done.tap) {
        done.tap = true;
        ok(q.py.some(Boolean) && !q.listen, 'a reading drill: its pinyin on the screen, its audio only on a tap (voice.tap)');
      }
    });
  }
  ok(done.pics && done.tf && done.listen && done.tap, 'every kind turned up in world 1\'s rounds (' + Object.keys(done).join(', ') + ')');
  // the Simulacro del examen: every listening question of the sims, heard only, in the exam's own Chinese
  const T1 = { tid: 'T1', dev: 'd9' };
  ['yct1', 'hsk2', 'hsk1'].forEach((lvl) => {
    const w = E.worldsOf(lvl).find((x) => x.kind === 'simulacro');
    const exam = E._drills.forWorld(lvl, w).filter((q) => q.exam && q.listen);
    const hz = exam.filter((q) => q.say.hz || q.say.file).length;
    ok(exam.length >= 30 && hz >= exam.length * 0.9, Levels.info(lvl).name + ': ' + exam.length + ' listening questions of the sims heard in «Simulacro del examen», ' + hz + ' in the exam\'s own Chinese or a La Base clip');
    const sr = E.startRound(lvl, 'simulacro', T1, { ok: true, via: 'teacher' }, null, null);
    const lq = sr.questions.find((q) => q.listen && !q.pics && !q.tf);
    if (lq) {
      const v = E.voice(sr.round, lq.i, 'ask', T1);
      ok(v.ok && (v.file || HANZI.test(v.text || '')), '… a round\'s heard question reads Chinese (' + (v.text ? v.text.length + ' characters' : 'a clip') + ')');
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. its own server
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-train-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };

function req(method, p, o = {}) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, o.headers || {});
    if (o.jar && Object.keys(o.jar).length) h.Cookie = Object.entries(o.jar).map(([k, v]) => k + '=' + v).join('; ');
    let data = null;
    if (o.body !== undefined) { data = Buffer.from(JSON.stringify(o.body)); h['Content-Type'] = 'application/json'; h['Content-Length'] = data.length; }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        const sc = res.headers['set-cookie'] || [];
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) { if (/Max-Age=0\b/.test(c)) delete o.jar[m[1]]; else o.jar[m[1]] = m[2]; } });
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, bytes: buf.length });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
const put = (p, body, o = {}) => req('PUT', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers) });
const teacher = (code) => ({ jar: {}, headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(code)) });
const ruta = async (o) => { const r = await get('/api/ruta-dorada', o); return Object.assign(r.json || {}, { _r: r }); };
const mod = (st, id) => (st.modules || []).find((m) => m.id === id);
const train = (ph, level, s) => get('/api/ruta/train?level=' + encodeURIComponent(level) + (s ? '&s=' + encodeURIComponent(s) : ''), ph.jar ? as(ph) : ph);
const round = (ph, level, world, s) => post('/api/ruta/train/round', { level, world, s }, ph.jar ? as(ph) : ph);
const answer = (ph, rid, i, chosen) => post('/api/ruta/train/answer', { round: rid, i, chosen }, ph.jar ? as(ph) : ph);
const finish = (ph, rid) => post('/api/ruta/train/finish', { round: rid }, ph.jar ? as(ph) : ph);
const isKeyScreen = (r) => r.status === 401 && /data-level-key="locked"/.test(r.text);
const isAudiosPage = (r) => r.status === 200 && /id="au-main"/.test(r.text) && !/data-level-key/.test(r.text);
const world = (v, key) => (v.worlds || []).find((w) => w.key === key);
// a whole round played with the test's own key: `rightN` right answers, the rest wrong → the finish
async function play(ph, level, worldKey, rightN, s) {
  const r = await round(ph, level, worldKey, s);
  if (!r.json || !r.json.ok) return { start: r };
  const K = keyOf(level, worldKey);
  let n = 0;
  for (const q of r.json.questions) {
    const right = K.get(q);
    const pick = n < rightN ? right : q.answers.find((x) => x !== right);
    await answer(ph, r.json.round, q.i, pick);
    n++;
  }
  const f = await finish(ph, r.json.round);
  return { start: r, fin: f.json || {}, status: f.status };
}

let srv = null;
let allLog = '';
async function startServer(extraEnv) {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    // (2026-10-18: El Simulacro Dorado taken ALONE is off by his decision, server.js DORADO_SELF_SERVE; this test plays the
    // kept code that earns it by practice (the same «earned» state that makes card 3 «¡Avísale a tu profe!»), so its server
    // runs with the flag ON. The flag OFF: test-sims-lock, test-ruta-dorada, test-golden-book, test-level-keys.)
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '', DRALY_DORADO_SELF_SERVE: '1' }, extraEnv || {}),
  });
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000));
  srv.kill();
  process.exit(2);
}
async function stopServer() {
  if (!srv) return;
  const p = new Promise((r) => srv.once('exit', r));
  srv.kill();
  await p;
  srv = null;
  await sleep(300);
}
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}
const { io } = require('socket.io-client');
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});

async function server() {
  const stamp36 = Date.now().toString(36).slice(-4);
  const Y = RP.baseOf('yct1');

  // ── boot 1: phase 3 (the switch can't be on) ──
  section('boot 1 = phase 3: a kid takes a simulation on their own, the switch is OFF');
  await startServer({ DRALY_TRAINING_BUILT: '0' });
  const G1 = phone();
  const kidG = await enter(G1, '1003', 'Dorado G ' + stamp36);
  const A1 = phone();
  const kidA = await enter(A1, '1003', 'Entrena A ' + stamp36);
  ok(kidG.ok && kidA.ok && kidA.levelOpen, 'two YCT 1 kids enrolled before the keys');
  const gp = await get('/api/hsk-sim/yct1-sim1', as(G1));
  ok(gp.status === 200 && gp.json.ok, 'phase 3: the key alone opens a simulation');
  const gs = await post('/api/hsk-sim/yct1-sim1/submit', { answers: {}, ticket: gp.json.sim.ticket }, as(G1));
  ok(gs.status === 200 && gs.json.ok, 'kid G hands it in (graded, on their record)');
  ok((await get('/api/admin/ruta-settings', teacher(SEED))).json.settings.trainingLive === false, 'the switch is OFF (phase 3)');
  await sleep(1500);   // the student file is written a second after the last change
  await stopServer();
  // the settings as phase 3 saved them (its default: OFF)
  fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, updatedAt: Date.now() - 1000 }));

  // ── boot 2: phase 4 ──
  section('boot 2 = phase 4: the launch switches El Entrenamiento ON once');
  await startServer();
  let s = (await get('/api/admin/ruta-settings', teacher(SEED))).json.settings;
  ok(s.trainingLive === true && s.trainingBuilt === true && s.trainingLaunchAt > 0 && s.doradoPct === 70, 'ON, built, the launch stamped, 70 %');
  ok(/El Entrenamiento is LIVE \(phase 4 launch\)/.test(allLog), 'the server log says so once');
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);
  const N1 = phone();
  const kidN = await enter(N1, '1003', 'Entrena N ' + stamp36);
  ok(kidN.ok && kidN.levelOpen === false, 'a kid enrolled after the keys, without the key');
  const K1 = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(K1))).json.ok, 'a phone that typed the YCT 1 key (nobody logged in)');
  ok((await post('/api/level-key', { level: 'hsk1', key: KEYS.hsk1 }, as(K1))).json.ok, '… and the HSK 1 key');
  const anon = phone();
  ok((await enter(A1, '1003', null, kidA.studentCode)).levelOpen && (await enter(G1, '1003', null, kidG.studentCode)).levelOpen, 'kids A and G log in again');

  section('the pages: behind the level\'s key');
  ok(isKeyScreen(await get('/audios/yct1/entrenamiento', as(anon))) && isKeyScreen(await get('/audios/yct1/entrenamiento/familia', as(N1))), 'anonymous, a new kid without the key: the key screen');
  ok(isAudiosPage(await get('/audios/yct1/entrenamiento', as(K1))) && isAudiosPage(await get('/audios/yct1/entrenamiento/familia', as(A1))), 'a key-only phone, a kid with their level: the page');
  ok(isAudiosPage(await get('/audios/hsk2/entrenamiento', teacher(SEED))) && isAudiosPage(await get('/audios/newhsk1/entrenamiento/familia', teacher(SEED))), 'a teacher: any level, by its stored id or its curriculum name');
  const bad = await get('/audios/yct1/entrenamiento/nope', as(K1));
  ok(bad.status === 302 && /\/audios\/yct1\/entrenamiento$/.test(bad.headers.location || ''), 'a world that does not exist → the level\'s worlds');
  ok((await get('/audios/zz9/entrenamiento', as(K1))).status === 302, 'a level that does not exist → La Ruta Dorada');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'entrenamiento.js'), 'utf8');
  ok(!/pack-check|\/api\/sets|\/api\/packs|\/api\/homework/.test(js), 'the page never uses the leaky homework / sets endpoints (only /api/ruta/train)');

  section('the API: the one door first');
  for (const [ph, who] of [[anon, 'anonymous'], [N1, 'a new kid without the key']]) {
    ok((await train(ph, 'yct1')).status === 401 && (await round(ph, 'yct1', 'familia')).status === 401, `${who}: 401`);
  }
  ok((await train(K1, 'hsk2')).status === 401, 'a key-only phone without the New HSK 1 key: 401 there');
  ok((await train(K1, 'zz9')).status === 404, 'a level that does not exist: 404');

  section('world by world');
  let v = (await train(A1, 'yct1')).json;
  ok(v.ok && v.student && /^[a-f0-9]{12}$/.test(v.who) && v.worlds.length === Y.worlds.length + 1 && v.worlds.every((w) => !w.open), 'kid A (no seals yet): ' + v.worlds.length + ' worlds, all closed, their account id');
  ok(v.dorado.rule === 'practice' && !v.dorado.open && v.dorado.of === Y.worlds.length && v.dorado.pct === 70, '… the Dorado: by practice, 70 %, ' + Y.worlds.length + ' worlds');
  let rr = await round(A1, 'yct1', 'familia');
  ok(rr.status === 403 && rr.json.closed && /Me la sé/.test(rr.json.error), 'world 1 without its seals: closed («¡Me la sé!» in La Base opens it)');
  ok((await post('/api/ruta/seals', { level: 'yct1', add: range(1, Y.worlds[0].count) }, as(A1))).json.ok, 'kid A stamps every seal of world 1');
  v = (await train(A1, 'yct1')).json;
  ok(world(v, 'familia').open && world(v, 'familia').via === 'seals' && !world(v, 'espejo').open && !world(v, 'simulacro').open, 'world 1 open (their seals); world 2 and the Simulacro closed');
  ok((await round(A1, 'yct1', 'espejo')).status === 403 && (await round(A1, 'yct1', 'simulacro')).status === 403, '… a round of world 2 or of the Simulacro: refused');
  v = (await train(A1, 'yct1', '18-29')).json;
  ok(world(v, 'espejo').open && world(v, 'espejo').via === 'seals', 'the seals this phone holds (not saved yet) count too (world 2 = words 18-29)');
  let kv = (await train(K1, 'yct1')).json;
  ok(kv.ok && !kv.student && kv.who === null && kv.worlds.every((w) => !w.open) && kv.dorado.login, 'a key-only phone without seals: closed; the Dorado needs a login');
  kv = (await train(K1, 'yct1', '1-17')).json;
  ok(world(kv, 'familia').open, '… with its own seals of world 1: world 1 open');
  const hv = (await train(K1, 'hsk1')).json;
  ok(hv.ok && hv.worlds[0].key === 'pinyin' && hv.worlds[0].open && hv.worlds[0].via === 'start' && hv.worlds.slice(1).every((w) => !w.open), 'HSK 1: «Pinyin básico» open from the start, the rest closed');
  ok((await round(K1, 'hsk1', 'pinyin')).json.ok, '… and it plays');
  const tv = (await train(teacher(SEED), 'yct1')).json;
  ok(tv.teacher && tv.worlds.every((w) => w.open) && tv.dorado.open, 'a teacher: every world, the Simulacro and the Dorado');

  section('grading on the server, never a leak');
  rr = await round(A1, 'yct1', 'familia');
  const R = rr.json;
  ok(R.ok && R.questions.length === 10 && !/"correct"|"expected"|"plan"|"kind"/.test(rr.text) && !HANZI.test(rr.text), 'a round: 10 questions, no right answer, no hanzi');
  ok(/no-store/.test(rr.headers['cache-control'] || '') && /no-store/.test(rr.headers['cloudflare-cdn-cache-control'] || ''), '… never cached (phone or Cloudflare)');
  const es2zh = R.questions.filter((q) => /^¿Cómo se dice/.test(q.text));
  ok(es2zh.every((q) => q.answers.every((x) => !TONED.test(x))), 'pinyin without tone marks');
  const Kf = keyOf('yct1', 'familia');
  const q0 = R.questions[0];
  const v0 = await get('/api/ruta/train/voice/' + R.round + '/0/after', as(A1));
  ok(v0.status === 403, 'the «after» audio before answering: refused');
  const other = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(other))).json.ok && (await answer(other, R.round, 0, q0.answers[0])).status === 403,
    'another phone (with the key) answering kid A\'s round: refused');
  const firstPick = q0.answers.find((x) => x !== Kf.get(q0));
  const a1 = await answer(A1, R.round, 0, firstPick);
  ok(a1.status === 200 && a1.json.correct === false && a1.json.expected === Kf.get(q0), 'a wrong answer → «no» + the right answer, now');
  const again = (await answer(A1, R.round, 0, Kf.get(q0))).json;
  ok(again.correct === false && again.again === true && again.chosen === firstPick, 'the same question again with the right answer: still wrong, and it says which answer counted');
  const picQ = R.questions.find((q) => q.image);
  if (picQ) {
    ok(picQ.image.indexOf('/api/ruta/train/pic/' + R.round + '/') === 0, 'a picture travels as the round\'s own link');
    const pic = await get(picQ.image, as(A1));
    ok(pic.status === 200 && /image\/webp/.test(pic.headers['content-type'] || '') && pic.bytes > 500, '… which serves it to the round\'s phone');
    ok((await get(picQ.image, as(other))).status === 403 && (await get(picQ.image, as(anon))).status === 401, '… and to nobody else');
  }
  ok(R.questions.every((q) => !q.image || !/assets|\.webp/.test(q.image)), 'no picture\'s file name in the round (it would say a «¿Cómo se dice?»\'s answer)');
  const picsQ = R.questions.find((q) => q.pics);
  if (picsQ) {
    const pp = await get(picsQ.pics[1], as(A1));
    ok(pp.status === 200 && /image\/webp/.test(pp.headers['content-type'] || '') && pp.bytes > 500 && /private/.test(pp.headers['cache-control'] || ''), 'an exam drill\'s photo B travels by the round (/pic/<round>/<i>/<k>)');
    ok((await get(picsQ.pics[1], as(other))).status === 403 && (await get(picsQ.pics[1], as(anon))).status === 401 &&
      (await get('/api/ruta/train/pic/' + R.round + '/' + picsQ.i + '/9', as(A1))).status === 404, '… to nobody else, and only its own photos');
  }
  ok((await answer(A1, R.round, 1, 'zzz')).status === 400, 'an answer that is not one of the options: refused');
  const askQ = R.questions.find((q) => q.voice.ask);
  if (askQ) {
    const va = await get('/api/ruta/train/voice/' + R.round + '/' + askQ.i + '/ask', as(A1));
    ok((va.status === 200 && /audio\/mpeg/.test(va.headers['content-type'] || '') && va.bytes > 1000) || va.status === 503, 'a question\'s own audio streams from the round (a La Base clip, or the platform voice: ' + va.status + ')');
    ok((await get('/api/ruta/train/voice/' + R.round + '/' + askQ.i + '/ask', as(N1))).status === 401, '… never to a phone without the key');
  }
  const optQ = R.questions.find((q) => q.voice.opts);
  if (optQ) ok([200, 503].includes((await get('/api/ruta/train/voice/' + R.round + '/' + optQ.i + '/o2', as(A1))).status), 'an option read on its own');
  ok((await get('/api/ruta/train/voice/' + R.round + '/0/after', as(A1))).status !== 403, '… and the «after» audio once answered');
  ok((await get('/api/ruta/train/voice/nope-nope-nope-nope/0/ask', as(A1))).status === 410, 'a round that does not exist: 410');
  for (const q of R.questions.slice(1)) await answer(A1, R.round, q.i, Kf.get(q));
  let f = await finish(A1, R.round);
  ok(f.json.ok && f.json.pct === 90 && f.json.stars === 3 && f.json.saved && f.json.best === 90 && !f.json.record, '9 of 10: 90 %, three stars, saved (a first round is not a «record»)');
  let p = await play(A1, 'yct1', 'familia', 5);
  ok(p.fin.pct === 50 && p.fin.best === 90 && !p.fin.record && p.fin.stars === 1, 'a later 50 %: saved, the best stays 90');
  v = (await train(A1, 'yct1')).json;
  ok(world(v, 'familia').best === 90, 'the worlds list shows the best: 90');

  section('a key-only phone practises; its scores join the account at the first login');
  const P1 = phone();
  const kidP = await enter(P1, '1003', 'Entrena P ' + stamp36);
  ok(kidP.ok && kidP.levelOpen === false, 'kid P (after the keys, no key yet)');
  await post('/api/homework/logout', {}, as(P1));
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(P1))).json.ok, 'their phone types the key, nobody logged in');
  p = await play(P1, 'yct1', 'familia', 8, '1-17');
  ok(p.fin.ok && p.fin.phone && !p.fin.saved && typeof p.fin.proof === 'string' && p.fin.pct === 80, 'they play world 1 (their phone\'s seals): 80 %, kept on the phone with a proof');
  ok((await post('/api/ruta/train/scores', { level: 'yct1', who: null, proofs: [p.fin.proof] }, as(P1))).status === 403, 'nobody logged in: nothing joins an account');
  ok((await enter(P1, '1003', null, kidP.studentCode)).levelOpen === true, 'kid P logs in on that phone (the key joins the account)');
  const whoP = (await train(P1, 'yct1')).json.who;
  const w409 = await post('/api/ruta/train/scores', { level: 'yct1', who: 'aaaaaaaaaaaa', proofs: [p.fin.proof] }, as(P1));
  ok(w409.status === 409 && w409.json.who === whoP, 'a phone holding another account\'s scores (a sibling): 409, nothing written');
  const P2 = phone();
  ok((await enter(P2, '1003', null, kidP.studentCode)).ok && (await post('/api/ruta/train/scores', { level: 'yct1', who: null, proofs: [p.fin.proof] }, as(P2))).json.merged === 0,
    'the same proof from another phone: not merged (bound to the phone that earned it)');
  const m = await post('/api/ruta/train/scores', { level: 'yct1', who: null, proofs: [p.fin.proof, 'garbage.token'] }, as(P1));
  ok(m.json.ok && m.json.merged === 1 && m.json.best.familia === 80 && m.json.who === whoP, 'from its own phone: 1 merged (a broken one ignored), world 1 best 80 on the account');
  ok(world((await train(P2, 'yct1')).json, 'familia').best === 80, '… seen from any phone of that account');

  section('the Dorado: earned by practice, kept by kids who already took a simulation');
  let mA = mod(await ruta(as(A1)), 'yct1');
  ok(!mA.dorado.open && mA.dorado.rule === 'practice' && mA.dorado.practiced === 1 && mA.dorado.of === Y.worlds.length && mA.sims.length === 0 && mA.simCount > 0,
    'kid A: 1 of ' + Y.worlds.length + ' worlds with 70 %, no simulation listed');
  ok(mA.train && mA.train.live && mA.train.worlds.length === Y.worlds.length + 1 && mA.train.worlds[0].best === 90, 'the route carries El Entrenamiento\'s worlds with the kid\'s best');
  let sp = await get('/api/hsk-sim/yct1-sim1', as(A1));
  ok(sp.status === 403 && sp.json.locked !== false && /practiques/.test(sp.json.error || ''), 'kid A on their own: the simulation is refused (403, «practica»)');
  const pg = await get('/yct-sim.html?sim=yct1-sim1', as(A1));
  ok(pg.status === 302 && /^\/audios\/yct1\?dorado=cerrado#paso-3$/.test(pg.headers.location || ''), '… its page sends them to the route\'s step 3');
  const mG = mod(await ruta(as(G1)), 'yct1');
  ok(mG.dorado.open && mG.dorado.via === 'taken' && mG.sims.length === mG.simCount, 'kid G (took a simulation before the launch): open, every simulation listed');
  ok((await get('/api/hsk-sim/yct1-sim2', as(G1))).status === 200, '… and it loads');
  ok((await get('/api/hsk-sim/yct1-sim1', as(K1))).status === 403 && mod(await ruta(as(K1)), 'yct1').dorado.login, 'a key-only phone: refused, «Entra con tu código»');
  ok((await get('/api/hsk-sim/yct1-sim1', teacher(SEED))).status === 200, 'a teacher: always');
  // a teacher's PIN room: the kid takes what the teacher launches, Dorado or not
  const host = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true });
  const created = await emitAck(host, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim3', password: LEGACY });
  const kidSock = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true });
  const joined = created && created.pin ? await emitAck(kidSock, 'player:join', { pin: created.pin, name: 'Sala N', studentCode: kidN.studentCode }) : {};
  ok(joined && joined.roomPass, 'kid N (no key, no Dorado) joins a teacher\'s exam room');
  const room = await get('/api/hsk-sim/yct1-sim3?pin=' + created.pin + '&pass=' + encodeURIComponent(joined.roomPass || ''), as(N1));
  ok(room.status === 200 && room.json.ok, '… and the room\'s simulation loads (rooms are not touched by the Dorado rule)');
  await emitAck(host, 'host:end', { pin: created.pin, password: LEGACY });
  host.close(); kidSock.close();
  // kid A earns it: every world with 70 % or more
  ok((await post('/api/ruta/seals', { level: 'yct1', add: range(1, Y.words) }, as(A1))).json.ok, 'kid A stamps every seal of YCT 1');
  v = (await train(A1, 'yct1')).json;
  ok(v.worlds.every((w) => w.open) && world(v, 'simulacro').via === 'ready', 'every world open → the Simulacro del examen opens too');
  const sim = await play(A1, 'yct1', 'simulacro', 10);
  ok(sim.fin.ok && sim.fin.pct === 100 && !sim.fin.doradoNow, 'the Simulacro del examen: 100 %, but it never counts for the Dorado');
  const regular = E.worldsOf('yct1').filter((w) => w.kind === 'world');
  let lastFin = null;
  for (const w of regular.slice(1)) {
    lastFin = (await play(A1, 'yct1', w.key, w === regular[regular.length - 1] ? 7 : 10)).fin;
  }
  ok(lastFin && lastFin.pct === 70 && lastFin.doradoNow === true, 'the last world at 70 % → «¡Abriste El Simulacro Dorado!» (doradoNow)');
  mA = mod(await ruta(as(A1)), 'yct1');
  ok(mA.dorado.open && mA.dorado.via === 'practice' && mA.sims.length === mA.simCount, 'the route: open by practice, the simulations listed');
  ok((await get('/api/hsk-sim/yct1-sim1', as(A1))).status === 200 && (await get('/yct-sim.html?sim=yct1-sim1', as(A1))).status === 200, '… the simulation and its page load');

  section('«Desbloquear» opens any world early');
  const N2 = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(N2))).json.ok && (await enter(N2, '1003', null, kidN.studentCode)).levelOpen, 'kid N types the key and logs in');
  ok(!world((await train(N2, 'yct1')).json, 'comida').open, 'world 4: closed');
  const act = (body) => post('/api/admin/student/' + kidN.studentCode + '/ruta', body, teacher(SEED));
  ok((await act({ level: 'yct1', step: 'train', world: 4, action: 'unlock' })).json.ok && world((await train(N2, 'yct1')).json, 'comida').via === 'teacher', 'a teacher opens world 4 → open (a teacher)');
  ok((await round(N2, 'yct1', 'comida')).json.ok, '… and it plays');
  ok((await act({ level: 'yct1', step: 'train', world: 'all', action: 'unlock' })).json.ok && world((await train(N2, 'yct1')).json, 'simulacro').open, 'every world → the Simulacro del examen too');
  ok((await act({ level: 'yct1', step: 'dorado', action: 'unlock' })).json.ok && mod(await ruta(as(N2)), 'yct1').dorado.open, '«Desbloquear» the Dorado: open');

  section('/maestro: the kid\'s practice and the rule');
  const prof = (await get('/api/admin/students/' + kidA.studentCode, teacher(SEED))).json;
  const L0 = prof.ruta.levels.find((l) => l.id === 'yct1');
  ok(L0 && L0.worlds.every((w) => w.practiced >= 70) && L0.worlds[0].practiced === 90 && L0.dorado.open && L0.dorado.via === 'practice', 'kid A: % per world (best), the Dorado open by practice');
  ok(L0.extra.length === 1 && L0.extra[0].key === 'simulacro' && L0.extra[0].best === 100, '… the Simulacro del examen\'s best shown apart');
  const LG = (await get('/api/admin/students/' + kidG.studentCode, teacher(SEED))).json.ruta.levels.find((l) => l.id === 'yct1');
  ok(LG.dorado.open && LG.dorado.via === 'taken', 'kid G: open because they already took a simulation');
  ok(prof.ruta.settings.trainingLive === true && prof.ruta.settings.doradoPct === 70, 'the rule in force comes with it');

  section('his switch: OFF sticks across a restart');
  ok((await put('/api/admin/ruta-settings', { trainingLive: false }, teacher(SEED))).json.settings.trainingLive === false, 'he switches it OFF');
  await stopServer();
  await startServer();
  s = (await get('/api/admin/ruta-settings', teacher(SEED))).json.settings;
  ok(s.trainingLive === false && !/El Entrenamiento is LIVE \(phase 4 launch\)[\s\S]*El Entrenamiento is LIVE \(phase 4 launch\)/.test(allLog), 'after a restart: still OFF (the launch ran once)');
  const mP = mod(await ruta(as(P1)), 'yct1');
  ok(mP.dorado.open && mP.dorado.rule === 'key' && mP.sims.length === mP.simCount, 'OFF: the key opens the Dorado again');
  ok((await get('/api/hsk-sim/yct1-sim1', as(K1))).status === 200, '… even on a key-only phone');
  ok((await finish(A1, R.round)).status === 410, 'a round from before the restart: 410 (the page starts a new one)');
  ok((await put('/api/admin/ruta-settings', { trainingLive: true }, teacher(SEED))).json.settings.trainingLive === true, 'back ON');

  section('nothing secret in the log');
  ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
  ok(!/\[tts\] synth voice/.test(allLog), 'El Entrenamiento\'s voice never logs what it says');
}

(async () => {
  let crashed = false;
  try { unit(); } catch (e) { crashed = true; failed++; console.log('  ✖ the in-process part crashed: ' + (e && e.stack || e)); }
  try { await server(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (crashed && allLog) console.log(allLog.slice(-1500));
  if (!KEEP) { for (const d of [DATA, UNIT]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } }
  console.log(failed ? `test-ruta-training: ${failed} FAILED, ${passed} passed` : `test-ruta-training: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
