#!/usr/bin/env node
// test-teacher-edit.js — /maestro → Teachers: the super admin edits a teacher (his ask 2026-10-19: "edit the teachers'
// name and their codes and passwords … send suggestions super cartoon style"). Its OWN server (port 4520, never 3000,
// never the live site) on a temporary data folder with MADE-UP teachers and kids; every code is generated here and
// never printed. Checks:
//   · only the super admin, from a page of ours, may edit; a regular teacher, no code, a wrong code, another site: no
//   · a name / email / country change (bad input refused in Spanish), no «<>»; a renamed «Ms Enni» / «Ms Nicole» is
//     never seeded again after a restart (the old boot migrations are one-shot)
//   · 🎲 cartoon suggestions: animal-describer-thing-NN, ≤ 24 characters, valid, unique, only words of the curated
//     lists, never a teacher's code; for every signed-in teacher
//   · another teacher's code (by uid): the old one stops (retired, «ya se cambió»), the new one logs in (also typed
//     with spaces, lower case or without dashes, or with its accents), remembered devices ask again, special
//     assignments follow, a retired code is never taken again, no two codes differ only by dashes; the super admin's
//     own row keeps this device remembered; a regular teacher's «Cambiar mi código» still works
//   · a class code renamed: every tagged kid moves (live AND archived), with their name, level, homework and inbox; its
//     level, classrooms and guides follow; the old class code stops existing (login refused, never handed to another
//     class; its own teacher may take it back); a kid with a session keeps going even from a page still holding the
//     old code; a code still on a deleted teacher's kids is refused; a new code's 🎲 is 4 free digits
//   · refused, with nothing changed, while the archive file can't be read; rate limits; nothing logs a code
//   · in-process: the word lists, accent / dash-tolerant lookups, old accent-dropped codes still working, retired
//     class codes skipped by new codes
//   node scripts/test-teacher-edit.js        (--port 4520 · --keep to leave the server running · --why: on a failure,
//                                            the server's own warnings, every code masked)
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
const PORT = Number(opt('port', 4520));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-tedit-'));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const letters = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[crypto.randomInt(24)]).join('');
const kidCode = () => Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const CartoonCodes = require('../core/cartoon-codes');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secrets = new Set([SEED, LEGACY]);   // every teacher code this test sees: none may reach the server log
const keep = (c) => { if (c) secrets.add(String(c)); return c; };

// ── HTTP with a cookie jar per visitor (a phone) ──
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
        resolve({ status: res.statusCode, headers: res.headers, text, json, setCookie: sc });
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
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, (extra && extra.headers) || {}) });
// a teacher at their own address (the edit limits count per address: each part of the test has its own)
let tipN = 10;
const teacherAt = () => { const ip = '203.0.113.' + (tipN++); return (code, extra) => ({ headers: Object.assign({ 'X-Admin-Pw': encodeURIComponent(code), 'CF-Connecting-IP': ip }, extra || {}) }); };
const T = (code) => ({ headers: { 'X-Admin-Pw': encodeURIComponent(code) } });
const cookieOk = (sc, name) => { const c = sc.find((x) => x.startsWith(name + '=')); return !!c && /HttpOnly/i.test(c); };
const sock = (jar) => io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true,
  extraHeaders: jar && Object.keys(jar).length ? { Cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') } : {} });
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
async function create(jar) {
  const s = sock(jar);
  const r = await emitAck(s, 'host:create', { gameType: 'mochi-mash' });
  s.close();
  return r;
}
async function enter(ph, accessCode, name, code) {
  const r = await post('/api/homework/enter', code ? { accessCode, studentCode: code } : { accessCode, displayName: name }, as(ph));
  return Object.assign({ status: r.status }, r.json || {});
}

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED }),
  });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; allLog += d; });
  srv.stderr.on('data', (d) => { log += d; allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return srv; } catch (_) {}
  }
  console.error('the server did not start:\n' + log.slice(-2000).split(SEED).join('<seed>').split(LEGACY).join('<legacy>'));
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

// a made-up kid resting in the archive, tagged with the super admin's class code 1002 (seeded before the first boot)
const ARCH = kidCode();
const DAY = 86400e3;
fs.writeFileSync(path.join(DATA, 'student-archive.json'), JSON.stringify({ [ARCH]: {
  code: ARCH, displayName: 'Archivada Prueba', avatar: null, classroomCode: '1002', classroomId: null, level: 'hsk2',
  firstSeen: Date.now() - 60 * DAY, lastSeen: Date.now() - 40 * DAY, sentencesBuilt: [] } }));
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));   // (this test's own temp folder)

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + String(e && e.stack || e).split(SEED).join('<seed>')); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    const leaked = [...secrets].filter((c) => c && allLog.includes(c));
    ok(!leaked.length, 'no teacher code reaches the server log (' + leaked.length + ' found)');
  }
  if (failed && args.includes('--why')) {   // the server's own warnings, codes masked
    let w = allLog.split('\n').filter((l) => /warn|fail|refused|undone|error/i.test(l)).slice(-30).join('\n');
    secrets.forEach((c) => { if (c) w = w.split(c).join('<code>'); });
    console.log(w);
  }
  try { unitChecks(); } catch (e) { failed++; console.log('  ✖ unit checks crashed: ' + (e && e.message)); }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-teacher-edit: ${failed} FAILED, ${passed} passed` : `test-teacher-edit: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();

