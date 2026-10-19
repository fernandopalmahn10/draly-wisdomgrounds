#!/usr/bin/env node
// test-home.js — «Mi Dralingo» part 3 (2026-10-18): the kid's home on /homework (public/js/mi-dralingo.js, his approved
// design .claude/handoff/kidhome-design). Its OWN server (port 4490, never 3000), a temporary data folder with MADE-UP kids
// (codes made up here, never printed), never data/, never the live site.
//   1 · «Hoy» = js/papas-plan.js today() (review 2026-10-18): the kid's ladder in the current experience (1 Palabras →
//       2 Práctica → 3 Tu tarea, its button named for what it does), a homework due as one reminder line; Papás keeps
//       homework first from the SAME plan; the server's plan is the page's plan; La Ruta Dorada's module page says the same
//   2 · GET /api/homework/home: the homework doors (an unknown code and «not yours» the same 403), `ruta` only for the
//       kid's own session, never cached, no code and no hanzi inside, the experiences per level (8 · 8 · 6) with their
//       world, a folder picture and word pictures under neutral addresses (served), each homework's tracks, the streak
//       («N días seguidos»: a real step counts once a day, a missed day starts again)
//   3 · the teacher's tareas mapped to experiences per level (YCT 1's game rounds by world, HSK 1's EXP tareas and its
//       Sim-Trainer tiers, New HSK 1's exam rounds in El Simulacro Dorado, custom tareas under «Hoy»), and every one of
//       them reachable from a screen of the home (nothing old unreachable: the table of the old portal's doors too)
//   4 · the Desafío flag is off («Muy pronto»), Mi perfil's actions (name, avatar, another level, scores, English,
//       install, «Salir»), no code on screen outside Mi perfil, every screen's way back, every phrase in English
//   node scripts/test-home.js            (--port 4490 · --keep to leave the server running)
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
const PORT = Number(opt('port', 4490));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const HANZI = /[㐀-鿿]/;

const Plan = require('../public/js/papas-plan.js');

// ── 1 · «Hoy» alone: today() of every focus ─────────────────────────────────────────────────────────────────────
const W = (n, best, open) => ({ n, name: 'Mundo ' + n, pic: null, first: (n - 1) * 10 + 1, count: 10, best: best == null ? null : best, open: !!open });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HW = (s3, s1) => [{ id: 'x-e03-r1', exp: 3, round: 1, title: 'Tres', sent: !!s3 }, { id: 'x-e01-r1', exp: 1, round: 1, title: 'Uno', sent: !!s1 }];
const raw = (o) => Object.assign({ pct: 70, words: 40, seals: [], worlds: [W(1), W(2), W(3), W(4)], hws: HW(false, false), sim: null }, o);
function todayTests() {
  section('«Hoy» = the kid\'s ladder (review 2026-10-18): the current experience, 1 Palabras → 2 Práctica → 3 Tu tarea; Papás keeps homework first');
  const T = (r) => { const p = Plan.plan(r); return { p, t: Plan.today(p) }; };
  let { p, t } = T(raw({}));
  ok(p.focus.kind === 'tarea' && p.focus.exp === 3, 'Papás («Lo más importante», the parents): the homework to send comes first');
  ok(t.kind === 'words' && t.exp === 1 && t.step === 1 && !t.dorado && t.go === 'Marcar mis palabras', 'the kid: experience 1, words untouched → step 1 «Marcar mis palabras» (a homework due is never the start step)');
  ok(t.text === '¡Hoy toca la Experiencia 1! Empieza por marcar sus palabras.', '… «' + t.text + '»');
  ok(t.remind && t.remind.left === 2 && t.remind.exp === 3 && t.remind.id === 'x-e03-r1' && t.remind.text === 'Y tienes 2 tareas por mandar.', '… the homework due rides along: «' + (t.remind && t.remind.text) + '» (opens the newest, experience 3)');
  ({ p, t } = T(raw({ hws: HW(true, true), seals: range(1, 10), worlds: [W(1, 55), W(2), W(3), W(4)] })));
  ok(p.focus.kind === 'practice' && t.kind === 'practice' && t.exp === 1 && t.step === 2 && t.go === 'Practicar aquí' && !t.remind, 'words done, practice below the goal: step 2 «Practicar aquí», nothing due');
  ok(t.text === '¡Hoy toca la Experiencia 1! Practica Mundo 1 hasta llegar al 70 %.', '… «' + t.text + '»');
  ({ p, t } = T(raw({ hws: HW(true, true), seals: range(1, 6) })));
  ok(t.kind === 'words' && t.text === '¡Hoy toca la Experiencia 1! Marca sus palabras: te faltan 4.', 'some marked: «te faltan 4»');
  ({ p, t } = T(raw({ hws: HW(true, true), seals: range(1, 9) })));
  ok(t.text === '¡Hoy toca la Experiencia 1! Marca sus palabras: te falta 1.', 'one left: «te falta 1» (singular)');
  ({ p, t } = T(raw({ hws: HW(false, false), seals: range(1, 10), worlds: [W(1, 80), W(2), W(3), W(4)] })));
  ok(t.kind === 'tarea' && t.exp === 1 && t.step === 3 && t.id === 'x-e01-r1' && t.go === 'Mandar mi tarea' && t.text === '¡Hoy toca la Experiencia 1! Manda tu tarea de Mundo 1.',
    'words and practice done: step 3 «Mandar mi tarea» of the same experience');
  ok(t.remind && t.remind.exp === 3 && t.remind.left === 1 && t.remind.text === 'Y tu tarea de esta semana: 1 por mandar.', '… and this week\'s homework (experience 3) as the reminder: «' + (t.remind && t.remind.text) + '»');
  const all = range(1, 40), best = [W(1, 80), W(2, 90), W(3, 75), W(4, 100)];
  ({ p, t } = T(raw({ hws: HW(true, true), seals: all, worlds: best })));
  ok(p.focus.kind === 'teacher' && t.kind === 'teacher' && t.dorado && t.exp === null && t.go === 'Avisar a mi profe' && /^¡Terminaste El Entrenamiento! Avísale a tu profe/.test(t.text), 'everything done: El Simulacro Dorado, «Avisar a mi profe»');
  ({ p, t } = T(raw({ hws: HW(true, true), seals: all, worlds: best, sim: { n: 2, percent: 85, passed: true, at: 1 } })));
  ok(p.focus.kind === 'fine' && t.dorado && t.go === 'Ver mi libro dorado' && t.text === '¡Aprobaste El Simulacro Dorado con 85 %! Repasa tu libro dorado.', 'a simulation passed: «Ver mi libro dorado»');
  ({ p, t } = T(raw({ worlds: [], hws: [], words: 0 })));
  ok(t.kind === 'fine' && !t.dorado && t.exp === null && !t.remind, 'a level with no experiences yet: a calm line');
  ({ p, t } = T(raw({ hws: [{ id: 'z-r1', exp: null, round: 1, title: 'Suelta', sent: false }] })));
  ok(t.kind === 'words' && t.remind && t.remind.exp === null && t.remind.id === 'z-r1' && t.remind.text === 'Y tienes 1 tarea por mandar.', 'a homework of no experience: the reminder opens the homework itself');
}

// ── the page's code in a sandbox (no browser): js/papas-plan.js + js/papas.js + js/mi-dralingo.js ─────────────────
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
  return ctx;
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
  return { en: (s) => { shown.length = 0; ctx.window.alert(s); return shown[0]; }, api: ctx.window.HwI18n };
}

