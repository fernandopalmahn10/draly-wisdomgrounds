#!/usr/bin/env node
// test-auto-account.js — the automatic student account (2026-10-18, his words: "make the system automatically give them an
// account… they automatically should keep that code forever… Are you sure you are not this student?"). Its OWN server
// (port 4460, never 3000) on a temporary data folder with MADE-UP accounts, throw-away teacher codes and level keys that
// are never printed. Never data/, never the live site. Checks (server.js «AUTOMATIC STUDENT ACCOUNTS»):
//   · no account on page views (a visitor, a link preview, a whole class opening the link, a phone typing the key alone)
//   · an account on each first real step (key · seal · train · tarea), the same shape and code as a /homework login,
//     auto: true, the module's level, no class code; never for a teacher, a logged-in kid or a page of another site
//   · one per phone: the session comes back from the device cookie (a reload, 12 h later), «Salir» parks it, a later step
//     resumes it, never a second one; a page view never wakes an archived one, a real step does
//   · the code is kept (/api/ruta/me), the name is saved (and refused when it is not a name), never «Anon»
//   · «¿Eres tú?»: the counts of the phone's account; the claim by a class code; the merge (union of seals and marks, the
//     best % per world, the typed account's exam tries / levels / teacher data untouched, the automatic one archived),
//     refused without BOTH proofs
//   · the rate limits (30 an hour per address, 3 a day per device); the roster's «automática» (super admin only)
//   node scripts/test-auto-account.js            (--port 4460 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4460));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'audios', 'catalog.json'), 'utf8'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round)).map((h) => h.id);
const NEW = hwOf('newhsk1');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-auto-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };
// the test signs device cookies with the server's key (the same SIM_LOCK_SECRET): the seeded accounts below
process.env.SIM_LOCK_SECRET = SECRET;
const SimLock = require('../core/sim-lock');
// (the device cookie names the account's firstSeen too: a code handed out again never answers to an old cookie)
const autoCookie = (code, parked, born) => SimLock.sign('A', [code, parked ? '1' : '0', String(born || 0)], 3600e3);

// made-up accounts seeded before the boot: an automatic one with progress (AUTA), a class kid with their own progress,
// tries and teacher data (REAL), an old automatic one with nothing (resting in the archive, OLDA)
const NOW = Date.now(), DAY = 86400e3;
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 3 * DAY }));
const REAL_TRIES = [{ simId: 'newhsk1-sim1', score: 150, total: 200, percent: 75, ts: NOW - 2 * DAY, answeredCount: 40, questions: 40, wrongQs: [3, 9] }];
const SEEDED = {
  AUTA: { code: 'AUTA', displayName: 'Dragoncito 512', avatar: null, classroomCode: null, classroomId: null, firstSeen: NOW - 5 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], auto: true, autoStep: 'seal', autoName: true, level: 'hsk2',
    ruta: { hsk2: { s: '1-10,40', at: NOW - DAY, p: { 1: 85, 2: 40, pinyin: 90 } } },
    tareas: { [NEW[0]]: { h: NOW - DAY, s: NOW - DAY }, [NEW[1]]: { h: NOW - DAY } },
    hskResults: [{ simId: 'newhsk1-sim2', score: 100, total: 200, percent: 50, ts: NOW - DAY, answeredCount: 40, questions: 40, wrongQs: [1] }] },
  REAL: { code: 'REAL', displayName: 'Valeria Prueba', avatar: 'dralingo', classroomCode: '1002', classroomId: null, firstSeen: NOW - 90 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: 'hsk2', levelAccess: { hsk2: { via: 'teacher', at: NOW - 9 * DAY } },
    ruta: { hsk2: { s: '5-20', at: NOW - DAY, p: { 1: 60, 2: 90 }, td: 1 } },
    tareas: { [NEW[1]]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY } }, hskResults: REAL_TRIES },
};
const ARCHIVED = {
  OLDA: { code: 'OLDA', displayName: 'Dragoncito 303', avatar: null, classroomCode: null, firstSeen: NOW - 50 * DAY, lastSeen: NOW - 50 * DAY,
    sentencesBuilt: [], auto: true, autoStep: 'key', autoName: true, level: 'yct1' },
};
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));
fs.writeFileSync(path.join(DATA, 'student-archive.json'), JSON.stringify(ARCHIVED));

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
const ruta = async (ph) => { const r = await get('/api/ruta-dorada', as(ph)); return Object.assign(r.json || {}, { _r: r }); };
const me = async (ph) => ((await get('/api/ruta/me', as(ph))).json || {}).account;
// (a homework mark's step needs a device the platform has seen: the page's /api/ruta-dorada gives it its dkd first)
const seen = async (ph) => { if (!ph.jar.dkd) await get('/api/ruta-dorada', as(ph)); };
const auto = async (ph, level, step, id, extra, more) => {
  if (step === 'tarea') await seen(ph);
  return post('/api/ruta/auto', Object.assign({ level, step, id }, more || {}), as(ph, extra));
};
const CODE6 = (c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c || '') && /[2-9]/.test(c);
const typeKey = (ph, level) => post('/api/level-key', { level, key: KEYS[level] }, as(ph));
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (_) { return {}; } };
const records = () => read('student-records.json');
const autoCodes = () => Object.values(records()).filter((r) => r && r.auto).map((r) => r.code);
const PLACEHOLDER = /^Dragoncito \d{3}$/;

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '1', DRALY_DORADO_SELF_SERVE: '' }),
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

