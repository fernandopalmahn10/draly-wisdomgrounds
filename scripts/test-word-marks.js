#!/usr/bin/env node
// test-word-marks.js — /maestro «Words: easiest and hardest» + a kid's words per experience (2026-10-21).
// His ask: which words the kids mark («¡Me la sé!» in La Base) and which they don't, per experience, to know what to
// practise more. Its OWN server (port 4610, never 3000) on a throw-away data folder with made-up kids and teacher codes
// that are never printed:
//   · GET /api/admin/word-marks?level=: per experience, each word with how many of the kids who STARTED it (marked at
//     least one of its words) marked it; kids who never started an experience don't count; only the teacher's own kids;
//     another teacher sees only hers and is refused a level that is not hers; no teacher code → 401; archived kids are
//     left out (and stay in the archive); no kid name or code in the answer; no code in the server log
//   · GET /api/admin/students/:code: each experience of La Ruta Dorada carries its words (pinyin + Spanish) and whether
//     this kid marked each one
//   node scripts/test-word-marks.js            (--port 4610 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4610));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-wmarks-'));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, trainingLaunchAt: Date.now() }));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);

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
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers) });
const teacher = (code) => ({ headers: { 'CF-Connecting-IP': '198.51.100.250', 'X-Admin-Pw': encodeURIComponent(code) } });
const stamp = (ph, level, add) => post('/api/ruta/seals', { level, add, remove: [] }, as(ph));
const marks = (code, level) => get('/api/admin/word-marks' + (level ? '?level=' + encodeURIComponent(level) : ''), teacher(code));

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '1' }),
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
}
async function enter(ph, accessCode, name) {
  return (await post('/api/homework/enter', { accessCode, displayName: name }, as(ph))).json || {};
}