// ── 2-4 · the server, the made-up kids ───────────────────────────────────────────────────────────────────────────
const CAT = JSON.parse(read('public/assets/audios/catalog.json'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
const NEWHW = hwOf('newhsk1');
const OLDHW = hwOf('hsk1');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-home-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const used = new Set();
const madeUpCode = () => { let c; do { c = Array.from({ length: 4 }, () => AB[crypto.randomInt(AB.length)]).join('') + (2 + crypto.randomInt(8)); } while (used.has(c)); used.add(c); return c; };
const NOW = Date.now(), DAY = 86400e3;
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
const CLASS = { hsk2: ['1', '0', '0', '2'].join(''), yct1: ['1', '0', '0', '3'].join(''), hsk1: ['1', '0', '0', '1'].join('') };
const allSent = (list) => Object.fromEntries(list.map((h) => [h.id, { h: NOW - DAY, s: NOW - DAY }]));
const P8 = { 1: 80, 2: 85, 3: 90, 4: 75, 5: 70, 6: 95, 7: 88, 8: 100 };
const KIDS = {
  NEWK: { level: 'hsk2', name: 'Sofía Prueba', avatar: 'aileen' },
  HALF: { level: 'hsk2', name: 'Mateo Prueba', avatar: 'adric', ruta: { s: '1-123', at: NOW - DAY, p: { 1: 92, 2: 74, 3: 55 } },
    tareas: { [NEWHW.find((h) => h.exp === 1).id]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY }, [NEWHW.find((h) => h.exp === 3).id]: { h: NOW - DAY } },
    extra: { streak: 4, dayDate: utcDay(NOW - DAY),
      inbox: [{ id: 'm-a1', fromName: 'Profe Fer', text: '¡Hola! Mañana jugamos en clase. Ten tu teléfono listo.', actionType: 'link', actionUrl: '/?pin=' + (100 + crypto.randomInt(800)), actionLabel: 'Entrar', ts: NOW - 3600e3, readAt: null },
        { id: 'm-a2', fromName: 'Profe Fer', text: 'Esta semana: Experiencia 3, El Restaurante Chino.', ts: NOW - 3 * DAY, readAt: NOW - 2 * DAY }],
      sentencesBuilt: [{ ts: NOW - DAY, words: ['w1', 'w2'], pin: '' }, { ts: NOW - 2 * DAY, words: ['w3', 'w4'], pin: '', pushedByTeacher: true, teacherName: 'Profe' }] } },
  PRAC: { level: 'hsk2', name: 'Lucía Prueba', avatar: 'camel', ruta: { s: '1-117', at: NOW - DAY, p: { 1: 92, 2: 74, 3: 55 } }, tareas: allSent(NEWHW) },
  WORD: { level: 'hsk2', name: 'Diego Prueba', avatar: 'oryx', ruta: { s: '1-40', at: NOW - DAY }, tareas: allSent(NEWHW) },
  DONE: { level: 'hsk2', name: 'Valentina Prueba', avatar: 'falcon', ruta: { s: '1-300', at: NOW - DAY, p: P8 }, tareas: allSent(NEWHW) },
  GOLD: { level: 'hsk2', name: 'Martín Prueba', avatar: 'dralingo', ruta: { s: '1-300', at: NOW - DAY, p: P8 }, tareas: allSent(NEWHW),
    extra: { hskResults: [{ simId: 'newhsk1-sim2', score: 170, total: 200, percent: 85, ts: NOW - DAY, answeredCount: 40, questions: 40, wrongQs: [] }] } },
  YCTK: { level: 'yct1', name: 'Emma Prueba', avatar: 'aileen', ruta: { s: '1-17', at: NOW - DAY, p: { 1: 80 } } },
  OLDK: { level: 'hsk1', name: 'Tomás Prueba', avatar: 'adric', ruta: { s: '1-40', at: NOW - DAY, p: { 1: 75, 2: 40, pinyin: 60 } },
    tareas: { [OLDHW[OLDHW.length - 1].id]: { h: NOW - DAY, s: NOW - DAY } }, extra: { testResults: [{ storyId: 'pinpin', score: 60, total: 100, ts: NOW - DAY }] } },
  GAPK: { level: 'hsk2', name: 'Pablo Prueba', avatar: 'oryx', extra: { streak: 9, dayDate: utcDay(NOW - 3 * DAY) } },
  OTHR: { level: 'hsk2', name: 'Clara Prueba', avatar: 'oryx', ruta: { s: '1-50', at: NOW - DAY, p: { 1: 99 } } },
  // (review 2026-10-18) kids far from UTC who studied «yesterday» on their own calendar: a step today keeps the streak.
  // Mexico City (UTC-6, a kid studying in the evening), and the two ends of the world: at any hour one of them is on a
  // different date than UTC, so a UTC count fails here every time
  TZMX: { level: 'hsk2', name: 'Ana Prueba', avatar: 'aileen', tz: 'America/Mexico_City', ruta: { s: '1-5', at: NOW - DAY } },
  TZKI: { level: 'hsk2', name: 'Leo Prueba', avatar: 'adric', tz: 'Pacific/Kiritimati', ruta: { s: '1-5', at: NOW - DAY } },
  TZPP: { level: 'hsk2', name: 'Mia Prueba', avatar: 'camel', tz: 'Pacific/Pago_Pago', ruta: { s: '1-5', at: NOW - DAY } },
};
const localDay = (tz, t) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const localYesterday = (tz) => { const d = new Date(localDay(tz, NOW) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
['TZMX', 'TZKI', 'TZPP'].forEach((k) => { KIDS[k].extra = { streak: 3, dayDate: localYesterday(KIDS[k].tz) }; });
const SEEDED = {};
Object.entries(KIDS).forEach(([k, v]) => {
  v.code = madeUpCode();
  SEEDED[v.code] = Object.assign({ code: v.code, displayName: v.name, avatar: v.avatar, classroomCode: CLASS[v.level], classroomId: null, firstSeen: NOW - 40 * DAY,
    lastSeen: NOW - DAY, sentencesBuilt: [], level: v.level, levelAccess: { [v.level]: { via: 'teacher', at: NOW - DAY } },
    ruta: v.ruta ? { [v.level]: v.ruta } : undefined, tareas: v.tareas }, v.extra || {});
});
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 30 * DAY }));
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));
const CUSTOM_ID = 'ca_test' + rnd(3).toLowerCase();
fs.writeFileSync(path.join(DATA, 'custom-assignments.json'), JSON.stringify({ items: { [CUSTOM_ID]: { id: CUSTOM_ID, teacherId: null, createdAt: NOW - DAY,
  title: 'Oraciones del restaurante', instructions: '', items: [{ es: 'Quiero comer jiaozi.', expected: 'wo xiang chi jiaozi' }, { es: 'Papá toma té.', expected: 'baba he cha' }],
  targetStudents: [KIDS.HALF.code], pointsPerItem: 10, status: 'active' } } }));

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
        resolve({ status: res.statusCode, headers: res.headers, text, json, size: buf.length });
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
const enter = async (ph, kid) => (await post('/api/homework/enter', { accessCode: CLASS[kid.level], studentCode: kid.code }, as(ph))).json || {};
const home = (ph, kid, code, ac) => get('/api/homework/home?accessCode=' + encodeURIComponent(ac == null ? CLASS[kid.level] : ac) + '&studentCode=' + encodeURIComponent((code || kid).code), as(ph));

let srv = null;
let allLog = '';
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

// the hooks' state homework.js hands the home, from what a login returns (and the calls the page makes after it)
async function stateOf(ph, kid, e) {
  const ac = CLASS[kid.level];
  const custom = ((await get('/api/homework/custom-assignments/' + kid.code + '?accessCode=' + ac, as(ph))).json || {}).assignments || [];
  const readings = ((await get('/api/homework/reading-tests?accessCode=' + ac + '&studentCode=' + kid.code, as(ph))).json || {}).stories || [];
  const tl = e.level === 'hsk1' ? (await get('/api/homework/trainer/list?accessCode=' + ac, as(ph))).json : null;
  const subs = e.submissions || [];
  // (homework.js taggedCustomAssignments)
  const tagged = custom.map((a) => {
    const mine = subs.filter((s) => s.assignmentId === a.id);
    const best = mine.reduce((m, s) => (s.score > (m && m.score || -1) ? s : m), null);
    return { a, status: best && best.score >= (a.itemCount || 0) * 8 ? 'done' : best ? 'pending' : 'new', best };
  });
  return { code: kid.code, accessCode: ac, keyMode: false, name: kid.name, avatar: kid.avatar, avatarUrl: '/assets/saga/avatars/' + kid.avatar + '.webp',
    level: e.level, levelName: e.levelName, folders: e.folders || null, assignments: e.assignments || [], submissions: subs, custom: tagged,
    readings, trainer: tl && tl.ok ? tl : null, inbox: [], unread: 0, daily: e.daily !== false };
}

