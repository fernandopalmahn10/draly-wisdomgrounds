#!/usr/bin/env node
// test-ruta-progress.js — La Ruta Dorada, phase 3 (2026-10-16): the kid's seals on their record + the unlock engine.
// Two parts, both on MADE-UP accounts in temporary folders (never data/, never the live site):
//   1. in this process (core/ruta-progress.js + core/student-records.js on a temp folder): the seal ranges, the record
//      stays small, archive → restore keeps the seals, the settings only fill what is missing, El Entrenamiento world by
//      world, «Desbloquear» / «Volver a bloquear», El Simulacro Dorado by key (switch OFF) and by practice (switch ON),
//      recordPractice (phase 4's call)
//   2. its OWN server (port 4420, never 3000) with throw-away teacher codes and level keys that are never printed:
//      GET/POST /api/ruta/seals (save, any phone, unstamp, union, validation, rate limit, access per level), every kind
//      of visitor (grandfathered kid · new kid without the key · key-only phone · anonymous · teacher), the route's
//      progress (/api/ruta-dorada), /maestro (a kid's profile, «Desbloquear» / «Volver a bloquear» per step, the roster
//      bar, the rules: teachers read, only the super admin changes), the /homework login's seal count
//   node scripts/test-ruta-progress.js            (--port 4420 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4420));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eqList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. in this process
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const UNIT = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-rprog-unit-'));
process.env.DRALY_DATA_DIR = UNIT;
process.env.STUDENT_DATA_DIR = UNIT;
const DAY = 86400e3, NOW = Date.now();
fs.writeFileSync(path.join(UNIT, 'student-records.json'), JSON.stringify({
  AAAA: { code: 'AAAA', displayName: 'Kid A', firstSeen: NOW - 60 * DAY, lastSeen: NOW, level: 'yct1', sentencesBuilt: [] },
  BBBB: { code: 'BBBB', displayName: 'Kid B', firstSeen: NOW - 90 * DAY, lastSeen: NOW - 45 * DAY, level: 'yct1', sentencesBuilt: [],
    ruta: { yct1: { s: '1-17,20', at: NOW - 45 * DAY, tw: [3] } } },
  CCCC: { code: 'CCCC', displayName: 'Kid C', firstSeen: NOW - 10 * DAY, lastSeen: NOW, level: 'hsk2', sentencesBuilt: [] },
}));
const Levels = require('../core/levels');
const S = require('../core/student-records');
const RP = require('../core/ruta-progress');

