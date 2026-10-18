#!/usr/bin/env node
// test-homework-ownership.js — a kid's record answers only to that kid's own phone (2026-10-18, the security fix «homework
// endpoints missing ownership checks»). Its OWN server (port 4490, never 3000) on a temporary data folder with MADE-UP kids
// and a throw-away teacher code that is never printed. Never data/, never the live site. Checks:
//   · every homework write and kid-specific read refuses a stranger (another class code + the kid's student code) and
//     still works for the kid's own phone (their class code): daily complete / sentence bonus / daily read, reading-test
//     submit / review / list / open, custom assignments list / open / submit, inbox read / read-all, exam attempts list,
//     assignment review
//   · a PIN game: a stranger's join with the kid's code never renames that kid nor links the game to them (a fresh
//     account, `guest: true` so the phone keeps its own saved code); the kid's own phone (its class code) links as before;
//     an exam room (hsksim) still links the typed code (the teacher's class, school tablets) but never renames the kid
//   node scripts/test-homework-ownership.js        (--port 4490 · --keep to leave the server running)
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
const PORT = Number(opt('port', 4490));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-own-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const Reading = require('../core/reading-story');
const STORY = Object.keys(Reading.STORIES || {})[0];

// made-up kids: KIDA in the New HSK 1 class (its class code is the level's code of the seeded super admin), with a
// reading-test try, an exam try, a custom assignment and a message
const NOW = Date.now(), DAY = 86400e3;
const CLASS = '1002', OTHER = '1001';
const SEEDED = {
  KIDA: { code: 'KIDA', displayName: 'Kid Prueba', avatar: 'dralingo', classroomCode: CLASS, classroomId: null, firstSeen: NOW - 40 * DAY,
    lastSeen: NOW - DAY, sentencesBuilt: [], level: 'hsk2', swords: 3,
    testResults: [{ storyId: STORY, storyTitle: 'x', score: 60, ts: NOW - 2 * DAY, breakdown: [{ i: 0, correctIdx: 1, picked: 0 }] }],
    hskResults: [{ simId: 'newhsk1-sim1', score: 150, total: 200, percent: 75, ts: NOW - 2 * DAY, wrongQs: [3] }],
    inbox: [{ id: 'm1', text: 'Hola', ts: NOW - DAY, read: false }] },
};
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));

function req(method, p, o = {}) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({ 'CF-Connecting-IP': o.ip || '198.51.100.7' }, o.headers || {});
    let data = null;
    if (o.body !== undefined) { data = Buffer.from(JSON.stringify(o.body)); h['Content-Type'] = 'application/json'; h['Content-Length'] = data.length; }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, text, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
const q = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const records = () => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8')); } catch (_) { return {}; } };
let ipN = 20;
const sock = () => io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '' }),
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