const CARTOON_RE = /^([A-Z]+)-([A-Z]+)-([A-Z]+)-(\d{2})$/;
const ANIMAL_SET = new Set(CartoonCodes.ANIMALS.map((a) => a[0]));
const DESC_SET = new Set(CartoonCodes.DESCRIBERS.flat());
const THING_SET = new Set(CartoonCodes.THINGS);
// words that must never appear in a code a kid's teacher gets (insults, bodies, drugs, double meanings, brands)
const DENY = new Set(['BURRO', 'VACA', 'CERDO', 'PUERCO', 'COCHINO', 'CHANCHO', 'RATA', 'ZORRA', 'PERRA', 'FOCA', 'BALLENA', 'MONO', 'GORILA',
  'LOCO', 'LOCA', 'TONTO', 'TONTA', 'GORDO', 'GORDA', 'FEO', 'FEA', 'CACA', 'PEDO', 'CULO', 'TETA', 'PENE', 'CHILE', 'PAPAYA', 'NIEVE',
  'GRIFO', 'PERICO', 'CAMELLO', 'PATO', 'MARIPOSA', 'MARIQUITA', 'LOBA', 'TIGRESA', 'BOMBON', 'MARACA', 'CORONA', 'GLOBO', 'PELOTA',
  'CEREZA', 'PEPINO', 'PLATANO', 'BANANA', 'HUEVO', 'NABO', 'CONCHA', 'BOLLO', 'CHORIZO', 'GOLOSA', 'TRAVIESA', 'ATREVIDA', 'RAPIDA',
  'AVENTURERA', 'PELUDA', 'TORTUGA', 'GALLINA', 'COTORRA', 'SAPO', 'BICHO', 'LEGO', 'COCA', 'PERRO', 'GATO']);
function cartoonOk(c) {
  const m = CARTOON_RE.exec(String(c || ''));
  if (!m || c.length > 24) return false;
  if (!ANIMAL_SET.has(m[1]) || !DESC_SET.has(m[2]) || !THING_SET.has(m[3])) return false;
  if (m[4] === '69' || m[4] === '88') return false;
  return ![m[1], m[2], m[3]].some((w) => DENY.has(w));
}

