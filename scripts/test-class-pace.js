#!/usr/bin/env node
// test-class-pace.js — «The class's pace decides this week's homework» (his picks 2026-10-21: «Each teacher, per class» +
// «Visible, can listen ahead»; the storybooks of every experience of the three modules arrived at once, so «the newest
// experience with homework» would always be the last one). Its OWN server (port 4530, never 3000), a temporary data
// folder with MADE-UP teachers, class codes and kids (all generated here, never printed), never data/, never the live site.
//   1 · the plan alone (public/js/papas-plan.js) with all 8 experiences holding homework: due = up to the class's
//       experience (`cur`); «this week» = that experience; «Lo más importante» only for due homework; later homework is
//       never counted (badges, reminder); a kid ahead of the class is told to listen, never to send; no pace = all due
//   2 · /maestro's endpoints (GET/POST /api/admin/class-pace): every teacher sees only their own classes, the super
//       admin every class; set / undo per class; another teacher's class, an unknown code, a bad number, another site:
//       refused (an unknown code and «not yours» the same answer); defaults per level; it survives a restart; a class
//       code rename carries it, a level change clears it; no class code in a log line
//   3 · the kid's and family's data: `cur` in /api/ruta-dorada (per module: the kid's class, a teacher's own class for
//       the preview, else the level's default), in /api/homework/home and the insights (Papás); the plan built on it
//       from TODAY's catalog; the kid's home (js/mi-dralingo.js in a sandbox): later experiences never badged
//   4 · the pages: /maestro's card and its words, «Esta semana» / «Más adelante», the English of every new phrase
//   node scripts/test-class-pace.js        (--port 4530 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4530));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const Plan = require('../public/js/papas-plan.js');
const Levels = require('../core/levels.js');

