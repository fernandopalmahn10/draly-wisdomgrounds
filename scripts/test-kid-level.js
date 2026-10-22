#!/usr/bin/env node
// test-kid-level.js — «Change level» (2026-10-22, his ask: "if I see someone is mistakenly in a level that doesn't
// correspond to them, I change it, and then automatically that person gets logged out and logged in again and it says
// exactly that"). Its OWN server (port 4640, never 3000) on a temporary data folder with MADE-UP kids, throw-away teacher
// codes and level keys that are never printed. Never data/, never the live site. Checks (server.js /api/admin/kid-level,
// core/student-records.js changeLevel, js/level-note.js):
//   · a class-code kid moved by the super admin to a level where the same teacher HAS a class: the kid's level, the new
//     class code, the level open as a teacher's opening, the old (grandfathered) level kept, progress kept, the roster
//   · the kid's phone: its next home load is in the new level with the notice, ONCE (seen = gone on every phone); «¡Vamos!»;
//     a second phone that saved the OLD class code still comes in, in the new level, and gets the new class code; that
//     login never undoes the change
//   · a class-code kid moved by her own teacher who has NO class of that level: own level, same class code, «Undo» puts
//     everything back exactly, and her class-code login keeps the teacher's level after a new change
//   · a key kid (dkid phone): moved, the phone still comes in without a key (never the key screen, never «¿Eres tú?»), the
//     cookie is re-issued for the new level; La Ruta Dorada's state carries the note; once its old level's devices are
//     closed, an old cookie asks for the key again (nothing weakened)
//   · refused: another teacher, an unknown kid (the same answer as «not yours»), an archived kid (never woken), another
//     site, a level that does not exist, an undo by someone else or too late
//   · a renamed class code renames the codes a kid was moved away from
//   · nothing logs a kid's code, a teacher code or a level key
//   node scripts/test-kid-level.js            (--port 4640 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4640));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const say = (t) => { console.log(t); if (process.env.TEST_OUT) { try { fs.appendFileSync(process.env.TEST_OUT, t + '\n'); } catch (_) {} } };
const ok = (cond, msg) => { if (cond) passed++; else { failed++; say('  ✖ ' + msg); } };
const section = (t) => say('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-kidlevel-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SUPER = 'T-' + rnd(5), BEA = 'T-' + rnd(5), CARO = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };
process.env.SIM_LOCK_SECRET = SECRET;
const SimLock = require('../core/sim-lock');

// made-up class codes (random, distinct, never a real one), read back from here only
const CLS = new Set();
while (CLS.size < 7) CLS.add(String(2000 + crypto.randomInt(7999)));
const [S_HSK, S_NEW, S_YCT, B_HSK, C_NEW, RENAMED, S_NEW2] = [...CLS];
const UID = { super: 'u' + rnd(6), bea: 'u' + rnd(6), caro: 'u' + rnd(6) };
const NOW = Date.now(), DAY = 86400e3;
const T0 = (o) => Object.assign({ codeGen: 0, email: null, country: 'MX', createdAt: NOW - 90 * DAY, lastSeen: NOW }, o);
fs.writeFileSync(path.join(DATA, 'teachers.json'), JSON.stringify({
  [SUPER]: T0({ teacherId: SUPER, uid: UID.super, displayName: 'Super Prueba', accessCodes: [S_HSK, S_NEW, S_YCT], codeLevels: { [S_NEW]: 'hsk2', [S_YCT]: 'yct1' }, isSuperAdmin: true }),
  // Bea teaches only Old HSK 1 (no class of New HSK 1 nor YCT 1): a kid she moves keeps her class code
  [BEA]: T0({ teacherId: BEA, uid: UID.bea, displayName: 'Bea Prueba', accessCodes: [B_HSK], codeLevels: {}, isSuperAdmin: false }),
  [CARO]: T0({ teacherId: CARO, uid: UID.caro, displayName: 'Caro Prueba', accessCodes: [C_NEW], codeLevels: { [C_NEW]: 'hsk2' }, isSuperAdmin: false }),
}));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 3 * DAY }));
// made-up kids: RICA (Ricardo, the super admin's Old HSK 1 class, from before the keys, with progress), BETO (Bea's class),
// KEYK (a key account tagged to Bea's class, held by a phone's dkid), CARK (Caro's kid), ARCH (Bea's kid resting in the archive)
const KIDS = { RICA: 'RICA', BETO: 'BETO', KEYK: 'KEY7K4', CARK: 'CARK', ARCH: 'ARCH', UNDK: 'UNDK', KEY3: 'KEY3K3', KEY2: 'KEY2K2' };
const KEY_BORN = NOW - 20 * DAY;
const SEEDED = {
  RICA: { code: 'RICA', displayName: 'Ricardo Prueba', avatar: 'aileen', classroomCode: S_HSK, classroomId: null, firstSeen: NOW - 200 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: 'hsk1', ruta: { hsk1: { s: '1-10', at: NOW - DAY, p: { 1: 85 } } }, tareas: { 'hsk1-e01-r1': { h: NOW - 2 * DAY, s: NOW - DAY } },
    hskResults: [{ simId: 'hsk1-sim1', ts: NOW - 5 * DAY, score: 150, total: 200, percent: 75 }] },
  BETO: { code: 'BETO', displayName: 'Beto Prueba', avatar: 'latifa', classroomCode: B_HSK, classroomId: null, firstSeen: NOW - 9 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: 'hsk1', levelSince: NOW - 9 * DAY, levelAccess: { hsk1: { via: 'teacher', at: NOW - 8 * DAY } }, ruta: { hsk1: { s: '1-3', at: NOW - DAY } } },
  KEY7K4: { code: 'KEY7K4', displayName: 'Kiara Prueba', avatar: 'falcon', classroomCode: B_HSK, classroomId: null, firstSeen: KEY_BORN, lastSeen: NOW - DAY,
    sentencesBuilt: [], byKey: NOW - 20 * DAY, level: 'hsk1', levelSince: KEY_BORN, levelAccess: { hsk1: { via: 'key', at: KEY_BORN, gen: 1 } }, ruta: { hsk1: { s: '1-5', at: NOW - DAY } } },
  CARK: { code: 'CARK', displayName: 'Carla Prueba', avatar: 'latifa', classroomCode: C_NEW, classroomId: null, firstSeen: NOW - 9 * DAY, lastSeen: NOW - DAY, sentencesBuilt: [], level: 'hsk2' },
  // (review 2026-10-22) phones that follow during the «Undo» window: a class kid (UNDK) and a key kid (KEY3, yct1); and a
  // key kid whose NEW level is closed before her phone follows (KEY2, yct1)
  UNDK: { code: 'UNDK', displayName: 'Uri Prueba', avatar: 'adric', classroomCode: S_HSK, classroomId: null, firstSeen: NOW - 9 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: 'hsk1', levelSince: NOW - 9 * DAY, levelAccess: { hsk1: { via: 'teacher', at: NOW - 8 * DAY } } },
  KEY3K3: { code: 'KEY3K3', displayName: 'Tea Prueba', avatar: 'falcon', classroomCode: null, classroomId: null, firstSeen: KEY_BORN, lastSeen: NOW - DAY,
    sentencesBuilt: [], byKey: KEY_BORN, level: 'yct1', levelSince: KEY_BORN, levelAccess: { yct1: { via: 'key', at: KEY_BORN, gen: 1 } } },
  KEY2K2: { code: 'KEY2K2', displayName: 'Dos Prueba', avatar: 'falcon', classroomCode: null, classroomId: null, firstSeen: KEY_BORN, lastSeen: NOW - DAY,
    sentencesBuilt: [], byKey: KEY_BORN, level: 'yct1', levelSince: KEY_BORN, levelAccess: { yct1: { via: 'key', at: KEY_BORN, gen: 1 } } },
};
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));
fs.writeFileSync(path.join(DATA, 'student-archive.json'), JSON.stringify({
  ARCH: { code: 'ARCH', displayName: 'Ana Archivo', avatar: null, classroomCode: B_HSK, classroomId: null, firstSeen: NOW - 120 * DAY, lastSeen: NOW - 60 * DAY, sentencesBuilt: [], level: 'hsk1' },
}));
const dkidOf = (code, born, lg, kg) => SimLock.sign('K', [code, '0', String(born), lg, String(kg || 0)], 3600e3);

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
        const text = Buffer.concat(chunks).toString('utf8');
        const sc = res.headers['set-cookie'] || [];
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) { if (/Max-Age=0\b/.test(c)) delete o.jar[m[1]]; else o.jar[m[1]] = m[2]; } });
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, cookies: sc });
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
let ipN = 10;
const phone = (ip) => ({ jar: {}, headers: { 'CF-Connecting-IP': ip || '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, extra || {}) });
const teacher = (code, extra) => ({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250', 'X-Admin-Pw': encodeURIComponent(code) }, extra || {}) });
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (_) { return {}; } };
const records = () => read('student-records.json');
const move = (tcode, code, level, extra) => post('/api/admin/kid-level', { code, level }, teacher(tcode, extra));
const home = (ph, code, ac) => get('/api/homework/home?accessCode=' + encodeURIComponent(ac || '') + '&studentCode=' + encodeURIComponent(code), as(ph));

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SUPER, RENDER: '', DRALY_TRAINING_BUILT: '1', DRALY_DORADO_SELF_SERVE: '' }),
  });
  try { os.setPriority(srv.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000).split(SUPER).join('<code>'));
  srv.kill();
  process.exit(2);
}
async function stopServer() {
  if (!srv) return;
  const p = new Promise((r) => srv.once('exit', r));
  srv.kill();
  await p;
  srv = null;
}