async function run() {
  const stamp = Date.now().toString(36).slice(-4);
  const admin = teacherAt();
  const listT = async (code, at) => (((await get('/api/admin/teachers', (at || admin)(code))).json) || {}).teachers || [];

  // ── 1. who may edit ──
  section('who may edit');
  const list0 = await listT(SEED);
  ok(list0.length === 3 && list0.every((t) => typeof t.uid === 'string' && t.uid.length >= 8), 'the super admin\'s list: 3 teachers, each with a uid');
  const sup = list0.find((t) => t.isSuperAdmin);
  const enni = list0.find((t) => /enni/i.test(t.displayName));
  const nicole = list0.find((t) => /nicole/i.test(t.displayName));
  ok(!!(sup && enni && nicole), 'the seeded super admin, Ms Enni and Ms Nicole');
  const ENNI0 = keep(enni.teacherId), NICOLE0 = keep(nicole.teacherId);
  const asEnni = teacherAt();
  for (const [what, call] of [
    ['a name', () => put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: 'Hack ' + stamp }, asEnni(ENNI0))],
    ['another teacher\'s code', () => put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: 'Prueba-' + rnd(4) + '7' }, asEnni(ENNI0))],
    ['her own code by this route', () => put('/api/admin/teacher/' + enni.uid + '/code', { newCode: 'Prueba-' + rnd(4) + '7' }, asEnni(ENNI0))],
    ['a class code', () => put('/api/admin/teacher/' + enni.uid + '/class-code', { from: enni.accessCodes[0], to: String(4000 + crypto.randomInt(999)) }, asEnni(ENNI0))],
    ['a class code check', () => post('/api/admin/teacher/' + enni.uid + '/class-code/check', { from: enni.accessCodes[0] }, asEnni(ENNI0))],
    ['a class code 🎲', () => get('/api/admin/class-codes/suggest', asEnni(ENNI0))],
    ['a class code\'s level', () => put('/api/admin/teacher/' + enni.uid + '/class-codes/level', { code: enni.accessCodes[0], level: 'yct1' }, asEnni(ENNI0))],
    ['a new class code', () => post('/api/admin/teacher/' + enni.uid + '/class-codes', { level: 'yct1' }, asEnni(ENNI0))],
    ['(delete) a teacher', () => req('DELETE', '/api/admin/teacher/' + nicole.uid, asEnni(ENNI0))],
  ]) {
    const r = await call();
    ok(r.status === 403 && r.json && /super admin/i.test(r.json.error || ''), `a regular teacher cannot change ${what} (${r.status})`);
  }
  ok((await put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: 'X' })).status === 401, 'no code: 401');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: 'X' }, T('WRONG-' + rnd(4)))).status === 401, 'a wrong code: 401');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: 'X' }, admin(SEED, { Origin: 'https://evil.example.com' }))).status === 403, 'from another site (Origin): refused');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: 'X' }, admin(SEED, { 'Sec-Fetch-Site': 'cross-site' }))).status === 403, 'from another site (Sec-Fetch-Site): refused');
  ok((await put('/api/admin/teacher/NOPE' + rnd(3) + '/profile', { displayName: 'X' }, admin(SEED))).status === 404, 'an unknown teacher: 404');
  ok((await listT(SEED)).find((t) => t.uid === nicole.uid).displayName === nicole.displayName, '… and nothing changed');

  // ── 2. name, email, country ──
  section('name, email, country');
  for (const [body, why] of [[{ displayName: '' }, 'an empty name'], [{ displayName: '    ' }, 'a blank name'], [{ displayName: 'x'.repeat(61) }, 'a 61-letter name'],
    [{ email: 'no-arroba' }, 'a broken email'], [{ country: '12' }, 'a country with digits'], [{ country: 'MEXI' }, 'a 4-letter country']]) {
    const r = await put('/api/admin/teacher/' + nicole.uid + '/profile', body, admin(SEED));
    ok(r.status === 400 && r.json && /[áéíóúñ]|nombre|correo|país|letras/i.test(r.json.error || ''), `${why} is refused in Spanish: ${r.json && r.json.error}`);
  }
  const p1 = await put('/api/admin/teacher/' + nicole.uid + '/profile', { displayName: '  Profe   <Luna>  Prueba ', email: 'luna.prueba@example.com', country: 'ae' }, admin(SEED));
  ok(p1.json && p1.json.ok && p1.json.teacher.displayName === 'Profe Luna Prueba' && p1.json.teacher.email === 'luna.prueba@example.com' && p1.json.teacher.country === 'AE',
    'Ms Nicole becomes «Profe Luna Prueba» (spaces tidied, no «<>»), email and country saved');
  ok(p1.json && p1.json.changed.length === 3 && p1.json.teacher.teacherId === NICOLE0, '… three fields changed, her code untouched');
  const p2 = await put('/api/admin/teacher/' + nicole.uid + '/profile', { email: '' }, admin(SEED));
  ok(p2.json && p2.json.ok && p2.json.teacher.email === null && p2.json.teacher.displayName === 'Profe Luna Prueba', 'an empty email clears it (only the fields sent change)');
  const p3 = await put('/api/admin/teacher/' + enni.uid + '/profile', { displayName: 'Miss Estrella Prueba' }, admin(SEED));
  ok(p3.json && p3.json.ok, 'Ms Enni becomes «Miss Estrella Prueba»');
  ok((await get('/api/admin/students', T(NICOLE0))).json.self.displayName === 'Profe Luna Prueba', 'her own /maestro shows the new name');
  ok(/a teacher's name changed \(Profe Luna Prueba\)/.test(allLog), 'the log says a name changed, with the name only');

  // ── 3. 🎲 cartoon suggestions ──
  section('🎲 cartoon suggestions');
  const sugs = [];
  for (let i = 0; i < 40; i++) sugs.push(keep(((await get('/api/admin/teachers/suggest-code', admin(SEED))).json || {}).code));
  ok(sugs.every(cartoonOk), 'every suggestion: an animal-describer-thing-NN from the curated lists, ≤ 24 characters, no word on the deny list');
  ok(new Set(sugs).size === sugs.length, '… all different');
  const codesNow = (await listT(SEED)).map((t) => t.teacherId);
  ok(!sugs.some((s) => codesNow.includes(s)), '… never a teacher\'s code');
  const regSug = await get('/api/admin/teachers/suggest-code', T(NICOLE0));
  ok(regSug.status === 200 && cartoonOk(keep(regSug.json.code)), 'a regular teacher gets suggestions too (her own «Cambiar mi código»)');
  ok((await get('/api/admin/teachers/suggest-code')).status === 401, '… nobody else');
  ok(/no-store/.test(regSug.headers['cache-control'] || ''), '… never cached');

  // ── 4. another teacher's code ──
  section('another teacher\'s code');
  const phE = phone();
  const kidE = await enter(phE, enni.accessCodes[0], 'Kid Enni ' + stamp);
  ok(kidE.ok, 'a kid joins Ms Enni\'s class');
  const ca = await post('/api/admin/custom-assignment', { title: 'Prueba ' + stamp, items: [{ es: 'hola', expected: 'ni hao' }], targetStudents: [kidE.studentCode] }, T(ENNI0));
  ok(ca.json && ca.json.ok, 'Ms Enni makes a special assignment');
  const devE = phone();
  await post('/api/teacher-device', { code: ENNI0 }, as(devE));
  ok(!!devE.jar.dtd && !!(await create(devE.jar)).pin, 'her laptop is remembered (opens games)');
  const coder = teacherAt();
  for (const [bad, why] of [['abc', 'too short'], ['ABCDEFGHIJ', 'no number'], ['12345678', 'no letter'], ['A1' + 'B'.repeat(30), 'too long'], [NICOLE0, 'another teacher\'s']]) {
    const r = await put('/api/admin/teacher/' + enni.uid + '/code', { newCode: bad }, coder(SEED));
    ok(r.status === 400 && r.json && r.json.error && !r.text.includes(ENNI0), `a code that is ${why} is refused: ${r.json && r.json.error}`);
  }
  const ENNI1 = keep(sugs[0]);
  const ch1 = await put('/api/admin/teacher/' + enni.uid + '/code', { newCode: ENNI1 }, coder(SEED));
  ok(ch1.json && ch1.json.ok && ch1.json.teacher.teacherId === ENNI1 && ch1.json.teacher.uid === enni.uid, 'the super admin gives Ms Enni a cartoon code (same account, same uid)');
  ok(!ch1.setCookie.some((c) => c.startsWith('dtd=')), '… his own device is not touched');
  const old1 = await get('/api/admin/students', T(ENNI0));
  ok(old1.status === 401 && old1.json && old1.json.retired, 'her old code stops at once («ya se cambió», not counted as a guess)');
  const new1 = await get('/api/admin/students', T(ENNI1));
  ok(new1.status === 200 && new1.json.students.some((s) => s.code === kidE.studentCode), 'the new code works and her kids are still hers');
  ok((await get('/api/admin/students', T(ENNI1.toLowerCase().replace(/-/g, ' ')))).status === 200, '… typed in lower case with spaces');
  ok((await get('/api/admin/students', T(ENNI1.replace(/-/g, '')))).status === 200, '… typed without the dashes');
  ok(!(await create(devE.jar)).pin, 'her remembered laptop asks for the code again');
  const cas = (await get('/api/admin/custom-assignments', T(ENNI1))).json;
  ok(cas && (cas.assignments || []).some((a) => a.title === 'Prueba ' + stamp), 'her special assignment followed the new code');
  const ENNI2 = keep(sugs[1]);
  ok((await put('/api/admin/teacher/' + enni.uid + '/code', { newCode: ENNI2 }, coder(SEED))).json.ok, 'a second change');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: ENNI1 }, coder(SEED))).status === 400, 'a retired code is never taken again (not even by another teacher)');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: ENNI1.replace(/-/g, '') }, coder(SEED))).status === 400, '… nor the same letters without the dashes');
  const oldLoose = await get('/api/admin/students', T(ENNI1.replace(/-/g, '')));
  ok(oldLoose.status === 401 && oldLoose.json && oldLoose.json.retired, 'the old code typed without dashes: «ya se cambió» too');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: ENNI2 }, coder(SEED))).status === 400, 'another teacher\'s code is refused');
  ok((await put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: ENNI2.replace(/-/g, '') }, coder(SEED))).status === 400, '… also without its dashes (one code, one teacher)');
  ok((await get('/api/admin/students', T(ENNI1))).json.retired === true && (await get('/api/admin/students', T(ENNI2))).status === 200, 'only the latest works');
  // a code with accents and spaces (made up here): stored without them, found with or without them
  const word = letters(4);
  const typed = 'Halcón ' + word + ' Dorada ' + String(10 + crypto.randomInt(59));
  const chN = await put('/api/admin/teacher/' + nicole.uid + '/code', { newCode: typed }, coder(SEED));
  const NICOLE1 = keep(chN.json && chN.json.teacher && chN.json.teacher.teacherId);
  ok(chN.json && chN.json.ok && /^HALCON-[A-Z]{4}-DORADA-\d{2}$/.test(NICOLE1 || ''), 'a code typed with an accent and spaces is stored as letters and dashes');
  ok((await get('/api/admin/students', T(typed.toLowerCase()))).status === 200 && (await get('/api/admin/students', T(NICOLE1.replace(/-/g, '')))).status === 200,
    '… and found typed either way');
  // the super admin's own row: same change, this device stays remembered
  const meP = phone();
  await get('/api/admin/students', as(meP, T(SEED)));
  const SUPER = keep(sugs[2]);
  const chS = await put('/api/admin/teacher/' + sup.uid + '/code', { newCode: SUPER }, as(meP, coder(SEED)));
  ok(chS.json && chS.json.ok && chS.json.teacher.teacherId === SUPER && cookieOk(chS.setCookie, 'dtd'), 'the super admin changes his own code from his row (this device stays remembered)');
  ok((await get('/api/admin/students', T(SEED))).status === 401 && (await get('/api/admin/students', T(SUPER))).status === 200, '… the old stops, the new works');
  ok(!!(await create(meP.jar)).pin, '… his device still opens games');
  // a regular teacher's «Cambiar mi código» (one flow) still works, now with a cartoon 🎲
  const NICOLE2 = keep(((await get('/api/admin/teachers/suggest-code', T(NICOLE1))).json || {}).code);
  const my = await post('/api/admin/my-code', { newCode: NICOLE2 }, T(NICOLE1));
  ok(my.json && my.json.ok && my.json.teacher.teacherId === NICOLE2, 'a regular teacher changes her own code with a 🎲 idea');
  ok((await post('/api/admin/my-code', { newCode: 'Otro-' + rnd(4) + '1' }, { headers: Object.assign({ Origin: 'https://evil.example.com' }, T(NICOLE2).headers) })).status === 403,
    '«Cambiar mi código» from another site: refused');

  // ── 5. a class code renamed ──
  section('a class code renamed');
  const ph1 = phone(), ph2 = phone(), ph3 = phone();
  const k1 = await enter(ph1, '1002', 'Kid Uno ' + stamp);
  const k2 = await enter(ph2, '1002', 'Kid Dos ' + stamp);
  const k3 = await enter(ph3, '1003', 'Kid Tres ' + stamp);
  ok(k1.ok && k2.ok && k3.ok && k1.level === 'hsk2' && k3.level === 'yct1' && ph1.jar.dsim, 'kids join 1002 (New HSK 1) and 1003 (YCT 1)');
  const asg = (k1.assignments || [])[0];
  ok(asg && (await post('/api/homework/submit', { accessCode: '1002', studentCode: k1.studentCode, assignmentId: asg.id, answers: [] }, as(ph1))).json.ok, 'kid 1 hands in a homework');
  ok((await post('/api/admin/student/' + k1.studentCode + '/message', { text: 'Hola ' + stamp }, T(SUPER))).json.ok, 'kid 1 gets a message');
  const room = (await post('/api/admin/classrooms', { name: 'Grupo Prueba ' + stamp, code: '1002' }, T(SUPER))).json;
  ok(room && room.ok, 'a named classroom tied to 1002');
  const pdf = Buffer.from('%PDF-1.4\n% prueba ' + stamp + '\n').toString('base64');
  const guide = (await post('/api/admin/guides', { title: 'Guía Prueba ' + stamp, exp: 'exp1', classroomCode: '1002', dataBase64: pdf }, T(SUPER))).json;
  ok(guide && guide.ok, 'a guide for 1002');
  // a class code still on a deleted teacher's kids
  const tmpT = (await post('/api/admin/teachers', { displayName: 'Profe Temporal ' + stamp, levels: ['yct1'] }, T(SUPER))).json.teacher;
  keep(tmpT.teacherId);
  const ORPH = tmpT.accessCodes[0];
  ok((await enter(phone(), ORPH, 'Kid Huerfano ' + stamp)).ok, 'a kid joins a temporary teacher\'s class');
  const lvl = await put('/api/admin/teacher/' + tmpT.uid + '/class-codes/level', { code: ORPH, level: 'hsk2' }, T(SUPER));
  ok(lvl.json && lvl.json.ok && lvl.json.teacher.codeLevels[ORPH] === 'hsk2', 'a class code\'s level changes by uid (no code in the address)');
  const add = await post('/api/admin/teacher/' + tmpT.uid + '/class-codes', { level: 'yct1' }, T(SUPER));
  ok(add.json && add.json.ok && /^\d{4}$/.test(add.json.code) && add.json.teacher.accessCodes.length === 2, 'a new class code by uid');
  ok((await req('DELETE', '/api/admin/teacher/' + tmpT.uid, T(SUPER))).json.ok, '… and that teacher is deleted by uid (the kid keeps the code)');
  const gone = await get('/api/admin/students', T(tmpT.teacherId));
  ok(gone.status === 401 && gone.json && gone.json.retired, 'a deleted teacher\'s code is retired («ya se cambió»), never taken again');
  ok((await req('DELETE', '/api/admin/teacher/' + sup.uid, T(SUPER))).status === 400, 'the super admin can\'t be deleted');
  const cc = teacherAt();
  const csug = [];
  for (let i = 0; i < 30; i++) csug.push(((await get('/api/admin/class-codes/suggest', cc(SUPER))).json || {}).code);
  const allClass = (await listT(SUPER)).flatMap((t) => t.accessCodes);
  ok(csug.every((c) => /^[1-9]\d{3}$/.test(c || '')) && !csug.some((c) => allClass.includes(c) || c === ORPH), '🎲 class codes: 4 digits, free, never a code still on kids');
  const chk = await post('/api/admin/teacher/' + sup.uid + '/class-code/check', { from: '1002' }, cc(SUPER));
  ok(chk.json && chk.json.ok && chk.json.kids.live === 2 && chk.json.kids.archived === 1 && chk.json.classrooms === 1, '«Revisar»: 2 kids, 1 archived account and 1 classroom will move');
  const enniNow = (await listT(SUPER)).find((t) => t.uid === enni.uid);
  for (const [to, why] of [['0123', 'starting with 0'], ['abcd', 'letters'], ['12345', '5 digits'], ['1002', 'the same code'], ['1001', 'another class (his own)'],
    [enniNow.accessCodes[0], 'another teacher\'s class'], [ORPH, 'a code still on a deleted teacher\'s kids']]) {
    const r = await post('/api/admin/teacher/' + sup.uid + '/class-code/check', { from: '1002', to }, cc(SUPER));
    const r2 = await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: '1002', to }, cc(SUPER));
    ok(r.status === 400 && r2.status === 400 && /[a-záéíóúñ]/.test((r2.json && r2.json.error) || ''), `a new class code that is ${why} is refused: ${r2.json && r2.json.error}`);
  }
  ok((await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: enniNow.accessCodes[0], to: csug[0] }, cc(SUPER))).status === 400, 'a code that is not that teacher\'s is refused');
  const NEW2 = csug[0];
  const ren = await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: '1002', to: NEW2 }, cc(SUPER));
  ok(ren.json && ren.json.ok && ren.json.kids.live === 2 && ren.json.kids.archived === 1 && ren.json.classrooms === 1 && ren.json.guides === 1,
    'renamed: 2 kids, 1 archived account, 1 classroom and 1 guide moved (' + ren.status + ' ' + ((ren.json && (ren.json.error || JSON.stringify(ren.json.kids))) || '') + ')');
  const supNow = (await listT(SUPER)).find((t) => t.uid === sup.uid);
  ok(!supNow.accessCodes.includes('1002') && supNow.accessCodes.indexOf(NEW2) === sup.accessCodes.indexOf('1002') && supNow.codeLevels[NEW2] === 'hsk2' && !('1002' in supNow.codeLevels),
    '… the code took its place in the list and kept its level (New HSK 1)');
  ok((await enter(phone(), '1002', null, k1.studentCode)).status === 401, 'the old class code stops existing (a login with it is refused)');
  const back1 = await enter(phone(), NEW2, null, k1.studentCode);
  ok(back1.ok && back1.studentCode === k1.studentCode && back1.level === 'hsk2' && !back1.isNew && back1.displayName === 'Kid Uno ' + stamp, 'the new class code + the kid\'s code: the same account, same name and level');
  const vam = await post('/api/entrada/vamos', {}, as(ph1));
  ok(vam.json && vam.json.ok && vam.json.studentCode === k1.studentCode && vam.json.classroomCode === NEW2 && vam.json.level === 'hsk2', 'kid 1\'s phone (remembered) comes in by itself and learns the new class code');
  const inbox = await get('/api/homework/inbox?accessCode=1002&studentCode=' + k1.studentCode, as(ph1));
  ok(inbox.status === 200 && inbox.json.inbox.some((m) => (m.text || '').includes(stamp)), 'a page still holding the old class code keeps working for its kid (session) and the message is there');
  ok((await get('/api/homework/inbox?accessCode=1002&studentCode=' + k1.studentCode, as(phone()))).status === 401, '… a phone without the kid\'s session gets nothing with the old code');
  ok((await get('/api/homework/inbox?accessCode=' + NEW2 + '&studentCode=' + k1.studentCode, as(phone()))).status === 200, '… and the new class code + kid code still opens it (as every class login)');
  const roster = (await get('/api/admin/students', T(SUPER))).json.students;
  const r1 = roster.find((s) => s.code === k1.studentCode), r2 = roster.find((s) => s.code === k2.studentCode), r3 = roster.find((s) => s.code === k3.studentCode);
  ok(r1 && r2 && r1.classroomCode === NEW2 && r2.classroomCode === NEW2 && r1.level === 'hsk2' && r1.assignmentCount === 1, 'the roster: both kids on the new code, level and homework kept');
  ok(r3 && r3.classroomCode === '1003', '… the other class is untouched');
  const rooms = (await get('/api/admin/classrooms', T(SUPER))).json.classrooms;
  ok(rooms.some((c) => c.name === 'Grupo Prueba ' + stamp && c.code === NEW2), 'the named classroom follows');
  const g1 = (await get('/api/guides?accessCode=' + NEW2 + '&studentCode=' + k1.studentCode, as(ph1))).json;
  const g3 = (await get('/api/guides?accessCode=1003&studentCode=' + k3.studentCode, as(ph3))).json;
  ok(g1 && g1.guides.some((g) => g.title === 'Guía Prueba ' + stamp) && g3 && !g3.guides.some((g) => g.title === 'Guía Prueba ' + stamp), 'the class guide follows (and stays only for that class)');
  const arc = readJson('student-archive.json');
  ok(arc[ARCH] && arc[ARCH].classroomCode === NEW2 && arc[ARCH].displayName === 'Archivada Prueba', 'the archived kid moved too, still resting in the archive');
  const enniCC = teacherAt();
  ok((await put('/api/admin/teacher/' + enni.uid + '/class-code', { from: enniNow.accessCodes[0], to: '1002' }, enniCC(SUPER))).status === 400, 'another class may never take the retired 1002');
  const undo = await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: NEW2, to: '1002' }, cc(SUPER));
  ok(undo.json && undo.json.ok && undo.json.kids.live === 2 && undo.json.kids.archived === 1, 'its own teacher may take 1002 back (an undo): the kids come back with it');
  const NEW3 = csug.find((c) => c !== NEW2);
  ok((await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: '1002', to: NEW3 }, cc(SUPER))).json.ok, 'and renamed once more');
  ok((await put('/api/admin/teacher/' + enni.uid + '/class-code', { from: enniNow.accessCodes[0], to: NEW2 }, enniCC(SUPER))).status === 400, '… the code given up in between is retired too');
  ok(/a class code was changed \(/.test(allLog) && /class code rename: 2 kids moved, 1 archived, 1 classrooms, 1 guides/.test(allLog), 'the log says a class code changed, with counts and the name only');
  const codeLines = allLog.split('\n').filter((l) => /class code|\[teachers\]|\[classrooms\]|\[guides\]/i.test(l));
  ok(!codeLines.some((l) => [NEW2, NEW3, '1002'].some((c) => l.includes(c) && !/1001-1003/.test(l))), '… never the class codes');

  // ── 6. limits ──
  section('limits');
  const flood = teacherAt();
  let last = null, n429 = 0;
  for (let i = 0; i < 62 && !n429; i++) { last = await put('/api/admin/teacher/' + nicole.uid + '/profile', { country: 'AE' }, flood(SUPER)); if (last.status === 429) n429 = i + 1; }
  ok(n429 > 0 && /espera/i.test((last.json && last.json.error) || ''), `60 changes in 10 minutes by one teacher → a wait (after ${n429} more here)`);
  ok((await put('/api/admin/teacher/' + nicole.uid + '/profile', { country: 'AE' }, teacherAt()(SUPER))).status === 429, '… from any address (it counts per teacher)');
  ok((await post('/api/admin/my-code', { newCode: 'abc' }, flood(NICOLE2))).status === 400, '… while another teacher at the same address is not slowed');

  // ── 7. a restart keeps everything, the old seeds never come back ──
  section('restart');
  await stopServer();
  await startServer();
  const list1 = await listT(SUPER);
  ok(list1.length === 3 && list1.some((t) => t.displayName === 'Profe Luna Prueba') && list1.some((t) => t.displayName === 'Miss Estrella Prueba') &&
    !list1.some((t) => /^Ms (Enni|Nicole)$/.test(t.displayName)), 'names kept; no «Ms Enni» / «Ms Nicole» seeded again');
  ok(readJson('teachers-meta.json').oldSeedsDone > 0, 'the old boot migrations are marked done (one-shot)');
  const sup1 = list1.find((t) => t.uid === sup.uid);
  ok(sup1.accessCodes.includes(NEW3) && sup1.codeLevels[NEW3] === 'hsk2' && !sup1.accessCodes.includes('1002'), 'the renamed class code and its level stay');
  ok((await enter(phone(), '1002', null, k2.studentCode)).status === 401 && (await enter(phone(), NEW3, null, k2.studentCode)).ok, 'the old class code still refused, the new one works');
  ok((await get('/api/admin/students', T(ENNI1))).json.retired && (await get('/api/admin/students', T(ENNI2))).status === 200, 'teacher codes: the retired still refused, the new still works');

  // ── 8. the archive file can't be read: no rename (its kids would be left behind) ──
  section('archive unreadable');
  await stopServer();
  const arcText = fs.readFileSync(path.join(DATA, 'student-archive.json'), 'utf8');
  fs.writeFileSync(path.join(DATA, 'student-archive.json'), '{ not json');
  await startServer();
  const NEW4 = csug.find((c) => c !== NEW2 && c !== NEW3);
  const refused = await put('/api/admin/teacher/' + sup.uid + '/class-code', { from: NEW3, to: NEW4 }, teacherAt()(SUPER));
  ok(refused.status === 503 && /archivadas/.test((refused.json && refused.json.error) || ''), 'a class-code rename is refused, with the reason');
  const sup2 = (await listT(SUPER)).find((t) => t.uid === sup.uid);
  const roster2 = (await get('/api/admin/students', T(SUPER))).json.students;
  ok(sup2.accessCodes.includes(NEW3) && !sup2.accessCodes.includes(NEW4) && roster2.find((s) => s.code === k1.studentCode).classroomCode === NEW3, '… nothing changed');
  ok(fs.readFileSync(path.join(DATA, 'student-archive.json'), 'utf8') === '{ not json', '… and the archive file was not written over');
  await stopServer();
  fs.writeFileSync(path.join(DATA, 'student-archive.json'), arcText);
}