async function main() {
  const tag = Date.now().toString(36).slice(-4);
  section('two teachers and their YCT 1 kids');
  const mk = async (name) => (await post('/api/admin/teachers', { displayName: name + ' ' + tag, levels: ['yct1'] }, teacher(SEED))).json.teacher;
  const T2 = await mk('Ms Palabras');
  const T3 = await mk('Mr Otra');
  ok(T2 && T2.accessCodes && T2.accessCodes.length && T3 && T3.accessCodes && T3.accessCodes.length, 'two teachers (not super admins), each with her own YCT 1 class code');
  const C2 = T2.accessCodes[0], C3 = T3.accessCodes[0];
  const kids = {};
  const make = async (k, code) => { const ph = phone(); const r = await enter(ph, code, 'Palabra ' + k + ' ' + tag); kids[k] = { ph, code: r.studentCode, name: 'Palabra ' + k + ' ' + tag }; return r; };
  for (const k of ['K1', 'K2', 'K3', 'K4', 'K6']) ok((await make(k, C2)).ok, k + ' joins Ms Palabras\' class');
  ok((await make('K5', C3)).ok, 'K5 joins Mr Otra\'s class');
  // world 1 of YCT 1 = words 1-17, world 2 = 18-29, world 3 = 30-37
  const plan = { K1: [...range(1, 10), 18, 19], K2: range(1, 17), K3: [1, 2], K4: [], K5: [...range(1, 17), 30, 31], K6: [...range(1, 17), 20, 21, 30] };
  for (const [k, list] of Object.entries(plan)) {
    if (!list.length) continue;
    const r = await stamp(kids[k].ph, 'yct1', list);
    ok(r.status === 200 && r.json && r.json.seals && r.json.seals.length === list.length, k + ' marks ' + list.length + ' words');
  }

  section('K6 rests in the archive');
  await sleep(1600);   // the student file is written a second after the last change
  await stopServer();
  const live = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
  const k6 = live[kids.K6.code];
  ok(k6 && k6.ruta && k6.ruta.yct1, 'K6 is on the live file with their marks');
  const arc = {}; arc[kids.K6.code] = k6;
  delete live[kids.K6.code];
  fs.writeFileSync(path.join(DATA, 'student-archive.json'), JSON.stringify(arc));
  fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(live));
  await startServer();

  section('the class view: only her kids, only the kids who started an experience');
  const logBefore = allLog.length;
  const r = await marks(T2.teacherId);
  const d = r.json || {};
  ok(r.status === 200 && d.ok && d.level === 'yct1' && d.name === 'YCT 1', 'her level by default: YCT 1');
  ok(Array.isArray(d.levels) && d.levels.length === 1 && d.levels[0].id === 'yct1', '… the only level in her picker (her class codes)');
  ok(/no-store/.test(r.headers['cache-control'] || ''), '… never cached');
  ok(d.kids === 3, 'kids with marks: K1, K2, K3 (K4 marked nothing, K5 is another class, K6 is archived) → ' + d.kids);
  ok(d.classKids === 4, 'kids in her YCT 1 classes: K1-K4 → ' + d.classKids);
  const w1 = d.worlds && d.worlds[0], w2 = d.worlds && d.worlds[1], w3 = d.worlds && d.worlds[2];
  ok(w1 && w1.n === 1 && w1.count === 17 && w1.words.length === 17 && w1.name, 'experience 1: 17 words, with its name');
  ok(w1.started === 3 && w1.all === 1, 'experience 1: 3 kids started it, 1 marked every word → ' + w1.started + ', ' + w1.all);
  const wd = (w, n) => w.words.find((x) => x.n === n) || {};
  ok(wd(w1, 1).marked === 3 && wd(w1, 5).marked === 2 && wd(w1, 11).marked === 1 && wd(w1, 17).marked === 1, 'word 1 by 3 kids, word 5 by 2, words 11 and 17 by 1');
  ok(w1.words.every((x) => typeof x.py === 'string' && x.py && typeof x.es === 'string' && x.es && !/[一-鿿]/.test(x.py + x.es)), 'each word: pinyin + Spanish, no hanzi');
  ok(w2.started === 1 && wd(w2, 18).marked === 1 && wd(w2, 20).marked === 0 && w2.all === 0, 'experience 2: only K1 started it (2 of 12)');
  ok(w3.started === 0 && w3.words.every((x) => x.marked === 0), 'experience 3: nobody of hers started it (K5 and K6 did, but they don\'t count)');
  ok(d.worlds.length === 6 && d.worlds.every((w) => w.words.every((x) => x.marked <= w.started)), 'never more marks than kids who started');
  const names = Object.values(kids).map((k) => k.name), codes = Object.values(kids).map((k) => k.code);
  ok(!names.some((n) => r.text.includes(n)) && !codes.some((c) => r.text.includes(c)) && !/displayName|"code"/.test(r.text), 'numbers only: no kid name or code in it');

  section('another teacher');
  const r3 = await marks(T3.teacherId, 'yct1');
  ok(r3.status === 200 && r3.json.kids === 1 && r3.json.worlds[0].started === 1 && r3.json.worlds[2].started === 1 && r3.json.worlds[1].started === 0, 'Mr Otra sees only K5');
  ok((await marks(T3.teacherId, 'hsk1')).status === 403, 'a level none of her classes has: refused (403)');
  ok((await marks(T3.teacherId, 'zz9')).status === 400, 'a level that does not exist: 400');
  ok((await get('/api/admin/word-marks?level=yct1', as(kids.K1.ph))).status === 401, 'a kid\'s phone (no teacher code): 401');
  ok((await get('/api/admin/word-marks?level=yct1', teacher('NOT-' + rnd(4)))).status === 401, 'a wrong teacher code: 401');

  section('the super admin');
  const rs = await marks(SEED, 'yct1');
  ok(rs.status === 200 && rs.json.levels.length >= 3 && rs.json.levels.some((l) => l.id === 'hsk2') && rs.json.levels.some((l) => l.id === 'hsk1'), 'every level in the picker');
  ok(rs.json.kids === 4 && rs.json.worlds[0].started === 4 && rs.json.worlds[2].started === 1, 'every live kid with marks (K1, K2, K3, K5), still not the archived K6');
  const rn = await marks(SEED, 'newhsk1');
  ok(rn.status === 200 && rn.json.level === 'hsk2' && rn.json.kids === 0 && rn.json.worlds.length >= 8 && rn.json.worlds.every((w) => w.started === 0), 'New HSK 1 (asked by its curriculum name): no marks yet, every experience listed');

  section('the archive stays the archive');
  await sleep(1200);
  const arcNow = JSON.parse(fs.readFileSync(path.join(DATA, 'student-archive.json'), 'utf8'));
  ok(arcNow[kids.K6.code], 'K6 is still archived after the class view (it never brings anyone back)');

  section('a kid\'s profile: the words per experience');
  const prof = (await get('/api/admin/students/' + kids.K1.code, teacher(T2.teacherId))).json;
  const L0 = prof && prof.ruta && prof.ruta.levels && prof.ruta.levels[0];
  const pw1 = L0 && L0.worlds && L0.worlds[0];
  ok(pw1 && Array.isArray(pw1.words) && pw1.words.length === 17 && pw1.sealed === 10, 'experience 1 carries its 17 words, 10 marked');
  ok(pw1.words.filter((x) => x.m).map((x) => x.n).join(',') === range(1, 10).join(',') && pw1.words.every((x) => x.py && x.es), '… words 1-10 marked ✓, 11-17 not yet, each with pinyin + Spanish');
  ok(L0.worlds[1].words.filter((x) => x.m).length === 2 && L0.worlds[1].words.length === 12, 'experience 2: 2 of 12 marked');
  ok((await get('/api/admin/students/' + kids.K1.code, teacher(T3.teacherId))).status === 403, 'another teacher can\'t open K1\'s profile');
  const act = await post('/api/admin/student/' + kids.K1.code + '/ruta', { level: 'yct1', step: 'train', world: 2, action: 'unlock' }, teacher(T2.teacherId));
  ok(act.json && act.json.ok && act.json.ruta.levels[0].worlds[0].words.length === 17, '«Open early» answers with the words too (the card is drawn again)');

  const logDuring = allLog.slice(logBefore);
  ok(!codes.some((c) => logDuring.includes(c)) && !logDuring.includes(T2.teacherId) && !logDuring.includes(T3.teacherId), 'no kid code or teacher code in the log lines of these calls');
}

(async () => {
  let crashed = false;
  await startServer();
  try { await main(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) ok(!allLog.includes(SEED) && !allLog.includes(LEGACY), 'no teacher code in the server log');
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-word-marks: ${failed} FAILED, ${passed} passed` : `test-word-marks: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