function unit() {
  section('the seals as ranges');
  ok(RP.encodeSeals(new Set([1, 2, 3, 5, 7, 8])) === '1-3,5,7-8', 'encode {1,2,3,5,7,8} → 1-3,5,7-8');
  ok(eqList([...RP.decodeSeals('1-3,5,7-8', 83)], [1, 2, 3, 5, 7, 8]), 'decode gives the same numbers back');
  ok(RP.decodeSeals('1-9999', 83).size === 83 && !RP.decodeSeals('1-9999', 83).has(84), 'decode never goes past the base (1-9999 → 83 words)');
  ok(RP.decodeSeals('x,-4,0,3-1,5;6,12', 83).size === 1 && RP.decodeSeals('x,-4,0,3-1,5;6,12', 83).has(12), 'decode drops anything that is not a word number');
  ok(RP.encodeSeals(new Set(range(1, 300))) === '1-300', 'a whole 300-word base is 5 characters');
  const alt = new Set(range(1, 300).filter((n) => n % 2));
  ok(RP.encodeSeals(alt).length < 900 && RP.decodeSeals(RP.encodeSeals(alt), 300).size === 150, 'the worst case (every other word) stays under 1 KB');

  section('the bases the engine reads (core/levels.js `base` + the catalog)');
  Levels.LEVELS.filter((l) => l.base).forEach((l) => {
    const b = RP.baseOf(l.id);
    ok(b && b.words > 0 && b.worlds.length > 0 && b.worlds.reduce((a, w) => a + w.count, 0) === b.words, `${l.name}: ${b ? b.words : '?'} words in ${b ? b.worlds.length : '?'} worlds that add up`);
    ok(b && b.worlds.every((w) => w.short && w.first >= 1), `${l.name}: each world has its short name and first word`);
  });
  ok(RP.baseOf('newhsk1') === RP.baseOf('hsk2'), 'newhsk1 is the curriculum name of the stored id hsk2');
  ok(RP.baseOf('zz9') === null, 'an unknown level has no base');
  const Y = RP.baseOf('yct1');

  section('settings: only fill what is missing');
  ok(RP.getSettings().trainingLive === false && RP.getSettings().doradoPct === 70, 'defaults: El Entrenamiento not live, 70 %');
  ok(!RP.setSettings({ doradoPct: 49 }).ok && !RP.setSettings({ doradoPct: 101 }).ok && !RP.setSettings({ doradoPct: 'x' }).ok && !RP.setSettings({ doradoPct: 72.5 }).ok, 'the % must be a whole number from 50 to 100');
  ok(!RP.setSettings({ trainingLive: 'yes' }).ok && !RP.setSettings({}).ok, 'the switch takes only true / false; an empty change is refused');
  ok(RP.setSettings({ doradoPct: 85 }).ok && RP.getSettings().doradoPct === 85, 'a valid % is saved');
  RP.loadSettings();
  ok(RP.getSettings().doradoPct === 85 && RP.getSettings().trainingLive === false, '… and survives a restart (boot never forces it back)');
  fs.writeFileSync(RP.SETTINGS_FILE, JSON.stringify({ doradoPct: 'oops', trainingLive: true }));
  RP.loadSettings();
  ok(RP.getSettings().doradoPct === 70 && RP.getSettings().trainingLive === true, 'a broken value takes its default, a good one is kept');
  fs.writeFileSync(RP.SETTINGS_FILE, '{not json');
  RP.loadSettings();
  ok(RP.getSettings().trainingLive === false && fs.readdirSync(UNIT).some((f) => /^ruta-settings\.unreadable-/.test(f)), 'an unreadable settings file is kept aside, never written over');
  ok(RP.setSettings({ trainingLive: false, doradoPct: 70 }).ok, 'back to the defaults');

  section('seals on a record (applySeals)');
  ok(RP.applySeals('AAAA', 'yct1', [1, 2, 3], []).ok, 'stamps 1, 2, 3');
  ok(eqList(RP.applySeals('AAAA', 'yct1', [5], [2]).seals, [1, 3, 5]), 'stamp 5 and unstamp 2 → 1, 3, 5');
  ok(eqList(RP.applySeals('AAAA', 'yct1', [3, 5], []).seals, [1, 3, 5]), 'stamping again changes nothing (a union)');
  ok(!RP.applySeals('AAAA', 'yct1', [84], []).ok && !RP.applySeals('AAAA', 'yct1', [0], []).ok && !RP.applySeals('AAAA', 'yct1', ['3'], []).ok,
    'word 84 of an 83-word base, 0, and a number in quotes are refused');
  ok(!RP.applySeals('AAAA', 'yct1', [7], [7]).ok && !RP.applySeals('AAAA', 'yct1', 'x', []).ok, 'the same word stamped and unstamped at once, or not a list: refused');
  ok(RP.applySeals('AAAA', 'zz9', [1], []).status === 404 && RP.applySeals('ZZZZ', 'yct1', [1], []).status === 404, 'an unknown level or account: 404');
  ok(S.get('AAAA').ruta.yct1.s === '1,3,5' && Object.keys(S.get('AAAA').ruta).join() === 'yct1', 'stored as ranges, under the stored level id');
  ok(eqList(RP.applySeals('CCCC', 'newhsk1', [1, 2], []).seals, [1, 2]) && S.get('CCCC').ruta.hsk2, 'New HSK 1 seals land under hsk2 (its stored id)');
  RP.applySeals('AAAA', 'yct1', [], [1, 3, 5]);
  ok(!S.get('AAAA').ruta, 'unstamping every seal leaves nothing behind on the record');
  RP.applySeals('AAAA', 'yct1', range(1, 83), []);
  ok(JSON.stringify(S.get('AAAA').ruta).length < 60 && S.get('AAAA').ruta.yct1.s === '1-83', 'every YCT 1 seal: the record grows by ' + JSON.stringify(S.get('AAAA').ruta).length + ' characters');
  RP.applySeals('AAAA', 'yct1', [], range(18, 83));

  section('El Entrenamiento opens world by world');
  let st = RP.state(S.get('AAAA'), 'yct1');
  ok(st.sealed === 17 && st.worlds[0].sealed === 17 && st.worlds[0].train && st.worlds[0].via === 'seals', 'all 17 seals of world 1 → world 1 open (its seals)');
  ok(st.worlds.slice(1).every((w) => !w.train && w.via === null) && st.train.open === 1 && st.train.of === Y.worlds.length, 'the other worlds stay closed: 1 of ' + Y.worlds.length);
  RP.applySeals('AAAA', 'yct1', [], [17]);
  ok(!RP.state(S.get('AAAA'), 'yct1').worlds[0].train, 'one seal less → world 1 closes again');
  ok(RP.state(null, 'yct1', { seals: new Set(range(18, 29)) }).worlds[1].train, 'a key-only phone counts its own seals (world 2 = words 18-29)');
  ok(RP.state(null, 'yct1', { seals: new Set([999, -1, 18]) }).sealed === 1, '… never more than its base');

  section('«Desbloquear» / «Volver a bloquear» per step');
  ok(RP.setTeacherUnlock('AAAA', 'yct1', 'train', 3, true).ok && RP.state(S.get('AAAA'), 'yct1').worlds[2].via === 'teacher', 'a teacher opens world 3');
  ok(RP.setTeacherUnlock('AAAA', 'yct1', 'train', 3, false).ok && !RP.state(S.get('AAAA'), 'yct1').worlds[2].train, '«Volver a bloquear» closes it');
  RP.applySeals('AAAA', 'yct1', [17], []);
  RP.setTeacherUnlock('AAAA', 'yct1', 'train', 1, false);
  ok(RP.state(S.get('AAAA'), 'yct1').worlds[0].train, 'a world the kid\'s seals opened stays open after «Volver a bloquear»');
  RP.setTeacherUnlock('AAAA', 'yct1', 'train', 'all', true);
  st = RP.state(S.get('AAAA'), 'yct1');
  ok(st.train.all && st.train.open === st.train.of && S.get('AAAA').ruta.yct1.tw === 'all', 'all worlds at once (stored as \'all\')');
  RP.setTeacherUnlock('AAAA', 'yct1', 'train', 2, false);
  st = RP.state(S.get('AAAA'), 'yct1');
  ok(!st.worlds[1].train && st.train.open === st.train.of - 1 && Array.isArray(S.get('AAAA').ruta.yct1.tw), 'then one world locked again: the others stay open');
  RP.setTeacherUnlock('AAAA', 'yct1', 'train', 'all', false);
  st = RP.state(S.get('AAAA'), 'yct1');
  ok(st.train.open === 1 && !S.get('AAAA').ruta.yct1.tw, '«Volver a bloquear» all: back to what the seals opened');
  ok(!RP.setTeacherUnlock('AAAA', 'yct1', 'train', 99, true).ok && !RP.setTeacherUnlock('AAAA', 'yct1', 'oops', 1, true).ok, 'a world or step that does not exist: refused');

  section('El Simulacro Dorado: the key until El Entrenamiento is live, then practice');
  const keyA = { ok: true, via: 'student' };
  ok(RP.state(S.get('AAAA'), 'yct1').dorado.rule === 'key' && RP.doradoOpen(keyA, S.get('AAAA'), 'yct1'), 'switch OFF: open with the key');
  ok(!RP.doradoOpen({ ok: false }, S.get('AAAA'), 'yct1'), '… never without the key');
  ok(RP.doradoOpen({ ok: true, via: 'key' }, null, 'yct1'), '… a key-only phone too');
  RP.setSettings({ trainingLive: true });
  st = RP.state(S.get('AAAA'), 'yct1');
  ok(st.dorado.rule === 'practice' && !st.dorado.open && st.dorado.practiced === 0 && st.dorado.of === Y.worlds.length, 'switch ON: closed until every world is practised');
  ok(!RP.doradoOpen({ ok: true, via: 'key' }, null, 'yct1') && RP.doradoOpen({ ok: true, via: 'teacher' }, null, 'yct1'), '… a phone alone can\'t earn it; a teacher always opens it');
  ok(RP.recordPractice('AAAA', 'yct1', 1, 69.6).best === 70 && RP.recordPractice('AAAA', 'yct1', 1, 40).best === 70, 'recordPractice keeps the best % per world (70, not 40)');
  ok(!RP.recordPractice('AAAA', 'yct1', 99, 80).ok && !RP.recordPractice('AAAA', 'yct1', 1, 101).ok && !RP.recordPractice('AAAA', 'yct1', 1, 'x').ok, '… a world that does not exist or a % out of 0-100: refused');
  Y.worlds.slice(1, -1).forEach((w) => RP.recordPractice('AAAA', 'yct1', w.n, 90));
  ok(!RP.state(S.get('AAAA'), 'yct1').dorado.open && RP.state(S.get('AAAA'), 'yct1').dorado.practiced === Y.worlds.length - 1, 'every world but one: still closed');
  RP.recordPractice('AAAA', 'yct1', Y.worlds[Y.worlds.length - 1].n, 69);
  ok(!RP.state(S.get('AAAA'), 'yct1').dorado.open, 'the last one at 69 %: still closed');
  RP.recordPractice('AAAA', 'yct1', Y.worlds[Y.worlds.length - 1].n, 70);
  st = RP.state(S.get('AAAA'), 'yct1');
  ok(st.dorado.open && st.dorado.via === 'practice' && RP.doradoOpen(keyA, S.get('AAAA'), 'yct1'), 'every world with 70 % → open (by practice)');
  RP.setSettings({ doradoPct: 95 });
  ok(!RP.state(S.get('AAAA'), 'yct1').dorado.open, 'the % raised to 95 → closed again (the rule is read live)');
  ok(RP.setTeacherUnlock('AAAA', 'yct1', 'dorado', null, true).ok && RP.state(S.get('AAAA'), 'yct1').dorado.via === 'teacher', '«Desbloquear» opens it');
  ok(RP.setTeacherUnlock('AAAA', 'yct1', 'dorado', null, false).ok && !RP.state(S.get('AAAA'), 'yct1').dorado.open, '«Volver a bloquear» closes it');
  ok(RP.trainWorldOpen(keyA, S.get('AAAA'), 'yct1', 1) && !RP.trainWorldOpen(keyA, S.get('AAAA'), 'yct1', 2) && !RP.trainWorldOpen({ ok: false }, S.get('AAAA'), 'yct1', 1)
    && RP.trainWorldOpen({ ok: true, via: 'teacher' }, null, 'yct1', 2), 'trainWorldOpen (phase 4\'s door): the kid\'s world 1, not world 2, nothing without the key, everything for a teacher');
  RP.setSettings({ trainingLive: false, doradoPct: 70 });

  section('archive → restore keeps the seals');
  ok(S.flushNow() === true, 'saved');
  const r = S.archiveInactive(30, NOW);
  ok(r.moved === 1 && !S.listAll().some((x) => x.code === 'BBBB'), 'Kid B (45 days away) moves to the archive');
  const arc = JSON.parse(fs.readFileSync(path.join(UNIT, 'student-archive.json'), 'utf8'));
  ok(arc.BBBB && arc.BBBB.ruta.yct1.s === '1-17,20', '… with their seals');
  ok(eqList(RP.applySeals('BBBB', 'yct1', [21], []).seals, [...range(1, 17), 20, 21]), 'their next stamp brings them back (Students.get) with every seal');
  st = RP.state(S.get('BBBB'), 'yct1');
  ok(S.archiveStats().archived === 0 && st.worlds[0].via === 'seals' && st.worlds[2].via === 'teacher', '… and their teacher\'s «Desbloquear» of world 3');
  ok(S.listAll().find((x) => x.code === 'BBBB').ruta.yct1.s === '1-17,20-21', 'the teacher list sees it (listAll carries ruta for the roster bar)');
  ok(S.flushNow() === true, 'saved again');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. its own server
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-rprog-'));
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
const put = (p, body, o = {}) => req('PUT', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, (extra && extra.headers) || {}) });
const teacher = (code) => ({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(code)) });
const seals = (ph, level) => get('/api/ruta/seals?level=' + encodeURIComponent(level), as(ph));
const stamp = (ph, level, add, remove) => post('/api/ruta/seals', { level, add: add || [], remove: remove || [] }, as(ph));
const ruta = async (o) => { const r = await get('/api/ruta-dorada', o); return Object.assign(r.json || {}, { _r: r }); };
const mod = (st, id) => (st.modules || []).find((m) => m.id === id);

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '' }),
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
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}