// ── 1 · the plan alone: 8 experiences, 2 homeworks each (rounds 1-2), the class on experience 3 ───────────────────
const W = (n, best, open) => ({ n, name: 'Mundo ' + n, pic: null, first: (n - 1) * 10 + 1, count: 10, best: best == null ? null : best, open: !!open });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// newest first, like the server's catalog order (experience desc, round desc)
const HW8 = (sent) => range(1, 8).reverse().flatMap((n) => [2, 1].map((r) => { const id = 'x-e0' + n + '-r' + r; return { id, exp: n, round: r, title: 'Tarea ' + n + '.' + r, sent: !!(sent && sent(n, r)) }; }));
const raw = (o) => Object.assign({ pct: 70, words: 80, seals: [], worlds: range(1, 8).map((n) => W(n)), hws: HW8(), cur: 3, sim: null }, o);
function planTests() {
  section('the plan: every experience has homework, the class is on experience 3');
  let p = Plan.plan(raw({}));
  let t = Plan.today(p);
  ok(p.pace === 3 && p.tareas.of === 6 && p.tareas.sent === 0 && p.tareas.later === 10 && p.tareas.ahead === 0,
    'due = the 6 homeworks of experiences 1-3; the 10 of experiences 4-8 are later, never counted (' + JSON.stringify(p.tareas) + ')');
  ok(same(p.tareas.week, { exp: 3, of: 2, left: 2 }), '«this week» = the class\'s experience 3 (2 homeworks, 2 left), never the newest (8)');
  ok(p.focus.kind === 'tarea' && p.focus.exp === 3 && p.focus.id === 'x-e03-r2', 'Papás «Lo más importante»: the newest DUE homework (experience 3), never experience 8\'s');
  ok(p.hws.every((h) => h.due === (h.exp <= 3)) && p.exps.every((e) => e.due === (e.n <= 3)), 'each homework and each experience knows whether it is due');
  ok(t.kind === 'words' && t.exp === 1 && t.remind && t.remind.left === 6 && t.remind.exp === 3 && t.remind.text === 'Y tienes 6 tareas por mandar.',
    'the kid: experience 1, words; the reminder counts the 6 due only («' + (t.remind && t.remind.text) + '»)');

  section('the plan: everything due is sent, the later ones are not');
  const upTo3 = (n) => n <= 3;
  p = Plan.plan(raw({ hws: HW8(upTo3) }));
  t = Plan.today(p);
  ok(p.tareas.of === 6 && p.tareas.sent === 6 && p.tareas.later === 10 && same(p.tareas.week, { exp: 3, of: 2, left: 0 }), 'all 6 due sent: «Al día» (week 3, 0 left), 10 later not missing');
  ok(p.focus.kind !== 'tarea' && p.focus.kind === 'words' && p.focus.exp === 1, '… Papás moves on to the words (no homework of later experiences pushed)');
  ok(!t.remind, '… and the kid gets no reminder (later homework never «por mandar»)');
  p = Plan.plan(raw({ hws: HW8((n) => n <= 3 || n === 6) }));
  ok(p.tareas.sent === 6 && p.tareas.ahead === 2, 'homework sent ahead (experience 6) counts as ahead, never as due');

  section('the plan: a kid ahead of the class');
  // (review 2026-10-21: homework that is not due never holds a kid back; the green ✓ stays strict)
  const best8 = range(1, 8).map((n) => W(n, n <= 4 ? 90 : null));
  p = Plan.plan(raw({ hws: HW8(upTo3), seals: range(1, 40), worlds: best8 }));
  t = Plan.today(p);
  ok(p.complete === 3 && !p.exps[3].done && p.exps[3].passed && !p.exps[3].due && p.current === 5,
    'experiences 1-3 complete; 4\'s words and practice done, its homework not due: not complete (no ✓), and the kid moves on to 5');
  ok(t.kind === 'words' && t.exp === 5 && t.step === Plan.stepOf('words') && !t.remind, '«Hoy»: the words of experience 5 («' + t.text + '»), no reminder: never «Manda tu tarea» for homework that is not due');
  ok(p.focus.kind === 'words' && p.focus.exp === 5, '… Papás: the words of experience 5, never experience 4\'s homework');
  // (2026-10-21, his ladder 1 Palabras → 2 Tu tarea → 3 Práctica: «Tu tarea» is a step only for homework that is due)
  p = Plan.plan(raw({ hws: HW8(upTo3), seals: range(1, 40), worlds: range(1, 8).map((n) => W(n, n <= 3 ? 90 : null)) }));
  t = Plan.today(p);
  ok(p.current === 4 && t.kind === 'practice' && t.exp === 4 && t.step === Plan.stepOf('practice'),
    'experience 4\'s words marked, its homework not due yet: «Hoy» goes on to its practice (the homework waits for the class)');
  const texts = pageWords();
  const tips = texts({ ruta: raw({ hws: HW8(upTo3), seals: range(1, 50), worlds: range(1, 8).map((n) => W(n, n <= 5 ? 90 : null)) }) }).tips;
  ok(tips.length === 3 && !/video/.test(tips[2]), '… nor do the tips ask for a video of later homework («' + tips[2] + '»)');
  p = Plan.plan(raw({ hws: HW8(upTo3), seals: range(1, 40), worlds: best8, cur: 4 }));
  t = Plan.today(p);
  ok(p.current === 4 && t.kind === 'tarea' && t.exp === 4 && t.go === 'Mandar mi tarea' && p.focus.kind === 'tarea' && p.focus.exp === 4,
    'the teacher moves the class to 4: the kid is back on 4, «Mandar mi tarea», and Papás asks for it');

  section('the plan: the edges');
  p = Plan.plan(raw({ cur: 8 }));
  ok(p.tareas.of === 16 && p.tareas.later === 0 && p.focus.id === 'x-e08-r2', 'the class on the last experience: everything due');
  p = Plan.plan(raw({ cur: null }));
  ok(p.pace === null && p.tareas.of === 16 && p.tareas.week === null && p.focus.id === 'x-e08-r2', 'no pace known: every homework due, no «this week» named');
  for (const bad of [0, -2, 2.5, 'x', '']) ok(Plan.plan(raw({ cur: bad })).pace === null, 'a pace of ' + JSON.stringify(bad) + ' is no pace');
  p = Plan.plan(raw({ cur: 5, hws: HW8().filter((h) => h.exp !== 5) }));
  ok(p.tareas.week === null && p.tareas.of === 8, 'the class\'s experience has no homework yet: no week named, the older ones still due');
  p = Plan.plan(raw({ hws: [{ id: 'z-r1', exp: null, round: 1, title: 'Suelta', sent: false }] }));
  ok(p.tareas.of === 1 && p.focus.kind === 'tarea', 'a homework of no experience is due');
}
// js/papas-plan.js + js/papas.js in a sandbox (only `texts`)
function pageWords() {
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('public/js/papas-plan.js'), ctx, { filename: 'papas-plan.js' });
  vm.runInContext(read('public/js/papas.js'), ctx, { filename: 'papas.js' });
  return ctx.DralyPapas.texts;
}
// the kid's home (js/mi-dralingo.js) in a sandbox, like test-home
function homeSandbox() {
  const noop = () => {};
  const ctx = { console, setTimeout, clearTimeout, URL };
  ctx.window = ctx; ctx.self = ctx;
  ctx.document = { addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { classList: { add: noop, remove: noop, contains: () => false } } };
  ctx.addEventListener = noop;
  ctx.matchMedia = () => ({ matches: false });
  ctx.location = { hash: '', pathname: '/homework', search: '' };
  ctx.history = { replaceState: noop };
  vm.createContext(ctx);
  for (const f of ['public/js/papas-plan.js', 'public/js/papas.js', 'public/js/mi-dralingo.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.DralyHome;
}
// hw-i18n.js in EN mode, read through its window.alert hook (as test-papas does)
function english() {
  const shown = [];
  const el = () => ({ style: {}, setAttribute() {}, getAttribute() { return null; }, addEventListener() {} });
  const ctx = {
    console, MutationObserver: function () { this.observe = () => {}; },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
    localStorage: { getItem: (k) => (k === 'hw_lang' ? 'en' : null), setItem() {} },
    location: { reload() {} },
    document: { readyState: 'complete', title: '', documentElement: {}, body: el(), createElement: el, createTreeWalker: () => ({ nextNode: () => null }), addEventListener() {}, getElementById: () => null },
  };
  ctx.document.body.appendChild = () => {};
  ctx.window = ctx;
  ctx.alert = (m) => { shown.push(m); };
  ctx.confirm = (m) => { shown.push(m); return true; };
  vm.createContext(ctx);
  vm.runInContext(read('public/js/hw-i18n.js'), ctx, { filename: 'hw-i18n.js' });
  return (s) => { shown.length = 0; ctx.window.alert(s); return shown[0]; };
}

// ── 2-3 · the server, the made-up teachers and kids ─────────────────────────────────────────────────────────────
const CAT = JSON.parse(read('public/assets/audios/catalog.json'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
const NEWHW = hwOf('newhsk1');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-pace-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const CODE_A = 'T-' + rnd(5);
const CODE_B = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const NOW = Date.now(), DAY = 86400e3;
// made-up class codes (random, distinct, never the port, never a real one)
const CLS = new Set();
while (CLS.size < 8) { const c = String(2101 + crypto.randomInt(7899)); if (c !== String(PORT)) CLS.add(c); }
const [S_NEW, S_YCT, S_OLD, A_NEW, A_OLD, B_NEW, A_RENAMED, SPARE] = [...CLS];
const UID = { S: 'u' + rnd(6), A: 'u' + rnd(6), B: 'u' + rnd(6) };
const teacher = (code, uid, name, codes, levels, sup) => ({ teacherId: code, uid, codeGen: 0, displayName: name, email: null, country: 'MX',
  accessCodes: codes, codeLevels: levels, isSuperAdmin: !!sup, createdAt: NOW - 90 * DAY, lastSeen: NOW - DAY });
// the teacher file and its one-shot flags are written before the boot: the first-boot seed and the old migrations never run
fs.writeFileSync(path.join(DATA, 'teachers.json'), JSON.stringify({
  [SEED]: teacher(SEED, UID.S, 'Super Prueba', [S_NEW, S_YCT, S_OLD], { [S_NEW]: 'hsk2', [S_YCT]: 'yct1', [S_OLD]: 'hsk1' }, true),
  [CODE_A]: teacher(CODE_A, UID.A, 'Ana Prueba', [A_NEW, A_OLD], { [A_NEW]: 'hsk2', [A_OLD]: 'hsk1' }),
  [CODE_B]: teacher(CODE_B, UID.B, 'Bea Prueba', [B_NEW], { [B_NEW]: 'hsk2' }),
}));
fs.writeFileSync(path.join(DATA, 'teachers-meta.json'), JSON.stringify({ superAdminSeenAt: NOW - 90 * DAY, retired: [], retiredLoose: [], retiredClass: [], oldSeedsDone: NOW - 90 * DAY }));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 30 * DAY }));
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const used = new Set();
const madeUpCode = () => { let c; do { c = Array.from({ length: 5 }, () => AB[crypto.randomInt(AB.length)]).join('') + (2 + crypto.randomInt(8)); } while (used.has(c)); used.add(c); return c; };
const KIDS = {
  KA: { level: 'hsk2', cls: A_NEW, name: 'Sofía Prueba' },     // Ana's New HSK 1 class
  KB: { level: 'hsk2', cls: B_NEW, name: 'Mateo Prueba' },     // Bea's New HSK 1 class
  KY: { level: 'yct1', cls: S_YCT, name: 'Emma Prueba' },      // the super admin's YCT 1 class (never set)
  KO: { level: 'hsk1', cls: A_OLD, name: 'Tomás Prueba' },     // Ana's Old HSK 1 class
};
const SEEDED = {};
Object.values(KIDS).forEach((v) => {
  v.code = madeUpCode();
  SEEDED[v.code] = { code: v.code, displayName: v.name, avatar: 'aileen', classroomCode: v.cls, classroomId: null, firstSeen: NOW - 40 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: v.level, levelAccess: { [v.level]: { via: 'teacher', at: NOW - DAY } } };
});
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
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers) });
// each teacher at their own address (the edit limits count per address)
const TIP = { S: '203.0.113.10', A: '203.0.113.11', B: '203.0.113.12' };
const T = (who, code, extra) => ({ headers: Object.assign({ 'X-Admin-Pw': encodeURIComponent(code), 'CF-Connecting-IP': TIP[who] }, extra || {}) });
const SA = () => T('S', SEED), TA = () => T('A', CODE_A), TB = () => T('B', CODE_B);
const pace = (o) => get('/api/admin/class-pace', o);
const setPace = (code, n, o) => post('/api/admin/class-pace', { code, n }, o);
const enter = async (ph, kid) => (await post('/api/homework/enter', { accessCode: kid.cls, studentCode: kid.code }, as(ph))).json || {};

