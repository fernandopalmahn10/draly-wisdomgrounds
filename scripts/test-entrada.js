#!/usr/bin/env node
// test-entrada.js — «Mi Dralingo», part 1: la entrada (2026-10-18, his pick: "the level key is the family's one password").
// Its OWN server (port 4470, never 3000) on a temporary data folder with MADE-UP accounts, throw-away teacher codes and
// level keys that are never printed (the class codes are read from the seeded test teacher, never written here). Never
// data/, never the live site. Checks (server.js «LA ENTRADA», js/entrada.js):
//   · «Soy nuevo»: a right key gives its level, the kid's name and avatar, a six-character code, no class code, the level
//     open on the account and the phone, the session and the phone's dkid; a wrong key is a counted miss (5 a phone →
//     a wait) with one uniform line
//   · «Ya tengo mi código»: code + key opens on a new phone (old 4-character accounts too); every wrong pair gives the same
//     answer and counts; a code without the key never opens (nor with a class code at the old form or the homework doors)
//   · the transitional door: an old class account logs in with the old form exactly as before, and the «¡Hola de nuevo!»
//     summary of the phone's saved codes needs them to be right (a wrong pair counts)
//   · «¡Hola de nuevo!»: only the phone's own kid; nothing for another phone; nothing after «Salir»; «¡Vamos!»
//   · the phone's automatic account becomes the kid's («Soy nuevo»), a parked one asks first (resume / fresh)
//   · a PIN room: the key account joins its teacher's class (proven by the phone's cookies), never a stranger's typed code,
//     never an unclaimed automatic account; who sees it in /maestro before and after
//   · «Salir» parks the remembered kid; another kid's login parks it too; code + key brings it back
//   · «Abrir otro nivel» (add a level by key); homework calls with the session and no class code
//   node scripts/test-entrada.js            (--port 4470 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4470));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
// (TEST_OUT=<file>: every line also goes there, for a run through the gentle runner that only shows the last line)
const say = (t) => { console.log(t); if (process.env.TEST_OUT) { try { fs.appendFileSync(process.env.TEST_OUT, t + '\n'); } catch (_) {} } };
const ok = (cond, msg) => { if (cond) passed++; else { failed++; say('  ✖ ' + msg); } };
const section = (t) => say('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-entrada-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };
process.env.SIM_LOCK_SECRET = SECRET;
const SimLock = require('../core/sim-lock');
const autoCookie = (code, parked, born) => SimLock.sign('A', [code, parked ? '1' : '0', String(born || 0)], 3600e3);

// a made-up super admin with made-up class codes (random, distinct, never a real one): the teacher file is written
// before the boot, so the first-boot seed never runs
const CLS = new Set();
while (CLS.size < 3) CLS.add(String(2000 + crypto.randomInt(7999)));
const [NEWC, YCTC, HSKC] = [...CLS];
fs.writeFileSync(path.join(DATA, 'teachers.json'), JSON.stringify({ [SEED]: {
  teacherId: SEED, uid: 'u' + rnd(6), codeGen: 0, displayName: 'Super Prueba', email: null, country: 'MX',
  accessCodes: [HSKC, NEWC, YCTC], codeLevels: { [NEWC]: 'hsk2', [YCTC]: 'yct1' }, isSuperAdmin: true, createdAt: Date.now(), lastSeen: Date.now(),
} }));
// made-up accounts: three automatic ones with progress (AUTA unparked, AUTB and AUTC parked on their phones), an old class
// kid (OLDK, a 4-character code, New HSK 1, its class code the made-up New HSK 1 one)
const NOW = Date.now(), DAY = 86400e3;
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 3 * DAY }));
const SEEDED = {
  AUTA: { code: 'AUTA', displayName: 'Dragoncito 512', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 5 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'seal', autoName: true, level: 'yct1', ruta: { yct1: { s: '1-10', at: NOW - DAY, p: { 1: 85 } } } },
  AUTB: { code: 'AUTB', displayName: 'Dragoncito 613', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 6 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'seal', autoName: true, level: 'hsk2', ruta: { hsk2: { s: '1-4', at: NOW - DAY } } },
  AUTC: { code: 'AUTC', displayName: 'Dragoncito 714', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 6 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'key', autoName: true, level: 'hsk2' },
  OLDK: { code: 'OLDK', displayName: 'Valeria Prueba', avatar: 'aileen', classroomCode: NEWC, classroomId: null, firstSeen: NOW - 90 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: 'hsk2', levelAccess: { hsk2: { via: 'teacher', at: NOW - 9 * DAY } } },
  // (security review F1) a sister's NAMED automatic account with progress, in use on the family phone
  AUTD: { code: 'AUTD', displayName: 'Martina', avatar: 'latifa', classroomCode: null, classroomId: null, firstSeen: NOW - 7 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'seal', level: 'hsk2', ruta: { hsk2: { s: '1-30', at: NOW - DAY } } },
  // an empty nameless automatic account in use on a phone (nothing of anyone's): «Soy nuevo» takes it quietly
  AUTE: { code: 'AUTE', displayName: 'Dragoncito 815', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 2 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'key', autoName: true, level: 'hsk2' },
  // (F5) an unclaimed automatic account: its code + the key opens it only on its own phone
  AUTF: { code: 'AUTF', displayName: 'Dragoncito 916', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 3 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'key', autoName: true, level: 'yct1' },
};
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));

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
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = (ip) => ({ jar: {}, headers: { 'CF-Connecting-IP': ip || '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, extra || {}) });
const teacher = (code) => ({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(code)) });
const CODE6 = (c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c || '') && /[2-9]/.test(c);
const hola = async (ph) => (await get('/api/entrada/hola', as(ph))).json || {};
const crear = (ph, key, name, avatar, more) => post('/api/entrada/crear', Object.assign({ key, name, avatar }, more || {}), as(ph));
const entrar = (ph, code, key) => post('/api/entrada/entrar', { code, key }, as(ph));
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (_) { return {}; } };
const records = () => read('student-records.json');
const sock = (ph) => {
  const h = { 'CF-Connecting-IP': ph.headers['CF-Connecting-IP'] };
  if (Object.keys(ph.jar).length) h.Cookie = Object.entries(ph.jar).map(([k, v]) => k + '=' + v).join('; ');
  return io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, extraHeaders: h });
};
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});