async function serverTests() {
  const S = homeSandbox();
  const H = S.DralyHome;
  const { en, api } = english();
  // (set the level keys: «Abrir otro nivel» below)
  const T = { headers: { 'CF-Connecting-IP': '198.51.100.250', 'X-Admin-Pw': encodeURIComponent(SEED) } };
  for (const [lvl, k] of Object.entries(KEYS)) ok(((await put('/api/admin/level-keys/' + lvl, { key: k }, T)).json || {}).ok, 'the ' + lvl + ' key is set (made up)');

  section('the made-up kids log in at /homework, their home answers');
  const phones = {}, E = {}, R = {}, ST = {};
  for (const [k, kid] of Object.entries(KIDS)) {
    phones[k] = phone();
    E[k] = await enter(phones[k], kid);
    ok(E[k].ok && E[k].studentCode === kid.code, k + ': logged in (' + kid.level + ')');
    R[k] = await home(phones[k], kid);
    ST[k] = await stateOf(phones[k], kid, E[k]);
  }
  const r0 = R.HALF;
  ok(r0.status === 200 && r0.json.ok && r0.json.ruta && /private/.test(r0.headers['cache-control'] || '') && /no-store/.test(r0.headers['cache-control'] || ''),
    'GET /api/homework/home: the kid\'s own session gets `ruta`, never cached');
  for (const k of Object.keys(KIDS)) {
    const d = R[k].json || {};
    const txt = JSON.stringify(d.ruta || {});
    ok(!!d.ruta && same(d.ruta.plan, Plan.plan(d.ruta)), k + ': the server\'s plan is the page\'s plan (the same file)');
    ok(!!d.ruta && !txt.includes(KIDS[k].code) && !HANZI.test(txt), k + ': no student code and no hanzi in the answer');
  }

  section('only the kid\'s own record (the homework doors)');
  const cls = await home(phones.HALF, KIDS.OTHR);
  ok(cls.status === 200 && cls.json.ruta === null, 'a classmate\'s home from this kid\'s phone (the same class code): no `ruta`');
  const bare = phone();
  const nos = await home(bare, KIDS.HALF);
  ok(nos.status === 200 && nos.json.ruta === null, 'a phone with no session (the class code + the code): the tareas only, no `ruta`');
  const unk = await get('/api/homework/home?accessCode=' + CLASS.hsk2 + '&studentCode=' + madeUpCode(), as(bare));
  const not = await get('/api/homework/home?accessCode=' + CLASS.yct1 + '&studentCode=' + KIDS.HALF.code, as(bare));
  ok(unk.status === 403 && not.status === 403 && unk.text === not.text, 'an unknown code and «not yours» get the same 403');
  ok((await get('/api/homework/home?accessCode=0000&studentCode=' + KIDS.HALF.code, as(bare))).status === 401, 'a class code that is no class code: refused');
  const keyless = await home(phones.HALF, KIDS.HALF, null, '');
  ok(keyless.status === 200 && keyless.json.ruta, 'no class code at all (a kid of the level key): the session is the pass');

  section('the experiences of each level: a path of scenes, pictures under neutral names, each homework playable');
  const dN = (k) => R[k].json.ruta;
  ok(dN('NEWK').exps.length === 8 && dN('OLDK').exps.length === 8 && dN('YCTK').exps.length === 6, 'New HSK 1 and HSK 1: 8 experiences · YCT 1: 6');
  for (const k of ['NEWK', 'OLDK', 'YCTK']) {
    const r = dN(k);
    ok(r.exps.every((e) => e.world && /^\/ruta-exp\/[a-z0-9]+\/\d+\.webp\?v=/.test(e.pic || '') && e.peek.length >= 1 && e.peek.length <= 4 && e.peek.every((u) => /^\/ruta-exp\/[a-z0-9]+\/\d+-\d\.webp\?v=/.test(u))),
      k + ': each experience has its pack world, its picture and 1-4 word pictures, all by number (never the pinyin file names)');
    const pics = r.exps.flatMap((e) => [e.pic].concat(e.peek));
    let served = 0;
    for (const u of pics.slice(0, 6)) { const g = await get(u); if (g.status === 200 && /image\/webp/.test(g.headers['content-type'] || '') && g.size > 500) served++; }
    ok(served === Math.min(6, pics.length), k + ': the pictures are served (webp)');
    ok(r.open === true && /\/clave$/.test(r.key) && r.route === '/audios/' + r.slug, k + ': La Base and El Entrenamiento open for this kid, the key and the module page named');
  }
  ok((await get('/ruta-exp/newhsk1/1-9.webp')).status === 404 && (await get('/ruta-exp/newhsk1/1-0.webp')).status === 404, '… nothing else by that address');
  const nm = dN('NEWK');
  ok(nm.hws.length === NEWHW.length && nm.hws.every((h) => nm.media[h.id] && nm.media[h.id].tracks.length === 3 && nm.media[h.id].tracks.every((t) => /^\/assets\/audios\//.test(t.src) && t.kind && t.dur > 0)),
    'New HSK 1: each homework comes with its three tracks (light: address, kind, length), to play it in its experience');
  ok(!JSON.stringify(nm.media).includes('"items"') && !JSON.stringify(nm.media).includes('"segs"'), '… never the lines (the homework page keeps them)');
  ok(dN('OLDK').extra.pinyin && dN('OLDK').extra.pinyin.open && dN('OLDK').extra.pinyin.best === 60 && dN('OLDK').extra.simulacro && dN('OLDK').extra.simulacro.open === false,
    'HSK 1: Pinyin básico open (60 %), the exam\'s practice world closed until every world is open');
  ok(dN('DONE').extra.simulacro.open === true && dN('DONE').dorado.open, '… open once every world is (El Simulacro Dorado earned)');

  section('«Hoy» on the home: the kid\'s ladder, from the SAME plan as Papás (homework first for the parents)');
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nbsp = (h) => h.replace(/ /g, ' ');
  for (const k of ['NEWK', 'HALF', 'PRAC', 'WORD', 'DONE', 'GOLD', 'YCTK', 'OLDK']) {
    const d = R[k].json;
    const ins = await get('/api/homework/insights/' + KIDS[k].code + '?accessCode=' + CLASS[KIDS[k].level], as(phones[k]));
    const pp = ins.json && ins.json.ruta && ins.json.ruta.plan;
    const m = H.model(d, ST[k], null);
    const t = Plan.today(Plan.plan(d.ruta));
    const bare = (o) => Object.assign({}, o, { href: undefined, wa: undefined });
    ok(pp && same(pp.focus, d.ruta.plan.focus), k + ': the home\'s plan and Papás\' plan say the same («' + (pp && pp.focus.kind) + '»)');
    ok(m.hoy && same(bare(m.hoy), bare(t)), k + ': the home\'s «Hoy» is today() of that plan («' + t.kind + '»)');
    const html = H.htmlFor(d, ST[k], '', false);
    ok(nbsp(html).includes(escH(t.text)), k + ': the phone shows «' + t.text + '»');
    ok(html.includes('<span>' + escH(t.go) + '</span>'), k + ': its button says what it does («' + t.go + '»)');
    ok(!t.remind || (nbsp(html).includes(escH(t.remind.text)) && (t.remind.exp ? html.includes('data-act="remind" data-exp="' + t.remind.exp + '"') : true)),
      k + ': a homework due rides along as one line' + (t.remind ? ' («' + t.remind.text + '»)' : ' (none)'));
    ok(!/\d %/.test(html), k + ': «N %» never splits over two lines (a no-break space)');
    const glow = t.kind === 'teacher' ? /md-gold is-today/.test(html) && /Avisa a tu profe/.test(html)
      : t.dorado ? /md-gold is-done/.test(html) && /Aprobado/.test(html) && !/md-gold is-today/.test(html)
        : t.exp ? html.includes('class="md-node is-today') && new RegExp('href="#exp-' + t.exp + '"[^>]*data-node').test(html.slice(html.indexOf('md-node is-today') - 200)) : true;
    ok(glow, k + ': the path shows it on ' + (t.kind === 'teacher' ? 'El Simulacro Dorado («Avisa a tu profe»)' : t.dorado ? 'El Simulacro Dorado (✓ «Aprobado», never «¡Empieza aquí!»)' : 'Experiencia ' + t.exp));
    if (t.exp && t.step) {
      const page = H.htmlFor(d, ST[k], '#exp-' + t.exp, false);
      ok(new RegExp('class="md-step is-next" id="md-step-' + t.step + '"').test(page), k + ': its experience opens with step ' + t.step + ' glowing «¡Empieza aquí!»');
    }
  }
  let m = H.model(R.NEWK.json, ST.NEWK, null);
  ok(R.NEWK.json.ruta.plan.focus.kind === 'tarea' && m.hoy.kind === 'words' && m.hoy.exp === 1 && m.hoy.step === 1 && m.hoy.remind && m.hoy.remind.exp === NEWHW[0].exp,
    'new kid: Papás says «the homework first»; the kid starts at experience 1, step 1, the homework as the reminder line');
  m = H.model(R.PRAC.json, ST.PRAC, null);
  ok(m.hoy.kind === 'practice' && m.hoy.exp === 3 && m.hoy.step === 2 && m.hoy.go === 'Practicar aquí', 'homework all sent: practice experience 3 (step 2, «Practicar aquí»)');
  m = H.model(R.DONE.json, ST.DONE, null);
  ok(m.hoy.kind === 'teacher' && m.hoy.wa && m.dorado.ready && m.dorado.tell && m.doneN === 8, 'all done: «Avisar a mi profe» (WhatsApp), El Simulacro Dorado ready');
  ok(/class="md-go is-wa" href="https:\/\/wa\.me\/\?text=/.test(H.htmlFor(R.DONE.json, ST.DONE, '', false)), '… «Hoy»\'s button opens the WhatsApp message itself');
  const dorHtml = H.htmlFor(R.DONE.json, ST.DONE, '#dorado', false);
  ok(/https:\/\/wa\.me\/\?text=/.test(dorHtml) && /Valentina Prueba/.test(decodeURIComponent((dorHtml.match(/wa\.me\/\?text=([^"]+)/) || [])[1] || '')) && /data-act="copy-msg"/.test(dorHtml),
    '… El Simulacro Dorado: the WhatsApp message with the kid\'s name, and «Copiar mensaje»');
  ok(!/yct-sim\.html|hsk-sim\.html|\/sim-media\//.test(dorHtml) && /En clase, con tu profe/.test(dorHtml), '… class mode: no simulation starts from the kid\'s phone');
  m = H.model(R.GOLD.json, ST.GOLD, null);
  ok(m.dorado.passed && /\/audios\/newhsk1\/libro\/2/.test(H.htmlFor(R.GOLD.json, ST.GOLD, '#dorado', true)), 'a simulation passed in class: its golden book on El Simulacro Dorado');
  ok(m.hoy.go === 'Ver mi libro dorado' && /\/audios\/newhsk1\/libro\/2/.test(m.hoy.href || ''), '… «Hoy»: «Ver mi libro dorado» opens that book');

  section('El Simulacro Dorado: one clean list (review 2026-10-18)');
  const gDor = H.htmlFor(R.GOLD.json, ST.GOLD, '#dorado', false);
  ok(/md-dor-state is-done/.test(gDor) && /Aprobado/.test(gDor) && /Tus simulacros/.test(gDor) && (gDor.match(/class="md-book-n/g) || []).length === 1,
    'passed: ✓ «Aprobado» on top, «Tus simulacros» lists each simulation taken (its latest try)');
  ok(!/Sin errores/.test(gDor), '… never «¡Sin errores!» beside a %');
  for (const k of ['NEWK', 'OLDK', 'YCTK', 'GOLD', 'DONE']) {
    const dd = H.htmlFor(R[k].json, ST[k], '#dorado', false) + H.htmlFor(R[k].json, ST[k], '#dorado', true);
    ok(!/Mis exámenes|data-exams-mount/.test(dd), k + ': no second «Mis exámenes» block');
    ok(!/Simulación|maestra/.test(dd) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(dd), k + ': «Simulacro», «tu profe», no emoji');
  }
  const nDor = H.htmlFor(R.NEWK.json, ST.NEWK, '#dorado', false);
  ok((nDor.match(/<details class="md-folder"/g) || []).length === 1 && /De tu profe · Practica el examen/.test(nDor) &&
    ST.NEWK.assignments.every((a) => nDor.includes('data-assignment-id="' + a.id + '"')), 'New HSK 1: its Simulacro rounds in ONE folder «De tu profe · Practica el examen»');
  ok(nDor.indexOf('Se abre en clase') > nDor.indexOf('md-folder'), '… «Se abre en clase…» under the open cards, never above them');
  const oDor0 = H.htmlFor(R.OLDK.json, ST.OLDK, '#dorado', false);
  const fOld = oDor0.slice(oDor0.indexOf('<details class="md-folder"'), oDor0.indexOf('</details>', oDor0.indexOf('<details class="md-folder"')));
  ok(/data-act="reading" data-story="pinpin"/.test(fOld), 'HSK 1: its «Exámenes de lectura» in that same folder');

  section('an experience: one ladder, the teacher\'s work after it, done states that agree');
  const nE1 = H.htmlFor(R.NEWK.json, ST.NEWK, '#exp-1', false);
  const li2 = nE1.slice(nE1.indexOf('id="md-step-2"'), nE1.indexOf('</li>', nE1.indexOf('id="md-step-2"')));
  ok(/md-step is-closed/.test(nE1) && !/class="md-btn/.test(li2) && /Se abre cuando marques todas sus palabras/.test(li2), 'a locked step: a lock and one plain line, no button');
  ok(!/class="md-step-t">\d · /.test(nE1) && (nE1.match(/class="md-step-n/g) || []).length === 3, 'each step\'s number once (its circle; never «1 · Palabras» too)');
  const y2 = H.htmlFor(R.YCTK.json, ST.YCTK, '#exp-2', false);
  ok(!/id="md-step-3"/.test(y2) && (y2.match(/class="md-step-n/g) || []).length === 2, 'YCT 1 (no homework audio): no step 3');
  ok(y2.indexOf('md-exp-profe') > y2.indexOf('</ol>') && /Preguntas de tu profe/.test(y2), '… the teacher\'s rounds after the steps («Preguntas de tu profe»), never inside a locked card');
  const o1 = H.htmlFor(R.OLDK.json, ST.OLDK, '#exp-1', false);
  ok(/Tu profe te dejó \d+ más/.test(o1) && !/data-party/.test(o1) && !/¡Experiencia lista!/.test(o1), 'HSK 1 experience 1 (3 steps done, new teacher work listed): «Tu profe te dejó N más», no celebration');
  ok(!/\bTier\b|\bEXP\s?\d/.test(o1) && /Preguntas del simulacro · /.test(o1), '… words a parent reads: «Preguntas del simulacro», never «Tier 1» or «EXP1»');
  const h1 = H.htmlFor(R.HALF.json, ST.HALF, '#exp-1', false);
  ok(/¡Qué crack! Tu profe ya tiene tus videos/.test(h1), 'every homework of the experience sent: Aileen «¡Qué crack! Tu profe ya tiene tus videos»');
  const h5 = H.htmlFor(R.HALF.json, ST.HALF, '#exp-5', false);
  ok(/md-step-n is-soon/.test(h5) && /Sin tarea todavía/.test(h5), 'no homework yet: step 3 «Sin tarea todavía» (dotted), never under a green ✓ without saying so');
  const hHome = H.htmlFor(R.HALF.json, ST.HALF, '', false);
  ok(/<i class="is-na"><\/i>sin tarea todavía/.test(hHome) && /\d+ de \d+ listas/.test(hHome), 'the path: the dotted bar explained («sin tarea todavía»), a short count («N de M listas»)');
  ok(!/md-ruta-all|Ver toda La Ruta Dorada/.test(hHome + H.htmlFor(R.HALF.json, ST.HALF, '', true)), 'no «Ver toda La Ruta Dorada» (the home IS the route)');
  const strip = hHome.slice(hHome.indexOf('class="md-strip"') - 10, hHome.indexOf('</section>', hHome.indexOf('class="md-strip"')));
  ok(/md-strip/.test(hHome) && strip.includes('data-assignment-id="' + CUSTOM_ID + '"') && hHome.indexOf('md-strip') < hHome.indexOf('md-ruta'), '«De tu profe»: one line right under «Hoy», its «Hacer» there');
  const deep = JSON.parse(JSON.stringify(ST.OLDK));
  deep.assignments = deep.assignments.concat([{ id: 'x-exp12', title: 'EXP12 · Otra cosa', expLabel: 'exp12', type: 'sentence-building', itemCount: 3 }]);
  const tDeep = H.mapTareas(R.OLDK.json, deep);
  ok(tDeep.loose.some((x) => x.id === 'x-exp12') && !tDeep.byExp[12], 'an «EXP12» above the level\'s 8 experiences: «De tu profe» under «Hoy», never a bucket nobody draws');

  section('no route on this phone (an expired session, another class code): the tabs and the dock stay');
  const noR = Object.assign({}, R.HALF.json, { ruta: null });
  const nrPhone = H.htmlFor(noR, ST.HALF, '', false), nrWide = H.htmlFor(noR, ST.HALF, '', true);
  ok(/class="md-tabs"/.test(nrPhone) && /Toca «Entrar de nuevo»|toca «Entrar de nuevo»/.test(nrPhone) && !/clave de tu nivel/.test(nrPhone), 'a phone: «Toca «Entrar de nuevo»», the tabs');
  ok(/class="md-dock"/.test(nrWide) && /md-msgs/.test(nrWide), 'a laptop: the dock, and the messages beside');
  ok(/class="md-tabs"/.test(H.htmlFor(noR, ST.HALF, '#mensajes', false)) && /md-msgs/.test(H.htmlFor(noR, ST.HALF, '#mensajes', false)), '… Mensajes still opens');
  // the bars: words / practice / homework of the halfway kid
  m = H.model(R.HALF.json, ST.HALF, null);
  const e1 = m.exps[0], e3 = m.exps[2];
  ok(e1.done && same(e1.bars, { words: 'done', practice: 'done', tarea: 'done' }), 'halfway kid: experience 1 done (three green bars)');
  ok(same(e3.bars, { words: 'done', practice: 'half', tarea: 'half' }) && !e3.done && e3.left >= 1, '… experience 3: words done, practice started (55 %), homework heard not sent');
  ok(m.exps[4].bars.words === 'none' && m.exps[4].bars.tarea === 'na' && !m.exps[4].started, '… experience 5: not started, no homework yet (its third bar «pronto»)');
  const yPath = H.htmlFor(R.YCTK.json, ST.YCTK, '', false);
  const yOl = yPath.slice(yPath.indexOf('<ol class="md-path"'), yPath.indexOf('</ol>', yPath.indexOf('<ol class="md-path"')));
  ok((yOl.match(/<i class="is-/g) || []).length === 6 * 2, 'YCT 1 (no homework audio yet): two bars per experience');

  section('«N días seguidos» on the kid\'s own calendar (the phone\'s time zone, review 2026-10-18)');
  for (const k of ['TZMX', 'TZKI', 'TZPP']) {
    const kid = KIDS[k];
    const h0 = await get('/api/homework/home?accessCode=&studentCode=' + kid.code + '&tz=' + encodeURIComponent(kid.tz), as(phones[k]));
    ok(h0.json && same(h0.json.streak, { days: 3, today: false }), k + ' (' + kid.tz + '): yesterday on their own calendar = «3 días seguidos» (got ' + JSON.stringify(h0.json && h0.json.streak) + ')');
    await post('/api/ruta/seals', { level: 'hsk2', add: [9] }, as(phones[k]));
    ok(same((await home(phones[k], kid)).json.streak, { days: 4, today: true }), k + ': a step today keeps the streak: 4');
  }
  ok((await get('/api/homework/home?accessCode=&studentCode=' + KIDS.TZMX.code + '&tz=Mars%2FBase', as(phones.TZMX))).status === 200, 'an unknown time zone is ignored (no harm)');
  const dl = await post('/api/homework/daily/complete', { accessCode: CLASS.hsk2, studentCode: KIDS.PRAC.code, date: '2099-01-01', correct: 3 }, as(phones.PRAC));
  ok(dl.json && dl.json.ok === false && dl.json.reason === 'baddate', 'the daily: a phone date far from the server\'s is refused («baddate»)');

  section('«N días seguidos»: a real step counts once a day, a missed day starts again');
  ok(same(R.HALF.json.streak, { days: 4, today: false }), 'yesterday was day 4: «4 días seguidos» (not today yet)');
  ok(same(R.GAPK.json.streak, { days: 0, today: false }), 'three days ago: 0 (an old streak never shows)');
  const sealA = await post('/api/ruta/seals', { level: 'hsk2', add: [200] }, as(phones.HALF));
  ok(sealA.json && sealA.json.ok && same((await home(phones.HALF, KIDS.HALF)).json.streak, { days: 5, today: true }), 'a seal today: 5, today');
  await post('/api/ruta/seals', { level: 'hsk2', add: [201] }, as(phones.HALF));
  ok(same((await home(phones.HALF, KIDS.HALF)).json.streak, { days: 5, today: true }), 'a second step the same day counts once');
  const mk = await post('/api/ruta/tareas', { sent: [NEWHW[0].id] }, as(phones.GAPK));
  ok(mk.json && mk.json.ok && same((await home(phones.GAPK, KIDS.GAPK)).json.streak, { days: 1, today: true }), 'after a gap, a homework mark starts again at 1');
  ok(same((await home(phones.NEWK, KIDS.NEWK)).json.streak, { days: 0, today: false }), 'a page view (the home itself) never counts');

  section('the teacher\'s tareas, each in its experience (nothing of the old folders lost)');
  const total = (t) => Object.values(t.byExp).reduce((s, l) => s + l.length, 0) + t.dorado.length + t.loose.length;
  // YCT 1: one game round tarea per pack round, by world = experience; the exam's rounds in El Simulacro Dorado
  let t = H.mapTareas(R.YCTK.json, ST.YCTK);
  const yRounds = (w) => ST.YCTK.assignments.filter((a) => a.expLabel === w).length;
  const yWorlds = R.YCTK.json.ruta.exps.map((e) => e.world);
  ok(yWorlds.join() === 'familia,espejo,mascotas,comida,numeros,escuela', 'YCT 1: experiences 1-6 = the pack\'s worlds in order (' + yWorlds.join(', ') + ')');
  ok(yWorlds.every((w, i) => (t.byExp[i + 1] || []).length === yRounds(w) && t.byExp[i + 1].every((x) => x.kind === 'asg')), '… each world\'s game rounds are in its experience');
  ok(t.dorado.length === yRounds('simulacro') && t.dorado.length === 10 && t.loose.length === 0, '… the 10 «Simulacro del examen» rounds in El Simulacro Dorado');
  ok(total(t) === ST.YCTK.assignments.length, '… every one of the ' + ST.YCTK.assignments.length + ' tareas has a place');
  // without the server's experiences (no session): the folders' order gives the same experiences
  const t2 = H.mapTareas(null, ST.YCTK);
  ok(same(Object.keys(t2.byExp).map((n) => [n, t2.byExp[n].length]), Object.keys(t.byExp).map((n) => [n, t.byExp[n].length])), '… the same mapping from the login\'s folders alone');
  // New HSK 1: its homework is the exam's rounds (core/levels.js onlyPackTareas)
  t = H.mapTareas(R.NEWK.json, ST.NEWK);
  ok(ST.NEWK.assignments.length === 4 && t.dorado.length === 4 && total(t) === 4, 'New HSK 1: its 4 exam rounds are in El Simulacro Dorado');
  // HSK 1: EXP1-8 sentence tareas → experience N; the Sim-Trainer's tiers of EXPn → experience N
  t = H.mapTareas(R.OLDK.json, ST.OLDK);
  const tm = ST.OLDK.trainer;
  ok(tm && Array.isArray(tm.tiers) && tm.tiers.length >= 1, 'HSK 1: the Sim-Trainer\'s tiers came (' + (tm ? tm.tiers.length : 0) + ')');
  const tierCells = tm ? tm.tiers.reduce((s, tier) => s + Object.values((tm.matrix || {})['t' + tier.tier] || {}).filter((c) => c > 0).length, 0) : 0;
  const trainerIn = Object.values(t.byExp).flat().filter((x) => x.kind === 'trainer');
  ok(tierCells > 0 && trainerIn.length === tierCells && trainerIn.every((x) => (t.byExp[Number(x.exp.slice(3))] || []).includes(x)), '… each tier of each experience is a card of that experience (' + tierCells + ')');
  ok(ST.OLDK.assignments.every((a) => (t.byExp[Number(a.expLabel.slice(3))] || []).some((x) => x.id === a.id)), '… each EXPn sentence tarea is in experience N');
  ok(total(t) === ST.OLDK.assignments.length + tierCells, '… nothing else, nothing missing');
  // custom tareas: «De tu profe» under «Hoy»
  t = H.mapTareas(R.HALF.json, ST.HALF);
  ok(t.loose.length === 1 && t.loose[0].id === CUSTOM_ID && t.loose[0].kind === 'custom', 'a custom tarea of the teacher: «De tu profe» under «Hoy»');
  ok(H.htmlFor(R.HALF.json, ST.HALF, '', false).includes('data-assignment-id="' + CUSTOM_ID + '"'), '… with its button on the home');
  // reading tests: El Simulacro Dorado («Exámenes de lectura» + «Ver mis errores»)
  t = H.mapTareas(R.OLDK.json, ST.OLDK);
  const oDor = H.htmlFor(R.OLDK.json, ST.OLDK, '#dorado', false);
  ok(t.readings.some((x) => x.storyId === 'pinpin' && x.exp === 'exp1') && /data-act="reading" data-story="pinpin"/.test(oDor) && /data-act="reading-review" data-story="pinpin"/.test(oDor),
    'a reading test tried in class: «Exámenes de lectura» in El Simulacro Dorado, with «Ver mis errores»');

  section('every tarea is reachable from a screen of the home');
  for (const k of ['YCTK', 'NEWK', 'OLDK', 'HALF']) {
    const d = R[k].json, s = ST[k];
    const views = [''].concat(d.ruta.exps.map((e) => '#exp-' + e.n), ['#dorado']);
    const htmlAll = views.map((v) => H.htmlFor(d, s, v, false) + H.htmlFor(d, s, v, true)).join('\n');
    const miss = s.assignments.filter((a) => !htmlAll.includes('data-assignment-id="' + a.id + '"'));
    ok(!miss.length, k + ': every tarea has its button (' + s.assignments.length + (miss.length ? '; missing ' + miss.map((a) => a.id).join(', ') : '') + ')');
    if (s.trainer) {
      const cells = [];
      s.trainer.tiers.forEach((tier) => Object.keys((s.trainer.matrix || {})['t' + tier.tier] || {}).forEach((exp) => { if (s.trainer.matrix['t' + tier.tier][exp] > 0) cells.push('data-tier="' + tier.tier + '" data-exp="' + exp + '"'); }));
      ok(cells.every((c) => htmlAll.includes(c)), k + ': every tier of every experience has its button (' + cells.length + ')');
    }
    ok(d.ruta.hws.every((h) => htmlAll.includes('data-hw-mount="' + h.exp + '"')), k + ': every homework audio\'s experience has its «3 · Tu tarea» cards');
  }
  ok(/class="md-also"[^>]*>También: Pinyin básico/.test(H.htmlFor(R.OLDK.json, ST.OLDK, '#exp-1', false)), 'HSK 1: «Pinyin básico» from experience 1\'s practice');

  section('the old portal\'s doors: each one has its place now');
  const html = read('public/homework.html');
  const js = read('public/js/mi-dralingo.js');
  const hw = read('public/js/homework.js');
  const css = read('public/css/mi-dralingo.css');
  const list = html.slice(html.indexOf('<div id="screen-list"'), html.indexOf('<!-- SCREEN: DIARIO'));
  const perfil = html.slice(html.indexOf('<div id="screen-settings"'), html.indexOf('<!-- SCREEN: PAPÁS'));
  const hNEW = H.htmlFor(R.HALF.json, ST.HALF, '', false), hWIDE = H.htmlFor(R.HALF.json, ST.HALF, '', true);
  const DOORS = [
    ['hero + HUD (XP, swords, streak)', /md-streak/.test(js) && /días seguidos/.test(js) && !/id="hw-hud"/.test(html), 'the band keeps «N días seguidos»; XP / swords stay on the account (/api/homework/daily)'],
    ['🔑 code pill', !/'hw-pin-stack'/.test(hw.replace(/getElementById\('hw-pin-stack'\)/g, '')) && /id="hw-settings-code"/.test(perfil), 'Mi perfil: the code + «Copiar mi código»'],
    ['▶ Siguiente', /class="md-hoy"/.test(hNEW) && /data-act="today"/.test(hNEW) && /window\.DralyHome\.next/.test(hw), '«Hoy» and its button («Marcar mis palabras», «Practicar aquí»…); a round\'s «▶ Siguiente» = the next tarea of its experience'],
    ['«La Ruta Dorada de X» card', /class="md-path"/.test(hNEW) && /class="md-pf-link" href="\/audios"/.test(perfil), 'the home IS the route; every level of La Ruta Dorada from Mi perfil («Ver todos los niveles»)'],
    ['«Hacer mis tareas» (both doors)', /data-hw-mount/.test(H.htmlFor(R.HALF.json, ST.HALF, '#exp-3', false)) && /Ruta\.hwCards/.test(js), 'each experience\'s «3 · Tu tarea» (js/ruta.js cards and marks)'],
    ['dock: Desafíos', /href="#desafio"/.test(hNEW) && /href="#desafio"/.test(hWIDE) && /openDaily: \(\) => openDaily\(\)/.test(hw), 'the Desafío tab («Muy pronto»; the old daily code behind DESAFIO_LIVE)'],
    ['dock: Mensajes', /href="#mensajes"/.test(hNEW) && /href="#mensajes"/.test(hWIDE), 'the Mensajes tab / tile'],
    ['dock: Mis oraciones', /href="#oraciones"/.test(hNEW) && /id="hw-sentences-list"/.test(list) && /loadSentences: \(\) => loadMySentences\(\)/.test(hw), 'the Oraciones tab (Mías / De tu profe)'],
    ['dock: Mis exámenes', /Tus simulacros/.test(js) && /class="md-books"/.test(H.htmlFor(R.GOLD.json, ST.GOLD, '#dorado', false)), 'El Simulacro Dorado: «Tus simulacros», each with its % and its libro dorado (one list)'],
    ['pill: Papás', /data-act="papas"/.test(hNEW) && /openParents: \(\) => openParentView\(\)/.test(hw), 'the band\'s «Papás»'],
    ['pill: Ajustes', /href="#perfil"/.test(hNEW) && /openPerfil: \(\) => openSettings\(\)/.test(hw), 'Mi perfil (the band, the avatar)'],
    ['pill: Instalar app', /data-pwa-install/.test(perfil), 'Mi perfil: «Instalar la app de Dralingo»'],
    ['pill: Salir', /id="hw-list-logout"/.test(perfil) && /confirmOut\(hwKeyMode\)/.test(hw), 'Mi perfil: «Salir» with «¿Salir de tu cuenta en este teléfono?»'],
    ['tabs Pendientes / Completadas / Tu Maestro', !/hw-tab-pending|hw-tab-done|hw-tab-custom/.test(html + hw) && /md-tp-chip is-done/.test(js), 'each tarea in its experience, done = green ✓; custom tareas: «De tu profe» under «Hoy»'],
    ['folder cards (YCT 1 rounds, New HSK 1 Simulacro rounds, HSK 1 EXP tareas)', /mapTareas/.test(js), 'the experiences\' «De tu profe» and El Simulacro Dorado (checked above, per level)'],
    ['«Exámenes de lectura» + «Ver mis errores»', /data-act="reading-review"/.test(oDor) && /data-act="review"/.test(js), 'El Simulacro Dorado; «Ver mis errores» on every tarea tried'],
    ['HSK 1 «Entrenamiento de Simulación» tiers', /data-act="trainer"/.test(js) && /openTrainer: \(tier, exp\) => openTrainer\(tier, exp\)/.test(hw), '«Preguntas del simulacro» cards in their experience'],
    ['🌐 English pill', /id="md-pf-en"/.test(perfil) && /window\.HwI18n = /.test(read('public/js/hw-i18n.js')) && /body\.md-in #hw-lang-toggle \{ display: none !important; \}/.test(css), 'Mi perfil\'s «English» switch (the floating pill steps aside on the home)'],
    ['«Borrar puntajes»', /id="hw-settings-reset-list"/.test(perfil) && /confirm\(`¿Borrar tus puntajes/.test(hw), 'Mi perfil, behind its confirm'],
    ['«Abrir otro nivel»', /id="hw-settings-level-key"/.test(perfil) && /id="hw-settings-level-btn"/.test(perfil), 'Mi perfil (POST /api/entrada/nivel, js/entrada.js)'],
    ['«Cambiar mi nombre» / «Cambiar mi avatar»', /id="hw-settings-name-input"/.test(perfil) && /id="hw-settings-avatar-grid"/.test(perfil), 'Mi perfil'],
    ['«¿Cómo te llamas?» on the home', /md-askname/.test(js), 'the band\'s link to Mi perfil\'s name'],
    ['the welcome moment', /HwPortal\.welcome/.test(hw) && /ptWelcome\(\);/.test(hw), 'js/portal.js after the entrance, once per visit'],
    ['the inbox toast', /window\.DralyHome\.go\('mensajes'\)/.test(hw), 'a tap opens Mensajes'],
    ['La Ruta Dorada\'s module page (/audios/<level>)', /kidIn\(ctx\)/.test(read('public/js/ruta.js')) && /label: 'Mi Dralingo'/.test(read('public/js/ruta.js')), 'stays for PDFs and WhatsApp links; for a logged-in kid its way back is «Mi Dralingo»'],
  ];
  DOORS.forEach(([old, cond, now]) => ok(!!cond, 'old door «' + old + '» → ' + now));
  ok(!/id="pt-next"|id="pt-base"|id="hw-tabs"|id="hw-list-grid"|id="hw-folder-bar"|id="hw-list-daily"|id="hw-list-inbox"|id="hw-list-settings"|id="hw-list-myexams"/.test(html),
    'the old home\'s doors are gone from the page (▶ Siguiente, the Ruta card, the tabs, the folders, the dock, the pills)');
  ok(!/Hacer mis tareas/.test(html.replace(/<!--[\s\S]*?-->/g, '') + hw.replace(/\/\/.*$/gm, '')) && !/'La Ruta Dorada de ' \+/.test(hw), '… no «Hacer mis tareas» and no «La Ruta Dorada de <nivel>» card left');

  section('Desafío del día: «Muy pronto», the old daily challenge behind its flag');
  ok(/const DESAFIO_LIVE = false;/.test(js) && S.DralyHome.DESAFIO_LIVE === false, 'DESAFIO_LIVE is false');
  const des = H.htmlFor(R.OLDK.json, ST.OLDK, '#desafio', false);
  ok(/Muy pronto/.test(des) && /Los juegos de la clase llegan a tu casa/.test(des) && /hamdan-cheer/.test(des) && /dragon\/fly-blue-mid/.test(des) && /data-act="today"/.test(des),
    '«Muy pronto: los juegos de la clase llegan a tu casa», the pin-game art, Hamdan, and a button that does today\'s step');
  ok(/id="screen-daily"/.test(html) && /function openDaily\(\)/.test(hw) && /app\.post\('\/api\/homework\/daily\/complete'/.test(read('server.js')), '… the daily challenge\'s screen, code and server are kept');

  section('Mi perfil: the code (only here), its actions');
  ok(/Mi código de alumno/.test(perfil) && /Copiar mi código/.test(perfil) && /id="hw-settings-code-copy"/.test(perfil), 'the code with «Copiar mi código»');
  const ren = await post('/api/homework/rename', { accessCode: '', studentCode: KIDS.HALF.code, displayName: 'Mateo Nuevo' }, as(phones.HALF));
  ok(ren.json && ren.json.ok && ren.json.displayName === 'Mateo Nuevo', '«Cambiar mi nombre» saves (the session is the pass)');
  const av = await post('/api/homework/avatar', { accessCode: '', studentCode: KIDS.HALF.code, avatar: 'camel' }, as(phones.HALF));
  ok(av.json && av.json.ok, '«Cambiar mi avatar» saves');
  const rs = await post('/api/homework/reset', { accessCode: '', studentCode: KIDS.HALF.code, assignmentId: 'nothing-yet' }, as(phones.HALF));
  ok(rs.json && rs.json.ok && rs.json.removed === 0, '«Borrar mis puntajes» answers (and asks first on the page)');
  const lv = await post('/api/entrada/nivel', { key: KEYS.yct1 }, as(phones.WORD));
  ok(lv.json && lv.json.ok && lv.json.moved && lv.json.levelName === 'YCT 1', '«Abrir otro nivel» with the new key: the kid moves to YCT 1');
  const after = await home(phones.WORD, KIDS.WORD, null, '');
  ok(after.json && after.json.level === 'yct1' && after.json.ruta && after.json.ruta.exps.length === 6, '… and the home is YCT 1\'s now (6 experiences)');
  ok(api && typeof api.toggle === 'function' && api.lang() === 'en', 'the English switch: hw-i18n.js\'s HwI18n');
  const out = await post('/api/homework/logout', {}, as(phones.HALF));
  ok(out.status === 200 && (await home(phones.HALF, KIDS.HALF, null, '')).status !== 200, '«Salir» ends the session: the home asks again');

  section('no code on screen outside Mi perfil, a way back on every screen, no hanzi, never «Chinese»');
  for (const k of ['NEWK', 'PRAC', 'DONE', 'GOLD', 'YCTK', 'OLDK']) {
    const d = R[k].json, s = ST[k];
    const views = ['', '#dorado', '#mensajes', '#oraciones', '#desafio'].concat(d.ruta.exps.map((e) => '#exp-' + e.n));
    let leak = false, hanzi = false, noBack = [];
    views.forEach((v) => [false, true].forEach((w) => {
      const h = H.htmlFor(d, s, v, w);
      if (h.includes(KIDS[k].code)) leak = true;
      if (HANZI.test(h)) hanzi = true;
      if (v && !w && !/class="md-back[^"]*" href="#"/.test(h)) noBack.push(v);
    }));
    ok(!leak, k + ': the code is on no screen of the home');
    ok(!hanzi, k + ': no hanzi');
    ok(!noBack.length, k + ': every page has its «Volver» (' + (noBack.join(' ') || 'all') + ')');
  }
  ok(/<code class="md-pf-codev" id="hw-settings-code"/.test(perfil) && (html.match(/id="hw-settings-code"/g) || []).length === 1, 'the page holds the code in Mi perfil only');
  ok(!/\bChinese\b/.test(js + list + perfil), 'never «Chinese»');
  ok(!HANZI.test(js) && !HANZI.test(list) && !HANZI.test(perfil), 'no hanzi in the home\'s code and markup');
  ok(/\.wu-pk-hanzi \{ display: none !important; \}/.test(css), 'the word card shows no hanzi on the home');
  ok((css.match(/min-height: 48px/g) || []).length >= 20 && !/min-height: (?:[1-3]\d|4[0-7])px/.test(css), 'tap targets 48 px (no smaller tap height in the home\'s styles)');
  ok(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'reduced motion: nothing moves');
  ok((js.match(/fetchpriority="high"/g) || []).length >= 2 && /loading="lazy"/.test(js), 'pictures lazy, except «Hoy»');

  section('every phrase of the home has its English (hw-i18n.js)');
  const missing = new Set();
  const content = new Set();
  Object.keys(KIDS).forEach((k) => { content.add(KIDS[k].name); content.add('¡Hola, ' + KIDS[k].name + '!'); });
  ['YCTK', 'NEWK', 'OLDK'].forEach((k) => {
    R[k].json.ruta.hws.forEach((h) => content.add(h.title));
    ST[k].assignments.forEach((a) => { content.add(a.title); content.add(a.title.replace(/^.+? · /, '')); content.add(a.subtitle); });

  });
  ST.OLDK.readings.forEach((x) => content.add(x.title));
  const texts = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').split(/<[^>]+>/).map((x) => x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()).filter(Boolean)
    .concat((h.match(/(?:aria-label|alt)="([^"]+)"/g) || []).map((x) => x.replace(/^[^"]+"|"$/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")));
  const settled = new Set();
  const check = (s) => {
    if (s && /[A-Za-zÀ-ÿ]/.test(s)) { const e1 = en(s); if (e1 && en(e1) !== e1) settled.add(s + ' → ' + e1 + ' → ' + en(e1)); }
    if (!s || !/[A-Za-zÀ-ÿ]/.test(s) || content.has(s) || /^[\d\s·%/.,:-]+$/.test(s)) return;
    const e = en(s);
    if (!e || (e === s && /[áéíóúñ¿¡]|\b(?:de|la|el|tu|mis?|con)\b/i.test(s)) || /[áéíóúñ¿¡]/i.test(e.replace(/«[^»]*»/g, ''))) missing.add(s);
  };
  ['NEWK', 'HALF', 'PRAC', 'WORD', 'DONE', 'GOLD', 'YCTK', 'OLDK'].forEach((k) => {
    const d = R[k].json || {}; if (!d.ruta) return;
    const views = ['', '#dorado', '#mensajes', '#oraciones', '#desafio'].concat(d.ruta.exps.map((e) => '#exp-' + e.n));
    views.forEach((v) => [false, true].forEach((w) => texts(H.htmlFor(d, ST[k], v, w)).forEach(check)));
  });
  texts((list + perfil).replace(/<!--[\s\S]*?-->/g, '')).forEach(check);
  ['Cargando tu Ruta Dorada…', 'No se pudo cargar tu Ruta Dorada. Revisa tu internet.', 'Volver a intentar', 'Para ver tu Ruta Dorada, toca «Entrar de nuevo».',
    'Algo salió mal al dibujar tu inicio.', 'Mi perfil y «Salir»', 'Tarea 2', 'Y tu tarea de esta semana: 1 por mandar.', 'Y tienes 1 tarea por mandar.', 'Y tienes 3 tareas por mandar.',
    '3 tareas nuevas', '1 nueva', '2 nuevas', '2 de 8 listas', 'Hiciste los 3 pasos. Tu profe te dejó 2 más.', 'Hiciste los 2 pasos. Tu profe te dejó 1 más.',
    'Lectura · 60 / 100', '2 lecturas', 'Preguntas como en el examen · 80 %', '¡Vas muy bien! Repasa cuando quieras.', 'Ver mi Ruta',
    'Entrar de nuevo', '¡Mensaje copiado!', 'Copiar mensaje', 'Pausa', 'Escuchada', 'Mandada', 'Nueva', 'Escuchar', 'Otra vez', '¿Fue sin querer?', 'Deshacer', 'Tarea · Ronda 2',
    'Audio 1 de 3 · Las palabras', '1 día seguido', '7 días seguidos', '1 mensaje nuevo', '3 mensajes nuevos', 'Todo leído', 'Entrar al juego con el PIN', 'Verla otra vez',
    'Escribe la clave de New HSK 1 para abrir tu Ruta Dorada.', 'Escribir la clave', 'Se abre con la clave de YCT 1.', '¡Vas muy bien! Sigue con la Experiencia 2.',
    '¡Vas muy bien! Muy pronto, tu Ruta Dorada.', '¡Hoy toca mandar tu tarea!', 'Ayer', 'Hoy', '2 hechas', '1 hecha', '3 rondas', '1 ronda', 'Libro dorado · 1 error', 'Libro dorado · 3 errores',
    '1 historia se abre cuando la lean en clase.', '2 historias se abren cuando la lean en clase.', 'Mi Dralingo · New HSK 1'].forEach(check);
  ok(!settled.size, 'English settles: a translated line translated again stays the same (no endless re-translation)' + (settled.size ? ': ' + [...settled].slice(0, 6).join(' | ') : ''));
  ok(/if \(out !== null && out !== v\) el\.setAttribute/.test(read('public/js/hw-i18n.js')), 'hw-i18n.js writes an attribute only when it changes (alt="Aileen" stays «Aileen» in English: writing it again looped forever and froze the laptop home)');
  ok(!missing.size, 'English for every phrase' +(missing.size ? ': missing ' + [...missing].slice(0, 40).map((m) => '«' + m + '»').join(', ') : ''));
  ok(en('¡Hoy toca la Experiencia 3! Practica El Restaurante Chino hasta llegar al 70 %.') === 'Today: Experience 3! Practice The Chinese Restaurant until you reach 70 %.', '… the experience\'s name is translated inside «Hoy»');
  ok(en('¡Hoy toca la Experiencia 3! Manda tu tarea de El Restaurante Chino.') === 'Today: Experience 3! Send your homework for The Chinese Restaurant.' && en('Mándala por WhatsApp') === 'Send it on WhatsApp' && en('Practicar aquí') === 'Practice here',
    '… «Send your homework for…», «Send it on WhatsApp», «Practice» (one spelling)');
  ok(!/Practise|practise/.test(read('public/js/hw-i18n.js')), '… never «Practise» next to «Practice»');

  section('the review\'s code fixes (2026-10-18)');
  const T2 = { headers: { 'CF-Connecting-IP': '198.51.100.251', 'X-Admin-Pw': encodeURIComponent(SEED) } };
  const msg = async (u) => (((await post('/api/admin/student/' + KIDS.OTHR.code + '/message', { text: 'Hola', actionType: 'link', actionUrl: u, actionLabel: 'Abrir' }, T2)).json || {}).message || {}).actionUrl;
  ok((await msg('/?pin=123')) === '/?pin=123' && (await msg('https://example.com/x')) === 'https://example.com/x', 'a message\'s link: a page of this site or https:// is kept');
  ok((await msg('javascript:alert(1)')) === null && (await msg('//example.com')) === null && (await msg('/\\example.com')) === null && (await msg('http://example.com')) === null,
    '… javascript:, //host, /\\host and http:// are dropped when the teacher sends it');
  ok(/\/\^\\\/\(\?!\[\\\/\\\\\]\)\//.test(js) && /\/\^\\\/\(\?!\[\\\/\\\\\]\)\//.test(hw), '… and both pages (the home\'s Mensajes, Papás\' message sheet) show only those links');
  ok(/function redraw\(\)/.test(js) && /p && !p\.paused && cards\) \{ soft\(\); return; \}/.test(js) && /redraw\(\);\n?\s*\}\);/.test(js.replace(/\r/g, '')), 'a fresh answer never cuts a homework audio that is playing (load → redraw → soft)');
  ok(/const sig = sigOf\(H\.state\(\)\.inbox, n\);/.test(js) && /if \(sig === inboxSig\) return;/.test(js), 'the 20-second inbox poll redraws Mensajes only when something changed');
  ok(/function brokenHtml\(\)/.test(js) && /catch \(err\) \{\s*console\.error\('\[home\] draw failed'/.test(js), 'a failure while drawing keeps the band, Mi perfil, «Volver a intentar»');
  ok(/My Dralingo/.test(js), 'the tab\'s title in English mode: «My Dralingo»');
  ok(/if \(name === 'entry' \|\| name === 'avatar'\) document\.body\.classList\.remove\('md-in'\)/.test(hw), 'the entry screen back: body.md-in comes off');
  ok(/Levels\.info\(LevelKeys\.classLevel\(rec\) \|\| rec\.level \|\| Levels\.DEFAULT\)/.test(read('server.js')), '/api/homework/home reads the level like the login (LevelKeys.classLevel)');
  ok(/auto: !!\(rec && _autoUnclaimed\(rec\) && _autoNameless\(rec\)\)/.test(read('server.js')) && /!ctx\.ruta\.auto\)/.test(read('public/js/ruta.js')),
    'the module page: no «Mi Dralingo» way back for an unclaimed nameless automatic account');
  ok(/function kidToday\(/.test(read('public/js/ruta.js')) && /else if \(T\) say = T\.text;/.test(read('public/js/ruta.js')) && /simLast: /.test(read('server.js')),
    'the module page\'s bubble = today() (the same words as «Hoy»)');
}

function pageTests() {
  section('the page loads the home');
  const html = read('public/homework.html');
  ok(/\/css\/mi-dralingo\.css\?v=\w+/.test(html) && /\/js\/mi-dralingo\.js\?v=\w+/.test(html) && /\/js\/ruta\.js\?v=\w+/.test(html), 'homework.html loads css/mi-dralingo.css, js/ruta.js and js/mi-dralingo.js (with ?v=)');
  ok(html.indexOf('/js/mi-dralingo.js') < html.indexOf('/js/homework.js') && html.indexOf('/js/papas.js') < html.indexOf('/js/mi-dralingo.js'), '… after js/papas.js, before js/homework.js');
  ok(/id="au-player"/.test(html) && /id="au-say"/.test(html), '… the one <audio> the homework cards play with');
  ok(/window\.DralyHome\.render\(HOME\)/.test(read('public/js/homework.js')), 'homework.js hands its hooks to the home');
  ok(/hwCards/.test(read('public/js/ruta.js')) && /function hwAct\(/.test(read('public/js/ruta.js')), 'js/ruta.js: one code for the homework cards («Tus tareas» and the home)');
  const ent = read('public/js/entrada.js');
  ok(/draly_home_in/.test(ent) && /backHome\(\)/.test(ent), 'back from a trip (La Base, El Entrenamiento…) in the same tab: straight into the home, no second «¡Hola de nuevo!»');
  ok(/draly_home_from/.test(read('public/js/entrenamiento.js')) && /draly_home_from/.test(read('public/js/libro.js')) && /draly_home_from/.test(read('public/js/audios.js')), '… El Entrenamiento, the golden book and a homework page opened from the home go back to it');
  const au = read('public/audios.html');
  ok(au.indexOf('/js/papas-plan.js') > 0 && au.indexOf('/js/papas-plan.js') < au.indexOf('/js/ruta.js'), 'the module page loads js/papas-plan.js before js/ruta.js (its bubble = today())');
  ok(/tz: TZ/.test(ent) && /&tz=/.test(read('public/js/mi-dralingo.js')), 'la entrada\'s POSTs and the home\'s load carry the phone\'s time zone');
}

(async () => {
  let crashed = false;
  try { todayTests(); pageTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  await startServer();
  try { await serverTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  else console.log('(server left running on port ' + PORT + ', data in a temp folder)');
  if (!crashed) {
    const codes = Object.values(KIDS).map((k) => k.code);
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
    ok(!codes.some((c) => new RegExp('\\b' + c + '\\b').test(allLog)), 'no kid\'s code in the server log');
    ok(!/\[home\] (ruta )?failed/.test(allLog), 'the server never failed building the home');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-home: ${failed} FAILED, ${passed} passed` : `test-home: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