let srv = null;
let allLog = '';
let bootLog = '';   // (the first boot's log: numbers it printed are not leaks)
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '1' }),
  });
  try { os.setPriority(srv.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + [SEED, CODE_A, CODE_B, LEGACY].reduce((s, c) => s.split(c).join('<code>'), allLog.slice(-2000)));
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

const DEF = { hsk2: Levels.info('hsk2').paceDefault, hsk1: Levels.info('hsk1').paceDefault, yct1: Levels.info('yct1').paceDefault };
async function teacherTests() {
  section('/maestro: each teacher sees their own classes, the super admin every class');
  const a0 = await pace(TA());
  ok(a0.status === 200 && a0.json && a0.json.ok && /no-store/.test(a0.headers['cache-control'] || ''), 'GET /api/admin/class-pace answers a teacher, never cached');
  const aCodes = (a0.json.classes || []).map((c) => c.code);
  ok(same(aCodes.slice().sort(), [A_NEW, A_OLD].sort()) && a0.json.classes.every((c) => c.mine && !c.set), 'a teacher: only her 2 classes, hers, none chosen yet');
  const cA = (d, code) => (d.json.classes || []).find((c) => c.code === code) || {};
  ok(cA(a0, A_NEW).cur === DEF.hsk2 && cA(a0, A_NEW).level === 'hsk2' && cA(a0, A_OLD).cur === DEF.hsk1, 'never chosen = the level\'s default (New HSK 1 ' + DEF.hsk2 + ', Old HSK 1 ' + DEF.hsk1 + ')');
  const L = a0.json.levels || {};
  // (today's curriculum: the counts and numbers come from the server's experiences, never written here)
  ok(Levels.LEVELS.every((l) => L[l.id] && L[l.id].exps.length >= 1 && L[l.id].slug === (l.pack || l.id)),
    'each level\'s experiences come along (' + Levels.LEVELS.map((l) => (L[l.id] ? L[l.id].exps.length : 0)).join(' · ') + '), with the module page\'s address');
  ok(Object.values(L).every((x) => x.exps.every((e, i) => Number.isInteger(e.n) && (i === 0 || e.n > x.exps[i - 1].n) && e.name &&
    /^\/ruta-exp\/[a-z0-9]+\/\d+\.webp\?v=/.test(e.pic || ''))), '… in order, each with its number, its name and its picture (by a neutral address)');
  ok(L.hsk2.exps.length >= 6 && [3, 4, 6].every((n) => L.hsk2.exps.some((e) => e.n === n)), '(this test moves New HSK 1 classes to experiences 3, 4 and 6: they exist)');
  ok(DEF.hsk2 === 4 && DEF.hsk1 === 4 && DEF.yct1 === 1, 'the defaults his decision named: Old HSK 1 = 4, New HSK 1 = 4, YCT 1 = 1');
  const s0 = await pace(SA());
  const sCodes = (s0.json.classes || []).map((c) => c.code);
  ok(s0.status === 200 && sCodes.length === 6 && [S_NEW, S_YCT, S_OLD, A_NEW, A_OLD, B_NEW].every((c) => sCodes.includes(c)), 'the super admin: every class (6)');
  ok(sCodes.slice(0, 3).every((c) => [S_NEW, S_YCT, S_OLD].includes(c)) && s0.json.classes.slice(0, 3).every((c) => c.mine) && s0.json.classes.slice(3).every((c) => !c.mine && c.teacher),
    '… his own first, then the others\' with their teacher\'s name');
  ok(cA(s0, S_YCT).cur === DEF.yct1, '… YCT 1 starts at experience ' + DEF.yct1);
  ok((await pace({ headers: { 'CF-Connecting-IP': '203.0.113.40' } })).status === 401 && (await pace({ headers: { 'X-Admin-Pw': 'T-NOPE' + rnd(3), 'CF-Connecting-IP': '203.0.113.41' } })).status === 401,
    'no code or a wrong code: refused');

  section('/maestro: one tap moves a class (and «Deshacer»)');
  let r = await setPace(A_NEW, 3, TA());
  ok(r.status === 200 && r.json.ok && r.json.cur === 3 && r.json.set === true && r.json.prev === null && r.json.level === 'hsk2' && r.json.name === L.hsk2.exps[2].name,
    'Ana puts her New HSK 1 class on experience 3 («' + (r.json && r.json.name) + '»): the toast\'s words come back');
  ok(cA(await pace(TA()), A_NEW).cur === 3 && cA(await pace(TA()), A_NEW).set, '… and her card says so');
  r = await setPace(A_NEW, 4, TA());
  ok(r.json.ok && r.json.cur === 4 && r.json.prev === 3, '› one more: 4 (prev 3, for «Deshacer»)');
  r = await setPace(A_NEW, 3, TA());
  ok(r.json.ok && r.json.cur === 3 && r.json.prev === 4, '«Deshacer»: back to 3');
  r = await setPace(A_OLD, 2, TA());
  ok(r.json.ok && r.json.cur === 2, 'her Old HSK 1 class on 2');
  r = await setPace(A_OLD, null, TA());
  ok(r.json.ok && r.json.set === false && r.json.cur === DEF.hsk1 && r.json.prev === 2, 'the undo of a first choice: back to «never chosen» (the default, ' + DEF.hsk1 + ')');
  r = await setPace(B_NEW, 6, SA());
  ok(r.json.ok && r.json.cur === 6, 'the super admin moves Bea\'s class (6)');
  r = await setPace(' ' + A_OLD.slice(0, 2) + ' ' + A_OLD.slice(2), 5, TA());
  ok(r.json.ok && r.json.code === A_OLD && r.json.cur === 5, 'a class code with spaces still finds it');
  ok((await setPace(A_OLD, null, TA())).json.ok, '(back to never chosen)');

  section('/maestro: what is refused');
  const notYours = await setPace(B_NEW, 2, TA());
  const unknown = await setPace(SPARE, 2, TA());
  ok(notYours.status === 403 && unknown.status === 403 && notYours.text === unknown.text, 'another teacher\'s class and an unknown code: the same 403');
  ok((await setPace(A_NEW, 2, TB())).status === 403, 'Bea can\'t move Ana\'s class');
  ok((await setPace(SPARE, 2, SA())).status === 404, 'the super admin: an unknown code is «ya no existe»');
  const lastOf = (id) => Math.max.apply(null, L[id].exps.map((e) => e.n));
  for (const bad of [0, lastOf('hsk2') + 1, -1, 2.5, 'x', '3', true, {}]) ok((await setPace(A_NEW, bad, TA())).status === 400, 'experience ' + JSON.stringify(bad) + ' of New HSK 1: refused');
  ok((await post('/api/admin/class-pace', { code: A_NEW }, TA())).status === 400, 'no `n` at all: refused (never a reset to the default)');
  ok((await setPace('__proto__', 2, TA())).status === 403 && (await setPace('constructor', 2, TA())).status === 403, 'a code like «__proto__» or «constructor»: refused like any unknown code');
  const lastY = lastOf('yct1');
  ok((await setPace(S_YCT, lastY + 1, SA())).status === 400 && (await setPace(S_YCT, lastY, SA())).json.ok, 'YCT 1 ends at experience ' + lastY + ': ' + (lastY + 1) + ' refused, ' + lastY + ' fine');
  ok((await setPace(S_YCT, null, SA())).json.ok, '(back to never chosen)');
  ok((await setPace(A_NEW, 2, T('A', CODE_A, { 'Sec-Fetch-Site': 'cross-site' }))).status === 403, 'from another site: refused');
  ok((await post('/api/admin/class-pace', { code: A_NEW, n: 2 }, { headers: { 'CF-Connecting-IP': '203.0.113.42' } })).status === 401, 'no teacher code: refused');
  ok(cA(await pace(TA()), A_NEW).cur === 3, '… nothing of it changed her class (still 3)');
}

async function kidTests() {
  section('the kids and families read their class\'s pace');
  const ph = {};
  for (const [k, kid] of Object.entries(KIDS)) { ph[k] = phone(); const e = await enter(ph[k], kid); ok(e.ok && e.studentCode === kid.code, k + ': logged in (' + kid.level + ')'); }
  const ruta = async (o) => (await get('/api/ruta-dorada', o)).json || {};
  const mod = (st, id) => (st.modules || []).find((m) => m.id === id) || {};
  let st = await ruta(as(ph.KA));
  ok(mod(st, 'hsk2').cur === 3 && mod(st, 'hsk1').cur === DEF.hsk1 && mod(st, 'yct1').cur === DEF.yct1, 'Ana\'s kid: La Ruta Dorada says experience 3 for New HSK 1; the other modules their defaults');
  st = await ruta(as(ph.KB));
  ok(mod(st, 'hsk2').cur === 6, 'Bea\'s kid: experience 6 (the super admin moved it)');
  st = await ruta(as(ph.KY));
  ok(mod(st, 'yct1').cur === DEF.yct1, 'a YCT 1 class never chosen: ' + DEF.yct1);
  st = await ruta(as(phone()));
  ok(mod(st, 'hsk2').cur === DEF.hsk2 && mod(st, 'hsk1').cur === DEF.hsk1 && mod(st, 'yct1').cur === DEF.yct1, 'a phone with no account (no class code): each level\'s default');
  st = await ruta(TA());
  ok(st.teacher && mod(st, 'hsk2').cur === 3 && mod(st, 'yct1').cur === DEF.yct1, 'Ana\'s preview: her own class\'s experience (3); a level she has no class of: the default');
  st = await ruta(SA());
  ok(st.teacher && mod(st, 'hsk2').cur === DEF.hsk2, 'the super admin\'s preview: his own New HSK 1 class (never chosen: the default)');

  section('Mi Dralingo and Papás: the plan on the class\'s pace, from today\'s catalog');
  const home = (await get('/api/homework/home?accessCode=' + A_NEW + '&studentCode=' + KIDS.KA.code, as(ph.KA))).json || {};
  const ins = (await get('/api/homework/insights/' + KIDS.KA.code + '?accessCode=' + A_NEW, as(ph.KA))).json || {};
  ok(home.ruta && home.ruta.cur === 3 && ins.ruta && ins.ruta.cur === 3, 'the home and the insights (Papás) carry `cur` = 3');
  const p = home.ruta.plan;
  ok(same(p, Plan.plan(home.ruta)), 'the server\'s plan is the page\'s plan');
  const due = NEWHW.filter((h) => h.exp <= 3), later = NEWHW.filter((h) => h.exp > 3);
  ok(p.tareas.of === due.length && p.tareas.later === later.length && p.tareas.sent === 0,
    'due = the catalog\'s homework of experiences 1-3 (' + due.length + '), later = ' + later.length + ' (experiences 4-8), never counted');
  ok(p.hws.every((h) => h.due === (h.exp <= 3)), '… each homework marked due or not');
  ok(due.length ? p.focus.kind === 'tarea' && p.focus.id === due[0].id : p.focus.kind !== 'tarea', 'Papás: the newest DUE homework (' + (due[0] ? due[0].id : 'none') + '), never a later one');
  const wk = NEWHW.filter((h) => h.exp === 3);
  ok(wk.length ? same(p.tareas.week, { exp: 3, of: wk.length, left: wk.length }) : p.tareas.week === null, '«this week» = experience 3\'s homework');
  const t = Plan.today(p);
  // (the kid has no seals: «Hoy» is experience 1's words, so every due homework rides along as the reminder)
  ok(due.length ? !!t.remind && t.remind.left === due.length && (t.remind.exp || 0) <= 3 : !t.remind,
    'the kid\'s reminder counts the due ones only' + (t.remind ? ' («' + t.remind.text + '»)' : ' (none due)'));
  const H = homeSandbox();
  const s = { code: KIDS.KA.code, accessCode: A_NEW, keyMode: false, name: KIDS.KA.name, avatar: 'aileen', avatarUrl: '/assets/saga/avatars/aileen.webp',
    level: 'hsk2', levelName: 'New HSK 1', folders: null, assignments: [], submissions: [], custom: [], readings: [], trainer: null, inbox: [], unread: 0, daily: false };
  const m = H.model(home, s, null);
  ok(m.exps.every((e) => (e.n > 3 ? e.left === 0 && e.later === (e.hws.length > 0) : !e.later && e.left === e.hws.length)),
    'the kid\'s home: a red «N por mandar» only on experiences 1-3; later ones «Más adelante», never badged');
  const lx = m.exps.find((e) => e.n > 3 && e.hws.length);
  if (lx) {
    const page = H.htmlFor(home, s, '#exp-' + lx.n, false);
    // («Tu tarea»'s step number read from js/papas-plan.js LADDER)
    const sT = Plan.stepOf('tarea');
    ok(/class="md-later" data-later="\d+">Más adelante</.test(page) && /Ya puedes escucharla/.test(page) && !new RegExp('id="md-step-' + sT + '"[^>]*>\\s*<span class="md-step-tag"').test(page) &&
      !new RegExp('class="md-step is-next" id="md-step-' + sT + '"').test(page) && /data-hw-mount/.test(page), 'experience ' + lx.n + ': its homework plays («Ya puedes escucharla», «Más adelante»), never «¡Empieza aquí!» or a red badge');
  } else ok(true, '(today\'s catalog has no homework after experience 3: nothing later to show)');
  const e3 = m.exps.find((e) => e.n === 3);
  if (e3 && e3.hws.length) ok(/class="md-badge" data-left="3">/.test(H.htmlFor(home, s, '#exp-3', false)) && e3.left === e3.hws.length, 'experience 3 (this week): its red «N por mandar»');

  section('a class code renamed carries its pace; a level change clears it');
  const ren = await put('/api/admin/teacher/' + UID.A + '/class-code', { from: A_NEW, to: A_RENAMED }, SA());
  ok(ren.status === 200 && ren.json.ok && ren.json.to === A_RENAMED, 'the super admin renames Ana\'s New HSK 1 class code');
  const a1 = await pace(TA());
  const cR = (a1.json.classes || []).find((c) => c.code === A_RENAMED) || {};
  ok(cR.cur === 3 && cR.set && !(a1.json.classes || []).some((c) => c.code === A_NEW), '… her card: the new code, still on experience 3');
  ok(((await ruta(as(ph.KA))).modules || []).find((x) => x.id === 'hsk2').cur === 3, '… and her kid (moved to the new code) still reads 3');
  ok((await setPace(A_NEW, 2, TA())).status === 403, '… the old code is nobody\'s now');
  const lv = await put('/api/admin/teacher/' + UID.B + '/class-codes/level', { code: B_NEW, level: 'hsk1' }, SA());
  const cB = ((await pace(TB())).json.classes || []).find((c) => c.code === B_NEW) || {};
  ok(lv.json && lv.json.ok && cB.level === 'hsk1' && cB.set === false && cB.cur === DEF.hsk1, 'Bea\'s class moved to Old HSK 1: never chosen there (its default ' + DEF.hsk1 + ')');
  await put('/api/admin/teacher/' + UID.B + '/class-codes/level', { code: B_NEW, level: 'hsk2' }, SA());
  ok((await setPace(B_NEW, 6, TB())).json.ok, '(back to New HSK 1, on 6 again)');
}

async function restartTests() {
  section('a restart keeps every class\'s pace (boot migrations only fill what is missing)');
  await stopServer();
  await startServer();
  const a = await pace(TA());
  const b = await pace(TB());
  ok(((a.json.classes || []).find((c) => c.code === A_RENAMED) || {}).cur === 3 && ((b.json.classes || []).find((c) => c.code === B_NEW) || {}).cur === 6,
    'after the restart: Ana\'s class on 3, Bea\'s on 6');
  ok(((a.json.classes || []).find((c) => c.code === A_OLD) || {}).set === false, '… and a class never chosen is still never chosen');
  const file = JSON.parse(fs.readFileSync(path.join(DATA, 'teachers.json'), 'utf8'));
  ok(file[CODE_A] && file[CODE_A].codeExps && file[CODE_A].codeExps[A_RENAMED] === 3 && !(A_NEW in file[CODE_A].codeExps), 'saved with the class code, on the teacher\'s record (the rename moved it)');
}

function pageTests() {
  section('the pages');
  const mjs = read('public/js/maestro.js');
  const mhtml = read('public/maestro.html');
  const css = read('public/css/teacher-dashboard.css');
  ok(/id="m-pace"/.test(mhtml) && mhtml.indexOf('id="m-pace"') < mhtml.indexOf('class="m-panel m-students"'), '/maestro: the card sits right above the students (the class view)');
  ok(/Elige en qué experiencia va tu clase/.test(mjs) && /'Ahora ' \+ who \+ ' está en ' \+ where/.test(mjs) && /Deshacer/.test(mjs) && /setTimeout\(kill, 8000\)/.test(mjs),
    '… «Elige en qué experiencia va tu clase», the toast «Ahora tu clase está en la Experiencia N · …» with «Deshacer» for 8 s');
  ok(/data-pace-step="-1"/.test(mjs) && /data-pace-step="1"/.test(mjs) && /data-pace-pick/.test(mjs) && /m-modal-card/.test(mjs.slice(mjs.indexOf('function pacePick'))), '… big ‹ ›, and «Elegir» opens a window of every experience');
  ok(!/class-pace\?/.test(mjs) && /JSON\.stringify\(\{ code, n \}\)/.test(mjs), '… the class code travels in the body, never in an address');
  ok(/\.m-pace-step \{[^}]*min-height: 48px/.test(css) && /\.m-pace-tile/.test(css), '… tap targets of 48 px');
  const rjs = read('public/js/ruta.js');
  ok(/Esta semana/.test(rjs) && /Más adelante/.test(rjs) && !/La más nueva/.test(rjs) && /dueOf\(m, hws\)/.test(rjs), 'La Ruta Dorada: «Esta semana» on the class\'s folder, «Más adelante» after it, counts of due homework only');
  const html = read('public/homework.html') + read('public/audios.html') + mhtml;
  ok(['js/ruta.js', 'js/papas-plan.js', 'js/papas.js', 'js/mi-dralingo.js', 'js/hw-i18n.js', 'js/maestro.js', 'css/ruta.css', 'css/mi-dralingo.css', 'css/teacher-dashboard.css']
    .every((f) => new RegExp('/' + f.replace('.', '\\.') + '\\?v=').test(html)), 'every changed file is asked for with a ?v=');
  const en = english();
  const missing = [];
  ['Esta semana', 'Más adelante', 'Ya puedes escucharla', 'Falta 1 por mandar', 'Faltan 3 por mandar',
    'Palabras y práctica listas. Tu tarea es para más adelante: ya puedes escucharla.',
    '«¡Vas adelantado! Ya podés escuchar el audio. La mandás cuando tu clase llegue a esta experiencia.»',
    'Palabras listas, práctica lista, tarea de más adelante'].forEach((s) => {
    const e = en(s);
    if (!e || e === s || /[áéíóúñ¿¡]/i.test(e)) missing.push(s);
    else if (en(e) !== e) missing.push(s + ' (its English is not settled)');
  });
  ok(!missing.length, 'every new phrase of the kid\'s home and Papás has its English' + (missing.length ? ': missing ' + missing.map((x) => '«' + x + '»').join(', ') : ''));
}

(async () => {
  let crashed = false;
  try { planTests(); pageTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  await startServer();
  bootLog = allLog;
  try { await teacherTests(); await kidTests(); await restartTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  else console.log('(server left running on port ' + PORT + ', data in a temp folder)');
  if (!crashed) {
    ok(![SEED, CODE_A, CODE_B, LEGACY].some((c) => allLog.includes(c)), 'no teacher code in the server log');
    // (a made-up 4-digit code may also be any number the first boot printed: only what came after the boot counts)
    const hit = (c, s) => new RegExp('(^|[^0-9])' + c + '([^0-9]|$)').test(s);
    const codeInLog = [S_NEW, S_YCT, S_OLD, A_NEW, A_OLD, B_NEW, A_RENAMED].filter((c) => !hit(c, bootLog) && hit(c, allLog.slice(bootLog.length)));
    ok(!codeInLog.length, 'no class code in the server log' + (codeInLog.length ? ' (' + codeInLog.length + ' found)' : ''));
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-class-pace: ${failed} FAILED, ${passed} passed` : `test-class-pace: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