let srv = null;
let allLog = '';
async function startServer(env) {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '1', DRALY_DORADO_SELF_SERVE: '' }, env || {}),
  });
  try { os.setPriority(srv.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000).split(SEED).join('<code>'));
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

const made = [];   // every code made here (the log must never show one)
const sockets = [];
async function run() {
  const sa = (((await get('/api/admin/teachers', teacher(SEED))).json || {}).teachers || []).find((t) => t.isSuperAdmin);
  ok(sa && sa.accessCodes.includes(NEWC), 'the made-up super admin is the one on the disk (no first-boot seed)');
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);

  // ── 1. «Soy nuevo» ──
  section('«Soy nuevo»: the key tells the level, the account is made');
  const A = phone();
  let r = await post('/api/entrada/clave', { key: KEYS.hsk2.toLowerCase().replace('-', ' ') }, as(A));
  ok(r.status === 200 && r.json.ok && r.json.level === 'newhsk1' && r.json.levelName === 'New HSK 1' && r.json.family === 'newhsk', 'clave: a right key (any case, a space for the dash) → «¡Tu nivel es New HSK 1!»');
  ok(!A.jar.dsim && !A.jar.dkid, '… a check only: no account, no session yet');
  r = await crear(A, KEYS.hsk2, 'Sofía', 'falcon');
  const accA = r.json && r.json.account;
  ok(r.status === 200 && r.json.ok && r.json.created === true && accA && CODE6(accA.code), '«Crear mi cuenta»: a new account, its code six characters with a digit');
  made.push(accA && accA.code);
  ok(accA && accA.name === 'Sofía' && accA.avatar === 'falcon' && accA.level === 'newhsk1' && accA.levelName === 'New HSK 1', '… the kid\'s name, avatar and the key\'s level');
  ok(A.jar.dsim && A.jar.dkid && A.jar.dlv_hsk2 && r.cookies.some((c) => /^dkid=/.test(c) && /HttpOnly/i.test(c)), '… the session, the phone\'s dkid (httpOnly) and the level open on the phone');
  await sleep(1300);
  const recA = records()[accA.code];
  ok(recA && recA.byKey > 0 && !recA.classroomCode && recA.level === 'hsk2' && recA.levelAccess && recA.levelAccess.hsk2 && recA.levelAccess.hsk2.via === 'key' && !recA.auto,
    'the record: byKey, no class code, level hsk2, the key saved on the account, never automatic');
  ok((await get('/api/ruta-dorada', as(A))).json.modules.find((m) => m.id === 'hsk2').open === true, 'La Ruta Dorada: New HSK 1 is open for this kid');
  r = await post('/api/entrada/vamos', {}, as(A));
  ok(r.json && r.json.ok && r.json.studentCode === accA.code && r.json.keyMode === true && !r.json.classroomCode && r.json.level === 'hsk2' && r.json.levelOpen === true && Array.isArray(r.json.assignments),
    '«¡Vamos!»: the portal\'s answer (keyMode, no class code, its level open)');
  // a name that is no name, no avatar
  ok((await crear(phone(), KEYS.hsk2, '12', 'falcon')).json.why === 'name' && (await crear(phone(), KEYS.hsk2, 'Ana', 'gojo')).json.why === 'avatar', 'a name with no letters, an avatar not of the saga: refused (nothing counted)');

  section('a wrong key: one uniform line, counted (5 a phone, then a wait)');
  const W = phone();
  const answers = [];
  for (let i = 0; i < 5; i++) answers.push(await post('/api/entrada/clave', { key: 'Nube-' + (10 + i) }, as(W)));
  ok(answers.every((x) => x.status === 401 && x.json.error === answers[0].json.error) && /Esa clave no es/.test(answers[0].json.error), 'five wrong keys: 401, the same line each time');
  r = await post('/api/entrada/clave', { key: KEYS.hsk2 }, as(W));
  ok(r.status === 429 && r.json.wait >= 1 && !r.json.level, '… then even the right key waits (429, minutes), the level not told');
  r = await crear(W, KEYS.hsk2, 'Sofía', 'falcon');
  ok(r.status === 429 && !W.jar.dsim, '… «Crear mi cuenta» waits too (the same counter)');
  ok((await post('/api/entrada/clave', { key: '' }, as(phone()))).status === 400, 'nothing typed: 400 (not counted)');
  r = await post('/api/entrada/clave', { key: 'PANDA-12' }, as(phone()));
  ok(r.status === 401, 'the screen\'s example key PANDA-12 is no key');

  // ── 2. «Ya tengo mi código» ──
  section('«Ya tengo mi código»: code + key on a new phone');
  const A2 = phone();
  r = await entrar(A2, accA.code.toLowerCase(), KEYS.hsk2);
  ok(r.status === 200 && r.json.ok && r.json.studentCode === accA.code && r.json.keyMode && A2.jar.dsim && A2.jar.dkid && A2.jar.dlv_hsk2, 'the code (any case) + the key: in, with its session, dkid and the level on this phone');
  const bad = [
    await entrar(phone(), accA.code, KEYS.yct1),          // a key of a level the account doesn't have
    await entrar(phone(), accA.code, 'Nube-77'),           // a wrong key
    await entrar(phone(), 'ZZ9ZZ9', KEYS.hsk2),            // a code that doesn't exist
    await entrar(phone(), 'AUTA', KEYS.hsk2),              // someone else's account, another level
    await entrar(phone(), 'AUTF', KEYS.yct1),              // (F5) an unclaimed automatic account, away from its phone
  ];
  ok(bad.every((x) => x.status === 401 && x.json.error === bad[0].json.error && !x.json.studentCode) && /El código o la clave no coinciden/.test(bad[0].json.error),
    'every wrong pair: the same 401 «El código o la clave no coinciden» (never which one, nor whether the code exists)');
  // (security review F3) a wrong CODE with a right key counts per phone (10), never on the old form's platform bucket
  const G = phone();
  for (let i = 0; i < 10; i++) await entrar(G, 'QQ' + (20 + i) + 'QQ', KEYS.hsk2);
  r = await entrar(G, accA.code, KEYS.hsk2);
  ok(r.status === 429 && !G.jar.dsim, 'ten wrong codes (with a right key) from a phone: then a wait, even for the right pair');
  r = await post('/api/homework/enter', { accessCode: NEWC, studentCode: 'OLDK' }, as(phone()));
  ok(r.json && r.json.ok, '… and the old form\'s logins never wait because of it');
  const GK = phone();
  for (let i = 0; i < 4; i++) await entrar(GK, accA.code, 'Nube-' + (30 + i));
  r = await entrar(GK, accA.code, KEYS.hsk2);
  ok(r.json && r.json.ok, 'four wrong KEYS (key guesses, never code guesses): the right pair still opens');
  for (let i = 0; i < 5; i++) await entrar(GK, accA.code, 'Nube-' + (40 + i));
  r = await entrar(GK, accA.code, KEYS.hsk2);
  ok(r.status === 429 && r.json.wait >= 1, '… five more: then the key screen\'s wait (5 per phone)');
  const FP = phone();
  FP.jar.dauto = autoCookie('AUTF', false, SEEDED.AUTF.firstSeen);
  r = await entrar(FP, 'AUTF', KEYS.yct1);
  ok(r.json && r.json.ok && r.json.studentCode === 'AUTF', '(F5) on ITS phone, the automatic account\'s code + key opens it (now the family\'s)');
  ok((await entrar(phone(), accA.code, '')).status === 400, 'a code without a key: 400, nothing opens');

  section('the code alone never opens (old form, homework doors)');
  const S1 = phone();
  r = await post('/api/homework/enter', { accessCode: NEWC, studentCode: accA.code }, as(S1));
  ok(r.json && r.json.ok === false && r.json.codeNotFound && !S1.jar.dsim, 'the old form with a class code + the key account\'s code: like a code that does not exist (no session)');
  r = await post('/api/homework/enter', { accessCode: NEWC, studentCode: accA.code, displayName: 'Intruso' }, as(S1));
  ok(r.json && r.json.ok && r.json.studentCode !== accA.code, '… with a name too: a new account, never this one');
  made.push(r.json && r.json.studentCode);
  r = await get('/api/homework/insights/' + accA.code + '?accessCode=' + NEWC, as(phone()));
  ok(r.status === 403, 'the parents\' view with a class code + the code: 403');
  r = await get('/api/homework/inbox?accessCode=' + NEWC + '&studentCode=' + accA.code, as(phone()));
  ok(r.status === 403, 'the inbox with a class code + the code: 403');
  r = await get('/api/homework/inbox?accessCode=&studentCode=' + accA.code, as(phone()));
  ok(r.status === 401, 'the inbox with no class code and no session: 401');
  r = await post('/api/level-access/session', { accessCode: NEWC, studentCode: accA.code }, as(phone()));
  ok(r.status >= 400 && !r.json.ok, 'the key screen\'s silent login with a class code + the code: refused');
  r = await post('/api/homework/avatar', { accessCode: NEWC, studentCode: accA.code, avatar: 'camel' }, as(phone()));
  ok(r.status === 403, 'an avatar change from another phone: 403');

  section('homework with the session (no class code)');
  r = await get('/api/homework/inbox?accessCode=&studentCode=' + accA.code, as(A));
  ok(r.status === 200 && r.json.ok, 'the inbox with the kid\'s own session and no class code: 200');
  r = await get('/api/homework/insights/' + accA.code + '?accessCode=', as(A));
  ok(r.status === 200 && r.json.ok, 'the parents\' view on the kid\'s own phone: 200');
  r = await post('/api/homework/avatar', { accessCode: '', studentCode: accA.code, avatar: 'camel' }, as(A));
  ok(r.json && r.json.ok, 'the kid changes their avatar (session)');
  r = await get('/api/homework/inbox?accessCode=&studentCode=OLDK', as(A));
  ok(r.status === 403, '… but never someone else\'s record with that session');
  r = await get('/api/homework/inbox?accessCode=' + String(10000 - Number(NEWC)).padStart(4, '7') + 'x&studentCode=' + accA.code, as(A));
  ok(r.status === 401, '… and a WRONG class code is still refused (only an empty one leans on the session)');
  r = await post('/api/homework/enter', { accessCode: '', displayName: 'Nadie' }, as(A));
  ok(r.status === 401 && !(r.json && r.json.studentCode), 'the old form\'s login never leans on a session (no class code: 401, nothing made)');
  r = await get('/api/homework/trainer/session/1/exp1?accessCode=', as(A));
  ok(r.status === 403 && /otro nivel/.test(r.json.error || ''), 'the HSK 1 trainer reads the session\'s level (New HSK 1: «otro nivel»)');

  // ── 3. the transitional door ──
  section('the transitional door: today\'s families');
  const O = phone();
  r = await post('/api/homework/enter', { accessCode: NEWC, studentCode: 'OLDK' }, as(O));
  ok(r.json && r.json.ok && r.json.studentCode === 'OLDK' && O.jar.dsim, 'an old class account with the old form: in, exactly as before (session)');
  const OH = phone();
  r = await post('/api/entrada/hola', { accessCode: NEWC, studentCode: 'OLDK' }, as(OH));
  ok(r.json && r.json.ok && r.json.kid && r.json.kid.name === 'Valeria Prueba' && r.json.kid.levelName === 'New HSK 1' && r.json.kid.how === 'codes' && !OH.jar.dsim,
    '«¡Hola de nuevo!» from the saved old codes: the kid\'s name and level, no session yet («¡Vamos!» logs in with them)');
  r = await post('/api/entrada/hola', { accessCode: YCTC, studentCode: 'OLDK' }, as(OH));
  ok(r.status === 401 && !r.json.kid, 'saved codes that no longer match (another class code): 401, nothing told');
  r = await post('/api/entrada/hola', { accessCode: NEWC, studentCode: accA.code }, as(OH));
  ok(r.status === 401, 'a key account\'s code with a class code: 401 there too');
  const OK4 = phone();
  r = await entrar(OK4, 'OLDK', KEYS.hsk2);
  ok(r.json && r.json.ok && r.json.studentCode === 'OLDK' && r.json.classroomCode === NEWC && r.json.keyMode === false && OK4.jar.dkid,
    'an old 4-character account with code + key: in (its own class code back for the old homework calls)');
  r = await entrar(phone(), 'OLDK', KEYS.yct1);
  ok(r.status === 401, '… never with the key of a level it doesn\'t have');

  // ── 4. «¡Hola de nuevo!»: only the phone's own kid ──
  section('«¡Hola de nuevo!»: only this phone\'s own kid');
  let h = await hola(A);
  ok(h.ok && h.kid && h.kid.name === 'Sofía' && h.kid.levelName === 'New HSK 1' && h.kid.avatar === 'camel' && !('code' in h.kid), 'phone A: its kid (name, avatar, level), never the code');
  delete A.jar.dsim;                                              // 12 h later
  h = await hola(A);
  ok(h.kid && h.kid.name === 'Sofía' && A.jar.dsim, '… 12 hours later: the phone still remembers (dkid renews the session)');
  delete A.jar.dsim;
  ok((await get('/api/ruta-dorada', as(A))).json.student === true && A.jar.dsim, '… and the session comes back by itself on La Ruta Dorada');
  h = await hola(phone());
  ok(h.ok && !h.kid && !h.parked && !h.auto && Array.isArray(h.levels) && h.levels.includes('New HSK 1'), 'a new phone: nobody (and the levels\' names for the key\'s hint)');
  const forged = phone();
  forged.jar.dkid = SimLock.sign('K', [accA.code, '0', '0'], 3600e3);
  ok(!(await hola(forged)).kid, 'a dkid naming the code with another firstSeen (a code handed out again): nobody');
  forged.jar.dkid = 'x' + A.jar.dkid;
  ok(!(await hola(forged)).kid, 'a dkid not signed by the server: nobody');

  // ── 5. the automatic account becomes the kid's ──
  section('«Soy nuevo» on a phone holding an automatic account');
  const P = phone();
  P.jar.dauto = autoCookie('AUTA', false, SEEDED.AUTA.firstSeen);
  h = await hola(P);
  ok(!h.kid && h.auto && h.auto.code === 'AUTA' && h.auto.placeholder, '«¡Hola de nuevo!» never greets «Dragoncito 512»: it goes to «¿Quién eres?» (the account is offered to «Soy nuevo»)');
  // (security review F1) an automatic account with progress is never taken without «¿Eres tú?» → «Sí, soy yo»
  r = await crear(P, KEYS.yct1, 'Mateo', 'oryx');
  ok(r.json && r.json.ok === false && r.json.why === 'parked' && r.json.account.code === 'AUTA' && !P.jar.dkid,
    '«Crear mi cuenta» on a phone whose automatic account has progress: «¿Eres tú?» first (nothing taken, nothing made)');
  r = await crear(P, KEYS.yct1, 'Mateo', 'oryx', { resume: true });
  ok(r.json && r.json.ok && r.json.converted === true && r.json.created === false && r.json.account.code === 'AUTA' && !P.jar.dauto && P.jar.dkid,
    '«Sí, soy yo»: it becomes THE kid\'s account: the same code, the device\'s dauto gone, dkid set');
  await sleep(1300);
  const a1 = records().AUTA;
  ok(a1 && !a1.auto && a1.wasAuto && a1.byKey && a1.displayName === 'Mateo' && a1.avatar === 'oryx' && !a1.autoName && a1.ruta && a1.ruta.yct1 && a1.ruta.yct1.s === '1-10',
    '… not automatic any more, the name and avatar, its seals kept (progress never split)');
  const Pk = phone();
  Pk.jar.dauto = autoCookie('AUTB', true, SEEDED.AUTB.firstSeen);    // parked («Salir»)
  h = await hola(Pk);
  ok(!h.kid && h.parked && h.parked.kind === 'auto' && h.parked.code === 'AUTB' && h.parked.progress.any, 'a PARKED automatic account: «¿Eres tú?» data, never greeted');
  r = await crear(Pk, KEYS.hsk2, 'Lucía', 'aileen');
  ok(r.json && r.json.ok === false && r.json.why === 'parked' && r.json.account.code === 'AUTB' && !Pk.jar.dsim, '«Crear mi cuenta» asks «¿Eres tú?» first (why: parked), nothing made');
  r = await crear(Pk, KEYS.hsk2, 'Lucía', 'aileen', { resume: true });
  ok(r.json && r.json.ok && r.json.converted && r.json.account.code === 'AUTB', '«Sí, soy yo» (resume): that account becomes Lucía\'s');
  const Pf = phone();
  Pf.jar.dauto = autoCookie('AUTC', true, SEEDED.AUTC.firstSeen);
  r = await crear(Pf, KEYS.hsk2, 'Tomás', 'plane', { fresh: true });
  ok(r.json && r.json.ok && r.json.created && r.json.account.code !== 'AUTC' && CODE6(r.json.account.code), '«No, soy otro alumno» (fresh): a new account, the parked one untouched');
  made.push(r.json && r.json.account && r.json.account.code);
  await sleep(1300);
  ok(records().AUTC && records().AUTC.auto, '… still automatic');
  // (F1) the family phone remembers the sister (Martina, a named automatic account): her brother taps «¿No eres tú?» →
  // «Soy nuevo» (the page sends fresh): a NEW account, Martina's untouched
  const Fam = phone();
  Fam.jar.dauto = autoCookie('AUTD', false, SEEDED.AUTD.firstSeen);
  h = await hola(Fam);
  ok(h.kid && h.kid.name === 'Martina' && !h.auto, 'the family phone greets the sister («¡Hola de nuevo!», Martina)');
  r = await crear(Fam, KEYS.hsk2, 'Bruno', 'adric', { fresh: true });
  ok(r.json && r.json.ok && r.json.created && r.json.account.code !== 'AUTD' && r.json.account.name === 'Bruno', '«¿No eres tú?» → «Soy nuevo»: a NEW account for the brother');
  made.push(r.json && r.json.account && r.json.account.code);
  await sleep(1300);
  const md = records().AUTD;
  ok(md && md.auto && md.displayName === 'Martina' && !md.byKey && md.ruta && md.ruta.hsk2.s === '1-30', '… the sister\'s account untouched (still hers, her progress, still automatic)');
  ok((await hola(Fam)).kid.name === 'Bruno', '… and the phone now greets the brother');
  r = await crear(phone(), KEYS.hsk2, 'Nadie', 'camel');
  made.push(r.json && r.json.account && r.json.account.code);
  const Fam2 = phone();
  Fam2.jar.dauto = autoCookie('AUTD', false, SEEDED.AUTD.firstSeen);
  r = await crear(Fam2, KEYS.hsk2, 'Bruno', 'adric');
  ok(r.json && r.json.ok === false && r.json.why === 'parked' && r.json.account.name === 'Martina', 'without fresh, a named automatic account is never taken: «¿Eres tú?» first');
  const Qt = phone();
  Qt.jar.dauto = autoCookie('AUTE', false, SEEDED.AUTE.firstSeen);
  r = await crear(Qt, KEYS.hsk2, 'Elena', 'aileen');
  ok(r.json && r.json.ok && r.json.converted && r.json.account.code === 'AUTE', 'an empty nameless automatic account in use on the phone: «Soy nuevo» takes it quietly (nothing of anyone\'s)');

  // ── 6. a teacher's PIN room ──
  section('a teacher\'s PIN room: the key account joins its teacher\'s class');
  const tch = (await post('/api/admin/teachers', { displayName: 'Profe Entrada ' + rnd(2), levels: ['hsk2', 'yct1'] }, teacher(SEED))).json.teacher;
  const tNew = tch.accessCodes.find((c) => tch.codeLevels[c] === 'hsk2');
  let roster = (await get('/api/admin/students', teacher(tch.teacherId))).json;
  ok(!roster.students.some((s) => s.code === accA.code), 'BEFORE: a regular teacher doesn\'t see the key kid');
  let sroster = (await get('/api/admin/students', teacher(SEED))).json;
  const rowA = sroster.students.find((s) => s.code === accA.code);
  ok(rowA && rowA.byKey === true && !rowA.classroomCode, '… the super admin does, with its «con clave» tag');
  const proj = phone('198.51.100.240');
  const hs = sock(proj); sockets.push(hs);
  const room = await emitAck(hs, 'host:create', { gameType: 'mochi-mash', password: tch.teacherId });
  ok(room && room.pin, 'the teacher opens a room');
  // a stranger who knows the code but holds nothing of the kid: never moves them into a class
  const stranger = sock(phone()); sockets.push(stranger);
  let j = await emitAck(stranger, 'player:join', { pin: room.pin, name: 'Otro', studentCode: accA.code });
  await sleep(1300);
  ok(j.ok && !records()[accA.code].classroomCode, 'a stranger joining with the kid\'s code (no cookies): no class code');
  const kidSock = sock(A); sockets.push(kidSock);
  j = await emitAck(kidSock, 'player:join', { pin: room.pin, name: 'Sofía', studentCode: accA.code });
  await sleep(1300);
  ok(j.ok && j.studentCode === accA.code && records()[accA.code].classroomCode === tNew, 'the kid\'s own phone joins: the account takes the teacher\'s New HSK 1 class code');
  roster = (await get('/api/admin/students', teacher(tch.teacherId))).json;
  ok(roster.students.some((s) => s.code === accA.code && s.classroomCode === tNew), 'AFTER: the teacher sees the kid in their New HSK 1 class (the «con clave» tag only shows without a class)');
  r = await post('/api/entrada/hola', { accessCode: tNew, studentCode: accA.code }, as(phone()));
  ok(r.status === 401, '… and still the class code + the code open nothing (a key account answers to code + key)');
  r = await post('/api/homework/enter', { accessCode: tNew, studentCode: accA.code }, as(phone()));
  ok(r.json && r.json.codeNotFound, '… not even at the old form');
  // an unclaimed automatic account in a PIN room: never tagged (M3)
  const AU = phone();
  AU.jar.dauto = autoCookie('AUTC', false, SEEDED.AUTC.firstSeen);
  await get('/api/ruta-dorada', as(AU));                            // its session from the device cookie
  const auSock = sock(AU); sockets.push(auSock);
  j = await emitAck(auSock, 'player:join', { pin: room.pin, name: 'Auto', studentCode: 'AUTC' });
  await sleep(1300);
  ok(j.ok && !records().AUTC.classroomCode, 'an unclaimed automatic account joining: never tagged (security review M3)');

  // ── 7. «Salir» ──
  section('«Salir», another kid on the phone');
  ok((await post('/api/homework/logout', {}, as(A))).json.ok && !A.jar.dsim && A.jar.dkid, '«Salir»: the session ends, the phone keeps the kid parked');
  h = await hola(A);
  ok(!h.kid && h.parked && h.parked.kind === 'key' && h.parked.name === 'Sofía' && h.parked.avatar === 'camel' && !('code' in h.parked),
    '… «¡Hola de nuevo!» never shows that kid by itself (parked: «¿Eres tú?» with name + avatar, NEVER the code: F4)');
  ok(!(await get('/api/ruta-dorada', as(A))).json.student && !A.jar.dsim, '… no session comes back by itself');
  r = await post('/api/entrada/vamos', {}, as(A));
  ok(r.status === 401 && r.json.why === 'none', '… «¡Vamos!» has nobody to open');
  r = await entrar(A, accA.code, KEYS.hsk2);
  ok(r.json && r.json.ok && A.jar.dsim && (await hola(A)).kid, 'code + key: the kid is back (remembered again)');
  // a sister logs in at the old form on this phone: the remembered kid rests
  r = await post('/api/homework/enter', { accessCode: NEWC, studentCode: 'OLDK' }, as(A));
  ok(r.json && r.json.ok && (await hola(A)).kid.name === 'Valeria Prueba', 'another kid\'s login on the phone: «¡Hola de nuevo!» is that kid now');
  await post('/api/homework/logout', {}, as(A));
  h = await hola(A);
  ok(!h.kid && h.parked && h.parked.name === 'Sofía' && !('code' in h.parked), '… and after her «Salir», the first kid is still parked (never logged in by itself)');

  // ── 8. «Abrir otro nivel» ──
  section('«Abrir otro nivel»');
  r = await post('/api/entrada/nivel', { key: KEYS.yct1 }, as(phone()));
  ok(r.status === 401 && r.json.why === 'login', 'without a session: 401');
  r = await post('/api/entrada/nivel', { key: 'Nube-90' }, as(A2));
  ok(r.status === 401 && /Esa clave no es/.test(r.json.error), 'a wrong key: the uniform line');
  r = await post('/api/entrada/nivel', { key: KEYS.hsk1 }, as(A2));
  ok(r.json && r.json.ok && r.json.moved && r.json.levelName === 'HSK 1' && A2.jar.dlv_hsk1, 'a new level\'s key: open on the account and the phone, the kid moves up');
  await sleep(1300);
  const ra = records()[accA.code];
  ok(ra.level === 'hsk1' && ra.levelAccess.hsk1.via === 'key' && ra.levelAccess.hsk2, '… the old level stays theirs');
  r = await post('/api/entrada/vamos', {}, as(A2));
  ok(r.json && r.json.level === 'hsk1' && r.json.levelOpen, '«¡Vamos!»: the home in the new level');
  r = await entrar(phone(), accA.code, KEYS.hsk2);
  ok(r.json && r.json.ok, 'the old level\'s key still opens the account on a new phone');

  // ── 9. limits, other sites ──
  section('limits, other sites');
  for (const p of ['/api/entrada/clave', '/api/entrada/crear', '/api/entrada/entrar', '/api/entrada/vamos', '/api/entrada/nivel', '/api/entrada/hola']) {
    r = await post(p, { key: KEYS.hsk2, name: 'Ana', avatar: 'camel', code: accA.code }, as(phone(), { Origin: 'https://evil.example' }));
    ok(r.status === 403, p + ' from another site: 403');
  }
  const R = phone();
  const outs = [];
  for (let i = 0; i < 6; i++) { outs.push(await crear(R, KEYS.yct1, 'Hermano ' + 'ABCDEF'[i], 'camel')); }
  ok(outs.slice(0, 5).every((x) => x.json && x.json.ok) && outs[5].status === 429, 'five new accounts a day on one phone (brothers and sisters), then a wait');
  outs.forEach((x) => made.push(x.json && x.json.account && x.json.account.code));
  await sleep(1300);
  ok(Object.values(records()).every((x) => x.displayName !== 'Anon' || !x.byKey), 'never «Anon»');

  // ── 9b. security review F2: a remembered phone can be closed ──
  section('a leaked key: «Cambiar» + «Cerrar en todos los aparatos» → the remembered phone asks the NEW key only');
  const P2 = phone();
  r = await crear(P2, KEYS.hsk2, 'Gael', 'falcon');
  const k2 = r.json && r.json.account;
  ok(k2 && CODE6(k2.code), 'a new kid on phone P2 (New HSK 1)');
  made.push(k2 && k2.code);
  const P3 = phone();
  ok((await entrar(P3, k2.code, KEYS.hsk2)).json.ok, '… and the same kid on a second phone P3 (code + key)');
  const oldKey = KEYS.hsk2;
  KEYS.hsk2 = 'Estrella-' + (10 + crypto.randomInt(89));
  ok((await put('/api/admin/level-keys/hsk2', { key: KEYS.hsk2 }, teacher(SEED))).json.ok, 'the super admin changes the New HSK 1 key');
  ok((await post('/api/admin/level-keys/hsk2/close-devices', {}, teacher(SEED))).json.ok, '… and closes it on every device');
  delete P2.jar.dsim;                                             // (the 12 h session ends: no renewal now)
  h = await hola(P2);
  ok(!h.kid && h.relock && h.relock.name === 'Gael' && !('code' in h.relock), 'phone P2: «Este teléfono te recuerda: escribe la clave nueva» (relock, name only)');
  ok(!(await get('/api/ruta-dorada', as(P2))).json.student && !P2.jar.dsim, '… no session comes back from the old dkid');
  ok((await post('/api/entrada/vamos', {}, as(P2))).status === 401, '… «¡Vamos!» opens nothing');
  r = await post('/api/entrada/reabrir', { key: oldKey }, as(P2));
  ok(r.status === 401 && /Esa clave no es/.test(r.json.error), '… the OLD key: the uniform «Esa clave no es»');
  r = await post('/api/entrada/reabrir', { key: KEYS.yct1 }, as(P2));
  ok(r.status === 401 && /Esa clave no es/.test(r.json.error), '… a key of a level the kid doesn\'t have: the same line');
  r = await post('/api/entrada/reabrir', { key: KEYS.hsk2 }, as(P2));
  ok(r.json && r.json.ok && r.json.studentCode === k2.code && r.json.levelOpen && P2.jar.dsim, '… the NEW key alone: in again (no code to type), the level open');
  ok((await hola(P2)).kid, '… and remembered again');
  ok((await post('/api/entrada/reabrir', { key: KEYS.hsk2 }, as(phone()))).status === 401, 'a phone that remembers nobody: /reabrir opens nothing');
  delete A2.jar.dsim;
  ok((await hola(A2)).kid, 'a kid of another level (HSK 1) is never asked: their phone still remembers them');

  section('a lost phone: «Cerrar su sesión en todos los teléfonos» (/maestro, super admin)');
  ok((await post('/api/admin/student/' + k2.code + '/close-sessions', {}, teacher(tch.teacherId))).status === 403, 'a regular teacher: 403');
  r = await post('/api/admin/student/' + k2.code + '/close-sessions', {}, teacher(SEED));
  ok(r.json && r.json.ok && r.json.kidGen === 1, 'the super admin closes the kid\'s sessions');
  ok(P2.jar.dsim && !(await get('/api/ruta-dorada', as(P2))).json.student, 'phone P2: its open session stops AT ONCE');
  r = await get('/api/homework/inbox?accessCode=&studentCode=' + k2.code, as(P2));
  ok(r.status === 401 || r.status === 403, '… the homework calls too (' + r.status + ')');
  h = await hola(P2);
  ok(!h.kid && !h.relock && h.parked && h.parked.kind === 'key' && !('code' in h.parked), '… «¡Hola de nuevo!» never shows the kid (like parked: code + key)');
  ok((await post('/api/entrada/vamos', {}, as(P3))).status === 401 && !(await hola(P3)).kid, 'phone P3 too');
  ok((await post('/api/entrada/reabrir', { key: KEYS.hsk2 }, as(P3))).status === 401, '… and the key alone never brings it back');
  r = await entrar(P2, k2.code, KEYS.hsk2);
  ok(r.json && r.json.ok && (await hola(P2)).kid, 'code + key: the kid is back on their phone');

  // ── 10. the pages ──
  section('the pages');
  const html = fs.readFileSync(path.join(ROOT, 'public', 'homework.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'entrada.js'), 'utf8');
  const dict = fs.readFileSync(path.join(ROOT, 'public', 'js', 'hw-i18n.js'), 'utf8');
  ok(/\/js\/entrada\.js\?v=\w+/.test(html) && /\/css\/entrada\.css\?v=\w+/.test(html) && /id="en-root"/.test(html), 'homework.html loads the entrance (with ?v=) and keeps the old card as the door');
  ok(/TRANSITIONAL/.test(html) && /TRANSITIONAL/.test(js), 'the old form is marked transitional in the page and the code');
  const states = ['hola', 'quien', 'clave', 'nivel', 'codigo', 'tengo'];
  ok(states.every((s) => new RegExp('function view' + s[0].toUpperCase() + s.slice(1) + '\\(').test(js)), 'every state of the design is drawn (' + states.join(' · ') + ')');
  // every Spanish line the entrance writes has its English (hw-i18n.js)
  const lines = ['Mi Dralingo', '¡Hola de nuevo!', 'Este teléfono te recuerda: no tienes que escribir nada.', '¿No eres tú?', '¿Quién eres?', 'Ya tengo mi código',
    'El que anoté en mi cuaderno', 'Soy nuevo', 'Solo necesito la clave de mi nivel', '¿Tu profe te dio un código de 4 números?', 'Entra aquí',
    'Escribe la clave de tu nivel', 'Está en el mensaje de WhatsApp de tu profe.', 'La clave', 'Seguir', '¡Tu nivel es', 'Elige tu avatar', 'Crear mi cuenta',
    '¡Ya tienes tu cuenta!', 'Tu código de alumno es:', 'Copiar mi código', 'Entra con tu código', 'Tu código de alumno', 'El de tu cuaderno',
    'La clave de tu nivel', 'El del mensaje de tu profe', '¿Salir de tu cuenta en este teléfono?', 'No, quedarme', 'Sí, salir', 'Antes de seguir',
    'Este teléfono te recuerda: escribe la clave nueva de tu nivel.'];
  const missing = lines.filter((l) => !js.includes(l) || !dict.includes("'" + l.replace(/'/g, "\\'") + "'"));
  ok(!missing.length, 'every line has its English in hw-i18n.js' + (missing.length ? ' (missing: ' + missing.join(' | ') + ')' : ''));
  ok(/Experiencia \(\\d\+\)/.test(dict) && /La clave dice tu nivel/.test(dict), '… the lines built from a template too (patterns)');
  const ph = [...js.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]);
  ok(ph.length >= 4 && ph.every((p) => !/[A-Z0-9]{3,}/.test(p)), 'placeholders are words or dots, never a code (' + ph.join(' | ') + ')');
  // (security review F1, F4, L4, L5: in the pages)
  const hw = fs.readFileSync(path.join(ROOT, 'public', 'js', 'homework.js'), 'utf8');
  const rajs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'ruta-auto.js'), 'utf8');
  const sv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  ok(/if \(keyKid\) \{ try \{ localStorage\.removeItem\(STORAGE_CODE_KEY\)/.test(hw), '«Salir» forgets the code on a key kid\'s phone (F4)');
  ok(/\.then\(leave, leave\)/.test(hw) && /setTimeout\(leave, 1500\)/.test(hw), '«Salir» waits for the logout (1.5 s at most) before leaving (L4)');
  ok(/acc\.code \? '<span>código/.test(rajs), '«¿Eres tú?» shows a code only when there is one (F4)');
  ok(/S\.answer = 'fresh'/.test(js) && /body\.fresh = true/.test(js), '«¿No eres tú?» → «Soy nuevo» sends fresh (F1)');
  ok(/_hwCheckAccess\(req, res, \{ classCodeOnly: true \}\)/.test(sv) && !/req\.path !== '\/api\/homework\/enter'/.test(sv), 'the old form\'s login asks for a real class code by a flag, not by its path (L5)');
}

(async () => {
  let crashed = false;
  await startServer();
  try { await run(); } catch (e) { crashed = true; failed++; say('  ✖ crashed: ' + (e && e.stack || e)); }
  sockets.forEach((s) => { try { s.close(); } catch (_) {} });
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
    ok(!made.filter(Boolean).some((c) => new RegExp('\\b' + c + '\\b').test(allLog)), 'no account\'s code in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  say(failed ? `test-entrada: ${failed} FAILED, ${passed} passed` : `test-entrada: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