// ── in-process checks (their own temp folder) ──
function unitChecks() {
  section('in-process: word lists, lookups, retired class codes');
  const words = [...CartoonCodes.ANIMALS.map((a) => a[0]), ...CartoonCodes.DESCRIBERS.flat(), ...CartoonCodes.THINGS];
  ok(words.every((w) => /^[A-Z]{2,12}$/.test(w)), 'every word: plain capitals A-Z (no ñ, no accents)');
  ok(CartoonCodes.ANIMALS.length >= 60 && CartoonCodes.DESCRIBERS.length >= 60 && CartoonCodes.THINGS.length >= 60, `60+ words per slot (${CartoonCodes.ANIMALS.length} · ${CartoonCodes.DESCRIBERS.length} · ${CartoonCodes.THINGS.length})`);
  ok(new Set(CartoonCodes.ANIMALS.map((a) => a[0])).size === CartoonCodes.ANIMALS.length && new Set(CartoonCodes.THINGS).size === CartoonCodes.THINGS.length, 'no word twice in a list');
  ok(CartoonCodes.ANIMALS.every((a) => a[1] === 'm' || a[1] === 'f') && CartoonCodes.DESCRIBERS.every((d) => d.length === 2), 'every animal has a gender, every describer both forms');
  ok(!words.some((w) => DENY.has(w)) && !CartoonCodes.NUMBERS.includes('69') && !CartoonCodes.NUMBERS.includes('88'), 'no word or number of the deny list');
  let calls = 0;
  const pickyFirst = CartoonCodes.suggest(() => (++calls > 5));
  ok(cartoonOk(pickyFirst) && calls === 6, 'a suggestion is only one the caller accepts');
  for (let i = 0; i < 2000; i++) { const c = CartoonCodes.suggest(); if (!cartoonOk(c)) { ok(false, 'a suggestion out of shape'); break; } }
  ok(true, '2000 suggestions in shape');

  const UNIT = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-tedit-unit-'));
  const LEG = 'DRAGN-' + letters(4) + '12';   // a code saved before 2026-10-19 from «Dragón-…» (the accented letter dropped)
  fs.writeFileSync(path.join(UNIT, 'teachers.json'), JSON.stringify({ [LEG]: { teacherId: LEG, displayName: 'Prueba Legado', email: null, country: null,
    accessCodes: ['5101'], codeLevels: {}, isSuperAdmin: true, createdAt: Date.now(), lastSeen: Date.now() } }));
  fs.writeFileSync(path.join(UNIT, 'teachers-meta.json'), JSON.stringify({ superAdminSeenAt: 1, retired: [] }));
  const before = process.env.DRALY_DATA_DIR;
  process.env.DRALY_DATA_DIR = UNIT;
  delete require.cache[require.resolve('../core/teachers')];
  const Tch = require('../core/teachers');
  try {
    ok(!!Tch.getByTeacherId(LEG.replace('DRAGN', 'DRAGÓN')), 'an old code saved without its accented letter still works typed as before');
    const n0 = Tch.listAll().length;
    const enniU = Tch.listAll().find((t) => /enni/i.test(t.displayName));
    ok(n0 === 3 && !!enniU, 'a disk that never ran the old seeds gets them once');
    Tch.updateProfile(enniU.uid, { displayName: 'Otra Prueba' });
    Tch.load();
    ok(Tch.listAll().length === n0, '… and never again after a rename (one-shot)');
    const W = letters(4);
    const out = Tch.changeCode(LEG, 'Dragón ' + W + ' 34');
    ok(out.ok && out.teacher.teacherId === 'DRAGON-' + W + '-34', 'a new code typed «Dragón …» keeps its letters: DRAGON-…');
    ok(!!Tch.getByTeacherId('dragón ' + W.toLowerCase() + ' 34') && !!Tch.getByTeacherId('DRAGON' + W + '34') && Tch.isRetired(LEG), '… found with accents, spaces or no dashes; the old one retired');
    ok(!Tch.validateNewCode('DRAGO-N' + W + '34').ok, 'a code that differs from another only by dashes is refused');
    ok(!Tch.getByTeacherId('DRAGON' + W + '3'), 'a near miss finds nobody');
    const supU = Tch.listAll().find((t) => t.isSuperAdmin);
    const all = new Set();
    for (let n = 1000; n < 10000; n++) all.add(String(n));
    ok(Tch.commitClassCodeRename(supU.uid, '5101', '5102').ok, 'a class code renamed in-process');
    ok(Tch.isRetiredClassCode('5101') && !Tch.validateNewClassCode('5101', '', enniU.uid).ok && Tch.validateNewClassCode('5101', '5102', supU.uid).ok,
      'the old class code: retired for other teachers, its own teacher may take it back');
    all.delete('5101'); all.delete('7777');
    Tch.configure({ classCodesOnKids: () => new Set(all) });
    const picks = new Set();
    for (let i = 0; i < 20; i++) picks.add(Tch.suggestClassCode());
    ok(picks.size === 1 && picks.has('7777'), 'a new class code skips codes on kids and retired ones');
    ok(!fs.readdirSync(UNIT).some((f) => /\.tmp$/.test(f)), 'the teacher file is written whole (no .tmp left)');
  } finally {
    if (before === undefined) delete process.env.DRALY_DATA_DIR; else process.env.DRALY_DATA_DIR = before;
    try { fs.rmSync(UNIT, { recursive: true, force: true }); } catch (_) {}
  }
  // an unreadable teachers-meta.json: kept aside, and the one-shot flags fail safe (no seed, no old migrations)
  const UNIT2 = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-tedit-unit-'));
  const SOLO = 'T-' + letters(6);
  fs.writeFileSync(path.join(UNIT2, 'teachers.json'), JSON.stringify({ [SOLO]: { teacherId: SOLO, displayName: 'Prueba Sola', accessCodes: ['5201'],
    codeLevels: {}, isSuperAdmin: true, createdAt: Date.now(), lastSeen: Date.now() } }));
  fs.writeFileSync(path.join(UNIT2, 'teachers-meta.json'), '{ not json');
  process.env.DRALY_DATA_DIR = UNIT2;
  delete require.cache[require.resolve('../core/teachers')];
  try {
    const T2 = require('../core/teachers');
    ok(T2.listAll().length === 1, 'an unreadable meta file: the old migrations do not run again (no teacher seeded)');
    ok(fs.readdirSync(UNIT2).some((f) => /^teachers-meta\.unreadable-\d+\.json$/.test(f)), '… and the file is kept aside, never written over');
  } finally {
    if (before === undefined) delete process.env.DRALY_DATA_DIR; else process.env.DRALY_DATA_DIR = before;
    delete require.cache[require.resolve('../core/teachers')];
    try { fs.rmSync(UNIT2, { recursive: true, force: true }); } catch (_) {}
  }
}