const made = [];   // every automatic code made here (the log must never show one)
async function run() {
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);

  // ── 1. page views make nothing ──
  section('no account on page views');
  const before = Object.keys(records()).length;
  const visitor = phone();
  for (const p of ['/audios', '/audios/', '/audios/yct1', '/audios/newhsk1', '/audios/' + NEW[0], '/audios/yct1-base', '/audios/yct1/entrenamiento', '/api/ruta-dorada', '/api/ruta/me', '/homework.html']) {
    await get(p, as(visitor));
  }
  ok(!visitor.jar.dsim && !visitor.jar.dauto, 'a visitor browsing every page gets no session and no device account');
  ok((await me(visitor)) === null, '… /api/ruta/me: no account');
  const preview = await get('/audios/yct1', { headers: { 'User-Agent': 'WhatsApp/2.23 (link preview)', 'CF-Connecting-IP': '198.51.100.200' } });
  ok(preview.status === 200 && !(preview.headers['set-cookie'] || []).some((c) => /^(dsim|dauto)=/.test(c)), 'a link preview: the page, no account');
  for (let i = 0; i < 30; i++) await get('/api/ruta-dorada', { jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.201' } });
  ok((await get('/api/ruta/auto', as(visitor))).status === 404, 'nothing makes an account on a GET');
  const keyOnly = phone();
  ok((await typeKey(keyOnly, 'yct1')).json.ok && !keyOnly.jar.dsim && !keyOnly.jar.dauto, 'a phone typing the key (the API alone): no account (the key screen asks for it, below)');
  await sleep(1300);
  ok(Object.keys(records()).length === before, 'thirty phones of a class opening the link: still no new record');

  // ── 2. each first step ──
  section('an account on each first real step');
  const K = phone();
  ok((await typeKey(K, 'yct1')).json.ok, 'phone K types the YCT 1 key');
  let r = await auto(K, 'yct1', 'key');
  const accK = r.json && r.json.account;
  ok(r.status === 200 && r.json.ok && r.json.created === true && accK && CODE6(accK.code), "'key': a new account, its code six characters with a digit (" + (accK && accK.code.length) + ')');
  made.push(accK && accK.code);
  ok(accK && PLACEHOLDER.test(accK.name) && accK.placeholder === true && accK.auto === true && accK.level === 'yct1' && accK.levelName === 'YCT 1',
    '… its friendly placeholder name («' + (accK && accK.name) + '»), its level (the key\'s)');
  ok(accK && !accK.name.includes(accK.code), '… the name never holds the code');
  ok(K.jar.dsim && K.jar.dauto && r.cookies.some((c) => /^draly_auto_new=1/.test(c) && !/HttpOnly/i.test(c)) && r.cookies.some((c) => /^dauto=/.test(c) && /HttpOnly/i.test(c)),
    '… the same session as a login (dsim), the device cookie (httpOnly) and the card\'s flag (readable)');
  ok(/no-store/.test(r.headers['cache-control'] || ''), '… never cached');
  await sleep(1300);
  const recK = records()[accK.code];
  const shape = Object.keys((await (async () => { const ph = phone(); const e = await enter(ph, '1003', 'Forma ' + rnd(2)); await sleep(1300); return records()[e.studentCode]; })()) || {});
  ok(recK && recK.auto === true && recK.autoStep === 'key' && recK.autoName === true && recK.level === 'yct1' && !recK.classroomCode && recK.displayName === accK.name,
    'the record: auto, autoStep key, the placeholder, level yct1, no class code');
  ok(recK && ['code', 'displayName', 'avatar', 'classroomCode', 'classroomId', 'firstSeen', 'lastSeen', 'sentencesBuilt'].every((k) => k in recK) &&
    ['code', 'displayName', 'firstSeen', 'lastSeen', 'sentencesBuilt'].every((k) => shape.includes(k)), '… the same shape as a /homework account');
  const st = await ruta(K);
  ok(st.student && st.me && st.me.code === accK.code && st.me.auto && st.home === 'yct1', 'the route sees the kid (me = the code, home = YCT 1)');
  ok((await post('/api/ruta/tareas', { heard: [NEW[0]] }, as(K))).json.ok === true, '… and the account takes its homework marks');

  const S = phone();
  await typeKey(S, 'hsk2');
  ok((await get('/api/ruta/seals?level=hsk2', as(S))).json.student === false, 'phone S: key only, its seals stay on the phone (student: false)');
  r = await auto(S, 'newhsk1', 'seal');
  ok(r.json && r.json.created && r.json.account.level === 'newhsk1', "'seal': a new account (New HSK 1, by its curriculum name)");
  made.push(r.json && r.json.account && r.json.account.code);
  const sealsS = await get('/api/ruta/seals?level=hsk2', as(S));
  ok(sealsS.json.student === true && sealsS.json.who === r.json.account.who, '… the seals now go to the account (the phone\'s join through /api/ruta/seals)');
  ok((await post('/api/ruta/seals', { level: 'hsk2', add: [1, 2, 3], who: sealsS.json.who }, as(S))).json.ok, '… the first seals are saved on it');

  const Tr = phone();
  await typeKey(Tr, 'hsk1');
  r = await auto(Tr, 'hsk1', 'train');
  ok(r.json && r.json.created && r.json.account.level === 'hsk1', "'train': a new account");
  made.push(r.json && r.json.account && r.json.account.code);
  // (2026-10-18, his words: "whenever I finish a practice on the training it's not recorded") the page asks for the account
  // AND starts the round with the same tap: the round starts as the phone's (no session yet), the account arrives
  // mid-round. The round that made the account counts ON it, never as a phone's score.
  const TR = phone();
  await seen(TR);
  await typeKey(TR, 'yct1');
  const rr0 = await post('/api/ruta/train/round', { level: 'yct1', world: 'familia', s: '1-17' }, as(TR));
  ok(rr0.json && rr0.json.ok && !TR.jar.dsim, 'the first «¡A jugar!»: the round starts on the phone (no account yet)');
  r = await auto(TR, 'yct1', 'train');
  ok(r.json && r.json.created && TR.jar.dsim, '… the same tap makes the automatic account (its session arrives mid-round)');
  made.push(r.json && r.json.account && r.json.account.code);
  for (const q of (rr0.json && rr0.json.questions) || []) await post('/api/ruta/train/answer', { round: rr0.json.round, i: q.i, chosen: q.answers[0] }, as(TR));
  const fin0 = (await post('/api/ruta/train/finish', { round: rr0.json && rr0.json.round }, as(TR))).json || {};
  ok(fin0.ok && fin0.saved === true && !fin0.phone && !fin0.proof && fin0.best === fin0.pct, 'that round counts ON the new account (saved, its best = its %), never as a phone score (' + fin0.pct + ' %)');
  const tv0 = (await get('/api/ruta/train?level=yct1&s=1-17', as(TR))).json || {};
  const fam0 = (tv0.worlds || []).find((w) => w.key === 'familia');
  ok(tv0.student && fam0 && fam0.best === fin0.pct, '… El Entrenamiento shows it on the world\'s tile (the account\'s best)');
  const mt0 = ((await ruta(TR)).modules || []).find((m) => m.id === 'yct1');
  ok(mt0 && mt0.train && mt0.train.worlds.find((w) => w.key === 'familia').best === fin0.pct, '… and the route (card 2 of the module page) counts it');
  ok(((await me(TR)) || {}).progress.worlds === 1, '… «¿Eres tú?» counts it as a world practised on that account');

  const H = phone();
  r = await auto(H, 'newhsk1', 'tarea', NEW[0]);
  ok(r.json && r.json.created && r.json.account.level === 'newhsk1', "'tarea': a new account with no key (the homework audios are open)");
  made.push(r.json && r.json.account && r.json.account.code);
  ok((await post('/api/ruta/tareas', { sent: [NEW[0]] }, as(H))).json.ok, '… its «¡Ya la mandé!» lands on it');
  const bare = phone();
  r = await post('/api/ruta/auto', { level: 'newhsk1', step: 'tarea', id: NEW[0] }, as(bare));
  ok(r.status === 403 && r.json.why === 'device' && !bare.jar.dauto, "'tarea' from a device never seen (a bare POST, no page): refused");
  ok(Object.values(records()).filter((x) => x.auto).every((x) => x.code.length === 6 || ['AUTA', 'OLDA'].includes(x.code)), 'every new automatic code has six characters');
  const H2 = phone();
  ok((await auto(H2, null, 'tarea', NEW[1])).json.account.level === 'newhsk1', "'tarea' without a level: the homework's own level");
  made.push((await me(H2)).code);
  ok((await auto(phone(), 'yct1', 'tarea', 'zz-not-a-homework')).status === 400 && (await auto(phone(), 'yct1', 'nap')).status === 400 && (await auto(phone(), 'zz9', 'key')).status === 400,
    'an unknown homework, step or level: 400');
  const noKey = phone();
  r = await auto(noKey, 'yct1', 'seal');
  ok(r.status === 401 && r.json.why === 'key' && !noKey.jar.dauto, "'seal' / 'key' / 'train' without the level's key: 401, nothing made");
  r = await auto({ jar: {}, headers: teacher(SEED).headers }, 'yct1', 'key');
  ok(r.json && r.json.ok === false && r.json.why === 'teacher', 'a teacher: never an automatic account');
  const L = phone();
  const kidL = await enter(L, '1002', 'Clase ' + rnd(2));
  r = await auto(L, 'newhsk1', 'tarea', NEW[0]);
  ok(r.json.ok && r.json.created === false && r.json.account.code === kidL.studentCode && !L.jar.dauto, 'a kid logged in at /homework: their own account, nothing new');
  r = await auto(phone(), 'newhsk1', 'tarea', NEW[0], { Origin: 'https://evil.example' });
  ok(r.status === 403 && r.json.why === 'site', 'a page of another site: refused');
  r = await auto(phone(), 'newhsk1', 'tarea', NEW[0], { 'Sec-Fetch-Site': 'cross-site' });
  ok(r.status === 403, '… also when the browser says cross-site');
  r = await auto(phone(), 'newhsk1', 'tarea', NEW[0], { Origin: 'http://127.0.0.1:' + PORT, 'Sec-Fetch-Site': 'same-origin' });
  ok(r.json && r.json.created, 'our own page (same origin): made');
  made.push(r.json && r.json.account && r.json.account.code);

  // ── 3. one per phone, kept ──
  section('one per phone, the code kept');
  r = await auto(K, 'yct1', 'seal');
  ok(r.json.ok && r.json.created === false && r.json.account.code === accK.code, 'phone K again: the same account');
  delete K.jar.dsim;                                           // 12 h later (the session cookie is gone)
  const st2 = await ruta(K);
  ok(st2.student && st2.me && st2.me.code === accK.code && K.jar.dsim, 'the session comes back from the device cookie (a reload, a new tab, the app)');
  delete K.jar.dsim;
  ok((await me(K)).code === accK.code && K.jar.dsim, '/api/ruta/me: the same code');
  delete K.jar.dsim;
  r = await auto(K, 'yct1', 'train');
  ok(r.json.ok && !r.json.created && r.json.account.code === accK.code, 'a step without the session: the same account, never a second one');
  await sleep(1300);
  const lastSeenK = records()[accK.code].lastSeen;
  for (let i = 0; i < 3; i++) { delete K.jar.dsim; await ruta(K); }
  await sleep(1300);
  ok(records()[accK.code].lastSeen === lastSeenK, 'page views (and renewals) never count as activity');
  // «Salir» at /homework: parked
  ok((await post('/api/homework/logout', {}, as(K))).json.ok && !K.jar.dsim && K.jar.dauto, '«Salir»: the session ends, the device keeps its account (parked)');
  ok(!(await ruta(K)).student && !K.jar.dsim, '… page views no longer log it in');
  const parked = await me(K);
  ok(parked && parked.code === accK.code && parked.session === false && parked.parked === true, '… /api/ruta/me still knows it (for «¿Eres tú?»)');
  // (security review M2: a sister on the same phone after «Salir»: a step never brings the parked account back by itself)
  const parkedCookie = K.jar.dauto;
  r = await auto(K, 'yct1', 'seal');
  ok(r.json.ok === false && r.json.why === 'parked' && r.json.account && r.json.account.code === accK.code && r.json.account.progress && !K.jar.dsim,
    'a step after «Salir»: «¿Eres tú?» data (why: parked, the code and its progress), no session');
  ok(K.jar.dauto === parkedCookie && !(await ruta(K)).student, '… the account stays parked (nothing written on it, no login)');
  r = await post('/api/ruta/auto/resume', {}, as(K, { Origin: 'https://evil.example' }));
  ok(r.status === 403, '«Sí, soy yo» from another site: refused');
  r = await post('/api/ruta/auto/resume', {}, as(K));
  ok(r.json.ok && r.json.resumed === true && r.json.account.code === accK.code && K.jar.dsim, '«Sí, soy yo» (POST /api/ruta/auto/resume): the same account comes back, not a new one');
  ok((await ruta(K)).student, '… and stays (renewed again)');
  ok(autoCodes().filter((c) => c === accK.code).length === 1, 'still one account for phone K');
  ok((await post('/api/ruta/auto/resume', {}, as(phone()))).status === 403, 'a phone holding no automatic account resumes nothing');
  // «No, soy otro alumno»: the step stays on the phone; the next step asks for a new account for the sister (fresh)
  const SIS = phone();
  await typeKey(SIS, 'yct1');
  r = await auto(SIS, 'yct1', 'seal');
  const accA = r.json.account;
  made.push(accA && accA.code);
  await post('/api/homework/logout', {}, as(SIS));
  r = await auto(SIS, 'yct1', 'seal');
  ok(r.json.why === 'parked' && r.json.account.code === accA.code, 'phone SIS: kid A, then «Salir»: the next step asks «¿Eres tú?»');
  r = await auto(SIS, 'yct1', 'seal', null, null, { fresh: true });
  const accB = r.json && r.json.account;
  ok(r.json.ok && r.json.created && accB && accB.code !== accA.code && SIS.jar.dsim, '«No, soy otro alumno», then a step: a new account for the sister (fresh)');
  made.push(accB && accB.code);
  ok((await me(SIS)).code === accB.code, '… which is this phone\'s account from now on');
  await sleep(1300);
  ok(records()[accA.code] && records()[accA.code].auto, '… kid A\'s account is untouched (its code still works where it is held, or with a class code)');

  // an archived automatic account: a page view never wakes it, a real step does
  const O = phone();
  O.jar.dauto = autoCookie('OLDA', false, ARCHIVED.OLDA.firstSeen);
  ok(!(await ruta(O)).student && !O.jar.dsim, 'an archived automatic account: a page view does not log it in');
  await sleep(1300);
  ok(!records().OLDA && read('student-archive.json').OLDA, '… nor brings it back from the archive');
  ok((await me(O)) && (await me(O)).archived === true, '… /api/ruta/me knows it rests in the archive');
  r = await auto(O, 'yct1', 'tarea', NEW[0]);
  ok(r.json.ok && r.json.resumed && r.json.account.code === 'OLDA', 'a real step: it comes back (restored), still the same code');
  await sleep(1300);
  ok(records().OLDA && records().OLDA.restoredAt > 0, '… restored from the archive');

  // a forged device cookie
  const F = phone();
  F.jar.dauto = autoCookie('AUTA', false, SEEDED.AUTA.firstSeen).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  ok(!(await ruta(F)).student && (await me(F)) === null, 'a forged device cookie: nothing');
  // (L2) a well-signed cookie for the same code but another account (a code handed out again): nothing either
  const F2 = phone();
  F2.jar.dauto = autoCookie('AUTA', false, SEEDED.AUTA.firstSeen + 1);
  ok(!(await ruta(F2)).student && (await me(F2)) === null && (await post('/api/ruta/auto/resume', {}, as(F2))).status === 403, 'a cookie of the same code but another account (its firstSeen): nothing');

  // ── 4. the name ──
  section('the name');
  r = await post('/api/ruta/me/name', { name: '  Ana   María ' }, as(K));
  ok(r.json.ok && r.json.account.name === 'Ana María' && r.json.account.placeholder === false, 'the kid\'s name is saved (spaces tidied)');
  await sleep(1300);
  ok(records()[accK.code].displayName === 'Ana María' && !records()[accK.code].autoName, '… on the record, the placeholder gone for good');
  for (const bad of ['', 'x', 'Anon', 'anonimo', '1234', '<b>Ana</b>', accK.code, 'Dragoncito 777', 'a'.repeat(25), 'Ana; DROP']) {
    ok((await post('/api/ruta/me/name', { name: bad }, as(K))).status === 400, 'not a name: ' + JSON.stringify(bad.slice(0, 12)));
  }
  ok((await post('/api/ruta/me/name', { name: 'Ana' }, as(phone()))).status === 403, 'without a session: refused');
  ok((await post('/api/ruta/me/name', { name: 'Ana' }, as(K, { Origin: 'https://evil.example' }))).status === 403, 'from another site: refused');

  // ── 5. «¿Eres tú?» ──
  section('«¿Eres tú?»: what the phone holds');
  const mS = await me(S);
  ok(mS && mS.auto && mS.session && mS.progress && mS.progress.seals === 3 && mS.progress.any === true, 'phone S: its account, 3 seals, progress');
  const mH = await me(H);
  ok(mH && mH.progress.sent === 1 && mH.progress.any, 'phone H: 1 homework sent');
  ok((await me(L)).code === kidL.studentCode && (await me(L)).auto === false && (await me(L)).classroomCode === '1002',
    'a /homework login: that account (not automatic), with its own class code («Sí, soy yo» logs in with it)');
  const quiet = phone();
  ok((await typeKey(quiet, 'yct1')).json.ok && (await me(quiet)) === null, 'a phone with only a key: nothing to remind');

  // ── 6. the claim by a class code ──
  section('the claim: a class code + the automatic code at /homework');
  const C = phone();
  r = await auto(C, 'newhsk1', 'tarea', NEW[2] || NEW[0]);
  const codeC = r.json.account.code;
  made.push(codeC);
  // (security review M3) anywhere else, the unclaimed automatic code is a code that does not exist
  const thief = phone();
  const t1 = await post('/api/homework/enter', { accessCode: '1002', studentCode: codeC }, as(thief));
  ok(t1.json && t1.json.ok === false && t1.json.codeNotFound === true && !thief.jar.dsim, 'another phone, a class code + the automatic code: «No encontramos ese código» (like a wrong code), no session');
  const tn = await post('/api/homework/enter', { accessCode: '1002', studentCode: codeC, displayName: 'Intruso' }, as(thief));
  ok(tn.json && tn.json.ok && tn.json.studentCode !== codeC && tn.json.isNew === true, '… with a name: a new account of its own, never this one');
  delete thief.jar.dsim;
  ok((await get('/api/homework/inbox?accessCode=1002&studentCode=' + codeC, as(phone()))).status === 403 &&
    (await post('/api/homework/rename', { accessCode: '1002', studentCode: codeC, displayName: 'Intruso' }, as(phone()))).status === 403,
    '… and no other /homework door opens it (inbox, rename)');
  await sleep(1300);
  ok(!records()[codeC].classroomCode && records()[codeC].displayName !== 'Intruso', '… the account stays unclaimed and untouched');
  const cl = await enter(C, '1002', null, codeC);
  ok(cl.ok && cl.studentCode === codeC && cl.isNew === false && C.jar.dsim && !C.jar.dauto, 'it logs in with a class code: the same account, the device cookie dropped');
  await sleep(1300);
  ok(records()[codeC].classroomCode === '1002' && records()[codeC].auto === true, '… tagged with that class (auto stays as its origin)');
  delete C.jar.dsim;
  ok(!(await ruta(C)).student, '… a normal account now: no year-long renewal');

  // ── 7. the merge ──
  section('«Pasar mi progreso a esta cuenta»');
  const M = phone();
  M.jar.dauto = autoCookie('AUTA', false, SEEDED.AUTA.firstSeen);                          // this phone made AUTA
  ok((await me(M)).code === 'AUTA' && (await ruta(M)).student, 'phone M holds the automatic account AUTA (renewed)');
  r = await post('/api/ruta/auto/merge', {}, as(M));
  ok(r.status === 403 && r.json.why === 'login', 'the automatic account alone: refused (no login to another account)');
  const other = phone();
  ok((await enter(other, '1002', null, 'REAL')).ok, '(REAL logs in on another phone)');
  r = await post('/api/ruta/auto/merge', {}, as(other));
  ok(r.status === 403 && r.json.why === 'auto', 'a login without this phone\'s automatic account: refused');
  const forged = phone();
  forged.jar.dauto = autoCookie('AUTA', false, SEEDED.AUTA.firstSeen).slice(0, -2) + 'zz';
  await enter(forged, '1002', null, 'REAL');
  ok((await post('/api/ruta/auto/merge', {}, as(forged))).status === 403, 'a forged automatic cookie + a login: refused');
  const lg = await enter(M, '1002', null, 'REAL');
  ok(lg.ok && lg.studentCode === 'REAL' && M.jar.dauto, 'REAL logs in on phone M (the automatic account parked, still on the phone)');
  ok((await me(M)).code === 'REAL', '… the phone\'s account is REAL now');
  ok((await post('/api/ruta/auto/merge', {}, as(M, { Origin: 'https://evil.example' }))).status === 403, '… a merge from another site: refused');
  r = await post('/api/ruta/auto/merge', {}, as(M));
  ok(r.json && r.json.ok && r.json.merged && r.json.account.code === 'REAL' && !M.jar.dauto, 'both proofs: merged, the device cookie gone');
  await sleep(1300);
  const real = records().REAL, arch = read('student-archive.json');
  const seals = (s) => { const out = new Set(); String(s || '').split(',').filter(Boolean).forEach((p) => { const [a, b] = p.split('-').map(Number); for (let n = a; n <= (b || a); n++) out.add(n); }); return out; };
  const S2 = seals(real.ruta.hsk2.s);
  ok([1, 2, 3, 4, 5, 10, 11, 20, 40].every((n) => S2.has(n)) && S2.size === 21, 'the seals: a union (1-20 and 40: ' + S2.size + ')');
  ok(real.ruta.hsk2.p['1'] === 85 && real.ruta.hsk2.p['2'] === 90 && real.ruta.hsk2.p.pinyin === 90, 'El Entrenamiento: the best % per world (85, 90, Pinyin 90)');
  ok(real.tareas[NEW[0]] && real.tareas[NEW[0]].s && real.tareas[NEW[1]].s === SEEDED.REAL.tareas[NEW[1]].s, 'the homework marks: a union (the typed account\'s own moments kept)');
  // (security review L3: the automatic account's exam tries MOVE into the real account; its own tries stay as they were)
  ok(real.hskResults.length === REAL_TRIES.length + 1 && JSON.stringify(real.hskResults.slice(0, REAL_TRIES.length)) === JSON.stringify(REAL_TRIES) &&
    real.hskResults[REAL_TRIES.length].simId === 'newhsk1-sim2' && real.hskResults[REAL_TRIES.length].migratedFrom === 'AUTA',
  'the exam try taken on the automatic account moved over (marked migratedFrom); the typed account\'s own tries untouched');
  ok(real.ruta.hsk2.td === 1 && real.levelAccess.hsk2.via === 'teacher' && real.classroomCode === '1002' && real.displayName === 'Valeria Prueba', '… its teacher data, levels, class and name: untouched');
  ok(!records().AUTA && arch.AUTA && arch.AUTA.mergedInto === 'REAL' && arch.AUTA.hskResults.length === 0, 'the automatic account rests in the archive (mergedInto), its try moved out');
  ok((await post('/api/ruta/auto/merge', {}, as(M))).status === 403, 'a second merge: nothing left to merge');
  // (L1) a merged account never comes back on a phone that still holds its cookie (another tab, an old backup)
  const OLDM = phone();
  OLDM.jar.dauto = autoCookie('AUTA', true, SEEDED.AUTA.firstSeen);
  ok((await me(OLDM)) === null && !(await ruta(OLDM)).student, 'a merged account\'s cookie: no «Mi código», no login');
  ok((await post('/api/ruta/auto/resume', {}, as(OLDM))).status === 403, '… «Sí, soy yo» resumes nothing');
  await enter(OLDM, '1002', null, 'REAL');
  ok((await post('/api/ruta/auto/merge', {}, as(OLDM))).status === 403, '… and it never merges again');
  await sleep(1300);
  ok(!records().AUTA && read('student-archive.json').AUTA, '… it stays in the archive');
  // the same kid twice: an automatic account cannot merge into itself, nor into another automatic account
  const Z = phone();
  r = await auto(Z, 'newhsk1', 'tarea', NEW[0]);
  made.push(r.json.account.code);
  ok((await post('/api/ruta/auto/merge', {}, as(Z))).status === 403, 'into itself: refused');

  // ── 8. the limits ──
  section('the limits');
  const SCHOOL = '198.51.100.240';
  let made30 = 0, last = null;
  for (let i = 0; i < 121; i++) {
    last = await auto(phone(SCHOOL), 'newhsk1', 'tarea', NEW[0]);
    if (last.json && last.json.created) { made30++; made.push(last.json.account.code); }
  }
  ok(made30 === 120 && last.status === 429 && last.json.why === 'rate', '120 new accounts an hour per address (two classes on one Wi-Fi), then a wait (' + made30 + ')');
  const DEV = phone();
  let dev = 0;
  for (let i = 0; i < 4; i++) {
    r = await auto(DEV, 'newhsk1', 'tarea', NEW[0]);
    if (r.json && r.json.created) { dev++; made.push(r.json.account.code); }
    delete DEV.jar.dsim; delete DEV.jar.dauto;                 // the same device (its dkd id) clearing its account away
  }
  ok(dev === 3 && r.status === 429, '3 a day per device, then a wait (' + dev + ')');

  // ── 9. no «Anon», the roster ──
  section('no «Anon», the teachers');
  await sleep(1300);
  const autos = Object.values(records()).filter((x) => x.auto);
  ok(autos.length >= made.filter(Boolean).length && autos.every((x) => x.displayName && x.displayName !== 'Anon' && (PLACEHOLDER.test(x.displayName) || !x.autoName)), 'every automatic account has a friendly name, never «Anon»');
  ok(autos.every((x) => !String(x.displayName).includes(x.code)), '… and never its code in its name');
  const roster = (await get('/api/admin/students', teacher(SEED))).json;
  const rowK = roster.students.find((s) => s.code === accK.code);
  ok(rowK && rowK.auto === true && rowK.displayName === 'Ana María', 'the super admin\'s roster: the automatic account with its «automática» tag');
  ok(roster.students.find((s) => s.code === codeC).auto === false, '… a claimed one (class code) without it');
  const t2 = (await post('/api/admin/teachers', { displayName: 'Profe Auto ' + rnd(2), levels: ['yct1'] }, teacher(SEED))).json;
  const r2 = (await get('/api/admin/students', teacher(t2.teacher.teacherId))).json;
  ok(r2.ok && !r2.students.some((s) => s.auto), 'a regular teacher: no automatic account in their list (nothing else changes)');
  const prof = (await get('/api/admin/students/' + accK.code, teacher(SEED))).json;
  ok(prof.ok && prof.auto === true && prof.levelKey && prof.levelKey.via === null, '… its profile: automática, its level not open on the account (the key stays on the device)');

  // ── 10. the module and the archive rule ──
  section('the module: createAuto, the 30-day archive');
  const MOD = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-auto-mod-'));
  process.env.STUDENT_DATA_DIR = MOD;
  const Students = require('../core/student-records');
  const a1 = Students.createAuto('Dragoncito 101', 'yct1', 'seal');
  const a2 = Students.createAuto('Dragoncito 102', 'hsk2', 'tarea');
  ok(a1.code !== a2.code && a1.auto && a1.level === 'yct1' && a2.level === 'hsk2' && !a1.classroomCode, 'createAuto: two codes, their levels, no class code');
  ok([a1, a2].every((a) => CODE6(a.code)) && Students.normalizeCode(a1.code.toLowerCase()) === a1.code && Students.get(a1.code) === a1, '… six characters with a digit, typed in any case');
  // one never used and one with progress both rest in the archive when stale: his rule «archived, never deleted»
  const a0 = Students.createAuto('Dragoncito 100', 'yct1', 'tarea');
  a0.firstSeen = a0.lastSeen = Date.now() - 31 * DAY;
  a1.firstSeen = a1.lastSeen = Date.now() - 31 * DAY;
  a1.tareas = { [NEW[0]]: { h: Date.now() - 40 * DAY } };
  const out = Students.archiveInactive();
  ok(out.emptyAuto === 1 && !out.removed && Students.peek(a0.code) && Students.peek(a0.code).archived === true, 'an automatic account nobody ever used: archived when it goes stale, never deleted');
  ok(out.moved === 2 && !Students.peek(a1.code).rec.restoredAt && Students.peek(a1.code).archived === true && Students.peek(a2.code).archived === false,
    'an automatic account with some progress and no activity for 30 days rests in the archive (peek never wakes it)');
  // (M3) a PIN room never claims an unclaimed automatic account
  const viaPin = Students.getOrProvisionForPin(a2.code, 'Sala', '1002');
  ok(viaPin === a2 && !a2.classroomCode, 'a PIN join with the automatic code: its results land on it, but it is never tagged with the room\'s class');
  // (L3) moveResults
  const cls = Students.getOrCreate(null, 'Clase Real');
  cls.classroomCode = '1002';
  a2.hskResults = [{ simId: 'yct1-sim1', ts: 5, total: 200 }];
  a2.assignmentSubmissions = [{ assignmentId: 'x', ts: 7 }];
  const mv = Students.moveResults(a2.code, cls.code);
  ok(mv.tries === 1 && mv.homework === 1 && cls.hskResults.length === 1 && cls.hskResults[0].migratedFrom === a2.code && a2.hskResults.length === 0 && cls.assignmentSubmissions.length === 1,
    'moveResults: the tries and the homework rounds move, marked where they came from');
  ok(Students.get(a1.code) && Students.peek(a1.code).archived === false, '… its code brings it back (a real step)');
  ok(Students.archiveOne(a2.code, { mergedInto: 'ZZZZ' }).moved === 1 && Students.peek(a2.code).archived && Students.peek(a2.code).rec.mergedInto === 'ZZZZ', 'archiveOne: one account, stamped');
  Students.flushNow();
  try { fs.rmSync(MOD, { recursive: true, force: true }); } catch (_) {}

  await phoneSide();
  ok(!/TypeError|ReferenceError|Unhandled/.test(allLog), 'no server error in the log');
}

// ── 11. the phone's side (security review M2): js/ruta-auto.js in a sandbox with a fake browser ──
// A) after «Salir» (dralyHwOut) a first step never logs the saved kid in again; B) a parked account is only asked about
async function phoneSide() {
  section('the phone after «Salir» (js/ruta-auto.js, homework.js, the key screen)');
  const vm = require('vm');
  const code = fs.readFileSync(path.join(ROOT, 'public', 'js', 'ruta-auto.js'), 'utf8');
  const sandbox = (store, answers, ask) => {
    const calls = [];
    const mem = Object.assign({}, store), sess = {};
    const storage = (m) => ({ getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } });
    const win = {
      localStorage: storage(mem), sessionStorage: storage(sess), navigator: {}, isSecureContext: true, matchMedia: () => ({ matches: false }),
      fetch: (url, o) => {
        const body = o && o.body ? JSON.parse(o.body) : null;
        calls.push({ url, body });
        const d = answers(url, body, calls.length);
        return Promise.resolve({ status: d && d.ok === false ? 403 : 200, json: () => Promise.resolve(d) });
      },
    };
    win.window = win;
    win.document = { cookie: '', body: { classList: { contains: () => false } } };
    vm.createContext(win);
    vm.runInContext(code, win);
    win.DralyAuto.askParked = ask || (() => Promise.resolve(null));
    return { win, calls, mem, sess };
  };
  const ACC = { code: 'K7P2Q9', name: 'Dragoncito 512', placeholder: true, auto: true, progress: { seals: 3, any: true } };
  // A: a sister after «Salir»
  const A1 = sandbox({ dralyHwAccessCode: '1002', dralyStudentCode: 'RRRR', dralyHwOut: '1' }, () => ({ ok: true, created: true, account: ACC }));
  await A1.win.DralyAuto.ensure('newhsk1', 'seal');
  ok(!A1.calls.some((c) => /level-access\/session/.test(c.url)) && A1.calls.some((c) => c.url === '/api/ruta/auto'),
    'A · after «Salir» (dralyHwOut): a seal never logs the saved kid in again (no silent login)');
  const A2 = sandbox({ dralyHwAccessCode: '1002', dralyStudentCode: 'RRRR' }, (url) => (/level-access/.test(url) ? { ok: true, kind: 'student' } : { ok: true, account: ACC }));
  const rA2 = await A2.win.DralyAuto.ensure('newhsk1', 'seal');
  ok(A2.calls[0].url === '/api/level-access/session' && rA2 && rA2.relogged, '… without «Salir», the kid saved on the phone logs in again (no duplicate for a real kid)');
  // B: the phone's parked account: asked, never resumed by itself
  let asked = 0;
  const B1 = sandbox({}, (url, body) => (url === '/api/ruta/auto' ? (body.fresh ? { ok: true, created: true, account: Object.assign({}, ACC, { code: 'B2B2B2' }) } : { ok: false, why: 'parked', account: ACC }) : { ok: false }),
    (acc) => { asked++; return Promise.resolve(acc.code === ACC.code ? 'other' : null); });
  const rB1 = await B1.win.DralyAuto.ensure('newhsk1', 'seal');
  ok(rB1 === null && asked === 1 && !B1.calls.some((c) => /resume/.test(c.url)), 'B · a parked account: «¿Eres tú?» asked, nothing resumed; «No, soy otro alumno» keeps the step on the phone');
  const rB2 = await B1.win.DralyAuto.ensure('newhsk1', 'tarea', 'x');
  const lastAuto = B1.calls.filter((c) => c.url === '/api/ruta/auto').pop();
  ok(lastAuto && lastAuto.body.fresh === true && rB2 && rB2.created && rB2.account.code === 'B2B2B2', '… the next step asks for a new account for this kid (fresh)');
  const B2 = sandbox({}, (url) => (url === '/api/ruta/auto' ? { ok: false, why: 'parked', account: ACC } : url === '/api/ruta/auto/resume' ? { ok: true, resumed: true, account: ACC } : { ok: false }),
    () => Promise.resolve('me'));
  const rB3 = await B2.win.DralyAuto.ensure('yct1', 'seal');
  ok(B2.calls.some((c) => c.url === '/api/ruta/auto/resume') && rB3 && rB3.resumed && rB3.account.code === ACC.code, '«Sí, soy yo»: resumed by its own explicit call');
  // the pages that set and read the flag
  const hw = fs.readFileSync(path.join(ROOT, 'public', 'js', 'homework.js'), 'utf8');
  const ks = fs.readFileSync(path.join(ROOT, 'protected', 'pages', 'level-key.html'), 'utf8');
  ok((hw.match(/markOut\(\)/g) || []).length >= 3 && /localStorage\.setItem\('dralyHwOut', '1'\)/.test(hw) && /localStorage\.removeItem\('dralyHwOut'\)/.test(hw),
    '/homework: «Salir» (and the avatar picker\'s way back) sets dralyHwOut, «Entrar» clears it');
  ok(/ls\('dralyHwOut'\) === '1' \? '' : ls\('dralyHwAccessCode'\)/.test(ks), 'the key screen: no silent login of the saved kid after «Salir»');
  ok(/acc\.classroomCode/.test(hw), '«Sí, soy yo» on a class account logs in with ITS OWN class code (L6)');
}

(async () => {
  let crashed = false;
  await startServer();
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
    ok(!made.filter(Boolean).some((c) => new RegExp('\\b' + c + '\\b').test(allLog)), 'no automatic account\'s code in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-auto-account: ${failed} FAILED, ${passed} passed` : `test-auto-account: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