async function run() {
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SUPER))).json.ok, `the ${lvl} key is set (the keys are live from now on)`);

  // ── 1. a class-code kid, moved by the super admin to a level where the same teacher has a class ──
  section('Ricardo (class code, Old HSK 1, from before the keys) → New HSK 1 by the super admin');
  const P1 = phone();
  let r = await post('/api/homework/enter', { accessCode: S_HSK, studentCode: 'RICA' }, as(P1));
  ok(r.json && r.json.ok && r.json.level === 'hsk1' && P1.jar.dsim, 'his phone logs in with his class code: Old HSK 1, a session');
  ok((await home(P1, 'RICA', S_HSK)).json.level === 'hsk1', '… his home says Old HSK 1');
  ok((await get('/api/admin/students', teacher(SUPER))).json.students.find((s) => s.code === 'RICA').level === 'hsk1', 'the roster says Old HSK 1');
  r = await move(SUPER, 'RICA', 'newhsk1');   // (the curriculum name of the stored id works too)
  ok(r.status === 200 && r.json.ok && r.json.from === 'hsk1' && r.json.level === 'hsk2' && r.json.teacherName === 'New HSK 1' && r.json.levelName === 'New HSK 1',
    'POST /api/admin/kid-level: moved from Old HSK 1 to New HSK 1');
  ok(r.json.moved === true && r.json.classroomCode === S_NEW, '… into the same teacher\'s New HSK 1 class');
  ok(r.json.levelKey && r.json.levelKey.level === 'hsk2' && r.json.levelKey.open === true && r.json.levelKey.via === 'teacher', '… New HSK 1 open on his account as a teacher\'s opening (no key)');
  ok(/^[a-f0-9]{24}$/.test(r.json.undo || '') && r.json.levelChange && r.json.levelChange.seen === 0, '… an undo token and the change in force, not seen yet');
  ok(Array.isArray(r.json.ruta && r.json.ruta.levels) && r.json.ruta.levels[0].id === 'hsk2', '… La Ruta Dorada in his profile now starts with New HSK 1');
  let rec = records().RICA;
  ok(rec.level === 'hsk2' && rec.classroomCode === S_NEW && rec.levelAccess.hsk2.via === 'teacher' && rec.levelAccess.hsk1 && rec.levelAccess.hsk1.via === 'grandfathered',
    'the record: level, class code, the new level a teacher\'s opening, the old one kept (it was his from before the keys)');
  ok(rec.levelBy && rec.levelBy.to === 'hsk2' && rec.levelBy.from.includes('hsk1') && rec.levelBy.codes.includes(S_HSK) && rec.levelBy.seen === 0 && !JSON.stringify(rec.levelBy).includes(SUPER),
    '… levelBy: the notice, the level and class code he was moved from (never a teacher code)');
  ok(rec.ruta.hsk1.s === '1-10' && rec.ruta.hsk1.p[1] === 85 && rec.tareas['hsk1-e01-r1'].s > 0 && rec.hskResults.length === 1, 'his progress stays: seals, practice, homework marks, exam tries');
  const st = (await get('/api/admin/students', teacher(SUPER))).json.students.find((s) => s.code === 'RICA');
  ok(st.level === 'hsk2' && st.classroomCode === S_NEW, 'the roster: New HSK 1, the New HSK 1 class');
  ok((await get('/api/admin/students/RICA', teacher(SUPER))).json.levelChange.at === rec.levelBy.at, 'his profile shows the change');

  section('his phone follows by itself and says so once');
  r = await home(P1, 'RICA', S_HSK);   // (the tab still holds the OLD class code)
  ok(r.status === 200 && r.json.level === 'hsk2' && r.json.levelName === 'New HSK 1' && r.json.slug === 'newhsk1', 'his next home load (old class code in the tab): New HSK 1');
  const note = r.json.levelNote;
  ok(note && note.name === 'New HSK 1' && note.level === 'newhsk1' && note.levelId === 'hsk2' && note.family === 'newhsk' && note.at === rec.levelBy.at, '… with the notice «Tu profe te cambió a New HSK 1 ✨»');
  ok(!JSON.stringify(note).includes('RICA') && !JSON.stringify(note).includes(S_HSK), '… which names no code');
  r = await post('/api/entrada/vamos', {}, as(P1));
  ok(r.json && r.json.ok && r.json.level === 'hsk2' && r.json.classroomCode === S_NEW && r.json.levelOpen === true && Array.isArray(r.json.assignments),
    '«¡Vamos!» (the page comes in again): New HSK 1, his new class code, the level open, nothing typed');
  const rd = (await get('/api/ruta-dorada', as(P1))).json;
  ok(rd.home === 'newhsk1' && rd.levelNote && rd.levelNote.at === note.at && rd.modules.find((m) => m.id === 'hsk2').open && rd.modules.find((m) => m.id === 'hsk1').open,
    'La Ruta Dorada: home New HSK 1, the notice too, New HSK 1 open, Old HSK 1 still open (his)');
  ok((await post('/api/homework/level-note', { at: note.at }, as(phone()))).status === 401, 'the notice\'s «seen» needs the kid\'s own session');
  r = await post('/api/homework/level-note', { at: note.at }, as(P1));
  ok(r.json && r.json.ok && r.json.seen === true, 'his phone showed it: told once');
  ok((await home(P1, 'RICA', S_NEW)).json.levelNote === null && (await get('/api/ruta-dorada', as(P1))).json.levelNote === null, '… then never again (home, La Ruta Dorada)');
  ok((await post('/api/homework/level-note', { at: note.at }, as(P1))).json.seen === false, '… a second «seen» changes nothing');

  section('a second phone that saved the OLD class code still comes in, in the new level');
  const P1b = phone();
  r = await post('/api/entrada/hola', { accessCode: S_HSK, studentCode: 'RICA' }, as(P1b));
  ok(r.json && r.json.ok && r.json.kid && r.json.kid.levelId === 'hsk2' && r.json.kid.levelName === 'New HSK 1', '«¡Hola de nuevo!» with the old saved codes: Ricardo, New HSK 1');
  r = await post('/api/homework/enter', { accessCode: S_HSK, studentCode: 'RICA' }, as(P1b));
  ok(r.json && r.json.ok && r.json.level === 'hsk2' && r.json.classMoved === true && r.json.classroomCode === S_NEW && P1b.jar.dsim && r.json.levelOpen === true,
    '«¡Vamos!» (the old login): New HSK 1, `classMoved` with the new class code, a session, the level open');
  rec = records().RICA;
  ok(rec.level === 'hsk2' && rec.classroomCode === S_NEW, '… and that login never undid the change');
  ok((await post('/api/homework/enter', { accessCode: S_YCT, studentCode: 'RICA' }, as(phone()))).json.classMoved === false, 'a class code he was never in: not «his» (as before)');
  await sleep(1300);
  // (a login with another class's code still re-tags a kid, as it always did: that is how kids moved up. Review
  // 2026-10-22: from then on nothing the teacher's change left keeps working)
  rec = records().RICA;
  ok(rec.classroomCode === S_YCT && rec.level === 'yct1' && !rec.levelBy, 'that login re-tagged him (as always) and cleared what the change left');
  r = await post('/api/entrada/hola', { accessCode: S_HSK, studentCode: 'RICA' }, as(phone()));
  ok(r.status === 401, '… so his former class code no longer holds him (never a former class code for good)');
  ok((await move(SUPER, 'RICA', 'hsk2')).json.ok, '(the super admin puts him back in New HSK 1 after that stranger\'s login)');
  ok(records().RICA.levelBy.codes.join() === S_YCT && records().RICA.levelBy.cc === S_NEW, '… the change now holds the class code he left (and the one he is in)');

  // ── 2. her own teacher, no class of that level: own level, Undo ──
  section('Beto (Bea\'s Old HSK 1 class; Bea has no New HSK 1 class) → New HSK 1 by Bea, then «Undo»');
  const P2 = phone();
  ok((await post('/api/homework/enter', { accessCode: B_HSK, studentCode: 'BETO' }, as(P2))).json.level === 'hsk1', 'his phone logs in: Old HSK 1');
  const before = records().BETO;
  r = await move(BEA, 'BETO', 'hsk2');
  ok(r.json && r.json.ok && r.json.moved === false && r.json.classroomCode === B_HSK && r.json.levelKey.level === 'hsk2', 'Bea moves him: New HSK 1, he stays in her class (she has none of that level)');
  rec = records().BETO;
  ok(rec.level === 'hsk2' && rec.classroomCode === B_HSK && rec.levelAccess.hsk2.via === 'teacher', '… his own level wins over the class code\'s');
  ok((await home(P2, 'BETO', B_HSK)).json.level === 'hsk2', '… his home is New HSK 1');
  const undo1 = r.json.undo;
  ok((await post('/api/admin/kid-level/undo', { undo: undo1 }, teacher(CARO))).status === 410, 'another teacher can\'t use her undo');
  r = await post('/api/admin/kid-level/undo', { undo: undo1 }, teacher(BEA));
  ok(r.json && r.json.ok && r.json.level === 'hsk1' && r.json.teacherName === 'Old HSK 1' && r.json.levelChange === null, '«Undo»: back to Old HSK 1 (the profile shows no change)');
  rec = records().BETO;
  ok(JSON.stringify([rec.level, rec.levelSince, rec.classroomCode, rec.levelAccess]) === JSON.stringify([before.level, before.levelSince, before.classroomCode, before.levelAccess]),
    '… exactly what was there before (level, its date, class code, open levels)');
  ok(rec.levelBy && rec.levelBy.to === 'hsk1' && rec.levelBy.from.includes('hsk2') && rec.levelBy.seen > 0, '… a change BACK: a phone that followed still holds him, and nothing to tell (he never saw the first one)');
  ok((await home(P2, 'BETO', B_HSK)).json.levelNote === null, '… so his phone shows no notice');
  ok((await post('/api/admin/kid-level/undo', { undo: undo1 }, teacher(BEA))).status === 410, 'an undo works once');
  r = await move(BEA, 'BETO', 'hsk2');
  ok(r.json.ok && r.json.level === 'hsk2', 'Bea moves him again');
  r = await post('/api/homework/enter', { accessCode: B_HSK, studentCode: 'BETO' }, as(phone()));
  ok(r.json && r.json.ok && r.json.level === 'hsk2' && r.json.classMoved === false && records().BETO.level === 'hsk2',
    'a login with his own class code (an Old HSK 1 code) keeps the teacher\'s New HSK 1');
  ok((await get('/api/homework/trainer/session/x/y?accessCode=' + B_HSK, as(P2))).status === 403, '… and the Old HSK 1 trainer closes for him (his level, not his class code\'s)');
  ok((await move(BEA, 'BETO', 'hsk2')).json.unchanged === true, 'the level he is already in: nothing changes');

  // ── 3. a key account held by a phone's dkid ──
  section('Kiara (key account, Bea\'s class, her phone holds her) → YCT 1 by Bea');
  const P3 = phone();
  P3.jar.dkid = dkidOf(KIDS.KEYK, KEY_BORN, 'hsk1:1', 0);
  const P3b = phone();
  P3b.jar.dkid = P3.jar.dkid;                      // another phone of hers (the same kind of cookie, from before)
  let h = (await get('/api/entrada/hola', as(P3))).json;
  ok(h.kid && h.kid.levelId === 'hsk1' && !h.relock, 'before: her phone says «¡Hola de nuevo!», HSK 1');
  const oldDkid = P3.jar.dkid;
  r = await move(BEA, KIDS.KEYK, 'yct1');
  ok(r.json && r.json.ok && r.json.level === 'yct1' && r.json.moved === false && r.json.levelKey.open && r.json.levelKey.via === 'teacher', 'Bea moves her to YCT 1 (opened by a teacher: no key)');
  h = (await get('/api/entrada/hola', as(P3))).json;
  ok(h.kid && !h.relock && !h.parked && h.kid.levelId === 'yct1' && h.kid.levelName === 'YCT 1', 'her phone: «¡Hola de nuevo!» in YCT 1 (never the key screen, never «¿Eres tú?»)');
  ok(P3.jar.dkid && P3.jar.dkid !== oldDkid, '… its dkid re-issued for the new level');
  r = await post('/api/entrada/vamos', {}, as(P3));
  ok(r.json && r.json.ok && r.json.level === 'yct1' && r.json.keyMode === true && r.json.levelOpen === true, '«¡Vamos!»: YCT 1, nothing to type');
  r = await home(P3, KIDS.KEYK, '');
  ok(r.json && r.json.ok && r.json.level === 'yct1' && r.json.levelNote && r.json.levelNote.name === 'YCT 1', 'her home: YCT 1 with «Tu profe te cambió a YCT 1 ✨»');
  ok((await get('/api/ruta-dorada', as(P3))).json.levelNote.name === 'YCT 1', '… La Ruta Dorada carries it too (until a phone shows it)');
  h = (await get('/api/entrada/hola', as(P3b))).json;
  ok(h.kid && !h.relock && h.kid.levelId === 'yct1', 'her OTHER phone (old cookie) follows at its next request');
  ok((await post('/api/homework/level-note', { at: r.json.levelNote.at }, as(P3))).json.seen === true, 'one phone showed it');
  ok((await get('/api/ruta-dorada', as(P3b))).json.levelNote === null, '… the other phone never shows it again');
  rec = records()[KIDS.KEYK];
  ok(rec.ruta.hsk1.s === '1-5' && rec.levelAccess.hsk1.via === 'key' && rec.classroomCode === B_HSK && rec.byKey, 'her HSK 1 seals and key stay; still in Bea\'s class; still a key account');

  // ── 3b. (review 2026-10-22) phones that followed during the «Undo» window still hold the kid afterwards ──
  section('«Undo» after a phone already followed: a change back, never a stranded phone');
  r = await move(SUPER, 'UNDK', 'hsk2');
  ok(r.json.ok && r.json.moved && r.json.classroomCode === S_NEW, 'Uri → New HSK 1, moved to the New HSK 1 class');
  const undo2 = r.json.undo;
  r = await post('/api/homework/enter', { accessCode: S_HSK, studentCode: 'UNDK' }, as(phone()));
  ok(r.json.ok && r.json.classMoved && r.json.classroomCode === S_NEW, 'his phone follows at once and saves the NEW class code');
  ok((await post('/api/admin/kid-level/undo', { undo: undo2 }, teacher(SUPER))).json.ok, 'then the teacher taps «Undo»');
  rec = records().UNDK;
  ok(rec.level === 'hsk1' && rec.classroomCode === S_HSK && !rec.levelAccess.hsk2, '… he is back in Old HSK 1, in his old class, New HSK 1 closed again');
  r = await post('/api/entrada/hola', { accessCode: S_NEW, studentCode: 'UNDK' }, as(phone()));
  ok(r.json && r.json.ok && r.json.kid.levelId === 'hsk1', 'a phone holding the NEW class code still comes in, in Old HSK 1');
  r = await post('/api/homework/enter', { accessCode: S_NEW, studentCode: 'UNDK' }, as(phone()));
  ok(r.json && r.json.ok && r.json.level === 'hsk1' && r.json.classMoved === true && r.json.classroomCode === S_HSK, '… its login keeps Old HSK 1 and hands back his class code');
  rec = records().UNDK;
  ok(rec.level === 'hsk1' && rec.classroomCode === S_HSK, '… and never undoes the teacher\'s «Undo»');
  const P7 = phone();
  P7.jar.dkid = dkidOf(KIDS.KEY3, KEY_BORN, 'yct1:1', 0);
  const k3old = P7.jar.dkid;
  r = await move(SUPER, KIDS.KEY3, 'hsk2');
  const undo3 = r.json.undo;
  h = (await get('/api/entrada/hola', as(P7))).json;
  ok(r.json.ok && h.kid && h.kid.levelId === 'hsk2' && P7.jar.dkid && P7.jar.dkid !== k3old, 'a key kid\'s phone follows to New HSK 1 (its cookie re-issued)');
  ok((await post('/api/admin/kid-level/undo', { undo: undo3 }, teacher(SUPER))).json.ok, '«Undo»');
  const P7b = { jar: { dkid: P7.jar.dkid }, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } };   // (the re-issued cookie, no session)
  h = (await get('/api/entrada/hola', as(P7b))).json;
  ok(h.kid && !h.relock && !h.parked && h.kid.levelId === 'yct1', 'her phone with the New HSK 1 cookie still comes in, back in YCT 1 (never the key screen)');
  ok(!records()[KIDS.KEY3].levelAccess.hsk2 && records()[KIDS.KEY3].levelAccess.yct1.via === 'key', '… New HSK 1 closed again, her YCT 1 key as it was');

  // ── 4. who may ──
  section('refused: another teacher, an unknown kid, an archived kid, another site, a bad level');
  const notMine = await move(CARO, 'BETO', 'yct1');
  const unknown = await move(CARO, 'ZZZZ', 'yct1');
  const unknown2 = await move(BEA, 'QQQQQQ', 'yct1');
  ok(notMine.status === 404 && unknown.status === 404 && unknown2.status === 404 && notMine.text === unknown.text && unknown.text === unknown2.text,
    'another teacher\'s kid and an unknown code: the same answer');
  ok(records().BETO.level === 'hsk2', '… nothing changed');
  ok((await move(BEA, 'CARK', 'hsk1')).status === 404, 'Bea can\'t move Caro\'s kid');
  ok((await move(CARO, 'CARK', 'yct1')).json.ok, 'Caro can move her own kid');
  ok(records().CARK.levelAccess.yct1 && records().CARK.levelAccess.yct1.by === 'level', '… YCT 1 opened by the change');
  ok((await move(CARO, 'CARK', 'hsk1')).json.ok && !records().CARK.levelAccess.yct1 && records().CARK.levelAccess.hsk1.via === 'teacher',
    'a mis-move fixed later: the level she never used (YCT 1) closes again; Old HSK 1 opens');
  const P4 = phone();
  r = await post('/api/homework/enter', { accessCode: C_NEW, studentCode: 'CARK' }, as(P4));
  ok(r.json && r.json.ok && r.json.level === 'hsk1' && r.json.classroomCode === C_NEW, 'her login with her (New HSK 1) class code: Old HSK 1, the teacher\'s level');
  ok((await get('/api/homework/trainer/session/x/y?accessCode=' + C_NEW, as(P4))).status === 404, '… so the Old HSK 1 trainer is hers (past the level door: «not found» for a made-up round)');
  const arch = await move(BEA, 'ARCH', 'hsk2');
  ok(arch.status === 409 && arch.json.archived === true, 'an archived kid of hers: refused (409)');
  ok((await move(CARO, 'ARCH', 'hsk2')).text === unknown.text, 'an archived kid of someone else: the same answer as unknown');
  ok(!records().ARCH && read('student-archive.json').ARCH && read('student-archive.json').ARCH.level === 'hsk1', '… and the archive was never woken or changed');
  ok((await move(SUPER, 'RICA', 'hsk3')).status === 400, 'a level that does not exist: 400');
  ok((await move(SUPER, 'RICA', 'yct1', { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'from another site: 403');
  ok((await post('/api/admin/kid-level', { code: 'RICA', level: 'yct1' }, { headers: { 'CF-Connecting-IP': '198.51.100.251' } })).status === 401, 'no teacher code: 401');
  ok((await post('/api/admin/kid-level/undo', { undo: 'f'.repeat(24) }, teacher(SUPER))).status === 410, 'an undo that does not exist: 410');

  // ── 5. a renamed class code renames the codes a kid was moved away from ──
  section('a renamed class code');
  r = await put('/api/admin/teacher/' + UID.super + '/class-code', { from: S_YCT, to: RENAMED }, teacher(SUPER));
  ok(r.json && r.json.ok, 'the super admin renames his YCT 1 class code');
  rec = records().RICA;
  ok(rec.levelBy.codes.includes(RENAMED) && !rec.levelBy.codes.includes(S_YCT) && rec.classroomCode === S_NEW, 'Ricardo\'s «moved from» code is renamed too; his class stays New HSK 1');
  r = await put('/api/admin/teacher/' + UID.super + '/class-code', { from: S_NEW, to: S_NEW2 }, teacher(SUPER));
  rec = records().RICA;
  ok(r.json && r.json.ok && rec.classroomCode === S_NEW2 && rec.levelBy.cc === S_NEW2, 'his own class code renamed: the change follows it (still his)');
  ok((await home(P1, 'RICA', S_NEW2)).json.level === 'hsk2', '… and he is still in New HSK 1');
  ok((await post('/api/entrada/hola', { accessCode: RENAMED, studentCode: 'RICA' }, as(phone()))).json.ok, '… so the renamed code still holds him');

  // ── 6. nothing weakened: closing the old level's devices still asks an old cookie for the key ──
  section('the old level\'s key closed on every device: an old cookie asks for the key again');
  ok((await post('/api/admin/level-keys/hsk1/close-devices', {}, teacher(SUPER))).json.ok, 'the super admin closes HSK 1 on every device');
  const P3c = phone();
  P3c.jar.dkid = oldDkid;
  h = (await get('/api/entrada/hola', as(P3c))).json;
  ok(!h.kid && h.relock && h.relock.levelId === 'yct1', 'a phone still holding the HSK 1 cookie: «escribe la clave nueva» (never in by itself)');
  h = (await get('/api/entrada/hola', as(P3))).json;
  ok(h.kid && h.kid.levelId === 'yct1', 'her phone that followed (its YCT 1 cookie, like a phone that typed the YCT 1 key) still comes in');
  // (review 2026-10-22) the NEW level closed before a phone followed: that phone asks for the key too
  const P8 = phone();
  P8.jar.dkid = dkidOf(KIDS.KEY2, KEY_BORN, 'yct1:1', 0);
  ok((await move(SUPER, KIDS.KEY2, 'hsk2')).json.ok, 'Dos (a key kid, YCT 1) → New HSK 1');
  ok((await post('/api/admin/level-keys/hsk2/close-devices', {}, teacher(SUPER))).json.ok, '… then New HSK 1 is closed on every device before her phone opens');
  h = (await get('/api/entrada/hola', as(P8))).json;
  ok(!h.kid && h.relock && h.relock.levelId === 'hsk2', 'her phone (still the YCT 1 cookie) asks for the key: a close of the new level counts too');

  // ── 7. the pages ──
  section('the pages');
  const mj = fs.readFileSync(path.join(ROOT, 'public', 'js', 'maestro.js'), 'utf8');
  const md = fs.readFileSync(path.join(ROOT, 'public', 'js', 'mi-dralingo.js'), 'utf8');
  const au = fs.readFileSync(path.join(ROOT, 'public', 'js', 'audios.js'), 'utf8');
  const ln = fs.readFileSync(path.join(ROOT, 'public', 'js', 'level-note.js'), 'utf8');
  const dict = fs.readFileSync(path.join(ROOT, 'public', 'js', 'hw-i18n.js'), 'utf8');
  ok(/'\/api\/admin\/kid-level'/.test(mj) && /JSON\.stringify\(\{ code: data\.code, level: pick \}\)/.test(mj) && !/kid-level\/'\s*\+/.test(mj), '/maestro sends the kid\'s code in the body, never in the address');
  ok(/label: 'Undo', ms: 8000/.test(mj) && /Are you sure\?/.test(mj) && /Change level/.test(mj), '/maestro: «Change level», «Are you sure?», a toast with «Undo» for 8 s');
  ok(/<details class="m-detail-more"[\s\S]{0,900}m-detail-close-sessions-btn/.test(mj), '«Cerrar su sesión en todos los teléfonos» lives under «More»');
  ok(/H\.follow\(\)/.test(md) && /DralyLevelNote\.show\(d\.levelNote\)/.test(md), 'the home comes in again in the new level, then shows the notice');
  ok(/levelFollow\(\)/.test(au) && /DralyLevelNote\.show\(n\)/.test(au), 'La Ruta Dorada goes to the new level and shows the notice');
  ok(/Tu profe te cambió a ' \+ esc\(note\.name\) \+ ' ✨/.test(ln) && /\/api\/homework\/level-note/.test(ln), 'the card: «Tu profe te cambió a <nivel> ✨», and it tells the server');
  ok(/Tu profe te cambió a \(\.\+\) ✨\$\//.test(dict) && /Lo que ya hiciste sigue guardado/.test(dict), 'its English is in hw-i18n.js');
  const en = 'Your teacher moved you to New HSK 1 ✨';
  ok(!/^Tu profe te cambió a (.+) ✨$/.test(en), '… and it settles (its English never matches the Spanish again)');
}

(async () => {
  let crashed = false;
  await startServer();
  try { await run(); } catch (e) { crashed = true; failed++; say('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(/\[kid-level\] a teacher changed a kid's level: Old HSK 1 → New HSK 1/.test(allLog), 'the log says what changed (levels only)');
    const secrets = [SUPER, BEA, CARO, LEGACY].concat(Object.values(KEYS));
    ok(!secrets.some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
    const kidCodes = Object.values(KIDS).concat(['ZZZZ', 'QQQQQQ']);
    ok(!kidCodes.some((c) => new RegExp('\\b' + c + '\\b').test(allLog)), 'no kid\'s code in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  say(failed ? `test-kid-level: ${failed} FAILED, ${passed} passed` : `test-kid-level: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