async function server() {
  const stamp36 = Date.now().toString(36).slice(-4);
  const Y = RP.baseOf('yct1');

  // ── the cast ──
  section('the kids, the keys, the teachers');
  const A1 = phone();
  const kidA = await enter(A1, '1003', 'Progreso A ' + stamp36);
  ok(kidA.ok && kidA.levelOpen === true && kidA.level === 'yct1', 'a YCT 1 kid enrolled before the keys');
  const rateKid = await enter(phone(), '1003', 'Progreso R ' + stamp36);
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);
  const N1 = phone();
  const kidN = await enter(N1, '1003', 'Progreso N ' + stamp36);
  ok(kidN.ok && kidN.levelOpen === false, 'a kid enrolled after the keys, without the key: locked');
  const K1 = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(K1))).json.ok, 'a phone that typed the YCT 1 key (nobody logged in)');
  const anon = phone();
  const t2 = await post('/api/admin/teachers', { displayName: 'Ms Prueba ' + stamp36, levels: ['yct1'] }, teacher(SEED));
  const T2 = t2.json && t2.json.teacher;
  ok(T2 && T2.teacherId && T2.accessCodes && T2.accessCodes.length, 'a second teacher (not super admin) with her own YCT 1 class code');

  // ── seals on the account ──
  section('a logged-in kid\'s seals live on their account');
  let g = await seals(A1, 'yct1');
  ok(g.status === 200 && g.json.student === true && /^[a-f0-9]{12}$/.test(g.json.who) && eqList(g.json.seals, []), 'GET: their account, no seals yet, an opaque id (never the code)');
  ok(!g.text.includes(kidA.studentCode) && /no-store/.test(g.headers['cache-control'] || ''), '… the code is not in it, and it is never cached');
  let p = await stamp(A1, 'yct1', [1, 2, 3]);
  ok(p.status === 200 && eqList(p.json.seals, [1, 2, 3]) && p.json.who === g.json.who, 'POST stamps 1, 2, 3');
  const A2 = phone();
  ok((await enter(A2, '1003', null, kidA.studentCode)).levelOpen === true, 'the same kid logs in on another phone');
  g = await seals(A2, 'yct1');
  ok(eqList(g.json.seals, [1, 2, 3]) && g.json.who === p.json.who, '… and sees the same seals there');
  ok(eqList((await stamp(A2, 'yct1', [], [2])).json.seals, [1, 3]), 'unstamps 2 on that phone');
  ok(eqList((await seals(A1, 'yct1')).json.seals, [1, 3]), '… the first phone sees it');
  ok(eqList((await stamp(A1, 'yct1', [3, 4, 5])).json.seals, [1, 3, 4, 5]), 'a phone\'s own seals join the account (a union: 3 twice is one seal)');
  ok(eqList((await stamp(A1, 'yct1', [], [])).json.seals, [1, 3, 4, 5]), 'an empty batch changes nothing');

  section('only valid word numbers, only a level the request may use');
  for (const [body, why] of [[{ level: 'yct1', add: [84] }, 'word 84 (YCT 1 has 83)'], [{ level: 'yct1', add: [0] }, 'word 0'], [{ level: 'yct1', add: ['7'] }, 'a number in quotes'],
    [{ level: 'yct1', add: [1.5] }, 'a fraction'], [{ level: 'yct1', add: [9], remove: [9] }, 'the same word stamped and unstamped'], [{ level: 'yct1', add: 'all' }, 'not a list'],
    [{ level: 'yct1', add: range(1, 200) }, 'more numbers than the base has twice over']]) {
    const r = await post('/api/ruta/seals', body, as(A1));
    ok(r.status === 400 && r.json && r.json.ok === false, `refused: ${why}`);
  }
  ok((await post('/api/ruta/seals', { level: 'zz9', add: [1] }, as(A1))).status === 404 && (await seals(A1, 'zz9')).status === 404, 'a level that does not exist: 404');
  ok((await post('/api/ruta/seals', { level: 'hsk1', add: [1] }, as(A1))).status === 401 && (await seals(A1, 'hsk1')).status === 401, 'HSK 1 (no key on this account or phone): 401');
  ok(eqList((await seals(A1, 'yct1')).json.seals, [1, 3, 4, 5]), '… nothing of it reached the account');
  ok((await seals(anon, 'yct1')).status === 401 && (await stamp(anon, 'yct1', [1])).status === 401, 'anonymous (no key, no login): 401');
  ok((await seals(N1, 'yct1')).status === 401 && (await stamp(N1, 'yct1', [1])).status === 401, 'a new kid without the key: 401 (logged in is not enough)');
  g = await seals(K1, 'yct1');
  ok(g.status === 200 && g.json.student === false && !('seals' in g.json), 'a key-only phone: student: false (its seals stay on the phone)');
  p = await stamp(K1, 'yct1', [1]);
  ok(p.status === 403 && p.json.student === false, '… and nothing is saved for it on the server');
  ok((await post('/api/admin/student/' + kidA.studentCode + '/level-access', { level: 'hsk2' }, teacher(SEED))).json.ok, 'a teacher opens New HSK 1 on kid A\'s account');
  ok(eqList((await stamp(A1, 'newhsk1', [1, 2])).json.seals, [1, 2]) && eqList((await seals(A1, 'hsk2')).json.seals, [1, 2]), 'New HSK 1 seals by its curriculum name (newhsk1) or its stored id (hsk2): the same');

  section('rate limit');
  const R1 = phone();
  ok((await enter(R1, '1003', null, rateKid.studentCode)).ok, 'another kid (logged in)');
  let first429 = 0;
  for (let i = 1; i <= 95 && !first429; i++) { const r = await stamp(R1, 'yct1', [1 + (i % 80)]); if (r.status === 429) first429 = i; }
  ok(first429 === 91, '90 saves in a minute pass, the 91st waits (' + first429 + ')');
  const w = await stamp(R1, 'yct1', [2]);
  ok(w.status === 429 && Number(w.headers['retry-after']) > 0 && /Espera/.test(w.json.error), '… with Retry-After and a kind message');
  ok((await stamp(A1, 'yct1', [6])).status === 200, 'another kid on another address is not slowed down');

  // ── the route ──
  section('the route shows it (/api/ruta-dorada)');
  let st = await ruta(as(A1));
  let m = mod(st, 'yct1');
  ok(st.student && st.who === (await seals(A1, 'yct1')).json.who, 'the kid\'s opaque id comes with the state (the page trusts a phone\'s mirror only when it is theirs)');
  ok(m.progress && m.progress.sealed === 5 && m.progress.words === Y.words && m.progress.worlds.length === Y.worlds.length, `their YCT 1 progress: 5 of ${Y.words} seals in ${Y.worlds.length} worlds`);
  ok(m.progress.worlds[0].sealed === 5 && m.progress.train.open === 0 && m.progress.train.live === false, 'world 1 has 5 seals; no world ready yet; El Entrenamiento not live');
  ok(m.base.worlds.length === Y.worlds.length && m.base.worlds.every((x) => x.short && x.first && x.count), 'an open module names its worlds (number, short name, first word, count)');
  ok(m.dorado && m.dorado.open === true && m.dorado.rule === 'key' && m.sims.length === m.simCount, 'El Simulacro Dorado: open with the key, its sims listed');
  await stamp(A1, 'yct1', range(1, Y.worlds[0].count));
  m = mod(await ruta(as(A1)), 'yct1');
  ok(m.progress.worlds[0].train && m.progress.train.open === 1 && !m.progress.worlds[1].train, 'every seal of world 1 → world 1 of El Entrenamiento opens (1 of ' + Y.worlds.length + ')');
  ok(mod(await ruta(as(A2)), 'yct1').progress.train.open === 1, '… on the other phone too');
  ok(mod(await ruta(as(A1)), 'hsk2').progress.sealed === 2 && mod(await ruta(as(A1)), 'hsk1').progress === null, 'New HSK 1 (opened by the teacher) has its own progress; HSK 1 (locked) has none');
  const an = await ruta(as(anon));
  ok(an.modules.every((x) => !x.progress && !x.dorado && !(x.base && x.base.worlds)) && an.who === null, 'anonymous: nothing personal, no worlds, no Dorado state');
  const kd = mod(await ruta(as(K1)), 'yct1');
  ok(kd.open && kd.progress === null && kd.base.worlds.length === Y.worlds.length && kd.dorado.open && kd.sims.length > 0, 'a key-only phone: the worlds (its page counts its own seals), the Dorado and the sims, no account progress');
  const nk = mod(await ruta(as(N1)), 'yct1');
  ok(!nk.open && !nk.progress && !nk.dorado && !(nk.base && nk.base.worlds), 'a new kid without the key: locked, nothing of the path');
  const tr = await ruta(teacher(SEED));
  ok(tr.teacher && tr.modules.every((x) => x.open && !x.progress && x.dorado.open), 'a teacher: every module open, no kid progress');
  ok(!st._r.text.includes(SEED) && !(await seals(A1, 'yct1')).text.includes(SEED), 'no teacher code in anything a kid gets');

  section('/homework: the login brings the account\'s seals');
  const A3 = phone();
  const re = await enter(A3, '1003', null, kidA.studentCode);
  ok(re.base && Array.isArray(re.base.seals) && re.base.seals.length === Y.worlds[0].count && re.base.who === st.who, 'the «La Ruta Dorada de YCT 1» count on their home: their account\'s seals and id');

  // ── /maestro ──
  section('/maestro: a kid\'s profile');
  const prof = (await get('/api/admin/students/' + kidA.studentCode, teacher(SEED))).json;
  const L0 = prof && prof.ruta && prof.ruta.levels && prof.ruta.levels[0];
  ok(L0 && L0.id === 'yct1' && L0.own && L0.open && L0.via === 'grandfathered', 'their class level first, open (enrolled before the keys)');
  ok(L0.sealed === Y.worlds[0].count && L0.worlds.length === Y.worlds.length && L0.worlds[0].via === 'seals' && L0.worlds[0].name, 'seals per world, world 1 open by their seals, world names');
  ok(L0.dorado.rule === 'key' && L0.sims.length > 0 && L0.sims.every((s) => s.best === null && s.tries === 0), 'El Simulacro Dorado (the key rule) and each sim (no try yet)');
  ok(prof.ruta.levels.some((l) => l.id === 'hsk2' && l.open && l.via === 'teacher' && l.sealed === 2), 'New HSK 1 (opened by a teacher, 2 seals) is listed too');
  ok(prof.ruta.settings.trainingLive === false && prof.ruta.settings.doradoPct === 70, 'the rules in force come with it');
  const act = (code, body, who) => post('/api/admin/student/' + code + '/ruta', body, who || teacher(SEED));
  let a = await act(kidA.studentCode, { level: 'yct1', step: 'train', world: 3, action: 'unlock' });
  ok(a.json.ok && a.json.ruta.levels[0].worlds[2].train && a.json.ruta.levels[0].worlds[2].via === 'teacher', '«Desbloquear» world 3 of El Entrenamiento');
  ok(mod(await ruta(as(A1)), 'yct1').progress.worlds[2].train && mod(await ruta(as(A1)), 'yct1').progress.worlds[2].teacher, '… the kid\'s route shows it open (a teacher)');
  a = await act(kidA.studentCode, { level: 'yct1', step: 'train', world: 3, action: 'lock' });
  ok(a.json.ok && !a.json.ruta.levels[0].worlds[2].train, '«Volver a bloquear» world 3');
  a = await act(kidA.studentCode, { level: 'yct1', step: 'train', world: 1, action: 'lock' });
  ok(a.json.ok && a.json.ruta.levels[0].worlds[0].train, 'world 1 stays open: the kid\'s own seals opened it');
  a = await act(kidA.studentCode, { level: 'yct1', step: 'train', world: 'all', action: 'unlock' });
  ok(a.json.ok && a.json.ruta.levels[0].train.open === Y.worlds.length && a.json.ruta.levels[0].train.all, '«Desbloquear» every world');
  a = await act(kidA.studentCode, { level: 'yct1', step: 'train', world: 'all', action: 'lock' });
  ok(a.json.ok && a.json.ruta.levels[0].train.open === 1, '«Volver a bloquear» every world: back to world 1 (their seals)');
  a = await act(kidA.studentCode, { level: 'yct1', step: 'dorado', action: 'unlock' });
  ok(a.json.ok && a.json.ruta.levels[0].dorado.teacher && a.json.ruta.levels[0].dorado.rule === 'key', '«Desbloquear» El Simulacro Dorado (counts once El Entrenamiento is live)');
  for (const [body, why] of [[{ level: 'yct1', step: 'train', world: 99, action: 'unlock' }, 'a world that does not exist'], [{ level: 'yct1', step: 'oops', action: 'unlock' }, 'a step that does not exist'],
    [{ level: 'yct1', step: 'train', world: 1, action: 'maybe' }, 'an action that is not unlock / lock'], [{ level: 'zz9', step: 'dorado', action: 'unlock' }, 'a level that does not exist']]) {
    ok((await act(kidA.studentCode, body)).status === 400, `refused: ${why}`);
  }
  ok((await act('ZZZZ', { level: 'yct1', step: 'dorado', action: 'unlock' })).status === 404, 'an unknown kid: 404');
  ok((await act(kidA.studentCode, { level: 'yct1', step: 'dorado', action: 'unlock' }, teacher(T2.teacherId))).status === 403, 'another class\'s teacher: 403');
  ok((await act(kidA.studentCode, { level: 'yct1', step: 'dorado', action: 'unlock' }, as(A1))).status === 401, 'the kid themselves (no teacher code): 401');
  const roster = (await get('/api/admin/students', teacher(SEED))).json;
  const row = roster.students.find((x) => x.code === kidA.studentCode);
  ok(row && row.rutaBar && row.rutaBar.level === 'yct1' && row.rutaBar.sealed === Y.worlds[0].count && row.rutaBar.train === 1 && row.rutaBar.worlds === Y.worlds.length, 'the roster: one small bar per kid (class level, seals, worlds ready)');
  ok(!('ruta' in row) && !roster.students.some((x) => 'ruta' in x), '… never the raw record');

  section('the rules: every teacher reads them, only the super admin changes them');
  ok((await get('/api/admin/ruta-settings', teacher(T2.teacherId))).json.canEdit === false, 'a teacher reads them (canEdit: false)');
  ok((await put('/api/admin/ruta-settings', { doradoPct: 80 }, teacher(T2.teacherId))).status === 403, '… and can\'t change them');
  ok((await put('/api/admin/ruta-settings', { doradoPct: 80 }, as(A1))).status === 401 && (await get('/api/admin/ruta-settings', as(anon))).status === 401, 'a kid or a visitor: 401');
  ok((await put('/api/admin/ruta-settings', { doradoPct: 45 }, teacher(SEED))).status === 400 && (await put('/api/admin/ruta-settings', { trainingLive: 'yes' }, teacher(SEED))).status === 400, 'a % out of 50-100 or a switch that is not true / false: refused');
  const s80 = await put('/api/admin/ruta-settings', { doradoPct: 80 }, teacher(SEED));
  ok(s80.json.ok && s80.json.settings.doradoPct === 80 && s80.json.settings.trainingLive === false, 'the super admin sets 80 %');

  section('«El Entrenamiento está activo» ON: El Simulacro Dorado is earned');
  ok((await put('/api/admin/ruta-settings', { trainingLive: true }, teacher(SEED))).json.settings.trainingLive === true, 'the switch ON');
  const N2 = phone();
  m = mod(await ruta(as(A1)), 'yct1');
  ok(m.dorado.open && m.sims.length === m.simCount, 'kid A (their teacher unlocked it): open, sims listed');
  await act(kidA.studentCode, { level: 'yct1', step: 'dorado', action: 'lock' });
  m = mod(await ruta(as(A1)), 'yct1');
  ok(!m.dorado.open && m.dorado.rule === 'practice' && m.dorado.pct === 80 && m.dorado.practiced === 0 && m.dorado.of === Y.worlds.length && m.sims.length === 0 && m.simCount > 0,
    'locked again: not earned, 0 of ' + Y.worlds.length + ' worlds with 80 %, no sim listed (only how many)');
  const k2 = mod(await ruta(as(K1)), 'yct1');
  ok(!k2.dorado.open && k2.dorado.login && k2.sims.length === 0, 'a key-only phone: «Entra con tu código» (practice is saved on an account)');
  ok(mod(await ruta(teacher(SEED)), 'yct1').sims.length > 0, 'a teacher: still every sim');
  ok((await get('/api/admin/students/' + kidA.studentCode, teacher(SEED))).json.ruta.levels[0].dorado.rule === 'practice', 'the profile shows the practice rule');
  ok((await put('/api/admin/ruta-settings', { trainingLive: false, doradoPct: 70 }, teacher(SEED))).json.settings.trainingLive === false, 'the switch OFF again');
  m = mod(await ruta(as(A1)), 'yct1');
  ok(m.dorado.open && m.dorado.rule === 'key' && m.sims.length === m.simCount, 'OFF: open with the key again, sims listed');
  ok(mod(await ruta(as(N2)), 'yct1').dorado === null, 'a visitor never gets a Dorado state');

  section('the record stays small');
  await stamp(A1, 'yct1', range(1, Y.words));
  await sleep(1500);   // the student file is written a second after the last change
  const recs = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
  const ra = recs[kidA.studentCode] && recs[kidA.studentCode].ruta;
  ok(ra && ra.yct1 && ra.yct1.s === '1-' + Y.words && JSON.stringify(ra).length < 120, 'every YCT 1 seal + New HSK 1 + a teacher\'s marks: ' + JSON.stringify(ra || {}).length + ' characters on the record');
  ok(!ra.yct1.p, 'no practice stored (phase 4 has not run)');
  // last: a login with another class's code re-tags the kid (homework as always), so it comes after every class check
  const other = await enter(phone(), T2.accessCodes[0], null, kidA.studentCode);
  ok(other.ok && !(other.base && other.base.seals), 'a login with another class\'s code (a stranger trying codes) gets no seals');
}

(async () => {
  let crashed = false;
  try { unit(); } catch (e) { crashed = true; failed++; console.log('  ✖ the in-process part crashed: ' + (e && e.stack || e)); }
  await startServer();
  try { await server(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
  }
  if (!KEEP) { for (const d of [DATA, UNIT]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } }
  console.log(failed ? `test-ruta-progress: ${failed} FAILED, ${passed} passed` : `test-ruta-progress: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