async function run() {
  const mine = { accessCode: CLASS, studentCode: 'KIDA' };
  const theirs = { accessCode: OTHER, studentCode: 'KIDA' };   // a valid class code, but not KIDA's own
  ok(STORY, 'a reading story to test with');

  section('homework writes: refused for a stranger, open for the kid\'s own phone');
  const today = new Date().toISOString().slice(0, 10);
  let r = await post('/api/homework/daily/complete', Object.assign({ date: today, correct: 5 }, theirs));
  ok(r.status === 403, 'daily/complete: a stranger is refused (' + r.status + ')');
  r = await post('/api/homework/daily/complete', Object.assign({ date: today, correct: 5 }, mine));
  ok(r.status === 200 && r.json && r.json.ok !== undefined, 'daily/complete: the kid\'s own phone works (' + r.status + ')');
  r = await post('/api/homework/daily/sentence-bonus', Object.assign({ date: today, wordIds: ['a', 'b'] }, theirs));
  ok(r.status === 403, 'daily/sentence-bonus: a stranger is refused');
  r = await post('/api/homework/daily/sentence-bonus', Object.assign({ date: today, wordIds: ['a', 'b'] }, mine));
  ok(r.status === 200, 'daily/sentence-bonus: the kid\'s own phone works');
  r = await post('/api/homework/reading-test/submit', Object.assign({ storyId: STORY, answers: [1, 1, 1, 1, 1] }, theirs));
  ok(r.status === 403, 'reading-test/submit: a stranger is refused');
  r = await post('/api/homework/reading-test/submit', Object.assign({ storyId: STORY, answers: [1, 1, 1, 1, 1] }, mine));
  ok(r.status === 200 && r.json && r.json.ok, 'reading-test/submit: the kid\'s own phone works');
  r = await post('/api/homework/custom-assignment/submit', Object.assign({ assignmentId: 'nope', answers: [] }, theirs));
  ok(r.status === 403, 'custom-assignment/submit: a stranger is refused before anything else');
  r = await post('/api/homework/custom-assignment/submit', Object.assign({ assignmentId: 'nope', answers: [] }, mine));
  ok(r.status === 404, 'custom-assignment/submit: the kid\'s own phone gets past the check (no such assignment: 404)');
  r = await post('/api/homework/inbox/m1/read', theirs);
  ok(r.status === 403, 'inbox read: a stranger is refused');
  r = await post('/api/homework/inbox/read-all', theirs);
  ok(r.status === 403, 'inbox read-all: a stranger is refused');
  r = await post('/api/homework/inbox/read-all', mine);
  ok(r.status === 200 && r.json && r.json.ok, 'inbox read-all: the kid\'s own phone works');

  section('kid-specific reads: refused for a stranger, open for the kid\'s own phone');
  const reads = [
    ['/api/homework/daily?' + q(Object.assign({ date: today }, theirs)), '/api/homework/daily?' + q(Object.assign({ date: today }, mine)), 'daily'],
    ['/api/homework/my-hsk-attempts/KIDA?' + q({ accessCode: OTHER }), '/api/homework/my-hsk-attempts/KIDA?' + q({ accessCode: CLASS }), 'exam attempts'],
    ['/api/homework/reading-review/' + STORY + '?' + q(theirs), '/api/homework/reading-review/' + STORY + '?' + q(mine), 'reading review'],
    ['/api/homework/custom-assignments/KIDA?' + q({ accessCode: OTHER }), '/api/homework/custom-assignments/KIDA?' + q({ accessCode: CLASS }), 'custom assignments'],
    ['/api/homework/assignment-review/x?' + q(theirs), '/api/homework/assignment-review/x?' + q(mine), 'assignment review'],
  ];
  for (const [bad, good, what] of reads) {
    const rb = await get(bad);
    const rg = await get(good);
    ok(rb.status === 403, what + ': a stranger is refused (' + rb.status + ')');
    ok(rg.status === 200, what + ': the kid\'s own phone works (' + rg.status + ')');
  }
  const listBad = await get('/api/homework/reading-tests?' + q(theirs));
  const listGood = await get('/api/homework/reading-tests?' + q(mine));
  const triedOf = (resp) => ((resp.json && resp.json.stories) || []).some((s) => s.best != null || s.triedInClass || s.bestScore != null);
  ok(listBad.status === 200 && !triedOf(listBad), 'reading-tests: a stranger gets the plain list, none of the kid\'s tries');
  ok(listGood.status === 200 && triedOf(listGood), 'reading-tests: the kid\'s own phone sees their tries');

  section('PIN games: a stranger\'s join never renames or links the kid');
  const host = sock();
  const room = await emitAck(host, 'host:create', { gameType: 'mochi-mash', password: SEED });
  ok(room && room.pin, 'a teacher opens a game');
  const s1 = sock();
  const j1 = await emitAck(s1, 'player:join', { pin: room.pin, name: 'Intruso', avatar: '', studentCode: 'KIDA', accessCode: OTHER });
  ok(j1.ok && j1.studentCode && j1.studentCode !== 'KIDA' && j1.guest === true, 'a stranger with the kid\'s code plays under a fresh account (guest: the phone keeps its saved code)');
  const s2 = sock();
  const j2 = await emitAck(s2, 'player:join', { pin: room.pin, name: 'Kid Prueba', avatar: '', studentCode: 'KIDA', accessCode: CLASS });
  ok(j2.ok && j2.studentCode === 'KIDA' && !j2.guest, 'the kid\'s own phone (its class code) links to the kid as before');
  await sleep(1600);
  ok(records().KIDA && records().KIDA.displayName === 'Kid Prueba', 'the kid\'s name was never changed by the stranger');

  section('an exam room: the typed code still links (teacher-supervised), but never renames');
  const ex = await emitAck(host, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: SEED });
  if (ex && ex.pin) {
    const s3 = sock();
    const j3 = await emitAck(s3, 'player:join', { pin: ex.pin, name: 'Otro Nombre', avatar: '', studentCode: 'KIDA', accessCode: '' });
    ok(j3.ok && j3.studentCode === 'KIDA' && !j3.guest, 'an exam-room join with the typed code links to the kid (school tablets keep working)');
    await sleep(1600);
    ok(records().KIDA && records().KIDA.displayName === 'Kid Prueba', '… but the unproven join did not rename the kid');
    s3.close();
  } else ok(false, 'a teacher opens an exam room (' + JSON.stringify(ex) + ')');
  [host, s1, s2].forEach((s) => s.close());
}

(async () => {
  let crashed = false;
  await startServer();
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) ok(!allLog.includes(SEED) && !allLog.includes(LEGACY), 'no teacher code in the server log');
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-homework-ownership: ${failed} FAILED, ${passed} passed` : `test-homework-ownership: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
